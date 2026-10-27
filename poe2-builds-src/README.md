# Forja PoE2 — gerador da biblioteca

O app `poe2-builds/` usa uma biblioteca de dados em `poe2-builds/kb/`. Ela tem duas partes:

| Arquivo | Natureza | O que tem |
|---|---|---|
| `kb/jogo.js` → `window.KB_JOGO` | **gerado** | versão/fonte, constantes do jogo (`consts`), classes, tipos de skill, skills ativas, suportes (efeito `fx`, vetores `v`, elementos `el`, compatibilidade `r`/`x`) |
| `kb/arvore.js` → `window.KB_ARVORE` | **gerado** | keystones, notáveis (com região STR/DEX/INT) e nós de ascendência |
| `kb/unicos.js` → `window.KB_UNICOS` | **gerado** | únicos (variante atual) com slot, base e modificadores |
| `kb/conceitos.js` → `window.KB_CONCEITOS` | **curado à mão** | vetores de dano, camadas de defesa, tópicos de mecânica, resumo/afinidades das ascendências, ferramentas |
| `kb/meta.js` → `window.KB_META` | **curado à mão** | retrato do meta (tier, ascendências, fontes, data) |

## Atualizar num patch novo (a cada ~4 meses)

1. Esperar o **Path of Building 2** publicar o suporte ao patch (repo `PathOfBuildingCommunity/PathOfBuilding-PoE2`).
2. Clonar fora do repositório (scratchpad):
   ```bash
   git clone --depth 1 https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git /caminho/pob2
   ```
3. Gerar (só **lê** os `.lua`/`.json` do PoB2 com o parser `lualit.py`; nada do PoB2 é executado):
   ```bash
   python3 -I poe2-builds-src/gerar_kb.py /caminho/pob2
   ```
   Saída esperada: `jogo.js`, `arvore.js`, `unicos.js` + um resumo com a contagem (skills, suportes, únicos…).
4. Revisar à mão:
   - `kb/conceitos.js`: `revisado`, `patch`, `jogo.atual/proximo`; tópicos cujas mecânicas mudaram nas patch notes;
     ascendências novas/alteradas (`ascendencias` — resumo PT, `afin` = tags de skill que combinam, `def`);
     classes novas (`classes`).
   - `kb/meta.js`: tier lists recentes + poe.ninja. Os nomes de skill/ascendência precisam bater **exatamente**
     com os do `jogo.js`.
5. Testar no Chromium (390px, claro/escuro, Firebase bloqueado) e **subir a versão `CACHE` em `poe2-builds/sw.js`**.

## Como o gerador classifica os suportes

- `fx`: texto real do efeito, montado com os `StatDescriptions` do PoB2.
- `v` (vetores): lido do texto `fx` + mods `MORE` do `statMap` — `more`, `conv` (gain as/conversão), `crit`,
  `taken` (inimigo toma mais: choque, wither…), `mitig` (penetração, exposição, quebra de armadura, maldição),
  `vel`, `ailment`, `clear`, `defesa`, `efic`; marcas de custo `menos` (penalidade) e `cond` (bônus condicional);
  restrições `semcrit`, `semailment`, `semelem`, `semcaos`.
- `el`: elementos que o suporte afeta (para não sugerir suporte de fogo em skill de raio).
- `r`/`x`: `requireSkillTypes`/`excludeSkillTypes` em notação pós-fixa (índices de `KB_JOGO.tipos`) — o app avalia
  igual ao `calcLib.doesTypeExpressionMatch` do PoB2.

Se um patch mudar o formato dos arquivos do PoB2 e o gerador quebrar, os pontos de leitura estão em
`gems_e_skills()`, `arvore()`, `unicos()` e `constantes()`.
