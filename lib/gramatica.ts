// 🟡 Gramática curada (ponte PT-BR → francês). Mesmo princípio da camada B:
// só conteúdo verificado é exibido; nada é gerado por IA em tempo de execução.

import gramatica from "@/data/gramatica.json";
import type { TopicoGramatica } from "./types";

const TOPICOS = gramatica.topicos as TopicoGramatica[];

export function topicosGramatica(): TopicoGramatica[] {
  return TOPICOS.filter((t) => t.status === "verificado");
}

export function topicoPorId(id: string): TopicoGramatica | null {
  return topicosGramatica().find((t) => t.id === id) ?? null;
}
