/* ============================================================
   Exile Forge — interface
   ------------------------------------------------------------
   Referência visual e de organização: o próprio Path of Exile 2 e
   o Path of Building 2 (abas Cálculos/Skills/Itens/Árvore/Config/
   Notas, painel de stats, cores oficiais, tooltips de item/gema).
   Rotas por hash (#/builds, #/criar, #/biblioteca, #/calcs,
   #/build/<id>/<aba>) — o "voltar" do celular funciona.
   Dados: localStorage (cópia offline) + Firebase RTDB via REST,
   nó planos/poe2-builds-dt2026 — uma chave por build
   (builds/<id>) + lápides (apagadas/<id>) + carimbo _at.
   Regras ficam no motor.js; a biblioteca em kb/*.js.
   ============================================================ */
"use strict";
const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/poe2-builds-dt2026";
const LS_BUILDS = "forja:builds", LS_OUTBOX = "forja:outbox", LS_CALC = "forja:calc";
const M = window.Motor, J = window.KB_JOGO, AR = window.KB_ARVORE, C = window.KB_CONCEITOS, META = window.KB_META, UNI = window.KB_UNICOS;

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = (x) => JSON.parse(JSON.stringify(x));
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmt = (n) => M.fmtNum(Math.round(n * 10) / 10);
const P = (t) => esc(M.preencher(t));
const semEmoji = (t) => String(t || "").replace(/^[^\p{L}\p{N}]+\s*/u, "");
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const COR = ["STR", "DEX", "INT"];
const corDe = (req) => { const m = Math.max(...req); if (!m) return ""; return req.map((v, i) => (v >= m * 0.5 && v > 0 ? COR[i] : "")).filter(Boolean).join("/"); };
const sock = (req) => `<i class="sock s-${esc(corDe(req || [0, 0, 0]).replace("/", "-"))}" title="${esc(corDe(req || [0, 0, 0]) || "sem cor")}"></i>`;
const TIPO_PT = { Attack: "Ataque", Spell: "Feitiço", Buff: "Buff", Minion: "Minion", Warcry: "Grito", Mark: "Marca", Totem: "Totem", Banner: "Bandeira", Shapeshift: "Transformação", Channelling: "Canalização", Meta: "Meta" };
const SLOT_PT = { amulet: "Amuleto", axe: "Machado", belt: "Cinto", body: "Peitoral", boots: "Botas", bow: "Arco", claw: "Garra", crossbow: "Besta", dagger: "Adaga", flail: "Mangual", flask: "Frasco", focus: "Foco", gloves: "Luvas", helmet: "Elmo", jewel: "Joia", mace: "Maça", quiver: "Aljava", ring: "Anel", sceptre: "Cetro", shield: "Escudo", soulcore: "Soul Core", spear: "Lança", staff: "Cajado", sword: "Espada", talisman: "Talismã", tincture: "Tintura", traptool: "Armadilha", wand: "Varinha", fishing: "Vara de pesca", incursionlimb: "Membro", charm: "Charm" };
const PAPEIS = [["principal", "Skill principal"], ["secundaria", "Secundária"], ["movimento", "Movimento"], ["buff", "Buff / persistente"], ["disparada", "Disparada (trigger)"], ["utilidade", "Utilidade"]];
const CLASSE_COR = { Warrior: "#E05030", Mercenary: "#E0E070", Ranger: "#70FF70", Huntress: "#70FF70", Monk: "#30C0D0", Sorceress: "#7070FF", Witch: "#7070FF", Druid: "#C040FF", Duelist: "#E0E070" };
const clsTxt = (classe, asc) => `<span class="cls" style="color:${CLASSE_COR[classe] || "var(--txt)"}">${esc(asc || classe || "sem classe")}</span>`;
const vTag = (v) => `<span class="v v-${esc(v)}">${esc(M.VET_ROTULO[v] || v)}</span>`;
const vTags = (vs) => (vs || []).filter((v) => v !== "inc").map(vTag).join(" ");
const linhagem = (n) => ((M.SU.get(n) || {}).lin ? "◆ " : "");
const SEV_PT = { erro: "Erro", alerta: "Alerta", dica: "Dica", ok: "Ponto forte", info: "Info" };
const ROT = (rot, max) => (rot || []).slice(0, max || 8).map((r) => `<span class="rot ${esc(r.c)}">${esc(semEmoji(r.t))}</span>`).join(" ");
const casa = (q, ...txt) => !q || q.split(" ").every((p) => txt.some((t) => M.norm(t).includes(p)));
const lnks = (nome) => `<a class="btn mini fant" href="${esc(M.wikiUrl(nome))}" target="_blank" rel="noopener">Wiki</a><a class="btn mini fant" href="${esc(M.dbUrl(nome))}" target="_blank" rel="noopener">PoE2DB</a>`;

/* ---------------- tooltips no estilo do jogo ---------------- */
function ttGema(s, extra) {
  const sup = !!s.fx;
  const base = sup ? `Suporte${s.nv ? " · nível " + s.nv : ""}${s.lin ? " · linhagem" : ""}` : [TIPO_PT[s.t] || s.t, s.w].filter(Boolean).join(" · ");
  return `<div class="tt tgema"><div class="tt-h"><div class="tt-n">${esc(s.n)}</div><div class="tt-b">${esc(base)}</div></div><div class="tt-c">
    <div class="info">${esc((s.tg || []).join(", "))}${corDe(s.req) ? " · " + esc(corDe(s.req)) : ""}${s.sp ? " · reserva " + s.sp + " de espírito" : ""}</div>
    ${s.d ? `<div class="sepi"></div><div class="desc">${esc(s.d)}</div>` : ""}
    ${sup && s.fx.length ? `<div class="sepi"></div>${s.fx.map((f) => `<div class="mod">${esc(f.replace(/\n/g, " "))}</div>`).join("")}` : ""}
    ${sup ? `<div class="chips" style="justify-content:center;margin-top:6px">${vTags(s.v)}</div>` : ""}
    ${extra || ""}</div></div>`;
}
function ttUnico(u, extra) {
  return `<div class="tt unique"><div class="tt-h"><div class="tt-n">${esc(u.n)}</div><div class="tt-b">${esc(u.b)}</div></div><div class="tt-c">
    <div class="info" style="color:var(--txt3)">${esc(SLOT_PT[u.slot] || u.slot)}${u.liga ? " · " + esc(u.liga) : ""}</div><div class="sepi"></div>
    ${u.m.map((m) => `<div class="mod">${esc(m)}</div>`).join("")}${extra || ""}</div></div>`;
}
function ttNo(n, tipo, extra) {
  return `<div class="tt no"><div class="tt-h"><div class="tt-n">${esc(n.n)}</div><div class="tt-b">${esc(tipo)}${n.reg ? " · região " + esc(n.reg) : ""}</div></div><div class="tt-c">
    ${n.s.map((x) => `<div class="mod">${esc(x)}</div>`).join("")}${extra || ""}</div></div>`;
}

/* ---------------- estado ---------------- */
let ST = { builds: {}, apagadas: {} };
let lastAt = 0, offlineAvisado = false;
function normalizar(b) {
  const out = Object.assign(M.novaBuild({}), b || {});
  ["grupos", "unicos", "keystones", "ascNos", "notaveis"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = out[k] ? Object.values(out[k]) : []; });
  if (out.nosIds && !Array.isArray(out.nosIds)) out.nosIds = Object.values(out.nosIds);
  out.grupos = out.grupos.filter(Boolean).map((g) => ({ skill: g.skill || "", papel: g.papel || "secundaria", sup: Array.isArray(g.sup) ? g.sup.filter(Boolean) : g.sup ? Object.values(g.sup) : [] }));
  ["stats", "recup", "vetMan"].forEach((k) => { if (!out[k] || typeof out[k] !== "object") out[k] = {}; });
  return out;
}
const listaBuilds = () => Object.values(ST.builds).sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0));
function saveLocal() { try { localStorage.setItem(LS_BUILDS, JSON.stringify(ST)); } catch (e) {} }
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BUILDS) || "null");
    if (raw && raw.builds) { ST = { builds: {}, apagadas: raw.apagadas || {} }; Object.values(raw.builds).forEach((b) => (ST.builds[b.id] = normalizar(b))); }
  } catch (e) {}
}

/* ---------------- rede (RTDB REST) + outbox ---------------- */
async function apiGet(p) { const r = await fetch(`${SYNC_URL}/${p}.json`, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function apiPut(p, v) { const r = await fetch(`${SYNC_URL}/${p}.json`, { method: "PUT", body: JSON.stringify(v) }); if (!r.ok) throw new Error("HTTP " + r.status); }
async function apiDel(p) { const r = await fetch(`${SYNC_URL}/${p}.json`, { method: "DELETE" }); if (!r.ok) throw new Error("HTTP " + r.status); }
const getOutbox = () => { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || "[]"); } catch (e) { return []; } };
const setOutbox = (q) => { try { localStorage.setItem(LS_OUTBOX, JSON.stringify(q)); } catch (e) {} };
async function bumpAt() { lastAt = Date.now(); try { await apiPut("_at", lastAt); } catch (e) {} }
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
  try { const at = await apiGet("_at"); if (typeof at === "number" && at > lastAt + 1500) { await pull(); if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) render(); } } catch (e) {}
}
function salvar(b) { b.atualizado = Date.now(); ST.builds[b.id] = b; saveLocal(); push("put", "builds/" + b.id, b); }
const salvarDepois = debounce((b) => salvar(b), 600);
function apagarBuild(id) {
  const b = ST.builds[id]; if (!b) return;
  delete ST.builds[id];
  const t = Date.now(); ST.apagadas[id] = t;
  saveLocal(); push("del", "builds/" + id); push("put", "apagadas/" + id, t);
  ir("#/builds");
  desfazer("Build apagada", () => { delete ST.apagadas[id]; push("del", "apagadas/" + id); salvar(b); render(); });
}

/* ---------------- UI base ---------------- */
let undoFn = null, undoTimer = null, toastTimer = null;
function desfazer(msg, fn) { undoFn = fn; $("#desfazerTxt").textContent = msg; $("#desfazer").classList.remove("hidden"); clearTimeout(undoTimer); undoTimer = setTimeout(fecharDesfazer, 12000); }
function fecharDesfazer() { $("#desfazer").classList.add("hidden"); undoFn = null; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 2400); }
const abrir = (id) => $(id).classList.remove("hidden");
const fechar = (el) => (typeof el === "string" ? $(el) : el).classList.add("hidden");
function mostrarTexto(titulo, txt) { $("#textoTitulo").textContent = titulo; $("#textoArea").value = txt; abrir("#textoModal"); }

