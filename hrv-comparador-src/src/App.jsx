import React, { useMemo, useState } from 'react'
import {
  useSynced, uid, SEED_CARS, SEED_DEALERS, DEFAULT_WEIGHTS
} from './store.js'
// SEED_CARS/SEED_DEALERS sao os dados iniciais pre-cadastrados (usados como seed nos hooks)
import { CRITERIA, custoEfetivo, scoreAll } from './scoring.js'

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const kmFmt = (n) => (Number(n) || 0).toLocaleString('pt-BR') + ' km'
// numero no formato BR (virgula decimal): 4.2 -> "4,2", 1700 -> "1.700"
const numBr = (n, dec = 1) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec })

const STATUS = [
  { v: 'analise', l: 'Em análise', cls: 'st-analise' },
  { v: 'favorito', l: 'Favorito', cls: 'st-favorito' },
  { v: 'fechado', l: 'Fechado', cls: 'st-fechado' },
  { v: 'descartado', l: 'Descartado', cls: 'st-descartado' }
]
const statusMeta = (v) => STATUS.find((s) => s.v === v) || STATUS[0]

const YESNO = { sim: 'Sim', nao: 'Não', parcial: 'Parcial', vao: 'Vão trocar' }

export default function App() {
  const [tab, setTab] = useState('carros')
  const [dealers, setDealers] = useSynced('dealers', SEED_DEALERS)
  const [cars, setCars] = useSynced('cars', SEED_CARS)
  const [weights, setWeights] = useSynced('weights', DEFAULT_WEIGHTS)

  const [carForm, setCarForm] = useState(null) // objeto em edicao ou null
  const [dealerForm, setDealerForm] = useState(null)

  const dealersById = useMemo(() => {
    const m = {}
    dealers.forEach((d) => (m[d.id] = d))
    return m
  }, [dealers])

  function exportJSON() {
    const blob = new Blob(
      [JSON.stringify({ exportadoEm: new Date().toISOString(), dealers, cars, weights }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hrv-comparador-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // --- CRUD carros ---
  function saveCar(c) {
    setCars((prev) => {
      const exists = prev.some((x) => x.id === c.id)
      return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]
    })
    setCarForm(null)
  }
  function removeCar(id) {
    if (!confirm('Excluir este carro?')) return
    setCars((prev) => prev.filter((x) => x.id !== id))
  }
  function setCarStatus(id, status) {
    setCars((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))
  }

  // --- CRUD concessionarias ---
  function saveDealer(d) {
    setDealers((prev) => {
      const exists = prev.some((x) => x.id === d.id)
      return exists ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]
    })
    setDealerForm(null)
  }
  function removeDealer(id) {
    const used = cars.some((c) => c.dealershipId === id)
    if (used) { alert('Há carros vinculados a esta concessionária. Remova-os ou troque a concessionária antes.'); return }
    if (!confirm('Excluir esta concessionária?')) return
    setDealers((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <div className="app">
      <header className="top">
        <div className="mark">🚗</div>
        <h1>Comparador HR-V</h1>
        <p>concessionárias &amp; carros usados · São Paulo</p>
        <div className="top-actions">
          <button onClick={exportJSON}>⬇︎ Exportar JSON</button>
          <button onClick={() => window.print()}>🖨 Imprimir matriz</button>
        </div>
      </header>

      {tab === 'carros' && (
        <CarrosView
          cars={cars}
          dealersById={dealersById}
          dealers={dealers}
          weights={weights}
          onAdd={() => setCarForm(newCar(dealers))}
          onEdit={(c) => setCarForm(c)}
          onRemove={removeCar}
          onStatus={setCarStatus}
        />
      )}
      {tab === 'concessionarias' && (
        <ConcessionariasView
          dealers={dealers}
          cars={cars}
          onAdd={() => setDealerForm(newDealer())}
          onEdit={(d) => setDealerForm(d)}
          onRemove={removeDealer}
        />
      )}
      {tab === 'comparacao' && (
        <ComparacaoView cars={cars} dealersById={dealersById} weights={weights} />
      )}
      {tab === 'ranking' && (
        <RankingView cars={cars} dealersById={dealersById} weights={weights} setWeights={setWeights} />
      )}

      <nav className="tabs">
        <TabBtn id="carros" tab={tab} setTab={setTab} ico="🚗" label="Carros" />
        <TabBtn id="concessionarias" tab={tab} setTab={setTab} ico="🏢" label="Lojas" />
        <TabBtn id="comparacao" tab={tab} setTab={setTab} ico="📊" label="Comparar" />
        <TabBtn id="ranking" tab={tab} setTab={setTab} ico="🏆" label="Ranking" />
      </nav>

      {carForm && (
        <CarForm
          value={carForm}
          dealers={dealers}
          onChange={setCarForm}
          onSave={saveCar}
          onCancel={() => setCarForm(null)}
        />
      )}
      {dealerForm && (
        <DealerForm value={dealerForm} onChange={setDealerForm} onSave={saveDealer} onCancel={() => setDealerForm(null)} />
      )}
    </div>
  )
}

function TabBtn({ id, tab, setTab, ico, label }) {
  return (
    <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
      <span className="ico">{ico}</span>
      <span>{label}</span>
    </button>
  )
}

// ---------- factories ----------
function newCar(dealers) {
  return {
    id: uid(),
    dealershipId: dealers[0]?.id || '',
    versao: 'LX',
    anoModelo: '',
    cor: '',
    km: '',
    preco: '',
    custoExtra: '',
    unicoDono: 'sim',
    historicoManutencao: 'sim',
    cvtTrocado: 'sim',
    garantia: '',
    reparos: '',
    pros: [],
    contras: [],
    obs: '',
    status: 'analise'
  }
}
function newDealer() {
  return {
    id: uid(),
    nome: '',
    tipo: 'Honda autorizada',
    endereco: '',
    telefone: '',
    googleNota: '',
    googleAval: '',
    reclameNota: '',
    reclameReput: 'Regular',
    reclameResolvidas: '',
    confiabilidade: 'Média',
    pontosFortes: '',
    pontosAtencao: ''
  }
}

// ======================= CARROS =======================
function CarrosView({ cars, dealersById, weights, onAdd, onEdit, onRemove, onStatus }) {
  const scored = useMemo(() => {
    const considered = cars.filter((c) => c.status !== 'descartado')
    const map = {}
    scoreAll(considered, dealersById, weights).forEach((s) => (map[s.car.id] = s.score))
    return map
  }, [cars, dealersById, weights])

  return (
    <>
      <div className="sec-head">
        <h2>Carros ({cars.length})</h2>
        <button className="btn" onClick={onAdd}>+ Carro</button>
      </div>
      {cars.length === 0 && <div className="empty">Nenhum carro ainda.<br />Toque em “+ Carro” para começar.</div>}
      {cars
        .slice()
        .sort((a, b) => (scored[b.id] || 0) - (scored[a.id] || 0))
        .map((c) => (
          <CarCard
            key={c.id}
            car={c}
            dealer={dealersById[c.dealershipId]}
            score={scored[c.id]}
            onEdit={() => onEdit(c)}
            onRemove={() => onRemove(c.id)}
            onStatus={(s) => onStatus(c.id, s)}
          />
        ))}
    </>
  )
}

function CarCard({ car, dealer, score, onEdit, onRemove, onStatus }) {
  const sm = statusMeta(car.status)
  const ce = custoEfetivo(car)
  return (
    <div className="card">
      <div className="row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>HR-V {car.versao} · {car.anoModelo || '—'}</h3>
          <div className="sub">{dealer ? dealer.nome : 'sem concessionária'} · {car.cor || 'cor —'}</div>
        </div>
        {typeof score === 'number' && (
          <div className="score-badge"><span className="n">{score}</span><span className="l">score</span></div>
        )}
      </div>

      <div className="meta">
        <span className={'tag ' + (car.cvtTrocado === 'nao' ? 'red' : car.cvtTrocado === 'sim' ? 'green' : 'amber')}>
          CVT: {YESNO[car.cvtTrocado]}
        </span>
        <span className={'tag ' + (car.unicoDono === 'nao' ? 'amber' : 'green')}>
          {car.unicoDono === 'sim' ? '1 dono' : '+de 1 dono'}
        </span>
        <span className="tag">{kmFmt(car.km)}</span>
        <span className="tag honey">{brl(ce)}</span>
        <span className={'pill-status ' + sm.cls}>{sm.l}</span>
      </div>

      <div className="meta" style={{ marginTop: 6 }}>
        <span className="tag">Anunciado {brl(car.preco)}</span>
        {Number(car.custoExtra) > 0 && <span className="tag">+ extras {brl(car.custoExtra)}</span>}
        <span className="tag">Manut.: {YESNO[car.historicoManutencao]}</span>
      </div>

      {(car.pros?.length || car.contras?.length) ? (
        <div className="lists">
          {car.pros?.length > 0 && (
            <div className="box pro"><b>Prós</b><ul>{car.pros.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
          )}
          {car.contras?.length > 0 && (
            <div className="box con"><b>Contras / riscos</b><ul>{car.contras.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
          )}
        </div>
      ) : null}

      {car.garantia && <div className="free"><b>Garantia</b>{car.garantia}</div>}
      {car.reparos && <div className="free"><b>Reparos / avarias</b>{car.reparos}</div>}
      {car.obs && <div className="free"><b>Observações</b>{car.obs}</div>}

      <div className="card-actions">
        <select className="btn ghost sm" value={car.status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <button className="btn ghost sm" onClick={onEdit}>✏️ Editar</button>
        <button className="btn danger sm" onClick={onRemove}>Excluir</button>
      </div>
    </div>
  )
}

// ======================= CONCESSIONARIAS =======================
function ConcessionariasView({ dealers, cars, onAdd, onEdit, onRemove }) {
  return (
    <>
      <div className="sec-head">
        <h2>Concessionárias ({dealers.length})</h2>
        <button className="btn" onClick={onAdd}>+ Loja</button>
      </div>
      {dealers.length === 0 && <div className="empty">Nenhuma concessionária ainda.</div>}
      {dealers.map((d) => {
        const nCars = cars.filter((c) => c.dealershipId === d.id).length
        const confCls = d.confiabilidade === 'Alta' ? 'green' : d.confiabilidade === 'Baixa' ? 'red' : 'amber'
        return (
          <div className="card" key={d.id}>
            <div className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{d.nome || 'Sem nome'}</h3>
                <div className="sub">{d.tipo}{d.endereco ? ' · ' + d.endereco : ''}</div>
              </div>
              <span className={'tag ' + confCls}>{d.confiabilidade}</span>
            </div>
            <div className="meta">
              {d.telefone && <span className="tag">📞 {d.telefone}</span>}
              {d.googleNota !== '' && d.googleNota != null && <span className="tag">⭐ Google {numBr(d.googleNota)} ({Number(d.googleAval || 0).toLocaleString('pt-BR')})</span>}
              {d.reclameNota !== '' && d.reclameNota != null && <span className="tag">RA {numBr(d.reclameNota)}/10 · {d.reclameReput}</span>}
              {d.reclameResolvidas !== '' && <span className="tag">{d.reclameResolvidas}% resolv.</span>}
              <span className="tag honey">{nCars} carro{nCars === 1 ? '' : 's'}</span>
            </div>
            {d.pontosFortes && <div className="free"><b>Pontos fortes</b>{d.pontosFortes}</div>}
            {d.pontosAtencao && <div className="free"><b>Pontos de atenção</b>{d.pontosAtencao}</div>}
            <div className="card-actions">
              <button className="btn ghost sm" onClick={() => onEdit(d)}>✏️ Editar</button>
              <button className="btn danger sm" onClick={() => onRemove(d.id)}>Excluir</button>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ======================= COMPARACAO (matriz) =======================
function ComparacaoView({ cars, dealersById, weights }) {
  const [hideDescartados, setHideDescartados] = useState(true)
  const list = useMemo(
    () => cars.filter((c) => (hideDescartados ? c.status !== 'descartado' : true)),
    [cars, hideDescartados]
  )
  const scoredList = useMemo(() => scoreAll(list, dealersById, weights), [list, dealersById, weights])
  const scoreById = useMemo(() => {
    const m = {}; scoredList.forEach((s) => (m[s.car.id] = s.score)); return m
  }, [scoredList])

  if (cars.length === 0) return <div className="empty">Cadastre carros para comparar.</div>

  const minKm = Math.min(...list.map((c) => Number(c.km)).filter(Number.isFinite))
  const minCe = Math.min(...list.map((c) => custoEfetivo(c)).filter(Number.isFinite))

  const rows = [
    { k: 'Loja', get: (c) => (dealersById[c.dealershipId]?.nome || '—') },
    { k: 'Versão', get: (c) => 'HR-V ' + c.versao },
    { k: 'Ano/modelo', get: (c) => c.anoModelo || '—' },
    { k: 'Cor', get: (c) => c.cor || '—' },
    { k: 'KM', get: (c) => kmFmt(c.km), cls: (c) => (Number(c.km) === minKm ? 'cell-green' : '') },
    { k: 'Preço anunciado', get: (c) => brl(c.preco) },
    { k: 'Custo extra', get: (c) => brl(c.custoExtra) },
    { k: 'Custo efetivo', get: (c) => brl(custoEfetivo(c)), cls: (c) => (custoEfetivo(c) === minCe ? 'cell-green' : '') },
    { k: 'Único dono', get: (c) => YESNO[c.unicoDono], cls: (c) => (c.unicoDono === 'nao' ? 'cell-amber' : '') },
    { k: 'Histórico manut.', get: (c) => YESNO[c.historicoManutencao] },
    { k: 'Fluido CVT', get: (c) => YESNO[c.cvtTrocado], cls: (c) => (c.cvtTrocado === 'nao' ? 'cell-red' : '') },
    { k: 'Garantia', get: (c) => c.garantia || '—' },
    { k: 'Reparos/avarias', get: (c) => c.reparos || '—' },
    { k: 'Status', get: (c) => statusMeta(c.status).l }
  ]

  return (
    <>
      <div className="sec-head"><h2>Comparação</h2></div>
      <div className="matrix-tools print-hide">
        <label>
          <input type="checkbox" checked={hideDescartados} onChange={(e) => setHideDescartados(e.target.checked)} />
          Esconder descartados
        </label>
        <span className="tag green">verde = melhor</span>
        <span className="tag red">vermelho = alerta</span>
        <span className="tag amber">amarelo = atenção</span>
      </div>
      {list.length === 0 ? (
        <div className="empty">Nenhum carro no filtro atual.</div>
      ) : (
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Atributo</th>
                {list.map((c) => (
                  <th key={c.id}>HR-V {c.versao}<br />{c.anoModelo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="score-row">
                <th>Score</th>
                {list.map((c) => <td key={c.id}>{scoreById[c.id]}</td>)}
              </tr>
              {rows.map((r) => (
                <tr key={r.k}>
                  <th>{r.k}</th>
                  {list.map((c) => (
                    <td key={c.id} className={r.cls ? r.cls(c) : ''}>{r.get(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ======================= RANKING / PESOS =======================
function RankingView({ cars, dealersById, weights, setWeights }) {
  const list = useMemo(() => cars.filter((c) => c.status !== 'descartado'), [cars])
  const ranked = useMemo(
    () => scoreAll(list, dealersById, weights).sort((a, b) => b.score - a.score),
    [list, dealersById, weights]
  )
  const setW = (k, v) => setWeights((prev) => ({ ...prev, [k]: Number(v) }))

  return (
    <>
      <div className="sec-head"><h2>Ranking &amp; pesos</h2></div>
      <div className="weights">
        <h3>Meus pesos</h3>
        <p className="hint">Ajuste a importância de cada critério (0 = ignora, 5 = máximo). Sugestão: Procedência/CVT &gt; KM &gt; Preço &gt; Equipamento &gt; Confiab. da loja.</p>
        {CRITERIA.map((cr) => (
          <div className="wrow" key={cr.key}>
            <span className="wl">{cr.label}</span>
            <input type="range" min="0" max="5" step="1" value={weights[cr.key] ?? 0} onChange={(e) => setW(cr.key, e.target.value)} />
            <span className="wv">{weights[cr.key] ?? 0}</span>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setWeights(DEFAULT_WEIGHTS)}>↺ Voltar ao padrão</button>
      </div>

      {ranked.length === 0 ? (
        <div className="empty">Sem carros para ranquear (todos descartados?).</div>
      ) : (
        ranked.map((r, i) => (
          <div className="rank-item" key={r.car.id}>
            <div className="pos">{i + 1}º</div>
            <div className="info">
              <div className="nm">HR-V {r.car.versao} · {r.car.anoModelo}</div>
              <div className="dl">{dealersById[r.car.dealershipId]?.nome || '—'} · {kmFmt(r.car.km)} · {brl(custoEfetivo(r.car))}</div>
              <div className="rank-bars">
                {CRITERIA.map((cr) => (
                  <div className="b" key={cr.key} title={`${cr.label}: ${r.subs[cr.key]}`}>
                    <i style={{ width: r.subs[cr.key] + '%' }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="score-badge"><span className="n">{r.score}</span><span className="l">score</span></div>
          </div>
        ))
      )}
    </>
  )
}

// ======================= FORMS =======================
function ListEditor({ label, items, onChange }) {
  return (
    <div className="field list-edit">
      <label>{label}</label>
      {items.map((it, i) => (
        <div className="li" key={i}>
          <input value={it} onChange={(e) => { const n = items.slice(); n[i] = e.target.value; onChange(n) }} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="add" onClick={() => onChange([...items, ''])}>+ adicionar item</button>
    </div>
  )
}

function CarForm({ value, dealers, onChange, onSave, onCancel }) {
  const v = value
  const set = (k, val) => onChange({ ...v, [k]: val })
  const ce = custoEfetivo(v)
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Carro</h2>

        <div className="field">
          <label>Concessionária</label>
          <select value={v.dealershipId} onChange={(e) => set('dealershipId', e.target.value)}>
            <option value="">— selecionar —</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        <div className="grid2">
          <div className="field">
            <label>Versão</label>
            <select value={v.versao} onChange={(e) => set('versao', e.target.value)}>
              {['LX', 'EX', 'EXL', 'Touring'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Ano/modelo</label>
            <input value={v.anoModelo} onChange={(e) => set('anoModelo', e.target.value)} placeholder="2017/2018" />
          </div>
          <div className="field">
            <label>Cor</label>
            <input value={v.cor} onChange={(e) => set('cor', e.target.value)} />
          </div>
          <div className="field">
            <label>KM</label>
            <input type="number" inputMode="numeric" value={v.km} onChange={(e) => set('km', e.target.value)} />
          </div>
          <div className="field">
            <label>Preço anunciado (R$)</label>
            <input type="number" inputMode="numeric" value={v.preco} onChange={(e) => set('preco', e.target.value)} />
          </div>
          <div className="field">
            <label>Custo extra estimado (R$)</label>
            <input type="number" inputMode="numeric" value={v.custoExtra} onChange={(e) => set('custoExtra', e.target.value)} />
          </div>
        </div>
        <div className="calc">Custo efetivo (auto): <b>{brl(ce)}</b></div>

        <div className="grid2">
          <div className="field">
            <label>Único dono</label>
            <select value={v.unicoDono} onChange={(e) => set('unicoDono', e.target.value)}>
              <option value="sim">Sim</option><option value="nao">Não</option>
            </select>
          </div>
          <div className="field">
            <label>Histórico manutenção</label>
            <select value={v.historicoManutencao} onChange={(e) => set('historicoManutencao', e.target.value)}>
              <option value="sim">Sim</option><option value="parcial">Parcial</option><option value="nao">Não</option>
            </select>
          </div>
          <div className="field">
            <label>Fluido do CVT trocado</label>
            <select value={v.cvtTrocado} onChange={(e) => set('cvtTrocado', e.target.value)}>
              <option value="sim">Sim</option><option value="vao">Vão trocar</option><option value="nao">Não</option>
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={v.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Garantia (prazo + cobertura)</label>
          <textarea value={v.garantia} onChange={(e) => set('garantia', e.target.value)} />
        </div>
        <div className="field">
          <label>Reparos pendentes / avarias</label>
          <textarea value={v.reparos} onChange={(e) => set('reparos', e.target.value)} />
        </div>

        <ListEditor label="Prós" items={v.pros} onChange={(n) => set('pros', n)} />
        <ListEditor label="Contras / riscos" items={v.contras} onChange={(n) => set('contras', n)} />

        <div className="field">
          <label>Observações</label>
          <textarea value={v.obs} onChange={(e) => set('obs', e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={() => onSave(v)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

function DealerForm({ value, onChange, onSave, onCancel }) {
  const v = value
  const set = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Concessionária</h2>
        <div className="field">
          <label>Nome</label>
          <input value={v.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div className="grid2">
          <div className="field">
            <label>Tipo</label>
            <select value={v.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {['Honda autorizada', 'Multimarcas', 'Loja'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={v.telefone} onChange={(e) => set('telefone', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Bairro / endereço</label>
          <input value={v.endereco} onChange={(e) => set('endereco', e.target.value)} />
        </div>
        <div className="grid2">
          <div className="field">
            <label>Nota Google (0-5)</label>
            <input type="number" step="0.1" min="0" max="5" value={v.googleNota} onChange={(e) => set('googleNota', e.target.value)} />
          </div>
          <div className="field">
            <label>Nº de avaliações</label>
            <input type="number" inputMode="numeric" value={v.googleAval} onChange={(e) => set('googleAval', e.target.value)} />
          </div>
          <div className="field">
            <label>Reclame Aqui (0-10)</label>
            <input type="number" step="0.1" min="0" max="10" value={v.reclameNota} onChange={(e) => set('reclameNota', e.target.value)} />
          </div>
          <div className="field">
            <label>Reputação RA</label>
            <select value={v.reclameReput} onChange={(e) => set('reclameReput', e.target.value)}>
              {['Ótimo', 'Bom', 'Regular', 'Ruim'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label>% reclam. resolvidas</label>
            <input type="number" inputMode="numeric" min="0" max="100" value={v.reclameResolvidas} onChange={(e) => set('reclameResolvidas', e.target.value)} />
          </div>
          <div className="field">
            <label>Confiabilidade (manual)</label>
            <select value={v.confiabilidade} onChange={(e) => set('confiabilidade', e.target.value)}>
              {['Alta', 'Média', 'Baixa'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Pontos fortes</label>
          <textarea value={v.pontosFortes} onChange={(e) => set('pontosFortes', e.target.value)} />
        </div>
        <div className="field">
          <label>Pontos de atenção</label>
          <textarea value={v.pontosAtencao} onChange={(e) => set('pontosAtencao', e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={() => onSave(v)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
