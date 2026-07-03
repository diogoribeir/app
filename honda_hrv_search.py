"""
Honda HR-V EXL 2017 — Buscador Inteligente de Oportunidades
Busca em 10+ sites confiáveis, avalia custo-benefício completo e descarta anúncios suspeitos.
"""

import requests
import re
import time
import unicodedata
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURAÇÕES — edite aqui
# ══════════════════════════════════════════════════════════════════════════════
ANO_ALVO          = 2017
VERSAO_ALVO       = "EXL"
PRECO_MAX_BUSCA   = 95_000    # teto de busca (um pouco acima do mercado)
PRECO_FIPE_REF    = 80_000    # referência FIPE (~2026) — atualizado dinamicamente se possível
KM_MEDIA_ANO      = 13_000    # km/ano esperado → 2017 = ~117k km em 9 anos
KM_EXCELENTE      = 70_000    # abaixo disso: excelente estado
KM_LIMITE_ALERTA  = 160_000   # acima disso: alerta de desgaste

CORES_EXCLUIDAS = {
    "branco", "branca", "white", "off white", "off-white", "pérola", "perola",
}

# SP capital + cidades até ~1h15 de carro
CIDADES_ACEITAS = {
    "sao paulo",
    # Grande SP
    "guarulhos", "osasco", "sao bernardo do campo", "santo andre", "diadema",
    "maua", "ribeirao pires", "sao caetano do sul", "mogi das cruzes", "suzano",
    "poa", "ferraz de vasconcelos", "itaquaquecetuba", "aruja",
    "carapicuiba", "itapevi", "jandira", "barueri", "santana de parnaiba",
    "cotia", "embu das artes", "embu", "taboao da serra", "itapecerica da serra",
    "sao lourenco da serra", "mairipora", "francisco morato", "franco da rocha",
    "caieiras", "cajamar", "pirapora do bom jesus",
    # Até 1h15
    "jundiai", "atibaia", "campinas", "valinhos", "vinhedo", "itatiba",
    "louveira", "itupeva", "indaiatuba", "sorocaba", "votorantim",
    "porto feliz", "salto", "itu", "campo limpo paulista", "varzea paulista",
    "jarinu", "braganca paulista", "sao roque", "mairinque", "ibiuna",
    "aracariguama", "santana de parnaiba",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "application/json, text/html, */*",
}

# Indicadores positivos no anúncio
GREEN_FLAGS = [
    "único dono", "unico dono", "1 dono", "revisão em dia", "revisoes em dia",
    "revisão concessionária", "revisao concessionaria", "revisões na honda",
    "ipva pago", "ipva quitado", "sem multa", "sem débito", "sem debito",
    "garantia", "laudo cautelar", "laudo aprovado", "sem sinistro",
    "impecável", "impecavel", "original", "chave reserva", "manual do proprietário",
    "placa i", "vistoriado", "licenciado",
]

# Indicadores negativos claros
RED_FLAGS = [
    "batido", "funilaria", "funileiro", "amassado", "reformado",
    "sem laudo", "sinistro", "recuperado", "leilão", "leilao",
    "vendo partes", "para peças", "para pecas", "motor com defeito",
    "câmbio com defeito", "ar não funciona", "ar condicionado com defeito",
    "lataria com dano",
]

# Indicadores de golpe/fraude — anúncio descartado
SCAM_FLAGS = [
    "preciso vender urgente", "viagem ao exterior", "fora do país", "fora do pais",
    "preciso de dinheiro rápido", "preciso de dinheiro rapido",
    "vendo por transferência antes", "pix antes", "sinal antes de ver",
    "deposito antes", "não posso mostrar", "nao posso mostrar",
    "missionário", "missionario", "pastor em viagem", "situação difícil",
    "aceito proposta absurda", "lote de carros", "carro de missão",
]


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def norm(texto: str) -> str:
    if not texto:
        return ""
    s = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def parse_km(value) -> int | None:
    if value is None:
        return None
    s = str(value).lower().replace(".", "").replace(",", "").strip()
    nums = re.findall(r"\d+", s)
    if not nums:
        return None
    val = int(nums[0])
    if val < 500 and "km" not in s:
        val *= 1_000
    return val if val < 900_000 else None


def fmt_price(v) -> str:
    if v is None:
        return "N/I"
    return "R$ " + f"{int(v):,}".replace(",", ".")


def fmt_km(v) -> str:
    km = parse_km(v) if not isinstance(v, int) else v
    if km is None:
        return "N/I"
    return f"{km:,} km".replace(",", ".")


def eh_exl(titulo: str, versao: str | None) -> bool:
    t = norm(titulo) + " " + norm(versao or "")
    # Deve ter EXL, não pode ser só LX ou EX sem L
    if "exl" in t:
        return True
    # WebMotors pode ter "ex-l" ou "ex l"
    if re.search(r"\bex[\s\-]?l\b", t):
        return True
    return False