/* ---------------- rotas ---------------- */
function rota() {
  const p = (location.hash || "#/builds").slice(2).split("/").map(decodeURIComponent);
  return { v: p[0] || "builds", id: p[1], sub: p[2] || "calcs" };
}
function ir(h) { if (location.hash === h) render(); else location.hash = h; }
let ultimaVista = "";
function render() {
  const r = rota();
  const aba = r.v === "build" ? "#/builds" : "#/" + r.v;
  $$(".aba").forEach((b) => b.classList.toggle("on", b.dataset.rota === aba));
  const chave = r.v + "/" + (r.id || "") + "/" + (r.v === "build" ? r.sub : "");
  if (chave !== ultimaVista) { window.scrollTo(0, 0); ultimaVista = chave; }
  if (r.v === "build") return renderBuild(r.id, r.sub);
  if (r.v === "criar") return renderCriar();
  if (r.v === "biblioteca") return renderBiblioteca();
  if (r.v === "calcs") return renderCalcs();
  return renderLista();
}

/* ============================================================
   BUILDS (lista)
   ============================================================ */
function renderLista() {
  const lista = listaBuilds();
  $("#vista").innerHTML = `
    <div class="ph"><h2>Builds</h2><div class="linha"><button class="btn mini fant" data-a="pob">Importar PoB</button><button class="btn mini prim" data-a="nova">Nova build</button></div></div>
    <p class="hint">Monte, importe do Path of Building 2 ou gere pelo assistente. Cada build é avaliada pelas mecânicas do jogo (dados do PoB2).</p>
    ${lista.length ? `<div class="stack">${lista.map((b) => {
      const r = M.analisar(b), p = M.principal(b);
      const erros = r.achados.filter((a) => a.sev === "erro").length;
      return `<div class="painel liso bcard" data-abrir="${esc(b.id)}"><div class="bc-top"><div class="t">
          <div class="bc-nome">${esc(b.nome || "Build sem nome")}</div>
          <div class="bc-sub">${clsTxt(b.classe, b.asc)} · <span class="c-gem">${esc(p ? p.s.n : "sem skill")}</span> · nível ${esc(b.nivel || "?")}</div>
          <div class="chips">${ROT(r.rotulos, 4)}${erros ? `<span class="rot risco">${erros} erro${erros > 1 ? "s" : ""}</span>` : ""}</div></div>
          <div class="nota">${fmt(r.geral)}<small>NOTA</small></div></div></div>`;
    }).join("")}</div>` : `<div class="painel vazio"><h2>Nenhuma build ainda</h2>
      <p class="muted">Comece pelo assistente (“O que você quer jogar?”), cole um código do Path of Building 2 ou crie do zero.</p>
      <div class="linha" style="justify-content:center;margin-top:12px"><a class="btn prim" href="#/criar">Assistente</a><button class="btn fant" data-a="pob">Importar PoB</button></div></div>`}`;
}
function novaVazia() { const b = M.novaBuild({ nome: "Nova build" }); salvar(b); ir(`#/build/${b.id}/skills`); }
function usarBuild(b, sub) { b = normalizar(b); salvar(b); ir(`#/build/${b.id}/${sub || "calcs"}`); }

/* ============================================================
   PÁGINA DA BUILD (abas como no PoB2)
   ============================================================ */
const SUBABAS = [["calcs", "Cálculos"], ["skills", "Skills"], ["itens", "Itens"], ["arvore", "Árvore"], ["config", "Config"], ["notas", "Notas"]];
let filtroAch = "";
function statsPob(b) {
  const st = b.stats || {}, K = J.consts;
  const sp = M.espirito(b);
  const v = (k) => st[k] !== undefined && st[k] !== "" && st[k] !== null;
  const linha = (rot, val, cls, vazio) => `<div class="ps${vazio ? " vaz" : ""}"><span>${rot}</span><b class="${cls || ""}">${val}</b></div>`;
  const num = (k, rot, cls, suf) => v(k) ? linha(rot, M.fmtNum(Math.round(+st[k])) + (suf || ""), cls) : linha(rot, "—", "", true);
  const res = (k, rot, cls) => {
    if (!v(k)) return linha(rot, "—", "", true);
    const x = +st[k], falta = K.resMax - x;
    return linha(rot, `${x}%${falta > 0 ? ` <span class="c-neg">(−${fmt(falta)})</span>` : ""}`, falta > 0 ? "c-neg" : cls);
  };
  return `<div class="pobstats">
    ${v("dps") ? linha("DPS", M.fmtNum(st.dps), "c-off") : linha("DPS", "—", "", true)}
    ${num("ehp", "EHP total", "c-def")}
    ${num("vida", "Vida", "c-life")}${num("es", "Escudo de energia", "c-es")}
    ${num("mana", "Mana", "c-mana")}${linha("Espírito", `${sp.custo} / ${sp.total}${sp.estimado ? "*" : ""}`, sp.custo > sp.total ? "c-neg" : "c-spirit")}
    ${num("armadura", "Armadura", "c-armour")}${num("evasao", "Evasão", "c-evasion")}
    ${num("deflexao", "Deflexão", "c-evasion", "%")}${num("bloqueio", "Bloqueio", "c-armour", "%")}
    ${res("resFogo", "Res. fogo", "c-fire")}${res("resFrio", "Res. frio", "c-cold")}
    ${res("resRaio", "Res. raio", "c-lightning")}${v("resCaos") ? linha("Res. caos", st.resCaos + "%", +st.resCaos < 0 ? "c-neg" : "c-chaos") : linha("Res. caos", "—", "", true)}
  </div>`;
}
function renderBuild(id, sub) {
  const b = ST.builds[id];
  if (!b) { ir("#/builds"); return; }
  if (!SUBABAS.some(([s]) => s === sub)) sub = "calcs";
  const r = M.analisar(b);
  const corpo = { calcs: abaCalcs, skills: abaSkills, itens: abaItens, arvore: abaArvore, config: abaConfig, notas: abaNotas }[sub](b, r);
  $("#vista").innerHTML = `
    <a class="lnk voltar" href="#/builds">‹ Builds</a>
    <div class="painel">
      <div class="bp-head"><div class="nota g">${fmt(r.geral)}<small>NOTA</small></div><div class="t">
        <div class="bp-nome">${esc(b.nome || "Build sem nome")}</div>
        <div class="bp-arq">${clsTxt(b.classe, b.asc)} · nível ${esc(b.nivel)} · ${esc(b.modo)}</div>
        <div class="bp-arq">${esc(r.arquetipo)}</div></div></div>
      <div class="chips" style="margin-top:10px">${ROT(r.rotulos, 10)}</div>
      ${statsPob(b)}
      ${(b.stats && Object.keys(b.stats).length) ? "" : `<p class="hint" style="margin:8px 0 0">Sem números do personagem — preencha em Config (copie da tela do PS5) ou importe do PoB.</p>`}
      <button class="btn prim bloco" style="margin-top:12px" data-a="bp">Levar para o jogo · Build Planner</button>
    </div>
    <nav class="subabas">${SUBABAS.map(([s, t]) => `<button class="subaba${s === sub ? " on" : ""}" data-sub="${s}">${t}</button>`).join("")}</nav>
    <div style="margin-top:12px">${corpo}</div>`;
}

