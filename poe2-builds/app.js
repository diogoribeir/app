/* ============================================================
   Exile Compass — interface
   ------------------------------------------------------------
   Telas (rotas por hash, o "voltar" do celular funciona):
     #/              início: minhas builds + Ler da foto / Nova build
     #/nova          nova build: por ascendência, por skill ou sorteio
     #/nova/a/<asc>  escolher a skill para a ascendência
     #/nova/s/<sk>   escolher a ascendência para a skill
     #/foto[/<id>]   montar (ou atualizar) a build lendo prints
     #/b/<id>[/aba]  build: árvore (caminho) · gemas · análise
   Dados: localStorage (cópia offline) + Firebase RTDB via REST,
   nó planos/poe2-builds-dt2026 — uma chave por build
   (builds/<id>) + lápides (apagadas/<id>) + carimbo _at.
   Árvore/caminho: arvore.js + caminho.js; regras: motor.js.
   ============================================================ */
"use strict";
const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/poe2-builds-dt2026";
const LS_BUILDS = "forja:builds", LS_OUTBOX = "forja:outbox";
const VERSAO_CAMINHO = "c1";
const M = window.Motor, J = window.KB_JOGO, C = window.KB_CONCEITOS, META = window.KB_META, GEM = window.KB_GEMAS || {}, CAM = window.Caminho;

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const semEmoji = (t) => String(t || "").replace(/^[^\p{L}\p{N}]+\s*/u, "");
const ic = (id, cls) => `<svg class="ic ${cls || ""}"><use href="#i-${id}"/></svg>`;
const imgAsc = (nome, tam, extra) => `<img class="retrato ${extra || ""}" src="img/asc/${esc(slug(nome))}.webp" width="${tam}" height="${tam}" alt="" loading="lazy">`;
function imgGema(nome, cls) {
  const g = GEM[nome];
  if (!g) return `<span class="gema-ic vazio ${cls || ""}">${esc((nome || "?")[0])}</span>`;
  return `<img class="gema-ic ${cls || ""}" src="img/gem/${esc(g[0])}.webp" alt="" loading="lazy">`;
}
const TIPO_PT = { Attack: "Ataque", Spell: "Feitiço", Buff: "Buff", Minion: "Minion", Warcry: "Grito", Mark: "Marca", Totem: "Totem", Banner: "Bandeira", Shapeshift: "Transformação", Channelling: "Canalização", Meta: "Meta" };
const EL_PT = { fire: "Fogo", cold: "Gelo", lightning: "Raio", chaos: "Caos", physical: "Físico" };
const TAG_PT = { projectile: "Projétil", area: "Área", melee: "Corpo a corpo", minion: "Minion", duration: "Duração", chaining: "Corrente", totem: "Totem", curse: "Maldição", herald: "Herald", aura: "Aura", warcry: "Grito", slam: "Slam", strike: "Golpe", channelling: "Canalizada", storm: "Tempestade", plant: "Planta", grenade: "Granada", companion: "Companheiro", shapeshift: "Transformação", trigger: "Disparada", nova: "Nova", remnant: "Remanescente" };
function resumoSkill(s) {
  if (!s) return "";
  const p = [TIPO_PT[s.t] || s.t];
  if (s.w) { const w = s.w.split(",")[0].trim(); p.push(/^Any/.test(w) ? "Qualquer arma" : M.armaPt(w) !== w ? M.armaPt(w) : w); }
  M.elementos(s).filter((e) => e !== "physical" || s.t !== "Attack").slice(0, 2).forEach((e) => p.push(EL_PT[e]));
  s.tg.filter((t) => TAG_PT[t]).slice(0, 2).forEach((t) => p.push(TAG_PT[t]));
  return [...new Set(p)].filter(Boolean).join(" · ");
}
function metaSelo(skill, asc) {
  const m = META.builds.find((x) => x.skill === skill && (!asc || x.asc.includes(asc)));
  return m ? `<span class="selo">Meta ${esc(m.tier)}</span>` : "";
}
const CLASSES = J.classes;
const CLASSE_DE = M.CLASSE_DE;
const notaCls = (n) => (n >= 7 ? "alta" : n >= 5 ? "media" : "baixa");

/* ---------------- estado + sincronização ---------------- */
let ST = { builds: {}, apagadas: {} };
let lastAt = 0, offlineAvisado = false;
function normalizar(b) {
  const out = Object.assign(M.novaBuild({}), b || {});
  ["grupos", "unicos", "keystones", "ascNos", "notaveis", "planoFixos", "planoEvitar", "ascFixos", "ascEvitar", "nosAtuais"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = out[k] ? Object.values(out[k]) : []; });
  if (out.nosIds && !Array.isArray(out.nosIds)) out.nosIds = Object.values(out.nosIds);
  out.grupos = out.grupos.filter(Boolean).map((g) => ({ skill: g.skill || "", papel: g.papel || "secundaria", sup: Array.isArray(g.sup) ? g.sup.filter(Boolean) : g.sup ? Object.values(g.sup) : [] }));
  ["stats", "recup", "vetMan"].forEach((k) => { if (!out[k] || typeof out[k] !== "object") out[k] = {}; });
  if (out.prioridade == null) out.prioridade = 0.4;
  if (!out.nivel) out.nivel = 1;
  if (out.plano && out.plano.ordem && !Array.isArray(out.plano.ordem)) out.plano.ordem = Object.values(out.plano.ordem);
  return out;
}
const listaBuilds = () => Object.values(ST.builds).sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0));
function saveLocal() { try { localStorage.setItem(LS_BUILDS, JSON.stringify(ST)); } catch (e) { /* cheio */ } }
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BUILDS) || "null");
    if (raw && raw.builds) { ST = { builds: {}, apagadas: raw.apagadas || {} }; Object.values(raw.builds).forEach((b) => { if (b && b.id) ST.builds[b.id] = normalizar(b); }); }
  } catch (e) { /* ok */ }
}
async function apiGet(p) { const r = await fetch(`${SYNC_URL}/${p}.json`, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function apiPut(p, v) { const r = await fetch(`${SYNC_URL}/${p}.json`, { method: "PUT", body: JSON.stringify(v) }); if (!r.ok) throw new Error("HTTP " + r.status); }
async function apiDel(p) { const r = await fetch(`${SYNC_URL}/${p}.json`, { method: "DELETE" }); if (!r.ok) throw new Error("HTTP " + r.status); }
const getOutbox = () => { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || "[]"); } catch (e) { return []; } };
const setOutbox = (q) => { try { localStorage.setItem(LS_OUTBOX, JSON.stringify(q)); } catch (e) { /* ok */ } };
async function bumpAt() { lastAt = Date.now(); try { await apiPut("_at", lastAt); } catch (e) { /* ok */ } }
async function push(op, path, v) {
  try {
    if (op === "put") await apiPut(path, v); else await apiDel(path);
    await bumpAt();
    if (offlineAvisado) { offlineAvisado = false; toast("Sincronizado"); }
    flush();
  } catch (e) {
    const q = getOutbox().filter((x) => x.path !== path); q.push({ op, path, v }); setOutbox(q);
    if (!offlineAvisado) { offlineAvisado = true; toast("Sem conexão — salvo no aparelho, sincroniza depois"); }
  }
}
async function flush() {
  const q = getOutbox(); if (!q.length) return;
  const resto = [];
  for (const it of q) { try { if (it.op === "put") await apiPut(it.path, it.v); else await apiDel(it.path); } catch (e) { resto.push(it); } }
  setOutbox(resto);
  if (resto.length < q.length) await bumpAt();
}
async function pull() {
  try {
    const [remoto, apagadas, at] = await Promise.all([apiGet("builds"), apiGet("apagadas"), apiGet("_at")]);
    if (typeof at === "number") lastAt = at;
    const pend = new Set(getOutbox().map((x) => x.path));
    Object.assign(ST.apagadas, apagadas || {});
    Object.values(remoto || {}).forEach((rb) => {
      if (!rb || !rb.id || pend.has("builds/" + rb.id)) return;
      const loc = ST.builds[rb.id];
      if (!loc || (rb.atualizado || 0) > (loc.atualizado || 0)) ST.builds[rb.id] = normalizar(rb);
    });
    Object.entries(ST.apagadas).forEach(([id, t]) => { const b = ST.builds[id]; if (b && (b.atualizado || 0) <= t && !pend.has("builds/" + id)) delete ST.builds[id]; });
    Object.values(ST.builds).forEach((b) => { if ((!remoto || !remoto[b.id]) && !pend.has("builds/" + b.id)) push("put", "builds/" + b.id, b); });
    saveLocal();
    return true;
  } catch (e) { return false; }
}
async function syncCheck() {
  try {
    const at = await apiGet("_at");
    if (typeof at === "number" && at > lastAt + 1500) {
      await pull();
      const foco = document.activeElement;
      if (!foco || !/INPUT|TEXTAREA|SELECT/.test(foco.tagName)) render();
    }
  } catch (e) { /* offline */ }
}
function salvar(b) { b.atualizado = Date.now(); ST.builds[b.id] = b; saveLocal(); push("put", "builds/" + b.id, b); }
const salvarDepois = debounce((b) => salvar(b), 700);
function apagarBuild(id) {
  const b = ST.builds[id]; if (!b) return;
  delete ST.builds[id];
  const t = Date.now(); ST.apagadas[id] = t;
  saveLocal(); push("del", "builds/" + id); push("put", "apagadas/" + id, t);
  ir("#/");
  desfazer("Build apagada", () => { delete ST.apagadas[id]; push("del", "apagadas/" + id); salvar(b); render(); });
}

