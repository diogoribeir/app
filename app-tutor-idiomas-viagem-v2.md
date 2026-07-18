# 🧳 Bagagem — Tutor de Idiomas para Viagem (v2)
### Spec + Prompt mestre + Plano de ação + **Arquitetura de Confiabilidade**

> **Pitch:** um tutor de IA que ensina a *entender e construir* um idioma para uma viagem específica — explicando o porquê, corrigindo seus erros e te fazendo falar. O diferencial técnico desta versão: **uma arquitetura que garante a correção do que é ensinado sem depender de você revisar manualmente.**

---

## 1. A tese do produto (o que faz "ensinar de verdade")

Adulto aprende rápido quando entende o **sistema**, não quando repete cartões. Quatro princípios:

1. **Input compreensível** — conteúdo um pouco acima do nível, sempre em contexto real de viagem.
2. **Ensino explícito do padrão** — toda regra é explicada usando a **língua materna como ponte** (cognatos, padrões compartilhados: PT -ção → FR -tion).
3. **Produção com correção** — o aluno fala/escreve e recebe correção do **seu** erro, com a regra.
4. **Repetição espaçada** — o que aprende volta na hora certa.

### Os 5 "anti-Duolingo" (regras de design)
- ❌ Frases desconexas → ✅ Tudo em situação real de viagem.
- ❌ Só certo/errado → ✅ Sempre explicar o porquê na língua do usuário.
- ❌ Todo mundo igual → ✅ Adapta ao seu erro e à sua viagem.
- ❌ Streak como objetivo → ✅ Se virar na situação real é o objetivo.
- ❌ Decorar → ✅ Construir: medir se o aluno produz frases novas.

---

## 2. Usuário e "job to be done"

Adulto com viagem marcada, ~30 min/dia, partindo do zero. *"Quero me virar sozinho em [restaurante, hotel, rua, compras, emergência] na viagem de [data], entendendo o que falo."* O app monta o roteiro **de trás pra frente a partir da data da viagem**.

---

## 3. ⭐ Arquitetura de Confiabilidade (o coração da v2)

> **O ponto-chave:** "garantia de 100%" só existe para informação que **não é gerada na hora — é buscada de fonte verificada.** A estratégia é classificar tudo em 3 camadas de confiança e tratar cada uma de um jeito. Isso é, na prática, o que o Duolingo faz: conteúdo curado por humanos + avaliadores automáticos.

### As 3 camadas de verdade

**🟢 Camada A — Fatos determinísticos (≈100% confiável)**
Conjugação, gênero do substantivo, números, ortografia. **Não tem IA achando — é consulta (lookup) em dado de referência curado.** Confiável porque é dado, não previsão.
- Conjugação: dataset/biblioteca de conjugação francesa (ex.: **Verbiste**)
- Léxico e gênero: **Lexique.org**, **Wiktionary** (dumps legíveis por máquina via **Kaikki**)

**🟡 Camada B — Conteúdo curado (alta confiança)**
O "banco-fonte" de frases e regras de viagem. **Verificado UMA vez** e reusado. É daqui que o app ensina.
- Frases de exemplo vindas de **corpus humano**: **Tatoeba** (frases traduzidas por pessoas, PT↔FR, aberto e grátis)
- Cada frase **cruzada com várias fontes** antes de entrar: dicionários (**Larousse**, **Le Robert**, **WordReference**), exemplos reais (**Reverso Context**, **Linguee**) e **Google Cloud Translation API** como voto independente
- Regra: só entra no banco o que passa no cruzamento (ver pipeline abaixo)

**🔴 Camada C — Geração livre (precisa de guarda)**
Conversa ao vivo, explicação adaptada, tradução de qualquer frase nova do aluno. **Aqui 100% é impossível** — é a parte que a IA gera de fato. Por isso ela passa pela guarda automática e, em último caso, cai pro conteúdo verificado das camadas A/B.

### O pipeline de validação automática (roda sozinho, sem você no meio)

Espelha o que o Duolingo faz — **Gerar → Avaliar → Selecionar**:

1. **Gerar** — o modelo produz um candidato (frase, correção, exemplo).
2. **Avaliar** — checagens automáticas em série:
   - *Determinística:* a conjugação bate com o conjugador? a palavra existe no léxico? o gênero está certo? (camada A)
   - *Concordância de tradução:* o **Google Translation API** e/ou outra fonte concordam com a tradução? Discordância = sinal vermelho.
   - *Avaliador IA:* um segundo prompt agindo como "examinador de francês rigoroso" marca se está gramaticalmente correto, natural e no nível certo. *(A IA é comprovadamente melhor checando do que gerando — por isso o avaliador é separado do gerador.)*
3. **Selecionar** — só é exibido o que passa em **todas** as checagens. Se falhar, o app não mostra e usa conteúdo verificado (A/B).
4. **Portão de CI no build** — quando entra conteúdo novo no banco, um teste automático confere cada item contra as fontes e **só te sinaliza as divergências**. Você revisa exceção, não tudo. Confiando nas fontes, a revisão manual tende a zero.

