/* ============================================================
   Exile Compass — DIAGNÓSTICO da build (o coração do app)
   ------------------------------------------------------------
   Build de PoE é resolução de problemas: a partir da ETAPA do
   jogo, dos SINTOMAS ("morro muito", "chefe demora"…) e do que
   os prints mostram, encontra as fraquezas, mede cada uma com
   um número e diz como resolver NAQUELA etapa.
   Só afirma o que vem de dado:
     · regras e números do jogo (PoB2, exportação da GGG, RePoE):
       teto de resistência 75%, penalidade por ato, nível de gema
       × nível de personagem, dano-base por nível de gema, runas,
       charms, nós da árvore perto de você;
     · o que os jogadores que estão indo bem usam (poe.ninja,
       kb/ref.js): suportes, buffs, ascendência, vida/ES/DPS por
       etapa;
     · as regras do motor.js (compatibilidade de suportes etc.).
   ============================================================ */
(function () {
  "use strict";
  const J = window.KB_JOGO, Mo = window.Motor, REF = window.KB_REF || { skills: {}, geral: {}, etapas: [] };
  const RUN = window.KB_RUNAS || { runas: [], charms: [] };
  const CMB = window.KB_COMBOS || { asc: {} };
  const T = window.KB_TREE, CAM = window.Caminho;
  const K = J.consts;
  const RES_MAX = K.resMax || 75;

  const ETAPAS = (REF.etapas && REF.etapas.length ? REF.etapas : [
    { id: "a1", n: "Ato 1", area: [1, 15], nivel: [1, 17], penal: 0 },
    { id: "a2", n: "Ato 2", area: [16, 31], nivel: [14, 33], penal: -10 },
    { id: "a3", n: "Ato 3", area: [33, 45], nivel: [30, 47], penal: -20 },
    { id: "a4", n: "Ato 4", area: [46, 53], nivel: [44, 55], penal: -30 },
    { id: "int", n: "Interlúdios", area: [54, 64], nivel: [52, 66], penal: -50 },
    { id: "m1", n: "Mapas T1–T5", area: [65, 69], nivel: [64, 76], penal: -60 },
    { id: "m2", n: "Mapas T6–T10", area: [70, 74], nivel: [72, 84], penal: -60 },
    { id: "m3", n: "Mapas T11–T15", area: [75, 79], nivel: [80, 92], penal: -60 },
    { id: "m4", n: "Chefes / T16", area: [80, 83], nivel: [88, 100], penal: -60 }
  ]);
  const ETAPA = new Map(ETAPAS.map((e) => [e.id, e]));
  const ORDEM = ETAPAS.map((e) => e.id);
  const campanha = (id) => ["a1", "a2", "a3", "a4", "int"].includes(id);
  function etapaPorNivel(nv) {
    const c = ETAPAS.filter((e) => nv >= e.nivel[0] && nv <= e.nivel[1]);
    return c.length ? c.sort((a, b) => (a.nivel[1] - a.nivel[0]) - (b.nivel[1] - b.nivel[0]))[0].id : "m1";
  }

  const SINTOMAS = [
    { id: "morro", n: "Morro muito", area: ["defesa", "recup"] },
    { id: "oneshot", n: "Morro de um golpe", area: ["defesa"] },
    { id: "chefe", n: "Chefe demora a morrer", area: ["dano"] },
    { id: "clear", n: "Limpo devagar", area: ["dano", "clear"] },
    { id: "mana", n: "Fico sem mana", area: ["mana"] },
    { id: "stun", n: "Fico atordoado", area: ["stun"] },
    { id: "ailment", n: "Congelado / eletrocutado / envenenado", area: ["ailment"] },
    { id: "melhorar", n: "Só quero melhorar", area: [] }
  ];
  const SINT = new Map(SINTOMAS.map((s) => [s.id, s]));

  /* ---------------- helpers ---------------- */
  const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
  const pct = (x) => Math.round(x) + "%";
  const ELS = [["resFogo", "fogo", "Fire", "Ruby Charm"], ["resFrio", "gelo", "Cold", "Sapphire Charm"], ["resRaio", "raio", "Lightning", "Topaz Charm"]];
  const RUNA_TIPO = { resFogo: "fogo", resFrio: "frio", resRaio: "raio", resCaos: "caos" };
  function melhorRuna(tipo, nivel) {
    const r = RUN.runas.filter((x) => x.tipo === tipo && (x.nv || 0) <= nivel).sort((a, b) => b.val - a.val)[0];
    const prox = RUN.runas.filter((x) => x.tipo === tipo && (x.nv || 0) > nivel).sort((a, b) => a.nv - b.nv)[0];
    return { r, prox };
  }
  function charm(contra) { return RUN.charms.find((c) => c.contra === contra); }
  const temSint = (ctx, id) => ctx.sintomas.has(id);
  function fatorSint(ctx, area) {
    let f = 1;
    ctx.sintomas.forEach((s) => { const d = SINT.get(s); if (d && d.area.includes(area)) f *= s === "oneshot" && area === "defesa" ? 1.5 : 1.35; });
    return f;
  }

  /* referência (poe.ninja) para a skill na etapa; cai para a etapa vizinha com dados */
  function refDe(skill, etapa) {
    const s = REF.skills && REF.skills[skill];
    if (!s) return null;
    const i = ORDEM.indexOf(etapa);
    const ordemBusca = [i, i - 1, i + 1, i - 2, i + 2].filter((k) => k >= 0 && k < ORDEM.length).map((k) => ORDEM[k]);
    let dims = null, st = null, etDims = null, etSt = null;
    for (const id of ordemBusca) {
      const e = s.etapas[id]; if (!e) continue;
      if (!dims && e.sup && e.sup.length) { dims = e; etDims = id; }
      if (!st && e.st) { st = e.st; etSt = id; }
      if (dims && st) break;
    }
    return { skill, total: s.n, ascGeral: s.asc, dims, st, etDims, etSt };
  }
  function refGeral(etapa) {
    const i = ORDEM.indexOf(etapa);
    for (const k of [i, i - 1, i + 1, i - 2, i + 2]) { const id = ORDEM[k]; if (id && REF.geral && REF.geral[id]) return { st: REF.geral[id], et: id }; }
    return null;
  }

  /* nós da árvore perto do que você já tem (ou do início da classe) que casam com um padrão */
  function nosPerto(b, rx, max) {
    const cl = CAM && CAM.CLASSE.get(b.classe);
    if (!cl) return [];
    const ascId = (CAM.ASC.get(b.asc) || {}).id;
    const ok = (n) => n && !n.a && !n.p && (n.t !== "c" || n.i === cl.ini) && (!n.u || n.u === ascId);
    const tem = new Set([cl.ini, ...(b.nosAtuais || [])]);
    if (b.plano && b.plano.ordem && !(b.nosAtuais || []).length) {
      const pts = CAM.pontosNoNivel(b.nivel || 1);
      b.plano.ordem.slice(0, pts).forEach((id) => tem.add(id));
    }
    const dist = new Map(); const fila = [];
    tem.forEach((id) => { dist.set(id, 0); fila.push(id); });
    while (fila.length) {
      const u = fila.shift(); const d = dist.get(u);
      if (d >= 8) continue;   /* mais longe que isso não é conselho prático */
      for (const v of CAM.VIZ.get(u) || []) { if (dist.has(v)) continue; const n = CAM.NO.get(v); if (!ok(n)) continue; dist.set(v, d + 1); fila.push(v); }
    }
    const out = [];
    dist.forEach((d, id) => {
      if (!d) return;
      const n = CAM.NO.get(id);
      const linhas = (n.s || []).flatMap((x) => x.split("\n"));
      const l = linhas.find((x) => rx.test(x));
      if (!l) return;
      const m = l.match(/([+-]?\d+(?:\.\d+)?)/);
      out.push({ n, d, l, v: m ? Math.abs(parseFloat(m[1])) : 1 });
    });
    out.sort((a, b) => (b.v / b.d) - (a.v / a.d) || a.d - b.d);
    return out.slice(0, max || 2);
  }
  const textoNo = (x) => `${x.n.n} (${x.l}) — a ${x.d} ${x.d === 1 ? "ponto" : "pontos"} do que você tem`;

  /* nível máximo de gema que o personagem pode usar + ganho de dano até lá */
  function nivelGema(s, nvPersonagem) {
    if (!s || !s.lv) return null;
    let max = 1;
    s.lv.forEach(([req], i) => { if (req <= nvPersonagem) max = i + 1; });
    return max;
  }
  function ganhoDano(s, de, para) {
    if (!s || !s.lv || !s.lv[de - 1] || !s.lv[para - 1]) return null;
    const a = s.lv[de - 1][1], b = s.lv[para - 1][1];
    if (!a || !b) return null;
    return (b / a - 1) * 100;
  }
  /* arma do app → modo de arma do poe.ninja ("Bow / Quiver", "Mace / Shield", "Two Handed Mace"…) */
  const NINJA_ARMA = { "One Hand Mace": "Mace", "Two Hand Mace": "Two Handed Mace", "One Hand Sword": "Sword", "Two Hand Sword": "Two Handed Sword",
    "One Hand Axe": "Axe", "Two Hand Axe": "Two Handed Axe" };
  function modoArma(b) {
    if (!b.arma) return "";
    const a = NINJA_ARMA[b.arma] || b.arma;
    const o = b.offhand ? (NINJA_ARMA[b.offhand] || b.offhand) : "";
    return o ? a + " / " + o : a;
  }
  /* quantos jogadores daquela ascendência usam a arma/skill (liga atual) */
  function uso(asc, tipo, nome) {
    const c = CMB.asc && CMB.asc[asc];
    if (!c) return null;
    const lst = tipo === "arma" ? c.arma : c.sk;
    const x = lst.find(([n]) => n === nome);
    return { n: x ? x[1] : 0, de: c.n, pct: x ? 100 * x[1] / c.n : 0, top: lst.slice(0, 3) };
  }
  const famDe = (n) => { const x = Mo.SU.get(n); return x ? x.fam : n.replace(/\s+(I{1,3}|IV|V)$/, ""); };

  /* ================= DIAGNÓSTICO ================= */
  function diagnosticar(b) {
    const etapa = b.etapa || etapaPorNivel(b.nivel || 1);
    const E = ETAPA.get(etapa) || ETAPAS[0];
    const ctx = { b, etapa, E, sintomas: new Set(b.sintomas || []) };
    const P = Mo.principal(b);
    const s = P && P.s;
    const st = b.stats || {};
    const nv = +b.nivel || E.nivel[0];
    const ref = s ? refDe(s.n, etapa) : null;
    const rg = refGeral(etapa);
    const probs = [], bons = [], faltam = [];
    const add = (p) => probs.push(p);
    const fEtapa = { a1: 0.55, a2: 0.75, a3: 0.9 }[etapa] || 1;

    /* ---------- 1. resistências elementais ---------- */
    let algumaRes = false;
    ELS.forEach(([k, pt, en, charmNome]) => {
      if (st[k] == null || st[k] === "") return;
      algumaRes = true;
      const r = +st[k];
      if (r >= RES_MAX) { bons.push(`Resistência a ${pt} no máximo (${r}%)`); return; }
      const falta = RES_MAX - r;
      const mult = (100 - r) / (100 - RES_MAX);
      const sev = Math.min(96, (18 + falta * 1.25) * fEtapa * fatorSint(ctx, "defesa"));
      const passos = [];
      passos.push(`Equipamento: procure "+% to ${en} Resistance" em anéis, amuleto, cinto, botas, luvas e elmo — é o jeito mais barato de subir resistência.`);
      const { r: runa, prox } = melhorRuna(RUNA_TIPO[k], nv);
      if (runa) passos.push(`Runa: ${runa.n} num soquete de armadura dá +${runa.val}% (${runa.nv ? "pede nível " + runa.nv : "sem nível mínimo"}).${prox ? ` No nível ${prox.nv}: ${prox.n} (+${prox.val}%).` : ""}`);
      const nos = nosPerto(b, new RegExp(`^\\+\\d+% to (${en}|all Elemental) Resistances?$`, "i"), 1);
      if (nos.length) passos.push("Árvore: " + textoNo(nos[0]) + ".");
      const ch = RUN.charms.find((c) => c.n === charmNome);
      if (ch && (temSint(ctx, "oneshot") || temSint(ctx, "morro"))) passos.push(`Enquanto isso: um ${ch.n} (cai a partir do nível ${ch.nv}) ativa sozinho quando você toma ${ch.pt}.`);
      if (campanha(etapa) && etapa !== "int") passos.push(`Atenção: ao matar o chefe do ${E.n} você perde mais 10% em todas as resistências — chegue ao próximo ato com folga.`);
      add({
        id: "res-" + k, area: "defesa", sev,
        tit: `Resistência a ${pt}: ${r}%`,
        num: `faltam ${falta}% para o máximo (${RES_MAX}%)`,
        pq: `Com ${r}% você toma ${mult.toFixed(1).replace(".", ",")}× o dano de ${pt} de quem está no máximo (${100 - r}% contra ${100 - RES_MAX}% do dano passa). ` +
          (E.penal ? `O número do jogo já desconta a penalidade desta etapa (${E.penal}%).` : ""),
        passos, fonte: "Regra do jogo: resistência máxima 75%; penalidade de −10% por chefe de ato, −60% no endgame."
      });
    });
    if (!algumaRes) faltam.push({ id: "res", t: "Resistências", como: "print da tela de Personagem (aba de defesas)" });

    /* caos: só pesa no endgame */
    if (st.resCaos != null && st.resCaos !== "" && !campanha(etapa) && +st.resCaos < 0) {
      const r = +st.resCaos;
      const passos = [`Equipamento: "+% to Chaos Resistance" em anéis, amuleto e cinto.`];
      const { r: runa } = melhorRuna("caos", nv); if (runa) passos.push(`${runa.n} num soquete de armadura: +${runa.val}%.`);
      const nos = nosPerto(b, /^\+\d+% to Chaos Resistance$/i, 1); if (nos.length) passos.push("Árvore: " + textoNo(nos[0]) + ".");
      add({ id: "res-caos", area: "defesa", sev: Math.min(55, 15 + -r * 0.6) * fatorSint(ctx, "defesa"), tit: `Resistência a caos: ${r}%`,
        num: "abaixo de 0%", pq: `Resistência negativa aumenta o dano de caos que você toma (${100 - r}% passa). No endgame há muito dano de caos.`, passos, fonte: "Regra do jogo." });
    }

    /* ---------- 2. vida + ES contra quem joga a mesma skill nessa etapa ---------- */
    const vida = +st.vida || 0, es = +st.es || 0;
    const refSt = (ref && ref.st) || (rg && rg.st);
    if (vida || es) {
      const pool = vida + es;
      const q = refSt && (refSt.pool || refSt.vida);
      if (q) {
        const [p25, p50] = q;
        const quem = ref && ref.st ? `jogadores de ${s.n}` : "jogadores";
        const etq = ETAPA.get((ref && ref.st ? ref.etSt : rg && rg.et) || etapa);
        if (pool < p25) {
          const passos = [];
          passos.push(`Equipamento: "+ to maximum Life" na armadura do corpo, elmo, cinto, luvas, botas e anéis${b.classe === "Sorceress" || b.classe === "Witch" ? ' — ou "+ to maximum Energy Shield" se você usa peças de inteligência' : ""}.`);
          const { r: runa, prox } = melhorRuna("vida", nv);
          if (runa) passos.push(`${runa.n} num soquete de armadura: +${runa.val} de vida${prox ? ` (no nível ${prox.nv}: ${prox.n}, +${prox.val})` : ""}.`);
          const nos = nosPerto(b, /^\d+% increased maximum (Life|Energy Shield)$|^\+\d+ to maximum (Life|Energy Shield)$/i, 1);
          if (nos.length) passos.push("Árvore: " + textoNo(nos[0]) + ".");
          add({ id: "pool", area: "defesa", sev: Math.min(92, (35 + 55 * (1 - pool / p50)) * fatorSint(ctx, "defesa")),
            tit: `Vida${es ? " + ES" : ""}: ${fmt(pool)}`,
            num: `metade dos ${quem} tem ${fmt(p50)} ou mais`,
            pq: `Na etapa ${etq ? etq.n : E.n}, 75% dos ${quem} que estavam na frente da liga tinham mais de ${fmt(p25)}${refSt.pool ? " de vida + ES" : " de vida"}. Com menos, qualquer golpe forte vira morte.`,
            passos, fonte: `${REF.fonte || "poe.ninja"} — ${refSt.n} personagens nessa faixa de nível.` });
        } else bons.push(`Vida${es ? " + ES" : ""} (${fmt(pool)}) dentro do normal para a etapa`);
      }
    } else faltam.push({ id: "vida", t: "Vida / ES", como: "print da tela de Personagem" });

    /* ---------- 3. nível da gema principal ---------- */
    (b.grupos || []).filter((g) => g.skill && g.nv).slice(0, 4).forEach((g) => {
      const sk = Mo.SK.get(g.skill); if (!sk || !sk.lv) return;
      const max = nivelGema(sk, nv);
      if (!max || +g.nv >= max - 1) { if (P && g === P.g) bons.push(`${sk.n} no nível certo (${g.nv})`); return; }
      const ganho = ganhoDano(sk, +g.nv, max);
      const principal = P && g === P.g;
      const sev = Math.min(principal ? 90 : 55, (max - g.nv) * (principal ? 16 : 9) * fatorSint(ctx, "dano"));
      add({ id: "gema-" + sk.n, area: "dano", sev,
        tit: `${sk.n} no nível ${g.nv}`, num: `no nível ${nv} dá para usar o nível ${max}`,
        pq: (ganho != null ? `Do nível ${g.nv} para o ${max} o dano-base da skill sobe ${Math.round(ganho)}% (tabela da gema). ` : "") +
          "Na campanha o nível da gema é a maior fonte de dano de uma skill.",
        passos: [`Use uma Uncut Skill Gem de nível ${max} (ou mais) na sua ${sk.n} — o nível da gema não lapidada depende do nível da área onde ela cai.`,
          `Requisito: gema nível ${max} pede personagem nível ${sk.lv[max - 1][0]}.`],
        fonte: "Dados da gema (Path of Building 2): requisito e dano por nível." });
    });
    if (P && !P.g.nv) faltam.push({ id: "nvgema", t: `Nível da ${P.s.n}`, como: "print da tela de Skills (ou digite)" });

    /* ---------- 4. suportes contra quem joga a mesma skill ---------- */
    if (P && ref && ref.dims && ref.dims.sup && ref.dims.sup.length) {
      const meus = new Set((P.g.sup || []).map(famDe));
      const usados = ref.dims.sup.filter(([n]) => { const su = Mo.SU.get(n); return su && Mo.compativel(su, P.s); });
      const faltando = usados.filter(([n, p]) => p >= 30 && !meus.has(famDe(n)));
      const raros = (P.g.sup || []).filter((n) => !ref.dims.sup.some(([m]) => famDe(m) === famDe(n)));
      const incompat = (P.g.sup || []).filter((n) => { const su = Mo.SU.get(n); return su && !Mo.compativel(su, P.s); });
      const tierAbaixo = (P.g.sup || []).map((n) => {
        const su = Mo.SU.get(n); if (!su) return null;
        const alvo = usados.find(([m, p]) => famDe(m) === su.fam && p >= 25 && ((Mo.SU.get(m) || {}).nv || 0) > (su.nv || 0));
        return alvo ? [n, alvo[0], alvo[1]] : null;
      }).filter(Boolean);
      const etq = ETAPA.get(ref.etDims);
      if (incompat.length) {
        add({ id: "sup-incompat", area: "dano", sev: 75 * fatorSint(ctx, "dano"), tit: `${incompat.length === 1 ? "Suporte que não funciona" : incompat.length + " suportes que não funcionam"} em ${P.s.n}`,
          num: incompat.join(", "), pq: "O jogo ignora suporte incompatível com a skill: é um espaço desperdiçado.",
          passos: [`Tire ${incompat.join(" e ")} e coloque ${faltando[0] ? faltando[0][0] + ` (usado por ${faltando[0][1]}%)` : "um suporte que funcione"}.`], fonte: "Regras de compatibilidade das gemas (Path of Building 2)." });
      }
      if (faltando.length || tierAbaixo.length) {
        const trocas = [];
        faltando.slice(0, 3).forEach(([n, p], i) => {
          const sai = raros[i];
          trocas.push(sai ? `Troque ${sai} (quase ninguém usa) por ${n} — ${p}% dos jogadores usam.` : `Adicione ${n} — ${p}% dos jogadores usam.`);
        });
        tierAbaixo.slice(0, 2).forEach(([meu, melhor, p]) => trocas.push(`Suba ${meu} para ${melhor} (${p}% já usam a versão mais forte nessa etapa).`));
        if ((P.g.sup || []).length < 5) trocas.push(`Você usa ${(P.g.sup || []).length} suporte(s); a gema aceita até 5 — Jeweller's Orbs abrem mais soquetes na gema.`);
        add({ id: "sup-ref", area: "dano", sev: Math.min(70, (25 + (faltando[0] ? faltando[0][1] * 0.45 : 10)) * fatorSint(ctx, "dano")),
          tit: `Suportes da ${P.s.n} diferentes de quem joga ela`,
          num: faltando.length ? `falta${faltando.length > 1 ? "m" : ""}: ${faltando.slice(0, 3).map(([n, p]) => `${n} (${p}%)`).join(", ")}` : "suportes de tier mais baixo",
          pq: `Entre os ${ref.dims.n} jogadores de ${P.s.n} na etapa ${etq ? etq.n : ""} (os primeiros da liga nesse momento), estes são os suportes mais ligados à skill. Não é obrigatório copiar — mas se o seu dano está fraco, comece por aqui.`,
          passos: trocas, fonte: `${REF.fonte || "poe.ninja"} — ${ref.dims.n} personagens (${ref.dims.m}).`,
          lista: usados.slice(0, 8).map(([n, p]) => ({ n, p, tem: meus.has(famDe(n)) })) });
      } else if ((P.g.sup || []).length) bons.push(`Suportes da ${P.s.n} parecidos com os de quem joga ela`);
    } else if (P && !(P.g.sup || []).length) {
      add({ id: "sup-vazio", area: "dano", sev: 60 * fatorSint(ctx, "dano"), tit: `${P.s.n} sem suportes`, num: "0 de 5",
        pq: "Cada suporte é um multiplicador de dano ou utilidade — sem eles a skill rende uma fração do que pode.",
        passos: Mo.recomendarSuportes(P.s, b, 3).map((n) => `Coloque ${n}.`), fonte: "Regras do motor (vetores de dano + compatibilidade)." });
    }

    /* ---------- 5. buffs de espírito ---------- */
    if (P && ref && ref.dims && ref.dims.esp && ref.dims.esp.length) {
      const meus = new Set((b.grupos || []).map((g) => g.skill));
      const top = ref.dims.esp.filter(([n, p]) => p >= 40 && !meus.has(n) && Mo.SK.has(n)).slice(0, 2);
      if (top.length) {
        const custo = top.map(([n]) => (Mo.SK.get(n) || {}).sp).filter(Boolean);
        add({ id: "espirito", area: "dano", sev: 30 * fatorSint(ctx, "dano"), tit: "Buff que quase todo mundo usa",
          num: top.map(([n, p]) => `${n} (${p}%)`).join(", "),
          pq: `Buffs persistentes reservam espírito e ficam ligados o tempo todo. ${top[0][1]}% dos jogadores de ${P.s.n} nessa etapa usam ${top[0][0]}.`,
          passos: [`Ative ${top[0][0]}${custo[0] ? ` (reserva ${custo[0]} de espírito)` : ""}${st.espirito ? `; você tem ${st.espirito} de espírito no total` : ""}.`, "Espírito vem das missões dos atos e de cetros/armaduras com espírito."],
          fonte: `${REF.fonte || "poe.ninja"}.` });
      }
    }

    /* ---------- 6. ascendência ---------- */
    const ptsAscEsperado = { a1: 0, a2: 2, a3: 4, a4: 4, int: 4, m1: 4, m2: 6, m3: 8, m4: 8 }[etapa] || 0;
    if (b.ascPts != null && +b.ascPts < ptsAscEsperado) {
      const prox = +b.ascPts < 2 ? "Trial of the Sekhemas (Ato 2)" : +b.ascPts < 4 ? "Trial of Chaos (Ato 3)" : "as provações de nível mais alto do endgame";
      add({ id: "asc", area: "dano", sev: 58, tit: `Ascendência: ${b.ascPts} de ${ptsAscEsperado} pontos possíveis`, num: `faltam ${ptsAscEsperado - b.ascPts} pontos`,
        pq: "Os nós de ascendência estão entre os mais fortes do personagem: 2 pontos por provação.", passos: [`Faça ${prox}: +2 pontos de ascendência.`],
        fonte: "Regra do jogo: 2 pontos por provação; Sekhemas (Ato 2) e Chaos (Ato 3) na campanha, 4 pontos no endgame." });
    }
    if (ref && ref.dims && ref.dims.nos && b.asc && (b.ascNos || []).length) {
      const meus = new Set(b.ascNos);
      const ascTree = new Set(((window.KB_ARVORE || {}).ascendencias || {})[b.asc] ? window.KB_ARVORE.ascendencias[b.asc].map((n) => n.n) : []);
      const pop = ref.dims.nos.filter(([n, p]) => ascTree.has(n) && p >= 40 && !meus.has(n)).slice(0, 2);
      if (pop.length && b.ascConfirmado) add({ id: "asc-nos", area: "dano", sev: 35, tit: "Nós de ascendência populares que você não tem",
        num: pop.map(([n, p]) => `${n} (${p}%)`).join(", "), pq: "Com a mesma skill, a maioria pega esses nós.", passos: [`Considere ${pop[0][0]} na próxima provação.`], fonte: `${REF.fonte || "poe.ninja"}.` });
    }

    /* ---------- 7. DPS (se você informou) ---------- */
    if (+st.dps && ref && ref.st && ref.st.dps) {
      const [p25, p50] = ref.st.dps;
      if (+st.dps < p25) add({ id: "dps", area: "dano", sev: Math.min(80, (30 + 45 * (1 - st.dps / p50)) * fatorSint(ctx, "dano")),
        tit: `DPS da ${P.s.n}: ${fmt(st.dps)}`, num: `metade tem ${fmt(p50)} ou mais`,
        pq: `75% dos jogadores de ${P.s.n} nessa faixa tinham mais de ${fmt(p25)} de DPS.`,
        passos: ["Veja primeiro o nível da gema e os suportes (acima).", P.s.t === "Attack" ? "Ataques usam o dano da arma como base: uma arma melhor é o maior salto de dano." : "Feitiços escalam com o nível da gema e com +nível de gemas no equipamento."],
        fonte: `${REF.fonte || "poe.ninja"}.` });
      else bons.push(`DPS (${fmt(st.dps)}) dentro do normal para a etapa`);
    }

    /* ---------- 7b. combinação rara (arma × ascendência, skill × ascendência) ---------- */
    if (b.asc && CMB.asc && CMB.asc[b.asc]) {
      const ma = modoArma(b);
      const ua = ma ? uso(b.asc, "arma", ma) : null;
      if (ua && ua.de >= 200 && ua.n < 20 && ua.pct < 1) {
        add({ id: "combo-arma", area: "dano", sev: 34 * fatorSint(ctx, "dano"), tit: `${b.asc} com ${ma}: combinação rara`,
          num: `${fmt(ua.n)} de ${fmt(ua.de)} jogadores`,
          pq: `Na liga atual quase ninguém com ${b.asc} usa ${ma}. Não é proibido, mas é pouco testado — se a build está difícil, compare com o que a maioria usa.`,
          passos: [`O que os ${b.asc} usam: ` + ua.top.map(([n, c]) => `${n} (${Math.round(100 * c / ua.de)}%)`).join(", ") + "."],
          fonte: `${CMB.fonte || "poe.ninja"} — ${fmt(ua.de)} personagens ${b.asc}.` });
      }
      const us = s ? uso(b.asc, "sk", s.n) : null;
      if (us && us.de >= 200 && us.n < 20 && us.pct < 1) {
        add({ id: "combo-skill", area: "dano", sev: 30 * fatorSint(ctx, "dano"), tit: `${s.n} é rara em ${b.asc}`,
          num: `${fmt(us.n)} de ${fmt(us.de)} jogadores`,
          pq: `Poucos ${b.asc} jogam com ${s.n}: a ascendência provavelmente não ajuda essa skill. Funciona, mas você está sem referência de quem já testou.`,
          passos: [`As skills mais usadas por ${b.asc}: ` + us.top.map(([n, c]) => `${n} (${Math.round(100 * c / us.de)}%)`).join(", ") + "."],
          fonte: `${CMB.fonte || "poe.ninja"}.` });
      } else if (us && us.n >= 20) bons.push(`${s.n} + ${b.asc}: ${fmt(us.n)} jogadores usam`);
    }

    /* ---------- 8. arma / regras do motor ---------- */
    let an = null;
    try { an = Mo.analisar(b); } catch (e) { an = null; }
    if (an) an.achados.filter((a) => a.sev === "erro" || a.sev === "alerta").forEach((a) => {
      if (/resist/i.test(a.titulo) || /vida|ES por nível|pool/i.test(a.titulo)) return;   /* já cobertos com número acima */
      add({ id: "motor-" + a.titulo, area: /arma|suporte|vetor|crít|skill/i.test(a.titulo) ? "dano" : "defesa",
        sev: (a.sev === "erro" ? 62 : 38), tit: Mo.preencher(a.titulo), num: "", pq: Mo.preencher(a.porque || ""), passos: a.acao ? [Mo.preencher(a.acao)] : [], fonte: "Regras do app (Path of Building 2)." });
    });

    /* ---------- 9. sintomas específicos ---------- */
    if (temSint(ctx, "mana") && P) {
      const caros = (P.g.sup || []).filter((n) => { const su = Mo.SU.get(n); return su && /(increased|more) (Mana )?Cost|Cost Multiplier|cost/i.test((su.fx || []).join(" ")) && !/reduced|less/i.test((su.fx || []).join(" ")); });
      const refMana = ref && ref.dims ? [...(ref.dims.sup || []), ...(ref.dims.esp || [])].filter(([n]) => /Innervate|Efficiency|Mana|Inspiration|Clarity|Remnant/i.test(n)) : [];
      const passos = [];
      if (caros.length) passos.push(`Estes suportes aumentam o custo de mana: ${caros.join(", ")}.`);
      refMana.slice(0, 2).forEach(([n, p]) => passos.push(`${n}: ${p}% dos jogadores de ${P.s.n} usam.`));
      const nos = nosPerto(b, /^\d+% increased (Mana Regeneration Rate|maximum Mana|Mana Cost Efficiency)|^\d+% reduced Mana Cost/i, 1); if (nos.length) passos.push("Árvore: " + textoNo(nos[0]) + ".");
      passos.push("Frasco de mana sempre cheio e equipado.");
      add({ id: "mana", area: "mana", sev: 70, tit: "Mana acabando", num: `${P.s.n}: custo × regeneração`, pq: "Sem mana a skill para — o dano cai a zero.", passos, fonte: "Dados das gemas + poe.ninja." });
    }
    if (temSint(ctx, "stun")) {
      const nos = nosPerto(b, /^\d+% increased Stun (Threshold|Recovery)|^Gain additional Stun Threshold/i, 2);
      const ch = charm("Stun");
      add({ id: "stun", area: "stun", sev: 66, tit: "Fico atordoado", num: "limiar de stun baixo", pq: "No PoE2 o stun vem de golpes grandes em relação à sua vida; ser atordoado em chefe costuma matar.",
        passos: [...nos.map((x) => "Árvore: " + textoNo(x) + "."), ch ? `${ch.n} (cai a partir do nível ${ch.nv}): ativa sozinho quando você é atordoado.` : "", "Mais vida também sobe o limiar de stun."].filter(Boolean), fonte: "Árvore oficial + dados de itens." });
    }
    if (temSint(ctx, "ailment")) {
      const passos = [];
      ["Freeze", "Shock", "Poison", "Ignite", "Bleed"].forEach((c) => { const x = charm(c); if (x && x.nv <= Math.max(nv, 12) && passos.length < 4) passos.push(`${x.n} (contra ${x.pt}, cai a partir do nível ${x.nv}).`); });
      const nos = nosPerto(b, /^\d+% increased (Elemental )?Ailment Threshold|^\d+% reduced (effect|Magnitude|Duration) of (Chill|Freeze|Shock|Ignite|Poison|Bleeding|Elemental Ailments) on you|^Gain additional Ailment Threshold/i, 2);
      nos.forEach((x) => passos.push("Árvore: " + textoNo(x) + "."));
      add({ id: "ailment", area: "ailment", sev: 64, tit: "Ailments (congelar, eletrocutar, veneno…)", num: "charms resolvem rápido", pq: "Charms ativam sozinhos quando o ailment acontece — é a solução padrão no PoE2.", passos, fonte: "Dados de itens (RePoE) + árvore oficial." });
    }

    /* ---------- ordenar ---------- */
    probs.sort((a, b2) => b2.sev - a.sev);
    const vistos = new Set();
    const lista = probs.filter((p) => { if (vistos.has(p.id)) return false; vistos.add(p.id); return true; });
    return { etapa: E, sintomas: [...ctx.sintomas], problemas: lista, bons, faltam, ref, refGeral: rg, analise: an };
  }

  /* ---------------- ranking objetivo das skills (uso real no topo da liga) ----------------
     nota pela posição: S = 1º–8º · A = 9º–25º · B = 26º–60º · C = 61º–110º · D = o resto (com ≥1 jogador) */
  const CORTES = [[8, "S"], [25, "A"], [60, "B"], [110, "C"], [Infinity, "D"]];
  const _rank = {};
  function ranking(modo) {
    modo = modo || "endgame";
    if (_rank[modo]) return _rank[modo];
    const p = CMB.pop && CMB.pop[modo];
    const m = new Map();
    if (p) p.sk.forEach(([n, c], i) => m.set(n, { pos: i + 1, n: c, pct: 100 * c / p.total, tier: CORTES.find(([lim]) => i + 1 <= lim)[1] }));
    _rank[modo] = { mapa: m, total: p ? p.total : 0, qtd: p ? p.sk.length : 0, m: p ? p.m : "" };
    return _rank[modo];
  }
  const tierDe = (skill, modo) => ranking(modo).mapa.get(skill) || null;

  window.Diag = { ETAPAS, ETAPA, SINTOMAS, etapaPorNivel, diagnosticar, refDe, nivelGema, ganhoDano, nosPerto, uso, modoArma, ranking, tierDe, CORTES };
})();