/* ---------------- avisos ---------------- */
let undoFn = null, undoTimer = null, toastTimer = null;
function desfazer(msg, fn) { undoFn = fn; $("#desfazerTxt").textContent = msg; $("#desfazer").classList.remove("hidden"); clearTimeout(undoTimer); undoTimer = setTimeout(fecharDesfazer, 12000); }
function fecharDesfazer() { $("#desfazer").classList.add("hidden"); undoFn = null; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 2600); }

/* ---------------- painel inferior ---------------- */
let folhaAoFechar = null;
function abrirFolha(html, ligar, aoFechar) {
  $("#folhaCorpo").innerHTML = html;
  $("#folha").classList.remove("hidden");
  folhaAoFechar = aoFechar || null;
  if (ligar) ligar($("#folhaCorpo"));
}
function fecharFolha() { $("#folha").classList.add("hidden"); $("#folhaCorpo").innerHTML = ""; const f = folhaAoFechar; folhaAoFechar = null; if (f) f(); }

/* ---------------- plano (caminho na árvore) ---------------- */
function principal(b) { return M.principal(b); }
function hashPlano(b) {
  const P = principal(b);
  return [VERSAO_CAMINHO, b.classe, b.asc, P ? P.s.n : "", P ? (P.g.sup || []).join(",") : "", (b.grupos || []).map((g) => g.skill).join(","), b.arma, b.offhand, b.prioridade, b.defesa || "",
    (b.planoFixos || []).join(","), (b.planoEvitar || []).join(","), (b.ascFixos || []).join(","), (b.ascEvitar || []).join(","), (b.nosAtuais || []).join(",")].join("|");
}
function calcularPlano(b) {
  const r = CAM.calcular(b, { nivel: 100 });
  const p = { h: hashPlano(b), ordem: [], passos: [], pontos: 0, asc: { ordem: [], passos: [] } };
  if (r.arvore) {
    p.ordem = r.arvore.ordem; p.pontos = r.arvore.pontos; p.atuais = r.arvore.atuais;
    p.passos = r.arvore.passos.map((x) => ({ a: x.alvo, de: x.de, ate: x.ate }));
  }
  if (r.asc) {
    const ov = r.asc.ov || {};
    p.asc = { ordem: r.asc.ordem, passos: r.asc.passos.map((x) => ({ a: x.alvo, de: x.de, ate: x.ate })) };
    p.ascIds = r.asc.ordem.map((id) => (ov[id] ? ov[id].i : id));
  }
  b.plano = p;
  const nomes = CAM.nomesDoPlano(r);
  b.keystones = nomes.keystones; b.notaveis = nomes.notaveis; b.ascNos = nomes.ascNos;
  b.nosIds = [...(p.atuais || []), ...p.ordem, ...(p.ascIds || [])];
  return p;
}
function plano(b) {
  if (!b.plano || b.plano.h !== hashPlano(b)) { calcularPlano(b); salvarDepois(b); }
  return b.plano;
}
const nosDoPasso = (p, ps) => p.ordem.slice(ps.de - 1 - (p.atuais || []).length, ps.ate - (p.atuais || []).length);

/* ---------------- criação de builds ---------------- */
function novaDe(skill, asc, origem) {
  const b = normalizar(M.montar(skill, asc, origem || "assistente"));
  b.nivel = 1; b.prioridade = 0.4;
  b.nome = skill + (asc ? " · " + asc : "");
  calcularPlano(b);
  salvar(b);
  return b;
}

/* ---------------- rotas ---------------- */
function rota() {
  const p = (location.hash || "#/").replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  return { v: p[0] || "", a: p[1], c: p[2] };
}
function ir(h) { if (location.hash === h) render(); else location.hash = h; }
let arvView = null;
function render() {
  if (arvView) { arvView.destruir(); arvView = null; }
  const r = rota();
  const vista = $("#vista");
  $("#voltarBtn").classList.toggle("hidden", !r.v);
  window.scrollTo(0, 0);
  if (r.v === "nova") return vNova(vista, r);
  if (r.v === "foto") return vFoto(vista, r);
  if (r.v === "b" && ST.builds[r.a]) return vBuild(vista, ST.builds[r.a], r.c || "arvore");
  return vInicio(vista);
}

/* ================= INÍCIO ================= */
function vInicio(v) {
  const lista = listaBuilds();
  v.innerHTML = `
    <section class="inicio-hero">
      <h1>Sua build, com o caminho na árvore</h1>
      <p>Escolha a ascendência e a skill — ou mande um print do jogo — e veja na árvore passiva o caminho calculado para a sua build.</p>
      <div class="acoes">
        <button class="btn grande" data-ir="#/foto">${ic("foto")} Ler da foto</button>
        <button class="btn grande fant" data-ir="#/nova">${ic("mais")} Nova build</button>
      </div>
      <button class="link" data-acao="pob">Tenho um código do Path of Building</button>
    </section>
    ${lista.length ? `<div class="secao">Minhas builds</div>` : ""}
    ${lista.map((b) => {
      const P = principal(b);
      let nota = "";
      try { nota = M.analisar(b).geral; } catch (e) { nota = ""; }
      return `<div class="cartao build-card" data-ir="#/b/${esc(b.id)}" role="button" tabindex="0">
        <div class="avatar">${imgAsc(b.asc || b.classe, 58)}${P ? imgGema(P.s.n) : ""}</div>
        <div class="info"><div class="nome">${esc(b.nome || "Build")}</div>
          <div class="det">${esc(b.asc || b.classe || "sem ascendência")} · Nível ${esc(b.nivel)}</div>
          <div class="det">${esc(P ? P.s.n : "sem skill principal")}</div></div>
        ${nota !== "" ? `<div class="nota ${notaCls(nota)}">${esc(String(nota).replace(".", ","))}</div>` : ""}
      </div>`;
    }).join("")}
    <p class="rodape">Exile Compass é um projeto de fã, sem relação com a Grinding Gear Games. Path of Exile é marca da Grinding Gear Games. Árvore e artes: exportação oficial da GGG; dados: Path of Building 2 e RePoE.</p>`;
}

