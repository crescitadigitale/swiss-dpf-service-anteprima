/* SWISS DPF SERVICE — navigazione, moduli, diagnosi guidata, verifica MFK. Nessun cookie, nessun tracciamento. */
(function () {
  'use strict';

  var CFG = window.SDS_CONFIG || {};
  var I = window.SDS_I18N || {};          /* testi nella lingua della pagina (generati da tools/build.py) */
  function fmt(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o && k in o ? o[k] : m; }); }
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
        showStatus(status, 'err', I.form.check);
        return;
      }
      /* Antispam: campo trappola e tempo minimo di compilazione */
      if (form.elements['sito_web'].value || Date.now() - started() < 3000) {
        showStatus(status, 'err', I.form.spam);
        return;
      }
      if (!CFG.formEndpoint) {
        showStatus(status, 'err', I.form.off);
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      /* gruppi di caselle (data-join) uniti in un solo campo, es. servizi = "DPF/FAP, GPF/OPF" */
      form.querySelectorAll('input[type="checkbox"][data-join]').forEach(function (cb) {
        var h = form.elements[cb.getAttribute('data-join')];
        if (cb === form.querySelector('input[data-join="' + cb.getAttribute('data-join') + '"]')) h.value = '';
        if (cb.checked) h.value += (h.value ? ', ' : '') + cb.value;
      });
      var data = new FormData(form);
      data.delete('sito_web');
      fetch(CFG.formEndpoint, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          window.location.href = form.dataset.thanks || 'grazie/';
        })
        .catch(function () {
          btn.disabled = false;
          showStatus(status, 'err', I.form.fail);
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

  /* ---------- Modulo "richiedi la convenzione" (officine) ---------- */
  var pf = document.getElementById('partner-form');
  if (pf) {
    var t2 = Date.now();
    wireForm(pf, function () { return t2; });

    /* Ricerca facoltativa nel registro federale delle imprese (UID, servizio pubblico dell'Ufficio federale di statistica,
       comprende anche le ditte individuali): parte solo al clic su "Cerca" o con Invio, mai mentre si scrive. */
    var rQ = pf.elements['nome'], rBtn = document.getElementById('reg-btn'), rList = document.getElementById('reg-list'),
        rSt = document.getElementById('reg-status'), rLoad = document.getElementById('reg-loader'), rBox = document.getElementById('reg-box');
    var R = I.reg || {};
    var UIDWS = 'https://www.uid-wse.admin.ch/V5.0/PublicServices.svc', NS_ORG = 'http://www.ech.ch/xmlns/eCH-0108/5';
    var ECH97 = 'http://www.ech.ch/xmlns/eCH-0097/5', ECH98 = 'http://www.ech.ch/xmlns/eCH-0098/5';
    document.getElementById('reg-loading-text').textContent = R.busy || '';
    var setF = function (n, v) { if (pf.elements[n] && v) pf.elements[n].value = v; };
    var fmtUid = function (n) { return 'CHE-' + n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6); };
    var clean = function (v) { return (v || '').replace(/\bnull\b/gi, ' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^[,\s]+|[,\s]+$/g, ''); };
    var fold = function (v) { return (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    var xmlText = function (el, ns, tag) { var n = el.getElementsByTagNameNS(ns, tag)[0]; return n ? n.textContent.trim() : ''; };
    var esc = function (v) { return v.replace(/[<>&"']/g, ' '); };
    var token = 0;
    var closeList = function () { rList.hidden = true; rList.replaceChildren(); };
    var resetStatus = function () { rSt.className = 'form-status'; rSt.textContent = ''; };
    var busy = function (on) { rLoad.hidden = !on; rBox.classList.toggle('is-loading', on); rBtn.disabled = on; };

    function soap(action, body) {
      var ctl = window.AbortController ? new AbortController() : null;
      if (ctl) setTimeout(function () { ctl.abort(); }, 25000);
      return fetch(UIDWS, { method: 'POST', credentials: 'omit', signal: ctl ? ctl.signal : undefined,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '"http://www.uid.admin.ch/xmlns/uid-wse/IPublicServices/' + action + '"' },
        body: '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + body + '</s:Body></s:Envelope>' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
        .then(function (txt) { return new DOMParser().parseFromString(txt, 'text/xml'); });
    }

    /* un risultato: i dati stanno nell'elemento <organisation> (eCH-0108) con identificazione e indirizzo */
    function readOrg(org) {
      var id = org.getElementsByTagNameNS(ECH98, 'organisationIdentification')[0], ad = org.getElementsByTagNameNS(ECH98, 'address')[0];
      if (!id || !ad) return null;
      var num = xmlText(id, ECH97, 'uidOrganisationId'), cat = xmlText(id, ECH97, 'uidOrganisationIdCategorie');
      if (cat !== 'CHE' || !/^\d{9}$/.test(num)) return null;
      return { name: clean(xmlText(id, ECH97, 'organisationName')), alt: clean(xmlText(id, ECH97, 'organisationAdditionalName')),
               form: xmlText(id, ECH97, 'legalForm'), uid: fmtUid(num),
               street: clean(xmlText(ad, ECH98, 'street') + ' ' + xmlText(ad, ECH98, 'houseNumber')), zip: xmlText(ad, ECH98, 'swissZipCode'),
               town: clean(xmlText(ad, ECH98, 'town')), canton: xmlText(ad, ECH98, 'cantonAbbreviation'),
               liq: org.getElementsByTagNameNS(NS_ORG, 'liquidation').length > 0 };
    }

    function query(raw) {
      var uid = raw.match(/CHE\D*(\d{3})\D*(\d{3})\D*(\d{3})/i);
      if (uid) {
        return soap('GetByUID', '<GetByUID xmlns="http://www.uid.admin.ch/xmlns/uid-wse"><uid><uidOrganisationIdCategorie xmlns="' + ECH97 + '">CHE</uidOrganisationIdCategorie>' +
          '<uidOrganisationId xmlns="' + ECH97 + '">' + uid[1] + uid[2] + uid[3] + '</uidOrganisationId></uid></GetByUID>')
          .then(function (doc) { return [].slice.call(doc.getElementsByTagNameNS(NS_ORG, 'organisation')).map(readOrg).filter(Boolean); });
      }
      /* il servizio cerca parole intere e nell'ordine scritto: chiedo "*parola più lunga*" e filtro io tutte le parole, in qualsiasi ordine */
      var words = fold(raw).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 2; });
      var longest = words.slice().sort(function (a, b) { return b.length - a.length; })[0];
      var term = esc(raw.split(/\s+/).filter(function (w) { return fold(w).indexOf(longest) >= 0; })[0] || longest);
      return soap('Search', '<Search xmlns="http://www.uid.admin.ch/xmlns/uid-wse"><searchParameters><uidEntitySearchParameters xmlns="http://www.uid.admin.ch/xmlns/uid-wse/5">' +
        '<organisationName>*' + term + '*</organisationName><address><cantonAbbreviation>TI</cantonAbbreviation></address></uidEntitySearchParameters></searchParameters>' +
        '<config><searchMode xmlns="http://www.uid.admin.ch/xmlns/uid-wse-shared/2">Normal</searchMode><maxNumberOfRecords xmlns="http://www.uid.admin.ch/xmlns/uid-wse-shared/2">100</maxNumberOfRecords>' +
        '<searchNameAndAddressHistory xmlns="http://www.uid.admin.ch/xmlns/uid-wse-shared/2">false</searchNameAndAddressHistory></config></Search>')
        .then(function (doc) {
          return [].slice.call(doc.getElementsByTagNameNS('http://www.uid.admin.ch/xmlns/uid-wse/5', 'uidEntitySearchResultItem')).map(function (it) {
            return readOrg(it.getElementsByTagNameNS(NS_ORG, 'organisation')[0]);
          }).filter(Boolean).filter(function (o) {
            var hay = fold(o.name + ' ' + o.alt);
            return words.every(function (w) { return hay.indexOf(w) >= 0; });
          });
        });
    }

    var search = function (fromUid) {
      var raw = (fromUid === true ? pf.elements['uid'].value : rQ.value).trim();
      closeList();
      if (raw.length < 3) { showStatus(rSt, 'err', R.short); rQ.focus(); return; }
      resetStatus();
      var me = ++token, started = Date.now();
      busy(true);
      var done = function (fn) { setTimeout(function () { if (me !== token) return; busy(false); fn(); }, Math.max(0, 900 - (Date.now() - started))); };
      query(raw).then(function (rows) {
        var seen = {}, f0 = fold(raw);
        rows = rows.filter(function (o) { if (seen[o.uid] || o.liq || o.canton !== 'TI' || /liquidazione|liquidation|faillit|fallit/i.test(o.name)) return false; return (seen[o.uid] = true); })
          .sort(function (a, b) { var sa = fold(a.name).indexOf(f0) === 0 ? 0 : 1, sb = fold(b.name).indexOf(f0) === 0 ? 0 : 1; return sa - sb || a.name.localeCompare(b.name); });
        var total = rows.length; rows = rows.slice(0, 10);
        done(function () {
          if (!rows.length) { showStatus(rSt, 'err', R.none); return; }
          rSt.className = 'form-status reg-pick'; rSt.textContent = total > rows.length ? (R.more || '').replace('{n}', rows.length) : R.pick;
          rows.forEach(function (o) {
            var li = document.createElement('li'), bt = document.createElement('button'), nm = document.createElement('strong'),
                ad = document.createElement('span'), ui = document.createElement('small');
            bt.type = 'button';
            nm.textContent = o.name;
            if (o.alt) { var em = document.createElement('em'); em.textContent = ' · ' + o.alt; nm.appendChild(em); }
            ad.textContent = [o.street, (o.zip + ' ' + o.town).trim()].filter(Boolean).join(', ');
            ui.textContent = o.uid + ((R.forms || {})[o.form] ? ' · ' + R.forms[o.form] : '');
            bt.append(nm, ad, ui);
            bt.addEventListener('click', function () {
              setF('nome', o.name); setF('uid', o.uid); setF('indirizzo', o.street); setF('cap', o.zip); setF('comune', o.town);
              pf.elements['forma_giuridica'].value = ({ '0101': 'Ditta individuale', '0103': 'Società in nome collettivo', '0104': 'Società in accomandita',
                '0106': 'Società anonima (SA)', '0107': 'Società a garanzia limitata (Sagl)', '0108': 'Società cooperativa', '0109': 'Associazione', '0110': 'Fondazione' })[o.form] || '';
              pf.elements['insegna'].value = o.alt;
              closeList(); showStatus(rSt, 'ok', R.done);
              pf.elements[pf.elements['referente'].value ? 'telefono' : 'referente'].focus();
            });
            li.appendChild(bt); rList.appendChild(li);
          });
          var x = document.createElement('li'), xb = document.createElement('button');
          xb.type = 'button'; xb.className = 'reg-close'; xb.textContent = R.close || '×';
          xb.addEventListener('click', function () { closeList(); resetStatus(); });
          x.appendChild(xb); rList.appendChild(x);
          rList.hidden = false;
        });
      }).catch(function () { done(function () { showStatus(rSt, 'err', R.fail); }); });
    };
    rBtn.addEventListener('click', function () { search(); });
    rQ.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); search(); }
      if (e.key === 'Escape') { closeList(); resetStatus(); }
    });
    /* anche dal campo UID: Invio cerca per numero UID */
    pf.elements['uid'].addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); search(true); }
    });
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
    var G = I.guide;

    function picked(name) {
      var el = guide.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }
    function symptoms() {
      return Array.prototype.map.call(guide.querySelectorAll('input[name="segnali"]:checked'), function (el) { return el.value; });
    }
    /* testo visibile dell'opzione scelta (nella lingua della pagina): i value restano i codici italiani */
    function labelOf(el) { var s = el.nextElementSibling; return s ? s.textContent.trim() : el.value; }
    function pickedLabel(name) {
      var el = guide.querySelector('input[name="' + name + '"]:checked');
      return el ? labelOf(el) : '';
    }
    function symptomLabels() {
      return Array.prototype.map.call(guide.querySelectorAll('input[name="segnali"]:checked'), labelOf);
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
      if (v === 'officina') { key = 'partner'; tipo = 'Officina'; }
      else if (only) { key = 'dec'; }
      else if (v === 'benzina') { key = 'gpf'; }
      else { key = 'dpf'; if (v === 'flotta') tipo = 'Azienda'; }
      title = G[key].title; text = G[key].text;
      /* il value del campo "servizio" resta in italiano (codice); il messaggio precompilato è nella lingua della pagina */
      var servizio = { dpf: 'Rigenerazione DPF/FAP', gpf: 'Rigenerazione GPF/OPF', dec: 'Decarbonizzazione preventiva', partner: 'Programma officine partner' }[key];
      var msg = fmt(G.msgVehicle, { v: pickedLabel('veicolo') }) + (sx.length && v !== 'officina' ? ' ' + fmt(G.msgSymptoms, { s: symptomLabels().join(', ') }) : '') + ' ' + G.msgEnd;
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
      var M = I.mfk;
      if (!s) { res.head = M.enterHead; res.body = M.enterBody; }
      else if (fuel !== 'diesel') {
        res.head = M.fuelHead;
        res.body = M.fuelBody;
      } else {
        var m, n, suf, known = true;
        if (kind === 'auto') {
          m = /^B(\d{1,2})([A-Z]*)/.exec(s);
          if (!m) known = false; else { n = +m[1]; suf = m[2] || ''; hit = n >= 6 || (n === 5 && suf >= 'B' && suf.length > 0); if (n === 5 && !suf) known = false; }
        } else {
          m = /^E(\d{1,2})/.exec(s);
          if (!m) known = false; else { n = +m[1]; hit = n >= 6; }
        }
        if (!known) { res.head = M.unknownHead; res.body = fmt(M.unknownBody, { code: raw.replace(/[<>&"]/g, '') }); }
        else if (hit) { res.cls = 'warn'; res.head = M.warnHead; res.body = M.warnBody; }
        else { res.cls = 'ok'; res.head = M.okHead; res.body = M.okBody; }
      }
      var cta = '';
      if (res.cls === 'warn' || res.cls === 'ok') {
        var msg = fmt(M.msg, { code: raw.replace(/[<>&"]/g, '').slice(0, 20) });
        cta = '<p><a class="btn btn--sm" href="' + contactHref + '?tipo=Privato&servizio=Rigenerazione%20DPF%2FFAP&msg=' + encodeURIComponent(msg) + '#modulo">' + M.cta + '</a></p>';
      }
      out.className = 'tool-out ' + res.cls;
      out.innerHTML = '<strong>' + res.head + '</strong><p>' + res.body + '</p>' + cta + '<p class="sources">' + M.source + '</p>';
    });
  }
  /* ---------- Officine convenzionate: filtro e mappa (swisstopo, caricata solo dopo il clic) ---------- */
  var partnerList = document.querySelector('.partner-list');
  if (partnerList) {
    var items = Array.prototype.slice.call(partnerList.querySelectorAll('.partner'));
    var chips = document.querySelectorAll('.partner-filter .chip');
    var zonaAttiva = '';
    var map = null, markers = [];

    function applyFilter() {
      items.forEach(function (li) { li.hidden = !!zonaAttiva && li.getAttribute('data-zona') !== zonaAttiva; });
      markers.forEach(function (m) {
        var vis = !zonaAttiva || m.zona === zonaAttiva;
        if (vis) { m.marker.addTo(map); } else { map.removeLayer(m.marker); }
      });
      if (map && markers.length) { fitMap(); }
    }
    function fitMap() {
      var pts = markers.filter(function (m) { return !zonaAttiva || m.zona === zonaAttiva; })
        .map(function (m) { return m.marker.getLatLng(); });
      if (pts.length) { map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 14 }); }
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        zonaAttiva = chip.getAttribute('data-zona') || '';
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFilter();
      });
    });

    function loadCss(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
    var openBtn = document.getElementById('map-open');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        openBtn.disabled = true;
        openBtn.textContent = I.map.loading;
        var base = document.querySelector('script[src*="js/main.js"]').getAttribute('src').replace(/js\/main\.js.*$/, '');
        loadCss(base + 'vendor/leaflet/leaflet.css');
        var sc = document.createElement('script');
        sc.src = base + 'vendor/leaflet/leaflet.js';
        sc.onerror = function () { openBtn.disabled = false; openBtn.textContent = I.map.fail; };
        sc.onload = function () {
          var box = document.getElementById('map');
          box.hidden = false;
          document.querySelector('.map-gate').hidden = true;
          map = L.map(box, { scrollWheelZoom: false, zoomControl: false }).setView([46.1, 8.95], 9);
          L.control.zoom({ zoomInTitle: I.map.zoomIn, zoomOutTitle: I.map.zoomOut }).addTo(map);
          L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', {
            maxZoom: 18, minZoom: 8, attribution: '&copy; <a href="https://www.swisstopo.admin.ch" rel="noopener">swisstopo</a>'
          }).addTo(map);
          L.Icon.Default.imagePath = sc.src.replace(/leaflet\.js.*$/, 'images/');
          items.forEach(function (li) {
            var m = L.marker([parseFloat(li.getAttribute('data-lat')), parseFloat(li.getAttribute('data-lng'))], { title: li.getAttribute('data-nome') });
            var nomeEl = document.createElement('strong');
            nomeEl.textContent = li.getAttribute('data-nome');
            m.bindPopup(nomeEl);
            m.on('click', function () { li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); });
            markers.push({ marker: m, zona: li.getAttribute('data-zona') });
            m.addTo(map);
          });
          fitMap();
          applyFilter();
        };
        document.head.appendChild(sc);
      });
    }
  }
})();
