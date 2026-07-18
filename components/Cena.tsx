"use client";

// 🎭 CENA AO VIVO: roleplay em modo teatro. O atendente FALA com você
// (voz), seu objetivo aparece em português e você responde escolhendo
// frases reais — o app fala a sua fala e a conversa avança.
// 100% determinístico: falas curadas, zero IA em tempo de execução.

import { useEffect, useMemo, useRef, useState } from "react";
import { dialogoPorId } from "@/lib/dialogos";
import { falar, pararFala } from "@/lib/fala";
import { cenasFeitas, concluirCena, XP_BONUS_PERFEITA, XP_CENA } from "@/lib/jogo";
import type { OpcaoDialogo } from "@/lib/types";

const FUNDOS: Record<string, string> = {
  restaurante:
    "radial-gradient(700px 420px at 85% -5%, rgba(245,158,88,.22), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(240,99,122,.12), transparent 60%)",
  hotel:
    "radial-gradient(700px 420px at 85% -5%, rgba(168,132,245,.22), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(91,124,250,.12), transparent 60%)",
  rua: "radial-gradient(700px 420px at 85% -5%, rgba(76,196,217,.2), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(52,201,142,.12), transparent 60%)",
};

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Fase = "intro" | "cena" | "fim";
interface Balao {
  quem: "eles" | "voce";
  fr: string;
  pt: string;
  pronuncia?: string;
}