/* ================= NOVA BUILD ================= */
function vNova(v, r) {
  if (r.a === "a" && r.c) return vNovaSkill(v, r.c);
  if (r.a === "s" && r.c) return vNovaAsc(v, r.c);
  const modo = r.a === "skill" ? "skill" : "asc";
  v.innerHTML = `
    <div class="passo-tit"><span class="num">1</span><h1>${modo === "asc" ? "Escolha a ascendência" : "Escolha a skill"}</h1></div>
    <div class="seg" role="tablist">
      <button class="${modo === "asc" ? "on" : ""}" data-ir="#/nova">Ascendência</button>
      <button class="${modo === "skill" ? "on" : ""}" data-ir="#/nova/skill">Skill</button>
      <button data-acao="sortear">${ic("dado")} Sortear</button>
    </div>
    <div id="novaCorpo"></div>`;
  const corpo = $("#novaCorpo");
  if (modo === "asc") {
    corpo.innerHTML = `<div class="grade-asc">${CLASSES.map((c) => `<div class="classe-tit">${esc(c.n)}</div>` +
      c.asc.map((a) => `<button class="asc-op" data-ir="#/nova/a/${encodeURIComponent(a)}">${imgAsc(a, 92)}<span class="n">${esc(a)}</span></button>`).join("")).join("")}</div>`;
  } else {
    corpo.innerHTML = `<div class="busca-box">${ic("busca")}<input id="buscaSkill" type="search" placeholder="Buscar skill (ex.: Spark, arco, minion)…" autocomplete="off"></div><div id="listaSkill"></div>`;
    const todas = J.skills.filter((s) => ["Attack", "Spell", "Minion"].includes(s.t) && !M.ehPersistente(s) && s.gid && !/Ascendancy|Triggered/.test(s.gid));
    const meta = new Set(META.builds.map((m) => m.skill));
    const ordenadas = todas.slice().sort((a, b) => (meta.has(b.n) - meta.has(a.n)) || (b.tier || 0) - (a.tier || 0) || a.n.localeCompare(b.n));
    const desenhar = () => {
      const q = M.norm($("#buscaSkill").value);
      const lst = ordenadas.filter((s) => !q || q.split(" ").every((p) => M.norm(s.n + " " + resumoSkill(s) + " " + s.tg.join(" ") + " " + (s.w || "")).includes(p))).slice(0, 60);
      $("#listaSkill").innerHTML = lst.map((s) => `<button class="skill-op" data-ir="#/nova/s/${encodeURIComponent(s.n)}">${imgGema(s.n)}<span class="info"><span class="n">${esc(s.n)}</span><br><span class="t">${esc(resumoSkill(s))}</span></span>${metaSelo(s.n)}</button>`).join("") || `<p class="vazio-txt">Nada encontrado.</p>`;
    };
    $("#buscaSkill").addEventListener("input", debounce(desenhar, 120));
    desenhar();
  }
}
function vNovaSkill(v, asc) {
  const cl = CLASSE_DE[asc];
  if (!cl) return ir("#/nova");
  const rank = M.rankSkillsPorAsc(asc).filter((x) => x.s.gid && !/Ascendancy|Triggered/.test(x.s.gid));
  const top = rank.slice(0, 8);
  const resumo = (C.ascendencias[asc] || {}).resumo || "";
  v.innerHTML = `
    <div class="heroi">${imgAsc(asc, 72)}<div class="info"><div class="nome">${esc(asc)}</div><div class="det">${esc(cl)}</div></div></div>
    ${resumo ? `<p class="sub small">${esc(M.preencher(resumo))}</p>` : ""}
    <div class="passo-tit"><span class="num">2</span><h1>Escolha a skill principal</h1></div>
    <div class="secao">Combinam com ${esc(asc)}</div>
    ${top.map((x) => `<button class="skill-op" data-criar="${esc(x.s.n)}" data-asc="${esc(asc)}">${imgGema(x.s.n)}<span class="info"><span class="n">${esc(x.s.n)}</span><br><span class="t">${esc(resumoSkill(x.s))}</span></span>${metaSelo(x.s.n, asc)}</button>`).join("")}
    <div class="secao">Todas</div>
    <div class="busca-box">${ic("busca")}<input id="buscaSkill" type="search" placeholder="Buscar skill…" autocomplete="off"></div>
    <div id="listaSkill"></div>`;
  const desenhar = () => {
    const q = M.norm($("#buscaSkill").value);
    const lst = rank.slice(8).filter((x) => !q || q.split(" ").every((p) => M.norm(x.s.n + " " + resumoSkill(x.s) + " " + x.s.tg.join(" ")).includes(p))).slice(0, q ? 60 : 24);
    $("#listaSkill").innerHTML = lst.map((x) => `<button class="skill-op" data-criar="${esc(x.s.n)}" data-asc="${esc(asc)}">${imgGema(x.s.n)}<span class="info"><span class="n">${esc(x.s.n)}</span><br><span class="t">${esc(resumoSkill(x.s))}</span></span></button>`).join("");
  };
  $("#buscaSkill").addEventListener("input", debounce(desenhar, 120));
  desenhar();
}
function vNovaAsc(v, skill) {
  const s = M.SK.get(skill);
  if (!s) return ir("#/nova/skill");
  const rank = M.rankAscPorSkill(s);
  const top = new Set(rank.slice(0, 3).map((x) => x.asc));
  v.innerHTML = `
    <div class="heroi">${imgGema(s.n, "g")}<div class="info"><div class="nome" style="color:var(--gema)">${esc(s.n)}</div><div class="det">${esc(resumoSkill(s))}</div></div></div>
    <div class="passo-tit"><span class="num">2</span><h1>Escolha a ascendência</h1></div>
    <p class="sub small">As com brilho combinam mais com ${esc(s.n)}.</p>
    <div class="grade-asc">${rank.map((x) => `<button class="asc-op ${top.has(x.asc) ? "on" : ""}" data-criar="${esc(s.n)}" data-asc="${esc(x.asc)}">${imgAsc(x.asc, 92)}<span class="n">${esc(x.asc)}</span><span class="c">${esc(x.classe)}</span></button>`).join("")}</div>`;
}

/* ================= FOTO ================= */
let fotoEstado = null;
function vFoto(v, r) {
  const alvo = r.a && ST.builds[r.a] ? ST.builds[r.a] : null;
  v.innerHTML = `
    <h1>${alvo ? "Atualizar pela foto" : "Ler a build da foto"}</h1>
    <p class="sub">Mande prints do jogo e o app lê os nomes para você — sem digitar item por item.</p>
    <ol class="foto-dica">
      <li><span class="n">1</span><span>No PS5, aperte <b>Create</b> e tire print da tela de <b>Skills</b> (gemas). Se quiser, também do <b>Personagem</b> (nível e números) e do <b>Equipamento</b>.</span></li>
      <li><span class="n">2</span><span>Abra no celular pelo app <b>PlayStation</b> (as capturas vão sozinhas) e salve na galeria. Foto da TV também serve — reta e sem reflexo.</span></li>
      <li><span class="n">3</span><span>Escolha as imagens aqui. A leitura é feita no próprio celular.</span></li>
    </ol>
    <button class="btn grande" id="escolherFotos">${ic("foto")} Escolher prints / fotos</button>
    <div id="fotoProg" class="cartao hidden"><div id="fotoMsg" class="small">Preparando…</div><div class="progresso"><i id="fotoBarra"></i></div><div id="fotoMini" class="miniaturas"></div></div>
    <div id="fotoRes"></div>`;
  $("#escolherFotos").addEventListener("click", () => { const inp = $("#arquivoFoto"); inp.value = ""; inp.dataset.alvo = alvo ? alvo.id : ""; inp.click(); });
  if (fotoEstado && fotoEstado.alvo === (alvo ? alvo.id : "")) mostrarResultadoFoto(fotoEstado.res, alvo);
}
async function lerFotos(files, alvoId) {
  const alvo = alvoId ? ST.builds[alvoId] : null;
  $("#fotoProg").classList.remove("hidden");
  $("#fotoRes").innerHTML = "";
  $("#fotoMini").innerHTML = files.map(() => "<img alt=\"\">").join("");
  $$("#fotoMini img").forEach((im, i) => { im.src = URL.createObjectURL(files[i]); });
  $("#escolherFotos").disabled = true;
  try {
    const res = await window.Foto.ler(files, (p, msg) => { $("#fotoBarra").style.width = Math.round(p * 100) + "%"; $("#fotoMsg").textContent = msg; });
    fotoEstado = { alvo: alvoId || "", res };
    mostrarResultadoFoto(res, alvo);
  } catch (e) {
    $("#fotoRes").innerHTML = `<div class="cartao"><b>Não consegui ler.</b><p class="small muted">${esc(e.message || e)}</p></div>`;
  } finally {
    $("#escolherFotos").disabled = false;
  }
}
function mostrarResultadoFoto(res, alvo) {
  const el = $("#fotoRes"); if (!el) return;
  const nada = !res.grupos.length && !res.asc && !res.unicos.length && !Object.keys(res.stats).length;
  const P = res.grupos.find((g) => g.papel === "principal");
  let ascSug = res.asc;
  if (!ascSug && P) { const rk = M.rankAscPorSkill(M.SK.get(P.skill)).filter((x) => !res.classe || x.classe === res.classe); ascSug = rk.length ? rk[0].asc : ""; }
  if (!ascSug && alvo) ascSug = alvo.asc;
  const STAT_PT = { vida: "Vida", es: "Escudo de energia", mana: "Mana", espirito: "Espírito", armadura: "Armadura", evasao: "Evasão", resFogo: "Res. fogo", resFrio: "Res. gelo", resRaio: "Res. raio", resCaos: "Res. caos", bloqueio: "Bloqueio", deflexao: "Deflexão" };
  el.innerHTML = nada ? `<div class="cartao"><b>Não reconheci nomes do jogo nessas imagens.</b>
      <p class="small muted">Dica: use os prints do próprio PS5 (mais nítidos que foto da TV) da tela de Skills, com o jogo em inglês.</p>
      <details><summary class="small">Ver o texto lido</summary><textarea readonly>${esc(res.linhas.join("\n"))}</textarea></details></div>` : `
    <div class="secao">Encontrei</div>
    <div class="cartao">
      <div class="achou"><span class="info"><b>Ascendência</b><div class="t">${res.asc ? "lida na imagem" : "não apareceu — escolhi a que mais combina"}</div></span>
        <select id="fAsc" class="campo" style="max-width:52%;min-height:42px;border-radius:9px;background:#0f0d0b;border:1px solid var(--borda2);padding:6px">${CLASSES.map((c) => `<optgroup label="${esc(c.n)}">${c.asc.map((a) => `<option ${a === ascSug ? "selected" : ""}>${esc(a)}</option>`).join("")}</optgroup>`).join("")}</select></div>
      ${res.nivel ? `<label class="achou"><input type="checkbox" data-f="nivel" checked><span class="info"><b>Nível ${res.nivel}</b></span></label>` : ""}
      ${res.grupos.map((g, i) => `<label class="achou"><input type="checkbox" data-f="g${i}" checked>${imgGema(g.skill, "p")}<span class="info"><b style="color:var(--gema)">${esc(g.skill)}</b>${g.papel === "principal" ? ` <span class="selo">principal</span>` : ""}
        <div class="t">${g.sup.length ? esc(g.sup.join(" · ")) : "sem suportes lidos"}</div></span></label>`).join("")}
      ${res.unicos.map((u, i) => `<label class="achou"><input type="checkbox" data-f="u${i}" checked><span class="info"><b style="color:var(--unico)">${esc(u)}</b><div class="t">único</div></span></label>`).join("")}
      ${Object.entries(res.stats).map(([k, val]) => `<label class="achou"><input type="checkbox" data-f="s:${esc(k)}" checked><span class="info"><b>${esc(STAT_PT[k] || k)}: ${esc(val)}</b></span></label>`).join("")}
    </div>
    <button class="btn grande" id="fotoCriar">${ic("ok")} ${alvo ? "Atualizar " + esc(alvo.nome) : "Criar build"}</button>
    <details style="margin-top:12px"><summary class="small muted">Ver o texto lido</summary><textarea readonly style="width:100%;min-height:140px;background:#0f0d0b;color:var(--txt2);border:1px solid var(--borda2);border-radius:10px">${esc(res.linhas.join("\n"))}</textarea></details>`;
  const btn = $("#fotoCriar");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const marc = (k) => { const c = el.querySelector(`[data-f="${k}"]`); return c && c.checked; };
    const asc = $("#fAsc").value;
    const grupos = res.grupos.filter((g, i) => marc("g" + i)).map((g) => ({ skill: g.skill, papel: g.papel, sup: g.sup.slice() }));
    if (grupos.length && !grupos.some((g) => g.papel === "principal")) grupos[0].papel = "principal";
    let b;
    if (alvo) {
      b = alvo;
      if (grupos.length) b.grupos = grupos;
    } else {
      const P0 = grupos.find((g) => g.papel === "principal");
      b = normalizar(P0 ? M.montar(P0.skill, asc, "foto") : M.novaBuild({ origem: "foto" }));
      if (grupos.length) b.grupos = grupos;
      b.nome = (P0 ? P0.skill : "Build") + " · " + asc;
    }
    b.asc = asc; b.classe = CLASSE_DE[asc] || b.classe;
    const P1 = M.principal(b);
    if (P1 && !M.armaAtende(P1.s.w, b.arma, b.offhand)) { b.arma = M.armaSugerida(P1.s.w) || b.arma; if (b.arma === "Bow") b.offhand = "Quiver"; }
    if (res.nivel && marc("nivel")) b.nivel = res.nivel;
    res.unicos.forEach((u, i) => { if (marc("u" + i) && !b.unicos.includes(u)) b.unicos.push(u); });
    Object.entries(res.stats).forEach(([k, val]) => { if (marc("s:" + k)) b.stats[k] = val; });
    calcularPlano(b);
    salvar(b);
    fotoEstado = null;
    ir("#/b/" + b.id);
    toast(alvo ? "Build atualizada" : "Build criada — veja o caminho na árvore");
  });
}

