// Perfil do aluno guardado NO APARELHO (localStorage).
// Deploy-ready em serverless: cada pessoa carrega o próprio estado, sem banco.

import type { Usuario } from "./types";

const K_USER = "lingo:usuario";

export function lerUsuario(): Usuario | null {
  if (typeof window === "undefined") return null;
  try {
    const u = localStorage.getItem(K_USER);
    return u ? (JSON.parse(u) as Usuario) : null;
  } catch {
    return null;
  }
}

export function salvarUsuario(usuario: Usuario) {
  localStorage.setItem(K_USER, JSON.stringify(usuario));
}

/** Apaga TODO o progresso do Lingo neste aparelho (perfil, XP, SRS…). */
export function apagarTudo() {
  const chaves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("lingo:")) chaves.push(k);
  }
  chaves.forEach((k) => localStorage.removeItem(k));
}
