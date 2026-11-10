/* Sons na Smart TV (ES5) — usa js/sons.js (PldSom)
   Presença: cada toque no tablet grava legislar/presenca/bip = {em, n}            -> TV toca o bip.
   Votação:  cada voto confirmado grava legislar/votacao/som = {tipo, em, n}       -> TV toca urna / buzina / bip.
   Só toca na Smart TV (dashboard.html com body.modo-tv). Não inicializa o Firebase: espera o próprio
   dashboard inicializar (evita "app duplicado" na TV antiga).
   Navegadores só liberam som depois de uma interação: basta apertar qualquer tecla do controle uma vez. */
(function () {
  if (window.self !== window.top) return;
  try { if (navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches) return; } catch (e) {}   // tablet: quem envia é ele
  var RAIZ = window.__PT_RAIZ || 'legislar';
  var offset = 0;

  function ehTV() { return !!(document.body && document.body.className && /(^| )modo-tv( |$)/.test(document.body.className)); }
  function destravar() { if (ehTV() && window.PldSom) window.PldSom.destravar(); }
  document.addEventListener('keydown', destravar, true);
  document.addEventListener('click', destravar, true);

  function ouvir(db, caminho, tipoFixo) {
    var primeiro = true, ultimo = null;
    db.ref(caminho).on('value', function (s) {
      var v = s.val(), chave = v ? String(v.n) : '';   // só o n: o horário do servidor pode chegar em 2 avisos
      if (primeiro) { primeiro = false; ultimo = chave; return; }   // não toca o som antigo ao abrir
      if (!v || chave === ultimo) return;
      ultimo = chave;
      if (!ehTV() || !window.PldSom) return;
      if (v.em && Date.now() + offset - v.em > 10000) return;      // sinal atrasado (ex.: tablet voltou da falta de internet)
      window.PldSom.tocar(tipoFixo || v.tipo);
    });
  }

  var tentativas = 0;
  function iniciar() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      if (++tentativas < 120) setTimeout(iniciar, 500);
      return;
    }
    var db; try { db = firebase.database(); } catch (e) { return; }
    db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
    ouvir(db, RAIZ + '/presenca/bip', 'bip');
    ouvir(db, RAIZ + '/votacao/som', null);
  }
  iniciar();
})();