def eh_ano_certo(titulo: str, ano) -> bool:
    t = norm(titulo)
    ano_str = str(ano or "")[:4]
    if ano_str == str(ANO_ALVO):
        return True
    if str(ANO_ALVO) in t:
        return True
    if not ano_str:
        return True  # sem info de ano, não descarta
    return False


def cor_ok(cor: str | None) -> bool:
    if not cor:
        return True
    return norm(cor) not in CORES_EXCLUIDAS


def cidade_ok(cidade: str | None, estado: str | None) -> bool:
    if not cidade:
        return True
    if estado and norm(estado) not in {"sp", "sao paulo"}:
        return False
    return norm(cidade) in CIDADES_ACEITAS


def detectar_flags(texto: str) -> tuple[list, list, bool]:
    t = norm(texto)
    green = [f for f in GREEN_FLAGS if norm(f) in t]
    red = [f for f in RED_FLAGS if norm(f) in t]
    scam = any(norm(f) in t for f in SCAM_FLAGS)
    return green, red, scam


def preco_suspeito(preco: float | None, fipe_ref: float) -> str:
    """Retorna '' (ok), 'alerta' ou 'scam'."""
    if preco is None:
        return ""
    diff = (fipe_ref - preco) / fipe_ref
    if diff > 0.35:
        return "scam"   # >35% abaixo da FIPE = quase certamente golpe
    if diff > 0.20:
        return "alerta"  # >20% abaixo = muito suspeito
    return ""


# ══════════════════════════════════════════════════════════════════════════════
#  SCORING — avaliação completa de custo-benefício
# ══════════════════════════════════════════════════════════════════════════════

def score_listing(item: dict, fipe_ref: float) -> float:
    """
    Score 0–100 baseado em:
      Preço vs FIPE  (0-25 pts)
      Quilometragem  (0-30 pts)
      Manutenção/histórico (0-25 pts — via flags e descrição)
      Qualidade do anúncio (0-20 pts)
    """
    score = 0.0
    desc = str(item.get("titulo", "")) + " " + str(item.get("descricao", ""))
    green, red, _ = detectar_flags(desc)

    # ── 1. Preço vs FIPE (25 pts) ────────────────────────────────────────────
    preco = item.get("preco")
    if preco:
        ratio = (fipe_ref - preco) / fipe_ref  # positivo = abaixo da FIPE (bom)
        pts_preco = min(25, max(0, ratio * 80 + 15))
        score += pts_preco
    else:
        score += 5  # penaliza levemente quem não informa preço

    # ── 2. Quilometragem (30 pts) ────────────────────────────────────────────
    km = parse_km(item.get("km"))
    if km is not None:
        if km < 50_000:
            score += 30
        elif km < 80_000:
            score += 26
        elif km < 110_000:
            score += 20
        elif km < 140_000:
            score += 13
        elif km < 160_000:
            score += 7
        else:
            score += 2
    else:
        score += 5  # penaliza por falta de informação

    # ── 3. Manutenção e histórico (25 pts) ───────────────────────────────────
    manut_flags = {
        "revisão em dia": 7, "revisoes em dia": 7,
        "revisão concessionária": 8, "revisao concessionaria": 8,
        "revisões na honda": 8,
        "único dono": 6, "unico dono": 6, "1 dono": 6,
        "laudo cautelar": 5, "laudo aprovado": 5, "sem sinistro": 4,
        "ipva pago": 2, "sem débito": 2, "sem debito": 2,
        "garantia": 3, "chave reserva": 2, "manual do proprietário": 2,
    }
    pts_manut = 0
    t = norm(desc)
    for flag, pts in manut_flags.items():
        if norm(flag) in t:
            pts_manut += pts
    score += min(25, pts_manut)

    # ── 4. Qualidade do anúncio (20 pts) ─────────────────────────────────────
    pts_anuncio = 0
    if item.get("preco"):
        pts_anuncio += 5
    if item.get("km"):
        pts_anuncio += 5
    if item.get("ano"):
        pts_anuncio += 2
    if item.get("versao"):
        pts_anuncio += 2
    desc_len = len(str(item.get("descricao", "")))
    if desc_len > 200:
        pts_anuncio += 6
    elif desc_len > 80:
        pts_anuncio += 3
    score += min(20, pts_anuncio)

    # ── Penalidades ───────────────────────────────────────────────────────────
    score -= len(red) * 6

    return round(max(0, min(100, score)), 1)


# ══════════════════════════════════════════════════════════════════════════════
#  FETCH FIPE (dinâmico, fallback para constante)
# ══════════════════════════════════════════════════════════════════════════════

