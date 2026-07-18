"use client";

// O player de exercícios (o coração do Lingo): barra de progresso, um
// exercício por vez, rodapé verde/vermelho e tela de conclusão com XP.
// Errou? A frase volta uma vez para o fim da fila — sem loop infinito.

import { useEffect, useMemo, useRef, useState } from "react";
import BotaoOuvir from "./BotaoOuvir";
import BotaoFalar from "./BotaoFalar";
import { falar } from "@/lib/fala";
import { registrarSRS } from "@/lib/srs";
import { concluirLicao, ganharXP, XP_BONUS_PERFEITA } from "@/lib/jogo";
import { corDe } from "@/lib/cores";
import type { CorUnidade, Exercicio } from "@/lib/types";

type Checagem = null | "certo" | "errado";

export default function Sessao({
  titulo,
  cor,
  fila: filaInicial,
  xpBase,
  licaoId,
  aoSair,
}: {
  titulo: string;
  cor: CorUnidade;
  fila: Exercicio[];
  xpBase: number;
  licaoId?: string;
  aoSair: () => void;
}) {
  const [fila, setFila] = useState<Exercicio[]>(filaInicial);
  const [indice, setIndice] = useState(0);
  const [checado, setChecado] = useState<Checagem>(null);
  const [erros, setErros] = useState(0);
  const [fim, setFim] = useState(false);
  const [confirmaSaida, setConfirmaSaida] = useState(false);
  const reinseridos = useRef(new Set<string>());
  const registrou = useRef(false);

  // respostas do exercício atual
  const [escolha, setEscolha] = useState<string | null>(null);
  const [montagem, setMontagem] = useState<number[]>([]); // índices das peças usadas
  const [falou, setFalou] = useState(false);

  const trio = corDe(cor);
  const ex = fila[indice];
  const total = fila.length;
  const perfeita = erros === 0;
  const xpGanho = xpBase + (perfeita ? XP_BONUS_PERFEITA : 0);

  // registra XP/conclusão UMA vez ao chegar na tela final
  useEffect(() => {
    if (fim && !registrou.current) {
      registrou.current = true;
      if (licaoId) concluirLicao(licaoId, xpGanho);
      else ganharXP(xpGanho);
    }
  }, [fim, licaoId, xpGanho]);

  // toca o áudio automaticamente ao apresentar/ouvir
  useEffect(() => {
    if (!ex || checado !== null) return;
    if (ex.tipo === "apresentar" || ex.tipo === "ouvir") {
      const t = setTimeout(() => falar(ex.item.alvo), 350);
      return () => clearTimeout(t);
    }
  }, [indice, ex, checado]);

  if (!ex && !fim) {
    // fila vazia (não deveria acontecer) — volta em paz
    aoSair();
    return null;
  }

  function respostaAtualCorreta(): boolean {
    if (!ex) return false;
    if (ex.tipo === "escolher" || ex.tipo === "ouvir") return escolha === ex.correta;
    if (ex.tipo === "montar") {
      const seq = montagem.map((i) => ex.pecas[i]);
      if (seq.length !== ex.alvoTokens.length) return false;
      return seq.every((t, i) => t.toLowerCase() === ex.alvoTokens[i].toLowerCase());
    }
    return true; // apresentar/falar não têm "errado"
  }

  function verificar() {
    if (!ex) return;
    const acertou = respostaAtualCorreta();
    setChecado(acertou ? "certo" : "errado");
    // feedback tátil no celular: toque curto no acerto, duplo no erro
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(acertou ? 25 : [60, 40, 60]);
    }
    if (ex.tipo !== "apresentar") registrarSRS(ex.item.id, acertou);
    if (acertou) {
      if (ex.tipo !== "apresentar" && ex.tipo !== "falar") falar(ex.item.alvo);
    } else {
      setErros((e) => e + 1);
      // reinsere o exercício UMA vez no fim da fila
      const chave = `${ex.tipo}:${ex.item.id}`;
      if (!reinseridos.current.has(chave)) {
        reinseridos.current.add(chave);
        setFila((f) => [...f, ex]);
      }
    }
  }

  function continuar() {
    setChecado(null);
    setEscolha(null);
    setMontagem([]);
    setFalou(false);
    if (indice + 1 >= fila.length) setFim(true);
    else setIndice((i) => i + 1);
  }

  const podeVerificar =
    ex &&
    (ex.tipo === "apresentar" ||
      ((ex.tipo === "escolher" || ex.tipo === "ouvir") && escolha !== null) ||
      (ex.tipo === "montar" && montagem.length > 0) ||
      ex.tipo === "falar");

  // ── tela de conclusão ─────────────────────────────────────────────
  if (fim) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="celebrar">
          <div className="text-7xl">{perfeita ? "🏆" : "🎉"}</div>
          <h2 className="mt-4 text-3xl font-extrabold">
            {perfeita ? (
              <span className="grad-texto">Lição perfeita!</span>
            ) : (
              "Lição concluída!"
            )}
          </h2>
          <p className="mt-2 font-semibold text-[var(--suave)]">{titulo}</p>
          <div className="mt-6 flex justify-center gap-3">
            <div className="cartao min-w-28 px-4 py-3">
              <p className="text-xs font-extrabold uppercase text-[var(--amarelo-escuro)]">Pontos</p>
              <p className="text-2xl font-black text-[var(--amarelo-escuro)]">+{xpGanho}</p>
            </div>
            <div className="cartao min-w-28 px-4 py-3">
              <p className="text-xs font-extrabold uppercase" style={{ color: trio.escuro }}>
                Precisão
              </p>
              <p className="text-2xl font-black" style={{ color: trio.escuro }}>
                {total > 0 ? Math.max(0, Math.round(((total - erros) / total) * 100)) : 100}%
              </p>
            </div>
          </div>
          {perfeita && (
            <p className="mt-3 text-sm font-bold text-[var(--verde-escuro)]">
              +{XP_BONUS_PERFEITA} pontos de bônus por não errar nenhuma!
            </p>
          )}
          <button onClick={aoSair} className="botao mt-8 w-full">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ── sessão em andamento ───────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      {/* topo: sair + progresso */}
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={() => setConfirmaSaida(true)}
          aria-label="Sair da lição"
          className="text-2xl font-black text-[var(--suave)] transition hover:text-[var(--texto)]"
        >
          ✕
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--borda)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(indice / total) * 100}%`, background: trio.base }}
          />
        </div>
      </div>

      {confirmaSaida && (
        <div className="cartao surgir mb-4 px-4 py-3 text-sm font-bold">
          Sair agora perde o progresso desta lição. Sair mesmo?
          <div className="mt-2 flex gap-2">
            <button onClick={aoSair} className="botao vermelho px-4 py-2 text-xs">
              Sair
            </button>
            <button
              onClick={() => setConfirmaSaida(false)}
              className="botao claro px-4 py-2 text-xs"
            >
              Ficar
            </button>
          </div>
        </div>
      )}

      {/* exercício */}
      <div key={indice} className="surgir flex-1 pb-40">
        {ex.tipo === "apresentar" && <ExApresentar ex={ex} />}
        {(ex.tipo === "escolher" || ex.tipo === "ouvir") && (
          <ExEscolher ex={ex} escolha={escolha} setEscolha={setEscolha} checado={checado} />
        )}
        {ex.tipo === "montar" && (
          <ExMontar ex={ex} montagem={montagem} setMontagem={setMontagem} checado={checado} />
        )}
        {ex.tipo === "falar" && <ExFalar ex={ex} aoTentar={() => setFalou(true)} />}
      </div>

      {/* rodapé: verificar / feedback */}
      <footer
        className={`fixed inset-x-0 bottom-0 border-t-2 px-4 py-4 ${
          checado === "certo"
            ? "border-[var(--verde)] bg-[var(--verde-claro)]"
            : checado === "errado"
            ? "border-[var(--vermelho)] bg-[var(--vermelho-claro)]"
            : "border-[var(--borda)] bg-[var(--cartao)]"
        }`}
      >
        <div className="mx-auto max-w-xl">
          {checado === "certo" && (
            <p className="mb-2 font-black text-[var(--verde-escuro)]">✅ Muito bem!</p>
          )}
          {checado === "errado" && (
            <div className={`mb-2 ${checado === "errado" ? "tremer" : ""}`}>
              <p className="font-black text-[var(--vermelho-escuro)]">Resposta certa:</p>
              <p className="font-bold text-[var(--vermelho-escuro)]">
                {ex.tipo === "montar" ? ex.item.alvo : "correta" in ex ? ex.correta : ""}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--vermelho-escuro)] opacity-80">
                Sem estresse: essa volta de novo no fim da lição.
              </p>
            </div>
          )}
          {checado === null ? (
            ex.tipo === "apresentar" || ex.tipo === "falar" ? (
              <div className="flex gap-2">
                {ex.tipo === "falar" && !falou && (
                  <button onClick={continuar} className="botao claro flex-1">
                    Pular
                  </button>
                )}
                <button
                  onClick={ex.tipo === "apresentar" ? verificar : continuar}
                  className="botao flex-1"
                  style={{ ["--b" as string]: trio.base, ["--b-sombra" as string]: trio.escuro }}
                >
                  {ex.tipo === "apresentar" ? "Entendi" : "Continuar"}
                </button>
              </div>
            ) : (
              <button onClick={verificar} disabled={!podeVerificar} className="botao w-full">
                Verificar
              </button>
            )
          ) : (
            <button
              onClick={continuar}
              className={`botao w-full ${checado === "errado" ? "vermelho" : ""}`}
            >
              Continuar
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ── renderizadores de exercício ─────────────────────────────────────

function ExApresentar({ ex }: { ex: Extract<Exercicio, { tipo: "apresentar" }> }) {
  const { item } = ex;
  return (
    <div>
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--suave)]">
        ✨ Frase nova
      </h3>
      <div className="cartao mt-3 px-5 py-6">
        <p className="text-2xl font-black">{item.alvo}</p>
        {item.pronuncia && (
          <p className="mt-1 font-bold text-[var(--azul)]">🗣️ {item.pronuncia}</p>
        )}
        <p className="mt-3 text-lg font-bold text-[var(--suave)]">{item.traducao}</p>
        <div className="mt-4">
          <BotaoOuvir texto={item.alvo} grande />
        </div>
      </div>
      {item.desmontado && (
        <div className="cartao mt-3 border-[var(--amarelo)] bg-[var(--amarelo-claro)] px-4 py-3 text-sm font-semibold">
          🔍 {item.desmontado}
        </div>
      )}
    </div>
  );
}

function ExEscolher({
  ex,
  escolha,
  setEscolha,
  checado,
}: {
  ex: Extract<Exercicio, { tipo: "escolher" | "ouvir" }>;
  escolha: string | null;
  setEscolha: (s: string) => void;
  checado: Checagem;
}) {
  const { item } = ex;
  const ehOuvir = ex.tipo === "ouvir";
  const ehFRPT = !ehOuvir && ex.direcao === "fr-pt";

  return (
    <div>
      <h3 className="text-xl font-black">
        {ehOuvir
          ? "O que você ouviu? 👂"
          : ehFRPT
          ? "O que significa?"
          : "Como se diz em francês?"}
      </h3>

      <div className="mt-4">
        {ehOuvir ? (
          <BotaoOuvir texto={item.alvo} grande />
        ) : ehFRPT ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xl font-black">{item.alvo}</p>
            <BotaoOuvir texto={item.alvo} />
          </div>
        ) : (
          <p className="text-xl font-black">“{item.traducao}”</p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {ex.opcoes.map((op) => {
          let cls = "";
          if (checado === null) cls = escolha === op ? "selecionada" : "";
          else if (op === ex.correta) cls = "certa";
          else if (op === escolha) cls = "errada";
          return (
            <button
              key={op}
              onClick={() => checado === null && setEscolha(op)}
              disabled={checado !== null}
              className={`opcao ${cls}`}
            >
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExMontar({
  ex,
  montagem,
  setMontagem,
  checado,
}: {
  ex: Extract<Exercicio, { tipo: "montar" }>;
  montagem: number[];
  setMontagem: (m: number[]) => void;
  checado: Checagem;
}) {
  return (
    <div>
      <h3 className="text-xl font-black">Monte a frase em francês 🧩</h3>
      <p className="mt-3 text-lg font-bold text-[var(--suave)]">“{ex.item.traducao}”</p>

      {/* linha de resposta */}
      <div className="mt-6 flex min-h-14 flex-wrap items-start gap-2 border-b-2 border-[var(--borda)] pb-3">
        {montagem.length === 0 && (
          <span className="text-sm font-semibold text-[var(--suave)]">
            Toque nas peças abaixo, na ordem…
          </span>
        )}
        {montagem.map((idx, pos) => (
          <button
            key={`${idx}-${pos}`}
            onClick={() =>
              checado === null && setMontagem(montagem.filter((_, p) => p !== pos))
            }
            className="chip"
            style={
              checado === "certo"
                ? { borderColor: "var(--verde)", background: "var(--verde-claro)" }
                : checado === "errado"
                ? { borderColor: "var(--vermelho)", background: "var(--vermelho-claro)" }
                : undefined
            }
          >
            {ex.pecas[idx]}
          </button>
        ))}
      </div>

      {/* banco de peças */}
      <div className="mt-6 flex flex-wrap gap-2">
        {ex.pecas.map((peca, idx) => (
          <button
            key={idx}
            onClick={() => checado === null && setMontagem([...montagem, idx])}
            className={`chip ${montagem.includes(idx) ? "usado" : ""}`}
          >
            {peca}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExFalar({
  ex,
  aoTentar,
}: {
  ex: Extract<Exercicio, { tipo: "falar" }>;
  aoTentar: () => void;
}) {
  const { item } = ex;
  return (
    <div>
      <h3 className="text-xl font-black">Agora é a sua vez de falar 🎤</h3>
      <div className="cartao mt-4 px-5 py-6">
        <p className="text-2xl font-black">{item.alvo}</p>
        {item.pronuncia && (
          <p className="mt-1 font-bold text-[var(--azul)]">🗣️ {item.pronuncia}</p>
        )}
        <p className="mt-2 font-bold text-[var(--suave)]">{item.traducao}</p>
        <div className="mt-4">
          <BotaoOuvir texto={item.alvo} />
        </div>
      </div>
      <div className="mt-4">
        <BotaoFalar alvo={item.alvo} aoResultado={() => aoTentar()} />
      </div>
    </div>
  );
}
