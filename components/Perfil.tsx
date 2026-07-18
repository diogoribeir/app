"use client";

// Aba PERFIL: estatísticas (XP, ofensiva, lições), gráfico da semana e ajustes.

import { useState } from "react";
import { atividadeSemana, ofensiva, totalLicoesFeitas, xpTotal } from "@/lib/jogo";
import { totalAgendados } from "@/lib/srs";
import { todasLicoes } from "@/lib/curso";
import { apagarTudo } from "@/lib/estadoLocal";
import type { Nivel, Usuario } from "@/lib/types";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const NIVEIS: { id: Nivel; rotulo: string }[] = [
  { id: "iniciante", rotulo: "🌱 Do zero" },
  { id: "basico", rotulo: "🌿 Básico" },
  { id: "intermediario", rotulo: "🌳 Intermediário" },
];
const METAS = [20, 40, 60];

export default function Perfil({
  usuario,
  aoAtualizar,
}: {
  usuario: Usuario;
  aoAtualizar: (u: Usuario) => void;
}) {
  const [confirmaReset, setConfirmaReset] = useState(false);
  const semana = atividadeSemana();
  const maxXP = Math.max(usuario.metaDiariaXP, ...semana.map((d) => d.xp));
  const feitas = totalLicoesFeitas();
  const totalLicoes = todasLicoes().length;

  return (
    <div className="surgir">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--verde-claro)] text-3xl">
          🥐
        </div>
        <div>
          <h1 className="text-2xl font-black">{usuario.nome || "Estudante"}</h1>
          <p className="text-sm font-semibold text-[var(--suave)]">
            Aprendendo francês desde {usuario.criadoEm}
          </p>
        </div>
      </div>

      {/* estatísticas */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat emoji="🔥" valor={String(ofensiva())} rotulo="dias seguidos" />
        <Stat emoji="⚡" valor={String(xpTotal())} rotulo="pontos acumulados" />
        <Stat emoji="⭐" valor={`${feitas}/${totalLicoes}`} rotulo="lições concluídas" />
        <Stat emoji="🧠" valor={String(totalAgendados())} rotulo="frases em memorização" />
      </div>

      {/* gráfico da semana */}
      <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-[var(--suave)]">
        Sua semana
      </h2>
      <div className="cartao mt-2 flex items-end justify-between gap-2 px-4 pb-3 pt-5">
        {semana.map((d) => {
          const dia = new Date(`${d.dia}T00:00:00`);
          const bateuMeta = d.xp >= usuario.metaDiariaXP;
          return (
            <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className="w-5 rounded-t-md transition-all"
                  style={{
                    height: `${maxXP > 0 ? Math.max(d.xp > 0 ? 8 : 2, (d.xp / maxXP) * 96) : 2}px`,
                    background: bateuMeta
                      ? "var(--verde)"
                      : d.xp > 0
                      ? "var(--amarelo)"
                      : "var(--borda)",
                  }}
                  title={`${d.xp} pts`}
                />
              </div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--suave)]">
                {DIAS_SEMANA[dia.getDay()]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ajustes */}
      <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-[var(--suave)]">
        Ajustes
      </h2>
      <div className="cartao mt-2 space-y-4 px-4 py-4">
        <div>
          <p className="text-sm font-black">Nível dos exercícios</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NIVEIS.map((n) => (
              <button
                key={n.id}
                onClick={() => aoAtualizar({ ...usuario, nivel: n.id })}
                className={`chip text-sm ${usuario.nivel === n.id ? "" : "opacity-60"}`}
                style={
                  usuario.nivel === n.id
                    ? { borderColor: "var(--azul)", background: "var(--azul-claro)" }
                    : undefined
                }
              >
                {n.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-black">Meta diária</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {METAS.map((m) => (
              <button
                key={m}
                onClick={() => aoAtualizar({ ...usuario, metaDiariaXP: m })}
                className={`chip text-sm ${usuario.metaDiariaXP === m ? "" : "opacity-60"}`}
                style={
                  usuario.metaDiariaXP === m
                    ? { borderColor: "var(--amarelo)", background: "var(--amarelo-claro)" }
                    : undefined
                }
              >
                {m} pts
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* zona de perigo */}
      <div className="mt-6">
        {confirmaReset ? (
          <div className="cartao border-[var(--vermelho)] bg-[var(--vermelho-claro)] px-4 py-3 text-sm font-bold text-[var(--vermelho-escuro)]">
            Isso apaga TODO o progresso deste aparelho (pontos, sequência, revisões).
            Não dá para desfazer.
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  apagarTudo();
                  location.reload();
                }}
                className="botao vermelho px-4 py-2 text-xs"
              >
                Apagar tudo
              </button>
              <button
                onClick={() => setConfirmaReset(false)}
                className="botao claro px-4 py-2 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmaReset(true)}
            className="text-xs font-extrabold uppercase text-[var(--vermelho)]"
          >
            Recomeçar do zero…
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ emoji, valor, rotulo }: { emoji: string; valor: string; rotulo: string }) {
  return (
    <div className="cartao flex items-center gap-3 px-4 py-3">
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="text-xl font-black leading-none">{valor}</p>
        <p className="mt-0.5 text-xs font-bold text-[var(--suave)]">{rotulo}</p>
      </div>
    </div>
  );
}
