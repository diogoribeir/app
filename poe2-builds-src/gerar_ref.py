#!/usr/bin/env python3
"""
Exile Compass — REFERÊNCIAS de builds reais por etapa (poe.ninja).

O poe.ninja guarda "fotos" da liga em vários momentos (3 h, 6 h, 12 h, 1 dia, …, semanas)
— cada foto mostra os personagens do topo naquele momento, ou seja, quem estava indo bem
na campanha (horas) e no endgame (dias/semanas). Para cada skill principal e cada foto,
a busca agregada devolve: ascendências, suportes ligados à skill, gemas de espírito,
nós de ascendência/keystones, únicos, e uma amostra de personagens com nível, vida, ES,
EHP e DPS. O gerador junta tudo por ETAPA do jogo (pelo nível dos personagens) e grava
poe2-builds/kb/ref.js (KB_REF), que o diagnóstico usa como "o que funciona".

Uso:  python3 -I poe2-builds-src/gerar_ref.py [--skills 60] [--liga forbiddenrites]
      python3 -I poe2-builds-src/gerar_ref.py --so-combos   (só kb/combos.js: arma × ascendência e skill × ascendência)
Faz ~1 pedido por segundo (educado com o site). ~10 min para 60 skills.
Fonte: https://poe.ninja/poe2/builds — dados agregados, citados no app.
"""
import argparse
import datetime
import json
import os
import re
import statistics
import struct
import subprocess
import sys
import time
import urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(AQUI), 'poe2-builds')
BASE = 'https://poe.ninja/poe2/api/builds/'
PAUSA = 1.0

# etapas do jogo: área (dados do jogo, RePoE world_areas: Ato 1 = 1–15, Ato 2 = 16–31, Ato 3 = 33–45,
# Ato 4 = 46–53; interlúdios 54–64; mapas 65+ = tier 1..16) e a faixa de nível de personagem usada
# para comparar (quem está nessa área costuma estar alguns níveis acima).
ETAPAS = [
    ('a1', 'Ato 1', [1, 15], [1, 17], 0),
    ('a2', 'Ato 2', [16, 31], [14, 33], -10),
    ('a3', 'Ato 3', [33, 45], [30, 47], -20),
    ('a4', 'Ato 4', [46, 53], [44, 55], -30),
    ('int', 'Interlúdios', [54, 64], [52, 66], -50),
    ('m1', 'Mapas T1–T5', [65, 69], [64, 76], -60),
    ('m2', 'Mapas T6–T10', [70, 74], [72, 84], -60),
    ('m3', 'Mapas T11–T15', [75, 79], [80, 92], -60),
    ('m4', 'Chefes / T16', [80, 83], [88, 100], -60),
]


# ---------------------------------------------------------------- protobuf mínimo (sem schema)
def varint(b, i):
    r = s = 0
    while True:
        x = b[i]
        i += 1
        r |= (x & 0x7f) << s
        s += 7
        if not x & 0x80:
            return r, i


def campos(b):
    i, out = 0, []
    while i < len(b):
        k, i = varint(b, i)
        f, wt = k >> 3, k & 7
        if wt == 0:
            v, i = varint(b, i)
        elif wt == 2:
            n, i = varint(b, i)
            v = b[i:i + n]
            i += n
        elif wt == 1:
            v = b[i:i + 8]
            i += 8
        elif wt == 5:
            v = b[i:i + 4]
            i += 4
        else:
            raise ValueError('wire type %d' % wt)
        out.append((f, v))
    return out


def varints(b):
    i, out = 0, []
    while i < len(b):
        v, i = varint(b, i)
        out.append(v)
    return out


def txt(v):
    return v.decode('utf-8') if isinstance(v, bytes) else v


# ---------------------------------------------------------------- rede
def baixar(url):
    """curl (o mesmo cliente que o site aceita); erro → exceção."""
    r = subprocess.run(['curl', '-sS', '-f', '-m', '90', url], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f'{url}: {r.stderr.decode()[:200]}')
    time.sleep(PAUSA)
    return r.stdout


_dic = {}


def dicionario(h):
    if h not in _dic:
        b = baixar(BASE + 'dictionary/' + h)
        assert b[:4] == b'NDIC'
        n = struct.unpack('<I', b[12:16])[0]
        k = struct.unpack('<I', b[28:32])[0]
        off = 44 + (k - 1) * 8
        ls = b[off:off + n]
        p = off + n
        nomes = []
        for L in ls:
            nomes.append(b[p:p + L].decode('utf-8'))
            p += L
        _dic[h] = nomes
    return _dic[h]


