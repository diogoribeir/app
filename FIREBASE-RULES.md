# Regras Firebase Realtime Database — apps-4b887

Acesse: https://console.firebase.google.com/project/apps-4b887/database/apps-4b887-default-rtdb/rules

## Regras atuais (inseguras)
```json
{
  "rules": {
    "planos": {
      ".read": true,
      ".write": true
    },
    ".read": false,
    ".write": false
  }
}
```

## Regras recomendadas para PRIVACIDADE (Placar do Casal — aplicar agora)

O **Placar do Casal** (`casal-pontos`) usa um **código secreto** que deriva o nó no banco
(`planos/casal-<hash>`). Para o código realmente proteger, o `/planos` inteiro **não pode ser
legível** — senão qualquer um lê `/planos.json` e vê todos os nós/dados (buraco que hoje afeta
**todos** os apps). Estas regras bloqueiam a leitura do `/planos` inteiro, mas mantêm cada nó
filho (nome conhecido) totalmente legível/gravável — então **os outros apps continuam funcionando
igual** e a deleção de eventos do Placar continua permitida.

```json
{
  "rules": {
    "planos": {
      ".read": false,
      ".write": false,
      "$plan": {
        ".read": true,
        ".write": true
      }
    },
    ".read": false,
    ".write": false
  }
}
```

- ✅ Todos os apps continuam funcionando (leem/gravam nós conhecidos).
- 🚫 Ninguém consegue mais **listar** `/planos.json` (não descobre os nós dos outros).
- 🔒 Sem o código do Placar, não dá pra achar/ler o nó do casal.
- ⚠️ Limitação: quem **adivinhar** o nome de um nó ainda o lê — por isso o código do Placar deve ter
  entropia (não usar `1234`/nomes). Proteção total só com login (não usado aqui).

Aplicar: https://console.firebase.google.com/project/apps-4b887/database/apps-4b887-default-rtdb/rules
→ colar → **Publicar**.

## Regras recomendadas (aplicar agora)

Estas regras mantêm o funcionamento dos apps mas bloqueiam os piores abusos:
- Leitura continua livre (os apps não têm login)
- Escrita exige que os dados sejam um objeto válido (não vazio)
- Limita o tamanho de cada campo a 100.000 bytes (impede flood de dados)
- Bloqueia deleção total dos nós principais

```json
{
  "rules": {
    "planos": {
      ".read": true,
      "perfil-gamer-dt2026": {
        ".write": "newData.exists()",
        "jogos": {
          ".validate": "newData.isString() || newData.hasChildren()"
        },
        "plano2026": {
          ".validate": "newData.isString() || newData.hasChildren()"
        }
      },
      "paris-planner-dt2026": {
        ".write": "newData.exists()",
        ".validate": "newData.isString() || newData.hasChildren()"
      },
      "dias-sem-doenca-dt2026": {
        ".write": "newData.exists()",
        ".validate": "newData.isString() || newData.hasChildren()"
      },
      "lingo-dt2026": {
        ".write": "newData.exists()",
        ".validate": "newData.isString() || newData.hasChildren()"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

### O que muda com essas regras
- ✅ Os apps continuam funcionando normalmente
- ✅ Escrita continua livre para os apps (sem login)
- ✅ HR-V removido — o nó hrv-comparador-dt2026 ficará bloqueado para escrita
- 🚫 Ninguém pode **apagar** um nó inteiro (DELETE) — o principal risco
- 🚫 Ninguém pode escrever `null` ou dados vazios

### Limitação importante
Mesmo com essas regras, alguém ainda pode **sobrescrever** os dados com lixo.
A proteção completa exige autenticação (login), que tornaria os apps mais complexos.

### Passos para aplicar
1. Abra: https://console.firebase.google.com/project/apps-4b887/database/apps-4b887-default-rtdb/rules
2. Substitua o conteúdo pelas regras acima
3. Clique em **Publicar**

### Segurança adicional (fazer manualmente)
- **GitHub 2FA**: https://github.com/settings/security → "Enable two-factor authentication"
  → Essa é a proteção mais importante: sem 2FA, quem pegar sua senha controla o site inteiro
- **Gmail 2FA**: Já deve estar ativo — confirmar em https://myaccount.google.com/security
- **Backup Firebase**: exportar os dados periodicamente em
  https://apps-4b887-default-rtdb.firebaseio.com/planos.json (salvar o arquivo)
