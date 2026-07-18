"use client";

// 🎤 Prática de fala: ouve o aluno (STT do navegador) e dá nota tolerante.

import { useState } from "react";
import { ouvirFrase, reconhecimentoDisponivel } from "@/lib/reconhecimento";
import { avaliarFala, type ResultadoFala } from "@/lib/comparar";

type Estado = "idle" | "ouvindo" | "resultado" | "erro";

const MSG_ERRO: Record<string, string> = {
  "not-allowed": "Permita o microfone no navegador para praticar a fala.",
  "service-not-allowed": "Permita o microfone no navegador para praticar.",
  "no-speech": "Não consegui te ouvir. Tente de novo, mais perto do mic.",
  indisponivel: "Seu navegador não suporta isso. Use Chrome ou Edge.",
  erro: "Algo deu errado. Tente de novo.",
};

export default function BotaoFalar({
  alvo,
  aoResultado,
}: {
  alvo: string;
  aoResultado?: (nota: number) => void;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [transcricao, setTranscricao] = useState("");
  const [resultado, setResultado] = useState<ResultadoFala | null>(null);
  const [erro, setErro] = useState("");

  if (!reconhecimentoDisponivel()) {
    return (
      <p className="text-xs text-[var(--suave)]">
        🎤 A prática de fala funciona no Chrome ou Edge.
      </p>
    );
  }

  function iniciar() {
    setEstado("ouvindo");
    setTranscricao("");
    setResultado(null);
    ouvirFrase({
      aoResultado: (texto) => {
        const r = avaliarFala(texto, alvo);
        setTranscricao(texto);
        setResultado(r);
        setEstado("resultado");
        aoResultado?.(r.nota);
      },
      aoErro: (tipo) => {
        setErro(MSG_ERRO[tipo] ?? MSG_ERRO.erro);
        setEstado("erro");
      },
      aoFim: () => {
        setEstado((e) => (e === "ouvindo" ? "idle" : e));
      },
    });
  }

  if (estado === "ouvindo") {
    return (
      <div className="cartao flex items-center gap-3 px-4 py-3 text-sm">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--vermelho)]" />
        <span className="font-bold text-[var(--vermelho)]">
          Ouvindo… fale a frase agora
        </span>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="cartao px-4 py-3 text-sm">
        <p className="font-bold text-[var(--laranja-escuro)]">{erro}</p>
        <button
          onClick={iniciar}
          className="mt-1 text-xs font-extrabold uppercase text-[var(--azul)]"
        >
          🎤 Tentar de novo
        </button>
      </div>
    );
  }

  if (estado === "resultado" && resultado) {
    const { nota } = resultado;
    const bom = nota >= 70;
    const medio = nota >= 45 && nota < 70;
    const cor = bom
      ? "text-[var(--verde-escuro)]"
      : medio
      ? "text-[var(--laranja-escuro)]"
      : "text-[var(--vermelho)]";
    const msg = bom
      ? "Muito bem! Soou certo 👏"
      : medio
      ? "Quase lá — bem perto!"
      : "Tente mais uma vez, com calma.";

    return (
      <div className="cartao surgir px-4 py-3 text-sm">
        <p className={`font-extrabold ${cor}`}>{msg}</p>
        <p className="mt-1 text-xs text-[var(--suave)]">
          Ouvi: <em>“{transcricao || "…"}”</em>
        </p>
        <p className="mt-1.5 text-xs text-[var(--suave)]">
          🎙️ O reconhecimento do navegador não é perfeito. Se você falou certo,
          siga em frente.
        </p>
        <button
          onClick={iniciar}
          className="mt-2 text-xs font-extrabold uppercase text-[var(--azul)]"
        >
          🎤 Falar de novo
        </button>
      </div>
    );
  }

  return (
    <button onClick={iniciar} className="botao azul w-full">
      🎤 Falar e checar
    </button>
  );
}
