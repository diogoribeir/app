# Guia dos Apps — Di & Tati (leia isto primeiro)

Este repositório hospeda **6 apps** do casal Di (Diogo) & Tati, publicados juntos no GitHub Pages.
(O App 2 — 📊 Roteiro Paris, o do Diogo, `roteiro-paris/` — foi **removido em ago/2026**; segue no
histórico do git. Não confundir com o App 3 — ✈️ Paris Trip Planner, o da Tati, `paris-planner/`.)
Este arquivo é o contexto completo para qualquer sessão nova do Claude: estrutura, Firebase,
como atualizar cada app e como publicar. **Responda sempre em português (BR).**

> 🧱 **APP NOVO — instrução para o Claude:** quando o Diogo pedir para criar um app novo (ou mexer no
> deploy/sincronização de um app), **LEIA o arquivo `RECEITA-APPS.md` (raiz) e siga a receita de lá** —
> não pergunte onde está a receita nem peça pra ele anexar nada; o arquivo já está no repositório.
> `RECEITA-APPS.md` = **arquivo único** com o catálogo de todos os apps + a receita completa (pasta →
> deploy no Pages → sincronização no Firebase, com código pronto e checklist). **Manter a tabela do
> catálogo atualizada ao criar/alterar apps.** (Não há mais `docs/NOVO-APP.md` — tudo ficou aqui.)

---

## Visão geral da infraestrutura

| Peça | O quê | Onde |
|---|---|---|
| **GitHub (código + site)** | Repositório `diogoribeir/app`, branch principal `master` | https://github.com/diogoribeir/app |
| **Site (GitHub Pages)** | Publicado pelo workflow do Actions | https://diogoribeir.github.io/app/ |
| **Firebase (Google)** | Projeto **`apps-4b887`** — banco de dados dos apps (Firestore + Realtime Database) | https://console.firebase.google.com/project/apps-4b887 |
| **Vercel** | ❌ **Não é mais usado** (ago/2026). O Lingo era o único app no Vercel; foi migrado para o GitHub Pages (site estático, sem servidor). O projeto `lingo` no Vercel pode ser removido — **todos** os apps ativos rodam agora no GitHub Pages | — |

### Como funciona o deploy
- O workflow `.github/workflows/deploy-pages.yml` roda **a cada push no `master`** (ou manualmente:
  aba **Actions → "Publicar apps no GitHub Pages" → Run workflow**).
- Ele monta o site assim: raiz → `home/` (página inicial com a lista de apps) · `/dias-sem-doenca/` →
  `dias-sem-doenca/` · `/paris-planner/` → `paris-planner/` · `/perfil-gamer/` → `perfil-gamer/` · `/poe2-builds/` → `poe2-builds/` ·
  `/lingo/` → build estático de `lingo-src/` (Next.js exportado; o workflow roda `npm ci && npm run build`
  com `NEXT_PUBLIC_BASE_PATH=/app/lingo` e copia `lingo-src/out/`).
- Fluxo de trabalho do Claude: **branch → commit → push → PR → merge no `master`** (o Diogo autoriza o
  Claude a mergear via ferramentas do GitHub). Depois do merge, verificar que o run terminou `success`.
- O site atualiza ~1 min após o deploy (o cache do celular pode segurar alguns minutos).

---

## App 1 — 🩺 Dias sem Doença (Di & Tati)
- **URL:** https://diogoribeir.github.io/app/dias-sem-doenca/
- **Pasta:** `dias-sem-doenca/` — HTML/CSS/JS puro, PWA (manifest + service worker `sw.js`).
- **O que faz:** conta dias sem doença de cada um + placar do casal; registrar doença zera o contador
  da pessoa e guarda no histórico; recuperação reinicia a contagem; backup exportar/importar no menu ⋯.
- **Sincronização:** Realtime Database via REST, nó **`planos/dias-sem-doenca-dt2026`** — **sem login**
  (mesma receita 1 dos outros). localStorage é a cópia offline; recarrega ao voltar se houver gravação nova.
- **Edição de registros:** histórico com ✏️ (corrigir nome/observação/datas) e link "corrigir" na doença
  atual (ajusta sem zerar contador).
- **Períodos saudáveis:** ao registrar uma doença que zera o contador, o tempo sem doença que acabou de
  encerrar (ex.: 32 dias) é guardado **automaticamente** em `people.<id>.wellRecords[]` (`{from,to,illness}`)
  e listado numa seção `#wellHistory` embaixo dos cards (por pessoa, ordenado do mais recente, com ✕ para
  excluir). **Back-fill:** `migrate()` reconstrói o período que faltou de quem está doente agora
  (`streakStart → illness.startedAt`) — assim doenças registradas antes desta lógica existir aparecem sem
  entrada manual; é idempotente (mesmo formato do registro automático, não duplica no reload).
  A seção fica sempre visível e ainda tem **➕ Adicionar** (modal `#wellAddModal`: pessoa + nº de dias +
  data fim + doença) para registrar períodos antigos manualmente — calcula `from = fim − dias`.
- **Desfazer:** as ações dos cards ("Ficou doente", "Sarou", "corrigir doença") guardam um snapshot do
  estado antes de mudar e mostram a barra flutuante `#undoBar` ("↩︎ Desfazer", some em 15s) — para o caso
  de clicar no botão errado. `pushUndo(label)`/`hideUndo()` no `app.js`; restaura o snapshot e sincroniza.
- **Migração jul/2026:** antes usava Firestore + login; os dados antigos seguem no Firestore
  (`casal/estado`) como backup. Authentication/Firestore podem ser desativados no console se quiser.
- **Edição:** direto nos arquivos da pasta. Ao mexer no `app.js`/`styles.css`/`index.html`, regenerar o
  arquivo único com `python3 dias-sem-doenca/build-standalone.py` e subir a versão de cache no `sw.js`
  (`CACHE = "dias-sem-doenca-vN"`).

## App 7 — 🏆 Placar do Casal (Di & Tati) — *gamificação*
- **URL:** https://diogoribeir.github.io/app/casal-pontos/
- **Pasta:** `casal-pontos/` — HTML/CSS/JS puro, PWA (manifest + `sw.js`). 3 abas via nav inferior:
  🏆 **Placar** · 🎁 **Loja** · 📊 **Stats**.
- **O que faz:** jogo de pontos do casal. Quando um **vacila**, o **parceiro ganha pontos**; os pontos
  são gastos na **loja** (resgatar recompensas: dia saudável, refeição saudável, cinema, Zara… editáveis)
  ou num **ataque** (⚔️ gastar seus pontos para descontar a mesma quantia do parceiro — os dois podem).
- **Combo / Double Damage:** vacilar seguidas vezes multiplica os pontos que o parceiro ganha —
  a partir de **3 seguidas** (padrão x2) e **5 seguidas** (padrão x3), configurável no menu ⋯ →
  “Regras de combo”. Banner de combo no topo do Placar e badge 🔥 no feed.