/* ================= BUILD ================= */
function vBuild(v, b, aba) {
  const P = principal(b);
  let an = null;
  try { an = M.analisar(b); } catch (e) { an = null; }
  v.innerHTML = `
    <div class="heroi">
      <div class="avatar">${imgAsc(b.asc || b.classe, 72)}${P ? imgGema(P.s.n) : ""}</div>
      <div class="info">
        <button class="nome" data-acao="renomear">${esc(b.nome || "Build")}</button>
        <div class="det">${esc(b.asc || b.classe || "sem ascendência")}${P ? " · " + esc(P.s.n) : ""}</div>
        <div class="nivel"><button data-nivel="-1" aria-label="Diminuir nível">${ic("menos")}</button><span data-acao="nivel">Nível ${esc(b.nivel)}</span><button data-nivel="1" aria-label="Aumentar nível">${ic("mais")}</button></div>
      </div>
      ${an ? `<div class="nota ${notaCls(an.geral)}" title="Nota geral">${esc(String(an.geral).replace(".", ","))}</div>` : ""}
    </div>
    <nav class="abas">
      <button class="${aba === "arvore" ? "on" : ""}" data-ir="#/b/${esc(b.id)}/arvore">Árvore</button>
      <button class="${aba === "gemas" ? "on" : ""}" data-ir="#/b/${esc(b.id)}/gemas">Gemas</button>
      <button class="${aba === "analise" ? "on" : ""}" data-ir="#/b/${esc(b.id)}/analise">Análise</button>
    </nav>
    <div id="abaCorpo"></div>`;
  const corpo = $("#abaCorpo");
  if (aba === "gemas") return abaGemas(corpo, b);
  if (aba === "analise") return abaAnalise(corpo, b, an);
  return abaArvore(corpo, b);
}

