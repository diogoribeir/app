"""
Honda HR-V EXL 2017 — Buscador Inteligente de Oportunidades
Busca em 10+ sites confiáveis, avalia custo-benefício completo e descarta anúncios suspeitos.
Gera arquivo HTML com links clicáveis que abre no navegador automaticamente.
"""

import requests
import re
import time
import unicodedata
import json
import webbrowser
import os
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
#  CONFIGURAÇÕES — edite aqui
# ══════════════════════════════════════════════════════════════════════════════
ANO_ALVO         = 2017
VERSAO_ALVO      = "EXL"
PRECO_MAX_BUSCA  = 95_000
PRECO_FIPE_REF   = 80_000
KM_EXCELENTE     = 70_000
KM_LIMITE_ALERTA = 160_000

CORES_EXCLUIDAS = {"branco","branca","white","off white","off-white","pérola","perola"}

CIDADES_ACEITAS = {
    "sao paulo",
    "guarulhos","osasco","sao bernardo do campo","santo andre","diadema",
    "maua","ribeirao pires","sao caetano do sul","mogi das cruzes","suzano",
    "poa","ferraz de vasconcelos","itaquaquecetuba","aruja",
    "carapicuiba","itapevi","jandira","barueri","santana de parnaiba",
    "cotia","embu das artes","embu","taboao da serra","itapecerica da serra",
    "sao lourenco da serra","mairipora","francisco morato","franco da rocha",
    "caieiras","cajamar","pirapora do bom jesus",
    "jundiai","atibaia","campinas","valinhos","vinhedo","itatiba",
    "louveira","itupeva","indaiatuba","sorocaba","votorantim",
    "porto feliz","salto","itu","campo limpo paulista","varzea paulista",
    "jarinu","braganca paulista","sao roque","mairinque","ibiuna","aracariguama",
}

# Headers com aparência de browser real
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

HEADERS_JSON = {**HEADERS,
    "Accept": "application/json, text/plain, */*",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}

GREEN_FLAGS = [
    "único dono","unico dono","1 dono","revisão em dia","revisoes em dia",
    "revisão concessionária","revisao concessionaria","revisões na honda",
    "ipva pago","ipva quitado","sem multa","sem débito","sem debito",
    "garantia","laudo cautelar","laudo aprovado","sem sinistro",
    "impecável","impecavel","original","chave reserva","manual do proprietário",
    "placa i","vistoriado","licenciado",
]
RED_FLAGS = [
    "batido","funilaria","funileiro","amassado","reformado",
    "sem laudo","sinistro","recuperado","leilão","leilao",
    "vendo partes","para peças","para pecas","motor com defeito",
    "câmbio com defeito","ar não funciona",
]
SCAM_FLAGS = [
    "preciso vender urgente","viagem ao exterior","fora do país","fora do pais",
    "preciso de dinheiro rápido","preciso de dinheiro rapido",
    "pix antes de ver","sinal antes de ver","deposito antes",
    "não posso mostrar","nao posso mostrar",
    "missionário","missionario","pastor em viagem",
    "aceito proposta absurda","lote de carros",
]


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def norm(texto: str) -> str:
    if not texto: return ""
    s = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

def parse_km(value) -> int | None:
    if value is None: return None
    s = str(value).lower().replace(".","").replace(",","").strip()
    nums = re.findall(r"\d+", s)
    if not nums: return None
    val = int(nums[0])
    if val < 500 and "km" not in s: val *= 1_000
    return val if val < 900_000 else None

def fmt_price(v) -> str:
    if v is None: return "N/I"
    return "R$ " + f"{int(v):,}".replace(",",".")

def fmt_km(v) -> str:
    km = parse_km(v) if not isinstance(v, int) else v
    if km is None: return "N/I"
    return f"{km:,} km".replace(",",".")

def eh_exl(titulo: str, versao: str | None, fonte: str = "") -> bool:
    # Fontes certificadas onde buscamos explicitamente por EXL — confia
    if "✓" in str(fonte): return True
    t = norm(titulo) + " " + norm(versao or "")
    if "exl" in t: return True
    if re.search(r"\bex[\s\-]?l\b", t): return True
    return False

def eh_ano_certo(titulo: str, ano) -> bool:
    ano_str = str(ano or "")[:4]
    if ano_str == str(ANO_ALVO): return True
    if str(ANO_ALVO) in norm(titulo): return True
    if not ano_str: return True
    return False

def cor_ok(cor: str | None) -> bool:
    if not cor: return True
    return norm(cor) not in CORES_EXCLUIDAS

def cidade_ok(cidade: str | None, estado: str | None) -> bool:
    if not cidade: return True
    if estado and norm(estado) not in {"sp","sao paulo"}: return False
    return norm(cidade) in CIDADES_ACEITAS

def detectar_flags(texto: str) -> tuple[list, list, bool]:
    t = norm(texto)
    green = [f for f in GREEN_FLAGS if norm(f) in t]
    red   = [f for f in RED_FLAGS   if norm(f) in t]
    scam  = any(norm(f) in t for f in SCAM_FLAGS)
    return green, red, scam

