/* Sons do plenário (ES5) — window.PldSom
   tocar('bip')    bip curto (Presença e Abster)
   tocar('urna')   sequência rápida de bips agudos com nota final, no estilo da urna eletrônica (Aprovar)
   tocar('reprova') duas notas graves descendentes "tu-tum", 0,45 s (Reprovar; 'buzina' antigo também cai aqui)
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
    } else if (tipo === 'reprova') {
      // duas notas descendentes (Si -> Fá), timbre suave (seno + um pouco de harmônico), com pequena pausa
      var rep = [[494, 0.15], [0, 0.04], [349, 0.26]], fr, du, fase;
      for (k = 0; k < rep.length; k++) {
        fr = rep[k][0]; du = rep[k][1]; n = Math.floor(du * TAXA);
        for (i = 0; i < n; i++) {
          t = i / TAXA;
          if (!fr) { amostras.push(0); continue; }
          fase = 2 * Math.PI * fr * t;
          amostras.push(0.5 * env(t, du, 0.008, k === 2 ? 0.12 : 0.03) * (Math.sin(fase) * 0.75 + Math.sin(2 * fase) * 0.2 + Math.sin(3 * fase) * 0.1));
        }
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
    tipo = tipo === 'urna' ? 'urna' : (tipo === 'reprova' || tipo === 'buzina') ? 'reprova' : 'bip';
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
