// Sincronização na nuvem (Firebase Realtime Database via REST) — Receita 1,
// a mesma dos outros apps do casal. Como o Lingo guarda o progresso em várias
// chaves `lingo:*` no localStorage (perfil, pontos/sequência, lições, cenas,
// SRS), sincronizamos TUDO num pacote só no nó `planos/lingo-dt2026`:
//
//   - ao abrir: carrega o pacote da nuvem e escreve nas chaves locais;
//   - a cada mudança: reenvia o pacote (debounce) + carimbo `_at`;
//   - ao voltar pro app: se a nuvem tem gravação mais nova, recarrega.
//
// localStorage continua sendo a cópia offline (o app lê dele normalmente).
// Sem login: quem souber a URL do nó lê/escreve (o nome funciona como senha),
// então nada de dado sensível aqui — só progresso de estudo. Última gravação vence.

const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/lingo-dt2026";
const PREFIXO = "lingo:";

let syncStamp = 0; // carimbo da última gravação conhecida (nuvem)
let timer: ReturnType<typeof setTimeout> | null = null;
let voltaLigada = false; // evita registrar o listener mais de uma vez

function temLS(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Snapshot de todas as chaves `lingo:*` do localStorage (valores crus). */
function snapshotLocal(): Record<string, string> {
  const obj: Record<string, string> = {};
  if (!temLS()) return obj;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIXO)) {
      const v = localStorage.getItem(k);
      if (v != null) obj[k] = v;
    }
  }
  return obj;
}

/** Escreve o pacote da nuvem nas chaves locais (direto, sem re-disparar envio). */
function aplicarSnapshot(obj: Record<string, unknown>) {
  if (!temLS() || !obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(PREFIXO) && typeof v === "string") {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* cota cheia / modo privado: ignora */
      }
    }
  }
}

/**
 * Carrega o progresso da nuvem para o localStorage ANTES do app renderizar.
 * Se a nuvem estiver vazia ou offline, mantém o que já existe no aparelho.
 */
export async function carregarDaNuvem(): Promise<void> {
  if (!temLS()) return;
  try {
    const [rDados, rAt] = await Promise.all([
      fetch(`${SYNC_URL}/dados.json`, { cache: "no-store" }),
      fetch(`${SYNC_URL}/_at.json`, { cache: "no-store" }),
    ]);
    if (rAt.ok) {
      const at = await rAt.json();
      if (typeof at === "number") syncStamp = at;
    }
    if (rDados.ok) {
      const dados = await rDados.json();
      if (dados && typeof dados === "object") aplicarSnapshot(dados as Record<string, unknown>);
    }
  } catch {
    /* offline / Firebase bloqueado: segue com a cópia local */
  }
}

/** Envia o pacote atual para a nuvem (imediato). Best-effort. */
async function enviarAgora() {
  if (!temLS()) return;
  const dados = snapshotLocal();
  syncStamp = Date.now();
  try {
    await fetch(`${SYNC_URL}/dados.json`, {
      method: "PUT",
      body: JSON.stringify(dados),
      keepalive: true,
    });
    fetch(`${SYNC_URL}/_at.json`, {
      method: "PUT",
      body: JSON.stringify(syncStamp),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* offline: o localStorage já guardou; sobe na próxima */
  }
}

/** Agenda um envio (debounce) — chamado por quem grava progresso. */
export function agendarEnvio() {
  if (!temLS()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    enviarAgora();
  }, 800);
}

/**
 * Liga o "recarregar ao voltar": se outro aparelho gravou depois, recarrega
 * a página ao reabrir o app (mesma abordagem dos outros apps). Também tenta
 * mandar o que estiver pendente quando o app vai pro fundo.
 */
export function iniciarSyncVolta() {
  if (typeof document === "undefined" || voltaLigada) return;
  voltaLigada = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // saindo: garante que a última mudança suba antes de o SO congelar a aba
      if (timer) {
        clearTimeout(timer);
        timer = null;
        enviarAgora();
      }
      return;
    }
    // voltando: se a nuvem está mais nova, recarrega com os dados novos
    fetch(`${SYNC_URL}/_at.json`, { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => {
        if (typeof v === "number" && v > syncStamp + 1500) location.reload();
      })
      .catch(() => {});
  });
}
