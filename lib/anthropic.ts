// Cliente fino da API Anthropic via fetch (sem SDK extra).
// Se não houver ANTHROPIC_API_KEY, o app roda em MODO MOCK.

export const MODELOS = {
  tutor: "claude-sonnet-4-6", // turnos normais
  tutorDificil: "claude-opus-4-8", // explicações difíceis
  avaliador: "claude-sonnet-4-6", // a "guarda" (camada C)
} as const;

export function temChave(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface ChamadaParams {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Faz uma chamada à API Anthropic e devolve o texto da resposta.
 * Lança erro se não houver chave (chame temChave() antes p/ decidir mock).
 */
export async function chamarClaude({
  system,
  user,
  model = MODELOS.tutor,
  maxTokens = 1200,
}: ChamadaParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!resp.ok) {
    const detalhe = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${detalhe}`);
  }

  const data = await resp.json();
  const texto = data?.content?.[0]?.text;
  if (typeof texto !== "string") throw new Error("Resposta inesperada da API");
  return texto;
}

/** Extrai o primeiro bloco JSON de um texto (o modelo às vezes embrulha em prosa). */
export function extrairJSON<T>(texto: string): T | null {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim < inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    return null;
  }
}
