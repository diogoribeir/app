# Paris Trip Planner (build)

Site estático **já compilado** (React + Vite) do planejador de viagem a Paris.
Publicado no GitHub Pages em `/paris-planner/`.

- App **somente leitura**: o conteúdo (orçamento, cronograma, saúde, etc.) é editado
  no código-fonte (`.tsx`) e recompilado. Persistência local via `localStorage`.
- Gerado a partir do componente React `paris-trip-planner.tsx` com Vite
  (`base: /Web-scraping-Sample/paris-planner/`), trocando `window.storage` por `localStorage`.

Estes arquivos (`index.html` + `assets/`) são a saída do `vite build`.
