import React, { useState, useEffect, useCallback } from "react";
import {
  Plane, Wallet, MapPin, Compass, Shirt, X, Utensils, ShoppingBag,
  Check, Ticket, Hotel, FileText, CheckCircle2, CircleDashed,
  CalendarDays, Sun, CloudRain, Loader2, Map as MapIcon,
  Star, Leaf, Clock, CreditCard, HeartPulse, Gift, Pill,
} from "lucide-react";

/* ---------- constants ---------- */

const TABS = [
  { id: "overview", title: "Visão geral", icon: Compass },
  { id: "budget", title: "Orçamento", icon: Wallet },
  { id: "itinerary", title: "Cronograma", icon: MapPin },
  { id: "map", title: "Mapa", icon: MapIcon },
  { id: "food", title: "Alimentação", icon: Utensils },
  { id: "health", title: "Saúde", icon: HeartPulse },
  { id: "logistics", title: "Logística", icon: Plane },
  { id: "compras", title: "Compras", icon: ShoppingBag },
  { id: "presentes", title: "Presentes", icon: Gift },
  { id: "outfits", title: "Outfits", icon: Shirt },
];

const BUDGET_CATEGORIES = [
  "Passagem", "Hospedagem", "Dinheiro disponível", "Alimentação", "Passeios",
  "Transporte local", "Compras", "Seguro viagem", "Outros",
];

const ITINERARY_TYPES = [
  { id: "passeio", label: "Passeio" },
  { id: "restaurante", label: "Restaurante" },
  { id: "compras", label: "Compras" },
  { id: "evento", label: "Show / Evento" },
  { id: "transporte", label: "Transporte" },
];

const CATEGORY_COLORS = {
  passeio: "#3B5166",
  restaurante: "#9B2C2C",
  compras: "#A88856",
  evento: "#5B6B4E",
  transporte: "#6B655A",
  hospedagem: "#1C1C1E",
};

const DOC_DEFAULTS = [
  "Passaporte válido (mín. 6 meses após a volta, recomendado)",
  "Seguro viagem com cobertura mínima de € 30.000 (obrigatório Schengen)",
  "ETIAS (verificar mais perto da viagem — previsto só pro 4º tri/2026)",
  "Reserva de hospedagem impressa/digital (hotel principal + aeroporto)",
  "Passagem de volta (e-ticket impresso/digital)",
  "Comprovante financeiro (extrato ou cartão internacional)",
  "Cartões de crédito internacionais avisados ao banco",
  "Chip / eSIM internacional (Nubank, 10GB cada) — resolvido",
];

