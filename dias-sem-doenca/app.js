/* Dias sem Doença — contador offline para Di e Tati.
   Tudo fica salvo localmente (localStorage), funciona sem internet. */

(function () {
  "use strict";

  var STORAGE_KEY = "ddsd_v1";
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
        best: 0                // melhor sequência em dias
      };
    }
    return { people: { di: person("Di"), tati: person("Tati") } };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || !s.people || !s.people.di || !s.people.tati) return defaultState();
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
  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  // dias completos entre dois instantes, contando por dia de calendário
  function daysBetween(fromTs, toTs) {
    var diff = startOfDay(toTs) - startOfDay(fromTs);
    return Math.max(0, Math.floor(diff / DAY));
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  // valor de <input type=date> -> timestamp (meio-dia local, evita fuso)
  function dateInputToTs(value) {
    if (!value) return Date.now();
    var p = value.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime();
  }
  function tsToDateInput(ts) {
    var d = new Date(ts);
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  // ---------- render ----------
  var cardsEl = document.getElementById("cards");

  function render() {
    var now = Date.now();
    var ids = Object.keys(state.people);
    var html = ids.map(function (id) {
      var p = state.people[id];
      if (p.status === "healthy") {
        var d = daysBetween(p.streakStart, now);
        if (d > (p.best || 0)) { p.best = d; }
        return healthyCard(id, p, d);
      }
      return sickCard(id, p, now);
    }).join("");
    cardsEl.innerHTML = html;
    save();
  }

  function historyHtml(p) {
    if (!p.records || !p.records.length) {
      return '<ul class="log"><li class="empty">Nenhuma doença registrada ainda 🙌</li></ul>';
    }
    var items = p.records.slice().reverse().map(function (r) {
      var sick = plural(daysBetween(r.startedAt, r.recoveredAt), "dia doente", "dias doente");
      var note = r.note ? ' — <span class="d">' + escapeHtml(r.note) + "</span>" : "";
      return '<li><b>' + escapeHtml(r.name) + "</b>" + note +
        '<div class="d">' + fmtDate(r.startedAt) + " → " + fmtDate(r.recoveredAt) +
        " · " + sick + "</div></li>";
    }).join("");
    return '<ul class="log">' + items + "</ul>";
  }

  function healthyCard(id, p, d) {
    var last = p.records.length ? p.records[p.records.length - 1] : null;
    var lastChip = last
      ? '<span class="chip">última: <b>' + escapeHtml(last.name) + "</b></span>"
      : "";
    return '' +
      '<section class="card" data-id="' + id + '">' +
        '<div class="head"><span class="name">' + escapeHtml(p.name) + '</span>' +
          '<span class="badge ok">saudável ✓</span></div>' +
        '<div class="counter"><div class="num">' + d + '</div>' +
          '<div class="label">' + (d === 1 ? "dia" : "dias") + ' sem doença</div></div>' +
        '<div class="meta">' +
          '<span class="chip">desde <b>' + fmtDate(p.streakStart) + "</b></span>" +
          '<span class="chip">recorde: <b>' + (p.best || 0) + " dias</b></span>" +
          lastChip +
        "</div>" +
        '<div class="actions"><button class="btn danger" data-act="sick">Registrar doença 🤒</button></div>' +
        '<details class="history"><summary>Histórico (' + p.records.length + ')</summary>' +
          historyHtml(p) + "</details>" +
      "</section>";
  }

  function sickCard(id, p, now) {
    var sickDays = daysBetween(p.illness.startedAt, now);
    var noteHtml = p.illness.note ? "<br><span>" + escapeHtml(p.illness.note) + "</span>" : "";
    return '' +
      '<section class="card sick" data-id="' + id + '">' +
        '<div class="head"><span class="name">' + escapeHtml(p.name) + '</span>' +
          '<span class="badge bad">doente 🤒</span></div>' +
        '<div class="counter"><div class="num">' + sickDays + '</div>' +
          '<div class="label">' + (sickDays === 1 ? "dia" : "dias") + ' doente</div></div>' +
        '<div class="illness-box">Doença: <b>' + escapeHtml(p.illness.name) + "</b>" +
          " <span class=\"d\">(desde " + fmtDate(p.illness.startedAt) + ")</span>" + noteHtml + "</div>" +
        '<div class="actions"><button class="btn ok" data-act="well">Marcar recuperação 🎉</button></div>' +
        '<details class="history"><summary>Histórico (' + p.records.length + ')</summary>' +
          historyHtml(p) + "</details>" +
      "</section>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- modais ----------
  var sickModal = document.getElementById("sickModal");
  var wellModal = document.getElementById("wellModal");
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

  function closeModals() {
    sickModal.classList.add("hidden");
    wellModal.classList.add("hidden");
    pendingId = null;
  }

  // ações
  cardsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var card = e.target.closest("[data-id]");
    var id = card.getAttribute("data-id");
    if (btn.getAttribute("data-act") === "sick") openSick(id);
    else if (btn.getAttribute("data-act") === "well") openWell(id);
  });

  document.getElementById("sickConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var name = document.getElementById("sickName").value.trim();
    if (!name) { document.getElementById("sickName").focus(); return; }
    var p = state.people[pendingId];
    var startedAt = dateInputToTs(document.getElementById("sickDate").value);
    // fecha a sequência saudável (já contabilizada no recorde via render)
    var streakDays = daysBetween(p.streakStart, startedAt);
    if (streakDays > (p.best || 0)) p.best = streakDays;
    p.status = "sick";
    p.illness = {
      name: name,
      note: document.getElementById("sickNote").value.trim(),
      startedAt: startedAt
    };
    closeModals();
    render();
  });

  document.getElementById("wellConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var p = state.people[pendingId];
    if (!p.illness) { closeModals(); return; }
    var recoveredAt = dateInputToTs(document.getElementById("wellDate").value);
    if (recoveredAt < p.illness.startedAt) recoveredAt = p.illness.startedAt;
    p.records.push({
      name: p.illness.name,
      note: p.illness.note,
      startedAt: p.illness.startedAt,
      recoveredAt: recoveredAt
    });
    // recomeça a contagem de dias sem doença a partir da recuperação
    p.status = "healthy";
    p.streakStart = recoveredAt;
    p.illness = null;
    closeModals();
    render();
  });

  // fechar modais
  Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) {
    b.addEventListener("click", closeModals);
  });
  [sickModal, wellModal].forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeModals(); });
  });

  // reiniciar tudo
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("Apagar todo o histórico e zerar os contadores de Di e Tati?")) {
      state = defaultState();
      save();
      render();
    }
  });

  // ---------- relógio: atualiza sozinho ----------
  render();
  setInterval(render, 30000);                 // recalcula a cada 30s
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) render();           // ao reabrir o app
  });

  // ---------- service worker (offline) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
