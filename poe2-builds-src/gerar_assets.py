#!/usr/bin/env python3
"""
Exile Compass — gera os dados VISUAIS do app (árvore passiva, artes e ícones).

Fontes (só dados e imagens, nada é executado):
  1) Exportação OFICIAL da árvore passiva da GGG
     https://github.com/grindinggear/poe2-skilltree-export  (data.json + assets/*.webp)
     → kb/tree.js        (nós, posições, ligações, quadros dos sprites)
     → img/tree/*.webp   (sprites dos ícones/molduras da árvore)
     → img/asc/*.webp    (retratos das classes e ascendências)
  2) RePoE PoE2  https://repoe-fork.github.io/poe2/  (dados extraídos do jogo)
     → img/gem/*.webp    (ícones das gemas de skill e de suporte)
     → kb/gemas.js       (ícone de cada gema + suportes recomendados pelo próprio jogo)

Uso:
  git clone --depth 1 https://github.com/grindinggear/poe2-skilltree-export <scratch>/ggg
  python3 -I poe2-builds-src/gerar_assets.py <scratch>/ggg <scratch>/repoe-cache
A pasta de cache guarda o skill_gems.json e os ícones baixados (não baixa de novo).
Requer Pillow (PIL) com suporte a WebP. Rodar DEPOIS do gerar_kb.py (lê kb/jogo.js).
"""
import json
import os
import re
import shutil
import ssl
import sys
import time
import urllib.request

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(AQUI), 'poe2-builds')
REPOE = 'https://repoe-fork.github.io/poe2/'


def ler_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def escrever_js(nome, var, obj, fonte):
    p = os.path.join(APP, 'kb', nome)
    js = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    with open(p, 'w', encoding='utf-8') as f:
        f.write(f'/* GERADO por poe2-builds-src/gerar_assets.py a partir de {fonte} — não editar à mão. */\n')
        f.write(f'window.{var}=')
        f.write(js)
        f.write(';\n')
    print(f'kb/{nome}: {len(js) // 1024} KB')


def limpa_stat(s):
    """'[Hit|Hits] against you' → 'Hits against you'; '[Strength]' → 'Strength'."""
    s = re.sub(r'\[([^\]|]*)\|([^\]]*)\]', r'\2', s)
    return re.sub(r'\[([^\]]*)\]', r'\1', s)


