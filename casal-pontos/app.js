/* ============================================================
   Placar do Casal — Di & Tati
   Gamificação: vacilos rendem pontos pro parceiro, combos/double
   damage, loja de recompensas, ataque e estatísticas.

   Fonte da verdade = o LOG DE EVENTOS (append-only). Os saldos de
   pontos são SEMPRE calculados a partir dos eventos, então gravações
   simultâneas dos dois nunca "brigam" pelo mesmo número.

   Sincronização: Firebase Realtime Database via REST (Receita 1),
   nó planos/casal-pontos-dt2026. Cada evento vira uma chave própria
   (PUT idempotente), com localStorage como cópia offline + outbox.
   ============================================================ */

const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/casal-pontos-dt2026";
const LS_STATE = "casalpontos:state";
const LS_OUTBOX = "casalpontos:outbox";

/* ---------- defaults (seed inicial) ---------- */
const DEFAULT_REWARDS = [
  { id: "r_diasaudavel", emoji: "🥗", name: "Dia saudável",     cost: 30 },
  { id: "r_refeicao",    emoji: "🍽️", name: "Refeição saudável", cost: 20 },
  { id: "r_cinema",      emoji: "🎬", name: "Cinema",           cost: 50 },
  { id: "r_zara",        emoji: "🛍️", name: "Compra na Zara",    cost: 120 },
];
const DEFAULT_VACILOS = [
  { id: "v_grosseria", emoji: "😤", name: "Grosseria",   points: 10 },
  { id: "v_atraso",    emoji: "⏰", name: "Atraso",      points: 10 },
  { id: "v_esqueceu",  emoji: "🤦", name: "Esqueceu algo", points: 10 },
  { id: "v_bagunca",   emoji: "🧦", name: "Bagunça",     points: 5  },
  { id: "v_outro",     emoji: "❓", name: "Outro",       points: 10 },
];
const DEFAULT_CONFIG = { names: { di: "Di", tati: "Tati" }, combo: { at3: 2, at5: 3 } };

/* ---------- estado ---------- */
/* rewards/vacilos começam null (não []): assim normalize() cai nos defaults
   mesmo no primeiro uso offline, sem nunca ficar sem tipos/recompensas. */
let STATE = { events: {}, rewards: null, vacilos: null, config: null };
let lastAt = 0;
let offlineNoticed = false;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = (x) => JSON.parse(JSON.stringify(x));
const other = (id) => (id === "di" ? "tati" : "di");
const uid = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const nameOf = (id) => (STATE.config && STATE.config.names && STATE.config.names[id]) || (id === "di" ? "Di" : "Tati");

/* ============================================================
   Camada de rede (RTDB REST)
   ============================================================ */
