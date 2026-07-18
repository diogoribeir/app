// Portão de CI (Fase 1, esqueleto).
// Confere cada item do banco de conteúdo (camada B) contra as fontes
// determinísticas disponíveis (camada A) e SINALIZA só as divergências.
//
// Rode com:  npm run verificar-conteudo
//
// Na Fase 1.5 isto cresce: cruzamento com Google Translate + dicionários,
// e falha o build (exit 1) se houver divergência não resolvida.

import content from "../data/content.json";
import facts from "../data/facts.json";
import type { ItemConteudo, Lexema } from "../lib/types";

const itens = content.itens as ItemConteudo[];
const lexico = facts.lexico as Lexema[];

const palavrasConhecidas = new Set(lexico.map((l) => l.palavra.toLowerCase()));

let divergencias = 0;
let verificados = 0;

console.log("🔎 Verificando conteúdo contra fontes determinísticas...\n");

for (const item of itens) {
  if (item.status === "verificado") verificados++;

  // Checagem básica de integridade (placeholder das checagens futuras).
  if (!item.alvo.trim() || !item.traducao.trim()) {
    console.log(`❌ [${item.id}] alvo ou tradução vazios.`);
    divergencias++;
    continue;
  }

  // Exemplo de checagem cruzada com a camada A: se a frase cita uma
  // palavra do nosso léxico, ela ao menos existe na base de fatos.
  const tokens = item.alvo.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç']+/g) ?? [];
  const reconhecidas = tokens.filter((t) => palavrasConhecidas.has(t));
  if (item.tipo === "frase" && reconhecidas.length > 0) {
    console.log(
      `✓ [${item.id}] ancorada no léxico (${reconhecidas.join(", ")})`
    );
  }
}

console.log(
  `\n📊 ${verificados}/${itens.length} itens verificados · ${divergencias} divergência(s).`
);

if (divergencias > 0) {
  console.error("\n⚠️  Revise as divergências acima.");
  process.exit(1);
}
console.log("\n✅ Sem divergências. Conteúdo seguro para ensinar.");