/* ---- aba Cálculos (análise) ---- */
function barra(rot, v, suf) {
  const cls = v < 4 ? "lo" : v < 7 ? "mid" : "hi";
  return `<div class="barra"><span>${rot}${suf || ""}</span><div class="trilho"><div class="ench ${cls}" style="width:${Math.max(3, v * 10)}%"></div></div><b>${fmt(v)}</b></div>`;
}
function abaCalcs(b, r) {
  const n = r.notas;
  const cont = (s) => r.achados.filter((a) => a.sev === s).length;
  const filtros = [["", "Todos"], ["erro", "Erros " + cont("erro")], ["alerta", "Alertas " + cont("alerta")], ["dica", "Dicas " + cont("dica")], ["ok", "Fortes " + cont("ok")], ["info", "Info " + cont("info")]];
  const achados = r.achados.filter((a) => !filtroAch || a.sev === filtroAch);
  const P0 = M.principal(b);
  const prox = r.achados.find((a) => a.sev === "erro") || r.achados.find((a) => a.sev === "alerta") || r.achados.find((a) => a.sev === "dica");
  return `
  ${prox ? `<div class="painel proximo"><h3>Próximo passo</h3><div class="at" style="margin-top:6px">${esc(prox.titulo)}</div>${prox.acao ? `<div class="aa">${esc(prox.acao)}</div>` : ""}
    ${prox.sups && prox.sups.length ? `<div class="chips" style="margin-top:8px"><button class="chip p" data-addsup="${esc(prox.sups[0])}">+ ${linhagem(prox.sups[0])}${esc(prox.sups[0])}</button></div>` : ""}
    <p class="hint" style="margin:8px 0 0">Uma coisa de cada vez: resolva esta e veja a nota mudar.</p></div>` : ""}
  <div class="painel"><h3>Avaliação</h3><div class="barras" style="margin-top:10px">
    ${barra("Dano", n.dano)}${barra("Defesa", n.defesa, n.defesaEstimada ? "*" : "")}${barra("Recuperação", n.recuperacao)}
    ${barra("Coerência", n.coerencia)}${barra("Controle (PS5)", n.controle)}${barra("Acessível", n.acesso)}</div>
    ${n.defesaEstimada ? `<p class="hint" style="margin:8px 0 0">* Defesa estimada — preencha os números em Config.</p>` : ""}</div>
  <div class="painel"><h3>Vetores de dano</h3><p class="hint">Dentro do vetor os bônus somam; entre vetores multiplicam. Vetor vazio é onde o próximo investimento mais rende.</p>
    <div class="vetores">${C.vetores.map((v) => { const f = r.vetores[v.id] || []; return `<div class="vt ${f.length ? "on" : ""}"><div class="vn">${esc(v.nome)}</div><div class="vf">${f.length ? esc(f.slice(0, 3).join(" · ")) : "vazio"}</div></div>`; }).join("")}</div></div>
  <div class="painel"><h3>Diagnóstico</h3>
    <div class="chips rolar" style="margin:10px 0">${filtros.map(([v, t]) => `<button class="chip p${filtroAch === v ? " on" : ""}" data-fach="${v}">${t}</button>`).join("")}</div>
    ${achados.map((a) => `<div class="ach ${a.sev}"><div class="sev">${SEV_PT[a.sev]}</div><div class="at">${esc(a.titulo)}</div>
      ${a.porque ? `<div class="ap">${esc(a.porque)}</div>` : ""}${a.acao ? `<div class="aa">${esc(a.acao)}</div>` : ""}
      ${a.sups && a.sups.length ? `<div class="chips">${a.sups.map((s) => `<button class="chip p" data-addsup="${esc(s)}">+ ${linhagem(s)}${esc(s)}</button>`).join("")}</div>` : ""}
      ${a.nots && a.nots.length ? `<div class="chips">${a.nots.map((s) => `<button class="chip p" data-addnot="${esc(s)}">◇ ${esc(s)}</button>`).join("")}</div>` : ""}
      ${a.wiki ? `<a class="wk" href="${esc(M.wikiUrl(a.wiki))}" target="_blank" rel="noopener">Wiki: ${esc(a.wiki.replace(/_/g, " "))}</a>` : ""}</div>`).join("") || '<p class="muted">Nada aqui.</p>'}
    ${P0 ? `<p class="hint" style="margin-top:10px">“+ suporte” coloca a gema na skill principal (${esc(P0.s.n)}); “◇” aloca o notável na build; ◆ = gema de linhagem (cara, 1 por personagem).</p>` : ""}</div>
  <div class="painel"><h3>Pesquisa antes de investir</h3><div class="pesq" style="margin-top:10px">
    ${M.pesquisa(b).map((p) => `<div class="pq"><span>${esc(p.titulo)}</span><span class="lk">${p.links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</span></div>`).join("")}</div></div>
  <div class="linha" style="margin-top:12px"><button class="btn fant" data-a="copiar">Copiar análise</button></div>`;
}

/* ---- aba Skills (grupos de soquete) ---- */
function abaSkills(b) {
  return `<p class="hint">Como no PoB2: cada grupo tem a gema ativa e os suportes. Suporte em vermelho não funciona na skill. “Sugerir” preenche os melhores suportes compatíveis por vetor de dano.</p>
  ${b.grupos.map((g, i) => {
    const s = M.SK.get(g.skill);
    return `<div class="grupo${g.papel === "principal" ? " prin" : ""}">
      <div class="g-tit"><span>Grupo ${i + 1}</span><select data-papel="${i}" aria-label="Papel">${PAPEIS.map(([v, t]) => `<option value="${v}"${v === g.papel ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="gema ativa">${sock(s && s.req)}<button class="gn" data-a="g-skill" data-g="${i}">${esc(g.skill || "Escolher gema…")}</button><button class="gx" data-a="g-del" data-g="${i}" aria-label="Remover grupo">✕</button></div>
      ${s ? `<div class="g-info">${esc([TIPO_PT[s.t] || s.t, s.w, s.sp ? "espírito " + s.sp : ""].filter(Boolean).join(" · "))}</div>` : ""}
      ${g.sup.map((n) => { const su = M.SU.get(n); const ok = su && s && M.compativel(su, s);
        return `<div class="gema sup${su && !ok ? " ruim" : ""}">${sock(su && su.req)}<button class="gn" data-a="s-ver" data-n="${esc(n)}">${linhagem(n)}${esc(n)}</button><span class="gm">${su ? vTags(su.v.filter((v) => ["more", "conv", "crit", "taken", "mitig", "vel", "cond", "menos"].includes(v)).slice(0, 2)) : '<span class="v v-menos">?</span>'}</span><button class="gx" data-a="s-del" data-g="${i}" data-n="${esc(n)}" aria-label="Remover">✕</button></div>`; }).join("")}
      ${s ? `<div class="g-acoes"><button class="btn mini fant" data-a="s-add" data-g="${i}">+ Suporte</button><button class="btn mini fant" data-a="g-sug" data-g="${i}">Sugerir</button></div>` : ""}
    </div>`;
  }).join("")}
  <button class="btn bloco" data-a="g-add">+ Grupo de soquetes</button>`;
}

/* ---- aba Itens ---- */
function abaItens(b) {
  const armas = [["", "—"]].concat(M.ARMAS.map((a) => [a.id, a.pt]));
  const offs = M.OFFHANDS.map((o) => [o.id, o.pt]);
  const sel = (f, lista, v) => `<select data-f="${f}">${lista.map(([id, t]) => `<option value="${esc(id)}"${id === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  return `<div class="painel"><h3>Sets de arma</h3>
    <div class="g2" style="margin-top:6px"><div><label class="rotulo">Arma · set 1</label>${sel("arma", armas, b.arma)}</div><div><label class="rotulo">Secundária</label>${sel("offhand", offs, b.offhand)}</div>
    <div><label class="rotulo">Arma · set 2</label>${sel("arma2", armas, b.arma2)}</div><div><label class="rotulo">Secundária</label>${sel("offhand2", offs, b.offhand2)}</div></div></div>
  <div class="painel"><div class="ph"><h3>Únicos</h3><button class="btn mini prim" data-a="u-add">+ Único</button></div>
    ${b.unicos.map((n) => { const u = M.UN.get(n); return u ? ttUnico(u, `<div class="acoes"><button class="btn mini fant" data-a="u-del" data-n="${esc(n)}">Remover</button></div>`) : `<p class="c-neg">${esc(n)} (não existe neste patch) <button class="lnk" data-a="u-del" data-n="${esc(n)}">remover</button></p>`; }).join("") || '<p class="muted">Nenhum único na build.</p>'}
  </div>`;
}

/* ---- aba Árvore ---- */
function abaArvore(b) {
  const ascs = (M.CLASSES.find((c) => c.n === b.classe) || { asc: Object.keys(C.ascendencias) }).asc;
  const nos = AR.ascendencias[b.asc] || [];
  const noL = (n, on, act, extra) => `<button class="no-l${on ? " on" : ""}${extra || ""}" data-a="${act}" data-n="${esc(n.n)}"><span class="ic"></span><span><b>${esc(n.n)}</b>${n.reg ? ` <span class="rg">${esc(n.reg)}</span>` : ""}<span class="st">${esc(n.s.join(" · "))}</span></span></button>`;
  return `<div class="painel"><h3>Classe e ascendência</h3>
    <div class="g2" style="margin-top:6px"><div><label class="rotulo">Classe</label><select data-f="classe"><option value="">—</option>${M.CLASSES.map((c) => `<option value="${esc(c.n)}"${c.n === b.classe ? " selected" : ""}>${esc(c.n)}</option>`).join("")}</select></div>
    <div><label class="rotulo">Ascendência</label><select data-f="asc"><option value="">—</option>${ascs.map((a) => `<option value="${esc(a)}"${a === b.asc ? " selected" : ""}>${esc(a)}</option>`).join("")}</select></div></div>
    ${b.asc ? `<p class="muted" style="margin-top:8px">${esc((C.ascendencias[b.asc] || {}).resumo || "")}</p>` : ""}</div>
  ${b.asc ? `<div class="painel"><h3>Ascendência — ${esc(b.asc)} <span class="muted" style="font-family:inherit;text-transform:none;letter-spacing:0">(${b.ascNos.length}/${J.consts.pontosAscendencia} pts)</span></h3><p class="hint">Toque para alocar.</p>
    <div class="nos">${nos.map((n) => noL(n, b.ascNos.includes(n.n), "asc-no")).join("")}</div></div>` : ""}
  <div class="painel"><div class="ph"><h3>Keystones</h3><button class="btn mini prim" data-a="k-add">+ Keystone</button></div>
    <div class="nos">${b.keystones.map((k) => { const n = M.KS.get(k) || { n: k, s: ["não existe neste patch"] }; return noL(n, true, "k-del", " ks"); }).join("") || '<p class="muted">Nenhuma. Toque numa alocada para remover.</p>'}</div></div>
  <div class="painel"><div class="ph"><h3>Notáveis</h3><button class="btn mini prim" data-a="n-add">+ Notável</button></div>
    <p class="hint">Liste os notáveis que definem a build — o app usa para detectar vetores de dano. A região mostra o setor da roda STR/DEX/INT.</p>
    <div class="nos">${b.notaveis.map((k) => { const n = M.NT.get(k) || { n: k, s: ["não existe neste patch"] }; return noL(n, true, "n-del"); }).join("") || '<p class="muted">Nenhum.</p>'}</div></div>`;
}

/* ---- aba Config ---- */
function abaConfig(b) {
  const st = b.stats || {};
  const num = (k, rot, cls) => `<div><label class="rotulo" for="st-${k}"><span class="${cls || ""}">${rot}</span></label><input id="st-${k}" type="number" inputmode="decimal" data-st="${k}" value="${esc(st[k] ?? "")}" placeholder="—" /></div>`;
  const chips = (campo, lista) => `<div class="chips">${lista.map(([v, t]) => `<button class="chip${b[campo] === v ? " on" : ""}" data-chip="${campo}" data-v="${v}">${t}</button>`).join("")}</div>`;
  const tg = (grupo, k, rot, sub) => `<label class="cfg"><span>${rot}${sub ? `<small>${sub}</small>` : ""}</span><input type="checkbox" data-${grupo}="${k}"${(grupo === "rec" ? b.recup : b.vetMan)[k] ? " checked" : ""} /></label>`;
  return `<div class="painel"><h3>Personagem</h3>
    <label class="rotulo" for="f-nome">Nome da build</label><input id="f-nome" type="text" data-f="nome" value="${esc(b.nome)}" maxlength="80" />
    <label class="rotulo" for="f-nivel">Nível</label><input id="f-nivel" type="number" inputmode="numeric" min="1" max="100" data-f="nivel" value="${esc(b.nivel)}" />
    <label class="rotulo">Objetivo</label>${chips("objetivo", [["campanha", "Campanha"], ["mapas", "Mapas"], ["chefes", "Chefes"], ["tudo", "Tudo"]])}
    <label class="rotulo">Liga</label>${chips("modo", [["SC", "Softcore"], ["HC", "Hardcore"], ["SSF", "SSF"], ["HCSSF", "HC SSF"]])}
    <label class="rotulo">Orçamento</label>${chips("orcamento", [["baixo", "Baixo"], ["medio", "Médio"], ["alto", "Alto"]])}</div>
  <div class="painel"><h3>Números do personagem</h3><p class="hint">Copie da tela do personagem no PS5 (resistências já vêm com a penalidade). Sem números o app estima — e avisa.</p>
    <div class="g2">${num("vida", "Vida", "c-life")}${num("es", "Escudo de energia", "c-es")}${num("mana", "Mana", "c-mana")}${num("espirito", "Espírito total", "c-spirit")}
      ${num("armadura", "Armadura", "c-armour")}${num("evasao", "Evasão", "c-evasion")}${num("deflexao", "Deflexão %", "c-evasion")}${num("bloqueio", "Bloqueio %")}
      ${num("resFogo", "Res. fogo %", "c-fire")}${num("resFrio", "Res. frio %", "c-cold")}${num("resRaio", "Res. raio %", "c-lightning")}${num("resCaos", "Res. caos %", "c-chaos")}
      ${num("crit", "Chance de crítico %")}${num("dps", "DPS (PoB)", "c-off")}</div></div>
  <div class="painel"><h3>Recuperação</h3>
    ${tg("rec", "leech", "Leech de vida / ES", "recupera parte do dano causado")}${tg("rec", "regen", "Regeneração de vida")}${tg("rec", "recarga", "Recarga de ES rápida")}
    ${tg("rec", "frasco", "Frascos de vida / mana")}${tg("rec", "charms", "Charms")}${tg("rec", "onkill", "Vida / ES ao matar")}</div>
  <div class="painel"><h3>Vetores vindos de itens e árvore</h3><p class="hint">O app detecta vetores pelas gemas, ascendência, keystones, notáveis e únicos. Marque o que vem de itens raros ou nós que você não listou.</p>
    ${C.vetores.filter((v) => v.id !== "base").map((v) => tg("vm", v.id, esc(v.nome))).join("")}${tg("vm", "ailment", "Build de ailment (ignição / veneno / sangramento)")}</div>`;
}

/* ---- aba Notas ---- */
function abaNotas(b) {
  return `<div class="painel"><h3>Notas</h3><textarea rows="8" data-f="notas" placeholder="Plano da árvore, itens que faltam, ideias…" style="margin-top:8px">${esc(b.notas)}</textarea>
    ${b.pob ? `<button class="btn fant bloco" style="margin-top:10px" data-a="ver-pob">Ver código PoB importado</button>` : ""}</div>
  <div class="linha" style="margin-top:12px"><button class="btn fant" data-a="dup">Duplicar build</button><button class="btn perigo" data-a="b-del">Apagar build</button></div>`;
}

/* ---- eventos da página da build ---- */
function onBuildInput(e) {
  const r = rota(); if (r.v !== "build") return;
  const b = ST.builds[r.id]; if (!b) return;
  const t = e.target;
  if (t.dataset.f) {
    const f = t.dataset.f;
    let v = t.value;
    if (f === "nivel") v = Math.max(1, Math.min(100, parseInt(v, 10) || 1));
    b[f] = v;
    if (f === "classe" && b.asc && M.CLASSE_DE[b.asc] !== v) { b.asc = ""; b.ascNos = []; }
    if (f === "asc") { b.ascNos = []; if (v && !b.classe) b.classe = M.CLASSE_DE[v]; }
    salvarDepois(b);
    if (e.type === "change" && ["classe", "asc", "arma", "offhand", "arma2", "offhand2"].includes(f)) render();
  } else if (t.dataset.st) {
    if (t.value === "") delete b.stats[t.dataset.st]; else b.stats[t.dataset.st] = parseFloat(t.value);
    salvarDepois(b);
  } else if (t.dataset.rec !== undefined) { b.recup[t.dataset.rec] = t.checked; salvarDepois(b); }
  else if (t.dataset.vm !== undefined) { b.vetMan[t.dataset.vm] = t.checked; salvarDepois(b); }
  else if (t.dataset.papel !== undefined && e.type === "change") {
    const gi = +t.dataset.papel;
    if (t.value === "principal") b.grupos.forEach((g) => { if (g.papel === "principal") g.papel = "secundaria"; });
    b.grupos[gi].papel = t.value; salvar(b); render();
  }
}
function onBuildClick(e) {
  const r = rota(); if (r.v !== "build") return false;
  const b = ST.builds[r.id]; if (!b) return false;
  const sb = e.target.closest("[data-sub]"); if (sb) { ir(`#/build/${b.id}/${sb.dataset.sub}`); return true; }
  const fa = e.target.closest("[data-fach]"); if (fa) { filtroAch = fa.dataset.fach; render(); return true; }
  const ch = e.target.closest("[data-chip]"); if (ch) { b[ch.dataset.chip] = ch.dataset.v; salvar(b); render(); return true; }
  const as = e.target.closest("[data-addsup]");
  if (as) {
    const P0 = M.principal(b); if (!P0) return true;
    const n = as.dataset.addsup;
    if (P0.g.sup.includes(n)) { toast("Já está na skill"); return true; }
    const antes = P0.g.sup.slice(); P0.g.sup.push(n); salvar(b); render();
    desfazer(`+ ${n}${P0.g.sup.length > 5 ? " (passou de 5 — remova um)" : ""}`, () => { P0.g.sup = antes; salvar(b); render(); });
    return true;
  }
  const an = e.target.closest("[data-addnot]");
  if (an) { if (!b.notaveis.includes(an.dataset.addnot)) b.notaveis.push(an.dataset.addnot); salvar(b); render(); toast("Notável alocado na build"); return true; }
  const el = e.target.closest("[data-a]"); if (!el) return false;
  const a = el.dataset.a, gi = +el.dataset.g, n = el.dataset.n, g = b.grupos[gi];
  const re = () => { salvar(b); render(); };
  if (a === "g-add") pickSkill(b, (s) => {
    const papel = M.ehPersistente(s) ? "buff" : b.grupos.some((x) => x.papel === "principal") ? "secundaria" : "principal";
    b.grupos.push({ skill: s.n, papel, sup: [] });
    if (papel === "principal" && !b.arma) b.arma = M.armaSugerida(s.w);
    re();
  });
  else if (a === "g-skill") pickSkill(b, (s) => { g.skill = s.n; re(); });
  else if (a === "g-del") { const c = clone(b.grupos); b.grupos.splice(gi, 1); re(); desfazer("Grupo removido", () => { b.grupos = c; re(); }); }
  else if (a === "s-add") pickSuporte(M.SK.get(g.skill), b, (su) => { if (g.sup.includes(su.n)) return toast("Já está neste grupo"); g.sup.push(su.n); re(); if (g.sup.length > 5) toast("Máximo de 5 suportes por skill"); });
  else if (a === "s-del") { g.sup = g.sup.filter((x) => x !== n); re(); }
  else if (a === "s-ver") { const su = M.SU.get(n); if (su) mostrarTexto(su.n, [su.fx.join("\n").replace(/\n+/g, "\n"), su.d].filter(Boolean).join("\n\n")); }
  else if (a === "g-sug") { const s = M.SK.get(g.skill); if (!s) return true; const antes = g.sup.slice(); g.sup = M.recomendarSuportes(s, b, 5); re(); desfazer("Suportes sugeridos: " + g.sup.length, () => { g.sup = antes; re(); }); }
  else if (a === "u-add") pickUnico((u) => { if (!b.unicos.includes(u.n)) b.unicos.push(u.n); re(); });
  else if (a === "u-del") { b.unicos = b.unicos.filter((x) => x !== n); re(); }
  else if (a === "k-add") pickNo("keystone", b, (k) => { if (!b.keystones.includes(k.n)) b.keystones.push(k.n); re(); });
  else if (a === "k-del") { b.keystones = b.keystones.filter((x) => x !== n); re(); }
  else if (a === "n-add") pickNo("notavel", b, (k) => { if (!b.notaveis.includes(k.n)) b.notaveis.push(k.n); re(); });
  else if (a === "n-del") { b.notaveis = b.notaveis.filter((x) => x !== n); re(); }
  else if (a === "asc-no") { b.ascNos = b.ascNos.includes(n) ? b.ascNos.filter((x) => x !== n) : b.ascNos.concat(n); re(); }
  else if (a === "ver-pob") mostrarTexto("Código PoB", b.pob || "");
  else if (a === "copiar") mostrarTexto("Análise", textoAnalise(b));
  else if (a === "dup") { const c = normalizar(Object.assign(clone(b), { id: M.novaBuild().id, nome: (b.nome || "Build") + " (cópia)", criado: Date.now() })); salvar(c); toast("Duplicada"); ir(`#/build/${c.id}/calcs`); }
  else if (a === "b-del") apagarBuild(b.id);
  else if (a === "bp") abrirBuildPlanner(b);
  else return false;
  return true;
}
function textoAnalise(b) {
  const r = M.analisar(b), n = r.notas, P0 = M.principal(b);
  let t = `EXILE FORGE — ${b.nome}\n${r.arquetipo}\nNota ${fmt(r.geral)} · ${r.rotulos.map((x) => semEmoji(x.t)).join(" · ")}\n\n`;
  t += `Dano ${fmt(n.dano)} · Defesa ${fmt(n.defesa)}${n.defesaEstimada ? "*" : ""} · Recuperação ${fmt(n.recuperacao)} · Coerência ${fmt(n.coerencia)} · Controle ${fmt(n.controle)} · Acessível ${fmt(n.acesso)}\n\n`;
  if (P0) t += `Skill principal: ${P0.s.n} + ${P0.g.sup.join(", ") || "sem suportes"}\n\n`;
  r.achados.filter((a) => a.sev !== "info").forEach((a) => { t += `[${SEV_PT[a.sev]}] ${a.titulo}${a.acao ? "\n   → " + a.acao : ""}${a.sups && a.sups.length ? " " + a.sups.join(", ") : ""}\n`; });
  return t + `\n(patch ${C.patch} · dados ${J.meta.fonte})`;
}

/* ============================================================
   SELETOR (picker)
   ============================================================ */
let PK = null;
function abrirPicker(cfg) {
  PK = Object.assign({ filtro: cfg.filtros ? cfg.filtros[0][0] : "", limite: 60 }, cfg);
  $("#pkTitulo").textContent = cfg.titulo;
  $("#pkBusca").value = ""; $("#pkBusca").placeholder = cfg.placeholder || "Buscar…";
  abrir("#picker"); renderPicker();
}
function renderPicker() {
  if (!PK) return;
  const q = M.norm($("#pkBusca").value);
  $("#pkFiltros").innerHTML = (PK.filtros || []).map(([v, t]) => `<button class="chip p${PK.filtro === v ? " on" : ""}" data-pkf="${esc(v)}">${esc(t)}</button>`).join("");
  const itens = PK.itens(q, PK.filtro);
  PK.atual = itens;
  let html = itens.slice(0, PK.limite).map((it, i) => `<button class="item${it.off ? " off" : ""}" data-pki="${i}"><b${it.cor ? ` style="color:${it.cor}"` : ""}>${it.pre || ""}${esc(it.titulo)}</b>${it.sub ? `<span class="is">${esc(it.sub)}</span>` : ""}${it.html ? `<span class="chips" style="margin-top:4px">${it.html}</span>` : ""}</button>`).join("");
  if (itens.length > PK.limite) html += `<button class="item" data-pkmais="1"><span class="is">Mostrar mais (${itens.length - PK.limite})…</span></button>`;
  $("#pkLista").innerHTML = html || '<p class="muted" style="text-align:center;padding:20px">Nada encontrado.</p>';
}
function pickSkill(b, cb) {
  abrirPicker({
    titulo: "Gema de skill", placeholder: "Nome, tag (fire, minion, slam…) ou arma",
    filtros: [["", "Todas"], ["Attack", "Ataques"], ["Spell", "Feitiços"], ["Minion", "Minions"], ["buff", "Persistentes"], ["arma", "Minha arma"]],
    itens: (q, f) => J.skills.filter((s) => {
      if (f === "buff") { if (!M.ehPersistente(s)) return false; }
      else if (f === "arma") { if (!s.w || !b || !M.armaAtende(s.w, b.arma, b.offhand)) return false; }
      else if (f && s.t !== f) return false;
      return casa(q, s.n, s.tg.join(" "), s.w, TIPO_PT[s.t] || "");
    }).map((s) => ({ titulo: s.n, cor: "var(--gem)", pre: sock(s.req) + " ", sub: [TIPO_PT[s.t] || s.t, s.w, s.sp ? "espírito " + s.sp : "", s.tier ? "tier " + s.tier : "especial"].filter(Boolean).join(" · "), dado: s })),
    onPick: (it) => cb(it.dado)
  });
}
function pickSuporte(skill, b, cb) {
  abrirPicker({
    titulo: "Suporte · " + (skill ? skill.n : "?"), placeholder: "Nome ou efeito (more, penetrate…)",
    filtros: [["comp", "Compatíveis"], ["more", "More"], ["conv", "Conversão"], ["crit", "Crítico"], ["taken", "Inimigo toma +"], ["mitig", "−Defesa inimiga"], ["vel", "Velocidade"], ["ailment", "Ailment"], ["clear", "Área/proj."], ["defesa", "Defesa"], ["todos", "Todos"]],
    itens: (q, f) => {
      const l = J.suportes.filter((s) => {
        const ok = skill ? M.compativel(s, skill) : true;
        if (f !== "todos" && !ok) return false;
        if (f && !["comp", "todos"].includes(f) && !s.v.includes(f)) return false;
        return casa(q, s.n, s.fam, s.fx.join(" "), s.d);
      });
      l.sort((x, y) => (M.compativel(y, skill) - M.compativel(x, skill)) || (M.rankSup(y, skill, b) - M.rankSup(x, skill, b)));
      return l.map((s) => ({ titulo: s.n, cor: skill && !M.compativel(s, skill) ? "var(--unsupported)" : "var(--gem)", pre: sock(s.req) + " " + (s.lin ? "◆ " : ""), off: skill && !M.compativel(s, skill),
        sub: s.fx.slice(0, 2).join(" · ").replace(/\n/g, " ") || s.d, html: vTags(s.v) + (s.lin ? ' <span class="v v-cond">linhagem</span>' : ""), dado: s }));
    },
    onPick: (it) => cb(it.dado)
  });
}
function pickUnico(cb) {
  const slots = [...new Set(UNI.map((u) => u.slot))].sort();
  abrirPicker({
    titulo: "Item único", placeholder: "Nome, base ou efeito",
    filtros: [["", "Todos"]].concat(slots.map((s) => [s, SLOT_PT[s] || s])),
    itens: (q, f) => UNI.filter((u) => (!f || u.slot === f) && casa(q, u.n, u.b, u.m.join(" "))).map((u) => ({ titulo: u.n, cor: "var(--unique)", sub: `${SLOT_PT[u.slot] || u.slot} · ${u.b} — ${u.m.slice(0, 2).join(" · ")}`, dado: u })),
    onPick: (it) => cb(it.dado)
  });
}
function pickNo(tipo, b, cb) {
  const reg = M.REGIAO_CLASSE[b && b.classe];
  const base = tipo === "keystone" ? AR.keystones : AR.notaveis;
  abrirPicker({
    titulo: tipo === "keystone" ? "Keystone" : "Notável", placeholder: "Nome ou efeito (penetration, more…)",
    filtros: [["", "Todas as regiões"]].concat(reg ? [["perto", "Perto de mim (" + reg + ")"]] : []).concat(["STR", "STR/DEX", "DEX", "DEX/INT", "INT", "STR/INT", "centro"].map((r) => [r, r])),
    itens: (q, f) => base.filter((n) => (!f || (f === "perto" ? n.reg === reg : n.reg === f)) && casa(q, n.n, n.s.join(" "))).map((n) => ({ titulo: n.n, cor: "var(--ouro2)", sub: n.reg + " · " + n.s.join(" · "), dado: n })),
    onPick: (it) => cb(it.dado)
  });
}

/* ============================================================
   CRIAR — "O que você quer jogar?"
   ============================================================ */
let CR = { modo: "" };
const voltarCriar = () => `<button class="lnk voltar" data-cr="">‹ O que você quer jogar?</button>`;
function proposta(b) {
  const r = M.analisar(b), P0 = M.principal(b);
  const buff = b.grupos.filter((g) => g.papel === "buff").map((g) => g.skill);
  const asc = C.ascendencias[b.asc] || {};
  return `<div class="painel"><h2>${esc(r.arquetipo)}</h2><div class="chips" style="margin-top:8px">${ROT(r.rotulos, 8)}</div>
    <dl class="kv">
      <dt>Classe</dt><dd>${clsTxt(b.classe, b.classe)} · ${clsTxt(b.classe, b.asc || "—")}</dd>
      <dt>Skill</dt><dd><b class="c-gem">${esc(P0 ? P0.s.n : "—")}</b>${P0 ? `<div class="muted">${esc(P0.s.d)}</div>` : ""}</dd>
      <dt>Arma</dt><dd>${esc(M.armaPt(b.arma))}${b.offhand ? " + " + esc(b.offhand) : ""}</dd>
      <dt>Suportes</dt><dd class="c-gem">${esc(P0 ? P0.g.sup.join(", ") : "") || "—"}</dd>
      <dt>Buff</dt><dd class="c-gem">${esc(buff.join(", ") || "—")}</dd>
      <dt>Ascendência</dt><dd>${esc(b.ascNos.join(", ") || "—")}${asc.resumo ? `<div class="muted">${esc(asc.resumo)}</div>` : ""}</dd>
      ${b.keystones.length ? `<dt>Keystone</dt><dd class="c-ouro">${esc(b.keystones.join(", "))}</dd>` : ""}
      <dt>Defesa</dt><dd>${esc({ armadura: "Armadura + vida", evasao: "Evasão + deflexão", es: "Escudo de energia", vida: "Vida + armadura/evasão", hibrido: "Híbrida" }[asc.def] || "—")}</dd>
      <dt>Nota prévia</dt><dd><b>${fmt(r.geral)}</b> <span class="muted">(sem números do personagem)</span></dd>
    </dl></div>`;
}
function renderCriar() {
  const el = $("#vista");
  if (!CR.modo) {
    el.innerHTML = `<h2>O que você quer jogar?</h2>
      <p class="hint">Escolha o ponto de partida. O assistente monta um esqueleto coerente (arma, suportes, ascendência) usando os dados do PoB2 — depois você ajusta.</p>
      <div class="opcoes">
        <button class="painel opcao" data-cr="aleatoria"><div class="ot">Build aleatória</div><div class="od">Sorteio coerente para sair do óbvio</div></button>
        <button class="painel opcao" data-cr="meta"><div class="ot">Meta</div><div class="od">O que está forte no patch</div></button>
        <button class="painel opcao" data-cr="unico"><div class="ot">Único legal</div><div class="od">Construir em volta de um item</div></button>
        <button class="painel opcao" data-cr="skill"><div class="ot">Skill divertida</div><div class="od">Começar pela gema</div></button>
        <button class="painel opcao inteira" data-cr="asc"><div class="ot">Ascendência divertida</div><div class="od">Começar pela fantasia da classe</div></button>
        <button class="painel opcao inteira" data-cr="zero"><div class="ot">Do zero</div><div class="od">Build em branco, montada por você</div></button>
      </div>
      <div class="painel" style="margin-top:14px"><h3>Depois: pesquise</h3>
        <p class="muted">Skill → wiki + PoE2DB · Ascendência → wiki + Path of Building 2 · Únicos → wiki + PoE2DB · Inspiração → poe.ninja. A aba Cálculos de cada build traz esses links prontos.</p></div>`;
    return;
  }
  if (CR.modo === "aleatoria") {
    if (!CR.prop) CR.prop = M.aleatoria({ classe: CR.classe, tipo: CR.tipo });
    el.innerHTML = `${voltarCriar()}<h2>Build aleatória</h2>
      <label class="rotulo">Classe</label><div class="chips">${[["", "Qualquer"]].concat(M.CLASSES.map((c) => [c.n, c.n])).map(([v, t]) => `<button class="chip p${(CR.classe || "") === v ? " on" : ""}" data-crc="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <label class="rotulo">Tipo</label><div class="chips">${[["", "Qualquer"], ["Attack", "Ataque"], ["Spell", "Feitiço"], ["Minion", "Minion"]].map(([v, t]) => `<button class="chip p${(CR.tipo || "") === v ? " on" : ""}" data-crt="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <div style="margin-top:14px">${proposta(CR.prop)}</div>
      <div class="linha" style="margin-top:12px"><button class="btn fant" data-cra="outra">Sortear outra</button><button class="btn prim" data-cra="usar">Usar esta build</button></div>`;
    return;
  }
  if (CR.modo === "meta") {
    el.innerHTML = `${voltarCriar()}<h2>Meta</h2><p class="hint">${esc(META.liga)} · ${esc(META.observacao)} Atualizado em ${esc(META.atualizado)} — confira sempre no poe.ninja.</p>
      <div class="stack">${META.builds.map((m, i) => `<div class="painel liso"><div class="ph"><b class="c-gem">${esc(m.skill)}</b><span class="tier">${esc(m.tier)}</span></div>
        <div class="muted">${m.asc.map((a) => clsTxt(M.CLASSE_DE[a], a)).join(" / ")} · ${esc({ mapas: "mapas", chefes: "chefes", ambos: "mapas + chefes" }[m.foco] || m.foco)} · dificuldade ${"●".repeat(m.dificuldade)}${"○".repeat(3 - m.dificuldade)}${m.starter ? " · bom começo de liga" : ""}</div>
        <p class="muted" style="color:var(--txt)">${esc(m.nota)}</p>
        <div class="chips">${m.asc.map((a) => `<button class="chip p" data-meta="${i}" data-asc="${esc(a)}">Usar com ${esc(a)}</button>`).join("")}</div></div>`).join("")}</div>
      <p class="rodape">Fontes: ${META.fontes.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join(" · ")}</p>`;
    return;
  }
  if (CR.modo === "unico") {
    const u = CR.sel && M.UN.get(CR.sel);
    if (!u) {
      const q = M.norm(CR.busca || "");
      el.innerHTML = `${voltarCriar()}<h2>Escolha um único</h2>
        <input class="busca" id="crBusca" type="search" placeholder="Nome ou efeito (ex.: minion, arrow, ignite)" value="${esc(CR.busca || "")}" />
        <div class="painel liso">${UNI.filter((x) => casa(q, x.n, x.b, x.m.join(" "), x.slot)).slice(0, 40).map((x) => `<button class="item" data-crsel="${esc(x.n)}"><b class="c-unique">${esc(x.n)}</b><span class="is">${esc((SLOT_PT[x.slot] || x.slot) + " · " + x.b)} — ${esc(x.m.slice(0, 2).join(" · "))}</span></button>`).join("")}</div>`;
      return;
    }
    const rk = M.rankSkillsPorUnico(u);
    el.innerHTML = `<button class="lnk voltar" data-crsel="">‹ Outros únicos</button>${ttUnico(u)}
      <p class="hint" style="margin-top:10px">Sinais detectados: ${esc(rk.sinais.join(", ") || "nenhum claro — escolha pela fantasia")}${rk.concedida ? ` · concede a skill <b class="c-gem">${esc(rk.concedida)}</b>` : ""}</p>
      <h3>Skills que combinam</h3><div class="painel liso" style="margin-top:8px">${rk.skills.slice(0, 12).map((x) => `<button class="item" data-crunico="${esc(x.s.n)}"><b class="c-gem">${esc(x.s.n)}</b><span class="is">${esc([TIPO_PT[x.s.t], x.s.w, corDe(x.s.req)].filter(Boolean).join(" · "))}</span></button>`).join("") || '<p class="muted">Nenhuma ligação óbvia.</p>'}</div>`;
    return;
  }
  if (CR.modo === "skill") {
    const s = CR.sel && M.SK.get(CR.sel);
    if (!s) {
      const q = M.norm(CR.busca || "");
      el.innerHTML = `${voltarCriar()}<h2>Escolha uma gema</h2>
        <input class="busca" id="crBusca" type="search" placeholder="Nome, tag (fire, minion, slam) ou arma" value="${esc(CR.busca || "")}" />
        <div class="chips" style="margin-bottom:10px">${[["", "Todas"], ["Attack", "Ataques"], ["Spell", "Feitiços"], ["Minion", "Minions"]].map(([v, t]) => `<button class="chip p${(CR.tipo || "") === v ? " on" : ""}" data-crt="${esc(v)}">${esc(t)}</button>`).join("")}</div>
        <div class="painel liso">${J.skills.filter((x) => x.tier > 0 && ["Attack", "Spell", "Minion"].includes(x.t) && (!CR.tipo || x.t === CR.tipo) && casa(q, x.n, x.tg.join(" "), x.w)).slice(0, 60).map((x) => `<button class="item" data-crsel="${esc(x.n)}"><b class="c-gem">${sock(x.req)} ${esc(x.n)}</b><span class="is">${esc([TIPO_PT[x.t], x.w].filter(Boolean).join(" · "))} — ${esc(x.d.slice(0, 110))}${x.d.length > 110 ? "…" : ""}</span></button>`).join("")}</div>`;
      return;
    }
    const asc = M.rankAscPorSkill(s).slice(0, 5);
    el.innerHTML = `<button class="lnk voltar" data-crsel="">‹ Outras gemas</button>
      ${ttGema(s, `<div class="sepi"></div><div class="info">Suportes recomendados</div><div class="c-gem" style="font-size:.84rem">${esc(M.recomendarSuportes(s, null, 5).join(" · "))}</div><div class="acoes">${lnks(s.n)}</div>`)}
      <h3 style="margin-top:14px">Ascendências que combinam</h3><div class="painel liso" style="margin-top:8px">${asc.map((a) => `<button class="item" data-crasc="${esc(a.asc)}"><b>${clsTxt(a.classe, a.asc)}</b> <span class="muted">${esc(a.classe)}</span><span class="is">${esc((C.ascendencias[a.asc] || {}).resumo || "")}</span></button>`).join("")}</div>`;
    return;
  }
  if (CR.modo === "asc") {
    const a = CR.sel;
    if (!a) {
      el.innerHTML = `${voltarCriar()}<h2>Escolha a ascendência</h2>
        ${M.CLASSES.map((c) => `<div class="painel"><h3 style="color:${CLASSE_COR[c.n]}">${esc(c.n)} <span class="muted" style="text-transform:none;letter-spacing:0;font-family:inherit">— ${esc((C.classes[c.n] || {}).arma || "")}</span></h3>
          ${c.asc.concat(c.n === "Witch" && !c.asc.includes("Abyssal Lich") ? ["Abyssal Lich"] : []).map((x) => `<button class="item" data-crsel="${esc(x)}"><b class="c-ouro">${esc(x)}</b><span class="is">${esc((C.ascendencias[x] || {}).resumo || "")}</span></button>`).join("")}</div>`).join("")}
        <div class="painel"><h3 style="color:${CLASSE_COR.Duelist}">Duelist</h3><p class="muted">Chega no 1.0 (11/12/2026), com espadas. A biblioteca é atualizada quando o PoB2 tiver os dados.</p></div>`;
      return;
    }
    el.innerHTML = `<button class="lnk voltar" data-crsel="">‹ Outras ascendências</button>
      <div class="painel"><h2>${clsTxt(M.CLASSE_DE[a], a)}</h2><p class="muted">${esc((C.ascendencias[a] || {}).resumo || "")}</p></div>
      <div style="margin-top:12px">${(AR.ascendencias[a] || []).map((n) => ttNo(n, "Nó de ascendência")).join("")}</div>
      <h3 style="margin-top:14px">Skills que combinam</h3><div class="painel liso" style="margin-top:8px">${M.rankSkillsPorAsc(a).slice(0, 10).map((x) => `<button class="item" data-crasc2="${esc(x.s.n)}"><b class="c-gem">${sock(x.s.req)} ${esc(x.s.n)}</b><span class="is">${esc([TIPO_PT[x.s.t], x.s.w].filter(Boolean).join(" · "))}</span></button>`).join("")}</div>`;
  }
}
function onCriarClick(e) {
  const t = e.target.closest("[data-cr],[data-crc],[data-crt],[data-cra],[data-meta],[data-crsel],[data-crunico],[data-crasc],[data-crasc2]");
  if (!t) return false;
  const usar = (b) => { CR = { modo: "" }; usarBuild(b, "calcs"); };
  if (t.dataset.cr !== undefined) { if (t.dataset.cr === "zero") { CR = { modo: "" }; novaVazia(); return true; } CR = { modo: t.dataset.cr }; }
  else if (t.dataset.crc !== undefined) { CR.classe = t.dataset.crc; CR.prop = null; }
  else if (t.dataset.crt !== undefined) { CR.tipo = t.dataset.crt; CR.prop = null; }
  else if (t.dataset.cra === "outra") CR.prop = null;
  else if (t.dataset.cra === "usar") { usar(CR.prop); return true; }
  else if (t.dataset.meta !== undefined) { const m = META.builds[+t.dataset.meta]; usar(M.montar(m.skill, t.dataset.asc, "meta")); return true; }
  else if (t.dataset.crsel !== undefined) CR.sel = t.dataset.crsel || null;
  else if (t.dataset.crunico !== undefined) { const s = M.SK.get(t.dataset.crunico); const b = M.montar(s.n, M.rankAscPorSkill(s)[0].asc, "assistente"); b.unicos = [CR.sel]; b.nome = s.n + " + " + CR.sel; usar(b); return true; }
  else if (t.dataset.crasc !== undefined) { usar(M.montar(CR.sel, t.dataset.crasc, "assistente")); return true; }
  else if (t.dataset.crasc2 !== undefined) { usar(M.montar(t.dataset.crasc2, CR.sel, "assistente")); return true; }
  renderCriar(); window.scrollTo(0, 0);
  return true;
}

/* ============================================================
   BIBLIOTECA
   ============================================================ */
let BB = { seg: "mecanicas", limite: 40, busca: "" };
const SEGS = [["mecanicas", "Mecânicas"], ["gemas", "Gemas"], ["suportes", "Suportes"], ["unicos", "Únicos"], ["asc", "Ascendências"], ["arvore", "Árvore"], ["ferramentas", "Ferramentas"], ["meta", "Meta"], ["sobre", "Sobre"]];
const det = (titulo, sub, corpo, aberto) => `<details${aberto ? " open" : ""}><summary><span><span class="ln">${titulo}</span>${sub ? `<span class="ls">${sub}</span>` : ""}</span></summary><div class="lc">${corpo}</div></details>`;
function contagem(q) {
  if (!q) return {};
  return {
    mecanicas: C.topicos.filter((t) => casa(q, t.titulo, M.preencher(t.resumo), t.pontos.join(" "))).length,
    gemas: J.skills.filter((s) => casa(q, s.n, s.tg.join(" "), s.d)).length,
    suportes: J.suportes.filter((s) => casa(q, s.n, s.fx.join(" "), s.d)).length,
    unicos: UNI.filter((u) => casa(q, u.n, u.b, u.m.join(" "))).length,
    asc: Object.keys(C.ascendencias).filter((a) => casa(q, a, C.ascendencias[a].resumo, (AR.ascendencias[a] || []).map((n) => n.n + " " + n.s.join(" ")).join(" "))).length,
    arvore: AR.keystones.concat(AR.notaveis).filter((n) => casa(q, n.n, n.s.join(" "))).length
  };
}
function renderBiblioteca() {
  const q = M.norm(BB.busca);
  const cnt = contagem(q);
  const mais = (total) => total > BB.limite ? `<button class="btn fant bloco mais" data-mais="1">Mostrar mais (${total - BB.limite})</button>` : "";
  let corpo = "";
  if (BB.seg === "mecanicas") {
    const tops = C.topicos.filter((t) => casa(q, t.titulo, M.preencher(t.resumo), t.pontos.join(" ")));
    const cats = [...new Set(tops.map((t) => t.cat))];
    corpo = (q ? "" : `
      <div class="painel"><h3>Vetores de escalonamento de dano</h3><p class="hint">Dentro do vetor você soma as fontes; entre vetores você multiplica os totais.</p>
        <div class="lib">${C.vetores.map((v) => det(esc(v.nome), esc(v.fontes.join(" · ")), `<p>${P(v.desc)}</p><p class="muted"><b>Como investir:</b> ${esc(v.como)}</p>`)).join("")}</div></div>
      <div class="painel"><h3>Camadas de defesa</h3><div class="lib">${C.camadas.map((c) => det(esc(c.nome), "", `<p>${P(c.desc)}</p>`)).join("")}</div></div>
      <div class="painel"><h3>Ciclo do jogo</h3><p class="muted">${esc(C.jogo.atual)}</p><p class="muted">${esc(C.jogo.proximo)}</p><p class="muted">${esc(C.jogo.ciclo)}</p></div>`) +
      cats.map((c) => `<div class="painel"><h3>${esc(c)}</h3><div class="lib">` + tops.filter((t) => t.cat === c).map((t) => det(esc(t.titulo), P(t.resumo).slice(0, 96) + (M.preencher(t.resumo).length > 96 ? "…" : ""),
        `<p>${P(t.resumo)}</p><ul>${t.pontos.map((p) => `<li>${P(p)}</li>`).join("")}</ul>${t.wiki ? `<a href="${esc(M.wikiUrl(t.wiki))}" target="_blank" rel="noopener">Wiki: ${esc(t.wiki.replace(/_/g, " "))}</a>` : ""}`, !!q)).join("") + `</div></div>`).join("");
  } else if (BB.seg === "gemas") {
    const l = J.skills.filter((s) => casa(q, s.n, s.tg.join(" "), s.d, s.w));
    corpo = `<div class="painel liso lib">${l.slice(0, BB.limite).map((s) => det(`<span class="c-gem">${sock(s.req)} ${esc(s.n)}</span>`, esc([TIPO_PT[s.t] || s.t, s.w].filter(Boolean).join(" · ")),
      ttGema(s, `<div class="sepi"></div><div class="info">Suportes recomendados</div><div class="c-gem">${esc(M.recomendarSuportes(s, null, 5).join(" · ") || "—")}</div>
        <div class="info" style="margin-top:6px">Ascendências que combinam</div><div class="c-ouro">${esc(M.rankAscPorSkill(s).slice(0, 3).map((a) => a.asc).join(" · "))}</div>
        <div class="acoes">${lnks(s.n)}<button class="btn mini prim" data-libskill="${esc(s.n)}">Criar build</button></div>`))).join("")}</div>${mais(l.length)}`;
  } else if (BB.seg === "suportes") {
    const l = J.suportes.filter((s) => casa(q, s.n, s.fx.join(" "), s.d, s.fam));
    corpo = `<div class="painel liso lib">${l.slice(0, BB.limite).map((s) => det(`<span class="c-gem">${sock(s.req)} ${s.lin ? "◆ " : ""}${esc(s.n)}</span>`, vTags(s.v.filter((v) => v !== "inc").slice(0, 4)),
      ttGema(s, `<div class="sepi"></div><div class="info">Família: ${esc(s.fam)}${s.lin ? " · linhagem (1 por personagem)" : ""}</div><div class="acoes">${lnks(s.n)}</div>`))).join("")}</div>${mais(l.length)}`;
  } else if (BB.seg === "unicos") {
    const l = UNI.filter((u) => casa(q, u.n, u.b, u.m.join(" "), u.slot));
    corpo = `<div class="painel liso lib">${l.slice(0, BB.limite).map((u) => det(`<span class="c-unique">${esc(u.n)}</span>`, esc((SLOT_PT[u.slot] || u.slot) + " · " + u.b),
      ttUnico(u, `<div class="acoes">${lnks(u.n)}<button class="btn mini prim" data-libunico="${esc(u.n)}">Construir em volta</button></div>`))).join("")}</div>${mais(l.length)}`;
  } else if (BB.seg === "asc") {
    corpo = M.CLASSES.map((c) => {
      const ascs = c.asc.concat(c.n === "Witch" && !c.asc.includes("Abyssal Lich") ? ["Abyssal Lich"] : []).filter((a) => casa(q, a, (C.ascendencias[a] || {}).resumo || "", (AR.ascendencias[a] || []).map((n) => n.n + " " + n.s.join(" ")).join(" ")));
      if (!ascs.length) return "";
      return `<div class="painel"><h3 style="color:${CLASSE_COR[c.n]}">${esc(c.n)} <span class="muted" style="text-transform:none;letter-spacing:0;font-family:inherit">— ${esc((C.classes[c.n] || {}).arma || "")}</span></h3><div class="lib">` +
        ascs.map((a) => det(`<span class="c-ouro">${esc(a)}</span>`, esc(((C.ascendencias[a] || {}).resumo || "").slice(0, 90)) + "…",
          `<p>${esc((C.ascendencias[a] || {}).resumo || "")}</p>${(AR.ascendencias[a] || []).map((n) => ttNo(n, "Nó de ascendência")).join("")}
           <p class="muted"><b>Skills que combinam:</b> <span class="c-gem">${esc(M.rankSkillsPorAsc(a).slice(0, 6).map((x) => x.s.n).join(" · "))}</span></p><div class="linha">${lnks(a)}</div>`, !!q)).join("") + `</div></div>`;
    }).join("");
  } else if (BB.seg === "arvore") {
    const ks = AR.keystones.filter((n) => casa(q, n.n, n.s.join(" ")));
    const nt = AR.notaveis.filter((n) => casa(q, n.n, n.s.join(" ")));
    corpo = `<p class="hint">Região = setor da roda STR/DEX/INT onde o nó fica (calculado pela posição na árvore do PoB2).</p>
      <div class="painel"><h3>Keystones (${ks.length})</h3><div class="lib">${ks.map((n) => det(`<span class="c-ouro">${esc(n.n)}</span>`, esc(n.reg), ttNo(n, "Keystone", `<div class="acoes">${lnks(n.n)}</div>`))).join("")}</div></div>
      <div class="painel"><h3>Notáveis (${nt.length})</h3><div class="lib">${nt.slice(0, BB.limite).map((n) => det(`<span class="c-ouro">${esc(n.n)}</span>`, esc(n.reg), ttNo(n, "Notável"))).join("")}</div>${mais(nt.length)}</div>`;
  } else if (BB.seg === "ferramentas") {
    corpo = `<p class="hint">As ferramentas da comunidade — e como usar cada uma no celular.</p>` + C.ferramentas.map((f) => `<div class="painel"><h3>${esc(f.nome)}</h3><p>${esc(f.para)}</p><p class="muted">No celular: ${esc(f.celular)}</p><a class="btn mini fant" href="${esc(f.url)}" target="_blank" rel="noopener">Abrir</a></div>`).join("");
  } else if (BB.seg === "meta") {
    corpo = `<div class="painel"><h3>${esc(META.liga)}</h3><p class="muted">${esc(META.observacao)}</p><p class="muted">Atualizado: ${esc(META.atualizado)}. Ascendências populares: ${META.ascPopulares.map((a) => clsTxt(M.CLASSE_DE[a], a)).join(", ")}.</p></div>` +
      META.builds.map((m) => `<div class="painel liso" style="margin-top:8px"><div class="ph"><b class="c-gem">${esc(m.skill)}</b><span class="tier">${esc(m.tier)}</span></div><div class="muted">${m.asc.map((a) => clsTxt(M.CLASSE_DE[a], a)).join(" / ")}</div><p class="muted" style="color:var(--txt)">${esc(m.nota)}</p></div>`).join("") +
      `<p class="rodape">${META.fontes.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join(" · ")}</p>`;
  } else if (BB.seg === "sobre") {
    const k = J.consts;
    corpo = `<div class="painel"><h3>De onde vêm os dados</h3>
      <p>Gemas, suportes, únicos, árvore e ascendências são <b>gerados automaticamente</b> dos arquivos do <b>Path of Building 2</b> (${esc(J.meta.fonte)}, patch ${esc(J.meta.patch)}, gerado em ${esc(J.meta.gerado)}).</p>
      <p class="muted">${Object.entries(J.meta.contagem).map(([a, b]) => `${b} ${a}`).join(" · ")}</p>
      <p>Mecânicas, resumos de ascendência e o meta são <b>curados</b> (revisão ${esc(C.revisado)}, ${esc(C.patch)}).</p>
      <p class="muted">${esc(C.jogo.proximo)}</p></div>
      <div class="painel"><h3>Constantes do jogo (PoB2)</h3><table class="tab-mini">
        <tr><td>Resistência máx. / cap absoluto</td><td>${k.resMax}% / ${k.resMaxCap}%</td></tr>
        <tr><td>Penalidade de resistência (endgame)</td><td>${k.resPenalidade}%</td></tr>
        <tr><td>Redução física máx. (armadura)</td><td>${k.drMaxFisico}%</td></tr>
        <tr><td>Evasão máx.</td><td>${k.evasaoCap}%</td></tr>
        <tr><td>Dano desviado pela deflexão</td><td>${k.deflexaoEfeito}%</td></tr>
        <tr><td>Bloqueio máx. base / absoluto</td><td>${k.bloqueioMaxBase}% / ${k.bloqueioCap}%</td></tr>
        <tr><td>Recarga de ES</td><td>${k.esRecargaPorSeg}%/s após ${k.esAtraso}s</td></tr>
        <tr><td>Bônus de crítico base</td><td>${k.critBonusBase}%</td></tr>
        <tr><td>Espírito das quests</td><td>${k.espiritoQuests}</td></tr>
        <tr><td>Pontos: níveis + quests / ascendência</td><td>${k.pontosNivel} + ${k.pontosQuest} / ${k.pontosAscendencia}</td></tr>
        <tr><td>Resistência de chefes (PoB2)</td><td>${k.resChefe}% · pinnacle ${k.resChefePinnacle}%</td></tr></table></div>
      <div class="painel"><h3>Atualização a cada patch</h3><ol class="muted" style="padding-left:18px;margin:6px 0 0">
        <li>Quando o PoB2 suportar o patch novo, o gerador <code>poe2-builds-src/gerar_kb.py</code> relê os dados.</li>
        <li>Mecânicas (<code>kb/conceitos.js</code>) e meta (<code>kb/meta.js</code>) são revisados à mão.</li>
        <li>Suas builds continuam salvas — o app reanalisa com as regras novas.</li></ol></div>`;
  }
  $("#vista").innerHTML = `<input id="libBusca" class="busca" type="search" placeholder="Buscar gema, suporte, único, mecânica…" value="${esc(BB.busca)}" autocomplete="off" />
    <div class="chips rolar" style="margin-bottom:10px">${SEGS.map(([v, t]) => `<button class="chip p${BB.seg === v ? " on" : ""}" data-seg="${v}">${t}${cnt[v] !== undefined ? ` (${cnt[v]})` : ""}</button>`).join("")}</div>
    ${corpo}`;
}
function onBibliotecaClick(e) {
  const t = e.target.closest("[data-seg],[data-mais],[data-libskill],[data-libunico]"); if (!t) return false;
  if (t.dataset.seg) { BB.seg = t.dataset.seg; BB.limite = 40; renderBiblioteca(); window.scrollTo(0, 0); }
  else if (t.dataset.mais) { BB.limite += 60; renderBiblioteca(); }
  else if (t.dataset.libskill) { CR = { modo: "skill", sel: t.dataset.libskill }; ir("#/criar"); }
  else if (t.dataset.libunico) { CR = { modo: "unico", sel: t.dataset.libunico }; ir("#/criar"); }
  return true;
}

/* ============================================================
   CALCS
   ============================================================ */
const CALC_PADRAO = { inc: 150, more: "25, 20", critChance: 10, critBonus: 100, conv: 0, taken: 0, res: 30, vel: 1.5, armadura: 5000, evasao: 5000, nivelMonstro: 83, resEl: 75 };
let CALC = (() => { try { return Object.assign({}, CALC_PADRAO, JSON.parse(localStorage.getItem(LS_CALC) || "{}"), { base: 100 }); } catch (e) { return Object.assign({ base: 100 }, CALC_PADRAO); } })();
function renderCalcs() {
  const inp = (k, rot, tipo) => `<div><label for="c-${k}">${rot}</label><input id="c-${k}" data-calc="${k}" type="${tipo || "number"}" inputmode="decimal" value="${esc(CALC[k])}" /></div>`;
  const lista = listaBuilds();
  $("#vista").innerHTML = `
  <div class="painel"><h3>Onde investir o próximo ponto</h3>
    <p class="hint">Modelo dos vetores: dano = base × conversão × increased × crítico × inimigo-toma × (1 − resistência) × more × velocidade. Valores relativos — o que importa é a comparação.</p>
    ${lista.length ? `<select id="calcBuild" style="margin-bottom:10px"><option value="">Preencher com números de uma build…</option>${lista.map((b) => `<option value="${esc(b.id)}">${esc(b.nome)}</option>`).join("")}</select>` : ""}
    <div class="calc">${inp("inc", "% increased (soma)")}${inp("more", "More (lista: 25, 20)", "text")}${inp("critChance", "Chance de crítico %")}${inp("critBonus", "Bônus de crítico %")}
      ${inp("conv", "Gain as extra %")}${inp("taken", "Inimigo toma +%")}${inp("res", "Resistência do inimigo %")}${inp("vel", "Ações por segundo")}</div>
    <div class="chips" style="margin-top:8px"><button class="chip p" data-res="0">Monstro comum 0%</button><button class="chip p" data-res="${J.consts.resChefe}">Chefe ${J.consts.resChefe}%</button><button class="chip p" data-res="${J.consts.resChefePinnacle}">Pinnacle ${J.consts.resChefePinnacle}%</button></div>
    <div class="res" id="calcRes"></div></div>
  <div class="painel"><h3>Defesa física e evasão</h3>
    <div class="calc" style="margin-top:8px">${inp("armadura", "Armadura")}${inp("evasao", "Evasão")}${inp("nivelMonstro", "Nível do monstro")}${inp("resEl", "Sua resistência %")}</div>
    <div class="res" id="defRes"></div></div>`;
  atualizarCalc();
}
function atualizarCalc() {
  const r = M.calcDano(CALC), inv = M.ondeInvestir(CALC), f = r.f;
  const max = Math.max(...inv.map((x) => x.ganho), 1);
  $("#calcRes").innerHTML = `<div class="muted">conv ×${fmt(f.conv)} · inc ×${fmt(f.inc)} · crit ×${fmt(f.crit)} · toma ×${fmt(f.taken)} · res ×${fmt(f.mitig)} · more ×${fmt(f.more)} · vel ×${fmt(f.vel)}</div>
    <div class="grande">${M.fmtNum(Math.round(r.total))} <span class="muted" style="font-family:inherit">dano relativo/s</span></div>
    <h3 style="margin-top:8px">Ganho de cada investimento</h3>
    <div class="inv">${inv.map((x) => `<span>${esc(x.rot)}</span><b>+${fmt(x.ganho)}%</b><div class="trilho"><div class="ench" style="width:${Math.max(2, (x.ganho / max) * 100)}%"></div></div>`).join("")}</div>
    <p class="hint" style="margin:6px 0 0">O primeiro da lista é onde seu próximo item/ponto rende mais.</p>`;
  const d = M.calcDefesa(CALC);
  const mult = (100 - (+CALC.resEl || 0)) / (100 - J.consts.resMax);
  $("#defRes").innerHTML = `<table class="tab-mini">${d.golpes.map((g) => `<tr><td>Golpe físico de ${M.fmtNum(g.h)}</td><td>−${fmt(g.dr)}%</td></tr>`).join("")}
    <tr><td>Chance de evitar ataques (precisão ${M.fmtNum(d.acc)})</td><td>${fmt(d.evade)}%</td></tr>
    <tr><td>Dano elemental vs. quem está no cap (${J.consts.resMax}%)</td><td>×${fmt(mult)}</td></tr></table>
    <p class="hint" style="margin:6px 0 0">Armadura: A ÷ (A + ${J.consts.armaduraRazao}×dano), máx. ${J.consts.drMaxFisico}%. Evasão: 1 − 0,95×Ev ÷ (Ev + 4×Precisão), máx. ${J.consts.evasaoCap}%.</p>`;
  try { localStorage.setItem(LS_CALC, JSON.stringify(CALC)); } catch (e) {}
}
function preencherCalc(b) {
  const st = b.stats || {};
  if (st.crit) CALC.critChance = st.crit;
  if (st.armadura) CALC.armadura = st.armadura;
  if (st.evasao) CALC.evasao = st.evasao;
  const res = ["resFogo", "resFrio", "resRaio"].map((k) => st[k]).filter((x) => x !== undefined);
  if (res.length) CALC.resEl = Math.min(...res);
  const P0 = M.principal(b);
  if (P0) CALC.more = P0.g.sup.map((n) => M.SU.get(n)).filter((s) => s && s.v.includes("more")).map((s) => +((s.fx.join(" ").match(/(\d+)% more/) || [])[1] || 0)).filter(Boolean).join(", ");
  renderCalcs(); toast("Preenchido com " + b.nome);
}

/* ============================================================
   BUILD PLANNER (levar a build para dentro do PoE2)
   ============================================================ */
let BP = null;
async function abrirBuildPlanner(b) {
  abrir("#bpModal");
  $("#bpCorpo").innerHTML = '<p class="muted">Montando o arquivo…</p>';
  try {
    const r = await window.BuildPlanner.texto(b);
    BP = { nome: window.BuildPlanner.nomeArquivo(b), json: r.json };
    const o = r.obj;
    $("#bpCorpo").innerHTML = `
      <div class="tt no"><div class="tt-h"><div class="tt-n">${esc(o.name)}</div><div class="tt-b">${esc(o.ascendancy || "sem ascendência")} · ${esc(BP.nome)}</div></div><div class="tt-c">
        <div class="mod">${o.passives.length} passivas · ${o.skills.length} gemas · ${o.skills.reduce((a, s) => a + (s.support_skills || []).length, 0)} suportes · ${o.inventory_slots.length} slots de item</div></div></div>
      ${r.avisos.length ? `<div class="ach alerta" style="margin-top:10px"><div class="sev">Atenção</div>${r.avisos.map((x) => `<div class="ap">${esc(x)}</div>`).join("")}</div>` : ""}
      <h3 style="margin-top:14px">Como levar para o jogo</h3>
      <ol class="muted" style="padding-left:18px;margin:6px 0 0">
        <li>Toque em <b>Baixar .build</b> — o arquivo fica nos downloads do celular.</li>
        <li>Abra <a href="https://pathofexile2.com/" target="_blank" rel="noopener">pathofexile2.com</a>, entre na sua conta e procure o <b>Build Planner</b>. Envie o arquivo e <b>assine</b> a build.</li>
        <li>No jogo, a build assinada aparece no Build Planner: passivas destacadas na árvore, gemas indicadas no corte de gemas e dicas nos slots de item.</li>
        <li>No PC também dá para colocar o arquivo direto na pasta <code>Documents/My Games/Path of Exile 2/BuildPlanner</code>.</li>
      </ol>
      <p class="hint" style="margin-top:8px">Formato oficial da GGG (Build Planner v1, experimental). Pela documentação, as builds assinadas no site são carregadas pelo jogo — confirme no PS5 na primeira vez.</p>`;
  } catch (e) { $("#bpCorpo").innerHTML = `<p class="err">${esc(e.message || e)}</p>`; BP = null; }
}

/* ============================================================
   BACKUP / PoB
   ============================================================ */
function exportar() {
  const blob = new Blob([JSON.stringify({ app: "exile-forge", versao: 1, exportado: new Date().toISOString(), builds: listaBuilds() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "exile-forge-builds-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importarArquivo(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result); const l = Array.isArray(d) ? d : d.builds;
      if (!Array.isArray(l)) throw new Error("formato");
      let n = 0; l.forEach((b) => { if (b && b.id) { salvar(normalizar(b)); n++; } });
      render(); toast(n + " build(s) importada(s)");
    } catch (e) { toast("Arquivo inválido"); }
  };
  fr.readAsText(file);
}
async function importarPob() {
  $("#pobErro").textContent = ""; $("#pobOk").disabled = true; $("#pobOk").textContent = "Lendo…";
  try {
    const r = await window.Pob.importar($("#pobTexto").value);
    fechar("#pobModal"); $("#pobTexto").value = "";
    usarBuild(r.build, "calcs");
    toast("Importado do PoB" + (r.desconhecidos.length ? ` (${r.desconhecidos.length} gema(s) não reconhecida(s))` : ""));
  } catch (e) { $("#pobErro").textContent = e.message || String(e); }
  finally { $("#pobOk").disabled = false; $("#pobOk").textContent = "Importar"; }
}

/* ============================================================
   EVENTOS + BOOT
   ============================================================ */
function wire() {
  $$(".aba").forEach((b) => b.addEventListener("click", () => { if (b.dataset.rota === "#/criar" && rota().v === "criar") CR = { modo: "" }; ir(b.dataset.rota); }));
  window.addEventListener("hashchange", render);
  document.body.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fechar]"); if (f) return fechar(f.closest(".modal"));
    if (e.target.classList.contains("modal")) return fechar(e.target);
  });
  $("#vista").addEventListener("click", (e) => {
    const v = rota().v;
    if (v === "build" && onBuildClick(e)) return;
    if (v === "criar" && onCriarClick(e)) return;
    if (v === "biblioteca" && onBibliotecaClick(e)) return;
    if (v === "calcs") { const r = e.target.closest("[data-res]"); if (r) { CALC.res = +r.dataset.res; renderCalcs(); } return; }
    const a = e.target.closest("[data-a]");
    if (a && a.dataset.a === "nova") return novaVazia();
    if (a && a.dataset.a === "pob") { $("#pobErro").textContent = ""; return abrir("#pobModal"); }
    const card = e.target.closest("[data-abrir]"); if (card) ir(`#/build/${card.dataset.abrir}/calcs`);
  });
  $("#vista").addEventListener("input", (e) => {
    const v = rota().v;
    if (v === "build") return onBuildInput(e);
    if (v === "calcs" && e.target.dataset.calc) { CALC[e.target.dataset.calc] = e.target.value; return atualizarCalc(); }
    if (v === "biblioteca" && e.target.id === "libBusca") return buscaLib(e.target.value);
    if (v === "criar" && e.target.id === "crBusca") return buscaCriar(e.target.value);
  });
  $("#vista").addEventListener("change", (e) => {
    const v = rota().v;
    if (v === "build") return onBuildInput(e);
    if (v === "calcs" && e.target.id === "calcBuild" && e.target.value) { const b = ST.builds[e.target.value]; if (b) preencherCalc(b); }
  });
  /* picker */
  $("#pkBusca").addEventListener("input", debounce(() => { if (PK) { PK.limite = 60; renderPicker(); } }, 120));
  $("#pkFiltros").addEventListener("click", (e) => { const c = e.target.closest("[data-pkf]"); if (!c || !PK) return; PK.filtro = c.dataset.pkf; PK.limite = 60; renderPicker(); });
  $("#pkLista").addEventListener("click", (e) => {
    const r = e.target.closest("[data-pki],[data-pkmais]"); if (!r || !PK) return;
    if (r.dataset.pkmais) { PK.limite += 80; renderPicker(); return; }
    const it = PK.atual[+r.dataset.pki], cb = PK.onPick;
    fechar("#picker"); PK = null; cb(it);
  });
  $("#pobOk").addEventListener("click", importarPob);
  $("#bpBaixar").addEventListener("click", () => { if (BP) { window.BuildPlanner.baixar(BP.nome, BP.json); toast("Arquivo " + BP.nome + " baixado"); } });
  $("#bpCopiar").addEventListener("click", () => { if (BP) { fechar("#bpModal"); mostrarTexto("Arquivo .build (JSON)", BP.json); } });
  $("#menuBtn").addEventListener("click", () => abrir("#menuModal"));
  $("#mExport").addEventListener("click", () => { fechar("#menuModal"); exportar(); });
  $("#mImport").addEventListener("click", () => $("#arquivo").click());
  $("#arquivo").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importarArquivo(f); e.target.value = ""; fechar("#menuModal"); });
  $("#mSobre").addEventListener("click", () => { fechar("#menuModal"); BB.seg = "sobre"; ir("#/biblioteca"); });
  $("#textoCopiar").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#textoArea").value); toast("Copiado"); } catch (e) { $("#textoArea").select(); toast("Selecionado — copie pelo menu do sistema"); } });
  $("#desfazerBtn").addEventListener("click", () => { const fn = undoFn; fecharDesfazer(); if (fn) fn(); });
}
const buscaLib = debounce((v) => {
  BB.busca = v; BB.limite = 40; renderBiblioteca();
  const i = $("#libBusca"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}, 220);
const buscaCriar = debounce((v) => {
  CR.busca = v; renderCriar();
  const i = $("#crBusca"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}, 220);

async function boot() {
  $("#patch").textContent = (C.patch.split(" ")[0] || J.meta.patch);
  wire();
  loadLocal();
  render();
  if (await pull()) render();
  await flush();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncCheck(); });
  window.addEventListener("online", () => { offlineAvisado = false; flush().then(syncCheck); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