- **Fonte da verdade = LOG DE EVENTOS (append-only).** Os saldos de pontos são **sempre calculados**
  a partir dos eventos (`vacilo`/`resgate`/`ataque`), então gravações simultâneas dos dois **não brigam
  pelo mesmo número** — cada evento é uma chave própria (`PUT` idempotente). Recompensas, tipos de vacilo
  e config (nomes/combo) são chaves à parte.
- **Acesso por CÓDIGO SECRETO (não é o esquema de nó fixo dos outros apps):** ao abrir pela 1ª vez o app
  mostra um **portão** (`#gate`) pedindo um código que o casal combina. O nó do banco é **derivado do
  código** (`planos/casal-<hash cyrb53>`, `nodeFromCode()`/`setupSync()` no `app.js`) — sem o código não
  dá pra achar nem ler os dados. O código fica em `localStorage` (`casalpontos:code`) e o state/outbox são
  namespaced por nó. Trocar o código: menu ⋯ → "🔑 Trocar código secreto". Código normalizado (trim +
  minúsculas). ⚠️ **Depende da regra do Firebase que bloqueia ler `/planos` inteiro** (só nós filhos
  conhecidos são legíveis) — ver `FIREBASE-RULES.md`; sem ela, alguém que leia `/planos.json` ainda
  enxerga tudo (buraco que afeta todos os apps). Segurança real dependeria de login (não usado aqui).
- **Sincronização:** Realtime Database via REST (Receita 1), nó derivado do código (acima) — sem login.
  localStorage é a cópia offline + **outbox** (reenvia o que falhou offline). Recarrega ao voltar
  e faz **polling a cada 7s** (via `_at`) para refletir o que o outro registrou (acesso simultâneo).
- **Estatísticas:** cards (saldo de cada um, total de vacilos, maior combo) + gráficos SVG/CSS sem libs:
  vacilos por pessoa, vacilos por motivo, onde os pontos foram gastos e evolução dos pontos (linha).
- **Backup/opções:** menu ⋯ = editar nomes, regras de combo, compartilhar placar, exportar/importar `.json`,
  zerar placar (apaga só o histórico/pontos; mantém recompensas e tipos). Barra **↩︎ Desfazer** nas ações.
- **Edição:** direto nos arquivos da pasta. Ao mexer no `app.js`/`styles.css`/`index.html`, **subir a
  versão do cache** no `sw.js` (`CACHE = "casal-pontos-vN"`), senão o celular segura a versão antiga.
  Ícones em `casal-pontos/icons/` (troféu dourado + coração azul/rosa), gerados via Chromium headless.

## App 2 — 📊 Roteiro Paris (o do Diogo) — ❌ REMOVIDO (ago/2026)
- Estava em `roteiro-paris/` (arquivo único). O Diogo pediu para deletar. Código no histórico do git
  (`git log -- roteiro-paris/`). **Não confundir com o App 3 (o da Tati), que continua ativo.**

## App 3 — ✈️ Paris Trip Planner (o da Tati, React)
- **URL:** https://diogoribeir.github.io/app/paris-planner/
- **Pastas:** `paris-planner-src/` (fonte Vite + React + Tailwind + lucide-react) e
  `paris-planner/` (o build publicado — index.html + assets/).
- **Fonte da verdade (ago/2026 em diante):** o **repositório** é oficial. A Tati **não exporta mais**
  o artifact do claude.ai dela — as mudanças de conteúdo/funcionalidade agora são feitas **direto em
  `paris-planner-src/src/App.jsx`** e publicadas daqui (pode editar horários, textos, dados `default*`
  etc. quando o Diogo pedir). Histórico: o app nasceu do `paristripplanner.tsx` (~3700 linhas) que ela
  exportava; o fluxo de importação de um `.tsx` novo continua documentado abaixo só para o caso de um dia
  chegar outro arquivo, mas o **padrão passou a ser editar no repositório**.
- **Sincronização:** Realtime Database via REST, nó **`planos/paris-planner-dt2026`** — o app carrega os
  dados da nuvem ao abrir, salva ao mudar, e recarrega ao voltar se houver gravação mais nova. localStorage
  é a cópia offline. ⚠️ **A nuvem é a fonte da verdade dos dados em runtime:** os arrays `default*` no
  código são só o *seed* inicial — se o nó da nuvem já tiver dados salvos (itinerário, orçamento etc.),
  editar o `default*` **não muda o que aparece no celular**; nesse caso, ou a edição é feita no app (que
  grava na nuvem) ou é preciso apagar/atualizar a chave correspondente no nó da nuvem pra o novo seed valer.
- ☀️ **Cronograma x nascer do sol:** os passeios ao ar livre de manhã cedo (ex.: Rue de Camoëns e Louvre
  externo, 07:30) já estão calibrados pro nascer do sol de Paris em setembro (~07:20-07:30, calculado via
  NOAA) — chegando 07:30 já há luz de verdade, nenhum passeio começa no escuro. Ao mexer em horários de
  manhã, conferir o nascer do sol da data antes de marcar passeio ao ar livre.

### 🔁 FLUXO DE IMPORTAÇÃO do App 3 (histórico — só se um dia chegar um `.tsx` novo da Tati)
1. Copiar o conteúdo do `.tsx` novo para `paris-planner-src/src/App.jsx`.
2. **Trocar o bloco de storage**: localizar `async function loadKey` / `saveKey` (que usam
   `window.storage`) e substituir pelo bloco com `SYNC_URL` (copiar do `App.jsx` atual do repositório
   antes de sobrescrever, ou do histórico do git). `SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/paris-planner-dt2026"`.
   Conferir que não sobrou `window.storage` no arquivo.
3. Compilar: `cd paris-planner-src && npm install && npm run build`
4. Publicar o build: `rm -rf ../paris-planner/assets ../paris-planner/index.html && cp -r dist/. ../paris-planner/`
5. Testar antes (ver "Convenções" abaixo), commit, push, PR, merge → Pages republica.
- ⚠️ `paris-planner-src/vite.config.js` tem `base: "/app/paris-planner/"` — se o
  repositório for renomeado um dia, **atualizar essa base** e recompilar.

## App 4 — 🎮 Perfil (o do Diogo) — *era "Perfil Gamer" até set/2026*
- **URL:** https://diogoribeir.github.io/app/perfil-gamer/
- **Pastas:** `perfil-gamer/` (app publicado: `index.html` + `dados.js` gerado) e
  `perfil-gamer-src/` (dados mestres: `biblioteca_jogos.xlsx` + geradores + docs).
