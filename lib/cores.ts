// Mapa das cores de unidade → variáveis do tema (globals.css).

import type { CorUnidade } from "./types";

export interface TrioCor {
  base: string;
  escuro: string;
  claro: string;
}

export const CORES: Record<CorUnidade, TrioCor> = {
  verde: { base: "var(--verde)", escuro: "var(--verde-escuro)", claro: "var(--verde-claro)" },
  azul: { base: "var(--azul)", escuro: "var(--azul-escuro)", claro: "var(--azul-claro)" },
  roxo: { base: "var(--roxo)", escuro: "var(--roxo-escuro)", claro: "var(--roxo-claro)" },
  laranja: { base: "var(--laranja)", escuro: "var(--laranja-escuro)", claro: "var(--laranja-claro)" },
  vermelho: { base: "var(--vermelho)", escuro: "var(--vermelho-escuro)", claro: "var(--vermelho-claro)" },
  ciano: { base: "var(--ciano)", escuro: "var(--ciano-escuro)", claro: "var(--ciano-claro)" },
};

export function corDe(nome: string): TrioCor {
  return CORES[(nome as CorUnidade) in CORES ? (nome as CorUnidade) : "azul"];
}