async function apiGet(path) {
  const r = await fetch(`${SYNC_URL}/${path}.json`, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function apiPut(path, value) {
  const r = await fetch(`${SYNC_URL}/${path}.json`, {
    method: "PUT", body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return true;
}
async function apiDel(path) {
  const r = await fetch(`${SYNC_URL}/${path}.json`, { method: "DELETE" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return true;
}
async function bumpAt() { lastAt = Date.now(); try { await apiPut("_at", lastAt); } catch (e) {} }

/* outbox: gravações que falharam (offline) e serão reenviadas depois */
function getOutbox() { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || "[]"); } catch { return []; } }
function setOutbox(q) { try { localStorage.setItem(LS_OUTBOX, JSON.stringify(q)); } catch (e) {} }
function enqueue(item) { const q = getOutbox(); q.push(item); setOutbox(q); }

async function push(op, path, value) {
  try {
    if (op === "put") await apiPut(path, value); else await apiDel(path);
    await bumpAt();
    if (offlineNoticed) { offlineNoticed = false; toast("Sincronizado ✅"); }
    flush(); // aproveita para escoar pendências
  } catch (e) {
    enqueue({ op, path, value });
    if (!offlineNoticed) { offlineNoticed = true; toast("Sem conexão — salvo no aparelho, sincroniza depois"); }
  }
}
async function flush() {
  const q = getOutbox();
  if (!q.length) return;
  const rest = [];
  for (const it of q) {
    try { if (it.op === "put") await apiPut(it.path, it.value); else await apiDel(it.path); }
    catch (e) { rest.push(it); }
  }
  setOutbox(rest);
  if (rest.length < q.length) await bumpAt();
}

/* ---------- persistência local ---------- */
function saveLocal() {
  try { localStorage.setItem(LS_STATE, JSON.stringify(STATE)); } catch (e) {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (raw) STATE = JSON.parse(raw);
  } catch (e) {}
}

/* garante que o app nunca quebre por dado faltando */
function normalize() {
  if (!STATE.events || typeof STATE.events !== "object") STATE.events = {};
  if (!Array.isArray(STATE.rewards)) STATE.rewards = clone(DEFAULT_REWARDS);
  if (!Array.isArray(STATE.vacilos)) STATE.vacilos = clone(DEFAULT_VACILOS);
  if (!STATE.config) STATE.config = clone(DEFAULT_CONFIG);
  if (!STATE.config.names) STATE.config.names = clone(DEFAULT_CONFIG.names);
  if (!STATE.config.combo) STATE.config.combo = clone(DEFAULT_CONFIG.combo);
}

/* semeia no banco o que estiver faltando (primeira vez) */
async function ensureSeed(missing) {
  if (missing.rewards) { STATE.rewards = clone(DEFAULT_REWARDS); await apiPut("rewards", STATE.rewards).catch(() => {}); }
  if (missing.vacilos) { STATE.vacilos = clone(DEFAULT_VACILOS); await apiPut("vacilos", STATE.vacilos).catch(() => {}); }
  if (missing.config)  { STATE.config  = clone(DEFAULT_CONFIG);  await apiPut("config",  STATE.config ).catch(() => {}); }
}

async function pull() {
  let res;
  try {
    res = await Promise.allSettled([
      apiGet("events"), apiGet("rewards"), apiGet("vacilos"), apiGet("config"), apiGet("_at"),
    ]);
  } catch (e) { res = null; }
  const ok = res && res.slice(0, 4).some((r) => r.status === "fulfilled");
  if (ok) {
    const [evs, rw, vc, cfg, at] = res;
    STATE.events  = (evs.status === "fulfilled" && evs.value) ? evs.value : {};
    STATE.rewards = (rw.status  === "fulfilled" && rw.value)  ? rw.value  : null;
    STATE.vacilos = (vc.status  === "fulfilled" && vc.value)  ? vc.value  : null;
    STATE.config  = (cfg.status === "fulfilled" && cfg.value) ? cfg.value : null;
    await ensureSeed({ rewards: !STATE.rewards, vacilos: !STATE.vacilos, config: !STATE.config });
    if (at.status === "fulfilled" && typeof at.value === "number") lastAt = at.value;
    normalize();
    saveLocal();
  } else {
    loadLocal();
    normalize();
  }
  renderAll();
}

/* verifica se o parceiro gravou algo e recarrega */
async function syncCheck() {
  if (getOutbox().length) { await flush(); }
  try {
    const at = await apiGet("_at");
    if (typeof at === "number" && at > lastAt + 200) await pull();
  } catch (e) {}
}

/* ============================================================
   Regras do jogo
   ============================================================ */
function eventsSorted() {
  return Object.values(STATE.events).filter(Boolean).sort((a, b) => (a.ts || 0) - (b.ts || 0));
}
function balances(list) {
  const evs = list || eventsSorted();
  const b = { di: 0, tati: 0 };
  for (const ev of evs) {
    if (ev.type === "vacilo") b[other(ev.by)] += ev.points || 0;
    else if (ev.type === "resgate") b[ev.by] -= ev.cost || 0;
    else if (ev.type === "ataque") { b[ev.by] -= ev.amount || 0; b[ev.target] -= ev.amount || 0; }
  }
  return b;
}
function multiplierFor(streak) {
  const c = STATE.config.combo || { at3: 2, at5: 3 };
  if (streak >= 5) return c.at5 || 3;
  if (streak >= 3) return c.at3 || 2;
  return 1;
}
/* streak atual = quantos vacilos seguidos a MESMA pessoa deu por último */
function currentStreak() {
  const vac = eventsSorted().filter((e) => e.type === "vacilo");
  if (!vac.length) return { by: null, count: 0 };
  const by = vac[vac.length - 1].by;
  let count = 0;
  for (let i = vac.length - 1; i >= 0; i--) { if (vac[i].by === by) count++; else break; }
  return { by, count };
}
/* qual seria o streak/mult se `by` vacilasse agora */
function nextStreak(by) {
  const cur = currentStreak();
  const count = cur.by === by ? cur.count + 1 : 1;
  return { count, mult: multiplierFor(count) };
}

/* ============================================================
   Render
   ============================================================ */
function renderAll() {
  normalize();
  renderCombo();
  renderScoreboard();
  renderQuick();
  renderFeed();
  renderLoja();
  renderStats();
}

function renderCombo() {
  const el = $("#comboBanner");
  const cur = currentStreak();
  if (!cur.by || cur.count < 2) { el.hidden = true; return; }
  const mult = multiplierFor(cur.count);
  el.hidden = false;
  if (cur.count >= 3) {
    el.className = "combo-banner";
    el.style.background = ""; // volta ao gradiente forte da classe
    el.innerHTML = `<span class="cb-emoji">🔥</span><span><b>${esc(nameOf(cur.by))}</b> vacilou <b>${cur.count}x seguidas</b> — DOUBLE DAMAGE! Cada vacilo vale <b>x${mult}</b> pra ${esc(nameOf(other(cur.by)))} 😈</span>`;
  } else {
    el.className = "combo-banner";
    el.style.background = "linear-gradient(120deg,#FFB347,#FFD27A)";
    el.innerHTML = `<span class="cb-emoji">😏</span><span><b>${esc(nameOf(cur.by))}</b> vacilou 2x seguidas — mais uma e vira <b>double damage x${multiplierFor(3)}</b>!</span>`;
  }
}

function pcardHTML(id, bal, leader, streakInfo) {
  const streak = streakInfo.by === id ? streakInfo.count : 0;
  const hot = streak >= 3;
  const streakCls = streak >= 2 ? (hot ? "streak hot" : "streak") : "streak none";
  const streakTxt = streak >= 2 ? `🔥 ${streak} seguidas${hot ? " · x" + multiplierFor(streak) : ""}` : "—";
  return `<div class="pcard ${id} ${leader === id ? "leader" : ""}">
      <div class="bar"></div>
      <div class="crown">👑</div>
      <div class="pname">${esc(nameOf(id))}</div>
      <div class="pts">${bal[id]}</div>
      <div class="ptslbl">pontos</div>
      <div class="${streakCls}">${streakTxt}</div>
    </div>`;
}
function renderScoreboard() {
  const bal = balances();
  const leader = bal.di === bal.tati ? null : (bal.di > bal.tati ? "di" : "tati");
  const streakInfo = currentStreak();
  const diff = Math.abs(bal.di - bal.tati);
  const vs = `<div class="vs">
      <div class="vs-badge">VS</div>
      <div class="diff">${diff === 0 ? "empate" : "+" + diff + " " + esc(nameOf(leader))}</div>
    </div>`;
  $("#scoreboard").innerHTML = pcardHTML("di", bal, leader, streakInfo) + vs + pcardHTML("tati", bal, leader, streakInfo);
}

function qcolHTML(id) {
  return `<div class="qcol ${id}">
      <div class="qhead">${esc(nameOf(id))}</div>
      <button class="qbtn vac" data-act="vacilo" data-id="${id}">😬 Vacilou</button>
      <button class="qbtn res" data-act="resgate" data-id="${id}">🎁 Resgatar</button>
      <button class="qbtn atk" data-act="ataque" data-id="${id}">⚔️ Tirar pontos</button>
    </div>`;
}
function renderQuick() { $("#quick").innerHTML = qcolHTML("di") + qcolHTML("tati"); }

function fmtWhen(ts) {
  const d = new Date(ts), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return "há " + Math.floor(diff / 60) + " min";
  if (diff < 86400 && d.getDate() === now.getDate()) return "há " + Math.floor(diff / 3600) + " h";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  if (d.getDate() === y.getDate() && d.getMonth() === y.getMonth()) return "ontem " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function feedLine(ev) {
  const b = (id) => `<b class="${id}">${esc(nameOf(id))}</b>`;
  if (ev.type === "vacilo") {
    const badge = (ev.mult || 1) > 1 ? `<span class="fbadge">🔥 x${ev.mult}</span>` : "";
    const note = ev.note ? ` — <i>${esc(ev.note)}</i>` : "";
    return {
      ic: ev.emoji || "😬",
      html: `${b(ev.by)} vacilou · ${esc(ev.cat || "vacilo")}${badge}${note}`,
      pts: `+${ev.points} ${esc(nameOf(other(ev.by)))}`,
      cls: "up",
    };
  }
  if (ev.type === "resgate") {
    return { ic: ev.emoji || "🎁", html: `${b(ev.by)} resgatou <b>${esc(ev.reward)}</b>`, pts: `−${ev.cost}`, cls: "down" };
  }
  if (ev.type === "ataque") {
    return { ic: "⚔️", html: `${b(ev.by)} descontou de ${b(ev.target)}`, pts: `−${ev.amount} nos dois`, cls: "down" };
  }
  return { ic: "•", html: "registro", pts: "", cls: "" };
}
function renderFeed() {
  const evs = eventsSorted().reverse();
  const ul = $("#feed"), empty = $("#feedEmpty");
  if (!evs.length) { ul.innerHTML = ""; empty.hidden = false; return; }
  empty.hidden = true;
  ul.innerHTML = evs.slice(0, 60).map((ev) => {
    const L = feedLine(ev);
    return `<li class="fitem">
        <span class="fic">${L.ic}</span>
        <span class="fbody"><span class="ftext">${L.html}</span><span class="fwhen">${fmtWhen(ev.ts)}</span></span>
        <span class="fpts ${L.cls}">${L.pts}</span>
        <button class="fdel" data-del="${ev.id}" aria-label="Apagar">✕</button>
      </li>`;
  }).join("");
}

/* ---------- Loja ---------- */
function renderLoja() {
  $("#rewardsList").innerHTML = STATE.rewards.map((r) => `
    <div class="gcard" data-reward="${esc(r.id)}">
      <div class="gedit">✏️</div>
      <div class="gemoji">${esc(r.emoji || "🎁")}</div>
      <div class="gname">${esc(r.name)}</div>
      <div class="gcost">${r.cost} <small>pts</small></div>
    </div>`).join("") || `<p class="hint">Nenhuma recompensa. Toque em “+ Nova”.</p>`;
  $("#vacilosList").innerHTML = STATE.vacilos.map((v) => `
    <div class="gcard" data-vacilo="${esc(v.id)}">
      <div class="gedit">✏️</div>
      <div class="gemoji">${esc(v.emoji || "😬")}</div>
      <div class="gname">${esc(v.name)}</div>
      <div class="gcost">+${v.points} <small>pro parceiro</small></div>
    </div>`).join("") || `<p class="hint">Nenhum tipo. Toque em “+ Novo”.</p>`;
}

/* ============================================================
   Estatísticas + gráficos (SVG/CSS, sem libs)
   ============================================================ */
function barChart(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => {
    const w = Math.round((r.value / max) * 100);
    return `<div class="barrow">
        <span class="blabel">${esc(r.label)}</span>
        <span class="btrack"><span class="bfill" style="width:${w}%;background:${r.color}"></span></span>
        <span class="bval">${r.value}${r.suffix || ""}</span>
      </div>`;
  }).join("");
}
function lineChart(diSeries, tatiSeries) {
  const W = 320, H = 120, pad = 10;
  const all = [0, ...diSeries, ...tatiSeries];
  let mn = Math.min(...all), mx = Math.max(...all);
  if (mn === mx) { mn -= 1; mx += 1; }
  const n = Math.max(diSeries.length, tatiSeries.length, 1);
  const x = (i) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v) => pad + (H - 2 * pad) * (1 - (v - mn) / (mx - mn));
  const poly = (s, color) =>
    `<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${s.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ")}"/>`;
  const dots = (s, color) =>
    s.length ? `<circle cx="${x(s.length - 1).toFixed(1)}" cy="${y(s[s.length - 1]).toFixed(1)}" r="3.5" fill="${color}"/>` : "";
  let zero = "";
  if (mn <= 0 && mx >= 0) zero = `<line x1="${pad}" y1="${y(0).toFixed(1)}" x2="${W - pad}" y2="${y(0).toFixed(1)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>`;
  return `<svg class="linechart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução dos pontos">
      ${zero}${poly(diSeries, "var(--di)")}${poly(tatiSeries, "var(--tati)")}${dots(diSeries, "var(--di)")}${dots(tatiSeries, "var(--tati)")}
    </svg>
    <div class="legend"><span><i style="background:var(--di)"></i>${esc(nameOf("di"))}</span><span><i style="background:var(--tati)"></i>${esc(nameOf("tati"))}</span></div>`;
}

function renderStats() {
  const evs = eventsSorted();
  const bal = balances();
  const vac = evs.filter((e) => e.type === "vacilo");
  const vacBy = { di: vac.filter((e) => e.by === "di").length, tati: vac.filter((e) => e.by === "tati").length };
  const spent = { di: 0, tati: 0 };
  for (const e of evs) {
    if (e.type === "resgate") spent[e.by] += e.cost || 0;
    else if (e.type === "ataque") spent[e.by] += e.amount || 0;
  }
  const maxCombo = vac.reduce((m, e) => Math.max(m, e.streak || 1), 0);

  $("#statCards").innerHTML = `
    <div class="scard di"><div class="snum">${bal.di}</div><div class="slbl">pontos de ${esc(nameOf("di"))}</div></div>
    <div class="scard tati"><div class="snum">${bal.tati}</div><div class="slbl">pontos de ${esc(nameOf("tati"))}</div></div>
    <div class="scard"><div class="snum">${vac.length}</div><div class="slbl">vacilos no total</div></div>
    <div class="scard"><div class="snum">${maxCombo}${maxCombo >= 3 ? " 🔥" : ""}</div><div class="slbl">maior combo</div></div>`;

  const charts = [];

  // 1. Vacilos por pessoa
  charts.push(`<div class="chart"><h3>😬 Vacilos por pessoa</h3>${
    vac.length ? barChart([
      { label: nameOf("di"), value: vacBy.di, color: "var(--di)" },
      { label: nameOf("tati"), value: vacBy.tati, color: "var(--tati)" },
    ]) : `<p class="chart-empty">Ainda sem vacilos registrados.</p>`
  }</div>`);

  // 2. Vacilos por motivo
  const byCat = {};
  for (const e of vac) { const k = e.cat || "Outro"; byCat[k] = (byCat[k] || 0) + 1; }
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: v, color: "var(--brand)" }));
  charts.push(`<div class="chart"><h3>📋 Vacilos por motivo</h3>${
    catRows.length ? barChart(catRows) : `<p class="chart-empty">Ainda sem vacilos registrados.</p>`
  }</div>`);

  // 3. Onde os pontos foram gastos
  const byGasto = {};
  for (const e of evs) {
    if (e.type === "resgate") { const k = (e.emoji ? e.emoji + " " : "") + (e.reward || "Recompensa"); byGasto[k] = (byGasto[k] || 0) + (e.cost || 0); }
    else if (e.type === "ataque") { byGasto["⚔️ Ataques"] = (byGasto["⚔️ Ataques"] || 0) + (e.amount || 0); }
  }
  const gastoRows = Object.entries(byGasto).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: v, color: "var(--gold)", suffix: "" }));
  charts.push(`<div class="chart"><h3>💸 Onde os pontos foram gastos</h3>${
    gastoRows.length ? barChart(gastoRows) : `<p class="chart-empty">Nenhum ponto gasto ainda.</p>`
  }</div>`);

  // 4. Evolução dos pontos
  const diSeries = [0], tatiSeries = [0];
  let cd = 0, ct = 0;
  for (const e of evs) {
    if (e.type === "vacilo") { if (other(e.by) === "di") cd += e.points || 0; else ct += e.points || 0; }
    else if (e.type === "resgate") { if (e.by === "di") cd -= e.cost || 0; else ct -= e.cost || 0; }
    else if (e.type === "ataque") { cd -= e.amount || 0; ct -= e.amount || 0; }
    diSeries.push(cd); tatiSeries.push(ct);
  }
  charts.push(`<div class="chart"><h3>📈 Evolução dos pontos</h3><p class="csub">saldo acumulado ao longo dos registros</p>${
    evs.length ? lineChart(diSeries, tatiSeries) : `<p class="chart-empty">O gráfico aparece após os primeiros registros.</p>`
  }</div>`);

  $("#charts").innerHTML = charts.join("");
}

