/* Sair da página no notebook: fecha esta aba (aberta pelo cartão do Legislar) e volta para a aba do Legislar.
   Se o navegador não deixar fechar (página não foi aberta em aba nova), volta para o dashboard nesta mesma aba. */
(function () {
  window.pldSairAba = function () {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(function () { if (!window.closed) location.replace('dashboard.html'); }, 300);
  };
})();
