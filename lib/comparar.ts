// Compara o que o aluno FALOU com a frase-alvo e dá uma nota TOLERANTE.
// O reconhecimento do navegador erra sons com frequência (ex.: ouve "excuse"
// em vez de "excusez"), então comparamos por SEMELHANÇA (distância de edição),
// não por igualdade exata — palavras parecidas contam como certas.

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ") // pontuação vira espaço
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let linha = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = linha[j];
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + custo);
      anterior = tmp;
    }
  }
  return linha[n];
}

/** Semelhança 0–1 entre duas palavras. */
function semelhanca(a: string, b: string): number {
  if (!a && !b) return 1;
  const maior = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / maior;
}

export interface ResultadoFala {
  nota: number; // 0–100 (média da semelhança por palavra)
  ditoNormalizado: string;
  faltaram: string[]; // palavras-alvo que ficaram bem diferentes
}

export function avaliarFala(dito: string, alvo: string): ResultadoFala {
  const ditoWords = normalizar(dito).split(" ").filter(Boolean);
  const alvoWords = normalizar(alvo).split(" ").filter(Boolean);

  let soma = 0;
  const faltaram: string[] = [];
  for (const w of alvoWords) {
    let melhor = 0;
    for (const d of ditoWords) melhor = Math.max(melhor, semelhanca(w, d));
    soma += melhor;
    if (melhor < 0.5) faltaram.push(w); // só conta como "faltou" se ficou bem longe
  }

  const nota = alvoWords.length
    ? Math.round((soma / alvoWords.length) * 100)
    : 0;

  return { nota, ditoNormalizado: ditoWords.join(" "), faltaram };
}
