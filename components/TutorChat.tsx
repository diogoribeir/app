"use client";

// Módulo TUTOR (camada C): chat em português com o tutor de IA.
// Toda resposta passa pela guarda gerador→avaliador; sem chave de API,
// roda em modo demonstração com conteúdo verificado.

import { useEffect, useRef, useState } from "react";
import BotaoOuvir from "./BotaoOuvir";
import { falar } from "@/lib/fala";
import type { RespostaTutor, TurnoChat, Usuario } from "@/lib/types";

/** A frase em francês que merece ser FALADA ao chegar a resposta. */
function fraseParaFalar(r?: RespostaTutor): string | null {
  if (!r) return null;
  return r.audio_texto[0] ?? r.vocab_novo[0]?.alvo ?? null;
}

const SUGESTOES = [
  "Como peço a conta educadamente?",
  "Qual a diferença entre bonjour e bonsoir?",
  "Por que 'je voudrais' e não 'je veux'?",
  "Como pergunto onde fica o metrô?",
];

export default function TutorChat({ usuario }: { usuario: Usuario }) {
  const [turnos, setTurnos] = useState<TurnoChat[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos, carregando]);

  async function enviar(mensagem: string) {
    const msg = mensagem.trim();
    if (!msg || carregando) return;
    setErro("");
    setTexto("");
    setTurnos((t) => [...t, { papel: "aluno", texto: msg }]);
    setCarregando(true);
    try {
      const resp = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagem: msg, usuario }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Erro no tutor.");
      const resposta = data.resposta as RespostaTutor;
      setTurnos((t) => [
        ...t,
        { papel: "tutor", texto: resposta.resposta, estruturado: resposta },
      ]);
      // O DIFERENCIAL: o tutor não só mostra — ele FALA a frase na hora.
      const frase = fraseParaFalar(resposta);
      if (frase) setTimeout(() => falar(frase), 400);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao falar com o tutor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="surgir flex min-h-[70vh] flex-col">
      <h1 className="text-2xl font-black">Tutor 💬</h1>
      <p className="mt-1 text-sm font-semibold text-[var(--suave)]">
        Pergunte qualquer coisa sobre francês, em português. O tutor só ensina a
        partir do conteúdo verificado — na dúvida, ele confirma antes.
      </p>

      <div className="mt-4 flex-1 space-y-3">
        {turnos.length === 0 && (
          <div className="cartao px-4 py-4">
            <p className="text-sm font-bold">Sem saber por onde começar? Tenta uma dessas:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="chip text-sm"
                  style={{ fontSize: "0.85rem" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turnos.map((t, i) =>
          t.papel === "aluno" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--azul)] px-4 py-2.5 font-bold text-white">
                {t.texto}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1 text-2xl">🧑‍🏫</span>
              <div className="cartao max-w-[85%] px-4 py-3">
                <p className="font-semibold">{t.texto}</p>
                <BlocoEstruturado r={t.estruturado} />
              </div>
            </div>
          )
        )}

        {carregando && (
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--suave)]">
            <span className="text-2xl">🧑‍🏫</span> pensando…
          </div>
        )}
        {erro && (
          <p className="cartao border-[var(--vermelho)] bg-[var(--vermelho-claro)] px-4 py-2 text-sm font-bold text-[var(--vermelho-escuro)]">
            {erro}
          </p>
        )}
        <div ref={fimRef} />
      </div>

      {/* caixa de envio */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="sticky bottom-24 mt-4 flex gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua dúvida em português…"
          className="cartao flex-1 px-4 py-3 font-semibold outline-none focus:border-[var(--azul)]"
        />
        <button
          type="submit"
          disabled={carregando || !texto.trim()}
          className="botao azul px-5"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

/** Partes estruturadas da resposta: correções, vocabulário novo e áudio. */
function BlocoEstruturado({ r }: { r?: RespostaTutor }) {
  if (!r) return null;
  // frases de áudio que não estão repetidas no vocabulário
  const jaMostradas = new Set(r.vocab_novo.map((v) => v.alvo.trim().toLowerCase()));
  const frasesAudio = r.audio_texto.filter(
    (f) => f.trim() && !jaMostradas.has(f.trim().toLowerCase())
  );
  return (
    <div className="mt-2 space-y-2">
      {frasesAudio.map((f) => (
        <div
          key={f}
          className="rounded-xl border-[1.5px] border-[var(--azul)] bg-[var(--azul-claro)] px-3 py-2.5"
        >
          <p className="serif text-lg font-bold">{f}</p>
          <div className="mt-2">
            <BotaoOuvir texto={f} />
          </div>
        </div>
      ))}
      {r.correcoes.map((c, i) => (
        <div
          key={i}
          className="rounded-xl border-2 border-[var(--laranja)] bg-[var(--laranja-claro)] px-3 py-2 text-sm"
        >
          <p className="font-black text-[var(--laranja-escuro)]">
            ✏️ {c.erro} → {c.correto}
          </p>
          <p className="mt-0.5 font-semibold">{c.regra_pt}</p>
        </div>
      ))}
      {r.vocab_novo.map((v, i) => (
        <div key={i} className="rounded-xl bg-[var(--azul-claro)] px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black">
              {v.alvo} <span className="font-semibold text-[var(--suave)]">= {v.traducao}</span>
            </p>
            <BotaoOuvir texto={v.alvo} />
          </div>
          {v.desmontado && <p className="mt-0.5 font-semibold">🔍 {v.desmontado}</p>}
        </div>
      ))}
      {r.proxima_meta && (
        <p className="text-xs font-bold text-[var(--suave)]">🎯 Próximo passo: {r.proxima_meta}</p>
      )}
    </div>
  );
}