def preco_suspeito(preco: float | None, fipe_ref: float) -> str:
    if preco is None: return ""
    diff = (fipe_ref - preco) / fipe_ref
    if diff > 0.35: return "scam"
    if diff > 0.20: return "alerta"
    return ""

def extrair_next_data(html: str) -> dict:
    """Extrai JSON embutido em páginas Next.js."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if m:
        try: return json.loads(m.group(1))
        except: pass
    return {}


# ══════════════════════════════════════════════════════════════════════════════
#  SCORING
# ══════════════════════════════════════════════════════════════════════════════

def score_listing(item: dict, fipe_ref: float) -> float:
    score = 0.0
    desc = str(item.get("titulo","")) + " " + str(item.get("descricao",""))
    green, red, _ = detectar_flags(desc)

    preco = item.get("preco")
    if preco:
        ratio = (fipe_ref - preco) / fipe_ref
        score += min(25, max(0, ratio * 80 + 15))
    else:
        score += 5

    km = parse_km(item.get("km"))
    if km is not None:
        if km < 50_000:   score += 30
        elif km < 80_000: score += 26
        elif km < 110_000:score += 20
        elif km < 140_000:score += 13
        elif km < 160_000:score += 7
        else:             score += 2
    else:
        score += 5

    manut = {
        "revisão em dia":8,"revisoes em dia":8,
        "revisão concessionária":8,"revisao concessionaria":8,"revisões na honda":8,
        "único dono":6,"unico dono":6,"1 dono":6,
        "laudo cautelar":5,"laudo aprovado":5,"sem sinistro":4,
        "ipva pago":2,"sem débito":2,"sem debito":2,
        "garantia":3,"chave reserva":2,"manual do proprietário":2,
    }
    t = norm(desc)
    pts_manut = sum(v for k,v in manut.items() if norm(k) in t)
    score += min(25, pts_manut)

    pts_anuncio = 0
    if item.get("preco"):   pts_anuncio += 5
    if item.get("km"):      pts_anuncio += 5
    if item.get("ano"):     pts_anuncio += 2
    if item.get("versao"):  pts_anuncio += 2
    desc_len = len(str(item.get("descricao","")))
    pts_anuncio += 6 if desc_len > 200 else (3 if desc_len > 80 else 0)
    score += min(20, pts_anuncio)

    score -= len(red) * 6
    return round(max(0, min(100, score)), 1)


# ══════════════════════════════════════════════════════════════════════════════
#  FIPE
# ══════════════════════════════════════════════════════════════════════════════

def buscar_preco_fipe() -> float:
    try:
        r = requests.post(
            "https://veiculos.fipe.org.br/api/veiculos//ConsultarTabelaDeReferencia",
            json={}, timeout=10
        )
        cod_tabela = r.json()[0]["Codigo"]
        for cod in ["2017-3","2017-1"]:
            r2 = requests.post(
                "https://veiculos.fipe.org.br/api/veiculos//ConsultarValorComTodosParametros",
                json={"codigoTabelaReferencia":cod_tabela,"codigoMarca":23,
                      "codigoModelo":6785,"codigoTipoCombustivel":3,
                      "anoModelo":2017,"codigoAnoModelo":cod,"tipoConsulta":"tradicional"},
                timeout=10
            )
            data = r2.json()
            if "Valor" in data:
                v = float(data["Valor"].replace("R$","").replace(".","").replace(",",".").strip())
                print(f"  FIPE: {fmt_price(v)}")
                return v
    except Exception:
        pass
    print(f"  FIPE: referência fixa {fmt_price(PRECO_FIPE_REF)}")
    return PRECO_FIPE_REF


# ══════════════════════════════════════════════════════════════════════════════
#  SCRAPERS
# ══════════════════════════════════════════════════════════════════════════════

def fazer_get(url, params=None, headers=None, timeout=20):
    """GET com retry e headers de browser."""
    h = {**HEADERS_JSON, **(headers or {})}
    for tentativa in range(3):
        try:
            r = requests.get(url, params=params, headers=h, timeout=timeout)
            if r.status_code == 200:
                return r
            time.sleep(1 + tentativa)
        except Exception:
            time.sleep(1 + tentativa)
    return None


def buscar_mercadolivre() -> list[dict]:
    """Site 1 — Mercado Livre"""
    print("  [1] Mercado Livre...")
    resultados, offset = [], 0
    h = {**HEADERS_JSON,
         "Referer": "https://www.mercadolivre.com.br/",
         "Origin": "https://www.mercadolivre.com.br"}
    while offset < 200:
        r = fazer_get("https://api.mercadolibre.com/sites/MLB/search",
                      params={"q":f"Honda HR-V EXL {ANO_ALVO}","category":"MLB1744",
                              "price_to":PRECO_MAX_BUSCA,"offset":offset,"limit":50},
                      headers=h)
        if not r: break
        try: data = r.json()
        except: break
        items = data.get("results",[])
        total = data.get("paging",{}).get("total",0)
        if not items: break
        for item in items:
            if not re.search(r"hr.?v", item.get("title",""), re.IGNORECASE): continue
            attrs = {a["id"]: a.get("value_name") for a in item.get("attributes",[])}
            resultados.append({
                "fonte":"Mercado Livre","titulo":item.get("title",""),
                "preco":item.get("price"),
                "km":attrs.get("VEHICLE_MILEAGE") or attrs.get("KILOMETERS"),
                "ano":attrs.get("VEHICLE_YEAR"),
                "versao":attrs.get("TRIM") or attrs.get("MODEL"),
                "cambio":attrs.get("VEHICLE_TRANSMISSION"),"cor":attrs.get("COLOR"),
                "cidade":item.get("address",{}).get("city_name",""),
                "estado":item.get("address",{}).get("state_name",""),
                "descricao":"","link":item.get("permalink",""),
            })
        offset += 50
        if offset >= total: break
        time.sleep(0.4)
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_webmotors() -> list[dict]:
    """Site 2 — WebMotors"""
    print("  [2] WebMotors...")
    resultados = []
    base = (f"https://www.webmotors.com.br/carros/estoque/?TipoVeiculo=carros"
            f"&Marca=HONDA&Modelo=HR-V&AnoModelo={ANO_ALVO}&PrecoAte={PRECO_MAX_BUSCA}")
    h = {**HEADERS_JSON,
         "Referer": "https://www.webmotors.com.br/",
         "Origin": "https://www.webmotors.com.br"}
    for page in range(1, 6):
        r = fazer_get("https://www.webmotors.com.br/api/search/car",
                      params={"url":f"{base}&Pag={page}","actualPage":page,
                              "displayPerPage":24,"order":1,"showMenu":"true","listFilters":"true"},
                      headers=h)
        if not r: break
        try: data = r.json()
        except: break
        anuncios = data.get("SearchResults",[])
        if not anuncios: break
        for a in anuncios:
            spec = a.get("Specification",{})
            prices = a.get("Prices",{})
            preco = prices.get("Price") or prices.get("PriceValue")
            if preco and preco > PRECO_MAX_BUSCA: continue
            titulo = f"{spec.get('Make','')} {spec.get('Model','')} {spec.get('Version','')} {spec.get('ModelYear','')}".strip()
            resultados.append({
                "fonte":"WebMotors","titulo":titulo,"preco":preco,
                "km":spec.get("OdometerLastValue"),
                "ano":spec.get("ModelYear") or spec.get("YearFabrication"),
                "versao":spec.get("Version"),"cambio":spec.get("GearShift"),"cor":spec.get("Color"),
                "cidade":a.get("Seller",{}).get("City",""),"estado":a.get("Seller",{}).get("State",""),
                "descricao":"",
                "link":f"https://www.webmotors.com.br/carros/anuncio/{a.get('UniqueId','')}",
            })
        if len(anuncios) < 24: break
        time.sleep(0.6)
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_olx() -> list[dict]:
    """Site 3 — OLX"""
    print("  [3] OLX...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        h = {**HEADERS, "Referer": "https://www.olx.com.br/"}
        for page in range(1, 4):
            r = fazer_get(
                f"https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/honda",
                params={"q":f"hr-v exl {ANO_ALVO}","pe":PRECO_MAX_BUSCA,"re":"sao_paulo","o":page},
                headers=h)
            if not r: break
            soup = BeautifulSoup(r.text, "lxml")

            # Tenta extrair JSON embutido do Next.js
            nd = extrair_next_data(r.text)
            listings = (nd.get("props",{}).get("pageProps",{}).get("ads")
                        or nd.get("props",{}).get("pageProps",{}).get("listings")
                        or [])
            if listings:
                for ad in listings:
                    titulo = ad.get("title","")
                    preco_raw = ad.get("price","") or ad.get("priceValue","")
                    nums = re.findall(r"\d+", str(preco_raw).replace(".",""))
                    preco = int(nums[0]) if nums else None
                    link = ad.get("url","") or ad.get("link","")
                    cidade = ad.get("location","") or ad.get("municipality","")
                    resultados.append({
                        "fonte":"OLX","titulo":titulo,"preco":preco,"km":None,"ano":None,
                        "versao":None,"cambio":None,"cor":None,"cidade":cidade,"estado":"SP",
                        "descricao":"","link":link,
                    })
            else:
                # Fallback: scraping HTML
                cards = (soup.select("section[data-ds-component='DS-AdCard']")
                         or soup.select("li[data-lurker-detail='result_card']")
                         or soup.select("[data-testid='ad-card']"))
                for card in cards:
                    try:
                        titulo = card.select_one("h2,h3,[class*='title']")
                        titulo = titulo.get_text(strip=True) if titulo else ""
                        preco_el = card.select_one("[class*='price'],[data-testid*='price']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.olx.com.br" + link
                        resultados.append({
                            "fonte":"OLX","titulo":titulo,"preco":preco,"km":None,"ano":None,
                            "versao":None,"cambio":None,"cor":None,"cidade":"","estado":"SP",
                            "descricao":"","link":link,
                        })
                    except: continue
            time.sleep(1)
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
            r = fazer_get("https://www.icarros.com.br/ache/listaanuncios.jsp",
                          params={"pag":page,"ord":2,"modelo":5,"marca":21,
                                  "anoFabricacaoDe":ANO_ALVO,"anoFabricacaoAte":ANO_ALVO,
                                  "priceMax":PRECO_MAX_BUSCA})
            if not r: break
            soup = BeautifulSoup(r.text, "lxml")
            cards = (soup.select("li.ads__list__item")
                     or soup.select(".anuncio")
                     or soup.select("[class*='listing']"))
            if not cards: break
            for card in cards:
                try:
                    titulo_el = card.select_one("h2,h3,[class*='title'],[class*='nome']")
                    titulo = titulo_el.get_text(strip=True) if titulo_el else ""
                    preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                    nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                    preco = int(nums[0]) if nums else None
                    km_el = card.select_one("[class*='km'],[class*='quilometr']")
                    km_txt = km_el.get_text(strip=True) if km_el else ""
                    link_el = card.select_one("a[href]")
                    link = link_el["href"] if link_el else ""
                    if link and not link.startswith("http"): link = "https://www.icarros.com.br" + link
                    resultados.append({
                        "fonte":"iCarros","titulo":titulo,"preco":preco,"km":km_txt,
                        "ano":ANO_ALVO,"versao":None,"cambio":None,"cor":None,
                        "cidade":"","estado":"SP","descricao":"","link":link,
                    })
                except: continue
            time.sleep(0.7)
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_kavak() -> list[dict]:
    """Site 5 — Kavak (seminovos certificados) via Next.js"""
    print("  [5] Kavak...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get(f"https://www.kavak.com/br/pesquisa/honda/hr-v",
                      params={"year":ANO_ALVO,"price_max":PRECO_MAX_BUSCA,"hub":"sao-paulo"})
        if r:
            nd = extrair_next_data(r.text)
            # Tenta várias estruturas possíveis do Next.js
            cars = (nd.get("props",{}).get("pageProps",{}).get("cars")
                    or nd.get("props",{}).get("pageProps",{}).get("inventories")
                    or nd.get("props",{}).get("pageProps",{}).get("data",{}).get("inventories")
                    or [])
            for car in cars:
                preco = car.get("retailPrice") or car.get("price")
                km    = car.get("mileage") or car.get("km")
                slug  = car.get("slug") or car.get("id","")
                resultados.append({
                    "fonte":"Kavak ✓",
                    "titulo":car.get("title") or f"Honda HR-V EXL {ANO_ALVO}",
                    "preco":preco,"km":km,"ano":car.get("year",ANO_ALVO),
                    "versao":car.get("trim","EXL"),"cambio":car.get("transmission"),
                    "cor":car.get("color") or car.get("exteriorColor"),
                    "cidade":car.get("city","São Paulo"),"estado":"SP",
                    "descricao":"Kavak: laudo cautelar, garantia e revisão inclusos",
                    "link":f"https://www.kavak.com/br/carro/{slug}",
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
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.mobiauto.com.br/estoque/honda/hr-v/exl",
                      params={"yearFrom":ANO_ALVO,"yearTo":ANO_ALVO,"state":"SP"})
        if r:
            nd = extrair_next_data(r.text)
            ads = (nd.get("props",{}).get("pageProps",{}).get("ads")
                   or nd.get("props",{}).get("pageProps",{}).get("vehicles")
                   or [])
            if ads:
                for ad in ads:
                    preco = ad.get("price") or ad.get("valor")
                    resultados.append({
                        "fonte":"Mobiauto","titulo":ad.get("title",f"Honda HR-V EXL {ANO_ALVO}"),
                        "preco":preco,"km":ad.get("mileage") or ad.get("km"),
                        "ano":ad.get("year",ANO_ALVO),"versao":ad.get("version","EXL"),
                        "cambio":ad.get("transmission"),"cor":ad.get("color"),
                        "cidade":ad.get("city",""),"estado":"SP",
                        "descricao":ad.get("description",""),
                        "link":ad.get("url","") or f"https://www.mobiauto.com.br/anuncio/{ad.get('id','')}",
                    })
            else:
                # fallback HTML
                soup = BeautifulSoup(r.text, "lxml")
                for card in soup.select("[class*='card'],[class*='vehicle'],[class*='veiculo']"):
                    try:
                        titulo = card.select_one("h2,h3")
                        titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.mobiauto.com.br" + link
                        resultados.append({
                            "fonte":"Mobiauto","titulo":titulo,"preco":preco,"km":None,
                            "ano":ANO_ALVO,"versao":"EXL","cambio":None,"cor":None,
                            "cidade":"","estado":"SP","descricao":"","link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_vrum() -> list[dict]:
    """Site 7 — Vrum"""
    print("  [7] Vrum...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.vrum.com.br/carros-usados/honda/hr-v",
                      params={"year":ANO_ALVO,"state":"SP","trim":"EXL"})
        if r:
            nd = extrair_next_data(r.text)
            ads = (nd.get("props",{}).get("pageProps",{}).get("vehicles")
                   or nd.get("props",{}).get("pageProps",{}).get("ads")
                   or [])
            for ad in ads:
                preco = ad.get("price") or ad.get("valor")
                resultados.append({
                    "fonte":"Vrum","titulo":ad.get("title",f"Honda HR-V {ANO_ALVO}"),
                    "preco":preco,"km":ad.get("mileage") or ad.get("km"),
                    "ano":ad.get("year",ANO_ALVO),"versao":ad.get("version"),
                    "cambio":ad.get("transmission"),"cor":ad.get("color"),
                    "cidade":ad.get("city",""),"estado":"SP","descricao":"",
                    "link":ad.get("url","") or f"https://www.vrum.com.br/anuncio/{ad.get('id','')}",
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
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.autoline.com.br/carros/honda/hr+v/",
                      params={"year0":ANO_ALVO,"year1":ANO_ALVO,"state":"SP"})
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            nd = extrair_next_data(r.text)
            ads = (nd.get("props",{}).get("pageProps",{}).get("ads")
                   or nd.get("props",{}).get("pageProps",{}).get("cars")
                   or [])
            for ad in ads:
                resultados.append({
                    "fonte":"AutoLine","titulo":ad.get("title",f"Honda HR-V {ANO_ALVO}"),
                    "preco":ad.get("price"),"km":ad.get("mileage"),
                    "ano":ad.get("year",ANO_ALVO),"versao":ad.get("version"),
                    "cambio":ad.get("transmission"),"cor":ad.get("color"),
                    "cidade":ad.get("city",""),"estado":"SP","descricao":"",
                    "link":ad.get("url",""),
                })
            if not ads:
                for card in soup.select("[class*='card'],[class*='car-item']"):
                    try:
                        titulo = card.select_one("h2,h3")
                        titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.autoline.com.br" + link
                        resultados.append({
                            "fonte":"AutoLine","titulo":titulo,"preco":preco,"km":None,
                            "ano":ANO_ALVO,"versao":None,"cambio":None,"cor":None,
                            "cidade":"","estado":"SP","descricao":"","link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_localiza_seminovos() -> list[dict]:
    """Site 9 — Localiza Seminovos"""
    print("  [9] Localiza Seminovos...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get("https://seminovos.localiza.com/carros",
                      params={"marca":"honda","modelo":"hr-v","versao":"exl",
                              "anoInicio":ANO_ALVO,"anoFim":ANO_ALVO})
        if r:
            nd = extrair_next_data(r.text)
            cars = (nd.get("props",{}).get("pageProps",{}).get("cars")
                    or nd.get("props",{}).get("pageProps",{}).get("vehicles")
                    or nd.get("props",{}).get("pageProps",{}).get("data",{}).get("vehicles")
                    or [])
            if cars:
                for car in cars:
                    preco = car.get("price") or car.get("valor")
                    slug = car.get("slug") or car.get("id","")
                    resultados.append({
                        "fonte":"Localiza Seminovos ✓",
                        "titulo":car.get("title") or f"Honda HR-V EXL {ANO_ALVO}",
                        "preco":preco,"km":car.get("mileage") or car.get("km"),
                        "ano":car.get("year",ANO_ALVO),"versao":"EXL",
                        "cambio":car.get("transmission"),"cor":car.get("color"),
                        "cidade":car.get("city","São Paulo"),"estado":"SP",
                        "descricao":"Frota Localiza: laudo cautelar e garantia inclusos",
                        "link":f"https://seminovos.localiza.com/carro/{slug}" if slug else "https://seminovos.localiza.com/carros",
                    })
            else:
                soup = BeautifulSoup(r.text, "lxml")
                for card in soup.select("[class*='card'],[class*='veiculo'],[class*='vehicle']"):
                    try:
                        titulo_el = card.select_one("h2,h3,[class*='title'],[class*='name']")
                        titulo = titulo_el.get_text(strip=True) if titulo_el else f"Honda HR-V EXL {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        km_el = card.select_one("[class*='km'],[class*='milage'],[class*='mileage']")
                        km_txt = km_el.get_text(strip=True) if km_el else ""
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://seminovos.localiza.com" + link
                        if not link: link = "https://seminovos.localiza.com/carros"
                        resultados.append({
                            "fonte":"Localiza Seminovos ✓",
                            "titulo":titulo if titulo else f"Honda HR-V EXL {ANO_ALVO}",
                            "preco":preco,"km":km_txt,"ano":ANO_ALVO,"versao":"EXL",
                            "cambio":None,"cor":None,"cidade":"São Paulo","estado":"SP",
                            "descricao":"Frota Localiza: laudo cautelar e garantia inclusos",
                            "link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_movida_seminovos() -> list[dict]:
    """Site 10 — Movida Seminovos"""
    print("  [10] Movida Seminovos...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.movida.com.br/seminovos",
                      params={"marca":"Honda","modelo":"HR-V","anoMin":ANO_ALVO,"anoMax":ANO_ALVO})
        if r:
            nd = extrair_next_data(r.text)
            cars = (nd.get("props",{}).get("pageProps",{}).get("vehicles")
                    or nd.get("props",{}).get("pageProps",{}).get("cars")
                    or [])
            for car in cars:
                slug = car.get("slug") or car.get("id","")
                resultados.append({
                    "fonte":"Movida Seminovos ✓",
                    "titulo":car.get("title") or f"Honda HR-V {ANO_ALVO}",
                    "preco":car.get("price") or car.get("valor"),
                    "km":car.get("mileage") or car.get("km"),
                    "ano":car.get("year",ANO_ALVO),"versao":car.get("version"),
                    "cambio":car.get("transmission"),"cor":car.get("color"),
                    "cidade":car.get("city","São Paulo"),"estado":"SP",
                    "descricao":"Frota Movida: revisão e documentação em dia",
                    "link":f"https://www.movida.com.br/seminovos/{slug}" if slug else "https://www.movida.com.br/seminovos",
                })
            if not cars:
                soup = BeautifulSoup(r.text, "lxml")
                for card in soup.select("[class*='card'],[class*='carro'],[class*='veiculo']"):
                    try:
                        titulo = card.select_one("h2,h3")
                        titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.movida.com.br" + link
                        if not link: link = "https://www.movida.com.br/seminovos"
                        resultados.append({
                            "fonte":"Movida Seminovos ✓","titulo":titulo,"preco":preco,"km":None,
                            "ano":ANO_ALVO,"versao":None,"cambio":None,"cor":None,
                            "cidade":"São Paulo","estado":"SP",
                            "descricao":"Frota Movida: revisão e documentação em dia","link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_honda_seminovos() -> list[dict]:
    """Site 11 — Honda Seminovos Oficial"""
    print("  [11] Honda Seminovos Oficial...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.honda.com.br/automoveis/seminovos/estoque",
                      params={"modelo":"HR-V","versao":"EXL","anoMin":ANO_ALVO,
                              "anoMax":ANO_ALVO,"precoMax":PRECO_MAX_BUSCA,"estado":"SP"})
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            nd = extrair_next_data(r.text)
            cars = (nd.get("props",{}).get("pageProps",{}).get("cars") or [])
            for car in cars:
                slug = car.get("slug") or car.get("id","")
                resultados.append({
                    "fonte":"Honda Oficial ✓",
                    "titulo":car.get("title") or f"Honda HR-V EXL {ANO_ALVO}",
                    "preco":car.get("price"),"km":car.get("mileage"),
                    "ano":car.get("year",ANO_ALVO),"versao":"EXL",
                    "cambio":car.get("transmission"),"cor":car.get("color"),
                    "cidade":car.get("city",""),"estado":"SP",
                    "descricao":"Rede oficial Honda: revisão, garantia e laudo cautelar",
                    "link":f"https://www.honda.com.br/automoveis/seminovos/{slug}" if slug else "https://www.honda.com.br/automoveis/seminovos/estoque",
                })
            if not cars:
                for card in soup.select("[class*='card'],[class*='seminovo']"):
                    try:
                        titulo = card.select_one("h2,h3")
                        titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.honda.com.br" + link
                        if not link: link = "https://www.honda.com.br/automoveis/seminovos/estoque"
                        resultados.append({
                            "fonte":"Honda Oficial ✓","titulo":titulo,"preco":preco,"km":None,
                            "ano":ANO_ALVO,"versao":"EXL","cambio":None,"cor":None,
                            "cidade":"","estado":"SP",
                            "descricao":"Rede oficial Honda: revisão, garantia e laudo cautelar","link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


def buscar_autoshow() -> list[dict]:
    """Site 12 — AutoShow SP"""
    print("  [12] AutoShow...")
    resultados = []
    try:
        from bs4 import BeautifulSoup
        r = fazer_get("https://www.autoshow.com.br/estoque",
                      params={"marca":"honda","modelo":"hr-v","ano":ANO_ALVO,"versao":"exl"})
        if r:
            nd = extrair_next_data(r.text)
            cars = (nd.get("props",{}).get("pageProps",{}).get("cars")
                    or nd.get("props",{}).get("pageProps",{}).get("vehicles")
                    or [])
            for car in cars:
                slug = car.get("slug") or car.get("id","")
                resultados.append({
                    "fonte":"AutoShow","titulo":car.get("title",f"Honda HR-V EXL {ANO_ALVO}"),
                    "preco":car.get("price"),"km":car.get("mileage"),
                    "ano":car.get("year",ANO_ALVO),"versao":"EXL",
                    "cambio":car.get("transmission"),"cor":car.get("color"),
                    "cidade":"São Paulo","estado":"SP","descricao":"",
                    "link":f"https://www.autoshow.com.br/carro/{slug}" if slug else "https://www.autoshow.com.br/estoque",
                })
            if not cars:
                soup = BeautifulSoup(r.text, "lxml")
                for card in soup.select("[class*='card'],[class*='veiculo'],[class*='car']"):
                    try:
                        titulo = card.select_one("h2,h3")
                        titulo = titulo.get_text(strip=True) if titulo else f"Honda HR-V EXL {ANO_ALVO}"
                        preco_el = card.select_one("[class*='price'],[class*='preco'],[class*='valor']")
                        nums = re.findall(r"\d+", (preco_el.get_text(strip=True) if preco_el else "").replace(".",""))
                        preco = int(nums[0]) if nums else None
                        link_el = card.select_one("a[href]")
                        link = link_el["href"] if link_el else ""
                        if link and not link.startswith("http"): link = "https://www.autoshow.com.br" + link
                        if not link: link = "https://www.autoshow.com.br/estoque"
                        resultados.append({
                            "fonte":"AutoShow","titulo":titulo,"preco":preco,"km":None,
                            "ano":ANO_ALVO,"versao":"EXL","cambio":None,"cor":None,
                            "cidade":"São Paulo","estado":"SP","descricao":"","link":link,
                        })
                    except: continue
    except Exception as e:
        print(f"    ⚠ {e}")
    print(f"    → {len(resultados)} encontrados")
    return resultados


# ══════════════════════════════════════════════════════════════════════════════
#  HTML COM LINKS CLICÁVEIS
# ══════════════════════════════════════════════════════════════════════════════

def gerar_html(ranking: list, alertas: list, fipe_ref: float):
    todos = ranking + alertas
    if not todos:
        return

    def badge(s):
        cor = "#22c55e" if s >= 65 else ("#f59e0b" if s >= 45 else "#ef4444")
        return f'<span style="background:{cor};color:#fff;padding:2px 10px;border-radius:20px;font-weight:bold">{s:.0f}/100</span>'

    def tag(fonte):
        cor = "#16a34a" if "✓" in fonte else "#2563eb"
        return f'<span style="background:{cor};color:#fff;padding:1px 7px;border-radius:4px;font-size:11px">{fonte}</span>'

    def fipe_txt(preco):
        if not preco: return ""
        d = (fipe_ref - preco) / fipe_ref * 100
        return (f'<br><small style="color:#16a34a">▼ {d:.0f}% abaixo FIPE</small>'
                if d > 0 else f'<br><small style="color:#dc2626">▲ {abs(d):.0f}% acima FIPE</small>')

    rows = ""
    for i, item in enumerate(todos, 1):
        desc = str(item.get("titulo","")) + " " + str(item.get("descricao",""))
        green, red, _ = detectar_flags(desc)
        alerta = item.get("_alerta_preco", False)
        gb = "".join(f'<span style="background:#dcfce7;color:#166534;padding:1px 5px;border-radius:3px;font-size:11px;margin:1px">{f}</span>' for f in green[:4])
        rb = "".join(f'<span style="background:#fee2e2;color:#991b1b;padding:1px 5px;border-radius:3px;font-size:11px;margin:1px">{f}</span>' for f in red)
        alerta_band = '<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:3px 6px;font-size:11px;margin-top:4px">⚠️ Preço muito abaixo da FIPE — verifique antes de contatar</div>' if alerta else ""
        link = item.get("link","#")
        rows += f"""<tr style="{'background:#fffbeb' if alerta else ''}">
          <td style="text-align:center;color:#9ca3af;font-weight:bold">{i}</td>
          <td>{badge(item['_score'])}</td>
          <td>{tag(item.get('fonte',''))}</td>
          <td><a href="{link}" target="_blank" style="color:#1d4ed8;font-weight:600;text-decoration:none;font-size:13px">{item.get('titulo','N/I')}</a>
              <div style="margin-top:3px">{gb}{rb}</div>{alerta_band}</td>
          <td style="font-weight:bold;color:#15803d;white-space:nowrap">{fmt_price(item.get('preco'))}{fipe_txt(item.get('preco'))}</td>
          <td style="white-space:nowrap">{fmt_km(item.get('km'))}</td>
          <td>{item.get('ano') or 'N/I'}</td>
          <td>{item.get('versao') or 'N/I'}</td>
          <td>{item.get('cambio') or 'N/I'}</td>
          <td>{item.get('cor') or 'N/I'}</td>
          <td style="font-size:12px">{(item.get('cidade','') or '')} {(item.get('estado','') or '')}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Honda HR-V EXL 2017 — Resultados</title>
