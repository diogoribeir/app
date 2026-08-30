"use client";

// 🗼 A VIAGEM: a home do Lingo. Lista VERTICAL de capítulos — dá para ver
// todos os módulos de uma vez (sem arrastar um carrossel). Cada capítulo é um
// cartão que EXPANDE para mostrar suas lições (acordeão). TUDO LIBERADO: o
// aluno estuda na ordem que quiser, e qualquer lição tem "pular" (já sei).

import { useEffect, useState } from "react";
import { UNIDADES, proximaLicao } from "@/lib/curso";
import { dialogoDoContexto } from "@/lib/dialogos";
import { topicosGramatica } from "@/lib/gramatica";
import { corDe } from "@/lib/cores";
import { cenasFeitas, licoesFeitas, ofensiva, xpHoje } from "@/lib/jogo";
import { idsVencidos } from "@/lib/srs";
import type { Usuario } from "@/lib/types";

/** Contexto-cenário de cada unidade (para o diálogo da cena ao vivo). */
const CONTEXTO_DA_UNIDADE: Record<string, string> = {
  "u-restaurante": "restaurante",
  "u-hotel": "hotel",
  "u-cidade": "rua",
};

const CLIMA: Record<string, string> = {
  verde: "radial-gradient(320px 160px at 90% 0%, rgba(52,201,142,.20), transparent 70%)",
  azul: "radial-gradient(320px 160px at 90% 0%, rgba(91,124,250,.22), transparent 70%)",
  roxo: "radial-gradient(320px 160px at 90% 0%, rgba(168,132,245,.22), transparent 70%)",
  laranja: "radial-gradient(320px 160px at 90% 0%, rgba(245,158,88,.20), transparent 70%)",
  vermelho: "radial-gradient(320px 160px at 90% 0%, rgba(240,99,122,.18), transparent 70%)",
  ciano: "radial-gradient(320px 160px at 90% 0%, rgba(76,196,217,.20), transparent 70%)",
};

