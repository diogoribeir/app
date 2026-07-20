# 📱 Apps do Di & Tati — Catálogo + Receita de publicação

> **Como usar este arquivo:** anexe-o em qualquer chat novo do Claude ao criar um app novo.
> Ele contém (1) a lista de todos os apps existentes com links e (2) a receita completa
> para deixar um app novo online no mesmo esquema.
> **Manutenção:** sempre que um app novo for criado, ATUALIZAR a tabela do catálogo abaixo
> (e também o card em `home/index.html` e a seção do app no `CLAUDE.md` do repositório).

---

## 🗂️ Catálogo de apps (atualizado em 20/07/2026)

**Página inicial (lista todos):** https://diogoribeir.github.io/app/

| App | Link | Pasta no repositório | Sincronização |
|---|---|---|---|
| 🩺 Dias sem Doença | https://diogoribeir.github.io/app/dias-sem-doenca/ | `dias-sem-doenca/` | RTDB `planos/dias-sem-doenca-dt2026` (sem login) |
| 📊 Roteiro Paris (Diogo) | https://diogoribeir.github.io/app/roteiro-paris/ | `roteiro-paris/` | RTDB `planos/<código-da-viagem>` (código no app) |
| ✈️ Paris Trip Planner (Tati) | https://diogoribeir.github.io/app/paris-planner/ | `paris-planner/` (build) + `paris-planner-src/` (fonte) | RTDB `planos/paris-planner-dt2026` |
| 🎮 Perfil Gamer | https://diogoribeir.github.io/app/perfil-gamer/ | `perfil-gamer/` (app) + `perfil-gamer-src/` (dados) | RTDB `planos/perfil-gamer-dt2026` (nuvem = fonte da verdade; `dados.js` = seed) |
| 🛋️ Decora (decoração + orçamento) | https://diogoribeir.github.io/app/decoracao/ | `decoracao/` | RTDB `planos/decoracao-dt2026` (sem login; catálogo curado no próprio arquivo) |
| 🇫🇷 Lingo (francês) | https://lingo-liard-kappa.vercel.app | `lingo-src/` (fonte Next.js) | Sem nuvem de dados (progresso local) · **Hospedado no VERCEL** (tem servidor: tutor + senha) — NÃO deletar o projeto `lingo` no Vercel |