/* ============================================================
   Modais
   ============================================================ */
function openModal(id) { $("#" + id).classList.remove("hidden"); }
function closeModal(id) { $("#" + id).classList.add("hidden"); }
function closeAllModals() { $$(".modal").forEach((m) => m.classList.add("hidden")); }

/* ---------- Vacilo ---------- */
let vaciloState = { by: "di", catId: null };
function openVacilo(by) {
  vaciloState = { by, catId: STATE.vacilos[0] ? STATE.vacilos[0].id : null };
  $("#vaciloTitle").textContent = "Vacilo de " + nameOf(by);
  $("#vaciloSub").textContent = `Quem ganha os pontos é ${nameOf(other(by))}.`;
  $("#vaciloNote").value = "";
  renderVaciloChips();
  updateVaciloPreview();
  openModal("vaciloModal");
}
function renderVaciloChips() {
  $("#vaciloChips").innerHTML = STATE.vacilos.map((v) =>
    `<button class="chip ${v.id === vaciloState.catId ? "sel" : ""}" data-cat="${esc(v.id)}">${esc(v.emoji || "😬")} ${esc(v.name)} <span class="cpts">+${v.points}</span></button>`
  ).join("");
}
function updateVaciloPreview() {
  const cat = STATE.vacilos.find((v) => v.id === vaciloState.catId);
  const el = $("#vaciloPreview");
  if (!cat) { el.textContent = "Escolha um motivo."; el.className = "preview"; return; }
  const ns = nextStreak(vaciloState.by);
  const pts = cat.points * ns.mult;
  if (ns.mult > 1) {
    el.className = "preview combo";
    el.innerHTML = `🔥 DOUBLE DAMAGE x${ns.mult}!<br><span class="big">${nameOf(other(vaciloState.by))} ganha +${pts} pts</span><br><small>${cat.points} × ${ns.mult} (${ns.count} vacilos seguidos)</small>`;
  } else {
    el.className = "preview";
    el.innerHTML = `<span class="big">${esc(nameOf(other(vaciloState.by)))} ganha +${pts} pts</span>`;
  }
}
function confirmVacilo() {
  const cat = STATE.vacilos.find((v) => v.id === vaciloState.catId);
  if (!cat) { toast("Escolha um motivo"); return; }
  const ns = nextStreak(vaciloState.by);
  const ev = {
    id: uid(), ts: Date.now(), type: "vacilo", by: vaciloState.by,
    catId: cat.id, cat: cat.name, emoji: cat.emoji, base: cat.points,
    mult: ns.mult, streak: ns.count, points: cat.points * ns.mult,
    note: $("#vaciloNote").value.trim() || null,
  };
  saveEvent(ev);
  closeModal("vaciloModal");
  const extra = ns.mult > 1 ? ` 🔥 x${ns.mult}` : "";
  toast(`${nameOf(other(vaciloState.by))} ganhou +${ev.points}${extra}`);
  showUndo(`Vacilo de ${nameOf(vaciloState.by)} registrado`, () => removeEvent(ev.id));
}

