# 🇫🇷 Lingo — O método de francês para brasileiros

**Use agora: https://lingo-liard-kappa.vercel.app**

Um curso de francês em capítulos, construído sobre a **gramática-ponte**: o
francês explicado a partir do português (cognatos -ção→-tion, le/la ≈ o/a,
"j'ai faim" = "tenho fome"…). A proposta é **entender o idioma**, não decorar
telinhas — com identidade editorial própria, sequência de estudo e meta diária
sóbrias, sem estética de joguinho.

**Regra de ouro:** nada de francês inventado por IA. Todas as lições,
exercícios e explicações vêm de **conteúdo verificado por humanos**. A IA só
atua no módulo **Tutor** (tirar dúvidas em português), protegida por uma guarda
gerador→avaliador.

## O que tem

- 📖 **Curso** — 8 capítulos e 26 lições (restaurante, hotel, cidade, compras,
  emergências…), exercícios variados: montar frase com peças, múltipla escolha
  PT↔FR, escuta e fala.
- ✒️ **Gramática** — 8 conceitos-ponte PT-BR→francês, com exemplos em áudio,
  tabelas de conjugação e mini-quiz.
- 🔊 **Áudio grátis** — ouvir cada frase em ritmo normal e 🐢 devagar
  (voz do navegador), e 🎤 praticar a fala com nota tolerante.
- 🗂️ **Revisão** — repetição espaçada: o que você praticou volta na hora certa.
- 💬 **Tutor** — chat de dúvidas em português (Claude; opcional, roda em modo
  demonstração sem chave).
- 👤 **Você** — pontos, dias seguidos, gráfico da semana, ajustes de nível e meta.

## Como rodar

Pré-requisito: **Node.js 18+**.

```bash
npm install
npm run dev     # http://localhost:3000
```

Tudo funciona sem chave de API (o Tutor responde em modo demonstração).
Para ligar o Tutor de verdade: copie `.env.example` → `.env.local` e preencha
`ANTHROPIC_API_KEY`.

O app é uma **PWA**: aberto no celular, dá para "Adicionar à tela de início" e
usar como app, inclusive offline. Todo o progresso fica no seu aparelho.

## Usar no celular (mesma rede Wi-Fi)

1. Deixe o computador ligado com `npm run dev` rodando.
2. Descubra o IP do computador: `ipconfig` → "IPv4" do adaptador Wi-Fi.
3. No Chrome do celular, abra `http://SEU-IP:3000` (ex.: `http://192.168.15.5:3000`).
4. Menu ⋮ → "Adicionar à tela de início" para virar um atalho de app.

Nesse modo o áudio 🔊 funciona; só o exercício de fala 🎤 fica indisponível
(o navegador exige HTTPS para o microfone — publique no Vercel para ter tudo).

## Validação de conteúdo

```bash
npm run verificar-conteudo   # portão de CI: conteúdo vs fontes determinísticas
npx tsc --noEmit             # checagem de tipos
```
