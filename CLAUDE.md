# CLAUDE.md — entry point (always-on, manter ENXUTO)

> Este arquivo é injetado no contexto **a cada sessão e a cada compactação**.
> Tudo aqui custa orçamento de contexto permanente. **Não dumpe detalhe aqui** —
> coisa longa/volátil vai para os docs sob demanda abaixo. Mantenha curto.

**Lingo** — o MÉTODO de francês p/ falantes de PT-BR: curso em capítulos,
**gramática-ponte** PT-BR→FR, módulo Tutor de IA. Identidade **editorial
francesa** — ⚠️ NUNCA parecer/posicionar como Duolingo (exigência do usuário).
Next.js 15 + React 19 + Tailwind v4 + TS. Produção:
https://lingo-liard-kappa.vercel.app (deploy: `npx vercel --prod --yes`).

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
- Sem `ANTHROPIC_API_KEY` o app roda em **modo mock** (só a aba Tutor usa API).

## Documentação (ler SOB DEMANDA — não está sempre no contexto)
- **`DOCUMENTACAO-TECNICA.md`** — fonte técnica completa: 3 camadas, mapa de
  arquivos, curso/exercícios, decisões, roadmap, convenções. Leia ao mexer em
  arquitetura/arquivos/conteúdo. **Mantenha-a atualizada.**
- `app-tutor-idiomas-viagem-v2.md` — plano-spec original (visão/histórico).
- `README.md` — setup para o usuário final.
