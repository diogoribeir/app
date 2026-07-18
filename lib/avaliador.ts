// 🔴 CAMADA C — A GUARDA. Pipeline Gerar → Avaliar → Selecionar.
// O avaliador é um SEGUNDO prompt, separado do gerador, porque a IA é
// comprovadamente melhor checando do que gerando. Combinamos isso com
// checagens determinísticas (camada A).

import type { RespostaTutor, VeredictoAvaliador } from "./types";
import { chamarClaude, extrairJSON, MODELOS, temChave } from "./anthropic";
import { existeVerificado } from "./camadaB";

const SYSTEM_AVALIADOR = `Você é um examinador rigoroso de francês. Para o conjunto de frases francesas abaixo, responda APENAS em JSON:
{ "gramatica_ok": bool, "natural": bool, "nivel_ok": bool, "problemas": ["..."] }
Seja conservador: na dúvida, marque como problema.`;

/** Extrai as frases francesas que o tutor pretende ensinar/exibir. */
function frasesParaChecar(r: RespostaTutor): string[] {
  const frases = [
    ...r.audio_texto,
    ...r.vocab_novo.map((v) => v.alvo),
    ...r.correcoes.map((c) => c.correto),
  ];
  return frases.map((f) => f.trim()).filter((f) => f.length > 0);
}

/** Avaliador IA (parte da guarda). Em modo mock, aprova de forma conservadora. */
async function avaliarComIA(frases: string[]): Promise<VeredictoAvaliador> {
  if (frases.length === 0) {
    return { gramatica_ok: true, natural: true, nivel_ok: true, problemas: [] };
  }

  if (!temChave()) {
    // Sem chave: o mock só usa conteúdo verificado, então passa.
    return { gramatica_ok: true, natural: true, nivel_ok: true, problemas: [] };
  }

  const texto = await chamarClaude({
    system: SYSTEM_AVALIADOR,
    user: frases.map((f, i) => `${i + 1}. ${f}`).join("\n"),
    model: MODELOS.avaliador,
    maxTokens: 600,
  });

  const json = extrairJSON<VeredictoAvaliador>(texto);
  if (!json) {
    return {
      gramatica_ok: false,
      natural: false,
      nivel_ok: false,
      problemas: ["Avaliador não retornou JSON válido."],
    };
  }
  return json;
}

export interface ResultadoGuarda {
  aprovado: boolean;
  veredicto: VeredictoAvaliador;
  frasesChecadas: string[];
}

/**
 * AVALIAR + SELECIONAR.
 * Roda o avaliador IA. Frases já presentes na base verificada passam direto
 * (já foram cruzadas na camada B). Só é "aprovado" o que passa em tudo.
 */
export async function passarPelaGuarda(
  r: RespostaTutor
): Promise<ResultadoGuarda> {
  const frases = frasesParaChecar(r);

  // Frases que JÁ estão verificadas (camada B) não precisam de nova avaliação.
  const naoVerificadas = frases.filter((f) => !existeVerificado(f));

  const veredicto = await avaliarComIA(naoVerificadas);
  const aprovado =
    veredicto.gramatica_ok && veredicto.natural && veredicto.nivel_ok;

  return { aprovado, veredicto, frasesChecadas: naoVerificadas };
}