export default function Viagem({
  usuario,
  aoAbrirLicao,
  aoAbrirCena,
  aoAbrirGramatica,
  aoRevisar,
  aoPular,
}: {
  usuario: Usuario;
  aoAbrirLicao: (licaoId: string) => void;
  aoAbrirCena: (dialogoId: string) => void;
  aoAbrirGramatica: (topicoId: string) => void;
  aoRevisar: (ids: string[]) => void;
  /** Marca uma lição como feita sem praticar (para quem já sabe). */
  aoPular: (licaoId: string) => void;
}) {
  const feitas = licoesFeitas();
  const cenas = cenasFeitas();
  const proxima = proximaLicao(feitas);
  const pts = xpHoje();
  const meta = usuario.metaDiariaXP;
  const dias = ofensiva();

  // capítulo aberto por padrão: o que tem a próxima lição pendente.
  const unidadeDaProxima =
    proxima && UNIDADES.find((u) => u.licoes.some((l) => l.id === proxima.licao.id));
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(unidadeDaProxima ? [unidadeDaProxima.id] : [UNIDADES[0].id])
  );
  const [gramAberta, setGramAberta] = useState(false);
  const [vencidos, setVencidos] = useState<string[]>([]);
  useEffect(() => setVencidos([...idsVencidos()]), []);

  function alternar(id: string) {
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

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
          className="mx-4 mb-1 flex items-center justify-between rounded-2xl bg-[var(--ouro-claro)] px-4 py-2.5 text-sm font-bold text-[var(--ouro)]"
        >
          🧠 {vencidos.length} {vencidos.length === 1 ? "frase" : "frases"} para revisar
          <span>→</span>
        </button>
      )}

      <p className="px-5 pb-1 pt-1 text-[11px] font-semibold text-[var(--suave)]">
        Tudo liberado — estude na ordem que quiser. Toque num capítulo para ver as lições.
      </p>

      {/* LISTA VERTICAL de capítulos (acordeão) */}
      <div className="flex flex-col gap-2.5 px-4 pb-4">
        {UNIDADES.map((unidade) => {
          const cor = corDe(unidade.cor);
          const concluidas = unidade.licoes.filter((l) => feitas.has(l.id)).length;
          const total = unidade.licoes.length;
          const completa = concluidas === total;
          const aberto = abertos.has(unidade.id);
          const dialogo = dialogoDoContexto(CONTEXTO_DA_UNIDADE[unidade.id] ?? "");

          return (
            <section
              key={unidade.id}
              className="cartao overflow-hidden p-0"
              style={{ backgroundImage: CLIMA[unidade.cor] }}
            >
              {/* cabeçalho clicável do capítulo */}
              <button
                onClick={() => alternar(unidade.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-3xl">{unidade.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-lg font-extrabold leading-tight">
                      {unidade.titulo}
                    </span>
                    {completa && (
                      <span className="shrink-0 text-xs font-black" style={{ color: cor.escuro }}>
                        ✓
                      </span>
                    )}
                  </span>
                  {/* progresso do capítulo */}
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--borda)]">
                      <span
                        className="block h-full rounded-full transition-all duration-500"
                        style={{ width: `${(concluidas / total) * 100}%`, background: cor.base }}
                      />
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[var(--suave)]">
                      {concluidas}/{total}
                    </span>
                  </span>
                </span>
                <span
                  className="shrink-0 text-lg font-black text-[var(--suave)] transition-transform"
                  style={{ transform: aberto ? "rotate(180deg)" : "none" }}
                >
                  ▾
                </span>
              </button>

              {/* lições do capítulo (expandido) */}
              {aberto && (
                <div className="surgir border-t border-[var(--borda)] px-3 pb-3 pt-1">
                  {unidade.licoes.map((licao) => {
                    const feita = feitas.has(licao.id);
                    return (
                      <div key={licao.id} className="flex items-center gap-1">
                        <button
                          onClick={() => aoAbrirLicao(licao.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[var(--azul-claro)]"
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
                          {feita && (
                            <span className="shrink-0 text-xs font-semibold text-[var(--suave)]">
                              rever
                            </span>
                          )}
                        </button>
                        {/* pular: em TODA lição não-feita (para quem já sabe) */}
                        {!feita && (
                          <button
                            onClick={() => aoPular(licao.id)}
                            className="shrink-0 rounded-lg px-2 py-2 text-xs font-bold text-[var(--suave)] transition hover:bg-[var(--azul-claro)] hover:text-[var(--texto)]"
                            title="Já sei — marcar como feita sem praticar"
                          >
                            já sei ✓
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* cena ao vivo do capítulo (também liberada) */}
                  {dialogo && (
                    <button
                      onClick={() => aoAbrirCena(dialogo.id)}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-bold text-[var(--suave)] transition hover:bg-[var(--azul-claro)] hover:text-[var(--texto)]"
                    >
                      🎭 Cena ao vivo: {dialogo.titulo}
                      {cenas.has(dialogo.id) && <span>✓</span>}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Pontes do português (gramática) — também em acordeão */}
        <section className="cartao overflow-hidden p-0" style={{ backgroundImage: CLIMA.azul }}>
          <button
            onClick={() => setGramAberta((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="text-3xl">📚</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold leading-tight">Pontes do português</span>
              <span className="block text-xs text-[var(--suave)]">
                O francês explicado pelo que você já sabe — consulte quando quiser.
              </span>
            </span>
            <span
              className="shrink-0 text-lg font-black text-[var(--suave)] transition-transform"
              style={{ transform: gramAberta ? "rotate(180deg)" : "none" }}
            >
              ▾
            </span>
          </button>
          {gramAberta && (
            <div className="surgir grid grid-cols-2 gap-2 border-t border-[var(--borda)] p-3">
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
          )}
        </section>
      </div>
    </div>
  );
}