# ---------------------------------------------------------------- árvore
def arvore(ggg):
    d = ler_json(os.path.join(ggg, 'data.json'))
    N = d['nodes']
    s_on = ler_json(os.path.join(ggg, 'assets', 'skills.json'))['frames']
    s_off = ler_json(os.path.join(ggg, 'assets', 'skills-disabled.json'))['frames']
    fr = ler_json(os.path.join(ggg, 'assets', 'frame.json'))['frames']

    # ascendências lançadas (as que têm nome) e classes jogáveis
    asc_ok, classes = {}, []
    for c in d['classes']:
        ascs = [a for a in c['ascendancies'] if a.get('name')]
        if not ascs:
            continue
        classes.append({'n': c['name'], 'idx': d['classes'].index(c), 'asc': ascs, 'raw': c})
        for a in ascs:
            asc_ok[a['id']] = a['name']

    def entra(v):
        if v.get('isMastery') or v.get('isBlighted'):
            return False
        a = v.get('ascendancyId')
        if a and a not in asc_ok:
            return False
        if not v.get('name') and 'classStartIndex' not in v:
            return False
        return True

    ids = {k for k, v in N.items() if k != 'root' and entra(v)}

    quadros_on, quadros_off, qidx_on, qidx_off = [], [], {}, {}

    def quadro(chave):
        if chave not in s_on:
            return None, None
        if chave not in qidx_on:
            f = s_on[chave]['frame']
            qidx_on[chave] = len(quadros_on)
            quadros_on.append([f['x'], f['y'], f['w'], f['h']])
            g = s_off[chave.replace('Active:', 'Inactive:', 1)]['frame']
            qidx_off[chave] = len(quadros_off)
            quadros_off.append([g['x'], g['y'], g['w'], g['h']])
        return qidx_on[chave], qidx_off[chave]

    nos = []
    inicio_classe = {}
    for k in sorted(ids, key=int):
        v = N[k]
        if 'classStartIndex' in v:
            tipo = 'c'
        elif v.get('isAscendancyStart'):
            tipo = 'as'
        elif v.get('isKeystone'):
            tipo = 'k'
        elif v.get('isJewelSocket'):
            tipo = 'j'
        elif v.get('isNotable'):
            tipo = 'n'
        elif v.get('isGenericAttribute'):
            tipo = 'at'
        else:
            tipo = 's'
        cat = 'keystoneActive' if tipo == 'k' else 'notableActive' if tipo == 'n' else 'normalActive'
        f_on, f_off = quadro(cat + ':' + v.get('icon', ''))
        if f_on is None and tipo == 'n':
            f_on, f_off = quadro('normalActive:' + v.get('icon', ''))
        o = {'i': int(k), 'x': round(v['x']), 'y': round(v['y']), 't': tipo, 'n': limpa_stat(v.get('name', ''))}
        if f_on is not None:
            o['f'] = f_on
            o['g'] = f_off
        st = [limpa_stat(s) for s in v.get('stats', [])]
        if st:
            o['s'] = st
        if v.get('ascendancyId'):
            o['a'] = v['ascendancyId']
        uc = v.get('unlockConstraint')
        if uc and uc.get('ascendancy'):
            o['u'] = uc['ascendancy']
        if v.get('isMultipleChoiceOption'):
            o['p'] = int(v['multipleChoiceParent'])
        if v.get('isMultipleChoice'):
            o['mc'] = 1
        if v.get('hideConnection'):
            o['h'] = 1
        if v.get('isFree'):
            o['free'] = 1
        for a, b in (('grantedStrength', 'str'), ('grantedDexterity', 'dex'), ('grantedIntelligence', 'int')):
            if v.get(a):
                o[b] = v[a]
        if v.get('grantedPassivePoints'):
            o['pp'] = v['grantedPassivePoints']
        if tipo == 'c':
            o['ci'] = v['classStartIndex']
            for ci in v['classStartIndex']:
                inicio_classe[ci] = int(k)
        if v.get('flavourText') and tipo == 'k':
            o['fl'] = ' '.join(v['flavourText']).strip('"')
        nos.append(o)

    # ligações: retas [a,b]; arcos [a,b,cx,cy]. Some as que cruzam do início da classe à ascendência.
    lig = []
    vistos = set()
    for e in d['edges']:
        a, b = str(e['from']), str(e['to'])
        if a not in ids or b not in ids:
            continue
        va, vb = N[a], N[b]
        if bool(va.get('ascendancyId')) != bool(vb.get('ascendancyId')):
            continue
        if va.get('isMultipleChoiceOption') or vb.get('isMultipleChoiceOption'):
            continue
        par = tuple(sorted((int(a), int(b))))
        if par in vistos:
            continue
        vistos.add(par)
        item = [int(a), int(b)]
        if e.get('orbit') and 'orbitX' in e:
            item += [round(e['orbitX']), round(e['orbitY'])]
        if va.get('hideConnection') or vb.get('hideConnection'):
            item = item[:2] + ([0, 0] if len(item) == 2 else item[2:]) + [1]
        lig.append(item)

    # classes, ascendências e o centro de cada ascendência (para desenhar a arte atrás)
    cls_out = []
    for c in classes:
        idx = c['idx']
        ascs = []
        for a in c['asc']:
            base = a['id']
            ov = {}
            if a.get('overridePairs') and not any(o.get('a') == a['id'] for o in nos):
                # variante (ex.: Abyssal Lich = Lich com alguns nós trocados): usa o desenho da base
                base = a['id'].rstrip('b')
                for nid, sid in a['overridePairs'].items():
                    t = d['skillOverrides'].get(str(sid))
                    if not t:
                        continue
                    cat = 'notableActive' if t.get('isNotable') else 'normalActive'
                    f_on, f_off = quadro(cat + ':' + t.get('icon', ''))
                    x = {'i': int(sid), 'n': limpa_stat(t.get('name', '')), 's': [limpa_stat(z) for z in t.get('stats', [])]}
                    if f_on is not None:
                        x['f'], x['g'] = f_on, f_off
                    ov[nid] = x
            meus = [o for o in nos if o.get('a') == base]
            ini = next((o['i'] for o in meus if o['t'] == 'as'), None)
            xs = [o['x'] for o in meus]
            ys = [o['y'] for o in meus]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            r = max(((o['x'] - cx) ** 2 + (o['y'] - cy) ** 2) ** 0.5 for o in meus)
            extra = {'base': base, 'ov': ov} if base != a['id'] else {}
            ascs.append({**extra, 'n': a['name'], 'id': a['id'], 'ini': ini, 'cx': round(cx), 'cy': round(cy), 'r': round(r),
                         'cor': a.get('flavourTextColour', ''), 'fl': a.get('flavourText', '')})
        cls_out.append({'n': c['n'], 'ini': inicio_classe.get(idx), 'asc': ascs})

    fq = {k.split(':', 1)[1]: [v['frame']['x'], v['frame']['y'], v['frame']['w'], v['frame']['h']] for k, v in fr.items()}
    out = {
        'versao': ler_versao(ggg),
        'lim': [d['min_x'], d['min_y'], d['max_x'], d['max_y']],
        'classes': cls_out,
        'nos': nos,
        'lig': lig,
        'q': quadros_on,
        'qo': quadros_off,
        'mold': fq,
    }
    return out, classes, d


