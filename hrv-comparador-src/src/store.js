// Persistencia: localStorage (fonte offline) + sincronizacao no Firebase RTDB
// via REST (Receita 1 do RECEITA-APPS.md). No nao sensivel: planos/hrv-comparador-dt2026.
import { useEffect, useRef, useState } from 'react'

const SYNC_URL =
  'https://apps-4b887-default-rtdb.firebaseio.com/planos/hrv-comparador-dt2026'

let syncStamp = 0

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

async function loadKey(key, fallback) {
  // tenta a nuvem, cai para o localStorage, e por fim para o seed
  try {
    const r = await fetch(`${SYNC_URL}/${key}.json`, { cache: 'no-store' })
    if (r.ok) {
      const v = await r.json()
      if (v != null) {
        try { localStorage.setItem(key, v) } catch (e) {}
        return JSON.parse(v)
      }
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    return fallback
  }
}

async function saveKey(key, value) {
  const s = JSON.stringify(value)
  try { localStorage.setItem(key, s) } catch (e) {}
  try {
    await fetch(`${SYNC_URL}/${key}.json`, { method: 'PUT', body: JSON.stringify(s) })
    syncStamp = Date.now()
    fetch(`${SYNC_URL}/_at.json`, { method: 'PUT', body: JSON.stringify(syncStamp) }).catch(() => {})
  } catch (e) {}
}

// recarrega ao voltar ao app se alguem gravou depois (outro aparelho)
fetch(`${SYNC_URL}/_at.json`, { cache: 'no-store' })
  .then((r) => r.json())
  .then((v) => { if (typeof v === 'number') syncStamp = v })
  .catch(() => {})

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return
    fetch(`${SYNC_URL}/_at.json`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((v) => { if (typeof v === 'number' && v > syncStamp + 1500) location.reload() })
      .catch(() => {})
  })
}

// Hook: um estado sincronizado por chave. Carrega uma vez, salva a cada mudanca.
export function useSynced(key, seed) {
  const [value, setValue] = useState(seed)
  const [ready, setReady] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    let alive = true
    loadKey(key, seed).then((v) => {
      if (!alive) return
      setValue(v)
      setReady(true)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!ready) return
    if (first.current) { first.current = false; return }
    saveKey(key, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready])

  return [value, setValue, ready]
}

// ---------- DADOS INICIAIS (seed) ----------