### Infraestrutura fixa
- **Repositório:** `diogoribeir/app` (https://github.com/diogoribeir/app) · branch principal `master`
- **Hospedagem:** GitHub Pages (workflow `.github/workflows/deploy-pages.yml`, publica a cada merge no `master`) — exceto o Lingo, que fica no Vercel por precisar de servidor
- **Banco:** Firebase, projeto único `apps-4b887` (Realtime Database no nó `planos/` para os apps; Firestore antigo do dias-sem-doenca guardado só como backup)
- **Fluxo git:** branch → commit → push → PR → merge no `master` (o Claude pode mergear e deve conferir o deploy `success`)
- **Contexto completo para o Claude:** arquivo `CLAUDE.md` na raiz do repositório (carregado automaticamente em sessões abertas no repositório)

---

# Receita técnica — criar um app novo neste projeto

Documentação para adicionar **qualquer app novo** ao esquema Di & Tati:
pasta no repositório → publicação no GitHub Pages → sincronização no Firebase.
Siga na ordem. Os blocos de código são reais (copiados dos apps que já funcionam).

> Contexto geral do projeto (repositório, apps existentes, links): ver `CLAUDE.md` na raiz.

---

## 0. Padrões fixos do projeto

| Item | Valor |
|---|---|
| Repositório | `diogoribeir/app` · branch principal `master` |
| Site | `https://diogoribeir.github.io/app/<pasta-do-app>/` |
| Deploy | GitHub Actions → `.github/workflows/deploy-pages.yml` (roda no push ao `master`) |
| Banco | Firebase, projeto único **`apps-4b887`** (Firestore + Realtime Database) |
| Fluxo git | branch → commit → push → PR → merge no `master` (Claude pode mergear) |

---

## 1. Criar a pasta do app

### Opção A — app simples (HTML/CSS/JS puro) ✅ preferida
Criar `meu-app/` com `index.html` (pode ser arquivo único, como o `roteiro-paris/`).
Regras de ouro (mobile-first):
- viewport: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`
- testar em 390px de largura; **cards em vez de tabelas**; nada de scroll horizontal;
- tema claro/escuro via `@media (prefers-color-scheme: dark)`;
- todo texto dinâmico passa por uma função `esc()` antes de entrar no HTML (anti-XSS).

### Opção B — app React (Vite)
```bash
npm create vite@latest meu-app-src -- --template react
cd meu-app-src && npm install
```
No `vite.config.js`, **obrigatório** apontar a base para o caminho do Pages:
```js
export default defineConfig({
  plugins: [react()],
  base: "/app/meu-app/"   // <- nome do repo + pasta publicada
})
```
Compilar e copiar o build para a pasta publicada:
```bash
npm run build
rm -rf ../meu-app/assets ../meu-app/index.html
cp -r dist/. ../meu-app/
```
Guardar `meu-app-src/` no repositório (com `.gitignore` contendo `node_modules/` e `dist/`).

---

## 2. Adicionar o app ao deploy (GitHub Pages)

Editar `.github/workflows/deploy-pages.yml` em **2 lugares**:

**(1)** nos gatilhos (`on.push.paths`):
```yaml
      - "meu-app/**"
```

**(2)** no passo "Montar o site" (a raiz recebe a página inicial `home/`; cada app tem sua pasta):
```yaml
      - name: Montar o site
        run: |
          mkdir -p _site/dias-sem-doenca _site/roteiro-paris _site/paris-planner _site/meu-app
          cp -r home/. _site/
          cp -r dias-sem-doenca/. _site/dias-sem-doenca/
          cp -r roteiro-paris/. _site/roteiro-paris/
          cp -r paris-planner/. _site/paris-planner/
          cp -r meu-app/. _site/meu-app/
```
**(3)** adicionar o card do app novo na página inicial `home/index.html`.

Depois do merge no `master`, o workflow publica sozinho. Conferir na aba Actions que o run
terminou `success` — o app fica em `https://diogoribeir.github.io/app/meu-app/`.

---

## 3. Sincronização no Firebase (escolher UMA receita)

Config do projeto (pública por design — a segurança vem das regras/login):
```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBrnrJI6vY97YOiNBnWAs7_t1Okylk5EOY",
  authDomain: "apps-4b887.firebaseapp.com",
  databaseURL: "https://apps-4b887-default-rtdb.firebaseio.com",
  projectId: "apps-4b887",
  storageBucket: "apps-4b887.firebasestorage.app",
  messagingSenderId: "293435823400",
  appId: "1:293435823400:web:4c08cad7f5342c8b4a6c1d"
};
```

### Receita 1 — RTDB via REST, nó fixo (a mais simples; usada no `paris-planner`)
Sem login, sem SDK, sem configurar nada no console. Bom para dados **não sensíveis** do casal.
Escolher um nó **dentro de `planos/`** (as regras já liberam esse nó) com nome não óbvio:

```js
const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/meu-app-dt2026";
let syncStamp = 0;

async function loadKey(key, fallback) {          // carrega da nuvem, cai pro local
  try {
    const r = await fetch(`${SYNC_URL}/${key}.json`, { cache: "no-store" });
    if (r.ok) { const v = await r.json();
      if (v != null) { try{localStorage.setItem(key, v);}catch(e){} return JSON.parse(v); } }
  } catch (e) {}
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
async function saveKey(key, value) {             // salva local + nuvem + carimbo
  const s = JSON.stringify(value);
  try { localStorage.setItem(key, s); } catch (e) {}
  try {
    await fetch(`${SYNC_URL}/${key}.json`, { method: "PUT", body: JSON.stringify(s) });
    syncStamp = Date.now();
    fetch(`${SYNC_URL}/_at.json`, { method: "PUT", body: JSON.stringify(syncStamp) }).catch(()=>{});
  } catch (e) {}
}
// recarregar ao voltar pro app se alguém salvou depois
fetch(`${SYNC_URL}/_at.json`, { cache:"no-store" }).then(r=>r.json())
  .then(v=>{ if (typeof v === "number") syncStamp = v; }).catch(()=>{});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  fetch(`${SYNC_URL}/_at.json`, { cache:"no-store" }).then(r=>r.json())
    .then(v=>{ if (typeof v === "number" && v > syncStamp + 1500) location.reload(); })
    .catch(()=>{});
});
```
Limitações: quem descobrir a URL do nó lê/escreve (o nome funciona como senha);
conflito = última gravação vence.

### Receita 2 — RTDB com SDK e "código de viagem" (usada no `roteiro-paris`)
Igual à 1, mas o usuário escolhe um código no app (`planos/<código>`) e compartilha por link
`#viagem=<código>`; atualização em tempo real com `onValue`. Copiar o bloco
`connectSync()/pushSync()` de `roteiro-paris/index.html` (importa o SDK do
`gstatic.com/firebasejs` sob demanda). Usar quando o usuário deve poder trocar/criar planos.

### Receita 3 — Firestore com login (dados privados)
Para dados que **precisam de proteção de verdade** (ex.: saúde). Login e-mail/senha do casal
(Authentication já ativado; usuário já existe). Scripts `firebase-*-compat.js` no HTML +
`onSnapshot` no documento. Exemplo completo no histórico do git: versão do
`dias-sem-doenca/app.js` anterior a jul/2026 (o app migrou para a receita 1).
Regras do Firestore para um novo doc/coleção (console → Firestore → Regras):
```
match /minha-colecao/{doc} {
  allow read, write: if request.auth != null;
}
```

### Qual receita usar?
| Situação | Receita |
|---|---|
| Dados simples do casal, sem sensibilidade | **1** (REST, nó fixo) |
| Vários "planos" compartilháveis por link | **2** (código de viagem) |
| Dados sensíveis / privacidade importa | **3** (Firestore + login) |

### Regras atuais do RTDB (não mexer sem motivo)
```json
{ "rules": { "planos": { ".read": true, ".write": true }, ".read": false, ".write": false } }
```
Teste rápido: `https://apps-4b887-default-rtdb.firebaseio.com/planos/teste.json` →
`null` = ok · `Permission denied` = regras despublicadas.

---

## 4. PWA (opcional — instalar na tela de início)
Copiar de `dias-sem-doenca/`: `manifest.webmanifest` (ajustar nome/cores/ícones) +
`sw.js` (ajustar a lista `ASSETS` e o nome do cache `CACHE = "meu-app-v1"`) +
`<link rel="manifest">` e o registro do service worker no HTML.
**Sempre que atualizar o app, subir a versão do cache** (`v1` → `v2`), senão o celular segura a antiga.

---

## 5. Testar ANTES de publicar (obrigatório)
Servidor local + Chromium headless (Playwright já vem instalado no ambiente do Claude):
```bash
python3 -m http.server 8000   # na raiz do repositório
```
Checklist mínimo (viewport 390×844):
- [ ] zero erros no console (`pageerror` / `console.error`)
- [ ] fluxo principal do app funciona (clicar de verdade nos botões)
- [ ] sem scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`)
- [ ] modo escuro legível (`colorScheme: 'dark'`)
- [ ] com Firebase **bloqueado** (abortar rotas `**/planos/**`), o app abre com fallback local
- [ ] sincronização: simular o banco com `page.route()` e conferir GET na carga e PUT ao salvar

## 6. Publicar
```bash
git checkout -B claude/minha-branch origin/master
git add meu-app .github/workflows/deploy-pages.yml
git commit -m "Add meu-app"
git push -u origin claude/minha-branch
# abrir PR → merge no master → conferir run 'success' na aba Actions
```
Avisar o Diogo com o link final. Cache do celular pode levar alguns minutos.

---

## Checklist-resumo (novo app)
1. [ ] Pasta `meu-app/` criada (ou `meu-app-src/` + build, se React — conferir `base` no Vite)
2. [ ] Workflow atualizado (paths + montagem do site)
3. [ ] Sincronização: receita 1, 2 ou 3 conforme a sensibilidade dos dados
4. [ ] Fallback offline funcionando (localStorage)
5. [ ] Testes do item 5 todos verdes
6. [ ] PR → merge → deploy `success` → link testado no celular
7. [ ] `CLAUDE.md` atualizado com o app novo (URL, pasta, banco, como editar)
8. [ ] **Este arquivo (`RECEITA-APPS.md`): adicionar o app novo na tabela do catálogo**
