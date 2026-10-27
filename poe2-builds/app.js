/* ============================================================
   Forja PoE2 — app (interface)
   ------------------------------------------------------------
   Abas: 🛠️ Builds · 🧭 Criar · 🔬 Análise · 📚 Saber · 🧮 Calc
   Dados: localStorage (cópia offline) + Firebase RTDB via REST
   (Receita 1), nó planos/poe2-builds-dt2026 — uma chave por build
   (builds/<id>) + lápides (apagadas/<id>) + carimbo _at.
   Regras/análise ficam no motor.js; a biblioteca em kb/*.js.
   ============================================================ */
"use strict";
const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/poe2-builds-dt2026";
const LS_BUILDS = "forja:builds", LS_OUTBOX = "forja:outbox", LS_CALC = "forja:calc", LS_ATUAL = "forja:atual";
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
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const COR = ["STR", "DEX", "INT"];
const corDe = (req) => { const m = Math.max(...req); if (!m) return ""; return req.map((v, i) => (v >= m * 0.5 && v > 0 ? COR[i] : "")).filter(Boolean).join("/"); };
const TIPO_PT = { Attack: "Ataque", Spell: "Feitiço", Buff: "Buff", Minion: "Minion", Warcry: "Grito", Mark: "Marca", Totem: "Totem", Banner: "Bandeira", Shapeshift: "Transformação", Channelling: "Canalização", Meta: "Meta" };
const SLOT_PT = { amulet: "Amuleto", axe: "Machado", belt: "Cinto", body: "Peitoral", boots: "Botas", bow: "Arco", claw: "Garra", crossbow: "Besta", dagger: "Adaga", flail: "Mangual", flask: "Frasco", focus: "Foco", gloves: "Luvas", helmet: "Elmo", jewel: "Joia", mace: "Maça", quiver: "Aljava", ring: "Anel", sceptre: "Cetro", shield: "Escudo", soulcore: "Soul Core", spear: "Lança", staff: "Cajado", sword: "Espada", talisman: "Talismã", tincture: "Tintura", traptool: "Armadilha", wand: "Varinha", fishing: "Vara de pesca", incursionlimb: "Membro", charm: "Charm" };
const PAPEIS = [["principal", "⭐ Principal"], ["secundaria", "Secundária"], ["movimento", "Movimento"], ["buff", "Buff/persistente"], ["disparada", "Disparada (trigger)"], ["utilidade", "Utilidade"]];
const VET_LISTA = ["more", "conv", "crit", "taken", "mitig", "vel", "ailment", "clear", "defesa", "efic"];
const vetTag = (v) => `<span class="tag v-${esc(v)}">${esc(M.VET_ROTULO[v] || v)}</span>`;
const linhagem = (n) => ((M.SU.get(n) || {}).lin ? "🔶 " : "");
const vetTags = (vs) => (vs || []).filter((v) => v !== "inc").map(vetTag).join(" ");

/* ---------------- estado ---------------- */
let ST = { builds: {}, apagadas: {} };
let lastAt = 0, offlineAvisado = false;

function normalizar(b) {
  const base = M.novaBuild({});
  const out = Object.assign(base, b || {});
  ["grupos", "unicos", "keystones", "ascNos", "notaveis"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = out[k] ? Object.values(out[k]) : []; });
  out.grupos = out.grupos.filter(Boolean).map((g) => ({ skill: g.skill || "", papel: g.papel || "secundaria", sup: Array.isArray(g.sup) ? g.sup.filter(Boolean) : g.sup ? Object.values(g.sup) : [] }));
  ["stats", "recup", "vetMan"].forEach((k) => { if (!out[k] || typeof out[k] !== "object") out[k] = {}; });
  return out;
}
function listaBuilds() { return Object.values(ST.builds).sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0)); }
function saveLocal() { try { localStorage.setItem(LS_BUILDS, JSON.stringify(ST)); } catch (e) {} }
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_BUILDS) || "null");
    if (raw && raw.builds) { ST = { builds: {}, apagadas: raw.apagadas || {} }; Object.values(raw.builds).forEach((b) => (ST.builds[b.id] = normalizar(b))); }
  } catch (e) {}
}

/* ---------------- rede (RTDB REST) + outbox ---------------- */
async function apiGet(path) { const r = await fetch(`${SYNC_URL}/${path}.json`, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function apiPut(path, v) { const r = await fetch(`${SYNC_URL}/${path}.json`, { method: "PUT", body: JSON.stringify(v) }); if (!r.ok) throw new Error("HTTP " + r.status); }
async function apiDel(path) { const r = await fetch(`${SYNC_URL}/${path}.json`, { method: "DELETE" }); if (!r.ok) throw new Error("HTTP " + r.status); }
const getOutbox = () => { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || "[]"); } catch (e) { return []; } };
const setOutbox = (q) => { try { localStorage.setItem(LS_OUTBOX, JSON.stringify(q)); } catch (e) {} };
async function bumpAt() { lastAt = Date.now(); try { await apiPut("_at", lastAt); } catch (e) {} }
async function push(op, path, v) {
  try {
    if (op === "put") await apiPut(path, v); else await apiDel(path);
    await bumpAt();
    if (offlineAvisado) { offlineAvisado = false; toast("Sincronizado ✅"); }
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
    /* builds só locais (criadas offline) sobem agora */
    Object.values(ST.builds).forEach((b) => { if (!remoto || !remoto[b.id]) { if (!pend.has("builds/" + b.id)) push("put", "builds/" + b.id, b); } });
    saveLocal();
    return true;
  } catch (e) { return false; }
}
async function syncCheck() {
  try { const at = await apiGet("_at"); if (typeof at === "number" && at > lastAt + 1500) { await pull(); renderAtual(); } } catch (e) {}
}

function salvarBuild(b, silencioso) {
  b.atualizado = Date.now();
  ST.builds[b.id] = b;
  saveLocal();
  push("put", "builds/" + b.id, b);
  if (!silencioso) renderBuilds();
}
const salvarDepois = debounce((b) => salvarBuild(b, true), 600);
function apagarBuild(id) {
  const b = ST.builds[id]; if (!b) return;
  delete ST.builds[id];
  const t = Date.now(); ST.apagadas[id] = t;
  saveLocal();
  push("del", "builds/" + id); push("put", "apagadas/" + id, t);
  renderBuilds();
  showUndo("Build apagada", () => { delete ST.apagadas[id]; push("del", "apagadas/" + id); salvarBuild(b); });
}

/* ---------------- UI base ---------------- */
let undoFn = null, undoTimer = null, toastTimer = null;
function showUndo(msg, fn) { undoFn = fn; $("#undoText").textContent = msg; $("#undoBar").classList.remove("hidden"); clearTimeout(undoTimer); undoTimer = setTimeout(hideUndo, 12000); }
function hideUndo() { $("#undoBar").classList.add("hidden"); undoFn = null; }
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 2400); }
function abrir(id) { $(id).classList.remove("hidden"); }
function fechar(el) { (typeof el === "string" ? $(el) : el).classList.add("hidden"); }
let abaAtual = "builds";
function goTab(nome) {
  abaAtual = nome;
  $$(".tab").forEach((t) => (t.hidden = t.dataset.tab !== nome));
  $$(".tabbtn").forEach((b) => b.classList.toggle("active", b.dataset.go === nome));
  window.scrollTo(0, 0);
  renderAtual();
}
function renderAtual() {
  if (abaAtual === "builds") renderBuilds();
  else if (abaAtual === "criar") renderCriar();
  else if (abaAtual === "analise") renderAnalise();
  else if (abaAtual === "saber") renderSaber();
  else if (abaAtual === "calc") renderCalc();
  if (!$("#editor").classList.contains("hidden")) renderEditor();
}

/* ============================================================
   ABA BUILDS
   ============================================================ */
function rotuloChips(rot, max) { return (rot || []).slice(0, max || 6).map((r) => `<span class="tag ${esc(r.c)}">${esc(r.t)}</span>`).join(" "); }
function renderBuilds() {
  const lista = listaBuilds();
  $("#buildEmpty").hidden = lista.length > 0;
  $("#buildList").innerHTML = lista.map((b) => {
    const r = M.analisar(b);
    const p = M.principal(b);
    const erros = r.achados.filter((a) => a.sev === "erro").length;
    return `<div class="bcard" data-id="${esc(b.id)}">
      <div class="bc-top"><div><div class="bc-name">${esc(b.nome || "Build sem nome")}</div>
        <div class="bc-sub">${esc([b.asc || b.classe || "sem classe", p ? p.s.n : "sem skill", "nível " + (b.nivel || "?")].join(" · "))}</div></div>
        <div class="score">${fmt(r.geral)}<small>NOTA</small></div></div>
      <div class="chips">${rotuloChips(r.rotulos, 5)}${erros ? `<span class="tag risco">❌ ${erros} erro${erros > 1 ? "s" : ""}</span>` : ""}</div>
      <div class="bc-act">
        <button class="mini-btn" data-act="analisar">🔬 Analisar</button>
        <button class="mini-btn ghost" data-act="editar">✏️ Editar</button>
        <button class="mini-btn ghost" data-act="dup">⧉ Duplicar</button>
        <button class="mini-btn ghost" data-act="del" aria-label="Apagar">🗑</button>
      </div></div>`;
  }).join("");
}
function novaVazia() { const b = M.novaBuild({ nome: "Nova build" }); salvarBuild(b); abrirEditor(b.id); }
function usarBuild(b, analisar) {
  b = normalizar(b);
  salvarBuild(b);
  try { localStorage.setItem(LS_ATUAL, b.id); } catch (e) {}
  if (analisar) { goTab("analise"); } else abrirEditor(b.id);
}

/* ============================================================
   EDITOR
   ============================================================ */
let edId = null;
const edB = () => ST.builds[edId];
function abrirEditor(id) { edId = id; try { localStorage.setItem(LS_ATUAL, id); } catch (e) {} abrir("#editor"); renderEditor(); $("#editor").scrollTop = 0; }
function fecharEditor() { fechar("#editor"); edId = null; renderAtual(); }