/* ---------- Resgate ---------- */
function openResgate(by) {
  const bal = balances();
  $("#resgateTitle").textContent = "Resgatar — " + nameOf(by);
  $("#resgateSub").textContent = `${nameOf(by)} tem ${bal[by]} pontos para gastar.`;
  $("#resgateList").innerHTML = STATE.rewards.map((r) => {
    const locked = bal[by] < r.cost;
    return `<div class="ritem ${locked ? "locked" : ""}">
        <span class="remoji">${esc(r.emoji || "🎁")}</span>
        <span class="rname">${esc(r.name)}</span>
        <span class="rcost">${r.cost} pts</span>
        <button class="rbtn" data-resgatar="${esc(r.id)}" data-by="${by}" ${locked ? "disabled" : ""}>${locked ? "🔒" : "Resgatar"}</button>
      </div>`;
  }).join("") || `<p class="hint">Nenhuma recompensa cadastrada. Crie na aba Loja.</p>`;
  openModal("resgateModal");
}
function doResgate(by, rewardId) {
  const r = STATE.rewards.find((x) => x.id === rewardId);
  if (!r) return;
  const bal = balances();
  if (bal[by] < r.cost) { toast("Pontos insuficientes"); return; }
  const ev = { id: uid(), ts: Date.now(), type: "resgate", by, rewardId: r.id, reward: r.name, emoji: r.emoji, cost: r.cost };
  saveEvent(ev);
  closeModal("resgateModal");
  toast(`${nameOf(by)} resgatou ${r.emoji || ""} ${r.name}`);
  showUndo("Recompensa resgatada", () => removeEvent(ev.id));
}