def kfloat(s):
    """'0.7k' → 700; '1.2m' → 1.2e6; '' → None."""
    s = (s or '').strip().lower().replace(',', '')
    m = re.match(r'^(-?[\d.]+)\s*([km]?)$', s)
    if not m:
        return None
    return float(m.group(1)) * {'': 1, 'k': 1e3, 'm': 1e6}[m.group(2)]


def busca(versao, overview, **filtros):
    q = {'overview': overview, 'type': 'exp'}
    q.update({k: v for k, v in filtros.items() if v})
    top = campos(campos(baixar(BASE + versao + '/search?' + urllib.parse.urlencode(q)))[0][1])
    total = next((v for f, v in top if f == 1 and isinstance(v, int)), 0)
    hashes = {}
    for f, v in top:
        if f == 6:
            d = {ff: txt(vv) for ff, vv in campos(v)}
            hashes[d.get(1)] = d.get(2)
    dims = {}
    for f, v in top:
        if f != 2:
            continue
        cs = campos(v)
        nome = txt(next(vv for ff, vv in cs if ff == 1))
        dic = txt(next(vv for ff, vv in cs if ff == 2))
        pares = []
        for ff, vv in cs:
            if ff == 3:
                d = dict(campos(vv))
                pares.append((d.get(1, 0), d.get(2, 0)))
        nomes = dicionario(hashes[dic]) if dic in hashes else []
        dims[nome] = sorted(((nomes[i] if i < len(nomes) else str(i)), c) for i, c in pares)
        dims[nome].sort(key=lambda x: -x[1])
    cols = {}
    for f, v in top:
        if f != 12:
            continue
        cs = campos(v)
        nome = txt(next(vv for ff, vv in cs if ff == 1))
        strs = [txt(vv) for ff, vv in cs if ff == 7]
        pack = [vv for ff, vv in cs if ff == 6]
        dicn = next((txt(vv) for ff, vv in cs if ff == 11), None)
        if pack:
            vals = varints(pack[0])
            if dicn and dicn in hashes:
                nomes = dicionario(hashes[dicn])
                vals = [nomes[x] if x < len(nomes) else None for x in vals]
            cols[nome] = vals
        elif strs:
            cols[nome] = strs
    faixa = next(([vv for ff, vv in campos(v) if ff in (2, 3)] for f, v in top if f == 3), [])
    return {'total': total, 'dims': dims, 'cols': cols, 'faixa': faixa}


# ---------------------------------------------------------------- agregação
def pct(lst, total, n, filtro=None):
    out = []
    for nome, c in lst:
        if filtro and not filtro(nome):
            continue
        if total:
            out.append([nome, round(100 * c / total)])
        if len(out) >= n:
            break
    return [x for x in out if x[1] >= 1]


def quartis(vals):
    vals = sorted(v for v in vals if v is not None and v > 0)
    if len(vals) < 5:
        return None
    q = statistics.quantiles(vals, n=4)
    return [round(q[0]), round(statistics.median(vals)), round(q[2])]


UNICO = lambda n: not re.match(r'^(Rare|Magic|Normal) ', n)


def etapa_do_nivel(nv):
    """etapa mais específica (a de faixa mais estreita) que contém o nível."""
    cands = [e for e in ETAPAS if e[3][0] <= nv <= e[3][1]]
    return min(cands, key=lambda e: e[3][1] - e[3][0])[0] if cands else None


def personagens(r, skill=None):
    c = r['cols']
    lv = c.get('level') or []
    vida = c.get('life') or []
    es = c.get('energyshield') or []
    ehp = c.get('ehp__str') or []
    cls = c.get('class') or []
    dps = c.get(f'dps-{skill}.total') if skill else None
    out = []
    for i, L in enumerate(lv):
        if not isinstance(L, int):
            continue
        out.append({
            'nv': L,
            'vida': vida[i] if i < len(vida) else None,
            'es': es[i] if i < len(es) else None,
            'ehp': kfloat(ehp[i]) if i < len(ehp) else None,
            'asc': cls[i] if i < len(cls) else None,
            'dps': kfloat(dps[i]) if dps and i < len(dps) else None,
        })
    return out


def resumo_stats(ps):
    if len(ps) < 5:
        return None
    o = {'n': len(ps)}
    for k in ('vida', 'es', 'ehp', 'dps'):
        vals = [p[k] for p in ps if not (k == 'vida' and (p[k] or 0) <= 1)]   # CI (vida 1) fica fora da vida
        q = quartis(vals)
        if q:
            o[k] = q
    q = quartis([(p['vida'] or 0) + (p['es'] or 0) for p in ps])
    if q:
        o['pool'] = q
    return o


