"use client";

// Aba PALAVRAS: baralho de cards que VIRAM (treino de caderno).
//  • Modo Palavras: vê a figura + o português → escreve o francês no caderno e
//    fala em voz alta → toca no card → vira e mostra a palavra FR + pronúncia
//    (com áudio) → marca Acertei/Errei (entra na revisão espaçada).
//  • Modo Ditado: OUVE o francês → escreve no caderno o que ouviu → vira e
//    confere a grafia.
// Conteúdo 100% verificado (lib/vocab → camada B). Sem IA em runtime.

import { useMemo, useState } from "react";
import { temasComVocab, vocabDoTema } from "@/lib/vocab";
import { registrarSRS } from "@/lib/srs";
import { pararFala, vozDisponivel } from "@/lib/fala";
import BotaoOuvir from "@/components/BotaoOuvir";
import BotaoFalar from "@/components/BotaoFalar";
import type { ItemConteudo } from "@/lib/types";

type Modo = "palavras" | "ditado";

function embaralhar<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function badgeGenero(g?: string) {
  if (g === "m") return { txt: "m", cor: "var(--azul)" };
  if (g === "f") return { txt: "f", cor: "var(--roxo)" };
  return null;
}

export default function Vocabulario() {
  const temas = useMemo(() => temasComVocab(), []);
  const temVoz = useMemo(() => vozDisponivel(), []);

  const [modo, setModo] = useState<Modo>("palavras");
  const [tema, setTema] = useState<string>("todos");
  const [baralho, setBaralho] = useState<ItemConteudo[]>(() =>
    embaralhar(vocabDoTema("todos"))
  );
  const [i, setI] = useState(0);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [acertos, setAcertos] = useState(0);

  function novoBaralho(t: string) {
    setBaralho(embaralhar(vocabDoTema(t)));
    setI(0);
    setVirado(false);
    setFeitos(0);
    setAcertos(0);
    pararFala();
  }
  function trocarTema(t: string) {
    setTema(t);
    novoBaralho(t);
  }
  function trocarModo(m: Modo) {
    setModo(m);
    setVirado(false);
    pararFala();
  }

  const total = baralho.length;
  const fim = i >= total;
  const carta = fim ? null : baralho[i];

  function avaliar(acertou: boolean) {
    if (carta) registrarSRS(carta.id, acertou);
    setFeitos((f) => f + 1);
    if (acertou) setAcertos((a) => a + 1);
    setVirado(false);
    pararFala();
    setI((x) => x + 1);
  }

  const badge = carta ? badgeGenero(carta.genero) : null;

  return (
    <div className="surgir pb-4">
      <header className="pb-3 pt-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="grad-texto">Palavras</span> no caderno
        </h1>
        <p className="mt-1.5 text-sm text-[var(--suave)]">
          Escreva à mão e fale — depois toque no card para conferir. É assim que
          fixa de verdade.
        </p>
      </header>

      {/* modo */}
      <div className="flex gap-2">
        <button
          onClick={() => trocarModo("palavras")}
          className={`chip flex-1 justify-center text-sm ${
            modo === "palavras" ? "ativo" : ""
          }`}
        >
          🖊️ Escrever
        </button>
        {temVoz && (
          <button
            onClick={() => trocarModo("ditado")}
            className={`chip flex-1 justify-center text-sm ${
              modo === "ditado" ? "ativo" : ""
            }`}
          >
            🎧 Ditado
          </button>
        )}
      </div>

      {/* temas */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => trocarTema("todos")}
          className={`chip shrink-0 text-sm ${tema === "todos" ? "ativo" : ""}`}
        >
          Todas
        </button>
        {temas.map((t) => (
          <button
            key={t.id}
            onClick={() => trocarTema(t.id)}
            className={`chip shrink-0 text-sm ${tema === t.id ? "ativo" : ""}`}
          >
            {t.emoji} {t.rotulo}
          </button>
        ))}
      </div>

      {/* progresso */}
      <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--suave)]">
        <span>
          {fim ? total : i + 1} / {total}
        </span>
        <span>✅ {acertos} acerto(s)</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--cartao-2)]">
        <div
          className="h-full rounded-full bg-[var(--verde)] transition-all"
          style={{ width: `${total ? (feitos / total) * 100 : 0}%` }}
        />
      </div>

      {/* ── FIM do baralho ─────────────────────────────────────────── */}
      {fim ? (
        <div className="celebrar cartao mt-6 p-7 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-2 text-xl font-extrabold">Baralho concluído!</h2>
          <p className="mt-1 text-sm text-[var(--suave)]">
            Você acertou <b className="text-[var(--verde-escuro)]">{acertos}</b>{" "}
            de <b>{total}</b>. O que você errou volta na{" "}
            <b>Revisão do dia</b> lá na aba Viagem.
          </p>
          <button
            onClick={() => novoBaralho(tema)}
            className="botao azul mt-5 w-full"
          >
            🔄 Repetir baralho
          </button>
        </div>
      ) : (
        carta && (
          <>
            {/* ── CARD QUE VIRA ──────────────────────────────────────── */}
            <div className={`vira mt-6 ${virado ? "virado" : ""}`}>
              <div className="vira-interno">
                {/* FRENTE */}
                <div
                  className="vira-face cartao flex flex-col items-center justify-center p-6 text-center"
                  style={{
                    minHeight: 320,
                    pointerEvents: virado ? "none" : "auto",
                    cursor: "pointer",
                  }}
                  onClick={() => setVirado(true)}
                  role="button"
                  aria-label="Virar o card para conferir"
                >
                  {modo === "palavras" ? (
                    <>
                      <div className="text-7xl leading-none">
                        {carta.emoji ?? "🃏"}
                      </div>
                      <p className="mt-4 text-2xl font-extrabold">
                        {carta.traducao}
                      </p>
                      <p className="mt-3 max-w-[16rem] text-sm text-[var(--suave)]">
                        Escreva em francês no caderno e fale em voz alta.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-6xl leading-none">🎧</div>
                      <p className="mt-4 text-lg font-extrabold">Ditado</p>
                      <div
                        className="mt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <BotaoOuvir texto={carta.alvo} grande />
                      </div>
                      <p className="mt-3 max-w-[16rem] text-sm text-[var(--suave)]">
                        Ouça e escreva no caderno o que você achou que ouviu.
                      </p>
                    </>
                  )}
                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-[var(--azul-escuro)]">
                    Toque para virar →
                  </p>
                </div>

                {/* VERSO */}
                <div
                  className="vira-face verso cartao flex flex-col items-center justify-center p-6 text-center"
                  style={{
                    minHeight: 320,
                    pointerEvents: virado ? "auto" : "none",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-extrabold">{carta.alvo}</p>
                    {badge && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-xs font-extrabold"
                        style={{ color: badge.cor, border: `1px solid ${badge.cor}` }}
                        title={badge.txt === "m" ? "masculino" : "feminino"}
                      >
                        {badge.txt}
                      </span>
                    )}
                  </div>
                  {carta.pronuncia && (
                    <p className="mt-1 text-base font-semibold text-[var(--azul-escuro)]">
                      {carta.pronuncia}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[var(--suave)]">
                    {carta.traducao}
                  </p>

                  <div className="mt-4">
                    <BotaoOuvir texto={carta.alvo} />
                  </div>

                  {temVoz && (
                    <div className="mt-3 w-full max-w-[18rem]">
                      <BotaoFalar alvo={carta.alvo} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* auto-avaliação (só depois de virar) */}
            {virado && (
              <div className="surgir mt-4 flex gap-3">
                <button
                  onClick={() => avaliar(false)}
                  className="botao vermelho flex-1"
                >
                  ❌ Errei
                </button>
                <button
                  onClick={() => avaliar(true)}
                  className="botao verde flex-1"
                >
                  ✅ Acertei
                </button>
              </div>
            )}
          </>
        )
      )}

      <p className="mt-6 text-center text-xs text-[var(--suave)]">
        {total} palavras verificadas por humanos · escreva à mão, fale, depois
        confira
      </p>
    </div>
  );
}