export const SEED_DEALERS = [
  {
    id: 'd-honda-jafet',
    nome: 'Honda SP Japan - Ricardo Jafet',
    grupo: 'Honda SP Japan',
    tipo: 'Honda autorizada',
    endereco: 'Av. Dr. Ricardo Jafet, 1920 (unidade 1450) - Ipiranga, São Paulo - SP',
    telefone: '(11) 2179-7000',
    googleNota: 4.2,
    googleAval: 1700,
    reclameNota: 6.0,
    reclameReput: 'Regular',
    reclameResolvidas: 70,
    confiabilidade: 'Média',
    status: 'ok',
    pontosFortes:
      'Honda autorizada de verdade (faz fluido do CVT no padrão original); vendas e atendimento geralmente bem avaliados; volume alto de avaliações (nota sólida, 4,2 com 1.700 avaliações).',
    pontosAtencao:
      'Reclamações sobre pós-venda/revisão (relato de "itens voltaram queimados para serem cobrados"); relato de defeito escondido em seminovo (rasgo em banco sob o tapete); avaliação de carro na troca costuma vir abaixo do mercado. CONFERIR CARRO ITEM POR ITEM NA ENTREGA e exigir tudo discriminado na nota.'
  },
  {
    id: 'd-flora-motors',
    nome: 'Honda Flora Motors',
    grupo: 'Flora Motors',
    tipo: 'Honda autorizada',
    endereco: 'Av. Washington Luís, 3709 - Chácara Monte Alegre (Santo Amaro), São Paulo - SP',
    telefone: '(11) 5685-7100',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada (faz o fluido do CVT no padrão original de fábrica).',
    pontosAtencao:
      'Nota do Google, Reclame Aqui e % de reclamações resolvidas ainda NÃO confirmados — conferir antes de decidir (preencher no cadastro depois de ligar/visitar).'
  },
  {
    id: 'd-dealer-berrini',
    nome: 'Dealer Honda - Berrini',
    grupo: 'Dealer Honda',
    tipo: 'Honda autorizada',
    endereco: 'Av. Dr. Chucri Zaidan, 45 - Vila Cordeiro (Brooklin/Berrini), São Paulo - SP',
    telefone: '(11) 2112-2555',
    googleNota: 4.2,
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada; grande estrutura na região da Berrini/Brooklin (mesmo grupo da unidade Nações Unidas).',
    pontosAtencao:
      'Nota Google ~4,2 (nº de avaliações a confirmar). Reclame Aqui e % resolvidas ainda não confirmados; há relatos mistos sobre recall/pós-venda — conferir.'
  },
  {
    id: 'd-dealer-nacoes',
    nome: 'Dealer Honda - Nações Unidas',
    grupo: 'Dealer Honda',
    tipo: 'Honda autorizada',
    endereco: 'Av. das Nações Unidas, 21621 - Jurubatuba (Brooklin), São Paulo - SP',
    telefone: '(11) 3585-9393',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada; mesmo grupo Dealer da unidade Berrini.',
    pontosAtencao:
      'Nota do Google, Reclame Aqui e % resolvidas ainda NÃO confirmados — conferir antes de decidir.'
  },
  {
    id: 'd-daitan-jabaquara',
    nome: 'Honda Daitan - Jabaquara',
    grupo: 'Honda Daitan',
    tipo: 'Honda autorizada',
    endereco: 'Av. Jabaquara, 2371 - Mirandópolis, São Paulo - SP',
    telefone: '(11) 5591-0140',
    googleNota: 4.2,
    googleAval: 35,
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada do grupo Daitan (rede com várias unidades na capital).',
    pontosAtencao:
      'Google 4,2 (35 avaliações). Reclame Aqui e % resolvidas ainda NÃO confirmados — conferir.'
  },
  {
    id: 'd-daitan-pompeia',
    nome: 'Honda Daitan - Pompéia',
    grupo: 'Honda Daitan',
    tipo: 'Honda autorizada',
    endereco: 'R. Carlos Vicari, 154 - Barra Funda, São Paulo - SP',
    telefone: '(11) 2102-0999',
    googleNota: '',
    googleAval: 37,
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada do grupo Daitan.',
    pontosAtencao:
      'Nota-estrela do Google (só o nº de avaliações ~37 foi achado), Reclame Aqui e % resolvidas ainda NÃO confirmados — conferir.'
  },
  {
    id: 'd-daitan-sumare',
    nome: 'Honda Daitan - Sumaré',
    grupo: 'Honda Daitan',
    tipo: 'Honda autorizada',
    endereco: 'Av. Sumaré, 1744 - Perdizes, São Paulo - SP',
    telefone: '(11) 3675-0655',
    googleNota: '',
    googleAval: 18,
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada do grupo Daitan.',
    pontosAtencao:
      'Nota-estrela do Google (só o nº de avaliações ~18 foi achado), Reclame Aqui e % resolvidas ainda NÃO confirmados — conferir.'
  },
  {
    id: 'd-daitan-ibirapuera',
    nome: 'Honda Daitan - Ibirapuera',
    grupo: 'Honda Daitan',
    tipo: 'Honda autorizada',
    endereco: 'Av. Ibirapuera, 2771 - Indianópolis, São Paulo - SP',
    telefone: '(11) 5536-9966',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Honda autorizada do grupo Daitan.',
    pontosAtencao:
      'Nota do Google, Reclame Aqui e % resolvidas ainda NÃO confirmados — conferir.'
  },
  {
    id: 'd-hpoint',
    nome: 'H Point (Honda)',
    grupo: 'H Point',
    tipo: 'Honda autorizada',
    endereco: '',
    telefone: '',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes: 'Rede Honda autorizada (H Point) — unidades na capital de SP a cadastrar.',
    pontosAtencao:
      'FALTAM DADOS: endereço, telefone, nota do Google, Reclame Aqui e % resolvidas das unidades H Point. A busca web bateu o limite; completar depois (ou pelo site oficial da Honda).'
  },
  {
    id: 'd-quest',
    nome: 'Quest Multimarcas',
    grupo: 'Quest Multimarcas',
    tipo: 'Multimarcas',
    endereco: '',
    telefone: '',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: '',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    status: 'aguardando',
    pontosFortes:
      'Vendedor José Roberto. O HR-V EXL anunciado tem laudo cautelar 100% aprovado e garantia da loja de 3 meses (motor e câmbio).',
    pontosAtencao:
      'É MULTIMARCAS (não Honda autorizada) — o fluido do CVT precisa ser confirmado/feito no padrão Honda. Endereço, telefone, Google e Reclame Aqui a preencher.'
  }
]

