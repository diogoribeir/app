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

**Produção:** https://lingo-liard-kappa.vercel.app (ver §5b).

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
- Estado 100% no aparelho (`localStorage`, chaves `lingo:*`): perfil
  (`lib/estadoLocal.ts`), pontos/sequência/lições (`lib/jogo.ts` — nomes
  internos `xp*`; na UI o termo é "pontos"), SRS (`lib/srs.ts`).
  Deploy-ready em serverless; só `/api/tutor` usa servidor.
- Acesso: senha opcional via `middleware.ts` (HTTP Basic + `ACCESS_PASSWORD`,
  usuário padrão `lingo`, comparação timing-safe).
- PWA: `manifest.webmanifest` + `public/sw.js` (cache `lingo-v2`) + `icon.svg`
  ("L" serifado, papel creme, filete tricolor).

## 4. Estrutura de arquivos

```
middleware.ts                    # senha opcional (HTTP Basic, timing-safe)
app/
  layout.tsx, globals.css        # shell + DESIGN SYSTEM "Paris ao anoitecer" (.botao/.opcao/.chip/.cartao/.grad-texto/.nav-vidro)
  page.tsx                       # ⭐ shell de abas (Hoje·Curso·Frases·Tutor·Você) + nav flutuante + lição em tela cheia
  api/tutor/route.ts             # POST → guardrails → pipeline da camada C
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
  guardrails.ts                  # 🛡️ validação/saneamento + rate limit da /api/tutor (ver §6b)
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
- Sem `ANTHROPIC_API_KEY` → modo mock (só a aba Tutor usa API).

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

**✅ PUBLICADO NO VERCEL (2026-07-03):** produção em
**https://lingo-liard-kappa.vercel.app** (projeto `lingo`, conta Hobby
diogoribeir-2614s-projects; deploy manual via `npx vercel --prod --yes`, build
na nuvem — pode rodar com o dev local ligado). Com HTTPS, a PWA completa
funciona: instalar, offline e 🎤 microfone. Sem env vars configuradas → tutor
em modo mock; para ligar: painel Vercel → Settings → Environment Variables →
`ANTHROPIC_API_KEY` (e opcionalmente `ACCESS_PASSWORD`). O acesso via rede
local abaixo continua valendo como alternativa de dev.

**Servidor para deixar ligado:** `npm run dev` serve, mas para uso contínuo o
modo produção é mais leve e estável: parar o dev (⚠️ nunca buildar com dev no
ar) → `npm run build` → `npm start`.

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
  quiz embaralhado (escolher PT↔FR conforme nível, montar frase com chips + 2
  iscas, ouvir e reconhecer) → falar (opcional/pulável). Erro → reinsere no fim
  UMA vez. Revisão SRS = só quiz.
- **Progresso (lib/jogo.ts):** 10 pontos/lição (+5 perfeita), meta diária
  (20/40/60 pts), sequência de dias não quebra se ainda não estudou hoje.
  Tom sóbrio na UI — "pontos" e "dias seguidos", nunca "XP"/estética de jogo.

## 6b. Guardrails de segurança (2026-07-02)

A única superfície com custo/IA é `/api/tutor`; o resto é estático + estado no
aparelho. Camadas (todas testadas com requisições reais):

1. **Validação/saneamento** (`lib/guardrails.ts#validarTurno`): a rota NUNCA
   repassa o objeto do cliente — reconstrói `Usuario` só com campos saneados
   (nome ≤30 chars, sem controle/quebra de linha; nivel só do enum). Mensagem
   ≤500 chars, sem caracteres de controle; corpo não-JSON → 400.
2. **Rate limit por IP** (`dentroDoLimite`): 6 req/min, janela deslizante em
   memória com teto de 5k IPs (serverless: por instância — corta abuso simples;
   upgrade futuro: Upstash/KV). Excesso → 429.
3. **Anti-prompt-injection** (`lib/tutor.ts`): bloco SEGURANÇA no system prompt
   (mensagem do aluno é dado, não instrução; escopo só francês; sem revelar
   prompt), nome re-sanitizado na interpolação (`nomeSeguro`, só letras), e a
   guarda gerador→avaliador continua por cima.
4. **Erros genéricos**: exceções logadas no servidor (`console.error`), cliente
   recebe mensagem neutra — nada de stack/detalhe da API vaza.
5. **Headers** (`next.config.mjs`): CSP tudo-'self' (app não usa recurso
   externo), `frame-ancestors 'none'` + `X-Frame-Options DENY` (clickjacking),
   `nosniff`, `Referrer-Policy`, `Permissions-Policy` (mic só self, resto
   bloqueado), `poweredByHeader: false`. ⚠️ mudanças aí exigem REINICIAR o dev.
6. **Basic auth** (`middleware.ts`): comparação em tempo constante
   (`igualSeguro`), usuário padrão `lingo`.
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
  tutor/revisão/perfil) + PWA + modo mock + guardrails (§6b) + publicado no
  Vercel (§5b) + identidade editorial própria (§7).
- **Próximos:** mais conteúdo verificado por unidade (Tatoeba com filtros
  melhores), áudio TTS premium com cache, pronúncia por fonema (Azure),
  ícone PNG p/ iOS, contas com sincronização (Supabase), rate limit
  distribuído (Upstash/KV), ligar `ANTHROPIC_API_KEY` na produção.

## 9. Convenções

- Código e UI em **português**; conteúdo novo precisa `status: "verificado"`
  (idealmente `desmontado` + `pronuncia` simplificada p/ PT-BR) e passar no
  `npm run verificar-conteudo`.
- Tema via variáveis CSS em `app/globals.css`; cores de unidade via
  `lib/cores.ts` (tokens `--verde`, `--azul`…). Classes do design system:
  `.botao` (variantes azul/verde/vermelho/claro), `.opcao`, `.chip`, `.cartao`,
  `.tricolor`, `.serif`. Na UI escrever "pontos" (nunca "XP") e manter o tom
  editorial (ver §7 e memória `feedback-nao-parecer-duolingo`).
- Deploy: `npx vercel --prod --yes` (build na nuvem). Mudança visual grande →
  bumpar `CACHE` em `public/sw.js`.
