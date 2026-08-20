# Guia dos Apps — Di & Tati (leia isto primeiro)

Este repositório hospeda **4 apps** do casal Di (Diogo) & Tati, publicados juntos no GitHub Pages.
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
| **Vercel** | Hospeda **SÓ o Lingo** (App 5 — projeto `lingo` na conta do Diogo). ⚠️ **NÃO deletar o projeto do Lingo.** Outros projetos Vercel ligados ao repositório antigo podem ser removidos | https://lingo-liard-kappa.vercel.app |

### Como funciona o deploy
- O workflow `.github/workflows/deploy-pages.yml` roda **a cada push no `master`** (ou manualmente:
  aba **Actions → "Publicar apps no GitHub Pages" → Run workflow**).
- Ele monta o site assim: raiz → `home/` (página inicial com a lista de apps) · `/dias-sem-doenca/` →
  `dias-sem-doenca/` · `/paris-planner/` → `paris-planner/` · `/perfil-gamer/` → `perfil-gamer/`.
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

## App 2 — 📊 Roteiro Paris (o do Diogo) — ❌ REMOVIDO (ago/2026)
- Estava em `roteiro-paris/` (arquivo único). O Diogo pediu para deletar. Código no histórico do git
  (`git log -- roteiro-paris/`). **Não confundir com o App 3 (o da Tati), que continua ativo.**

## App 3 — ✈️ Paris Trip Planner (o da Tati, React)
- **URL:** https://diogoribeir.github.io/app/paris-planner/
- **Pastas:** `paris-planner-src/` (fonte Vite + React + Tailwind + lucide-react) e
  `paris-planner/` (o build publicado — index.html + assets/).
- **Quem desenvolve:** a **Tati**, num artifact do claude.ai dela. Ela exporta um `paristripplanner.tsx`
  (~3400 linhas) e o Diogo traz o arquivo pra cá. **Não** alterar funcionalidades por conta própria —
  a fonte da verdade do conteúdo é o arquivo dela.
- **Sincronização:** Realtime Database via REST, nó **`planos/paris-planner-dt2026`** — o app carrega os
  dados da nuvem ao abrir, salva ao mudar, e recarrega ao voltar se houver gravação mais nova. O arquivo
  dela vem com `window.storage` (API que só existe no claude.ai) e é **substituído no build** por esse
  bloco de nuvem + localStorage.

### 🔁 FLUXO DE ATUALIZAÇÃO do App 3 (quando chegar um .tsx novo)
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

## App 4 — 🎮 Perfil Gamer (o do Diogo)
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
  **horas** e o **ano jogado** de cada uma: a 1ª é o campo `horas`/`anoJog` base e as demais ficam em
  `g.runs[]` (`{horas, anoJog}`). **Veredicto e status são únicos por jogo** (não por jogatina). Botão
  "🔁 Nova jogatina" no card e no Editar (pede horas + ano); o card mostra "🔁 W1 Xh · W2 Yh". Horas
  totais e estatísticas somam todas as jogatinas. Helpers: `runHoras/totalHoras/runsResumo`.
  (Não há campo Observação.)
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
  A aba 🗓 **Plano 2026** é editável: cada jogo planejado tem só **nome + estimativa de horas + data
  (calendário)**; a fila fica **ordenada por data**. As **horas disponíveis** vão de hoje até
  **31/jan/2027**: cada semana vale um **padrão editável** de horas — `padraoSemana`, que começa em
  `HORAS_SEMANA` (10, o padrão de fábrica p/ o ↺) — com exceções por dia (`PERIODOS`: 21–24/set 10h/dia;
  sem jogatina 10–19/set) e horizonte `PLANO_FIM`. O painel recolhível **⚙️ Ajustar horas por semana**
  (`details.wkbox`, estado `wkOpen`) tem no topo o **Padrão de todas as semanas** (`#padSemana`) — mudar
  ali troca **todas** as semanas de uma vez (ex.: 10→8) — e abaixo lista cada semana (segunda→domingo, via
  `semanasPlano()`/`segunda()`) com um input editável p/ **subir/baixar as horas da respectiva semana**; o
  total "disponível" recalcula e ↺ volta ao padrão. Ajustes por semana ficam em `HS` (`{ "<segunda ISO>":
  nº }`), sobrepondo o padrão global; o app mostra se a fila cabe (sobra/falta). Cada
  item tem **▶️ "estou jogando"**, que marca o jogo como *jogando agora*: ele vira o card do topo da aba
  Jogos e entra na biblioteca; o "falta na fila" desconta as horas já jogadas desse jogo (estimativa −
  horas). Na aba 📊
  **Estatísticas**, o "Top 10 — mais horas" tem chips para filtrar por veredicto (Masterpiece, Muito Bom…)
  e uma marca discreta **❌** ao lado do nome dos jogos que foram dropados (`enc==="N"`).
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

## App 5 — 🇫🇷 Lingo (curso de francês, Next.js no Vercel)
- **URL:** https://lingo-liard-kappa.vercel.app — ⚠️ hospedado no **Vercel** (único app fora do
  GitHub Pages, porque tem servidor: rota de API do tutor + middleware de senha).
- **Pasta:** `lingo-src/` (fonte Next.js 15 + React 19 + Tailwind 4; cópia da branch `claude/lingo`,
  que veio de outra sessão do Claude Code).
- **O que faz:** curso de francês PT-BR ("gramática-ponte"), 8 capítulos/26 lições, exercícios,
  áudio pela voz do navegador, prática de fala 🎤, revisão espaçada (SRS), phrasebook, e o módulo
  **Tutor** (chat de dúvidas com Claude).
- **Regra de ouro do app:** nada de francês inventado por IA — conteúdo verificado em `data/*.json`;
  a IA só atua no Tutor, com guarda gerador→avaliador (`lib/pipeline.ts`, `lib/guardrails.ts`).
- **Variáveis de ambiente (no Vercel):** `ANTHROPIC_API_KEY` (opcional — sem ela o Tutor roda em
  modo demonstração/mock) · `ACCESS_PASSWORD`/`ACCESS_USER` (opcional — senha básica de acesso).
- **Atualização:** editar `lingo-src/`, e o deploy é pelo Vercel (projeto do Diogo). O card na
  página inicial (`home/index.html`) aponta pro link do Vercel.

---

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