def buscar_preco_fipe() -> float:
    """
    Tenta buscar preço FIPE para Honda HR-V EXL 1.8 FlexOne 2017.
    Código FIPE Honda: 023; HR-V EXL 2017 ~ 023292-7
    """
    try:
        # Passo 1: tabela de referência atual
        r = requests.post(
            "https://veiculos.fipe.org.br/api/veiculos//ConsultarTabelaDeReferencia",
            json={}, headers=HEADERS, timeout=10
        )
        tabelas = r.json()
        cod_tabela = tabelas[0]["Codigo"]  # mais recente

        # Passo 2: consultar preço direto pelo código FIPE conhecido
        # HR-V EXL 1.8 FlexOne CVT 2017/2017 — código aproximado
        for cod_fipe in ["023292-7", "023293-5", "023291-9"]:
            r2 = requests.post(
                "https://veiculos.fipe.org.br/api/veiculos//ConsultarValorComTodosParametros",
                json={
                    "codigoTabelaReferencia": cod_tabela,
                    "codigoMarca": 23,           # Honda
                    "codigoModelo": 6785,         # HR-V (aproximado)
                    "codigoTipoCombustivel": 3,   # Gasolina/Álcool
                    "anoModelo": 2017,
                    "codigoAnoModelo": "2017-3",
                    "tipoConsulta": "tradicional",
                },
                headers=HEADERS, timeout=10
            )
            data = r2.json()
            if "Valor" in data:
                preco_txt = data["Valor"].replace("R$", "").replace(".", "").replace(",", ".").strip()
                preco = float(preco_txt)
                print(f"  FIPE obtida: {fmt_price(preco)} ({data.get('CodigoFipe','?')})")
                return preco
    except Exception:
        pass

    print(f"  FIPE: usando referência fixa de {fmt_price(PRECO_FIPE_REF)}")
    return PRECO_FIPE_REF


# ══════════════════════════════════════════════════════════════════════════════
#  SITES DE BUSCA (10+)
# ══════════════════════════════════════════════════════════════════════════════

