/* ============================================================
   Exile Forge — importação de código do Path of Building 2
   ------------------------------------------------------------
   Código PoB = base64 (url-safe) de um XML comprimido com zlib.
   Decodifica no próprio navegador (DecompressionStream) e
   transforma o XML <PathOfBuilding2> num objeto `build`.
   ============================================================ */
(function () {
  "use strict";

  async function inflar(bytes) {
    if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não descompacta códigos PoB (atualize o navegador).");
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  function base64(texto) {
    let s = texto.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* aceita: código puro, link pobb.in (tenta baixar o /raw) ou o XML direto */
  async function obterXml(entrada) {
    let t = String(entrada || "").trim();
    if (!t) throw new Error("Cole um código PoB.");
    if (t.startsWith("<")) return t;
    const link = t.match(/pobb\.in\/(?:u\/[^/\s]+\/)?([A-Za-z0-9_-]+)/i);
    if (link) {
      try {
        const r = await fetch("https://pobb.in/" + link[1] + "/raw", { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        t = (await r.text()).trim();
      } catch (e) {
        throw new Error("Não consegui abrir o link do pobb.in daqui (o site bloqueia). Abra o link, toque em “Copy” e cole o código.");
      }
    }
    if (!/^[A-Za-z0-9+/_=\-\s]+$/.test(t)) throw new Error("Isso não parece um código PoB (deve ter só letras, números, - e _).");
    let bytes;
    try { bytes = base64(t); } catch (e) { throw new Error("Código PoB inválido (base64)."); }
    try { return await inflar(bytes); } catch (e) { throw new Error(/navegador/.test(e.message || "") ? e.message : "Não consegui descompactar o código — você copiou ele inteiro?"); }
  }

  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? Math.round(n * 10) / 10 : undefined; };

  function paraBuild(xml) {
    const M = window.Motor;
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML do PoB inválido.");
    const raiz = doc.documentElement;
    if (raiz.nodeName === "PathOfBuilding") throw new Error("Esse código é do Path of Building do PoE 1 — use um código do PoB 2.");
    if (raiz.nodeName !== "PathOfBuilding2") throw new Error("Formato não reconhecido (esperava PathOfBuilding2).");
    const B = raiz.querySelector("Build");
    const b = M.novaBuild({ origem: "pob" });
    b.classe = (B && B.getAttribute("className")) || "";
    b.asc = (B && B.getAttribute("ascendClassName")) || "";
    if (b.asc === "None") b.asc = "";
    b.nivel = parseInt(B && B.getAttribute("level"), 10) || 1;

    /* números calculados pelo PoB */
    const ps = {};
    raiz.querySelectorAll("Build > PlayerStat").forEach((p) => { ps[p.getAttribute("stat")] = p.getAttribute("value"); });
    const st = {};
    const mapa = { vida: "Life", es: "EnergyShield", mana: "Mana", espirito: "Spirit", armadura: "Armour", evasao: "Evasion", deflexao: "DeflectChance",
      bloqueio: "EffectiveBlockChance", resFogo: "FireResist", resFrio: "ColdResist", resRaio: "LightningResist", resCaos: "ChaosResist", crit: "CritChance", ehp: "TotalEHP" };
    Object.entries(mapa).forEach(([k, s]) => { if (ps[s] !== undefined) st[k] = num(ps[s]); });
    const dps = ps.FullDPS || ps.CombinedDPS || ps.TotalDPS;
    if (dps !== undefined) st.dps = Math.round(parseFloat(dps));
    b.stats = st;
    if (+ps.LifeLeechGainRate > 0) b.recup.leech = true;
    if (+ps.NetLifeRegen > 0 || +ps.LifeRegenRecovery > 0) b.recup.regen = true;
    if (+ps.EnergyShield > 0) b.recup.recarga = true;

    /* skills e suportes */
    const desconhecidos = [];
    const mainIdx = parseInt(B && B.getAttribute("mainSocketGroup"), 10) || 1;
    const setAtivo = raiz.querySelector("Skills") && raiz.querySelector("Skills").getAttribute("activeSkillSet");
    let grupos = [...raiz.querySelectorAll("Skills > SkillSet")];
    let skillEls = grupos.length ? [...(grupos.find((s) => s.getAttribute("id") === setAtivo) || grupos[0]).querySelectorAll(":scope > Skill")] : [...raiz.querySelectorAll("Skills > Skill")];
    skillEls.forEach((sk, i) => {
      if (sk.getAttribute("enabled") === "false") return;
      const gems = [...sk.querySelectorAll(":scope > Gem")].filter((g) => g.getAttribute("enabled") !== "false");
      const ativos = [], sups = [];
      gems.forEach((g) => {
        const nome = (g.getAttribute("nameSpec") || "").trim();
        const n = M.norm(nome);
        const a = M.SKN.get(n), s = M.SUN.get(n) || M.SUN.get(M.norm(nome.replace(/ Support$/i, "")));
        if (s && !a) sups.push(s.n);
        else if (a) ativos.push(a.n);
        else if (nome) desconhecidos.push(nome);
      });
      ativos.forEach((nome, j) => {
        const s = M.SK.get(nome);
        const papel = i + 1 === mainIdx && j === 0 ? "principal" : M.ehPersistente(s) ? "buff" : "secundaria";
        b.grupos.push({ skill: nome, papel, sup: j === 0 ? sups.slice(0, 6) : [] });
      });
    });
    if (!b.grupos.some((g) => g.papel === "principal") && b.grupos.length) {
      const g = b.grupos.find((g) => !M.ehPersistente(M.SK.get(g.skill))) || b.grupos[0];
      g.papel = "principal";
    }

    /* árvore: keystones, notáveis, ascendência */
    const specs = [...raiz.querySelectorAll("Tree > Spec")];
    const tree = raiz.querySelector("Tree");
    const ativoSpec = specs[(parseInt(tree && tree.getAttribute("activeSpec"), 10) || 1) - 1] || specs[0];
    if (ativoSpec) {
      const ids = (ativoSpec.getAttribute("nodes") || "").split(",").map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
      b.nosIds = ids.filter((id) => id < 65536);
      ids.forEach((id) => {
        const n = M.NODE.get(id); if (!n) return;
        if (n.tipo === "keystone") b.keystones.push(n.n);
        else if (n.tipo === "notavel") b.notaveis.push(n.n);
        else if (n.tipo === "asc") {
          const meu = (window.KB_ARVORE.ascendencias[b.asc] || []).find((x) => x.id === id);
          if (meu && !b.ascNos.includes(meu.n)) b.ascNos.push(meu.n);
        }
      });
    }

    /* itens: únicos + arma */
    const itensPorId = {};
    raiz.querySelectorAll("Items > Item").forEach((it) => { itensPorId[it.getAttribute("id")] = it.textContent || ""; });
    const setItens = raiz.querySelector("Items > ItemSet") ;
    const usados = new Set();
    const slots = {};
    if (setItens) setItens.querySelectorAll("Slot").forEach((s) => { const id = s.getAttribute("itemId"); if (id && id !== "0") { usados.add(id); slots[s.getAttribute("name")] = id; } });
    else Object.keys(itensPorId).forEach((id) => usados.add(id));
    usados.forEach((id) => {
      const txt = itensPorId[id]; if (!txt) return;
      const linhas = txt.split("\n").map((l) => l.trim()).filter(Boolean);
      const r = linhas.findIndex((l) => /^Rarity:/i.test(l));
      if (r >= 0 && /UNIQUE/i.test(linhas[r]) && linhas[r + 1]) {
        const u = M.UNN.get(M.norm(linhas[r + 1]));
        if (u && !b.unicos.includes(u.n)) b.unicos.push(u.n);
      }
    });
    /* arma: pelo requisito da skill principal (o XML não traz a classe do item) */
    const P = M.principal(b);
    if (P) {
      b.arma = M.armaSugerida(P.s.w) || (P.s.t === "Spell" ? "Staff" : "");
      if (b.arma === "Bow") b.offhand = "Quiver";
    }
    const arma1 = itensPorId[slots["Weapon 1"]] || "";
    [["Quarterstaff", /Quarterstaff/], ["Bow", /\bBow\b/], ["Crossbow", /Crossbow/], ["Spear", /Spear/], ["Talisman", /Talisman/], ["Sceptre", /Sceptre/], ["Wand", /\bWand\b/], ["Staff", /\bStaff\b/], ["Two Hand Mace", /Two Hand Mace|Maul|Hammer/], ["One Hand Mace", /Mace|Club/]].some(([id, rx]) => {
      if (rx.test(arma1.split("\n").slice(0, 4).join(" ")) && (!b.arma || M.armaAtende(P && P.s.w, id, b.offhand))) { b.arma = id; return true; }
      return false;
    });
    const off = itensPorId[slots["Weapon 2"]] || "";
    if (/Shield/.test(off)) b.offhand = /Buckler/.test(off) ? "Buckler" : "Shield";
    else if (/Focus/.test(off)) b.offhand = "Focus";
    else if (/Quiver/.test(off)) b.offhand = "Quiver";

    const notas = raiz.querySelector("Notes");
    if (notas && notas.textContent.trim()) b.notas = notas.textContent.trim().replace(/\^(x[0-9A-Fa-f]{6}|[0-9])/g, "").slice(0, 3000);
    b.nome = (P ? P.s.n : "Build") + (b.asc ? " " + b.asc : "") + " (PoB)";
    return { build: b, desconhecidos: [...new Set(desconhecidos)] };
  }

  async function importar(texto) {
    const xml = await obterXml(texto);
    const r = paraBuild(xml);
    if (!/^</.test(String(texto).trim())) r.build.pob = String(texto).trim().slice(0, 60000);
    return r;
  }

  window.Pob = { importar, obterXml, paraBuild };
})();
