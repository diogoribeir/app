// 🟡 Diálogos curados das CENAS AO VIVO (roleplay determinístico).
// Mesmo princípio da camada B: só conteúdo verificado; falas do aluno
// vêm das frases verificadas. Nada de IA em tempo de execução.

import dialogos from "@/data/dialogos.json";
import type { Dialogo } from "./types";

const DIALOGOS = dialogos.dialogos as Dialogo[];

export function dialogosVerificados(): Dialogo[] {
  return DIALOGOS.filter((d) => d.status === "verificado");
}

export function dialogoPorId(id: string): Dialogo | null {
  return dialogosVerificados().find((d) => d.id === id) ?? null;
}

/** Diálogo de uma unidade (pelo contexto), se existir. */
export function dialogoDoContexto(contexto: string): Dialogo | null {
  return dialogosVerificados().find((d) => d.contexto === contexto) ?? null;
}
