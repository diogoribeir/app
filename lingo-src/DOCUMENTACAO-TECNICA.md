# Documentação técnica — Lingo

> **Fonte técnica completa do projeto, lida SOB DEMANDA.** Não é carregada
> automaticamente no contexto — o `CLAUDE.md` (enxuto, always-on) aponta para cá.
> Leia este arquivo ao iniciar tarefas que mexam em arquitetura, arquivos,
> decisões ou fases. **Mantenha-o atualizado.** README.md é para o usuário final;
> `app-tutor-idiomas-viagem-v2.md` é o plano-spec original (histórico/visão).

---

## 1. O que é

**Lingo** — **o método de francês para falantes de português do Brasil**:
curso em capítulos com lições curtas, cuja espinha dorsal é a
**gramática-ponte** — o francês explicado a partir do que o brasileiro JÁ sabe
(cognatos, gênero/artigos, nasais, ter fome/sede…), não repetição gamificada.
Identidade **editorial francesa** (papel creme, serifa, azul-tinta) —
deliberadamente **não** parecida com Duolingo, por exigência do usuário
(ver §7 e memória `feedback-nao-parecer-duolingo`). Reconstrução (jul/2026)
do protótipo "Bagagem".

**Produção:** https://diogoribeir.github.io/app/lingo/ — **site estático no
GitHub Pages** (migrado do Vercel em ago/2026; ver §5b). Sem servidor: a rota
`/api/tutor` e o `middleware` foram removidos e o Tutor roda no navegador
(`lib/tutorCliente.ts`), sempre em **modo demonstração** (sem chave de API).

**Regra de ouro (inalterada):** o app NÃO ensina francês "inventado" pelo
modelo. Lições, exercícios e gramática saem de **conteúdo verificado**
(determinístico, sem IA em runtime). A IA só atua no módulo Tutor (camada C),
cercada pela guarda gerador→avaliador com fallback.

## 2. Arquitetura de confiabilidade (3 camadas) — o coração

| Camada | Confiança | Onde no código | O que faz |
|---|---|---|---|
| 🟢 **A — Fatos** | ~100% (lookup) | `lib/camadaA.ts` + `data/facts.json` | Conjugação, gênero, léxico. **Sem IA.** Tabelas exibidas nas lições de gramática. |
| 🟡 **B — Conteúdo curado** | Alta | `lib/camadaB.ts` + `data/content.json` · `lib/gramatica.ts` + `data/gramatica.json` | Frases E tópicos de gramática verificados. Lições/exercícios **só ensinam daqui**. |
| 🔴 **C — Geração livre** | Com guarda | `lib/tutor.ts`, `lib/avaliador.ts`, `lib/pipeline.ts` | Módulo Tutor (chat). Gerar→Avaliar→Selecionar; se falhar, **fallback** para A/B. |

**Decisão-chave:** curso, exercícios e gramática são 100% determinísticos
(`lib/curso.ts` + `lib/exercicios.ts`), sem custo de API. A IA só é usada na
aba Tutor.

## 3. Stack

- **Next.js 15** (App Router) + **React 19** + **Tailwind v4** + **TypeScript**.
- IA: API Anthropic via `fetch` (sem SDK), `lib/anthropic.ts`
  (tutor `claude-sonnet-4-6`; difícil `claude-opus-4-8`; avaliador `claude-sonnet-4-6`).
- TTS (🔊 normal / 🐢 devagar): Web Speech API grátis (`lib/fala.ts`).
- STT (🎤 falar e checar): Web Speech API (`lib/reconhecimento.ts` + nota
  tolerante em `lib/comparar.ts`).
- Estado no aparelho (`localStorage`, chaves `lingo:*`): perfil
  (`lib/estadoLocal.ts`), pontos/sequência/lições (`lib/jogo.ts` — nomes
  internos `xp*`; na UI o termo é "pontos"), SRS (`lib/srs.ts`).
  **Sincronização na nuvem (ago/2026, `lib/nuvem.ts`):** RTDB via REST (Receita 1),
  nó `planos/lingo-dt2026` — todas as chaves `lingo:*` sobem num pacote único
  (`dados` + carimbo `_at`); carrega ao abrir, reenvia a cada mudança (debounce)
  e recarrega ao voltar se a nuvem estiver mais nova. localStorage = cópia offline.
  **Site estático (GitHub Pages) — sem servidor:** o Tutor roda no navegador
  (`lib/tutorCliente.ts`), sempre em modo demonstração.