- **O que faz:** biblioteca de jogos PS4/PS5 com veredictos estilo ACG (Masterpiece → Muito Ruim),
  3 abas: 🎮 Jogos (busca sempre visível + painel de filtros **recolhível** `⚙ Filtros` — recolhido por
  padrão p/ dar espaço à lista no celular; quando recolhido mostra a ordenação atual e os filtros ativos
  como chips; veredicto/status/**ano de lançamento**/ordenação dentro do painel) ·
  📊 Estatísticas (distribuição, tempo total jogado, top horas com filtro por veredicto, por gênero,
  motivos de drop) · 🗓 Plano 2026.
- **PWA:** instalável (manifest + `sw.js` network-first) e abre offline; ícones `icon-192/512.png`
  gerados por canvas. Menu **⋯** no cabeçalho = backup exportar/importar (`.json` com jogos + plano).
- **Jogatinas (playthroughs):** cada jogo pode ter mais de uma jogatina (rejogar/NG+) — guarda-se as
  **horas**, o **ano jogado** e o **status** de cada uma: a 1ª é o campo `horas`/`anoJog`/`enc` base e as
  demais ficam em `g.runs[]` (`{horas, anoJog, enc}`). **O veredicto é único por jogo; o status é por
  jogatina** (set/2026) — dá pra ter dropado o W1 e estar jogando o W2 (ex.: Kingdom Come 2) sem que um
  apague o outro. Botão "🔁 Nova jogatina" no card e no Editar (pede horas + ano + status); o card mostra
  "🔁 W1 ❌16h · W2 🔄12h". Horas totais e estatísticas somam todas as jogatinas.
  Helpers: `runHoras/totalHoras/runsResumo` · **status:** `runStatus(g)` (lista `[W1, W2, …]`, `enc`
  ausente numa run = `"S"`), `temStatus(g,e)` (alguma jogatina nesse status) e `statusJogo(g)`
  (status principal, prioridade **jogando > zerado > dropado**).
  Onde cada um vale: **`temStatus`** → seção "Jogando agora" (qualquer jogatina em andamento destaca o
  jogo), filtro de status (dropado acha o jogo mesmo se só o W1 foi dropado), ❌ no Top 10, motivo do
  drop, lista de motivos, "faltam Xh" do Plano · **`statusJogo`** → o texto do card e os contadores de
  zerados/dropados. O ▶️ "estou jogando" do Plano **abre uma jogatina nova** (`{horas:0, enc:"#"}`) em vez
  de sobrescrever `g.enc`. (Não há campo Observação.)
  - ⏸️ **Pausado (`"P"`, out/2026):** 4º status de jogatina. `statusJogo` = jogando > **pausado** > zerado >
    dropado; `emAberto(g)` = jogando **ou** pausado (ainda tem horas no Plano: `pfaltaH`, `pitemPendente`,
    `pjogadasAtual`, `jogadoEmAndamento`). Pausado **não** aparece em "Jogando agora". Mandar um item do
    Plano pro **📥 backlog pausa** a jogatina "jogando" do jogo (`pausarJogo(pjogoDoItem(p))` — liga por jid
    ou nome, mesmo sem ▶️); o **▶️ retoma** a jogatina pausada em vez de abrir outra. Migração única
    `migBacklogPausa` pausou o que já estava no backlog (ex.: FF Resonance).
- **Ano jogado (`g.anoJog` / `run.anoJog`):** ano em que cada jogatina foi jogada — **diferente do ano de
  lançamento** (`g.ano`), pois dá pra rejogar o mesmo jogo em anos distintos (ex.: Death Stranding 2 —
  W1 num ano, W2 em 2026). Editável no card (campo "🎮 Joguei em (ano)" p/ o W1 + input de ano em cada
  jogatina W2+) e no "➕ Registrar jogo". A aba 🎮 **Jogos** tem o filtro **"🎮 Joguei no ano"** no painel
  `⚙ Filtros` (`fAnoJog`, chips por ano via `anosJogadosDisp()`): um jogo entra se **qualquer** jogatina
  bater o ano (helper `anosDoJogo(g)`). Só ano de jogatina, não confundir com o filtro "📅 Ano de
  lançamento" (`fAno`).
- **Filosofia (respeitar):** veredicto categórico, NUNCA notas numéricas na interface;
  componentes H/G/D/FF discretos como "análise interna". Detalhes em `perfil-gamer-src/README.md`.