def ler_versao(ggg):
    try:
        import subprocess
        r = subprocess.run(['git', '-C', ggg, 'log', '-1', '--format=%s|%cs'], capture_output=True, text=True, check=True)
        s, data = r.stdout.strip().split('|')
        return {'patch': s, 'data': data}
    except Exception:
        return {'patch': '?', 'data': ''}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def imagens_arvore(ggg, classes):
    dst = os.path.join(APP, 'img', 'tree')
    os.makedirs(dst, exist_ok=True)
    src = os.path.join(ggg, 'assets')
    shutil.copyfile(os.path.join(src, 'skills.webp'), os.path.join(dst, 'skills.webp'))
    shutil.copyfile(os.path.join(src, 'skills-disabled.webp'), os.path.join(dst, 'skills-off.webp'))
    shutil.copyfile(os.path.join(src, 'frame.webp'), os.path.join(dst, 'frame.webp'))
    # anel do início de classe (2000px → 512px)
    gb = Image.open(os.path.join(src, 'group-background.webp'))
    gb.crop((0, 0, 2000, 2000)).resize((512, 512), Image.LANCZOS).save(os.path.join(dst, 'start-on.webp'), 'WEBP', quality=82)
    gb.crop((2000, 0, 4000, 2000)).resize((512, 512), Image.LANCZOS).save(os.path.join(dst, 'start.webp'), 'WEBP', quality=82)

    # retratos: background-<classe>.webp tem Class0 (classe base) + Class1..n (ascendências na ordem do data.json)
    dst = os.path.join(APP, 'img', 'asc')
    os.makedirs(dst, exist_ok=True)
    for c in classes:
        nome = c['n'].lower()
        meta = ler_json(os.path.join(src, f'background-{nome}.json'))
        im = Image.open(os.path.join(src, meta['meta']['image']))
        quadros = meta['frames']

        def salvar(chave, arq):
            f = quadros[chave]['frame']
            im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).resize((384, 384), Image.LANCZOS) \
                .save(os.path.join(dst, arq), 'WEBP', quality=78)

        cap = nome.capitalize()
        salvar(f'class{cap}:Class0', f'{slug(c["n"])}.webp')
        for i, a in enumerate(c['raw']['ascendancies']):
            if not a.get('name'):
                continue
            chave = f'class{cap}:Class{i + 1}'
            if chave in quadros:
                salvar(chave, f'{slug(a["name"])}.webp')
    print('img/tree e img/asc: ok')


