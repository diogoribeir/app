#!/usr/bin/env python3
"""Gera a biblioteca de dados do app Exile Compass a partir do Path of Building 2.

Uso (a cada patch do jogo, ~4 meses):
    git clone --depth 1 https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git /tmp/pob2
    python3 -I poe2-builds-src/gerar_kb.py /tmp/pob2

Saída (sobrescreve): poe2-builds/kb/jogo.js, arvore.js, unicos.js
Os arquivos curados à mão (conceitos.js, meta.js) NÃO são tocados.

Só LÊ os arquivos .lua/.json do PoB2 como dados (parser próprio em lualit.py);
nenhum código do PoB2 é executado.
"""
import json, os, re, subprocess, sys, math, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lualit import parse_return_table, parse_assignments  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, '..', 'poe2-builds', 'kb')


def ler(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


# ------------------------------------------------------------------ versão
def versao(pob):
    gv = ler(f'{pob}/src/GameVersions.lua')
    arv = re.findall(r'"(\d+_\d+)"', re.search(r'treeVersionList = \{([^}]*)\}', gv).group(1))[-1]
    try:
        commit = subprocess.run(['git', '-C', pob, 'log', '-1', '--format=%h %cs'],
                                capture_output=True, text=True).stdout.strip()
    except Exception:
        commit = '?'
    return arv, commit


# ------------------------------------------------------------------ constantes
def constantes(pob):
    misc = ler(f'{pob}/src/Data/Misc.lua')
    data_lua = ler(f'{pob}/src/Modules/Data.lua')
    cfg = ler(f'{pob}/src/Modules/ConfigOptions.lua')

    def gc(nome):
        m = re.search(r'\["%s"\] = (-?[\d.]+)' % re.escape(nome), misc)
        return float(m.group(1)) if m else None

    def dm(nome):
        m = re.search(r'\b%s = (-?[\d.]+)' % re.escape(nome), data_lua)
        return float(m.group(1)) if m else None

    pen = re.search(r'var = "resistancePenalty".*?list = \{(.*?)\}, defaultIndex', cfg, re.S)
    penal = [(int(v), l) for v, l in re.findall(r'val=(-?\d+),label="([^"]+)"', pen.group(1))] if pen else []

    # recompensas de quest (espírito, pontos de passiva)
    q = ler(f'{pob}/src/Data/QuestRewards.lua')
    espirito = sum(int(x) for x in re.findall(r'"\+(\d+) to Spirit"', q))
    pts_quest = sum(int(x) for x in re.findall(r'\["questPoints"\] = (\d+)', q))
    vida_quest = sum(int(x) for x in re.findall(r'"\+(\d+) to maximum Life"', q))
    res_quest = {}
    for v, el in re.findall(r'"\+(\d+)% to (Fire|Cold|Lightning) Resistance"', q):
        res_quest[el] = res_quest.get(el, 0) + int(v)

    def n(x):
        return int(x) if x is not None and float(x).is_integer() else x

    def tabela(nome):
        m = re.search(r'data\.%s = \{([^}]*)\}' % nome, misc)
        return [n(float(x)) for x in re.findall(r'-?[\d.]+', m.group(1))] if m else []

    # resistência padrão de chefes no config do PoB2 (Boss / Pinnacle)
    chefe = {}
    for tipo, v in re.findall(r'val == "(Boss|Pinnacle)" then\s*\n\s*local defaultEleResist = (\d+)', cfg):
        chefe[tipo] = int(v)

    return {
        'precisaoMonstro': tabela('monsterAccuracyTable'),
        'resChefe': chefe.get('Boss', 30),
        'resChefePinnacle': chefe.get('Pinnacle', 50),
        'resMax': n(gc('base_maximum_all_resistances_%')),
        'resMaxCap': n(dm('MaxResistCap')),
        'resPenalidade': penal[-1][0] if penal else -60,
        'resPenalidadeAtos': [{'v': v, 'rotulo': l} for v, l in penal],
        'drMaxFisico': n(gc('maximum_physical_damage_reduction_%')),
        'armaduraRazao': n(dm('ArmourRatio')),
        'evasaoCap': n(gc('DefaultMaxEvadeChancePercent')),
        'deflexaoCap': n(dm('DeflectionChanceCap')),
        'deflexaoEfeito': n(gc('BasePercentDamageDeflected')),
        'bloqueioMaxBase': n(gc('object_inherent_base_maximum_block_%_from_ot')),
        'bloqueioCap': n(dm('BlockChanceCap')),
        'esRecargaPorSeg': round(gc('energy_shield_recharge_rate_per_minute_%') / 60, 2),
        'esAtraso': n(dm('EnergyShieldRechargeDelay')),
        'manaRegenPorSeg': round(gc('character_inherent_mana_regeneration_rate_per_minute_%') / 60, 2),
        'critBonusBase': n(gc('base_critical_hit_damage_bonus')),
        'vidaPorNivel': n(gc('life_per_level')),
        'manaPorNivel': n(gc('mana_per_level')),
        'cargasMax': n(gc('max_power_charges')),
        'igniteDanoPorSeg': n(gc('IgniteHitDamagePercentPerMinute') / 60),
        'igniteDuracao': n(gc('BaseIgniteDuration')),
        'venenoDanoPorSeg': n(gc('PoisonHitDamagePercentPerMinute') / 60),
        'venenoDuracao': n(gc('BasePoisonDuration')),
        'sangramentoDanoPorSeg': n(gc('BleedingHitDamagePercentPerMinute') / 60),
        'sangramentoDuracao': n(gc('BaseBleedingDuration')),
        'choqueMagnitude': n(gc('BaseShockMagnitude')),
        'frioMaxLentidao': n(gc('ChillMaxEffect')),
        'cullNormal': n(gc('CullingStrikeNormalThreshold')),
        'cullMagico': n(gc('CullingStrikeMagicThreshold')),
        'cullRaro': n(gc('CullingStrikeRareThreshold')),
        'cullUnico': n(gc('CullingStrikeUniqueThreshold')),
        'limiarAilmentVida': n(gc('PlayerAilmentThresholdLifeFactor')),
        'rageMax': n(gc('BaseMaximumRage')),
        'espiritoQuests': espirito,
        'pontosQuest': pts_quest,
        'pontosNivel': 99,
        'pontosAscendencia': 8,
        'vidaQuests': vida_quest,
        'resQuests': res_quest,
        'nivelEndgame': n(gc('EndgameStartLevel')),
        'suporteOuro': n(gc('SupportGemGoldPrice')),
        'linhagemOuro': n(gc('LineageSupportGemGoldPrice ')),
    }


# ------------------------------------------------------------------ descrições de stats
class Descritor:
    """Transforma (stat, valor) em texto usando os StatDescriptions do PoB2."""

    def __init__(self, arquivos):
        self.entradas = []
        self.indice = {}
        for arq in arquivos:
            t = parse_return_table(ler(arq))
            base = len(self.entradas)
            nums = {k: v for k, v in t.items() if isinstance(k, int)}
            for k in sorted(nums):
                self.entradas.append(nums[k])
            for k, v in t.items():
                if isinstance(k, str) and isinstance(v, int):
                    self.indice.setdefault(k, base + v - 1)

    @staticmethod
    def _ok(lim, v):
        if not isinstance(lim, (list, dict)):
            return True
        lo, hi = (lim[0], lim[1]) if isinstance(lim, list) else (lim.get(1), lim.get(2))
        if not isinstance(v, (int, float)):
            return True
        if lo == '!':  # "!" = diferente de hi
            return not isinstance(hi, (int, float)) or v != hi
        if isinstance(lo, (int, float)) and v < lo:
            return False
        if isinstance(hi, (int, float)) and v > hi:
            return False
        return True

    @staticmethod
    def _fmt(x):
        if isinstance(x, float):
            x = round(x, 2)
            if x.is_integer():
                x = int(x)
        return str(x)

    def texto(self, valores):
        """valores: dict stat->valor. Devolve lista de linhas."""
        linhas, usados = [], set()
        for stat in valores:
            if stat in usados or stat not in self.indice:
                continue
            ent = self.entradas[self.indice[stat]]
            stats = ent.get('stats') or []
            if isinstance(stats, dict):
                stats = [stats[k] for k in sorted(stats)]
            vals = [valores.get(s, 0) for s in stats]
            usados.update(stats)
            variantes = ent.get(1) or []
            if isinstance(variantes, dict):
                variantes = [variantes[k] for k in sorted(k for k in variantes if isinstance(k, int))]
            for var in variantes:
                lims = var.get('limit') or []
                if isinstance(lims, dict):
                    lims = [lims[k] for k in sorted(lims)]
                if all(self._ok(l, vals[i] if i < len(vals) else 0) for i, l in enumerate(lims)):
                    vs = list(vals)
                    for k, h in var.items():
                        if isinstance(k, int) and isinstance(h, dict):
                            i = (h.get('v') or 1) - 1
                            if i >= len(vs):
                                continue
                            kk = h.get('k', '')
                            if kk.startswith('negate'):
                                vs[i] = -vs[i] * (2 if 'double' in kk else 1)
                            elif kk == 'double':
                                vs[i] *= 2
                            elif kk.startswith('milliseconds_to_seconds'):
                                vs[i] = vs[i] / 1000
                            elif kk.startswith('per_minute_to_per_second'):
                                vs[i] = vs[i] / 60
                            elif kk.startswith('divide_by_one_hundred'):
                                vs[i] = vs[i] / 100
                            elif kk.startswith('divide_by_ten'):
                                vs[i] = vs[i] / 10
                            elif kk.startswith('divide_by_two'):
                                vs[i] = vs[i] / 2
                            elif kk == 'times_twenty':
                                vs[i] *= 20
                    txt = var.get('text', '')
                    txt = re.sub(r'\{(\d+)(?::[^}]*)?\}', lambda m: self._fmt(vs[int(m.group(1))]) if int(m.group(1)) < len(vs) else '#', txt)
                    txt = re.sub(r'\[([^|\]]+)\|([^\]]+)\]', r'\2', txt)  # [Tag|Texto] -> Texto
                    txt = re.sub(r'\[([^\]]+)\]', r'\1', txt)
                    if txt:
                        linhas.append(txt)
                    break
        return linhas


# ------------------------------------------------------------------ vetores dos suportes
# Classifica cada suporte nos vetores do slide "Hit Damage Scaling Vectors" a partir do TEXTO do
# efeito (fx) — mais confiável que o id do stat — e dos mods MORE reais do statMap do PoB2.
COND = r'\b(if|when|while|per|on|every|against|within|after|for each|consume[sd]?|further|closer|require[sd]?|recently|combo|up to|scaling|cooldown|glory|rage)\b'
EL_RX = [('fire', r'fire|ignite|flammab|burn'), ('cold', r'cold|freez|chill|\bice\b|frost'), ('lightning', r'lightning|shock|electrocut'),
         ('chaos', r'chaos|poison|wither'), ('physical', r'physical|bleed|incision|armour break|break armour|broken armour')]


def elementos_suporte(nome, fx):
    # linhas de restrição ("cannot inflict Elemental Ailments") não definem o elemento do suporte
    linhas = [nome] + [' '.join(l.split()) for l in fx if not re.search(r'cannot|deal no', l, re.I)]
    t = ' '.join(linhas).lower()
    if re.search(r'elemental', t):
        return ['cold', 'fire', 'lightning']
    return sorted(e for e, rx in EL_RX if re.search(rx, t))


def vetores_suporte(stats_vals, statmap, desc, fx):
    tags = set()

    def restricao(texto):
        t = texto.lower()
        if 'crit' in t:
            tags.add('semcrit')
        if re.search(r'ailment|ignite|freeze|shock|chill|electrocut', t):
            tags.add('semailment')
        if 'elemental' in t:
            tags.add('semelem')
        if 'chaos' in t:
            tags.add('semcaos')

    for stat, v in stats_vals.items():
        if v == 0:
            continue
        s = stat.lower()
        if re.search(r'cannot|_no_|^no_|never|deal_no', s):
            restricao(s)
            continue
        mods = statmap.get(stat) if isinstance(statmap, dict) else None
        if isinstance(mods, list) and isinstance(v, (int, float)) and v > 0:
            for m in mods:
                if isinstance(m, dict) and m.get('__call') == 'mod' and len(m.get('args') or []) > 1:
                    nome, tipo = str(m['args'][0]), str(m['args'][1])
                    if tipo == 'MORE' and re.search(r'Damage$', nome) and 'Taken' not in nome and not re.search(r'magnitude|ailment|ignite|poison|bleed', s):
                        tags.add('more')

    for linha in fx:
        l = ' '.join(linha.split())
        low = l.lower()
        if re.search(r'cannot|deal no |never ', low):
            restricao(low)
            continue
        penal_proprio = re.search(r'\byou are\b|\byou take\b|minions from supported skills take|movement speed penalty|\bcost\b|reservation', low)
        if ' more ' in f' {low} ' and 'damage' in low and 'magnitude' not in low and 'as though' not in low and not re.search(r'\btake\b|taken|penalty|cost|reservation|duration', low):
            tags.add('more')
        if ' more ' in f' {low} ' and 'magnitude' in low:
            tags.add('ailment')
        if re.search(r' more | as extra|% of damage as', f' {low} ') and re.search(COND, low):
            tags.add('cond')
        if re.search(r'\bless\b', low) and re.search(r'damage|speed|area|chance|magnitude|duration', low) and not re.search(r'\btake\b|taken', low):
            tags.add('menos')
        if re.search(r'minions? .*take \d+% more damage', low) or (penal_proprio and re.search(r'dazed|lose', low)):
            tags.add('menos')
        if re.search(r'gain \d+% of .*damage as|as extra .*damage|damage converted? to|convert(?:ed|s)? .*damage', low):
            tags.add('conv')
        if 'critical' in low and not penal_proprio and 'less critical' not in low:
            tags.add('crit')
        if re.search(r'chance to shock|shock chance|magnitude of shock|inflict shock|always shock|also shock|wither|intimidat|vulnerab|increased damage taken|take \d+% increased damage', low) and not penal_proprio and not re.search(r'trigger|reflected', low):
            tags.add('taken')
        if re.search(r'have a cooldown', low):
            tags.add('menos')
        if re.search(r'penetrat|exposure|break armour|armour break|curse|hex|resistance', low) and not re.search(r'consume', low) and not penal_proprio:
            tags.add('mitig')
        if re.search(r'consume', low) and re.search(r'more', low):
            tags.add('cond')
        if re.search(r'(attack|cast|skill) speed', low) and re.search(r'increased|more', low) and 'less' not in low:
            tags.add('vel')
        if re.search(r'ignite|poison|bleed|chill|freeze|electrocut|ailment|flammability', low):
            tags.add('ailment')
        if re.search(r'area of effect|projectile|chain|pierce|fork|additional|radius', low) and 'less' not in low:
            tags.add('clear')
        if re.search(r'leech|recover|regenerat|\blife\b|energy shield|armour|evasion|block|deflect|stun threshold', low) and not re.search(r'enem|break armour|broken armour|cost', low):
            tags.add('defesa')
        if re.search(r'\bcost|reservation|cooldown', low) and re.search(r'less|reduced|no ', low):
            tags.add('efic')
    tudo = ' '.join(' '.join(l.split()) for l in fx).lower()
    if ('more' in tags or 'conv' in tags) and re.search(COND, tudo):
        tags.add('cond')
    if not fx:
        d = (desc or '').lower()
        for tag, rx in [('ailment', r'ignite|poison|bleed|freeze|chill|electrocut'), ('taken', r'shock|wither'),
                        ('mitig', r'exposure|penetrat|break armour|curse'), ('clear', r'area of effect|projectile|chain|pierce|fork')]:
            if re.search(rx, d):
                tags.add(tag)
    return sorted(tags)


# ------------------------------------------------------------------ gems + skills
def niveis_skill(ge):
    """[[nível de personagem exigido, índice de dano], …] para os níveis 1..20 da gema.
    Índice de dano: ataque = baseMultiplier; feitiço/dano base = soma de mín+máx dos stats
    *_base_*_damage do 1º statSet. 0 quando o dano não depende do nível (ou não deu para ler)."""
    lv = ge.get('levels') or {}
    if not isinstance(lv, dict) or not lv:
        return None
    ss = ge.get('statSets') or {}
    ss1 = ss.get(1) if isinstance(ss, dict) else (ss[0] if isinstance(ss, list) and ss else {})
    ss1 = ss1 or {}
    st = ss1.get('stats') or []
    if isinstance(st, dict):
        st = [st[k] for k in sorted(st)]
    idx = [i for i, x in enumerate(st) if isinstance(x, str) and re.search(r'(minimum|maximum)_base_.*damage', x)]
    slv = ss1.get('levels') or {}
    out = []
    for n in range(1, 21):
        L = lv.get(n)
        if not isinstance(L, dict):
            break
        req = L.get('levelRequirement', 0) or 0
        d = 0.0
        if isinstance(L.get('baseMultiplier'), (int, float)):
            d = float(L['baseMultiplier'])
        elif idx and isinstance(slv, dict) and isinstance(slv.get(n), dict):
            vals = slv[n]
            d = float(sum(vals.get(i + 1, 0) for i in idx if isinstance(vals.get(i + 1, 0), (int, float))))
        out.append([int(req), round(d, 3)])
    return out if len(out) >= 2 else None


def gems_e_skills(pob):
    G = parse_return_table(ler(f'{pob}/src/Data/Gems.lua'))
    skills = {}
    for f in ['act_str', 'act_dex', 'act_int', 'sup_str', 'sup_dex', 'sup_int', 'minion', 'other']:
        skills.update(parse_assignments(ler(f'{pob}/src/Data/Skills/{f}.lua'), 'skills'))
    desc = Descritor([f'{pob}/src/Data/StatDescriptions/gem_stat_descriptions.lua',
                      f'{pob}/src/Data/StatDescriptions/skill_stat_descriptions.lua',
                      f'{pob}/src/Data/StatDescriptions/stat_descriptions.lua'])

    tipos = []
    tidx = {}

    def ti(nome):
        if nome not in tidx:
            tidx[nome] = len(tipos)
            tipos.append(nome)
        return tidx[nome]

    def lista_tipos(x):
        if isinstance(x, dict):
            return [ti(k) for k, v in x.items() if v is True and isinstance(k, str)]
        return []

    def expr(x):
        if isinstance(x, list):
            return [ti(k) for k in x if isinstance(k, str)]
        if isinstance(x, dict):  # dict com só índices
            return [ti(x[k]) for k in sorted(k for k in x if isinstance(k, int)) if isinstance(x[k], str)]
        return []

    def attr(g):
        r = [g.get('reqStr', 0) or 0, g.get('reqDex', 0) or 0, g.get('reqInt', 0) or 0]
        return r

    ativos, suportes = [], []
    for gid, g in G.items():
        tags = g.get('tags', {}) or {}
        ge = skills.get(g.get('grantedEffectId'), {}) or {}
        tg = sorted(k for k, v in tags.items() if v is True and k not in ('grants_active_skill', 'support', 'strength', 'dexterity', 'intelligence'))
        if tags.get('support'):
            nome = g['name']
            m = re.search(r'\s+(I{1,3}|IV|V)$', nome)
            ss = (ge.get('statSets') or {})
            ss1 = ss.get(1) if isinstance(ss, dict) else (ss[0] if isinstance(ss, list) and ss else {})
            ss1 = ss1 or {}
            vals = {}
            cs = ss1.get('constantStats') or []
            if isinstance(cs, dict):
                cs = [cs[k] for k in sorted(cs)]
            for par in cs:
                if isinstance(par, list) and len(par) >= 2 and isinstance(par[0], str):
                    vals[par[0]] = par[1]
            st = ss1.get('stats') or []
            if isinstance(st, dict):
                st = [st[k] for k in sorted(st)]
            lv = ss1.get('levels') or {}
            lv1 = lv.get(1) if isinstance(lv, dict) else (lv[0] if isinstance(lv, list) and lv else {})
            lv1 = lv1 if isinstance(lv1, dict) else {}
            for i, s in enumerate(st):
                if isinstance(s, str):
                    vals[s] = lv1.get(i + 1, 1) if isinstance(lv1.get(i + 1, 1), (int, float)) else 1
            fx = desc.texto(vals)
            sup = {
                'n': nome,
                'gid': g.get('gameId', ''),
                'fam': g.get('gemFamily') or re.sub(r'\s+(I{1,3}|IV|V)$', '', nome),
                'nv': {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}.get(m.group(1)) if m else 0,
                'lin': bool(tags.get('lineage')),
                'tg': tg,
                'req': attr(g),
                'tier': g.get('Tier', 0),
                'd': ge.get('description', ''),
                'fx': fx,
                'r': expr(ge.get('requireSkillTypes')),
                'x': expr(ge.get('excludeSkillTypes')),
                'v': vetores_suporte(vals, ss1.get('statMap') or {}, ge.get('description', ''), fx),
                'el': elementos_suporte(nome, fx),
            }
            if ge.get('ignoreMinionTypes'):
                sup['imt'] = 1
            suportes.append(sup)
        elif tags.get('grants_active_skill') and '{' not in g['name']:
            lv = ge.get('levels') or {}
            lv1 = lv.get(1) if isinstance(lv, dict) else {}
            lv1 = lv1 if isinstance(lv1, dict) else {}
            sk = {
                'n': g['name'],
                'gid': g.get('gameId', ''),
                't': g.get('gemType', ''),
                'tg': tg,
                'req': attr(g),
                'w': g.get('weaponRequirements', ''),
                'tier': g.get('Tier', 0),
                'd': ge.get('description', ''),
                'st': lista_tipos(ge.get('skillTypes')),
            }
            mst = lista_tipos(ge.get('minionSkillTypes'))
            if mst:
                sk['mst'] = mst
            nivs = niveis_skill(ge)
            if nivs:
                sk['lv'] = nivs
            if lv1.get('spiritReservationFlat'):
                sk['sp'] = lv1['spiritReservationFlat']
            if lv1.get('storedUses') or lv1.get('cooldown'):
                sk['cd'] = lv1.get('cooldown')
            ativos.append(sk)
    ativos.sort(key=lambda s: s['n'])
    suportes.sort(key=lambda s: s['n'])
    return ativos, suportes, tipos


# ------------------------------------------------------------------ árvore
REGIOES = [(90, 'INT'), (30, 'DEX/INT'), (-30, 'DEX'), (-90, 'STR/DEX'), (-150, 'STR'), (150, 'STR/INT')]


def regiao(x, y):
    if math.hypot(x, y) < 1600:
        return 'centro'
    ang = math.degrees(math.atan2(-y, x))
    best = min(REGIOES, key=lambda r: min(abs(ang - r[0]), 360 - abs(ang - r[0])))
    return best[1]


def arvore(pob, ver):
    t = json.load(open(f'{pob}/src/TreeData/{ver}/tree.json', encoding='utf-8'))
    N, G = t['nodes'], t['groups']

    def pos(n):
        g = G[n['group'] - 1] if isinstance(G, list) else G[str(n['group'])]
        return g['x'], g['y']

    classes = []
    for c in t['classes']:
        classes.append({
            'n': c['name'],
            'attr': [c.get('base_str', 0), c.get('base_dex', 0), c.get('base_int', 0)],
            'asc': [a['name'] for a in c.get('ascendancies', [])],
            'ascId': {a['name']: a.get('internalId', '') for a in c.get('ascendancies', [])},
        })
    keystones, notaveis, asc = [], [], {}
    for nid, n in N.items():
        stats = [s.replace('\n', ' ') for s in n.get('stats', [])]
        if n.get('ascendancyName'):
            if not (n.get('isNotable') or n.get('isAscendancyStart')) or not stats:
                continue
            asc.setdefault(n['ascendancyName'], []).append({'id': int(nid), 'sid': n.get('stringId', ''), 'n': n['name'], 's': stats})
            for outra, o in (n.get('options') or {}).items():
                if isinstance(o, dict) and outra != n['ascendancyName']:
                    asc.setdefault(outra, []).append({'id': int(nid), 'sid': n.get('stringId', ''), 'n': o.get('name', n['name']), 's': o.get('stats', stats)})
            continue
        if n.get('isKeystone'):
            x, y = pos(n)
            keystones.append({'id': int(nid), 'sid': n.get('stringId', ''), 'n': n['name'], 's': stats, 'reg': regiao(x, y)})
        elif n.get('isNotable') and stats:
            x, y = pos(n)
            notaveis.append({'id': int(nid), 'sid': n.get('stringId', ''), 'n': n['name'], 's': stats, 'reg': regiao(x, y)})
    keystones.sort(key=lambda k: k['n'])
    notaveis.sort(key=lambda k: k['n'])
    for a in asc.values():
        a.sort(key=lambda k: k['n'])
    # nós de atributo/pequenos não entram (só notáveis, keystones e ascendência)
    # mapa id -> stringId de TODOS os nós alocáveis (exportar a árvore inteira de uma build do PoB
    # para o Build Planner do jogo); só nós com id < 65536 existem na tabela PassiveSkills
    todos = {int(nid): n['stringId'] for nid, n in N.items() if n.get('stringId') and int(nid) < 65536 and not n.get('isOnlyImage')}
    return {'classes': classes, 'keystones': keystones, 'notaveis': notaveis, 'ascendencias': asc, 'todos': todos}


# ------------------------------------------------------------------ únicos
CABECALHOS = ('Variant:', 'League:', 'Source:', 'Implicits:', 'Requires', 'Sockets:', 'Has Alt Variant', 'Selected Variant',
              'Selected Alt Variant', 'Limited to:', 'Radius:', 'Version:', 'Crafted:', 'Allow Duplicate', 'Left ring', 'Right ring',
              'LevelReq:', 'Item Level:', 'Quality:')


def unicos(pob):
    out = []
    pasta = f'{pob}/src/Data/Uniques'
    for arq in sorted(os.listdir(pasta)):
        if not arq.endswith('.lua'):
            continue
        slot = arq[:-4]
        txt = ler(os.path.join(pasta, arq))
        for bloco in re.findall(r'\[\[\n?(.*?)\]\]', txt, re.S):
            linhas = [l.strip() for l in bloco.strip().split('\n') if l.strip()]
            if len(linhas) < 2:
                continue
            nome, base = linhas[0], linhas[1]
            variantes = [l[len('Variant:'):].strip() for l in linhas if l.startswith('Variant:')]
            sel = None
            if 'Current' in variantes:
                sel = variantes.index('Current') + 1
            elif variantes:
                m = [l for l in linhas if l.startswith('Selected Variant:')]
                sel = int(m[0].split(':')[1]) if m else len(variantes)
                if not any(re.match(r'(Pre |\d)', v) for v in variantes):
                    sel = sel  # variante "de escolha" (ex.: tipo de base) — mostra a selecionada
            liga = next((l.split(':', 1)[1].strip() for l in linhas if l.startswith('League:')), '')
            mods = []
            for l in linhas[2:]:
                if l.startswith(CABECALHOS):
                    continue
                vm = re.match(r'^\{variant:([\d,]+)\}', l)
                if vm:
                    if sel is None or sel not in [int(x) for x in vm.group(1).split(',')]:
                        continue
                l = re.sub(r'\{[a-zA-Z]+(?::[^}]*)?\}', '', l).strip()
                if l:
                    mods.append(l)
            out.append({'n': nome, 'b': base, 'slot': slot, 'liga': liga, 'm': mods})
    # remove duplicatas de nome (mantém a primeira)
    vistos, final = set(), []
    for u in out:
        if u['n'] in vistos:
            continue
        vistos.add(u['n'])
        final.append(u)
    final.sort(key=lambda u: u['n'])
    return final


# ------------------------------------------------------------------ escrita
def escrever(nome, var, obj):
    p = os.path.join(SAIDA, nome)
    js = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(p, 'w', encoding='utf-8') as f:
        f.write('/* GERADO por poe2-builds-src/gerar_kb.py a partir do Path of Building 2 — não editar à mão. */\n')
        f.write(f'window.{var}=')
        f.write(js)
        f.write(';\n')
    print(f'{nome}: {len(js) // 1024} KB')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pob = sys.argv[1]
    ver, commit = versao(pob)
    consts = constantes(pob)
    ativos, suportes, tipos = gems_e_skills(pob)
    arv = arvore(pob, ver)
    uni = unicos(pob)
    meta = {
        'patch': ver.replace('_', '.'),
        'fonte': f'Path of Building 2 (commit {commit})',
        'gerado': datetime.date.today().isoformat(),
        'contagem': {'skills': len(ativos), 'suportes': len(suportes), 'unicos': len(uni),
                     'keystones': len(arv['keystones']), 'notaveis': len(arv['notaveis']),
                     'ascendencias': sum(len(c['asc']) for c in arv['classes'])},
    }
    escrever('jogo.js', 'KB_JOGO', {'meta': meta, 'consts': consts, 'classes': arv['classes'], 'tipos': tipos,
                                    'skills': ativos, 'suportes': suportes})
    escrever('nos.js', 'KB_NOS', arv['todos'])
    escrever('arvore.js', 'KB_ARVORE', {'keystones': arv['keystones'], 'notaveis': arv['notaveis'],
                                         'ascendencias': arv['ascendencias']})
    escrever('unicos.js', 'KB_UNICOS', uni)
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    main()
