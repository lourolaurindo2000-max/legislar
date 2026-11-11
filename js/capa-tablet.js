/* PLD — Tablets dos vereadores sempre em tela cheia (sessão real)
 *
 * Quando o Modo de ensaio é DESLIGADO, cada tablet mostra uma capa "Toque para começar".
 * O navegador só deixa entrar em tela cheia depois de um toque — o toque na capa ativa a tela cheia.
 * Se o tablet sair da tela cheia (gesto de voltar do Android), a capa aparece de novo.
 * Instalado como aplicativo (manifest.json) já fica em tela cheia e a capa não aparece.
 * Só age em tablet/celular (toque sem mouse), fora de iframe. ES5 (a Smart TV também carrega a página).
 */
(function () {
  var W = window, D = document;
  var tablet = false;
  try { tablet = navigator.maxTouchPoints > 0 && (!W.matchMedia('(any-pointer: fine)').matches || W.matchMedia('(pointer: coarse)').matches || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent || '')) && W.top === W; } catch (e) {}
  W.CapaTablet = { set: function () {}, ativo: function () { return false; } };
  if (!tablet) return;

  function comoApp() {
    try { return W.matchMedia('(display-mode: fullscreen)').matches || W.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; }
  }
  function cheia() { return comoApp() || !!(D.fullscreenElement || D.webkitFullscreenElement); }
  var el = D.documentElement;
  var podeCheia = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  // Na Votação (script com data-sempre="1") a capa aparece SEMPRE ao abrir a página, em todos os tablets,
  // mesmo com Modo de ensaio ligado, já em tela cheia ou instalado como app — padrão igual para todos.
  var tag = D.querySelector('script[src*="capa-tablet.js"]');
  var sempre = !!(tag && tag.getAttribute('data-sempre') === '1');
  var entrou = false;

  // último estado conhecido do ensaio (para a capa aparecer já ao abrir a página)
  var ensaio = null;
  try { var g = localStorage.getItem('pld_ensaio'); if (g === '0') ensaio = false; else if (g === '1') ensaio = true; } catch (e) {}

  var css = '#pldCapa{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;' +
    'background:radial-gradient(ellipse at 50% 35%,#16335e 0%,#0B2545 55%,#06162b 100%);color:#fff;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;padding:24px}' +
    '#pldCapa.on{display:flex}' +
    '#pldCapa img{width:150px;height:150px;object-fit:contain;filter:drop-shadow(0 10px 28px rgba(0,0,0,.45));margin-bottom:22px}' +
    '#pldCapa small{display:block;color:#e6b955;letter-spacing:.22em;text-transform:uppercase;font-weight:700;font-size:.85rem;margin-bottom:8px}' +
    '#pldCapa b{display:block;font-size:2rem;font-weight:800;line-height:1.15}' +
    '#pldCapa .ln{width:90px;height:3px;background:#e6b955;border-radius:3px;margin:20px auto}' +
    '#pldCapa .bt{display:inline-block;margin-top:6px;padding:16px 34px;border-radius:999px;background:#e6b955;color:#0B2545;font-weight:800;font-size:1.15rem;box-shadow:0 10px 30px rgba(230,185,85,.35);animation:pldPulso 2s ease-in-out infinite}' +
    '#pldCapa p{margin:18px 0 0;color:rgba(255,255,255,.65);font-size:.95rem}' +
    '@keyframes pldPulso{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}';
  var st = D.createElement('style'); st.textContent = css; (D.head || el).appendChild(st);

  var capa = null;
  function criar() {
    if (capa || !D.body) return;
    var raiz = (D.querySelector('script[src*="capa-tablet.js"]') || {}).src || '';
    raiz = raiz.replace(/js\/capa-tablet\.js.*$/, '');
    capa = D.createElement('div');
    capa.id = 'pldCapa';
    capa.setAttribute('role', 'button');
    capa.setAttribute('aria-label', 'Toque para começar');
    capa.innerHTML = '<img src="' + raiz + 'img/brasao.png" alt="">' +
      '<small>Câmara Municipal de Almadina</small><b>Plenário Jonas Plínio</b><div class="ln"></div>' +
      '<span class="bt">Toque para começar</span><p>Votação Plenária</p>';
    function tocar(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      entrou = true;
      if (cheia()) { capa.className = ''; return; }
      try {
        var r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
        if (r && r['catch']) r['catch'](function () {});
      } catch (x) {}
      capa.className = '';
    }
    capa.addEventListener('click', tocar, true);
    capa.addEventListener('touchend', tocar, true);
    D.body.appendChild(capa);
  }

  function avaliar() {
    criar();
    if (!capa) return;
    var mostrar = (sempre && !entrou) || (ensaio === false && podeCheia && !cheia());
    capa.className = mostrar ? 'on' : '';
    el.className = el.className.replace(/\s*\bsessao-real\b/g, '') + (ensaio === false ? ' sessao-real' : '');
  }

  D.addEventListener('fullscreenchange', avaliar);
  D.addEventListener('webkitfullscreenchange', avaliar);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', avaliar); else avaliar();

  W.CapaTablet = {
    set: function (ligado) {
      ensaio = !!ligado;
      try { localStorage.setItem('pld_ensaio', ensaio ? '1' : '0'); } catch (e) {}
      avaliar();
    },
    ativo: function () { return !!(capa && capa.className === 'on'); }
  };
})();
