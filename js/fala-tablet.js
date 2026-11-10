/* Fala no tablet (ES5)
   Quando o notebook clica em "Iniciar" no Controle de Fala, todos os tablets mostram
   o vereador que está falando (foto, nome, partido e o tempo restante).
   Só funciona nos tablets/celulares: Smart TV e notebook não são alterados.
   Lê (nunca grava) legislar/controleFala/estado, /dados, /fotos e /notebookAberto
   (marcado pelo notebook enquanto o Controle de Fala está aberto). */
(function () {
  var ehTablet = false;
  try {
    ehTablet = navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches && window.self === window.top;
  } catch (e) { ehTablet = false; }
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent || '')) ehTablet = false;
  if (!ehTablet || typeof firebase === 'undefined') return;

  var PADRAO = {
    1: { nome: 'Ver. Rogério Gotado', partido: 'PT', cargo: 'Presidente', foto: 'https://2.gravatar.com/userimage/277172047/cd0c7fd16ed7a3be204e382e86af7e23?size=400' },
    2: { nome: 'Ver. Lucas Cavalcante', partido: 'PODEMOS', cargo: 'Vice-Presidente', foto: 'https://2.gravatar.com/userimage/277172047/21cee79305a9e7882d6ae14f87a77652?size=400' },
    3: { nome: 'Ver. Dilson Junior', partido: 'PV', cargo: '1º Secretário', foto: 'https://1.gravatar.com/userimage/277172047/663db92eb90b94a5fce1914f09f97435?size=400' },
    4: { nome: 'Ver. Wilson Freitas', partido: 'PC do B', cargo: '2º Secretário', foto: 'https://0.gravatar.com/userimage/277172047/9342d191dbd2a0115384f72754b0056b?size=400' },
    5: { nome: 'ver. José Lindomar (Bimba)', partido: 'PODEMOS', cargo: 'Vereador', foto: 'https://1.gravatar.com/userimage/277172047/8b0bc09db080b520bb5efcac97fdac7d?size=400' },
    6: { nome: 'Prof. Sylas Souza', partido: 'PODEMOS', cargo: 'Vereador', foto: 'https://2.gravatar.com/userimage/277172047/599489b917ada4c8af9a7add57a38d56?size=400' },
    7: { nome: 'Vera. Maria Nilza', partido: 'PODEMOS', cargo: 'Vereadora', foto: 'https://1.gravatar.com/userimage/277172047/1664047f373debf8b5651065a72ff1ea?size=400' },
    8: { nome: 'Vera. Marilene Costa', partido: 'PP', cargo: 'Vereadora', foto: 'https://2.gravatar.com/userimage/277172047/649f18d55aefc7b14c929b5b4cbb3f0d?size=400' },
    9: { nome: 'Ver. Jackson Costa', partido: 'AVANTE', cargo: 'Vereador', foto: 'https://2.gravatar.com/userimage/277172047/8039d08ed8a294328b8f8b70bbbeb765?size=400' }
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
    '#ft-fala{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;z-index:99990;display:none;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;' +
    'background:#0a1022;background:radial-gradient(1100px 620px at 8% -12%,rgba(58,100,216,.35),transparent 62%),radial-gradient(900px 520px at 108% 0%,rgba(230,185,85,.16),transparent 60%),#0a1022;' +
    'color:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}' +
    '#ft-fala.ft-on{display:flex;touch-action:none;overscroll-behavior:none}' +
    '#ft-fala .ft-box{max-width:620px;max-width:92vw;width:100%}' +
    '#ft-fala .ft-tag{display:inline-block;padding:7px 16px;border-radius:999px;font-size:14px;font-size:2.2vmin;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(230,185,85,.55);color:#e6b955;background:rgba(230,185,85,.08)}' +
    '#ft-fala .ft-tag i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#34d399;margin-right:9px;vertical-align:1px;animation:ft-pulso 1.2s infinite}' +
    '#ft-fala.ft-pausa .ft-tag i{background:#fbbf24;animation:none}' +
    '#ft-fala.ft-fim .ft-tag i{background:#f87171;animation:none}' +
    '@keyframes ft-pulso{0%,100%{opacity:1}50%{opacity:.25}}' +
    '#ft-fala .ft-foto{display:block;width:210px;height:210px;width:34vmin;height:34vmin;margin:26px auto 18px;margin:4vmin auto 2.6vmin;border-radius:50%;object-fit:cover;border:5px solid #e6b955;box-shadow:0 0 0 8px rgba(230,185,85,.12),0 18px 50px rgba(0,0,0,.5);background:#1b2547}' +
    '#ft-fala .ft-nome{font-size:34px;font-size:5.4vmin;font-weight:800;line-height:1.15;margin:0}' +
    '#ft-fala .ft-sub{font-size:17px;font-size:2.7vmin;color:#c9d2ea;margin-top:8px}' +
    '#ft-fala .ft-tempo{font-size:76px;font-size:13vmin;font-weight:800;letter-spacing:.04em;margin-top:22px;margin-top:3vmin;font-variant-numeric:tabular-nums;color:#fff}' +
    '#ft-fala .ft-tempo.ft-alerta{color:#fbbf24}#ft-fala .ft-tempo.ft-zero{color:#f87171}' +
    '#ft-fala .ft-modo{font-size:14px;font-size:2.2vmin;color:#8f9bbd;margin-top:4px;text-transform:uppercase;letter-spacing:.1em}' +
    '#ft-fala .ft-ocultar{margin-top:28px;background:transparent;color:#c9d2ea;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:11px 22px;font-size:15px;font-family:inherit}' +
    '#ft-barra{position:fixed;left:12px;right:12px;bottom:12px;z-index:99989;display:none;align-items:center;padding:10px 14px;border-radius:16px;background:#0f1a3a;border:1px solid rgba(230,185,85,.5);color:#fff;font-family:Inter,system-ui,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)}' +
    '#ft-barra.ft-on{display:flex}' +
    '#ft-barra img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #e6b955;margin-right:12px;flex:0 0 auto}' +
    '#ft-barra .ft-bn{flex:1 1 auto;text-align:left;font-size:15px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
    '#ft-barra .ft-bn small{display:block;font-weight:400;color:#c9d2ea;font-size:12px}' +
    '#ft-barra .ft-bt{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;margin:0 12px}' +
    '#ft-barra button{background:#e6b955;color:#0a1022;border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px;font-family:inherit}';

  var estavaVisivel = false, aberto = false, est = null, dados = {}, foto = {}, offset = 0, minimizado = false, fotoAtual = '';
  var tela, barra;

  function el(id) { return document.getElementById(id); }
  function montar() {
    var st = document.createElement('style'); st.appendChild(document.createTextNode(css)); document.head.appendChild(st);
    tela = document.createElement('div'); tela.id = 'ft-fala';
    tela.innerHTML = '<div class="ft-box"><span class="ft-tag"><i></i><span id="ft-st">Em discurso</span></span>' +
      '<img class="ft-foto" id="ft-foto" alt="">' +
      '<p class="ft-nome" id="ft-nome"></p><div class="ft-sub" id="ft-sub"></div>' +
      '<div class="ft-tempo" id="ft-tempo">00:00</div><div class="ft-modo" id="ft-modo"></div>' +'</div>';
    barra = document.createElement('div'); barra.id = 'ft-barra';
    barra.innerHTML = '<img id="ft-bfoto" alt=""><div class="ft-bn"><span id="ft-bnome"></span><small id="ft-bst"></small></div>' +
      '<div class="ft-bt" id="ft-btempo"></div><button type="button" id="ft-abrir">Ver</button>';
    document.body.appendChild(tela); document.body.appendChild(barra);
    el('ft-abrir').onclick = function () { minimizado = false; render(); };
  }

  function agora() { return Date.now() + offset; }
  function segundos() {
    if (!est) return 0;
    if (est.running) return Math.max(0, Math.ceil(((est.endAt || 0) - agora()) / 1000));
    return Math.max(0, Math.round(est.remaining || 0));
  }
  function mmss(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }

  // Mostra durante a fala (rodando ou pausada) e só com o Controle de Fala aberto no notebook.
  function visivel() {
    if (!est || !aberto) return false;   // notebook saiu do Controle de Fala: tablets voltam à página do Legislar
    // só durante a fala; finalizou (Zerar/esgotado) = fecha na hora
    return !!(est.running || est.status === 'discurso' || est.status === 'pausado');
  }

  function render() {
    if (!tela) return;
    var ver = visivel();
    if (!ver) minimizado = false;
    // a fala saiu da tela do tablet: volta para a página principal do Legislativo
    if (!ver && estavaVisivel && !/dashboard\.html$/.test(location.pathname)) { estavaVisivel = false; location.href = 'dashboard.html'; return; }
    estavaVisivel = ver;
    tela.className = ver && !minimizado ? 'ft-on' : '';
    document.documentElement.style.overflow = ver ? 'hidden' : '';
    barra.className = ver && minimizado ? 'ft-on' : '';
    if (!ver) return;
    var id = est.vereadorId || 1, p = PADRAO[id] || {}, d = dados['v' + id] || {};
    var nome = d.nome || p.nome || ('Vereador ' + id), partido = d.partido || p.partido || '';
    var src = foto['v' + id] || p.foto || '';
    var stt = est.running ? 'Em discurso' : est.status === 'pausado' ? 'Discurso pausado' : est.status === 'esgotado' ? 'Tempo esgotado' : est.status === 'concluida' ? 'Fala concluída' : 'Em discurso';
    tela.className += est.running ? '' : (est.status === 'pausado' ? ' ft-pausa' : ' ft-fim');
    var s = segundos();
    if (src !== fotoAtual) { fotoAtual = src; el('ft-foto').src = src; el('ft-bfoto').src = src; }
    el('ft-st').textContent = stt;
    el('ft-nome').textContent = nome;
    el('ft-sub').textContent = [p.cargo, partido].filter(function (x) { return x; }).join(' · ');
    el('ft-tempo').textContent = mmss(s);
    el('ft-tempo').className = 'ft-tempo' + (s === 0 ? ' ft-zero' : s <= 60 ? ' ft-alerta' : '');
    el('ft-modo').textContent = est.modoLabel || '';
    el('ft-bnome').textContent = nome;
    el('ft-bst').textContent = stt;
    el('ft-btempo').textContent = mmss(s);
  }

  var fotoRef = null;
  function ouvirFoto(id) {
    if (fotoRef && fotoRef.key === 'v' + id) return;
    if (fotoRef) fotoRef.off();
    fotoRef = db.ref('legislar/controleFala/fotos/v' + id);
    fotoRef.on('value', function (s) { foto = {}; if (s.val()) foto['v' + id] = s.val(); render(); });
  }

  // Tela cheia: o navegador só permite depois de um toque. Qualquer toque no tablet
  // (inclusive na tela da fala, que não tem botões) coloca a tela cheia, com ou sem ensaio.
  function emTelaCheia() {
    try {
      if (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return true;
    } catch (e) {}
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function pedirTelaCheia() {
    if (emTelaCheia()) return;
    var h = document.documentElement;
    try {
      var r = h.requestFullscreen ? h.requestFullscreen({ navigationUI: 'hide' }) : (h.webkitRequestFullscreen ? h.webkitRequestFullscreen() : null);
      if (r && r['catch']) r['catch'](function () {});
    } catch (e) {}
  }

  function iniciar() {
    montar();
    document.addEventListener('touchend', pedirTelaCheia, true);
    document.addEventListener('click', pedirTelaCheia, true);
    db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
    db.ref('legislar/controleFala/notebookAberto').on('value', function (s) { aberto = !!s.val(); render(); });
    db.ref('legislar/controleFala/dados').on('value', function (s) { dados = s.val() || {}; render(); });
    db.ref('legislar/controleFala/estado').on('value', function (s) {
      var v = s.val();
      var antes = est;
      est = v;
      // uma nova fala (ou outro orador) sempre abre em tela cheia
      if (v && antes && (v.vereadorId !== antes.vereadorId || (v.running && !antes.running && antes.status !== 'pausado'))) minimizado = false;
      if (v) ouvirFoto(v.vereadorId || 1);
      render();
    });
    setInterval(render, 500);
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
