/* ============================================================
   Exile Forge — RETRATO DO META (curado à mão)
   ------------------------------------------------------------
   Fonte: tier lists públicas e guias de out/2026 (0.5.4–0.5.5).
   Não é o poe.ninja ao vivo (o site bloqueia leitura automática):
   confira sempre em https://poe.ninja/poe2/builds.
   Atualizar a cada patch/liga: trocar `atualizado`, `liga` e a lista.
   Campos: skill (nome exato da gem), asc (lista), tier (S+/S/A/B),
           foco (mapas/chefes/ambos), dificuldade (1 fácil – 3 difícil),
           starter (bom começo de liga sem itens), nota (PT).
   ============================================================ */
window.KB_META = {
  atualizado: "2026-10-27",
  liga: "0.5.5 — Forbidden Rites (até o 1.0 em 11/12/2026)",
  fontes: [
    { nome: "U4GM — tier list 0.5.5 Forbidden Rites", url: "https://www.u4gm.com/path-of-exile-2/blog-poe-2-0.5.5-build-tier-list-best-forbidden-rites-builds" },
    { nome: "Timesaver — tier list 0.5.4 (Runes of Aldur)", url: "https://timesaver.gg/blog/poe2-0-5-4-best-builds-tier-list" },
    { nome: "LFCarry — ranking por poe.ninja (Runes of Aldur, 12/ago)", url: "https://lfcarry.com/guides/poe2-builds" },
    { nome: "poe.ninja (confira o atual)", url: "https://poe.ninja/poe2/builds" }
  ],
  observacao: "Snapshot de Runes of Aldur (poe.ninja, 12/ago): ~20% do ladder era Martial Artist e Twister tinha ~12%. O 0.5.5 não mudou balanceamento de skills/ascendências.",
  builds: [
    { skill: "Whirling Assault", asc: ["Martial Artist"], tier: "S+", foco: "ambos", dificuldade: 2, starter: true,
      nota: "Melee de cajado que avança girando; definiu o meta corpo a corpo do 0.5." },
    { skill: "Twister", asc: ["Spirit Walker", "Deadeye", "Gemling Legionnaire"], tier: "S+", foco: "mapas", dificuldade: 1, starter: true,
      nota: "Lança: tornados erráticos que limpam a tela; muito popular e confortável no controle." },
    { skill: "Spark", asc: ["Infernalist"], tier: "S+", foco: "ambos", dificuldade: 3, starter: false,
      nota: "Spark com Cast on Critical + Comet: dano altíssimo, mas montagem e itens exigentes." },
    { skill: "Ice Shot", asc: ["Deadeye"], tier: "S", foco: "ambos", dificuldade: 1, starter: true,
      nota: "Um dos arcos mais fortes do patch; projéteis extras do Deadeye brilham." },
    { skill: "Tame Beast", asc: ["Spirit Walker"], tier: "S", foco: "ambos", dificuldade: 1, starter: true,
      nota: "Companheiros (fera domada) que escalam com o dano da sua arma." },
    { skill: "Thrashing Vines", asc: ["Lich", "Oracle"], tier: "S", foco: "ambos", dificuldade: 2, starter: false,
      nota: "Builds de plantas (Entangle / Thrashing Vines / Toxic Growth)." },
    { skill: "Falling Thunder", asc: ["Invoker", "Martial Artist"], tier: "A", foco: "ambos", dificuldade: 2, starter: true,
      nota: "Slam de cajado com projéteis de raio; ótimo começo de liga para Monk." },
    { skill: "Essence Drain", asc: ["Lich"], tier: "A", foco: "ambos", dificuldade: 2, starter: true,
      nota: "Caos de DoT com Contagion; seguro e barato." },
    { skill: "Lightning Arrow", asc: ["Deadeye"], tier: "A", foco: "mapas", dificuldade: 1, starter: true,
      nota: "Clássico de arco para limpar mapas." },
    { skill: "Walking Calamity", asc: ["Shaman", "Oracle"], tier: "B", foco: "mapas", dificuldade: 2, starter: false,
      nota: "Foi topo no 0.5.0 (autobomber de urso); perdeu espaço nas listas do 0.5.4+." }
  ],
  ascPopulares: ["Martial Artist", "Gemling Legionnaire", "Disciple of Varashta", "Witchhunter", "Deadeye", "Spirit Walker", "Infernalist"]
};
