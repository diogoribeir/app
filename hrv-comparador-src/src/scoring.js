// Sistema de pontuacao configuravel.
// Cada carro recebe sub-notas 0-100 em 5 criterios; a nota final e a media
// ponderada pelos pesos definidos pelo usuario.

export const CRITERIA = [
  { key: 'procedencia', label: 'Procedência / CVT' },
  { key: 'km', label: 'KM' },
  { key: 'preco', label: 'Preço' },
  { key: 'equipamento', label: 'Equipamento' },
  { key: 'confiabilidade', label: 'Confiab. da loja' }
]

export function custoEfetivo(car) {
  return (Number(car.preco) || 0) + (Number(car.custoExtra) || 0)
}

// Procedencia/CVT: nota absoluta pela documentacao e pelo fluido do CVT.
function scoreProcedencia(car) {
  let s = 0
  if (car.unicoDono === 'sim') s += 30
  if (car.historicoManutencao === 'sim') s += 30
  else if (car.historicoManutencao === 'parcial') s += 15
  if (car.cvtTrocado === 'sim') s += 40
  else if (car.cvtTrocado === 'vao') s += 25
  return Math.max(0, Math.min(100, s))
}

// Equipamento: nota absoluta pela versao.
function scoreEquipamento(car) {
  const map = { LX: 25, EX: 50, EXL: 75, Touring: 100 }
  return map[car.versao] ?? 50
}

// Confiabilidade da loja: mistura o campo manual com Google e Reclame Aqui.
function scoreConfiabilidade(dealer) {
  if (!dealer) return 50
  const confMap = { Alta: 100, Média: 60, Baixa: 25 }
  const conf = confMap[dealer.confiabilidade] ?? 50
  const google = dealer.googleNota ? (Number(dealer.googleNota) / 5) * 100 : conf
  const reclame = dealer.reclameNota ? (Number(dealer.reclameNota) / 10) * 100 : conf
  return Math.round(0.5 * conf + 0.25 * google + 0.25 * reclame)
}

// Notas relativas (menor e melhor) normalizadas dentro do conjunto avaliado.
function relativeLowerBetter(values, value) {
  const nums = values.filter((v) => Number.isFinite(v))
  if (nums.length === 0 || !Number.isFinite(value)) return 50
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (max === min) return 100
  return Math.round((100 * (max - value)) / (max - min))
}

// Calcula sub-notas de todos os carros (km e preco sao relativos ao grupo).
export function scoreAll(cars, dealersById, weights) {
  const kmVals = cars.map((c) => Number(c.km))
  const precoVals = cars.map((c) => custoEfetivo(c))

  const totalW =
    (weights.procedencia || 0) +
    (weights.km || 0) +
    (weights.preco || 0) +
    (weights.equipamento || 0) +
    (weights.confiabilidade || 0)

  return cars.map((car) => {
    const subs = {
      procedencia: scoreProcedencia(car),
      km: relativeLowerBetter(kmVals, Number(car.km)),
      preco: relativeLowerBetter(precoVals, custoEfetivo(car)),
      equipamento: scoreEquipamento(car),
      confiabilidade: scoreConfiabilidade(dealersById[car.dealershipId])
    }
    const weighted =
      subs.procedencia * (weights.procedencia || 0) +
      subs.km * (weights.km || 0) +
      subs.preco * (weights.preco || 0) +
      subs.equipamento * (weights.equipamento || 0) +
      subs.confiabilidade * (weights.confiabilidade || 0)
    const score = totalW > 0 ? Math.round(weighted / totalW) : 0
    return { car, subs, score }
  })
}
