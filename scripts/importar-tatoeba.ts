// Importador Tatoeba → camada B (conteúdo verificado).
// Lê os dumps PT/FR + ligações (frases traduzidas por HUMANOS), filtra para
// frases curtas e de viagem por contexto, e mescla em data/content.json.
//
// Pré-requisito: arquivos descompactados em data/raw/:
//   fra_sentences.tsv, por_sentences.tsv, fra-por_links.tsv
// Rode com:  npm run importar-tatoeba
//
// Reliability: as frases e traduções vêm do corpus humano do Tatoeba (camada B).
// Pronúncia/desmontado NÃO são inventados aqui — ficam ausentes (a UI lida com
// isso; o áudio TTS continua funcionando). Aulas curadas à mão são preservadas.

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { ItemConteudo } from "../lib/types";

const RAW = path.join(process.cwd(), "data", "raw");
const CONTENT = path.join(process.cwd(), "data", "content.json");

const MAX_PALAVRAS = 9; // frases curtas = boas para iniciante

// Contextos e palavras-chave (normalizadas, sem acento). Ordem = prioridade.
const CONTEXTOS: { nome: string; cap: number; chaves: string[] }[] = [
  {
    nome: "geral",
    cap: 8,
    chaves: [
      "bonjour", "bonsoir", "merci", "vous plait", "oui", "non", "pardon",
      "excusez", "au revoir", "parlez vous", "je ne comprends", "comprends",
      "m appelle", "enchante", "comment allez", "de rien", "bienvenue",
    ],
  },
  {
    nome: "restaurante",
    cap: 16,
    chaves: [
      "restaurant", "table", "menu", "carte", "addition", "cafe", "manger",
      "boire", "plat", "eau", "vin", "biere", "commander", "serveur",
      "dejeuner", "diner", "reservation", "reserver", "faim", "soif",
      "dessert", "entree", "delicieux",
    ],
  },
  {
    nome: "hotel",
    cap: 12,
    chaves: [
      "hotel", "chambre", "nuit", "cle", "clef", "valise", "ascenseur",
      "petit dejeuner", "lit", "etage", "reception", "sejour", "bagage",
    ],
  },
  {
    nome: "compras",
    cap: 12,
    chaves: [
      "combien", "prix", "coute", "acheter", "payer", "euros", "magasin",
      "taille", "essayer", "caisse", "cher", "ouvert", "ferme", "carte bancaire",
    ],
  },
  {
    nome: "emergencia",
    cap: 10,
    chaves: [
      "aidez", "au secours", "secours", "police", "medecin", "hopital",
      "pharmacie", "malade", "urgence", "douleur", "blesse", "ambulance",
      "j ai mal", "vole",
    ],
  },
  {
    nome: "rua",
    cap: 14,
    chaves: [
      "ou est", "ou sont", "gare", "rue", "gauche", "droite", "tout droit",
      "metro", "bus", "train", "taxi", "arret", "billet", "plan", "perdu",
      "loin", "adresse", "aeroport", "direction", "ici",
    ],
  },
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function casaContexto(textoNorm: string): string | null {
  const acolchoado = ` ${textoNorm} `;
  for (const ctx of CONTEXTOS) {
    if (ctx.chaves.some((k) => acolchoado.includes(` ${k} `))) return ctx.nome;
  }
  return null;
}

/** Lê um arquivo de frases (id \t lang \t texto) → Map id→texto. */
function lerFrases(arquivo: string): Map<string, string> {
  const txt = readFileSync(path.join(RAW, arquivo), "utf-8");
  const mapa = new Map<string, string>();
  for (const linha of txt.split("\n")) {
    const tab1 = linha.indexOf("\t");
    if (tab1 < 0) continue;
    const tab2 = linha.indexOf("\t", tab1 + 1);
    if (tab2 < 0) continue;
    const id = linha.slice(0, tab1);
    const texto = linha.slice(tab2 + 1).trim();
    if (texto) mapa.set(id, texto);
  }
  return mapa;
}

function contarPalavras(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function main() {
  console.log("📥 Lendo dumps do Tatoeba…");
  const fra = lerFrases("fra_sentences.tsv");
  const por = lerFrases("por_sentences.tsv");
  console.log(`   FR: ${fra.size} frases · PT: ${por.size} frases`);

  // fraId → melhor (mais curta) tradução PT.
  const traducaoDe = new Map<string, { porId: string; texto: string }>();
  const links = readFileSync(path.join(RAW, "fra-por_links.tsv"), "utf-8");
  for (const linha of links.split("\n")) {
    const [fraId, porId] = linha.split("\t");
    if (!fraId || !porId) continue;
    const pt = por.get(porId);
    if (!pt) continue;
    const atual = traducaoDe.get(fraId);
    if (!atual || pt.length < atual.texto.length) {
      traducaoDe.set(fraId, { porId, texto: pt });
    }
  }
  console.log(`   pares FR↔PT: ${traducaoDe.size}`);

  // Conteúdo já existente (curado à mão) — preservar e evitar duplicar.
  const atual = JSON.parse(readFileSync(CONTENT, "utf-8"));
  const itensExistentes: ItemConteudo[] = atual.itens;
  const jaVistos = new Set(
    itensExistentes.map((i) => normalizar(i.alvo))
  );

  // Candidatos por contexto.
  const porContexto = new Map<string, ItemConteudo[]>();
  for (const ctx of CONTEXTOS) porContexto.set(ctx.nome, []);

  for (const [fraId, traducao] of traducaoDe) {
    const textoFR = fra.get(fraId);
    if (!textoFR) continue;
    if (contarPalavras(textoFR) > MAX_PALAVRAS) continue;

    const norm = normalizar(textoFR);
    if (jaVistos.has(norm)) continue;

    const contexto = casaContexto(norm);
    if (!contexto) continue;

    jaVistos.add(norm);
    porContexto.get(contexto)!.push({
      id: `t${fraId}`,
      tipo: "frase",
      alvo: textoFR,
      traducao: traducao.texto,
      contexto,
      fonte: `Tatoeba #${fraId}↔${traducao.porId}`,
      status: "verificado",
    });
  }

  // Para cada contexto: ordena por frase mais curta (mais fácil) e aplica o cap.
  const novos: ItemConteudo[] = [];
  for (const ctx of CONTEXTOS) {
    const lista = porContexto
      .get(ctx.nome)!
      .sort((a, b) => contarPalavras(a.alvo) - contarPalavras(b.alvo))
      .slice(0, ctx.cap);
    novos.push(...lista);
    console.log(`   ${ctx.nome}: +${lista.length}`);
  }

  const final = {
    _fonte:
      "Curadoria à mão + importação do Tatoeba (corpus humano PT↔FR). Frases verificadas; pronúncia/desmontado só nos itens curados.",
    itens: [...itensExistentes, ...novos],
  };
  writeFileSync(CONTENT, JSON.stringify(final, null, 2), "utf-8");
  console.log(
    `\n✅ content.json: ${itensExistentes.length} existentes + ${novos.length} novos = ${final.itens.length} itens.`
  );
}

main();
