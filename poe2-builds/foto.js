/* ============================================================
   Exile Compass — montar a build a partir de FOTOS / PRINTS
   ------------------------------------------------------------
   OCR no próprio celular (Tesseract.js, carregado do jsDelivr só
   quando usado). A imagem é preparada (cinza, inverte o fundo
   escuro do jogo, estica o contraste) e o texto lido é casado
   com os nomes do jogo (skills, suportes, ascendências, únicos)
   por semelhança — erros de leitura pequenos não atrapalham.
   Telas que funcionam melhor: Skills (gemas), Personagem
   (nível/ascendência/números) e Equipamento (únicos).
   ============================================================ */
(function () {
  "use strict";
  const J = window.KB_JOGO, U = window.KB_UNICOS || [], Mo = window.Motor;
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[|]/g, "l").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  /* ---------------- dicionário ---------------- */
  let DIC = null;
  function dicionario() {
    if (DIC) return DIC;
    const ent = [];
    const add = (tipo, n) => { const k = norm(n); if (k.length >= 3) ent.push({ tipo, n, k, w: k.split(" ").length }); };
    J.skills.forEach((s) => add("skill", s.n));
    J.suportes.forEach((s) => add("sup", s.n));
    J.classes.forEach((c) => { add("classe", c.n); c.asc.forEach((a) => add("asc", a)); });
    U.forEach((u) => add("unico", u.n));
    const exato = new Map();
    ent.forEach((e) => { if (!exato.has(e.k)) exato.set(e.k, e); });
    const porLetra = new Map();
    ent.forEach((e) => { const c = e.k[0]; if (!porLetra.has(c)) porLetra.set(c, []); porLetra.get(c).push(e); });
    DIC = { ent, exato, porLetra };
    return DIC;
  }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1));
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  /* o OCR costuma trocar o "I" dos tiers de suporte (Retreat I, Pin II) por ] | ! 1 ou l colado:
     testa variantes da linha e fica com a que casa mais nomes */
  function variantes(linha) {
    const v1 = String(linha).replace(/[\]|!]/g, "I").replace(/([a-z])(I{1,3})(?=\s|$)/g, "$1 $2")
      .replace(/(^|\s)[Il1]{3}(?=\s|$)/g, "$1III").replace(/(^|\s)[Il1]{2}(?=\s|$)/g, "$1II").replace(/(^|\s)[l1](?=\s|$)/g, "$1I");
    const v2 = v1.replace(/([a-z]{2,})[l1](?=\s|$)/g, "$1 I").replace(/([a-z]{2,})[l1]{2}(?=\s|$)/g, "$1 II");
    return [...new Set([String(linha), v1, v2])];
  }
  function casarLinha(linha) {
    let melhor = [], ms = -1;
    for (const v of variantes(linha)) {
      const r = casarUma(v);
      const sc = r.reduce((a, e) => a + e.k.length, 0);
      if (sc > ms) { ms = sc; melhor = r; }
    }
    return melhor;
  }
  function casarUma(linha) {
    const D = dicionario();
    const ws = norm(linha).split(" ").filter(Boolean);
    const achados = [];
    for (let i = 0; i < ws.length; i++) {
      for (let L = 1; L <= 6 && i + L <= ws.length; L++) {
        const cand = ws.slice(i, i + L).join(" ");
        if (cand.length < 4) continue;
        const ex = D.exato.get(cand);
        if (ex) { achados.push({ e: ex, i, L, sc: 1 + cand.length / 100 }); continue; }
        if (cand.length < 6) continue;
        const lista = D.porLetra.get(cand[0]) || [];
        let best = null, bs = 0;
        for (const e of lista) {
          if (Math.abs(e.w - L) > 1 || Math.abs(e.k.length - cand.length) > Math.max(2, cand.length * 0.2)) continue;
          const r = 1 - lev(cand, e.k) / Math.max(cand.length, e.k.length);
          if (r > bs) { bs = r; best = e; }
        }
        const lim = cand.length <= 8 ? 0.88 : 0.82;
        if (best && bs >= lim) achados.push({ e: best, i, L, sc: bs + cand.length / 100 });
      }
    }
    achados.sort((a, b) => b.sc - a.sc || b.L - a.L);
    const usado = new Array(ws.length).fill(false);
    const out = [];
    for (const a of achados) {
      let livre = true;
      for (let k = a.i; k < a.i + a.L; k++) if (usado[k]) livre = false;
      if (!livre) continue;
      for (let k = a.i; k < a.i + a.L; k++) usado[k] = true;
      out.push(a);
    }
    return out.sort((a, b) => a.i - b.i).map((a) => a.e);
  }

  /* ---------------- números da tela de personagem ---------------- */
  const NUM = "(\\d{1,3}(?:[.,]\\d{3})+|\\d{1,6})";
  const STATS = [
    ["vida", new RegExp("^(?:maximum\\s+)?life\\b[^\\d%]{0,6}" + NUM + "(?!\\s*%)", "i")],
    ["es", new RegExp("^(?:maximum\\s+)?energy shield\\b[^\\d%]{0,6}" + NUM + "(?!\\s*%)", "i")],
    ["mana", new RegExp("^(?:maximum\\s+)?mana\\b[^\\d%]{0,6}" + NUM + "(?!\\s*%)", "i")],
    ["espirito", new RegExp("^spirit\\b[^\\d%]{0,6}" + NUM, "i")],
    ["armadura", new RegExp("^armou?r\\b[^\\d%]{0,6}" + NUM, "i")],
    ["evasao", new RegExp("^evasion(?: rating)?\\b[^\\d%]{0,6}" + NUM, "i")],
    ["resFogo", /^fire resistance\b[^\d-]{0,6}(-?\d{1,3})\s*%?/i],
    ["resFrio", /^cold resistance\b[^\d-]{0,6}(-?\d{1,3})\s*%?/i],
    ["resRaio", /^lightning resistance\b[^\d-]{0,6}(-?\d{1,3})\s*%?/i],
    ["resCaos", /^chaos resistance\b[^\d-]{0,6}(-?\d{1,3})\s*%?/i],
    ["bloqueio", /^block chance\b[^\d]{0,6}(\d{1,3})\s*%?/i],
    ["deflexao", /^deflect(?:ion)? chance\b[^\d]{0,6}(\d{1,3})\s*%?/i]
  ];
  const numero = (s) => parseInt(String(s).replace(/[.,]/g, ""), 10);

  function interpretar(linhas) {
    const r = { asc: "", classe: "", nivel: 0, grupos: [], soltos: [], unicos: [], stats: {}, linhas };
    let atual = null, desde = 99;
    for (const linhaBruta of linhas) {
      const linha = String(linhaBruta || "").trim();
      if (!linha) continue;
      const limpa = linha.replace(/^[^A-Za-z]+/, "");
      for (const [k, rx] of STATS) { const m = limpa.match(rx); if (m && r.stats[k] == null) r.stats[k] = numero(m[1]); }
      const achados = casarLinha(linha);
      const temClasse = achados.some((e) => e.tipo === "asc" || e.tipo === "classe");
      const skillAqui = achados.filter((e) => e.tipo === "skill").pop();
      /* "Level N": nível da gema (perto de uma skill, até 21) ou do personagem (junto da classe) */
      const lv = linha.match(/\b(?:level|lvl|lv|n[ií]vel)\s*[:.]?\s*(\d{1,3})\b/i);
      if (lv) {
        const n = +lv[1];
        if (temClasse) { if (n >= 1 && n <= 100) r.nivel = n; }
        else if (n <= 21 && (skillAqui || (atual && desde <= 2))) {
          const g = skillAqui ? r.grupos.find((x) => x.skill === skillAqui.n) : atual;
          if (g && !g.nv) g.nv = n; else if (!g && skillAqui) r.grupos.push({ skill: skillAqui.n, sup: [], nv: n });
        } else if (!r.nivel && n >= 1 && n <= 100) r.nivel = n;
      }
      desde++;
      for (const e of achados) {
        if (e.tipo === "asc") { if (!r.asc) r.asc = e.n; }
        else if (e.tipo === "classe") { if (!r.classe) r.classe = e.n; }
        else if (e.tipo === "unico") { if (!r.unicos.includes(e.n)) r.unicos.push(e.n); }
        else if (e.tipo === "skill") {
          let g = r.grupos.find((x) => x.skill === e.n);
          if (!g) { g = { skill: e.n, sup: [] }; r.grupos.push(g); }
          atual = g; desde = 0;
        } else if (e.tipo === "sup") {
          const alvo = atual;
          if (alvo) { if (!alvo.sup.includes(e.n) && alvo.sup.length < 5) alvo.sup.push(e.n); }
          else if (!r.soltos.includes(e.n)) r.soltos.push(e.n);
        }
      }
    }
    if (r.asc && !r.classe) r.classe = Mo.CLASSE_DE[r.asc] || "";
    /* principal = a primeira skill que não é buff persistente */
    const pri = r.grupos.find((g) => !Mo.ehPersistente(Mo.SK.get(g.skill))) || r.grupos[0];
    r.grupos.forEach((g) => { g.papel = g === pri ? "principal" : Mo.ehPersistente(Mo.SK.get(g.skill)) ? "buff" : "secundaria"; });
    if (pri && r.soltos.length) { r.soltos.forEach((n) => { if (pri.sup.length < 5 && !pri.sup.includes(n)) pri.sup.push(n); }); r.soltos = []; }
    return r;
  }

  /* ---------------- imagem → canvas preparado ---------------- */
  async function abrirImagem(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { /* cai no <img> */ } }
    return await new Promise((ok, falha) => {
      const im = new Image(); const url = URL.createObjectURL(file);
      im.onload = () => { URL.revokeObjectURL(url); ok(im); }; im.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Imagem inválida")); };
      im.src = url;
    });
  }
  async function preparar(file) {
    const im = await abrirImagem(file);
    const w0 = im.width || im.naturalWidth, h0 = im.height || im.naturalHeight;
    const alvo = Math.max(1400, Math.min(2200, w0));
    const k = alvo / w0;
    const cv = document.createElement("canvas");
    cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    const W = cv.width, H = cv.height;
    const id = ctx.getImageData(0, 0, W, H), p = id.data;
    /* cinza */
    const g = new Float32Array(W * H);
    let soma = 0;
    for (let i = 0, k = 0; i < p.length; i += 4, k++) { const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000; g[k] = y; soma += y; }
    const claroNoEscuro = soma / (W * H) < 128;      /* UI do jogo: texto claro sobre fundo escuro */
    /* fundo local (média numa janela grande, via imagem integral) → só sobra o que destoa do fundo: o texto */
    const R = Math.max(12, Math.round(W * 0.015));
    const I = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let lin = 0; for (let x = 0; x < W; x++) { lin += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + lin; } }
    const d = new Float32Array(W * H);
    const hist = new Uint32Array(256);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1);
        const media = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const v = Math.max(0, claroNoEscuro ? g[y * W + x] - media : media - g[y * W + x]);
        d[y * W + x] = v; hist[Math.min(255, v | 0)]++;
      }
    }
    /* escala: o 99,5º percentil vira preto total */
    let acc = 0, alto = 255;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= W * H * 0.005) { alto = Math.max(20, v); break; } }
    const esc = 255 / alto;
    for (let k = 0, i = 0; k < d.length; k++, i += 4) { const o = 255 - Math.min(255, d[k] * esc); p[i] = p[i + 1] = p[i + 2] = o; }
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  /* ---------------- OCR ---------------- */
  let carregando = null;
  function carregarTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!carregando) carregando = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = TESS; s.crossOrigin = "anonymous";
      s.onload = () => window.Tesseract ? ok(window.Tesseract) : falha(new Error("Tesseract não carregou"));
      s.onerror = () => { carregando = null; falha(new Error("Sem internet para baixar o leitor de texto (primeira vez).")); };
      document.head.appendChild(s);
    });
    return carregando;
  }
  /* files → { texto por imagem, resultado interpretado } ; onProg(0..1, mensagem) */
  async function ler(files, onProg) {
    const prog = onProg || (() => {});
    prog(0.02, "Baixando o leitor de texto…");
    const Tess = await carregarTesseract();
    let atual = 0;
    const total = files.length;
    const worker = await Tess.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") prog((atual + m.progress) / total * 0.95 + 0.05, `Lendo imagem ${atual + 1} de ${total}…`);
        else if (/load|initializ/i.test(m.status || "")) prog(0.04, "Preparando o leitor…");
      }
    });
    const linhas = [];
    try {
      for (atual = 0; atual < total; atual++) {
        prog(atual / total * 0.95 + 0.05, `Preparando imagem ${atual + 1} de ${total}…`);
        const cv = await preparar(files[atual]);
        const { data } = await worker.recognize(cv);
        String(data.text || "").split(/\n+/).forEach((l) => { if (l.trim()) linhas.push(l.trim()); });
      }
    } finally {
      try { await worker.terminate(); } catch (e) { /* ok */ }
    }
    prog(1, "Pronto");
    return interpretar(linhas);
  }

  window.Foto = { ler, interpretar, casarLinha, preparar, norm, carregarTesseract };
})();
