# Roteiro Paris — Planejador de Viagem (set/2026)

Aplicação web de página única que substitui a planilha "Roteiro_Paris_Setembro_2026.xlsx".
Reproduz as 10 abas originais (Resumo, Seleção, Programação, Cronograma, Atrações, Comer,
Brechós, Transporte, Orçamento, Evitar) com recálculo automático do orçamento e
sincronização opcional entre aparelhos.

- **Arquivo único:** `index.html` — sem build, sem dependências, funciona offline.
- **Stack:** HTML + CSS + JavaScript vanilla (ES2020). Firebase Realtime Database
  (SDK modular v10, carregado sob demanda via `import()` dinâmico) apenas quando a
  sincronização está configurada.

---

## 1. Funcionalidades

| Funcionalidade | Como funciona |
|---|---|
| Cenário 10 ↔ 12 dias | Toggle no cabeçalho. Mostra/oculta os dias extras (D10*, D11*, D12*, marcados em laranja) e recalcula todo o orçamento. |
| Seleção SIM/NÃO | Cada local pode ser cortado. O roteiro risca a atividade, mostra o substituto sugerido da planilha e o orçamento desconta o preço na hora. |
| Orçamento editável | Campos azuis (hospedagem, alimentação, jantares, compras, reserva) recalculam total, por pessoa e por dia — mesmas fórmulas da planilha. |
| Roteiro dia a dia | Cartões expansíveis (`<details>`) com o cronograma hora a hora, lógica de eficiência de cada dia e custo do dia (desconta cortes). |
| Checklist de reservas | Na aba Resumo; estado persistido. |
| Persistência local | `localStorage`, automática a cada mudança. |
| Link com snapshot | Botão "Copiar link" sem sync: estado serializado em base64 no hash (`#plano=...`). |
| Sincronização em tempo real | Com Firebase configurado: código de viagem (`#viagem=...`) conecta todos os aparelhos ao mesmo plano. |

## 2. Arquitetura do `index.html`

```
<style>     tokens de tema (claro/escuro) + componentes
<body>      cabeçalho (total, toggle 10/12, botões) + tabbar + <main> renderizado por JS
<script>
  ├── DADOS  ......... conteúdo da planilha embutido como constantes JS
  │     SEL_ITEMS      itens da aba Seleção (id, preço casal, prioridade, substituto, cenário)
  │     DAYS           dias com slots hora a hora (custo, transporte, tipo, sel-id)
  │     RESUMO / RESERVAS / ATRACOES / COMER / BRECHOS / TRANSPORTE / REGRAS_OURO / EVITAR
  ├── SINCRONIZAÇÃO ... FIREBASE_CONFIG, connectSync(), pushSync(), renderSyncUI()
  ├── ESTADO  ......... state {ext, sel, budget, checks}, loadState()/saveState()/applyParsed()
  ├── CÁLCULO ......... calcBudget(), dayCost() — as "fórmulas" da planilha
  ├── RENDER  ......... 9 views (uma por aba) que geram HTML e re-renderizam a cada mudança
  └── EVENTOS ......... delegação de click/change no document
```

### Estado

```js
state = {
  ext: 0 | 1,                    // cenário: 0 = 10 dias, 1 = 12 dias  (era a célula B4 da planilha)
  sel: { [id]: boolean },        // SIM/NÃO por item da Seleção
  budget: {                      // células editáveis (azuis) do Orçamento
    hospUnit: 140, alimUnit: 75, jantUnit: 60, jantQty: 2, brechos: 150, reserva: 200
  },
  checks: { [id]: boolean }      // checklist de reservas
}
```

Chaves no `localStorage`:

- `roteiro-paris-2026-v1` — o `state` acima (JSON).
- `roteiro-paris-2026-sync-code` — código da viagem para sincronização.

### Fórmulas do orçamento (`calcBudget()`)

Equivalências com a planilha (aba Orçamento, B4 = `ext`):

