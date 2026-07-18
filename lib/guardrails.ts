// GUARDRAILS da API do tutor (única superfície com custo e com IA).
// Camadas: validação/saneamento de entrada → rate limit por IP → erros
// genéricos (sem vazar interno). O anti-prompt-injection fica no system
// prompt (lib/tutor.ts) + na guarda gerador→avaliador (lib/avaliador.ts).

import type { Nivel, Usuario } from "./types";

export const LIMITE_MENSAGEM = 500; // caracteres por dúvida
const LIMITE_NOME = 30;

// ── Saneamento ──────────────────────────────────────────────────────

const RE_CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Remove caracteres de controle (e \n em campos de linha única). */
function limparTexto(s: unknown, max: number, umaLinha = false): string {
  if (typeof s !== "string") return "";
  let t = s.replace(RE_CONTROLE, "");
  if (umaLinha) t = t.replace(/[\r\n]+/g, " ");
  return t.trim().slice(0, max);
}

const NIVEIS: Nivel[] = ["iniciante", "basico", "intermediario"];

export interface EntradaValidada {
  ok: boolean;
  erro?: string;
  mensagem: string;
  usuario: Usuario;
}

/**
 * Valida e RECONSTRÓI a entrada do turno: nunca repassamos o objeto do
 * cliente adiante — montamos um Usuario novo só com campos saneados.
 */
export function validarTurno(body: unknown): EntradaValidada {
  const b = (body ?? {}) as Record<string, unknown>;
  const vazio: Usuario = {
    id: "anon",
    nome: "",
    nivel: "iniciante",
    metaDiariaXP: 20,
    criadoEm: "",
  };

  if (typeof b.mensagem === "string" && b.mensagem.length > LIMITE_MENSAGEM * 4) {
    return {
      ok: false,
      erro: `Mensagem longa demais (máx. ${LIMITE_MENSAGEM} caracteres).`,
      mensagem: "",
      usuario: vazio,
    };
  }

  const mensagem = limparTexto(b.mensagem, LIMITE_MENSAGEM);
  if (!mensagem) {
    return { ok: false, erro: "Escreva uma dúvida.", mensagem: "", usuario: vazio };
  }

  const u = (b.usuario ?? {}) as Record<string, unknown>;
  const nivel = NIVEIS.includes(u.nivel as Nivel) ? (u.nivel as Nivel) : "iniciante";
  const usuario: Usuario = {
    ...vazio,
    nome: limparTexto(u.nome, LIMITE_NOME, true),
    nivel,
  };

  return { ok: true, mensagem, usuario };
}

// ── Rate limit por IP (janela deslizante, em memória) ───────────────
// Em serverless cada instância tem o próprio mapa — não é perfeito, mas
// corta abuso simples de custo. Upgrade futuro: KV/Upstash.

const JANELA_MS = 60_000;
const MAX_POR_MINUTO = 6;
const MAX_IPS = 5_000; // teto de memória

const chamadas = new Map<string, number[]>();

export function ipDaRequisicao(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "local";
}

/** true = pode seguir; false = estourou o limite (responder 429). */
export function dentroDoLimite(ip: string): boolean {
  const agora = Date.now();
  const lista = (chamadas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= MAX_POR_MINUTO) {
    chamadas.set(ip, lista);
    return false;
  }
  lista.push(agora);
  // evita crescimento sem fim do mapa
  if (chamadas.size >= MAX_IPS && !chamadas.has(ip)) {
    const primeiro = chamadas.keys().next().value;
    if (primeiro !== undefined) chamadas.delete(primeiro);
  }
  chamadas.set(ip, lista);
  return true;
}
