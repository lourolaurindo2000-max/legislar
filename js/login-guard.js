/* PLD — Acesso restrito ao Operador (login em index.html)
 * Notebook e tablets: sem login válido, a página volta para a tela "Acesso à Plenário".
 * Smart TV (dentro do quadro da TV, navegador de TV, ou marcada como TV sem toque): entra sem login.
 * O login vale 12 horas neste aparelho (os cards do dashboard abrem em abas novas).
 * Celular: o login não fica guardado — sempre que sair do Legislar, pede usuário e senha de novo.
 * ES5 — a Smart TV antiga também carrega este arquivo.
 */
(function () {
  var W = window;
  var CHAVE = 'pld_login', VALIDADE = 12 * 60 * 60 * 1000;

  function ehSmartTV() {
    try { if (W.top !== W) return true; } catch (e) { return true; }
    var ua = navigator.userAgent || '';
    if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(ua)) return true;
    try { if (localStorage.getItem('pld_tv') === '1' && !(navigator.maxTouchPoints > 0)) return true; } catch (e) {}
    return false;
  }

  // Celular (tela pequena com toque): o vereador entra com nome + senha nas páginas pessoais
  function ehCelular() {
    try {
      if (!(navigator.maxTouchPoints > 0)) return false;
      if (/iPhone|iPod/i.test(navigator.userAgent || '')) return true;
      return Math.min(screen.width, screen.height) < 600;
    } catch (e) { return false; }
  }

  // No celular o login NÃO fica guardado: vale só enquanto o Legislar está aberto.
  // Saiu do aplicativo (outro app, tela bloqueada, fechou, reiniciou) → pede usuário e senha de novo.
  var CEL = ehCelular() && !ehSmartTV();
  var SAIU = 'pld_saiu', TOLERANCIA = 8000; // 8 s cobre a troca normal entre páginas do Legislar

  function agora() { return new Date().getTime(); }

  if (CEL) { try { localStorage.removeItem(CHAVE); } catch (e) {} }

  function logado() {
    try {
      var t = parseInt((CEL ? sessionStorage : localStorage).getItem(CHAVE), 10);
      return t > 0 && (agora() - t) < VALIDADE;
    } catch (e) { return false; }
  }

  function sair() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
    try { sessionStorage.removeItem(CHAVE); } catch (e) {}
  }

  W.PldLogin = {
    smartTV: ehSmartTV,
    celular: ehCelular,
    logado: logado,
    entrar: function () {
      try {
        if (CEL) { sessionStorage.setItem(CHAVE, String(agora())); sessionStorage.removeItem(SAIU); }
        else localStorage.setItem(CHAVE, String(agora()));
      } catch (e) {}
    },
    sair: sair
  };

  var ehIndex = /(^|\/)(index\.html)?$/i.test(location.pathname);
  var ehPessoal = /(^|\/)(anotacoes|arquivos_diversos)\.html$/i.test(location.pathname);

  function irParaLogin() {
    var volta = location.pathname.replace(/^.*\//, '') + location.search + location.hash;
    try { document.documentElement.style.visibility = 'hidden'; } catch (e) {}
    location.replace('index.html?volta=' + encodeURIComponent(volta));
  }

  if (CEL) {
    var marcarSaida = function () { try { sessionStorage.setItem(SAIU, String(agora())); } catch (e) {} };
    // Voltou ao Legislar depois de sair: tranca de novo
    var conferirVolta = function () {
      var t = 0;
      try { t = parseInt(sessionStorage.getItem(SAIU), 10) || 0; sessionStorage.removeItem(SAIU); } catch (e) {}
      if (!t || agora() - t < TOLERANCIA) return false;
      sair();
      if (ehIndex) return false;
      // Anotações/Arquivos: recarrega para pedir de novo a senha do vereador
      if (ehPessoal) { try { document.documentElement.style.visibility = 'hidden'; } catch (e) {} location.reload(); }
      else irParaLogin();
      return true;
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') marcarSaida(); else conferirVolta();
    });
    W.addEventListener('pagehide', marcarSaida);
    W.addEventListener('pageshow', function (ev) { if (ev && ev.persisted) conferirVolta(); });
    if (conferirVolta()) return;
  }

  // Na própria tela de login não bloqueia
  if (ehIndex) return;
  if (ehSmartTV() || logado()) return;
  if (ehCelular() && ehPessoal) return;

  irParaLogin();
})();
