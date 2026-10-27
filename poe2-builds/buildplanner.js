/* ============================================================
   Exile Compass — exportação para o BUILD PLANNER do PoE2
   ------------------------------------------------------------
   Formato oficial da GGG (pathofexile.com/developer/docs/game,
   "Build Planner (PoE2 only)", versão 1 experimental): um JSON
   .build com name/author/description/ascendancy + passives
   (ids da tabela PassiveSkills = stringId da árvore), skills e
   support_skills (ids BaseItemTypes = gameId das gemas) e
   inventory_slots (ids da tabela Inventories). Mesmo mapeamento
   do exportador do Path of Building 2 (BuildExportPoE2.lua).
   O jogo carrega builds assinadas pelo site pathofexile2.com
   ou arquivos na pasta BuildPlanner (PC).
   ============================================================ */
(function () {
  "use strict";
  const M = window.Motor, J = window.KB_JOGO, A = window.KB_ARVORE, C = window.KB_CONCEITOS;
  const APP_URL = "https://diogoribeir.github.io/app/poe2-builds/";

  /* slot do único → id da tabela Inventories (PoB2: Data/InventorySlots.lua) */
  const SLOT_INV = {
    body: "BodyArmour1", helmet: "Helm1", gloves: "Gloves1", boots: "Boots1", belt: "Belt1", amulet: "Amulet1",
    ring: "Ring1", shield: "Offhand1", focus: "Offhand1", quiver: "Offhand1", flask: "Flask1", charm: "Flask1",
    bow: "Weapon1", crossbow: "Weapon1", spear: "Weapon1", staff: "Weapon1", wand: "Weapon1", sceptre: "Weapon1", mace: "Weapon1",
    axe: "Weapon1", claw: "Weapon1", dagger: "Weapon1", flail: "Weapon1", sword: "Weapon1", talisman: "Weapon1", traptool: "Weapon1"
  };
  /* markup do jogo usa { } como delimitador: tirar chaves de textos livres */
  const limpa = (s) => String(s == null ? "" : s).replace(/[{}]/g, "").trim();
  const VET_EN = { more: "more multiplier", conv: "conversion / gain as", crit: "critical", taken: "enemy takes more damage", mitig: "lowers enemy defence", vel: "speed", ailment: "ailment", clear: "area / projectiles", defesa: "defence" };

  function ascId(b) {
    const cl = J.classes.find((c) => c.n === (b.classe || M.CLASSE_DE[b.asc]));
    return (cl && cl.ascId && cl.ascId[b.asc]) || "";
  }
  function sidDe(nome, lista) { const n = lista.find((x) => x.n === nome); return n && n.sid; }

  /* carrega kb/nos.js (id → stringId de toda a árvore) só quando precisa */
  let nosPromessa = null;
  function carregarNos() {
    if (window.KB_NOS) return Promise.resolve(window.KB_NOS);
    if (!nosPromessa) nosPromessa = new Promise((ok, falha) => {
      const s = document.createElement("script"); s.src = "kb/nos.js";
      s.onload = () => ok(window.KB_NOS || {}); s.onerror = () => { nosPromessa = null; falha(new Error("kb/nos.js")); };
      document.head.appendChild(s);
    });
    return nosPromessa;
  }

  async function gerar(b) {
    const avisos = [];
    const r = M.analisar(b);
    const out = {
      name: limpa(b.nome || "Exile Compass build").slice(0, 80),
      author: "Exile Compass",
      link: APP_URL,
      description: limpa(`${r.arquetipo}. Made with Exile Compass (fan tool, not affiliated with Grinding Gear Games).`)
    };
    const asc = ascId(b);
    if (asc) out.ascendancy = asc;
    else if (b.asc) avisos.push(`A ascendência ${b.asc} não tem id no Build Planner — o arquivo vai sem ascendência.`);

    /* passivas */
    const passivas = [];
    const vistos = new Set();
    const add = (sid, texto) => { if (!sid || vistos.has(sid)) return; vistos.add(sid); passivas.push(texto ? { id: sid, additional_text: texto } : sid); };
    if (Array.isArray(b.nosIds) && b.nosIds.length) {
      try {
        const mapa = await carregarNos();
        b.nosIds.forEach((id) => add(mapa[id]));
      } catch (e) { avisos.push("Não consegui carregar a árvore completa; exportando só os nós listados."); }
    }
    (A.ascendencias[b.asc] || []).filter((n) => b.ascNos.includes(n.n)).forEach((n) => add(n.sid, "<gold>{Exile Compass: ascendancy pick}"));
    b.keystones.forEach((k) => { const sid = sidDe(k, A.keystones); if (sid) add(sid, "<gold>{Exile Compass: keystone}"); else avisos.push(`Keystone ${k} não encontrada.`); });
    b.notaveis.forEach((k) => { const sid = sidDe(k, A.notaveis); if (sid) add(sid, "<gold>{Exile Compass: key notable}"); else avisos.push(`Notável ${k} não encontrado.`); });
    if (!(Array.isArray(b.nosIds) && b.nosIds.length)) avisos.push("Árvore: só keystones, notáveis e nós de ascendência que você listou (o caminho entre eles não vai). Importando um código PoB a árvore inteira é exportada.");
    out.passives = passivas;

    /* gemas */
    const skills = [];
    (b.grupos || []).forEach((g) => {
      const s = M.SK.get(g.skill);
      if (!s) return;
      if (!s.gid) { avisos.push(`${s.n} não tem id de gema (skill de item/ascendência) — ficou de fora.`); return; }
      const papel = { principal: "Main skill", buff: "Buff / persistent", movimento: "Movement", disparada: "Triggered", utilidade: "Utility", secundaria: "Secondary" }[g.papel] || "";
      const e = { id: s.gid };
      if (papel) e.additional_text = g.papel === "principal" ? `<gold>{<b>{${papel}}}` : papel;
      const sups = [];
      (g.sup || []).forEach((n) => {
        const su = M.SU.get(n);
        if (!su || !su.gid) return;
        if (!M.compativel(su, s)) { avisos.push(`${n} não funciona em ${s.n} — não exportado.`); return; }
        const vs = su.v.filter((v) => VET_EN[v]).slice(0, 2).map((v) => VET_EN[v]);
        sups.push(vs.length ? { id: su.gid, additional_text: "Vector: " + vs.join(", ") } : su.gid);
      });
      if (sups.length) e.support_skills = sups;
      skills.push(e);
    });
    out.skills = skills;

    /* itens: únicos + dica de arma */
    const slots = [];
    const usados = new Set();
    let aneis = 0;
    (b.unicos || []).forEach((n) => {
      const u = M.UN.get(n); if (!u) return;
      let inv = SLOT_INV[u.slot];
      if (!inv) { avisos.push(`${n} (${u.slot}) não tem slot no Build Planner.`); return; }
      if (u.slot === "ring") inv = ++aneis === 1 ? "Ring1" : "Ring2";
      if (usados.has(inv) && inv !== "Flask1") { avisos.push(`${n}: slot ${inv} já ocupado por outro único.`); return; }
      usados.add(inv);
      slots.push({ inventory_id: inv, unique_name: u.n, additional_text: `<unique>{<b>{${limpa(u.n)}}}\n<grey>{${limpa(u.b)}}` });
    });
    if (b.arma && !usados.has("Weapon1")) {
      const a = M.ARMA.get(b.arma);
      slots.push({ inventory_id: "Weapon1", additional_text: `<silver>{Any ${limpa(b.arma)}}${a ? "\n<grey>{" + limpa(a.pt) + "}" : ""}` });
    }
    out.inventory_slots = slots;

    if (!skills.length) avisos.push("Nenhuma gema exportável — adicione a skill principal.");
    return { obj: out, avisos };
  }

  function nomeArquivo(b) {
    return (String(b.nome || "Exile Compass build").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "build") + ".build";
  }
  async function texto(b) { const r = await gerar(b); return { json: JSON.stringify(r.obj, null, 2), avisos: r.avisos, obj: r.obj }; }
  function baixar(nome, json) {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  window.BuildPlanner = { gerar, texto, baixar, nomeArquivo, ascId };
})();
