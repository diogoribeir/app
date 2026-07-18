// Senha de acesso simples (HTTP Basic Auth) para o protótipo publicado.
// A senha fica numa variável de ambiente no servidor (ACCESS_PASSWORD),
// NUNCA no código enviado ao navegador. Se não houver senha configurada
// (ex.: rodando local), o app fica liberado.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Comparação em tempo constante — evita timing attack na senha. */
function igualSeguro(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const senha = process.env.ACCESS_PASSWORD;
  if (!senha) return NextResponse.next(); // sem senha → liberado (dev local)

  const usuario = process.env.ACCESS_USER || "lingo";
  const auth = req.headers.get("authorization");

  if (auth?.startsWith("Basic ")) {
    try {
      const decodificado = atob(auth.slice(6));
      const sep = decodificado.indexOf(":");
      const u = decodificado.slice(0, sep);
      const p = decodificado.slice(sep + 1);
      // as duas comparações SEMPRE rodam por inteiro (sem curto-circuito)
      const okUsuario = igualSeguro(u, usuario);
      const okSenha = igualSeguro(p, senha);
      if (okUsuario && okSenha) return NextResponse.next();
    } catch {
      /* cai no 401 abaixo */
    }
  }

  return new NextResponse("Acesso restrito", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lingo"' },
  });
}

// Protege as páginas e a API; libera assets estáticos e os arquivos da PWA.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
