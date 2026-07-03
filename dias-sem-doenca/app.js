/* Dias sem Doença — contador offline para Di e Tati (+ placar do casal).
   Tudo fica salvo localmente (localStorage). Funciona sem internet. */

(function () {
  "use strict";

  var STORAGE_KEY = "ddsd_v2";
  var DAY = 86400000;

  // ---------- estado ----------
  function defaultState() {
    var now = Date.now();
    function person(name) {
      return { name: name, status: "healthy", streakStart: now, illness: null, records: [], best: 0 };
    }
    return { people: { di: person("Di"), tati: person("Tati") }, coupleBest: 0 };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("ddsd_v1");
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || !s.people || !s.people.di || !s.people.tati) return defaultState();
      if (typeof s.coupleBest !== "number") s.coupleBest = 0;
      return s;
    } catch (e) { return defaultState(); }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load();

  // ---------- datas ----------
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function daysBetween(a, b) { return Math.max(0, Math.floor((startOfDay(b) - startOfDay(a)) / DAY)); }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function dias(n) { return n === 1 ? "dia" : "dias"; }
  function dateInputToTs(v) { if (!v) return Date.now(); var p = v.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime(); }
  function tsToDateInput(ts) { var d = new Date(ts); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---------- render ----------
  var coupleEl = document.getElementById("coupleCard");

  function render() {
    var now = Date.now(), di = state.people.di, tati = state.people.tati;
    [["di", di], ["tati", tati]].forEach(function (pair) {
      var p = pair[1];
      if (p.status === "healthy") { var d = daysBetween(p.streakStart, now); if (d > (p.best || 0)) p.best = d; }
      renderPerson(pair[0], p, now);
    });

    var anySick = di.status === "sick" || tati.status === "sick";
    if (!anySick) {
      var cd = daysBetween(Math.max(di.streakStart, tati.streakStart), now);
      if (cd > (state.coupleBest || 0)) state.coupleBest = cd;
      coupleEl.className = "couple";
      coupleEl.innerHTML =
        '<div class="eyebrow">Di &amp; Tati · juntos</div>' +
        '<div class="big num">' + cd + '</div>' +
        '<div class="label">' + dias(cd) + ' sem ninguém doente</div>' +
        '<div class="record">🏆 recorde do casal: ' + (state.coupleBest || 0) + ' ' + dias(state.coupleBest || 0) + '</div>';
    } else {
      var who = [];
      if (di.status === "sick") who.push("Di");
      if (tati.status === "sick") who.push("Tati");
      coupleEl.className = "couple alert";
      coupleEl.innerHTML =
        '<div class="eyebrow">Di &amp; Tati · juntos</div>' +
        '<div class="big num">0</div>' +
        '<div class="label">' + who.join(" e ") + (who.length > 1 ? " estão doentes 🤒" : " está doente 🤒") + '</div>' +
        '<div class="record">🏆 recorde do casal: ' + (state.coupleBest || 0) + ' ' + dias(state.coupleBest || 0) + '</div>';
    }
    save();
  }

  function renderPerson(id, p, now) {
    var el = document.querySelector('.person[data-id="' + id + '"]');
    if (!el) return;
    var hist = '<button class="hist-link" data-act="hist">Histórico (' + p.records.length + ')</button>';
    if (p.status === "healthy") {
      var d = daysBetween(p.streakStart, now);
      el.className = "person";
      el.innerHTML =
        '<div class="name">' + esc(p.name) + '</div><span class="chip ok">saudável</span>' +
        '<div class="count num">' + d + '</div><div class="unit">' + dias(d) + ' sem doença</div>' +
        '<div class="rec">recorde: ' + (p.best || 0) + ' ' + dias(p.best || 0) + '</div>' +
        '<button class="btn danger" data-act="sick">Ficou doente 🤒</button>' + hist;
    } else {
      var sd = daysBetween(p.illness.startedAt, now);
      var note = p.illness.note ? " · " + esc(p.illness.note) : "";
      el.className = "person sick";
      el.innerHTML =
        '<div class="name">' + esc(p.name) + '</div><span class="chip bad">doente</span>' +
        '<div class="count num">' + sd + '</div><div class="unit">' + dias(sd) + ' doente</div>' +
        '<div class="ill"><b>' + esc(p.illness.name) + '</b>' + note + '</div>' +
        '<button class="btn ok" data-act="well">Sarou 🎉</button>' + hist;
    }
  }

  // ---------- modais ----------
  var sickModal = document.getElementById("sickModal");
  var wellModal = document.getElementById("wellModal");
  var histModal = document.getElementById("histModal");
  var menuModal = document.getElementById("menuModal");
  var pendingId = null;

  function openSick(id) {
    pendingId = id;
    document.getElementById("sickTitle").textContent = "Registrar doença — " + state.people[id].name;
    document.getElementById("sickName").value = "";
    document.getElementById("sickNote").value = "";
    document.getElementById("sickDate").value = tsToDateInput(Date.now());
    sickModal.classList.remove("hidden");
    setTimeout(function () { document.getElementById("sickName").focus(); }, 50);
  }
  function openWell(id) {
    pendingId = id;
    var p = state.people[id];
    document.getElementById("wellTitle").textContent = "Recuperação — " + p.name;
    document.getElementById("wellInfo").textContent = "Doença atual: " + p.illness.name + " (desde " + fmtDate(p.illness.startedAt) + ").";
    document.getElementById("wellDate").value = tsToDateInput(Date.now());
    wellModal.classList.remove("hidden");
  }
  function openHist(id) {
    pendingId = id;
    document.getElementById("histTitle").textContent = "Histórico — " + state.people[id].name;
    renderHistList(id);
    histModal.classList.remove("hidden");
  }
  function renderHistList(id) {
    var p = state.people[id], listEl = document.getElementById("histList");
    if (!p.records.length) { listEl.innerHTML = '<li class="empty">Nenhuma doença registrada ainda 🙌</li>'; return; }
    listEl.innerHTML = p.records.map(function (r, i) {
      var dur = daysBetween(r.startedAt, r.recoveredAt);
      var note = r.note ? " — " + esc(r.note) : "";
      return '<li><div class="info"><b>' + esc(r.name) + '</b>' + note +
        '<div class="d">' + fmtDate(r.startedAt) + " → " + fmtDate(r.recoveredAt) + " · " + dur + " " + dias(dur) + ' doente</div></div>' +
        '<button class="del" data-del="' + i + '" aria-label="Excluir">✕</button></li>';
    }).join("");
  }
  function closeModals() {
    [sickModal, wellModal, histModal, menuModal].forEach(function (m) { m.classList.add("hidden"); });
    pendingId = null;
  }

  document.querySelector(".people").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var id = e.target.closest("[data-id]").getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "sick") openSick(id); else if (act === "well") openWell(id); else if (act === "hist") openHist(id);
  });

  document.getElementById("sickConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var name = document.getElementById("sickName").value.trim();
    if (!name) { document.getElementById("sickName").focus(); return; }
    var p = state.people[pendingId];
    var startedAt = dateInputToTs(document.getElementById("sickDate").value);
    var streak = daysBetween(p.streakStart, startedAt);
    if (streak > (p.best || 0)) p.best = streak;
    p.status = "sick";
    p.illness = { name: name, note: document.getElementById("sickNote").value.trim(), startedAt: startedAt };
    closeModals(); render();
  });

  document.getElementById("wellConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var p = state.people[pendingId]; if (!p.illness) { closeModals(); return; }
    var rec = dateInputToTs(document.getElementById("wellDate").value);
    if (rec < p.illness.startedAt) rec = p.illness.startedAt;
    p.records.push({ name: p.illness.name, note: p.illness.note, startedAt: p.illness.startedAt, recoveredAt: rec });
    p.status = "healthy"; p.streakStart = rec; p.illness = null;
    closeModals(); render();
  });

  document.getElementById("histList").addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]"); if (!del || !pendingId) return;
    var i = +del.getAttribute("data-del"), p = state.people[pendingId];
    if (confirm('Excluir o registro de "' + p.records[i].name + '"?')) {
      p.records.splice(i, 1); save(); renderHistList(pendingId); render();
    }
  });

  // ---------- menu / backup ----------
  document.getElementById("menuBtn").addEventListener("click", function () { menuModal.classList.remove("hidden"); });

  document.getElementById("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dias-sem-doenca-backup-" + tsToDateInput(Date.now()) + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  });

  var importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", function () { importFile.click(); });
  importFile.addEventListener("change", function () {
    var f = importFile.files && importFile.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (!s || !s.people || !s.people.di || !s.people.tati) throw new Error("formato");
        if (typeof s.coupleBest !== "number") s.coupleBest = 0;
        state = s; save(); closeModals(); render();
        alert("Backup restaurado com sucesso! ✅");
      } catch (e) { alert("Não consegui ler esse arquivo. Escolha um backup válido (.json)."); }
      importFile.value = "";
    };
    reader.readAsText(f);
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("Apagar todo o histórico e zerar todos os contadores?")) {
      state = defaultState(); save(); closeModals(); render();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) { b.addEventListener("click", closeModals); });
  [sickModal, wellModal, histModal, menuModal].forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeModals(); });
  });

  // ---------- relógio: atualiza sozinho ----------
  render();
  setInterval(render, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });

  // ---------- service worker (offline) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