- Acesso: **sem senha** — site público como os outros apps (o antigo
  `middleware.ts` de HTTP Basic foi removido na migração para o Pages).
- PWA: `manifest.webmanifest` + `public/sw.js` (cache `lingo-v2`) + `icon.svg`
  ("L" serifado, papel creme, filete tricolor).

## 4. Estrutura de arquivos

```
next.config.mjs                  # output: "export" + basePath (NEXT_PUBLIC_BASE_PATH)
app/
  layout.tsx, globals.css        # shell + DESIGN SYSTEM "Paris ao anoitecer" (.botao/.opcao/.chip/.cartao/.grad-texto/.nav-vidro)
  page.tsx                       # ⭐ shell de abas (Hoje·Curso·Frases·Tutor·Você) + nav flutuante + lição em tela cheia
  (api/tutor removido — site estático; o Tutor roda no cliente, ver lib/tutorCliente.ts)
components/
  Onboarding.tsx                 # 3 passos: nome → nível → meta diária (pontos)
  Hoje.tsx                       # ⭐ aba HOJE: anel da meta (SVG), "Estudar agora" 1 toque, revisão SRS embutida, atalhos, semana
  Caminho.tsx                    # ⭐ aba CURSO: estante de gramática-ponte + capítulos com progresso e lições
  Frases.tsx                     # ⭐ aba FRASES: phrasebook busca+filtro; toque no cartão = FALA (🐢 devagar); offline
  Sessao.tsx                     # ⭐ player de exercícios (progresso, rodapé verde/vermelho, reinserção de erro 1x, vibração tátil, tela de pontos)
  LicaoGramatica.tsx             # lição de gramática: seções → exemplos c/ áudio → tabelas (camada A) → quiz
  TutorChat.tsx                  # aba Tutor (chat camada C): mostra E FALA — resposta com frase FR toca o áudio automaticamente (audio_texto → falar()) + cartões com 🔊/🐢
  Perfil.tsx                     # aba Você (stats, gráfico da semana, ajustes, reset)
  BotaoOuvir.tsx                 # 🔊 Ouvir / 🐢 Devagar
  BotaoFalar.tsx                 # 🎤 fala e checa
  RegistrarSW.tsx                # PWA
lib/
  types.ts                       # tipos centrais (Usuario, Unidade/Licao, Exercicio, TopicoGramatica…)
  curso.ts                       # ⭐ CURSO: unidades→lições (refs a ids verificados), desbloqueio linear, validarCurso()
  exercicios.ts                  # ⭐ gerador determinístico: apresentar/escolher(PT↔FR)/montar(chips)/ouvir/falar
  jogo.ts                        # pontos (funções xp*), sequência (streak), lições feitas, atividade da semana
  guardrails.ts                  # 🛡️ validação/saneamento (validarTurno; rate-limit por IP não usado no estático)
  tutorCliente.ts                # Tutor no navegador: validarTurno → pipeline (sempre mock)
  nuvem.ts                       # ☁️ sync RTDB (Receita 1): pacote lingo:* no nó planos/lingo-dt2026
  gramatica.ts                   # loader dos tópicos verificados (gramatica.json)
  camadaA.ts / camadaB.ts        # 🟢/🟡 (inalterados; recuperarContexto([]) = tudo)
  tutor.ts / avaliador.ts / pipeline.ts  # 🔴 camada C (prompt geral PT-BR→FR + bloco anti-injection)
  anthropic.ts, fala.ts, reconhecimento.ts, comparar.ts, srs.ts, estadoLocal.ts, cores.ts
data/
  facts.json                     # camada A (6 verbos, ~16 lexemas)
  content.json                   # camada B (45 itens verificados, 6 contextos)
  gramatica.json                 # ⭐ 8 tópicos-ponte PT-BR→FR (seções, exemplos, quiz, refs a conjugações)
scripts/verificar-conteudo.ts    # portão de CI
.claude/launch.json              # preview: "lingo-dev" (npm run dev, porta 3000)
```

## 5. Como rodar / validar