- **EDITÁVEL no app** (igual aos outros): botão "➕ Registrar jogo" (modal). **Editar é inline no card**:
  tocar no jogo expande o card já como editor (nome, ano, horas W1, status, veredicto, gêneros,
  motivo, jogatinas W2+, análise interna, Excluir) — salva ao sair de cada campo, sem abrir janela.
  A aba 🗓 **Plano** é editável: cada jogo planejado tem **nome + estimativa de horas + data
  (calendário) + ano**; a fila fica **ordenada por data**.
  - 📅 **Filtro por ano + Geral + rollover (set/2026):** o Plano tinha jogos de 2026 e 2027 misturados na
    mesma fila e num único "disponível" até dez/2027. Agora tem **chips no topo** (`.anochip`, estado
    `planoAno`, handler `data-pano`): **Geral** (`planoAno="geral"` → tudo junto, como era antes) + um chip
    por ano. Num ano, a aba mostra **só aquele ano**: horas **disponíveis** dele (`horasDisponiveisAno(ano)`
    = semanas cuja segunda cai no ano), **falta na fila** e **fila** só dos itens do ano, e o painel ⚙️ só
    com os meses do ano; no **Geral** volta tudo (`horasDisponiveis()`, todas as semanas/itens). `anoFoco()`
    = `planoAno` (`"geral"` ou nº) ou o ano atual `ANO_HOJE`. A aba **abre sempre no Geral** (`planoAno = "geral"` inicial, out/2026).
    - **Ano de cada item:** `anoDoItem(p)` = pela `data`; sem data, pelo campo `p.ano`; senão `ANO_HOJE`.
      ⚠️ **Jogo sem data de lançamento** ainda precisa de um **ano** (não necessariamente 2026): o modal tem
      o campo **Ano** (`#pAno`, preenchido pela data ou à mão) e o `#pSave` grava `p.ano`.
    - **🔄 Rollover automático (`anoFila(p)`):** um item cujo ano já passou **e que ainda não terminou**
      (`pitemPendente` = não começou, ou está jogando; zerado/dropado = concluído) **rola pro ano atual** —
      ex.: o que sobrou de 2026 aparece em 2027 sozinho quando o ano vira, marcado **"↪ de 2026"** no card
      (`.prolou`). O filtro por ano e os chips usam `anoFila` (não `anoDoItem`), então as horas a completar
      passam a contar contra o ano novo. Backlog também rola (segue fora da conta até voltar pra fila).
      Helpers de módulo: `plinked`/`pjogadasAtual`/`pfaltaH`/`pitemPendente` (o `viewPlano` reusa).
    - Migração única **`migPlanoAno`** carimba `p.ano` nos itens que já existiam (pela data; os 3 sem data
      do lote de 2027 — Lord of the Fallen 2/Kena 2/Tides of Annihilation — viram 2027; o resto, ano atual).
    - **🎮 Horas jogadas descontam da semana (set/2026):** as horas registradas nas **jogatinas em andamento**
      (status `"#"`) descontam da **capacidade da semana atual**. Mecânica de **marco por semana** (`SB` =
      `{wk:"<segunda ISO>", base}`, salvo no `plano2026.semBase`): no começo de cada semana o `ensureSemBase()`
      (chamado no fim do `boot()`) fotografa o total em andamento (`jogadoEmAndamento()` = soma de `pjogadasAtual`
      dos jogos `"#"`); `jogadoSemana()` = quanto subiu desde o marco. O `viewPlano` desconta esse valor do
      **disponível** (só quando a semana atual está no escopo — ano atual ou Geral), limitado à capacidade da
      própria semana (`descontoSem = min(jogado, defAtual)`). A **semana em curso** no painel ⚙️ mostra
      "🎮 joguei Xh · restam Yh" (`.wkjog`, linha `.wkatual`) e o card mostra a nota. ⚠️ O que **não for usado**
      na semana é **perdido** quando ela passa (o marco reancora e o "jogado" zera); registrar um jogo antigo já
      finalizado **não** conta (só jogatina em andamento).
    - **⚖️ Peso por dia (`PESO_DIA`, set/2026):** as horas da semana **não** se espalham iguais — `horasDoDia`
      distribui pelo peso do dia (`[Dom,Seg,Ter,Qua,Qui,Sex,Sáb] = [1,1,1.6,1.6,1.6,1,1]`, ter–qui mais pesado),
      normalizado por `SOMA_PESO` (semana cheia continua somando `padraoSemana`; só muda a divisão por dia e a
      semana parcial). `PERIODOS` são absolutos por dia e ignoram o peso. Editável no código (constante).
      As **horas disponíveis** vão de hoje até
  **31/dez/2027** (`PLANO_FIM`): cada semana vale um **padrão editável** de horas — `padraoSemana`, que começa em
  `HORAS_SEMANA` (**7** desde set/2026, o padrão de fábrica p/ o ↺) — com exceções por dia (`PERIODOS`: 21–24/set 10h/dia;
  sem jogatina 10–19/set) e horizonte `PLANO_FIM`. O painel recolhível **⚙️ Ajustar horas por semana**
  (`details.wkbox`, estado `wkOpen`) tem **3 níveis**, do mais amplo pro mais específico:
  **(1) padrão global** `padraoSemana` (`#padSemana`) → vale pra tudo · **(2) mês** `HM`
  (`{ "AAAA-MM": nº }`, input `data-mes`) → "todas as semanas deste mês valem X" — ao gravar, **apaga os `HS` das
  semanas daquele mês** (chave = segunda no mês), senão os ajustes soltos antigos venciam o mês; a semana que vira o
  mês volta pro cálculo dia a dia (cada dia na taxa do seu mês) · **(3) semana solta**
  `HS` (`{ "<segunda ISO>": nº }`, input `data-wk`) → vence os outros dois. Cada nível tem ↺
  (`data-padreset`/`data-mesreset`/`data-wkreset`). ⚠️ Os níveis 1 e 2 entram pela **taxa diária** no
  `horasDoDia(iso)` (`PERIODOS` > `HM[mês]/7` > `padraoSemana/7`), então semana parcial, virada de mês e
  os `PERIODOS` saem certos de graça; só o `HS` é um valor de semana fechado. Com o horizonte até
  dez/2027 são ~69 semanas, então as linhas ficam **agrupadas por mês** em `details.mesbox` (chave =
  mês da segunda; só o mês atual abre no 1º render, estado em `mesOpen`), cada um com o total e um
  resumo — sem isso viram um paredão de linhas no celular. O total "disponível" recalcula sozinho e o
  app mostra se a fila cabe (sobra/falta). Cada
  item tem **▶️ "estou jogando"**, que marca o jogo como *jogando agora*: ele vira o card do topo da aba
  Jogos e entra na biblioteca; o "falta na fila" desconta as horas já jogadas desse jogo (estimativa −
  horas). Na aba 📊
  **Estatísticas**, a seção **"⏱ Horas por jogo"** (id `top`) lista **todos** os jogos do filtro (não só top 10),
  ordenados por horas, com **❌** nos dropados. Dois filtros: **veredicto** (chips `data-statver`, estado `statVer`)
  e **status** (chips `data-statstatus`, estado `statStatus`: `""` geral · `"S"` zerados · `"N"` dropados, via
  `statusJogo(g)`). No topo um strip mostra **jogos · média/jogo · total** — a **média** conta só jogos com
  `totalHoras>0` (jogo não jogado não abaixa a média), e o filtro de status evita que zerado/dropado sujem a média.
  A antiga seção **"Por gênero"** foi **removida** (set/2026 — os `genres` do xlsx estão inconsistentes e
  distorciam; uma tentativa de "Conclusão por veredicto" no lugar foi descartada por ser óbvia — melhor veredicto
  termina mais). As Estatísticas hoje são: **Distribuição** · **Horas por jogo** · **Drops**.
- **Nome (set/2026):** o app se chama **"Perfil"** (era "Perfil Gamer") — `<title>`, `<h1>`, `manifest.json`
  (`name`/`short_name`), `apple-mobile-web-app-title` e o card da `home/index.html`. ⚠️ **A pasta, a URL
  (`/app/perfil-gamer/`) e o nó do Firebase (`planos/perfil-gamer-dt2026`) continuam com o nome antigo** —
  renomear quebraria o link salvo no celular e a sincronização; só mexer nisso se o Diogo pedir.
- **Dia que passou não conta:** a semana em curso vale só de **hoje em diante**. `semanasPlano()` soma
  `horasDoDia` de `w.de` (= hoje, na semana atual; a segunda, nas futuras) até `w.ate`, e devolve
  `def` (horas), `dias` e `parcial`. `horasDaSemana(w)` = ajuste manual (`HS`) ou `def`; `horasDisponiveis()`
  soma isso. O rótulo da linha usa `w.de`→`w.ate`, então **bate com o valor do input** (ex.: numa quarta,
  "9–13/set · resto da semana · 5d"), e o ajuste manual dessa semana também vale para os dias restantes.
  ⚠️ Não rotular a linha com a semana cheia (segunda→domingo): o Diogo leu isso como "está contando um dia
  que já passou". Como a soma é por dia via `horasDoDia`, os `PERIODOS` continuam valendo.
