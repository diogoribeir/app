"use client";

// Aba FRASES: o phrasebook de bolso. Busca + filtro por situação e
// TOQUE NO CARTÃO = o app FALA na hora (🐢 para devagar). Funciona
// offline (PWA) — feito para usar NO balcão, não só para estudar.

import { useMemo, useState } from "react";
import { itensVerificados } from "@/lib/camadaB";
import { falar, pararFala } from "@/lib/fala";

const CONTEXTOS: { id: string; rotulo: string }[] = [
  { id: "todos", rotulo: "Todas" },
  { id: "geral", rotulo: "✨ Básicas" },
  { id: "restaurante", rotulo: "🍽️ Restaurante" },
  { id: "hotel", rotulo: "🛏️ Hotel" },
  { id: "rua", rotulo: "🧭 Na rua" },
  { id: "compras", rotulo: "🛍️ Compras" },
  { id: "emergencia", rotulo: "🚑 Emergência" },
];

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function Frases() {
  const [busca, setBusca] = useState("");
  const [contexto, setContexto] = useState("todos");
  const [falandoId, setFalandoId] = useState<string | null>(null);

  const frases = useMemo(() => {
    const todas = itensVerificados().filter((i) => i.tipo === "frase");
    const n = normalizar(busca.trim());
    return todas.filter((f) => {
      if (contexto !== "todos" && f.contexto !== contexto) return false;
      if (!n) return true;
      return normalizar(`${f.alvo} ${f.traducao}`).includes(n);
    });
  }, [busca, contexto]);

  function tocar(id: string, texto: string, lento = false) {
    pararFala();
    setFalandoId(id);
    falar(texto, { lento, aoFinalizar: () => setFalandoId(null) });
  }

  return (
    <div className="surgir pb-4">
      <header className="pb-4 pt-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Frases <span className="grad-texto">prontas</span>
        </h1>
        <p className="mt-1.5 text-sm text-[var(--suave)]">
          Toque num cartão e o Lingo fala por você — perfeito para a hora H.
          Funciona até sem internet.
        </p>
      </header>

      {/* busca */}
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar… (ex.: conta, banheiro, ajuda)"
        className="cartao w-full px-4 py-3 font-semibold outline-none placeholder:text-[var(--suave)] focus:border-[var(--grad-a)]"
      />

      {/* filtros por situação */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {CONTEXTOS.map((c) => (
          <button
            key={c.id}
            onClick={() => setContexto(c.id)}
            className={`chip shrink-0 text-sm ${contexto === c.id ? "ativo" : ""}`}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      {/* cartões falantes */}
      <div className="mt-4 space-y-2.5">
        {frases.length === 0 && (
          <p className="cartao p-5 text-center text-sm text-[var(--suave)]">
            Nada com esse termo — tente outra palavra.
          </p>
        )}
        {frases.map((f) => {
          const falando = falandoId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => tocar(f.id, f.alvo)}
              className={`cartao w-full p-4 text-left transition hover:border-[var(--borda-forte)] ${
                falando ? "falando" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold leading-snug">{f.alvo}</p>
                  {f.pronuncia && (
                    <p className="mt-0.5 text-sm font-semibold text-[var(--azul-escuro)]">
                      {f.pronuncia}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[var(--suave)]">{f.traducao}</p>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span
                    className={`text-xl ${falando ? "pulsar" : ""}`}
                    aria-hidden
                  >
                    {falando ? "🔊" : "🔈"}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Ouvir devagar"
                    onClick={(e) => {
                      e.stopPropagation();
                      tocar(f.id, f.alvo, true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        tocar(f.id, f.alvo, true);
                      }
                    }}
                    className="rounded-full border border-[var(--borda-forte)] px-2.5 py-1 text-xs font-bold text-[var(--suave)] transition hover:bg-[var(--azul-claro)]"
                  >
                    🐢
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-[var(--suave)]">
        {frases.length} frases verificadas por humanos · toque = fala · 🐢 = devagar
      </p>
    </div>
  );
}
