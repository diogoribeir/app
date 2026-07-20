# Guia dos Apps — Di & Tati (leia isto primeiro)

Este repositório hospeda **5 apps** do casal Di (Diogo) & Tati, publicados juntos no GitHub Pages.
Este arquivo é o contexto completo para qualquer sessão nova do Claude: estrutura, Firebase,
como atualizar cada app e como publicar. **Responda sempre em português (BR).**

> 🧱 **Para criar um APP NOVO neste esquema** (pasta → deploy no Pages → sincronização no
> Firebase, com código pronto e checklist): seguir a receita técnica em **`docs/NOVO-APP.md`**.
> 📋 **`RECEITA-APPS.md`** (raiz) = catálogo de todos os apps + receita num arquivo só, para o
> Diogo anexar em chats novos — **manter a tabela dele atualizada ao criar/alterar apps**.

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
  `dias-sem-doenca/` · `/roteiro-paris/` → `roteiro-paris/` · `/paris-planner/` → `paris-planner/` ·
  `/perfil-gamer/` → `perfil-gamer/` · `/decoracao/` → `decoracao/`.
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
- **Migração jul/2026:** antes usava Firestore + login; os dados antigos seguem no Firestore
  (`casal/estado`) como backup. Authentication/Firestore podem ser desativados no console se quiser.
- **Edição:** direto nos arquivos da pasta. Ao mexer no `app.js`/`styles.css`/`index.html`, regenerar o
  arquivo único com `python3 dias-sem-doenca/build-standalone.py` e subir a versão de cache no `sw.js`
  (`CACHE = "dias-sem-doenca-vN"`).

## App 2 — 📊 Roteiro Paris (o do Diogo)
- **URL:** https://diogoribeir.github.io/app/roteiro-paris/
- **Pasta:** `roteiro-paris/` — **arquivo único** `index.html` (dados embutidos em constantes JS).
- **Viagem (datas FIXAS — respeitar sempre):** ida GRU→CDG **10/09/2026 19:35** (Air France 459,
  chega 11/09 11:55) · volta CDG→GRU **18/09/2026 08:15** (KLM 2006/791, conexão Amsterdã).
  7 dias inteiros em Paris (11–17/09); **dia 18 é só o voo, sem passeios**. Não existe mais cenário 10/12 dias.
- **4 abas (mobile-first, navegação fixa embaixo):** ☑️ **Escolher** (SIM/NÃO por prioridade — o roteiro
  risca o que foi cortado e o orçamento recalcula) · 🗓 **Roteiro** (dia a dia) · 💶 **Orçamento** ·
  📖 **Guia** (Reservas, Informações, Atrações, Comer, Brechós, Transporte, Evitar — em seções sanfona, cards).
- **Orçamento:** o total do topo é SÓ "gastos na viagem" (alimentação, jantares, atrações, cruzeiro,
  transporte com **Navigo Semaine** semanal €65 casal, brechós, reserva). **Hotel fica em seção separada**
  ("dinheiro já reservado") e **aéreo aparece como ✓ pago** — nunca somar no total de viagem.
- **Sincronização:** **Realtime Database**, nó `planos/<código-da-viagem>` — o usuário liga em
  "Sincronizar entre aparelhos" e compartilha por link `#viagem=<código>`. Config embutida no arquivo.
- **Edição:** direto em `roteiro-paris/index.html` (constantes `SEL_ITEMS`, `DAYS`, `RESUMO`, `ATRACOES`,
  `COMER`, `BRECHOS`, `TRANSPORTE`, `EVITAR`; fórmulas em `calcBudget()`).

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
  3 abas: 🎮 Jogos (busca, filtros por veredicto/status, ordenação, custo/hora R$90) ·
  📊 Estatísticas (distribuição, top horas, por gênero, insights, motivos de drop) · 🗓 Plano 2026.
- **Filosofia (respeitar):** veredicto categórico, NUNCA notas numéricas na interface;
  componentes H/G/D/FF discretos como "análise interna". Detalhes em `perfil-gamer-src/README.md`.
