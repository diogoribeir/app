/* ============================================================
   Exile Forge — leitor da PoE2 Wiki dentro do app
   ------------------------------------------------------------
   Usa a API do MediaWiki da poe2wiki.net direto do navegador do
   celular (action=parse / action=opensearch com origin=* → CORS
   anônimo). O HTML da wiki NUNCA entra na página: é lido num
   documento inerte (DOMParser) e convertido em blocos de texto
   (títulos, parágrafos, listas, tabelas) com links internos —
   a tela é montada com textContent. Cache no localStorage por
   7 dias para ler offline. Conteúdo da wiki: CC BY-NC-SA 3.0.
   ============================================================ */
(function () {
  "use strict";
  const API = "https://www.poe2wiki.net/w/api.php";
  const SITE = "https://www.poe2wiki.net/wiki/";
  const TTL = 7 * 24 * 3600 * 1000;
  const PREF = "forja:wiki:";
  const IGNORAR = "script,style,link,meta,noscript,sup.reference,.mw-editsection,.navbox,.toc,#toc,.mw-references-wrap,ol.references,.noprint,.mw-empty-elt,.thumb,figure,img,.metadata,.ambox,.hatnote";
  const NS_FORA = /^(File|Image|Special|Category|Template|Help|User|Module|Talk|Path of Exile 2 Wiki):/i;
  const $ = (s) => document.querySelector(s);
  let pilha = [];
  let pedido = 0;

  const urlPagina = (t) => SITE + encodeURIComponent(String(t).replace(/ /g, "_"));
  const chave = (t) => PREF + String(t).toLowerCase().replace(/_/g, " ").trim();
  function lerCache(t) { try { return JSON.parse(localStorage.getItem(chave(t)) || "null"); } catch (e) { return null; } }
  function limparMetade() {
    const ks = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREF)) ks.push(k); }
    ks.map((k) => { let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch (e) {} return [k, t]; })
      .sort((a, b) => a[1] - b[1]).slice(0, Math.ceil(ks.length / 2)).forEach(([k]) => localStorage.removeItem(k));
  }
  function gravarCache(t, d) {
    const s = JSON.stringify(d);
    try { localStorage.setItem(chave(t), s); } catch (e) { limparMetade(); try { localStorage.setItem(chave(t), s); } catch (e2) {} }
  }

  async function api(params) {
    const q = new URLSearchParams(Object.assign({ format: "json", formatversion: "2", origin: "*" }, params));
    const r = await fetch(API + "?" + q.toString(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j && j.error) { const e = new Error(j.error.info || j.error.code); e.codigo = j.error.code; throw e; }
    return j;
  }

  /* ---------- HTML da wiki → blocos de texto ---------- */
  const limpa = (s) => String(s || "").replace(/\s+/g, " ").trim();
  function trechos(el) {
    const out = [];
    (function andar(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) out.push(["", c.textContent]);
        else if (c.nodeType === 1) {
          if (c.tagName === "A") {
            const m = (c.getAttribute("href") || "").match(/^\/wiki\/([^#?]+)/);
            let alvo = "";
            if (m) { try { alvo = decodeURIComponent(m[1]).replace(/_/g, " "); } catch (e) { alvo = ""; } }
            out.push([alvo && !NS_FORA.test(alvo) ? alvo : "", c.textContent]);
          } else if (c.tagName === "BR") out.push(["", "\n"]);
          else andar(c);
        }
      }
    })(el);
    const r = [];
    for (const [l, t] of out) {
      if (!t) continue;
      const u = r[r.length - 1];
      if (u && !u[0] && !l) u[1] += t; else r.push([l, t]);
    }
    return r.map(([l, t]) => [l, t.replace(/[ \t\r\f\v]+/g, " ")]).filter(([l, t]) => l || t.trim());
  }
  function extrair(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const raiz = doc.querySelector(".mw-parser-output") || doc.body;
    raiz.querySelectorAll(IGNORAR).forEach((n) => n.remove());
    const blocos = [];
    (function visitar(el) {
      for (const c of el.children) {
        if (blocos.length > 600) return;
        const tag = c.tagName;
        if (/^H[1-6]$/.test(tag)) { const t = limpa(c.textContent); if (t) blocos.push({ h: +tag[1], x: t }); }
        else if (tag === "P") { const r = trechos(c); if (r.length) blocos.push({ p: r }); }
        else if (tag === "UL" || tag === "OL") { for (const li of c.children) if (li.tagName === "LI") { const r = trechos(li); if (r.length) blocos.push({ li: r }); } }
        else if (tag === "DL") { for (const d of c.children) { if (d.tagName === "DT") { const t = limpa(d.textContent); if (t) blocos.push({ h: 5, x: t }); } else { const r = trechos(d); if (r.length) blocos.push({ p: r }); } } }
        else if (tag === "TABLE") {
          const linhas = [];
          c.querySelectorAll("tr").forEach((tr, i) => { if (i >= 60) return; const cel = [...tr.children].map((td) => limpa(td.textContent)).filter(Boolean); if (cel.length) linhas.push(cel); });
          if (linhas.length) blocos.push({ tab: linhas });
        } else if (/^(DIV|SECTION|BLOCKQUOTE|CENTER|ASIDE)$/.test(tag)) {
          if (c.querySelector("p,ul,ol,table,h2,h3,h4,dl")) visitar(c);
          else { const r = trechos(c); if (r.length && limpa(c.textContent)) blocos.push({ p: r }); }
        } else if (tag === "SPAN") { if (limpa(c.textContent)) blocos.push({ p: trechos(c) }); }
      }
    })(raiz);
    return blocos;
  }

  async function pagina(titulo) {
    const c = lerCache(titulo);
    if (c && Date.now() - c.t < TTL) return c;
    try {
      const j = await api({ action: "parse", page: titulo, prop: "text", redirects: "1", disableeditsection: "1", disabletoc: "1" });
      const p = j.parse || {};
      const html = typeof p.text === "string" ? p.text : (p.text && p.text["*"]) || "";
      const d = { t: Date.now(), titulo: p.title || titulo, blocos: extrair(html) };
      gravarCache(titulo, d);
      if (d.titulo.toLowerCase() !== String(titulo).toLowerCase()) gravarCache(d.titulo, d);
      return d;
    } catch (e) {
      if (c) return Object.assign({}, c, { velho: true });
      throw e;
    }
  }

  /* ---------- tela ---------- */
  const no = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  function linkInterno(alvo, txt) { const b = no("button", "wk-link", txt); b.type = "button"; b.dataset.wk = alvo; return b; }
  function cabecalho(titulo) {
    $("#wkTitulo").textContent = titulo;
    $("#wkAbrir").href = urlPagina(titulo);
    $("#wkVoltar").hidden = pilha.length <= 1;
  }
  function mostrarCarregando(titulo) {
    cabecalho(titulo);
    const corpo = $("#wkCorpo"); corpo.textContent = "";
    corpo.appendChild(no("p", "muted", "Carregando da PoE2 Wiki…"));
  }
  function mostrarErro(titulo, e) {
    const corpo = $("#wkCorpo"); corpo.textContent = "";
    const naoExiste = e && /missingtitle/.test(e.codigo || "");
    corpo.appendChild(no("p", "err", naoExiste ? `A wiki não tem uma página chamada “${titulo}”.` : "Não consegui abrir a wiki por aqui (sem internet ou a wiki recusou a conexão)."));
    const a = no("a", "btn fant", "Abrir no navegador"); a.href = urlPagina(titulo); a.target = "_blank"; a.rel = "noopener";
    corpo.appendChild(a);
    if (naoExiste) corpo.appendChild(no("p", "hint", "Tente a busca acima — o nome em inglês costuma funcionar."));
  }
  function desenhar(d) {
    cabecalho(d.titulo);
    const corpo = $("#wkCorpo"); corpo.textContent = "";
    if (d.velho) corpo.appendChild(no("p", "hint", "Sem conexão — mostrando a cópia salva."));
    for (const b of d.blocos) {
      let el = null;
      if (b.h) el = no(b.h <= 2 ? "h3" : "h4", "wk-h", b.x);
      else if (b.p || b.li) {
        el = no(b.li ? "div" : "p", b.li ? "wk-li" : "wk-p");
        for (const [alvo, t] of (b.p || b.li)) el.appendChild(alvo ? linkInterno(alvo, t) : document.createTextNode(t));
      } else if (b.tab) {
        el = no("div", "wk-tab");
        for (const lin of b.tab) el.appendChild(no("div", "wk-tr", lin.join(" · ")));
      }
      if (el) corpo.appendChild(el);
    }
    if (!d.blocos.length) corpo.appendChild(no("p", "muted", "Página sem texto para mostrar aqui — abra no navegador."));
    corpo.scrollTop = 0;
  }
  async function ir(titulo, empilhar) {
    titulo = String(titulo || "").replace(/_/g, " ").trim();
    if (!titulo) return;
    if (empilhar !== false) pilha.push(titulo);
    const meu = ++pedido;
    mostrarCarregando(titulo);
    try { const d = await pagina(titulo); if (meu === pedido) desenhar(d); }
    catch (e) { if (meu === pedido) mostrarErro(titulo, e); }
  }
  async function buscar(q) {
    q = String(q || "").trim(); if (!q) return;
    const meu = ++pedido;
    cabecalho("Busca: " + q); $("#wkAbrir").href = SITE + "Special:Search?search=" + encodeURIComponent(q);
    const corpo = $("#wkCorpo"); corpo.textContent = ""; corpo.appendChild(no("p", "muted", "Buscando…"));
    try {
      const j = await api({ action: "opensearch", search: q, limit: "20", namespace: "0", redirects: "resolve" });
      if (meu !== pedido) return;
      corpo.textContent = "";
      const titulos = Array.isArray(j) ? j[1] || [] : [];
      if (!titulos.length) corpo.appendChild(no("p", "muted", "Nada encontrado."));
      titulos.forEach((t) => { const b = linkInterno(t, t); b.classList.add("wk-res"); corpo.appendChild(b); });
    } catch (e) { if (meu === pedido) mostrarErro(q, e); }
  }

  function abrir(titulo) {
    pilha = [];
    document.getElementById("wikiModal").classList.remove("hidden");
    $("#wkBusca").value = "";
    ir(titulo);
  }
  function ligar() {
    $("#wkCorpo").addEventListener("click", (e) => { const b = e.target.closest("[data-wk]"); if (b) ir(b.dataset.wk); });
    $("#wkVoltar").addEventListener("click", () => { if (pilha.length > 1) { pilha.pop(); ir(pilha[pilha.length - 1], false); } });
    $("#wkForm").addEventListener("submit", (e) => { e.preventDefault(); buscar($("#wkBusca").value); $("#wkBusca").blur(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar); else ligar();

  window.Wiki = { abrir, extrair, urlPagina };
})();
