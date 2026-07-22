"use client";

// Shell do Lingo: onboarding → abas (Viagem · Frases · Tutor · Você) com
// nav flutuante de vidro. Lições, cenas e gramática abrem em tela cheia.

import { useEffect, useState } from "react";
import Onboarding from "@/components/Onboarding";
import Viagem from "@/components/Viagem";
import Vocabulario from "@/components/Vocabulario";
import Frases from "@/components/Frases";
import Sessao from "@/components/Sessao";
import Cena from "@/components/Cena";
import LicaoGramatica from "@/components/LicaoGramatica";
import TutorChat from "@/components/TutorChat";
import Perfil from "@/components/Perfil";
import { lerUsuario, salvarUsuario } from "@/lib/estadoLocal";
import { licaoPorId, itensDaLicao, itemPorId } from "@/lib/curso";
import { gerarFilaLicao, gerarFilaRevisao } from "@/lib/exercicios";
import { XP_LICAO, XP_REVISAO } from "@/lib/jogo";
import type { Usuario, Exercicio } from "@/lib/types";

type Aba = "viagem" | "vocab" | "frases" | "tutor" | "perfil";

type Tela =
  | { tipo: "abas" }
  | { tipo: "licao"; licaoId: string }
  | { tipo: "cena"; dialogoId: string }
  | { tipo: "gramatica"; topicoId: string; licaoId?: string }
  | { tipo: "revisao"; ids: string[] };

const ABAS: { id: Aba; emoji: string; rotulo: string }[] = [
  { id: "viagem", emoji: "🗼", rotulo: "Viagem" },
  { id: "vocab", emoji: "📇", rotulo: "Palavras" },
  { id: "frases", emoji: "🗣️", rotulo: "Frases" },
  { id: "tutor", emoji: "💬", rotulo: "Tutor" },
  { id: "perfil", emoji: "👤", rotulo: "Você" },
];

export default function Pagina() {
  const [pronto, setPronto] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [aba, setAba] = useState<Aba>("viagem");
  const [tela, setTela] = useState<Tela>({ tipo: "abas" });
  // muda a cada conclusão, para as abas recalcularem progresso
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    setUsuario(lerUsuario());
    setPronto(true);
  }, []);

  if (!pronto) return null;

  if (!usuario) {
    return (
      <Onboarding
        aoConcluir={(u) => {
          salvarUsuario(u);
          setUsuario(u);
        }}
      />
    );
  }

  function voltar() {
    setTela({ tipo: "abas" });
    setVersao((v) => v + 1);
  }

  function abrirLicao(licaoId: string) {
    const achado = licaoPorId(licaoId);
    if (!achado) return;
    if (achado.licao.tipo === "gramatica" && achado.licao.gramaticaId) {
      setTela({ tipo: "gramatica", topicoId: achado.licao.gramaticaId, licaoId });
    } else {
      setTela({ tipo: "licao", licaoId });
    }
  }

  // ── telas em cima das abas ────────────────────────────────────────
  if (tela.tipo === "licao") {
    const achado = licaoPorId(tela.licaoId);
    if (!achado) {
      voltar();
      return null;
    }
    const fila: Exercicio[] = gerarFilaLicao(itensDaLicao(achado.licao), usuario.nivel);
    return (
      <Sessao
        titulo={achado.licao.titulo}
        cor={achado.unidade.cor}
        fila={fila}
        xpBase={XP_LICAO}
        licaoId={tela.licaoId}
        aoSair={voltar}
      />
    );
  }

  if (tela.tipo === "cena") {
    return <Cena dialogoId={tela.dialogoId} aoSair={voltar} />;
  }

  if (tela.tipo === "gramatica") {
    return (
      <LicaoGramatica
        topicoId={tela.topicoId}
        licaoId={tela.licaoId}
        aoSair={voltar}
      />
    );
  }

  if (tela.tipo === "revisao") {
    const itens = tela.ids
      .map((id) => itemPorId(id))
      .filter((i): i is NonNullable<ReturnType<typeof itemPorId>> => Boolean(i));
    return (
      <Sessao
        titulo="Revisão do dia"
        cor="azul"
        fila={gerarFilaRevisao(itens, usuario.nivel)}
        xpBase={XP_REVISAO}
        aoSair={voltar}
      />
    );
  }

  // ── abas ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-24">
      {aba === "viagem" && (
        <Viagem
          key={`v${versao}`}
          usuario={usuario}
          aoAbrirLicao={abrirLicao}
          aoAbrirCena={(dialogoId) => setTela({ tipo: "cena", dialogoId })}
          aoAbrirGramatica={(topicoId) => setTela({ tipo: "gramatica", topicoId })}
          aoRevisar={(ids) => setTela({ tipo: "revisao", ids })}
        />
      )}
      {aba === "vocab" && (
        <div className="px-4">
          <Vocabulario />
        </div>
      )}
      {aba === "frases" && (
        <div className="px-4">
          <Frases />
        </div>
      )}
      {aba === "tutor" && (
        <div className="px-4">
          <TutorChat usuario={usuario} />
        </div>
      )}
      {aba === "perfil" && (
        <div className="px-4">
          <Perfil
            key={`p${versao}`}
            usuario={usuario}
            aoAtualizar={(u) => {
              salvarUsuario(u);
              setUsuario(u);
            }}
          />
        </div>
      )}

      {/* nav flutuante de vidro */}
      <nav className="fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="nav-vidro mx-auto flex max-w-md items-stretch justify-around rounded-3xl px-1 py-1.5 shadow-2xl">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-bold transition ${
                aba === a.id
                  ? "bg-[var(--azul-claro)] text-[var(--texto)]"
                  : "text-[var(--suave)]"
              }`}
            >
              <span className="text-lg leading-none">{a.emoji}</span>
              {a.rotulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