/* ---------- Ataque ---------- */
let ataqueBy = "di";
function openAtaque(by) {
  const bal = balances();
  if (bal[by] < 1) { toast(`${nameOf(by)} não tem pontos para gastar`); return; }
  ataqueBy = by;
  const max = bal[by];
  $("#ataqueTitle").textContent = "Tirar pontos do parceiro";
  $("#ataqueSub").textContent = `${nameOf(by)} gasta pontos para descontar a mesma quantia de ${nameOf(other(by))}.`;
  const inp = $("#ataqueAmount"), rng = $("#ataqueRange");
  const def = Math.min(10, max);
  inp.max = max; inp.value = def; rng.max = max; rng.min = 1; rng.value = def;
  updateAtaquePreview();
  openModal("ataqueModal");
}
function updateAtaquePreview() {
  const bal = balances();
  let amt = parseInt($("#ataqueAmount").value, 10) || 0;
  amt = Math.max(1, Math.min(amt, bal[ataqueBy]));
  const tgt = other(ataqueBy);
  $("#ataquePreview").innerHTML =
    `<span class="big">${esc(nameOf(ataqueBy))}: ${bal[ataqueBy]} → ${bal[ataqueBy] - amt}</span><br><span class="big">${esc(nameOf(tgt))}: ${bal[tgt]} → ${bal[tgt] - amt}</span>`;
}
function confirmAtaque() {
  const bal = balances();
  let amt = parseInt($("#ataqueAmount").value, 10) || 0;
  amt = Math.max(1, Math.min(amt, bal[ataqueBy]));
  const ev = { id: uid(), ts: Date.now(), type: "ataque", by: ataqueBy, target: other(ataqueBy), amount: amt };
  saveEvent(ev);
  closeModal("ataqueModal");
  toast(`${nameOf(ataqueBy)} descontou ${amt} de ${nameOf(other(ataqueBy))}`);
  showUndo("Ataque registrado", () => removeEvent(ev.id));
}

