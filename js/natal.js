/* PLD — Enfeite de Natal discreto na página principal (dashboard).
 * Aparece sozinho de 17/11 até 06/01 (Dia de Reis) e some depois, sem precisar mexer.
 * Notebook, tablets e Smart TV. Fica ATRÁS da tela da TV (sistemas abertos) e das mensagens da Mesa.
 * Teste fora da época: dashboard.html?natal=1  ·  esconder: ?natal=0
 * ES5 — a Smart TV antiga também carrega este arquivo.
 */
(function () {
  var q = location.search || '';
  var forcar = /[?&]natal=1/.test(q), tirar = /[?&]natal=0/.test(q);
  var h = new Date(), m = h.getMonth() + 1, d = h.getDate();
  var epoca = (m === 11 && d >= 17) || m === 12 || (m === 1 && d <= 6);
  if (tirar || (!epoca && !forcar)) return;

  var calmo = false;
  try { calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css =
    '.natal-camada{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:900;overflow:hidden}' +
    '.phone-mockup{position:relative;z-index:901}' +   /* a neve passa por trás do celular com os cartões */
    /* cordão de luzes no topo */
    '.natal-cordao{position:absolute;top:0;left:0;width:100%;height:46px}' +
    '.natal-luz{-webkit-animation:natalPisca 3.2s ease-in-out infinite;animation:natalPisca 3.2s ease-in-out infinite}' +
    '@-webkit-keyframes natalPisca{0%,100%{opacity:.95}50%{opacity:.35}}' +
    '@keyframes natalPisca{0%,100%{opacity:.95}50%{opacity:.35}}' +
    /* flocos de neve lentos e transparentes */
    '.natal-floco{position:absolute;top:-20px;color:#fff;opacity:.0;-webkit-animation:natalCai linear infinite;animation:natalCai linear infinite}' +
    '@-webkit-keyframes natalCai{0%{-webkit-transform:translate(0,-20px);opacity:0}10%{opacity:.45}90%{opacity:.35}100%{-webkit-transform:translate(30px,105vh);opacity:0}}' +
    '@keyframes natalCai{0%{transform:translate(0,-20px);opacity:0}10%{opacity:.45}90%{opacity:.35}100%{transform:translate(30px,105vh);opacity:0}}' +
    /* mensagem discreta sob o texto principal */
    '.natal-msg{display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;margin-top:22px;font-size:1.05rem;letter-spacing:.02em;color:rgba(255,255,255,.82)}' +
    '.natal-msg svg{width:22px;height:22px;margin-right:10px;-webkit-flex:none;flex:none}' +
    '.natal-msg em{font-style:normal;color:#f6d77a;font-weight:600}' +
    'body.modo-tv .natal-msg{font-size:1.5rem}body.modo-tv .natal-msg svg{width:30px;height:30px}' +
    (calmo ? '.natal-luz,.natal-floco{-webkit-animation:none!important;animation:none!important}.natal-floco{display:none}' : '');
  var st = document.createElement('style'); st.id = 'natal-css'; st.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(st);

  function cordao() {
    var cores = ['#f6c453', '#e05a5a', '#5fc48a', '#7fb8f0'];
    var n = 22, w = 1000, svg = '<svg class="natal-cordao" viewBox="0 0 ' + w + ' 46" preserveAspectRatio="none" aria-hidden="true">';
    var fio = 'M0 4', i, x, y, seg = w / (n - 1);
    for (i = 1; i < n; i++) { x = i * seg; fio += ' Q' + (x - seg / 2).toFixed(1) + ' 26 ' + x.toFixed(1) + ' 4'; }
    svg += '<path d="' + fio + '" fill="none" stroke="rgba(20,40,30,.55)" stroke-width="1.6"/>';
    for (i = 0; i < n - 1; i++) {
      x = (i + 0.5) * seg; y = 15;
      var c = cores[i % cores.length], atraso = ((i * 0.37) % 3.2).toFixed(2);
      svg += '<g class="natal-luz" style="-webkit-animation-delay:-' + atraso + 's;animation-delay:-' + atraso + 's">' +
        '<rect x="' + (x - 2.5).toFixed(1) + '" y="' + (y - 2) + '" width="5" height="4" rx="1" fill="#3b4a3f"/>' +
        '<ellipse cx="' + x.toFixed(1) + '" cy="' + (y + 7) + '" rx="4" ry="6.5" fill="' + c + '"/>' +
        '<ellipse cx="' + x.toFixed(1) + '" cy="' + (y + 7) + '" rx="9" ry="11" fill="' + c + '" opacity=".18"/></g>';
    }
    return svg + '</svg>';
  }

  function montar() {
    if (document.getElementById('natalCamada')) return;
    var camada = document.createElement('div');
    camada.className = 'natal-camada'; camada.id = 'natalCamada'; camada.setAttribute('aria-hidden', 'true');
    var h = '';   // sem cordão de luzes no topo (pedido do usuário)
    if (!calmo) {
      for (var i = 0; i < 14; i++) {
        var tam = 8 + (i * 7) % 9, esq = (i * 73) % 100, dur = 16 + (i * 5) % 12, atr = (i * 2.3) % dur;
        h += '<span class="natal-floco" style="left:' + esq + '%;font-size:' + tam + 'px;-webkit-animation-duration:' + dur + 's;animation-duration:' + dur + 's;-webkit-animation-delay:-' + atr.toFixed(1) + 's;animation-delay:-' + atr.toFixed(1) + 's">&#10052;</span>';
      }
    }
    camada.innerHTML = h;
    document.body.appendChild(camada);

    var alvo = document.querySelector('.hero-text');
    if (alvo && !document.getElementById('natalMsg')) {
      var msg = document.createElement('div');
      msg.className = 'natal-msg'; msg.id = 'natalMsg';
      msg.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.6 6.1 6.6.5-5 4.3 1.6 6.4L12 16.4l-5.8 3.4 1.6-6.4-5-4.3 6.6-.5z" fill="#f6d77a"/></svg>' +
        '<span><em>Boas Festas</em> e um próspero Ano Novo!</span>';
      alvo.appendChild(msg);
    }
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
