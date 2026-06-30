/* Dias sem Doença — contador offline para Di e Tati (+ contagem do casal).
   Tudo fica salvo localmente (localStorage), funciona sem internet. */

(function () {
  "use strict";

  var STORAGE_KEY = "ddsd_v2";
  var DAY = 86400000;

  // ---------- estado ----------
  function defaultState() {
    var now = Date.now();
    function person(name) {
      return {
        name: name,
        status: "healthy",     // "healthy" | "sick"
        streakStart: now,      // início da sequência saudável atual
        illness: null,         // { name, note, startedAt }
        records: [],           // histórico de doenças já recuperadas
        best: 0                // melhor sequência individual em dias
      };
    }
    return { people: { di: person("Di"), tati: person("Tati") }, coupleBest: 0 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      // migra da versão anterior, se existir
      if (!raw) { raw = localStorage.getItem("ddsd_v1"); }
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || !s.people || !s.people.di || !s.people.tati) return defaultState();
      if (typeof s.coupleBest !== "number") s.coupleBest = 0;
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var state = load();

  // ---------- datas ----------
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function daysBetween(fromTs, toTs) {
    return Math.max(0, Math.floor((startOfDay(toTs) - startOfDay(fromTs)) / DAY));
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function dateInputToTs(value) {
    if (!value) return Date.now();
    var p = value.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime();
  }
  function tsToDateInput(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- render ----------
  var coupleEl = document.getElementById("coupleCard");

  function render() {
    var now = Date.now();
    var di = state.people.di, tati = state.people.tati;

    // contadores individuais
    [["di", di], ["tati", tati]].forEach(function (pair) {
      var p = pair[1];
      if (p.status === "healthy") {
        var d = daysBetween(p.streakStart, now);
        if (d > (p.best || 0)) p.best = d;
      }
      renderPerson(pair[0], p, now);
    });

    // contador do casal: dias sem NINGUÉM doente
    var anySick = di.status === "sick" || tati.status === "sick";
    if (!anySick) {
      var coupleStart = Math.max(di.streakStart, tati.streakStart);
      var cd = daysBetween(coupleStart, now);
      if (cd > (state.coupleBest || 0)) state.coupleBest = cd;
      coupleEl.className = "couple";
      coupleEl.innerHTML =
        '<div class="ctitle">👫 Di &amp; Tati — juntos</div>' +
        '<div class="num">' + cd + '</div>' +
        '<div class="label">' + (cd === 1 ? "dia" : "dias") + ' sem ninguém doente</div>' +
        '<div class="chips"><span class="chip">recorde do casal: ' + (state.coupleBest || 0) + ' dias</span></div>';
    } else {
      var who = [];
      if (di.status === "sick") who.push("Di");
      if (tati.status === "sick") who.push("Tati");
      coupleEl.className = "couple alert";
      coupleEl.innerHTML =
        '<div class="ctitle">👫 Di &amp; Tati — juntos</div>' +
        '<div class="num">0</div>' +
        '<div class="label">' + who.join(" e ") + (who.length > 1 ? " estão" : " está") + ' doente 🤒</div>' +
        '<div class="chips"><span class="chip">recorde do casal: ' + (state.coupleBest || 0) + ' dias</span></div>';
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
        '<div class="head"><span class="name">' + escapeHtml(p.name) + '</span>' +
          '<span class="badge ok">saudável</span></div>' +
        '<div class="num">' + d + '</div>' +
        '<div class="label">' + (d === 1 ? "dia" : "dias") + ' sem doença</div>' +
        '<div class="meta">recorde: ' + (p.best || 0) + ' d</div>' +
        '<button class="btn danger" data-act="sick">Ficou doente 🤒</button>' +
        hist;
    } else {
      var sickDays = daysBetween(p.illness.startedAt, now);
      var note = p.illness.note ? " · " + escapeHtml(p.illness.note) : "";
      el.className = "person sick";
      el.innerHTML =
        '<div class="head"><span class="name">' + escapeHtml(p.name) + '</span>' +
          '<span class="badge bad">doente</span></div>' +
        '<div class="num">' + sickDays + '</div>' +
        '<div class="label">' + (sickDays === 1 ? "dia" : "dias") + ' doente</div>' +
        '<div class="ill"><b>' + escapeHtml(p.illness.name) + '</b>' + note + '</div>' +
        '<button class="btn ok" data-act="well">Sarou 🎉</button>' +
        hist;
    }
  }

  // ---------- modais ----------
  var sickModal = document.getElementById("sickModal");
  var wellModal = document.getElementById("wellModal");
  var histModal = document.getElementById("histModal");
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
    document.getElementById("wellInfo").textContent =
      "Doença atual: " + p.illness.name + " (desde " + fmtDate(p.illness.startedAt) + ").";
    document.getElementById("wellDate").value = tsToDateInput(Date.now());
    wellModal.classList.remove("hidden");
  }
  function openHist(id) {
    pendingId = id;
    var p = state.people[id];
    document.getElementById("histTitle").textContent = "Histórico — " + p.name;
    renderHistList(id);
    histModal.classList.remove("hidden");
  }
  function renderHistList(id) {
    var p = state.people[id];
    var listEl = document.getElementById("histList");
    if (!p.records.length) {
      listEl.innerHTML = '<li class="empty">Nenhuma doença registrada ainda 🙌</li>';
      return;
    }
    listEl.innerHTML = p.records.map(function (r, i) {
      var dur = daysBetween(r.startedAt, r.recoveredAt);
      var note = r.note ? ' — ' + escapeHtml(r.note) : "";
      return '<li><div class="info"><b>' + escapeHtml(r.name) + '</b>' + note +
        '<div class="d">' + fmtDate(r.startedAt) + " → " + fmtDate(r.recoveredAt) +
        " · " + dur + (dur === 1 ? " dia" : " dias") + ' doente</div></div>' +
        '<button class="del" data-del="' + i + '">✕</button></li>';
    }).join("");
  }
  function closeModals() {
    sickModal.classList.add("hidden");
    wellModal.classList.add("hidden");
    histModal.classList.add("hidden");
    pendingId = null;
  }

  // cliques nas pessoas
  document.querySelector(".people").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = e.target.closest("[data-id]").getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "sick") openSick(id);
    else if (act === "well") openWell(id);
    else if (act === "hist") openHist(id);
  });

  // confirmar doença
  document.getElementById("sickConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var name = document.getElementById("sickName").value.trim();
    if (!name) { document.getElementById("sickName").focus(); return; }
    var p = state.people[pendingId];
    var startedAt = dateInputToTs(document.getElementById("sickDate").value);
    var streakDays = daysBetween(p.streakStart, startedAt);
    if (streakDays > (p.best || 0)) p.best = streakDays;
    p.status = "sick";
    p.illness = { name: name, note: document.getElementById("sickNote").value.trim(), startedAt: startedAt };
    closeModals();
    render();
  });

  // confirmar recuperação
  document.getElementById("wellConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var p = state.people[pendingId];
    if (!p.illness) { closeModals(); return; }
    var recoveredAt = dateInputToTs(document.getElementById("wellDate").value);
    if (recoveredAt < p.illness.startedAt) recoveredAt = p.illness.startedAt;
    p.records.push({ name: p.illness.name, note: p.illness.note, startedAt: p.illness.startedAt, recoveredAt: recoveredAt });
    p.status = "healthy";
    p.streakStart = recoveredAt;
    p.illness = null;
    closeModals();
    render();
  });

  // excluir registro do histórico
  document.getElementById("histList").addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]");
    if (!del || !pendingId) return;
    var i = +del.getAttribute("data-del");
    var p = state.people[pendingId];
    if (confirm("Excluir o registro de \"" + p.records[i].name + "\"?")) {
      p.records.splice(i, 1);
      save();
      renderHistList(pendingId);
      render();
    }
  });

  // fechar modais
  Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) {
    b.addEventListener("click", closeModals);
  });
  [sickModal, wellModal, histModal].forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeModals(); });
  });

  // reiniciar tudo
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("Apagar todo o histórico e zerar todos os contadores?")) {
      state = defaultState();
      save();
      render();
    }
  });

  // ---------- relógio: atualiza sozinho ----------
  render();
  setInterval(render, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });

  // ---------- service worker (offline) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
