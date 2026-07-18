"use client";

// 🔊 Ouvir (ritmo normal) e 🐢 Devagar (ritmo reduzido) — TTS grátis do navegador.

import { useState } from "react";
import { falar, vozDisponivel } from "@/lib/fala";

export default function BotaoOuvir({
  texto,
  grande = false,
}: {
  texto: string;
  grande?: boolean;
}) {
  const [falando, setFalando] = useState<null | "normal" | "lento">(null);

  if (!vozDisponivel()) return null;

  function ouvir(lento: boolean) {
    setFalando(lento ? "lento" : "normal"); // feedback imediato
    falar(texto, { lento, aoFinalizar: () => setFalando(null) });
  }

  const base = grande ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => ouvir(false)}
        disabled={falando !== null}
        aria-label="Ouvir em ritmo normal"
        className={`${base} rounded-lg font-bold text-[#fffdf9] transition disabled:opacity-70 ${
          falando === "normal" ? "bg-[var(--verde)]" : "bg-[var(--azul)]"
        }`}
      >
        {falando === "normal" ? "🔊 …" : "🔊 Ouvir"}
      </button>
      <button
        onClick={() => ouvir(true)}
        disabled={falando !== null}
        aria-label="Ouvir devagar"
        className={`${base} cartao rounded-xl font-bold transition disabled:opacity-70 ${
          falando === "lento"
            ? "border-[var(--verde)] text-[var(--verde-escuro)]"
            : "text-[var(--suave)]"
        }`}
      >
        {falando === "lento" ? "🐢 …" : "🐢 Devagar"}
      </button>
    </div>
  );
}
