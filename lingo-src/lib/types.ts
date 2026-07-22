// Tipos centrais do Lingo.

export type Nivel = "iniciante" | "basico" | "intermediario";

/** Perfil do aluno (guardado no aparelho). */
export interface Usuario {
  id: string;
  nome: string;
  nivel: Nivel;
  metaDiariaXP: number; // 20 | 40 | 60
  criadoEm: string; // ISO yyyy-mm-dd
}

// ── Camada A — fatos determinísticos (lookup, ~100%) ────────────────
export interface Conjugacao {
  infinitivo: string;
  traducao: string;
  presente: Record<string, string>; // pessoa -> forma
}

export interface Lexema {
  palavra: string;
  genero: "m" | "f" | "—";
  traducao: string;
}

// ── Camada B — conteúdo curado/verificado (RAG) ─────────────────────
export interface ItemConteudo {
  id: string;
  tipo: "frase" | "regra" | "vocab";
  alvo: string; // no idioma-alvo (francês)
  traducao: string; // na língua materna
  contexto: string; // ex.: "restaurante"
  fonte: string; // ex.: "curado"
  status: "verificado" | "pendente";
  desmontado?: string; // frase "desmontada" peça por peça
  pronuncia?: string; // pronúncia simplificada para PT-BR
  // ── só para tipo "vocab" (aba Vocabulário / baralho de cards) ──────
  emoji?: string; // figura do card (padrão visual do app; ex.: "🥖")
  imagem?: string | null; // caminho de ilustração/foto futura (por ora null)
  tema?: string; // agrupador do baralho (ex.: "comida", "numeros")
  genero?: "m" | "f" | "—"; // gênero do substantivo, quando fizer sentido
}

// ── Gramática (conteúdo curado, ponte PT-BR → FR) ───────────────────
export interface ExemploGramatica {
  fr: string;
  pt: string;
  pronuncia?: string;
}

export interface PerguntaQuiz {
  pergunta: string;
  opcoes: string[];
  correta: number; // índice em opcoes
  explicacao: string;
}

export interface TopicoGramatica {
  id: string;
  emoji: string;
  cor: string; // token de cor da unidade (azul, verde, roxo…)
  titulo: string;
  subtitulo: string;
  status: "verificado" | "pendente";
  fonte: string;
  secoes: { titulo: string; corpo: string }[];
  exemplos: ExemploGramatica[];
  quiz: PerguntaQuiz[];
  /** Infinitivos cuja tabela (camada A) deve ser exibida no tópico. */
  conjugacoes?: string[];
}

// ── Curso (trilha de unidades e lições) ─────────────────────────────
export type CorUnidade = "verde" | "azul" | "roxo" | "laranja" | "vermelho" | "ciano";

export interface Licao {
  id: string;
  tipo: "frases" | "gramatica";
  titulo: string;
  /** ids de ItemConteudo (tipo === "frases"). */
  itemIds?: string[];
  /** id de TopicoGramatica (tipo === "gramatica"). */
  gramaticaId?: string;
}

export interface Unidade {
  id: string;
  emoji: string;
  titulo: string;
  descricao: string;
  cor: CorUnidade;
  licoes: Licao[];
}

// ── Cenas ao vivo (roleplay determinístico, conteúdo curado) ────────
export interface OpcaoDialogo {
  fr: string;
  pt: string;
  ok: boolean;
  /** Feedback bem-humorado quando a escolha não cabe na cena. */
  porQue?: string;
}

export interface TurnoDialogo {
  falaFR: string;
  falaPT: string;
  pronuncia?: string;
  /** O que o aluno precisa fazer, em português. */
  objetivo: string;
  opcoes: OpcaoDialogo[];
}

export interface Dialogo {
  id: string;
  titulo: string;
  contexto: string;
  emoji: string;
  papel: string; // ex.: "o garçom"
  status: "verificado" | "pendente";
  fonte: string;
  intro: string;
  final: string;
  turnos: TurnoDialogo[];
}

// ── Exercícios (gerados deterministicamente do conteúdo verificado) ──
export type Exercicio =
  | { tipo: "apresentar"; item: ItemConteudo }
  | {
      tipo: "escolher";
      direcao: "pt-fr" | "fr-pt";
      item: ItemConteudo;
      opcoes: string[];
      correta: string;
    }
  | { tipo: "montar"; item: ItemConteudo; pecas: string[]; alvoTokens: string[] }
  | { tipo: "ouvir"; item: ItemConteudo; opcoes: string[]; correta: string }
  | { tipo: "falar"; item: ItemConteudo };

// ── Estrutura de uma resposta do tutor (camada C, já validada) ──────
export interface Correcao {
  erro: string;
  correto: string;
  regra_pt: string;
  tipo: string;
}

export interface VocabNovo {
  alvo: string;
  traducao: string;
  desmontado: string;
}

export interface RespostaTutor {
  resposta: string; // texto natural e encorajador
  correcoes: Correcao[];
  vocab_novo: VocabNovo[];
  audio_texto: string[]; // frases a ouvir
  proxima_meta: string;
}

/** Veredito do avaliador (camada C — a "guarda"). */
export interface VeredictoAvaliador {
  gramatica_ok: boolean;
  natural: boolean;
  nivel_ok: boolean;
  problemas: string[];
}

export interface TurnoChat {
  papel: "aluno" | "tutor";
  texto: string;
  estruturado?: RespostaTutor;
}
