/* ============================================================
   Exile Forge — biblioteca CURADA (editar à mão a cada patch)
   ------------------------------------------------------------
   • Números entre {c.chave} são preenchidos pelo app a partir de
     KB_JOGO.consts (gerado do Path of Building 2) — assim, quando
     o gerador roda num patch novo, os textos se atualizam sozinhos.
   • "wiki" = nome da página em https://www.poe2wiki.net/wiki/<wiki>
   • Ao revisar: atualizar `revisado`, `patch` e conferir cada tópico
     marcado com `revisar: true` nas notas do patch.
   ============================================================ */
window.KB_CONCEITOS = {
  revisado: "2026-10-27",
  patch: "0.5.5 — Forbidden Rites",
  jogo: {
    atual: "0.5.5 (Forbidden Rites, liga de evento lançada em 04/09/2026). Não mudou balanceamento de skills/ascendências em relação ao 0.5 (Return of the Ancients).",
    proximo: "1.0 — lançamento completo em 11/12/2026 (PC, PS5, Xbox): nova classe Duelist (espadas), atos finais da campanha e free-to-play. Quando sair: rodar o gerador com o PoB2 atualizado e revisar o meta.",
    ciclo: "O PoE2 recebe um patch grande a cada ~4 meses. Builds, números e o meta mudam — por isso a biblioteca daqui é gerada dos dados do Path of Building 2 e tem data de revisão."
  },

  /* ---------------- Vetores de escalonamento (slide "Hit Damage Scaling Vectors") ---------------- */
  vetores: [
    { id: "base", ico: "🗡️", nome: "Dano base & da skill",
      desc: "O ponto de partida do hit. Ataques usam o dano da ARMA (+ dano adicionado plano); feitiços e minions usam o dano base da gem, que sobe com o NÍVEL da gem.",
      fontes: ["Dano da arma (marcial)", "Dano adicionado plano (marcial)", "Dano base da skill (nível da gem)", "Conversão própria da skill"],
      como: "Arma com mais dano físico/elemental, +níveis de gem (spells/minions), qualidade, dano adicionado em anéis/luvas/quiver." },
    { id: "conv", ico: "🔀", nome: "Conversão & “Gain as”",
      desc: "Transforma ou DUPLICA dano em outro tipo. “Gain X% como Y” soma dano extra sem tirar o original — é quase um multiplicador. No PoE2 a conversão acontece sobre o dano base, então o dano convertido escala pelos modificadores do tipo FINAL.",
      fontes: ["Conversão da árvore", "Conversão de itens", "“Gain X% of Damage as Y” (suportes, árvore, ascendência)"],
      como: "Suportes do tipo Attunement/Infusion, nós de “gain as extra”, ascendências (ex.: Invoker ganha frio/raio extra)." },
    { id: "inc", ico: "📈", nome: "Dano aumentado (increased)",
      desc: "TODOS os “% increased” somam num balde só. Por isso cada ponto a mais rende cada vez menos: com 300% já somados, +30% vale só ~7,5% de dano real.",
      fontes: ["Equipamentos", "Árvore passiva", "Gems de suporte", "Buffs"],
      como: "Bom no começo; no endgame prefira diversificar para outros vetores." },
    { id: "crit", ico: "🎯", nome: "Acerto crítico",
      desc: "Multiplicador médio = 1 + chance × bônus. O bônus base de crítico é {c.critBonusBase}%. Só compensa investir em bônus quando a chance já é alta (e vice-versa).",
      fontes: ["Chance de crítico (arma/skill/árvore)", "Bônus de dano crítico"],
      como: "Armas/skills com crítico base alto, nós de crítico, Fraqueza Crítica (marcas), Amazon/Invoker/Blood Mage." },
    { id: "taken", ico: "💥", nome: "Inimigo toma mais dano",
      desc: "Debuffs que fazem o inimigo receber MAIS dano — multiplicam tudo. Choque tem magnitude base de {c.choqueMagnitude}%.",
      fontes: ["Shock (choque)", "Withered (definhado)", "Armadura totalmente quebrada", "Únicos", "Gems de linhagem"],
      como: "Aplicar choque (raio), wither (caos), quebrar armadura (Warbringer faz a armadura quebrada aumentar TODO dano)." },
    { id: "mitig", ico: "🛡️", nome: "Reduzir a defesa do inimigo",
      desc: "Resistência/armadura do inimigo cortam seu dano. No PoB2 chefes comuns têm {c.resChefe}% de resistência elemental e pinnacles {c.resChefePinnacle}% — reduzir isso é dano “de graça”.",
      fontes: ["Maldições de redução de resistência", "Quebra de armadura (físico)", "Penetração", "Exposição"],
      como: "Suportes de Exposure, maldições, penetração na árvore; contra físico, quebrar armadura." },
    { id: "more", ico: "✖️", nome: "Multiplicadores “more”",
      desc: "Cada “X% more” multiplica SEPARADO de todo o resto. É o vetor mais forte: 3 suportes de 25% more = ×1,95.",
      fontes: ["Gems de suporte", "Ascendências", "Árvore (keystones/notáveis)"],
      como: "Encher a skill principal com os melhores suportes de “more” compatíveis; escolher ascendência com more multiplicadores." },
    { id: "vel", ico: "⚡", nome: "Velocidade (ataque/conjuração)",
      desc: "Não está no slide (que olha o dano por hit), mas DPS = dano por hit × hits por segundo. Velocidade multiplica o DPS e ainda melhora a fluidez — no controle, faz muita diferença.",
      fontes: ["Velocidade de ataque/conjuração", "Suportes de velocidade", "Tailwind, Onslaught, Arcane Surge"],
      como: "Suportes tipo Rapid Attacks, nós de velocidade, buffs (Tailwind do Deadeye, Arcane Surge do Stormweaver)." }
  ],

  /* ---------------- Camadas de defesa ---------------- */
  camadas: [
    { id: "pool", ico: "❤️", nome: "Reserva (vida / ES)", desc: "Quanto dano você aguenta antes de morrer. Base para tudo: sem pool, nenhuma camada salva de um golpe grande." },
    { id: "res", ico: "🔥", nome: "Resistências", desc: "Cap de {c.resMax}% (máx. absoluto {c.resMaxCap}%). No endgame há {c.resPenalidade}% de penalidade — o valor que aparece no personagem já vem descontado." },
    { id: "evitar", ico: "💨", nome: "Evitar (evasão / deflexão / bloqueio)", desc: "Fazer o golpe não acertar ou acertar menos." },
    { id: "mitigar", ico: "🧱", nome: "Mitigar (armadura / redução)", desc: "Diminuir o dano que chega (armadura reduz físico)." },
    { id: "recup", ico: "♻️", nome: "Recuperação", desc: "Leech, regeneração, recarga de ES, frascos, vida ao matar — repor o que perdeu." },
    { id: "ctrl", ico: "🧊", nome: "Prevenção de controle", desc: "Não ser atordoado, congelado ou eletrocutado: limiar de stun/ailments, imunidades, charms." }
  ],

  /* ---------------- Tópicos (glossário com números) ---------------- */
  topicos: [
    { id: "pensar", cat: "Fundamentos", ico: "🧠", titulo: "Como pensar uma build",
      resumo: "Toda build boa equilibra 3 coisas: DANO que escala por vários vetores, DEFESA em camadas e RECUPERAÇÃO. Depois vem conforto (velocidade, poucos botões).",
      pontos: [
        "Comece pelo que te diverte: uma skill, uma ascendência, um único — ou o meta.",
        "Cheque as restrições: atributos (roda STR/DEX/INT), arma exigida pela skill, espírito para buffs.",
        "Dano: dentro de um vetor os bônus SOMAM; entre vetores eles MULTIPLICAM. Diversificar rende mais que empilhar.",
        "Defesa: resistências no cap primeiro, depois pool (vida/ES) e uma camada principal (armadura OU evasão OU ES).",
        "Pesquise antes de gastar: wiki + poe2db para a skill, PoB2 para testar, poe.ninja para ver quem já joga isso."
      ], wiki: "Build" },
    { id: "restricoes", cat: "Fundamentos", ico: "🧭", titulo: "Restrições: atributos e a roda da árvore",
      resumo: "A árvore é uma roda: INT no topo, DEX/INT à direita, DEX embaixo à direita, STR/DEX embaixo, STR à esquerda e STR/INT em cima à esquerda. Cada classe começa num setor.",
      pontos: [
        "Gems exigem atributos da cor delas (vermelha = STR, verde = DEX, azul = INT). Usar gems de outra cor exige atributo extra em itens ou nós de atributo.",
        "Notáveis longe do seu ponto de partida custam muitos pontos de caminho — o app mostra a região de cada notável/keystone.",
        "A skill define a arma (ex.: Lightning Arrow só com Arco; Twister só com Lança). Confira antes de planejar a árvore.",
        "Gemling Legionnaire ignora parte disso: requisitos atendidos pelo seu maior atributo."
      ], wiki: "Passive_skill" },
    { id: "pontos", cat: "Fundamentos", ico: "🌳", titulo: "Pontos de passiva e ascendência",
      resumo: "{c.pontosNivel} pontos por nível (2 a 100) + {c.pontosQuest} de quests da campanha. Ascendência: {c.pontosAscendencia} pontos.",
      pontos: [
        "As quests da campanha dão +2 pontos de “set de arma” várias vezes ({c.pontosQuest} no total): eles permitem árvores diferentes por set de arma.",
        "Witchhunter pode transformar 100 pontos normais em pontos de set de arma.",
        "Campanha também dá +{c.vidaQuests} de vida e resistências permanentes (~+{c.resQuests.Fire}% em cada elemento, somando escolhas)."
      ], wiki: "Passive_skill" },
    { id: "espirito", cat: "Fundamentos", ico: "👻", titulo: "Espírito (Spirit)",
      resumo: "Recurso que RESERVA espaço para skills persistentes: auras, heralds, companheiros, meta gems (Cast on Critical etc.). A campanha dá {c.espiritoQuests} de espírito.",
      pontos: [
        "Fontes: quests ({c.espiritoQuests} no total), cetros (base 100), amuletos e armaduras com espírito, nós da árvore.",
        "Some o custo de todos os buffs persistentes — se passar do seu espírito, algum não liga.",
        "Tactician: buffs persistentes reservam 50% menos. Acolyte of Chayula troca espírito por Darkness."
      ], wiki: "Spirit" },
    { id: "suportes", cat: "Fundamentos", ico: "💎", titulo: "Gems de suporte: regras",
      resumo: "Suportes só funcionam em skills com os tipos compatíveis. Muitos vêm em níveis (I, II, III) da mesma família.",
      pontos: [
        "Na MESMA skill, dois suportes da mesma família não somam: só um vale (o PoB2 marca o outro como substituído).",
        "Desde o 0.3, o mesmo suporte comum pode ir em skills diferentes.",
        "Gems de LINHAGEM (nomes de personagens, ex.: Kaom's Madness): só 1 cópia por personagem e são bem mais caras (preço base {c.linhagemOuro} de ouro vs {c.suporteOuro} das comuns).",
        "Cuidado com suportes que proíbem algo: “não pode critar” (Controlled Destruction) ou “sem ailments elementais” (Elemental Focus) brigam com builds de crítico/ailment."
      ], wiki: "Support_gem" },
    { id: "weaponset", cat: "Fundamentos", ico: "⚔️", titulo: "Sets de arma",
      resumo: "Você tem dois sets de arma e pode trocar em combate. Os pontos de set de arma deixam cada set com nós próprios.",
      pontos: [
        "Útil para ter uma arma de clear e outra de chefe, ou um set só para buffs/utilitárias.",
        "Skills exigem a arma do tipo certo no set em uso."
      ], wiki: "Weapon_set" },

    { id: "inc-more", cat: "Ofensa", ico: "✖️", titulo: "Increased × More",
      resumo: "“Increased” soma num balde; “more” multiplica separado. Exemplo: com 200% increased, +100% increased = +33% de dano real; um 30% more = +30% sempre.",
      pontos: [
        "Dano final = base × (1 + soma dos increased) × (1 + more₁) × (1 + more₂) × …",
        "Quanto mais increased você já tem, menos vale o próximo.",
        "Use a 🧮 Calculadora para ver qual vetor dá mais dano para a SUA build."
      ], wiki: "Damage" },
    { id: "marcial", cat: "Ofensa", ico: "🗡️", titulo: "Dano de arma (ataques)",
      resumo: "Ataques escalam com o dano da arma: dano físico e elemental da arma, dano adicionado plano e velocidade de ataque da arma.",
      pontos: [
        "Trocar de arma costuma ser o maior salto de dano de um atacante.",
        "Dano adicionado plano (anéis, luvas, quiver) vale mais em skills com efetividade alta.",
        "Feitiços NÃO usam dano da arma — para eles o que conta é o nível da gem (+níveis em cetro/varinha/foco/amuleto)."
      ], wiki: "Weapon" },
    { id: "conversao", cat: "Ofensa", ico: "🔀", titulo: "Conversão e “gain as”",
      resumo: "Ordem de conversão: físico → raio → frio → fogo → caos (nunca volta). “Gain as extra” duplica parte do dano em outro tipo.",
      pontos: [
        "No PoE2 a conversão acontece sobre o dano base (o PoB2 converte antes dos modificadores): escale o tipo FINAL.",
        "Conversão e gain-as acontecem ao mesmo tempo (slide).",
        "Converter para um elemento abre choque/ignição/congelamento e as penetrações/exposições daquele elemento."
      ], wiki: "Damage_conversion" },
    { id: "critico", cat: "Ofensa", ico: "🎯", titulo: "Acerto crítico",
      resumo: "Crítico multiplica o hit pelo bônus de crítico (base {c.critBonusBase}%). Multiplicador médio = 1 + chance × bônus.",
      pontos: [
        "Com 10% de chance, dobrar o bônus quase não muda nada; com 60%+ de chance, o bônus vira um multiplicador enorme.",
        "Fraqueza Crítica (marcas do Deadeye) aumenta a chance contra o alvo.",
        "Invoker: críticos ignoram resistência elemental não-negativa. Blood Mage: feitiços com 15% de crítico base."
      ], wiki: "Critical_hit" },
    { id: "nivelgem", cat: "Ofensa", ico: "⬆️", titulo: "Nível de gem",
      resumo: "Feitiços e minions tiram quase todo o dano do nível da gem. +1 nível costuma valer mais que muitos % increased.",
      pontos: [
        "Procure “+X to Level of all Spell/Minion Skills” em armas, foco e amuleto.",
        "Ataques ganham menos com nível (o dano vem da arma), mas ainda escalam a efetividade."
      ], wiki: "Skill_gem" },
    { id: "penetracao", cat: "Ofensa", ico: "🧨", titulo: "Penetração, exposição e maldições",
      resumo: "Todas reduzem a resistência efetiva do inimigo. Contra chefes com {c.resChefe}–{c.resChefePinnacle}% de resistência, tirar 20–30% vale muito.",
      pontos: [
        "Exposição: debuff que baixa a resistência a um elemento (suportes de Exposure, Shaman dá exposição em área).",
        "Penetração: ignora parte da resistência só nos SEUS hits.",
        "Maldições: alcance limitado ao número de maldições que você pode aplicar (Lich aplica uma extra e com duração infinita)."
      ], wiki: "Penetration" },
    { id: "armadura-quebra", cat: "Ofensa", ico: "🔨", titulo: "Quebra de armadura",
      resumo: "Quebrar a armadura do inimigo aumenta seu dano FÍSICO; com a armadura totalmente quebrada o inimigo toma mais dano físico.",
      pontos: [
        "Warbringer: armadura totalmente quebrada passa a aumentar TODO dano recebido e pode ir abaixo de zero.",
        "Forte para builds físicas de maça/slam."
      ], wiki: "Armour_break" },
    { id: "ailments", cat: "Ailments", ico: "☣️", titulo: "Ailments de dano (DoT)",
      resumo: "Ignição, veneno e sangramento causam dano ao longo do tempo baseado no dano do hit que os aplicou.",
      pontos: [
        "Ignição: {c.igniteDanoPorSeg}% do dano do hit por segundo por {c.igniteDuracao}s (base).",
        "Veneno: {c.venenoDanoPorSeg}% por segundo por {c.venenoDuracao}s — EMPILHA (Pathfinder dobra quantos venenos o alvo aceita).",
        "Sangramento: {c.sangramentoDanoPorSeg}% por segundo por {c.sangramentoDuracao}s; “agravado” é mais forte.",
        "A chance de aplicar escala com o dano do hit comparado ao limiar de ailment do monstro — hits grandes aplicam melhor."
      ], wiki: "Ailment" },
    { id: "ailments-ctrl", cat: "Ailments", ico: "🧊", titulo: "Choque, frio, congelamento, eletrocutar, pin",
      resumo: "Ailments de controle. Choque faz o alvo tomar +{c.choqueMagnitude}% de dano (base). Chill deixa lento (máx. {c.frioMaxLentidao}%).",
      pontos: [
        "Congelamento, Eletrocutar e Pin são barras de ACÚMULO: hits enchem a barra até o alvo travar.",
        "Contra chefes, controlar = mais tempo batendo e menos tomando.",
        "Stormweaver aplica dois choques/dois chills ao mesmo tempo."
      ], wiki: "Freeze" },
    { id: "cull", cat: "Ofensa", ico: "💀", titulo: "Culling Strike",
      resumo: "Mata instantaneamente inimigos com pouca vida: normais abaixo de {c.cullNormal}%, mágicos {c.cullMagico}%, raros {c.cullRaro}%, únicos {c.cullUnico}%.",
      pontos: ["Witchhunter tem Culling Strike na ascendência.", "Na prática é um multiplicador de ~5–10% em chefes."], wiki: "Culling_strike" },
    { id: "cargas", cat: "Mecânicas", ico: "🔋", titulo: "Cargas e recursos",
      resumo: "Power, Frenzy e Endurance (máx. {c.cargasMax} cada por padrão). No PoE2 muitas skills CONSOMEM cargas para efeitos fortes.",
      pontos: ["Deadeye dobra benefícios de consumir Frenzy.", "Lich: feitiços consomem Power Charge para 40% more dano.", "Rage (máx. base {c.rageMax}) é recurso dos guerreiros/Shaman."], wiki: "Charge" },
    { id: "meta", cat: "Mecânicas", ico: "🔁", titulo: "Meta gems e triggers",
      resumo: "Meta gems (Cast on Critical, Cast on Shock, Invocation…) acumulam ENERGIA e disparam feitiços sozinhas. Reservam espírito.",
      pontos: ["Reduzem botões: ótimo no controle.", "Invoker: meta gems ganham 35% mais energia.", "O feitiço disparado precisa ser compatível (tipo Triggerable)."], wiki: "Meta_gem" },
    { id: "minions", cat: "Mecânicas", ico: "🧟", titulo: "Minions e companheiros",
      resumo: "Minions escalam com dano de minion, +nível das gems de minion e suportes de minion. Persistentes reservam espírito.",
      pontos: ["Seu personagem precisa sobreviver sozinho: minions não te dão defesa automática.", "Spirit Walker: companheiros ganham dano da sua arma.", "Totens funcionam parecido (limite de totens)."], wiki: "Minion" },

    { id: "resistencias", cat: "Defesa", ico: "🔥", titulo: "Resistências",
      resumo: "Fogo/Frio/Raio: cap {c.resMax}% (máx. absoluto {c.resMaxCap}%). A penalidade sobe {c.resPenalidadeAtos.1.v}% por ato até {c.resPenalidade}% no endgame.",
      pontos: [
        "PRIORIDADE nº 1 no endgame: de 75% para 50% você toma o DOBRO de dano elemental (25% → 50% passa).",
        "O valor no personagem já inclui a penalidade — mire 75% em cada elemento.",
        "Caos não sofre a penalidade, mas começa baixo; 0% ou mais já ajuda muito contra chefes de caos.",
        "Smith of Kitava liga resistência de fogo às outras; Acolyte of Chayula dobra a de caos."
      ], wiki: "Resistance" },
    { id: "armadura", cat: "Defesa", ico: "🧱", titulo: "Armadura",
      resumo: "Reduz dano FÍSICO de hits: redução = A ÷ (A + {c.armaduraRazao} × dano). Máximo {c.drMaxFisico}%.",
      pontos: [
        "Ótima contra muitos hits pequenos, fraca contra golpes enormes: 10.000 de armadura reduz 50% de um hit de 1.000, mas só ~17% de um hit de 5.000.",
        "Alguns nós/ascendências aplicam parte da armadura contra dano elemental ou de caos.",
        "Veja a calculadora de defesa (aba 🧮)."
      ], wiki: "Armour" },
    { id: "evasao", cat: "Defesa", ico: "💨", titulo: "Evasão",
      resumo: "Chance de evitar hits de ATAQUE. Chance do monstro acertar = 1 − 0,95 × Ev ÷ (Ev + 4 × Precisão). Máx. {c.evasaoCap}% de evasão.",
      pontos: [
        "Feitiços não são evadidos por padrão (o PoB2 calcula “Spell Evade” só com modificadores específicos).",
        "Pathfinder transforma metade da evasão em redução de dano elemental.",
        "Combine com deflexão ou ES para não depender só de sorte."
      ], wiki: "Evasion" },
    { id: "deflexao", cat: "Defesa", ico: "🌀", titulo: "Deflexão",
      resumo: "Chance de DESVIAR um hit: o golpe desviado causa {c.deflexaoEfeito}% menos dano. Chance máx. {c.deflexaoCap}%.",
      pontos: ["Vem de nós que convertem parte da evasão/armadura em deflexão (Tactician: 20% da armadura).", "É uma camada estável: não zera o golpe, mas corta sempre que ativa."], wiki: "Deflection" },
    { id: "bloqueio", cat: "Defesa", ico: "🛡️", titulo: "Bloqueio",
      resumo: "Escudos (e buckler) dão chance de bloquear hits. Máx. base {c.bloqueioMaxBase}% (absoluto {c.bloqueioCap}%).",
      pontos: ["Warbringer: bloqueio fixo de 35% do escudo; com Turtle Charm o máx. vira 75%."], wiki: "Block" },
    { id: "es", cat: "Defesa", ico: "🔷", titulo: "Escudo de Energia (ES)",
      resumo: "Absorve dano antes da vida (exceto caos em alguns casos). Recarrega {c.esRecargaPorSeg}% do máximo por segundo após {c.esAtraso}s sem tomar dano.",
      pontos: ["Ótimo para INT (Sorceress/Witch/Lich).", "Reduzir o atraso de recarga é enorme (Disciple of Varashta: −1s; Martial Artist reduz por combo).", "Lich: a vida não muda enquanto tiver ES."], wiki: "Energy_shield" },
    { id: "vida", cat: "Defesa", ico: "❤️", titulo: "Vida e EHP",
      resumo: "Vida cresce {c.vidaPorNivel} por nível + itens + árvore. EHP (vida efetiva) = quanto dano bruto você aguenta considerando todas as camadas.",
      pontos: ["Referência grosseira de endgame: 3.000–4.000+ de vida (ou vida+ES) antes de chefes pinnacle.", "O PoB2 calcula o “Total EHP” — se você importar um código PoB, o app mostra."], wiki: "Life" },
    { id: "recuperacao", cat: "Defesa", ico: "♻️", titulo: "Recuperação",
      resumo: "Sem recuperação, qualquer dano acumulado mata. Fontes: leech, regeneração, recarga de ES, frascos, vida/mana ao matar.",
      pontos: ["Leech recupera um % do dano causado ao longo do tempo.", "Mana regenera {c.manaRegenPorSeg}% por segundo de base.", "Charms disparam sozinhos em situações (ex.: ao ser congelado) — ganhe slots extras na campanha."], wiki: "Life_leech" },
    { id: "stun", cat: "Defesa", ico: "😵", titulo: "Atordoamento (stun)",
      resumo: "Stun leve interrompe; o pesado é uma barra de acúmulo que te deixa parado. Morrer travado é a causa nº 1 de morte em melee.",
      pontos: ["Aumente o limiar de stun (nós de vida/armadura) ou use Unwavering Stance (não sofre stun leve, mas perde o dodge roll).", "Pathfinder não sofre stun pesado enquanto corre."], wiki: "Stun" },

    { id: "console", cat: "PS5 / Controle", ico: "🎮", titulo: "Jogando no controle (PS5)",
      resumo: "No controle você tem menos botões diretos que no teclado (no PC são 13 slots; parte só com modificador). Builds com 1–2 botões principais rendem mais.",
      pontos: [
        "Buffs persistentes (auras, heralds, companheiros) não ocupam botão depois de ligados.",
        "Meta gems/triggers (Cast on Critical, Cast on Shock) disparam skills sozinhas — menos botões.",
        "Canalização (segurar) é confortável; skills de alvo no chão ou de combo com timing pedem mais precisão.",
        "Projéteis e área ampla perdoam a mira automática do controle.",
        "Regra prática do app: até 5 skills ativas de botão = confortável; 6–8 = exige modificador; 9+ = cansativo."
      ], wiki: "Controller" }
  ],

  /* ---------------- Classes ---------------- */
  classes: {
    Warrior:  { pt: "Guerreiro", arma: "Maças", estilo: "Corpo a corpo pesado, slams, armadura e vida." },
    Mercenary:{ pt: "Mercenário", arma: "Bestas (crossbow)", estilo: "Munições, granadas, tiro e versatilidade STR/DEX." },
    Ranger:   { pt: "Patrulheira", arma: "Arcos", estilo: "Projéteis, evasão e mobilidade." },
    Huntress: { pt: "Caçadora", arma: "Lanças (+ buckler)", estilo: "Lança corpo a corpo e de arremesso, companheiros." },
    Monk:     { pt: "Monge", arma: "Cajados (quarterstaff) e punhos", estilo: "Corpo a corpo rápido, elemental, combos." },
    Sorceress:{ pt: "Feiticeira", arma: "Cajado/varinha + foco", estilo: "Feitiços elementais, ES." },
    Witch:    { pt: "Bruxa", arma: "Cetro/varinha + foco", estilo: "Minions, caos, fogo, maldições." },
    Druid:    { pt: "Druida", arma: "Talismãs", estilo: "Transformações (urso, lobo, wyvern), plantas e tempestades." },
    Duelist:  { pt: "Duelista", arma: "Espadas", estilo: "Chega no 1.0 (11/12/2026).", futuro: true }
  },

  /* ---------------- Ascendências (resumo em PT + afinidades com tags de skill) ---------------- */
  ascendencias: {
    "Deadeye":            { resumo: "Mestre de projéteis: +1 projétil em TODAS as skills, Tailwind (velocidade), cargas de Frenesi turbinadas e marcas que aplicam Fraqueza Crítica.", afin: ["projectile", "mark", "attack", "chaining"], def: "evasao" },
    "Pathfinder":         { resumo: "Venenos e frascos: dobra os venenos simultâneos no alvo, frascos de vida sem fila, metade da evasão vira redução de dano elemental, imune a lentidão.", afin: ["chaos", "projectile", "duration"], def: "evasao" },
    "Amazon":             { resumo: "Precisão vira crítico e dano físico; 50% more dano contra Fraqueza Aberta (raros/únicos); leech também com dano elemental; surges elementais ao consumir cargas.", afin: ["attack", "melee", "projectile", "lightning"], def: "evasao" },
    "Spirit Walker":      { resumo: "Companheiros e espíritos de Azmeri: companheiros ganham 60% do dano da sua arma, penas de coruja no dodge roll, Vivid Stampede (cervos) e feras únicas domadas.", afin: ["companion", "minion", "wind", "projectile"], def: "evasao" },
    "Ritualist":          { resumo: "Rituais e acessórios: +1 slot de anel, +25% nos bônus de anéis/amuleto, +1 charm, Blood Boil e Ritual Sacrifice. Escala muito com equipamento.", afin: ["attack", "physical", "duration"], def: "evasao" },
    "Titan":              { resumo: "Gigante dos slams: 15% more vida, 50% more armadura do peitoral, aftershocks extras, Crushing Blows e 25% more dano contra atordoados.", afin: ["slam", "melee", "physical"], def: "armadura" },
    "Warbringer":         { resumo: "Totens, gritos e quebra de armadura: armadura totalmente quebrada aumenta TODO dano recebido, gritos sem cooldown, bloqueio fixo de 35%, totem que absorve dano.", afin: ["totem", "warcry", "slam", "physical"], def: "armadura" },
    "Smith of Kitava":    { resumo: "Ferreiro: personaliza o peitoral (vida, resistências, armadura vs elemental/caos, imune a ailments de dano), feitiço de fogo no hit, Temper Weapon e Manifest Weapon.", afin: ["melee", "fire", "strike", "slam"], def: "armadura" },
    "Tactician":          { resumo: "Comandante: buffs persistentes reservam 50% menos espírito, totens de artilharia, banners sem limite, Pin com projéteis, deflexão a partir da armadura.", afin: ["ammunition", "projectile", "totem", "banner", "grenade"], def: "armadura" },
    "Witchhunter":        { resumo: "Caçador: Culling Strike, Decimating Strike, explosões ao matar, quebra a Concentração do inimigo (até 40% more dano), Sorcery Ward e pontos extras de set de arma.", afin: ["ammunition", "attack", "physical", "grenade"], def: "armadura" },
    "Gemling Legionnaire":{ resumo: "Gemas: requisitos atendidos pelo maior atributo, bônus de atributo dobrados, efeitos extras de qualidade e bônus por cor de suporte. Ótimo para misturar cores.", afin: ["attack", "spell", "projectile", "ammunition"], def: "hibrido" },
    "Invoker":            { resumo: "Elemental de cajado: críticos ignoram resistência elemental não-negativa, ganha frio/raio extra, Elemental Expression em crit melee, meta gems com 35% mais energia.", afin: ["lightning", "cold", "melee", "strike", "invocation"], def: "evasao" },
    "Acolyte of Chayula": { resumo: "Escuridão e caos: troca espírito por Darkness (escudo extra), resistência ao caos dobrada, leech com caos, Volatility e Archon of Chayula.", afin: ["chaos", "melee", "strike"], def: "evasao" },
    "Martial Artist":     { resumo: "Mestre de combos: combo extra, combo de qualquer ataque, runas tatuadas (soquetes extras), luvas viram Fists of Stone e técnicas Hollow.", afin: ["melee", "strike", "attack", "area"], def: "evasao" },
    "Stormweaver":        { resumo: "Tempestades: Arcane Surge permanente, dois choques e dois chills no alvo, todo dano conta para choque/chill, +2 no limite de skills elementais, Elemental Storm em crit.", afin: ["spell", "lightning", "cold", "storm", "remnant"], def: "es" },
    "Chronomancer":       { resumo: "Tempo: 20% de chance de Echo/Repeat em feitiços, toma 30% menos dano agora (parte vem depois), lentidão em volta, Time Freeze/Time Snap/Temporal Rift.", afin: ["spell", "repeatable", "area"], def: "es" },
    "Disciple of Varashta":{ resumo: "Invoca os djinns (Baryas) Kelari, Navira e Ruzhan com skills próprias; ES vira armadura, recarga de ES mais rápida, dano elemental sai da mana primeiro; foco + cajado.", afin: ["spell", "minion", "area"], def: "es" },
    "Infernalist":        { resumo: "Fogo infernal: troca mana por Infernal Flame, Demon Form, Cão Infernal, todo dano contribui para ignição, crit com 50% more bônus (queima você), espírito a partir da vida.", afin: ["fire", "spell", "minion"], def: "vida" },
    "Blood Mage":         { resumo: "Sangue: skills custam vida, feitiços com 15% de crítico base, 20% do dano de feitiço vira leech, bônus de crit por vida atual, sangramento com dano elemental.", afin: ["spell", "physical", "chaos"], def: "vida" },
    "Lich":               { resumo: "ES e maldições: vida não muda com ES, maldições infinitas e +1 maldição, Unholy Might, feitiços que sacrificam ES causam 30% more dano, Power Charge = 40% more.", afin: ["chaos", "spell", "curse", "minion"], def: "es" },
    "Abyssal Lich":       { resumo: "Variante abissal da Lich (mesmas bases de ES e maldições) com Abyssal Apparition ao consumir cargas, explosões físicas e oferendas que afetam você.", afin: ["spell", "curse", "minion", "physical"], def: "es" },
    "Oracle":             { resumo: "Destino: aloca nós perto de keystones sem conexão, críticos inevitáveis, dano dos inimigos “unlucky”, mana absorve dano, totens extras.", afin: ["spell", "plant", "totem", "cold"], def: "hibrido" },
    "Shaman":             { resumo: "Fúria primal: Rage dá more dano de feitiço, adaptações elementais reduzem dano, exposição nos inimigos próximos, espírito por charm vazio, Apocalypse.", afin: ["spell", "shapeshift", "storm", "plant"], def: "hibrido" }
  },

  /* ---------------- Ferramentas (slides "Build Making Tools") ---------------- */
  ferramentas: [
    { nome: "Path of Building 2 (PoB2)", ico: "🧮", url: "https://pathofbuilding.community/",
      para: "A calculadora completa: árvore, itens, gems e DPS/EHP exatos. É a fonte dos dados deste app.",
      celular: "Só roda no PC. No celular: abra builds pelo pobb.in ou cole o código PoB aqui (Builds → Importar PoB)." },
    { nome: "pobb.in", ico: "🔗", url: "https://pobb.in/",
      para: "Compartilhar e ver builds do PoB no navegador (árvore, itens, gems).",
      celular: "Funciona bem no celular. Copie o código PoB da página e cole aqui para a análise." },
    { nome: "poe.ninja (builds)", ico: "📊", url: "https://poe.ninja/poe2/builds",
      para: "O que o ladder está jogando AGORA: % de cada ascendência, skills, itens. É o termômetro do meta real.",
      celular: "Filtre por skill/ascendência; abra um personagem para ver gems/itens e exportar o código PoB." },
    { nome: "PoE2DB", ico: "🗄️", url: "https://poe2db.tw/us/",
      para: "Banco de dados do jogo: gems com números por nível, modificadores, bases, únicos, patch notes.",
      celular: "Use para checar números exatos e de onde vem cada coisa." },
    { nome: "Wiki do PoE2", ico: "📖", url: "https://www.poe2wiki.net/",
      para: "Mecânicas explicadas (resistência, armadura, ailments…), páginas de skills e únicos.",
      celular: "Cada tópico daqui tem link direto para a página da wiki." },
    { nome: "Maxroll", ico: "📘", url: "https://maxroll.gg/poe2/build-guides",
      para: "Guias detalhados com progressão (campanha → endgame) e planner.", celular: "Bom para seguir passo a passo." },
    { nome: "Mobalytics", ico: "📗", url: "https://mobalytics.gg/poe-2/builds",
      para: "Guias de criadores e tier lists.", celular: "Bom para ideias e variantes." },
    { nome: "r/PathofExile2Builds", ico: "💬", url: "https://www.reddit.com/r/PathofExile2Builds/",
      para: "Comunidade: ideias fora do meta, perguntas, builds de único.", celular: "Pesquise o nome da skill + ascendência." }
  ]
};