### Onde a IA fica presa ao conteúdo verificado (RAG)
O tutor só pode ensinar **a partir do que está nas camadas A/B**, citando a fonte internamente. Se um fato não está na fonte confiável, ele não é apresentado como verdade — vira "deixa eu confirmar" em vez de invenção.

### O que isso garante (resumo honesto)
- **~100%** na camada A (lookup) e alta confiança na B (curado + cruzado).
- A camada C **não** tem garantia absoluta, mas é cercada por avaliadores e cai pro verificado quando falha.
- **Regra de ouro do design:** tudo que *precisa* estar certo mora em A/B; a liberdade da IA fica só na didática (camada C), onde uma imperfeição é tolerável e o aluno corrige no uso.

---

## 4. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | **Next.js + React + Tailwind** (PWA) | Ótimo no celular sem loja de apps |
| Backend | **API routes do Next.js** | Monolito simples no v1 |
| Cérebro tutor | **API Anthropic** — Sonnet nos turnos normais, Opus 4.8 nas explicações difíceis | Explica, conversa, corrige |
| **Avaliador (guarda)** | **2º prompt Anthropic** "examinador" + checagens determinísticas | Valida a geração livre |
| Fatos (camada A) | **Verbiste**, **Lexique.org**, **Wiktionary/Kaikki** | Lookup determinístico |
| Frases (camada B) | **Tatoeba** + cruzamento com **Google Cloud Translation API**, Reverso, Linguee | Corpus humano + votos independentes |
| Voz (TTS) | **OpenAI/Google TTS** (barato) ou **ElevenLabs** (premium), com cache | Voz nativa |
| Pronúncia | **Azure Speech – Pronunciation Assessment** | Nota fonema a fonema |
| Repetição espaçada | **FSRS** (lib JS) | Mais eficiente que SM-2 |
| Banco | **SQLite** → **Supabase/Postgres** | Começa simples, escala depois |
| Deploy | **Vercel** | Casa com Next.js |

---

## 5. O motor pedagógico (system prompt do tutor)

```
Você é tutor especialista de {idioma_alvo} para falante nativo de {lingua_materna},
preparando-se para viagem a {destino} em {data_viagem}. Nível: {nivel}.

REGRAS:
- Ensine o SISTEMA, não frases soltas — o aluno deve CONSTRUIR frases novas.
- Use a língua materna como PONTE (cognatos, padrões compartilhados).
- Ao corrigir, explique o PORQUÊ em {lingua_materna}, curto. Nunca só "errado".
- Ensine APENAS a partir do CONTEÚDO VERIFICADO fornecido no contexto (RAG).
  Se algo não estiver nele, diga que vai confirmar — NÃO invente como fato.
- 1 conceito novo por vez. Seja caloroso e direto.

DEVOLVA a cada turno: (1) resposta natural e encorajadora + (2) JSON:
{ correcoes:[{erro,correto,regra_pt,tipo}], vocab_novo:[{alvo,traducao,desmontado}],
  audio_texto:[...], proxima_meta:"..." }
```

E o **avaliador** (prompt separado, roda depois do tutor):
```
Você é um examinador rigoroso de {idioma_alvo}. Para cada frase abaixo, responda em JSON:
{ gramatica_ok:bool, natural:bool, nivel_ok:bool, problemas:[...] }.
Seja conservador: na dúvida, marque como problema.
```

---

## 6. Modelo de dados (esboço)

```
users    (id, lingua_materna, idioma_alvo, data_viagem, contexto, nivel)
content  (id, tipo[frase|regra|vocab], alvo, traducao, fonte, status[verificado|pendente]) ← camada B
facts    (lookup determinístico em Verbiste/Lexique — não precisa armazenar tudo)
cards    (id, user_id, content_id, fsrs_state)        ← repetição espaçada
errors   (id, user_id, tipo, exemplo, regra, resolvido)
goals    (id, user_id, descricao, status, semana_alvo)
```

---

## 7. ⭐ PROMPT MESTRE — cole no Claude Code