/* ---------- Editar recompensa ---------- */
let editRewardId = null;
function openRewardEdit(id) {
  editRewardId = id;
  const r = id ? STATE.rewards.find((x) => x.id === id) : null;
  $("#rewardEditTitle").textContent = r ? "Editar recompensa" : "Nova recompensa";
  $("#reEmoji").value = r ? (r.emoji || "") : "🎁";
  $("#reName").value = r ? r.name : "";
  $("#reCost").value = r ? r.cost : "";
  $("#reDelete").style.display = r ? "" : "none";
  openModal("rewardEditModal");
}
function saveReward() {
  const emoji = $("#reEmoji").value.trim() || "🎁";
  const name = $("#reName").value.trim();
  const cost = parseInt($("#reCost").value, 10);
  if (!name) { toast("Dê um nome"); return; }
  if (!(cost > 0)) { toast("Custo inválido"); return; }
  if (editRewardId) {
    const r = STATE.rewards.find((x) => x.id === editRewardId);
    if (r) { r.emoji = emoji; r.name = name; r.cost = cost; }
  } else {
    STATE.rewards.push({ id: "r" + uid(), emoji, name, cost });
  }
  saveRewards();
  closeModal("rewardEditModal");
  toast("Recompensa salva");
}
function deleteReward() {
  if (!editRewardId) return;
  STATE.rewards = STATE.rewards.filter((x) => x.id !== editRewardId);
  saveRewards();
  closeModal("rewardEditModal");
  toast("Recompensa excluída");
}

