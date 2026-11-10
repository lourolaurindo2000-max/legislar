/* Sons do plenário (ES5) — window.PldSom
   tocar('bip')    bip curto (Presença e Abster)
   tocar('urna')   sequência rápida de bips agudos com nota final, no estilo da urna eletrônica (Aprovar)
   tocar('buzina') buzina grave (Reprovar)
   Os sons são gerados aqui mesmo (sem arquivos). Usa Web Audio; se a TV/navegador não tiver,
   toca o mesmo som como WAV. Navegadores só liberam som depois de um toque/tecla: destravar(). */
(function () {
  if (window.PldSom) return;
  var TAXA = 22050;   // aceito por todos os navegadores com Web Audio
  var cache = {}, wavs = {}, ctx = null;

  function clamp(x) { return x > 1 ? 1 : x < -1 ? -1 : x; }
  function env(t, dur, ataque, saida) { return Math.min(1, t / ataque) * Math.min(1, Math.max(0, dur - t) / saida); }
  function quadradoSuave(fase) { var s = Math.sin(fase); return (s > 0 ? 1 : -1) * Math.min(1, Math.abs(s) * 4); }

  function gerar(tipo) {
    var amostras = [], i, t, n, k;
    if (tipo === 'urna') {
      // 8 notas curtas alternando agudo/mais agudo + nota final longa
      var notas = [], f;
      for (k = 0; k < 8; k++) notas.push([k % 2 ? 2200 : 1750, 0.045]);
      notas.push([2200, 0.34]);
      for (k = 0; k < notas.length; k++) {
        f = notas[k][0]; n = Math.floor(notas[k][1] * TAXA);
        for (i = 0; i < n; i++) { t = i / TAXA; amostras.push(0.42 * env(t, notas[k][1], 0.004, k === notas.length - 1 ? 0.12 : 0.006) * quadradoSuave(2 * Math.PI * f * t)); }
      }
    } else if (tipo === 'buzina') {
      var dur = 0.75; n = Math.floor(dur * TAXA);
      for (i = 0; i < n; i++) {
        t = i / TAXA;
        var a = 2 * ((t * 349) % 1) - 1, b = 2 * ((t * 440) % 1) - 1, c = 2 * ((t * 174.5) % 1) - 1;
        var v = (0.45 * a + 0.4 * b + 0.25 * c) * 1.6;
        amostras.push(0.45 * env(t, dur, 0.02, 0.08) * clamp(v));
      }
    } else {
      n = Math.floor(0.12 * TAXA);
      for (i = 0; i < n; i++) { t = i / TAXA; amostras.push(0.6 * env(t, 0.12, 0.006, 0.05) * Math.sin(2 * Math.PI * 1046 * t)); }
    }
    return amostras;
  }
  function amostrasDe(tipo) { if (!cache[tipo]) cache[tipo] = gerar(tipo); return cache[tipo]; }

  function wav(tipo) {
    if (wavs[tipo]) return wavs[tipo];
    var a = amostrasDe(tipo), n = a.length, d = '', i, partes = [];
    function u32(x) { return String.fromCharCode(x & 255, (x >> 8) & 255, (x >> 16) & 255, (x >> 24) & 255); }
    function u16(x) { return String.fromCharCode(x & 255, (x >> 8) & 255); }
    for (i = 0; i < n; i++) {
      d += String.fromCharCode(Math.round(128 + 127 * clamp(a[i])));
      if (d.length >= 4096) { partes.push(d); d = ''; }
    }
    partes.push(d);
    wavs[tipo] = 'data:audio/wav;base64,' + btoa('RIFF' + u32(36 + n) + 'WAVEfmt ' + u32(16) + u16(1) + u16(1) + u32(TAXA) + u32(TAXA) + u16(1) + u16(8) + 'data' + u32(n) + partes.join(''));
    return wavs[tipo];
  }

  function contexto() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function destravar() { var c = contexto(); if (c && c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) {} } }

  function reserva(tipo) {
    try { var el = new Audio(wav(tipo)); el.volume = 1; var r = el.play(); if (r && r['catch']) r['catch'](function () {}); } catch (e) {}
  }
  function tocar(tipo) {
    tipo = tipo === 'urna' || tipo === 'buzina' ? tipo : 'bip';
    var c = contexto();
    if (!c || !c.createBuffer) { reserva(tipo); return; }
    try {
      if (c.state === 'suspended' && c.resume) c.resume();
      var a = amostrasDe(tipo), buf = c.createBuffer(1, a.length, TAXA), d = buf.getChannelData(0), i;
      for (i = 0; i < a.length; i++) d[i] = a[i];
      var src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start(0);
    } catch (e) { reserva(tipo); }
  }

  window.PldSom = { tocar: tocar, destravar: destravar };
})();