def principais_do_jogo():
    with open(os.path.join(APP, 'kb', 'jogo.js'), encoding='utf-8') as f:
        t = f.read()
    J = json.loads(t[t.index('window.KB_JOGO=') + len('window.KB_JOGO='):].rstrip().rstrip(';'))
    ruim = {'persistent', 'curse', 'mark', 'herald', 'aura', 'buff', 'warcry', 'meta', 'trigger', 'banner'}
    return {x['n'] for x in J['skills'] if x['t'] in ('Attack', 'Spell', 'Minion') and not (set(x['tg']) & ruim) and not x.get('sp')}


def combos(sv):
    """Quantos jogadores de cada ascendência usam cada modo de arma e cada skill principal (liga atual)."""
    versao, overview = sv['version'], sv['snapshotName']
    principais = principais_do_jogo()
    g = busca(versao, overview)
    out = {}
    for asc, n in g['dims'].get('class', []):
        r = busca(versao, overview, **{'class': asc})
        out[asc] = {'n': r['total'],
                    'arma': [[m, c] for m, c in r['dims'].get('weaponmode', []) if c > 0],
                    'sk': [[x, c] for x, c in r['dims'].get('skills', []) if c > 0 and x in principais]}
        print(f'  {asc}: {r["total"]}', flush=True)
    # popularidade de cada skill principal: agora (endgame) e com 3 h de liga (campanha, níveis ~1–45)
    pop = {}
    for chave, m in (('endgame', ''), ('campanha', 'hour-3')):
        if m and m not in sv['timeMachineLabels']:
            continue
        r = g if not m else busca(versao, overview, timemachine=m)
        # no endgame vale a skill principal ("skills"); na campanha muita gente ainda não tem skill principal
        # calculada, então conta quem tem a gema equipada ("allskills")
        dim = 'skills' if not m else 'allskills'
        pop[chave] = {'m': m or 'atual', 'dim': dim, 'total': r['total'], 'faixa': r['faixa'],
                      'sk': [[x, c] for x, c in r['dims'].get(dim, []) if c > 0 and x in principais]}
        print(f'  popularidade {chave}: {r["total"]} personagens, {len(pop[chave]["sk"])} skills', flush=True)
    obj = {'fonte': f'poe.ninja — {sv["name"]}', 'liga': sv['name'], 'versao': versao, 'gerado': datetime.date.today().isoformat(),
           'total': g['total'], 'asc': out, 'pop': pop}
    p = os.path.join(APP, 'kb', 'combos.js')
    js = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(p, 'w', encoding='utf-8') as f:
        f.write('/* GERADO por poe2-builds-src/gerar_ref.py --so-combos a partir do poe.ninja — não editar à mão. */\n')
        f.write('window.KB_COMBOS=' + js + ';\n')
    print(f'kb/combos.js: {len(js) // 1024} KB', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skills', type=int, default=60)
    ap.add_argument('--liga', default='')
    ap.add_argument('--so-combos', action='store_true')
    a = ap.parse_args()

    idx = json.loads(subprocess.run(['curl', '-sS', '-f', '-m', '60', 'https://poe.ninja/poe2/api/data/index-state'], capture_output=True, check=True).stdout)
    snaps = idx['snapshotVersions']
    sv = next((s for s in snaps if s['url'] == a.liga), None) if a.liga else None
    if not sv:   # a liga de desafio mais nova (não HC/SSF), que é a primeira da lista
        sv = next(s for s in snaps if not re.search(r'hc|ssf|standard|hardcore', s['url']))
    if a.so_combos:
        combos(sv)
        return
    versao, overview = sv['version'], sv['snapshotName']
    usar = {'hour-3', 'hour-6', 'hour-12', 'hour-18', 'day-1', 'day-2', 'day-3', 'day-5', 'week-1', 'week-2', 'week-4'}
    momentos = [''] + [m for m in sv['timeMachineLabels'] if m in usar]
    ordem = {'hour': 1, 'day': 24, 'week': 168}
    momentos.sort(key=lambda m: 1e9 if not m else ordem[m.split('-')[0]] * int(m.split('-')[1]))
    print(f'liga {sv["name"]} versão {versao} momentos {momentos}', flush=True)

    # 1) visão geral de cada momento: faixa de nível, skills mais jogadas, amostra de personagens
    geral = {}
    pers_geral = []
    for m in momentos:
        r = busca(versao, overview, timemachine=m)
        ps = personagens(r)
        nvs = sorted(p['nv'] for p in ps)
        geral[m] = {'total': r['total'], 'faixa': r['faixa'], 'nv_med': nvs[len(nvs) // 2] if nvs else None,
                    'skills': r['dims'].get('skills', [])}
        pers_geral += ps
        print(f'  momento {m or "atual"}: {r["total"]} personagens, níveis {r["faixa"]}, mediana {geral[m]["nv_med"]}', flush=True)

    # 2) skills a cobrir: as skills PRINCIPAIS (ataque/feitiço/minion; sem buffs, maldições e marcas)
    #    mais jogadas agora + as mais jogadas na campanha
    with open(os.path.join(APP, 'kb', 'jogo.js'), encoding='utf-8') as f:
        t = f.read()
    J = json.loads(t[t.index('window.KB_JOGO=') + len('window.KB_JOGO='):].rstrip().rstrip(';'))
    ruim = {'persistent', 'curse', 'mark', 'herald', 'aura', 'buff', 'warcry', 'meta', 'trigger', 'banner'}
    principais = {x['n'] for x in J['skills'] if x['t'] in ('Attack', 'Spell', 'Minion') and not (set(x['tg']) & ruim) and not x.get('sp')}
    contagem = {}
    for m, g in geral.items():
        for nome, c in g['skills']:
            if nome in principais:
                contagem[nome] = max(contagem.get(nome, 0), c / max(1, g['total']))
    skills = [s for s, _ in sorted(contagem.items(), key=lambda x: -x[1])][:a.skills]
    print(f'{len(skills)} skills', flush=True)

    # momento que melhor representa cada etapa (mediana de nível mais perto do centro da faixa)
    def momento_da_etapa(e, base):
        c = (e[3][0] + e[3][1]) / 2
        cands = [(abs(g['nv_med'] - c), m) for m, g in base.items() if g.get('nv_med') is not None and e[3][0] - 6 <= g['nv_med'] <= e[3][1] + 6]
        return min(cands)[1] if cands else None

    ref_geral = {}
    for e in ETAPAS:
        ps = [p for p in pers_geral if e[3][0] <= p['nv'] <= e[3][1]]
        st = resumo_stats(ps)
        if st:
            ref_geral[e[0]] = st

    out_sk = {}
    for k, sk in enumerate(skills):
        print(f'[{k + 1}/{len(skills)}] {sk}', flush=True)
        por_m = {}
        todos = []
        for m in momentos:
            try:
                r = busca(versao, overview, timemachine=m, skills=sk)
            except Exception as ex:  # noqa: BLE001
                print('   falhou', m, ex, flush=True)
                continue
            if not r['total']:
                continue
            ps = personagens(r, sk)
            nvs = sorted(p['nv'] for p in ps)
            por_m[m] = {'r': r, 'nv_med': nvs[len(nvs) // 2] if nvs else None}
            todos += ps
        if '' not in por_m:
            continue
        atual = por_m['']['r']
        info = {'n': atual['total'],
                'asc': pct(atual['dims'].get('class', []), atual['total'], 6),
                'etapas': {}}
        for e in ETAPAS:
            m = momento_da_etapa(e, por_m)
            ps = [p for p in todos if e[3][0] <= p['nv'] <= e[3][1]]
            st = resumo_stats(ps)
            if not m and not st:
                continue
            ent = {}
            if m is not None:
                r = por_m[m]['r']
                tot = r['total']
                ent.update({
                    'm': m or 'atual', 'n': tot,
                    'sup': pct(r['dims'].get(f'linkedgems-{sk}', []), tot, 14),
                    'esp': pct(r['dims'].get('spiritgems', []), tot, 8),
                    'out': pct([x for x in r['dims'].get('skills', []) if x[0] != sk], tot, 6),
                    'asc': pct(r['dims'].get('class', []), tot, 6),
                    'nos': pct(r['dims'].get('keypassives', []), tot, 12),
                    'uni': pct(r['dims'].get('items', []), tot, 10, UNICO),
                    'arma': pct(r['dims'].get('weaponmode', []), tot, 4),
                    'tr': pct(r['dims'].get(f'traits-{sk}', []) or r['dims'].get('traits', []), tot, 6),
                })
            if st:
                ent['st'] = st
            info['etapas'][e[0]] = ent
        out_sk[sk] = info

    obj = {
        'fonte': f'poe.ninja — {sv["name"]}',
        'url': f'https://poe.ninja/poe2/builds/{sv["url"]}',
        'liga': sv['name'],
        'versao': versao,
        'gerado': datetime.date.today().isoformat(),
        'etapas': [{'id': e[0], 'n': e[1], 'area': e[2], 'nivel': e[3], 'penal': e[4]} for e in ETAPAS],
        'geral': ref_geral,
        'skills': out_sk,
    }
    p = os.path.join(APP, 'kb', 'ref.js')
    js = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(p, 'w', encoding='utf-8') as f:
        f.write('/* GERADO por poe2-builds-src/gerar_ref.py a partir do poe.ninja (dados agregados da liga) — não editar à mão. */\n')
        f.write('window.KB_REF=' + js + ';\n')
    print(f'kb/ref.js: {len(js) // 1024} KB, {len(out_sk)} skills', flush=True)


if __name__ == '__main__':
    main()
