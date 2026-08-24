# CLAUDE.md — entry point (always-on, manter ENXUTO)

> Este arquivo é injetado no contexto **a cada sessão e a cada compactação**.
> Tudo aqui custa orçamento de contexto permanente. **Não dumpe detalhe aqui** —
> coisa longa/volátil vai para os docs sob demanda abaixo. Mantenha curto.

**Lingo** — o MÉTODO de francês p/ falantes de PT-BR: curso em capítulos,
**gramática-ponte** PT-BR→FR, módulo Tutor de IA. Identidade **editorial
francesa** — ⚠️ NUNCA parecer/posicionar como Duolingo (exigência do usuário).
Next.js 15 + React 19 + Tailwind v4 + TS. Produção (ago/2026 em diante):
**GitHub Pages, site ESTÁTICO** em https://diogoribeir.github.io/app/lingo/
(migrado do Vercel). Deploy = workflow do repo raiz (`npm ci && npm run build`
com `NEXT_PUBLIC_BASE_PATH=/app/lingo`, copia `out/`). **Sem servidor:** a rota
`/api/tutor` e o `middleware` foram removidos — o Tutor roda no navegador
(`lib/tutorCliente.ts`), **sempre em modo demonstração** (sem chave de API).
**Progresso sincroniza na nuvem** (RTDB, nó `planos/lingo-dt2026`, `lib/nuvem.ts`):
as chaves `lingo:*` sobem num pacote só; localStorage = cópia offline.

## Regra de ouro
O app **não ensina francês inventado pelo modelo**. Trilha/exercícios/gramática
saem do **conteúdo verificado** (camadas A/B + `data/gramatica.json`,
determinístico, sem IA). A IA só age na camada C (aba Tutor), cercada pela
guarda gerador+avaliador com fallback.

## Rodar / validar
- `npm install` → `npm run dev` (http://localhost:3000)
- Validar: `npx tsc --noEmit`. CI de conteúdo: `npm run verificar-conteudo`.
- ⚠️ **Nunca rodar `npm run build` com o `npm run dev` ligado** (corrompe `.next`
  → "Cannot find module './XXX.js'"). Conserto: parar node → `rm -rf .next` → dev.
- Build estático: `npm run build` gera `out/` (usa `output: "export"`). No Pages
  o workflow passa `NEXT_PUBLIC_BASE_PATH=/app/lingo`; local fica vazio.
- O Tutor roda **sempre em modo demonstração** (não há chave de API no site
  estático) — o pipeline roda no navegador via `lib/tutorCliente.ts`.

## Documentação (ler SOB DEMANDA — não está sempre no contexto)
- **`DOCUMENTACAO-TECNICA.md`** — fonte técnica completa: 3 camadas, mapa de
  arquivos, curso/exercícios, decisões, roadmap, convenções. Leia ao mexer em
  arquitetura/arquivos/conteúdo. **Mantenha-a atualizada.**
- `app-tutor-idiomas-viagem-v2.md` — plano-spec original (visão/histórico).
- `README.md` — setup para o usuário final.