```
Vamos construir um app web "Bagagem": um tutor de IA que ensina um idioma para uma
viagem específica, focado em ENTENDER e CONSTRUIR (não decorar). Par inicial: ensinar
FRANCÊS para falante de PORTUGUÊS brasileiro; arquitetura preparada para outros pares.

PRINCÍPIO CENTRAL DE CONFIABILIDADE: o app NÃO pode ensinar francês inventado pelo modelo.
Implemente 3 camadas:
  A) FATOS DETERMINÍSTICOS por lookup (conjugação via Verbiste/dataset; gênero/léxico via
     Lexique.org ou Wiktionary/Kaikki). Sem IA gerando isso.
  B) CONTEÚDO CURADO: um banco de frases/regras de viagem semeado do corpus humano
     Tatoeba, cada item CRUZADO com Google Cloud Translation API + dicionário antes de
     receber status "verificado". O tutor só ensina a partir desse banco (RAG).
  C) GERAÇÃO LIVRE (conversa/adaptação) passa por um PIPELINE Gerar→Avaliar→Selecionar:
     um segundo prompt "examinador" + checagens determinísticas validam antes de exibir;
     se falhar, faça fallback para conteúdo verificado.
Adicione um passo de CI que valida conteúdo novo contra as fontes e sinaliza só as divergências.

PRINCÍPIOS PEDAGÓGICOS (refletir no system prompt do tutor):
  - Ensinar o padrão, não frases soltas; explicar o porquê em português usando cognatos;
    corrigir o erro específico com a regra; contexto sempre de viagem; currículo montado
    de trás pra frente a partir da data da viagem.

STACK: Next.js + React + Tailwind (PWA), API routes, API Anthropic (tutor + avaliador),
FSRS, SQLite no início.

TRABALHE EM FASES; antes de cada uma, mostre um plano curto. Comece pela FASE 1 (MVP, texto):
onboarding + tutor conversacional (com o system prompt acima e saída em JSON) + frases
"desmontadas" + roteiro com metas "consigo fazer X". Já deixe a camada de conteúdo
verificado (B) e a guarda (C) estruturadas, mesmo que com poucos dados de exemplo.
NÃO implemente áudio nem reconhecimento de fala ainda (fases 2 e 3).
Crie um README com setup e onde colocar as chaves (variáveis de ambiente, nunca no código).
Me pergunte se algo estiver ambíguo antes de codar.
```

---

## 8. Plano de ação em fases

**Fase 0 — Setup** (instalar Claude Code, repo, chaves, env).
**Fase 1 — MVP (texto):** onboarding + tutor + correção com porquê + frases desmontadas + roteiro. **Já com as camadas B e C estruturadas.** *Pronto quando:* você erra de propósito e recebe correção clara explicando a regra.
**Fase 1.5 — Semear e blindar o conteúdo:** importar frases-núcleo do Tatoeba, cruzar com Google Translation API + dicionário, marcar "verificado"; ligar o avaliador automático e o CI. *Pronto quando:* conteúdo não-verificado nunca é ensinado como fato.
**Fase 2 — Voz nativa (TTS)** com cache e "ouvir devagar".
**Fase 3 — Falar e ser corrigido** (Azure Pronunciation Assessment → dica explicada).
**Fase 4 — Memória:** FSRS + roteiro adaptativo por erro e data.
**Fase 5 — Polimento:** PWA, offline, contas (Supabase), novos pares de idiomas.

---

## 9. Setup prático (contas, chaves, custos)

**Claude Code:** instalador nativo (recomendado, sem dependências, auto-update) **ou** `npm install -g @anthropic-ai/claude-code` (precisa de **Node.js 18+**). Há app de desktop (macOS/Windows). Guia: https://docs.claude.com/en/docs/claude-code/overview — na 1ª vez você autentica com sua conta Anthropic; a API é **paga por uso**.

| Quando | Serviço | Observação |
|---|---|---|
| Fase 1 | **Anthropic API** | tutor + avaliador; pago por uso |
| Fase 1.5 | **Tatoeba** (grátis), **Google Cloud Translation API** (pago, cruzamento), **Lexique.org / Wiktionary / Verbiste** (grátis/abertos) | base verificada |
| Fase 2 | **OpenAI/Google/ElevenLabs** (TTS) | comece barato, cacheie |
| Fase 3 | **Azure Speech** | tem tier grátis |
| Fase 5 | **Supabase** / **Vercel** | tiers grátis |

> ⚠️ Preços e nomes de modelos mudam — confira o valor atual no painel de cada serviço. **Nunca** ponha chaves no código; use variáveis de ambiente.

---

## 10. Como saber se "ensina de verdade" (métricas)

Não meça XP. Meça competência:
- **Geração:** o aluno produz uma frase **nova** e correta que nunca viu pronta?
- **Compreensão:** entende um diálogo curto quase em velocidade real?
- **Autocorreção:** percebe e conserta o próprio erro após a explicação?
- **Metas de viagem:** quantas "consigo fazer X" estão concluídas até a data?
- **Qualidade do conteúdo (saúde do app):** % de itens "verificados" no banco; nº de candidatos reprovados pelo avaliador (quanto mais reprova, melhor a guarda está funcionando).

---

*Lembrete realista: a v2 te dá ~100% de confiança nos FATOS (camadas A/B) e uma guarda forte na conversa livre (C). Não existe app de IA generativa que garanta 100% na geração livre — nem o Duolingo, que teve erros públicos e se apoia em conteúdo humano-curado + avaliadores. Esta arquitetura tira a validação das suas mãos e a coloca em dados confiáveis + checagens automáticas.*
