// A TRILHA do Lingo: unidades → lições, em ordem pedagógica.
// Cada lição referencia APENAS conteúdo verificado (camada B) ou tópicos de
// gramática curados — nada é inventado em tempo de execução.

import { itensVerificados } from "./camadaB";
import { topicosGramatica } from "./gramatica";
import type { ItemConteudo, Licao, Unidade } from "./types";

export const UNIDADES: Unidade[] = [
  {
    id: "u-basicos",
    emoji: "🥐",
    titulo: "Primeiros passos",
    descricao: "As palavras mágicas que abrem qualquer porta na França.",
    cor: "verde",
    licoes: [
      { id: "l-saudacoes", tipo: "frases", titulo: "Palavras mágicas", itemIds: ["g1", "g2", "g3"] },
      { id: "l-sobreviver", tipo: "frases", titulo: "Kit de sobrevivência", itemIds: ["g4", "g5", "g12", "g6"] },
      { id: "l-cognatos", tipo: "gramatica", titulo: "Você já sabe francês", gramaticaId: "cognatos" },
    ],
  },
  {
    id: "u-apresentar",
    emoji: "👋",
    titulo: "Apresentações",
    descricao: "Chegar, cumprimentar e puxar conversa do jeito certo.",
    cor: "azul",
    licoes: [
      { id: "l-chegando", tipo: "frases", titulo: "Chegando e saindo", itemIds: ["g7", "g8"] },
      { id: "l-quem-sou", tipo: "frases", titulo: "Quem é você", itemIds: ["g9", "g10", "g11"] },
      { id: "l-tu-vous", tipo: "gramatica", titulo: "Tu ou vous?", gramaticaId: "tu-vous" },
    ],
  },
  {
    id: "u-restaurante",
    emoji: "🍽️",
    titulo: "No restaurante",
    descricao: "Mesa, cardápio, pedido e conta — sem passar aperto.",
    cor: "laranja",
    licoes: [
      { id: "l-genero", tipo: "gramatica", titulo: "Le, la, un, une", gramaticaId: "genero-artigos" },
      { id: "l-mesa", tipo: "frases", titulo: "Pegando a mesa", itemIds: ["r1", "r2", "r3"] },
      { id: "l-durante", tipo: "frases", titulo: "Durante a refeição", itemIds: ["r4", "r5"] },
      { id: "l-cafe", tipo: "frases", titulo: "Café e padaria", itemIds: ["r6", "r7", "r8", "r9"] },
    ],
  },
  {
    id: "u-hotel",
    emoji: "🏨",
    titulo: "No hotel",
    descricao: "Check-in, café da manhã e pequenos pedidos.",
    cor: "roxo",
    licoes: [
      { id: "l-etre-avoir", tipo: "gramatica", titulo: "Être e avoir", gramaticaId: "etre-avoir" },
      { id: "l-checkin", tipo: "frases", titulo: "Check-in", itemIds: ["h1", "h2"] },
      { id: "l-hospedado", tipo: "frases", titulo: "Durante a estadia", itemIds: ["h3", "h4"] },
      { id: "l-pedidos-hotel", tipo: "frases", titulo: "Resolvendo problemas", itemIds: ["h5", "h6"] },
    ],
  },
  {
    id: "u-cidade",
    emoji: "🗺️",
    titulo: "Pela cidade",
    descricao: "Metrô, trem e como não se perder (ou se achar de novo).",
    cor: "ciano",
    licoes: [
      { id: "l-perguntas", tipo: "gramatica", titulo: "Três jeitos de perguntar", gramaticaId: "perguntas" },
      { id: "l-onde-fica", tipo: "frases", titulo: "Onde fica?", itemIds: ["u1", "u2", "u3"] },
      { id: "l-transporte", tipo: "frases", titulo: "Perdido e achado", itemIds: ["u4", "u5"] },
      { id: "l-direcoes", tipo: "frases", titulo: "Entendendo direções", itemIds: ["u6", "u7"] },
    ],
  },
  {
    id: "u-compras",
    emoji: "🛍️",
    titulo: "Compras",
    descricao: "Preço, cartão e aquele 'só estou olhando' salvador.",
    cor: "azul",
    licoes: [
      { id: "l-negacao", tipo: "gramatica", titulo: "Ne… pas", gramaticaId: "negacao" },
      { id: "l-preco", tipo: "frases", titulo: "Quanto custa?", itemIds: ["c1", "c2"] },
      { id: "l-pagando", tipo: "frases", titulo: "Na hora de pagar", itemIds: ["c3", "c4"] },
      { id: "l-escolhendo", tipo: "frases", titulo: "Escolhendo", itemIds: ["c5", "c6"] },
    ],
  },
  {
    id: "u-emergencia",
    emoji: "🚨",
    titulo: "Emergências",
    descricao: "As frases que você espera nunca usar — mas precisa saber.",
    cor: "vermelho",
    licoes: [
      { id: "l-ajuda", tipo: "frases", titulo: "Pedindo ajuda", itemIds: ["e1", "e5"] },
      { id: "l-saude", tipo: "frases", titulo: "Saúde e socorro", itemIds: ["e2", "e3", "e4"] },
      { id: "l-falsos-amigos", tipo: "gramatica", titulo: "Falsos amigos", gramaticaId: "falsos-amigos" },
    ],
  },
  {
    id: "u-polimento",
    emoji: "🎵",
    titulo: "Polimento",
    descricao: "Soar mais francês: os segredos da pronúncia.",
    cor: "roxo",
    licoes: [
      { id: "l-sons", tipo: "gramatica", titulo: "Os sons do francês", gramaticaId: "sons-do-frances" },
    ],
  },
];

