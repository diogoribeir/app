// Reconhecimento de voz do navegador (Web Speech API — SpeechRecognition).
// GRÁTIS, sem chave. Funciona em Chrome/Edge (usa servidores do Google,
// então precisa de internet). Captura a fala e devolve a transcrição.
// Upgrade futuro (Fase 3): Azure Pronunciation Assessment (nota por fonema).

/* eslint-disable @typescript-eslint/no-explicit-any */

export function reconhecimentoDisponivel(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

export interface ControleFala {
  parar: () => void;
}

interface OuvirOpts {
  aoResultado: (texto: string) => void;
  aoErro: (tipo: string) => void;
  aoFim: () => void;
}

/** Inicia a escuta de UMA frase em francês. */
export function ouvirFrase(opts: OuvirOpts): ControleFala | null {
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) {
    opts.aoErro("indisponivel");
    return null;
  }

  const rec = new SR();
  rec.lang = "fr-FR";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e: any) => {
    const texto = e.results?.[0]?.[0]?.transcript ?? "";
    opts.aoResultado(texto);
  };
  rec.onerror = (e: any) => opts.aoErro(e?.error || "erro");
  rec.onend = () => opts.aoFim();

  try {
    rec.start();
  } catch {
    opts.aoErro("erro");
    return null;
  }
  return { parar: () => rec.stop() };
}
