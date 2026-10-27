/* ============================================================
   Forja PoE2 — MOTOR (sem interface)
   ------------------------------------------------------------
   Índices da biblioteca + regras de análise, classificação e
   sugestões. Funções puras sobre o objeto `build`; o app.js só
   desenha o resultado. Todas as regras citam a mecânica e os
   números de KB_JOGO.consts (Path of Building 2).
   ============================================================ */
(function () {
  "use strict";
  const J = window.KB_JOGO, A = window.KB_ARVORE, U = window.KB_UNICOS || [];
  const C = window.KB_CONCEITOS, M = window.KB_META;
  const K = J.consts;
  const T = J.tipos;

  /* ---------------- índices ---------------- */
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const SK = new Map(J.skills.map((s) => [s.n, s]));
  const SU = new Map(J.suportes.map((s) => [s.n, s]));
  const UN = new Map(U.map((u) => [u.n, u]));
  const KS = new Map(A.keystones.map((k) => [k.n, k]));
  const NT = new Map(A.notaveis.map((k) => [k.n, k]));
  const SKN = new Map(J.skills.map((s) => [norm(s.n), s]));
  const SUN = new Map(J.suportes.map((s) => [norm(s.n), s]));
  const UNN = new Map(U.map((u) => [norm(u.n), u]));
  const NODE = new Map();
  A.keystones.forEach((k) => NODE.set(k.id, { tipo: "keystone", n: k.n }));
  A.notaveis.forEach((k) => NODE.set(k.id, { tipo: "notavel", n: k.n }));
  Object.entries(A.ascendencias).forEach(([asc, ns]) => ns.forEach((k) => { if (!NODE.has(k.id) || NODE.get(k.id).tipo !== "asc") NODE.set(k.id, { tipo: "asc", n: k.n, asc }); }));
  const CLASSES = J.classes;
  const CLASSE_DE = {};
  CLASSES.forEach((c) => c.asc.forEach((a) => (CLASSE_DE[a] = c.n)));
  CLASSE_DE["Abyssal Lich"] = CLASSE_DE["Abyssal Lich"] || "Witch";

  const tiposDe = (s) => new Set((s && s.st || []).map((i) => T[i]));
  const ATTR = ["STR", "DEX", "INT"];
  const ARMA_CLASSE = { Warrior: /Mace|Shield/, Mercenary: /Crossbow/, Ranger: /Bow/, Huntress: /Spear/, Monk: /Quarterstaff|Unarmed/, Druid: /Talisman/ };
  const REGIAO_CLASSE = { Warrior: "STR", Mercenary: "STR/DEX", Ranger: "DEX", Huntress: "DEX", Monk: "DEX/INT", Sorceress: "INT", Witch: "INT", Druid: "STR/INT" };
  const VIZINHAS = { "STR": ["STR/INT", "STR/DEX"], "STR/DEX": ["STR", "DEX"], "DEX": ["STR/DEX", "DEX/INT"], "DEX/INT": ["DEX", "INT"], "INT": ["DEX/INT", "STR/INT"], "STR/INT": ["INT", "STR"] };

  /* ---------------- texto com {c.chave} ---------------- */
  function preencher(txt) {
    return String(txt || "").replace(/\{c\.([\w.]+)\}/g, (_, p) => {
      let v = K;
      for (const k of p.split(".")) { v = v == null ? v : v[k]; }
      return v == null ? "?" : (typeof v === "number" ? fmtNum(v) : String(v));
    });
  }
  function fmtNum(v) { return Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }

  /* ---------------- armas ---------------- */
  const ARMAS = [
    { id: "Bow", pt: "Arco", marcial: true, melee: false },
    { id: "Crossbow", pt: "Besta", marcial: true, melee: false },
    { id: "Spear", pt: "Lança", marcial: true, melee: true },
    { id: "Quarterstaff", pt: "Cajado de combate", marcial: true, melee: true },
    { id: "One Hand Mace", pt: "Maça 1 mão", marcial: true, melee: true },
    { id: "Two Hand Mace", pt: "Maça 2 mãos", marcial: true, melee: true },
    { id: "Talisman", pt: "Talismã", marcial: true, melee: true },
    { id: "Claw", pt: "Garra", marcial: true, melee: true },
    { id: "Dagger", pt: "Adaga", marcial: true, melee: true },
    { id: "One Hand Axe", pt: "Machado 1 mão", marcial: true, melee: true },
    { id: "Two Hand Axe", pt: "Machado 2 mãos", marcial: true, melee: true },
    { id: "Flail", pt: "Mangual", marcial: true, melee: true },
    { id: "One Hand Sword", pt: "Espada 1 mão (1.0)", marcial: true, melee: true },
    { id: "Two Hand Sword", pt: "Espada 2 mãos (1.0)", marcial: true, melee: true },
    { id: "Wand", pt: "Varinha", marcial: false },
    { id: "Staff", pt: "Cajado (feitiço)", marcial: false },
    { id: "Sceptre", pt: "Cetro", marcial: false },
    { id: "Unarmed", pt: "Desarmado", marcial: false }
  ];
  const OFFHANDS = [
    { id: "", pt: "Nada / 2 mãos" }, { id: "Shield", pt: "Escudo" }, { id: "Buckler", pt: "Buckler" },
    { id: "Focus", pt: "Foco" }, { id: "Quiver", pt: "Aljava" }, { id: "Sceptre", pt: "Cetro" }, { id: "Wand", pt: "Varinha (2ª)" }
  ];
  const ARMA = new Map(ARMAS.map((a) => [a.id, a]));
  const armaPt = (id) => (ARMA.get(id) || {}).pt || id || "—";

  function requisitoArma(w) { return String(w || "").split(/,\s*/).filter(Boolean); }
  function armaAtende(w, arma, off) {
    const reqs = requisitoArma(w);
    if (!reqs.length) return true;
    const a = ARMA.get(arma) || {};
    return reqs.some((r) => {
      if (r === "Any Martial Weapon") return !!a.marcial;
      if (r === "Any Melee Martial Weapon") return !!a.melee;
      if (r === "Any Melee Martial Weapon or Unarmed") return !!a.melee || arma === "Unarmed";
      if (r === "Any non-Talisman Melee Martial Weapon") return !!a.melee && arma !== "Talisman";
      if (r === "Any non-Talisman Martial Weapon") return !!a.marcial && arma !== "Talisman";
      if (r === "Unarmed") return arma === "Unarmed" || !arma;
      if (r === "Armoured Shield") return off === "Shield";
      if (r === "Any Shield") return off === "Shield" || off === "Buckler";
      return r === arma || r === off;
    });
  }
  /* sugestão de arma a partir do requisito da skill */
  function armaSugerida(w) {
    const r = requisitoArma(w)[0] || "";
    if (!r) return "";
    if (/Any.*Martial/.test(r)) return "";
    if (r === "One Hand Mace, Two Hand Mace") return "Two Hand Mace";
    if (r === "Armoured Shield" || r === "Any Shield") return "";
    return ARMA.has(r) ? r : "";
  }

  /* ---------------- compatibilidade de suportes (porta do PoB2) ---------------- */
  function expr(lista, tipos, mtipos) {
    const pilha = [];
    for (const i of lista) {
      const t = T[i];
      if (t === "OR") { const o = pilha.pop(); pilha.push(pilha.pop() || o); }
      else if (t === "AND") { const o = pilha.pop(); pilha.push(pilha.pop() && o); }
      else if (t === "NOT") { pilha.push(!pilha.pop()); }
      else pilha.push(tipos.has(t) || (mtipos ? mtipos.has(t) : false));
    }
    return pilha.some(Boolean);
  }
  function compativel(sup, skill) {
    if (!sup || !skill) return false;
    const tipos = tiposDe(skill);
    const mt = sup.imt ? null : new Set((skill.mst || []).map((i) => T[i]));
    if (sup.x && sup.x.length && expr(sup.x, tipos)) return false;
    if (!sup.r || !sup.r.length) return true;
    return expr(sup.r, tipos, mt);
  }
  function suportesCompativeis(skill) { return J.suportes.filter((s) => compativel(s, skill)); }

  /* ---------------- descrição de vetores ---------------- */
  const VETOR = new Map(C.vetores.map((v) => [v.id, v]));
  const VET_ROTULO = { more: "more", conv: "conversão", inc: "increased", crit: "crítico", taken: "inimigo toma +", mitig: "−defesa inimiga", vel: "velocidade", ailment: "ailment", clear: "área/projéteis", defesa: "defesa", efic: "eficiência", menos: "tem penalidade", semcrit: "proíbe crítico", semailment: "proíbe ailments", semelem: "zera elemental", semcaos: "zera caos", cond: "condicional" };

  /* ---------------- helpers de build ---------------- */
  function principal(b) {
    const g = (b.grupos || []).find((g) => g.papel === "principal" && SK.has(g.skill)) || (b.grupos || []).find((g) => SK.has(g.skill));
    return g ? { g, s: SK.get(g.skill) } : null;
  }
  function tagsSkill(s) { return new Set(s ? s.tg : []); }
  function elementos(s) {
    const tg = tagsSkill(s);
    const els = ["fire", "cold", "lightning", "chaos", "physical"].filter((e) => tg.has(e));
    if (s && s.t === "Attack" && !els.length) els.push("physical");
    return els;
  }
  const EL_PT = { fire: "fogo", cold: "gelo", lightning: "raio", chaos: "caos", physical: "físico" };
  const EL_EN = { fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos", physical: "Physical" };
  function ehPersistente(s) { return !!s && (s.tg.includes("persistent") || !!s.sp); }
  function nosAsc(b) { return (b.ascNos || []).map((n) => (A.ascendencias[b.asc] || []).find((x) => x.n === n)).filter(Boolean); }
  function textoLista(arr) { return arr.length <= 1 ? (arr[0] || "") : arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1]; }

  /* fontes de cada vetor dentro da build */
  function detectarVetores(b) {
    const P = principal(b);
    const res = {};
    const add = (v, fonte) => { (res[v] = res[v] || []).push(fonte); };
    if (P) {
      const s = P.s, tg = tagsSkill(s);
      add("base", s.t === "Attack" ? "Dano da arma (" + armaPt(b.arma) + ")" : s.t === "Minion" ? "Nível da gem de minion" : "Nível da gem (" + s.n + ")");
      if (tg.has("lightning")) add("taken", "Choque natural do dano de raio");
      for (const n of P.g.sup || []) {
        const su = SU.get(n); if (!su) continue;
        if (!compativel(su, s)) continue;
        for (const v of su.v) if (["more", "conv", "crit", "taken", "mitig", "vel", "inc", "ailment"].includes(v)) add(v, su.n);
      }
    }
    (b.grupos || []).forEach((g) => {
      const s = SK.get(g.skill); if (!s || (P && g === P.g)) return;
      if (s.tg.includes("curse")) add("mitig", "Maldição: " + s.n);
      if (s.tg.includes("mark")) add("crit", "Marca: " + s.n);
      if (s.tg.includes("herald") || s.tg.includes("aura")) add("inc", "Buff: " + s.n);
    });
    const rx = {
      conv: /gain .*% of .*damage as|converted to|convert .*damage/i,
      crit: /critical/i,
      taken: /damage taken|shock|wither|takes? .*increased damage|fully broken armour/i,
      mitig: /penetrat|exposure|ignore .*resist|resistance.*enem|enem.*resistance|curse|break armour/i,
      more: /\d+% more (?!.*(cost|reservation|mana|life|duration|movement speed penalty))/i,
      vel: /(attack|cast|skill) speed|tailwind|arcane surge|onslaught/i,
      inc: /increased .*damage/i
    };
    const varrer = (linhas, fonte) => {
      const txt = linhas.join(" / ");
      for (const [v, r] of Object.entries(rx)) if (r.test(txt) && !/never deal critical|cannot deal critical/i.test(v === "crit" ? txt : "")) add(v, fonte);
    };
    nosAsc(b).forEach((n) => varrer(n.s, "Ascendência: " + n.n));
    (b.keystones || []).forEach((n) => { const k = KS.get(n); if (k) varrer(k.s, "Keystone: " + k.n); });
    (b.notaveis || []).forEach((n) => { const k = NT.get(n); if (k) varrer(k.s, "Notável: " + k.n); });
    (b.unicos || []).forEach((n) => { const u = UN.get(n); if (u) varrer(u.m, "Único: " + u.n); });
    const st = b.stats || {};
    if (+st.crit >= 25) add("crit", "Chance de crítico " + st.crit + "%");
    Object.entries(b.vetMan || {}).forEach(([v, on]) => { if (on) add(v, "Marcado por você (árvore/itens)"); });
    for (const v of Object.keys(res)) res[v] = [...new Set(res[v])];
    return res;
  }

  function contarMore(b) {
    const P = principal(b); if (!P) return 0;
    return (P.g.sup || []).map((n) => SU.get(n)).filter((s) => s && compativel(s, P.s) && s.v.includes("more")).length;
  }

  /* botões ativos no controle */
  function botoes(b) {
    let n = 0; const lista = [];
    (b.grupos || []).forEach((g) => {
      const s = SK.get(g.skill); if (!s) return;
      if (ehPersistente(s) || g.papel === "buff") return;
      if (g.papel === "disparada") return;
      n++; lista.push(s.n);
    });
    return { n, lista };
  }

  /* espírito */
  function espirito(b) {
    let custo = 0; const itens = [];
    const tactician = b.asc === "Tactician" && (b.ascNos || []).includes("A Solid Plan");
    const lordWilds = (b.keystones || []).includes("Lord of the Wilds");
    (b.grupos || []).forEach((g) => {
      const s = SK.get(g.skill); if (!s || !s.sp) return;
      let c = s.sp;
      if (tactician && s.tg.includes("persistent")) c = Math.round(c * 0.5);
      custo += c; itens.push(s.n + " (" + c + ")");
    });
    let total = +((b.stats || {}).espirito) || 0;
    let estimado = false;
    if (!total) {
      estimado = true;
      total = (b.nivel || 1) >= 40 ? K.espiritoQuests : (b.nivel || 1) >= 20 ? 60 : 30;
      if (b.arma === "Sceptre" || b.offhand === "Sceptre") total += 100;
      if (lordWilds) total = Math.round(total * 0.5);
    }
    const semEspirito = b.asc === "Acolyte of Chayula" && (b.ascNos || []).includes("Embrace the Darkness");
    return { custo, total, estimado, itens, semEspirito };
  }

  /* ---------------- regras ---------------- */
  const SEV = { erro: 0, alerta: 1, dica: 2, ok: 3, info: 4 };
  function achado(sev, titulo, porque, acao, extra) { return Object.assign({ sev, titulo, porque, acao }, extra || {}); }

  function analisar(b) {
    const out = [];
    const P = principal(b);
    const s = P && P.s;
    const tg = tagsSkill(s);
    const lvl = +b.nivel || 1;
    const endgame = lvl >= K.nivelEndgame;
    const hc = /HC/.test(b.modo || "");
    const st = b.stats || {};
    const temNum = (k) => st[k] !== undefined && st[k] !== null && st[k] !== "";
    const vet = detectarVetores(b);
    const classe = b.classe || CLASSE_DE[b.asc] || "";

    /* --- identidade --- */
    if (!b.classe) out.push(achado("erro", "Escolha a classe", "Classe define o ponto de partida na árvore (a roda STR/DEX/INT) e as ascendências.", "Edite a build → Identidade."));
    if (b.asc && b.classe && CLASSE_DE[b.asc] && CLASSE_DE[b.asc] !== b.classe)
      out.push(achado("erro", `${b.asc} não é ascendência de ${b.classe}`, `${b.asc} pertence à classe ${CLASSE_DE[b.asc]}.`, "Troque a classe ou a ascendência."));
    if (!b.asc && lvl >= 30) out.push(achado("alerta", "Sem ascendência definida", "A ascendência dá os maiores multiplicadores da build (8 pontos).", "Escolha uma — a aba 🧭 Criar mostra as que combinam com a sua skill."));

    if (!s) {
      out.push(achado("erro", "Defina a skill principal", "Sem skill principal não dá para avaliar dano, suportes nem arma.", "Edite a build → Skills → adicione e marque como principal."));
      return finalizar(b, out, vet);
    }

    /* --- arma --- */
    if (s.w && !armaAtende(s.w, b.arma, b.offhand)) {
      const ok2 = b.arma2 && armaAtende(s.w, b.arma2, b.offhand2);
      if (!ok2) out.push(achado("erro", `${s.n} exige: ${s.w}`, `A gem só funciona com essa arma. Sua arma atual: ${armaPt(b.arma)}${b.offhand ? " + " + b.offhand : ""}.`, `Troque a arma para ${requisitoArma(s.w).join(" ou ")} (ou use o set de arma 2).`, { wiki: s.n }));
    }
    (b.grupos || []).forEach((g) => {
      const x = SK.get(g.skill);
      if (!x || x === s || !x.w) return;
      if (!armaAtende(x.w, b.arma, b.offhand) && !(b.arma2 && armaAtende(x.w, b.arma2, b.offhand2)))
        out.push(achado("alerta", `${x.n} não funciona com sua arma`, `Exige ${x.w}.`, "Coloque essa arma no set 2 ou troque a skill."));
    });

    /* --- atributos (roda) --- */
    if (classe && REGIAO_CLASSE[classe] && b.asc !== "Gemling Legionnaire") {
      const reg = REGIAO_CLASSE[classe];
      const cores = new Set();
      const fora = [];
      (b.grupos || []).forEach((g) => {
        const x = SK.get(g.skill); if (!x) return;
        x.req.forEach((v, i) => { if (v >= 50) cores.add(ATTR[i]); });
        const dom = ATTR[x.req.indexOf(Math.max(...x.req))];
        if (Math.max(...x.req) > 0 && !reg.includes(dom)) fora.push(`${x.n} (${dom})`);
      });
      if (fora.length) out.push(achado(fora.some((f) => f.startsWith(s.n)) ? "alerta" : "dica", "Gems fora da sua região de atributo",
        `${classe} começa na região ${reg} da árvore. ${textoLista(fora)} pedem outro atributo — gems exigem o atributo da cor delas.`,
        "Some atributo em itens (anéis/amuleto) ou pegue nós de atributo no caminho. Gemling Legionnaire ignora isso."));
      if (cores.size >= 3) out.push(achado("dica", "Build tricolor", "Você usa gems das 3 cores (STR, DEX, INT): vai precisar de atributos de todas.", "Concentre as gems em 1–2 cores ou planeje itens com atributos."));
    }

    /* --- suportes --- */
    const linhagemUso = {};
    (b.grupos || []).forEach((g) => {
      const x = SK.get(g.skill); if (!x) return;
      const fams = {};
      (g.sup || []).forEach((n) => {
        const su = SU.get(n);
        if (!su) { out.push(achado("alerta", `Suporte desconhecido: ${n}`, "Não está na biblioteca deste patch (nome errado ou removido).", "Escolha de novo pela lista.")); return; }
        if (!compativel(su, x)) out.push(achado("erro", `${su.n} não funciona em ${x.n}`, `O suporte exige skills do tipo certo (ele não se aplica a esta skill no PoB2).`, "Troque por um suporte compatível (a lista do editor filtra).", { sup: su.n }));
        fams[su.fam] = (fams[su.fam] || []).concat(su.n);
        if (su.lin) linhagemUso[su.n] = (linhagemUso[su.n] || 0) + 1;
        const els = elementos(x);
        if (su.v.includes("semelem") && els.some((e) => ["fire", "cold", "lightning"].includes(e)))
          out.push(achado("erro", `${su.n} zera o dano elemental de ${x.n}`, su.fx.join(" · "), "Remova o suporte ou troque a skill."));
        if (su.v.includes("semcaos") && els.includes("chaos"))
          out.push(achado("erro", `${su.n} zera o dano de caos de ${x.n}`, su.fx.join(" · "), "Remova o suporte."));
        const less = su.fx.join(" ").match(/(\d+)% less ([A-Za-z ]+?) Damage/);
        if (less) {
          const alvo = less[2];
          const atinge = els.filter((e) => new RegExp(EL_EN[e], "i").test(alvo));
          if (atinge.length && !/Hit|Attack|Spell/.test(alvo)) out.push(achado("alerta", `${su.n} reduz ${less[1]}% do seu dano de ${atinge.map((e) => EL_PT[e]).join("/")}`, su.fx.join(" · "), "Use só se a conversão/ganho compensar — confira no PoB2."));
        }
      });
      Object.entries(fams).forEach(([f, ns]) => { if (ns.length > 1) out.push(achado("erro", `Dois suportes da família “${f}” em ${x.n}`, `${textoLista(ns)}: na mesma skill só um deles vale (o PoB2 marca o outro como substituído).`, "Deixe só o de nível mais alto e use o soquete para outro vetor.")); });
      if ((g.sup || []).length > 5) out.push(achado("alerta", `${x.n} com ${(g.sup || []).length} suportes`, "Uma skill comporta no máximo 5 suportes (soquetes vêm com Jeweller's Orbs).", "Remova os mais fracos."));
    });
    Object.entries(linhagemUso).forEach(([n, q]) => { if (q > 1) out.push(achado("erro", `${n} usado ${q}×`, "Gems de linhagem: só 1 cópia por personagem.", "Deixe em uma só skill.")); });

    /* conflitos com crítico / ailments */
    const ehCrit = (vet.crit || []).some((f) => !/^Chance/.test(f)) || ["Amazon", "Invoker", "Blood Mage"].includes(b.asc) || +st.crit >= 30;
    (P.g.sup || []).forEach((n) => {
      const su = SU.get(n); if (!su) return;
      if (su.v.includes("semcrit") && ehCrit) out.push(achado("erro", `${su.n} proíbe crítico — sua build é de crítico`, su.fx.join(" · "), "Troque por outro suporte de “more”.", { sup: su.n }));
      if (su.v.includes("semailment") && (tg.has("fire") && b.asc === "Infernalist" || (vet.ailment || []).length)) out.push(achado("alerta", `${su.n} impede ailments elementais`, su.fx.join(" · "), "Se a build depende de ignição/choque/congelamento, troque."));
    });
    if ((b.keystones || []).includes("Resolute Technique") && ehCrit) out.push(achado("erro", "Resolute Technique + crítico", "Resolute Technique: “Never deal Critical Hits”.", "Tire a keystone ou abandone o crítico."));

    /* --- vetores de dano --- */
    const nMore = contarMore(b);
    const comp = suportesCompativeis(s);
    const jaTem = new Set(P.g.sup || []);
    const famTem = new Set((P.g.sup || []).map((n) => (SU.get(n) || {}).fam).filter(Boolean));
    const melhores = (v, n) => comp.filter((x) => x.v.includes(v) && !jaTem.has(x.n) && !famTem.has(x.fam) && !conflitaSem(x, s, b)).sort((a, b2) => ((a.lin ? 1 : 0) - (b2.lin ? 1 : 0)) || (rankSup(b2, s, b) - rankSup(a, s, b))).filter((x, i, arr) => arr.findIndex((y) => y.fam === x.fam) === i).slice(0, n || 4).map((x) => x.n);
    if ((P.g.sup || []).length < 2 && lvl >= 10) out.push(achado("alerta", `${s.n} com poucos suportes`, "Suportes são a maior fonte de multiplicadores “more” — cada um multiplica o dano separado.", "Encha a skill principal (até 5).", { sups: melhores("more", 5) }));
    if (nMore < 2) out.push(achado(nMore ? "dica" : "alerta", nMore ? "Só 1 multiplicador “more” na skill principal" : "Nenhum multiplicador “more” na skill principal",
      "“More” multiplica separado de tudo: 3 suportes de 25% more = ×1,95 de dano. É o vetor mais forte do slide.",
      "Suportes compatíveis com “more”:", { sups: melhores("more", 5) }));
    const faltam = [];
    if (!(vet.conv || []).length) faltam.push("conv");
    if (!(vet.taken || []).length) faltam.push("taken");
    if (!(vet.mitig || []).length) faltam.push("mitig");
    if (!(vet.vel || []).length && s.t !== "Minion") faltam.push("vel");
    faltam.forEach((v) => {
      const sups = melhores(v, 4);
      const nots = notaveisPara(v, classe, 4);
      const d = VETOR.get(v);
      out.push(achado("dica", `Vetor vazio: ${d.nome}`, preencher(d.desc) + " Dentro do vetor soma; entre vetores multiplica — um vetor vazio é o investimento que mais rende.",
        "Opções: " + (sups.length ? "suportes compatíveis" : "") + (sups.length && nots.length ? " ou " : "") + (nots.length ? "notáveis na sua região da árvore" : "") + (sups.length || nots.length ? "." : d.como), { sups, nots, vetor: v }));
    });
    if ((vet.inc || []).length === 0 && !(b.vetMan || {}).inc) { /* increased quase sempre vem da árvore: não alarmar */ }
    if (s.t === "Spell" || s.t === "Minion") out.push(achado("info", "Feitiços/minions escalam com nível da gem", preencher("Para " + s.n + ", +1 nível costuma valer mais que muitos % increased."), "Procure “+X to Level of all " + (s.t === "Minion" ? "Minion" : "Spell") + " Skills” em arma/foco/amuleto."));

    /* --- defesa --- */
    const res = ["resFogo", "resFrio", "resRaio"];
    const nomesRes = { resFogo: "fogo", resFrio: "frio", resRaio: "raio" };
    if (res.some(temNum)) {
      const baixas = res.filter((r) => temNum(r) && +st[r] < K.resMax);
      if (baixas.length) {
        const pior = Math.min(...baixas.map((r) => +st[r]));
        const mult = (100 - pior) / (100 - K.resMax);
        out.push(achado(endgame ? "erro" : "alerta", `Resistência abaixo de ${K.resMax}%: ${baixas.map((r) => nomesRes[r] + " " + st[r] + "%").join(", ")}`,
          `Com ${pior}% você toma ${fmtNum(Math.round(mult * 10) / 10)}× o dano elemental de quem está no cap. No endgame a penalidade é ${K.resPenalidade}% (o valor do personagem já vem descontado).`,
          "Prioridade nº 1: resistências em anéis, cinto, botas e luvas; nós de resistência; Smith of Kitava/quests de resistência.", { wiki: "Resistance" }));
      } else out.push(achado("ok", `Resistências elementais no cap (${K.resMax}%)`, "Base sólida contra dano elemental.", ""));
    } else if (endgame) out.push(achado("dica", "Preencha suas resistências", `No endgame há ${K.resPenalidade}% de penalidade; o app só avalia se souber os números.`, "Edite → Números do personagem."));
    if (temNum("resCaos") && +st.resCaos < 0 && lvl >= 70) out.push(achado("alerta", `Resistência ao caos negativa (${st.resCaos}%)`, "Caos não tem a penalidade elemental, mas negativo aumenta o dano de caos recebido; chefes de endgame usam bastante caos.", "Mire 0%+ (itens com caos, nós de caos)."));

    const vida = +st.vida || 0, es = +st.es || 0, pool = vida + es;
    if (pool) {
      const alvo = lvl >= 85 ? 4500 : lvl >= 75 ? 3500 : lvl >= 60 ? 2500 : 1200;
      if (pool < alvo * (hc ? 1.3 : 1)) out.push(achado(pool < alvo * 0.7 ? "erro" : "alerta", `Vida+ES baixa para o nível ${lvl}: ${fmtNum(pool)}`, `Referência grosseira: ~${fmtNum(Math.round(alvo * (hc ? 1.3 : 1)))}+ nesse ponto${hc ? " (HC pede mais)" : ""}. Sem pool, nenhuma camada segura um golpe grande.`, "Nós de vida/ES na árvore e vida em todos os itens possíveis."));
      else out.push(achado("ok", `Pool de vida+ES saudável (${fmtNum(pool)})`, "", ""));
    }
    const camadas = [];
    if (+st.armadura >= 4000) camadas.push("armadura");
    if (+st.evasao >= 4000) camadas.push("evasão");
    if (es >= 1500) camadas.push("ES");
    if (+st.deflexao >= 15) camadas.push("deflexão");
    if (+st.bloqueio >= 25) camadas.push("bloqueio");
    if (temNum("armadura") || temNum("evasao") || es) {
      if (!camadas.length) out.push(achado(endgame ? "alerta" : "dica", "Sem camada principal de defesa", "Armadura, evasão e ES baixos: você depende só da vida.", `Para ${classe || "sua classe"} o natural é ${defNatural(classe, b.asc)} (itens da sua cor de atributo).`));
      else out.push(achado("ok", "Camadas de defesa: " + textoLista(camadas), "", ""));
    }
    if (+st.armadura) {
      const a = +st.armadura;
      const dr = (h) => Math.min(K.drMaxFisico, Math.round((a / (a + K.armaduraRazao * h)) * 100));
      out.push(achado("info", "Sua armadura contra golpes físicos", `Com ${fmtNum(a)} de armadura: hit de 1.000 → −${dr(1000)}% · 3.000 → −${dr(3000)}% · 6.000 → −${dr(6000)}% (fórmula A ÷ (A + ${K.armaduraRazao}×dano)).`, "Armadura é ótima contra muitos hits pequenos e fraca contra golpes enormes de chefe.", { wiki: "Armour" }));
    }
    if (+st.evasao) {
      const ev = +st.evasao, acc = K.precisaoMonstro[Math.min(K.precisaoMonstro.length, 83) - 1] || 1500;
      const hit = Math.max(5, Math.min(100, Math.round((1 - (0.95 * ev) / (ev + 4 * acc)) * 100)));
      out.push(achado("info", `Evasão: ~${100 - hit}% de chance de evitar ataques (monstro nível 83)`, `Fórmula do PoB2: chance do monstro acertar = 1 − 0,95×Ev ÷ (Ev + 4×Precisão); precisão do monstro nível 83 ≈ ${fmtNum(acc)}. Não evita feitiços.`, "Combine com deflexão, ES ou armadura para os golpes que passam.", { wiki: "Evasion" }));
    }

    /* recuperação */
    const r = b.recup || {};
    const fontesRec = Object.entries(r).filter(([, v]) => v).map(([k]) => ({ leech: "leech", regen: "regeneração", recarga: "recarga de ES", frasco: "frascos", charms: "charms", onkill: "vida ao matar" }[k]));
    nosAsc(b).forEach((n) => { if (/leech|regenerat|recharge|recover/i.test(n.s.join(" "))) fontesRec.push(n.n); });
    if (es >= 1000 && !(b.keystones || []).some((k) => /Zealot's Oath|Scarred Faith/.test(k))) fontesRec.push("recarga natural de ES");
    if (!fontesRec.length) out.push(achado(endgame ? "erro" : "alerta", "Sem fonte de recuperação marcada", "Sem leech/regeneração/recarga, o dano acumulado de vários monstros mata mesmo com defesa alta.", "Marque o que você tem em Editar → Recuperação, ou pegue leech na árvore/itens."));
    else if (fontesRec.length === 1 && endgame) out.push(achado("dica", "Só uma fonte de recuperação: " + fontesRec[0], "Em chefes longos uma fonte só costuma faltar.", "Adicione uma segunda (ex.: leech + frasco, regen + recarga de ES)."));
    if (es >= 1500) out.push(achado("info", "Recarga do ES", preencher(`ES recarrega {c.esRecargaPorSeg}% do máximo por segundo após {c.esAtraso}s sem dano — com ${fmtNum(es)} de ES isso dá ~${fmtNum(Math.round(es * K.esRecargaPorSeg / 100))}/s quando começa.`), "Reduzir o atraso de recarga vale muito para builds de ES.", { wiki: "Energy_shield" }));

    /* stun para melee */
    if (tg.has("melee") && !(b.keystones || []).includes("Unwavering Stance") && lvl >= 40 && !/stun/i.test(nosAsc(b).map((n) => n.s.join(" ")).join(" ")))
      out.push(achado("dica", "Corpo a corpo: cuide do atordoamento", "Melee fica perto dos monstros e é atordoado com frequência; travar é a principal causa de morte.", "Nós de limiar de stun, vida e armadura; charms anti-congelamento/stun."));

    /* espírito */
    const sp = espirito(b);
    if (sp.semEspirito && sp.custo) out.push(achado("erro", "Embrace the Darkness: você não tem espírito", "O Acolyte com Embrace the Darkness troca o espírito por Darkness — buffs persistentes não ligam.", "Remova os buffs persistentes ou o nó."));
    else if (sp.custo > sp.total) out.push(achado("erro", `Espírito insuficiente: ${sp.custo} de ${sp.total}${sp.estimado ? " (estimado)" : ""}`, `Reservas: ${sp.itens.join(", ")}. A campanha dá ${K.espiritoQuests} de espírito; cetros dão 100.`, "Tire um buff, use cetro/itens com espírito ou Tactician (A Solid Plan: −50%)."));
    else if (sp.custo && sp.total - sp.custo >= 30) out.push(achado("dica", `Sobra espírito: ${sp.total - sp.custo}${sp.estimado ? " (estimado)" : ""}`, "Espírito parado é poder desperdiçado.", "Um herald, aura ou meta gem (Cast on Critical/Shock) cabe aí."));
    else if (!sp.custo && lvl >= 20) out.push(achado("dica", "Nenhum buff persistente", `Você tem ~${sp.total} de espírito${sp.estimado ? " (estimado)" : ""} sem uso.`, "Heralds, auras e meta gems são dano/defesa “de graça”."));

    /* controle */
    const bt = botoes(b);
    if (bt.n >= 9) out.push(achado("alerta", `${bt.n} skills de botão — pesado no controle`, "No controle os botões diretos são poucos; o resto exige modificador.", "Troque utilitárias por buffs persistentes ou triggers (meta gems)."));
    else if (bt.n >= 6) out.push(achado("dica", `${bt.n} skills de botão`, "No PS5 a partir de 6 você começa a depender do modificador (segurar gatilho).", "Considere transformar uma em trigger (Cast on Critical/Shock) ou persistente."));
    else if (bt.n) out.push(achado("ok", `Confortável no controle (${bt.n} botões)`, "", ""));
    if ((b.keystones || []).includes("Unwavering Stance")) out.push(achado("alerta", "Unwavering Stance: sem dodge roll", "“Cannot Dodge Roll or Sprint” — no controle o dodge roll é sua principal ferramenta de sobrevivência.", "Só vale se a build for muito tanque."));

    /* keystones específicas */
    regrasKeystones(b, s, vet, out, es, vida);

    /* sinergia ascendência × skill */
    if (b.asc) {
      const ranking = rankAscPorSkill(s);
      const minha = ranking.find((x) => x.asc === b.asc);
      const top = ranking.slice(0, 3);
      if (minha && minha.score < (top[0] ? top[0].score * 0.5 : 0) && !top.some((x) => x.asc === b.asc))
        out.push(achado("dica", `${b.asc} conversa pouco com ${s.n}`, `Afinidades da ${b.asc}: ${((C.ascendencias[b.asc] || {}).afin || []).join(", ")}. Tags da skill: ${s.tg.join(", ")}.`, "Ascendências que combinam mais: " + top.map((x) => x.asc).join(", ") + "."));
    }
    /* meta */
    const mb = M.builds.filter((x) => x.skill === s.n);
    if (mb.length && b.asc && !mb.some((x) => x.asc.includes(b.asc))) out.push(achado("info", `No meta, ${s.n} é jogada com ${textoLista([...new Set(mb.flatMap((x) => x.asc))])}`, "Não quer dizer que a sua não funciona — só que essa combinação está provada no ladder.", "Veja quem joga no poe.ninja."));

    /* únicos */
    const slots = {};
    (b.unicos || []).forEach((n) => { const u = UN.get(n); if (!u) return; (slots[u.slot] = slots[u.slot] || []).push(u.n); });
    const LIM = { ring: b.asc === "Ritualist" && (b.ascNos || []).includes("Unfurled Finger") ? 3 : 2, jewel: 99, flask: 5, charm: 3 };
    Object.entries(slots).forEach(([sl, ns]) => { if (ns.length > (LIM[sl] || 1)) out.push(achado("alerta", `Únicos demais no mesmo slot (${sl})`, textoLista(ns) + " ocupam o mesmo espaço.", "Escolha um.")); });

    return finalizar(b, out, vet);
  }

  function defNatural(classe, asc) {
    const d = asc && C.ascendencias[asc] && C.ascendencias[asc].def;
    const mapa = { armadura: "armadura + vida", evasao: "evasão + deflexão", es: "Escudo de Energia (ES)", vida: "vida + armadura/evasão", hibrido: "uma mistura (ex.: armadura/ES)" };
    if (d) return mapa[d];
    const r = REGIAO_CLASSE[classe] || "";
    return r.includes("STR") && r.includes("INT") ? "armadura/ES" : r.includes("STR") && r.includes("DEX") ? "armadura/evasão" : r.includes("DEX") && r.includes("INT") ? "evasão/ES" : r === "STR" ? "armadura + vida" : r === "DEX" ? "evasão + deflexão" : "ES";
  }

  function regrasKeystones(b, s, vet, out, es, vida) {
    const ks = new Set(b.keystones || []);
    const tg = tagsSkill(s);
    const custo = (k) => (KS.get(k) || { s: [] }).s.join(" · ");
    if (ks.has("Avatar of Fire") && !tg.has("fire")) out.push(achado("alerta", "Avatar of Fire numa skill que não é de fogo", custo("Avatar of Fire"), "75% vira fogo e o resto é perdido: escale FOGO (não o elemento original)."));
    if (ks.has("Chaos Inoculation") && es < 1500) out.push(achado("erro", "Chaos Inoculation sem ES", custo("Chaos Inoculation"), "CI deixa a vida em 1: só funciona com muito ES."));
    if (ks.has("Chaos Inoculation") && b.asc === "Blood Mage") out.push(achado("erro", "Chaos Inoculation + Blood Mage", "Blood Mage paga skills com vida; com 1 de vida não dá.", "Escolha um dos dois."));
    if (ks.has("Vaal Pact") && !(b.recup || {}).leech) out.push(achado("erro", "Vaal Pact sem leech", custo("Vaal Pact"), "Com Vaal Pact só leech recupera vida: garanta leech."));
    if ((ks.has("Zealot's Oath") || ks.has("Scarred Faith")) && es >= 1500) out.push(achado("alerta", "Keystone que desliga a recarga do ES", custo(ks.has("Zealot's Oath") ? "Zealot's Oath" : "Scarred Faith"), "Garanta outra forma de recuperar ES."));
    if (ks.has("Wildsurge Incantation") && !(tg.has("storm") || tg.has("plant"))) out.push(achado("alerta", "Wildsurge Incantation sem skill de tempestade/planta", custo("Wildsurge Incantation"), "Só afeta feitiços Storm e Plant."));
    if (ks.has("Ancestral Bond") && !(b.grupos || []).some((g) => (SK.get(g.skill) || { tg: [] }).tg.includes("totem"))) out.push(achado("alerta", "Ancestral Bond sem totens", custo("Ancestral Bond"), "Só vale para builds de totem."));
    if (ks.has("Trusted Kinship") && !(b.grupos || []).some((g) => (SK.get(g.skill) || { tg: [] }).tg.includes("companion"))) out.push(achado("alerta", "Trusted Kinship sem companheiros", custo("Trusted Kinship"), "Só vale com companheiros."));
    if (ks.has("Iron Reflexes") && b.asc === "Pathfinder" && (b.ascNos || []).includes("Sustainable Practices")) out.push(achado("erro", "Iron Reflexes anula Sustainable Practices", "Iron Reflexes converte toda evasão em armadura — o nó de evasão do Pathfinder fica sem efeito.", "Escolha um dos dois."));
    if (ks.has("Giant's Blood")) out.push(achado("info", "Giant's Blood triplica requisitos de atributo", custo("Giant's Blood"), "Planeje muita força."));
    if (ks.has("Oasis") && (b.recup || {}).charms) out.push(achado("erro", "Oasis: não pode usar charms", custo("Oasis"), "Desmarque charms ou tire a keystone."));
    if (ks.has("Eldritch Battery") && ks.has("Chaos Inoculation")) out.push(achado("alerta", "Eldritch Battery + CI", "Eldritch Battery converte o ES em mana — com CI você fica sem defesa.", "Repense a combinação."));
    if (ks.has("Mind Over Matter") && +((b.stats || {}).mana) < 1500) out.push(achado("dica", "Mind Over Matter com pouca mana", custo("Mind Over Matter"), "MoM pede mana alta e regeneração forte."));
    (b.keystones || []).forEach((k) => { if (!KS.has(k)) out.push(achado("alerta", `Keystone desconhecida: ${k}`, "Não existe neste patch.", "Remova.")); });
  }

  /* ---------------- notas e classificação ---------------- */
  function finalizar(b, achados, vet) {
    achados.sort((x, y) => SEV[x.sev] - SEV[y.sev]);
    const notas = notasDe(b, achados, vet);
    const rot = rotulos(b, notas, vet);
    return { achados, notas, rotulos: rot, vetores: vet, arquetipo: arquetipo(b, vet), geral: notaGeral(notas) };
  }

  function notasDe(b, achados, vet) {
    const P = principal(b), s = P && P.s;
    const st = b.stats || {};
    const pesos = { base: 1, conv: 1.2, inc: 0.6, crit: 1, taken: 1.2, mitig: 1.2, more: 1.5, vel: 1 };
    let dano = 0, max = 0;
    for (const [v, p] of Object.entries(pesos)) { max += p; if ((vet[v] || []).length) dano += p; }
    const nMore = contarMore(b);
    dano = s ? Math.min(10, (dano / max) * 8.5 + Math.min(nMore, 4) * 0.4) : 0;

    let def = 0, defEst = false;
    const res = ["resFogo", "resFrio", "resRaio"].filter((k) => st[k] !== undefined && st[k] !== "");
    if (res.length) def += 3 * (res.filter((k) => +st[k] >= K.resMax).length / 3); else { defEst = true; def += 1.5; }
    const pool = (+st.vida || 0) + (+st.es || 0);
    const lvl = +b.nivel || 1;
    const alvo = lvl >= 85 ? 4500 : lvl >= 75 ? 3500 : lvl >= 60 ? 2500 : 1200;
    if (pool) def += Math.min(3, (pool / alvo) * 2.5); else { defEst = true; def += 1.2; }
    let cam = 0;
    if (+st.armadura >= 4000) cam++; if (+st.evasao >= 4000) cam++; if (+st.es >= 1500) cam++; if (+st.deflexao >= 15) cam++; if (+st.bloqueio >= 25) cam++;
    if (!(st.armadura || st.evasao || st.es)) { defEst = true; cam = 1; }
    def += Math.min(2.5, cam * 1.1);
    if (st.resCaos !== undefined && st.resCaos !== "") def += +st.resCaos >= 0 ? 1.5 : +st.resCaos >= -30 ? 0.6 : 0; else def += 0.5;
    def = Math.min(10, def);

    const r = b.recup || {};
    let rec = Object.values(r).filter(Boolean).length * 2.2;
    nosAsc(b).forEach((n) => { if (/leech|regenerat|recharge|recover/i.test(n.s.join(" "))) rec += 1.5; });
    if (+st.es >= 1000) rec += 1;
    rec = Math.min(10, rec);

    const erros = achados.filter((a) => a.sev === "erro").length, alertas = achados.filter((a) => a.sev === "alerta").length;
    const coer = Math.max(0, 10 - erros * 2.5 - alertas * 0.8);

    const bt = botoes(b).n;
    let ctrl = bt <= 3 ? 10 : bt <= 5 ? 8.5 : bt <= 8 ? 6 : 4;
    if (s && (s.tg.includes("projectile") || s.tg.includes("area"))) ctrl = Math.min(10, ctrl + 0.5);
    if ((b.keystones || []).includes("Unwavering Stance")) ctrl -= 1.5;
    if (!s) ctrl = 0;

    let custo = 10;
    custo -= (b.unicos || []).length * 1.3;
    (b.grupos || []).forEach((g) => (g.sup || []).forEach((n) => { const su = SU.get(n); if (su && su.lin) custo -= 1.5; }));
    custo = Math.max(1, Math.min(10, custo));

    const r1 = (x) => Math.round(Math.max(0, x) * 10) / 10;
    return { dano: r1(dano), defesa: r1(def), defesaEstimada: defEst, recuperacao: r1(rec), coerencia: r1(coer), controle: r1(ctrl), acesso: r1(custo) };
  }
  function notaGeral(n) {
    return Math.round((n.dano * 0.25 + n.defesa * 0.25 + n.recuperacao * 0.12 + n.coerencia * 0.2 + n.controle * 0.1 + n.acesso * 0.08) * 10) / 10;
  }

  function metaDe(b) {
    const P = principal(b); if (!P) return null;
    const exato = M.builds.find((x) => x.skill === P.s.n && x.asc.includes(b.asc));
    if (exato) return { tipo: "exato", tier: exato.tier, item: exato };
    const skill = M.builds.find((x) => x.skill === P.s.n);
    if (skill) return { tipo: "skill", tier: skill.tier, item: skill };
    if (M.ascPopulares.includes(b.asc)) return { tipo: "asc" };
    return null;
  }

  function rotulos(b, n, vet) {
    const out = [];
    const P = principal(b), s = P && P.s;
    const tg = tagsSkill(s);
    const md = metaDe(b);
    if (md && md.tipo === "exato") out.push({ t: `🏆 Meta ${md.tier}`, c: "meta" });
    else if (md && md.tipo === "skill") out.push({ t: `🏅 Skill do meta (${md.tier})`, c: "meta" });
    else if (md && md.tipo === "asc") out.push({ t: "📈 Ascendência popular", c: "meta" });
    else if (s) out.push({ t: "🧪 Fora do meta", c: "fun" });
    if (s && !md && ((b.unicos || []).length || (b.keystones || []).length >= 2)) out.push({ t: "✨ Criativa / fun", c: "fun" });
    if ((b.unicos || []).some((u) => /Grants Skill/.test(((UN.get(u) || {}).m || []).join(" ")))) out.push({ t: "💎 Build de único", c: "fun" });
    if (s) {
      const estilo = s.t === "Minion" || tg.has("minion") ? "🧟 Minions" : tg.has("totem") ? "🗿 Totens" : tg.has("shapeshift") ? "🐻 Transformação" : s.t === "Spell" ? "🔮 Feitiço" : tg.has("melee") ? "⚔️ Corpo a corpo" : "🏹 Distância";
      out.push({ t: estilo, c: "estilo" });
      const clear = tg.has("area") || tg.has("projectile") || tg.has("chaining");
      const boss = contarMore(b) >= 3 && ((vet.mitig || []).length || (vet.taken || []).length);
      out.push({ t: clear && boss ? "🌍 Mapas + chefes" : clear ? "🗺️ Mapper (limpa tela)" : boss ? "👑 Bosser" : "🎯 Alvo único", c: "foco" });
    }
    if (n.dano >= 7 && n.defesa <= 4) out.push({ t: "💥 Canhão de vidro", c: "risco" });
    else if (n.defesa >= 7 && n.dano <= 5) out.push({ t: "🧱 Tanque", c: "risco" });
    else if (n.defesa >= 6 && n.dano >= 6) out.push({ t: "⚖️ Equilibrada", c: "ok" });
    if (n.defesa >= 7 && n.recuperacao >= 6) out.push({ t: "☠️ Aguenta HC", c: "ok" });
    if (s && !(b.unicos || []).length && n.acesso >= 9 && (s.tier || 0) <= 9) out.push({ t: "🌱 Bom começo de liga", c: "ok" });
    if (n.acesso <= 5) out.push({ t: "💰 Cara de montar", c: "risco" });
    if (n.controle >= 8.5) out.push({ t: "🎮 Confortável no PS5", c: "ok" });
    else if (s && n.controle <= 5) out.push({ t: "🎮 Muitos botões", c: "risco" });
    return out;
  }

  function arquetipo(b, vet) {
    const P = principal(b); if (!P) return "Build sem skill principal";
    const s = P.s, tg = tagsSkill(s);
    const a = b.arma;
    let quem = s.t === "Minion" || tg.has("minion") ? "Invocador" : tg.has("totem") ? "Mestre de totens" : tg.has("shapeshift") ? "Druida transformado" :
      s.t === "Spell" ? "Conjurador" : a === "Bow" ? "Arqueiro" : a === "Crossbow" ? "Atirador de besta" : a === "Spear" ? "Lanceiro" :
        a === "Quarterstaff" ? "Monge de cajado" : /Mace/.test(a || "") ? "Esmagador de maça" : a === "Talisman" ? "Druida de talismã" : a === "Unarmed" ? "Lutador" : tg.has("melee") ? "Guerreiro" : "Atacante";
    const els = elementos(s).filter((e) => e !== "physical");
    const el = els.length > 1 ? "elemental" : els[0] ? EL_PT[els[0]] : "físico";
    const crit = (vet.crit || []).length >= 2 ? " crítico" : "";
    const ail = s.tg.includes("chaos") && /Essence|Contagion|Poison/i.test(s.n) ? " de DoT" : "";
    return `${quem} de ${el}${crit}${ail} · ${b.asc || b.classe || "?"}`;
  }

  /* ---------------- rankings / sugestões ---------------- */
  const ASC_CRIT = ["Amazon", "Invoker", "Blood Mage", "Oracle", "Infernalist", "Deadeye"];
  function buildCritica(b) {
    if (!b) return false;
    const st = b.stats || {};
    return ASC_CRIT.includes(b.asc) || !!(b.vetMan || {}).crit || +st.crit >= 25 ||
      (b.grupos || []).some((g) => (g.sup || []).some((n) => { const x = SU.get(n); return x && x.v.includes("crit") && !x.v.includes("semcrit"); }));
  }
  /* restrições ("sem X") só atrapalham se a skill/build depende de X */
  function conflitaSem(su, skill, b) {
    const v = su.v, els = elementos(skill);
    if (v.includes("semelem") && els.some((e) => ["fire", "cold", "lightning"].includes(e))) return true;
    if (v.includes("semcaos") && els.includes("chaos")) return true;
    if (v.includes("semcrit") && buildCritica(b)) return true;
    if (v.includes("semailment") && skill.tg.some((t) => ["fire", "cold", "lightning"].includes(t)) && b && (b.vetMan || {}).ailment) return true;
    return false;
  }
  function rankSup(su, skill, b) {
    let r = 0;
    const v = new Set(su.v);
    if (v.has("more")) r += 5;
    if (v.has("cond")) r -= 2.5;
    if (conflitaSem(su, skill, b)) r -= 20;
    if (/Minion/.test((su.fx || []).join(" ")) && (skill.t === "Minion" || skill.tg.includes("minion"))) r += 3;
    if (v.has("conv") || v.has("taken") || v.has("mitig")) r += 3;
    if (v.has("vel")) r += 2;
    if (v.has("crit")) r += buildCritica(b) ? 2 : -5;
    if (v.has("menos")) r -= 2;
    if (v.has("clear") && skill && (skill.tg.includes("area") || skill.tg.includes("projectile"))) r += 0.5;
    if (v.has("ailment") && !skill.tg.some((t) => ["fire", "cold", "lightning", "chaos", "physical"].includes(t))) r -= 1;
    if (su.lin) r -= b && b.orcamento === "alto" ? 0 : 1.5;
    r += (su.nv || 0) * 0.6;
    const els = elementos(skill);
    const txt = (su.fx || []).join(" ");
    const sel = su.el || [];
    if (sel.length) {
      const bate = sel.some((e) => els.includes(e));
      const fisAtk = !bate && skill.t === "Attack" && sel.length === 1 && sel[0] === "physical";
      r += bate ? 1.5 : fisAtk ? -2 : -8;
    }
    const alvo = txt.match(/less ([A-Za-z ]+?) Damage/);
    if (alvo && els.some((e) => new RegExp(EL_EN[e], "i").test(alvo[1]))) r -= 6;
    if (/Minion/.test(txt) && skill.t !== "Minion" && !skill.tg.includes("minion")) r -= 3;
    /* DoT x hit: suporte de "Damage over Time" só vale em skill de DoT, e vice-versa */
    const tipos = tiposDe(skill);
    const supDot = /damage over time/i.test(txt), supHit = /more [A-Za-z ]*Hit Damage|Damage with Hits|more Hit/i.test(txt);
    if (tipos.has("DamageOverTime")) { if (supDot) r += 3; if (supHit) r -= tipos.has("DegenOnlySpellDamage") ? 8 : 3; }
    else if (supDot && !/ailment/i.test(txt)) r -= 4;
    return r;
  }
  /* melhores suportes por vetor para uma skill */
  function recomendarSuportes(skill, b, n) {
    if (!skill) return [];
    n = n || 5;
    const nota = (x) => rankSup(x, skill, b);
    const comp = suportesCompativeis(skill).filter((x) => !conflitaSem(x, skill, b) && nota(x) >= 3.5);
    const porFam = new Map();
    comp.sort((x, y) => nota(y) - nota(x)).forEach((x) => { if (!porFam.has(x.fam)) porFam.set(x.fam, x); });
    const lista = [...porFam.values()];
    const escolhidos = [], vistos = new Set();
    const critOk = buildCritica(b);
    for (const v of ["more", "conv", "mitig", "taken", "more", "vel", "crit", "more"]) {
      if (v === "crit" && !critOk) continue;
      const c = lista.find((x) => x.v.includes(v) && !vistos.has(x.n) && (critOk || !x.v.includes("crit")));
      if (c) { escolhidos.push(c.n); vistos.add(c.n); }
      if (escolhidos.length >= n) break;
    }
    for (const x of lista) { if (escolhidos.length >= n) break; if (!vistos.has(x.n)) { escolhidos.push(x.n); vistos.add(x.n); } }
    return escolhidos;
  }
  const VET_RX_NOTAVEL = {
    conv: /gain .*% of .*damage as|converted to/i, crit: /critical/i, taken: /shock|wither|take .*increased damage|damage taken/i,
    mitig: /penetrat|exposure|break armour|curse|resistance/i, more: /\bmore\b/i, vel: /(attack|cast|skill) speed/i, inc: /increased .*damage/i
  };
  function notaveisPara(v, classe, n) {
    const rx = VET_RX_NOTAVEL[v]; if (!rx) return [];
    const reg = REGIAO_CLASSE[classe];
    const perto = new Set(reg ? [reg, ...(VIZINHAS[reg] || [])] : []);
    return A.notaveis.filter((x) => rx.test(x.s.join(" ")) && !/enemies? (deal|have) .*more|you take .*more/i.test(x.s.join(" ")))
      .map((x) => ({ x, d: x.reg === reg ? 0 : perto.has(x.reg) ? 1 : 2 }))
      .sort((a, b) => a.d - b.d).slice(0, n || 4).map((o) => o.x.n);
  }
  function rankAscPorSkill(skill) {
    const tg = tagsSkill(skill);
    return Object.entries(C.ascendencias).map(([asc, d]) => {
      const armaCl = ARMA_CLASSE[CLASSE_DE[asc]];
      let sc = armaCl && skill.w ? (armaCl.test(skill.w) ? 3 : /Any/.test(skill.w) ? 0 : -2) : 0;
      sc += (d.afin || []).reduce((a, t) => a + (tg.has(t) ? 2 : 0) + (t === "spell" && skill.t === "Spell" ? 1 : 0) + (t === "attack" && skill.t === "Attack" ? 1 : 0) + (t === "minion" && skill.t === "Minion" ? 1 : 0), 0);
      const txt = (A.ascendencias[asc] || []).map((n) => n.s.join(" ")).join(" ").toLowerCase();
      skill.tg.forEach((t) => { if (t.length > 3 && txt.includes(t)) sc += 1; });
      if (M.builds.some((m) => m.skill === skill.n && m.asc.includes(asc))) sc += 4;
      const cl = CLASSE_DE[asc];
      const reg = REGIAO_CLASSE[cl] || "";
      const dom = ATTR[skill.req.indexOf(Math.max(...skill.req))];
      if (reg.includes(dom)) sc += 1.5;
      return { asc, classe: cl, score: sc };
    }).sort((a, b) => b.score - a.score);
  }
  function rankSkillsPorAsc(asc) {
    const d = C.ascendencias[asc] || {}; const cl = CLASSE_DE[asc]; const reg = REGIAO_CLASSE[cl] || "";
    const txt = (A.ascendencias[asc] || []).map((n) => n.s.join(" ")).join(" ").toLowerCase();
    const armaCl = ARMA_CLASSE[cl];
    return J.skills.filter((s) => s.tier > 0 && !ehPersistente(s) && ["Attack", "Spell", "Minion"].includes(s.t)).map((s) => {
      let sc = (d.afin || []).reduce((a, t) => a + (s.tg.includes(t) ? 2 : 0), 0);
      if (armaCl && s.w) sc += armaCl.test(s.w) ? 3 : /Any/.test(s.w) ? 0 : -3;
      if (!armaCl && s.t === "Attack" && s.w && !/Any/.test(s.w)) sc -= 2;
      s.tg.forEach((t) => { if (t.length > 3 && txt.includes(t)) sc += 1; });
      const dom = ATTR[s.req.indexOf(Math.max(...s.req))];
      if (reg.includes(dom)) sc += 2;
      if (M.builds.some((m) => m.skill === s.n && m.asc.includes(asc))) sc += 5;
      return { s, score: sc };
    }).sort((a, b) => b.score - a.score);
  }
  function rankSkillsPorUnico(u) {
    const txt = u.m.join(" ").toLowerCase() + " " + u.slot;
    const sinais = {
      bow: /bow|arrow/, spear: /spear/, crossbow: /crossbow|bolt|ammunition/, quarterstaff: /quarterstaff/, mace: /mace/, talisman: /talisman/,
      minion: /minion|companion|undead|skeleton|zombie/, spell: /spell|cast/, attack: /attack/, melee: /melee|strike/, projectile: /projectile/, area: /area of effect/,
      fire: /fire|ignite|burn/, cold: /cold|freeze|chill/, lightning: /lightning|shock|electrocut/, chaos: /chaos|poison|wither/, physical: /physical|bleed/,
      curse: /curse|hex/, totem: /totem/, warcry: /warcry/, herald: /herald/, trigger: /trigger/, crit: /critical/, slam: /slam/, mark: /mark/
    };
    const ativos = Object.entries(sinais).filter(([, r]) => r.test(txt)).map(([k]) => k);
    const concedida = (u.m.find((l) => /^Grants Skill:/i.test(l)) || "").replace(/^Grants Skill:\s*(Level \S+\s*)?/i, "").trim();
    return {
      sinais: ativos, concedida,
      skills: J.skills.filter((s) => s.tier > 0 && ["Attack", "Spell", "Minion"].includes(s.t)).map((s) => {
        let sc = 0;
        ativos.forEach((k) => {
          if (s.tg.includes(k)) sc += 2;
          if (k === "spell" && s.t === "Spell") sc += 2;
          if (k === "attack" && s.t === "Attack") sc += 2;
          if (k === "minion" && s.t === "Minion") sc += 2;
          if (/^(bow|spear|crossbow|quarterstaff|talisman)$/.test(k) && norm(s.w).includes(k)) sc += 3;
          if (k === "mace" && /mace/i.test(s.w)) sc += 3;
          if (k === "crit" && s.tg.includes("attack")) sc += 0.3;
        });
        return { s, score: sc };
      }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
    };
  }

  /* ---------------- geração (aleatória / a partir de escolhas) ---------------- */
  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function novaBuild(base) {
    return Object.assign({
      id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: "", classe: "", asc: "", nivel: 90, objetivo: "tudo", modo: "SC", orcamento: "medio",
      arma: "", offhand: "", arma2: "", offhand2: "",
      grupos: [], unicos: [], keystones: [], ascNos: [], notaveis: [],
      stats: {}, recup: { frasco: true }, vetMan: {}, notas: "", origem: "manual",
      criado: Date.now(), atualizado: Date.now()
    }, base || {});
  }
  function montar(skillNome, asc, origem, extra) {
    const s = SK.get(skillNome);
    const classe = asc ? CLASSE_DE[asc] : (s ? classePorSkill(s) : "");
    const b = novaBuild({ origem: origem || "assistente", classe, asc: asc || "" });
    if (s) {
      b.arma = armaSugerida(s.w) || (s.t === "Spell" ? (classe === "Witch" ? "Sceptre" : "Staff") : s.t === "Minion" ? "Sceptre" : "");
      if (requisitoArma(s.w).includes("Armoured Shield")) { b.arma = "One Hand Mace"; b.offhand = "Shield"; }
      if (b.arma === "Bow") b.offhand = "Quiver";
      if (s.t === "Spell" && b.arma !== "Staff") b.offhand = "Focus";
      b.grupos.push({ skill: s.n, papel: "principal", sup: recomendarSuportes(s, b, 5) });
      const buff = escolherBuff(s, b);
      if (buff) b.grupos.push({ skill: buff.n, papel: "buff", sup: [] });
      b.nome = s.n + (asc ? " " + asc : "");
    }
    if (asc) b.ascNos = escolherNosAsc(asc, s);
    return Object.assign(b, extra || {});
  }
  function classePorSkill(s) {
    const dom = ATTR[s.req.indexOf(Math.max(...s.req))];
    const w = s.w || "";
    if (/Bow/.test(w)) return "Ranger"; if (/Spear/.test(w)) return "Huntress"; if (/Crossbow/.test(w)) return "Mercenary";
    if (/Quarterstaff|Unarmed/.test(w)) return "Monk"; if (/Mace|Shield/.test(w)) return "Warrior"; if (/Talisman/.test(w)) return "Druid";
    if (s.t === "Minion") return "Witch";
    return dom === "INT" ? (s.tg.includes("chaos") || s.tg.includes("physical") ? "Witch" : "Sorceress") : dom === "DEX" ? "Ranger" : "Warrior";
  }
  function escolherBuff(s, b) {
    const els = elementos(s);
    const persist = J.skills.filter((x) => x.sp && x.sp <= 60 && x.tg.includes("persistent") && !x.tg.includes("meta") && !x.tg.includes("companion"));
    const herald = persist.filter((x) => x.tg.includes("herald") && armaAtende(x.w, b.arma, b.offhand) && els.some((e) => x.tg.includes(e)));
    if (herald.length) return herald[0];
    const ok = persist.filter((x) => armaAtende(x.w, b.arma, b.offhand) && x.req.indexOf(Math.max(...x.req)) === s.req.indexOf(Math.max(...s.req)));
    return ok[0] || null;
  }
  function escolherNosAsc(asc, s) {
    const nos = (A.ascendencias[asc] || []).filter((n) => !/^Grants Skill/i.test(n.s[0]) || true);
    if (!s) return nos.slice(0, 4).map((n) => n.n);
    const tg = tagsSkill(s);
    return nos.map((n) => {
      const t = n.s.join(" ").toLowerCase();
      let sc = 0;
      tg.forEach((x) => { if (x.length > 3 && t.includes(x)) sc += 2; });
      if (/\bmore\b/.test(t)) sc += 1.5;
      if (s.t === "Spell" && /spell/.test(t)) sc += 2;
      if (s.t === "Attack" && /attack/.test(t)) sc += 2;
      if (/life|energy shield|armour|evasion/.test(t)) sc += 0.5;
      return { n, sc };
    }).sort((a, b) => b.sc - a.sc).slice(0, 4).map((x) => x.n.n);
  }
  function aleatoria(filtro) {
    filtro = filtro || {};
    const ascs = Object.keys(C.ascendencias).filter((a) => !filtro.classe || CLASSE_DE[a] === filtro.classe);
    const asc = rnd(ascs);
    const cand = rankSkillsPorAsc(asc).filter((x) => !filtro.tipo || x.s.t === filtro.tipo);
    const topo = cand.slice(0, Math.max(6, Math.round(cand.length * 0.15)));
    const pick = rnd(topo.length ? topo : cand);
    const b = montar(pick.s.n, asc, "aleatoria");
    /* keystone "temperinho": só entra se não gerar erro/alerta na análise */
    const ks = A.keystones.filter((k) => k.reg === REGIAO_CLASSE[CLASSE_DE[asc]] && !/Chaos Inoculation|Vaal Pact|Eldritch Battery|Blood Magic|Mind Over Matter|Zealot's Oath|Scarred Faith|Eternal Youth|Necromantic Talisman|Resolute Technique|Unwavering Stance|Conduit|Oasis/.test(k.n));
    if (ks.length && Math.random() < 0.6) {
      const base = analisar(b).achados.filter((a) => a.sev === "erro" || a.sev === "alerta").length;
      for (const k of ks.sort(() => Math.random() - 0.5)) {
        b.keystones = [k.n];
        if (analisar(b).achados.filter((a) => a.sev === "erro" || a.sev === "alerta").length <= base) break;
        b.keystones = [];
      }
    }
    b.nome = "🎲 " + b.nome;
    return b;
  }

  /* ---------------- links de pesquisa ---------------- */
  const wikiUrl = (nome) => "https://www.poe2wiki.net/wiki/" + encodeURIComponent(String(nome).replace(/ /g, "_"));
  const dbUrl = (nome) => "https://poe2db.tw/us/" + encodeURIComponent(String(nome).replace(/ /g, "_").replace(/'/g, ""));
  const redditUrl = (q) => "https://www.reddit.com/r/PathofExile2Builds/search/?q=" + encodeURIComponent(q);
  function pesquisa(b) {
    const P = principal(b), out = [];
    if (P) out.push({ titulo: "Aprenda sobre sua skill: " + P.s.n, links: [["Wiki", wikiUrl(P.s.n)], ["PoE2DB", dbUrl(P.s.n)]] });
    if (b.asc) out.push({ titulo: "Aprenda sobre sua ascendência: " + b.asc, links: [["Wiki", wikiUrl(b.asc)], ["PoB2", "https://pathofbuilding.community/"]] });
    (b.unicos || []).slice(0, 4).forEach((u) => out.push({ titulo: "Único: " + u, links: [["Wiki", wikiUrl(u)], ["PoE2DB", dbUrl(u)]] }));
    out.push({ titulo: "Inspiração: quem joga isso", links: [["poe.ninja", "https://poe.ninja/poe2/builds"], ["Reddit", redditUrl((P ? P.s.n : "") + " " + (b.asc || ""))], ["Maxroll", "https://maxroll.gg/poe2/build-guides"], ["Mobalytics", "https://mobalytics.gg/poe-2/builds"]] });
    return out;
  }

  /* ---------------- calculadora de vetores ---------------- */
  function calcDano(e) {
    const more = String(e.more || "").split(/[,;\s]+/).map(Number).filter((x) => !isNaN(x) && x);
    const f = {
      base: +e.base || 0,
      conv: 1 + (+e.conv || 0) / 100,
      inc: 1 + (+e.inc || 0) / 100,
      crit: 1 + Math.min(100, +e.critChance || 0) / 100 * ((+e.critBonus || 0) / 100),
      taken: 1 + (+e.taken || 0) / 100,
      mitig: 1 - Math.max(-200, Math.min(90, +e.res || 0)) / 100,
      more: more.reduce((a, x) => a * (1 + x / 100), 1),
      vel: +e.vel || 1
    };
    const total = f.base * f.conv * f.inc * f.crit * f.taken * f.mitig * f.more * f.vel;
    return { f, total };
  }
  function ondeInvestir(e) {
    const base = calcDano(e).total || 1;
    const testes = [
      { id: "inc", rot: "+30% increased", mud: { inc: (+e.inc || 0) + 30 } },
      { id: "more", rot: "+1 suporte de 25% more", mud: { more: (e.more || "") + ",25" } },
      { id: "conv", rot: "+25% gain as extra", mud: { conv: (+e.conv || 0) + 25 } },
      { id: "crit", rot: "+10 pontos de chance de crítico", mud: { critChance: Math.min(100, (+e.critChance || 0) + 10) } },
      { id: "crit2", rot: "+50% de bônus crítico", mud: { critBonus: (+e.critBonus || 0) + 50 } },
      { id: "taken", rot: "+20% dano recebido (choque/wither)", mud: { taken: (+e.taken || 0) + 20 } },
      { id: "mitig", rot: "−20% resistência do inimigo (exposição/pen.)", mud: { res: (+e.res || 0) - 20 } },
      { id: "vel", rot: "+10% velocidade", mud: { vel: (+e.vel || 1) * 1.1 } }
    ];
    return testes.map((t) => ({ id: t.id, rot: t.rot, ganho: (calcDano(Object.assign({}, e, t.mud)).total / base - 1) * 100 })).sort((a, b) => b.ganho - a.ganho);
  }
  function calcDefesa(e) {
    const a = +e.armadura || 0, ev = +e.evasao || 0, nivel = Math.max(1, Math.min(K.precisaoMonstro.length, +e.nivelMonstro || 83));
    const acc = K.precisaoMonstro[nivel - 1];
    const golpes = [500, 1000, 2500, 5000, 10000].map((h) => ({ h, dr: Math.min(K.drMaxFisico, a ? (a / (a + K.armaduraRazao * h)) * 100 : 0) }));
    const acerta = ev ? Math.max(5, Math.min(100, (1 - (0.95 * ev) / (ev + 4 * acc)) * 100)) : 100;
    return { golpes, acc, evade: 100 - acerta };
  }

  window.Motor = {
    norm, preencher, fmtNum, SK, SU, UN, KS, NT, SKN, SUN, UNN, NODE, CLASSES, CLASSE_DE, REGIAO_CLASSE, ARMAS, OFFHANDS, ARMA, armaPt,
    VET_ROTULO, VETOR, compativel, suportesCompativeis, armaAtende, armaSugerida, requisitoArma, principal, detectarVetores, contarMore, botoes, espirito,
    analisar, rankSup, buildCritica, conflitaSem, recomendarSuportes, rankAscPorSkill, rankSkillsPorAsc, rankSkillsPorUnico, notaveisPara, novaBuild, montar, aleatoria, metaDe,
    pesquisa, wikiUrl, dbUrl, calcDano, ondeInvestir, calcDefesa, ehPersistente, elementos, EL_PT, tiposDe
  };
})();