- **Backlog do Plano (`p.backlog`):** cada item da fila tem **📥** para mandar pro backlog e **↩️** para
  voltar — um toque, sem confirmação, e o item continua guardado com data/estimativa. Item no backlog
  **não entra no `somaEst`** (some do "falta na fila" e da barra), sai da fila principal e aparece numa
  seção recolhível `details.bkbox` embaixo ("📥 Backlog · N jogos · fora da conta", estado `bkOpen`),
  com o texto "não conta no planejamento" e sem o ▶️. A flag é `delete`ada ao voltar (não fica `false`
  sujando a nuvem). Renderização: helper `pItem({p,i})` desenha os dois casos; `ativos`/`naBacklog`
  saem do mesmo `fila` já ordenado por data. ⚠️ `bkOpen` começa **aberto**: com ele fechado o Diogo
  achou que um jogo tinha sumido do plano (o 📥 fica ao lado do ✏️ e é fácil tocar sem querer).
  ⚠️ O `#pSave` remonta o item do zero — **tem que copiar o `backlog` do `prev`**, senão editar um jogo
  do backlog o devolve pra fila sozinho (era um bug).
- **Migração única `migPlanoAdd2027`:** 6 jogos que o Diogo pediu pra somar ao Plano (set/2026) — Fable
  23/02/27 50h · Exodus 07/04/27 30h · Final Fantasy VII Revelations 08/04/27 80h · Lord of the Fallen 2,
  Kena 2 e Tides of Annihilation sem data (35h/15h/40h). Entrou como migração porque **a nuvem é a fonte
  da verdade**: mexer no `window.PLANO` do `dados.js` não muda o que aparece no celular. Compara por nome
  normalizado antes de inserir, então não duplica o que o Diogo já tiver posto à mão, e grava o marcador
  `migPlanoAdd2027=true`. 👉 **Receita pra quando ele pedir mais jogos no plano:** copiar esse bloco do
  `boot()` com um marcador novo — não adianta editar o seed.
- **Migração única `migPadrao7`:** o padrão semanal caiu de 10h → 7h (set/2026), mas a nuvem guardava
  `padraoSemana: 10` — mudar só a constante não adiantaria. O `boot()` troca **uma vez** 10 → `HORAS_SEMANA`
  e grava o marcador `migPadrao7=true` na nuvem; se o Diogo já tiver escolhido outro valor, não mexe.
- **Sincronização:** Realtime Database via REST, nó **`planos/perfil-gamer-dt2026`** — a nuvem é a
  fonte da verdade; `perfil-gamer/dados.js` é só a carga inicial (seed). localStorage = cópia offline;
  recarrega ao voltar se houver gravação mais nova (mesma receita 1 do paris-planner). O **Plano 2026**
  (jogos planejados + padrão global + ajustes de horas por semana) sincroniza no mesmo nó, chave
  `plano2026` (`{itens, horasSemana, padraoSemana}`); `window.PLANO` do `dados.js` é só o seed inicial.
- **Ano de lançamento (`g.ano`):** cada jogo tem o ano oficial de lançamento (pesquisado na web, ago/2026)
  — usado no filtro/ordenação "📅 Lançamento" e exibido no card. Fica na coluna **Ano** do xlsx; o
  `dados.js` traz o campo no seed. Como a nuvem é a fonte da verdade,
  o `boot()` faz **backfill**: preenche `g.ano` faltante casando com o seed por id (fallback: nome
  normalizado) e regrava — idempotente. Editável no card (campo Ano) e no "➕ Registrar jogo".
- **Chips de ano (lançamento e "joguei no ano"):** anos **≥ `LEGADO_ANO` (2020)** viram chip individual;
  tudo **antes de 2020** agrupa num único chip **"Legado <2020"** (token `"lt"`) — helper `chipsAno()`,
  matcher `anoCasa()`, rótulo ativo `labelAno()`. Evita a fileira enorme de anos antigos (era PS4).
- **Migração única `migAnoJog`:** ao abrir, o `boot()` preenche `anoJog = g.ano` nos jogos de 1 jogatina
  (Avowed = 2026), pula multi-jogatina, não sobrescreve o que já tem, e grava o marcador `migAnoJog=true`
  na nuvem p/ rodar só uma vez.
- **Atualização em massa/histórico:** `perfil-gamer-src/biblioteca_jogos.xlsx` + `gerar_doc.py` +
  `gerar_dados.py` (regenera o seed). ⚠️ O seed NÃO sobrescreve a nuvem — para repor a nuvem a partir
  do xlsx é preciso apagar o nó `planos/perfil-gamer-dt2026/jogos` (o app então sobe o seed de novo).
- **Agente de apoio:** `.claude/agents/perfil-gamer.md` (psicólogo comportamental + estatístico +
  especialista em jogos) — usar para registrar jogos, propor veredictos e análises.

## App 6 — 🚗 Comparador HR-V — ❌ REMOVIDO (set/2026)
- Removido a pedido do Diogo. Código no histórico do git. Não recriar sem o Diogo pedir.
- O nó Firebase `planos/hrv-comparador-dt2026` pode ser apagado no console Firebase.

## App 5 — 🇫🇷 Lingo (curso de francês, Next.js no Vercel)
- **URL:** https://diogoribeir.github.io/app/lingo/ — hospedado no **GitHub Pages** como **site
  estático** (migrado do Vercel em ago/2026). Como o Pages não tem servidor, a rota `/api/tutor` e o
  `middleware` de senha foram **removidos**: o Tutor roda 100% no navegador via `lib/tutorCliente.ts`,
  **sempre em modo demonstração** (sem chave de API — o navegador não pode guardar segredo). Para ter
  IA de verdade no Tutor de novo seria preciso voltar a um servidor (Vercel/etc.).
- **Pasta:** `lingo-src/` (fonte Next.js 15 + React 19 + Tailwind 4; cópia da branch `claude/lingo`,
  que veio de outra sessão do Claude Code). Config de export: `next.config.mjs` tem `output: "export"`
  e usa `NEXT_PUBLIC_BASE_PATH` (o workflow passa `/app/lingo`; vazio no dev local).
- **O que faz:** curso de francês PT-BR ("gramática-ponte"), 8 capítulos/26 lições, exercícios,
  áudio pela voz do navegador, prática de fala 🎤, revisão espaçada (SRS), phrasebook, e o módulo
  **Tutor** (chat de dúvidas com Claude).
- **Regra de ouro do app:** nada de francês inventado por IA — conteúdo verificado em `data/*.json`;
  a IA só atua no Tutor, com guarda gerador→avaliador (`lib/pipeline.ts`, `lib/guardrails.ts`).
- **Variáveis de ambiente:** só `NEXT_PUBLIC_BASE_PATH` (definida pelo workflow como `/app/lingo`).
  Não há mais `ANTHROPIC_API_KEY`/`ACCESS_PASSWORD` — o Tutor é sempre demonstração e não há senha
  (site público, igual aos outros apps).
