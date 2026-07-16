# Paris Planner — fonte (para recompilar)

Projeto React + Vite que gera o site publicado em `/paris-planner/`.
Guardado aqui para facilitar **atualizações futuras** do app.

## Atualizar com uma versão nova (fluxo)
Quando chegar um `paris-trip-planner.tsx` novo (exportado do artifact do Claude):

1. Substituir `src/App.jsx` pelo conteúdo do novo `.tsx`.
2. Trocar o storage do Claude por `localStorage` (só se o arquivo novo voltar a usar
   `window.storage`): as funções `loadKey`/`saveKey` devem usar
   `localStorage.getItem` / `localStorage.setItem`.
3. Compilar e publicar:
   ```bash
   cd paris-planner-src
   npm install
   npm run build
   rm -rf ../paris-planner/assets ../paris-planner/index.html
   cp -r dist/. ../paris-planner/
   ```
4. Commit + push + merge → o GitHub Pages republica no mesmo link.

## Configuração
- `vite.config.js` usa `base: /app/paris-planner/` (caminho do Pages).
- Tailwind com as cores do app (`limestone`, `ink`, `seine`, `wine`, `brass`).
- Fontes Google (Fraunces, Work Sans, IBM Plex Mono) via `@import` em `src/index.css`.

> O app é **somente leitura** (conteúdo fixo no código) e salva preferências locais
> via `localStorage`. As atualizações de conteúdo/funcionalidade vêm do `.tsx` novo.
