"use client";

// 🗼 A VIAGEM: a home do Lingo. Nada de listas roladas — cada capítulo é
// um CARTÃO-CENA em tela cheia; você desliza para o lado (como stories)
// e cada cartão tem UMA ação principal. Lições detalhadas ficam numa
// gaveta; a gramática-ponte é o último cartão da viagem.

import { useEffect, useState } from "react";
import { UNIDADES, estaDesbloqueada, proximaLicao } from "@/lib/curso";
import { dialogoDoContexto } from "@/lib/dialogos";
import { topicosGramatica } from "@/lib/gramatica";
import { corDe } from "@/lib/cores";
import { cenasFeitas, licoesFeitas, ofensiva, xpHoje } from "@/lib/jogo";
import { idsVencidos } from "@/lib/srs";
import type { Unidade, Usuario } from "@/lib/types";

/** Contexto-cenário de cada unidade (para diálogo e clima visual). */
const CONTEXTO_DA_UNIDADE: Record<string, string> = {
  "u-restaurante": "restaurante",
  "u-hotel": "hotel",
  "u-cidade": "rua",
};

const CLIMA: Record<string, string> = {
  verde: "radial-gradient(420px 300px at 80% 0%, rgba(52,201,142,.22), transparent 65%)",
  azul: "radial-gradient(420px 300px at 80% 0%, rgba(91,124,250,.24), transparent 65%)",
  roxo: "radial-gradient(420px 300px at 80% 0%, rgba(168,132,245,.24), transparent 65%)",
  laranja: "radial-gradient(420px 300px at 80% 0%, rgba(245,158,88,.22), transparent 65%)",
  vermelho: "radial-gradient(420px 300px at 80% 0%, rgba(240,99,122,.2), transparent 65%)",
  ciano: "radial-gradient(420px 300px at 80% 0%, rgba(76,196,217,.22), transparent 65%)",
};

