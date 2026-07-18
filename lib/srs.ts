// Repetição espaçada ENTRE dias (FSRS-lite, estilo SM-2 simplificado).
// Cada frase praticada ganha uma data de revisão (due). O que está vencido
// hoje volta na "Revisão de hoje". Tudo no aparelho (localStorage), sem custo.

export interface CartaoSRS {
  intervalo: number; // dias até a próxima revisão
  facilidade: number; // multiplicador (≥ 1.3)
  due: string; // data da próxima revisão (YYYY-MM-DD)
}

const CHAVE = "lingo:srs";

function isoHoje(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function isoEmDias(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function ler(): Record<string, CartaoSRS> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "{}");
  } catch {
    return {};
  }
}

function salvar(m: Record<string, CartaoSRS>) {
  localStorage.setItem(CHAVE, JSON.stringify(m));
}

/** Atualiza o agendamento de uma frase após uma resposta. */
export function registrarSRS(id: string, acertou: boolean) {
  const m = ler();
  const c = m[id] ?? { intervalo: 0, facilidade: 2.3, due: isoHoje() };

  if (acertou) {
    const proximo =
      c.intervalo <= 0
        ? 1
        : c.intervalo === 1
        ? 3
        : Math.round(c.intervalo * c.facilidade);
    c.intervalo = proximo;
    c.due = isoEmDias(proximo);
  } else {
    c.facilidade = Math.max(1.3, c.facilidade - 0.2);
    c.intervalo = 1;
    c.due = isoEmDias(1); // erra hoje → revê amanhã
  }

  m[id] = c;
  salvar(m);
}

/** Ids de frases cuja revisão está vencida (due ≤ hoje). */
export function idsVencidos(): Set<string> {
  const m = ler();
  const hoje = isoHoje();
  const s = new Set<string>();
  for (const [id, c] of Object.entries(m)) {
    if (c.due <= hoje) s.add(id);
  }
  return s;
}

/** Quantas frases já estão agendadas (foram estudadas alguma vez). */
export function totalAgendados(): number {
  return Object.keys(ler()).length;
}

/** Ids de todas as frases já praticadas (para progresso automático de metas). */
export function idsAgendados(): Set<string> {
  return new Set(Object.keys(ler()));
}