# ---------------------------------------------------------------- gemas
def baixar(url, destino, ctx):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return True
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60, context=ctx) as r:
                dados = r.read()
            with open(destino, 'wb') as f:
                f.write(dados)
            return True
        except Exception as e:  # noqa: BLE001
            if getattr(e, 'code', 0) == 404:
                return False
            time.sleep(2 * (tentativa + 1))
    return False


def ler_kb_jogo():
    with open(os.path.join(APP, 'kb', 'jogo.js'), encoding='utf-8') as f:
        txt = f.read()
    ini = txt.index('window.KB_JOGO=') + len('window.KB_JOGO=')
    return json.loads(txt[ini:].rstrip().rstrip(';'))


def gemas(cache):
    os.makedirs(cache, exist_ok=True)
    caf = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
    ctx = ssl.create_default_context(cafile=caf) if caf else ssl.create_default_context()
    pg = os.path.join(cache, 'skill_gems.json')
    if not baixar(REPOE + 'skill_gems.json', pg, ctx):
        raise SystemExit('não consegui baixar skill_gems.json do RePoE')
    rg = ler_json(pg)
    nome_de = {k: (v.get('base_item') or {}).get('display_name') for k, v in rg.items()}
    J = ler_kb_jogo()
    sup_nomes = {s['n'] for s in J['suportes']}
    dst = os.path.join(APP, 'img', 'gem')
    os.makedirs(dst, exist_ok=True)
    icones = os.path.join(cache, 'icones')
    os.makedirs(icones, exist_ok=True)
    out, falhas, usados = {}, [], set()
    for lista, ativo in ((J['skills'], True), (J['suportes'], False)):
        for g in lista:
            r = rg.get(g['gid'])
            if not r or not r.get('icon_dds_file'):
                falhas.append(g['n'])
                continue
            dds = r['icon_dds_file']
            base = dds[:-4] if dds.lower().endswith('.dds') else dds
            if '/' not in base:
                base = 'Art/2DArt/SkillIcons/' + base
            arq = slug(base.rsplit('/', 1)[1]) + '.webp'
            if not baixar(REPOE + base + '.webp', os.path.join(icones, arq), ctx):
                falhas.append(g['n'])
                continue
            if arq not in usados:
                im = Image.open(os.path.join(icones, arq)).convert('RGBA')
                if max(im.size) > 64:
                    im = im.resize((64, 64), Image.LANCZOS)
                im.save(os.path.join(dst, arq), 'WEBP', quality=80, method=6)
                usados.add(arq)
            item = [arq[:-5]]
            if ativo:
                rec = []
                for sid in r.get('recommended_supports') or []:
                    n = nome_de.get(sid)
                    if n and n in sup_nomes and n not in rec:
                        rec.append(n)
                if rec:
                    item.append(rec)
            out[g['n']] = item
    # remove ícones órfãos de gerações antigas
    for f in os.listdir(dst):
        if f.endswith('.webp') and f not in usados:
            os.remove(os.path.join(dst, f))
    print(f'img/gem: {len(usados)} ícones; sem ícone: {len(falhas)} {falhas[:8]}')
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    ggg, cache = sys.argv[1], sys.argv[2]
    tree, classes, _ = arvore(ggg)
    escrever_js('tree.js', 'KB_TREE', tree, 'poe2-skilltree-export (GGG)')
    imagens_arvore(ggg, classes)
    g = gemas(cache)
    escrever_js('gemas.js', 'KB_GEMAS', g, 'RePoE PoE2 (ícones e suportes recomendados)')


if __name__ == '__main__':
    main()
