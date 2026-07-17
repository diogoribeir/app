/* Dias sem Doença — Di & Tati.
   Sincronização igual aos outros apps: Realtime Database do casal (REST),
   gaveta planos/dias-sem-doenca-dt2026 — SEM login. localStorage é a cópia
   offline (e a origem da migração: a 1ª abertura sobe os dados atuais). */

(function () {
  "use strict";

  var STORAGE_KEY = "ddsd_v2";
  var SYNC_URL = "https://apps-4b887-default-rtdb.firebaseio.com/planos/dias-sem-doenca-dt2026";
  var DAY = 86400000;

  // ---------- estado ----------
  function defaultState() {
    var now = Date.now();
    function person(name) {
      return { name: name, status: "healthy", streakStart: now, illness: null, records: [], best: 0 };
    }
    return { people: { di: person("Di"), tati: person("Tati") }, coupleBest: 0 };
  }
  function valid(s) { return s && s.people && s.people.di && s.people.tati; }
  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("ddsd_v1");
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!valid(s)) return defaultState();
      if (typeof s.coupleBest !== "number") s.coupleBest = 0;
      return s;
    } catch (e) { return defaultState(); }
  }
  function writeLocal() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }

  var state = readLocal();
  var cloudOK = false;
  var syncStamp = 0;

  // grava local + nuvem
  function commit() {
    writeLocal();
    fetch(SYNC_URL + "/state.json", { method: "PUT", body: JSON.stringify(state) })
      .then(function () {
        cloudOK = true; syncStamp = Date.now();
        fetch(SYNC_URL + "/_at.json", { method: "PUT", body: JSON.stringify(syncStamp) }).catch(function(){});
        setStatus();
      })
      .catch(function () { cloudOK = false; setStatus(); });
  }
  function boot() {
    fetch(SYNC_URL + "/state.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        cloudOK = true;
        if (valid(v)) {
          state = v;
          if (typeof state.coupleBest !== "number") state.coupleBest = 0;
          writeLocal();
        } else {
          commit();                      // 1ª vez: sobe os dados deste aparelho
        }
        render();
      })
      .catch(function () { cloudOK = false; setStatus(); });
    fetch(SYNC_URL + "/_at.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (v) { if (typeof v === "number") syncStamp = v; }).catch(function(){});
  }
  function setStatus() {
    var el = document.getElementById("statusTag");
    if (!el) return;
    if (cloudOK) { el.textContent = "sincronizado ✓"; el.className = "tag"; }
    else { el.textContent = "offline — salva no aparelho"; el.className = "tag warn"; }
  }

  // ---------- datas / util ----------
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
    writeLocal();
    setStatus();
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
        '<div class="ill"><b>' + esc(p.illness.name) + '</b>' + note +
          ' <button class="fixlink" data-act="fixill">corrigir ✏️</button></div>' +
        '<button class="btn ok" data-act="well">Sarou 🎉</button>' + hist;
    }
  }

  // ---------- modais ----------
  var sickModal = document.getElementById("sickModal");
  var wellModal = document.getElementById("wellModal");
  var histModal = document.getElementById("histModal");
  var menuModal = document.getElementById("menuModal");
  var histEditModal = document.getElementById("histEditModal");
  var pendingId = null;
  var fixingIllness = false;   // sickModal em modo correção (não zera nada)
  var editRecIdx = null;       // índice do registro do histórico em edição

  function openSick(id, fix) {
    pendingId = id;
    fixingIllness = !!fix;
    var p = state.people[id];
    document.getElementById("sickTitle").textContent =
      (fix ? "Corrigir doença — " : "Registrar doença — ") + p.name;
    document.getElementById("sickConfirm").textContent = fix ? "Salvar correção" : "Marcar como doente";
    document.getElementById("sickName").value = fix ? p.illness.name : "";
    document.getElementById("sickNote").value = fix ? (p.illness.note || "") : "";
    document.getElementById("sickDate").value = tsToDateInput(fix ? p.illness.startedAt : Date.now());
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
        '<button class="edit" data-editrec="' + i + '" aria-label="Editar">✏️</button>' +
        '<button class="del" data-del="' + i + '" aria-label="Excluir">✕</button></li>';
    }).join("");
  }
  function openHistEdit(i) {
    editRecIdx = i;
    var r = state.people[pendingId].records[i];
    document.getElementById("heName").value = r.name;
    document.getElementById("heNote").value = r.note || "";
    document.getElementById("heStart").value = tsToDateInput(r.startedAt);
    document.getElementById("heEnd").value = tsToDateInput(r.recoveredAt);
    histModal.classList.add("hidden");
    histEditModal.classList.remove("hidden");
  }
  function closeModals() {
    Array.prototype.forEach.call(document.querySelectorAll(".modal"), function (m) { m.classList.add("hidden"); });
    pendingId = null; fixingIllness = false; editRecIdx = null;
  }

  document.querySelector(".people").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var id = e.target.closest("[data-id]").getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "sick") openSick(id, false);
    else if (act === "fixill") openSick(id, true);
    else if (act === "well") openWell(id);
    else if (act === "hist") openHist(id);
  });

  document.getElementById("sickConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var name = document.getElementById("sickName").value.trim();
    if (!name) { document.getElementById("sickName").focus(); return; }
    var p = state.people[pendingId];
    var startedAt = dateInputToTs(document.getElementById("sickDate").value);
    if (fixingIllness && p.illness) {
      // só corrige os dados da doença atual — não mexe em contador nem histórico
      p.illness.name = name;
      p.illness.note = document.getElementById("sickNote").value.trim();
      p.illness.startedAt = startedAt;
    } else {
      var streak = daysBetween(p.streakStart, startedAt);
      if (streak > (p.best || 0)) p.best = streak;
      p.status = "sick";
      p.illness = { name: name, note: document.getElementById("sickNote").value.trim(), startedAt: startedAt };
    }
    closeModals(); render(); commit();
  });

  document.getElementById("wellConfirm").addEventListener("click", function () {
    if (!pendingId) return;
    var p = state.people[pendingId]; if (!p.illness) { closeModals(); return; }
    var rec = dateInputToTs(document.getElementById("wellDate").value);
    if (rec < p.illness.startedAt) rec = p.illness.startedAt;
    p.records.push({ name: p.illness.name, note: p.illness.note, startedAt: p.illness.startedAt, recoveredAt: rec });
    p.status = "healthy"; p.streakStart = rec; p.illness = null;
    closeModals(); render(); commit();
  });

  // histórico: editar / excluir
  document.getElementById("histList").addEventListener("click", function (e) {
    var ed = e.target.closest("[data-editrec]");
    if (ed && pendingId) { openHistEdit(+ed.getAttribute("data-editrec")); return; }
    var del = e.target.closest("[data-del]"); if (!del || !pendingId) return;
    var i = +del.getAttribute("data-del"), p = state.people[pendingId];
    if (confirm('Excluir o registro de "' + p.records[i].name + '"?')) {
      p.records.splice(i, 1); renderHistList(pendingId); render(); commit();
    }
  });

  document.getElementById("heSave").addEventListener("click", function () {
    if (pendingId == null || editRecIdx == null) { closeModals(); return; }
    var name = document.getElementById("heName").value.trim();
    if (!name) { document.getElementById("heName").focus(); return; }
    var r = state.people[pendingId].records[editRecIdx];
    r.name = name;
    r.note = document.getElementById("heNote").value.trim();
    r.startedAt = dateInputToTs(document.getElementById("heStart").value);
    r.recoveredAt = dateInputToTs(document.getElementById("heEnd").value);
    if (r.recoveredAt < r.startedAt) r.recoveredAt = r.startedAt;
    var keep = pendingId;
    histEditModal.classList.add("hidden");
    editRecIdx = null;
    render(); commit();
    openHist(keep);   // volta pro histórico atualizado
  });

  // ---------- menu / compartilhar / backup ----------
  document.getElementById("menuBtn").addEventListener("click", function () { menuModal.classList.remove("hidden"); });

  function personLine(p, now) {
    if (p.status === "healthy") {
      var d = daysBetween(p.streakStart, now);
      return "• " + p.name + ": " + d + " " + dias(d) + " sem doença";
    }
    var sd = daysBetween(p.illness.startedAt, now);
    return "• " + p.name + ": doente 🤒 " + p.illness.name + " — " + sd + " " + dias(sd);
  }
  function summaryText() {
    var now = Date.now(), di = state.people.di, tati = state.people.tati, couple;
    if (di.status === "sick" || tati.status === "sick") {
      var who = [];
      if (di.status === "sick") who.push("Di");
      if (tati.status === "sick") who.push("Tati");
      couple = "👫 Casal: " + who.join(" e ") + (who.length > 1 ? " doentes 🤒" : " doente 🤒");
    } else {
      var cd = daysBetween(Math.max(di.streakStart, tati.streakStart), now);
      couple = "👫 Casal: " + cd + " " + dias(cd) + " sem ninguém doente (recorde " + (state.coupleBest || 0) + ")";
    }
    return "🩺 Dias sem Doença — " + fmtDate(now) + "\n" + couple + "\n" + personLine(di, now) + "\n" + personLine(tati, now);
  }
  var shareModal = document.getElementById("shareModal");
  document.getElementById("shareBtn").addEventListener("click", function () {
    var text = summaryText();
    if (navigator.share) {
      navigator.share({ title: "Dias sem Doença", text: text }).then(function () { closeModals(); })
        .catch(function () { openShareModal(text); });
    } else { openShareModal(text); }
  });
  function openShareModal(text) {
    menuModal.classList.add("hidden");
    document.getElementById("shareText").value = text;
    shareModal.classList.remove("hidden");
  }
  document.getElementById("shareCopy").addEventListener("click", function () {
    var ta = document.getElementById("shareText"), btn = this;
    function done() { btn.textContent = "Copiado ✓"; setTimeout(function () { btn.textContent = "Copiar"; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(done).catch(function () { ta.focus(); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} });
    } else { ta.focus(); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} }
  });

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
        if (!valid(s)) throw new Error("formato");
        if (typeof s.coupleBest !== "number") s.coupleBest = 0;
        state = s; closeModals(); render(); commit();
        alert("Backup restaurado com sucesso! ✅");
      } catch (e) { alert("Não consegui ler esse arquivo. Escolha um backup válido (.json)."); }
      importFile.value = "";
    };
    reader.readAsText(f);
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("Apagar todo o histórico e zerar todos os contadores?")) {
      state = defaultState(); closeModals(); render(); commit();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) { b.addEventListener("click", closeModals); });
  Array.prototype.forEach.call(document.querySelectorAll(".modal"), function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeModals(); });
  });

  // ---------- relógio + volta pro app ----------
  render();
  setInterval(render, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    render();
    fetch(SYNC_URL + "/_at.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (v) { if (typeof v === "number" && v > syncStamp + 1500) location.reload(); })
      .catch(function(){});
  });

  // ---------- service worker (offline) ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  boot();
})();