/** Todos os contextos usados no curso (para o RAG do tutor). */
export const CONTEXTOS = ["geral", "restaurante", "hotel", "rua", "compras", "emergencia"];

const ITENS_POR_ID = new Map(itensVerificados().map((i) => [i.id, i]));

/** Lista achatada de lições na ordem da trilha. */
export function todasLicoes(): { licao: Licao; unidade: Unidade }[] {
  return UNIDADES.flatMap((u) => u.licoes.map((l) => ({ licao: l, unidade: u })));
}

export function licaoPorId(id: string): { licao: Licao; unidade: Unidade } | null {
  return todasLicoes().find((x) => x.licao.id === id) ?? null;
}

/** Itens verificados de uma lição de frases (ignora ids inexistentes). */
export function itensDaLicao(licao: Licao): ItemConteudo[] {
  return (licao.itemIds ?? [])
    .map((id) => ITENS_POR_ID.get(id))
    .filter((i): i is ItemConteudo => Boolean(i));
}

export function itemPorId(id: string): ItemConteudo | null {
  return ITENS_POR_ID.get(id) ?? null;
}

/**
 * Trilha linear: uma lição está desbloqueada se for a primeira ainda não
 * feita (ou se já foi feita — repetir é sempre permitido).
 */
export function estaDesbloqueada(licaoId: string, feitas: Set<string>): boolean {
  for (const { licao } of todasLicoes()) {
    if (licao.id === licaoId) return true; // é a próxima não-feita ou anterior
    if (!feitas.has(licao.id)) return false; // achou uma pendente antes dela
  }
  return false;
}

/** A próxima lição não concluída (para o botão "Continuar"). */
export function proximaLicao(feitas: Set<string>): { licao: Licao; unidade: Unidade } | null {
  return todasLicoes().find((x) => !feitas.has(x.licao.id)) ?? null;
}

/** Sanidade em dev: acusa lições apontando para ids inexistentes. */
export function validarCurso(): string[] {
  const problemas: string[] = [];
  const gramaticas = new Set(topicosGramatica().map((t) => t.id));
  for (const { licao } of todasLicoes()) {
    if (licao.tipo === "frases") {
      for (const id of licao.itemIds ?? []) {
        if (!ITENS_POR_ID.has(id)) problemas.push(`Lição ${licao.id}: item "${id}" não existe/não verificado.`);
      }
    } else if (licao.gramaticaId && !gramaticas.has(licao.gramaticaId)) {
      problemas.push(`Lição ${licao.id}: gramática "${licao.gramaticaId}" não existe.`);
    }
  }
  return problemas;
}
