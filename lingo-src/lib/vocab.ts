// Vocabulário (aba Palavras / baralho de cards que viram).
// Fonte: SÓ conteúdo verificado da camada B (data/content.json, tipo "vocab").
// Nada de francês gerado por IA — mesma regra de ouro do resto do curso.

import { itensVerificados } from "./camadaB";
import type { ItemConteudo } from "./types";

export interface Tema {
  id: string;
  rotulo: string;
  emoji: string;
}

// Ordem e rótulos dos temas do baralho (do mais básico ao de viagem).
export const TEMAS: Tema[] = [
  { id: "saudacoes", rotulo: "Saudações", emoji: "👋" },
  { id: "numeros", rotulo: "Números", emoji: "🔢" },
  { id: "comida", rotulo: "Comida", emoji: "🥖" },
  { id: "restaurante", rotulo: "Restaurante", emoji: "🍽️" },
  { id: "hotel", rotulo: "Hotel", emoji: "🛏️" },
  { id: "rua", rotulo: "Na rua", emoji: "🧭" },
];

/** Todas as palavras verificadas (tipo "vocab"). */
export function vocabVerificado(): ItemConteudo[] {
  return itensVerificados().filter((i) => i.tipo === "vocab");
}

/** Palavras de um tema (ou todas, quando tema === "todos"). */
export function vocabDoTema(tema: string): ItemConteudo[] {
  const todas = vocabVerificado();
  if (tema === "todos") return todas;
  return todas.filter((v) => v.tema === tema);
}

/** Só os temas que realmente têm palavras (na ordem de TEMAS). */
export function temasComVocab(): Tema[] {
  const presentes = new Set(vocabVerificado().map((v) => v.tema));
  return TEMAS.filter((t) => presentes.has(t.id));
}
