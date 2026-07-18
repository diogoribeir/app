import { NextResponse } from "next/server";
import { processarTurno } from "@/lib/pipeline";
import { dentroDoLimite, ipDaRequisicao, validarTurno } from "@/lib/guardrails";

export async function POST(req: Request) {
  // 1) rate limit por IP — protege o custo da API de abuso simples
  if (!dentroDoLimite(ipDaRequisicao(req))) {
    return NextResponse.json(
      { erro: "Calma! Muitas perguntas em sequência. Tente de novo em 1 minuto." },
      { status: 429 }
    );
  }

  // 2) corpo precisa ser JSON válido…
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  // 3) …e passar na validação/saneamento (nunca repassamos o objeto cru)
  const entrada = validarTurno(body);
  if (!entrada.ok) {
    return NextResponse.json({ erro: entrada.erro }, { status: 400 });
  }

  const dificil = Boolean((body as Record<string, unknown>)?.dificil);

  try {
    const resultado = await processarTurno(entrada.usuario, entrada.mensagem, dificil);
    return NextResponse.json(resultado);
  } catch (e) {
    // erro real só no log do servidor; o cliente recebe mensagem genérica
    console.error("[/api/tutor]", e);
    return NextResponse.json(
      { erro: "O tutor está indisponível agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }
}