- **Sincronização (ago/2026):** Realtime Database via REST (Receita 1), nó **`planos/lingo-dt2026`**
  (`lib/nuvem.ts`). Todo o progresso (perfil, pontos/sequência, lições, cenas, SRS — as chaves
  `lingo:*` do localStorage) sobe num **pacote único** (`dados` + carimbo `_at`): carrega da nuvem ao
  abrir, reenvia a cada mudança (debounce) e recarrega ao voltar se houver gravação mais nova.
  localStorage = cópia offline. Antes disso o progresso era **só local** (sumia ao trocar de aparelho/
  domínio); agora sincroniza entre aparelhos, como os outros apps.
- **Atualização:** editar `lingo-src/` → commit/push → PR → merge no `master`; o workflow do Pages
  recompila e republica em `/app/lingo/`. O card na `home/index.html` aponta para `./lingo/`.

---

## App 8 — 🧭 Exile Compass (o do Diogo) — *diagnóstico de builds de Path of Exile 2*
- **URL:** https://diogoribeir.github.io/app/poe2-builds/
- **Pastas:** `poe2-builds/` (app publicado, HTML/CSS/JS puro, PWA) e `poe2-builds-src/` (geradores:
  `gerar_kb.py` + `lualit.py` = dados do PoB2; `gerar_assets.py` = árvore/artes/ícones/runas; `gerar_ref.py` =
  referências do poe.ninja; `README.md`).
- **O QUE O APP É (out/2026, depois de 3 tentativas — respeitar):** um **diagnóstico** que resolve problemas.
  O Diogo joga no **PS5** e disse: *"quero algo que indique o que estou fazendo errado no meu build, onde melhorar, o que
  está faltando, onde focar considerando a etapa em que estou — fazer build no PoE é resolução de problemas"* e que as
  sugestões sejam **baseadas em builds que existem (poe.ninja, Mobalytics…) e em conhecimento do app, SEM INVENTAR**.
  Fluxo: **(1) Onde você está?** (Ato 1–4, Interlúdios, Mapas T1–5/6–10/11–15, Chefes) + nível → **(2) O que está
  acontecendo?** (morro muito, morro de um golpe, chefe demora, limpo devagar, sem mana, atordoado, ailments) →
  **(3) Prints do PS5** (Skills, Personagem/defesas, Equipamento) com conferência/edição manual → **resultado**:
  **"Sua maior fraqueza"** (número + porquê com a conta + "Como resolver agora" em passos + a base/fonte), "Depois
  disso" (próximos 4), "Faltam dados", "O que já está bom" e **"Quem joga <skill> — <etapa>"** (referência real).
  As versões anteriores (montador "Exile Forge" e o "Exile Compass" de árvore + caminho) foram rejeitadas; a árvore
  com caminho calculado continua como aba secundária.
  Não há integração com o PS5 (a API da GGG não aceita apps novos) → a build entra por **prints** (OCR no celular).
  O jogo dele está em **inglês** (o OCR casa com os nomes em inglês).
- **Identidade visual = ferramentas de PoE2** (NÃO seguir os apps do casal): sempre escuro, títulos em **Cinzel**
  (OFL em `fonts/`), dourado das molduras, cores do PoB2; ícones de interface em SVG (`<symbol>` no `index.html`),
  sem emojis. Interface **simples**, uma recomendação principal por vez (ele trava com listas longas).
- **Nome:** **Exile Compass** (antes "Exile Forge"/"Forja PoE2"). ⚠️ Pasta/URL (`poe2-builds/`), nó do Firebase
  (`planos/poe2-builds-dt2026`) e chaves do localStorage (`forja:builds`, `forja:outbox`) **ficaram com o nome antigo**.
- **Telas (rotas por hash):** `#/` início ("Diagnosticar minha build", "Montar uma build do zero", código PoB; cards das
  builds mostram a maior fraqueza) · `#/diag[/<id>]` fluxo do diagnóstico (estado em `rascunho` até "Ver diagnóstico";
  `concluirDiag` grava `b.etapa`, `b.sintomas`, `b.ascPts`, `grupos[].nv` = nível da gema, `b.stats`) · `#/nova…`
  montar do zero (ascendência/skill/sorteio) · `#/b/<id>/<aba>` build com abas **Diagnóstico** (padrão) · **Árvore** ·
  **Gemas**. Painel inferior único `#folha` (`abrirFolha`), seletor com busca (`seletor()`), etapa/sintomas
  (`folhaEtapa`/`folhaSintomas`).