/* ---------- Editar tipo de vacilo ---------- */
let editVaciloId = null;
function openVaciloEdit(id) {
  editVaciloId = id;
  const v = id ? STATE.vacilos.find((x) => x.id === id) : null;
  $("#vaciloEditTitle").textContent = v ? "Editar tipo de vacilo" : "Novo tipo de vacilo";
  $("#veEmoji").value = v ? (v.emoji || "") : "😬";
  $("#veName").value = v ? v.name : "";
  $("#vePoints").value = v ? v.points : "";
  $("#veDelete").style.display = v ? "" : "none";
  openModal("vaciloEditModal");
}
function saveVaciloType() {
  const emoji = $("#veEmoji").value.trim() || "😬";
  const name = $("#veName").value.trim();
  const points = parseInt($("#vePoints").value, 10);
  if (!name) { toast("Dê um nome"); return; }
  if (!(points > 0)) { toast("Pontos inválidos"); return; }
  if (editVaciloId) {
    const v = STATE.vacilos.find((x) => x.id === editVaciloId);
    if (v) { v.emoji = emoji; v.name = name; v.points = points; }
  } else {
    STATE.vacilos.push({ id: "v" + uid(), emoji, name, points });
  }
  saveVacilos();
  closeModal("vaciloEditModal");
  toast("Tipo salvo");
}
function deleteVaciloType() {
  if (!editVaciloId) return;
  if (STATE.vacilos.length <= 1) { toast("Precisa ter pelo menos um tipo"); return; }
  STATE.vacilos = STATE.vacilos.filter((x) => x.id !== editVaciloId);
  saveVacilos();
  closeModal("vaciloEditModal");
  toast("Tipo excluído");
}

/* ---------- Persistir mudanças ---------- */
function saveEvent(ev) { STATE.events[ev.id] = ev; saveLocal(); renderAll(); push("put", "events/" + ev.id, ev); }
function removeEvent(id) { delete STATE.events[id]; saveLocal(); renderAll(); push("del", "events/" + id); }
function saveRewards() { saveLocal(); renderAll(); push("put", "rewards", STATE.rewards); }
function saveVacilos() { saveLocal(); renderAll(); push("put", "vacilos", STATE.vacilos); }
function saveConfig() { saveLocal(); renderAll(); push("put", "config", STATE.config); }

/* ---------- Nomes / combo ---------- */
function openNames() {
  $("#nameDi").value = nameOf("di");
  $("#nameTati").value = nameOf("tati");
  openModal("namesModal");
}
function saveNames() {
  STATE.config.names.di = $("#nameDi").value.trim() || "Di";
  STATE.config.names.tati = $("#nameTati").value.trim() || "Tati";
  saveConfig();
  closeModal("namesModal");
  toast("Nomes atualizados");
}
function openCombo() {
  $("#combo3").value = STATE.config.combo.at3;
  $("#combo5").value = STATE.config.combo.at5;
  openModal("comboModal");
}
function saveCombo() {
  STATE.config.combo.at3 = Math.max(1, parseInt($("#combo3").value, 10) || 2);
  STATE.config.combo.at5 = Math.max(1, parseInt($("#combo5").value, 10) || 3);
  saveConfig();
  closeModal("comboModal");
  toast("Regras de combo salvas");
}

/* ---------- Backup / reset ---------- */
function exportBackup() {
  const data = { app: "casal-pontos", version: 1, exportedAt: new Date().toISOString(),
    events: STATE.events, rewards: STATE.rewards, vacilos: STATE.vacilos, config: STATE.config };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "placar-casal-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
  closeModal("menuModal");
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || d.app !== "casal-pontos") { toast("Arquivo inválido"); return; }
      STATE.events = d.events || {};
      STATE.rewards = Array.isArray(d.rewards) ? d.rewards : clone(DEFAULT_REWARDS);
      STATE.vacilos = Array.isArray(d.vacilos) ? d.vacilos : clone(DEFAULT_VACILOS);
      STATE.config = d.config || clone(DEFAULT_CONFIG);
      normalize(); saveLocal(); renderAll();
      push("put", "events", STATE.events);
      saveRewards(); saveVacilos(); saveConfig();
      closeModal("menuModal");
      toast("Backup restaurado ✅");
    } catch (e) { toast("Não consegui ler o arquivo"); }
  };
  reader.readAsText(file);
}
function resetAll() {
  if (!confirm("Zerar TODO o placar? Isso apaga o histórico e os pontos dos dois. As recompensas e tipos de vacilo continuam.")) return;
  STATE.events = {};
  saveLocal(); renderAll();
  push("del", "events");
  closeModal("menuModal");
  toast("Placar zerado");
}
function shareText() {
  const bal = balances();
  const leader = bal.di === bal.tati ? null : (bal.di > bal.tati ? "di" : "tati");
  const cur = currentStreak();
  let t = "🏆 Placar do Casal\n\n";
  t += `${nameOf("di")}: ${bal.di} pts\n${nameOf("tati")}: ${bal.tati} pts\n\n`;
  t += leader ? `👑 ${nameOf(leader)} tá na frente por ${Math.abs(bal.di - bal.tati)}!\n` : "Empate técnico! 🤝\n";
  if (cur.by && cur.count >= 3) t += `🔥 ${nameOf(cur.by)} tá vacilando ${cur.count}x seguidas...\n`;
  t += "\nhttps://diogoribeir.github.io/app/casal-pontos/";
  $("#shareText").value = t;
  closeModal("menuModal");
  openModal("shareModal");
}

