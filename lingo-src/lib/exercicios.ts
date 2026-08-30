// Gerador DETERMINÍSTICO de exercícios (sem IA, sem custo): tudo sai das
// frases verificadas da camada B. Estilos: apresentar, escolher (PT↔FR),
// montar a frase com peças, ouvir (áudio → texto) e completar a lacuna.
// Distratores vêm de frases do MESMO contexto (opções erradas plausíveis) e
// a fila evita dois exercícios do mesmo tipo em seguida (menos repetitivo).

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

/**
 * Frases verificadas que servem de "distrator" (excluindo o próprio item).
 * Prioriza frases do MESMO contexto (ex.: restaurante) — assim as opções
 * erradas são plausíveis de verdade, não um sorteio aleatório fácil.
 */
function poolDistratores(exceto: ItemConteudo): ItemConteudo[] {
  const todas = itensVerificados().filter((i) => i.tipo === "frase" && i.id !== exceto.id);
  const mesmoCtx = todas.filter((i) => i.contexto === exceto.contexto);
  const outros = todas.filter((i) => i.contexto !== exceto.contexto);
  // mesmo contexto primeiro (embaralhado), depois o resto como reserva
  return [...embaralhar(mesmoCtx), ...embaralhar(outros)];
}

function opcoesDe(item: ItemConteudo, campo: "alvo" | "traducao", n: number): string[] {
  const outras = poolDistratores(item)
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

/** Palavras "pequenas" que não valem a pena esconder numa lacuna. */
const PALAVRINHAS = new Set([
  "je", "tu", "il", "un", "une", "le", "la", "les", "de", "du", "à", "a",
  "et", "ou", "ne", "pas", "ce", "en", "s'il", "vous",
]);

/**
 * Completar a lacuna: esconde UMA palavra "de conteúdo" da frase e pede para
 * o aluno escolher qual é. Distratores são palavras de outras frases (mesmo
 * tamanho de desafio, sem virar caça-palavra).
 */
function exCompletar(item: ItemConteudo, nOpcoes: number): Exercicio | null {
  const tokens = tokenizar(item.alvo);
  if (tokens.length < 3) return null;

  // candidatas a esconder: palavras com ≥3 letras e que não sejam "palavrinhas"
  const candidatas = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.length >= 3 && !PALAVRINHAS.has(t.toLowerCase()));
  const alvo = (candidatas.length > 0 ? embaralhar(candidatas)[0] : null);
  if (!alvo) return null;

  const correta = alvo.t;
  const usada = new Set([correta.toLowerCase()]);
  const distratores: string[] = [];
  for (const d of poolDistratores(item).flatMap((i) => tokenizar(i.alvo))) {
    const n = d.toLowerCase();
    if (d.length >= 3 && !PALAVRINHAS.has(n) && !usada.has(n)) {
      usada.add(n);
      distratores.push(d);
      if (distratores.length >= nOpcoes - 1) break;
    }
  }
  if (distratores.length === 0) return null;

  return {
    tipo: "completar",
    item,
    tokens,
    lacuna: alvo.i,
    opcoes: embaralhar([correta, ...distratores]),
    correta,
  };
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
type TipoTeste = "escolher-pt-fr" | "escolher-fr-pt" | "montar" | "ouvir" | "completar";

function tiposPossiveis(item: ItemConteudo, nivel: Nivel): TipoTeste[] {
  const { usaFRPT, nOpcoes } = configNivel(nivel);
  const tipos: TipoTeste[] = ["escolher-pt-fr", "ouvir"];
  if (usaFRPT) tipos.push("escolher-fr-pt");
  // só oferece montar/completar se a frase render peças suficientes
  if (exMontar(item)) tipos.push("montar");
  if (exCompletar(item, nOpcoes)) tipos.push("completar");
  return tipos;
}

function exDoTipo(item: ItemConteudo, tipo: TipoTeste, nOpcoes: number): Exercicio {
  if (tipo === "montar") return exMontar(item)!;
  if (tipo === "completar") return exCompletar(item, nOpcoes)!;
  if (tipo === "ouvir") return exOuvir(item, nOpcoes);
  return exEscolher(item, tipo === "escolher-fr-pt" ? "fr-pt" : "pt-fr", nOpcoes);
}

/** Reordena para nunca deixar dois exercícios do MESMO tipo em seguida. */
function espalharTipos(fila: Exercicio[]): Exercicio[] {
  const restante = [...fila];
  const saida: Exercicio[] = [];
  while (restante.length > 0) {
    const anterior = saida[saida.length - 1];
    // acha o próximo cujo tipo é diferente do último colocado
    let idx = restante.findIndex((e) => !anterior || e.tipo !== anterior.tipo);
    if (idx === -1) idx = 0; // só sobrou o mesmo tipo: deixa passar
    saida.push(restante.splice(idx, 1)[0]);
  }
  return saida;
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

  const filaQuiz = espalharTipos(embaralhar(quiz));
  // Fala fica por último: é opcional (pulável) e fecha a lição falando.
  const falar: Exercicio[] = frases.length > 0 ? [{ tipo: "falar", item: frases[0] }] : [];

  return [...ensino, ...filaQuiz, ...falar];
}

/** Fila de REVISÃO (SRS): sem apresentação, direto aos exercícios. */
export function gerarFilaRevisao(itens: ItemConteudo[], nivel: Nivel): Exercicio[] {
  const frases = itens.filter((i) => i.tipo !== "regra");
  const { nOpcoes } = configNivel(nivel);

  const fila: Exercicio[] = [];
  frases.forEach((item, idx) => {
    // roda entre os formatos possíveis daquela frase (varia a cada revisão)
    const opcoes = embaralhar(tiposPossiveis(item, nivel));
    fila.push(exDoTipo(item, opcoes[idx % opcoes.length], nOpcoes));
  });
  return espalharTipos(embaralhar(fila));
}