export default function Viagem({
  usuario,
  aoAbrirLicao,
  aoAbrirCena,
  aoAbrirGramatica,
  aoRevisar,
}: {
  usuario: Usuario;
  aoAbrirLicao: (licaoId: string) => void;
  aoAbrirCena: (dialogoId: string) => void;
  aoAbrirGramatica: (topicoId: string) => void;
  aoRevisar: (ids: string[]) => void;
}) {
  const [gaveta, setGaveta] = useState<Unidade | null>(null);
  const [vencidos, setVencidos] = useState<string[]>([]);
  useEffect(() => setVencidos([...idsVencidos()]), []);

  const feitas = licoesFeitas();
  const cenas = cenasFeitas();
  const proxima = proximaLicao(feitas);
  const pts = xpHoje();
  const meta = usuario.metaDiariaXP;
  const dias = ofensiva();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* topo compacto */}
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <span className="text-2xl font-extrabold tracking-tight">
          <span className="grad-texto">Lingo</span>
        </span>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-[var(--ouro-claro)] px-3 py-1 text-[var(--ouro)]" title="Dias seguidos">
            🔥 {dias}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              pts >= meta
                ? "bg-[var(--verde-claro)] text-[var(--verde-escuro)]"
                : "bg-[var(--azul-claro)] text-[var(--azul-escuro)]"
            }`}
            title="Meta de hoje"
          >
            {pts >= meta ? "✓" : "⚡"} {pts}/{meta}
          </span>
        </div>
      </header>

      {/* revisão do dia (1 linha, só quando existe) */}
      {vencidos.length > 0 && (
        <button
          onClick={() => aoRevisar(vencidos)}
          className="mx-5 mb-1 flex items-center justify-between rounded-2xl bg-[var(--ouro-claro)] px-4 py-2.5 text-sm font-bold text-[var(--ouro)]"
        >
          🧠 {vencidos.length} {vencidos.length === 1 ? "frase" : "frases"} para revisar
          <span>→</span>
        </button>
      )}

      {/* o carrossel da viagem */}
      <div
        className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 pt-3"
        style={{ scrollbarWidth: "none" }}
      >
        {UNIDADES.map((unidade, idx) => {
          const cor = corDe(unidade.cor);
          const concluidas = unidade.licoes.filter((l) => feitas.has(l.id)).length;
          const total = unidade.licoes.length;
          const completa = concluidas === total;
          const aberta = estaDesbloqueada(unidade.licoes[0].id, feitas);
          const atualAqui = proxima && unidade.licoes.some((l) => l.id === proxima.licao.id);
          const proximaDaUnidade =
            unidade.licoes.find((l) => !feitas.has(l.id)) ?? unidade.licoes[0];
          const dialogo = dialogoDoContexto(CONTEXTO_DA_UNIDADE[unidade.id] ?? "");
          const cenaLiberada = dialogo && concluidas > 0;

          return (
            <section
              key={unidade.id}
              className={`cartao flex w-[82vw] max-w-sm shrink-0 snap-center flex-col p-5 ${
                aberta ? "" : "opacity-55"
              }`}
              style={{ backgroundImage: CLIMA[unidade.cor] }}
            >
              {/* cenário */}
              <div className="flex items-start justify-between">
                <span className="text-6xl drop-shadow-[0_8px_24px_rgba(0,0,0,.4)]">{unidade.emoji}</span>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-extrabold"
                  style={{ background: cor.claro, color: cor.escuro }}
                >
                  {idx + 1} / {UNIDADES.length}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-extrabold leading-tight">{unidade.titulo}</h2>
              <p className="mt-1 text-sm text-[var(--suave)]">{unidade.descricao}</p>

              {/* progresso do capítulo */}
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--borda)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(concluidas / total) * 100}%`, background: cor.base }}
                  />
                </div>
                <span className="text-xs font-bold text-[var(--suave)]">
                  {concluidas}/{total}
                </span>
              </div>

              <div className="flex-1" />

              {/* ações: UMA principal + extras */}
              {aberta ? (
                <>
                  <button
                    onClick={() => aoAbrirLicao(proximaDaUnidade.id)}
                    className="botao mt-4 w-full"
                  >
                    {completa ? "Rever capítulo" : atualAqui ? "Continuar" : "Estudar"} ·{" "}
                    {proximaDaUnidade.titulo}
                  </button>
                  {dialogo && (
                    <button
                      onClick={() => cenaLiberada && aoAbrirCena(dialogo.id)}
                      disabled={!cenaLiberada}
                      className={`botao claro mt-2 w-full ${cenaLiberada ? "" : "opacity-60"}`}
                      title={cenaLiberada ? "" : "Complete 1 lição do capítulo para liberar a cena"}
                    >
                      🎭 Cena ao vivo: {dialogo.titulo}
                      {cenas.has(dialogo.id) ? " ✓" : cenaLiberada ? "" : " 🔒"}
                    </button>
                  )}
                  <button
                    onClick={() => setGaveta(unidade)}
                    className="mt-2 w-full py-1.5 text-center text-xs font-bold text-[var(--suave)]"
                  >
                    ver as {total} lições ▾
                  </button>
                </>
              ) : (
                <p className="mt-4 rounded-xl bg-[var(--azul-claro)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--suave)]">
                  🔒 Termine o capítulo anterior para desbloquear
                </p>
              )}
            </section>
          );
        })}

        {/* último cartão: as pontes do português */}
        <section
          className="cartao flex w-[82vw] max-w-sm shrink-0 snap-center flex-col p-5"
          style={{ backgroundImage: CLIMA.azul }}
        >
          <span className="text-6xl">📚</span>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight">Pontes do português</h2>
          <p className="mt-1 text-sm text-[var(--suave)]">
            O francês explicado pelo que você já sabe — consulte quando quiser.
          </p>
          <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
            {topicosGramatica().map((t) => (
              <button
                key={t.id}
                onClick={() => aoAbrirGramatica(t.id)}
                className="rounded-xl border border-[var(--borda)] bg-[rgba(255,255,255,.04)] px-3 py-2.5 text-left text-[13px] font-bold leading-tight transition hover:border-[var(--borda-forte)]"
              >
                <span className="block text-lg">{t.emoji}</span>
                {t.titulo}
              </button>
            ))}
          </div>
        </section>
      </div>

      <p className="pb-2 text-center text-[11px] text-[var(--suave)]">← deslize pela viagem →</p>

      {/* gaveta de lições do capítulo */}
      {gaveta && (
        <div className="fixed inset-0 z-50" onClick={() => setGaveta(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="cartao surgir absolute inset-x-3 bottom-3 max-h-[70dvh] overflow-y-auto rounded-3xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {gaveta.emoji} {gaveta.titulo}
              </h3>
              <button onClick={() => setGaveta(null)} className="text-xl text-[var(--suave)]">
                ✕
              </button>
            </div>
            {gaveta.licoes.map((licao) => {
              const feita = feitas.has(licao.id);
              const ok = estaDesbloqueada(licao.id, feitas);
              const cor = corDe(gaveta.cor);
              return (
                <button
                  key={licao.id}
                  onClick={() => ok && aoAbrirLicao(licao.id)}
                  disabled={!ok}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    ok ? "hover:bg-[var(--azul-claro)]" : "cursor-not-allowed opacity-40"
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={
                      feita
                        ? { background: cor.base, color: "#fff" }
                        : { border: "2px solid var(--borda-forte)", color: "var(--suave)" }
                    }
                  >
                    {feita ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{licao.titulo}</span>
                    <span className="block text-xs text-[var(--suave)]">
                      {licao.tipo === "gramatica" ? "gramática-ponte" : "frases + áudio"}
                    </span>
                  </span>
                  {feita && <span className="text-xs font-semibold text-[var(--suave)]">rever</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
