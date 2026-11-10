/* Bip na Smart TV (ES5)
   Cada toque na Presença dos tablets grava legislar/presenca/bip = {em, n}.
   A Smart TV (dashboard.html com body.modo-tv) ouve esse caminho e toca o mesmo bip.
   Não inicializa o Firebase: espera o próprio dashboard inicializar (evita "app duplicado" na TV antiga).
   Navegadores só liberam som depois de uma interação: basta apertar qualquer tecla do controle uma vez. */
(function () {
  if (window.self !== window.top) return;
  try { if (navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches) return; } catch (e) {}   // tablet: quem envia é ele
  var RAIZ = window.__PT_RAIZ || 'legislar';
  var ctx = null, offset = 0;

  function ehTV() { return !!(document.body && document.body.className && /(^| )modo-tv( |$)/.test(document.body.className)); }
  function contexto() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function destravar() { if (!ehTV()) return; var c = contexto(); if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) {} } }
  document.addEventListener('keydown', destravar, true);
  document.addEventListener('click', destravar, true);

  // Reserva para TVs sem Web Audio: o mesmo bip como arquivo WAV gerado aqui (8 kHz, 8 bits, 0,12 s)
  var wav = null;
  function gerarWav() {
    var taxa = 8000, n = Math.floor(taxa * 0.12), i, d = '';
    function u32(x) { return String.fromCharCode(x & 255, (x >> 8) & 255, (x >> 16) & 255, (x >> 24) & 255); }
    function u16(x) { return String.fromCharCode(x & 255, (x >> 8) & 255); }
    for (i = 0; i < n; i++) {
      var env = Math.min(1, i / 80) * Math.min(1, (n - i) / 400);
      d += String.fromCharCode(Math.round(128 + 90 * env * Math.sin(2 * Math.PI * 1046 * i / taxa)));
    }
    return 'data:audio/wav;base64,' + btoa('RIFF' + u32(36 + n) + 'WAVEfmt ' + u32(16) + u16(1) + u16(1) + u32(taxa) + u32(taxa) + u16(1) + u16(8) + 'data' + u32(n) + d);
  }
  function bipReserva() {
    try {
      if (!wav) wav = gerarWav();
      var a = new Audio(wav); a.volume = 1;
      var r = a.play(); if (r && r['catch']) r['catch'](function () {});
    } catch (e) {}
  }

  function bip() {
    var c = contexto();
    if (!c) { bipReserva(); return; }
    try {
      if (c.state === 'suspended' && c.resume) c.resume();
      var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1046, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.14);
    } catch (e) { bipReserva(); }
  }

  var tentativas = 0;
  function iniciar() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      if (++tentativas < 120) setTimeout(iniciar, 500);
      return;
    }
    var db; try { db = firebase.database(); } catch (e) { return; }
    db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
    var primeiro = true, ultimo = null;
    db.ref(RAIZ + '/presenca/bip').on('value', function (s) {
      var v = s.val(), chave = v ? String(v.n) : '';   // só o n: o horário do servidor chega em 2 avisos
      if (primeiro) { primeiro = false; ultimo = chave; return; }   // não toca o bip antigo ao abrir
      if (!v || chave === ultimo) return;
      ultimo = chave;
      if (!ehTV()) return;
      if (v.em && Date.now() + offset - v.em > 10000) return;      // sinal atrasado (ex.: tablet voltou da falta de internet)
      bip();
    });
  }
  iniciar();
})();