- **Motor do diagnóstico (`diagnostico.js`, `window.Diag`):** `diagnosticar(b)` → `{etapa, problemas[{id, area, sev,
  tit, num, pq, passos, fonte, lista?}], bons, faltam, ref}`; ordena por **gravidade** (`sev` 0–100 × fator da etapa ×
  fator dos sintomas). Checagens, todas com base em dado:
  - **Resistências** (fogo/gelo/raio): falta até 75% e "você toma N× o dano" = (100−res)/25; passos = mods de item,
    **runa** do nível certo (`kb/runas.js`), nó de resistência **a ≤ 8 pontos** do que ele tem (`nosPerto`, BFS na
    árvore oficial), charm (`Topaz/Ruby/Sapphire`) se morre, e o aviso de −10% ao matar o chefe do ato. Caos só no endgame.
  - **Vida + ES** contra os quartis de quem joga a mesma skill na etapa (`KB_REF…st.pool/vida`); passos = mods,
    Body Rune, nó de vida perto.
  - **Nível da gema** (`grupos[].nv`) contra o máximo que o nível de personagem permite (`KB_JOGO.skills[].lv` =
    `[nível exigido, índice de dano]` por nível de gema, do PoB2) e o **ganho de dano-base** até lá; passo = Uncut
    Skill Gem do nível (o nível da gema não lapidada vem do nível da área).
  - **Suportes** contra os mais ligados à skill naquela etapa (poe.ninja `linkedgems`), por **família** (tier I/II/III);
    incompatíveis (motor), tier abaixo do que a maioria usa, menos de 5 suportes (Jeweller's Orbs).
  - **Buffs de espírito** que ≥40% usam; **ascendência** (`b.ascPts` contra o esperado na etapa: 2 no Ato 2 —
    Trial of the Sekhemas, 4 no Ato 3 — Trial of Chaos, 8 no endgame); **DPS** informado contra os quartis.
  - **Sintomas:** mana (suportes que encarecem, suportes/buffs de mana que a referência usa, nó perto), stun (nós de
    Stun Threshold/Recovery + Stone Charm), ailments (charms Thawing/Grounding/Antidote/Dousing/Staunching com nível).
  - Achados `erro`/`alerta` do `motor.js` entram com gravidade 62/38.
  Fatos do jogo usados (confirmados em out/2026): teto 75%; −10% de resistência por chefe de ato, interlúdios −40/−50%
  por nível de área, −60% no endgame (o painel do jogo já mostra o valor com penalidade); 2 pontos de ascendência por
  provação. Etapas (área, dados do RePoE `world_areas`): Ato 1 = 1–15, Ato 2 = 16–31, Ato 3 = 33–45, Ato 4 = 46–53,
  interlúdios 54–64, mapas 65+ (tier 1–16 = 65–80).
- **Referências reais (`kb/ref.js` = `KB_REF`, gerado por `gerar_ref.py`):** o poe.ninja guarda "fotos" da liga em
  vários momentos (3 h, 6 h, 12 h, 18 h, 1/2/3/5 dias, 1/2/4 semanas, agora) — cada foto mostra os personagens do
  topo naquele momento (3 h ≈ níveis 1–45, 6 h ≈ 20–73…). Para as ~60 skills principais mais jogadas, o gerador
  junta por **etapa**: suportes ligados (`sup`), buffs de espírito (`esp`), ascendências (`asc`), nós de ascendência/
  keystones (`nos`), únicos (`uni`), armas, e quartis de **vida/ES/pool/EHP/DPS** (`st`) dos personagens na faixa de
  nível da etapa. API usada: `poe.ninja/poe2/api/builds/<versão>/search?overview=…&type=exp&skills=…&timemachine=…`
  (protobuf; decodificado sem schema) + `…/builds/dictionary/<hash>` (formato "NDIC": cabeçalho de 44 bytes, (K−1)
  pares u32, N comprimentos u8, strings). Baixa com **curl** (o Python-urllib leva 403), 1 pedido/s — ~1 h para 60
  skills. Skill sem referência → o diagnóstico usa só as regras do jogo (e avisa).
- **Árvore passiva (`arvore.js`, canvas):** dados e artes da **exportação OFICIAL da GGG**
  (`github.com/grindinggear/poe2-skilltree-export`: posições, ligações retas/arcos, sprites `skills*.webp`/`frame.webp`,
  retratos `background-<classe>.webp`). Um dedo arrasta, pinça dá zoom, duplo toque aproxima, toque abre o nó.
  Modos **Árvore** e **Ascendência** (arte da ascendência ao fundo). Estados: dourado cheio = pontos até o nível
  atual; dourado claro = próximos; ciano = fixado ("quero"); vermelho = evitar. Números = ordem dos marcos
  (notável/keystone/joia). Nomes dos notáveis aparecem com zoom.
- **Caminho sugerido (`caminho.js`, a "matemática"):** (1) **perfil** da build → peso por categoria de stat
  (elemento/tipo da skill, ataque/feitiço/minion, arma, crítico, defesa da classe e o controle **Dano ↔ Defesa** =
  `b.prioridade`); (2) **valor de cada nó** = Σ linhas: peso × relevância dos qualificadores ("with Bows", "Spell",
  "Fire"… — elementos são *case-sensitive* para "fire" verbo não virar Fogo) × magnitude ÷ **mediana da categoria na
  árvore** (medido nos dados); condicional ×0,7, contra tipo de monstro ×0,15, "more" ×2,5, "reduced/less" negativo;
  keystones só por regra explícita (`KEYSTONE`); (3) **Steiner com prêmios e orçamento**: guloso por ganho/custo^0,85
  com Dijkstra multi-origem + troca de galhos fracos enquanto o total melhora; a **ordem de subir de nível** é refeita
  com ganho/custo^1,15 (o que rende mais por ponto primeiro). Pontos: `pontosNoNivel` = (nível−1) + quests (24 até o
  nível 65, proporcional antes). Ascendência: mesmo cálculo no subgrafo (8 pontos; 2 por provação ≈ níveis 20/40/55/70).
  `b.planoFixos`/`planoEvitar`/`ascFixos`/`ascEvitar` (tocar no nó → "Quero este"/"Evitar") e `b.nosAtuais`
  (árvore vinda do código PoB; só conta o que está ligado ao início da classe). O plano fica em `b.plano`
  (`{h, ordem, passos:[{a,de,ate}], pontos, atuais, asc:{ordem,passos}, ascIds}`) e só recalcula quando o hash das
  entradas muda (`hashPlano`, `VERSAO_CAMINHO` no `app.js` — subir se mudar a lógica). Abyssal Lich = desenho da
  Lich com nós trocados (`asc.ov`). Oracle tem nós extras na árvore principal (`n.u = "Druid1"`).
- **Ler da foto (`foto.js`):** OCR **no celular** com Tesseract.js 5.1.1 (jsDelivr, carregado só quando usado; a CSP
  libera `cdn.jsdelivr.net` + `wasm-unsafe-eval` + `worker-src blob:`). Preparação da imagem: cinza → **subtrai o fundo
  local** (média numa janela de ~1,5% da largura, imagem integral) → texto preto no branco; sem isso o degradê do
  fundo do jogo apaga o texto. Casamento por semelhança (Levenshtein, por palavra-inicial) com skills, suportes,
  classes, ascendências e únicos; números da tela de personagem por regex (vida, ES, mana, espírito, armadura,
  evasão, resistências, bloqueio). Suportes lidos vão para a última skill lida; **"Level N"** vira nível da gema
  (até 21, perto de uma skill) ou do personagem (junto da classe/ascendência). O OCR troca o "I" dos tiers de suporte por
  `] | ! 1 l` — `variantes()` testa versões corrigidas da linha e fica com a que casa mais nomes. Testado com print sintético nítido e
  borrado/torto/JPEG: leu tudo (só confunde às vezes "II" com "I"). Funciona com o jogo em **inglês**.
- **Gemas:** ícones de todas as gemas em `img/gem/*.webp` (RePoE, 64px) + `kb/gemas.js` (`KB_GEMAS[nome] =
  [arquivo, [suportes recomendados pelo PRÓPRIO JOGO]]` — o `rankSup` do motor dá +1,5 a eles; selo "jogo" na UI).
- **Exportar para o jogo — Build Planner do PoE2** (`buildplanner.js`, menu ⋯ → "Levar para o jogo"): `.build` (JSON)
  do formato oficial da GGG (v1 experimental), igual ao exportador do PoB2: `ascendancy` = id interno (`Ranger1`,
  `Witch3b`…), `passives` = `stringId` de **todos os nós do plano** (`b.nosIds` → `kb/nos.js`, carregado só na
  exportação), `skills`/`support_skills` = `gameId` (`gid`), `inventory_slots` com `unique_name`. Markup `<gold>{…}`.
  O usuário envia/assina no **pathofexile2.com**. ⚠️ Funcionamento no PS5 ainda não confirmado pelo Diogo.
- **Importar código do PoB2 (`pob.js`):** base64url → zlib (`DecompressionStream`) → XML `<PathOfBuilding2>` → build;
  a árvore do código vira `b.nosAtuais` (o caminho continua dali) e os nós de ascendência viram `ascFixos`.
- **APIs pesquisadas (out/2026):** GGG `api.pathofexile.com` exige OAuth e **não aceita apps novos**; poe.ninja tem
  JSON; RePoE PoE2 (`repoe-fork.github.io/poe2/`: JSON + imagens convertidas em `Art/…webp`); poe2db (HTML);
  **poe2wiki recusa servidores na nuvem** (403; no celular abre — o app só linka). O antigo leitor `wiki.js` foi
  removido (nunca foi ligado; está no histórico do git). Rede do ambiente do Claude em **Full** desde out/2026.
- **Motor de análise (`motor.js`, sem interface):** mesmas regras da versão anterior — compatibilidade de suportes
  portada do PoB2 (`compativel()` em RPN como `calcLib.doesTypeExpressionMatch`), `analisar(b)` →
  `{achados, notas, rotulos, vetores, arquetipo, geral}`, `recomendarSuportes`, `rankAscPorSkill`,
  `rankSkillsPorAsc`, `aleatoria`, `montar`… Os achados `erro`/`alerta` entram no diagnóstico (a antiga aba
  **Análise** foi removida — o diagnóstico substitui). Os nomes de
  keystones/notáveis/nós de ascendência que o motor usa saem do plano (`Caminho.nomesDoPlano`).
- **Biblioteca (`poe2-builds/kb/`)** — ⚠️ não confundir:
  - **GERADA** (não editar à mão): `jogo.js`, `arvore.js`, `unicos.js`, `nos.js` (do **Path of Building 2**, via
    `gerar_kb.py` — nada do PoB2 é executado) e `tree.js` (`KB_TREE`: nós `{i,x,y,t,n,s,f,g,a,u,p…}`, ligações
    `lig` `[a,b]`/`[a,b,cx,cy]`, quadros dos sprites `q`/`qo`/`mold`, classes/ascendências com centro/raio) +
    `gemas.js` + `runas.js` (`KB_RUNAS`: runas/soul cores de resistência e vida com nível; charms e contra o que
    ativam) (via `gerar_assets.py`, da exportação da GGG + RePoE) + `ref.js` (`KB_REF`, poe.ninja, via `gerar_ref.py`).
    Imagens geradas: `img/tree/`, `img/asc/`, `img/gem/`.
  - **CURADA** (editar à mão, PT-BR): `conceitos.js` (resumo/afinidades das ascendências, vetores, camadas…) e
    `meta.js` (retrato do meta com tier/fontes; dá o selo "Meta S/A").
- **🔄 Atualizar a cada patch (~4 meses; próximo: 1.0 em 11/12/2026 com o Duelist):** (1) PoB2:
  `git clone --depth 1 https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git <scratch>/pob2` →
  `python3 -I poe2-builds-src/gerar_kb.py <scratch>/pob2`; (2) árvore/artes/ícones:
  `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/grindinggear/poe2-skilltree-export <scratch>/ggg` →
  `python3 -I poe2-builds-src/gerar_assets.py <scratch>/ggg <scratch>/repoe-cache` (baixa os ícones do RePoE, ~3 min);
  (3) **referências** `python3 -I poe2-builds-src/gerar_ref.py --skills 60` (~1 h; pega a liga de desafio mais nova
  do poe.ninja — **rodar de novo uns dias depois de cada liga começar**, quando as fotos de 3 h/6 h/1 dia já existem);
  (4) revisar `conceitos.js`/`meta.js`; (5) conferir o diagnóstico de 3–4 builds e se a classe nova (Duelist) aparece;
  (6) **subir `CACHE` no `sw.js`**. Detalhes em `poe2-builds-src/README.md`. Agente:
  `.claude/agents/poe2-builds.md`. ⚠️ Rodar o Lua do PoB2 é bloqueado no ambiente do Claude (por isso o parser próprio).
- **Sincronização:** Realtime Database via REST (Receita 1), nó **`planos/poe2-builds-dt2026`**: **uma chave por
  build** (`builds/<id>`, inclui `plano`) + lápides `apagadas/<id>` + `_at`. Ao abrir: puxa e mescla por `atualizado`;
  offline vai pro outbox (`forja:outbox`). localStorage = `forja:builds`.
- **Edição/teste:** ao mexer em QUALQUER arquivo do app ou da `kb/`, **subir `CACHE` no `sw.js`** (`"poe2-builds-vN"`;
  v4 = Exile Compass, v5 = diagnóstico). O SW pré-carrega app + kb + sprites da árvore; retratos e ícones de gema (`img/asc`,
  `img/gem`) vão para o cache `poe2-builds-img-v1` na 1ª vez que aparecem. Testes com Playwright **bloqueando o
  Firebase** (`route(/firebaseio/, abort)`) para não sujar os dados reais; OCR testado com print sintético gerado no
  Chromium (o navegador de teste precisa do proxy do ambiente para baixar o Tesseract).

## Firebase — projeto `apps-4b887` (tudo num projeto só)
- **Console:** https://console.firebase.google.com/project/apps-4b887
- **Config web** (pública por design — a segurança vem das regras/login):
  ```js
  apiKey: "AIzaSyBrnrJI6vY97YOiNBnWAs7_t1Okylk5EOY",
  authDomain: "apps-4b887.firebaseapp.com",
  databaseURL: "https://apps-4b887-default-rtdb.firebaseio.com",
  projectId: "apps-4b887",
  storageBucket: "apps-4b887.firebasestorage.app",
  messagingSenderId: "293435823400",
  appId: "1:293435823400:web:4c08cad7f5342c8b4a6c1d"
  ```
- **Firestore** (App 1): regras exigem login. **Authentication**: e-mail/senha ativado, 1 usuário do casal.
  Domínio autorizado: `diogoribeir.github.io`.
- **Realtime Database** (Apps 2 e 3): regras publicadas =
  `{ "rules": { "planos": { ".read": true, ".write": true }, ".read": false, ".write": false } }`
  (nó `planos` aberto — o código do plano funciona como senha; não guardar dados sensíveis).
- **Teste rápido do RTDB:** abrir https://apps-4b887-default-rtdb.firebaseio.com/planos/teste.json →
  `null` = funcionando · `Permission denied` = regras não publicadas.

---

## Convenções de trabalho (para o Claude)
- **Mobile first sempre**: os apps são usados no celular (≈390px). Nada de tabela larga (usar cards),
  nada de scroll horizontal, testar também **modo escuro**.
- **Testar antes de publicar**: rodar o app com servidor local + Playwright/Chromium headless
  (pré-instalado), checar erros de console e o fluxo principal; para o App 3, testar com a rede do
  Firebase bloqueada também (deve abrir com fallback local).
- **Publicação**: o Diogo prefere que o Claude **faça o merge e acompanhe o deploy** sozinho, avisando
  quando estiver no ar. Confirmar `conclusion: success` no workflow antes de dizer que subiu.
- **Paris:** só resta o `paris-planner` (o da Tati, React, conteúdo vem do artifact dela). O antigo
  `roteiro-paris` (o do Diogo) foi removido — não recriar sem o Diogo pedir.
- Commits em inglês; interface e conversa em **português (BR)**.
