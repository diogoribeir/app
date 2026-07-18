// 🟡 CAMADA B — Conteúdo curado/verificado (a base do RAG).
// O tutor SÓ pode ensinar a partir daqui. Se um fato não está na base
// verificada, ele não pode ser apresentado como verdade.

import content from "@/data/content.json";
import type { ItemConteudo } from "./types";

const ITENS = content.itens as ItemConteudo[];

/** Só o que está com status "verificado" pode alimentar o tutor. */
export function itensVerificados(): ItemConteudo[] {
  return ITENS.filter((i) => i.status === "verificado");
}

/**
 * Recupera os itens verificados mais relevantes para o contexto do aluno.
 * (RAG simples por palavra-chave; na Fase 1.5 vira busca semântica.)
 */
export function recuperarContexto(
  contextos: string[],
  limite = 8
): ItemConteudo[] {
  const alvos = new Set(contextos.map((c) => c.toLowerCase()));
  const verificados = itensVerificados();

  // Lista vazia de contextos = usar TODO o conteúdo verificado.
  const relevantes =
    alvos.size === 0
      ? verificados
      : verificados.filter(
          (i) => alvos.has(i.contexto.toLowerCase()) || i.contexto === "geral"
        );

  const base = relevantes.length > 0 ? relevantes : verificados;
  return base.slice(0, limite);
}

/** Monta o bloco de contexto verificado que vai no prompt do tutor (RAG). */
export function montarBlocoRAG(contextos: string[]): string {
  const itens = recuperarContexto(contextos, 48);
  if (itens.length === 0) return "(nenhum conteúdo verificado disponível)";

  return itens
    .map((i) => {
      if (i.tipo === "regra") return `- REGRA [${i.contexto}]: ${i.traducao}`;
      return `- FRASE [${i.contexto}]: "${i.alvo}" = "${i.traducao}" (fonte: ${i.fonte})`;
    })
    .join("\n");
}

/** Verifica se um texto-alvo já consta como verificado na base. */
export function existeVerificado(alvo: string): boolean {
  const n = alvo.trim().toLowerCase();
  return itensVerificados().some((i) => i.alvo.trim().toLowerCase() === n);
}

export function todoConteudo(): ItemConteudo[] {
  return ITENS;
}
