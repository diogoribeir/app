/* ============================================================
   Exile Compass — CAMINHO SUGERIDO na árvore passiva
   ------------------------------------------------------------
   1) Perfil da build → peso de cada categoria de stat
      (elemento da skill, ataque/feitiço, arma, crítico, defesa da
      classe, e o controle Dano ↔ Defesa).
   2) Valor de cada nó = Σ linhas: peso(categoria) × relevância
      (qualificadores da linha: "with Bows", "Spell", "Fire"...)
      × magnitude ÷ magnitude típica daquela categoria (mediana
      de todas as linhas da árvore — tudo medido nos dados).
   3) Árvore de Steiner com prêmios e orçamento de pontos:
      guloso por ganho/custo^0,85 (Dijkstra multi-origem a partir
      do que já está alocado) + troca de galhos fracos enquanto o
      total melhorar. A ordem final = ordem de pegar subindo de nível.
   ============================================================ */
(function () {
  "use strict";
  const T = window.KB_TREE, J = window.KB_JOGO, Mo = window.Motor;
  const K = J.consts;
  const NO = new Map(T.nos.map((n) => [n.i, n]));
  const VIZ = new Map();
  T.lig.forEach((l) => {
    if (!VIZ.has(l[0])) VIZ.set(l[0], []);
    if (!VIZ.has(l[1])) VIZ.set(l[1], []);
    VIZ.get(l[0]).push(l[1]); VIZ.get(l[1]).push(l[0]);
  });
  const CLASSE = new Map(T.classes.map((c) => [c.n, c]));
  const ASC = new Map(); T.classes.forEach((c) => c.asc.forEach((a) => ASC.set(a.n, Object.assign({ classe: c.n }, a))));

  /* ---------------- nível → pontos ---------------- */
  function pontosNoNivel(nv) {
    nv = Math.max(1, Math.min(100, +nv || 1));
    const quest = nv >= K.nivelEndgame ? K.pontosQuest : Math.round(K.pontosQuest * (nv - 1) / (K.nivelEndgame - 1));
    return (nv - 1) + quest;
  }
  function nivelDoPonto(p) { for (let nv = 1; nv <= 100; nv++) if (pontosNoNivel(nv) >= p) return nv; return 100; }

  /* ---------------- categorias das linhas ---------------- */
  /* ordem importa: a primeira regra que casa define a categoria */
  const REGRAS = [
    [/additional Projectiles?|fire an additional|\bProjectiles? .*\b(Fork|Chain)|\+\d+ to the number of Projectiles/i, "projExtra"],
    [/^Grants Skill/i, "concede"],
    [/Arcane Surge/i, "surge"],
    [/Tailwind|Onslaught/i, "pressa"],
    [/Frenzy Charges?/i, "frenesi"],
    [/Power Charges?/i, "poder"],
    [/Endurance Charges?/i, "resistencia"],
    [/Critical Weakness/i, "critChance"],
    [/^Minions?\b.*\b(Life|Resistances?|Armour|Evasion|Energy Shield|Reservation)\b/i, "minionDef"],
    [/^Minions?\b|\bMinions? (deal|have|gain)\b/i, "minion"],
    [/^Companions?\b.*\b(Life|Resistances?|Armour|Evasion)\b/i, "minionDef", "companion"],
    [/^Companions?\b|while your Companion/i, "companion"],
    [/Totems?\b/i, "totem"],
    [/(on|against) you\b|Hits against you|Debuffs on you|Slowing Potency of Debuffs/i, "ailDef", null, true],
    [/Damage taken|you take|take \d+% (less|reduced)/i, "taken", null, true],
    [/Ailment Threshold|Freeze Threshold|Elemental Ailment Threshold/i, "ailDef"],
    [/Stun Threshold|Stun Recovery|Light Stun|Heavy Stun.*(you|threshold)/i, "stunDef"],
    [/maximum Energy Shield|Energy Shield Recharge|Energy Shield\b/i, "es"],
    [/Armour and Evasion|Evasion and Energy Shield|Armour and Energy Shield|Armour, Evasion and Energy Shield/i, "defMix"],
    [/Break .*Armour|Broken Armour/i, "quebra"],
    [/Armour/i, "armadura"],
    [/Deflect/i, "deflexao"],
    [/Evasion/i, "evasao"],
    [/Block/i, "bloqueio"],
    [/maximum Life|Life Regeneration|Regenerate .*Life|Life Recovery|Recouped as Life|Life Flask|\bLife\b.*per second/i, "vida"],
    [/Leech/i, "leech"],
    [/Resistances?\b/i, "res"],
    [/Mana (Regeneration|Recovery)|maximum Mana|Mana Flask|Mana Leech/i, "mana"],
    [/Cost|Costs?\b/i, "custo", null, true],
    [/Spirit|Reservation/i, "espirito"],
    [/Movement Speed/i, "movimento"],
    [/Flask|Charm/i, "frasco"],
    [/to (Strength|Dexterity|Intelligence|all Attributes|any Attribute)/i, "atributo"],
    [/Critical (Spell |Attack )?Damage Bonus/i, "critDano"],
    [/Critical (Hit )?Chance|Critical Strike Chance/i, "critChance"],
    [/Penetrat|Exposure/i, "pen"],
    [/Ignite|Flammability/i, "ignite"],
    [/Shock/i, "shock"],
    [/Freeze/i, "freeze"],
    [/Chill/i, "chill"],
    [/Electrocut/i, "electrocute"],
    [/Poison/i, "poison"],
    [/Bleed|Incision/i, "bleed"],
    [/Stun Buildup|\bDaze|Heavy Stun|Pin Buildup|Immobilis/i, "stun"],
    [/Ailment/i, "ailment"],
    [/Damage over Time/i, "dot"],
    [/Damage/i, "dano"],
    [/Attack Speed/i, "velAtaque"],
    [/Cast Speed/i, "velConj"],
    [/Skill Speed|Warcry Speed|Totem Placement speed/i, "velSkill"],
    [/Accuracy/i, "precisao"],
    [/Area of Effect/i, "aoe"],
    [/Projectile Speed|Projectiles?\b/i, "proj"],
    [/Skill Effect Duration|Duration/i, "duracao"],
    [/Cooldown Recovery/i, "cooldown"],
    [/Aura|Herald|Curse|Mark|Warcry|Archon|Infusion|Remnant|Glory|Rage|Charges?|Energy/i, "mecanica"]
  ];
  /* qualificadores (o que a linha exige da build) */
  const QUAL = [
    [/\bFire\b/, "fire", "el"], [/\bCold\b/, "cold", "el"], [/\bLightning\b/, "lightning", "el"], [/\bChaos\b/, "chaos", "el"], [/\bPhysical\b/, "physical", "el"], [/\bElemental\b/, "elemental", "el"],
    [/\bSpells?\b/i, "spell"], [/\bAttacks?\b/i, "attack"], [/\bProjectiles?\b/i, "projectile"], [/\bMelee\b/i, "melee"], [/\bArea\b/i, "area"],
    [/\bBows?\b|\bArrows?\b|\bQuivers?\b/i, "w:Bow"], [/\bBolts?\b|Ammunition/i, "w:Crossbow"], [/\bCrossbows?\b/i, "w:Crossbow"], [/\bSpears?\b/i, "w:Spear"], [/Quarterstaff|Quarterstaves/i, "w:Quarterstaff"], [/\bMaces?\b/i, "w:Mace"],
    [/\bTalismans?\b/i, "w:Talisman"], [/\bWands?\b/i, "w:Wand"], [/\bStaff\b|\bStaves\b/i, "w:Staff"], [/\bSceptres?\b/i, "w:Sceptre"], [/\bSwords?\b|\bAxes?\b|\bDaggers?\b|\bClaws?\b|\bFlails?\b/i, "w:nada"],
    [/Two Handed/i, "w:2h"], [/One Handed/i, "w:1h"], [/Unarmed/i, "w:Unarmed"], [/\bShields?\b/i, "w:Shield"], [/Dual Wield/i, "w:dual"],
    [/Empowered/i, "empowered"], [/Triggered/i, "trigger"], [/Channell?ing/i, "channelling"], [/Herald/i, "herald"], [/Warcr(y|ies)/i, "warcry"], [/\bSlams?\b/i, "slam"], [/\bStrikes?\b/i, "strike"],
    [/Grenades?/i, "grenade"], [/Hazards?/i, "hazard"], [/\bStorms?\b/i, "storm"], [/\bPlants?\b/i, "plant"], [/Remnants?/i, "remnant"], [/Invocat|Invoked/i, "invocation"], [/Shapeshift|\bBear\b|\bWolf\b|\bWyvern\b/i, "shapeshift"],
    [/Companions?/i, "companion"], [/\bMarks?\b/i, "mark"], [/Curses?\b|Hex/i, "curse"], [/\bAuras?\b/i, "aura"], [/Archon/i, "archon"], [/Infusion/i, "infusion"], [/Thorns/i, "thorns"], [/Parr(y|ied)/i, "parry"], [/\bRage\b/i, "rage"],
    [/Totems?|Ballista/i, "totem"], [/Meta Skills|Energy/i, "meta"], [/Surrounded/i, "melee"], [/Low Life/i, "lowlife"], [/Spirit/i, "persist"], [/Sprint/i, "sprint"], [/Presence/i, "presence"]
  ];
  const COND = /\bwhile\b|\bif\b|\bwhen\b|\brecently\b|that are\b|for each\b|\bper\b|\bevery\b/i;
  /* só contra um tipo de monstro: quase nunca vale o ponto */
  const RACA = /(against|on|to) (Demons?|Undead|Beasts?|Humanoids?|Constructs?|Eldritch)\b/i;

  const cacheLinha = new Map();
  function lerLinha(l) {
    let r = cacheLinha.get(l);
    if (r) return r;
    let cat = null, inv = false;
    for (const [rx, c, , iv] of REGRAS) if (rx.test(l)) { cat = c; inv = !!iv; break; }
    const m = l.match(/([+-]?\d+(?:\.\d+)?)/);
    const v = m ? Math.abs(parseFloat(m[1])) : 1;
    const neg = /\breduced\b|\bless\b/i.test(l) || (m && m[1][0] === "-");
    const q = [];
    for (const [rx, k, g] of QUAL) if (rx.test(l)) q.push([k, g]);
    const more = /\d+% more\b/i.test(l) && !neg;
    r = { cat, v, neg: inv ? !neg : neg, q, cond: COND.test(l), raca: RACA.test(l), more };
    cacheLinha.set(l, r);
    return r;
  }
  /* magnitude típica (mediana) por categoria, medida nos nós da árvore principal */
  const TIPICO = (() => {
    const vals = {};
    T.nos.forEach((n) => { if (n.a || !n.s) return; n.s.forEach((s) => s.split("\n").forEach((l) => { const r = lerLinha(l); if (r.cat && r.v > 0) (vals[r.cat] = vals[r.cat] || []).push(r.v); })); });
    const out = {};
    Object.entries(vals).forEach(([c, a]) => { a.sort((x, y) => x - y); out[c] = a[a.length >> 1] || 1; });
    return out;
  })();

  /* ---------------- perfil da build ---------------- */
  const DEF_CLASSE = {
    Warrior: { armadura: 1, evasao: 0.15, es: 0.1 }, Mercenary: { armadura: 0.8, evasao: 0.8, es: 0.1 }, Ranger: { armadura: 0.1, evasao: 1, es: 0.15 },
    Huntress: { armadura: 0.2, evasao: 1, es: 0.1 }, Monk: { armadura: 0.1, evasao: 0.8, es: 0.8 }, Sorceress: { armadura: 0.1, evasao: 0.1, es: 1 },
    Witch: { armadura: 0.1, evasao: 0.1, es: 1 }, Druid: { armadura: 0.8, evasao: 0.1, es: 0.8 }
  };
  const ARMAS_2M = /Bow|Crossbow|Quarterstaff|Two Hand|Staff|Talisman/;
  function perfil(b, prio) {
    const P = Mo.principal(b);
    const s = P ? P.s : null;
    const tg = new Set(s ? s.tg : []);
    const t = s ? s.t : "";
    const minion = t === "Minion" || tg.has("minion");
    const atk = !minion && (t === "Attack" || tg.has("attack"));
    const spell = !minion && (t === "Spell" || tg.has("spell"));
    const els = new Set(s ? Mo.elementos(s) : []);
    const elemental = ["fire", "cold", "lightning"].some((e) => els.has(e));
    const crit = Mo.buildCritica(b);
    const dot = !!s && (Mo.tiposDe(s).has("DamageOverTime") || /damage over time|per second/i.test(s.d || ""));
    const arma = b.arma || "";
    const off = b.offhand || "";
    const todos = new Set();
    (b.grupos || []).forEach((g) => { const x = Mo.SK.get(g.skill); if (x) x.tg.forEach((k) => todos.add(k)); });
    const def = Object.assign({ armadura: 0.4, evasao: 0.4, es: 0.4 }, DEF_CLASSE[b.classe] || {});
    if (b.defesa === "vida") Object.assign(def, { es: 0.05 });
    if (b.defesa === "es") Object.assign(def, { es: 1.2, armadura: 0.05, evasao: 0.05 });
    if (b.defesa === "armadura") Object.assign(def, { armadura: 1.1, evasao: 0.1 });
    if (b.defesa === "evasao") Object.assign(def, { evasao: 1.1, armadura: 0.1 });
    const p = Math.max(0, Math.min(1, prio == null ? 0.4 : prio));
    const fo = (1 - p) * 2, fd = p * 2;

    /* relevância de cada qualificador (0..1) */
    const Q = {
      fire: els.has("fire") ? 1 : 0, cold: els.has("cold") ? 1 : 0, lightning: els.has("lightning") ? 1 : 0, chaos: els.has("chaos") ? 1 : 0,
      physical: els.has("physical") ? 1 : 0, elemental: elemental ? 1 : 0,
      spell: spell ? 1 : 0, attack: atk ? 1 : 0, projectile: tg.has("projectile") ? 1 : 0, melee: tg.has("melee") ? 1 : 0, area: tg.has("area") ? 1 : 0.15,
      "w:Bow": /Bow/.test(arma) ? 1 : 0, "w:Crossbow": /Crossbow/.test(arma) ? 1 : 0, "w:Spear": /Spear/.test(arma) ? 1 : 0, "w:Quarterstaff": /Quarterstaff/.test(arma) ? 1 : 0,
      "w:Mace": /Mace/.test(arma) ? 1 : 0, "w:Talisman": /Talisman/.test(arma) ? 1 : 0, "w:Wand": /Wand/.test(arma) ? 1 : 0, "w:Staff": /^Staff/.test(arma) ? 1 : 0,
      "w:Sceptre": /Sceptre/.test(arma + off) ? 1 : 0, "w:nada": 0, "w:2h": ARMAS_2M.test(arma) && atk ? 1 : 0, "w:1h": arma && !ARMAS_2M.test(arma) && atk ? 1 : 0,
      "w:Unarmed": /Unarmed/.test(arma) ? 1 : 0, "w:Shield": /Shield|Buckler/.test(off) ? 1 : 0, "w:dual": 0,
      empowered: atk && tg.has("melee") ? 0.6 : 0.1, trigger: tg.has("trigger") || todos.has("meta") ? 1 : 0.1, channelling: tg.has("channelling") ? 1 : 0,
      herald: todos.has("herald") ? 1 : 0, warcry: todos.has("warcry") ? 1 : 0, slam: tg.has("slam") ? 1 : 0, strike: tg.has("strike") ? 1 : 0,
      grenade: tg.has("grenade") ? 1 : 0, hazard: tg.has("hazard") ? 1 : 0, storm: tg.has("storm") ? 1 : 0, plant: tg.has("plant") ? 1 : 0,
      remnant: tg.has("remnant") ? 1 : 0, invocation: tg.has("invocation") ? 1 : 0, shapeshift: tg.has("shapeshift") ? 1 : 0, companion: todos.has("companion") ? 1 : 0,
      mark: todos.has("mark") ? 1 : 0, curse: todos.has("curse") ? 1 : 0, aura: todos.has("aura") ? 1 : 0.2, archon: 0.3, infusion: tg.has("infusion") ? 1 : 0.2,
      thorns: 0, parry: /Shield|Buckler/.test(off) ? 0.4 : 0, rage: atk && tg.has("melee") ? 0.5 : 0, totem: todos.has("totem") ? 1 : 0, meta: todos.has("meta") ? 1 : 0.1,
      lowlife: 0.2, persist: todos.has("persistent") ? 0.8 : 0.3, sprint: 0.2, presence: 0.4
    };
    const proj = tg.has("projectile");
    /* peso de cada categoria */
    const W = {
      dano: 1 * fo, dot: dot ? 1 * fo : 0, critChance: (crit ? 1 : 0.1) * fo, critDano: (crit ? 0.9 : 0.05) * fo, pen: (elemental ? 0.9 : 0.1) * fo,
      velAtaque: atk ? 0.9 * fo : 0, velConj: spell ? 0.9 * fo : 0, velSkill: minion ? 0.2 * fo : 0.8 * fo, precisao: atk ? 0.45 * fo : 0,
      ignite: els.has("fire") ? 0.5 * fo : 0, shock: els.has("lightning") ? 0.55 * fo : 0, freeze: els.has("cold") ? 0.45 * fo : 0, chill: els.has("cold") ? 0.25 * fo : 0,
      electrocute: els.has("lightning") ? 0.35 * fo : 0, poison: els.has("chaos") && dot ? 0.6 * fo : 0.05, bleed: atk && els.has("physical") ? 0.35 * fo : 0,
      stun: tg.has("melee") ? 0.4 * fo : 0.1 * fo, ailment: 0.2 * fo, aoe: tg.has("area") ? 0.55 * fo : 0.05, proj: tg.has("projectile") ? 0.3 * fo : 0,
      duracao: tg.has("duration") ? 0.25 * fo : 0, cooldown: tg.has("trigger") || todos.has("meta") ? 0.35 * fo : 0.05, quebra: atk && els.has("physical") ? 0.3 * fo : 0,
      minion: minion ? 1.2 * fo : 0, companion: todos.has("companion") ? 1 * fo : 0, totem: todos.has("totem") ? 1 * fo : 0, mecanica: 0.15 * fo,
      minionDef: minion || todos.has("companion") ? 0.6 * fd : 0,
      vida: 1 * fd, es: def.es * fd, armadura: def.armadura * fd, evasao: def.evasao * fd, deflexao: def.evasao * 0.8 * fd, bloqueio: /Shield|Buckler/.test(off) ? 0.8 * fd : 0.05,
      defMix: Math.max(def.armadura, def.evasao, def.es) * 0.6 * fd, res: 0.6 * fd, leech: atk ? 0.5 * fd : 0.15 * fd, taken: 0.9 * fd, stunDef: 0.35 * fd, ailDef: 0.3 * fd,
      mana: spell ? 0.35 : 0.2, custo: 0.25, espirito: todos.has("persistent") ? 0.45 : 0.1, movimento: 0.45, frasco: 0.25 * fd, atributo: 0.3,
      projExtra: proj ? 5 * fo : 0, concede: 0.6, surge: spell ? 0.8 * fo : 0.1, pressa: 0.6 * fo, frenesi: atk ? 0.5 * fo : 0.1, poder: crit || spell ? 0.5 * fo : 0.1,
      resistencia: 0.4 * fd
    };
    const req = s ? s.req : [0, 0, 0];
    const attr = ["Strength", "Dexterity", "Intelligence"][req.indexOf(Math.max(...req))] || "Strength";
    return { s, tg, els, atk, spell, minion, crit, dot, def, Q, W, attr, prio: p };
  }

  /* ---------------- valor de um nó ---------------- */
  const KEYSTONE = {
    "Resolute Technique": (P) => P.atk && !P.crit ? 5 : 0,
    "Ancestral Bond": (P) => P.Q.totem ? 7 : 0,
    "Trusted Kinship": (P) => P.Q.companion ? 6 : 0,
    "Wildsurge Incantation": (P) => P.tg.has("storm") || P.tg.has("plant") ? 8 : 0,
    "Ritual Cadence": (P) => P.tg.has("invocation") ? 5 : 0,
    "Crimson Assault": (P) => P.W.bleed > 0.2 ? 4 : 0,
    "Hollow Palm Technique": (P) => P.Q["w:Unarmed"] ? 8 : 0,
    "Avatar of Fire": (P) => P.els.has("fire") && P.els.size === 1 ? 4 : 0,
    "Glancing Blows": (P) => P.def.evasao >= 1 && P.prio >= 0.5 ? 3 : 0,
    "Necromantic Talisman": (P) => P.minion ? 3 : 0,
    "Chaos Inoculation": (P) => P.def.es >= 1.2 ? 6 : 0,
    "Eldritch Battery": () => 0
  };
  function valorNo(n, P) {
    if (!n || n.t === "c" || n.t === "as") return { v: 0, por: [] };
    if (n.t === "k") { const f = KEYSTONE[n.n]; const v = f ? f(P) : 0; return { v, por: v ? [{ l: (n.s || []).join(" · "), v }] : [] }; }
    if (n.t === "j") return { v: 0.9, por: [{ l: "Encaixe de joia (uma joia boa rende muito por ponto)", v: 0.9 }] };
    if (n.t === "at") return { v: P.W.atributo, por: [{ l: "+5 de atributo (escolha " + P.attr + ")", v: P.W.atributo }] };
    let total = 0;
    const por = [];
    (n.s || []).forEach((st) => st.split("\n").forEach((l) => {
      const r = lerLinha(l);
      if (!r.cat) return;
      let w = P.W[r.cat] || 0;
      if (!w) return;
      if (r.cat === "atributo") {
        const quer = new RegExp(P.attr + "|all Attributes|any Attribute", "i").test(l);
        w = quer ? w * 1.2 : w * 0.4;
      }
      /* relevância pelos qualificadores: elementos = melhor deles; o resto multiplica */
      let rel = 1, elMax = -1;
      if (!["vida", "es", "armadura", "evasao", "deflexao", "res", "taken", "ailDef", "stunDef", "movimento", "atributo", "mana", "custo", "espirito", "frasco", "leech", "bloqueio", "defMix", "minionDef"].includes(r.cat)) {
        r.q.forEach(([k, g]) => {
          const x = P.Q[k] == null ? 1 : P.Q[k];
          if (g === "el") elMax = Math.max(elMax, x); else rel *= x;
        });
        if (elMax >= 0) rel *= elMax;
      } else if (r.q.some(([k]) => k === "w:Shield") && !P.Q["w:Shield"]) rel = 0.1;
      if (!rel) return;
      if (r.cond && rel < 1.01) rel *= 0.7;
      if (r.raca) rel *= 0.15;
      if (r.more) rel *= 2.5;
      const mag = ["projExtra", "concede", "surge", "pressa", "frenesi", "poder", "resistencia"].includes(r.cat) ? 1 : Math.max(0.25, Math.min(4, r.v / (TIPICO[r.cat] || 1)));
      const val = w * rel * mag * (r.neg ? -0.8 : 1);
      if (Math.abs(val) < 0.02) return;
      total += val;
      por.push({ l, v: val });
    }));
    por.sort((a, b) => b.v - a.v);
    return { v: total, por };
  }

  /* ---------------- grafo da build ---------------- */
  function grafoPrincipal(b) {
    const cl = CLASSE.get(b.classe);
    const ascId = (ASC.get(b.asc) || {}).id;
    const ok = (n) => n && !n.a && !n.p && (n.t !== "c" || (cl && n.i === cl.ini)) && (!n.u || n.u === ascId);
    return { ini: cl ? cl.ini : null, ok };
  }
  function grafoAsc(b) {
    const a = ASC.get(b.asc);
    if (!a) return null;
    const base = a.base || a.id;
    const ok = (n) => n && n.a === base && !n.p;
    return { ini: a.ini, ok, ov: a.ov || {} };
  }

  /* Dijkstra multi-origem: custo 1 por nó (menos um tiquinho se o nó vale algo, para preferir rotas boas) */
  function dijkstra(T0, ok, val, evitar, vmax) {
    const dist = new Map(), pai = new Map(), ganho = new Map(), saltos = new Map();
    const fila = [];
    const push = (id, d) => { fila.push([d, id]); let i = fila.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (fila[p][0] <= fila[i][0]) break; [fila[p], fila[i]] = [fila[i], fila[p]]; i = p; } };
    const pop = () => { const top = fila[0]; const last = fila.pop(); if (fila.length) { fila[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < fila.length && fila[l][0] < fila[m][0]) m = l; if (r < fila.length && fila[r][0] < fila[m][0]) m = r; if (m === i) break; [fila[m], fila[i]] = [fila[i], fila[m]]; i = m; } } return top; };
    T0.forEach((id) => { dist.set(id, 0); ganho.set(id, 0); saltos.set(id, 0); push(id, 0); });
    while (fila.length) {
      const [d, u] = pop();
      if (d > dist.get(u)) continue;
      for (const v of VIZ.get(u) || []) {
        if (T0.has(v) || evitar.has(v)) continue;
        const n = NO.get(v);
        if (!ok(n)) continue;
        const vv = val.get(v) || 0;
        const c = vv >= 0 ? 1 - 0.25 * Math.min(1, vv / vmax) : 1 + Math.min(3, -vv);
        const nd = d + c;
        if (nd < (dist.has(v) ? dist.get(v) : Infinity)) {
          dist.set(v, nd); pai.set(v, u); ganho.set(v, ganho.get(u) + (val.get(v) || 0)); saltos.set(v, saltos.get(u) + 1);
          push(v, nd);
        }
      }
    }
    return { dist, pai, ganho, saltos };
  }
  function caminhoAte(pai, T0, alvo) {
    const out = [];
    let x = alvo;
    while (x != null && !T0.has(x)) { out.push(x); x = pai.get(x); }
    return out.reverse();
  }

  /* guloso com orçamento; `fixos` entram primeiro (do mais perto ao mais longe) */
  function guloso(T0, ok, val, orc, evitar, fixos, alvosPermitidos, expo) {
    const ex = expo || 0.85;
    const T1 = new Set(T0);
    const ordem = [], picks = [];
    let usados = 0;
    const vmax = Math.max(1, ...[...val.values()]);
    const pend = new Set([...fixos].filter((id) => !T1.has(id)));
    for (let guarda = 0; guarda < 400 && usados < orc; guarda++) {
      const D = dijkstra(T1, ok, val, evitar, vmax);
      let melhor = null, melhorR = 0;
      if (pend.size) {
        for (const id of pend) {
          const h = D.saltos.get(id);
          if (h == null || usados + h > orc) continue;
          if (!melhor || h < melhorR) { melhor = id; melhorR = h; }
        }
        if (melhor != null) pend.delete(melhor); else pend.clear();
      }
      if (melhor == null) {
        melhorR = 0;
        for (const [id, g] of D.ganho) {
          const h = D.saltos.get(id);
          if (!h || usados + h > orc || g <= 0) continue;
          if (alvosPermitidos && !alvosPermitidos.has(id)) continue;
          const r = g / Math.pow(h, ex);
          if (r > melhorR) { melhorR = r; melhor = id; }
        }
        if (melhor == null || melhorR < 0.05) break;
      }
      const cam = caminhoAte(D.pai, T1, melhor);
      if (!cam.length) break;
      cam.forEach((id) => { T1.add(id); ordem.push(id); });
      picks.push({ alvo: melhor, nos: cam });
      usados += cam.length;
    }
    return { T: T1, ordem, usados, picks };
  }
  const somaV = (ids, val) => { let s = 0; ids.forEach((id) => { s += val.get(id) || 0; }); return s; };

  /* troca de galhos: tira o galho-folha de pior razão e deixa o guloso gastar de novo */
  function melhorar(T0, ok, val, orc, evitar, fixos, res) {
    let atual = res;
    for (let it = 0; it < 12; it++) {
      const T1 = new Set(atual.T);
      const grau = (id) => (VIZ.get(id) || []).filter((v) => T1.has(v)).length;
      let pior = null, piorR = Infinity;
      atual.ordem.forEach((id) => {
        if (T0.has(id) || fixos.has(id) || grau(id) !== 1) return;
        const galho = [];
        let x = id, ant = null;
        for (;;) {
          if (T0.has(x) || fixos.has(x)) break;
          galho.push(x);
          const viz = (VIZ.get(x) || []).filter((v) => T1.has(v) && v !== ant);
          if (viz.length !== 1) break;
          ant = x; x = viz[0];
          if (grau(x) > 2) break;
        }
        const r = somaV(galho, val) / galho.length;
        if (galho.length && r < piorR) { piorR = r; pior = galho; }
      });
      if (!pior) break;
      const sem = new Set(atual.T); pior.forEach((id) => sem.delete(id));
      const evit2 = new Set(evitar); pior.forEach((id) => evit2.add(id));
      const novo = guloso(sem, ok, val, orc - (atual.usados - pior.length), evit2, new Set(), null);
      const vA = somaV(atual.T, val), vN = somaV(novo.T, val);
      if (vN <= vA + 0.01) break;
      const ordem = atual.ordem.filter((id) => novo.T.has(id)).concat(novo.ordem);
      atual = { T: novo.T, ordem, usados: atual.usados - pior.length + novo.usados };
    }
    return atual;
  }

  /* passos legíveis: cada escolha do guloso vira um passo; escolhas pequenas seguidas
     (só nós simples) se juntam; o rótulo é o nó mais importante do passo */
  const MARCO = (n) => n && (n.t === "n" || n.t === "k" || n.t === "j");
  function montarPassos(picks, ini0, val) {
    const passos = [];
    let ponto = ini0;
    picks.forEach((pk) => {
      const u = passos[passos.length - 1];
      const temMarco = pk.nos.some((id) => MARCO(NO.get(id)));
      if (u && !u.marco && !temMarco && u.nos.length + pk.nos.length <= 5) u.nos = u.nos.concat(pk.nos);
      else passos.push({ nos: pk.nos.slice(), marco: temMarco });
    });
    passos.forEach((p) => {
      const marcos = p.nos.filter((id) => MARCO(NO.get(id)));
      const cand = marcos.length ? marcos : p.nos;
      p.alvo = cand.reduce((a, b) => ((val.get(b) || 0) > (val.get(a) || 0) ? b : a), cand[cand.length - 1]);
      p.de = ponto + 1; p.ate = ponto + p.nos.length; ponto = p.ate;
    });
    return passos;
  }

  function valores(P, ok, ov) {
    const val = new Map(), por = new Map();
    T.nos.forEach((n) => {
      if (!ok(n)) return;
      const m = ov && ov[n.i] ? Object.assign({}, n, ov[n.i]) : n;
      const r = valorNo(m, P);
      let v = r.v;
      if (m.a && m.t === "n") v += 1.5;
      if (m.pp) v = Math.max(v, 1.2);
      val.set(n.i, v); por.set(n.i, r.por);
    });
    return { val, por };
  }

  function calcular(b, opt) {
    opt = opt || {};
    const P = perfil(b, opt.prioridade != null ? opt.prioridade : b.prioridade);
    const out = { perfil: P, valores: new Map(), motivos: new Map() };
    const g = grafoPrincipal(b);
    if (g.ini != null) {
      const { val, por } = valores(P, g.ok);
      val.set(g.ini, 0);
      const orc = pontosNoNivel(opt.nivel || b.nivelAlvo || 100);
      const fixos = new Set((b.planoFixos || []).filter((id) => g.ok(NO.get(id))));
      const evitar = new Set(b.planoEvitar || []);
      /* só vale o que está ligado ao início da classe (ilhas soltas são ignoradas) */
      const marc = new Set((b.nosAtuais || []).filter((id) => g.ok(NO.get(id))));
      const atuais = [];
      const fila = [g.ini], visto = new Set([g.ini]);
      while (fila.length) { const u = fila.shift(); for (const v of VIZ.get(u) || []) if (marc.has(v) && !visto.has(v)) { visto.add(v); atuais.push(v); fila.push(v); } }
      const T0 = new Set([g.ini, ...atuais]);
      let r = guloso(T0, g.ok, val, Math.max(0, orc - atuais.length), evitar, fixos, null);
      r = melhorar(T0, g.ok, val, Math.max(0, orc - atuais.length), evitar, fixos, r);
      /* reordena: refaz o guloso só dentro do conjunto final → ordem de quem rende mais primeiro */
      const final = new Set(r.T);
      const okFinal = (n) => n && final.has(n.i);
      const ord = guloso(T0, okFinal, val, r.usados, new Set(), fixos, null, 1.15);
      const resto = r.ordem.filter((id) => !ord.T.has(id) && !T0.has(id));
      const ordem = ord.ordem.concat(resto);
      const picks = ord.picks.concat(resto.length ? [{ alvo: resto[resto.length - 1], nos: resto }] : []);
      out.arvore = { ini: g.ini, atuais, ordem, passos: montarPassos(picks, atuais.length, val), pontos: orc, usados: atuais.length + ordem.length, valor: somaV(final, val) };
      val.forEach((v, k) => out.valores.set(k, v)); por.forEach((v, k) => out.motivos.set(k, v));
    }
    const ga = grafoAsc(b);
    if (ga && ga.ini != null) {
      const { val, por } = valores(P, ga.ok, ga.ov);
      const fixos = new Set((b.ascFixos || []).filter((id) => ga.ok(NO.get(id))));
      const r = guloso(new Set([ga.ini]), ga.ok, val, K.pontosAscendencia, new Set(b.ascEvitar || []), fixos, null);
      out.asc = { ini: ga.ini, ordem: r.ordem, passos: montarPassos(r.picks, 0, val), pontos: K.pontosAscendencia, ov: ga.ov };
      val.forEach((v, k) => out.valores.set(k, v)); por.forEach((v, k) => out.motivos.set(k, v));
    }
    return out;
  }

  /* nomes de keystones/notáveis/nós de ascendência do plano (o motor de análise usa nomes) */
  function nomesDoPlano(res) {
    const ks = [], nt = [], asc = [];
    if (res.arvore) res.arvore.atuais.concat(res.arvore.ordem).forEach((id) => { const n = NO.get(id); if (!n) return; if (n.t === "k") ks.push(n.n); else if (n.t === "n") nt.push(n.n); });
    if (res.asc) res.asc.ordem.forEach((id) => { const n = NO.get(id); const o = (res.asc.ov || {})[id]; const m = o ? Object.assign({}, n, o) : n; if (m && m.t === "n") asc.push(m.n); });
    return { keystones: ks, notaveis: nt, ascNos: asc };
  }

  window.Caminho = { calcular, perfil, valorNo, pontosNoNivel, nivelDoPonto, nomesDoPlano, NO, VIZ, ASC, CLASSE, TIPICO, lerLinha };
})();