/* ---------- Undo / toast ---------- */
let undoTimer = null, undoFn = null;
function showUndo(msg, fn) {
  undoFn = fn;
  $("#undoText").textContent = msg;
  $("#undoBar").classList.remove("hidden");
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 12000);
}
function hideUndo() { $("#undoBar").classList.add("hidden"); undoFn = null; }
let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
}

/* ---------- Navegação por abas ---------- */
function goTab(name) {
  $$(".tab").forEach((t) => (t.hidden = t.dataset.tab !== name));
  $$(".tabbtn").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (name === "stats") renderStats();
}

/* ============================================================
   Eventos de UI
   ============================================================ */
function wireUI() {
  // nav
  $$(".tabbtn").forEach((b) => b.addEventListener("click", () => goTab(b.dataset.go)));

  // ações rápidas (delegação)
  $("#quick").addEventListener("click", (e) => {
    const btn = e.target.closest(".qbtn"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    if (act === "vacilo") openVacilo(id);
    else if (act === "resgate") openResgate(id);
    else if (act === "ataque") openAtaque(id);
  });

  // feed: apagar
  $("#feed").addEventListener("click", (e) => {
    const del = e.target.closest(".fdel"); if (!del) return;
    const id = del.dataset.del;
    const ev = STATE.events[id];
    removeEvent(id);
    if (ev) showUndo("Registro apagado", () => saveEvent(ev));
  });

  // vacilo modal
  $("#vaciloChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    vaciloState.catId = chip.dataset.cat;
    renderVaciloChips(); updateVaciloPreview();
  });
  $("#vaciloConfirm").addEventListener("click", confirmVacilo);

  // resgate modal
  $("#resgateList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-resgatar]"); if (!btn || btn.disabled) return;
    doResgate(btn.dataset.by, btn.dataset.resgatar);
  });

  // ataque modal
  $("#ataqueAmount").addEventListener("input", () => {
    const bal = balances();
    let amt = parseInt($("#ataqueAmount").value, 10) || 0;
    amt = Math.max(1, Math.min(amt, bal[ataqueBy]));
    $("#ataqueRange").value = amt;
    updateAtaquePreview();
  });
  $("#ataqueRange").addEventListener("input", () => {
    $("#ataqueAmount").value = $("#ataqueRange").value;
    updateAtaquePreview();
  });
  $("#ataqueConfirm").addEventListener("click", confirmAtaque);

  // loja
  $("#addReward").addEventListener("click", () => openRewardEdit(null));
  $("#addVacilo").addEventListener("click", () => openVaciloEdit(null));
  $("#rewardsList").addEventListener("click", (e) => {
    const c = e.target.closest("[data-reward]"); if (c) openRewardEdit(c.dataset.reward);
  });
  $("#vacilosList").addEventListener("click", (e) => {
    const c = e.target.closest("[data-vacilo]"); if (c) openVaciloEdit(c.dataset.vacilo);
  });
  $("#reSave").addEventListener("click", saveReward);
  $("#reDelete").addEventListener("click", deleteReward);
  $("#veSave").addEventListener("click", saveVaciloType);
  $("#veDelete").addEventListener("click", deleteVaciloType);

  // menu
  $("#menuBtn").addEventListener("click", () => openModal("menuModal"));
  $("#editNamesBtn").addEventListener("click", () => { closeModal("menuModal"); openNames(); });
  $("#comboBtn").addEventListener("click", () => { closeModal("menuModal"); openCombo(); });
  $("#namesSave").addEventListener("click", saveNames);
  $("#comboSave").addEventListener("click", saveCombo);
  $("#shareBtn").addEventListener("click", shareText);
  $("#shareCopy").addEventListener("click", () => {
    const t = $("#shareText"); t.select();
    navigator.clipboard ? navigator.clipboard.writeText(t.value).then(() => toast("Copiado ✅")) : document.execCommand("copy");
  });
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });
  $("#resetBtn").addEventListener("click", resetAll);

  // undo
  $("#undoBtn").addEventListener("click", () => { if (undoFn) undoFn(); hideUndo(); });

  // fechar modais
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest(".modal").classList.add("hidden")));
  $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.add("hidden"); }));
}

/* ============================================================
   Boot
   ============================================================ */
async function boot() {
  loadLocal(); normalize(); renderAll(); // pinta na hora com o que tiver local
  wireUI();
  await pull();                          // busca a nuvem
  await flush();                         // escoa pendências, se houver

  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncCheck(); });
  window.addEventListener("online", () => { offlineNoticed = false; flush().then(syncCheck); });
  setInterval(() => { if (document.visibilityState === "visible") syncCheck(); }, 7000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
