/* Sair da página: SÓ NO NOTEBOOK fecha esta aba (aberta pelo cartão do Legislar) e volta para a aba do Legislar.
   Tablets, celulares e Smart TV continuam como antes: vão para o dashboard nesta mesma aba.
   Se o navegador não deixar fechar a aba, volta para o dashboard nesta mesma aba. */
(function () {
  function ehNotebook() {
    var quadro = false; try { quadro = window.self !== window.top; } catch (e) { quadro = true; }
    if (quadro) return false;
    if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|AFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent)) return false;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return false;
    var fino = false; try { fino = window.matchMedia('(any-pointer: fine)').matches; } catch (e) {}
    return fino;
  }
  window.pldSairAba = function () {
    if (!ehNotebook() || !window.opener) { location.href = 'dashboard.html'; return; }   // aberto na mesma janela: só volta ao painel
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(function () { if (!window.closed) location.replace('dashboard.html'); }, 300);
  };
})();
