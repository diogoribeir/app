// Tutor rodando NO NAVEGADOR (site estático no GitHub Pages, sem servidor).
// Reaproveita o mesmo pipeline da guarda gerador→avaliador; como não há
// ANTHROPIC_API_KEY no cliente, tudo cai no MODO DEMONSTRAÇÃO (mock), que só
// usa conteúdo verificado — seguro para exibir. A validação/saneamento de
// entrada (guardrails) continua valendo.

import { processarTurno } from "./pipeline";
import { validarTurno } from "./guardrails";
import type { RespostaTutor, Usuario } from "./types";

export async function perguntarTutorLocal(
  mensagem: string,
  usuario: Usuario
): Promise<RespostaTutor> {
  const entrada = validarTurno({ mensagem, usuario });
  if (!entrada.ok) throw new Error(entrada.erro || "Requisição inválida.");
  const resultado = await processarTurno(entrada.usuario, entrada.mensagem, false);
  return resultado.resposta;
}