/* ---------- aba ÁRVORE ---------- */
let modoArv = "main";
function abaArvore(el, b) {
  const p = plano(b);
  el.innerHTML = `
    <div class="arv" id="arv">
      <div class="arv-modo"><button data-modo="main" class="${modoArv === "main" ? "on" : ""}">Árvore</button><button data-modo="asc" class="${modoArv === "asc" ? "on" : ""}">Ascendência</button></div>
      <div class="arv-ctl">
        <button data-z="in" aria-label="Aproximar">${ic("mais")}</button>
        <button data-z="out" aria-label="Afastar">${ic("menos")}</button>
        <button data-z="foco" aria-label="Centralizar no caminho">${ic("alvo")}</button>
        <button data-z="tudo" aria-label="Ver a árvore inteira">${ic("tudo")}</button>
      </div>
      <div class="arv-leg"><span><i style="background:#e8c15a"></i>até o seu nível</span><span><i style="background:rgba(232,193,90,.5)"></i>próximos pontos</span><span><i style="background:#5fd3e0"></i>você quer</span></div>
    </div>
    <div class="prio">
      <div class="prio-l"><span>Mais <b>dano</b></span><span>Mais <b>defesa</b></span></div>
      <input id="prio" type="range" min="0" max="1" step="0.1" value="${esc(b.prioridade)}" aria-label="Prioridade entre dano e defesa">
    </div>
    <div id="resumoPts" class="resumo-pts"></div>
    <div class="secao" id="passosTit">Ordem para pegar</div>
    <p class="small muted" style="margin:-4px 0 6px">Calculado pela matemática do app: cada nó ganha uma nota pelo que faz para a sua skill e defesa, e o caminho escolhe o que rende mais por ponto. Toque num nó para ver o porquê, fixar ou evitar.</p>
    <ol class="passos" id="passos"></ol>`;
  arvView = window.Arvore.criar($("#arv"), { onTap: (n) => { if (n) folhaNo(b, n); } });
  atualizarArvore(b, true);
  $$(".arv-modo button", el).forEach((bt) => bt.addEventListener("click", () => {
    modoArv = bt.dataset.modo;
    $$(".arv-modo button", el).forEach((x) => x.classList.toggle("on", x === bt));
    arvView.modo(modoArv);
    atualizarArvore(b, false);
  }));
  $$(".arv-ctl button", el).forEach((bt) => bt.addEventListener("click", () => {
    const z = bt.dataset.z;
    if (z === "in") arvView.zoom(1.5); else if (z === "out") arvView.zoom(1 / 1.5); else if (z === "tudo") arvView.tudo(); else arvView.focar();
  }));
  $("#prio").addEventListener("change", (e) => {
    b.prioridade = +e.target.value;
    toast("Recalculando o caminho…");
    setTimeout(() => { calcularPlano(b); salvar(b); atualizarArvore(b, false); toast("Caminho recalculado"); }, 30);
  });
}
function atualizarArvore(b, focar) {
  const p = plano(b);
  const agora = CAM.pontosNoNivel(b.nivel);
  const numero = new Map();
  const marco = (id) => { const n = CAM.NO.get(id); return n && (n.t === "n" || n.t === "k" || n.t === "j"); };
  if (modoArv === "asc") p.asc.passos.forEach((ps, i) => numero.set(ps.a, i + 1));
  else p.passos.forEach((ps, i) => { if (marco(ps.a)) numero.set(ps.a, i + 1); });
  const A = CAM.ASC.get(b.asc);
  arvView.definir({
    classe: CAM.CLASSE.get(b.classe) || null, asc: A || null, ov: (A && A.ov) || {},
    ordem: p.ordem, atuais: p.atuais || [], ate: agora, numero,
    fixos: modoArv === "asc" ? b.ascFixos : b.planoFixos, evitar: modoArv === "asc" ? b.ascEvitar : b.planoEvitar,
    ascOrdem: p.asc.ordem, ascAte: Math.min(8, ascPontosNoNivel(b.nivel))
  });
  if (focar) { if (modoArv === "asc") arvView.modo("asc"); else arvView.focar(); }
  const usados = Math.min(p.pontos, agora);
  $("#resumoPts").innerHTML = `<span class="chip ouro">Nível ${esc(b.nivel)}: <b>${usados}</b> pontos</span><span class="chip">Plano completo: <b>${p.pontos}</b> (nível 100)</span><span class="chip">Ascendência: <b>${Math.min(8, ascPontosNoNivel(b.nivel))}/8</b></span>`;
  desenharPassos(b);
}
/* pontos de ascendência: 2 por provação (aprox. níveis 20, 40, 55, 70) */
function ascPontosNoNivel(nv) { return nv >= 70 ? 8 : nv >= 55 ? 6 : nv >= 40 ? 4 : nv >= 20 ? 2 : 0; }
function perfilAttr(b) { const P = principal(b); if (!P) return ""; const r = P.s.req; return ["Strength", "Dexterity", "Intelligence"][r.indexOf(Math.max(...r))]; }
function nomeNo(n, ov) { const o = ov && ov[n.i]; return o ? o.n : n.n; }
function statsNo(n, ov) { const o = ov && ov[n.i]; return (o ? o.s : n.s) || []; }
function desenharPassos(b) {
  const p = plano(b);
  const ol = $("#passos"); if (!ol) return;
  const asc = modoArv === "asc";
  const A = CAM.ASC.get(b.asc), ov = (A && A.ov) || {};
  const agora = asc ? ascPontosNoNivel(b.nivel) : CAM.pontosNoNivel(b.nivel);
  const passos = asc ? p.asc.passos : p.passos;
  $("#passosTit").textContent = asc ? "Ordem na ascendência" : "Ordem para pegar";
  const atuaisN = asc ? 0 : (p.atuais || []).length;
  let marcouAgora = false;
  ol.innerHTML = passos.map((ps, i) => {
    const n = CAM.NO.get(ps.a); if (!n) return "";
    const feito = ps.ate <= agora;
    let cls = feito ? "feito" : "";
    if (!feito && !marcouAgora) { cls = "agora"; marcouAgora = true; }
    const nos = asc ? p.asc.ordem.slice(ps.de - 1, ps.ate) : nosDoPasso(p, ps);
    const via = {};
    const attr = { Strength: "FOR", Dexterity: "DES", Intelligence: "INT" }[perfilAttr(b)] || "";
    nos.filter((id) => id !== ps.a).forEach((id) => { const m = CAM.NO.get(id); if (m) { const nm = m.t === "at" ? `Atributo (escolha ${attr})` : nomeNo(m, ov); via[nm] = (via[nm] || 0) + 1; } });
    const viaTxt = Object.entries(via).map(([k, q]) => q > 1 ? `${k} ×${q}` : k).join(" · ");
    const st = statsNo(n, ov).slice(0, 2).map((x) => x.replace(/\n/g, " ")).join(" · ");
    const nivelTxt = asc ? "" : ` · ~nível ${CAM.nivelDoPonto(ps.ate + atuaisN)}`;
    return `<li class="passo ${cls}" data-no="${n.i}"><span class="n">${i + 1}</span><span class="info">
      <span class="alvo">${esc(nomeNo(n, ov))}</span> <span class="pts">pontos ${ps.de}–${ps.ate}${nivelTxt}</span>
      ${st ? `<div class="st">${esc(st)}</div>` : ""}${viaTxt ? `<div class="via">passa por: ${esc(viaTxt)}</div>` : ""}</span></li>`;
  }).join("") || `<p class="vazio-txt">${asc ? "Escolha uma ascendência para ver o caminho dela." : "Escolha a skill principal para calcular o caminho."}</p>`;
  $$(".passo", ol).forEach((li) => li.addEventListener("click", () => {
    const id = +li.dataset.no;
    if (arvView) { arvView.centrar(id); $("#arv").scrollIntoView({ behavior: "smooth", block: "center" }); }
    const n = CAM.NO.get(id); if (n) folhaNo(b, ov[id] ? Object.assign({}, n, ov[id], { i: id }) : n);
  }));
}
const TIPO_NO = { s: "Passiva pequena", at: "Atributo", n: "Notável", k: "Keystone", j: "Encaixe de joia", c: "Início da classe", as: "Início da ascendência" };
function folhaNo(b, n) {
  const asc = !!n.a;
  const p = plano(b);
  const perfil = CAM.perfil(b, b.prioridade);
  const val = CAM.valorNo(Object.assign({}, n, { t: asc && n.t === "n" ? "n" : n.t }), perfil);
  const ordem = asc ? p.asc.ordem : p.ordem;
  const idx = ordem.indexOf(n.i);
  const passos = asc ? p.asc.passos : p.passos;
  const passo = passos.findIndex((ps) => (asc ? ps.de - 1 <= idx && idx <= ps.ate - 1 : nosDoPasso(p, ps).includes(n.i)));
  const fixos = asc ? b.ascFixos : b.planoFixos, evitar = asc ? b.ascEvitar : b.planoEvitar;
  const fixo = fixos.includes(n.i), evit = evitar.includes(n.i);
  const atual = (p.atuais || []).includes(n.i);
  const onde = atual ? "Você já tem (importado)" : idx >= 0 ? `No caminho — passo ${passo + 1}, ponto ${idx + 1 + (asc ? 0 : (p.atuais || []).length)}${asc ? "" : " (~nível " + CAM.nivelDoPonto(idx + 1 + (p.atuais || []).length) + ")"}` : "Fora do caminho sugerido";
  const st = (n.s || []).flatMap((x) => x.split("\n"));
  const tipo = asc ? (n.t === "n" ? "Notável de ascendência" : n.t === "as" ? "Início" : "Passiva de ascendência") : TIPO_NO[n.t] || "";
  abrirFolha(`
    <div class="tt"><div class="tt-h"><div class="tt-n">${esc(n.n)}</div><div class="tt-b">${esc(tipo)}</div></div>
      <div class="tt-c">${st.map((x) => `<div class="mod">${esc(x)}</div>`).join("") || `<div class="muted small" style="text-align:center">Sem efeito próprio (passagem).</div>`}</div></div>
    <p class="small" style="margin:10px 0 4px;color:var(--ouro2)">${esc(onde)}</p>
    ${val.por.length ? `<div class="small muted">Por que vale (para esta build):</div><ul class="pq-lista">${val.por.slice(0, 5).map((x) => `<li><span>${esc(x.l)}</span><b class="${x.v < 0 ? "neg" : ""}">${x.v > 0 ? "+" : ""}${esc(x.v.toFixed(1))}</b></li>`).join("")}</ul>` : n.t !== "c" && n.t !== "as" ? `<p class="small muted">Para esta build esse nó vale pouco (nota ≈ 0).</p>` : ""}
    ${n.t === "c" || n.t === "as" ? "" : `<div class="linha-btns" style="margin-top:14px">
      <button class="btn ${fixo ? "" : "fant"}" data-q="fixo">${fixo ? ic("ok") + " Quero (fixado)" : "Quero este"}</button>
      <button class="btn ${evit ? "perigo" : "fant"}" data-q="evitar">${evit ? ic("x") + " Evitando" : "Evitar"}</button></div>`}
    <div class="linha-btns" style="margin-top:10px"><a class="btn fant mini" href="${esc(M.wikiUrl(n.n))}" target="_blank" rel="noopener">Ver na wiki</a></div>`, (c) => {
    $$("[data-q]", c).forEach((bt) => bt.addEventListener("click", () => {
      const k = bt.dataset.q;
      const lf = asc ? "ascFixos" : "planoFixos", le = asc ? "ascEvitar" : "planoEvitar";
      const tira = (arr) => arr.filter((x) => x !== n.i);
      if (k === "fixo") { b[lf] = fixo ? tira(b[lf]) : [...tira(b[lf]), n.i]; b[le] = tira(b[le]); }
      else { b[le] = evit ? tira(b[le]) : [...tira(b[le]), n.i]; b[lf] = tira(b[lf]); }
      fecharFolha();
      toast("Recalculando o caminho…");
      setTimeout(() => { calcularPlano(b); salvar(b); if (arvView) atualizarArvore(b, false); toast(k === "fixo" ? (fixo ? "Tirado dos fixos" : "Fixado: o caminho passa por ele") : (evit ? "Liberado" : "O caminho vai desviar dele")); }, 30);
    }));
  });
}

