/* Presença Plenária nos tablets (ES5)
   Quando o operador clica em "Presença Plenária" no notebook (legislar/painel/tela = presenca_plenaria.html),
   todos os tablets mostram, em tela cheia, a Presença Plenária com os 9 vereadores e o botão
   "Registrar presença". Quando o notebook sai da Presença, os tablets voltam ao painel.
   Só funciona nos tablets/celulares: Smart TV, notebook e a página presenca_plenaria.html não são alterados.
   Lê legislar/painel/tela, legislar/presenca/(vereadores, sessao/atual, config/camara) e
   legislar/votacao/aparelhos + config/ensaio (para saber de quem é o tablet).
   Grava SOMENTE legislar/presenca/vereadores/{id} = {status:'presente', atualizadoEm} — nunca marca ausente —
   e legislar/presenca/bip = {em, n} a cada toque (a Smart TV toca o bip junto). */
(function () {
  var ehTablet = false;
  try {
    ehTablet = navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches && window.self === window.top;
  } catch (e) { ehTablet = false; }
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent || '')) ehTablet = false;
  if (window.__PT_TESTE) ehTablet = true;   // só para teste automatizado
  if (!ehTablet || typeof firebase === 'undefined') return;

  var RAIZ = window.__PT_RAIZ || 'legislar';
  var BASE = RAIZ + '/presenca';
  var VALIDADE = 4 * 3600 * 1000;   // igual ao dashboard: depois de 4 h o pedido de tela perde a validade
  var ESPERA = 5000;                // o notebook acabou de abrir a Presença: espera ela carregar antes de liberar o botão

  // Votação (id do tablet) -> Presença (id do vereador)
  var VOT2PRES = { v1: 'jackson', v2: 'dilson', v3: 'lucas', v4: 'marilene', v5: 'nilza', v6: 'rogerio', v7: 'sylas', v8: 'jose', v9: 'wilson' };
  var FOTOS = {
    jackson: 'https://2.gravatar.com/userimage/277172047/8039d08ed8a294328b8f8b70bbbeb765?size=240',
    marilene: 'https://2.gravatar.com/userimage/277172047/649f18d55aefc7b14c929b5b4cbb3f0d?size=240',
    nilza: 'https://1.gravatar.com/userimage/277172047/1664047f373debf8b5651065a72ff1ea?size=240',
    wilson: 'https://0.gravatar.com/userimage/277172047/9342d191dbd2a0115384f72754b0056b?size=240',
    rogerio: 'https://2.gravatar.com/userimage/277172047/cd0c7fd16ed7a3be204e382e86af7e23?size=240',
    dilson: 'https://1.gravatar.com/userimage/277172047/663db92eb90b94a5fce1914f09f97435?size=240',
    lucas: 'https://2.gravatar.com/userimage/277172047/21cee79305a9e7882d6ae14f87a77652?size=240',
    sylas: 'https://2.gravatar.com/userimage/277172047/599489b917ada4c8af9a7add57a38d56?size=240',
    jose: 'https://1.gravatar.com/userimage/277172047/8b0bc09db080b520bb5efcac97fdac7d?size=240'
  };

  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp({
      apiKey: 'AIzaSyAHawTmb2za8y2Eq70FWejq64-5J6Pbqfo',
      authDomain: 'projeto-teste-f08c4.firebaseapp.com',
      databaseURL: 'https://projeto-teste-f08c4-default-rtdb.firebaseio.com',
      projectId: 'projeto-teste-f08c4',
      storageBucket: 'projeto-teste-f08c4.firebasestorage.app',
      messagingSenderId: '788863562302',
      appId: '1:788863562302:web:2ddcfb6c2c892770de976f'
    });
  } catch (e) {}
  var db;
  try { db = firebase.database(); } catch (e) { return; }

  var css = '' +
    '#pt-pres{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;z-index:99980;display:none;flex-direction:column;box-sizing:border-box;padding:2.2vmin 2.6vmin;overflow:hidden;' +
    'background:#0a1022;background:radial-gradient(1100px 620px at 8% -12%,rgba(58,100,216,.35),transparent 62%),radial-gradient(900px 520px at 108% 0%,rgba(230,185,85,.16),transparent 60%),#0a1022;' +
    'color:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
    '#pt-pres.pt-on{display:flex;touch-action:manipulation;overscroll-behavior:none}' +
    '#pt-pres *{box-sizing:border-box}' +
    '#pt-pres .pt-top{display:flex;align-items:center;flex:0 0 auto;padding-bottom:1.6vmin;border-bottom:1px solid rgba(230,185,85,.35)}' +
    '#pt-pres .pt-logo{width:7.5vmin;height:7.5vmin;object-fit:contain;margin-right:1.8vmin;flex:0 0 auto}' +
    '#pt-pres .pt-tit{flex:1 1 auto;min-width:0}' +
    '#pt-pres .pt-tit b{display:block;font-size:3.6vmin;font-weight:800;letter-spacing:.06em;color:#e6b955;text-transform:uppercase;line-height:1.1}' +
    '#pt-pres .pt-tit small{display:block;font-size:2.1vmin;color:#c9d2ea;margin-top:.4vmin;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#pt-pres .pt-info{text-align:right;flex:0 0 auto;margin-left:1.6vmin}' +
    '#pt-pres .pt-cont{font-size:3.4vmin;font-weight:800;font-variant-numeric:tabular-nums}' +
    '#pt-pres .pt-cont span{color:#34d399}' +
    '#pt-pres .pt-sess{display:inline-block;margin-top:.5vmin;padding:.4vmin 1.4vmin;border-radius:999px;font-size:1.8vmin;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,.25);color:#c9d2ea}' +
    '#pt-pres .pt-sess.aberta{border-color:rgba(52,211,153,.6);color:#34d399}' +
    '#pt-pres .pt-sess.suspensa{border-color:rgba(251,191,36,.6);color:#fbbf24}' +
    '#pt-pres .pt-aviso{flex:0 0 auto;text-align:center;font-size:2.5vmin;font-weight:600;color:#fff;margin:1.6vmin 0 1.2vmin;min-height:3.2vmin}' +
    '#pt-pres .pt-aviso.ok{color:#34d399}' +
    '#pt-pres .pt-grid{flex:1 1 auto;min-height:0;display:-ms-grid;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr}' +
    '#pt-pres .pt-card{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:.8vmin;padding:1vmin;border-radius:2vmin;min-height:0;overflow:hidden;' +
    'background:rgba(255,255,255,.05);border:2px solid rgba(248,113,113,.55);cursor:pointer;transition:transform .12s}' +
    '#pt-pres .pt-card:active{transform:scale(.97)}' +
    '#pt-pres .pt-card.presente{border-color:#34d399;background:rgba(52,211,153,.12)}' +
    '#pt-pres .pt-card.justificado{border-color:#fbbf24;background:rgba(251,191,36,.10)}' +
    '#pt-pres .pt-card.meu{box-shadow:0 0 0 .5vmin #e6b955,0 0 3vmin rgba(230,185,85,.45)}' +
    '#pt-pres .pt-card.meu.ausente{animation:pt-brilho 1.6s ease-in-out infinite}' +
    '@keyframes pt-brilho{0%,100%{box-shadow:0 0 0 .5vmin #e6b955,0 0 1.5vmin rgba(230,185,85,.3)}50%{box-shadow:0 0 0 .5vmin #e6b955,0 0 4.5vmin rgba(230,185,85,.8)}}' +
    '#pt-pres .pt-card.bloq{opacity:.55;cursor:default}' +
    '#pt-pres .pt-card img,#pt-pres .pt-card .pt-ini{width:11vmin;height:11vmin;border-radius:50%;object-fit:cover;border:.5vmin solid rgba(255,255,255,.18);background:#1b2547;flex:0 0 auto}' +
    '#pt-pres .pt-card .pt-ini{display:flex;align-items:center;justify-content:center;font-size:4vmin;font-weight:800;color:#e6b955}' +
    '#pt-pres .pt-card.presente img{border-color:#34d399}' +
    '#pt-pres .pt-nome{font-size:2.4vmin;font-weight:800;line-height:1.15;margin-top:1vmin;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#pt-pres .pt-sub{font-size:1.7vmin;color:#c9d2ea;margin-top:.3vmin;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#pt-pres .pt-st{margin-top:.8vmin;padding:.4vmin 1.6vmin;border-radius:999px;font-size:1.8vmin;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:rgba(248,113,113,.18);color:#fca5a5}' +
    '#pt-pres .presente .pt-st{background:rgba(52,211,153,.2);color:#6ee7b7}' +
    '#pt-pres .justificado .pt-st{background:rgba(251,191,36,.2);color:#fcd34d}' +
    '#pt-pres .pt-tag{position:absolute;top:1vmin;left:1vmin;font-size:1.5vmin;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0a1022;background:#e6b955;border-radius:999px;padding:.3vmin 1.1vmin}' +
    '#pt-pres .pt-vazio{grid-column:1 / -1;text-align:center;align-self:center;font-size:2.6vmin;color:#c9d2ea}' +
    '#pt-modal{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99981;display:none;align-items:center;justify-content:center;padding:3vmin;background:rgba(3,7,18,.78);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;-webkit-tap-highlight-color:transparent}' +
    '#pt-modal.pt-on{display:flex}' +
    '#pt-modal .pt-box{width:100%;max-width:92vmin;text-align:center;padding:4vmin;border-radius:3vmin;background:#0f1a3a;border:1px solid rgba(230,185,85,.55);box-shadow:0 3vmin 8vmin rgba(0,0,0,.6)}' +
    '#pt-modal img,#pt-modal .pt-ini{display:block;width:26vmin;height:26vmin;margin:0 auto 2.4vmin;border-radius:50%;object-fit:cover;border:.7vmin solid #e6b955;background:#1b2547}' +
    '#pt-modal .pt-ini{display:flex;align-items:center;justify-content:center;font-size:9vmin;font-weight:800;color:#e6b955}' +
    '#pt-modal .pt-mn{font-size:4.6vmin;font-weight:800;line-height:1.15}' +
    '#pt-modal .pt-ms{font-size:2.4vmin;color:#c9d2ea;margin-top:.8vmin}' +
    '#pt-modal .pt-msg{font-size:2.6vmin;margin-top:2.4vmin;min-height:3.4vmin;color:#fff}' +
    '#pt-modal .pt-msg.ok{color:#34d399;font-weight:800;font-size:3.4vmin}' +
    '#pt-modal .pt-msg.erro{color:#fca5a5}' +
    '#pt-modal button{font-family:inherit;border:0;border-radius:2vmin;cursor:pointer}' +
    '#pt-modal .pt-reg{display:block;width:100%;margin-top:2.6vmin;padding:3vmin 2vmin;font-size:4.2vmin;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#06210f;background:#34d399;box-shadow:0 1vmin 3vmin rgba(52,211,153,.35)}' +
    '#pt-modal .pt-reg[disabled]{opacity:.5;cursor:default}' +
    '#pt-modal .pt-canc{display:block;width:100%;margin-top:1.6vmin;padding:2vmin;font-size:2.6vmin;font-weight:700;color:#c9d2ea;background:transparent;border:1px solid rgba(255,255,255,.25)}';

  var mostrando = false, tela = null, offset = 0, telaPronta = false;
  var vers = {}, sess = {}, camara = {}, aparelhos = {}, ensaio = false, carregouVer = false;
  var escolhido = null, enviando = false, fecharT = null;
  var raiz, grid, modal;

  // (não usado: a pedido do usuário o bip sai só na Smart TV, não no tablet)
  var audioCtx = null;
  function bip() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
      var t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1046, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.14);
    } catch (e) {}
  }
  // Cada toque num nome ou botão: a Smart TV toca o bip (js/bip-tv.js). O tablet fica em silêncio.
  function bipTV() {
    try { db.ref(BASE + '/bip').set({ em: firebase.database.ServerValue.TIMESTAMP, n: Math.floor(Math.random() * 1e9) }); } catch (e) {}
  }
  function tocou(e) {
    var t = e.target;
    while (t && t.nodeType === 1) {
      if (t.tagName === 'BUTTON') { if (!t.disabled) bipTV(); return; }
      if (t.className && /(^| )pt-card( |$)/.test(t.className)) { if (!/(^| )bloq( |$)/.test(t.className)) bipTV(); return; }
      t = t.parentNode;
    }
  }

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function agora() { return Date.now() + offset; }
  function norm(s) { return s === 'presente' || s === 'justificado' ? s : 'ausente'; }
  function rotulo(s) { return s === 'presente' ? 'Presente' : s === 'justificado' ? 'Justificado' : 'Ausente'; }
  function iniciais(n) { n = String(n || '').replace(/^(ver|vera|prof)\.?\s+/i, '').replace(/^\s+|\s+$/g, ''); var p = n.split(/\s+/); return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
  function foto(id, v) { var f = v && v.foto; if (f && /^(data:|https?:)/.test(f)) return f; return FOTOS[id] || ''; }
  function avatar(id, v) {
    var u = foto(id, v);
    if (u) return '<img src="' + esc(u) + '" alt="" data-ini="' + esc(iniciais(v.nome)) + '" onerror="this.outerHTML=\'<div class=&quot;pt-ini&quot;>\'+(this.getAttribute(\'data-ini\')||\'?\')+\'</div>\'">';
    return '<div class="pt-ini">' + esc(iniciais(v.nome)) + '</div>';
  }
  function lista() {
    return Object.keys(vers).map(function (id) { var v = vers[id]; return { id: id, v: v }; })
      .sort(function (a, b) { return (a.v.ordem || 0) - (b.v.ordem || 0) || (b.v.presidente ? 1 : 0) - (a.v.presidente ? 1 : 0) || String(a.v.nome).localeCompare(String(b.v.nome)); });
  }

  // De quem é este tablet: o vínculo da Votação (fora do Modo de ensaio); senão, o último vereador que registrou aqui.
  function devId() { try { return localStorage.getItem('vp_dev') || ''; } catch (e) { return ''; } }
  function dono() {
    var dev = devId();
    if (!ensaio && dev) for (var vid in aparelhos) if (aparelhos.hasOwnProperty(vid) && aparelhos[vid] && aparelhos[vid].dev === dev && VOT2PRES[vid] && vers[VOT2PRES[vid]]) return { id: VOT2PRES[vid], fixo: true };
    var m = ''; try { m = localStorage.getItem('pt_meu') || ''; } catch (e) {}
    if (m && vers[m]) return { id: m, fixo: false };
    return null;
  }

  function montar() {
    var st = document.createElement('style'); st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.id = 'pt-pres';
    raiz.innerHTML = '<div class="pt-top"><img class="pt-logo" src="img/brasao.png" alt="" onerror="this.style.display=\'none\'">' +
      '<div class="pt-tit"><b>Presença Plenária</b><small id="pt-cam"></small></div>' +
      '<div class="pt-info"><div class="pt-cont">Presentes <span id="pt-np">0</span> / <span id="pt-nt" style="color:#fff">0</span></div><div class="pt-sess" id="pt-sess">Aguardando</div></div></div>' +
      '<div class="pt-aviso" id="pt-aviso"></div><div class="pt-grid" id="pt-grid"></div>';
    modal = document.createElement('div'); modal.id = 'pt-modal';
    modal.innerHTML = '<div class="pt-box"><div id="pt-mfoto"></div><div class="pt-mn" id="pt-mn"></div><div class="pt-ms" id="pt-ms"></div>' +
      '<div class="pt-msg" id="pt-msg"></div><button type="button" class="pt-reg" id="pt-reg">Registrar presença</button>' +
      '<button type="button" class="pt-canc" id="pt-canc">Voltar</button></div>';
    document.body.appendChild(raiz); document.body.appendChild(modal);
    raiz.addEventListener('click', tocou, true); modal.addEventListener('click', tocou, true);
    grid = el('pt-grid');
    grid.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== grid && !(t.getAttribute && t.getAttribute('data-id'))) t = t.parentNode;
      if (!t || t === grid) return;
      abrir(t.getAttribute('data-id'));
    });
    el('pt-reg').addEventListener('click', registrar);
    el('pt-canc').addEventListener('click', fecharModal);
  }

  function render() {
    if (!raiz) return;
    var ver = !!tela && carregouVer;
    if (!ver) {
      if (mostrando) { mostrando = false; raiz.className = ''; fecharModal(); document.documentElement.style.overflow = ''; }
      return;
    }
    if (!mostrando) { mostrando = true; raiz.className = 'pt-on'; document.documentElement.style.overflow = 'hidden'; }
    var L = lista(), np = 0, d = dono(), html = '';
    for (var i = 0; i < L.length; i++) {
      var id = L[i].id, v = L[i].v, s = norm(v.status);
      if (s === 'presente') np++;
      var meu = d && d.id === id, bloq = d && d.fixo && !meu;
      html += '<div class="pt-card ' + s + (meu ? ' meu' : '') + (bloq ? ' bloq' : '') + '" data-id="' + esc(id) + '">' +
        (meu ? '<span class="pt-tag">Este tablet</span>' : '') + avatar(id, v) +
        '<div class="pt-nome">' + esc(v.nome || id) + '</div>' +
        '<div class="pt-sub">' + esc([v.cargo, v.partido].filter(function (x) { return x; }).join(' · ')) + '</div>' +
        '<div class="pt-st">' + rotulo(s) + '</div></div>';
    }
    if (!L.length) html = '<div class="pt-vazio">Carregando os vereadores…</div>';
    if (grid.getAttribute('data-h') !== html) { grid.innerHTML = html; grid.setAttribute('data-h', html); }
    el('pt-np').textContent = np; el('pt-nt').textContent = L.length;
    el('pt-cam').textContent = (camara.nome || 'Plenário Jonas Plínio') + (sess.numero ? ' · ' + sess.numero + 'ª Sessão ' + (sess.tipo || '') : '');
    var e = sess.estado, se = el('pt-sess');
    se.textContent = e === 'aberta' ? 'Sessão aberta' : e === 'suspensa' ? 'Sessão suspensa' : e === 'encerrada' ? 'Sessão encerrada' : 'Aguardando';
    se.className = 'pt-sess' + (e === 'aberta' || e === 'suspensa' ? ' ' + e : '');
    var av = el('pt-aviso');
    if (d && vers[d.id] && norm(vers[d.id].status) === 'presente') { av.textContent = '✓ Sua presença está registrada, ' + (vers[d.id].nome || '') + '.'; av.className = 'pt-aviso ok'; }
    else if (d) { av.textContent = 'Toque no seu nome para registrar a presença.'; av.className = 'pt-aviso'; }
    else { av.textContent = 'Toque no seu nome para registrar a sua presença.'; av.className = 'pt-aviso'; }
    if (escolhido) renderModal();
  }

  function abrir(id) {
    var d = dono();
    if (!vers[id]) return;
    if (d && d.fixo && d.id !== id) return;   // tablet vinculado: só o dono registra aqui
    escolhido = id; clearTimeout(fecharT);
    el('pt-msg').textContent = ''; el('pt-msg').className = 'pt-msg';
    modal.className = 'pt-on';
    renderModal();
  }
  function fecharModal() { escolhido = null; enviando = false; clearTimeout(fecharT); if (modal) modal.className = ''; }

  function renderModal() {
    var v = vers[escolhido];
    if (!v) { fecharModal(); return; }
    var s = norm(v.status);
    var f = el('pt-mfoto'), h = avatar(escolhido, v);
    if (f.getAttribute('data-h') !== h) { f.innerHTML = h; f.setAttribute('data-h', h); }
    el('pt-mn').textContent = v.nome || escolhido;
    el('pt-ms').textContent = [v.cargo, v.partido].filter(function (x) { return x; }).join(' · ');
    var b = el('pt-reg'), m = el('pt-msg');
    if (s === 'presente') {
      b.style.display = 'none';
      if (!enviando) { m.textContent = '✓ Presença registrada'; m.className = 'pt-msg ok'; }
      el('pt-canc').textContent = 'Fechar';
      return;
    }
    b.style.display = '';
    el('pt-canc').textContent = 'Voltar';
    var falta = telaPronta ? 0 : Math.ceil((tela.em + ESPERA - agora()) / 1000);
    if (enviando) { b.disabled = true; b.textContent = 'Registrando…'; }
    else if (falta > 0) { b.disabled = true; b.textContent = 'Aguarde ' + falta + ' s…'; }
    else { b.disabled = false; b.textContent = 'Registrar presença'; }
    if (!enviando && !m.textContent && s === 'justificado') m.textContent = 'A Mesa marcou como justificado. Toque abaixo se você está presente.';
  }

  function registrar() {
    var id = escolhido;
    if (!id || enviando || !vers[id] || norm(vers[id].status) === 'presente') return;
    if (!telaPronta && agora() < tela.em + ESPERA) return;
    var d = dono();
    if (d && d.fixo && d.id !== id) return;
    enviando = true; renderModal();
    var m = el('pt-msg'), terminou = false;
    var lento = setTimeout(function () {
      if (terminou) return;
      m.textContent = 'Sem internet no momento. A presença será enviada assim que a conexão voltar.'; m.className = 'pt-msg erro';
    }, 5000);
    db.ref(BASE + '/vereadores/' + id).update({ status: 'presente', atualizadoEm: Date.now() }).then(function () {
      terminou = true; clearTimeout(lento);
      try { localStorage.setItem('pt_meu', id); } catch (e) {}
      enviando = false;
      if (escolhido === id) {
        m.textContent = '✓ Presença registrada'; m.className = 'pt-msg ok';
        renderModal();
        fecharT = setTimeout(function () { if (escolhido === id) fecharModal(); }, 2500);
      }
      render();
    }, function () {
      terminou = true; clearTimeout(lento); enviando = false;
      if (escolhido === id) { m.textContent = 'Não foi possível registrar. Toque de novo.'; m.className = 'pt-msg erro'; renderModal(); }
    });
  }

  function avaliarTela(v) {
    v = v || {};
    var ok = v.pagina === 'presenca_plenaria.html' && v.em && (agora() - v.em < VALIDADE);
    tela = ok ? { em: v.em } : null;
    telaPronta = !!(ok && agora() - v.em >= ESPERA);
    render();
  }

  function iniciar() {
    montar();
    db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
    var ultTela = null;
    db.ref(RAIZ + '/painel/tela').on('value', function (s) { ultTela = s.val(); avaliarTela(ultTela); });
    db.ref(BASE + '/vereadores').on('value', function (s) { vers = s.val() || {}; carregouVer = true; render(); });
    db.ref(BASE + '/sessao/atual').on('value', function (s) { sess = s.val() || {}; render(); });
    db.ref(BASE + '/config/camara').on('value', function (s) { camara = s.val() || {}; render(); });
    db.ref(RAIZ + '/votacao/aparelhos').on('value', function (s) { aparelhos = s.val() || {}; render(); });
    db.ref(RAIZ + '/votacao/config/ensaio').on('value', function (s) { var v = s.val(); ensaio = !!(v && v.ligado); render(); });
    // contagem do "Aguarde" e validade de 4 h
    setInterval(function () {
      if (ultTela && (tela || mostrando)) {
        var antes = telaPronta, tinha = !!tela;
        avaliarTela(ultTela);
        if (antes === telaPronta && tinha === !!tela && escolhido) renderModal();
      }
    }, 1000);
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
