/* PLD — Acesso restrito ao Operador (login em index.html)
 * Notebook e tablets: sem login válido, a página volta para a tela "Acesso à Plenário".
 * Smart TV (dentro do quadro da TV, navegador de TV, ou marcada como TV sem toque): entra sem login.
 * O login vale 12 horas neste aparelho (os cards do dashboard abrem em abas novas).
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

  function logado() {
    try {
      var t = parseInt(localStorage.getItem(CHAVE), 10);
      return t > 0 && (new Date().getTime() - t) < VALIDADE;
    } catch (e) { return false; }
  }

  W.PldLogin = {
    smartTV: ehSmartTV,
    logado: logado,
    entrar: function () { try { localStorage.setItem(CHAVE, String(new Date().getTime())); } catch (e) {} },
    sair: function () { try { localStorage.removeItem(CHAVE); } catch (e) {} }
  };

  // Na própria tela de login não bloqueia
  if (/(^|\/)(index\.html)?$/i.test(location.pathname)) return;
  if (ehSmartTV() || logado()) return;

  var volta = location.pathname.replace(/^.*\//, '') + location.search + location.hash;
  try { document.documentElement.style.visibility = 'hidden'; } catch (e) {}
  location.replace('index.html?volta=' + encodeURIComponent(volta));
})();
