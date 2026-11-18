/* PLD — Natal na página principal (dashboard): só a frase "★ Boas Festas e um próspero Ano Novo!"
 * (sem luzes e sem neve — a tela azul fica como sempre foi; pedido do usuário em 17/11/2026).
 * Aparece sozinha de 17/11 até 06/01 (Dia de Reis) e some depois, sem precisar mexer.
 * Notebook, tablets e Smart TV.  Teste fora da época: dashboard.html?natal=1  ·  esconder: ?natal=0
 * ES5 — a Smart TV antiga também carrega este arquivo.
 */
(function () {
  var q = location.search || '';
  var forcar = /[?&]natal=1/.test(q), tirar = /[?&]natal=0/.test(q);
  var h = new Date(), m = h.getMonth() + 1, d = h.getDate();
  var epoca = (m === 11 && d >= 17) || m === 12 || (m === 1 && d <= 6);
  if (tirar || (!epoca && !forcar)) return;

  var css =
    '.natal-msg{display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;margin-top:22px;font-size:1.05rem;letter-spacing:.02em;color:rgba(255,255,255,.82)}' +
    '.natal-msg svg{width:22px;height:22px;margin-right:10px;-webkit-flex:none;flex:none}' +
    '.natal-msg em{font-style:normal;color:#f6d77a;font-weight:600}' +
    'body.modo-tv .natal-msg{font-size:1.5rem}body.modo-tv .natal-msg svg{width:30px;height:30px}';
  var st = document.createElement('style'); st.id = 'natal-css'; st.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(st);

  function montar() {
    var alvo = document.querySelector('.hero-text');
    if (!alvo || document.getElementById('natalMsg')) return;
    var msg = document.createElement('div');
    msg.className = 'natal-msg'; msg.id = 'natalMsg';
    msg.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.6 6.1 6.6.5-5 4.3 1.6 6.4L12 16.4l-5.8 3.4 1.6-6.4-5-4.3 6.6-.5z" fill="#f6d77a"/></svg>' +
      '<span><em>Boas Festas</em> e um próspero Ano Novo!</span>';
    alvo.appendChild(msg);
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