export default function Cena({
  dialogoId,
  aoSair,
}: {
  dialogoId: string;
  aoSair: () => void;
}) {
  const dialogo = dialogoPorId(dialogoId);
  const [fase, setFase] = useState<Fase>("intro");
  const [turnoIdx, setTurnoIdx] = useState(0);
  const [historico, setHistorico] = useState<Balao[]>([]);
  const [erradas, setErradas] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [avancando, setAvancando] = useState(false);
  const [erros, setErros] = useState(0);
  const registrou = useRef(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const turno = dialogo?.turnos[turnoIdx];
  const opcoes = useMemo(
    () => (turno ? embaralhar(turno.opcoes) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dialogoId, turnoIdx]
  );

  // o atendente fala ao entrar em cada turno
  useEffect(() => {
    if (fase !== "cena" || !turno) return;
    const t = setTimeout(() => falar(turno.falaFR), 450);
    return () => clearTimeout(t);
  }, [fase, turnoIdx, turno]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [historico, feedback, fase]);

  if (!dialogo) {
    aoSair();
    return null;
  }

  const perfeita = erros === 0;
  const pts = XP_CENA + (perfeita ? XP_BONUS_PERFEITA : 0);
  const jaFeita = cenasFeitas().has(dialogo.id);

  function entrarNaCena() {
    setFase("cena");
    setHistorico(turno ? [{ quem: "eles", fr: turno.falaFR, pt: turno.falaPT, pronuncia: turno.pronuncia }] : []);
  }

  function escolher(op: OpcaoDialogo) {
    if (avancando || !turno) return;
    if (!op.ok) {
      setErros((e) => e + 1);
      setErradas((s) => new Set(s).add(op.fr));
      setFeedback(op.porQue ?? "Hmm, essa fala não cabe aqui — tente outra.");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([60, 40, 60]);
      return;
    }
    // acertou: sua fala entra em cena e é FALADA
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(25);
    setFeedback(null);
    setAvancando(true);
    setHistorico((h) => [...h, { quem: "voce", fr: op.fr, pt: op.pt }]);
    pararFala();
    falar(op.fr, {
      aoFinalizar: () => {
        const proximo = turnoIdx + 1;
        if (proximo >= dialogo!.turnos.length) {
          if (!registrou.current) {
            registrou.current = true;
            concluirCena(dialogo!.id, pts);
          }
          setTimeout(() => setFase("fim"), 500);
        } else {
          const t = dialogo!.turnos[proximo];
          setTimeout(() => {
            setTurnoIdx(proximo);
            setErradas(new Set());
            setHistorico((h) => [...h, { quem: "eles", fr: t.falaFR, pt: t.falaPT, pronuncia: t.pronuncia }]);
            setAvancando(false);
          }, 550);
        }
      },
    });
  }

  const fundo = FUNDOS[dialogo.contexto] ?? FUNDOS.rua;

  // ── intro ─────────────────────────────────────────────────────────
  if (fase === "intro") {
    return (
      <div
        className="mx-auto flex min-h-dvh max-w-xl flex-col justify-between px-6 py-6"
        style={{ backgroundImage: fundo }}
      >
        <button onClick={aoSair} aria-label="Sair" className="self-start text-2xl text-[var(--suave)]">
          ✕
        </button>
        <div className="surgir text-center">
          <div className="text-8xl drop-shadow-[0_10px_30px_rgba(91,124,250,.35)]">{dialogo.emoji}</div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[var(--ouro)]">
            Cena ao vivo{jaFeita ? " · rever" : ""}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{dialogo.titulo}</h1>
          <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-[var(--suave)]">
            {dialogo.intro}
          </p>
          <p className="mt-4 text-sm text-[var(--suave)]">
            🔊 Ligue o som — <b>{dialogo.papel}</b> vai falar com você.
          </p>
        </div>
        <button onClick={entrarNaCena} className="botao w-full py-4 text-lg">
          🎬 Entrar na cena
        </button>
      </div>
    );
  }

  // ── fim ───────────────────────────────────────────────────────────
  if (fase === "fim") {
    return (
      <div
        className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center"
        style={{ backgroundImage: fundo }}
      >
        <div className="celebrar">
          <div className="text-7xl">{dialogo.emoji}</div>
          <h2 className="mt-4 text-3xl font-extrabold">
            <span className="grad-texto">Cena concluída!</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed">{dialogo.final}</p>
          <div className="cartao mx-auto mt-6 min-w-32 px-5 py-3">
            <p className="text-xs font-bold uppercase text-[var(--ouro)]">Pontos</p>
            <p className="text-3xl font-extrabold text-[var(--ouro)]">+{pts}</p>
            {perfeita && (
              <p className="mt-1 text-xs font-semibold text-[var(--verde-escuro)]">
                sem nenhum tropeço — chapeau! 🎩
              </p>
            )}
          </div>
          <button onClick={aoSair} className="botao mt-8 w-full">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ── a cena em si ──────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4" style={{ backgroundImage: fundo }}>
      {/* topo */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={aoSair} aria-label="Sair da cena" className="text-2xl text-[var(--suave)]">
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--borda)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(turnoIdx / dialogo.turnos.length) * 100}%`,
              background: "linear-gradient(90deg, var(--grad-a), var(--grad-b))",
            }}
          />
        </div>
        <span className="text-lg">{dialogo.emoji}</span>
      </div>

      {/* palco: os balões da conversa */}
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {historico.map((b, i) => (
          <div key={i} className={`surgir flex ${b.quem === "voce" ? "justify-end" : "justify-start"}`}>
            <button
              onClick={() => falar(b.fr)}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-left ${
                b.quem === "voce"
                  ? "rounded-br-md text-white"
                  : "cartao rounded-bl-md"
              }`}
              style={
                b.quem === "voce"
                  ? { background: "linear-gradient(120deg, var(--grad-a), var(--grad-b))" }
                  : undefined
              }
              title="Tocar de novo"
            >
              <span className="block text-[17px] font-bold leading-snug">{b.fr}</span>
              {b.pronuncia && b.quem === "eles" && (
                <span className="mt-0.5 block text-xs font-semibold text-[var(--azul-escuro)]">
                  {b.pronuncia}
                </span>
              )}
              <span
                className={`mt-1 block text-xs ${
                  b.quem === "voce" ? "text-white/75" : "text-[var(--suave)]"
                }`}
              >
                {b.pt}
              </span>
            </button>
          </div>
        ))}

        {feedback && (
          <div className="tremer rounded-2xl border border-[var(--vermelho)] bg-[var(--vermelho-claro)] px-4 py-3 text-sm font-semibold text-[var(--vermelho-escuro)]">
            {feedback}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* seu objetivo + suas opções de fala */}
      <div className="pb-5 pt-2">
        <p className="mb-2.5 text-center text-sm font-bold text-[var(--ouro)]">
          🎯 {turno?.objetivo}
        </p>
        <div className="space-y-2">
          {opcoes.map((op) => {
            const bloqueada = erradas.has(op.fr);
            return (
              <button
                key={op.fr}
                onClick={() => escolher(op)}
                disabled={bloqueada || avancando}
                className={`opcao py-3 ${bloqueada ? "errada opacity-50" : ""}`}
              >
                <span className="block font-bold">{op.fr}</span>
                <span className="block text-xs text-[var(--suave)]">{op.pt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