/* ---------- aba GEMAS ---------- */
function abaGemas(el, b) {
  const P = principal(b);
  const s = P && P.s;
  const sugest = s ? M.recomendarSuportes(s, b, 5) : [];
  const recJogo = new Set(s && GEM[s.n] && GEM[s.n][1] ? GEM[s.n][1] : []);
  const atuais = P ? P.g.sup : [];
  const mesmo = sugest.length && sugest.every((x) => atuais.includes(x)) && atuais.length >= sugest.length;
  const outros = (b.grupos || []).filter((g) => !P || g !== P.g);
  el.innerHTML = `
    <div class="cartao ouro">
      ${s ? `<div class="skill-top">${imgGema(s.n, "g")}<div><div class="n">${esc(s.n)}</div><div class="small muted">${esc(resumoSkill(s))}</div></div></div>
        <p class="small" style="color:var(--txt2)">${esc(s.d || "")}</p>` : `<p>Sem skill principal.</p>`}
      <div class="linha-btns"><button class="btn fant mini" data-acao="trocarSkill">Trocar skill principal</button></div>
    </div>
    <div class="secao">Suportes da skill principal (${atuais.length}/5)</div>
    <div class="cartao">
      ${atuais.map((n) => linhaSup(n, s, recJogo)).join("") || `<p class="small muted">Nenhum suporte ainda.</p>`}
      ${atuais.length < 5 && s ? `<div class="linha-btns" style="margin-top:8px"><button class="btn fant mini" data-acao="addSup">${ic("mais")} Adicionar suporte</button></div>` : ""}
    </div>
    ${s && !mesmo ? `<div class="cartao ouro"><div class="secao" style="margin-top:0">Sugestão do app</div>
      <div class="chips" style="margin-bottom:10px">${sugest.map((n) => `<span class="chip">${imgGema(n, "p")} ${esc(n)}${recJogo.has(n) ? ` <span class="selo verde">jogo</span>` : ""}</span>`).join("")}</div>
      <p class="small muted">Escolhidos pelos vetores de dano (more, conversão, penetração, velocidade…) e pela compatibilidade com ${esc(s.n)}. "jogo" = também recomendado pelo próprio PoE2.</p>
      <button class="btn mini" data-acao="usarSug">Usar estes suportes</button></div>` : ""}
    <div class="secao">Outras skills</div>
    <div class="cartao">
      ${outros.map((g) => { const x = M.SK.get(g.skill); return `<div class="gema-linha" data-grupo="${esc(g.skill)}">${imgGema(g.skill)}<span class="info"><span class="n">${esc(g.skill)}</span><div class="t">${esc(x ? resumoSkill(x) : "")}${x && x.sp ? " · reserva " + x.sp + " de espírito" : ""}</div></span></div>`; }).join("") || `<p class="small muted">Nenhuma — buffs (auras, heralds) e skills de movimento entram aqui.</p>`}
      <div class="linha-btns" style="margin-top:8px"><button class="btn fant mini" data-acao="addSkill">${ic("mais")} Adicionar skill</button></div>
    </div>
    <div class="secao">Arma</div>
    <div class="cartao"><div class="campos">
      <div class="campo"><label for="arma">Arma</label><select id="arma">${M.ARMAS.map((a) => `<option value="${esc(a.id)}" ${a.id === b.arma ? "selected" : ""}>${esc(a.pt)}</option>`).join("")}</select></div>
      <div class="campo"><label for="off">Mão secundária</label><select id="off">${M.OFFHANDS.map((a) => `<option value="${esc(a.id)}" ${a.id === b.offhand ? "selected" : ""}>${esc(a.pt)}</option>`).join("")}</select></div>
    </div>${s && !M.armaAtende(s.w, b.arma, b.offhand) ? `<p class="small" style="color:var(--erro)">${esc(s.n)} pede: ${esc(s.w)}.</p>` : ""}</div>`;
  $$("[data-sup]", el).forEach((d) => d.addEventListener("click", () => folhaSup(b, d.dataset.sup)));
  $$("[data-grupo]", el).forEach((d) => d.addEventListener("click", () => folhaSkill(b, d.dataset.grupo)));
  $("#arma").addEventListener("change", (e) => { b.arma = e.target.value; salvar(b); render(); });
  $("#off").addEventListener("change", (e) => { b.offhand = e.target.value; salvar(b); render(); });
}
function linhaSup(n, s, recJogo) {
  const su = M.SU.get(n);
  const ok = su && s ? M.compativel(su, s) : true;
  const fx = su && su.fx && su.fx[0] ? su.fx[0].replace(/\n/g, " ") : "";
  return `<div class="gema-linha" data-sup="${esc(n)}">${imgGema(n)}<span class="info"><span class="n sup">${esc(n)}</span>${recJogo.has(n) ? ` <span class="selo verde">jogo</span>` : ""}
    <div class="t ${ok ? "" : "ruim"}">${ok ? esc(fx) : "Não funciona nesta skill"}</div></span></div>`;
}
function folhaSup(b, n) {
  const su = M.SU.get(n);
  const P = principal(b);
  abrirFolha(`<div class="tt gema"><div class="tt-h"><div class="tt-n">${esc(n)}</div><div class="tt-b">Gema de suporte${su && su.lin ? " · linhagem" : ""}</div></div>
    <div class="tt-c">${su ? (su.fx || []).map((f) => `<div class="mod">${esc(f.replace(/\n/g, " "))}</div>`).join("") : ""}${su && su.d ? `<p class="small muted" style="text-align:center">${esc(su.d)}</p>` : ""}</div></div>
    <div class="linha-btns" style="margin-top:14px"><button class="btn perigo" data-x="tirar">Remover</button><a class="btn fant" href="${esc(M.wikiUrl(n))}" target="_blank" rel="noopener">Wiki</a></div>`, (c) => {
    $("[data-x=tirar]", c).addEventListener("click", () => { if (P) P.g.sup = P.g.sup.filter((x) => x !== n); salvar(b); fecharFolha(); render(); });
  });
}
function folhaSkill(b, nome) {
  const s = M.SK.get(nome);
  const g = b.grupos.find((x) => x.skill === nome);
  abrirFolha(`<div class="tt gema"><div class="tt-h"><div class="tt-n">${esc(nome)}</div><div class="tt-b">${esc(s ? resumoSkill(s) : "")}</div></div>
    <div class="tt-c"><p class="small" style="color:var(--txt2)">${esc(s ? s.d : "")}</p></div></div>
    <div class="linha-btns" style="margin-top:14px"><button class="btn" data-x="principal">Tornar principal</button><button class="btn perigo" data-x="tirar">Remover</button></div>`, (c) => {
    $("[data-x=tirar]", c).addEventListener("click", () => { b.grupos = b.grupos.filter((x) => x !== g); salvar(b); fecharFolha(); render(); });
    $("[data-x=principal]", c).addEventListener("click", () => {
      b.grupos.forEach((x) => { if (x.papel === "principal") x.papel = "secundaria"; });
      g.papel = "principal";
      if (!g.sup.length) g.sup = M.recomendarSuportes(s, b, 5);
      if (s && !M.armaAtende(s.w, b.arma, b.offhand)) { b.arma = M.armaSugerida(s.w) || b.arma; }
      salvar(b); fecharFolha(); render(); toast("Skill principal trocada — caminho recalculado");
    });
  });
}
function seletor(titulo, itens, aoEscolher) {
  abrirFolha(`<h2>${esc(titulo)}</h2><div class="busca-box">${ic("busca")}<input id="selBusca" type="search" placeholder="Buscar…" autocomplete="off"></div><div id="selLista"></div>`, (c) => {
    const desenhar = () => {
      const q = M.norm($("#selBusca", c).value);
      const lst = itens.filter((x) => !q || q.split(" ").every((p) => M.norm(x.n + " " + (x.t || "")).includes(p))).slice(0, 50);
      $("#selLista", c).innerHTML = lst.map((x) => `<button class="skill-op" data-n="${esc(x.n)}">${imgGema(x.n)}<span class="info"><span class="n">${esc(x.n)}</span><br><span class="t">${esc(x.t || "")}</span></span>${x.selo || ""}</button>`).join("") || `<p class="vazio-txt">Nada encontrado.</p>`;
      $$("[data-n]", c).forEach((bt) => bt.addEventListener("click", () => { fecharFolha(); aoEscolher(bt.dataset.n); }));
    };
    $("#selBusca", c).addEventListener("input", debounce(desenhar, 100));
    desenhar();
  });
}

