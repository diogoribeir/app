"use client";

// Lição de GRAMÁTICA: páginas curtas (conceito → exemplos com áudio →
// tabelas da camada A quando houver) e um mini-quiz no fim.
// Conteúdo 100% curado (data/gramatica.json) — nada gerado por IA.

import { useMemo, useRef, useState } from "react";
import BotaoOuvir from "./BotaoOuvir";
import { topicoPorId } from "@/lib/gramatica";
import { conjugar } from "@/lib/camadaA";
import { corDe } from "@/lib/cores";
import { concluirLicao, ganharXP, XP_BONUS_PERFEITA, XP_LICAO } from "@/lib/jogo";
import type { PerguntaQuiz } from "@/lib/types";

type Pagina =
  | { tipo: "secao"; titulo: string; corpo: string }
  | { tipo: "exemplos" }
  | { tipo: "conjugacao"; infinitivo: string }
  | { tipo: "quiz"; pergunta: PerguntaQuiz };

export default function LicaoGramatica({
  topicoId,
  licaoId,
  aoSair,
}: {
  topicoId: string;
  /** Presente quando aberta pela trilha (dá XP); ausente na biblioteca. */
  licaoId?: string;
  aoSair: () => void;
}) {
  const topico = topicoPorId(topicoId);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [checado, setChecado] = useState(false);
  const [erros, setErros] = useState(0);
  const [fim, setFim] = useState(false);
  const registrou = useRef(false);

  const paginas: Pagina[] = useMemo(() => {
    if (!topico) return [];
    return [
      ...topico.secoes.map((s) => ({ tipo: "secao" as const, ...s })),
      ...(topico.exemplos.length > 0 ? [{ tipo: "exemplos" as const }] : []),
      ...(topico.conjugacoes ?? []).map((inf) => ({
        tipo: "conjugacao" as const,
        infinitivo: inf,
      })),
      ...topico.quiz.map((pergunta) => ({ tipo: "quiz" as const, pergunta })),
    ];
  }, [topico]);

  if (!topico) {
    aoSair();
    return null;
  }

  const cor = corDe(topico.cor);
  const pagina = paginas[indice];
  const perfeita = erros === 0;
  const xpGanho = XP_LICAO + (perfeita ? XP_BONUS_PERFEITA : 0);

  function continuar() {
    setEscolha(null);
    setChecado(false);
    if (indice + 1 >= paginas.length) {
      if (!registrou.current) {
        registrou.current = true;
        if (licaoId) concluirLicao(licaoId, xpGanho);
        else ganharXP(Math.max(5, Math.round(xpGanho / 2))); // leitura avulsa vale menos
      }
      setFim(true);
    } else {
      setIndice((i) => i + 1);
    }
  }

  if (fim) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="celebrar">
          <div className="text-7xl">{topico.emoji}</div>
          <h2 className="mt-4 text-3xl font-black">Conceito dominado!</h2>
          <p className="mt-2 font-semibold text-[var(--suave)]">{topico.titulo}</p>
          <div className="cartao mx-auto mt-6 min-w-32 px-4 py-3">
            <p className="text-xs font-extrabold uppercase text-[var(--amarelo-escuro)]">Pontos</p>
            <p className="text-2xl font-black text-[var(--amarelo-escuro)]">
              +{licaoId ? xpGanho : Math.max(5, Math.round(xpGanho / 2))}
            </p>
          </div>
          <button onClick={aoSair} className="botao mt-8 w-full">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      {/* topo */}
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={aoSair}
          aria-label="Sair"
          className="text-2xl font-black text-[var(--suave)] transition hover:text-[var(--texto)]"
        >
          ✕
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--borda)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(indice / paginas.length) * 100}%`, background: cor.base }}
          />
        </div>
      </div>

      <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: cor.escuro }}>
        {topico.emoji} {topico.titulo}
      </p>

      <div key={indice} className="surgir flex-1 pb-40 pt-3">
        {pagina.tipo === "secao" && (
          <div>
            <h3 className="text-2xl font-black">{pagina.titulo}</h3>
            <p className="mt-4 whitespace-pre-line text-[17px] font-semibold leading-relaxed">
              {pagina.corpo}
            </p>
          </div>
        )}

        {pagina.tipo === "exemplos" && (
          <div>
            <h3 className="text-2xl font-black">Ouça na prática 👂</h3>
            <div className="mt-4 space-y-3">
              {topico.exemplos.map((e) => (
                <div key={e.fr} className="cartao px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-black">{e.fr}</p>
                    <BotaoOuvir texto={e.fr} />
                  </div>
                  {e.pronuncia && (
                    <p className="mt-0.5 text-sm font-bold text-[var(--azul)]">
                      🗣️ {e.pronuncia}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-semibold text-[var(--suave)]">{e.pt}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {pagina.tipo === "conjugacao" && (
          <TabelaConjugacao infinitivo={pagina.infinitivo} corEscura={cor.escuro} />
        )}

        {pagina.tipo === "quiz" && (
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-[var(--suave)]">
              🧠 Rapidinha
            </h3>
            <p className="mt-2 text-xl font-black">{pagina.pergunta.pergunta}</p>
            <div className="mt-5 space-y-3">
              {pagina.pergunta.opcoes.map((op, i) => {
                let cls = "";
                if (!checado) cls = escolha === i ? "selecionada" : "";
                else if (i === pagina.pergunta.correta) cls = "certa";
                else if (i === escolha) cls = "errada";
                return (
                  <button
                    key={op}
                    onClick={() => !checado && setEscolha(i)}
                    disabled={checado}
                    className={`opcao ${cls}`}
                  >
                    {op}
                  </button>
                );
              })}
            </div>
            {checado && (
              <div
                className={`cartao surgir mt-4 px-4 py-3 text-sm font-bold ${
                  escolha === pagina.pergunta.correta
                    ? "border-[var(--verde)] bg-[var(--verde-claro)] text-[var(--verde-escuro)]"
                    : "border-[var(--vermelho)] bg-[var(--vermelho-claro)] text-[var(--vermelho-escuro)]"
                }`}
              >
                {escolha === pagina.pergunta.correta ? "✅ Isso! " : "Quase! "}
                {pagina.pergunta.explicacao}
              </div>
            )}
          </div>
        )}
      </div>

      {/* rodapé */}
      <footer className="fixed inset-x-0 bottom-0 border-t-2 border-[var(--borda)] bg-[var(--cartao)] px-4 py-4">
        <div className="mx-auto max-w-xl">
          {pagina.tipo === "quiz" && !checado ? (
            <button
              onClick={() => {
                setChecado(true);
                if (escolha !== pagina.pergunta.correta) setErros((e) => e + 1);
              }}
              disabled={escolha === null}
              className="botao w-full"
            >
              Verificar
            </button>
          ) : (
            <button
              onClick={continuar}
              className="botao w-full"
              style={{ ["--b" as string]: cor.base, ["--b-sombra" as string]: cor.escuro }}
            >
              Continuar
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** Tabela de conjugação vinda da CAMADA A (fatos, sem IA). */
function TabelaConjugacao({
  infinitivo,
  corEscura,
}: {
  infinitivo: string;
  corEscura: string;
}) {
  const c = conjugar(infinitivo);
  if (!c) return null;
  return (
    <div>
      <h3 className="text-2xl font-black">
        {c.infinitivo} <span className="text-[var(--suave)]">({c.traducao})</span>
      </h3>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">
        Presente · direto da camada de fatos ✅
      </p>
      <div className="cartao mt-4 divide-y-2 divide-[var(--borda)]">
        {Object.entries(c.presente).map(([pessoa, forma]) => {
          const frase = `${pessoa.split("/")[0]} ${forma}`;
          return (
            <div key={pessoa} className="flex items-center justify-between px-4 py-2.5">
              <p className="font-bold">
                <span className="text-[var(--suave)]">{pessoa}</span>{" "}
                <span style={{ color: corEscura }} className="font-black">
                  {forma}
                </span>
              </p>
              <BotaoOuvir texto={frase} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
