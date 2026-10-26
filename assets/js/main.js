/* SWISS DPF SERVICE — navigazione e modulo contatti. Nessun cookie, nessun tracciamento. */
(function () {
  'use strict';

  var CFG = window.SDS_CONFIG || {};

  /* Menu mobile e sottomenu */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  var subBtn = document.querySelector('.has-sub > button');
  var sub = document.querySelector('.sub');
  if (subBtn && sub) {
    subBtn.addEventListener('click', function () {
      var open = sub.classList.toggle('open');
      subBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!subBtn.parentNode.contains(e.target)) {
        sub.classList.remove('open');
        subBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        sub.classList.remove('open');
        subBtn.setAttribute('aria-expanded', 'false');
        if (nav) { nav.classList.remove('open'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
      }
    });
  }

  /* Modulo richieste */
  var form = document.getElementById('request-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var typeSel = form.elements['tipo'];
  var bizField = document.getElementById('field-attivita');
  var started = Date.now();

  function syncType() {
    var t = typeSel.value;
    bizField.hidden = !(t === 'Azienda' || t === 'Officina');
  }
  typeSel.addEventListener('change', syncType);

  /* Precompilazione da link (?tipo=...&servizio=...) e da pulsanti data-service */
  var params = new URLSearchParams(location.search);
  if (params.get('tipo')) typeSel.value = params.get('tipo');
  if (params.get('servizio')) form.elements['servizio'].value = params.get('servizio');
  if (form.dataset.preset) typeSel.value = form.dataset.preset;
  syncType();

  document.querySelectorAll('[data-service]').forEach(function (a) {
    a.addEventListener('click', function () {
      form.elements['servizio'].value = a.getAttribute('data-service');
      if (a.getAttribute('data-tipo')) { typeSel.value = a.getAttribute('data-tipo'); syncType(); }
    });
  });

  function showStatus(kind, html) {
    status.className = 'form-status ' + kind;
    status.innerHTML = html;
    status.setAttribute('tabindex', '-1');
    status.focus();
  }

  function validate() {
    var ok = true;
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });
    form.querySelectorAll('[required]').forEach(function (el) {
      var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
      if (el.type === 'email' && el.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim())) bad = true;
      if (el.closest('[hidden]')) bad = false;
      if (bad) { ok = false; var f = el.closest('.field'); if (f) f.classList.add('invalid'); }
    });
    if (!ok) {
      var first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea');
      if (first) first.focus();
    }
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.className = 'form-status';
    if (!validate()) {
      showStatus('err', 'Controlla i campi evidenziati e riprova.');
      return;
    }
    /* Antispam: campo trappola e tempo minimo di compilazione */
    if (form.elements['sito_web'].value || Date.now() - started < 3000) {
      showStatus('err', 'Invio non riuscito. Riprova tra qualche secondo oppure chiamaci al <a href="tel:+41762925822">076 292 58 22</a>.');
      return;
    }
    if (!CFG.formEndpoint) {
      showStatus('err', 'Il modulo online non è ancora attivo. Per la tua richiesta chiamaci al <a href="tel:+41762925822">076 292 58 22</a> o scrivi a <a href="mailto:contatti@swissdpfservice.ch">contatti@swissdpfservice.ch</a>.');
      return;
    }
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    var data = new FormData(form);
    data.delete('sito_web');
    fetch(CFG.formEndpoint, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.href = form.dataset.thanks || 'grazie/';
      })
      .catch(function () {
        btn.disabled = false;
        showStatus('err', 'Non è stato possibile inviare la richiesta. Riprova oppure chiamaci al <a href="tel:+41762925822">076 292 58 22</a> o scrivi a <a href="mailto:contatti@swissdpfservice.ch">contatti@swissdpfservice.ch</a>.');
      });
  });
})();