// Revisão do seed de concessionárias: ao subir, a migração idempotente
// (App.jsx) insere no nó da nuvem as lojas do seed que faltarem (por id) e
// preenche campos vazios (grupo/status/googleNota/googleAval) a partir do
// seed — uma única vez, sem sobrescrever o que o usuário digitou.
export const SEED_DEALERS_REV = 5

export const SEED_CARS = [
  {
    id: 'c-lx-jafet',
    dealershipId: 'd-honda-jafet',
    versao: 'LX',
    anoModelo: '2017/2018',
    cor: 'Cinza',
    km: 107000,
    preco: 85430,
    custoExtra: 2500,
    unicoDono: 'sim',
    historicoManutencao: 'sim',
    cvtTrocado: 'vao',
    garantia: '3 meses motor e câmbio + 7 dias para qualquer defeito',
    reparos:
      'Trinca no para-choque traseiro (canto direito); amassados na lataria que vão para o martelinho de ouro (sem pintura); revisão a ser feita.',
    pros: [
      'Dona única com papelada de manutenção completa (raro e valioso)',
      'Honda autorizada vai trocar o fluido do CVT no padrão correto',
      'Garantia de 3 meses cobrindo motor e câmbio',
      'Preço justo (R$ 85.430, abaixo do mercado do EXL)',
      'Mecânica idêntica ao EXL (não se perde nada em motor/câmbio/suspensão)',
      'KM relativamente controlado para o ano (107k, uso leve recente)'
    ],
    contras: [
      'Versão de entrada: sem couro, sem multimídia boa, sem câmera de fábrica',
      'Precisa gastar ~R$ 2.500 em multimídia + câmera',
      'Fluido do CVT nunca foi trocado em 107k (risco a mitigar com a troca)',
      'Tem trinca no para-choque e amassados (indo pro martelinho)',
      'Loja tem ressalvas de pós-venda e transparência em seminovo (conferir tudo na entrega)',
      'Não permite test-drive nem tirar o carro para inspeção'
    ],
    obs:
      'Preço: R$ 84.000 (baixaram de 84.900) + R$ 1.300 documentação + R$ 130 laudo = R$ 85.430. ' +
      'Mecânica IDÊNTICA às versões EX/EXL (mesmo motor 1.8 140cv, mesmo CVT, mesma suspensão/buchas - só muda equipamento). ' +
      'Ponto crítico é confirmar o fluido do CVT na revisão (nunca trocado em 107k) e exigir discriminado na nota. ' +
      'Levar mecânico de confiança para avaliar no pátio antes de fechar.',
    status: 'favorito'
  },
  {
    id: 'c-exl-quest',
    dealershipId: 'd-quest',
    versao: 'EXL',
    anoModelo: '2017',
    cor: '',
    km: 81000,
    preco: '',
    custoExtra: 0,
    unicoDono: 'sim',
    historicoManutencao: 'sim',
    cvtTrocado: 'nao',
    garantia: '3 meses motor e câmbio (garantia da loja)',
    reparos: 'Nada relatado. Sem sinistro, sem batidas; laudo cautelar 100% aprovado.',
    pros: [
      'Único dono',
      'Laudo cautelar 100% aprovado (sem sinistro, sem batidas)',
      'Revisões feitas na concessionária até 81.000 km',
      'Bancos bem conservados',
      'Versão EXL: já vem com couro, multimídia e câmera de fábrica (não precisa gastar extra)',
      'Garantia da loja de 3 meses (motor e câmbio)'
    ],
    contras: [
      'Loja multimarcas (não Honda autorizada) — fluido do CVT precisa ser conferido/feito no padrão Honda',
      'Preço ainda a confirmar',
      'Cor a confirmar'
    ],
    obs:
      'HONDA HR-V 1.8 16V FLEX EXL 4P AUTOMÁTICO 2017. Vendedor José Roberto (Quest Multimarcas). ' +
      'KM de referência 81.000 (revisões na concessionária até essa marca) — confirmar a KM atual. ' +
      'Fluido do CVT: confirmar se/quando foi trocado. Manuais + laudo cautelar recebidos (laudo aprovado).',
    status: 'analise'
  }
]

// Revisão do seed de carros: a migração (App.jsx) insere no nó da nuvem os
// carros do seed que faltarem (por id), uma única vez — sem duplicar nem
// ressuscitar os apagados de propósito.
export const SEED_CARS_REV = 1

export const DEFAULT_WEIGHTS = {
  // do mais importante ao menos importante (peso 1 a 5)
  procedencia: 5, // Procedência / CVT comprovado
  km: 4,
  preco: 3,
  equipamento: 2,
  confiabilidade: 1 // confiabilidade da loja
}
