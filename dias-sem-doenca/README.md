# 🩺 Dias sem Doença — Di & Tati

App que conta há quantos dias **Di** e **Tati** estão sem ficar doentes (estilo "X dias sem acidente", mas para doenças), com **placar do casal**.

Funciona em **dois modos**:

- **Local** (sem configuração): salva só no próprio aparelho (`localStorage`). Ótimo para uso pessoal e offline.
- **Compartilhado** (com Firebase): login do casal + banco na nuvem, sincronizando **ao vivo** entre os dois celulares, com dados privados.

## Funcionalidades
- Contadores individuais de **dias sem doença** (Di e Tati) + **placar do casal** (dias sem ninguém doente).
- Registrar doença (zera o contador da pessoa e guarda a doença), marcar recuperação (recomeça a contagem).
- **Histórico** com exclusão de registros; **recorde** individual e do casal.
- **Backup**: exportar/importar os dados (menu ⋯).
- Tema claro/escuro automático, layout de uma tela só, instalável (PWA), offline.

## Modo compartilhado (Firebase)
1. Crie um projeto grátis em https://console.firebase.google.com
2. Registre um app **Web** e copie a config do SDK.
3. Cole os valores em `firebase-config.js`.
4. Ative **Authentication → Email/Senha** e crie **um usuário** (a conta do casal). Desative novos cadastros.
5. Ative **Firestore Database** e use a regra:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /casal/{doc} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
6. Os dois entram no app com o mesmo e-mail/senha e veem os mesmos dados ao vivo.

> Enquanto `firebase-config.js` estiver com `COLE_AQUI`, o app roda no modo **local**.

## Deploy no Vercel
1. https://vercel.com → login com GitHub → **Add New → Project** → importar este repositório.
2. **Root Directory:** `dias-sem-doenca` · **Framework Preset:** Other · **Deploy**.
3. Abra o link `.vercel.app` no celular → **Adicionar à tela de início**.

## Testar no computador
```bash
cd dias-sem-doenca
python3 -m http.server 8000
```
Abra `http://localhost:8000`.

## Arquivo único (uso pessoal, offline)
`Dias-sem-Doenca.html` é uma versão **local** em arquivo único: baixe e abra no navegador, sem servidor.