function opts(lista, sel) { return lista.map(([v, t]) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(t)}</option>`).join(""); }
function chipsEscolha(campo, lista, valor) {
  return `<div class="chips">${lista.map(([v, t]) => `<button class="chip${v === valor ? " sel" : ""}" data-chip="${campo}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>`;
}
function supRow(gi, nome, skill) {
  const s = M.SU.get(nome);
  const ok = s && skill && M.compativel(s, skill);
  return `<div class="sup${s && !ok ? " bad" : ""}">
    <span class="s-n">${s && s.lin ? "🔶 " : ""}${esc(nome)}</span>${s ? `<span class="chips">${vetTags(s.v.filter((v) => !["defesa", "efic", "clear", "ailment"].includes(v)).slice(0, 3))}</span>` : `<span class="tag risco">?</span>`}
    <button class="s-x" data-act="s-del" data-g="${gi}" data-n="${esc(nome)}" aria-label="Remover">✕</button></div>`;
}
function renderEditor() {
  const b = edB(); if (!b) return;
  $("#edTitle").textContent = b.nome || "Editar build";
  const classes = M.CLASSES.map((c) => [c.n, `${c.n} — ${(C.classes[c.n] || {}).pt || ""}`]);
  const ascs = (M.CLASSES.find((c) => c.n === b.classe) || { asc: Object.keys(C.ascendencias) }).asc;
  const armas = [["", "—"]].concat(M.ARMAS.map((a) => [a.id, a.pt]));
  const offs = M.OFFHANDS.map((o) => [o.id, o.pt]);
  const ascNos = (AR.ascendencias[b.asc] || []);
  const st = b.stats || {};
  const num = (k, rot, dica) => `<div class="field"><label class="lbl" for="st-${k}">${rot}</label><input id="st-${k}" type="number" inputmode="decimal" data-st="${k}" value="${esc(st[k] ?? "")}" placeholder="—" />${dica ? `<small>${dica}</small>` : ""}</div>`;
  const tg = (grupo, k, rot, sub) => `<label class="toggle"><span>${rot}${sub ? `<small>${sub}</small>` : ""}</span><input type="checkbox" data-${grupo}="${k}"${(grupo === "rec" ? b.recup : b.vetMan)[k] ? " checked" : ""} /></label>`;

  $("#edBody").innerHTML = `
  <details class="sec" open><summary>🧬 Identidade</summary><div class="sec-body">
    <label class="lbl" for="f-nome">Nome</label><input id="f-nome" type="text" data-f="nome" value="${esc(b.nome)}" maxlength="80" />
    <div class="grid2">
      <div><label class="lbl" for="f-classe">Classe</label><select id="f-classe" data-f="classe"><option value="">—</option>${opts(classes, b.classe)}</select></div>
      <div><label class="lbl" for="f-asc">Ascendência</label><select id="f-asc" data-f="asc"><option value="">—</option>${opts(ascs.map((a) => [a, a]), b.asc)}</select></div>
    </div>
    <label class="lbl" for="f-nivel">Nível do personagem</label><input id="f-nivel" type="number" inputmode="numeric" min="1" max="100" data-f="nivel" value="${esc(b.nivel)}" />
    <label class="lbl">Objetivo</label>${chipsEscolha("objetivo", [["campanha", "Campanha"], ["mapas", "Mapas"], ["chefes", "Chefes"], ["tudo", "Tudo"]], b.objetivo)}
    <label class="lbl">Modo</label>${chipsEscolha("modo", [["SC", "Softcore"], ["HC", "Hardcore"], ["SSF", "SSF"], ["HCSSF", "HC SSF"]], b.modo)}
    <label class="lbl">Orçamento</label>${chipsEscolha("orcamento", [["baixo", "Baixo"], ["medio", "Médio"], ["alto", "Alto"]], b.orcamento)}
  </div></details>

  <details class="sec" open><summary>✨ Skills e suportes <span class="tag">${b.grupos.length}</span></summary><div class="sec-body">
    <p class="hint">Marque uma skill como ⭐ principal. O botão “⚡ Sugerir” preenche os melhores suportes compatíveis (por vetor de dano).</p>
    ${b.grupos.map((g, i) => {
      const s = M.SK.get(g.skill);
      const info = s ? [TIPO_PT[s.t] || s.t, s.w ? "arma: " + s.w : "", corDe(s.req), s.sp ? "espírito " + s.sp : ""].filter(Boolean).join(" · ") : "";
      return `<div class="grupo${g.papel === "principal" ? " principal" : ""}">
        <div class="g-head"><button class="g-skill" data-act="g-skill" data-g="${i}">${esc(g.skill || "Escolher skill…")}</button>
          <select class="g-papel" data-act="g-papel" data-g="${i}" aria-label="Papel">${opts(PAPEIS, g.papel)}</select>
          <button class="g-del" data-act="g-del" data-g="${i}" aria-label="Apagar skill">🗑</button></div>
        ${info ? `<div class="g-info">${esc(info)}</div>` : ""}
        <div class="sups">${g.sup.map((n) => supRow(i, n, s)).join("")}</div>
        ${s ? `<div class="g-btns"><button class="mini-btn ghost" data-act="s-add" data-g="${i}">+ Suporte</button><button class="mini-btn ghost" data-act="g-sug" data-g="${i}">⚡ Sugerir</button></div>` : ""}
      </div>`;
    }).join("")}
    <button class="btn ghost block" data-act="g-add">+ Adicionar skill</button>
  </div></details>

  <details class="sec"><summary>⚔️ Armas</summary><div class="sec-body">
    <div class="grid2">
      <div><label class="lbl" for="f-arma">Arma (set 1)</label><select id="f-arma" data-f="arma">${opts(armas, b.arma)}</select></div>
      <div><label class="lbl" for="f-off">Mão secundária</label><select id="f-off" data-f="offhand">${opts(offs, b.offhand)}</select></div>
      <div><label class="lbl" for="f-arma2">Arma (set 2)</label><select id="f-arma2" data-f="arma2">${opts(armas, b.arma2)}</select></div>
      <div><label class="lbl" for="f-off2">Secundária (set 2)</label><select id="f-off2" data-f="offhand2">${opts(offs, b.offhand2)}</select></div>
    </div>
  </div></details>

  <details class="sec"><summary>💎 Únicos <span class="tag">${b.unicos.length}</span></summary><div class="sec-body">
    <div class="chips">${b.unicos.map((n) => `<button class="chip" data-act="u-del" data-n="${esc(n)}">${esc(n)} ✕</button>`).join("") || '<span class="muted">Nenhum.</span>'}</div>
    <button class="btn ghost block" style="margin-top:10px" data-act="u-add">+ Único</button>
  </div></details>

  <details class="sec"><summary>🌳 Ascendência e árvore</summary><div class="sec-body">
    ${b.asc ? `<label class="lbl">Nós da ${esc(b.asc)} (toque para marcar)</label>
      <div class="chips">${ascNos.map((n) => `<button class="chip sm${b.ascNos.includes(n.n) ? " sel" : ""}" data-act="asc-no" data-n="${esc(n.n)}" title="${esc(n.s.join(" / "))}">${esc(n.n)}</button>`).join("")}</div>` : '<p class="muted">Escolha a ascendência em Identidade.</p>'}
    <label class="lbl">Keystones</label>
    <div class="chips">${b.keystones.map((n) => `<button class="chip" data-act="k-del" data-n="${esc(n)}">${esc(n)} ✕</button>`).join("")}<button class="chip" data-act="k-add">+ keystone</button></div>
    <label class="lbl">Notáveis importantes</label>
    <div class="chips">${b.notaveis.map((n) => `<button class="chip sm" data-act="n-del" data-n="${esc(n)}">${esc(n)} ✕</button>`).join("")}<button class="chip" data-act="n-add">+ notável</button></div>
  </div></details>

  <details class="sec"${Object.keys(st).length ? " open" : ""}><summary>📊 Números do personagem</summary><div class="sec-body">
    <p class="hint">Copie da tela do personagem no PS5 (os valores já vêm com a penalidade de resistência). Sem números o app estima — e avisa.</p>
    <div class="grid2">
      ${num("vida", "Vida")}${num("es", "Escudo de energia")}${num("mana", "Mana")}${num("espirito", "Espírito total")}
      ${num("armadura", "Armadura")}${num("evasao", "Evasão")}${num("deflexao", "Deflexão %")}${num("bloqueio", "Bloqueio %")}
      ${num("resFogo", "Res. fogo %")}${num("resFrio", "Res. frio %")}${num("resRaio", "Res. raio %")}${num("resCaos", "Res. caos %")}
      ${num("crit", "Chance crítico %")}${num("dps", "DPS (PoB)")}
    </div>
  </div></details>

  <details class="sec"><summary>♻️ Recuperação</summary><div class="sec-body">
    ${tg("rec", "leech", "Leech de vida/ES", "recupera parte do dano causado")}${tg("rec", "regen", "Regeneração de vida")}${tg("rec", "recarga", "Recarga de ES rápida")}
    ${tg("rec", "frasco", "Frascos de vida/mana")}${tg("rec", "charms", "Charms")}${tg("rec", "onkill", "Vida/ES ao matar")}
  </div></details>

  <details class="sec"><summary>🧩 Vetores vindos da árvore/itens</summary><div class="sec-body">
    <p class="hint">O app detecta vetores pelas gems, ascendência, keystones, notáveis e únicos. Marque aqui o que vem de itens raros ou nós que você não listou.</p>
    ${C.vetores.filter((v) => v.id !== "base").map((v) => tg("vm", v.id, v.ico + " " + v.nome)).join("")}
    ${tg("vm", "ailment", "☣️ Build de ailment (ignição/veneno/sangramento)")}
  </div></details>

  <details class="sec"><summary>📝 Notas</summary><div class="sec-body">
    <textarea rows="5" data-f="notas" placeholder="Plano de árvore, itens que faltam, ideias…">${esc(b.notas)}</textarea>
    ${b.pob ? `<button class="btn ghost block" style="margin-top:10px" data-act="ver-pob">📋 Ver código PoB importado</button>` : ""}
  </div></details>
  <button class="btn danger block" data-act="b-del">🗑 Apagar build</button>`;
}

function onEditorInput(e) {
  const b = edB(); if (!b) return;
  const t = e.target;
  if (t.dataset.f) {
    const f = t.dataset.f;
    let v = t.value;
    if (f === "nivel") v = Math.max(1, Math.min(100, parseInt(v, 10) || 1));
    b[f] = v;
    if (f === "classe" && b.asc && M.CLASSE_DE[b.asc] !== v) { b.asc = ""; b.ascNos = []; }
    if (f === "asc") { b.ascNos = []; if (v && !b.classe) b.classe = M.CLASSE_DE[v]; }
    if (f === "nome") $("#edTitle").textContent = v || "Editar build";
    salvarDepois(b);
    if (e.type === "change" && ["classe", "asc", "arma", "offhand"].includes(f)) renderEditor();
  } else if (t.dataset.st) {
    const k = t.dataset.st;
    if (t.value === "") delete b.stats[k]; else b.stats[k] = parseFloat(t.value);
    salvarDepois(b);
  } else if (t.dataset.rec !== undefined) { b.recup[t.dataset.rec] = t.checked; salvarDepois(b); }
  else if (t.dataset.vm !== undefined) { b.vetMan[t.dataset.vm] = t.checked; salvarDepois(b); }
  else if (t.dataset.act === "g-papel") {
    const gi = +t.dataset.g;
    if (t.value === "principal") b.grupos.forEach((g) => { if (g.papel === "principal") g.papel = "secundaria"; });
    b.grupos[gi].papel = t.value;
    salvarBuild(b, true); renderEditor();
  }
}
function onEditorClick(e) {
  const el = e.target.closest("[data-act],[data-chip]"); if (!el) return;
  const b = edB(); if (!b) return;
  if (el.dataset.chip) { b[el.dataset.chip] = el.dataset.v; salvarBuild(b, true); renderEditor(); return; }
  const act = el.dataset.act, gi = +el.dataset.g, n = el.dataset.n;
  const g = b.grupos[gi];
  if (act === "g-add") {
    pickSkill((s) => {
      const papel = M.ehPersistente(s) ? "buff" : b.grupos.some((x) => x.papel === "principal") ? "secundaria" : "principal";
      b.grupos.push({ skill: s.n, papel, sup: [] });
      if (papel === "principal" && !b.arma) b.arma = M.armaSugerida(s.w);
      salvarBuild(b, true); renderEditor();
    }, b);
  } else if (act === "g-skill") {
    pickSkill((s) => { g.skill = s.n; salvarBuild(b, true); renderEditor(); }, b);
  } else if (act === "g-del") {
    const copia = clone(b.grupos);
    b.grupos.splice(gi, 1); salvarBuild(b, true); renderEditor();
    showUndo("Skill removida", () => { b.grupos = copia; salvarBuild(b, true); renderEditor(); });
  } else if (act === "s-add") {
    pickSuporte(M.SK.get(g.skill), b, (su) => {
      if (g.sup.includes(su.n)) return toast("Já está nesta skill");
      g.sup.push(su.n); salvarBuild(b, true); renderEditor();
      if (g.sup.length > 5) toast("Atenção: máximo de 5 suportes por skill");
    });
  } else if (act === "s-del") {
    g.sup = g.sup.filter((x) => x !== n); salvarBuild(b, true); renderEditor();
  } else if (act === "g-sug") {
    const s = M.SK.get(g.skill); if (!s) return;
    const antes = g.sup.slice();
    const rec = M.recomendarSuportes(s, b, 5);
    g.sup = rec; salvarBuild(b, true); renderEditor();
    showUndo("Suportes sugeridos: " + rec.length, () => { g.sup = antes; salvarBuild(b, true); renderEditor(); });
  } else if (act === "u-add") {
    pickUnico((u) => { if (!b.unicos.includes(u.n)) b.unicos.push(u.n); salvarBuild(b, true); renderEditor(); });
  } else if (act === "u-del") { b.unicos = b.unicos.filter((x) => x !== n); salvarBuild(b, true); renderEditor(); }
  else if (act === "k-add") { pickNo("keystone", b, (k) => { if (!b.keystones.includes(k.n)) b.keystones.push(k.n); salvarBuild(b, true); renderEditor(); }); }
  else if (act === "k-del") { b.keystones = b.keystones.filter((x) => x !== n); salvarBuild(b, true); renderEditor(); }
  else if (act === "n-add") { pickNo("notavel", b, (k) => { if (!b.notaveis.includes(k.n)) b.notaveis.push(k.n); salvarBuild(b, true); renderEditor(); }); }
  else if (act === "n-del") { b.notaveis = b.notaveis.filter((x) => x !== n); salvarBuild(b, true); renderEditor(); }
  else if (act === "asc-no") {
    b.ascNos = b.ascNos.includes(n) ? b.ascNos.filter((x) => x !== n) : b.ascNos.concat(n);
    salvarBuild(b, true); renderEditor();
  } else if (act === "ver-pob") { mostrarTexto("Código PoB", b.pob || ""); }
  else if (act === "b-del") { const id = b.id; fecharEditor(); apagarBuild(id); }
}

/* ============================================================
   SELETOR (picker genérico)
   ============================================================ */
let PK = null;
function abrirPicker(cfg) {
  PK = Object.assign({ filtro: cfg.filtros ? cfg.filtros[0][0] : "", limite: 60 }, cfg);
  $("#pkTitle").textContent = cfg.titulo;
  $("#pkBusca").value = "";
  $("#pkBusca").placeholder = cfg.placeholder || "Buscar…";
  abrir("#picker");
  renderPicker();
  setTimeout(() => { try { $("#pkBusca").focus({ preventScroll: true }); } catch (e) {} }, 60);
}
function renderPicker() {
  if (!PK) return;
  const q = M.norm($("#pkBusca").value);
  $("#pkFiltros").innerHTML = (PK.filtros || []).map(([v, t]) => `<button class="chip sm${PK.filtro === v ? " sel" : ""}" data-pkf="${esc(v)}">${esc(t)}</button>`).join("");
  const itens = PK.itens(q, PK.filtro);
  PK.atual = itens;
  let html = "";
  let secao = null;
  itens.slice(0, PK.limite).forEach((it, i) => {
    if (it.secao && it.secao !== secao) { secao = it.secao; html += `<div class="pk-sec">${esc(secao)}</div>`; }
    html += `<button class="pk-row${it.off ? " off" : ""}" data-pki="${i}"><b>${esc(it.titulo)}</b>${it.sub ? `<span class="pk-sub">${esc(it.sub)}</span>` : ""}${it.html ? `<span class="chips">${it.html}</span>` : ""}</button>`;
  });
  if (itens.length > PK.limite) html += `<button class="pk-row" data-pkmais="1"><span class="pk-sub">Mostrar mais (${itens.length - PK.limite})…</span></button>`;
  if (!itens.length) html = `<p class="empty">Nada encontrado.</p>`;
  $("#pkLista").innerHTML = html;
}
const casa = (q, ...txt) => !q || q.split(" ").every((p) => txt.some((t) => M.norm(t).includes(p)));

function pickSkill(cb, b) {
  const P0 = b && M.principal(b);
  abrirPicker({
    titulo: "Escolher skill", placeholder: "Nome, tag (fire, minion, slam…) ou arma",
    filtros: [["", "Todas"], ["Attack", "Ataques"], ["Spell", "Feitiços"], ["Minion", "Minions"], ["buff", "Buffs/persist."], ["arma", "Minha arma"]],
    itens: (q, f) => J.skills.filter((s) => {
      if (f === "buff") { if (!M.ehPersistente(s)) return false; }
      else if (f === "arma") { if (!s.w || !b || !M.armaAtende(s.w, b.arma, b.offhand)) return false; }
      else if (f && s.t !== f) return false;
      return casa(q, s.n, s.tg.join(" "), s.w, TIPO_PT[s.t] || "");
    }).map((s) => ({ titulo: s.n, sub: [TIPO_PT[s.t] || s.t, s.w, corDe(s.req), s.sp ? "espírito " + s.sp : "", s.tier ? "tier " + s.tier : "especial"].filter(Boolean).join(" · "), html: s.tg.slice(0, 5).map((t) => `<span class="tag">${esc(t)}</span>`).join(" "), dado: s })),
    onPick: (it) => cb(it.dado)
  });
}
function pickSuporte(skill, b, cb) {
  const vistos = new Set();
  abrirPicker({
    titulo: "Suporte para " + (skill ? skill.n : "?"), placeholder: "Nome ou efeito (more, penetrate…)",
    filtros: [["comp", "Compatíveis"], ["more", "More"], ["conv", "Conversão"], ["crit", "Crítico"], ["taken", "Inimigo toma +"], ["mitig", "−Defesa inimiga"], ["vel", "Velocidade"], ["ailment", "Ailment"], ["clear", "Área/proj."], ["defesa", "Defesa"], ["todos", "Todos"]],
    itens: (q, f) => {
      const lista = J.suportes.filter((s) => {
        const ok = skill ? M.compativel(s, skill) : true;
        if (f !== "todos" && !ok) return false;
        if (f && !["comp", "todos"].includes(f) && !s.v.includes(f)) return false;
        return casa(q, s.n, s.fam, s.fx.join(" "), s.d);
      });
      lista.sort((x, y) => (M.compativel(y, skill) - M.compativel(x, skill)) || (M.rankSup(y, skill, b) - M.rankSup(x, skill, b)));
      return lista.map((s) => ({
        titulo: (s.lin ? "🔶 " : "") + s.n, off: skill && !M.compativel(s, skill),
        sub: s.fx.slice(0, 2).join(" · ").replace(/\n/g, " ") || s.d,
        html: vetTags(s.v) + (s.lin ? ' <span class="tag fun">linhagem</span>' : "") + (skill && !M.compativel(s, skill) ? ' <span class="tag risco">incompatível</span>' : ""), dado: s
      }));
    },
    onPick: (it) => cb(it.dado)
  });
}
function pickUnico(cb) {
  const slots = [...new Set(UNI.map((u) => u.slot))].sort();
  abrirPicker({
    titulo: "Escolher único", placeholder: "Nome, base ou efeito",
    filtros: [["", "Todos"]].concat(slots.map((s) => [s, SLOT_PT[s] || s])),
    itens: (q, f) => UNI.filter((u) => (!f || u.slot === f) && casa(q, u.n, u.b, u.m.join(" "))).map((u) => ({ titulo: u.n, sub: `${SLOT_PT[u.slot] || u.slot} · ${u.b}${u.liga ? " · " + u.liga : ""}`, html: `<span class="pk-sub">${esc(u.m.slice(0, 2).join(" · "))}</span>`, dado: u })),
    onPick: (it) => cb(it.dado)
  });
}
function pickNo(tipo, b, cb) {
  const reg = M.REGIAO_CLASSE[b && b.classe];
  const base = tipo === "keystone" ? AR.keystones : AR.notaveis;
  abrirPicker({
    titulo: tipo === "keystone" ? "Escolher keystone" : "Escolher notável", placeholder: "Nome ou efeito (penetration, more…)",
    filtros: [["", "Todas as regiões"]].concat((reg ? [["perto", "Perto de mim (" + reg + ")"]] : [])).concat(["STR", "STR/DEX", "DEX", "DEX/INT", "INT", "STR/INT", "centro"].map((r) => [r, r])),
    itens: (q, f) => base.filter((n) => (!f || (f === "perto" ? n.reg === reg : n.reg === f)) && casa(q, n.n, n.s.join(" "))).map((n) => ({ titulo: n.n, sub: n.reg + " · " + n.s.join(" / "), dado: n })),
    onPick: (it) => cb(it.dado)
  });
}

/* ============================================================
   ANÁLISE
   ============================================================ */
let filtroAch = "";
function buildAtual() {
  let id = null; try { id = localStorage.getItem(LS_ATUAL); } catch (e) {}
  return ST.builds[id] || listaBuilds()[0] || null;
}
function barra(rot, v, sufixo) {
  const cls = v < 4 ? "lo" : v < 7 ? "mid" : "hi";
  return `<div class="bar"><span>${rot}${sufixo || ""}</span><div class="trk"><div class="fil ${cls}" style="width:${Math.max(3, v * 10)}%"></div></div><b>${fmt(v)}</b></div>`;
}
function renderAnalise() {
  const lista = listaBuilds();
  const b = buildAtual();
  $("#anaSel").innerHTML = lista.map((x) => `<option value="${esc(x.id)}"${b && x.id === b.id ? " selected" : ""}>${esc(x.nome || "Build")}</option>`).join("");
  $("#anaEdit").hidden = !b;
  if (!b) { $("#anaBody").innerHTML = `<div class="empty-card"><div class="big">🔬</div><p>Nenhuma build para analisar.</p><button class="btn primary" data-go="criar">🧭 Criar uma</button></div>`; return; }
  const r = M.analisar(b);
  const n = r.notas;
  const cont = (s) => r.achados.filter((a) => a.sev === s).length;
  const SEVS = [["", "Todos"], ["erro", "❌ Erros " + cont("erro")], ["alerta", "⚠️ Alertas " + cont("alerta")], ["dica", "💡 Dicas " + cont("dica")], ["ok", "✅ Fortes " + cont("ok")], ["info", "ℹ️ Info " + cont("info")]];
  const ICO = { erro: "❌", alerta: "⚠️", dica: "💡", ok: "✅", info: "ℹ️" };
  const achados = r.achados.filter((a) => !filtroAch || a.sev === filtroAch);
  const P0 = M.principal(b);
  const proximo = r.achados.find((a) => a.sev === "erro") || r.achados.find((a) => a.sev === "alerta") || r.achados.find((a) => a.sev === "dica");
  $("#anaBody").innerHTML = `
  <div class="card">
    <div class="ana-head"><div class="score big">${fmt(r.geral)}<small>NOTA</small></div>
      <div class="tit"><div class="arq">${esc(r.arquetipo)}</div><div class="muted">${esc(b.nome || "")} · nível ${esc(b.nivel)} · ${esc(b.modo)}</div></div></div>
    <div class="chips" style="margin-top:10px">${rotuloChips(r.rotulos, 12)}</div>
  </div>
  ${proximo ? `<div class="card proximo"><h3>👉 Próximo passo</h3><div class="a-t">${esc(proximo.titulo)}</div>${proximo.acao ? `<div class="a-a">${esc(proximo.acao)}</div>` : ""}
    ${proximo.sups && proximo.sups.length ? `<div class="chips" style="margin-top:6px"><button class="chip sm" data-addsup="${esc(proximo.sups[0])}">+ ${linhagem(proximo.sups[0])}${esc(proximo.sups[0])}</button></div>` : ""}
    <p class="hint" style="margin:6px 0 0">Uma coisa de cada vez: resolva esta e reanalise.</p></div>` : ""}
  <div class="card"><h3>📏 Notas por dimensão</h3><div class="bars">
    ${barra("💥 Dano", n.dano)}${barra("🛡️ Defesa", n.defesa, n.defesaEstimada ? "*" : "")}${barra("♻️ Recuperação", n.recuperacao)}
    ${barra("🧩 Coerência", n.coerencia)}${barra("🎮 Controle PS5", n.controle)}${barra("💰 Acessível", n.acesso)}</div>
    ${n.defesaEstimada ? `<p class="hint" style="margin:8px 0 0">* Defesa estimada — preencha os números do personagem para uma nota real.</p>` : ""}
  </div>
  <div class="card"><h3>🎯 Vetores de dano</h3><p class="hint">Dentro do vetor os bônus somam; entre vetores multiplicam. Vetor vazio = melhor lugar para investir.</p>
    <div class="vgrid">${C.vetores.map((v) => { const f = r.vetores[v.id] || []; return `<div class="vbox ${f.length ? "on" : "off"}"><div class="vt">${v.ico} ${esc(v.nome)} ${f.length ? "✅" : ""}</div><div class="vs">${f.length ? esc(f.slice(0, 3).join(" · ")) : "vazio"}</div></div>`; }).join("")}</div>
  </div>
  <div class="card"><h3>🩺 Diagnóstico</h3>
    <div class="chips scroll-x filtros-ach">${SEVS.map(([v, t]) => `<button class="chip sm${filtroAch === v ? " sel" : ""}" data-fach="${v}">${t}</button>`).join("")}</div>
    ${achados.map((a) => `<div class="achado ${a.sev}">
      <div class="a-t">${ICO[a.sev]} ${esc(a.titulo)}</div>
      ${a.porque ? `<div class="a-p">${esc(a.porque)}</div>` : ""}
      ${a.acao ? `<div class="a-a">👉 ${esc(a.acao)}</div>` : ""}
      ${a.sups && a.sups.length ? `<div class="chips">${a.sups.map((s) => `<button class="chip sm" data-addsup="${esc(s)}">+ ${linhagem(s)}${esc(s)}</button>`).join("")}</div>` : ""}
      ${a.nots && a.nots.length ? `<div class="chips">${a.nots.map((s) => `<button class="chip sm" data-addnot="${esc(s)}">🌳 ${esc(s)}</button>`).join("")}</div>` : ""}
      ${a.wiki ? `<a class="a-link" href="${esc(M.wikiUrl(a.wiki))}" target="_blank" rel="noopener">📖 Wiki: ${esc(a.wiki.replace(/_/g, " "))}</a>` : ""}
    </div>`).join("") || '<p class="empty">Nada aqui.</p>'}
    ${P0 ? `<p class="hint" style="margin-top:10px">Toque em “+ suporte” para colocar na skill principal (${esc(P0.s.n)}); “🌳” marca o notável na sua build; 🔶 = gem de linhagem (cara, 1 por personagem).</p>` : ""}
  </div>
  <div class="card"><h3>🔎 Pesquisa antes de investir</h3><div class="pesq">
    ${M.pesquisa(b).map((p) => `<div class="pesq-item"><span>${esc(p.titulo)}</span><span class="lk">${p.links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</span></div>`).join("")}
  </div></div>
  <div class="row-btns" style="margin-top:12px"><button class="btn ghost" id="anaTexto">📤 Copiar análise</button><button class="btn primary" id="anaEdit2">✏️ Editar build</button></div>`;
}
function textoAnalise(b) {
  const r = M.analisar(b);
  const n = r.notas;
  const ICO = { erro: "❌", alerta: "⚠️", dica: "💡", ok: "✅", info: "ℹ️" };
  const P0 = M.principal(b);
  let t = `⚒️ Forja PoE2 — ${b.nome}\n${r.arquetipo}\nNota ${fmt(r.geral)} · ${r.rotulos.map((x) => x.t).join(" · ")}\n\n`;
  t += `Dano ${fmt(n.dano)} · Defesa ${fmt(n.defesa)}${n.defesaEstimada ? "*" : ""} · Recuperação ${fmt(n.recuperacao)} · Coerência ${fmt(n.coerencia)} · Controle ${fmt(n.controle)} · Acessível ${fmt(n.acesso)}\n\n`;
  if (P0) t += `Skill principal: ${P0.s.n} + ${P0.g.sup.join(", ") || "sem suportes"}\n\n`;
  r.achados.filter((a) => a.sev !== "info").forEach((a) => { t += `${ICO[a.sev]} ${a.titulo}${a.acao ? "\n   → " + a.acao : ""}${a.sups && a.sups.length ? " " + a.sups.join(", ") : ""}\n`; });
  t += `\n(patch ${C.patch} · dados ${J.meta.fonte})`;
  return t;
}
function mostrarTexto(titulo, txt) { $("#textoTitulo").textContent = titulo; $("#textoArea").value = txt; abrir("#textoModal"); }

/* ============================================================
   CRIAR (assistente "O que você quer jogar?")
   ============================================================ */
let CR = { modo: "", sel: null, filtroClasse: "", filtroTipo: "", busca: "", prop: null };
function voltarCriar() { return `<button class="link-btn voltar" data-cr="home">← O que você quer jogar?</button>`; }
function renderProposta(b) {
  const r = M.analisar(b);
  const P0 = M.principal(b);
  const buff = b.grupos.filter((g) => g.papel === "buff").map((g) => g.skill);
  const asc = C.ascendencias[b.asc] || {};
  return `<div class="prop">
    <div class="p-t">${esc(r.arquetipo)}</div>
    <div class="chips" style="margin-top:6px">${rotuloChips(r.rotulos, 8)}</div>
    <dl class="kv">
      <dt>Classe</dt><dd>${esc(b.classe)} · ${esc(b.asc || "—")}</dd>
      <dt>Skill</dt><dd><b>${esc(P0 ? P0.s.n : "—")}</b>${P0 ? `<div class="muted">${esc(P0.s.d)}</div>` : ""}</dd>
      <dt>Arma</dt><dd>${esc(M.armaPt(b.arma))}${b.offhand ? " + " + esc(b.offhand) : ""}</dd>
      <dt>Suportes</dt><dd>${esc(P0 ? P0.g.sup.join(", ") : "") || "—"}</dd>
      <dt>Buff</dt><dd>${esc(buff.join(", ") || "—")}</dd>
      <dt>Ascendência</dt><dd>${esc(b.ascNos.join(", ") || "—")}${asc.resumo ? `<div class="muted">${esc(asc.resumo)}</div>` : ""}</dd>
      ${b.keystones.length ? `<dt>Keystone</dt><dd>${esc(b.keystones.join(", "))}</dd>` : ""}
      <dt>Defesa</dt><dd>${esc({ armadura: "Armadura + vida", evasao: "Evasão + deflexão", es: "Escudo de Energia", vida: "Vida + armadura/evasão", hibrido: "Híbrida" }[asc.def] || "—")}</dd>
      <dt>Nota prévia</dt><dd><b>${fmt(r.geral)}</b> <span class="muted">(sem números do personagem)</span></dd>
    </dl>
  </div>`;
}
function renderCriar() {
  const el = $("#criarBody");
  if (!CR.modo || CR.modo === "home") {
    el.innerHTML = `<h2>🧭 O que você quer jogar?</h2>
      <p class="hint">Escolha um ponto de partida — o assistente monta um esqueleto coerente (arma, suportes, ascendência) e você ajusta depois.</p>
      <div class="opcoes">
        <button class="opcao" data-cr="aleatoria"><div class="o-e">🎲</div><div class="o-t">Build aleatória</div><div class="o-d">Sorteio coerente para sair do óbvio</div></button>
        <button class="opcao" data-cr="meta"><div class="o-e">🏆</div><div class="o-t">Meta</div><div class="o-d">O que está forte no patch</div></button>
        <button class="opcao" data-cr="unico"><div class="o-e">💎</div><div class="o-t">Único legal</div><div class="o-d">Construir em volta de um item</div></button>
        <button class="opcao" data-cr="skill"><div class="o-e">✨</div><div class="o-t">Skill divertida</div><div class="o-d">Comece pela habilidade</div></button>
        <button class="opcao full" data-cr="asc"><div class="o-e">👑</div><div class="o-t">Ascendência divertida</div><div class="o-d">Comece pela fantasia da classe</div></button>
        <button class="opcao full" data-cr="zero"><div class="o-e">📝</div><div class="o-t">Do zero</div><div class="o-d">Editor em branco</div></button>
      </div>
      <div class="card" style="margin-top:14px"><h3>🔎 Depois: pesquise (slide “Research”)</h3>
        <p class="muted">Skill → wiki + PoE2DB · Ascendência → wiki + Path of Building 2 · Únicos → wiki + PoE2DB · Inspiração → poe.ninja. A análise de cada build traz esses links prontos.</p></div>`;
    return;
  }
  if (CR.modo === "aleatoria") {
    if (!CR.prop) CR.prop = M.aleatoria({ classe: CR.filtroClasse, tipo: CR.filtroTipo });
    el.innerHTML = `${voltarCriar()}<h2>🎲 Build aleatória</h2>
      <label class="lbl">Classe</label><div class="chips">${[["", "Qualquer"]].concat(M.CLASSES.map((c) => [c.n, c.n])).map(([v, t]) => `<button class="chip sm${CR.filtroClasse === v ? " sel" : ""}" data-crc="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <label class="lbl">Tipo</label><div class="chips">${[["", "Qualquer"], ["Attack", "Ataque"], ["Spell", "Feitiço"], ["Minion", "Minion"]].map(([v, t]) => `<button class="chip sm${CR.filtroTipo === v ? " sel" : ""}" data-crt="${esc(v)}">${esc(t)}</button>`).join("")}</div>
      <div style="margin-top:12px">${renderProposta(CR.prop)}</div>
      <div class="row-btns" style="margin-top:12px"><button class="btn ghost" data-cr-act="outra">🎲 Outra</button><button class="btn primary" data-cr-act="usar">✅ Usar e analisar</button></div>`;
    return;
  }
  if (CR.modo === "meta") {
    el.innerHTML = `${voltarCriar()}<h2>🏆 Meta — ${esc(META.liga)}</h2>
      <p class="hint">${esc(META.observacao)} Atualizado em ${esc(META.atualizado)} — confira sempre no poe.ninja.</p>
      <div class="mlist">${META.builds.map((m, i) => `<div class="mcard"><div class="m-top"><b>${esc(m.skill)}</b><span class="tier">${esc(m.tier)}</span></div>
        <div class="muted">${esc(m.asc.join(" / "))} · ${esc({ mapas: "mapas", chefes: "chefes", ambos: "mapas + chefes" }[m.foco] || m.foco)} · dificuldade ${"●".repeat(m.dificuldade)}${"○".repeat(3 - m.dificuldade)}${m.starter ? " · 🌱 starter" : ""}</div>
        <p class="muted" style="color:var(--ink)">${esc(m.nota)}</p>
        <div class="chips">${m.asc.map((a) => `<button class="chip sm" data-meta="${i}" data-asc="${esc(a)}">Usar com ${esc(a)}</button>`).join("")}</div></div>`).join("")}</div>
      <p class="fonte">Fontes: ${META.fontes.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join(" · ")}</p>`;
    return;
  }
  if (CR.modo === "unico") {
    const u = CR.sel && M.UN.get(CR.sel);
    if (!u) {
      const q = M.norm(CR.busca);
      const lista = UNI.filter((x) => casa(q, x.n, x.b, x.m.join(" "), x.slot)).slice(0, 40);
      el.innerHTML = `${voltarCriar()}<h2>💎 Escolha um único</h2>
        <input class="search" id="crBusca" type="search" placeholder="Nome ou efeito (ex.: minion, arrow, ignite)" value="${esc(CR.busca)}" />
        <div class="stack">${lista.map((x) => `<button class="pk-row card" data-crsel="${esc(x.n)}"><b>${esc(x.n)}</b><span class="pk-sub">${esc((SLOT_PT[x.slot] || x.slot) + " · " + x.b)}</span><span class="pk-sub">${esc(x.m.slice(0, 3).join(" · "))}</span></button>`).join("")}</div>`;
      return;
    }
    const rk = M.rankSkillsPorUnico(u);
    el.innerHTML = `<button class="link-btn voltar" data-crsel="">← Outros únicos</button>
      <div class="card"><h2>💎 ${esc(u.n)}</h2><p class="muted">${esc((SLOT_PT[u.slot] || u.slot) + " · " + u.b)}${u.liga ? " · " + esc(u.liga) : ""}</p>
        <ul class="mods">${u.m.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
        <p class="hint">Sinais detectados: ${esc(rk.sinais.join(", ") || "nenhum claro — escolha pela fantasia")}</p></div>
      ${rk.concedida ? `<p class="hint">Este único concede a skill <b>${esc(rk.concedida)}</b>.</p>` : ""}
      <h3 style="margin-top:12px">Skills que combinam</h3>
      <div class="stack">${rk.skills.slice(0, 12).map((x) => `<button class="pk-row card" data-crunico="${esc(x.s.n)}"><b>${esc(x.s.n)}</b><span class="pk-sub">${esc([TIPO_PT[x.s.t], x.s.w, corDe(x.s.req)].filter(Boolean).join(" · "))}</span></button>`).join("") || '<p class="muted">Nenhuma ligação óbvia — use o editor do zero.</p>'}</div>`;
    return;
  }
  if (CR.modo === "skill") {
    const s = CR.sel && M.SK.get(CR.sel);
    if (!s) {
      const q = M.norm(CR.busca);
      const lista = J.skills.filter((x) => x.tier > 0 && ["Attack", "Spell", "Minion"].includes(x.t) && (!CR.filtroTipo || x.t === CR.filtroTipo) && casa(q, x.n, x.tg.join(" "), x.w)).slice(0, 60);
      el.innerHTML = `${voltarCriar()}<h2>✨ Escolha uma skill</h2>
        <input class="search" id="crBusca" type="search" placeholder="Nome, tag (fire, minion, slam) ou arma" value="${esc(CR.busca)}" />
        <div class="chips" style="margin-bottom:10px">${[["", "Todas"], ["Attack", "Ataques"], ["Spell", "Feitiços"], ["Minion", "Minions"]].map(([v, t]) => `<button class="chip sm${CR.filtroTipo === v ? " sel" : ""}" data-crt="${esc(v)}">${esc(t)}</button>`).join("")}</div>
        <div class="stack">${lista.map((x) => `<button class="pk-row card" data-crsel="${esc(x.n)}"><b>${esc(x.n)}</b><span class="pk-sub">${esc([TIPO_PT[x.t], x.w, corDe(x.req)].filter(Boolean).join(" · "))}</span><span class="pk-sub">${esc(x.d.slice(0, 120))}${x.d.length > 120 ? "…" : ""}</span></button>`).join("")}</div>`;
      return;
    }
    const asc = M.rankAscPorSkill(s).slice(0, 5);
    const sups = M.recomendarSuportes(s, null, 5);
    el.innerHTML = `<button class="link-btn voltar" data-crsel="">← Outras skills</button>
      <div class="card"><h2>✨ ${esc(s.n)}</h2><p class="muted">${esc([TIPO_PT[s.t], s.w ? "exige " + s.w : "", corDe(s.req), s.sp ? "espírito " + s.sp : ""].filter(Boolean).join(" · "))}</p>
        <p>${esc(s.d)}</p><div class="chips">${s.tg.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>
        <p class="hint" style="margin-top:8px">Suportes recomendados: ${esc(sups.join(", "))}</p>
        <div class="row-btns"><a class="mini-btn ghost" href="${esc(M.wikiUrl(s.n))}" target="_blank" rel="noopener">📖 Wiki</a><a class="mini-btn ghost" href="${esc(M.dbUrl(s.n))}" target="_blank" rel="noopener">🗄️ PoE2DB</a></div></div>
      <h3 style="margin-top:12px">Ascendências que combinam</h3>
      <div class="stack">${asc.map((a) => `<button class="pk-row card" data-crasc="${esc(a.asc)}"><b>${esc(a.asc)}</b> <span class="tag">${esc(a.classe)}</span><span class="pk-sub">${esc((C.ascendencias[a.asc] || {}).resumo || "")}</span></button>`).join("")}</div>`;
    return;
  }
  if (CR.modo === "asc") {
    const a = CR.sel;
    if (!a) {
      el.innerHTML = `${voltarCriar()}<h2>👑 Escolha a ascendência</h2>
        ${M.CLASSES.map((c) => `<div class="card"><h3>${esc(c.n)} <span class="muted">— ${esc((C.classes[c.n] || {}).arma || "")}</span></h3>
          <div class="stack">${c.asc.concat(c.n === "Witch" && !c.asc.includes("Abyssal Lich") ? ["Abyssal Lich"] : []).map((x) => `<button class="pk-row" data-crsel="${esc(x)}"><b>${esc(x)}</b><span class="pk-sub">${esc((C.ascendencias[x] || {}).resumo || "")}</span></button>`).join("")}</div></div>`).join("")}
        <div class="card"><h3>Duelist <span class="muted">— espadas</span></h3><p class="muted">Chega no 1.0 (11/12/2026). A biblioteca será atualizada quando o PoB2 tiver os dados.</p></div>`;
      return;
    }
    const sk = M.rankSkillsPorAsc(a).slice(0, 10);
    el.innerHTML = `<button class="link-btn voltar" data-crsel="">← Outras ascendências</button>
      <div class="card"><h2>👑 ${esc(a)}</h2><p class="muted">${esc(M.CLASSE_DE[a] || "")}</p><p>${esc((C.ascendencias[a] || {}).resumo || "")}</p>
        <ul class="mods">${(AR.ascendencias[a] || []).map((n) => `<li><b>${esc(n.n)}</b> — ${esc(n.s.join(" / "))}</li>`).join("")}</ul></div>
      <h3 style="margin-top:12px">Skills que combinam</h3>
      <div class="stack">${sk.map((x) => `<button class="pk-row card" data-crasc2="${esc(x.s.n)}"><b>${esc(x.s.n)}</b><span class="pk-sub">${esc([TIPO_PT[x.s.t], x.s.w, corDe(x.s.req)].filter(Boolean).join(" · "))}</span></button>`).join("")}</div>`;
  }
}
function onCriarClick(e) {
  const t = e.target.closest("[data-cr],[data-crc],[data-crt],[data-cr-act],[data-meta],[data-crsel],[data-crunico],[data-crasc],[data-crasc2]");
  if (!t) return;
  if (t.dataset.cr !== undefined) {
    const m = t.dataset.cr;
    if (m === "zero") return novaVazia();
    CR = { modo: m, sel: null, filtroClasse: "", filtroTipo: "", busca: "", prop: null };
  } else if (t.dataset.crc !== undefined) { CR.filtroClasse = t.dataset.crc; CR.prop = null; }
  else if (t.dataset.crt !== undefined) { CR.filtroTipo = t.dataset.crt; CR.prop = null; }
  else if (t.dataset.crAct === "outra") CR.prop = null;
  else if (t.dataset.crAct === "usar") { const b = CR.prop; CR = { modo: "" }; usarBuild(b, true); return; }
  else if (t.dataset.meta !== undefined) { const m = META.builds[+t.dataset.meta]; CR = { modo: "" }; usarBuild(M.montar(m.skill, t.dataset.asc, "meta"), true); return; }
  else if (t.dataset.crsel !== undefined) { CR.sel = t.dataset.crsel || null; }
  else if (t.dataset.crunico !== undefined) {
    const s = M.SK.get(t.dataset.crunico); const asc = M.rankAscPorSkill(s)[0].asc;
    const b = M.montar(s.n, asc, "assistente"); b.unicos = [CR.sel]; b.nome = s.n + " + " + CR.sel; CR = { modo: "" }; usarBuild(b, true); return;
  } else if (t.dataset.crasc !== undefined) { const b = M.montar(CR.sel, t.dataset.crasc, "assistente"); CR = { modo: "" }; usarBuild(b, true); return; }
  else if (t.dataset.crasc2 !== undefined) { const b = M.montar(t.dataset.crasc2, CR.sel, "assistente"); CR = { modo: "" }; usarBuild(b, true); return; }
  renderCriar();
  window.scrollTo(0, 0);
}

/* ============================================================
   SABER (biblioteca)
   ============================================================ */
let SB = { seg: "conceitos", limite: 40 };
const SEGS = [["conceitos", "🧠 Conceitos"], ["skills", "✨ Skills"], ["suportes", "💎 Suportes"], ["unicos", "🟧 Únicos"], ["asc", "👑 Ascendências"], ["arvore", "🌳 Árvore"], ["ferramentas", "🧰 Ferramentas"], ["meta", "🏆 Meta"], ["sobre", "ℹ️ Sobre"]];
function kbItem(titulo, sub, corpo, aberto) {
  return `<details class="kb-item"${aberto ? " open" : ""}><summary><span><span class="k-n">${titulo}</span>${sub ? `<span class="k-s">${sub}</span>` : ""}</span><span class="muted">▾</span></summary><div class="k-body">${corpo}</div></details>`;
}
const links = (nome) => `<div class="row-btns" style="margin-top:8px"><a class="mini-btn ghost" href="${esc(M.wikiUrl(nome))}" target="_blank" rel="noopener">📖 Wiki</a><a class="mini-btn ghost" href="${esc(M.dbUrl(nome))}" target="_blank" rel="noopener">🗄️ PoE2DB</a></div>`;
function contagem(q) {
  if (!q) return {};
  return {
    conceitos: C.topicos.filter((t) => casa(q, t.titulo, M.preencher(t.resumo), t.pontos.join(" "))).length,
    skills: J.skills.filter((s) => casa(q, s.n, s.tg.join(" "), s.d)).length,
    suportes: J.suportes.filter((s) => casa(q, s.n, s.fx.join(" "), s.d)).length,
    unicos: UNI.filter((u) => casa(q, u.n, u.b, u.m.join(" "))).length,
    asc: Object.keys(C.ascendencias).filter((a) => casa(q, a, C.ascendencias[a].resumo, (AR.ascendencias[a] || []).map((n) => n.n + " " + n.s.join(" ")).join(" "))).length,
    arvore: AR.keystones.concat(AR.notaveis).filter((n) => casa(q, n.n, n.s.join(" "))).length
  };
}
function renderSaber() {
  const q = M.norm($("#saberBusca").value);
  const cnt = contagem(q);
  $("#saberSeg").innerHTML = SEGS.map(([v, t]) => `<button class="chip sm${SB.seg === v ? " sel" : ""}" data-seg="${v}">${t}${cnt[v] !== undefined ? ` (${cnt[v]})` : ""}</button>`).join("");
  const el = $("#saberBody");
  const mais = (total) => total > SB.limite ? `<button class="btn ghost block" data-mais="1">Mostrar mais (${total - SB.limite})</button>` : "";
  if (SB.seg === "conceitos") {
    const tops = C.topicos.filter((t) => casa(q, t.titulo, M.preencher(t.resumo), t.pontos.join(" ")));
    const cats = [...new Set(tops.map((t) => t.cat))];
    el.innerHTML = (q ? "" : `
      <div class="card"><h3>🎯 Vetores de escalonamento de dano</h3><p class="hint">Dentro do vetor você SOMA as fontes; entre vetores você MULTIPLICA os totais.</p>
        ${C.vetores.map((v) => kbItem(v.ico + " " + esc(v.nome), esc(v.fontes.join(" · ")), `<p>${P(v.desc)}</p><p class="muted"><b>Como investir:</b> ${esc(v.como)}</p>`)).join("")}</div>
      <div class="card"><h3>🛡️ Camadas de defesa</h3>${C.camadas.map((c) => kbItem(c.ico + " " + esc(c.nome), "", `<p>${P(c.desc)}</p>`)).join("")}</div>
      <div class="card"><h3>📅 Ciclo do jogo</h3><p class="muted">${esc(C.jogo.atual)}</p><p class="muted">${esc(C.jogo.proximo)}</p><p class="muted">${esc(C.jogo.ciclo)}</p></div>`) +
      cats.map((c) => `<h3 style="margin:14px 2px 8px">${esc(c)}</h3>` + tops.filter((t) => t.cat === c).map((t) => kbItem(t.ico + " " + esc(t.titulo), P(t.resumo).slice(0, 90) + (M.preencher(t.resumo).length > 90 ? "…" : ""),
        `<p>${P(t.resumo)}</p><ul>${t.pontos.map((p) => `<li>${P(p)}</li>`).join("")}</ul>${t.wiki ? `<a class="a-link" href="${esc(M.wikiUrl(t.wiki))}" target="_blank" rel="noopener">📖 Wiki: ${esc(t.wiki.replace(/_/g, " "))}</a>` : ""}`, !!q)).join("")).join("");
  } else if (SB.seg === "skills") {
    const l = J.skills.filter((s) => casa(q, s.n, s.tg.join(" "), s.d, s.w));
    el.innerHTML = l.slice(0, SB.limite).map((s) => kbItem(esc(s.n), esc([TIPO_PT[s.t] || s.t, s.w, corDe(s.req)].filter(Boolean).join(" · ")),
      `<p>${esc(s.d)}</p><div class="chips">${s.tg.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>
       <p class="muted">${s.sp ? "Reserva " + s.sp + " de espírito · " : ""}${s.tier ? "Tier da gem " + s.tier : "Skill especial (item/ascendência)"}</p>
       <p class="muted"><b>Suportes recomendados:</b> ${esc(M.recomendarSuportes(s, null, 5).join(", ") || "—")}</p>
       <p class="muted"><b>Ascendências que combinam:</b> ${esc(M.rankAscPorSkill(s).slice(0, 3).map((a) => a.asc).join(", "))}</p>
       ${links(s.n)}<button class="btn primary block" style="margin-top:8px" data-kbskill="${esc(s.n)}">✨ Criar build com esta skill</button>`)).join("") + mais(l.length);
  } else if (SB.seg === "suportes") {
    const l = J.suportes.filter((s) => casa(q, s.n, s.fx.join(" "), s.d, s.fam));
    el.innerHTML = l.slice(0, SB.limite).map((s) => kbItem((s.lin ? "🔶 " : "") + esc(s.n), vetTags(s.v),
      `<ul class="mods">${s.fx.map((f) => `<li>${esc(f.replace(/\n/g, " "))}</li>`).join("")}</ul><p class="muted">${esc(s.d)}</p>
       <p class="muted">Família: ${esc(s.fam)}${s.nv ? " · nível " + s.nv : ""}${s.lin ? " · linhagem (1 por personagem)" : ""} · cor ${esc(corDe(s.req) || "—")}</p>${links(s.n)}`)).join("") + mais(l.length);
  } else if (SB.seg === "unicos") {
    const l = UNI.filter((u) => casa(q, u.n, u.b, u.m.join(" "), u.slot));
    el.innerHTML = l.slice(0, SB.limite).map((u) => kbItem(esc(u.n), esc((SLOT_PT[u.slot] || u.slot) + " · " + u.b + (u.liga ? " · " + u.liga : "")),
      `<ul class="mods">${u.m.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>${links(u.n)}<button class="btn primary block" style="margin-top:8px" data-kbunico="${esc(u.n)}">💎 Construir em volta deste único</button>`)).join("") + mais(l.length);
  } else if (SB.seg === "asc") {
    el.innerHTML = M.CLASSES.map((c) => `<h3 style="margin:14px 2px 8px">${esc(c.n)} — ${esc((C.classes[c.n] || {}).pt || "")} <span class="muted">(${esc((C.classes[c.n] || {}).arma || "")})</span></h3>` +
      c.asc.concat(c.n === "Witch" && !c.asc.includes("Abyssal Lich") ? ["Abyssal Lich"] : []).filter((a) => casa(q, a, (C.ascendencias[a] || {}).resumo || "", (AR.ascendencias[a] || []).map((n) => n.n + " " + n.s.join(" ")).join(" "))).map((a) => kbItem("👑 " + esc(a), esc(((C.ascendencias[a] || {}).resumo || "").slice(0, 80)) + "…",
        `<p>${esc((C.ascendencias[a] || {}).resumo || "")}</p><ul class="mods">${(AR.ascendencias[a] || []).map((n) => `<li><b>${esc(n.n)}</b> — ${esc(n.s.join(" / "))}</li>`).join("")}</ul>
         <p class="muted"><b>Skills que combinam:</b> ${esc(M.rankSkillsPorAsc(a).slice(0, 6).map((x) => x.s.n).join(", "))}</p>${links(a)}`, !!q)).join("")).join("");
  } else if (SB.seg === "arvore") {
    const ks = AR.keystones.filter((n) => casa(q, n.n, n.s.join(" ")));
    const nt = AR.notaveis.filter((n) => casa(q, n.n, n.s.join(" ")));
    el.innerHTML = `<p class="hint">Região = setor da roda STR/DEX/INT onde o nó fica (calculado pela posição na árvore do PoB2).</p>
      <h3 style="margin:8px 2px">🔑 Keystones (${ks.length})</h3>${ks.map((n) => kbItem(esc(n.n), esc(n.reg), `<ul class="mods">${n.s.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${links(n.n)}`)).join("")}
      <h3 style="margin:14px 2px 8px">⭐ Notáveis (${nt.length})</h3>${nt.slice(0, SB.limite).map((n) => kbItem(esc(n.n), esc(n.reg), `<ul class="mods">${n.s.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`)).join("")}${mais(nt.length)}`;
  } else if (SB.seg === "ferramentas") {
    el.innerHTML = `<p class="hint">As ferramentas dos slides — e como usar cada uma no celular.</p>` + C.ferramentas.map((f) => `<div class="card"><h3>${f.ico} ${esc(f.nome)}</h3><p>${esc(f.para)}</p><p class="muted">📱 ${esc(f.celular)}</p><a class="mini-btn ghost" href="${esc(f.url)}" target="_blank" rel="noopener">Abrir ↗</a></div>`).join("");
  } else if (SB.seg === "meta") {
    el.innerHTML = `<div class="card"><h3>🏆 ${esc(META.liga)}</h3><p class="muted">${esc(META.observacao)}</p><p class="muted">Atualizado: ${esc(META.atualizado)}. Ascendências populares: ${esc(META.ascPopulares.join(", "))}.</p></div>` +
      META.builds.map((m) => `<div class="mcard" style="margin-top:8px"><div class="m-top"><b>${esc(m.skill)}</b><span class="tier">${esc(m.tier)}</span></div><div class="muted">${esc(m.asc.join(" / "))}</div><p class="muted" style="color:var(--ink)">${esc(m.nota)}</p></div>`).join("") +
      `<p class="fonte">${META.fontes.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome)}</a>`).join(" · ")}</p>`;
  } else if (SB.seg === "sobre") {
    const k = J.consts;
    el.innerHTML = `<div class="card"><h3>📦 De onde vêm os dados</h3>
      <p>Skills, suportes, únicos, árvore e ascendências são <b>gerados automaticamente</b> dos arquivos do <b>Path of Building 2</b> (${esc(J.meta.fonte)}, patch ${esc(J.meta.patch)}, gerado em ${esc(J.meta.gerado)}).</p>
      <p class="muted">${Object.entries(J.meta.contagem).map(([a, b]) => `${b} ${a}`).join(" · ")}</p>
      <p>Textos de conceitos, resumos de ascendência e o meta são <b>curados</b> (revisão ${esc(C.revisado)}, ${esc(C.patch)}).</p>
      <p class="muted">${esc(C.jogo.proximo)}</p></div>
      <div class="card"><h3>🔢 Constantes do jogo (PoB2)</h3><table class="tbl-mini">
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
        <tr><td>Resistência de chefes (PoB2)</td><td>${k.resChefe}% · pinnacle ${k.resChefePinnacle}%</td></tr>
      </table></div>
      <div class="card"><h3>🔄 Como atualizar a cada patch</h3><ol class="muted" style="padding-left:18px">
        <li>Quando o PoB2 lançar a versão do patch novo, o Claude roda <code>poe2-builds-src/gerar_kb.py</code> (lê os dados do PoB2).</li>
        <li>Revisa <code>kb/conceitos.js</code> (mecânicas que mudaram) e <code>kb/meta.js</code> (o que está forte).</li>
        <li>Sobe a versão do cache e publica. Suas builds continuam salvas — o app reanalisa com as regras novas.</li></ol></div>`;
  }
}
function onSaberClick(e) {
  const t = e.target.closest("[data-seg],[data-mais],[data-kbskill],[data-kbunico]"); if (!t) return;
  if (t.dataset.seg) { SB.seg = t.dataset.seg; SB.limite = 40; renderSaber(); window.scrollTo(0, 0); }
  else if (t.dataset.mais) { SB.limite += 60; renderSaber(); }
  else if (t.dataset.kbskill) { CR = { modo: "skill", sel: t.dataset.kbskill, filtroClasse: "", filtroTipo: "", busca: "", prop: null }; goTab("criar"); }
  else if (t.dataset.kbunico) { CR = { modo: "unico", sel: t.dataset.kbunico, filtroClasse: "", filtroTipo: "", busca: "", prop: null }; goTab("criar"); }
}

/* ============================================================
   CALCULADORA
   ============================================================ */
const CALC_PADRAO = { base: 100, inc: 150, more: "25, 20", critChance: 10, critBonus: 100, conv: 0, taken: 0, res: 30, vel: 1.5, armadura: 5000, evasao: 5000, nivelMonstro: 83, resEl: 75 };
let CALC = (() => { try { return Object.assign({}, CALC_PADRAO, JSON.parse(localStorage.getItem(LS_CALC) || "{}")); } catch (e) { return Object.assign({}, CALC_PADRAO); } })();
function renderCalc() {
  const inp = (k, rot, tipo) => `<div><label for="c-${k}">${rot}</label><input id="c-${k}" data-calc="${k}" type="${tipo || "number"}" inputmode="decimal" value="${esc(CALC[k])}" /></div>`;
  const lista = listaBuilds();
  $("#calcBody").innerHTML = `
  <div class="card"><h3>🧮 Onde investir o próximo ponto</h3>
    <p class="hint">Modelo do slide: dano = base × conversão × increased × crítico × inimigo-toma × (1 − resistência) × more × velocidade. Valores relativos — o que importa é a comparação.</p>
    ${lista.length ? `<div class="selrow"><select id="calcBuild" class="selbox"><option value="">Preencher com números de uma build…</option>${lista.map((b) => `<option value="${esc(b.id)}">${esc(b.nome)}</option>`).join("")}</select></div>` : ""}
    <div class="calc-grid">
      ${inp("inc", "% increased (soma)")}${inp("more", "More (lista: 25, 20)", "text")}
      ${inp("critChance", "Chance de crítico %")}${inp("critBonus", "Bônus de crítico %")}
      ${inp("conv", "Gain as extra %")}${inp("taken", "Inimigo toma +%")}
      ${inp("res", "Resistência do inimigo %")}${inp("vel", "Ações por segundo")}
    </div>
    <div class="chips" style="margin-top:8px"><button class="chip sm" data-res="0">Monstro comum 0%</button><button class="chip sm" data-res="${J.consts.resChefe}">Chefe ${J.consts.resChefe}%</button><button class="chip sm" data-res="${J.consts.resChefePinnacle}">Pinnacle ${J.consts.resChefePinnacle}%</button></div>
    <div class="resultado" id="calcRes"></div>
  </div>
  <div class="card"><h3>🛡️ Defesa física e evasão</h3>
    <div class="calc-grid">${inp("armadura", "Armadura")}${inp("evasao", "Evasão")}${inp("nivelMonstro", "Nível do monstro")}${inp("resEl", "Sua resistência %")}</div>
    <div class="resultado" id="defRes"></div>
  </div>`;
  atualizarCalc();
}
function atualizarCalc() {
  const r = M.calcDano(CALC);
  const inv = M.ondeInvestir(CALC);
  const max = Math.max(...inv.map((x) => x.ganho), 1);
  const f = r.f;
  $("#calcRes").innerHTML = `<div class="muted">Multiplicadores: conv ×${fmt(f.conv)} · inc ×${fmt(f.inc)} · crit ×${fmt(f.crit)} · toma ×${fmt(f.taken)} · res ×${fmt(f.mitig)} · more ×${fmt(f.more)} · vel ×${fmt(f.vel)}</div>
    <div class="big">${M.fmtNum(Math.round(r.total))} <span class="muted">dano relativo/s</span></div>
    <h3 style="margin-top:8px">Ganho de cada investimento</h3>
    <div class="inv">${inv.map((x) => `<span>${esc(x.rot)}</span><b>+${fmt(x.ganho)}%</b><div class="trk"><div class="fil" style="width:${Math.max(2, (x.ganho / max) * 100)}%"></div></div>`).join("")}</div>
    <p class="hint" style="margin:6px 0 0">👉 O primeiro da lista é onde seu próximo item/ponto rende mais.</p>`;
  const d = M.calcDefesa(CALC);
  const resEl = +CALC.resEl || 0;
  const multRes = (100 - resEl) / (100 - J.consts.resMax);
  $("#defRes").innerHTML = `<table class="tbl-mini">${d.golpes.map((g) => `<tr><td>Golpe físico de ${M.fmtNum(g.h)}</td><td>−${fmt(g.dr)}%</td></tr>`).join("")}
    <tr><td>Chance de evitar ataques (precisão ${M.fmtNum(d.acc)})</td><td>${fmt(d.evade)}%</td></tr>
    <tr><td>Dano elemental vs. quem está no cap (${J.consts.resMax}%)</td><td>×${fmt(multRes)}</td></tr></table>
    <p class="hint" style="margin:6px 0 0">Armadura: A ÷ (A + ${J.consts.armaduraRazao}×dano), máx. ${J.consts.drMaxFisico}%. Evasão: 1 − 0,95×Ev ÷ (Ev + 4×Precisão), máx. ${J.consts.evasaoCap}%.</p>`;
  try { localStorage.setItem(LS_CALC, JSON.stringify(CALC)); } catch (e) {}
}

/* ============================================================
   MENU / BACKUP / PoB
   ============================================================ */
function exportar() {
  const blob = new Blob([JSON.stringify({ app: "forja-poe2", versao: 1, exportado: new Date().toISOString(), builds: listaBuilds() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "forja-poe2-builds-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importarArquivo(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      const lista = Array.isArray(d) ? d : d.builds;
      if (!Array.isArray(lista)) throw new Error("formato");
      let n = 0;
      lista.forEach((b) => { if (b && b.id) { salvarBuild(normalizar(b), true); n++; } });
      renderBuilds(); toast(n + " build(s) importada(s)");
    } catch (e) { toast("Arquivo inválido"); }
  };
  fr.readAsText(file);
}
async function importarPob() {
  const txt = $("#pobTexto").value;
  $("#pobErro").textContent = "";
  $("#pobOk").disabled = true; $("#pobOk").textContent = "Lendo…";
  try {
    const r = await window.Pob.importar(txt);
    fechar("#pobModal"); $("#pobTexto").value = "";
    usarBuild(r.build, true);
    toast("Importado do PoB ✅" + (r.desconhecidos.length ? ` (${r.desconhecidos.length} gem(s) não reconhecida(s))` : ""));
  } catch (e) { $("#pobErro").textContent = e.message || String(e); }
  finally { $("#pobOk").disabled = false; $("#pobOk").textContent = "Importar e analisar"; }
}

/* ============================================================
   EVENTOS
   ============================================================ */
function wire() {
  $$(".tabbtn").forEach((b) => b.addEventListener("click", () => goTab(b.dataset.go)));
  document.body.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]:not(.tabbtn)"); if (go) goTab(go.dataset.go);
    const close = e.target.closest("[data-close]"); if (close) fechar(close.closest(".modal"));
    if (e.target.classList.contains("modal")) fechar(e.target);
  });
  $("#btnNova").addEventListener("click", novaVazia);
  const pob = () => { $("#pobErro").textContent = ""; abrir("#pobModal"); };
  $("#btnPob").addEventListener("click", pob); $("#btnPob2").addEventListener("click", pob);
  $("#pobOk").addEventListener("click", importarPob);
  $("#buildList").addEventListener("click", (e) => {
    const card = e.target.closest(".bcard"); if (!card) return;
    const id = card.dataset.id, act = (e.target.closest("[data-act]") || {}).dataset;
    const a = act && act.act;
    if (a === "del") return apagarBuild(id);
    if (a === "dup") { const c = normalizar(Object.assign(clone(ST.builds[id]), { id: M.novaBuild().id, nome: (ST.builds[id].nome || "Build") + " (cópia)", criado: Date.now() })); salvarBuild(c); toast("Duplicada"); return; }
    if (a === "editar") return abrirEditor(id);
    try { localStorage.setItem(LS_ATUAL, id); } catch (err) {}
    goTab("analise");
  });
  /* editor */
  $("#edBack").addEventListener("click", fecharEditor);
  $("#edAnalisar").addEventListener("click", () => { const id = edId; fechar("#editor"); edId = null; try { localStorage.setItem(LS_ATUAL, id); } catch (e) {} goTab("analise"); });
  $("#edBody").addEventListener("click", onEditorClick);
  $("#edBody").addEventListener("input", onEditorInput);
  $("#edBody").addEventListener("change", onEditorInput);
  /* picker */
  $("#pkBusca").addEventListener("input", debounce(() => { if (PK) { PK.limite = 60; renderPicker(); } }, 120));
  $("#pkFiltros").addEventListener("click", (e) => { const c = e.target.closest("[data-pkf]"); if (!c || !PK) return; PK.filtro = c.dataset.pkf; PK.limite = 60; renderPicker(); });
  $("#pkLista").addEventListener("click", (e) => {
    const r = e.target.closest("[data-pki],[data-pkmais]"); if (!r || !PK) return;
    if (r.dataset.pkmais) { PK.limite += 80; renderPicker(); return; }
    const it = PK.atual[+r.dataset.pki]; const cb = PK.onPick;
    fechar("#picker"); PK = null; cb(it);
  });
  /* análise */
  $("#anaSel").addEventListener("change", (e) => { try { localStorage.setItem(LS_ATUAL, e.target.value); } catch (err) {} renderAnalise(); });
  $("#anaEdit").addEventListener("click", () => { const b = buildAtual(); if (b) abrirEditor(b.id); });
  $("#anaBody").addEventListener("click", (e) => {
    const b = buildAtual(); if (!b) return;
    const f = e.target.closest("[data-fach]"); if (f) { filtroAch = f.dataset.fach; renderAnalise(); return; }
    if (e.target.closest("#anaEdit2")) return abrirEditor(b.id);
    if (e.target.closest("#anaTexto")) return mostrarTexto("Análise", textoAnalise(b));
    const s = e.target.closest("[data-addsup]");
    if (s) {
      const P0 = M.principal(b); if (!P0) return;
      if (P0.g.sup.includes(s.dataset.addsup)) return toast("Já está na skill");
      const antes = P0.g.sup.slice();
      P0.g.sup.push(s.dataset.addsup);
      salvarBuild(b, true); renderAnalise();
      showUndo(`+ ${s.dataset.addsup}${P0.g.sup.length > 5 ? " (passou de 5 — remova um)" : ""}`, () => { P0.g.sup = antes; salvarBuild(b, true); renderAnalise(); });
      return;
    }
    const n = e.target.closest("[data-addnot]");
    if (n) { if (!b.notaveis.includes(n.dataset.addnot)) b.notaveis.push(n.dataset.addnot); salvarBuild(b, true); renderAnalise(); toast("Notável marcado na build"); }
  });
  /* criar */
  $("#criarBody").addEventListener("click", onCriarClick);
  $("#criarBody").addEventListener("input", debounce((e) => {
    if (e.target.id !== "crBusca") return;
    CR.busca = e.target.value; renderCriar();
    const i = $("#crBusca"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }, 200));
  /* saber */
  $("#saberBusca").addEventListener("input", debounce(() => { SB.limite = 40; renderSaber(); }, 180));
  $("#saberSeg").addEventListener("click", onSaberClick);
  $("#saberBody").addEventListener("click", onSaberClick);
  /* calc */
  $("#calcBody").addEventListener("input", (e) => { const k = e.target.dataset.calc; if (!k) return; CALC[k] = e.target.type === "text" ? e.target.value : e.target.value; atualizarCalc(); });
  $("#calcBody").addEventListener("click", (e) => { const r = e.target.closest("[data-res]"); if (!r) return; CALC.res = +r.dataset.res; renderCalc(); });
  $("#calcBody").addEventListener("change", (e) => {
    if (e.target.id !== "calcBuild" || !e.target.value) return;
    const b = ST.builds[e.target.value]; if (!b) return;
    const st = b.stats || {};
    if (st.crit) CALC.critChance = st.crit;
    if (st.armadura) CALC.armadura = st.armadura;
    if (st.evasao) CALC.evasao = st.evasao;
    const res = ["resFogo", "resFrio", "resRaio"].map((k) => st[k]).filter((x) => x !== undefined);
    if (res.length) CALC.resEl = Math.min(...res);
    const P0 = M.principal(b);
    if (P0) {
      const more = P0.g.sup.map((n) => M.SU.get(n)).filter((s) => s && s.v.includes("more")).map((s) => { const m = (s.fx.join(" ").match(/(\d+)% more/) || [])[1]; return m ? +m : 0; }).filter(Boolean);
      CALC.more = more.join(", ");
    }
    renderCalc(); toast("Preenchido com " + b.nome);
  });
  /* menu */
  $("#menuBtn").addEventListener("click", () => abrir("#menuModal"));
  $("#mExport").addEventListener("click", () => { fechar("#menuModal"); exportar(); });
  $("#mImport").addEventListener("click", () => $("#fileImport").click());
  $("#fileImport").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importarArquivo(f); e.target.value = ""; fechar("#menuModal"); });
  $("#mSobre").addEventListener("click", () => { fechar("#menuModal"); SB.seg = "sobre"; goTab("saber"); });
  $("#textoCopiar").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#textoArea").value); toast("Copiado ✅"); } catch (e) { $("#textoArea").select(); document.execCommand && document.execCommand("copy"); toast("Copiado"); } });
  $("#undoBtn").addEventListener("click", () => { const fn = undoFn; hideUndo(); if (fn) fn(); });
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  $("#patchBadge").textContent = "patch " + (C.patch.split(" ")[0] || J.meta.patch);
  wire();
  loadLocal();
  goTab("builds");
  if (await pull()) renderAtual();
  await flush();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncCheck(); });
  window.addEventListener("online", () => { offlineAvisado = false; flush().then(syncCheck); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
