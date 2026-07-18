// 🟢 CAMADA A — Fatos determinísticos.
// Nada de IA aqui: é consulta (lookup) em dado de referência curado.
// Confiável porque é dado, não previsão.

import facts from "@/data/facts.json";
import type { Conjugacao, Lexema } from "./types";

const CONJUGACOES = facts.conjugacoes as Conjugacao[];
const LEXICO = facts.lexico as Lexema[];

function normalizar(s: string): string {
  return s.trim().toLowerCase();
}

/** Devolve a conjugação no presente de um verbo, ou null se não estiver na base. */
export function conjugar(infinitivo: string): Conjugacao | null {
  const alvo = normalizar(infinitivo);
  return CONJUGACOES.find((c) => normalizar(c.infinitivo) === alvo) ?? null;
}

/** Devolve gênero + tradução de uma palavra, ou null se não estiver na base. */
export function buscarLexema(palavra: string): Lexema | null {
  const alvo = normalizar(palavra).replace(/^(le |la |l'|un |une )/, "");
  return LEXICO.find((l) => normalizar(l.palavra) === alvo) ?? null;
}

/**
 * Confere se uma forma verbal flexionada existe na base determinística.
 * Usado pela guarda da camada C. Retorna:
 *  - { conhecido: false } quando o verbo não está na base (não dá pra afirmar nada);
 *  - { conhecido: true, valido: bool } quando dá pra checar.
 */
export function validarFormaVerbal(
  infinitivo: string,
  forma: string
): { conhecido: boolean; valido: boolean } {
  const c = conjugar(infinitivo);
  if (!c) return { conhecido: false, valido: false };
  const formaNorm = normalizar(forma);
  const valido = Object.values(c.presente).some(
    (v) => normalizar(v) === formaNorm
  );
  return { conhecido: true, valido };
}

export function todasConjugacoes(): Conjugacao[] {
  return CONJUGACOES;
}

export function todoLexico(): Lexema[] {
  return LEXICO;
}
