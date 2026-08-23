// Gerador DETERMINÍSTICO de exercícios (sem IA, sem custo): tudo sai das
// frases verificadas da camada B. Estilos: apresentar, escolher (PT↔FR),
// montar a frase com peças, e ouvir (áudio → texto).

import { itensVerificados } from "./camadaB";
import type { Exercicio, ItemConteudo, Nivel } from "./types";

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Quebra uma frase em peças (chips): palavras com apóstrofo ficam juntas. */
export function tokenizar(frase: string): string[] {
  return frase
    .replace(/[.!?…]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[«"(]+|[»"),:;]+$/g, ""))
    .filter(Boolean);
}

function normalizarToken(t: string): string {
  return t.toLowerCase();
}

/** Frases verificadas que servem de "distrator" (excluindo o próprio item). */
function poolDistratores(exceto: ItemConteudo): ItemConteudo[] {
  return itensVerificados().filter((i) => i.tipo === "frase" && i.id !== exceto.id);
}

function opcoesDe(item: ItemConteudo, campo: "alvo" | "traducao", n: number): string[] {
  const outras = embaralhar(poolDistratores(item))
    .map((i) => i[campo])
    .filter((t) => t !== item[campo])
    .slice(0, n - 1);
  return embaralhar([item[campo], ...outras]);
}

function exEscolher(item: ItemConteudo, direcao: "pt-fr" | "fr-pt", nOpcoes: number): Exercicio {
  const campo = direcao === "pt-fr" ? "alvo" : "traducao";
  return {
    tipo: "escolher",
    direcao,
    item,
    opcoes: opcoesDe(item, campo, nOpcoes),
    correta: item[campo],
  };
}

function exMontar(item: ItemConteudo): Exercicio | null {
  const alvoTokens = tokenizar(item.alvo);
  if (alvoTokens.length < 3 || alvoTokens.length > 9) return null;

  const presentes = new Set(alvoTokens.map(normalizarToken));
  const distratores = embaralhar(
    poolDistratores(item)
      .flatMap((i) => tokenizar(i.alvo))
      .filter((t) => !presentes.has(normalizarToken(t)))
  );
  // 2 peças-isca deixam o exercício interessante sem virar caça-palavra.
  const iscas = [...new Set(distratores.map(normalizarToken))]
    .slice(0, 2)
    .map((n) => distratores.find((d) => normalizarToken(d) === n)!);

  return { tipo: "montar", item, pecas: embaralhar([...alvoTokens, ...iscas]), alvoTokens };
}

function exOuvir(item: ItemConteudo, nOpcoes: number): Exercicio {
  return { tipo: "ouvir", item, opcoes: opcoesDe(item, "alvo", nOpcoes), correta: item.alvo };
}

/** Nº de opções e mistura de direções conforme o nível do aluno. */
function configNivel(nivel: Nivel): { nOpcoes: number; usaFRPT: boolean } {
  if (nivel === "iniciante") return { nOpcoes: 3, usaFRPT: false };
  if (nivel === "basico") return { nOpcoes: 4, usaFRPT: true };
  return { nOpcoes: 4, usaFRPT: true };
}

/**
 * Escolhe um tipo de teste para uma frase, sorteando entre os formatos
 * possíveis para aquele item (evita cair sempre no mesmo estilo). Recebe o
 * tipo usado na rodada anterior para não repetir dois iguais em seguida.
 */
function tiposPossiveis(
  item: ItemConteudo,
  nivel: Nivel
): ("escolher-pt-fr" | "escolher-fr-pt" | "montar" | "ouvir")[] {
  const { usaFRPT } = configNivel(nivel);
  const tipos: ("escolher-pt-fr" | "escolher-fr-pt" | "montar" | "ouvir")[] = [
    "escolher-pt-fr",
    "ouvir",
  ];
  if (usaFRPT) tipos.push("escolher-fr-pt");
  // só oferece montar se a frase render peças suficientes
  if (exMontar(item)) tipos.push("montar");
  return tipos;
}

function exDoTipo(
  item: ItemConteudo,
  tipo: "escolher-pt-fr" | "escolher-fr-pt" | "montar" | "ouvir",
  nOpcoes: number
): Exercicio {
  if (tipo === "montar") return exMontar(item)!;
  if (tipo === "ouvir") return exOuvir(item, nOpcoes);
  return exEscolher(item, tipo === "escolher-fr-pt" ? "fr-pt" : "pt-fr", nOpcoes);
}

/**
 * Fila de uma LIÇÃO NOVA: ensina todas as frases primeiro (evita o "eco" de
 * testar logo após mostrar) e fecha com um quiz variado sobre elas.
 * Cada frase é testada em DOIS formatos diferentes, sorteados por item, para
 * que a mesma lição não pareça sempre a mesma sequência de exercícios.
 */
export function gerarFilaLicao(itens: ItemConteudo[], nivel: Nivel): Exercicio[] {
  const frases = itens.filter((i) => i.tipo !== "regra");
  const { nOpcoes } = configNivel(nivel);

  const ensino: Exercicio[] = frases.map((item) => ({ tipo: "apresentar", item }));

  // Para cada frase, sorteia 2 formatos DISTINTOS entre os possíveis — assim
  // cada item aparece de dois jeitos e a mistura muda a cada abertura.
  const quiz: Exercicio[] = [];
  frases.forEach((item) => {
    const opcoes = embaralhar(tiposPossiveis(item, nivel));
    const quantos = Math.min(2, opcoes.length);
    for (let i = 0; i < quantos; i++) {
      quiz.push(exDoTipo(item, opcoes[i], nOpcoes));
    }
  });

  const filaQuiz = embaralhar(quiz);
  // Fala fica por último: é opcional (pulável) e fecha a lição falando.
  const falar: Exercicio[] = frases.length > 0 ? [{ tipo: "falar", item: frases[0] }] : [];

  return [...ensino, ...filaQuiz, ...falar];
}

/** Fila de REVISÃO (SRS): sem apresentação, direto aos exercícios. */
export function gerarFilaRevisao(itens: ItemConteudo[], nivel: Nivel): Exercicio[] {
  const frases = itens.filter((i) => i.tipo !== "regra");
  const { nOpcoes, usaFRPT } = configNivel(nivel);

  const fila: Exercicio[] = [];
  frases.forEach((item, idx) => {
    const escolhaMontar = exMontar(item);
    if (idx % 3 === 2 && escolhaMontar) fila.push(escolhaMontar);
    else if (idx % 3 === 1) fila.push(exOuvir(item, nOpcoes));
    else fila.push(exEscolher(item, usaFRPT && idx % 2 === 1 ? "fr-pt" : "pt-fr", nOpcoes));
  });
  return embaralhar(fila);
}
