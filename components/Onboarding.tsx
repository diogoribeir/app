"use client";

// Onboarding do Lingo: 3 passos (boas-vindas → nível → meta diária).

import { useState } from "react";
import type { Nivel, Usuario } from "@/lib/types";

const NIVEIS: { id: Nivel; titulo: string; desc: string }[] = [
  { id: "iniciante", titulo: "Do zero", desc: "Nunca estudei francês" },
  { id: "basico", titulo: "Alguma coisa", desc: "Sei umas palavras soltas" },
  { id: "intermediario", titulo: "Já me viro", desc: "Formo frases simples" },
];

const METAS: { xp: number; titulo: string; desc: string }[] = [
  { xp: 20, titulo: "Leve", desc: "~5 min por dia" },
  { xp: 40, titulo: "Regular", desc: "~10 min por dia" },
  { xp: 60, titulo: "Dedicado", desc: "~15 min por dia" },
];

export default function Onboarding({
  aoConcluir,
}: {
  aoConcluir: (u: Usuario) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState<Nivel | null>(null);

  function concluir(metaXP: number) {
    aoConcluir({
      id: `u-${Date.now()}`,
      nome: nome.trim(),
      nivel: nivel ?? "iniciante",
      metaDiariaXP: metaXP,
      criadoEm: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      {/* progresso discreto */}
      <div className="mb-10 h-1.5 w-full overflow-hidden rounded-full bg-[var(--borda)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${((passo + 1) / 3) * 100}%`,
            background: "linear-gradient(90deg, var(--grad-a), var(--grad-b))",
          }}
        />
      </div>

      {passo === 0 && (
        <div className="surgir">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="grad-texto">Lingo</span>
          </h1>
          <p className="mt-5 text-2xl font-bold leading-snug">
            Francês que faz sentido para quem fala português.
          </p>
          <div className="mt-6 space-y-2.5 text-[15px]">
            <p className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--verde)]">✓</span>
              <span>
                <b>Gramática-ponte:</b> o francês explicado pelo que você já
                sabe — cognatos, gênero, os sons do português.
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--verde)]">✓</span>
              <span>
                <b>Tudo com voz:</b> cada frase fala em ritmo normal e devagar
                — e você pratica falando também.
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--verde)]">✓</span>
              <span>
                <b>Zero invenção:</b> conteúdo verificado por humanos; a IA só
                tira dúvidas, vigiada de perto.
              </span>
            </p>
          </div>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como podemos te chamar?"
            className="cartao mt-8 w-full px-4 py-3.5 font-semibold outline-none placeholder:text-[var(--suave)] focus:border-[var(--grad-a)]"
            maxLength={30}
          />
          <button onClick={() => setPasso(1)} className="botao mt-4 w-full">
            Commencer ✨
          </button>
        </div>
      )}

      {passo === 1 && (
        <div className="surgir">
          <h2 className="text-2xl font-extrabold">
            Quanto francês você já tem na bagagem?
          </h2>
          <div className="mt-6 space-y-3">
            {NIVEIS.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setNivel(n.id);
                  setPasso(2);
                }}
                className="opcao"
              >
                <span className="block font-bold">{n.titulo}</span>
                <span className="block text-sm text-[var(--suave)]">{n.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="surgir">
          <h2 className="text-2xl font-extrabold">Qual é a sua meta diária?</h2>
          <p className="mt-2 text-sm text-[var(--suave)]">
            Constância vale mais que maratona — dá para mudar depois.
          </p>
          <div className="mt-6 space-y-3">
            {METAS.map((m) => (
              <button
                key={m.xp}
                onClick={() => concluir(m.xp)}
                className="opcao flex items-center justify-between"
              >
                <span>
                  <span className="block font-bold">{m.titulo}</span>
                  <span className="block text-sm text-[var(--suave)]">{m.desc}</span>
                </span>
                <span className="font-extrabold text-[var(--ouro)]">{m.xp} pts</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