- `npm install` → `npm run dev` (http://localhost:3000)
- `npx tsc --noEmit` (tipos) · `npm run verificar-conteudo` (CI de conteúdo)
- Sanidade do curso: `npx tsx -e "import {validarCurso} from './lib/curso'; console.log(validarCurso())"`
- ⚠️ NÃO rodar `npm run build` com o dev ligado (corrompe `.next`).
- `npm run build` gera `out/` (export estático). No Pages o workflow define
  `NEXT_PUBLIC_BASE_PATH=/app/lingo`; local fica vazio.
- O Tutor roda **sempre em modo demonstração** (site estático não tem chave).

## 5b. Acesso pelo celular (Android, mesma rede Wi-Fi)

Com o notebook ligado e o servidor rodando, o celular acessa direto pela rede:

1. Notebook e celular na **mesma rede Wi-Fi**.
2. No notebook: `npm run dev` (o Next já escuta em `0.0.0.0:3000`).
3. Descobrir o IP do notebook: `ipconfig` → "IPv4 Address" do adaptador Wi-Fi
   (verificado em 2026-07-02: `192.168.15.5` na rede TATI-5G — pode mudar se o
   roteador redistribuir IPs; reconferir se parar de abrir).
4. No Chrome do celular: **http://192.168.15.5:3000**.
5. Opcional: menu ⋮ → **"Adicionar à tela de início"** → vira um atalho de app.

**Firewall:** já verificado — o `node.exe` tem regra de entrada *Allow* no
perfil *Public* (que é o perfil da rede atual). Se um dia não abrir, é o
primeiro suspeito: `Get-NetFirewallApplicationFilter -Program "*node.exe*" |
Get-NetFirewallRule`.

**Limitações do acesso via HTTP na rede local** (secure context só existe em
HTTPS ou localhost):
- 🔊 **Ouvir (TTS) funciona** normalmente.
- 🎤 **Falar (STT) NÃO funciona** — o navegador exige HTTPS para o microfone.
  O exercício de fala é pulável, então nada trava.
- **Service worker/offline não registra** — o atalho abre o site, mas não é a
  PWA completa nem funciona offline.

**✅ MIGRADO PARA O GITHUB PAGES (2026-08):** produção em
**https://diogoribeir.github.io/app/lingo/** — site **estático** publicado pelo
workflow do repositório raiz (`.github/workflows/deploy-pages.yml`): ele roda
`npm ci && npm run build` em `lingo-src/` com `NEXT_PUBLIC_BASE_PATH=/app/lingo`
e copia `out/` para `/app/lingo/`. Com HTTPS, a PWA completa funciona (instalar,
offline e 🎤 microfone).

**Por que estático:** o Pages não roda servidor. A rota `/api/tutor` e o
`middleware` de senha foram removidos; o Tutor roda no navegador
(`lib/tutorCliente.ts`) e fica **sempre em modo demonstração** (o navegador não
pode guardar `ANTHROPIC_API_KEY` com segurança). Para IA real no Tutor de novo
seria preciso voltar a um servidor (Vercel/etc.) e restaurar `api/tutor`
(está no histórico do git). O antigo projeto `lingo` no Vercel pode ser removido.

**Rodar em produção local (opcional):** `npm run build` gera `out/`; sirva a
pasta com qualquer servidor estático (ex.: `npx serve out`). Para dev normal,
`npm run dev`.

## 6. O curso (conteúdo pedagógico)

- **8 unidades / 26 lições** em `lib/curso.ts`: Primeiros passos, Apresentações,
  Restaurante, Hotel, Cidade, Compras, Emergências, Polimento. Lições de
  gramática são intercaladas nas unidades (ex.: gênero antes do restaurante,
  negação antes de "o wifi não funciona").
- **Gramática-ponte (data/gramatica.json), 8 tópicos:** cognatos (-ção→-tion…),
  gênero/artigos (le/la ≈ o/a), être+avoir (ser E estar; "j'ai faim" = "tenho
  fome" como em PT), negação ne…pas, 3 jeitos de perguntar, tu/vous, falsos
  amigos (attendre≠atender, entendre≠entender…), sons do francês (brasileiro já
  tem as nasais). Cada tópico: seções + exemplos com áudio + mini-quiz; campo
  `conjugacoes` puxa tabelas da camada A.
- **Exercícios (lib/exercicios.ts):** lição nova = apresentar todas as frases →
  quiz embaralhado → falar (opcional/pulável). Cada frase é testada em **2
  formatos DISTINTOS sorteados por item** (entre escolher PT→FR, escolher FR→PT,
  montar com chips e ouvir), então a mesma lição não cai sempre na mesma
  sequência (menos repetitivo). Erro → reinsere no fim UMA vez. Revisão SRS = só
  quiz.
- **Player (Sessao.tsx):** respostas guardadas **por índice** (`estados`), então
  dá para **voltar (‹)** e rever exercícios já respondidos sem perder a resposta.
  Ao concluir uma lição da trilha, a tela de pontos mostra **"Próxima lição →"**
  (encadeia via `proximaAposLicao` em `curso.ts`) além de "Voltar à trilha".
  O mesmo vale para as lições de gramática (`LicaoGramatica.tsx`).
- **Progresso (lib/jogo.ts):** 10 pontos/lição (+5 perfeita), meta diária
  (20/40/60 pts), sequência de dias não quebra se ainda não estudou hoje.
  Tom sóbrio na UI — "pontos" e "dias seguidos", nunca "XP"/estética de jogo.

## 6b. Guardrails de segurança (2026-07-02; atualizado ago/2026)

⚠️ **Contexto mudou:** desde a migração para o GitHub Pages (site estático), o
Tutor roda **no navegador em modo demonstração** — não há mais chamada de API
com custo, nem servidor. As camadas 1 e 3 continuam valendo (rodam no cliente);
2, 4 e 6 eram do servidor e não se aplicam mais; a 5 (headers) só vale no `next
dev` (o Pages não aplica headers). O código do servidor (`api/tutor`, rate limit
por IP em `guardrails.ts`, `middleware.ts`) está preservado no histórico do git
caso um dia o Tutor volte a rodar num servidor.

1. **Validação/saneamento** (`lib/guardrails.ts#validarTurno`): `tutorCliente`
   NUNCA repassa o objeto cru — reconstrói `Usuario` só com campos saneados
   (nome ≤30 chars, sem controle/quebra de linha; nivel só do enum). Mensagem
   ≤500 chars, sem caracteres de controle. **(ativo — roda no cliente)**
2. ~~Rate limit por IP~~ — só fazia sentido no servidor; **não se aplica** no
   estático (sem custo de API, tudo local).
3. **Anti-prompt-injection** (`lib/tutor.ts`): bloco SEGURANÇA no system prompt
   e `nomeSeguro` na interpolação. **(ativo, mas só relevante se um dia houver
   chave; em modo demonstração a resposta é fixa e verificada.)**
4. ~~Erros genéricos do servidor~~ — sem servidor; erros do cliente já são neutros.
5. **Headers** (`next.config.mjs`): CSP tudo-'self' etc. **só valem no `next
   dev`** — o GitHub Pages não aplica headers (igual aos outros apps do repo).
6. ~~Basic auth (`middleware.ts`)~~ — **removido**; site público.
7. **XSS**: React escapa por padrão; sem `dangerouslySetInnerHTML` no projeto.
   Chaves: `.gitignore` cobre `.env*`; sem segredo em código.

## 7. Decisões técnicas (e o porquê)

- **Identidade "PARIS AO ANOITECER" (2026-07-06), NÃO Duolingo** — o usuário
  rejeitou o clone do Duolingo (07-03) e DEPOIS a identidade editorial clara
  (07-06, "não consegue fazer algo inovador, bonito, atraente, prático?").
  Atual: escuro premium `#0d1020` com brilho radial no topo, cartões de vidro
  (`.cartao` gradiente + borda), **gradiente-assinatura** azul→violeta
  (`--grad-a #5b7cfa` → `--grad-b #9d7bfa`, texto via `.grad-texto`), dourado
  `--ouro #e8b45a` para progresso/meta, nav flutuante com blur (`.nav-vidro`),
  vibração tátil nos exercícios (`navigator.vibrate` em `Sessao.tsx`).
  Estrutura (2026-07-06, após o usuário rejeitar "ficar rolando tela pra
  baixo" e pedir algo "novo/ousado"): abas **Viagem · Frases · Tutor · Você**.
  **Viagem** (`Viagem.tsx`) = home SEM rolagem vertical: carrossel horizontal
  snap de CARTÕES-CENA (1 por capítulo, com clima de cor, progresso e UMA ação
  principal; lições detalhadas numa gaveta; último cartão = biblioteca de
  gramática; revisão SRS = 1 linha no topo). **🎭 CENAS AO VIVO** (`Cena.tsx` +
  `data/dialogos.json` + `lib/dialogos.ts`) = a inovação-assinatura: roleplay
  em modo teatro — o atendente FALA (TTS), objetivo em PT, o aluno escolhe
  falas REAIS (frases verificadas), o app fala a fala dele; erro → feedback
  com humor (campo `porQue`); 100% determinístico (diferente dos concorrentes
  de roleplay por IA, aqui NADA é gerado em runtime). Cena destrava com 1
  lição do capítulo; +15 pts (+5 perfeita) em `lingo:cenas` (`lib/jogo.ts`).
  **Frases** (`Frases.tsx`): phrasebook busca+filtro, toque no cartão = fala,
  🐢 devagar, offline. "Pontos" na UI (não "XP" — internos `xp*` mantidos).
  Sem mascote coruja. Posicionamento: "francês que faz sentido".
- **Nome "Lingo"** (não "Unolingo"): curto e não soa cópia do Duolingo.
- **Sem hearts/vidas**: punição frustra iniciante; a pressão vem da meta+streak.
- **Trilha linear** com repetição livre de lições concluídas.
- **Cache do SW**: qualquer mudança visual grande deve **bumpar `CACHE` em
  `public/sw.js`** (v2 = identidade editorial), senão instalações antigas
  continuam vendo a UI velha (stale-while-revalidate).
- **Gramática como cidadã de primeira classe**: lições na trilha E biblioteca
  na aba própria (reler vale metade do XP).
- **Fonte de verdade das lições = ids** (`itemIds` no curso → content.json);
  `validarCurso()` acusa referência quebrada.
- **Tudo determinístico fora do Tutor** — mesmos motivos do Bagagem (confiável
  e barato). JSON (não SQLite), fetch (não SDK), TTS/STT do navegador: mantidos.
- **Estado antigo (`bagagem:*`) não é migrado** — protótipo, recomeço limpo.

## 8. Roadmap

- **Feito (jul/2026):** reconstrução completa (curso/exercícios/gramática-ponte/
  tutor/revisão/perfil) + PWA + modo mock + guardrails (§6b) + identidade
  editorial própria (§7). Publicado no Vercel (jul) e depois **migrado para o
  GitHub Pages** como site estático (ago/2026, §5b).
- **Feito (ago/2026) — melhorias no player:** exercícios menos repetitivos
  (2 formatos distintos por frase), botão VOLTAR (‹) para rever exercícios, e
  "Próxima lição →" encadeando a trilha ao concluir (`Sessao.tsx`,
  `LicaoGramatica.tsx`, `curso.ts#proximaAposLicao`).
- **Feito (ago/2026) — sincronização na nuvem** (`lib/nuvem.ts`): progresso deixa
  de ser só local e passa a subir para o RTDB (nó `planos/lingo-dt2026`),
  sincronizando entre aparelhos como os outros apps. Resolve o "sumiu meu
  progresso" (que era, na verdade, localStorage preso a um domínio/aparelho).
- **Feito (jul/2026) — aba Palavras (vocabulário):** baralho de cards que viram
  para treino de caderno. Dois modos: **Escrever** (vê figura/emoji + PT →
  escreve o FR à mão e fala → vira e confere palavra + pronúncia + áudio) e
  **Ditado** (ouve o FR → escreve o que ouviu → vira e confere a grafia).
  Auto-avaliação Acertei/Errei liga na revisão espaçada (`lib/srs.ts`).
  Conteúdo: itens `tipo: "vocab"` em `data/content.json` (campos extras
  `emoji`/`imagem`/`tema`/`genero`), lidos por `lib/vocab.ts`. Componente
  `components/Vocabulario.tsx`; animação de virar em `app/globals.css` (`.vira`).
- **Próximos:** mais conteúdo verificado por unidade (Tatoeba com filtros
  melhores), áudio TTS premium com cache, pronúncia por fonema (Azure),
  ícone PNG p/ iOS, contas com sincronização (Supabase). Tutor com IA real
  exigiria voltar a um servidor (o site hoje é estático, sem chave de API).

## 9. Convenções

- Código e UI em **português**; conteúdo novo precisa `status: "verificado"`
  (idealmente `desmontado` + `pronuncia` simplificada p/ PT-BR) e passar no
  `npm run verificar-conteudo`.
- Tema via variáveis CSS em `app/globals.css`; cores de unidade via
  `lib/cores.ts` (tokens `--verde`, `--azul`…). Classes do design system:
  `.botao` (variantes azul/verde/vermelho/claro), `.opcao`, `.chip`, `.cartao`,
  `.tricolor`, `.serif`. Na UI escrever "pontos" (nunca "XP") e manter o tom
  editorial (ver §7 e memória `feedback-nao-parecer-duolingo`).
- Deploy: **GitHub Pages** via workflow do repo raiz (push no `master` →
  build + publish em `/app/lingo/`). Mudança visual grande → bumpar `CACHE` em
  `public/sw.js`.