- **EDITÁVEL no app** (igual aos outros): botão "➕ Registrar jogo" + Editar/Excluir em cada card.
- **Sincronização:** Realtime Database via REST, nó **`planos/perfil-gamer-dt2026`** — a nuvem é a
  fonte da verdade; `perfil-gamer/dados.js` é só a carga inicial (seed). localStorage = cópia offline;
  recarrega ao voltar se houver gravação mais nova (mesma receita 1 do paris-planner).
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

## App 6 — 🛋️ Decora (planejador de decoração + orçamento)
- **URL:** https://diogoribeir.github.io/app/decoracao/
- **Pasta:** `decoracao/` — **arquivo único** `index.html` (HTML/CSS/JS puro, mobile-first).
- **O que faz:** a pessoa sobe a **foto (ou planta) do ambiente**, arrasta **móveis de lojas reais**
  por cima (mover / redimensionar / girar / camadas), e vê o **orçamento somando em tempo real**.
  4 abas: 🛋️ **Montar** (editor de colagem 2D sobre a foto) · 🛒 **Catálogo** (30 itens com faixa de
  preço aproximada, loja e link de busca; filtros por categoria/estilo/preço) · 💰 **Orçamento**
  (teto por ambiente, gasto x meta, gasto por categoria, lista de compras, **recomendações
  determinísticas** do que falta e cabe no orçamento) · 🗂️ **Projetos** (um ambiente por cômodo).
- **Produtos do usuário (`state.custom`):** botão "➕ Adicionar produto de uma loja" no Catálogo — a
  pessoa cadastra um produto real (nome, faixa/preço, loja, link, categoria, estilo, dimensões e
  **foto**). Ele entra no catálogo com selo "meu" e pode ser **colado na foto com a imagem real**
  (não só a silhueta). Fotos de produto são reduzidas a ~700px/PNG (preserva recorte transparente).
  Tudo passa pelo resolvedor `def(id)` (catálogo embutido + custom) — orçamento, lista e recomendações
  já contam os produtos do usuário. É a ponte para um futuro **feed de afiliados** (quando houver contas).
- **Filosofia (respeitar):** **preços são faixas aproximadas** (referência), nunca valor exato
  fingindo precisão — o botão "Buscar" leva à busca na loja para conferir o preço atual. Nada de
  inventar produto/preço. O catálogo é curado em `CAT` (loja + faixa BRL + estilo + dimensões cm).
- **Planta 2D (vista de cima, à escala):** no Montar há o alternador **📷 Foto / 📐 Planta**. Na planta,
  o cômodo é desenhado à escala real (`roomW`×`roomL` em metros, com grade de 1 m) e cada móvel vira uma
  **pegada** largura×profundidade (`CAT_DEPTH` por categoria, ou `dcm` do produto). Arrasta para mover,
  **⟳ 90°** para girar; peça que passa das paredes fica **vermelha** ("não cabe assim") e mostra o
  **% de piso ocupado**. Reaproveita `p.items` (campos `px,py,prot`) — orçamento/lista não mudam.
- **Remoção de fundo (beta):** ao cadastrar um produto com foto, o botão **✂️ Remover fundo** faz um
  flood-fill por tolerância a partir das bordas (`removeBgFromDataURL`) — bom para foto de produto em
  fundo branco/liso; gera PNG transparente para colar limpo na cena.
- **Dados 3D-ready:** cada peça guarda dimensões (largura/altura/profundidade em cm), posição (fração),
  escala e rotação — a planta 2D já usa esses dados e uma futura **vista 3D** reaproveita o mesmo modelo.
- **Sincronização:** Realtime Database via REST, nó **`planos/decoracao-dt2026`** (receita 1) — a
  nuvem é a fonte; localStorage é a cópia offline; recarrega ao voltar se houver gravação mais nova.
  As fotos do ambiente entram no `state` como dataURL (reduzidas a ~1400px/JPEG antes de salvar).
- **Edição:** direto em `decoracao/index.html` (constantes `CAT`, `STORES`, `ICONS`, `ROOMS`;
  lojas com busca em `STORES[...].url(q)`). Para novos móveis, adicionar item em `CAT` e, se for um
  tipo visual novo, uma silhueta em `ICONS`.

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
- **Não misturar os dois apps de Paris**: o `roteiro-paris` é o do Diogo (planilha/escolhas); o
  `paris-planner` é o da Tati (React, conteúdo vem do artifact dela).
- Commits em inglês; interface e conversa em **português (BR)**.