def buscar_mercadolivre() -> list[dict]:
    """Site 1 — Mercado Livre (API oficial)"""
    print("  [1] Mercado Livre...")
    resultados, offset = [], 0
    while offset < 200:
        try:
            r = requests.get(
                "https://api.mercadolibre.com/sites/MLB/search",
                params={
                    "q": f"Honda HR-V EXL {ANO_ALVO}",
                    "category": "MLB1744",
                    "price_to": PRECO_MAX_BUSCA,
                    "offset": offset, "limit": 50,
                },
                headers=HEADERS, timeout=15
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"    ⚠ {e}"); break

        items = data.get("results", [])
        total = data.get("paging", {}).get("total", 0)
        if not items:
            break

        for item in items:
            titulo = item.get("title", "")
            if not re.search(r"hr.?v", titulo, re.IGNORECASE):
                continue
            attrs = {a["id"]: a.get("value_name") for a in item.get("attributes", [])}
            resultados.append({
                "fonte": "Mercado Livre",
                "titulo": titulo,
                "preco": item.get("price"),
                "km": attrs.get("VEHICLE_MILEAGE") or attrs.get("KILOMETERS"),
                "ano": attrs.get("VEHICLE_YEAR"),
                "versao": attrs.get("TRIM") or attrs.get("MODEL"),
                "cambio": attrs.get("VEHICLE_TRANSMISSION"),
                "cor": attrs.get("COLOR"),
                "cidade": item.get("address", {}).get("city_name", ""),
                "estado": item.get("address", {}).get("state_name", ""),
                "descricao": "",
                "link": item.get("permalink", ""),
            })
        offset += 50
        if offset >= total:
            break
        time.sleep(0.4)

    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_webmotors() -> list[dict]:
    """Site 2 — WebMotors (API)"""
    print("  [2] WebMotors...")
    resultados = []
    base = (
        "https://www.webmotors.com.br/carros/estoque/?TipoVeiculo=carros"
        f"&Marca=HONDA&Modelo=HR-V&AnoModelo={ANO_ALVO}&PrecoAte={PRECO_MAX_BUSCA}"
    )
    for page in range(1, 6):
        try:
            r = requests.get(
                "https://www.webmotors.com.br/api/search/car",
                params={
                    "url": f"{base}&Pag={page}",
                    "actualPage": page, "displayPerPage": 24,
                    "order": 1, "showMenu": "true", "listFilters": "true",
                },
                headers=HEADERS, timeout=15
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"    ⚠ p.{page}: {e}"); break

        anuncios = data.get("SearchResults", [])
        if not anuncios:
            break

        for a in anuncios:
            spec = a.get("Specification", {})
            prices = a.get("Prices", {})
            preco = prices.get("Price") or prices.get("PriceValue")
            if preco and preco > PRECO_MAX_BUSCA:
                continue
            titulo = (
                f"{spec.get('Make','')} {spec.get('Model','')} "
                f"{spec.get('Version','')} {spec.get('ModelYear','')}".strip()
            )
            resultados.append({
                "fonte": "WebMotors",
                "titulo": titulo,
                "preco": preco,
                "km": spec.get("OdometerLastValue"),
                "ano": spec.get("ModelYear") or spec.get("YearFabrication"),
                "versao": spec.get("Version"),
                "cambio": spec.get("GearShift"),
                "cor": spec.get("Color"),
                "cidade": a.get("Seller", {}).get("City", ""),
                "estado": a.get("Seller", {}).get("State", ""),
                "descricao": "",
                "link": f"https://www.webmotors.com.br/carros/anuncio/{a.get('UniqueId','')}",
            })
        if len(anuncios) < 24:
            break
        time.sleep(0.5)

    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_olx() -> list[dict]:
    """Site 3 — OLX"""
    print("  [3] OLX...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        for page in range(1, 4):
            url = (
                f"https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/honda"
                f"?q=hr-v+exl+{ANO_ALVO}&pe={PRECO_MAX_BUSCA}&re=sao_paulo&o={page}"
            )
            r = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(r.text, "lxml")
            cards = soup.select("li[data-lurker-detail='result_card']") or \
                    soup.select("section[data-ds-component='DS-AdCard']") or \
                    soup.select("div[data-testid='listing-card']")
            if not cards:
                break
            for card in cards:
                try:
                    titulo = card.select_one("h2,h3,[class*='title']")
                    titulo = titulo.get_text(strip=True) if titulo else ""
                    preco_el = card.select_one("[class*='price']")
                    preco_txt = preco_el.get_text(strip=True) if preco_el else ""
                    nums = re.findall(r"\d+", preco_txt.replace(".", ""))
                    preco = int(nums[0]) if nums else None
                    link_el = card.select_one("a[href]")
                    link = link_el["href"] if link_el else ""
                    if link and not link.startswith("http"):
                        link = "https://www.olx.com.br" + link
                    local_el = card.select_one("[class*='location']") or card.select_one("[class*='cidade']")
                    local_txt = local_el.get_text(strip=True) if local_el else ""
                    cidade = local_txt.split(",")[0].strip() if local_txt else ""
                    resultados.append({
                        "fonte": "OLX",
                        "titulo": titulo, "preco": preco, "km": None, "ano": None,
                        "versao": None, "cambio": None, "cor": None,
                        "cidade": cidade, "estado": "SP", "descricao": "",
                        "link": link,
                    })
                except Exception:
                    continue
            time.sleep(0.7)
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_icarros() -> list[dict]:
    """Site 4 — iCarros"""
    print("  [4] iCarros...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        for page in range(1, 4):
            url = (
                f"https://www.icarros.com.br/ache/listaanuncios.jsp"
                f"?pag={page}&ord=2&modelo=5&marca=21"
                f"&anoFabricacaoDe={ANO_ALVO}&anoFabricacaoAte={ANO_ALVO}"
                f"&priceMax={PRECO_MAX_BUSCA}"
            )
            r = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(r.text, "lxml")
            cards = soup.select("li.ads__list__item") or soup.select(".anuncio")
            if not cards:
                break
            for card in cards:
                try:
                    titulo = (card.select_one("[class*='title']") or card.select_one("h2"))
                    titulo = titulo.get_text(strip=True) if titulo else ""
                    preco_el = card.select_one("[class*='price']") or card.select_one(".preco")
                    nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".", ""))
                    preco = int(nums[0]) if nums else None
                    km_el = card.select_one("[class*='km']") or card.select_one(".km")
                    km_txt = km_el.get_text(strip=True) if km_el else ""
                    link_el = card.select_one("a[href]")
                    link = link_el["href"] if link_el else ""
                    if link and not link.startswith("http"):
                        link = "https://www.icarros.com.br" + link
                    resultados.append({
                        "fonte": "iCarros",
                        "titulo": titulo, "preco": preco, "km": km_txt,
                        "ano": ANO_ALVO, "versao": None, "cambio": None, "cor": None,
                        "cidade": "", "estado": "SP", "descricao": "", "link": link,
                    })
                except Exception:
                    continue
            time.sleep(0.5)
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_kavak() -> list[dict]:
    """Site 5 — Kavak (seminovos certificados)"""
    print("  [5] Kavak...")
    resultados = []
    try:
        # Kavak tem endpoint de busca JSON
        params = {
            "make": "Honda", "model": "HR-V", "trim": "EXL",
            "fromYear": ANO_ALVO, "toYear": ANO_ALVO,
            "maxPrice": PRECO_MAX_BUSCA, "hubId": "sao-paulo",
        }
        r = requests.get(
            "https://www.kavak.com/br/api/inventories/search",
            params=params, headers=HEADERS, timeout=15
        )
        data = r.json()
        items = data.get("data", {}).get("inventories", []) or data.get("items", []) or []
        for item in items:
            resultados.append({
                "fonte": "Kavak ✓",  # ✓ = seminovo certificado
                "titulo": item.get("title") or f"Honda HR-V EXL {ANO_ALVO}",
                "preco": item.get("price") or item.get("retailPrice"),
                "km": item.get("mileage") or item.get("km"),
                "ano": item.get("year") or ANO_ALVO,
                "versao": item.get("trim") or "EXL",
                "cambio": item.get("transmission"),
                "cor": item.get("color") or item.get("exteriorColor"),
                "cidade": item.get("city") or "São Paulo",
                "estado": item.get("state") or "SP",
                "descricao": "Kavak: laudo cautelar, garantia e revisão inclusos",
                "link": f"https://www.kavak.com/br/carro/{item.get('slug','honda-hrv')}",
            })
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_mobiauto() -> list[dict]:
    """Site 6 — Mobiauto"""
    print("  [6] Mobiauto...")
    resultados = []
    try:
        r = requests.get(
            "https://www.mobiauto.com.br/api/search",
            params={
                "make": "honda", "model": "hr-v", "trim": "exl",
                "yearFrom": ANO_ALVO, "yearTo": ANO_ALVO,
                "priceMax": PRECO_MAX_BUSCA, "state": "SP",
                "page": 1, "pageSize": 30,
            },
            headers=HEADERS, timeout=15
        )
        data = r.json()
        items = data.get("ads", []) or data.get("result", {}).get("ads", []) or []
        for item in items:
            resultados.append({
                "fonte": "Mobiauto",
                "titulo": item.get("title", f"Honda HR-V EXL {ANO_ALVO}"),
                "preco": item.get("price"),
                "km": item.get("mileage"),
                "ano": item.get("year") or ANO_ALVO,
                "versao": item.get("version") or "EXL",
                "cambio": item.get("transmission"),
                "cor": item.get("color"),
                "cidade": item.get("city", ""),
                "estado": item.get("state", "SP"),
                "descricao": item.get("description", ""),
                "link": item.get("url", "") or f"https://www.mobiauto.com.br/anuncio/{item.get('id','')}",
            })
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_vrum() -> list[dict]:
    """Site 7 — Vrum"""
    print("  [7] Vrum...")
    resultados = []
    try:
        r = requests.get(
            "https://www.vrum.com.br/api/v1/ads",
            params={
                "brand": "honda", "model": "hr-v", "version": "exl",
                "year_start": ANO_ALVO, "year_end": ANO_ALVO,
                "price_end": PRECO_MAX_BUSCA, "state": "SP", "per_page": 30,
            },
            headers=HEADERS, timeout=15
        )
        data = r.json()
        items = data.get("data", []) or data.get("ads", []) or []
        for item in items:
            resultados.append({
                "fonte": "Vrum",
                "titulo": item.get("title", f"Honda HR-V EXL {ANO_ALVO}"),
                "preco": item.get("price"),
                "km": item.get("mileage"),
                "ano": item.get("year") or ANO_ALVO,
                "versao": item.get("version") or "EXL",
                "cambio": item.get("transmission"),
                "cor": item.get("color"),
                "cidade": item.get("city", ""),
                "estado": item.get("state", "SP"),
                "descricao": item.get("description", ""),
                "link": item.get("url", "") or f"https://www.vrum.com.br/anuncio/{item.get('id','')}",
            })
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_autoline() -> list[dict]:
    """Site 8 — AutoLine"""
    print("  [8] AutoLine...")
    resultados = []
    try:
        r = requests.get(
            "https://www.autoline.com.br/api/search",
            params={
                "brand": "honda", "model": "hr-v",
                "year_from": ANO_ALVO, "year_to": ANO_ALVO,
                "price_to": PRECO_MAX_BUSCA, "state": "SP", "page": 1,
            },
            headers=HEADERS, timeout=15
        )
        data = r.json()
        for item in (data.get("data") or data.get("ads") or []):
            resultados.append({
                "fonte": "AutoLine",
                "titulo": item.get("title", f"Honda HR-V {ANO_ALVO}"),
                "preco": item.get("price"),
                "km": item.get("mileage"),
                "ano": item.get("year") or ANO_ALVO,
                "versao": item.get("version"),
                "cambio": item.get("transmission"),
                "cor": item.get("color"),
                "cidade": item.get("city", ""),
                "estado": item.get("state", "SP"),
                "descricao": item.get("description", ""),
                "link": item.get("url", ""),
            })
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_localiza_seminovos() -> list[dict]:
    """Site 9 — Localiza Seminovos (frota certificada)"""
    print("  [9] Localiza Seminovos...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = requests.get(
            f"https://seminovos.localiza.com/carros?marca=honda&modelo=hr-v"
            f"&anoInicio={ANO_ALVO}&anoFim={ANO_ALVO}",
            headers=HEADERS, timeout=15
        )
        soup = BeautifulSoup(r.text, "lxml")
        cards = soup.select("[class*='card']") or soup.select("[class*='veiculo']")
        for card in cards:
            try:
                titulo = card.select_one("h2,h3,[class*='title']")
                titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                preco_el = card.select_one("[class*='price'],[class*='preco']")
                nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".", ""))
                preco = int(nums[0]) if nums else None
                km_el = card.select_one("[class*='km']")
                km_txt = km_el.get_text(strip=True) if km_el else ""
                link_el = card.select_one("a")
                link = link_el["href"] if link_el and link_el.has_attr("href") else ""
                if link and not link.startswith("http"):
                    link = "https://seminovos.localiza.com" + link
                resultados.append({
                    "fonte": "Localiza Seminovos ✓",
                    "titulo": titulo, "preco": preco, "km": km_txt,
                    "ano": ANO_ALVO, "versao": None, "cambio": None, "cor": None,
                    "cidade": "São Paulo", "estado": "SP",
                    "descricao": "Frota Localiza: laudo cautelar e garantia",
                    "link": link,
                })
            except Exception:
                continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_movida_seminovos() -> list[dict]:
    """Site 10 — Movida Seminovos (frota certificada)"""
    print("  [10] Movida Seminovos...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = requests.get(
            f"https://www.movida.com.br/seminovos?marca=Honda&modelo=HR-V"
            f"&anoMin={ANO_ALVO}&anoMax={ANO_ALVO}",
            headers=HEADERS, timeout=15
        )
        soup = BeautifulSoup(r.text, "lxml")
        cards = soup.select("[class*='card'],[class*='carro'],[class*='veiculo']")
        for card in cards:
            try:
                titulo = card.select_one("h2,h3,[class*='title']")
                titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V {ANO_ALVO}"
                preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".", ""))
                preco = int(nums[0]) if nums else None
                km_el = card.select_one("[class*='km'],[class*='quilometro']")
                km_txt = km_el.get_text(strip=True) if km_el else ""
                link_el = card.select_one("a[href]")
                link = link_el["href"] if link_el else ""
                if link and not link.startswith("http"):
                    link = "https://www.movida.com.br" + link
                resultados.append({
                    "fonte": "Movida Seminovos ✓",
                    "titulo": titulo, "preco": preco, "km": km_txt,
                    "ano": ANO_ALVO, "versao": None, "cambio": None, "cor": None,
                    "cidade": "São Paulo", "estado": "SP",
                    "descricao": "Frota Movida: revisão e documentação em dia",
                    "link": link,
                })
            except Exception:
                continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_honda_seminovos() -> list[dict]:
    """Site 11 — Honda Seminovos (rede oficial Honda)"""
    print("  [11] Honda Seminovos Oficial...")
    resultados = []
    try:
        r = requests.get(
            "https://www.honda.com.br/automoveis/seminovos/estoque",
            params={
                "modelo": "HR-V", "versao": "EXL",
                "anoMin": ANO_ALVO, "anoMax": ANO_ALVO,
                "precoMax": PRECO_MAX_BUSCA, "estado": "SP",
            },
            headers=HEADERS, timeout=15
        )
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "lxml")
        cards = soup.select("[class*='card'],[class*='seminovo'],[class*='veiculo']")
        for card in cards:
            try:
                titulo = card.select_one("h2,h3,[class*='title']")
                titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                preco_el = card.select_one("[class*='price'],[class*='preco']")
                nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".", ""))
                preco = int(nums[0]) if nums else None
                km_el = card.select_one("[class*='km']")
                km_txt = km_el.get_text(strip=True) if km_el else ""
                link_el = card.select_one("a[href]")
                link = link_el["href"] if link_el else ""
                if link and not link.startswith("http"):
                    link = "https://www.honda.com.br" + link
                resultados.append({
                    "fonte": "Honda Seminovos Oficial ✓",
                    "titulo": titulo, "preco": preco, "km": km_txt,
                    "ano": ANO_ALVO, "versao": "EXL", "cambio": None, "cor": None,
                    "cidade": "", "estado": "SP",
                    "descricao": "Rede oficial Honda: revisão, garantia e laudo cautelar",
                    "link": link,
                })
            except Exception:
                continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_autoshow() -> list[dict]:
    """Site 12 — AutoShow (concessionária SP)"""
    print("  [12] AutoShow...")
    resultados = []
    try:
        r = requests.get(
            "https://www.autoshow.com.br/estoque",
            params={
                "marca": "honda", "modelo": "hr-v",
                "ano": ANO_ALVO, "versao": "exl",
            },
            headers=HEADERS, timeout=15
        )
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "lxml")
        cards = soup.select("[class*='card'],[class*='veiculo']")
        for card in cards:
            try:
                titulo = card.select_one("h2,h3")
                titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".", ""))
                preco = int(nums[0]) if nums else None
                link_el = card.select_one("a[href]")
                link = link_el["href"] if link_el else ""
                resultados.append({
                    "fonte": "AutoShow",
                    "titulo": titulo, "preco": preco, "km": None,
                    "ano": ANO_ALVO, "versao": "EXL", "cambio": None, "cor": None,
                    "cidade": "São Paulo", "estado": "SP", "descricao": "",
                    "link": link if link.startswith("http") else "https://www.autoshow.com.br" + link,
                })
            except Exception:
                continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


