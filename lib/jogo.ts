// Gamificação do Lingo: XP, ofensiva (streak) e lições concluídas.
// Tudo no aparelho (localStorage) — sem servidor, deploy-ready.

const K_ATIVIDADE = "lingo:atividade"; // { "2026-07-02": 30, ... } xp por dia
const K_LICOES = "lingo:licoes"; // { licaoId: "2026-07-02", ... }
const K_CENAS = "lingo:cenas"; // { dialogoId: "2026-07-02", ... }

export const XP_LICAO = 10;
export const XP_BONUS_PERFEITA = 5;
export const XP_REVISAO = 10;
export const XP_CENA = 15;

function isoHoje(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function lerMapa<T>(chave: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(chave) || "{}");
  } catch {
    return {};
  }
}

function salvarMapa<T>(chave: string, m: Record<string, T>) {
  localStorage.setItem(chave, JSON.stringify(m));
}

/** Soma XP na atividade de hoje. */
export function ganharXP(xp: number) {
  const m = lerMapa<number>(K_ATIVIDADE);
  const hoje = isoHoje();
  m[hoje] = (m[hoje] ?? 0) + xp;
  salvarMapa(K_ATIVIDADE, m);
}

export function xpHoje(): number {
  return lerMapa<number>(K_ATIVIDADE)[isoHoje()] ?? 0;
}

export function xpTotal(): number {
  return Object.values(lerMapa<number>(K_ATIVIDADE)).reduce((a, b) => a + b, 0);
}

/** Dias seguidos com atividade, terminando hoje ou ontem (streak). */
export function ofensiva(): number {
  const m = lerMapa<number>(K_ATIVIDADE);
  const dias = new Set(Object.keys(m).filter((d) => (m[d] ?? 0) > 0));
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // A ofensiva não quebra se você ainda não estudou HOJE — começa a contar de ontem.
  if (!dias.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dias.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Últimos 7 dias (para o gráfico do perfil): [{dia, xp}] do mais antigo ao atual. */
export function atividadeSemana(): { dia: string; xp: number }[] {
  const m = lerMapa<number>(K_ATIVIDADE);
  const out: { dia: string; xp: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ dia: iso, xp: m[iso] ?? 0 });
  }
  return out;
}

export function concluirLicao(licaoId: string, xp: number) {
  const m = lerMapa<string>(K_LICOES);
  m[licaoId] = isoHoje();
  salvarMapa(K_LICOES, m);
  ganharXP(xp);
}

export function licoesFeitas(): Set<string> {
  return new Set(Object.keys(lerMapa<string>(K_LICOES)));
}

export function concluirCena(dialogoId: string, xp: number) {
  const m = lerMapa<string>(K_CENAS);
  m[dialogoId] = isoHoje();
  salvarMapa(K_CENAS, m);
  ganharXP(xp);
}

export function cenasFeitas(): Set<string> {
  return new Set(Object.keys(lerMapa<string>(K_CENAS)));
}

export function totalLicoesFeitas(): number {
  return licoesFeitas().size;
}
