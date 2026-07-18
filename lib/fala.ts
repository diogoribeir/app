// Áudio de pronúncia usando a Web Speech API do navegador.
// GRÁTIS, sem chave de API e sem custo. Voz do sistema (boa, não premium).
// Na Fase 2 podemos trocar por TTS premium (ElevenLabs/Google) com cache.

export function vozDisponivel(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let vozFR: SpeechSynthesisVoice | null = null;

function escolherVozFR(): SpeechSynthesisVoice | null {
  if (!vozDisponivel()) return null;
  if (vozFR) return vozFR;
  const vozes = window.speechSynthesis.getVoices();
  vozFR = vozes.find((v) => v.lang?.toLowerCase().startsWith("fr")) ?? null;
  return vozFR;
}

// As vozes carregam de forma assíncrona em alguns navegadores.
if (vozDisponivel()) {
  window.speechSynthesis.onvoiceschanged = () => {
    vozFR = null;
    escolherVozFR();
  };
}

interface OpcoesFala {
  lento?: boolean;
  aoIniciar?: () => void;
  aoFinalizar?: () => void;
}

/** Fala um texto em francês. Dispara callbacks para feedback de UI. */
export function falar(texto: string, opts: OpcoesFala = {}): boolean {
  if (!vozDisponivel()) {
    opts.aoFinalizar?.();
    return false;
  }
  // Cancela qualquer fala anterior — evita sobreposição e clique-duplo.
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "fr-FR";
  u.rate = opts.lento ? 0.55 : 0.95;
  const voz = escolherVozFR();
  if (voz) u.voice = voz;

  u.onstart = () => opts.aoIniciar?.();
  u.onend = () => opts.aoFinalizar?.();
  u.onerror = () => opts.aoFinalizar?.();

  window.speechSynthesis.speak(u);
  return true;
}

/** Interrompe qualquer fala em andamento. */
export function pararFala(): void {
  if (vozDisponivel()) window.speechSynthesis.cancel();
}