<style>
  body{{font-family:Arial,sans-serif;margin:20px;background:#f8fafc;color:#1e293b}}
  h1{{margin-bottom:6px}}
  .info{{background:#e0f2fe;padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:13px}}
  table{{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.1)}}
  th{{background:#1e293b;color:#fff;padding:10px 10px;text-align:left;font-size:12px;white-space:nowrap}}
  td{{padding:9px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;vertical-align:top}}
  tr:hover td{{background:#f0f9ff}}
  a:hover{{text-decoration:underline!important}}
</style></head><body>
<h1>🚗 Honda HR-V EXL 2017 — Melhores Oportunidades</h1>
<div class="info">
  📅 {datetime.now().strftime('%d/%m/%Y %H:%M')} &nbsp;|&nbsp;
  📊 FIPE ref.: {fmt_price(fipe_ref)} &nbsp;|&nbsp;
  ✅ {len(ranking)} válidos &nbsp;|&nbsp;
  ⚠️ {len(alertas)} com alerta de preço &nbsp;|&nbsp;
  🎨 Sem branco &nbsp;|&nbsp; 📍 SP + até 1h15
</div>
<table><thead><tr>
  <th>#</th><th>Score</th><th>Site</th><th>Anúncio (clique para abrir)</th>
  <th>Preço</th><th>KM</th><th>Ano</th><th>Versão</th><th>Câmbio</th><th>Cor</th><th>Local</th>
</tr></thead><tbody>{rows}</tbody></table>
</body></html>"""

    nome = "resultado_hrv.html"
    with open(nome, "w", encoding="utf-8") as f:
        f.write(html)

    caminho = os.path.abspath(nome)
    print(f"\n  ✅ HTML gerado: {caminho}")
    print(f"  🌐 Abrindo no navegador...")
    webbrowser.open(f"file:///{caminho.replace(os.sep, '/')}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("═" * 68)
    print(f"  HONDA HR-V EXL {ANO_ALVO} — Buscador de Oportunidades")
    print(f"  Cor: sem branco  |  Local: SP + até 1h15 de carro")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("═" * 68)

    print("\n[Referência FIPE]")
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

    # Deduplica — usa link OU (titulo+preco) como chave
    vistos, unicos = set(), []
    for item in todos:
        link = item.get("link","").split("?")[0].rstrip("/")
        chave = link if link else f"{item.get('titulo','')}|{item.get('preco','')}"
        if chave not in vistos:
            vistos.add(chave)
            unicos.append(item)

    total_bruto = len(unicos)
    motivos = {"versao":0,"ano":0,"cor":0,"cidade":0,"suspeito":0}
    validos, alertas = [], []

    for item in unicos:
        desc = str(item.get("titulo","")) + " " + str(item.get("descricao",""))
        if not eh_exl(item.get("titulo",""), item.get("versao"), item.get("fonte","")):
            motivos["versao"] += 1; continue
        if not eh_ano_certo(item.get("titulo",""), item.get("ano")):
            motivos["ano"] += 1; continue
        if not cor_ok(item.get("cor")):
            motivos["cor"] += 1; continue
        if not cidade_ok(item.get("cidade"), item.get("estado")):
            motivos["cidade"] += 1; continue
        _, _, scam = detectar_flags(desc)
        alerta_preco = preco_suspeito(item.get("preco"), fipe_ref)
        if scam or alerta_preco == "scam":
            motivos["suspeito"] += 1; continue
        item["_score"] = score_listing(item, fipe_ref)
        item["_alerta_preco"] = alerta_preco == "alerta"
        (alertas if alerta_preco == "alerta" else validos).append(item)

    ranking = sorted(validos, key=lambda x: x["_score"], reverse=True)
    ranking_alertas = sorted(alertas, key=lambda x: x["_score"], reverse=True)

    print(f"\n{'═'*68}")
    print(f"  FILTROS (de {total_bruto} únicos):")
    for k,v in motivos.items(): print(f"    {k:20}: -{v}")
    print(f"  ══ {len(ranking)} válidos | {len(alertas)} com alerta de preço")
    print(f"{'═'*68}")

    if not ranking and not ranking_alertas:
        print("\n  Nenhum anúncio passou pelos filtros.")
        return

    # Resumo no terminal
    todos_v = ranking + ranking_alertas
    precos = [x["preco"] for x in todos_v if x.get("preco")]
    kms    = [parse_km(x["km"]) for x in todos_v if parse_km(x.get("km"))]
    if precos:
        print(f"\n  Preço médio : {fmt_price(int(sum(precos)/len(precos)))}")
        print(f"  Mais barato : {fmt_price(min(precos))}")
        print(f"  FIPE ref.   : {fmt_price(fipe_ref)}")
    if kms:
        print(f"  KM médio    : {fmt_km(int(sum(kms)/len(kms)))}")

    gerar_html(ranking, ranking_alertas, fipe_ref)


if __name__ == "__main__":
    main()