/* ---------- aba ANÁLISE ---------- */
function abaAnalise(el, b, an) {
  if (!an) { el.innerHTML = `<p class="vazio-txt">Sem análise.</p>`; return; }
  const prox = an.achados.find((a) => a.sev === "erro") || an.achados.find((a) => a.sev === "alerta") || an.achados.find((a) => a.sev === "dica");
  const resto = an.achados.filter((a) => a !== prox && a.sev !== "info");
  const N = an.notas;
  const barra = (rot, v, extra) => `<div class="barra-nota"><span>${esc(rot)}${extra || ""}</span><span class="tr"><i style="width:${Math.max(0, Math.min(100, v * 10))}%"></i></span><b>${esc(String(v).replace(".", ","))}</b></div>`;
  const st = b.stats || {};
  const CAMPOS = [["vida", "Vida"], ["es", "Escudo de energia"], ["resFogo", "Res. fogo %"], ["resFrio", "Res. gelo %"], ["resRaio", "Res. raio %"], ["resCaos", "Res. caos %"], ["armadura", "Armadura"], ["evasao", "Evasão"]];
  el.innerHTML = `
    <div class="cartao ouro" style="display:flex;gap:14px;align-items:center">
      <div class="nota ${notaCls(an.geral)}" style="width:64px;height:64px;font-size:22px">${esc(String(an.geral).replace(".", ","))}</div>
      <div><div style="font-weight:700">${esc(an.arquetipo)}</div><div class="chips" style="margin-top:6px">${(an.rotulos || []).slice(0, 5).map((r) => `<span class="chip">${esc(semEmoji(r.t))}</span>`).join("")}</div></div>
    </div>
    ${prox ? `<div class="cartao proximo"><div class="tag">Próximo passo</div><div class="tit">${esc(M.preencher(prox.titulo))}</div><div class="small" style="color:var(--txt2)">${esc(M.preencher(prox.porque || ""))}</div>${prox.acao ? `<div class="small" style="color:var(--ouro2);margin-top:6px">${esc(M.preencher(prox.acao))}</div>` : ""}</div>` : `<div class="cartao"><b>Nada urgente para corrigir.</b></div>`}
    <div class="cartao"><div class="barras">
      ${barra("Dano", N.dano)}${barra("Defesa", N.defesa, N.defesaEstimada ? " *" : "")}${barra("Recuperação", N.recuperacao)}${barra("Coerência", N.coerencia)}${barra("Controle PS5", N.controle)}${barra("Acessível", N.acesso)}
    </div>${N.defesaEstimada ? `<p class="small muted" style="margin:8px 0 0">* defesa estimada — preencha seus números abaixo (ou leia da foto do personagem).</p>` : ""}</div>
    ${resto.length ? `<div class="secao">Outros pontos (${resto.length})</div><div class="cartao">${resto.slice(0, 4).map(achadoHtml).join("")}
      ${resto.length > 4 ? `<details><summary class="small" style="color:var(--ouro2);padding:6px 0">Ver mais ${resto.length - 4}</summary>${resto.slice(4).map(achadoHtml).join("")}</details>` : ""}</div>` : ""}
    <div class="secao">Seus números (opcional)</div>
    <div class="cartao">
      <div class="campos">${CAMPOS.map(([k, rot]) => `<div class="campo"><label for="st-${k}">${esc(rot)}</label><input id="st-${k}" data-st="${k}" type="number" inputmode="numeric" value="${esc(st[k] == null ? "" : st[k])}"></div>`).join("")}</div>
      <div class="linha-btns" style="margin-top:12px"><button class="btn fant" data-ir="#/foto/${esc(b.id)}">${ic("foto")} Ler da foto do personagem</button></div>
    </div>
    <div class="secao">Aprender mais</div>
    <div class="cartao">${M.pesquisa(b).map((x) => `<div style="margin:6px 0"><div class="small">${esc(x.titulo)}</div><div class="chips" style="margin-top:4px">${x.links.map(([t, u]) => `<a class="btn fant mini" href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div></div>`).join("")}</div>`;
  $$("[data-st]", el).forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.st, v = inp.value.trim();
    if (v === "") delete b.stats[k]; else b.stats[k] = +v;
    salvar(b); render();
  }));
}
function achadoHtml(a) {
  return `<div class="achado ${esc(a.sev)}"><div class="tit">${esc(M.preencher(a.titulo))}</div>${a.porque ? `<div class="pq">${esc(M.preencher(a.porque))}</div>` : ""}${a.acao ? `<div class="ac">${esc(M.preencher(a.acao))}</div>` : ""}</div>`;
}

/* ================= MENU / AÇÕES ================= */
function menu() {
  const r = rota();
  const b = r.v === "b" ? ST.builds[r.a] : null;
  const itens = b ? [
    ["jogo", "bussola", "Levar para o jogo (Build Planner)"],
    ["fotoAtualizar", "foto", "Atualizar pela foto"],
    ["renomear", "codigo", "Renomear"],
    ["duplicar", "mais", "Duplicar"],
    ["apagar", "x", "Apagar build", "perigo"]
  ] : [
    ["pob", "codigo", "Importar código do Path of Building"],
    ["backupSai", "ok", "Exportar backup (.json)"],
    ["backupEntra", "mais", "Importar backup"],
    ["sobre", "bussola", "Sobre o Exile Compass"]
  ];
  abrirFolha(`<div class="menu-lista">${itens.map(([a, i, t, c]) => `<button data-acao="${a}" class="${c || ""}">${ic(i)} ${esc(t)}</button>`).join("")}</div>`);
}
function acao(nome, el) {
  const r = rota();
  const b = r.v === "b" ? ST.builds[r.a] : null;
  if (nome !== "pob" && nome !== "sortear") fecharFolhaSeMenu();
  switch (nome) {
    case "sortear": { const x = normalizar(M.aleatoria()); x.nome = semEmoji(x.nome); x.nivel = 1; calcularPlano(x); salvar(x); ir("#/b/" + x.id); toast("Build sorteada: " + x.nome); break; }
    case "pob": return folhaPob();
    case "renomear": if (b) folhaTexto("Nome da build", b.nome, (t) => { b.nome = t.trim() || b.nome; salvar(b); render(); }); break;
    case "nivel": if (b) folhaNivel(b); break;
    case "duplicar": if (b) { const x = normalizar(JSON.parse(JSON.stringify(b))); x.id = M.novaBuild().id; x.nome = b.nome + " (cópia)"; x.criado = Date.now(); salvar(x); ir("#/b/" + x.id); } break;
    case "apagar": if (b) apagarBuild(b.id); break;
    case "fotoAtualizar": if (b) ir("#/foto/" + b.id); break;
    case "jogo": if (b) folhaBuildPlanner(b); break;
    case "trocarSkill": if (b) {
      const rk = b.asc ? M.rankSkillsPorAsc(b.asc).map((x) => x.s) : J.skills;
      seletor("Skill principal", rk.filter((s) => s.gid && ["Attack", "Spell", "Minion"].includes(s.t) && !M.ehPersistente(s)).map((s) => ({ n: s.n, t: resumoSkill(s), selo: metaSelo(s.n, b.asc) })), (n) => {
        const s = M.SK.get(n);
        b.grupos.forEach((g) => { if (g.papel === "principal") g.papel = "secundaria"; });
        b.grupos = b.grupos.filter((g) => g.skill !== n);
        b.grupos.unshift({ skill: n, papel: "principal", sup: M.recomendarSuportes(s, b, 5) });
        if (!M.armaAtende(s.w, b.arma, b.offhand)) { b.arma = M.armaSugerida(s.w) || b.arma; if (b.arma === "Bow") b.offhand = "Quiver"; }
        salvar(b); render(); toast("Skill trocada — caminho recalculado");
      });
    } break;
    case "addSup": if (b) {
      const P = principal(b); if (!P) break;
      const lst = M.suportesCompativeis(P.s).filter((x) => !P.g.sup.includes(x.n)).map((x) => ({ x, r: M.rankSup(x, P.s, b) })).sort((a, z) => z.r - a.r);
      seletor("Adicionar suporte", lst.map(({ x }) => ({ n: x.n, t: (x.fx && x.fx[0] || "").replace(/\n/g, " ") })), (n) => { P.g.sup.push(n); salvar(b); render(); });
    } break;
    case "usarSug": if (b) { const P = principal(b); if (P) { P.g.sup = M.recomendarSuportes(P.s, b, 5); salvar(b); render(); toast("Suportes atualizados"); } } break;
    case "addSkill": if (b) {
      seletor("Adicionar skill", J.skills.filter((s) => s.gid && !b.grupos.some((g) => g.skill === s.n)).map((s) => ({ n: s.n, t: resumoSkill(s) + (s.sp ? " · espírito " + s.sp : "") })), (n) => {
        const s = M.SK.get(n);
        b.grupos.push({ skill: n, papel: M.ehPersistente(s) ? "buff" : "secundaria", sup: [] });
        salvar(b); render();
      });
    } break;
    case "backupSai": {
      const blob = new Blob([JSON.stringify({ app: "exile-compass", versao: 1, builds: listaBuilds() }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "exile-compass-backup.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      break;
    }
    case "backupEntra": $("#arquivoBackup").value = ""; $("#arquivoBackup").click(); break;
    case "sobre":
      abrirFolha(`<h2>Exile Compass</h2><p class="small">Ferramenta de fã para montar builds de Path of Exile 2 no celular (feita para quem joga no PS5).</p>
        <p class="small muted">Árvore passiva, ícones e artes: exportação oficial da GGG (poe2-skilltree-export, patch ${esc(window.KB_TREE.versao.patch)}). Gemas, regras e números: Path of Building 2 (${esc(J.meta.fonte)}). Ícones das gemas e suportes recomendados: RePoE. Meta: ${esc(META.liga)}.</p>
        <p class="small muted">Sem relação com a Grinding Gear Games.</p>`);
      break;
    default: break;
  }
}
function fecharFolhaSeMenu() { if ($("#folhaCorpo .menu-lista")) fecharFolha(); }
function folhaTexto(titulo, valor, ok) {
  abrirFolha(`<h2>${esc(titulo)}</h2><input id="txtIn" class="campo" style="width:100%;min-height:46px;border-radius:10px;border:1px solid var(--borda2);background:#0f0d0b;padding:10px" value="${esc(valor)}"><div class="linha-btns" style="margin-top:12px"><button class="btn" id="txtOk">Salvar</button></div>`, (c) => {
    const inp = $("#txtIn", c); inp.focus(); inp.select();
    const fim = () => { ok(inp.value); fecharFolha(); };
    $("#txtOk", c).addEventListener("click", fim);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fim(); });
  });
}
function folhaNivel(b) {
  abrirFolha(`<h2>Nível do personagem</h2><div style="text-align:center;font-size:34px;font-weight:800;color:var(--ouro2)" id="nvTxt">${esc(b.nivel)}</div>
    <input id="nvIn" type="range" min="1" max="100" value="${esc(b.nivel)}"><p class="small muted">O caminho mostra em dourado cheio o que você já deveria ter neste nível.</p>
    <div class="linha-btns"><button class="btn" id="nvOk">Pronto</button></div>`, (c) => {
    $("#nvIn", c).addEventListener("input", (e) => { $("#nvTxt", c).textContent = e.target.value; });
    $("#nvOk", c).addEventListener("click", () => { b.nivel = +$("#nvIn", c).value; salvar(b); fecharFolha(); render(); });
  });
}
function folhaPob() {
  abrirFolha(`<h2>Código do Path of Building 2</h2><p class="small muted">Cole o código (ou link do pobb.in) de uma build do PoB2. A árvore que já está nele vira o ponto de partida do caminho.</p>
    <textarea id="pobTxt" placeholder="eNrt…"></textarea><div id="pobErro" class="small" style="color:var(--erro)"></div>
    <div class="linha-btns" style="margin-top:10px"><button class="btn" id="pobOk">Importar</button></div>`, (c) => {
    $("#pobOk", c).addEventListener("click", async () => {
      try {
        const r = await window.Pob.importar($("#pobTxt", c).value);
        const b = normalizar(r.build);
        const A = CAM.ASC.get(b.asc);
        const base = A ? (A.base || A.id) : "";
        b.nosAtuais = (b.nosIds || []).filter((id) => { const n = CAM.NO.get(id); return n && !n.a; });
        b.ascFixos = (b.nosIds || []).filter((id) => { const n = CAM.NO.get(id); return n && n.a === base && n.t !== "as"; });
        calcularPlano(b); salvar(b); fecharFolha(); ir("#/b/" + b.id);
        toast(r.desconhecidos.length ? "Importada — ignorei: " + r.desconhecidos.slice(0, 3).join(", ") : "Build importada do PoB");
      } catch (e) { $("#pobErro", c).textContent = e.message || String(e); }
    });
  });
}
async function folhaBuildPlanner(b) {
  plano(b);
  abrirFolha(`<h2>Levar para o jogo</h2><p class="small muted">Gera o arquivo <b>.build</b> do Build Planner oficial do PoE2 (árvore do caminho, gemas e únicos). Envie em <b>pathofexile2.com</b> (Build Planner) para usar no jogo.</p><div id="bpAvisos" class="small muted">Gerando…</div><div class="linha-btns" style="margin-top:12px"><button class="btn" id="bpBaixar" disabled>Baixar ${esc(window.BuildPlanner.nomeArquivo(b))}</button></div>`, async (c) => {
    try {
      const r = await window.BuildPlanner.texto(b);
      $("#bpAvisos", c).innerHTML = r.avisos.length ? `<ul>${r.avisos.slice(0, 6).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "Tudo certo.";
      const bt = $("#bpBaixar", c); bt.disabled = false;
      bt.addEventListener("click", () => window.BuildPlanner.baixar(window.BuildPlanner.nomeArquivo(b), r.json));
    } catch (e) { $("#bpAvisos", c).textContent = "Erro: " + (e.message || e); }
  });
}

