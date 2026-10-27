/* ============================================================
   Exile Compass — desenho da ÁRVORE PASSIVA (canvas)
   ------------------------------------------------------------
   Posições, ligações (retas e arcos), ícones e molduras vêm da
   exportação oficial da GGG (kb/tree.js + img/tree/*.webp).
   Um dedo arrasta, dois dedos dão zoom, toque seleciona o nó.
   Estados de cada nó: caminho até o nível atual (dourado cheio),
   caminho planejado (dourado claro), fixado (ciano), evitado
   (vermelho) e fora do caminho (apagado).
   ============================================================ */
(function () {
  "use strict";
  const T = window.KB_TREE;
  const NO = new Map(T.nos.map((n) => [n.i, n]));
  const FK = 1.1;                      /* px do sprite → unidades da árvore */
  const RAIO = { s: 36, at: 34, n: 54, k: 76, j: 54, c: 70, as: 44 };
  const MOLD = {
    s: ["PSSkillFrame", "PSSkillFrameActive", "PSSkillFrameHighlighted"], at: ["PSSkillFrame", "PSSkillFrameActive", "PSSkillFrameHighlighted"],
    n: ["NotableFrameUnallocated", "NotableFrameAllocated", "NotableFrameCanAllocate"], k: ["KeystoneFrameUnallocated", "KeystoneFrameAllocated", "KeystoneFrameCanAllocate"],
    j: ["JewelFrameUnallocated", "JewelFrameAllocated", "JewelFrameCanAllocate"],
    as_s: ["AscendancyFrameNormalUnallocated", "AscendancyFrameNormalAllocated", "AscendancyFrameNormalCanAllocate"],
    as_n: ["AscendancyFrameNotableUnallocated", "AscendancyFrameNotableAllocated", "AscendancyFrameNotableCanAllocate"]
  };
  const COR = { ouro: "#e8c15a", ouroClaro: "rgba(232,193,90,.55)", linha: "rgba(128,112,86,.42)", linhaAsc: "rgba(150,135,110,.55)", fixo: "#5fd3e0", evitar: "#e05050", sel: "#ffffff", fundo: "#0b0a09" };

  const imgs = {};
  let carregadas = null;
  function carregar(base) {
    if (carregadas) return carregadas;
    const lista = { on: "skills.webp", off: "skills-off.webp", frame: "frame.webp", start: "start.webp", startOn: "start-on.webp" };
    carregadas = Promise.all(Object.entries(lista).map(([k, f]) => new Promise((ok) => {
      const im = new Image(); im.decoding = "async";
      im.onload = () => { imgs[k] = im; ok(); }; im.onerror = () => ok();
      im.src = base + "img/tree/" + f;
    })));
    return carregadas;
  }
  const retratos = new Map();
  function retrato(base, nome, cb) {
    if (!nome) return null;
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (retratos.has(slug)) return retratos.get(slug);
    const im = new Image(); im.decoding = "async";
    im.onload = () => cb && cb(); im.src = base + "img/asc/" + slug + ".webp";
    retratos.set(slug, im);
    return im;
  }

  function criar(el, opt) {
    opt = opt || {};
    const base = opt.base || "";
    const cv = document.createElement("canvas");
    cv.className = "arv-canvas";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", "Árvore passiva — arraste para mover, pinça para zoom, toque num nó para ver detalhes");
    el.appendChild(cv);
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let s = 0.05, ox = 0, oy = 0;
    let modo = "main";
    let d = { ordem: [], atuais: new Set(), fixos: new Set(), evitar: new Set(), ate: 0, numero: new Map(), sel: null, classe: null, asc: null, ov: {}, ascOrdem: [], ascAte: 99 };
    let plano = new Set(), feito = new Set(), ascPlano = new Set();
    let pend = false, vivo = true;

    function tamanho() {
      const r = el.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      pedir();
    }
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(tamanho) : null;
    if (ro) ro.observe(el); else window.addEventListener("resize", tamanho);

    function pedir() { if (!pend && vivo) { pend = true; requestAnimationFrame(desenhar); } }
    carregar(base).then(pedir);

    const visivel = (n) => {
      if (modo === "asc") { const a = d.asc; return !!a && n.a === (a.base || a.id) && !n.p; }
      if (n.a || n.p) return false;
      if (n.u && (!d.asc || n.u !== d.asc.id)) return false;
      return true;
    };
    const dados = (n) => (modo === "asc" && d.ov[n.i]) ? Object.assign({}, n, d.ov[n.i]) : n;
    const estado = (n) => {
      if (n.t === "c") return d.classe && n.i === d.classe.ini ? 2 : 0;
      if (modo === "asc") { if (n.t === "as") return 2; return ascPlano.has(n.i) ? (d.ascOrdem.indexOf(n.i) < d.ascAte ? 2 : 1) : 0; }
      if (feito.has(n.i)) return 2;
      if (plano.has(n.i)) return 1;
      return 0;
    };

    function arco(l, A, B) {
      const [, , cx, cy] = l;
      const r = Math.hypot(A.x - cx, A.y - cy);
      let a1 = Math.atan2(A.y - cy, A.x - cx), a2 = Math.atan2(B.y - cy, B.x - cx);
      let da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      ctx.moveTo(A.x * s + ox, A.y * s + oy);
      ctx.arc(cx * s + ox, cy * s + oy, r * s, a1, a1 + da, da < 0);
    }

    function desenhar() {
      pend = false;
      if (!vivo) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(40,32,22,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const mx = 140 / s;
      const x0 = -ox / s - mx, y0 = -oy / s - mx, x1 = (W - ox) / s + mx, y1 = (H - oy) / s + mx;
      const dentro = (n) => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1;

      /* arte de fundo */
      if (modo === "asc" && d.asc) {
        const im = retrato(base, d.asc.n, pedir);
        if (im && im.complete && im.naturalWidth) {
          const R = d.asc.r * 1.35;
          ctx.save(); ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.arc(d.asc.cx * s + ox, d.asc.cy * s + oy, R * s, 0, 2 * Math.PI); ctx.clip();
          ctx.drawImage(im, (d.asc.cx - R) * s + ox, (d.asc.cy - R) * s + oy, 2 * R * s, 2 * R * s);
          ctx.restore();
        }
      } else {
        T.classes.forEach((c) => {
          const n = NO.get(c.ini); if (!n || !dentro(n)) return;
          const meu = d.classe && d.classe.ini === c.ini;
          const im = meu ? imgs.startOn : imgs.start;
          const R = 560;
          if (meu) {
            const p = retrato(base, d.classe.n, pedir);
            if (p && p.complete && p.naturalWidth) {
              ctx.save(); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(n.x * s + ox, n.y * s + oy, R * 0.58 * s, 0, 2 * Math.PI); ctx.clip();
              ctx.drawImage(p, (n.x - R * 0.58) * s + ox, (n.y - R * 0.58) * s + oy, 2 * R * 0.58 * s, 2 * R * 0.58 * s); ctx.restore();
            }
          }
          if (im) { ctx.globalAlpha = meu ? 1 : 0.45; ctx.drawImage(im, (n.x - R) * s + ox, (n.y - R) * s + oy, 2 * R * s, 2 * R * s); ctx.globalAlpha = 1; }
        });
      }

      /* ligações */
      const lw = Math.max(1, 7 * s);
      const ligs = [[], [], []];
      for (const l of T.lig) {
        if (l[4]) continue;
        const A = NO.get(l[0]), B = NO.get(l[1]);
        if (!A || !B || !visivel(A) || !visivel(B)) continue;
        if (!dentro(A) && !dentro(B)) continue;
        const ea = estado(A), eb = estado(B);
        ligs[Math.min(ea, eb)].push([l, A, B]);
      }
      ctx.lineCap = "round";
      const traco = (lista, cor, w) => {
        if (!lista.length) return;
        ctx.beginPath();
        for (const [l, A, B] of lista) {
          if (l.length >= 4 && (l[2] || l[3])) arco(l, A, B);
          else { ctx.moveTo(A.x * s + ox, A.y * s + oy); ctx.lineTo(B.x * s + ox, B.y * s + oy); }
        }
        ctx.strokeStyle = cor; ctx.lineWidth = w; ctx.stroke();
      };
      traco(ligs[0], modo === "asc" ? COR.linhaAsc : COR.linha, lw);
      traco(ligs[1], "rgba(232,193,90,.28)", Math.max(3, lw * 2.4));
      traco(ligs[1], COR.ouroClaro, Math.max(1.5, lw * 1.1));
      traco(ligs[2], "rgba(255,200,90,.30)", Math.max(4, lw * 3));
      traco(ligs[2], COR.ouro, Math.max(2, lw * 1.5));

      /* nós */
      const pequenos = [[], [], []];
      const grandes = [];
      for (const n0 of T.nos) {
        if (!visivel(n0) || !dentro(n0)) continue;
        const n = dados(n0);
        if (n.t === "c" && modo === "main") continue;
        const r = (RAIO[n.t] || 26) * (n.a && n.t === "n" ? 1.25 : 1);
        const rs = r * s;
        const e = estado(n);
        if (rs < 4.5) pequenos[e].push([n, Math.max(1.2, rs)]);
        else grandes.push([n, r, rs, e]);
      }
      [["rgba(150,135,110,.75)", 0], [COR.ouroClaro, 1], [COR.ouro, 2]].forEach(([cor, e]) => {
        if (!pequenos[e].length) return;
        ctx.fillStyle = cor; ctx.beginPath();
        for (const [n, rr] of pequenos[e]) { ctx.moveTo(n.x * s + ox + rr, n.y * s + oy); ctx.arc(n.x * s + ox, n.y * s + oy, rr, 0, 2 * Math.PI); }
        ctx.fill();
      });
      const fr = T.mold;
      for (const [n, r, rs, e] of grandes) {
        const X = n.x * s + ox, Y = n.y * s + oy;
        const folha = e ? imgs.on : imgs.off;
        const q = e ? T.q[n.f] : T.qo[n.g];
        if (folha && q) {
          const ri = r * (n.t === "k" ? 0.66 : n.t === "n" ? 0.68 : 0.7) * s;
          ctx.save();
          ctx.beginPath(); ctx.arc(X, Y, ri, 0, 2 * Math.PI); ctx.clip();
          if (!e) ctx.globalAlpha = 0.8;
          ctx.drawImage(folha, q[0], q[1], q[2], q[3], X - ri, Y - ri, 2 * ri, 2 * ri);
          ctx.restore();
        } else {
          ctx.fillStyle = e ? COR.ouro : "#3a342c"; ctx.beginPath(); ctx.arc(X, Y, rs * 0.7, 0, 2 * Math.PI); ctx.fill();
        }
        const tipo = n.a ? (n.t === "n" ? "as_n" : n.t === "as" ? null : "as_s") : n.t;
        const nomes = tipo && MOLD[tipo];
        const m = nomes && fr[nomes[e === 2 ? 1 : e === 1 ? 2 : 0]];
        if (n.t === "as" && fr.AscendancyStartNode) {
          const f = fr.AscendancyStartNode; ctx.drawImage(imgs.frame, f[0], f[1], f[2], f[3], X - rs * 1.3, Y - rs * 1.3, rs * 2.6, rs * 2.6);
        } else if (m && imgs.frame) {
          const sz = rs * 2.15;
          ctx.drawImage(imgs.frame, m[0], m[1], m[2], m[3], X - sz / 2, Y - sz / 2, sz, sz);
        } else {
          ctx.strokeStyle = e ? COR.ouro : "#6b604f"; ctx.lineWidth = Math.max(1, rs * 0.15); ctx.beginPath(); ctx.arc(X, Y, rs * 0.85, 0, 2 * Math.PI); ctx.stroke();
        }
        if (d.fixos.has(n.i) || d.evitar.has(n.i)) {
          ctx.strokeStyle = d.fixos.has(n.i) ? COR.fixo : COR.evitar; ctx.lineWidth = Math.max(2, rs * 0.18);
          ctx.beginPath(); ctx.arc(X, Y, rs * 1.15, 0, 2 * Math.PI); ctx.stroke();
          if (d.evitar.has(n.i)) { ctx.beginPath(); ctx.moveTo(X - rs * 0.7, Y - rs * 0.7); ctx.lineTo(X + rs * 0.7, Y + rs * 0.7); ctx.stroke(); }
        }
        if (rs >= 15 && (n.t === "n" || n.t === "k" || n.t === "j" || (n.a && n.t !== "as"))) {
          ctx.font = "600 " + Math.round(Math.min(15, Math.max(10, rs * 0.45))) + "px Cinzel, Georgia, serif";
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(n.n, X, Y + rs * 1.1);
          ctx.fillStyle = e ? "#f3dc9a" : "#b7aa92"; ctx.fillText(n.n, X, Y + rs * 1.1);
        }
      }
      /* números da ordem (só nos marcos do caminho) */
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 11px system-ui, sans-serif";
      d.numero.forEach((num, id) => {
        const n = NO.get(id); if (!n || !visivel(n) || !dentro(n)) return;
        const rs = (RAIO[n.t] || 26) * s * (n.a ? 1.25 : 1);
        const X = n.x * s + ox + Math.max(7, rs * 0.85), Y = n.y * s + oy - Math.max(7, rs * 0.85);
        ctx.fillStyle = estado(n) === 2 ? COR.ouro : "#2a2216";
        ctx.strokeStyle = COR.ouro; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X, Y, 9, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = estado(n) === 2 ? "#1a1408" : COR.ouro; ctx.fillText(String(num), X, Y + 0.5);
      });
      /* seleção */
      if (d.sel != null) {
        const n = NO.get(d.sel);
        if (n && visivel(n)) {
          const rs = Math.max(10, (RAIO[n.t] || 26) * s * (n.a ? 1.25 : 1));
          ctx.strokeStyle = COR.sel; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.arc(n.x * s + ox, n.y * s + oy, rs * 1.35, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    /* ---------------- enquadrar ---------------- */
    function enquadrar(ids, margem) {
      const ns = ids.map((i) => NO.get(i)).filter(Boolean);
      if (!ns.length) return;
      let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
      ns.forEach((n) => { ax = Math.min(ax, n.x); ay = Math.min(ay, n.y); bx = Math.max(bx, n.x); by = Math.max(by, n.y); });
      const m = margem == null ? 300 : margem;
      ax -= m; ay -= m; bx += m; by += m;
      s = Math.min(W / (bx - ax), H / (by - ay));
      s = Math.max(0.012, Math.min(1.6, s));
      ox = W / 2 - ((ax + bx) / 2) * s; oy = H / 2 - ((ay + by) / 2) * s;
      pedir();
    }
    function focar() {
      if (!W) tamanho();
      if (modo === "asc" && d.asc) {
        const R = d.asc.r * 1.4;
        s = Math.min(W, H) / (2 * R); ox = W / 2 - d.asc.cx * s; oy = H / 2 - d.asc.cy * s; pedir(); return;
      }
      const ids = [...(d.classe ? [d.classe.ini] : []), ...d.ordem.slice(0, Math.max(12, Math.min(30, d.ate || 30)))];
      enquadrar(ids, 350);
    }
    function tudo() {
      const ns = T.nos.filter((n) => !n.a);
      enquadrar(ns.map((n) => n.i), 200);
    }

    /* ---------------- gestos ---------------- */
    const ptrs = new Map();
    let ini = null, pinca = null, toque = null;
    function zoomEm(f, px, py) {
      const ns = Math.max(0.012, Math.min(2.2, s * f));
      const k = ns / s;
      ox = px - (px - ox) * k; oy = py - (py - oy) * k; s = ns;
      pedir();
    }
    function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, pos(e));
      if (ptrs.size === 1) { const [x, y] = pos(e); ini = { x, y, ox, oy, t: Date.now(), mov: 0 }; }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, ox, oy };
        if (ini) ini.mov = 999;
      }
    });
    cv.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, pos(e));
      if (ptrs.size >= 2 && pinca) {
        const [a, b] = [...ptrs.values()];
        const dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const ns = Math.max(0.012, Math.min(2.2, pinca.s * dd / Math.max(1, pinca.d)));
        const k = ns / pinca.s;
        s = ns; ox = mx - (pinca.mx - pinca.ox) * k; oy = my - (pinca.my - pinca.oy) * k;
        pedir();
      } else if (ini && ptrs.size === 1) {
        const [x, y] = pos(e);
        ini.mov = Math.max(ini.mov, Math.hypot(x - ini.x, y - ini.y));
        ox = ini.ox + (x - ini.x); oy = ini.oy + (y - ini.y);
        pedir();
      }
    });
    const fim = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinca = null;
      if (ptrs.size === 1) { const [p] = [...ptrs.values()]; ini = { x: p[0], y: p[1], ox, oy, t: Date.now(), mov: 999 }; return; }
      if (ini && ini.mov < 9 && Date.now() - ini.t < 500 && e.type === "pointerup") {
        const [x, y] = pos(e);
        const agora = Date.now();
        if (toque && agora - toque.t < 300 && Math.hypot(x - toque.x, y - toque.y) < 24) { zoomEm(2, x, y); toque = null; }
        else { toque = { t: agora, x, y }; tocar(x, y); }
      }
      ini = null;
    };
    cv.addEventListener("pointerup", fim);
    cv.addEventListener("pointercancel", fim);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = pos(e); zoomEm(e.deltaY < 0 ? 1.18 : 1 / 1.18, x, y); }, { passive: false });

    function tocar(x, y) {
      let melhor = null, md = Infinity;
      for (const n0 of T.nos) {
        if (!visivel(n0) || n0.t === "c") continue;
        const X = n0.x * s + ox, Y = n0.y * s + oy;
        const dd = Math.hypot(X - x, Y - y);
        const lim = Math.max(22, (RAIO[n0.t] || 26) * s * 1.2);
        if (dd < lim && dd < md) { md = dd; melhor = n0; }
      }
      d.sel = melhor ? melhor.i : null;
      pedir();
      if (opt.onTap) opt.onTap(melhor ? dados(melhor) : null);
    }

    return {
      definir(novo) {
        d = Object.assign(d, novo);
        d.atuais = new Set(d.atuais || []); d.fixos = new Set(d.fixos || []); d.evitar = new Set(d.evitar || []);
        plano = new Set([...d.ordem, ...d.atuais]);
        feito = new Set([...d.atuais, ...d.ordem.slice(0, Math.max(0, d.ate - d.atuais.size))]);
        ascPlano = new Set(d.ascOrdem || []);
        pedir();
      },
      modo(m) { modo = m; d.sel = null; focar(); },
      get modoAtual() { return modo; },
      focar, tudo, enquadrar,
      zoom(f) { zoomEm(f, W / 2, H / 2); },
      selecionar(id) { d.sel = id; pedir(); },
      centrar(id) { const n = NO.get(id); if (!n) return; if (s < 0.25) s = 0.32; ox = W / 2 - n.x * s; oy = H / 2 - n.y * s; d.sel = id; pedir(); },
      redesenhar: pedir,
      destruir() { vivo = false; if (ro) ro.disconnect(); cv.remove(); }
    };
  }

  window.Arvore = { criar, NO, carregar, retrato };
})();
