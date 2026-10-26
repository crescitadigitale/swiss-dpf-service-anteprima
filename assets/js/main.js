/* SWISS DPF SERVICE — navigazione, moduli, diagnosi guidata, verifica MFK. Nessun cookie, nessun tracciamento. */
(function () {
  'use strict';

  var CFG = window.SDS_CONFIG || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- Menu mobile e sottomenu ---------- */
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

  /* ---------- Comparsa allo scorrimento (disattivata con movimento ridotto) ---------- */
  (function () {
    var targets = document.querySelectorAll('.card, .steps li, .section-head, .callout, .diagram, .guide, .tool, .faq details');
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--d', (i % 4) * 70 + 'ms');
      io.observe(el);
    });
  })();

  /* ---------- Utilità moduli ---------- */
  function showStatus(status, kind, html) {
    status.className = 'form-status ' + kind;
    status.innerHTML = html;
    status.setAttribute('tabindex', '-1');
    status.focus();
  }

  function validate(form) {
    var ok = true;
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });
    form.querySelectorAll('[required]').forEach(function (el) {
      var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
      if (el.type === 'email' && el.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim())) bad = true;
      if (el.type === 'tel' && el.value.trim() && !/^[+()\d][\d\s().\/-]{5,}$/.test(el.value.trim())) bad = true;
      if (el.closest('[hidden]')) bad = false;
      if (bad) { ok = false; var f = el.closest('.field'); if (f) f.classList.add('invalid'); }
    });
    if (!ok) {
      var first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea');
      if (first) first.focus();
    }
    return ok;
  }

  function wireForm(form, started) {
    var status = form.querySelector('.form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      if (!validate(form)) {
        showStatus(status, 'err', 'Controlla i campi evidenziati e riprova.');
        return;
      }
      /* Antispam: campo trappola e tempo minimo di compilazione */
      if (form.elements['sito_web'].value || Date.now() - started() < 3000) {
        showStatus(status, 'err', 'Invio non riuscito. Riprova tra qualche secondo oppure chiamaci al <a href="tel:+41762925822">076 292 58 22</a>.');
        return;
      }
      if (!CFG.formEndpoint) {
        showStatus(status, 'err', 'Il modulo online non è ancora attivo. Per la tua richiesta chiamaci al <a href="tel:+41762925822">076 292 58 22</a> o scrivi a <a href="mailto:contatti@swissdpfservice.ch">contatti@swissdpfservice.ch</a>.');
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
          showStatus(status, 'err', 'Non è stato possibile inviare la richiesta. Riprova oppure chiamaci al <a href="tel:+41762925822">076 292 58 22</a> o scrivi a <a href="mailto:contatti@swissdpfservice.ch">contatti@swissdpfservice.ch</a>.');
        });
    });
  }

  /* ---------- Modulo richieste completo ---------- */
  var form = document.getElementById('request-form');
  if (form) {
    var t0 = Date.now();
    var typeSel = form.elements['tipo'];
    var bizField = document.getElementById('field-attivita');
    var syncType = function () { bizField.hidden = !(typeSel.value === 'Azienda' || typeSel.value === 'Officina'); };
    typeSel.addEventListener('change', syncType);

    /* Precompilazione da link (?tipo=&servizio=&msg=) e da pulsanti data-service */
    var params = new URLSearchParams(location.search);
    if (params.get('tipo')) typeSel.value = params.get('tipo');
    if (params.get('servizio')) form.elements['servizio'].value = params.get('servizio');
    if (params.get('msg')) form.elements['messaggio'].value = params.get('msg').slice(0, 600);
    if (form.dataset.preset) typeSel.value = form.dataset.preset;
    syncType();

    document.querySelectorAll('[data-service]').forEach(function (a) {
      a.addEventListener('click', function () {
        form.elements['servizio'].value = a.getAttribute('data-service');
        if (a.getAttribute('data-tipo')) { typeSel.value = a.getAttribute('data-tipo'); syncType(); }
      });
    });
    wireForm(form, function () { return t0; });
  }

  /* ---------- Modulo "ti richiamiamo" ---------- */
  var cb = document.getElementById('callback-form');
  if (cb) { var t1 = Date.now(); wireForm(cb, function () { return t1; }); }

  /* ---------- Diagnosi guidata ---------- */
  var guide = document.getElementById('guide');
  if (guide) {
    guide.hidden = false;
    var steps = guide.querySelectorAll('.guide-step');
    var bar = guide.querySelector('.guide-bar');
    var back = guide.querySelector('[data-guide-back]');
    var next = guide.querySelector('[data-guide-next]');
    var result = guide.querySelector('.guide-result');
    var cur = 0;
    var VEH = { diesel: 'Auto o furgone diesel', benzina: 'Auto o furgone a benzina con filtro', flotta: 'Veicoli aziendali / flotta', officina: 'Sono un\'officina' };

    function picked(name) {
      var el = guide.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }
    function symptoms() {
      return Array.prototype.map.call(guide.querySelectorAll('input[name="segnali"]:checked'), function (el) { return el.value; });
    }
    function render(moveFocus) {
      steps.forEach(function (s, i) { s.hidden = i !== cur; });
      result.hidden = cur !== 2;
      bar.style.width = ((cur + 1) / 3 * 100) + '%';
      back.hidden = cur === 0;
      next.hidden = cur === 2;
      next.disabled = cur === 0 ? !picked('veicolo') : false;
      var target = cur === 2 ? result.querySelector('h3') : steps[cur].querySelector('legend');
      if (moveFocus && target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }
    function buildResult() {
      var v = picked('veicolo'), sx = symptoms();
      var only = sx.length === 1 && sx[0] === 'Nessun sintomo, voglio prevenire';
      var key = 'dpf', title, text, tipo = 'Privato';
      if (v === 'officina') { key = 'partner'; tipo = 'Officina'; title = 'Programma officine partner'; text = 'Per le officine c\'è un canale dedicato: ti spieghiamo il programma e valutiamo insieme la collaborazione.'; }
      else if (only) { key = 'dec'; title = 'Decarbonizzazione preventiva'; text = 'Se non noti sintomi e vuoi prevenire, il servizio da valutare è la decarbonizzazione preventiva. Ti diciamo se ha senso per il tuo veicolo.'; }
      else if (v === 'benzina') { key = 'gpf'; title = 'Rigenerazione GPF/OPF'; text = 'Per un benzina con filtro antiparticolato il servizio da valutare è la rigenerazione GPF/OPF, previa verifica dell\'idoneità.'; }
      else { key = 'dpf'; title = 'Rigenerazione DPF/FAP'; text = 'Il servizio da valutare è la rigenerazione DPF/FAP, previa verifica dell\'idoneità del filtro.'; if (v === 'flotta') tipo = 'Azienda'; }
      var servizio = { dpf: 'Rigenerazione DPF/FAP', gpf: 'Rigenerazione GPF/OPF', dec: 'Decarbonizzazione preventiva', partner: 'Programma officine partner' }[key];
      var msg = 'Veicolo: ' + (VEH[v] || '') + '.' + (sx.length && v !== 'officina' ? ' Segnali: ' + sx.join(', ') + '.' : '') + ' Vorrei una valutazione.';
      var contact = guide.getAttribute('data-contact') + '?tipo=' + encodeURIComponent(tipo) + '&servizio=' + encodeURIComponent(servizio) + '&msg=' + encodeURIComponent(msg) + '#modulo';
      result.querySelector('h3').textContent = title;
      result.querySelector('.guide-text').textContent = text;
      result.querySelector('[data-guide-cta]').setAttribute('href', contact);
      result.querySelector('[data-guide-more]').setAttribute('href', guide.getAttribute('data-' + key));
      result.querySelector('[data-guide-mfk]').hidden = sx.indexOf('Controllo MFK in arrivo') === -1 || v === 'benzina' || v === 'officina';
    }
    guide.addEventListener('change', function () { if (cur === 0) next.disabled = !picked('veicolo'); });
    next.addEventListener('click', function () {
      if (cur === 0 && picked('veicolo') === 'officina') { cur = 2; buildResult(); render(true); return; }
      if (cur === 1) buildResult();
      cur = Math.min(2, cur + 1); render(true);
    });
    back.addEventListener('click', function () {
      cur = (cur === 2 && picked('veicolo') === 'officina') ? 0 : Math.max(0, cur - 1); render(true);
    });
    guide.querySelector('[data-guide-reset]').addEventListener('click', function () {
      guide.querySelectorAll('input').forEach(function (i) { i.checked = false; });
      cur = 0; render(true);
    });
    render();
  }

  /* ---------- Verifica MFK ---------- */
  var tool = document.getElementById('mfk-tool');
  if (tool) {
    tool.hidden = false;
    var out = tool.querySelector('.tool-out');
    var contactHref = tool.getAttribute('data-contact');
    tool.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, kind = f.elements['mezzo'].value, fuel = f.elements['alim'].value;
      var raw = f.elements['codice'].value, s = raw.toUpperCase().replace(/[\s._\-]/g, '');
      var res = { cls: 'info', head: '', body: '' }, hit = false;
      if (!s) { res.head = 'Inserisci il codice'; res.body = 'Lo trovi nel libretto di circolazione, al campo 72 (per esempio B6 o E06).'; }
      else if (fuel !== 'diesel') {
        res.head = 'Il controllo riguarda i diesel';
        res.body = 'Il controllo con misura delle particelle introdotto nel 2023 riguarda i veicoli diesel con filtro antiparticolato. Per gli altri veicoli non abbiamo informazioni verificate: chiedi pure a noi.';
      } else {
        var m, n, suf, known = true;
        if (kind === 'auto') {
          m = /^B(\d{1,2})([A-Z]*)/.exec(s);
          if (!m) known = false; else { n = +m[1]; suf = m[2] || ''; hit = n >= 6 || (n === 5 && suf >= 'B' && suf.length > 0); if (n === 5 && !suf) known = false; }
        } else {
          m = /^E(\d{1,2})/.exec(s);
          if (!m) known = false; else { n = +m[1]; hit = n >= 6; }
        }
        if (!known) { res.head = 'Codice non riconosciuto'; res.body = 'Non riesco a interpretare «' + raw.replace(/[<>&"]/g, '') + '». Controlla il campo 72 del libretto, oppure scrivici il codice e ti rispondiamo.'; }
        else if (hit) { res.cls = 'warn'; res.head = 'Probabilmente rientri nel controllo'; res.body = 'Un diesel con questo codice emissioni è tra quelli per cui la MFK verifica il filtro antiparticolato (limite 250\'000 particelle/cm³). Se hai un controllo in arrivo o noti sintomi, fai valutare il filtro.'; }
        else { res.cls = 'ok'; res.head = 'Probabilmente non rientri'; res.body = 'Con questo codice emissioni il veicolo non risulta tra quelli interessati al controllo del filtro. Se noti sintomi, il filtro può comunque essere valutato.'; }
      }
      var cta = '';
      if (res.cls === 'warn' || res.cls === 'ok') {
        var msg = 'Verifica MFK: codice emissioni ' + raw.replace(/[<>&"]/g, '').slice(0, 20) + '. Vorrei una valutazione del filtro.';
        cta = '<p><a class="btn btn--sm" href="' + contactHref + '?tipo=Privato&servizio=Rigenerazione%20DPF%2FFAP&msg=' + encodeURIComponent(msg) + '#modulo">Richiedi una valutazione</a></p>';
      }
      out.className = 'tool-out ' + res.cls;
      out.innerHTML = '<strong>' + res.head + '</strong><p>' + res.body + '</p>' + cta + '<p class="sources">Indicazione di massima basata sulle informazioni AGVS (2023). Vale il controllo ufficiale dell\'autorità cantonale.</p>';
    });
  }
})();
