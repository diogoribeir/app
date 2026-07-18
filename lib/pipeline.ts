// Orquestra o turno do tutor: GERAR → AVALIAR → SELECIONAR.
// Se a geração livre (camada C) falhar na guarda, faz FALLBACK para
// conteúdo verificado (camadas A/B).

import type { RespostaTutor, Usuario } from "./types";
import { gerarRespostaTutor } from "./tutor";
import { passarPelaGuarda } from "./avaliador";
import { recuperarContexto } from "./camadaB";

export interface ResultadoTurno {
  resposta: RespostaTutor;
  origem: "gerado" | "fallback_verificado";
  mock: boolean;
  guarda: { aprovado: boolean; problemas: string[]; frasesChecadas: string[] };
}

export async function processarTurno(
  usuario: Usuario,
  mensagemAluno: string,
  dificil = false
): Promise<ResultadoTurno> {
  // 1) GERAR
  const { resposta, mock } = await gerarRespostaTutor(
    usuario,
    mensagemAluno,
    dificil
  );

  // 2) AVALIAR + 3) SELECIONAR
  const guarda = await passarPelaGuarda(resposta);

  if (guarda.aprovado) {
    return {
      resposta,
      origem: "gerado",
      mock,
      guarda: {
        aprovado: true,
        problemas: guarda.veredicto.problemas,
        frasesChecadas: guarda.frasesChecadas,
      },
    };
  }

  // FALLBACK — não exibimos a geração reprovada; usamos o verificado.
  return {
    resposta: respostaFallback(usuario),
    origem: "fallback_verificado",
    mock,
    guarda: {
      aprovado: false,
      problemas: guarda.veredicto.problemas,
      frasesChecadas: guarda.frasesChecadas,
    },
  };
}

/** Resposta segura montada 100% a partir do conteúdo verificado. */
function respostaFallback(_usuario: Usuario): RespostaTutor {
  const itens = recuperarContexto([], 3);
  const frases = itens.filter((i) => i.tipo === "frase");

  return {
    resposta:
      "Deixa eu confirmar isso direito antes de te ensinar — não quero te passar nada incerto. Enquanto isso, pratique com frases que já validei:",
    correcoes: [],
    vocab_novo: frases.map((f) => ({
      alvo: f.alvo,
      traducao: f.traducao,
      desmontado: f.traducao,
    })),
    audio_texto: frases.map((f) => f.alvo),
    proxima_meta: "Reforçar uma frase já verificada do seu contexto.",
  };
}