const uid = () => Math.random().toString(36).slice(2, 10);
const toNumber = (v) => {
  const n = parseFloat(String(v ?? "").trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const fmtMoney = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Turns raw URLs inside a text fragment into short clickable links instead of showing the full address.
function linkifyParts(text) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      const clean = part.replace(/[)\].,]+$/, "");
      return (
        <a key={i} href={clean} target="_blank" rel="noreferrer" className="text-[#3B5166] underline">
          ver link ↗
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// Renders a notes string as short readable bullets instead of one dense paragraph,
// protecting embedded URLs from being split apart, then linkifying them.
function NoteList({ text }) {
  if (!text) return null;
  const urls = [];
  const masked = text.replace(/https?:\/\/\S+/g, (m) => {
    urls.push(m);
    return `\u0000${urls.length - 1}\u0000`;
  });
  const sentences = masked
    .split(/(?<=[.;])\s+(?=[A-ZÀ-Ý0-9€(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <ul className="mt-1.5 space-y-1">
      {sentences.map((s, i) => {
        const restored = s.replace(/\u0000(\d+)\u0000/g, (_, idx) => urls[Number(idx)]);
        return (
          <li key={i} className="flex gap-1.5 text-[11px] text-[#6B655A] leading-relaxed">
            <span className="text-[#A88856] shrink-0 leading-[1.4]">•</span>
            <span>{linkifyParts(restored)}</span>
          </li>
        );
      })}
    </ul>
  );
}

const emptyLogistics = {
  tripStart: "2026-09-10",
  tripEnd: "2026-09-18",
  flights: {
    outbound: {
      airline: "Air France", flightNumber: "459", date: "2026-09-10",
      depart: "19:35", arrive: "11:55", from: "GRU", to: "CDG",
      confirmation: "Decolar 267894351300 · web check-in X3Q8F7 · chega 11/09 em Paris",
      seats: "31L e 31K (assento standard, já marcados)",
      baggage: "2x bagagem de mão + 2x bolsa pequena por pessoa · 0x bagagem despachada incluída",
      meals: "Café da manhã + refeição principal, sendo 1x refeição vegana já solicitada",
    },
    inbound: {
      airline: "KLM", flightNumber: "2006 / 791", date: "2026-09-18",
      depart: "08:15", arrive: "19:50", from: "CDG", to: "GRU",
      confirmation: "Decolar 267894351300 · web check-in X3Q8F7",
      segments: [
        {
          leg: "1º trecho", flightNumber: "KL 2006", from: "CDG", to: "AMS",
          depart: "08:15", arrive: "09:40", date: "18/09",
          terminal: "Embarque no CDG: terminal a confirmar no e-ticket/check-in (KLM costuma operar do Terminal 2E/2F)",
        },
        {
          leg: "Conexão em Amsterdã (AMS)", flightNumber: "", from: "", to: "",
          depart: "09:40", arrive: "13:00", date: "18/09",
          terminal: "Espera de 3h20 em Schiphol, tempo confortável pra uma conexão internacional. Schiphol é aeroporto de terminal único, então não tem troca de terminal — só seguir as placas de 'Flight Connections/Transfers'.",
          procedure: "Passo a passo da conexão: 1) Desembarcar do voo CDG-AMS e seguir as placas amarelas de 'Flight Connections'. 2) Como o trecho CDG-AMS é dentro do Espaço Schengen mas o AMS-GRU sai do Schengen, tem controle de passaporte de saída do Schengen no meio do caminho — é rápido, mas leve o passaporte em mãos, não na mala. 3) Sem bagagem despachada (é o caso de vocês agora): só passar direto pela conexão com a bagagem de mão, sem precisar de esteira nem coleta — direto pro portão de embarque do KL 791. 4) Se em algum momento decidirem despachar mala: como os dois trechos são operados pela KLM na mesma reserva, a bagagem normalmente já sai despachada direto até o GRU (não precisa recolher e redespachar em Amsterdã) — mas sempre confirme isso no check-in em Guarulhos, pedindo pra conferir se a etiqueta vai até o destino final. 5) Chegando no portão, o embarque costuma fechar uns 20-30 min antes do horário de saída (13h00) — não deixe pra sair andando de última hora mesmo com a folga de 3h20.",
        },
        {
          leg: "2º trecho", flightNumber: "KL 791", from: "AMS", to: "GRU",
          depart: "13:00", arrive: "19:50", date: "18/09",
          terminal: "Embarque em Schiphol: gate a confirmar no painel do aeroporto (costuma ser terminal único, área D/E/F/G/H). Chegada em GRU no mesmo dia (19h50, horário de Brasília) — o horário bate por causa do fuso, não é erro.",
        },
      ],
      seats: "36A e 36B (assento standard, já marcados) — trecho AMS-GRU",
      baggage: "2x bagagem de mão + 2x bolsa pequena por pessoa · 0x bagagem despachada incluída",
      meals: "Refeição a bordo (trecho AMS-GRU) — detalhe do menu ainda não escolhido",
    },
  },
  accommodation: {
    name: "LALA Hôtel",
    address: "3 Rue Darcet, 17º arr., 75017 Paris, França · tel +33 1 85 09 51 40",
    lat: 48.8847, lng: 2.3218,
    metro: "Rome (M2), ~6 min a pé",
    checkin: "2026-09-11",
    checkout: "2026-09-17",
    confirmation: "Booking 6659.656.292 · PIN 1979",
    notes: "Quarto Duplo (acesso mobilidade reduzida), 2 hóspedes, 6 diárias. Sem café da manhã incluído. Cancelamento grátis até 2 dias antes do check-in.",
  },
  accommodation2: {
    name: "Hotel do aeroporto (a confirmar)",
    address: "A definir — região do CDG",
    lat: null, lng: null,
    metro: "",
    checkin: "2026-09-17",
    checkout: "2026-09-18",
    confirmation: "",
    notes: "1 diária pra facilitar o embarque do voo de volta (KLM, 08:15 do dia 18). Ainda falta escolher e reservar — ideal um hotel servido pelo monotrilho gratuito CDGVal, já que é de graça e evita depender de transporte com horário fixo.",
  },
  transportNotes: "",
  documents: DOC_DEFAULTS.map((label) => ({
    id: uid(), label, done: label.startsWith("Chip"),
  })),
};

const EUR_TO_BRL_RATE = 6.266; // aproximado, média ponderada dos três câmbios já feitos (R$ 7.270,01 / €1.160,14)

const defaultBudget = [
  {
    id: uid(), category: "Hospedagem", item: "LALA Hôtel — 6 diárias (11 a 17/09)",
    amount: "5420.61", currency: "BRL", status: "planejado",
    notes: "Booking 6659.656.292. Total aprox. em EUR: € 915,89 pago na acomodação. Reservada, ainda não paga.",
  },
  {
    id: uid(), category: "Hospedagem", item: "Hotel do aeroporto — 1 diária (17 a 18/09)",
    amount: "700.00", currency: "BRL", status: "planejado",
    notes: "Ainda falta escolher e reservar. Ideal um hotel servido pelo monotrilho gratuito CDGVal, pra facilitar o embarque do voo das 08h15.",
  },
  {
    id: uid(), category: "Seguro viagem", item: "Seguro saúde de viagem",
    amount: "500.00", currency: "BRL", status: "planejado",
    notes: "Obrigatório pra entrar no Espaço Schengen — cobertura mínima exigida de € 30.000 em despesas médicas/hospitalares. Ainda falta contratar.",
  },
  {
    id: uid(), category: "Outros", item: "Internet (chip internacional Nubank, 10GB cada)",
    amount: "0", currency: "BRL", status: "pago",
    notes: "Já incluso no plano do Nubank — sem custo extra na viagem.",
  },
  {
    id: uid(), category: "Passagem", item: "Passagem aérea (Air France / KLM)",
    amount: "13317.89", currency: "BRL", status: "planejado",
    notes: "Cobrada na fatura do cartão com vencimento em 03/08. Inclui R$ 881,89 da compra de assentos nos voos (marcados para os dois: 31L/31K no trecho GRU-CDG, 36A/36B no trecho AMS-GRU).",
  },
  {
    id: uid(), category: "Dinheiro disponível", item: "Câmbio — 1º lote (€500)",
    amount: "3161.00", currency: "BRL", eurAmount: "500", status: "pago",
    notes: "Taxa aproximada: R$ 6,32/€. Vira crédito disponível pra gastar na viagem — não conta como gasto até ser usado.",
  },
  {
    id: uid(), category: "Dinheiro disponível", item: "Câmbio — 2º lote (€560,14)",
    amount: "3500.00", currency: "BRL", eurAmount: "560.14", status: "pago",
    notes: "",
  },
  {
    id: uid(), category: "Dinheiro disponível", item: "Câmbio — 3º lote (€100)",
    amount: "609.01", currency: "BRL", eurAmount: "100", status: "pago",
    notes: "",
  },
  {
    id: uid(), category: "Transporte local", item: "Traslado aeroporto — chegada (11/09)",
    amount: "28", currency: "EUR", status: "planejado",
    notes: "RER B (bilhete Île-de-France, €14/pessoa = €28 no total) até Gare du Nord, com baldeação pro metrô linha 2 até a Rome — decidido pela pouca bagagem, sem necessidade de táxi.",
  },
  {
    id: uid(), category: "Transporte local", item: "Bilhetes avulsos (11 a 13/09, antes do Navigo)",
    amount: "40", currency: "EUR", status: "planejado",
    notes: "Estimativa: ~4 viagens/pessoa nesses 3 dias × € 2,55 × 2 pessoas ≈ €20/pessoa. O Navigo Semaine só pode começar numa segunda-feira, então esses 3 dias (sex a dom) precisam ser em bilhete avulso mesmo.",
  },
  {
    id: uid(), category: "Transporte local", item: "Navigo Semaine (14 a 20/09) — 2 pessoas",
    amount: "64.80", currency: "EUR", status: "planejado",
    notes: "€32,40/pessoa (tarifa 2026, todas as zonas, inclui aeroportos). Comprado na segunda 14/09, cobre Paris de segunda a sexta — incluindo a ida pro CDG no dia 18 (volta pro Brasil), sem precisar comprar o bilhete de aeroporto separado (€14) de novo. Compensa: com ~13+ viagens no período (bem provável entre passeios + o traslado final), sai mais barato que bilhete avulso.",
  },
];

const defaultWishlist = [
  {
    id: uid(), item: "Sac cabas M Le Pliage Original", store: "Longchamp", storeAddress: "404 Rue Saint-Honoré, 75001 Paris",
    price: "200.00", currency: "EUR", quantity: 1,
    link: "https://www.longchamp.com/fr/fr/products/sac-cabas-m-L2605089504.html",
    icon: "bag", color: "#8B5E3C",
    notes: "Toile recyclée, cor Cognac, ref. L2605089504 — a bolsa em si custa €125. Orçamento aberto até €200 no total, pra dar espaço de trocar de modelo/cor ou incluir um item extra (carteira, pochette). Já passa dos €100,01 mínimos na mesma loja/dia — dá pra pedir tax free (≈12% de volta). Peça o formulário na hora com o passaporte e valide no aeroporto antes do check-in.",
    alternatives: [
      { name: "Polène", address: "69 Rue de Richelieu, 75002 Paris", notes: "Marca francesa que virou febre nas redes — bolsas estruturadas, mesma faixa de 'luxo acessível' que a Longchamp, só que num design mais minimalista/geométrico." },
      { name: "Le Tanneur", address: "Vários endereços em Paris (marca francesa tradicional de couro)", notes: "Casa francesa de couro bem mais antiga que a Polène, discreta e menos hypada — bom se quiser fugir do que todo mundo tá usando." },
    ],
  },
  {
    id: uid(), item: "Conjunto de talheres configurável (5 peças)", store: "Sabre", storeAddress: "39 Rue de Poitou, 75003 Paris",
    price: "56.00", currency: "EUR", quantity: 2,
    link: "https://br.sabre-paris.com/br/products/produit-configurable-generique",
    icon: "cutlery", color: "#A88856",
    notes: "2 conjuntos de 5 peças a €56 cada = €112 total — dá pra escolher as cores na hora. Também passa dos €100,01 mínimos — tax free (≈12% de volta, ~€13,40), formulário com passaporte na compra e validado no aeroporto.",
    alternatives: [
      { name: "Forge de Laguiole", address: "29 Rue Boissy d'Anglas, 75008 Paris", notes: "A marca francesa de talheres/facas mais tradicional (desde 1829) — visual mais clássico/rústico (cabo de chifre) em vez do colorido moderno da Sabre." },
      { name: "Laguiole en Aubrac", address: "Île Saint-Louis, Paris (perto da Notre-Dame)", notes: "Outra loja da mesma tradição de Laguiole, bem central — dá pra combinar com o passeio de domingo de manhã na Île de la Cité, já que fica ao lado." },
    ],
  },
];

const OUTFIT_IMAGES = {
  skirtColorida: "data:image/jpeg;base64,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",
  sneaker: "data:image/jpeg;base64,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REBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERA/9k=",
  skirtOliva: "data:image/jpeg;base64,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",
  topPreto: "data:image/jpeg;base64,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",
  vestidoPreto: "data:image/jpeg;base64,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",
};

// Regra oficial da Embaixada da França no Brasil (br.ambafrance.org): medicamentos não entorpecentes/
// não psicotrópicos podem ser transportados sem receita para até 3 meses de tratamento; acima disso,
// ou se for entorpecente/psicotrópico, a receita médica é obrigatória.
const MEDICATION_GENERAL_RULE = {
  title: "Regra geral (embaixada da França)",
  text: "Remédio não entorpecente/não psicotrópico: sem receita vale pra até 3 meses de tratamento — como é uma viagem de 1 semana, não seria obrigatório, mas é sempre recomendado levar por segurança. Remédio entorpecente ou psicotrópico: receita médica é sempre obrigatória, não importa a duração.",
};

const MEDICATIONS = [
  {
    id: uid(), name: "Baricitinibe", use: "Uso contínuo — artrite reumatoide",
    prescriptionNeeded: "Recomendado levar receita + laudo médico",
    notes: "Não é entorpecente/psicotrópico, mas por ser uso contínuo de longo prazo (e um medicamento biológico/especializado de alto custo), o mais seguro é levar a receita médica e, se possível, uma carta do médico em inglês ou francês explicando o diagnóstico e a dosagem. Leve na embalagem original, na bagagem de mão.",
  },
  {
    id: uid(), name: "Sertralina", use: "Uso contínuo — depressão",
    prescriptionNeeded: "Recomendado levar receita",
    notes: "Antidepressivo (ISRS) — não é classificado como entorpecente controlado na França, mas por ser uso contínuo vale levar a receita médica por precaução, na embalagem original, na bagagem de mão.",
  },
  {
    id: uid(), name: "Ondansetrona (Ondif)", use: "Enjoo / náusea",
    prescriptionNeeded: "Não obrigatório (viagem curta)",
    notes: "Não entorpecente. Leve só a quantidade necessária pra viagem, de preferência na caixa original.",
  },
  {
    id: uid(), name: "Resfenol", use: "Gripe / resfriado",
    prescriptionNeeded: "Não obrigatório",
    notes: "Venda livre no Brasil, sem substância controlada — não deve ter restrição de entrada na França.",
  },
  {
    id: uid(), name: "Strepsils", use: "Dor de garganta",
    prescriptionNeeded: "Não obrigatório",
    notes: "Pastilha de venda livre, sem nenhuma restrição.",
  },
  {
    id: uid(), name: "Advil (ibuprofeno)", use: "Dor / febre / anti-inflamatório",
    prescriptionNeeded: "Não obrigatório",
    notes: "Analgésico comum, vendido sem receita na maioria dos países, incluindo a França.",
  },
  {
    id: uid(), name: "Esomeprazol", use: "Refluxo / azia",
    prescriptionNeeded: "Não obrigatório (viagem curta)",
    notes: "Inibidor de bomba de prótons, não controlado — leve só a quantidade pra viagem.",
  },
  {
    id: uid(), name: "Luftal (cápsula)", use: "Gases / desconforto abdominal",
    prescriptionNeeded: "Não obrigatório",
    notes: "Simeticona, de venda livre, sem nenhuma restrição.",
  },
];

const SOUVENIR_CATEGORIES = [
  { id: "cha", label: "Chá", forWhom: "Mãe, sogra e cunhada" },
  { id: "chocolate", label: "Chocolate", forWhom: "Amigos" },
  { id: "cafe", label: "Café", forWhom: "Pai" },
  { id: "manteiga", label: "Manteiga", forWhom: "" },
];

const defaultSouvenirs = [
  {
    id: uid(), category: "cha", item: "Mariage Frères", store: "Mariage Frères Le Marais",
    address: "30 Rue du Bourg-Tibourg, 75004 Paris", metro: "Saint-Paul (M1), ~3 min a pé",
    avgPrice: "€14-18 (lata de 100g)",
    notes: "A mais tradicional casa de chá da França (desde 1854) — mais de 800 variedades, vendidas nas latinhas pretas clássicas. Fica no Marais, no mesmo dia da Sabre e dos brechós.",
    link: "https://www.mariagefreres.com", linkLabel: "site oficial",
  },
  {
    id: uid(), category: "cha", item: "Nina's Marie-Antoinette", store: "Nina's Paris (Vendôme)",
    address: "29 Rue Danielle Casanova, 75001 Paris", metro: "Pyramides (M7, M14) ou Opéra, ~5 min a pé",
    avgPrice: "€13-16 (lata de 100g)",
    notes: "Casa de chá com receita histórica de 1672, famosa pelo blend 'Marie-Antoinette' (chá preto com maçã e pétalas de rosa). Fica perto da Place Vendôme, no caminho do dia da Longchamp.",
    link: "https://www.ninasparis.com", linkLabel: "site oficial",
  },
  {
    id: uid(), category: "chocolate", item: "Jacques Genin", store: "Jacques Genin Marais",
    address: "133 Rue de Turenne, 75003 Paris", metro: "Filles du Calvaire (M8), ~5 min a pé",
    avgPrice: "€25-32 (caixa de caramelos/pâtes de fruits)",
    notes: "Um dos chocolatiers mais respeitados de Paris — os caramelos e as pâtes de fruits (balas de fruta) viajam bem e são perfeitos de presente. Nota 4,4/5. Fica no Marais, mesma região da Sabre.",
    link: "https://www.jacquesgenin.fr", linkLabel: "site oficial",
  },
  {
    id: uid(), category: "chocolate", item: "Macarons Ladurée", store: "Ladurée Bonaparte",
    address: "21 Rue Bonaparte, 75006 Paris", metro: "Saint-Germain-des-Prés (M4), ~4 min a pé",
    avgPrice: "€16-17 (caixa de 6)",
    notes: "O macaron mais clássico de Paris, desde 1862 — sabores como pistache, framboesa e caramelo com flor de sal. Essa unidade fica em Saint-Germain, mesma região do GoodJo/Kilo Shop/Luxemburgo. Não dura muito, então é mais pra saborear na viagem do que pra levar de presente.",
    link: "https://laduree.com", linkLabel: "site oficial",
  },
  {
    id: uid(), category: "cafe", item: "Grãos de café torrados", store: "Terres de Café (Batignolles)",
    address: "33 Rue des Batignolles, 75017 Paris", metro: "Rome (M2), ~5 min a pé",
    avgPrice: "€9-12 (pacote de 250g)",
    notes: "Torrefação especializada pertinho do hotel — já está na aba Alimentação como opção de café rápido, mas também vende grãos/pacotes fechados, ótimo pra levar de presente.",
    link: null, linkLabel: null,
  },
  {
    id: uid(), category: "manteiga", item: "Beurre Bordier", store: "La Grande Épicerie de Paris",
    address: "38 Rue de Sèvres, 75007 Paris", metro: "Sèvres-Babylone (M10, M12), na saída",
    avgPrice: "€4-6 (peça de 125-250g)",
    notes: "Considerada uma das melhores manteigas da França/do mundo. A Grande Épicerie faz embalagem a vácuo na hora — essencial pra sobreviver à viagem de volta ao Brasil. Sabores: tradicional, sal defumado, trufa, baunilha.",
    link: null, linkLabel: null,
  },
  {
    id: uid(), category: "manteiga", item: "Beurre Bordier (alternativa no Marais)", store: "L'Épicerie Breizh Café",
    address: "111 Rue Vieille du Temple, 75003 Paris", metro: "Saint-Sébastien – Froissart (M8), ~3 min a pé",
    avgPrice: "€4-6 (peça de 125-250g)",
    notes: "Mesma manteiga Bordier, só que sem sair do Marais — dá pra pegar no mesmo dia da Sabre/brechós/Jacques Genin, sem precisar ir até o 7º.",
    link: null, linkLabel: null,
  },
];

const defaultOutfits = [
  {
    id: uid(), occasion: "Passeio de dia — versão colorida",
    images: [
      { url: OUTFIT_IMAGES.skirtColorida, label: "saia estampada" },
      { url: OUTFIT_IMAGES.topPreto, label: "regata preta" },
      { url: OUTFIT_IMAGES.sneaker, label: "New Balance" },
    ],
    pieces: "Saia midi plissada estampada (rosa, laranja, preto e off-white), regata preta gola alta, tênis New Balance bege suede",
    weather: "ameno",
    notes: "Estampa chama atenção sozinha — deixa o resto neutro (regata lisa + tênis bege) pra não competir. Boa pra dias de bastante caminhada, tipo Marais ou parques.",
  },
  {
    id: uid(), occasion: "Passeio de dia — versão neutra",
    images: [
      { url: OUTFIT_IMAGES.skirtOliva, label: "saia verde-oliva" },
      { url: OUTFIT_IMAGES.topPreto, label: "regata preta" },
      { url: OUTFIT_IMAGES.sneaker, label: "New Balance" },
    ],
    pieces: "Saia midi evasê verde-oliva, regata preta gola alta, tênis New Balance bege suede",
    weather: "ameno",
    notes: "Alternativa mais discreta pro mesmo top e tênis — troca a saia estampada pela lisa quando quiser um visual mais monocromático/autumn.",
  },
  {
    id: uid(), occasion: "Jantar / noite",
    images: [
      { url: OUTFIT_IMAGES.vestidoPreto, label: "vestido preto" },
    ],
    pieces: "Vestido preto midi decote canoa, sandália rasteira preta",
    weather: "ameno",
    notes: "Peça coringa — resolve um jantar mais arrumado (tipo Breizh Café ou Café Pli à noite) sem precisar levar muita coisa na mala. Dá pra variar com um casaco leve por cima nas noites mais frescas.",
  },
];

const FOOD_CATEGORIES = [
  { id: "rapida", label: "Refeição rápida" },
  { id: "restaurante", label: "Restaurante" },
  { id: "mercado", label: "Mercado" },
];

const defaultFood = [
  {
    id: uid(), name: "Café Dose Paris • Batignolles", category: "rapida",
    address: "82 Place du Dr Félix Lobligeois, 75017 Paris", walkMinutes: 6,
    priceRange: "$$", vegetarian: "Sim — pastelaria vegan e sem glúten disponível",
    hours: "Ter-Sex 8h-20h · Sáb-Dom 9h-19h · Fecha segunda",
    payment: "Cartão (Visa/Mastercard) e dinheiro",
    rating: 4.7,
    link: "https://dose.paris/en/pages/cafe-de-quartier/dose-batignolles",
    linkLabel: "site oficial",
    notes: "Coffee shop torrefador, ótimo pro café da manhã — ovos mexidos, pancakes com abacate, croissants. Costuma encher no brunch de fim de semana.",
  },
  {
    id: uid(), name: "Café Joyeux Batignolles", category: "rapida",
    address: "68 Place du Dr Félix Lobligeois, 75017 Paris", walkMinutes: 6,
    priceRange: "$", vegetarian: "Sim — opção vegetariana no cardápio",
    hours: "Todos os dias, 9h-19h",
    payment: "Cartão e dinheiro (padrão)",
    rating: 4.9,
    link: "https://www.cafejoyeux.com/fr/content/97-cafe-joyeux-paris-batignolles",
    linkLabel: "site oficial",
    notes: "Café inclusivo (equipe com deficiência intelectual) — croque-monsieur, quiches, saladas. Bom pra um lanche rápido sem reserva, foco em pegar pra viagem.",
  },
  {
    id: uid(), name: "Breizh Café Batignolles", category: "restaurante",
    address: "31 Rue des Batignolles, 75017 Paris", walkMinutes: 8,
    priceRange: "$$", vegetarian: "Sim — galette de cogumelos com Comté",
    hours: "Todos os dias, almoço e jantar",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.breizhcafe.com/batignolles",
    linkLabel: "site oficial / cardápio",
    notes: "Creperia bretã com ingredientes orgânicos — galettes de trigo sarraceno (€6-18,50), menu almoço €19 até 15h. Boa opção pro jantar do dia 11.",
  },
  {
    id: uid(), name: "Marché biologique des Batignolles", category: "mercado",
    address: "Terre-plein do Boulevard des Batignolles, 75017 Paris", walkMinutes: 8,
    priceRange: "$$", vegetarian: "Sim — feira de produtos frescos e orgânicos",
    hours: "Sábados, aprox. 9h-14h",
    payment: "Majoritariamente dinheiro — alguns produtores aceitam cartão",
    rating: null,
    link: "https://www.paris.fr/lieux/marche-biologique-des-batignolles-4514",
    linkLabel: "página oficial (Ville de Paris)",
    notes: "Feira orgânica ao ar livre, boa pra frutas, queijos e um lanche fresco no sábado de manhã.",
  },
  {
    id: uid(), name: "Monoprix (Place de Clichy)", category: "mercado",
    address: "Place de Clichy, 75017/75008 Paris", walkMinutes: 10,
    priceRange: "$", vegetarian: "Sim — amplo sortimento de opções vegetarianas/veganas",
    hours: "Seg-Sáb ~9h-22h (alguns domingos até 13h)",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.monoprix.fr",
    linkLabel: "site oficial",
    notes: "Supermercado completo — bom pra água, lanches e itens de necessidade básica sem precisar sair do bairro.",
  },
  {
    id: uid(), name: "Pret A Manger (Batignolles)", category: "rapida",
    address: "39 Rue Mstislav Rostropovitch, 75017 Paris", walkMinutes: 15,
    priceRange: "$", vegetarian: "Sim — linha veggie/vegan bem variada (sanduíches, saladas, wraps)",
    hours: "Geralmente 7h-20h em dias úteis, horário reduzido no fim de semana (confirmar no local)",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.pretamanger.fr/fr-FR/shop-finder/l/paris/39-rue-mstislav-rostropovitch/10716",
    linkLabel: "site oficial",
    notes: "Rede prática pra um café da manhã ou almoço rápido sem escolher muito — fica no Parc Clichy-Batignolles, um pouco mais longe que os outros mas no caminho de quem for passear por ali.",
  },
  {
    id: uid(), name: "Hank Burger (vegano)", category: "rapida",
    address: "55 Rue des Archives, 75003 Paris", walkMinutes: null,
    priceRange: "$$", vegetarian: "100% vegano — burgers, nuggets e milkshakes plant-based",
    hours: "Todos os dias, 11h45-22h (sex/sáb até 22h30)",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.hank-burger.com",
    linkLabel: "site oficial",
    notes: "Fast-food vegano de verdade — pede no balcão e recebe rápido, sem precisar de garçom. Fica no Marais, pertinho da Alatone e do metrô Rambuteau — dá pra encaixar no dia do Marais.",
  },
  {
    id: uid(), name: "L'As du Fallafel", category: "rapida",
    address: "34 Rue des Rosiers, 75004 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Sim — o falafel clássico já é vegetariano por padrão, com molho picante vegano",
    hours: "Dom-Qui 11h-0h · Sex 11h-17h · Fechado aos sábados (kosher)",
    payment: "Cartão e dinheiro",
    rating: 4.3,
    link: "https://en.wikipedia.org/wiki/L%27As_du_Fallafel",
    linkLabel: "mais informações",
    notes: "O falafel mais famoso de Paris, no coração do Marais — pede na janelinha de takeaway (fura fila menor que o salão) e come sentado numa praça pertinho. Fechado sábado, mas está aberto no domingo do seu roteiro do Marais.",
  },
  {
    id: uid(), name: "Crêperie des Arts", category: "restaurante",
    address: "27 Rue Saint-André des Arts, 75006 Paris", walkMinutes: null,
    priceRange: "$$", vegetarian: "Sim — galette customizável (troca recheio), opção sem lactose; vegano não confirmado",
    hours: "Todos os dias (confirmar horário exato no local)",
    payment: "Cartão e dinheiro",
    rating: null,
    link: null, linkLabel: null,
    notes: "Creperia clássica perto de Saint-Michel/Notre-Dame — boa opção de almoço no dia do passeio 'Before Sunset', já que fica no mesmo bairro do Shakespeare and Company.",
  },
  {
    id: uid(), name: "All'Antico Vinaio", category: "rapida",
    address: "3 Rue du Petit Pont, 75005 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Opções vegetarianas limitadas no cardápio (maioria dos schiacciate leva presunto/embutidos) — vegano não confirmado",
    hours: "Todos os dias, 10h-22h",
    payment: "Cartão e dinheiro",
    rating: 4.8,
    link: "https://www.allanticovinaio.com/parigi/",
    linkLabel: "site oficial",
    notes: "Sanduíches florentinos (schiacciata) famosos — pede no balcão, bem rápido. Fica perto de Notre-Dame, no Quartier Latin.",
  },
  {
    id: uid(), name: "Tora Tora (onigiri)", category: "rapida",
    address: "1 Rue Villedo, 75001 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Sim — 8 das 17 variedades de onigiri são veggie",
    hours: "Ter-Sáb 11h30-17h · Dom 11h30-16h · Fechado segunda",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://onigiri-toratora.com/",
    linkLabel: "site oficial",
    notes: "Comptoir de onigiri (bolinho de arroz japonês) pra viagem, do chef do Kunitoraya — pede e sai andando, sem mesa. Fica perto do Palais-Royal/Louvre, bom pro dia da Longchamp.",
  },
  {
    id: uid(), name: "Jay's Pizza (fatia NY-style)", category: "rapida",
    address: "20 Rue de Mazagran, 75010 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Sim — a fatia Classique (queijo) é vegetariana; vegano não disponível",
    hours: "Fechado aos domingos (demais dias, confirmar horário no local)",
    payment: "Cartão e dinheiro",
    rating: null,
    link: null, linkLabel: null,
    notes: "Comptoir de pizza no estilo Nova York, vendida à fatia (€3,90-5) — pede e come na rua ou sentado, sem garçom. Fica no 10º, perto da região do Café Pli.",
  },
  {
    id: uid(), name: "La Sabicherie (sabich)", category: "rapida",
    address: "33 Rue du Faubourg Saint-Antoine, 75011 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Sim — o sabich (berinjela, hummus, ovo cozido, batata assada) é vegetariano por padrão",
    hours: "Todos os dias, ~11h-21h30/22h",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.lasabicherie.com/",
    linkLabel: "site oficial",
    notes: "Street food israelense especializada no sabich, sanduíche tradicional judaico-iraquiano — pede no balcão, é rápido e dá pra levar pra comer sentado numa praça por perto. Tem uma segunda unidade em 6 Rue Notre-Dame de Lorette, 75009.",
  },
  {
    id: uid(), name: "Junk Burgers (smash burger)", category: "rapida",
    address: "4 Rue de l'Ancienne Comédie, 75006 Paris", walkMinutes: null,
    priceRange: "$", vegetarian: "Sim — opção de burger vegano no cardápio",
    hours: "Todos os dias, 12h-22h30",
    payment: "Cartão e dinheiro",
    rating: null,
    link: "https://www.junkburgers.com/en/nosadresses",
    linkLabel: "site oficial",
    notes: "Smash burger sem frescura — só pão brioche, carne, queijo e molho da casa, do tamanho S ao XXL. Pede no balcão, sem garçom. Essa unidade fica perto do Odéon, mesma região do GoodJo/Kilo Shop/Luxemburgo (terça-feira).",
  },
];

// Números de emergência e recursos de saúde válidos para toda a viagem.
const EMERGENCY_NUMBERS = [
  { label: "Emergência médica (SAMU)", value: "15" },
  { label: "Emergência europeia (geral)", value: "112" },
  { label: "Polícia", value: "17" },
  { label: "Bombeiros", value: "18" },
  { label: "SOS Médecins (médico a domicílio, 24h)", value: "01 47 07 77 77" },
];

const BRAZIL_CONSULATE = {
  name: "Consulado-Geral do Brasil em Paris",
  address: "65 Avenue Franklin Delano Roosevelt, 75008 Paris",
  metro: "Saint-Philippe-du-Roule (M9), ~2 min a pé",
  emergencyPhone: "+33 6 80 80 96 78",
  emergencyNote: "Plantão 24h — só pra emergências graves e comprovadas (perda de passaporte, prisão, hospitalização, óbito).",
  email: "assistencia.cgparis@itamaraty.gov.br",
  emailHours: "Seg-Sex, 10h-16h",
};

const PHARMACIES = [
  {
    id: uid(), name: "Pharmacie Européenne", zone: "Perto do hotel (Batignolles/Clichy)",
    address: "6 Place de Clichy, 75017/75008 Paris", walkMinutes: 7,
    hours: "Aberta 24h/24, 7 dias por semana", notes: "A mais prática pra qualquer imprevisto de madrugada — fica bem na Place de Clichy.",
  },
  {
    id: uid(), name: "Pharmacie Les Champs", zone: "Perto de Concorde/Louvre",
    address: "84 Avenue des Champs-Élysées, 75008 Paris", walkMinutes: null,
    hours: "Aberta 24h/24, 7 dias por semana", notes: "Boa opção no dia da Torre Eiffel/Louvre/Longchamp — fica na região.",
  },
  {
    id: uid(), name: "La Pharmacie de la Place République", zone: "Perto do Café Pli / Canal Saint-Martin",
    address: "Place de la République, 75011 Paris", walkMinutes: null,
    hours: "Horário comercial (confirmar no local/Google Maps)", notes: "A mais próxima do Café Pli e do passeio pelo Canal Saint-Martin.",
  },
  {
    id: uid(), name: "Farmácias no Marais", zone: "Marais (Sabre / brechós)",
    address: "Procure a cruz verde nas ruas do Marais (concentração perto da Rue de Rivoli/BHV)", walkMinutes: null,
    hours: "Varia por farmácia", notes: "Não achei uma unidade específica confirmada — no Marais é fácil achar uma farmácia com o símbolo da cruz verde a poucos passos de qualquer rua principal.",
  },
];

const HOSPITALS = [
  {
    id: uid(), name: "Hôtel-Dieu", zone: "Central (Louvre/Marais)",
    address: "1 Place du Parvis Notre-Dame, 75004 Paris", phone: "01 42 34 82 32",
    notes: "Hospital público com pronto-socorro (urgências) — o mais central, bom pra quem estiver na região do Louvre ou do Marais.",
  },
  {
    id: uid(), name: "Saint-Louis", zone: "Perto do Café Pli / Canal Saint-Martin",
    address: "1 Avenue Claude-Vellefaux, 75010 Paris", phone: "01 42 49 91 17",
    notes: "Hospital público com urgências, bem perto da região do 11º/Canal Saint-Martin.",
  },
  {
    id: uid(), name: "Bichat — Claude-Bernard", zone: "Perto do hotel (17º)",
    address: "46 Rue Henri-Huchard, 75018 Paris", phone: "01 40 25 80 80",
    notes: "Hospital público com urgências, o mais próximo do hotel.",
  },
  {
    id: uid(), name: "American Hospital of Paris (privado)", zone: "Referência em inglês",
    address: "63 Boulevard Victor Hugo, 92200 Neuilly-sur-Seine", phone: "01 46 41 25 25",
    notes: "Hospital privado com atendimento em inglês e fila geralmente mais curta — bom se o seguro viagem cobrir rede privada. Fica a oeste do hotel.",
  },
];

const SECTOR_BATHROOM_TIPS = {
  "Marais (3e/4e)": "BHV Marais (52 Rue de Rivoli) tem banheiro público gratuito; o Centre Pompidou também, no térreo.",
  "Louvre / Tuileries (1er)": "Banheiros pagos (~€0,50) dentro do Jardim des Tuileries; ou entre em alguma loja/departamento como a Printemps Haussmann.",
  "République / Canal Saint-Martin (11e)": "Sendo cliente do Café Pli já resolve; senão, tem um McDonald's perto da Place de la République.",
  "Batignolles / Clichy (17e)": "Qualquer café perto do hotel resolve.",
  "Montmartre (18e)": "Sendo cliente do Café des Deux Moulins já resolve; também tem banheiro público perto do carrossel, aos pés do Sacré-Cœur.",
  "Torre Eiffel / Champ de Mars (7e)": "Banheiros públicos no próprio Champ de Mars (perto do carrossel) e no Trocadéro, do outro lado do rio.",
  "Saint-Germain / Luxembourg (6e)": "O Jardin du Luxembourg tem banheiros públicos gratuitos espalhados pelo parque.",
  "Giverny (fora de Paris)": "Tem banheiro na própria Fondation Claude Monet e nos cafés/restaurantes do centrinho de Giverny.",
};

const defaultItinerary = [
  {
    id: uid(), date: "2026-09-11", time: "11:55", title: "Pouso em CDG", type: "transporte",
    address: "Aéroport Paris-Charles de Gaulle, 95700 Roissy-en-France", lat: 49.0097, lng: 2.5479,
    metro: "",
    costAmount: "", costCurrency: "EUR", notes: "Voo Air France 459, chegando de Guarulhos.",
  },
  {
    id: uid(), date: "2026-09-11", time: "12:35", title: "Traslado até o hotel (RER B + metrô)", type: "transporte",
    address: "", lat: null, lng: null, metro: "RER B até Gare du Nord, baldeia pro M2 até a Rome",
    costAmount: "28", costCurrency: "EUR", notes: "RER B (€14/pessoa) até Gare du Nord, depois metrô linha 2 até a Rome — ~60-75 min no total com a baldeação. Decidido por causa da pouca bagagem, sem precisar de táxi.",
  },
  {
    id: uid(), date: "2026-09-11", time: "13:45", title: "Check-in / deixar as malas no LALA Hôtel", type: "hospedagem",
    address: "3 Rue Darcet, 17º arr., 75017 Paris", lat: 48.8847, lng: 2.3218,
    metro: "Rome (M2), ~6 min a pé",
    costAmount: "", costCurrency: "EUR", notes: "Chegada oficial do check-in é dia 11/09. Aproveite pra descansar um pouco da viagem.",
  },
  {
    id: uid(), date: "2026-09-11", time: "14:00", title: "Almoço na Breizh Café Batignolles", type: "restaurante",
    address: "31 Rue des Batignolles, 75017 Paris", lat: 48.8837, lng: 2.3226,
    metro: "Rome (M2), ~5 min a pé",
    costAmount: "20", costCurrency: "EUR",
    notes: "Pertinho do hotel — galette de trigo sarraceno pro primeiro almoço em Paris, sem precisar ir longe logo depois da viagem.",
  },
  {
    id: uid(), date: "2026-09-11", time: "16:00", title: "Passeio pela Montmartre de Amélie Poulain", type: "passeio",
    address: "Rue Lepic / Rue des Trois Frères, 75018 Paris", lat: 48.8859, lng: 2.3355,
    metro: "Abbesses (M12), ~15 min a pé do hotel ou 2 paradas de metrô",
    costAmount: "0", costCurrency: "EUR",
    notes: "Montmartre fica pertinho do hotel, então dá pra fazer essa tarde mesmo se não estiver cansada demais (senão, é só remarcar pra outro dia). Roteiro: Café des Deux Moulins (15 Rue Lepic — onde a Amélie trabalhava, peça a crème brûlée), Marché de la Butte / Maison Collignon (56 Rue des Trois Frères — a mercearia do filme), e a estação Abbesses com a entrada art nouveau. Termina com a subida até o Sacré-Cœur pra ver o pôr do sol.",
  },
  {
    id: uid(), date: "2026-09-11", time: "18:00", title: "Cabine de fotos instantâneas (Fotoautomat)", type: "passeio",
    address: "53 Rue des Trois Frères, 75018 Paris", lat: 48.8853, lng: 2.3407,
    metro: "Abbesses (M12), ~2 min a pé",
    costAmount: "6", costCurrency: "EUR",
    notes: "A cabine analógica de verdade que aparece no filme Amélie Poulain — fotos em preto e branco, €6 a tira de 4 poses (aceita moedas de €1/€2 e cartão contactless). Costuma ter fila nos fins de semana à tarde/noite, então talvez valha ir antes do Sacré-Cœur.",
  },
  {
    id: uid(), date: "2026-09-11", time: "19:30", title: "Jantar em Montmartre", type: "restaurante",
    address: "Rue des Trois Frères, 75018 Paris", lat: 48.885, lng: 2.3405,
    metro: "Abbesses (M12), ~2 min a pé",
    costAmount: "25", costCurrency: "EUR",
    notes: "Jantar leve e sem pressa depois da cabine de fotos — sem sair da região, já que ainda é o primeiro dia e o cansaço da viagem pode pesar.",
  },
  {
    id: uid(), date: "2026-09-11", time: "21:00", title: "Monoprix (compras pra manhã)", type: "compras",
    address: "Place de Clichy, 75017/75008 Paris", lat: 48.8830, lng: 2.3273,
    metro: "Place de Clichy (M2, M13), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Passa antes de voltar pro hotel pra comprar pão, fruta e algo pra beber — amanhã sai muito cedo (6h) e nenhum café vai estar aberto ainda.",
  },
  {
    id: uid(), date: "", time: "", title: "Pret A Manger", type: "restaurante",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "", costCurrency: "EUR", notes: "",
  },
  {
    id: uid(), date: "2026-09-15", time: "10:00", title: "Café da manhã perto do Canal Saint-Martin", type: "restaurante",
    address: "Rue du Faubourg du Temple, 75011 Paris", lat: 48.868, lng: 2.3665,
    metro: "Goncourt (M11), ~3 min a pé",
    costAmount: "12", costCurrency: "EUR",
    notes: "Qualquer padaria/café pela região resolve antes do Café Pli — o Canal Saint-Martin tem bastante opção de boulangerie.",
  },
  {
    id: uid(), date: "2026-09-15", time: "11:00", title: "Café Pli", type: "passeio",
    address: "38 Rue du Faubourg du Temple, 75011 Paris", lat: 48.8676, lng: 2.3702,
    metro: "Goncourt (M11), ~3 min a pé",
    costAmount: "15", costCurrency: "EUR",
    notes: "Escrever uma carta para receber daqui 1, 5 ou 10 anos. Pacote de 1 ano ≈ €15 (bebida incluída); 5 anos ≈ €25. Fica no 11º, perto do Canal Saint-Martin.",
  },
  {
    id: uid(), date: "2026-09-15", time: "12:00", title: "Comprar lanche na Liberté (padaria)", type: "restaurante",
    address: "39 Rue des Vinaigriers, 75010 Paris", lat: 48.8712, lng: 2.3618,
    metro: "Jacques Bonsergent (M5) ou Gare de l'Est, ~5 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Padaria renomada bem perto do Canal Saint-Martin — pegue pães, sanduíches e doces aqui pra guardar pro piquenique no Jardim de Luxemburgo mais tarde. Saia até 12h15 — são uns 25-30 min de metrô até lá (linha 5 + baldeação), então não dá pra enrolar muito aqui.",
  },
  {
    id: uid(), date: "2026-09-14", time: "13:00", title: "Almoço no Jardim des Tuileries", type: "restaurante",
    address: "Jardin des Tuileries, 75001 Paris", lat: 48.8635, lng: 2.3275,
    metro: "Tuileries (M1), na entrada do jardim",
    costAmount: "15", costCurrency: "EUR",
    notes: "Tem um Paul (padaria) dentro do próprio jardim — bom almoço leve antes de seguir pra Longchamp, que é pertinho.",
  },
  {
    id: uid(), date: "2026-09-14", time: "14:00", title: "Longchamp", type: "compras",
    address: "404 Rue Saint-Honoré, 75001 Paris", lat: 48.8666, lng: 2.3272,
    metro: "Concorde (M1, M8, M12), ~3 min a pé",
    costAmount: "200", costCurrency: "EUR",
    notes: "Flagship no 1º arr. (404 rue Saint-Honoré) — a maior loja da marca no mundo. Outras opções: 21 Rue du Vieux Colombier, 75006 (Saint-Germain) e 77 Av. des Champs-Élysées, 75008. Modelo escolhido: Sac cabas M Le Pliage Original, toile recyclée cor Cognac, ref. L2605089504, € 125 — https://www.longchamp.com/fr/fr/products/sac-cabas-m-L2605089504.html. Orçamento aberto até €200, com espaço pra trocar de modelo ou incluir carteira/pochette. Outras boas pedidas: carteiras e pochettes Le Pliage (mais em conta que a bolsa, ótimas de presente) e a linha Le Pliage Cuir (versão em couro, mais sofisticada). Tax free: sozinha já passa dos € 100,01 mínimos numa mesma loja/dia, então dá pra pedir a détaxe (≈12% de volta) — peça o formulário na hora com o passaporte e valide no aeroporto antes do check-in.",
  },
  {
    id: uid(), date: "2026-09-14", time: "15:30", title: "Opéra Garnier (área externa)", type: "passeio",
    address: "Place de l'Opéra, 75009 Paris", lat: 48.8719, lng: 2.3316,
    metro: "Opéra (M3, M7, M8), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a fachada suntuosa do teatro — sem entrar (ingresso pago). Fica a uns 10-15 min a pé da Longchamp, pela Rue de la Paix/Place Vendôme.",
  },
  {
    id: uid(), date: "2026-09-14", time: "18:15", title: "Jantar no Le Progrès (Montmartre)", type: "restaurante",
    address: "7 Rue des Trois Frères, 75018 Paris", lat: 48.8852, lng: 2.3406,
    metro: "Abbesses (M12), ~2 min a pé",
    costAmount: "50", costCurrency: "EUR",
    notes: "O jantar intimista da viagem — bistrô tradicional parisiense de verdade (nota 9/10), na mesma rua da cabine de fotos que vocês já visitaram no primeiro dia. Apesar de perto do Sacré-Cœur, não é armadilha turística — é frequentado por gente do bairro. Saída da Opéra Garnier ~16h para chegar com folga (uns 25-30 min de metrô).",
  },
  {
    id: uid(), date: "2026-09-14", time: "20:00", title: "Monoprix (compras pra manhã)", type: "compras",
    address: "Place de Clichy, 75017/75008 Paris", lat: 48.883, lng: 2.3273,
    metro: "Place de Clichy (M2, M13), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Passa antes de voltar pro hotel pra ter café/pão/fruta prontos amanhã de manhã.",
  },
  {
    id: uid(), date: "2026-09-13", time: "15:30", title: "Free'p'Star", type: "compras",
    address: "61 Rue de la Verrerie, 75004 Paris", lat: 48.858, lng: 2.355,
    metro: "Hôtel de Ville (M1, M11), ~2 min a pé",
    costAmount: "", costCurrency: "EUR",
    notes: "Vintage/segunda mão do Marais. Boas pedidas: jaquetas jeans e de couro (bem precificadas), camisetas de banda originais, e peças esportivas retrô (corta-ventos, moletons). Outras opções na região: Kilo Shop (vende por peso). Vintage de grife: Thanx God I'm a V.I.P (12 Rue de Lancry, 75010). Mais em conta: Guerrisol (21 Blvd Marguerite de Rochechouart, 75009).",
  },
  {
    id: uid(), date: "2026-09-13", time: "16:30", title: "Uniqlo Marais", type: "compras",
    address: "39 Rue des Francs-Bourgeois, 75004 Paris", lat: 48.8578, lng: 2.3608,
    metro: "Saint-Paul (M1), ~2 min a pé",
    costAmount: "", costCurrency: "EUR",
    notes: "Loja de 3 andares numa antiga fábrica do século 19 (Usine des Cendres) — uma das maiores Uniqlo de Paris, pertinho da Place des Vosges. Boas pedidas: linha Heattech (camisetas/leggings térmicas, ótimas pra levar de volta pro frio do Brasil), jaqueta ultra-light dobrável, e as camisetas UT com estampas exclusivas de Paris. Aberta domingo das 10h às 20h, então fecha bem o resto da tarde no Marais.",
  },
  {
    id: uid(), date: "2026-09-13", time: "17:00", title: "Muji Marais", type: "compras",
    address: "47 Rue des Francs-Bourgeois, 75004 Paris", lat: 48.858, lng: 2.361,
    metro: "Saint-Paul (M1), ~2 min a pé",
    costAmount: "", costCurrency: "EUR",
    notes: "Bem do lado da Uniqlo, mesma rua — papelaria japonesa, roupas básicas, itens de casa e organização, bons pra presente. Boas pedidas: nécessaires e organizadores de viagem em nylon, canetas/cadernos de papelaria, e o difusor de aromas compacto. A loja do Marais também abre aos domingos.",
  },
  {
    id: uid(), date: "2026-09-13", time: "17:45", title: "Monoprix Beaubourg (compras pra manhã)", type: "compras",
    address: "71 Rue Rambuteau, 75004 Paris", lat: 48.8608, lng: 2.3517,
    metro: "Rambuteau (M11), ~2 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Passa aqui antes de voltar pro hotel pra ter café/pão/fruta prontos amanhã de manhã (segunda começa tranquilo, mas nunca custa ter algo em mãos).",
  },
  {
    id: uid(), date: "2026-09-13", time: "18:30", title: "Jantar na Breizh Café (Marais)", type: "restaurante",
    address: "109 Rue Vieille du Temple, 75003 Paris", lat: 48.8611, lng: 2.3635,
    metro: "Saint-Sébastien – Froissart (M8), ~3 min a pé",
    costAmount: "25", costCurrency: "EUR",
    notes: "A unidade original da rede, ali onde vocês já passaram pra provar a manteiga Bordier — fecha o domingo com um jantar de galettes sem precisar ir mais longe.",
  },
  {
    id: uid(), date: "2026-09-14", time: "09:30", title: "Comprar lanche na Café Dose", type: "restaurante",
    address: "82 Place du Dr Félix Lobligeois, 75017 Paris", lat: 48.8869, lng: 2.3223,
    metro: "Rome (M2), ~5 min a pé",
    costAmount: "12", costCurrency: "EUR",
  },
  {
    id: uid(), date: "2026-09-14", time: "10:00", title: "Parc Monceau (piquenique)", type: "passeio",
    address: "35 Boulevard de Courcelles, 75008 Paris", lat: 48.8797, lng: 2.3095,
    metro: "Monceau (M2), na entrada do parque",
    costAmount: "0", costCurrency: "EUR",
    notes: "Parque elegante com arquitetura clássica (colunata, pirâmide, pontezinha). Piquenique logo na chegada, com o lanche já comprado na Café Dose, e depois uma caminhada tranquila pelo parque.",
  },
  {
    id: uid(), date: "2026-09-13", time: "06:30", title: "Louvre (área externa)", type: "passeio",
    address: "Musée du Louvre, Cour Napoléon, 75001 Paris", lat: 48.8606, lng: 2.3376,
    metro: "Palais Royal – Musée du Louvre (M1, M7), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só o pátio e a pirâmide de vidro — sem entrar no museu. Chegando 6h30 dá pra fotografar completamente sozinha, bem antes de qualquer grupo de turista aparecer.",
  },
  {
    id: uid(), date: "2026-09-13", time: "07:15", title: "Notre-Dame / Île de la Cité (área externa)", type: "passeio",
    address: "Parvis Notre-Dame – Place Jean-Paul II, 75004 Paris", lat: 48.853, lng: 2.3499,
    metro: "Cité (M4) ou Saint-Michel Notre-Dame (RER B/C), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Direto do Louvre a pé (~15-20 min) ou de metrô — fotos da fachada e da Île de la Cité sem gente, antes da Shakespeare and Company abrir (10h).",
  },
  {
    id: uid(), date: "2026-09-13", time: "08:00", title: "Café da manhã no Quartier Latin", type: "restaurante",
    address: "Rue Saint-Jacques / Rue de la Huchette, 75005 Paris", lat: 48.8517, lng: 2.3459,
    metro: "Saint-Michel (M4), ~3 min a pé",
    costAmount: "12", costCurrency: "EUR",
    notes: "Qualquer padaria por ali resolve, antes de seguir pra Shakespeare and Company às 10h — dá tempo de comer com calma vendo o movimento do Quartier Latin acordar.",
  },
  {
    id: uid(), date: "2026-09-13", time: "10:00", title: "Shakespeare and Company", type: "passeio",
    address: "37 Rue de la Bûcherie, 75005 Paris", lat: 48.8523, lng: 2.347,
    metro: "Saint-Michel (M4) ou Cluny-La Sorbonne (M10), ~5 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Livraria icônica em frente à Notre-Dame — é onde Jesse e Céline se reencontram em 'Before Sunset' (também aparece em 'Midnight in Paris'). Dá pra folhear livros e tomar um café ao lado antes de seguir pro Marais.",
  },
  {
    id: uid(), date: "2026-09-13", time: "11:00", title: "Caminhada \"Before Sunset\" até o Marais", type: "passeio",
    address: "Rue Saint-Julien le Pauvre → Rue Galande → Rue des Jardins Saint-Paul → Rue Saint-Paul, 75004 Paris", lat: 48.8541, lng: 2.3564,
    metro: "Saint-Paul (M1), ~2 min a pé no final do trajeto",
    costAmount: "0", costCurrency: "EUR",
    notes: "Refaz o passeio de Jesse e Céline no filme: saindo da livraria, pega a Rue Saint-Julien le Pauvre, depois Rue Galande, atravessa o Sena e segue por Rue des Jardins Saint-Paul e Rue Charlemagne até a Rue Saint-Paul — termina bem na entrada do Marais, a tempo pra Sabre e os brechós à tarde.",
  },
  {
    id: uid(), date: "2026-09-13", time: "11:45", title: "Centre Pompidou (área externa)", type: "passeio",
    address: "Place Georges-Pompidou, 75004 Paris", lat: 48.8607, lng: 2.3522,
    metro: "Rambuteau (M11), ~2 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a fachada industrial (tubulações coloridas por fora) — sem entrar no museu. Fica pertinho da Alatone e do resto do roteiro do Marais. Saia até 12h — é só uns 5-8 min a pé até o L'As du Fallafel.",
  },
  {
    id: uid(), date: "2026-09-13", time: "12:00", title: "Almoço no L'As du Fallafel", type: "restaurante",
    address: "34 Rue des Rosiers, 75004 Paris", lat: 48.8572, lng: 2.3591,
    metro: "Saint-Paul (M1), ~4 min a pé",
    costAmount: "8", costCurrency: "EUR",
    notes: "O falafel mais famoso de Paris — pede na janela de takeaway e come sentado numa praça por perto, rapidinho antes das compras da tarde (ver aba Alimentação pros detalhes).",
  },
  {
    id: uid(), date: "2026-09-13", time: "12:30", title: "Alatone", type: "compras",
    address: "96 Rue Rambuteau, 75001 Paris", lat: 48.862, lng: 2.3495,
    metro: "Rambuteau (M11), na porta",
    costAmount: "", costCurrency: "EUR",
    notes: "Fica entre Les Halles e o Marais — cai bem no caminho entre a caminhada de 'Before Sunset' e a Sabre/brechós da tarde. Boas pedidas: peças curadas de grife (costuma ter seleção mais garimpada que os brechós por peso) e acessórios vintage (cintos, bolsas pequenas).",
  },
  {
    id: uid(), date: "2026-09-13", time: "13:30", title: "Sabre", type: "compras",
    address: "39 Rue de Poitou, 75003 Paris", lat: 48.8631, lng: 2.3641,
    metro: "Filles du Calvaire (M8), ~5 min a pé",
    costAmount: "112", costCurrency: "EUR",
    notes: "Boutique no Marais (39 Rue de Poitou) — dá pra montar um jogo customizado na hora, escolhendo as cores. 2 conjuntos configuráveis (5 peças cada) a € 56 cada = € 112 — https://br.sabre-paris.com/br/products/produit-configurable-generique. Outras boas pedidas: talher avulso pra presente (mais barato que o conjunto fechado) e a linha de utensílios de cozinha (espátulas, colheres) com os mesmos cabos coloridos. Tax free: passa dos € 100,01 mínimos na mesma loja/dia, então dá pra pedir a détaxe (≈12% de volta, ~€13,40) — peça o formulário com o passaporte na hora da compra e valide no aeroporto antes do check-in.",
  },
  {
    id: uid(), date: "2026-09-13", time: "14:15", title: "Provar chocolates na Jacques Genin", type: "restaurante",
    address: "133 Rue de Turenne, 75003 Paris", metro: "Filles du Calvaire (M8), ~5 min a pé",
    lat: 48.8631, lng: 2.3617,
    costAmount: "0", costCurrency: "EUR",
    notes: "Ainda não precisa decidir o que levar — só provar os caramelos e pâtes de fruits agora pra ir anotando os favoritos. A decisão final de quanto comprar fica pro fim da viagem (ver aba Compras).",
  },
  {
    id: uid(), date: "2026-09-13", time: "14:45", title: "Provar manteiga Bordier na Breizh Café", type: "restaurante",
    address: "111 Rue Vieille du Temple, 75003 Paris", metro: "Saint-Sébastien – Froissart (M8), ~3 min a pé",
    lat: 48.8611, lng: 2.3635,
    costAmount: "0", costCurrency: "EUR",
    notes: "A épicerie do Breizh Café vende a manteiga Bordier nos sabores tradicional, sal defumado, trufa e baunilha — bom momento pra provar um pouco de cada e decidir o favorito antes de comprar de verdade mais perto da volta.",
  },
  {
    id: uid(), date: "2026-09-12", time: "06:00", title: "Saída do hotel", type: "transporte",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "0", costCurrency: "EUR",
    notes: "De táxi/Uber (~15-20 min a essa hora, com pouco trânsito) pra chegar na Rue de Camoëns até as 6h30. O metrô ainda não é confiável nesse horário tão cedo com baldeação — vale o táxi só nesse trecho específico.",
  },
  {
    id: uid(), date: "2026-09-12", time: "06:30", title: "Rue de Camoëns (fotos da torre)", type: "passeio",
    address: "Rue de Camoëns, 75016 Paris", lat: 48.8615, lng: 2.2843,
    metro: "Trocadéro (M6, M9), ~5 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Ponto clássico de foto da Torre Eiffel — a escadaria com grades de ferro emoldura a torre ao fundo, sem gente essa hora da manhã. Alternativa bem perto: Rue de l'Université, do outro lado do rio (7º), que também dá um corredor de visão direto pra torre.",
  },
  {
    id: uid(), date: "2026-09-12", time: "07:15", title: "Torre Eiffel (área externa)", type: "passeio",
    address: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris", lat: 48.8584, lng: 2.2945,
    metro: "Bir-Hakeim (M6), ~8 min a pé — ou RER C Champ de Mars–Tour Eiffel, na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Desça da Rue de Camoëns atravessando a Pont d'Iéna pra chegar aos pés da torre. Só a área externa (Champ de Mars) — sem subir. Ainda cedo o bastante pra evitar as multidões que se formam a partir de umas 9h-10h.",
  },
  {
    id: uid(), date: "2026-09-12", time: "08:00", title: "Pont de Bir-Hakeim", type: "passeio",
    address: "Pont de Bir-Hakeim, 75015 Paris", lat: 48.8535, lng: 2.2887,
    metro: "Bir-Hakeim (M6) ou Passy (M6), ~3 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Ponte de metrô elevada bem pertinho do Champ de Mars — apareceu em 'Inception' e é um dos points mais fotografados de Paris, com a torre ao fundo pela estrutura de ferro. Rapidinho, uns 15-20 min já resolve. Saia até 8h15 pra chegar na Rue Cler até 8h30 (uns 15 min a pé).",
  },
  {
    id: uid(), date: "2026-09-12", time: "08:30", title: "Café da manhã na Rue Cler", type: "restaurante",
    address: "Rue Cler, 75007 Paris", lat: 48.8577, lng: 2.3057,
    metro: "École Militaire (M8), ~5 min a pé",
    costAmount: "12", costCurrency: "EUR",
    notes: "Rua de mercado tradicional do 7º, cheia de padarias e mercearias — qualquer uma resolve pro café da manhã depois das fotos da torre. Fica a uns 15 min a pé do Bir-Hakeim.",
  },
  {
    id: uid(), date: "2026-09-12", time: "09:30", title: "Hôtel des Invalides (área externa)", type: "passeio",
    address: "Esplanade des Invalides, 75007 Paris", lat: 48.8566, lng: 2.3125,
    metro: "Invalides (M8, M13), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a fachada e a cúpula dourada (onde está o túmulo de Napoleão) — sem entrar no museu militar. Fica a uns 10 min a pé da Rue Cler.",
  },
  {
    id: uid(), date: "2026-09-12", time: "11:00", title: "Almoço perto do Musée d'Orsay", type: "restaurante",
    address: "Rue de Lille / Quai Anatole France, 75007 Paris", lat: 48.8605, lng: 2.3265,
    metro: "Musée d'Orsay (RER C) ou Solférino (M12)",
    costAmount: "20", costCurrency: "EUR",
    notes: "Cafés e brasseries na região do museu — bom horário pra almoçar antes de seguir pros Champs-Élysées à tarde.",
  },
  {
    id: uid(), date: "2026-09-12", time: "12:00", title: "Musée d'Orsay (área externa)", type: "passeio",
    address: "1 Rue de la Légion d'Honneur, 75007 Paris", lat: 48.86, lng: 2.3266,
    metro: "Musée d'Orsay (RER C), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a fachada da antiga estação de trem (Gare d'Orsay) — arquitetura icônica, sem entrar no museu. Fica de frente pro Sena, ótimas fotos com o relógio gigante.",
  },
  {
    id: uid(), date: "2026-09-12", time: "14:00", title: "Avenue des Champs-Élysées", type: "passeio",
    address: "Avenue des Champs-Élysées, 75008 Paris", lat: 48.8698, lng: 2.3076,
    metro: "Franklin D. Roosevelt (M1, M9), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Caminhada pela avenida mais famosa de Paris — vitrines, lojas de grife, e o point clássico de tirar foto olhando pro Arco do Triunfo lá no fim.",
  },
  {
    id: uid(), date: "2026-09-12", time: "15:30", title: "Arco do Triunfo (área externa)", type: "passeio",
    address: "Place Charles de Gaulle, 75008 Paris", lat: 48.8738, lng: 2.295,
    metro: "Charles de Gaulle – Étoile (M1, M2, M6), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a vista de fora, da Place Charles de Gaulle — subir lá em cima é pago e não está no roteiro. Dá pra ver as 12 avenidas que saem dali feito estrela.",
  },
  {
    id: uid(), date: "2026-09-12", time: "17:00", title: "Jardins des Champs-Élysées (parque)", type: "passeio",
    address: "Jardins des Champs-Élysées, 75008 Paris", lat: 48.8656, lng: 2.3131,
    metro: "Champs-Élysées – Clemenceau (M1, M13), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Parque público tranquilo entre a avenida e o Grand Palais/Petit Palais — bom pra descansar as pernas antes de seguir a pé até o Sena pro jantar. É um respiro verde no meio da agitação da avenida.",
  },
  {
    id: uid(), date: "2026-09-12", time: "19:30", title: "Jantar/lanche às margens do Sena", type: "restaurante",
    address: "Port des Champs-Élysées (perto do Pont Alexandre III), 75008 Paris", lat: 48.8635, lng: 2.3138,
    metro: "Invalides (M8, M13) ou Champs-Élysées – Clemenceau (M1, M13), ~5 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Fecha o dia sentados na margem do rio perto do Pont Alexandre III — um dos trechos mais bonitos pra ver o pôr do sol e a Torre Eiffel iluminada à distância. Pegue queijos, presunto, baguete e um vinho numa mercearia/cave à vin no caminho (tem várias pela Av. Bosquet e Rue Saint-Dominique, perto do Eiffel).",
  },
  {
    id: uid(), date: "2026-09-12", time: "21:00", title: "Monoprix Champs-Élysées (compras pra manhã)", type: "compras",
    address: "52 Avenue des Champs-Élysées, 75008 Paris", lat: 48.8712, lng: 2.3055,
    metro: "Franklin D. Roosevelt (M1, M9), ~2 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Fica aberto até tarde — passa aqui antes de voltar pro hotel pra ter café/pão/fruta prontos amanhã de manhã.",
  },
  {
    id: uid(), date: "2026-09-16", time: "07:15", title: "Café da manhã perto da Gare Saint-Lazare", type: "restaurante",
    address: "Rue Saint-Lazare, 75008/75009 Paris", lat: 48.8759, lng: 2.3252,
    metro: "Saint-Lazare (M3, M12, M13, M14)",
    costAmount: "12", costCurrency: "EUR",
    notes: "Qualquer padaria da região da estação resolve antes de pegar o trem — chegue com folga pro trem das 8h.",
  },
  {
    id: uid(), date: "2026-09-16", time: "08:00", title: "Jardim de Monet (Giverny)", type: "passeio",
    address: "Fondation Claude Monet, 84 Rue Claude Monet, 27620 Giverny, França", lat: 49.0762, lng: 1.5339,
    metro: "Sem metrô — trem de Paris Gare Saint-Lazare até Vernon (~45-50 min) + ônibus até Giverny (~15-20 min)",
    costAmount: "50", costCurrency: "EUR",
    notes: "Bate-volta fora de Paris (a ~75 km, região da Normandia) — reserve o dia inteiro. Ingresso da Fundação ≈ €11 + trem ida/volta ≈ €20-35 + ônibus Vernon-Giverny ida/volta ≈ €10. Aberto só de abril a novembro. Compre o ingresso do jardim com antecedência no site da Fondation Monet pra não pegar fila.",
  },
  {
    id: uid(), date: "2026-09-16", time: "12:30", title: "Almoço em Giverny", type: "restaurante",
    address: "Giverny, 27620 França", lat: 49.0755, lng: 1.5335,
    metro: "", costAmount: "18", costCurrency: "EUR",
    notes: "Restaurantinhos e cafés pertinho da Fondation Monet — bom momento pro almoço antes de pegar o ônibus/trem de volta pra Paris.",
  },
  {
    id: uid(), date: "2026-09-16", time: "18:30", title: "Jantar perto da Gare Saint-Lazare", type: "restaurante",
    address: "Rue Saint-Lazare, 75008/75009 Paris", lat: 48.8759, lng: 2.3252,
    metro: "Saint-Lazare (M3, M12, M13, M14)",
    costAmount: "25", costCurrency: "EUR",
    notes: "Direto do trem de volta de Giverny, antes de seguir pro hotel — a região da estação tem bastante opção de brasserie.",
  },
  {
    id: uid(), date: "2026-09-16", time: "19:30", title: "Monoprix Saint-Lazare (compras pra manhã)", type: "compras",
    address: "Gare Saint-Lazare, 75008 Paris", lat: 48.8756, lng: 2.3253,
    metro: "Saint-Lazare (M3, M12, M13, M14), na própria estação",
    costAmount: "0", costCurrency: "EUR",
    notes: "Direto do trem de volta de Giverny — o Monoprix fica dentro da própria Gare Saint-Lazare, prático pra já resolver o café da manhã de amanhã sem mais um desvio.",
  },
  {
    id: uid(), date: "2026-09-15", time: "12:45", title: "Jardim de Luxemburgo (piquenique)", type: "passeio",
    address: "Jardin du Luxembourg, 75006 Paris", lat: 48.8462, lng: 2.3372,
    metro: "Luxembourg (RER B), ~2 min a pé — ou Odéon (M4, M10), ~8 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Parque público gratuito — visita e piquenique logo depois de comprar o lanche na Liberté, sentados nas cadeiras de ferro espalhadas pelo gramado principal.",
  },
  {
    id: uid(), date: "2026-09-15", time: "13:30", title: "Panthéon (área externa)", type: "passeio",
    address: "Place du Panthéon, 75005 Paris", lat: 48.8462, lng: 2.3464,
    metro: "Luxembourg (RER B), ~10 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Só a fachada neoclássica — sem entrar (tem ingresso pago pra visitar por dentro). Fica a uns 10 min a pé do Jardim de Luxemburgo, dá pra encaixar antes de seguir pro GoodJo/Kilo Shop.",
  },
  {
    id: uid(), date: "2026-09-15", time: "14:15", title: "GoodJo Vintage", type: "compras",
    address: "8 Rue Dupuytren, 75006 Paris", lat: 48.8514, lng: 2.3378,
    metro: "Odéon (M4, M10), ~4 min a pé",
    costAmount: "", costCurrency: "EUR",
    notes: "Segunda mão de luxo (Hermès, Chanel, YSL, Dior, Céline) — vale checar se precisa de horário marcado (o Instagram deles menciona atendimento 'sur rdv'). Boas pedidas: lenços de seda Hermès (entrada mais acessível na marca) e bolsas pequenas/clutches vintage. Tem uma segunda unidade em 16 Rue de la Sourdière, 75001, perto do Louvre.",
  },
  {
    id: uid(), date: "2026-09-15", time: "15:00", title: "Kilo Shop Saint-Germain", type: "compras",
    address: "125 Boulevard Saint-Germain, 75006 Paris", lat: 48.8517, lng: 2.3387,
    metro: "Odéon (M4, M10), ~5 min a pé",
    costAmount: "", costCurrency: "EUR",
    notes: "Vende por peso — mesma rede da opção que já tinha no Marais, essa unidade fica em Saint-Germain, ali do lado do Jardim de Luxemburgo. Boas pedidas: jeans vintage (Levi's/Wrangler) e camisas de time/banda — costuma sair mais barato que comprar peça por peça, já que o preço é por quilo.",
  },
  {
    id: uid(), date: "2026-09-15", time: "15:45", title: "Provar cosméticos na City Pharma", type: "compras",
    address: "26 Rue du Four, 75006 Paris", lat: 48.8514, lng: 2.3328,
    metro: "Mabillon (M10) ou Saint-Germain-des-Prés (M4)",
    costAmount: "0", costCurrency: "EUR",
    notes: "Testa os produtos de farmácia francesa (Bioderma, Nuxe, La Roche-Posay, Caudalie) direto na loja — não precisa comprar tudo hoje, dá pra ir anotando o que quer levar e decidir a quantidade final mais perto da volta.",
  },
  {
    id: uid(), date: "2026-09-15", time: "16:15", title: "Monoprix Rennes (compras pra manhã)", type: "compras",
    address: "50 Rue de Rennes, 75006 Paris", lat: 48.8496, lng: 2.3299,
    metro: "Saint-Sulpice (M4), ~3 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Passa aqui antes de voltar pro hotel pra ter café/pão/fruta prontos amanhã de manhã — dia de Giverny começa cedo.",
  },
  {
    id: uid(), date: "2026-09-15", time: "18:30", title: "Jantar em Saint-Germain-des-Prés", type: "restaurante",
    address: "Saint-Germain-des-Prés, 75006 Paris", lat: 48.8535, lng: 2.334,
    metro: "Saint-Germain-des-Prés (M4)",
    costAmount: "30", costCurrency: "EUR",
    notes: "Qualquer bistrô das ruazinhas ao redor da igreja resolve bem — região cheia de opções de qualidade, sem precisar reservar com muita antecedência.",
  },
  {
    id: uid(), date: "2026-09-17", time: "10:00", title: "Café da manhã em Batignolles", type: "restaurante",
    address: "Batignolles, 75017 Paris", lat: 48.8837, lng: 2.3226,
    metro: "Rome (M2)",
    costAmount: "12", costCurrency: "EUR",
    notes: "Última manhã tranquila pertinho do hotel, antes do checkout ao meio-dia — qualquer padaria da região resolve.",
  },
  {
    id: uid(), date: "2026-09-17", time: "11:00", title: "Checkout do LALA Hôtel (malas na recepção)", type: "hospedagem",
    address: "3 Rue Darcet, 17º arr., 75017 Paris", lat: 48.8847, lng: 2.3218,
    metro: "Rome (M2), ~6 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Checkout no horário padrão do hotel (11h — confirme na reserva se for diferente). Deixa as malas guardadas na recepção e segue aproveitando a cidade o resto do dia, sem precisar carregar nada.",
  },
  {
    id: uid(), date: "2026-09-17", time: "12:30", title: "Almoço livre", type: "restaurante",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "20", costCurrency: "EUR",
    notes: "Último almoço em Paris — aproveite pra revisitar algum lugar querido dos dias anteriores, ou descobrir algo novo perto de onde estiver.",
  },
  {
    id: uid(), date: "2026-09-17", time: "14:30", title: "Le Butter Shop (provar manteigas)", type: "compras",
    address: "5 Rue Bouchut, 75015 Paris", lat: 48.8467, lng: 2.3078,
    metro: "Ségur (M10) ou Sèvres-Lecourbe (M6), a conferir a mais próxima",
    costAmount: "0", costCurrency: "EUR",
    notes: "Empório gourmet nota 5,0 — vale a pena bem no fim da viagem, já que aqui é quando decide de vez qual manteiga (e o que mais) levar pra casa, depois de já ter provado na Breizh Café e na Grande Épicerie. Fica no 15º, mais longe do hotel — reserve um tempinho de deslocamento. Confirme o horário de funcionamento mais perto da data, é um empório pequeno.",
  },
  {
    id: uid(), date: "2026-09-17", time: "17:00", title: "Monoprix (compras pra manhã do voo)", type: "compras",
    address: "Place de Clichy, 75017/75008 Paris", lat: 48.883, lng: 2.3273,
    metro: "Place de Clichy (M2, M13), na saída",
    costAmount: "0", costCurrency: "EUR",
    notes: "Última parada antes do traslado pro hotel do aeroporto — o voo de volta sai às 8h15 de sexta, bem cedo, então vale já ter café da manhã em mãos.",
  },
  {
    id: uid(), date: "2026-09-17", time: "18:00", title: "Último jantar em Batignolles", type: "restaurante",
    address: "Batignolles, 75017 Paris", lat: 48.8837, lng: 2.3226,
    metro: "Rome (M2)",
    costAmount: "25", costCurrency: "EUR",
    notes: "Fecha a viagem com um jantar tranquilo pertinho do hotel, antes de pegar as malas e seguir pro aeroporto.",
  },
  {
    id: uid(), date: "2026-09-17", time: "19:00", title: "Retirar as malas no LALA Hôtel", type: "hospedagem",
    address: "3 Rue Darcet, 17º arr., 75017 Paris", lat: 48.8847, lng: 2.3218,
    metro: "Rome (M2), ~6 min a pé",
    costAmount: "0", costCurrency: "EUR",
    notes: "Passa pra pegar as malas guardadas desde o checkout das 11h.",
  },
  {
    id: uid(), date: "2026-09-17", time: "19:30", title: "Traslado para o hotel do aeroporto", type: "transporte",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "", costCurrency: "EUR",
    notes: "Hotel do aeroporto é só pra dormir essa noite — chegando à noite, sem compromisso, já que amanhã o voo sai bem cedo.",
  },
  {
    id: uid(), date: "2026-09-18", time: "04:00", title: "Acordar e se preparar", type: "transporte",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "0", costCurrency: "EUR",
    notes: "Voo KLM 08h15 — com validação de tax free antes do check-in, o ideal é sair do hotel já com tudo pronto.",
  },
  {
    id: uid(), date: "2026-09-18", time: "04:30", title: "Checkout do hotel do aeroporto", type: "hospedagem",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "0", costCurrency: "EUR",
    notes: "Checkout rápido — se o hotel for servido pelo CDGVal (monotrilho gratuito), o trajeto até o terminal é rápido, mas sempre com folga.",
  },
  {
    id: uid(), date: "2026-09-18", time: "05:00", title: "Validar tax free (PABLO) no aeroporto", type: "transporte",
    address: "Aéroport Paris-Charles de Gaulle, Terminal (confirmar no bilhete)", lat: 49.0097, lng: 2.5479,
    metro: "", costAmount: "0", costCurrency: "EUR",
    notes: "A validação da détaxe (Longchamp, Sabre e o que mais tiver o formulário) precisa ser feita ANTES de despachar a bagagem, nos terminais eletrônicos PABLO ou no balcão de alfândega — reserve uns 30-40 min pra isso, especialmente se pegar fila.",
  },
  {
    id: uid(), date: "2026-09-18", time: "05:30", title: "Check-in e despacho de bagagem (KLM)", type: "transporte",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "0", costCurrency: "EUR",
    notes: "Depois da détaxe validada, segue pro check-in normal. Voo KLM 2006, conexão em Amsterdã (chega 09h40, sai 13h00 rumo a GRU).",
  },
  {
    id: uid(), date: "2026-09-18", time: "07:45", title: "Embarque", type: "transporte",
    address: "", lat: null, lng: null, metro: "",
    costAmount: "0", costCurrency: "EUR",
    notes: "Decolagem às 8h15. Essa é a viagem de volta — sem mais programação depois do embarque.",
  },
];

// Narrativa de cada dia da viagem (11 a 17/09) — vai sendo ajustada conforme novos lugares entram no roteiro.
// A ordem dos dias respeita o funcionamento real dos locais e a proximidade entre eles — o Marais
// costuma ter suas lojas abertas aos domingos (à tarde), diferente do resto de Paris, por isso
// essa atividade foi pro domingo, não durante a semana.
const DAY_PLANS = {
  "2026-09-11": {
    title: "Sex. — Chegada em Paris",
    narrative: "Pouso em CDG às 11h55, desembarque + traslado até o hotel (~1h-1h30) — chegada prevista por volta das 13h30-14h. Deixar as malas no LALA Hôtel e, se o cansaço permitir, aproveitar que Montmartre fica pertinho pra fazer o passeio da Amélie Poulain (Café des Deux Moulins, mercearia do filme e a cabine de fotos) e terminar vendo o pôr do sol no Sacré-Cœur. Se preferir descansar, dá pra remarcar essa parte pra outro dia.",
  },
  "2026-09-12": {
    title: "Sáb. — Torre Eiffel",
    narrative: "Saída do hotel de táxi às 6h pra chegar na Rue de Camoëns até as 6h30 — ponto clássico de foto da torre emoldurada pela escadaria de ferro, e sem ninguém por perto essa hora. Depois desce pra Torre Eiffel/Champ de Mars às 7h15, e passa pela Pont de Bir-Hakeim às 8h (outro point fotogênico, aparece em 'Inception'). À tarde, uma caminhada pelos Champs-Élysées até o Arco do Triunfo, com uma parada nos Jardins des Champs-Élysées (parque) no caminho de volta. Pra fechar o dia, jantar/lanche tipo piquenique nas margens do Sena perto do Pont Alexandre III, vendo o pôr do sol e a torre iluminada à distância.",
  },
  "2026-09-13": {
    title: "Dom. — Marais + roteiro \"Before Sunset\"",
    narrative: "Começa às 6h30 no Louvre (pátio e pirâmide, fotos sem ninguém por perto), seguindo às 7h15 pra Notre-Dame/Île de la Cité, antes da cidade acordar. No Marais as lojas costumam abrir aos domingos — mas boa parte só na parte da tarde. Às 10h, o passeio de 'Before Sunset': começa na livraria Shakespeare and Company (frente à Notre-Dame), segue pela Rue Saint-Julien le Pauvre e Rue Galande, atravessa o Sena e chega ao Marais pela Rue des Jardins Saint-Paul. Pro almoço rápido antes das compras, L'As du Fallafel ou o Hank Burger (vegano) resolvem sem precisar de garçom — ver aba Alimentação. À tarde, Sabre (talheres, a partir das 13h30), os brechós Free'p'Star (a partir das 15h) e a Uniqlo do Marais e a Muji (a partir das 16h30, uma do lado da outra na mesma rua). Volta ao hotel até as 20h.",
  },
  "2026-09-14": {
    title: "Seg. — Parc Monceau + Longchamp",
    narrative: "Dia mais tranquilo, pertinho do hotel. Comece pegando o lanche na Café Dose (Batignolles) e vá direto pro Parc Monceau fazer o piquenique assim que chegar. À tarde, Longchamp (fica na região Saint-Honoré, uma das zonas com funcionamento normal de segunda a sábado). Volta ao hotel até as 20h.",
  },
  "2026-09-15": {
    title: "Ter. — Canal Saint-Martin + Luxemburgo",
    narrative: "Terça-feira funciona bem aqui (nenhum dos dois é museu, então não pega o fechamento de terça do Louvre/Pompidou). Manhã na região do Café Pli / Canal Saint-Martin — passe na padaria Liberté pra pegar o lanche e vá direto pro Jardim de Luxemburgo fazer o piquenique. Depois, GoodJo Vintage e Kilo Shop (ambos em Saint-Germain, ali do lado) pra uma parada de brechó. Volta ao hotel até as 20h.",
  },
  "2026-09-16": {
    title: "Qua. — Giverny (bate-volta)",
    narrative: "Dia inteiro reservado pro jardim de Monet em Giverny — aberto todos os dias (abril a novembro), então qualquer dia da semana funciona. Trem saindo cedo da Gare Saint-Lazare. Volta prevista no fim da tarde/início da noite, já de volta ao hotel.",
  },
  "2026-09-17": {
    title: "Qui. — Checkout + traslado",
    narrative: "Checkout do LALA Hôtel às 11h, deixando as malas guardadas na recepção pra continuar aproveitando a cidade sem carregar nada. À noite, retira as malas e segue pro hotel do aeroporto, só pra dormir.",
  },
  "2026-09-18": {
    title: "Sex. — Volta ao Brasil",
    narrative: "Dia só de viagem de volta. Acordar 4h, checkout do hotel do aeroporto às 4h30, validar a détaxe (tax free) no PABLO antes de despachar bagagem, check-in KLM, e embarque às 7h45 pro voo das 8h15 (conexão em Amsterdã).",
  },
};

const METRO_STATIONS = [
  { name: "La Fourche", lines: "M13", lat: 48.8837, lng: 2.3266 },
  { name: "Rome", lines: "M2", lat: 48.8797, lng: 2.3220 },
  { name: "République", lines: "M3 M5 M8 M9 M11", lat: 48.8671, lng: 2.3639 },
  { name: "Goncourt", lines: "M11", lat: 48.8687, lng: 2.3702 },
  { name: "Tuileries", lines: "M1", lat: 48.8646, lng: 2.3280 },
  { name: "Hôtel de Ville", lines: "M1 M11", lat: 48.8570, lng: 2.3514 },
  { name: "Porte de Clignancourt", lines: "M4", lat: 48.8974, lng: 2.3444 },
  { name: "Filles du Calvaire", lines: "M8", lat: 48.8625, lng: 2.3644 },
  { name: "Bir-Hakeim", lines: "M6", lat: 48.8540, lng: 2.2892 },
  { name: "Palais Royal – Musée du Louvre", lines: "M1 M7", lat: 48.8625, lng: 2.3366 },
  { name: "Luxembourg", lines: "RER B", lat: 48.8462, lng: 2.3399 },
];

function getSector(address) {
  if (!address) return null;
  if (/27620|Giverny/i.test(address)) return "Giverny (fora de Paris)";
  if (/75003|75004/.test(address)) return "Marais (3e/4e)";
  if (/75001/.test(address)) return "Louvre / Tuileries (1er)";
  if (/75005/.test(address)) return "Quartier Latin / Notre-Dame (5e)";
  if (/75007|75015|75016/.test(address)) return "Torre Eiffel / Champ de Mars (7e)";
  if (/75010|75011/.test(address)) return "République / Canal Saint-Martin (11e)";
  if (/75017/.test(address)) return "Batignolles / Clichy (17e)";
  if (/75018/.test(address)) return "Montmartre (18e)";
  if (/75006/.test(address)) return "Saint-Germain / Luxembourg (6e)";
  if (/75008|75009/.test(address)) return "Champs-Élysées (8e)";
  return "Outra região";
}

/* ---------- storage helpers ----------
   Nuvem: Firebase Realtime Database do casal (projeto apps-4b887), nó
   planos/ (mesmas regras já publicadas para o roteiro). Os dados carregam
   da nuvem ao abrir e salvam na nuvem a cada mudança; o localStorage fica
   como cópia offline. Ao voltar pro app, se houver versão mais nova na
   nuvem, a página recarrega sozinha. */

const SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/paris-planner-dt2026";
let syncStamp = 0;

async function loadKey(key, fallback) {
  try {
    const r = await fetch(`${SYNC_URL}/${key}.json`, { cache: "no-store" });
    if (r.ok) {
      const v = await r.json();
      if (v != null) {
        try { localStorage.setItem(key, v); } catch (e) {}
        return JSON.parse(v);
      }
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  const s = JSON.stringify(value);
  try { localStorage.setItem(key, s); } catch (e) {}
  try {
    await fetch(`${SYNC_URL}/${key}.json`, { method: "PUT", body: JSON.stringify(s) });
    syncStamp = Date.now();
    fetch(`${SYNC_URL}/_at.json`, { method: "PUT", body: JSON.stringify(syncStamp) }).catch(() => {});
  } catch (e) {}
}
// carimbo inicial + recarregar ao voltar pro app se alguém salvou depois
fetch(`${SYNC_URL}/_at.json`, { cache: "no-store" })
  .then(r => r.json()).then(v => { if (typeof v === "number") syncStamp = v; }).catch(() => {});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  fetch(`${SYNC_URL}/_at.json`, { cache: "no-store" })
    .then(r => r.json())
    .then(v => { if (typeof v === "number" && v > syncStamp + 1500) location.reload(); })
    .catch(() => {});
});

/* ---------- small UI atoms ---------- */

function Stub({ children }) {
  return (
    <div className="relative">
      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#F1EDE4]" />
      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#F1EDE4]" />
      {children}
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <div
      className={`bg-white/70 border border-[#D9D2C2] rounded-sm p-5 ${className}`}
      style={{ boxShadow: "0 1px 0 rgba(28,28,30,0.03)" }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-[#FBFAF7] border border-[#D9D2C2] rounded-sm px-3 py-2 text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#3B5166]/40 focus:border-[#3B5166]";

function EmptyHint({ text }) {
  return <p className="text-[13px] text-[#8A8375] italic">{text}</p>;
}

/* ---------- totals helpers ---------- */

function currencyTotals(list, amountKey, curKey) {
  const totals = {};
  list.forEach((x) => {
    const cur = x[curKey] || "EUR";
    totals[cur] = (totals[cur] || 0) + toNumber(x[amountKey]);
  });
  return totals;
}
function mergeTotals(...totalsList) {
  const merged = {};
  totalsList.forEach((t) => {
    Object.entries(t).forEach(([cur, val]) => {
      merged[cur] = (merged[cur] || 0) + val;
    });
  });
  return merged;
}
function formatTotals(totals) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "";
  return entries.map(([cur, val]) => `${cur} ${fmtMoney(val)}`).join(" · ");
}

/* ---------- App ---------- */

export default function ParisTripPlanner() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState("");

  const [budget, setBudget] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [logistics, setLogistics] = useState(emptyLogistics);
  const [outfits, setOutfits] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [food, setFood] = useState([]);
  const [souvenirs, setSouvenirs] = useState([]);
  const [gifts, setGifts] = useState([]);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    (async () => {
      const [b, i, l, o, w, fd, sv, gf] = await Promise.all([
        loadKey("paris-trip:budget", defaultBudget),
        loadKey("paris-trip:itinerary", defaultItinerary),
        loadKey("paris-trip:logistics", emptyLogistics),
        loadKey("paris-trip:outfits", defaultOutfits),
        loadKey("paris-trip:wishlist", defaultWishlist),
        loadKey("paris-trip:food", defaultFood),
        loadKey("paris-trip:souvenirs", defaultSouvenirs),
        loadKey("paris-trip:gifts", defaultGifts),
      ]);
      setBudget(b);
      setItinerary(i);
      setLogistics({
        ...emptyLogistics, ...l,
        flights: { ...emptyLogistics.flights, ...(l.flights || {}) },
        accommodation: { ...emptyLogistics.accommodation, ...(l.accommodation || {}) },
      });
      setOutfits(o);
      setWishlist(w);
      setFood(fd);
      setSouvenirs(sv);
      setGifts(gf);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) saveKey("paris-trip:budget", budget); }, [budget, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:itinerary", itinerary); }, [itinerary, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:logistics", logistics); }, [logistics, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:outfits", outfits); }, [outfits, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:wishlist", wishlist); }, [wishlist, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:food", food); }, [food, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:souvenirs", souvenirs); }, [souvenirs, ready]);
  useEffect(() => { if (ready) saveKey("paris-trip:gifts", gifts); }, [gifts, ready]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDE9DF]">
        <Loader2 className="animate-spin text-[#3B5166]" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDE9DF] text-[#1C1C1E]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      <Header logistics={logistics} />
      <NavTabs tab={tab} setTab={setTab} />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-6">
        {tab === "overview" && (
          <Overview budget={budget} itinerary={itinerary} logistics={logistics} outfits={outfits} wishlist={wishlist} gifts={gifts} goTo={setTab} />
        )}
        {tab === "budget" && <BudgetTab budget={budget} itinerary={itinerary} />}
        {tab === "itinerary" && <ItineraryTab itinerary={itinerary} />}
        {tab === "map" && <MapTab itinerary={itinerary} logistics={logistics} />}
        {tab === "food" && <FoodTab food={food} />}
        {tab === "health" && <HealthTab />}
        {tab === "logistics" && <LogisticsTab logistics={logistics} />}
        {tab === "compras" && <ComprasTab wishlist={wishlist} itinerary={itinerary} souvenirs={souvenirs} />}
        {tab === "presentes" && <GiftsTab gifts={gifts} />}
        {tab === "outfits" && <OutfitsTab outfits={outfits} />}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#1C1C1E] text-[#EDE9DF] text-[13px] px-4 py-2.5 rounded-sm shadow-lg flex items-center gap-2 z-20">
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- header ---------- */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

function Header({ logistics }) {
  const d = daysUntil(logistics.tripStart);
  return (
    <header className="border-b border-[#D9D2C2] bg-[#EDE9DF]">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-5 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#9B2C2C]">GRU · CDG</p>
          <h1 className="font-display text-[34px] leading-none mt-1">Paris</h1>
        </div>
        <div className="text-right">
          {d === null ? (
            <p className="text-[12px] text-[#6B655A]">defina a data em Logística</p>
          ) : d >= 0 ? (
            <>
              <p className="font-display text-[28px] leading-none text-[#3B5166]">{d}</p>
              <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A]">dias para embarcar</p>
            </>
          ) : (
            <p className="text-[12px] text-[#6B655A]">bon voyage ✈️</p>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------- nav ---------- */

function NavTabs({ tab, setTab }) {
  return (
    <div className="sticky top-0 z-10 bg-[#EDE9DF]/95 backdrop-blur border-b border-[#D9D2C2]">
      <div className="max-w-2xl mx-auto px-4 flex gap-2 overflow-x-auto py-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-sm border transition-colors ${
                active
                  ? "bg-[#1C1C1E] border-[#1C1C1E] text-[#EDE9DF]"
                  : "bg-transparent border-[#D9D2C2] text-[#4A453D] hover:border-[#3B5166]"
              }`}
              style={{ borderStyle: active ? "solid" : "dashed" }}
            >
              <Icon size={14} />
              <span className="text-[13px] font-medium">{t.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Overview ---------- */

function Overview({ budget, itinerary, logistics, outfits, wishlist, gifts, goTo }) {
  const TARGET_PLANNED = 30000;
  const TARGET_MAX = 40000;
  const PEOPLE = 2;
  const COLOR_EFETIVADO = "#3B5166";
  const COLOR_PREVISTO = "#A88856";
  const [expandedCashCategory, setExpandedCashCategory] = useState(null);
  const [expandedGastoCategory, setExpandedGastoCategory] = useState(null);

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tripStart = new Date(logistics.tripStart + "T00:00:00");
  const tripEndDate = new Date(logistics.tripEnd + "T00:00:00");
  const daysUntilTrip = Math.round((tripStart - todayMidnight) / 86400000);
  const daysUntilReturn = Math.round((tripEndDate - todayMidnight) / 86400000);
  let countdownLabel, countdownSub;
  if (daysUntilTrip > 0) {
    countdownLabel = `${daysUntilTrip} dia${daysUntilTrip === 1 ? "" : "s"}`;
    countdownSub = "faltam pra embarcar";
  } else if (daysUntilReturn > 0) {
    countdownLabel = "Vocês estão em Paris!";
    countdownSub = `volta em ${daysUntilReturn} dia${daysUntilReturn === 1 ? "" : "s"}`;
  } else {
    countdownLabel = "Boa volta!";
    countdownSub = "espero que a viagem tenha sido incrível";
  }

  // "Já pago" aqui é o que já foi de fato gasto na viagem — a compra de câmbio não conta (vira crédito, não gasto).
  const investedBRL = budget.filter((b) => b.currency === "BRL").reduce((s, b) => s + toNumber(b.amount), 0);
  const totalCashEUR = budget.filter((b) => b.category === "Dinheiro disponível").reduce((s, b) => s + toNumber(b.eurAmount), 0);
  const cashSpentEUR = budget
    .filter((b) => b.status === "pago" && b.category !== "Dinheiro disponível" && b.currency === "EUR")
    .reduce((s, b) => s + toNumber(b.amount), 0);
  const cashAvailableEUR = totalCashEUR - cashSpentEUR;

  // ----- Chart 1: Gastos (BRL) — uma barra só, por categoria -----
  const hospedagemItems = budget.filter((b) => b.category === "Hospedagem");
  const hospedagemTotal = hospedagemItems.reduce((s, b) => s + toNumber(b.amount), 0);
  const passagemTotal = budget.filter((b) => b.category === "Passagem").reduce((s, b) => s + toNumber(b.amount), 0);
  const cambioTotal = budget.filter((b) => b.category === "Dinheiro disponível").reduce((s, b) => s + toNumber(b.amount), 0);
  const seguroTotal = budget.filter((b) => b.category === "Seguro viagem").reduce((s, b) => s + toNumber(b.amount), 0);
  const presentesTotalEUR = gifts.reduce((s, g) => s + (g.budgetEUR || 0), 0);
  const presentesTotalBRL = presentesTotalEUR * EUR_TO_BRL_RATE;

  const gastosSegments = [
    { label: "Passagem", value: passagemTotal, color: "#3B5166" },
    { label: "Hospedagem", value: hospedagemTotal, color: "#A88856" },
    { label: "Câmbio", value: cambioTotal, color: "#5B6B4E" },
    { label: "Seguro viagem", value: seguroTotal, color: "#C97B4A" },
    { label: "Presentes", value: presentesTotalBRL, color: "#9B2C2C" },
  ];
  const gastosTotal = passagemTotal + hospedagemTotal + cambioTotal + seguroTotal + presentesTotalBRL;

  // ----- Chart 2: Dinheiro disponível (EUR) — por categoria de uso previsto -----
  const itinerarioTransporteEUR = itinerary.filter((i) => i.type === "transporte" && i.costCurrency === "EUR").reduce((s, i) => s + toNumber(i.costAmount), 0);
  const transporteEUR = budget.filter((b) => b.category === "Transporte local" && b.currency === "EUR").reduce((s, b) => s + toNumber(b.amount), 0) + itinerarioTransporteEUR;
  const comprasEUR = itinerary.filter((i) => i.type === "compras" && i.costCurrency === "EUR").reduce((s, i) => s + toNumber(i.costAmount), 0);
  const alimentacaoBase = itinerary.filter((i) => i.type === "restaurante" && i.costCurrency === "EUR").reduce((s, i) => s + toNumber(i.costAmount), 0);
  const alimentacaoEUR = alimentacaoBase * 1.12; // ~12% de margem pra bebidas, extras e imprevistos
  const passeiosEUR = itinerary.filter((i) => i.type === "passeio" && i.costCurrency === "EUR").reduce((s, i) => s + toNumber(i.costAmount), 0);
  const presentesEUR = gifts.reduce((s, g) => s + (g.budgetEUR || 0), 0);
  const restanteEUR = Math.max(0, totalCashEUR - transporteEUR - comprasEUR - passeiosEUR - alimentacaoEUR - presentesEUR);
  const cashSegments = [
    { label: "Transporte", value: transporteEUR, color: "#6B655A" },
    { label: "Compras", value: comprasEUR, color: "#A88856" },
    { label: "Alimentação", value: alimentacaoEUR, color: "#C97B4A" },
    { label: "Passeios", value: passeiosEUR, color: "#5B6B4E" },
    { label: "Presentes", value: presentesEUR, color: "#9B2C2C" },
    { label: "Ainda não alocado", value: restanteEUR, color: "#D9D2C2" },
  ];

  // ----- Divisão por pessoa — mesmas categorias de gasto, tudo convertido pra reais na cotação paga -----
  const personCategoryColors = {
    Passagem: "#3B5166", Hospedagem: "#A88856", Alimentação: "#C97B4A",
    Transporte: "#6B655A", Passeios: "#5B6B4E", "Seguro viagem": "#8A6BA1",
    Presentes: "#9B2C2C", Compras: "#7A5C61",
  };
  const personCommonCategories = [
    { label: "Passagem", brl: passagemTotal, tatiRatio: 0.5 },
    { label: "Hospedagem", brl: hospedagemTotal, tatiRatio: 0.5 },
    { label: "Alimentação", brl: alimentacaoEUR * EUR_TO_BRL_RATE, tatiRatio: 0.4 },
    { label: "Transporte", brl: transporteEUR * EUR_TO_BRL_RATE, tatiRatio: 0.5 },
    { label: "Passeios", brl: passeiosEUR * EUR_TO_BRL_RATE, tatiRatio: 0.5 },
    { label: "Seguro viagem", brl: seguroTotal, tatiRatio: 0.5 },
    { label: "Presentes", brl: presentesTotalBRL, tatiRatio: 0.5 },
  ].filter((c) => c.brl > 0);
  const comprasTotalBRL = comprasEUR * EUR_TO_BRL_RATE;
  const tatiSegments = [
    ...personCommonCategories.map((c) => ({ label: c.label, value: c.brl * c.tatiRatio, color: personCategoryColors[c.label] })),
    ...(comprasTotalBRL > 0 ? [{ label: "Compras", value: comprasTotalBRL, color: personCategoryColors.Compras }] : []),
  ];
  const diSegments = personCommonCategories.map((c) => ({ label: c.label, value: c.brl * (1 - c.tatiRatio), color: personCategoryColors[c.label] }));
  const tatiTotalBRL = tatiSegments.reduce((s, seg) => s + seg.value, 0);
  const diTotalBRL = diSegments.reduce((s, seg) => s + seg.value, 0);
  const personMax = Math.max(tatiTotalBRL, diTotalBRL, 1);

  const nextStops = [...itinerary]
    .filter((i) => i.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const docsLeft = logistics.documents.filter((d) => !d.done).length;

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Paris te espera</p>
        <p className="font-display text-[28px] text-[#9B2C2C]">{countdownLabel}</p>
        <p className="text-[12px] text-[#8A8375] mt-0.5">{countdownSub}</p>
      </SectionCard>

      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Total já investido (em reais)</p>
        <p className="font-display text-[26px] text-[#3B5166]">R$ {fmtMoney(investedBRL)}</p>
        <p className="text-[11px] text-[#8A8375] mt-1">Passagem + hospedagem + custo do câmbio já feito.</p>

        <div className="mt-3.5 space-y-3">
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D]">Meta planejada — R$ {fmtMoney(TARGET_PLANNED)}</span>
              <span className="text-[#8A8375]">{((investedBRL / TARGET_PLANNED) * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={investedBRL} max={TARGET_PLANNED} color="#3B5166" />
          </div>
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D]">Teto máximo — R$ {fmtMoney(TARGET_MAX)}</span>
              <span className="text-[#8A8375]">{((investedBRL / TARGET_MAX) * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={investedBRL} max={TARGET_MAX} color="#9B2C2C" />
          </div>
        </div>
        <button onClick={() => goTo("budget")} className="text-[12px] text-[#3B5166] underline mt-3 inline-block">ver orçamento</button>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-[18px]">Gastos</p>
          <button onClick={() => goTo("budget")} className="text-[12px] text-[#3B5166] underline">ver orçamento</button>
        </div>
        <p className="text-[11px] text-[#8A8375] mb-3">Total R$ {fmtMoney(gastosTotal)} — toque numa categoria pra ver os itens.</p>
        <div className="w-full h-6 rounded-full bg-[#E3DDCC] overflow-hidden flex">
          {gastosSegments.map((seg, i) => seg.value > 0 && (
            <div key={i} style={{ width: `${(seg.value / gastosTotal) * 100}%`, background: seg.color }} title={`${seg.label}: R$ ${fmtMoney(seg.value)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
          {gastosSegments.map((seg, i) => seg.value > 0 && (
            <button
              key={i}
              onClick={() => setExpandedGastoCategory((prev) => (prev === seg.label ? null : seg.label))}
              className={`flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-sm ${expandedGastoCategory === seg.label ? "bg-[#1C1C1E]/[0.06] font-semibold text-[#1C1C1E]" : "text-[#4A453D]"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: seg.color }} />
              {seg.label}: R$ {fmtMoney(seg.value)}
            </button>
          ))}
        </div>
        {expandedGastoCategory && (
          <div className="mt-3 pt-3 border-t border-[#D9D2C2] space-y-2">
            {expandedGastoCategory === "Passagem" && (
              budget.filter((b) => b.category === "Passagem").map((b) => (
                <div key={b.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{b.item}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">R$ {fmtMoney(toNumber(b.amount))}</span>
                </div>
              ))
            )}
            {expandedGastoCategory === "Hospedagem" && (
              hospedagemItems.map((b) => (
                <div key={b.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{b.item}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">R$ {fmtMoney(toNumber(b.amount))}</span>
                </div>
              ))
            )}
            {expandedGastoCategory === "Câmbio" && (
              budget.filter((b) => b.category === "Dinheiro disponível").map((b) => (
                <div key={b.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{b.item}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">R$ {fmtMoney(toNumber(b.amount))}</span>
                </div>
              ))
            )}
            {expandedGastoCategory === "Seguro viagem" && (
              budget.filter((b) => b.category === "Seguro viagem").map((b) => (
                <div key={b.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{b.item}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">R$ {fmtMoney(toNumber(b.amount))}</span>
                </div>
              ))
            )}
            {expandedGastoCategory === "Presentes" && (
              gifts.map((g) => (
                <div key={g.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{g.person}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">R$ {fmtMoney((g.budgetEUR || 0) * EUR_TO_BRL_RATE)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Divisão por pessoa</p>
        <p className="text-[11px] text-[#8A8375] mb-3">
          Mesmas categorias do gráfico de Gastos, divididas 50/50 — exceto Alimentação, que fica 40% Tati / 60%
          Di. Tudo convertido pra reais na cotação já paga (R$ {EUR_TO_BRL_RATE.toFixed(3)}/€). Só na Tati entra
          o valor de Compras (100%).
        </p>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D] font-medium">Tati</span>
              <span className="font-mono text-[#3B5166]">R$ {fmtMoney(tatiTotalBRL)}</span>
            </div>
            <div className="w-full h-6 rounded-full bg-[#E3DDCC] overflow-hidden flex">
              {tatiSegments.map((seg, i) => seg.value > 0 && (
                <div key={i} style={{ width: `${(seg.value / personMax) * 100}%`, background: seg.color }} title={`${seg.label}: R$ ${fmtMoney(seg.value)}`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {tatiSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] text-[#4A453D]">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: seg.color }} />
                  {seg.label}: R$ {fmtMoney(seg.value)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D] font-medium">Di</span>
              <span className="font-mono text-[#3B5166]">R$ {fmtMoney(diTotalBRL)}</span>
            </div>
            <div className="w-full h-6 rounded-full bg-[#E3DDCC] overflow-hidden flex">
              {diSegments.map((seg, i) => seg.value > 0 && (
                <div key={i} style={{ width: `${(seg.value / personMax) * 100}%`, background: seg.color }} title={`${seg.label}: R$ ${fmtMoney(seg.value)}`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {diSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] text-[#4A453D]">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: seg.color }} />
                  {seg.label}: R$ {fmtMoney(seg.value)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-[18px]">Dinheiro disponível</p>
          <button onClick={() => goTo("budget")} className="text-[12px] text-[#3B5166] underline">ver orçamento</button>
        </div>
        <p className="text-[11px] text-[#8A8375] mb-3">€ {fmtMoney(totalCashEUR)} comprados — toque numa categoria pra ver os itens.</p>
        <div className="w-full h-6 rounded-full bg-[#E3DDCC] overflow-hidden flex">
          {cashSegments.map((seg, i) => seg.value > 0 && (
            <div key={i} style={{ width: `${(seg.value / totalCashEUR) * 100}%`, background: seg.color }} title={`${seg.label}: € ${fmtMoney(seg.value)}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
          {cashSegments.map((seg, i) => (
            <button
              key={i}
              onClick={() => setExpandedCashCategory((prev) => (prev === seg.label ? null : seg.label))}
              className={`flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-sm ${expandedCashCategory === seg.label ? "bg-[#1C1C1E]/[0.06] font-semibold text-[#1C1C1E]" : "text-[#4A453D]"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: seg.color }} />
              {seg.label}: € {fmtMoney(seg.value)}
            </button>
          ))}
        </div>
        {expandedCashCategory && (
          <div className="mt-3 pt-3 border-t border-[#D9D2C2] space-y-2">
            {expandedCashCategory === "Transporte" && (
              <>
                {budget.filter((b) => b.category === "Transporte local" && b.currency === "EUR").map((b) => (
                  <div key={b.id} className="flex justify-between text-[12px]">
                    <span className="text-[#4A453D]">{b.item}</span>
                    <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(toNumber(b.amount))}</span>
                  </div>
                ))}
                {itinerary.filter((i) => i.type === "transporte" && i.costCurrency === "EUR" && toNumber(i.costAmount) > 0).map((i) => (
                  <div key={i.id} className="flex justify-between text-[12px]">
                    <span className="text-[#4A453D]">{i.title}</span>
                    <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(toNumber(i.costAmount))}</span>
                  </div>
                ))}
              </>
            )}
            {expandedCashCategory === "Compras" && (
              itinerary.filter((i) => i.type === "compras" && i.costCurrency === "EUR" && toNumber(i.costAmount) > 0).map((i) => (
                <div key={i.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{i.title}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(toNumber(i.costAmount))}</span>
                </div>
              ))
            )}
            {expandedCashCategory === "Alimentação" && (
              <>
                {itinerary.filter((i) => i.type === "restaurante" && i.costCurrency === "EUR" && toNumber(i.costAmount) > 0).map((i) => (
                  <div key={i.id} className="flex justify-between text-[12px]">
                    <span className="text-[#4A453D]">{i.title}</span>
                    <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(toNumber(i.costAmount))}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[12px] pt-1 border-t border-[#D9D2C2]">
                  <span className="text-[#8A8375] italic">Margem de ~12% (bebidas, extras, imprevistos)</span>
                  <span className="font-mono text-[#8A8375] shrink-0 ml-2">€ {fmtMoney(alimentacaoEUR - alimentacaoBase)}</span>
                </div>
              </>
            )}
            {expandedCashCategory === "Passeios" && (
              itinerary.filter((i) => i.type === "passeio" && i.costCurrency === "EUR" && toNumber(i.costAmount) > 0).map((i) => (
                <div key={i.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{i.title}</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(toNumber(i.costAmount))}</span>
                </div>
              ))
            )}
            {expandedCashCategory === "Presentes" && (
              gifts.map((g) => (
                <div key={g.id} className="flex justify-between text-[12px]">
                  <span className="text-[#4A453D]">{g.person} ({g.giftType})</span>
                  <span className="font-mono text-[#6B655A] shrink-0 ml-2">€ {fmtMoney(g.budgetEUR)}</span>
                </div>
              ))
            )}
            {expandedCashCategory === "Ainda não alocado" && (
              <p className="text-[12px] text-[#6B655A] leading-relaxed">
                Esse valor ainda não tem destino certo — sobra depois de somar transporte, compras e passeios já
                estimados. Fica de reserva pra imprevistos ou pra decidir depois.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-[18px]">Próximos passeios</p>
          <button onClick={() => goTo("itinerary")} className="text-[12px] text-[#3B5166] underline">
            ver roteiro
          </button>
        </div>
        {nextStops.length === 0 ? (
          <EmptyHint text="Nenhum passeio com data ainda. Adicione lugares que quer visitar na aba Passeios." />
        ) : (
          <div className="space-y-2">
            {nextStops.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-[13px]">
                <span className="font-mono text-[#9B2C2C] w-20 shrink-0">{tripDayLabel(s.date)}</span>
                <span className="truncate">{s.title}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-[18px]">Checklist de documentos</p>
          <button onClick={() => goTo("logistics")} className="text-[12px] text-[#3B5166] underline">
            ver logística
          </button>
        </div>
        {docsLeft === 0 ? (
          <p className="text-[13px] text-[#3B5166] flex items-center gap-1.5"><Check size={14} /> tudo pronto</p>
        ) : (
          <p className="text-[13px] text-[#6B655A]">{docsLeft} item(ns) pendente(s)</p>
        )}
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-2">Como usar</p>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Manda pra mim as informações da passagem, hospedagem, lugares que quer visitar e fotos de roupas
          (pode colar o link da imagem) que eu vou organizando tudo aqui pra você. Tudo fica salvo automaticamente.
        </p>
      </SectionCard>
    </div>
  );
}

function HBarChart({ rows, maxValue, formatValue }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-[#4A453D]">{row.label}</span>
            <span className="font-mono text-[#6B655A]">{formatValue(row.total)}</span>
          </div>
          <div className="w-full h-5 rounded-full bg-[#E3DDCC] overflow-hidden flex">
            {row.segments.map((seg, i) => seg.value > 0 && (
              <div key={i} style={{ width: `${(seg.value / maxValue) * 100}%`, background: seg.color }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBlock({ label, value, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-[#FBFAF7] border border-[#D9D2C2] rounded-sm p-3 hover:border-[#3B5166] transition-colors">
      <p className="text-[10px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">{label}</p>
      <p className="font-mono text-[15px]">{value || "—"}</p>
    </button>
  );
}

/* ---------- Budget ---------- */

function ProgressBar({ value, max, color = "#3B5166" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-2 rounded-full bg-[#E3DDCC] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function BudgetTab({ budget, itinerary }) {
  const PEOPLE = 2;
  const TARGET_PLANNED = 30000;
  const TARGET_MAX = 40000;
  const [converterEUR, setConverterEUR] = useState("10");

  const grouped = BUDGET_CATEGORIES.map((cat) => ({
    cat,
    items: budget.filter((b) => b.category === cat),
  })).filter((g) => g.items.length > 0);

  // Total já investido (BRL): passagem + hospedagem + custo em reais do câmbio já feito.
  // Só soma itens em BRL — o crédito em euros entra aqui pelo custo de compra, não pelo valor de face.
  const investedBRL = budget
    .filter((b) => b.currency === "BRL")
    .reduce((sum, b) => sum + toNumber(b.amount), 0);
  const pendingExchangeCost = budget.some(
    (b) => b.category === "Dinheiro disponível" && b.currency === "BRL" && !toNumber(b.amount) && b.eurAmount
  );

  // Dinheiro disponível (crédito em euros): total comprado menos o que já foi de fato gasto na viagem em EUR.
  const totalCashEUR = budget
    .filter((b) => b.category === "Dinheiro disponível")
    .reduce((sum, b) => sum + toNumber(b.eurAmount), 0);

  // Gasto na viagem: só o que já está "pago" e não é a própria compra de câmbio (isso é crédito, não gasto).
  const paidItems = budget.filter((b) => b.status === "pago" && b.category !== "Dinheiro disponível");
  const cashSpentEUR = paidItems.filter((b) => b.currency === "EUR").reduce((s, b) => s + toNumber(b.amount), 0);
  const otherPaidBRL = paidItems.filter((b) => b.currency !== "EUR").reduce((s, b) => s + toNumber(b.amount), 0);
  const gastoNaViagemBRL = otherPaidBRL + cashSpentEUR * EUR_TO_BRL_RATE;
  const cashAvailableEUR = totalCashEUR - cashSpentEUR;

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="font-display text-[18px] mb-1">Conversor rápido</p>
        <p className="text-[11px] text-[#8A8375] mb-3">Taxa média usada no app: R$ {EUR_TO_BRL_RATE.toFixed(3)} por euro.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-[10px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Euros</p>
            <div className="flex items-center gap-1 bg-white/60 border border-[#D9D2C2] rounded-sm px-2.5 py-2">
              <span className="text-[13px] text-[#8A8375]">€</span>
              <input
                type="text" inputMode="decimal" value={converterEUR}
                onChange={(e) => setConverterEUR(e.target.value.replace(/[^0-9,.]/g, ""))}
                className="w-full bg-transparent text-[15px] font-mono outline-none"
              />
            </div>
          </div>
          <span className="text-[#8A8375] mt-4">→</span>
          <div className="flex-1">
            <p className="text-[10px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Reais</p>
            <div className="bg-[#F1EDE4] border border-[#D9D2C2] rounded-sm px-2.5 py-2">
              <span className="text-[15px] font-mono text-[#3B5166]">R$ {fmtMoney(toNumber(converterEUR) * EUR_TO_BRL_RATE)}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Total já investido (em reais)</p>
        <p className="font-display text-[26px] text-[#3B5166]">R$ {fmtMoney(investedBRL)}</p>
        <p className="text-[11px] text-[#8A8375] mt-1">Passagem + hospedagem + custo do câmbio já feito.</p>
        {pendingExchangeCost && (
          <p className="text-[11px] text-[#9B2C2C] mt-1">Falta o valor em reais do 2º lote de câmbio — me manda que eu somo aqui.</p>
        )}

        <div className="mt-3.5 space-y-3">
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D]">Meta planejada — R$ {fmtMoney(TARGET_PLANNED)}</span>
              <span className="text-[#8A8375]">{((investedBRL / TARGET_PLANNED) * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={investedBRL} max={TARGET_PLANNED} color="#3B5166" />
            <p className="text-[11px] text-[#8A8375] mt-1">
              {investedBRL <= TARGET_PLANNED
                ? `Faltam R$ ${fmtMoney(TARGET_PLANNED - investedBRL)} pra bater a meta.`
                : `R$ ${fmtMoney(investedBRL - TARGET_PLANNED)} acima da meta planejada.`}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#4A453D]">Teto máximo — R$ {fmtMoney(TARGET_MAX)}</span>
              <span className="text-[#8A8375]">{((investedBRL / TARGET_MAX) * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={investedBRL} max={TARGET_MAX} color="#9B2C2C" />
            <p className="text-[11px] text-[#8A8375] mt-1">Ainda dá R$ {fmtMoney(TARGET_MAX - investedBRL)} até o teto.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Dinheiro disponível na viagem</p>
        <p className="font-display text-[26px] text-[#3B5166]">€ {fmtMoney(cashAvailableEUR)}</p>
        <div className="flex gap-4 mt-2 text-[11px] text-[#8A8375]">
          <span>Comprado: € {fmtMoney(totalCashEUR)}</span>
          <span>Já usado: € {fmtMoney(cashSpentEUR)}</span>
        </div>
        <p className="text-[11px] text-[#6B655A] mt-2 leading-relaxed">
          Esse é o crédito da conta global. Coisas pagas com ele durante a viagem (museus, lanches, etc.) descontam
          daqui — é só marcar o item como "pago" com moeda EUR numa categoria como Passeios ou Alimentação.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Gasto na viagem (já pago)</p>
        <p className="font-display text-[26px] text-[#3B5166]">R$ {fmtMoney(gastoNaViagemBRL)}</p>
        <p className="text-[11px] text-[#8A8375] mt-1">
          {gastoNaViagemBRL === 0
            ? "Nada pago ainda além do câmbio (que conta como crédito, não gasto)."
            : `Inclui € ${fmtMoney(cashSpentEUR)} usados do crédito (≈ R$ ${fmtMoney(cashSpentEUR * EUR_TO_BRL_RATE)}) + demais itens pagos em reais.`}
        </p>
      </SectionCard>

      {grouped.length === 0 && <EmptyHint text="Nenhum gasto ainda. Me manda os valores que eu adiciono aqui." />}

      {grouped.map((g) => (
        <div key={g.cat}>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">{g.cat}</p>
          <div className="space-y-2">
            {g.items.map((item) => (
              <div key={item.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    {item.status === "pago" ? (
                      <CheckCircle2 size={14} className="text-[#3B5166] shrink-0" />
                    ) : (
                      <CircleDashed size={14} className="text-[#A88856] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] truncate">{item.item}</p>
                      <p className="text-[11px] text-[#8A8375]">{item.status === "pago" ? "pago" : "planejado"}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[13px] shrink-0 text-right">
                    {item.eurAmount
                      ? `€ ${fmtMoney(toNumber(item.eurAmount))}${item.amount ? ` · R$ ${fmtMoney(toNumber(item.amount))}` : " · R$ a confirmar"}`
                      : `${item.currency} ${fmtMoney(toNumber(item.amount))}`}
                  </span>
                </div>
                <NoteList text={item.notes} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Navigo Semaine x bilhete avulso</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Tarifas de 2026, por pessoa.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#FBFAF7] border border-[#D9D2C2] rounded-sm p-3">
            <p className="text-[10px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Bilhete avulso (t+)</p>
            <p className="font-mono text-[15px]">€ 2,55</p>
            <p className="text-[11px] text-[#8A8375] mt-1">por viagem, com baldeações em 2h</p>
          </div>
          <div className="bg-[#FBFAF7] border border-[#D9D2C2] rounded-sm p-3">
            <p className="text-[10px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Navigo Semaine</p>
            <p className="font-mono text-[15px]">€ 32,40</p>
            <p className="text-[11px] text-[#8A8375] mt-1">ilimitado, seg a dom, inclui aeroportos</p>
          </div>
        </div>
        <p className="text-[12px] text-[#4A453D] leading-relaxed">
          O Navigo Semaine só pode começar numa segunda-feira — por isso sex (11) a dom (13) precisam ser em
          bilhete avulso de qualquer forma. Comprando o Navigo na segunda (14/09), ele cobre Paris até domingo
          (20/09), incluindo o traslado final pro CDG no dia 18 — ou seja, sai de graça a viagem de volta ao
          aeroporto, que custaria €14 avulso. Break-even: € 32,40 ÷ € 2,55 ≈ <strong>13 viagens</strong>. Com 4
          dias cheios de passeio (seg a qui) mais o traslado do dia 18, é bem provável passar disso — por isso o
          Navigo tende a compensar nessa janela.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Estimativa de gasto diário (necessidades básicas)</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Alimentação + transporte, por pessoa — não inclui compras nem passeios pagos à parte.</p>
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4A453D]">Café da manhã (padaria/café rápido)</span>
            <span className="font-mono">€ 5-8</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4A453D]">Almoço rápido (balcão/takeaway)</span>
            <span className="font-mono">€ 10-15</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4A453D]">Jantar (restaurante casual)</span>
            <span className="font-mono">€ 20-30</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-[#4A453D]">Transporte (metrô/Navigo rateado)</span>
            <span className="font-mono">€ 5-7</span>
          </div>
          <div className="flex justify-between text-[13px] pt-2 border-t border-[#D9D2C2] font-medium">
            <span className="text-[#1C1C1E]">Total por pessoa/dia</span>
            <span className="font-mono text-[#3B5166]">€ 40-60</span>
          </div>
        </div>
        <p className="text-[12px] text-[#4A453D] leading-relaxed">
          Pra {PEOPLE} pessoas em 7 dias cheios (11 a 17/09), isso dá aproximadamente <strong>€ 560 a € 840</strong> só
          em alimentação e transporte básico. Bom comparar esse valor com o "Dinheiro disponível" na Visão geral
          pra ver se o crédito em euros cobre — se os dias saírem mais caros que a estimativa, vale ter um cartão
          internacional como reforço.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3">Por pessoa ({PEOPLE} pessoas)</p>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between"><span className="text-[#4A453D]">Já investido</span><span className="font-mono">R$ {fmtMoney(investedBRL / PEOPLE)}</span></div>
          <div className="flex justify-between"><span className="text-[#4A453D]">Meta planejada</span><span className="font-mono">R$ {fmtMoney(TARGET_PLANNED / PEOPLE)}</span></div>
          <div className="flex justify-between"><span className="text-[#4A453D]">Teto máximo</span><span className="font-mono">R$ {fmtMoney(TARGET_MAX / PEOPLE)}</span></div>
          <div className="flex justify-between"><span className="text-[#4A453D]">Crédito em euros disponível</span><span className="font-mono">€ {fmtMoney(cashAvailableEUR / PEOPLE)}</span></div>
          <div className="flex justify-between"><span className="text-[#4A453D]">Gasto na viagem até agora</span><span className="font-mono">R$ {fmtMoney(gastoNaViagemBRL / PEOPLE)}</span></div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me manda os valores e ajustes pelo chat que eu atualizo pra você.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Itinerary ---------- */

const WEEKDAYS_PT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const [, m, day] = dateStr.split("-");
  return `${WEEKDAYS_PT[d.getDay()]} ${day}/${m}`;
}

const TRIP_START_DATE = "2026-09-11";
function tripDayLabel(dateStr) {
  const start = new Date(TRIP_START_DATE + "T12:00:00");
  const d = new Date(dateStr + "T12:00:00");
  const offset = Math.round((d - start) / 86400000);
  const wd = WEEKDAYS_PT[d.getDay()].replace(".", "");
  return `D${offset} (${wd})`;
}

const CATEGORY_ICONS = {
  passeio: Compass,
  restaurante: Utensils,
  compras: ShoppingBag,
  evento: Ticket,
  transporte: Plane,
  hospedagem: Hotel,
};

function TimelineItem({ item, isLast }) {
  const Icon = CATEGORY_ICONS[item.type] || Compass;
  const color = CATEGORY_COLORS[item.type] || "#3B5166";
  const label = ITINERARY_TYPES.find((t) => t.id === item.type)?.label;
  return (
    <div className="flex gap-2.5">
      <div className="w-11 shrink-0 text-right pt-1.5">
        <span className="text-[11px] font-mono text-[#6B655A]">{item.time || "—"}</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
          <Icon size={12} className="text-white" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#D9D2C2] my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-3.5">
        <div className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-[13px] font-medium">{item.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${color}1f`, color }}>
              {label}
            </span>
          </div>
          {item.costAmount ? (
            <p className="text-[11px] text-[#8A8375] mt-0.5 flex items-center gap-1"><Wallet size={11} /> {item.costCurrency} {fmtMoney(toNumber(item.costAmount))}</p>
          ) : null}
          {item.address && <p className="text-[11px] text-[#8A8375] mt-0.5 flex items-center gap-1"><MapPin size={11} /> {item.address}</p>}
          {item.metro && <p className="text-[11px] text-[#3B5166] mt-0.5">🚇 {item.metro}</p>}
          <NoteList text={item.notes} />
        </div>
      </div>
    </div>
  );
}

function ItineraryTab({ itinerary }) {
  const sorted = [...itinerary].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || ""));
  const grouped = sorted.reduce((acc, i) => {
    const key = i.date || "";
    (acc[key] = acc[key] || []).push(i);
    return acc;
  }, {});
  const tripDates = Object.keys(DAY_PLANS);
  const extraDates = Object.keys(grouped).filter((d) => d && !tripDates.includes(d));
  const noDateItems = grouped[""] || [];

  return (
    <div className="space-y-4">
      {itinerary.length === 0 && <EmptyHint text="Ainda sem passeios. Me manda a lista de lugares que quer visitar em Paris." />}

      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2">Legenda</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {ITINERARY_TYPES.map((t) => {
            const Icon = CATEGORY_ICONS[t.id] || Compass;
            return (
              <span key={t.id} className="flex items-center gap-1.5 text-[11px] text-[#4A453D]">
                <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: CATEGORY_COLORS[t.id] }}>
                  <Icon size={9} className="text-white" />
                </span>
                {t.label}
              </span>
            );
          })}
        </div>
      </SectionCard>

      {[...tripDates, ...extraDates].map((date) => {
        const items = grouped[date] || [];
        const plan = DAY_PLANS[date];
        return (
          <SectionCard key={date}>
            <p className="font-display text-[22px] text-[#9B2C2C] leading-none mb-1">{tripDayLabel(date)}</p>
            <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-0.5">
              {formatDayLabel(date)}{plan ? ` — ${plan.title.replace(/^[A-Za-zç.]+\.\s—\s/, "")}` : ""}
            </p>
            {items.length === 0 ? (
              <p className="text-[11px] text-[#8A8375] italic">Sem atividade específica ainda — me diga se quiser incluir algo nesse dia.</p>
            ) : (
              <div>
                {items.map((item, idx) => (
                  <TimelineItem key={item.id} item={item} isLast={idx === items.length - 1} />
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}

      {noDateItems.length > 0 && (
        <SectionCard>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2">Sem data ainda</p>
          <div className="space-y-2">
            {noDateItems.map((item) => (
              <div key={item.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
                <p className="text-[13px] font-medium">{item.title}</p>
                <p className="text-[11px] text-[#8A8375] capitalize">{ITINERARY_TYPES.find((t) => t.id === item.type)?.label}</p>
                <NoteList text={item.notes} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <p className="text-[11px] text-[#8A8375] leading-relaxed">
          18/09 é o dia da viagem de volta, com o cronograma de checkout do hotel do aeroporto + tax free + embarque.
          O domingo prioriza o Marais, que depende do dia da semana pra funcionar bem; os demais seguem o padrão de
          sair às 7h pros pontos turísticos (só fotos), lojas/cafés no horário comercial, e volta ao hotel até as 20h.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me manda os lugares e ajustes pelo chat que eu atualizo pra você.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Map ---------- */

function mapLinkUrl(q) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// This is a schematic (not geographically precise) overview — real street-tile map
// providers were unreachable from this sandbox across multiple attempts, and what
// actually matters here is seeing where things sit relative to each other and to
// the nearest metro, which this gives clearly without depending on any external
// map service (so it always renders).
const MAP_BOUNDS = { latMin: 48.838, latMax: 48.912, lngMin: 2.285, lngMax: 2.385 };
const MAP_W = 400, MAP_H = 320;

function project(lat, lng) {
  const x = ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * MAP_W;
  const y = ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * MAP_H;
  return { x, y };
}

// Rough label anchors for the neighborhoods in view, just for orientation.
const ZONE_LABELS = [
  { label: "17e · Clichy", x: 60, y: 40 },
  { label: "9e", x: 170, y: 70 },
  { label: "18e", x: 210, y: 15 },
  { label: "1er · Louvre", x: 195, y: 155 },
  { label: "3e/4e · Marais", x: 260, y: 165 },
  { label: "11e", x: 300, y: 130 },
  { label: "7e · Eiffel", x: 90, y: 210 },
  { label: "6e", x: 155, y: 220 },
  { label: "Parc Monceau", x: 60, y: 60 },
];

function usePlaces(itinerary, logistics) {
  return [
    logistics.accommodation.name && {
      id: "hotel",
      title: logistics.accommodation.name,
      category: "hospedagem",
      subtitle: "Hospedagem",
      address: logistics.accommodation.address,
      metro: logistics.accommodation.metro,
      lat: logistics.accommodation.lat,
      lng: logistics.accommodation.lng,
    },
    ...itinerary.filter((i) => i.address).map((i) => ({
      id: i.id,
      title: i.title,
      category: i.type,
      subtitle: ITINERARY_TYPES.find((t) => t.id === i.type)?.label,
      address: i.address,
      metro: i.metro,
      lat: i.lat,
      lng: i.lng,
    })),
  ].filter(Boolean);
}

const LEGEND_ITEMS = [
  { key: "hospedagem", label: "Hospedagem" },
  { key: "passeio", label: "Passeio" },
  { key: "restaurante", label: "Restaurante" },
  { key: "compras", label: "Compras" },
  { key: "evento", label: "Show / Evento" },
  { key: "transporte", label: "Transporte" },
];

function MapTab({ itinerary, logistics }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const places = usePlaces(itinerary, logistics);
  const onMapPlaces = places.filter((p) => getSector(p.address) !== "Giverny (fora de Paris)");
  const withoutCoords = places.filter((p) => !(p.lat && p.lng));
  const filteredPlaces = activeCategory ? onMapPlaces.filter((p) => p.category === activeCategory) : onMapPlaces;
  const filteredPinned = filteredPlaces.filter((p) => p.lat && p.lng);

  const toggleCategory = (key) => {
    setSelectedPlace(null);
    setActiveCategory((prev) => (prev === key ? null : key));
  };

  // group places by neighborhood/sector for daily-itinerary planning
  const sectorGroups = places.reduce((acc, p) => {
    const sector = getSector(p.address);
    if (!sector) return acc;
    (acc[sector] = acc[sector] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Visão geral de onde cada lugar fica e o metrô mais próximo (círculos brancos). Não é um mapa de ruas
          real — é um esquema pra mostrar a distribuição e a proximidade entre os pontos. Toque num pin pros detalhes.
        </p>
        {withoutCoords.length > 0 && (
          <p className="text-[11px] text-[#9B2C2C] mt-2">
            {withoutCoords.length} lugar(es) ainda sem coordenadas — me avisa que eu localizo.
          </p>
        )}
      </SectionCard>

      <SectionCard className="!p-0 overflow-hidden">
        <div className="px-3.5 pt-3.5 pb-3 border-b border-[#D9D2C2]">
          <div className="flex flex-wrap gap-2">
            {LEGEND_ITEMS.map((l) => (
              <button
                key={l.key}
                onClick={() => toggleCategory(l.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                  activeCategory === l.key
                    ? "bg-[#1C1C1E] text-[#EDE9DF] border-[#1C1C1E]"
                    : "bg-white border-[#D9D2C2] text-[#4A453D]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: activeCategory === l.key ? "#EDE9DF" : CATEGORY_COLORS[l.key] }}
                />
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-80 block" style={{ background: "#E7E2D6" }}>
            <path
              d={`M 0 ${MAP_H * 0.62} C ${MAP_W * 0.25} ${MAP_H * 0.5}, ${MAP_W * 0.4} ${MAP_H * 0.72}, ${MAP_W * 0.62} ${MAP_H * 0.6} S ${MAP_W * 0.85} ${MAP_H * 0.42}, ${MAP_W} ${MAP_H * 0.5}`}
              fill="none" stroke="#C7CDD4" strokeWidth="10" strokeLinecap="round" opacity="0.7"
            />
            {!activeCategory && ZONE_LABELS.map((z) => (
              <text key={z.label} x={z.x} y={z.y} fontSize="9" fill="#A39B8A" fontFamily="'Work Sans', sans-serif">
                {z.label}
              </text>
            ))}
            {!activeCategory && METRO_STATIONS.map((s) => {
              const { x, y } = project(s.lat, s.lng);
              return (
                <g
                  key={s.name}
                  onClick={() => setSelectedPlace({ id: s.name, title: s.name, subtitle: "Estação de metrô", address: s.lines, metro: null })}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={x} cy={y} r="5" fill="#fff" stroke="#6B655A" strokeWidth="1.5" />
                </g>
              );
            })}
            {filteredPinned.map((p) => {
              const { x, y } = project(p.lat, p.lng);
              const color = CATEGORY_COLORS[p.category] || "#3B5166";
              const s = 0.9;
              return (
                <g
                  key={p.id}
                  transform={`translate(${x - 12 * s}, ${y - 23 * s}) scale(${s})`}
                  onClick={() => setSelectedPlace(p)}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    fill={color} stroke="#EDE9DF" strokeWidth="1.2"
                  />
                  <circle cx="12" cy="9" r="3" fill="#EDE9DF" />
                </g>
              );
            })}
          </svg>

          {selectedPlace && (
            <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-6px_20px_rgba(0,0,0,0.18)] p-4 pt-3">
              <div className="w-9 h-1 rounded-full bg-[#D9D2C2] mx-auto mb-3" />
              <button onClick={() => setSelectedPlace(null)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#F1EDE4] flex items-center justify-center">
                <X size={14} className="text-[#4A453D]" />
              </button>
              <p className="font-display text-[17px] pr-8">{selectedPlace.title}</p>
              {selectedPlace.subtitle && <p className="text-[12px] text-[#8A8375] mt-0.5">{selectedPlace.subtitle}</p>}
              {selectedPlace.address && <p className="text-[12px] text-[#4A453D] mt-1">{selectedPlace.address}</p>}
              {selectedPlace.metro && <p className="text-[12px] text-[#3B5166] mt-1">🚇 {selectedPlace.metro}</p>}
              {selectedPlace.lat && (
                <a
                  href={mapLinkUrl(selectedPlace.address)}
                  target="_blank" rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 bg-[#3B5166] text-white text-[13px] px-4 py-2 rounded-full"
                >
                  <MapIcon size={14} /> Abrir no Google Maps
                </a>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {places.length === 0 && <EmptyHint text="Nenhum lugar com endereço ainda." />}

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Sugestão de roteiro por região</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Agrupe os passeios de cada região no mesmo dia pra render mais.</p>
        <div className="space-y-3">
          {Object.entries(sectorGroups).map(([sector, items]) => (
            <div key={sector} className="border-l-2 border-[#3B5166] pl-3">
              <p className="text-[13px] font-medium">{sector}</p>
              <ul className="mt-1 space-y-0.5">
                {items.map((p) => (
                  <li key={p.id} className="text-[12px] text-[#4A453D]">
                    • {p.title}{p.metro ? ` — 🚇 ${p.metro}` : ""}
                  </li>
                ))}
              </ul>
              {SECTOR_BATHROOM_TIPS[sector] && (
                <p className="text-[11px] text-[#6B655A] mt-1.5">🚻 {SECTOR_BATHROOM_TIPS[sector]}</p>
              )}
              {sector === "Giverny (fora de Paris)" && (
                <p className="text-[11px] text-[#9B2C2C] mt-1.5">Fica a ~75 km de Paris, por isso não aparece como pin no mapa acima — reserve um dia só pra esse bate-volta.</p>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Banheiros públicos pela cidade</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Opções de confiança fora dos pontos do roteiro.</p>
        <ul className="space-y-1.5 text-[12px] text-[#4A453D]">
          <li>• Grandes magasins: Galeries Lafayette e Printemps (Boulevard Haussmann) — banheiros amplos, de graça.</li>
          <li>• Museus: qualquer museu que visitar (Louvre, Orsay etc.) tem banheiro incluído no ingresso.</li>
          <li>• Cafés/redes: Starbucks e McDonald's costumam liberar sendo cliente (um café ou item pequeno já resolve).</li>
          <li>• Estações grandes de trem (Gare du Nord, Gare de Lyon): banheiros pagos, geralmente ~€1.</li>
          <li>• Sanisettes (cabines públicas verdes nas calçadas): gratuitas, mas variam de limpeza.</li>
        </ul>
      </SectionCard>
    </div>
  );
}



/* ---------- Logistics ---------- */

function ReadRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-0.5">{label}</p>
      <p className="text-[14px]">{value}</p>
    </div>
  );
}

function LogisticsTab({ logistics }) {
  const l = logistics;
  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><CalendarDays size={16} /> Datas da viagem</p>
        <div className="grid grid-cols-2 gap-3">
          <ReadRow label="Ida" value={l.tripStart} />
          <ReadRow label="Volta" value={l.tripEnd} />
        </div>
      </SectionCard>

      <FlightCard label="Ida" flight={l.flights.outbound} />
      <FlightCard label="Volta" flight={l.flights.inbound} />

      <SectionCard>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><Hotel size={16} /> Hospedagem</p>
        <div className="space-y-3">
          <ReadRow label="Nome" value={l.accommodation.name} />
          <ReadRow label="Endereço" value={l.accommodation.address} />
          <ReadRow label="Metrô mais próximo" value={l.accommodation.metro} />
          <div className="grid grid-cols-2 gap-3">
            <ReadRow label="Check-in" value={l.accommodation.checkin} />
            <ReadRow label="Check-out" value={l.accommodation.checkout} />
          </div>
          <ReadRow label="Nº confirmação" value={l.accommodation.confirmation} />
          <ReadRow label="Notas" value={l.accommodation.notes} />
        </div>
      </SectionCard>

      {l.accommodation2 && (
        <SectionCard>
          <p className="font-display text-[18px] mb-3 flex items-center gap-2"><Hotel size={16} /> Hospedagem 2 — véspera da volta</p>
          <div className="space-y-3">
            <ReadRow label="Nome" value={l.accommodation2.name} />
            <ReadRow label="Endereço" value={l.accommodation2.address} />
            <div className="grid grid-cols-2 gap-3">
              <ReadRow label="Check-in" value={l.accommodation2.checkin} />
              <ReadRow label="Check-out" value={l.accommodation2.checkout} />
            </div>
            <ReadRow label="Notas" value={l.accommodation2.notes} />
          </div>
        </SectionCard>
      )}

      {l.transportNotes && (
        <SectionCard>
          <p className="font-display text-[18px] mb-3">Transporte local</p>
          <p className="text-[14px]">{l.transportNotes}</p>
        </SectionCard>
      )}

      <SectionCard>
        <p className="font-display text-[18px] mb-1 flex items-center gap-2"><Sun size={16} /> Lista de malas</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Baseada no clima de Paris em setembro (dias 11-18/09).</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Clima esperado</p>
            <p>Dias entre 18°C e 24°C, noites mais frescas (11-14°C). Chuva passageira é comum (~6-11 dias no mês), geralmente pancadas leves, não tempestades.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Roupas</p>
            <ul className="mt-1 space-y-1">
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Camadas leves (camisetas, blusas finas) pra usar durante o dia.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Um casaco leve ou corta-vento pra noite e manhãs mais frias.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Lenço/echarpe — esquenta e não ocupa espaço na mala.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Calçado confortável pra caminhar bastante (o roteiro tem muita caminhada) + uma opção mais fechada pra dia de chuva.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Itens essenciais</p>
            <ul className="mt-1 space-y-1">
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Guarda-chuva compacto (chuva é rápida e imprevisível).</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Adaptador de tomada (ver card abaixo).</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Power bank — bom pra dias inteiros de passeio usando GPS/câmera.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Espaço extra na mala/uma dobrável — vão voltar com Longchamp e Sabre a mais.</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3">Tomada e voltagem (Brasil → França)</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Tipo de tomada</p>
            <p>França usa os tipos C e E (pino redondo, com aterramento no tipo E). O plugue brasileiro mais antigo (2 pinos redondos) costuma encaixar direto; o novo padrão brasileiro (3 pinos redondos, tipo N) pode não entrar sem adaptador — leve um adaptador simples de dois pinos redondos por garantia.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Voltagem</p>
            <p>França: 230V, 50Hz. Brasil varia entre 127V e 220V conforme a região. Praticamente todo carregador de celular/notebook moderno é bivolt (confira se está escrito "Input: 100-240V" no aparelho) — esses funcionam sem problema. Aparelhos só de 110-127V (secador, chapinha antiga) vão queimar — não leve, ou use um transformador de verdade (adaptador de plugue sozinho não resolve voltagem).</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3">Gorjetas e etiqueta local</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Gorjeta (pourboire)</p>
            <p>Na França o serviço já vem incluso na conta ("service compris") por lei — gorjeta não é obrigatória. Ainda assim, é comum arredondar a conta ou deixar uns € 1-2 por pessoa num café, e ~5-10% num restaurante se o atendimento foi bom. Em bares/cafés de balcão, ninguém espera nada.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Cumprimento</p>
            <p>Ao entrar numa loja pequena, é normal (e esperado) dizer "Bonjour" antes de qualquer coisa — direto ao ponto sem isso é visto como falta de educação. Pra sair, "Merci, au revoir" também é padrão.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Restaurantes</p>
            <p>Pedir a conta costuma exigir sinalizar pro garçom ("l'addition, s'il vous plaît") — ela não vem sozinha como no Brasil. Refeições demoram mais, é parte da cultura, não falta de atenção.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><FileText size={16} /> Regras de imigração e saúde (Brasil → Schengen)</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Passaporte</p>
            <p>A regra oficial da Schengen é validade mínima de <strong>3 meses após a data de saída</strong> do bloco (ou seja, além de 18/09/2026). Mas cias aéreas e alguns balcões de imigração costumam ser mais rígidos e pedir <strong>6 meses</strong> — então o mais seguro é ter o passaporte válido até pelo menos <strong>18/03/2027</strong>.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Seguro viagem</p>
            <p>Obrigatório pra entrar no Espaço Schengen, com cobertura mínima de <strong>€ 30.000</strong> em despesas médicas/hospitalares (inclui repatriação). Não existe acordo de saúde entre Brasil e França, então sem seguro a entrada pode ser barrada.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Visto / ETIAS</p>
            <p>Brasileiro não precisa de visto pra turismo até 90 dias. O ETIAS (autorização eletrônica prévia) só deve entrar em vigor no <strong>4º trimestre de 2026</strong> — depois da viagem (11-18/09) — então não é necessário agora. Vale checar de novo perto da data, caso a data de início mude.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Vacinas</p>
            <p>Nenhuma é obrigatória pra entrar na França vindo direto do Brasil (não há exigência de febre amarela nem outras). Só fica atenção se o voo tiver escala em país de risco (não é o caso do voo Air France/KLM direto GRU-CDG e volta via Amsterdã, que não exige).</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Outros documentos pedidos na fronteira</p>
            <p>Passagem de volta (comprovando que vai sair do Schengen dentro do prazo), reserva de hospedagem, e comprovante de meios financeiros (extrato, cartão internacional ou dinheiro em espécie). O sistema EES (registro biométrico de entrada/saída) já está em implantação — pode pedir foto e digitais na primeira entrada, mas isso é automático, não precisa providenciar nada antes.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-1 flex items-center gap-2"><FileText size={16} /> Alfândega — volta ao Brasil</p>
        <p className="text-[12px] text-[#8A8375] mb-3">Regras da Receita Federal pra quem chega de avião (2026).</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Cota de isenção</p>
            <p><strong>US$ 1.000 por pessoa</strong> em compras feitas fora do Brasil, mais uma cota extra de <strong>US$ 1.000</strong> só pro duty free do aeroporto de chegada (não acumulam). A cota é individual — vocês dois não podem somar as cotas pra um item mais caro.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Onde vocês estão hoje</p>
            <p>Longchamp (€125) + Sabre (€112) já dá uns € 237 (~US$ 255) por enquanto — bem abaixo da cota. Chá, chocolate, café e manteiga da aba Souvenirs somam pouco a mais. Ainda assim, vale ir somando os recibos conforme forem comprando, principalmente se decidirem levar mais coisa.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Alimentos (chá, chocolate, café, manteiga, queijo)</p>
            <p>Produtos industrializados, lacrados e rotulados de fábrica (como os desta viagem) geralmente passam sem problema. O que é restrito/proibido é item <em>in natura</em>: queijo fresco, embutidos, frutas, sementes — não é o caso de nada que está no roteiro de compras de vocês.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Se passar da cota</p>
            <p>É só declarar voluntariamente (formulário e-DBV, dá pra preencher antes mesmo de viajar) e pagar <strong>50% de imposto só sobre o valor excedente</strong> — não tem problema nenhum em declarar, é a opção mais simples e barata se acontecer.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Dinheiro em espécie</p>
            <p>Só precisa declarar se estiver levando/trazendo mais de <strong>US$ 10.000</strong> (ou equivalente) em espécie — bem acima do que vocês estão trocando.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><FileText size={16} /> Checklist de documentos</p>
        <div className="space-y-2">
          {l.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className={`w-5 h-5 shrink-0 border rounded-sm flex items-center justify-center ${d.done ? "bg-[#3B5166] border-[#3B5166]" : "border-[#D9D2C2]"}`}>
                {d.done && <Check size={13} className="text-white" />}
              </span>
              <span className={`text-[13px] ${d.done ? "line-through text-[#8A8375]" : ""}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me conta o que já resolveu (documentos, etc.) pelo chat que eu atualizo o checklist.
        </p>
      </SectionCard>
    </div>
  );
}

function FlightCard({ label, flight }) {
  return (
    <SectionCard>
      <Stub>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><Ticket size={16} /> Voo de {label}</p>
      </Stub>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ReadRow label="Companhia" value={flight.airline} />
          <ReadRow label="Nº do voo" value={flight.flightNumber} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ReadRow label="Data" value={flight.date} />
          <ReadRow label="Partida" value={flight.depart} />
          <ReadRow label="Chegada" value={flight.arrive} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ReadRow label="De" value={flight.from} />
          <ReadRow label="Para" value={flight.to} />
        </div>
        <ReadRow label="Assentos" value={flight.seats} />
        <ReadRow label="Bagagem" value={flight.baggage} />
        <ReadRow label="Refeições" value={flight.meals} />
        <ReadRow label="Localizador" value={flight.confirmation} />
      </div>

      {flight.segments && flight.segments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#D9D2C2]">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2.5">Detalhe da conexão, trecho a trecho</p>
          <div className="space-y-3">
            {flight.segments.map((seg, i) => (
              <div key={i} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
                <p className="text-[12px] font-medium text-[#1C1C1E]">
                  {seg.leg}{seg.flightNumber ? ` — voo ${seg.flightNumber}` : ""}
                </p>
                {seg.from && seg.to && (
                  <p className="text-[12px] text-[#4A453D] mt-1">
                    {seg.from} {seg.depart} → {seg.to} {seg.arrive} <span className="text-[#8A8375]">({seg.date})</span>
                  </p>
                )}
                {!seg.from && (
                  <p className="text-[12px] text-[#4A453D] mt-1">
                    {seg.depart} → {seg.arrive} <span className="text-[#8A8375]">({seg.date})</span>
                  </p>
                )}
                {seg.terminal && <p className="text-[11px] text-[#6B655A] mt-1.5 leading-relaxed">{seg.terminal}</p>}
                {seg.procedure && <NoteList text={seg.procedure} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ---------- Food ---------- */

function StarRating({ value }) {
  if (value == null) {
    return <span className="text-[11px] text-[#8A8375]">sem nota exata — bem avaliado</span>;
  }
  const full = Math.round(value);
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={12} fill={i <= full ? "#A88856" : "none"} stroke="#A88856" />
        ))}
      </span>
      <span className="text-[11px] text-[#8A8375]">{value.toFixed(1)}</span>
    </span>
  );
}

function FoodTab({ food }) {
  const grouped = FOOD_CATEGORIES.map((c) => ({ ...c, items: food.filter((f) => f.category === c.id) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Opções pertinho do LALA Hôtel pra café da manhã, lanche ou jantar sem precisar ir longe do bairro.
        </p>
      </SectionCard>

      {food.length === 0 && <EmptyHint text="Nenhum lugar mapeado ainda." />}

      {grouped.map((g) => (
        <div key={g.id}>
          <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">{g.label}</p>
          <div className="space-y-2.5">
            {g.items.map((item) => (
              <div key={item.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">{item.name}</p>
                  <span className="text-[12px] font-mono text-[#A88856] shrink-0">{item.priceRange}</span>
                </div>
                <p className="text-[11px] text-[#8A8375] mt-0.5 flex items-center gap-1">
                  <MapPin size={11} className="shrink-0" /> {item.address} · {item.walkMinutes} min a pé
                </p>
                <div className="mt-1.5"><StarRating value={item.rating} /></div>
                <ul className="mt-1.5 space-y-1">
                  <li className="flex gap-1.5 text-[11px] text-[#6B655A]">
                    <Leaf size={12} className="shrink-0 mt-0.5 text-[#5B6B4E]" /> <span>{item.vegetarian}</span>
                  </li>
                  <li className="flex gap-1.5 text-[11px] text-[#6B655A]">
                    <Clock size={12} className="shrink-0 mt-0.5" /> <span>{item.hours}</span>
                  </li>
                  <li className="flex gap-1.5 text-[11px] text-[#6B655A]">
                    <CreditCard size={12} className="shrink-0 mt-0.5" /> <span>{item.payment}</span>
                  </li>
                </ul>
                <NoteList text={item.notes} />
                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-[11px] text-[#3B5166] underline mt-1.5 inline-block">
                    {item.linkLabel || "ver cardápio"} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me manda outros lugares que você quer mapear que eu adiciono aqui.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Health ---------- */

function HealthTab() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Farmácias e hospitais de referência perto dos lugares do roteiro, números de emergência da França, e o
          que levar de medicamento.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3 flex items-center gap-2"><HeartPulse size={16} /> Números de emergência</p>
        <div className="space-y-2">
          {EMERGENCY_NUMBERS.map((n) => (
            <div key={n.label} className="flex items-center justify-between text-[13px]">
              <span className="text-[#4A453D]">{n.label}</span>
              <span className="font-mono text-[#9B2C2C]">{n.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="font-display text-[18px] mb-3">Consulado Brasileiro em Paris</p>
        <p className="text-[13px] font-medium">{BRAZIL_CONSULATE.name}</p>
        <p className="text-[11px] text-[#8A8375] mt-1 flex items-center gap-1">
          <MapPin size={11} className="shrink-0" /> {BRAZIL_CONSULATE.address}
        </p>
        <p className="text-[11px] text-[#8A8375] mt-0.5">{BRAZIL_CONSULATE.metro}</p>
        <div className="mt-2 space-y-1">
          <p className="text-[13px] font-mono text-[#9B2C2C]">{BRAZIL_CONSULATE.emergencyPhone}</p>
          <p className="text-[11px] text-[#6B655A]">{BRAZIL_CONSULATE.emergencyNote}</p>
        </div>
        <div className="mt-2">
          <p className="text-[11px] text-[#6B655A]">{BRAZIL_CONSULATE.email} · {BRAZIL_CONSULATE.emailHours}</p>
        </div>
      </SectionCard>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2">Farmácias por região do roteiro</p>
        <div className="space-y-2.5">
          {PHARMACIES.map((p) => (
            <div key={p.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <p className="text-[13px] font-medium">{p.name}</p>
              <p className="text-[11px] text-[#A88856] mt-0.5">{p.zone}</p>
              <p className="text-[11px] text-[#8A8375] mt-1 flex items-center gap-1">
                <MapPin size={11} className="shrink-0" /> {p.address}{p.walkMinutes ? ` · ${p.walkMinutes} min a pé do hotel` : ""}
              </p>
              <p className="text-[11px] text-[#6B655A] mt-1 flex items-center gap-1">
                <Clock size={11} className="shrink-0" /> {p.hours}
              </p>
              <NoteList text={p.notes} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">Hospitais de referência (urgências)</p>
        <div className="space-y-2.5">
          {HOSPITALS.map((h) => (
            <div key={h.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <p className="text-[13px] font-medium">{h.name}</p>
              <p className="text-[11px] text-[#A88856] mt-0.5">{h.zone}</p>
              <p className="text-[11px] text-[#8A8375] mt-1 flex items-center gap-1">
                <MapPin size={11} className="shrink-0" /> {h.address}
              </p>
              <p className="text-[11px] text-[#3B5166] mt-1 font-mono">{h.phone}</p>
              <NoteList text={h.notes} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2 flex items-center gap-1.5"><Pill size={12} /> Medicamentos pra levar</p>
        <SectionCard>
          <p className="font-display text-[16px] mb-1">{MEDICATION_GENERAL_RULE.title}</p>
          <p className="text-[12px] text-[#4A453D] leading-relaxed">{MEDICATION_GENERAL_RULE.text}</p>
        </SectionCard>
        <p className="text-[11px] text-[#6B655A] leading-relaxed mt-2 mb-2.5">
          Pra todos os itens: mantenha na embalagem/caixa original, leve na bagagem de mão, e some só a
          quantidade necessária pro período da viagem (com uma pequena folga). Não é aconselhamento médico —
          confirme com seu médico antes de viajar, principalmente pro baricitinibe e a sertralina.
        </p>
        <div className="space-y-2.5">
          {MEDICATIONS.map((m) => (
            <div key={m.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <p className="text-[13px] font-medium">{m.name}</p>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-1"
                style={{
                  background: m.prescriptionNeeded.startsWith("Recomendado") ? "#9B2C2C1f" : "#5B6B4E1f",
                  color: m.prescriptionNeeded.startsWith("Recomendado") ? "#9B2C2C" : "#5B6B4E",
                }}
              >
                {m.prescriptionNeeded}
              </span>
              <p className="text-[11px] text-[#8A8375] mt-0.5">{m.use}</p>
              <NoteList text={m.notes} />
            </div>
          ))}
        </div>
      </div>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me avisa se quiser que eu mapeie mais algum lugar de saúde ou medicamento.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Wishlist ---------- */

const defaultGifts = [
  {
    id: uid(), person: "Sueli", budgetEUR: 20, giftType: "Chá",
    suggestion: "Mariage Frères (lata ~100g, €14-18) — Marais, 30 Rue du Bourg-Tibourg",
  },
  {
    id: uid(), person: "Eduardo", budgetEUR: 10, giftType: "Café",
    suggestion: "Terres de Café, pacote de grãos (~€9-12) — Batignolles, 33 Rue des Batignolles",
  },
  {
    id: uid(), person: "Larissa", budgetEUR: 20, giftType: "A definir",
    suggestion: "Sugestão: chá Nina's Marie-Antoinette (lata ~100g, €13-16) — 29 Rue Danielle Casanova",
  },
  {
    id: uid(), person: "Jonny", budgetEUR: 4, giftType: "Chocolate",
    suggestion: "Tablete de chocolate francês (Michel Cluizel ou Lindt Excellence, ~€3-4) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Ivone", budgetEUR: 20, giftType: "A definir",
    suggestion: "Sugestão: kit de cosméticos de farmácia francesa (água micelar + óleo, ~€16-20) — City Pharma, 26 Rue du Four",
  },
  {
    id: uid(), person: "Aline", budgetEUR: 20, giftType: "A definir",
    suggestion: "Sugestão: caixa de macarons Ladurée (6 unidades, €16-17) — 21 Rue Bonaparte",
  },
  {
    id: uid(), person: "Marcelo", budgetEUR: 4, giftType: "Chocolate",
    suggestion: "Tablete de chocolate francês (~€3-4) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Henrique e Sabrina", budgetEUR: 5, giftType: "Chocolate",
    suggestion: "1 tablete de chocolate francês pra dividir (~€4-6) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Jaio e Ilma", budgetEUR: 5, giftType: "Chocolate",
    suggestion: "1 tablete de chocolate francês pra dividir (~€4-6) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Celso", budgetEUR: 4, giftType: "Chocolate",
    suggestion: "Tablete de chocolate francês (~€3-4) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Colegas de trabalho (Tati)", budgetEUR: 10, giftType: "Pacote de mini chocolates",
    suggestion: "Saquinho de caramelos/pâtes de fruits avulsos (~100g, €10) — Jacques Genin, 133 Rue de Turenne",
  },
  {
    id: uid(), person: "Colegas de trabalho (Di)", budgetEUR: 10, giftType: "Pacote de mini chocolates",
    suggestion: "Saquinho de caramelos/pâtes de fruits avulsos (~100g, €10) — Jacques Genin, 133 Rue de Turenne",
  },
  {
    id: uid(), person: "Yumi", budgetEUR: 4, giftType: "Chocolate",
    suggestion: "Tablete de chocolate francês (~€3-4) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Miyuki", budgetEUR: 10, giftType: "Chá",
    suggestion: "Mariage Frères ou Nina's, lata pequena (~€10-13) — ver opções acima",
  },
  {
    id: uid(), person: "Kaori", budgetEUR: 4, giftType: "Chocolate",
    suggestion: "Tablete de chocolate francês (~€3-4) — qualquer Monoprix",
  },
  {
    id: uid(), person: "Paulinha", budgetEUR: 10, giftType: "A definir",
    suggestion: "Sugestão: café Terres de Café, pacote pequeno (~€9-12) — Batignolles",
  },
];

const BAG_LUXURY_PYRAMID = [
  {
    tier: "Acessível (onde vocês estão comprando)", color: "#5B6B4E",
    brands: [
      { name: "Longchamp", model: "Le Pliage (nylon)", price: "€ 100-150" },
      { name: "Sézane", model: "Bolsas de couro (Le Baguette, Le Vernon)", price: "€ 150-250" },
    ],
  },
  {
    tier: "Luxo acessível / contemporâneo", color: "#A88856",
    brands: [
      { name: "Polène", model: "Numéro Un / Cyme", price: "€ 330-480" },
      { name: "Le Tanneur", model: "Linha de couro clássica", price: "€ 200-350" },
      { name: "A.P.C.", model: "Bolsas de couro minimalistas", price: "€ 350-550" },
      { name: "Jacquemus", model: "Le Chiquito / Le Bambino", price: "€ 450-750" },
      { name: "Maje / Sandro / Claudie Pierlot", model: "Bolsas de couro do dia a dia", price: "€ 250-400" },
      { name: "Zadig & Voltaire", model: "Bolsas com tachas/estilo rock", price: "€ 300-450" },
      { name: "Ba&sh", model: "Bolsas de couro casual-chique", price: "€ 250-400" },
    ],
  },
  {
    tier: "Luxo tradicional (grife alta)", color: "#C97B4A",
    brands: [
      { name: "Louis Vuitton", model: "Neverfull (canvas monograma)", price: "€ 1.300-1.500" },
      { name: "Dior", model: "Lady Dior (tamanho pequeno)", price: "€ 5.500+" },
      { name: "Céline", model: "Triomphe (canvas/couro)", price: "€ 1.200-2.500" },
      { name: "Chloé", model: "Marcie", price: "€ 1.500-2.500" },
      { name: "Givenchy", model: "Antigona (pequena)", price: "€ 1.500-2.800" },
      { name: "Saint Laurent", model: "Loulou / Envelope pequeno", price: "€ 2.000-2.800" },
      { name: "Balenciaga", model: "Hourglass / City pequena", price: "€ 2.000-2.800" },
      { name: "Lanvin", model: "Bolsas de couro clássicas", price: "€ 1.200-2.000" },
    ],
  },
  {
    tier: "Luxo máximo (griffe de elite)", color: "#9B2C2C",
    brands: [
      { name: "Chanel", model: "Classic Flap (tamanho pequeno)", price: "€ 8.000-10.000+" },
      { name: "Hermès", model: "Birkin", price: "€ 10.000+ (com lista de espera, não é só chegar e comprar)" },
      { name: "Goyard", model: "Saint Louis PM (tote)", price: "€ 2.000-2.500 (marca não faz promoção nunca, e costuma preferir pagamento à vista)" },
    ],
  },
];

const FRENCH_BRANDS = [
  {
    id: uid(), category: "Roupas", name: "Sézane", store: "L'Appartement Paris 4 (Marais)",
    address: "Bains du Marais, região da Rue des Blancs-Manteaux, 75004 Paris",
    avgPrice: "€80-150 (saia/vestido) · €150-220 (suéter de caxemira)",
    notes: "Marca francesa de 'luxo acessível' que virou fenômeno online — ninguém acha que é turística de tão usada pelas parisienses. Peças-chave: suéteres de caxemira, vestidos, sapatilhas e o cardigã Gilet (best-seller). Aberta aos domingos, então cai bem no mesmo dia do Marais.",
  },
  {
    id: uid(), category: "Cosméticos", name: "Marcas de farmácia francesa (Bioderma, Nuxe, La Roche-Posay, Avène, Caudalie)", store: "City Pharma",
    address: "26 Rue du Four, 75006 Paris", metro: "Mabillon (M10) ou Saint-Germain-des-Prés (M4)",
    avgPrice: "€8-15 por item (água micelar, óleo, protetor solar)",
    notes: "A farmácia mais famosa de Paris pra cosmético barato — até 30% mais barato que outras farmácias. Pedidas certeiras: água micelar Bioderma Sensibio H2O, óleo Nuxe Huile Prodigieuse, protetor solar La Roche-Posay. Vá cedo (abre 8h30) pra fugir da multidão. Fica em Saint-Germain, mesma região do GoodJo/Kilo Shop/Luxemburgo.",
  },
  {
    id: uid(), category: "Outros (casa/perfume)", name: "Diptyque", store: "Boutique Diptyque Saint-Germain",
    address: "34 Boulevard Saint-Germain, 75005 Paris", metro: "Maubert-Mutualité (M10)",
    avgPrice: "€52 (vela clássica 190g)",
    notes: "Velas e perfumes de nicho, criados em Paris desde 1961 — a vela Baies (groselha/rosa) é o item mais icônico e um clássico de presente. Preço não é baixo, mas o cheiro é bem 'Paris' mesmo.",
  },
  {
    id: uid(), category: "Outros (concept store)", name: "Merci", store: "Merci Paris",
    address: "111 Boulevard Beaumarchais, 75003 Paris", metro: "Saint-Sébastien – Froissart (M8)",
    avgPrice: "€15-20 (a sacola tote icônica) · variável no resto (moda, casa, design)",
    notes: "Concept store icônico do Haut-Marais — moda, design e itens de casa curados, com um Fiat 500 vintage estacionado na entrada (point de foto). Fechado aos domingos, então não cai no dia do Marais — mas fica bem perto da região do Café Pli/Canal Saint-Martin, dá pra encaixar nesse dia.",
  },
];

/* ---------- Gifts ---------- */

function GiftsTab({ gifts }) {
  const totalBudget = gifts.reduce((s, g) => s + (g.budgetEUR || 0), 0);
  const pendingCount = gifts.filter((g) => g.giftType === "A definir").length;

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-1">Total do orçamento de presentes</p>
        <p className="font-display text-[26px] text-[#3B5166]">€ {fmtMoney(totalBudget)}</p>
        <p className="text-[11px] text-[#8A8375] mt-1">
          {gifts.length} pessoas/grupos{pendingCount > 0 ? ` · ${pendingCount} ainda "a definir" (já com sugestão)` : ""}
        </p>
      </SectionCard>

      {gifts.length === 0 && <EmptyHint text="Nenhum presente na lista ainda." />}

      <div className="space-y-2.5">
        {gifts.map((g) => (
          <div key={g.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium">{g.person}</p>
              <span className="font-mono text-[13px] text-[#3B5166] shrink-0">€ {fmtMoney(g.budgetEUR)}</span>
            </div>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-1"
              style={{
                background: g.giftType === "A definir" ? "#9B2C2C1f" : "#5B6B4E1f",
                color: g.giftType === "A definir" ? "#9B2C2C" : "#5B6B4E",
              }}
            >
              {g.giftType}
            </span>
            <p className="text-[12px] text-[#4A453D] mt-1.5 leading-relaxed">{g.suggestion}</p>
          </div>
        ))}
      </div>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me manda mais nomes, ajustes de orçamento ou trocas de sugestão que eu atualizo pra você.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Compras ---------- */

function ComprasTab({ wishlist, itinerary, souvenirs }) {
  const totalsByCurrency = wishlist.reduce((acc, w) => {
    const total = toNumber(w.price) * (w.quantity || 1);
    acc[w.currency] = (acc[w.currency] || 0) + total;
    return acc;
  }, {});

  const shops = [...itinerary]
    .filter((i) => i.type === "compras")
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Todas as lojas do roteiro num só lugar, mais os itens de compra já decididos com preço e link.
        </p>
      </SectionCard>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#9B2C2C] mb-0.5">Compras imperdíveis</p>
        <p className="text-[11px] text-[#8A8375] mb-2">
          {Object.entries(totalsByCurrency).map(([cur, val]) => `${cur} ${fmtMoney(val)}`).join(" · ") || "—"} já sinalizado
        </p>

        {wishlist.length === 0 && <EmptyHint text="Nada sinalizado ainda. Me manda o link do produto que você quer comprar." />}

        <div className="space-y-2.5">
          {wishlist.map((w) => (
            <div key={w.id} className="bg-white/60 border border-[#9B2C2C]/30 rounded-sm px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-sm shrink-0 flex items-center justify-center"
                    style={{ background: `${w.color || "#A88856"}22` }}
                  >
                    {w.icon === "cutlery" ? (
                      <Utensils size={20} style={{ color: w.color || "#A88856" }} />
                    ) : (
                      <ShoppingBag size={20} style={{ color: w.color || "#A88856" }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{w.item}</p>
                    <p className="text-[11px] text-[#8A8375] mt-0.5">{w.store}{w.storeAddress ? ` · ${w.storeAddress}` : ""}</p>
                  </div>
                </div>
                <span className="font-mono text-[13px] shrink-0 text-right">
                  {w.currency} {fmtMoney(toNumber(w.price))}
                  {w.quantity > 1 ? ` × ${w.quantity}` : ""}
                </span>
              </div>
              {w.quantity > 1 && (
                <p className="text-[11px] text-[#6B655A] mt-1">Total: {w.currency} {fmtMoney(toNumber(w.price) * w.quantity)}</p>
              )}
              <NoteList text={w.notes} />
              {w.link && (
                <a href={w.link} target="_blank" rel="noreferrer" className="text-[11px] text-[#3B5166] underline mt-1.5 inline-block break-all">
                  ver produto
                </a>
              )}
              {w.alternatives && w.alternatives.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-[#D9D2C2]">
                  <p className="text-[10px] tracking-[0.08em] uppercase text-[#A88856] mb-1.5">Alternativas</p>
                  <div className="space-y-2">
                    {w.alternatives.map((alt, i) => (
                      <div key={i}>
                        <p className="text-[12px] font-medium">{alt.name}</p>
                        <p className="text-[11px] text-[#8A8375] mt-0.5">{alt.address}</p>
                        <p className="text-[11px] text-[#6B655A] mt-0.5 leading-relaxed">{alt.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">Lojas do roteiro</p>
        {shops.length === 0 && <EmptyHint text="Nenhuma loja no roteiro ainda." />}
        <div className="space-y-2.5">
          {shops.map((s) => (
            <div key={s.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium">{s.title}</p>
                {s.date && <span className="text-[11px] font-mono text-[#9B2C2C] shrink-0">{tripDayLabel(s.date)}</span>}
              </div>
              {s.address && (
                <p className="text-[11px] text-[#8A8375] mt-0.5 flex items-center gap-1">
                  <MapPin size={11} className="shrink-0" /> {s.address}
                </p>
              )}
              {s.metro && <p className="text-[11px] text-[#3B5166] mt-0.5">🚇 {s.metro}</p>}
              <NoteList text={s.notes} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">Alimentos pra levar pra casa</p>
        <p className="text-[11px] text-[#8A8375] mb-2">Chá, chocolate, café e outros industrializados/lacrados — passam tranquilo na alfândega (ver aba Logística).</p>
        <div className="space-y-2.5">
          {souvenirs.map((s) => (
            <div key={s.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <p className="text-[10px] tracking-[0.08em] uppercase text-[#A88856] mb-0.5">{SOUVENIR_CATEGORIES.find((c) => c.id === s.category)?.label}</p>
              {s.avgPrice && <p className="text-[11px] font-mono text-[#3B5166] mb-0.5">{s.avgPrice}</p>}
              <p className="text-[13px] font-medium">{s.item}</p>
              <p className="text-[11px] text-[#8A8375] mt-0.5">{s.store}</p>
              <p className="text-[11px] text-[#8A8375] mt-1 flex items-center gap-1">
                <MapPin size={11} className="shrink-0" /> {s.address}
              </p>
              {s.metro && <p className="text-[11px] text-[#3B5166] mt-0.5">🚇 {s.metro}</p>}
              <NoteList text={s.notes} />
              {s.link && (
                <a href={s.link} target="_blank" rel="noreferrer" className="text-[11px] text-[#3B5166] underline mt-1.5 inline-block">
                  {s.linkLabel || "ver site"} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-0.5">Pirâmide do luxo — bolsas francesas</p>
        <p className="text-[11px] text-[#8A8375] mb-2">Preço médio de uma bolsa simples em cada marca, do mais acessível ao mais alto — pra situar onde Sézane, Polène e Longchamp ficam.</p>
        <div className="space-y-2.5">
          {BAG_LUXURY_PYRAMID.map((t) => (
            <div key={t.tier} className="border-l-2 pl-3" style={{ borderColor: t.color }}>
              <p className="text-[12px] font-medium" style={{ color: t.color }}>{t.tier}</p>
              <div className="mt-1 space-y-2">
                {t.brands.map((b) => (
                  <div key={b.name} className="text-[12px]">
                    <p className="text-[#4A453D]">
                      <span className="font-medium">{b.name}</span> <span className="text-[#8A8375]">— {b.model}</span>
                    </p>
                    <p className="font-mono text-[#6B655A]">{b.price}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionCard>
        <p className="font-display text-[18px] mb-1">Risco de falsificação nos brechós</p>
        <div className="space-y-3 text-[12px] text-[#4A453D] leading-relaxed">
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">A lei francesa é séria</p>
            <p>Comprar ou transportar produto falsificado na França é crime — até 3 anos de prisão e € 300.000 de multa (chega a 5 anos/€ 500.000 em caso de revenda). Vale tanto pra bolsa quanto pra qualquer item com marca.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Free'p'Star, Kilo Shop e Alatone — risco baixo</p>
            <p>São brechós de moda em geral (roupa vintage, peças por peso), não especializados em bolsas de grife — dificilmente vão ter réplica de luxo em circulação, porque simplesmente não é o produto que eles vendem.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">GoodJo Vintage — risco moderado, exige atenção</p>
            <p>Esse sim é brechó de luxo de verdade (Hermès, Chanel, YSL, Dior) — é onde vale prestar atenção. Brechós de luxo sérios fazem autenticação profissional e dão documentação/nota fiscal; se a loja não souber comprovar procedência ou fugir da pergunta, não vale o risco.</p>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Sinais de alerta</p>
            <ul className="mt-1 space-y-1">
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Preço muito abaixo do valor de mercado do modelo (pesquise antes de ir).</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Cheiro forte de plástico/cola, costura torta ou acabamento interno malfeito.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Loja sem nota fiscal ou que evita explicar a procedência da peça.</li>
              <li className="flex gap-1.5"><span className="text-[#A88856] shrink-0">•</span> Vários exemplares idênticos do mesmo modelo em cores/tamanhos diferentes disponíveis na hora.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[13px] text-[#1C1C1E]">Onde não tem esse risco</p>
            <p>As lojas oficiais das marcas (Longchamp, Sézane, Uniqlo, Muji) e o restante do roteiro não têm nenhum risco de falsificação — é só nos brechós de luxo (GoodJo) que vale essa atenção extra.</p>
          </div>
        </div>
      </SectionCard>

      <div>
        <p className="text-[11px] tracking-[0.08em] uppercase text-[#6B655A] mb-2 mt-2">Marcas francesas imperdíveis</p>
        <p className="text-[11px] text-[#8A8375] mb-2">Roupas, cosméticos e outros — coisas que só valem a pena comprar sendo francesas mesmo.</p>
        <div className="space-y-2.5">
          {FRENCH_BRANDS.map((b) => (
            <div key={b.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm px-3 py-2.5">
              <p className="text-[10px] tracking-[0.08em] uppercase text-[#A88856] mb-0.5">{b.category}</p>
              {b.avgPrice && <p className="text-[11px] font-mono text-[#3B5166] mb-0.5">{b.avgPrice}</p>}
              <p className="text-[13px] font-medium">{b.name}</p>
              <p className="text-[11px] text-[#8A8375] mt-0.5">{b.store}</p>
              <p className="text-[11px] text-[#8A8375] mt-1 flex items-center gap-1">
                <MapPin size={11} className="shrink-0" /> {b.address}
              </p>
              {b.metro && <p className="text-[11px] text-[#3B5166] mt-0.5">🚇 {b.metro}</p>}
              <NoteList text={b.notes} />
            </div>
          ))}
        </div>
      </div>

      <SectionCard>
        <p className="text-[12px] text-[#6B655A] leading-relaxed">
          Este app é só de leitura — me manda o link do produto ou a loja nova que eu adiciono aqui.
        </p>
      </SectionCard>
    </div>
  );
}

/* ---------- Outfits ---------- */

function FlatLayGrid({ images }) {
  if (!images || images.length === 0) return null;

  const Cell = ({ img, flexGrow = 1 }) => (
    <div
      className="flex items-center justify-center bg-white rounded-sm overflow-hidden"
      style={{ flex: flexGrow }}
    >
      <img
        src={img.url} alt={img.label || ""}
        className="max-w-full max-h-full object-contain"
        style={{ maxHeight: "100%" }}
        onError={(e) => { e.target.style.display = "none"; }}
      />
    </div>
  );

  if (images.length === 1) {
    return (
      <div className="flex p-2 bg-[#F1EDE4]" style={{ height: 220 }}>
        <Cell img={images[0]} />
      </div>
    );
  }

  const [main, ...rest] = images;
  return (
    <div className="flex gap-1.5 p-1.5 bg-[#F1EDE4]" style={{ height: 220 }}>
      <div className="flex" style={{ flex: 1.1 }}>
        <Cell img={main} />
      </div>
      <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
        {rest.map((img, i) => (
          <Cell key={i} img={img} />
        ))}
      </div>
    </div>
  );
}

function OutfitsTab({ outfits }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-[13px] text-[#4A453D] leading-relaxed">
          Manda as fotos das roupas (ou o link) pelo chat que eu monto os looks aqui pra você.
        </p>
      </SectionCard>

      {outfits.length === 0 && <EmptyHint text="Nenhum look salvo ainda." />}

      <div className="space-y-3">
        {outfits.map((o, idx) => (
          <div key={o.id} className="bg-white/60 border border-[#D9D2C2] rounded-sm overflow-hidden">
            <p className="font-display text-[15px] tracking-wide uppercase px-3 pt-2.5 pb-1.5">
              {idx + 1}. {o.occasion}
            </p>
            {o.images && o.images.length > 0 ? (
              <FlatLayGrid images={o.images} />
            ) : (
              <div className="w-full h-24 flex items-center justify-center bg-[#F1EDE4]">
                <WeatherIcon w={o.weather} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherIcon({ w }) {
  if (w === "chuva") return <CloudRain size={20} className="text-[#3B5166]" />;
  return <Sun size={20} className="text-[#A88856]" />;
}
