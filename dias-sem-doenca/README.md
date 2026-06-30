# 🩺 Dias sem Doença

App **offline** que conta há quantos dias **Di** e **Tati** estão sem ficar doentes — no estilo do quadro "X dias sem acidente", mas para doenças.

## O que ele faz
- **Dois contadores**, um para Di e outro para Tati, cada um mostrando os **dias sem doença**.
- O **relógio conta sozinho**: a contagem aumenta automaticamente a cada dia, mesmo com o app fechado (ele recalcula pela data).
- Quando alguém **fica doente**, você registra: o contador **zera** e fica marcado como *doente*, guardando **qual foi a doença** (e uma observação opcional).
- Enquanto a pessoa está doente, aparece **há quantos dias está doente** (acompanha a recuperação).
- Quando a pessoa **se recupera**, você marca a recuperação: aí o contador de "dias sem doença" **recomeça do zero** a partir da data em que sarou.
- Guarda o **histórico** de todas as doenças (início, fim e duração) e o **recorde** de maior sequência saudável.
- **Tudo fica salvo no próprio celular** (não usa internet, não manda dados pra lugar nenhum).

## Como instalar no celular (Android)
Como é um PWA, ele instala direto pelo navegador, sem loja:

1. Coloque os arquivos desta pasta em qualquer hospedagem HTTPS (ex.: GitHub Pages) **ou** abra o `index.html` por um servidor local.
2. Abra o endereço no **Chrome** do Android.
3. Menu (⋮) → **Adicionar à tela de início** / **Instalar app**.
4. Pronto: vira um ícone na tela inicial e **abre offline**, como um app normal.

> No iPhone: abra no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.

### Testar no computador
Dentro desta pasta:
```bash
python3 -m http.server 8000
```
Abra `http://localhost:8000` no navegador. (Um servidor é necessário para o modo offline / service worker funcionar.)

## Arquivos
- `index.html` — tela do app
- `styles.css` — visual
- `app.js` — lógica (contagem, doenças, histórico, salvamento local)
- `manifest.webmanifest` — define o app instalável
- `sw.js` — service worker (faz funcionar offline)
- `icons/` — ícones do app

## Reiniciar
O botão **"Reiniciar tudo"** no rodapé apaga o histórico e zera os dois contadores.