/* ================= eventos globais ================= */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ir],[data-acao],[data-criar],[data-nivel],[data-fechar]");
  if (!t) return;
  if (t.hasAttribute("data-fechar")) { fecharFolha(); return; }
  if (t.dataset.ir) { e.preventDefault(); fecharFolhaSeMenu(); ir(t.dataset.ir); return; }
  if (t.dataset.criar) { const b = novaDe(t.dataset.criar, t.dataset.asc); modoArv = "main"; ir("#/b/" + b.id); toast("Caminho calculado para " + b.nome); return; }
  if (t.dataset.nivel) {
    const r = rota(); const b = ST.builds[r.a]; if (!b) return;
    b.nivel = Math.max(1, Math.min(100, (b.nivel || 1) + +t.dataset.nivel));
    salvarDepois(b);
    const sp = $("[data-acao=nivel]"); if (sp) sp.textContent = "Nível " + b.nivel;
    if (arvView) atualizarArvore(b, false);
    return;
  }
  if (t.dataset.acao) acao(t.dataset.acao, t);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharFolha();
  if (e.key === "Enter" && e.target.classList && e.target.classList.contains("build-card")) e.target.click();
});
$("#menuBtn").addEventListener("click", menu);
$("#voltarBtn").addEventListener("click", () => { if (history.length > 1) history.back(); else ir("#/"); });
$("#desfazerBtn").addEventListener("click", () => { const f = undoFn; fecharDesfazer(); if (f) f(); });
$("#arquivoFoto").addEventListener("change", (e) => {
  const fs = Array.from(e.target.files || []).slice(0, 6);
  if (fs.length) lerFotos(fs, e.target.dataset.alvo || "");
});
$("#arquivoBackup").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const lst = Array.isArray(d.builds) ? d.builds : Object.values(d.builds || {});
    let n = 0;
    lst.forEach((x) => { if (x && x.id) { salvar(normalizar(x)); n++; } });
    toast(n + " builds importadas"); render();
  } catch (err) { toast("Arquivo de backup inválido"); }
});
window.addEventListener("hashchange", () => { fecharFolha(); render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { flush(); syncCheck(); } });
window.addEventListener("online", () => { flush(); syncCheck(); });

/* ================= início ================= */
loadLocal();
render();
pull().then((ok) => { if (ok) { const foco = document.activeElement; if (!foco || !/INPUT|TEXTAREA|SELECT/.test(foco.tagName)) render(); } flush(); });
setInterval(() => { if (!document.hidden) syncCheck(); }, 20000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