# ══════════════════════════════════════════════════════════════════════════════
#  SAÍDA FORMATADA
# ══════════════════════════════════════════════════════════════════════════════

def imprimir_item(rank: int, item: dict, fipe_ref: float):
    V = "\033[92m"   # verde
    R = "\033[91m"   # vermelho
    Y = "\033[93m"   # amarelo
    B = "\033[1m"    # negrito
    X = "\033[0m"    # reset

    score = item["_score"]
    barra = "█" * int(score / 10) + "░" * (10 - int(score / 10))
    cor_score = V if score >= 65 else (Y if score >= 45 else R)

    desc = str(item.get("titulo", "")) + " " + str(item.get("descricao", ""))
    green, red, _ = detectar_flags(desc)

    # Diferença vs FIPE
    preco = item.get("preco")
    fipe_txt = ""
    if preco:
        diff_pct = (fipe_ref - preco) / fipe_ref * 100
        if diff_pct > 0:
            fipe_txt = f" {V}({diff_pct:.0f}% abaixo FIPE){X}"
        elif diff_pct < 0:
            fipe_txt = f" {R}({abs(diff_pct):.0f}% acima FIPE){X}"
        else:
            fipe_txt = " (na FIPE)"

    print(f"\n{B}#{rank:02d}{X} [{barra}] {cor_score}{B}{score:.0f}/100{X}  {B}[{item['fonte']}]{X}")
    print(f"     {B}{item['titulo']}{X}")
    print(f"     Preço  : {V}{B}{fmt_price(preco)}{X}{fipe_txt}")
    print(f"     KM     : {fmt_km(item.get('km'))}")
    print(f"     Ano    : {item.get('ano') or 'N/I'}")
    if item.get("versao"):
        print(f"     Versão : {item['versao']}")
    if item.get("cambio"):
        print(f"     Câmbio : {item['cambio']}")
    if item.get("cor"):
        print(f"     Cor    : {item['cor']}")
    local = f"{item.get('cidade','')} {item.get('estado','')}".strip()
    if local:
        print(f"     Local  : {local}")
    if item.get("descricao") and len(item["descricao"]) > 10:
        trecho = item["descricao"][:120].replace("\n", " ")
        print(f"     Desc   : {trecho}{'...' if len(item['descricao']) > 120 else ''}")
    if green:
        print(f"     {V}✔ {' | '.join(green[:5])}{X}")
    if red:
        print(f"     {R}⚠ {' | '.join(red)}{X}")
    print(f"     Link   : {item['link']}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("═" * 68)
    print(f"  HONDA HR-V EXL {ANO_ALVO} — Buscador de Oportunidades")
    print(f"  Cor: sem branco  |  Local: SP + até 1h15 de carro")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("═" * 68)

    print("\n[Referência de preço]")
    fipe_ref = buscar_preco_fipe()

    print("\n[Buscando em 12 sites...]")
    todos = []
    todos += buscar_mercadolivre()
    todos += buscar_webmotors()
    todos += buscar_olx()
    todos += buscar_icarros()
    todos += buscar_kavak()
    todos += buscar_mobiauto()
    todos += buscar_vrum()
    todos += buscar_autoline()
    todos += buscar_localiza_seminovos()
    todos += buscar_movida_seminovos()
    todos += buscar_honda_seminovos()
    todos += buscar_autoshow()

    if not todos:
        print("\nNenhum resultado coletado. Verifique sua conexão.")
        return

    # ── Deduplica ────────────────────────────────────────────────────────────
    vistos, unicos = set(), []
    for item in todos:
        chave = item.get("link", "").split("?")[0].rstrip("/")
        if chave and chave not in vistos:
            vistos.add(chave)
            unicos.append(item)

    total_bruto = len(unicos)
    motivos = {"versao": 0, "ano": 0, "cor": 0, "cidade": 0, "suspeito": 0, "preco_scam": 0}

    validos = []
    alertas = []

    for item in unicos:
        desc = str(item.get("titulo", "")) + " " + str(item.get("descricao", ""))

        # ── Filtro de versão (só EXL) ─────────────────────────────────────
        if not eh_exl(item.get("titulo", ""), item.get("versao")):
            motivos["versao"] += 1
            continue

        # ── Filtro de ano ─────────────────────────────────────────────────
        if not eh_ano_certo(item.get("titulo", ""), item.get("ano")):
            motivos["ano"] += 1
            continue

        # ── Filtro de cor ─────────────────────────────────────────────────
        if not cor_ok(item.get("cor")):
            motivos["cor"] += 1
            continue

        # ── Filtro de cidade ──────────────────────────────────────────────
        if not cidade_ok(item.get("cidade"), item.get("estado")):
            motivos["cidade"] += 1
            continue

        # ── Detector de golpe/fraude ──────────────────────────────────────
        _, _, scam_desc = detectar_flags(desc)
        scam_preco = preco_suspeito(item.get("preco"), fipe_ref)

        if scam_desc or scam_preco == "scam":
            motivos["suspeito"] += 1
            continue  # descarta completamente

        item["_score"] = score_listing(item, fipe_ref)
        item["_alerta_preco"] = scam_preco == "alerta"

        if scam_preco == "alerta":
            alertas.append(item)
        else:
            validos.append(item)

    ranking = sorted(validos, key=lambda x: x["_score"], reverse=True)
    ranking_alertas = sorted(alertas, key=lambda x: x["_score"], reverse=True)

    # ── Resultado principal ───────────────────────────────────────────────────
    print(f"\n{'═' * 68}")
    print(f"  FILTROS APLICADOS (de {total_bruto} únicos coletados):")
    print(f"    Versão ≠ EXL     : -{motivos['versao']}")
    print(f"    Ano ≠ {ANO_ALVO}       : -{motivos['ano']}")
    print(f"    Cor branca       : -{motivos['cor']}")
    print(f"    Fora da área     : -{motivos['cidade']}")
    print(f"    Anúncio suspeito : -{motivos['suspeito']} (descartados)")
    print(f"  ══ {len(ranking)} anúncios válidos  |  {len(alertas)} com alerta de preço")
    print(f"{'═' * 68}")

    if not ranking and not ranking_alertas:
        print("\n  Nenhum anúncio passou pelos filtros.")
        return

    if ranking:
        print(f"\n  {'▶ TOP OPORTUNIDADES':^64}")
        print(f"  (FIPE ref.: {fmt_price(fipe_ref)}  |  Score considera preço, km, manutenção e qualidade)\n")
        for i, item in enumerate(ranking[:20], 1):
            imprimir_item(i, item, fipe_ref)

    if ranking_alertas:
        Y = "\033[93m"
        X = "\033[0m"
        print(f"\n{'─' * 68}")
        print(f"{Y}  ⚠ ANÚNCIOS COM PREÇO MUITO ABAIXO DA FIPE (verifique antes de contatar){X}")
        print(f"{'─' * 68}")
        for i, item in enumerate(ranking_alertas[:5], 1):
            imprimir_item(i, item, fipe_ref)

    # ── Resumo ────────────────────────────────────────────────────────────────
    todos_validos = ranking + ranking_alertas
    precos = [x["preco"] for x in todos_validos if x.get("preco")]
    kms    = [parse_km(x["km"]) for x in todos_validos if parse_km(x.get("km"))]

    print(f"\n{'═' * 68}")
    print("  RESUMO ESTATÍSTICO")
    print(f"{'═' * 68}")
    if precos:
        print(f"  Preço médio  : {fmt_price(int(sum(precos)/len(precos)))}")
        print(f"  Mais barato  : {fmt_price(min(precos))}")
        print(f"  Mais caro    : {fmt_price(max(precos))}")
        print(f"  Ref. FIPE    : {fmt_price(fipe_ref)}")
    if kms:
        print(f"  KM médio     : {fmt_km(int(sum(kms)/len(kms)))}")
        print(f"  Menor KM     : {fmt_km(min(kms))}")
    print(f"  Total válidos: {len(ranking)} | Com alerta: {len(alertas)} | Descartados: {motivos['suspeito']}")
    print()


if __name__ == "__main__":
    main()