| Linha | Fórmula |
|---|---|
| Hospedagem | `hospUnit × (8 + 2·ext)` noites |
| Alimentação | `alimUnit × (9 + 2·ext)` dias |
| Jantares especiais | `jantUnit × jantQty` |
| Atrações | **soma automática** dos itens SIM da Seleção no cenário atual, exceto os de linha própria (`cruzeiro`, `paulbert`, `giverny`, `flv`) |
| Cruzeiro Sena | `30` se `sel.cruzeiro` |
| Transporte urbano | `175 + 15·ext` |
| Giverny | `124` se `ext && sel.giverny` (inclui trem SNCF, fora do Navigo) |
| Fondation LV | `36` se `ext && sel.flv` |
| Brechós / Reserva | valores editáveis |
| Totais | soma; por pessoa `= total/2`; por dia `= total/(10 + 2·ext)` |

Valores de verificação: padrão 10 dias = **€ 2.720**; padrão 12 dias = **€ 3.325**
(idênticos à planilha com B4 = 0/1).

### Links compartilháveis (hash da URL)

- `#plano=<base64url(JSON do state)>` — snapshot estático; quem abre substitui o
  próprio plano local. Sempre funciona, mesmo sem Firebase.
- `#viagem=<código>` — entra na viagem sincronizada; o código é salvo no aparelho
  e o hash é removido da URL (`history.replaceState`) para não vazar em prints.

## 3. Sincronização (Firebase Realtime Database)

### Modelo

- Um nó por viagem: `planos/<código>`, contendo `{ by, at, state }`.
  - `by` — id aleatório do cliente que gravou (suprime eco: cada aparelho ignora
    a notificação da própria gravação).
  - `at` — timestamp da gravação.
  - `state` — o estado completo do plano.
- Estratégia de conflito: **last-write-wins** com debounce de 400 ms na gravação.
  Suficiente para 2 pessoas; não há merge por campo.
- O SDK só é baixado (via `import()` de `gstatic.com`) se `FIREBASE_CONFIG` estiver
  preenchido **e** houver código de viagem — sem config o app é 100% estático.

### Configuração

Em `index.html`, preencher a constante:

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "<projeto>.firebaseapp.com",
  databaseURL: "https://<projeto>-default-rtdb.firebaseio.com", // OBRIGATÓRIA p/ RTDB
  projectId: "<projeto>",
  appId: "..."
};
```

> Atenção: o console do Firebase costuma omitir `databaseURL` no snippet — copie a URL
> exibida no topo da tela do Realtime Database. Bancos fora dos EUA usam outro domínio
> (ex.: `https://<projeto>-default-rtdb.europe-west1.firebasedatabase.app`).

Regras do Realtime Database (aba *Regras* → Publicar):

```json
{
  "rules": {
    "planos": { ".read": true, ".write": true },
    ".read": false,
    ".write": false
  }
}
```

### Modelo de segurança (limitações conhecidas)

- Qualquer pessoa com o **código da viagem** lê e escreve aquele plano — o código é a
  senha. Usar códigos não óbvios (o app sugere `paris-` + 6 caracteres aleatórios).
- O nó `planos` é público para quem souber adivinhar um código; não guardar dados
  sensíveis no plano. Para endurecer: Firebase Auth anônimo + regras por usuário.
- A `apiKey` do Firebase **não é secreta** (identifica o projeto, não autentica);
  pode ficar no HTML público.

### Teste rápido do banco

Abrir `https://<databaseURL>/planos/teste.json` no navegador:

| Resposta | Diagnóstico |
|---|---|
| `null` | Banco existe e regras publicadas — pronto. |
| `{"error":"Permission denied"}` | Banco existe, regras não publicadas/erradas. |
| `404 / not found` | Banco não existe nessa URL: Realtime Database não criado (só Firestore?) ou região diferente. |

## 4. Deploy

### GitHub Pages (atual)

O workflow `.github/workflows/deploy-pages.yml` publica no push para `master`:

- raiz do site → app `dias-sem-doenca` (URL antiga preservada)
- `/roteiro-paris/` → este app

URL final: `https://diogoribeir.github.io/app/roteiro-paris/`

### Alternativas

Qualquer host estático serve (Vercel, Netlify, etc.) — é um arquivo só. A hospedagem
**não** influencia a sincronização (quem sincroniza é o Firebase); apenas o Artifact
do claude.ai não sincroniza, porque o CSP de lá bloqueia hosts externos.

## 5. Fluxo de uso (2 pessoas)

1. Pessoa A abre o app → **Sincronizar entre aparelhos** → escolhe o código.
2. A toca **Copiar link com meu plano** (o link vira `#viagem=<código>`) e envia.
3. Pessoa B abre o link: entra na mesma viagem; o plano da nuvem substitui o local.
4. Daí em diante, qualquer mudança de um aparece no outro em ~1 s, com orçamento
   recalculado. Sem internet, cada um segue editando local; ao reconectar, a última
   gravação vence.

## 6. Desenvolvimento e testes

- Não há build: editar `index.html` e abrir no navegador (`file://` funciona).
- Testes manuais automatizados usados no desenvolvimento (Playwright + Chromium
  headless): valores de verificação do orçamento, corte de itens, persistência,
  link snapshot e fluxo de sincronização com SDK mockado (interceptação das URLs
  `gstatic.com/firebasejs`). Roteiro dos casos:
  1. Total padrão €2.720 (10d) / €3.325 (12d);
  2. Cortar Louvre → −€64; ligar Panthéon → +€26;
  3. Editar hospedagem 140→160 → +€160; sobrevive a reload;
  4. `#plano=` reproduz o estado em outro contexto de navegador;
  5. Com sync: gravação debounced com `by` do cliente; update remoto re-renderiza;
     `#viagem=` no link de compartilhamento.

### Convenções do código

- Sem framework: views são funções que retornam HTML string; re-render completo a
  cada mudança de estado (a página é pequena — sem custo perceptível).
- Delegação de eventos no `document` com atributos `data-*`
  (`data-tab`, `data-sel`, `data-budget`, `data-check`).
- Todo texto dinâmico passa por `esc()` antes de entrar no HTML.
- Tema claro/escuro por tokens CSS (`:root`, `@media (prefers-color-scheme)` e
  overrides `:root[data-theme=...]`).
- Não re-renderizar sincronamente dentro de `change` de `<input>` (quebra o DOM
  durante o blur) — usar `setTimeout(render, 0)`.

## 7. Estrutura de dados de conteúdo

Para alterar o roteiro (novos horários, preços, restaurantes), editar as constantes
no topo do `<script>`:

- `SEL_ITEMS` — cada item: `{id, n(ome), t(ipo), d(ia), p(reço casal €), pr(ioridade), cut(substituto), sc:"ext"?, off:true?}`.
  - `sc:"ext"` → só existe no cenário 12 dias; `off:true` → começa como NÃO (curingas).
  - Itens com linha própria no orçamento: manter `BUDGET_OWN_LINE` em dia.
- `DAYS` — cada dia: `{id, num, date, title, sub, sc?, logic, slots:[{t, w, m, tp, c?, sel?}]}`.
  - `tp` ∈ `destaque | refeição | desloc | livre`; `c` = custo casal €; `sel` liga o
    slot a um item da Seleção (risca e desconta quando cortado).
- Preços/observações das abas informativas: `ATRACOES`, `COMER`, `BRECHOS`,
  `TRANSPORTE`, `EVITAR`, `RESUMO`, `RESERVAS`.

## 8. Solução de problemas

| Sintoma | Causa provável / correção |
|---|---|
| Botão "Sincronizar" não aparece | `FIREBASE_CONFIG` é `null`. |
| Toast "Sincronização indisponível: permission_denied" | Regras do RTDB não publicadas. |
| Toast "Não consegui conectar" | Sem internet, `databaseURL` errada/região errada, ou host com CSP bloqueando `gstatic.com` (caso do Artifact). |
| Plano "voltou no tempo" | Last-write-wins: alguém gravou por cima depois de ficar offline. Não há histórico — o nó guarda só o estado atual. |
| Mudança não aparece no outro aparelho | Conferir se ambos mostram o chip "✓ Sincronizado" com o MESMO código. |
