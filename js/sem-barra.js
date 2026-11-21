/* PLD — SÓ NO NOTEBOOK: bloqueia atalhos que poderiam mostrar o endereço do sistema
   (código-fonte, ferramentas do desenvolvedor, histórico, downloads, favoritos, imprimir, salvar,
   sair da tela cheia, menu do botão direito, abrir link em nova aba/janela, arrastar links).
   Tablets, celulares e Smart TV: não muda nada. */
(function () {
  function ehNotebook() {
    var quadro = false; try { quadro = window.self !== window.top; } catch (e) { quadro = true; }
    if (quadro) return false;
    var ua = navigator.userAgent || '';
    if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|AFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(ua)) return false;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
    try { if (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches) return false; } catch (e) {}
    var fino = false; try { fino = window.matchMedia('(any-pointer: fine)').matches; } catch (e) {}
    return fino;
  }
  if (!ehNotebook()) return;

  function parar(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); return false; }
  function campo(el) {
    return el && el.closest && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  }

  // Teclas
  window.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase(), c = e.keyCode, ctrl = e.ctrlKey || e.metaKey;
    if (c === 123 || k === 'f12') return parar(e);                         // F12 (desenvolvedor)
    if (c === 122 || k === 'f11') return parar(e);                         // F11 (sair da tela cheia)
    if (c === 121 || k === 'f10') return parar(e);                         // F10 (menu)
    if (e.altKey && !ctrl && (k === 'f' || k === 'e' || k === 'd' || k === 'home' || k === 'arrowleft' || k === 'arrowright')) return parar(e);
    if (ctrl && e.shiftKey && 'ijckobdmn'.indexOf(k) >= 0 && k.length === 1) return parar(e);   // ferramentas, favoritos, limpar dados...
    if (ctrl && e.shiftKey && (k === 'delete' || c === 46)) return parar(e);
    if (ctrl && !e.shiftKey && 'uhjsdpgtnlek'.indexOf(k) >= 0 && k.length === 1) return parar(e); // código-fonte, histórico, downloads, salvar, favoritos, imprimir, abrir janela/aba, endereço
  }, true);

  // Botão direito (menu com "Abrir em nova aba", "Inspecionar", "Exibir código-fonte"...) — liberado só dentro de campos de texto
  window.addEventListener('contextmenu', function (e) { if (!campo(e.target)) return parar(e); }, true);

  // Ctrl/Shift/meio + clique em link abriria nova aba/janela com barra: abre na mesma janela
  function linkDe(e) { return e.target && e.target.closest ? e.target.closest('a[href]') : null; }
  window.addEventListener('click', function (e) {
    var a = linkDe(e); if (!a) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) { parar(e); return; }
  }, true);
  window.addEventListener('auxclick', function (e) { if (e.button === 1 && linkDe(e)) parar(e); }, true);
  window.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); }, true);   // rolagem automática do botão do meio

  // Botão discreto "Reiniciar o sistema" (canto superior esquerdo): recarrega a página quando travar ou ficar lento
  function criarReiniciar() {
    if (!document.body || document.getElementById('pldReiniciar')) return;
    var st = document.createElement('style');
    st.textContent =
      '#pldReiniciar{position:fixed;top:4px;left:4px;z-index:2147483647;width:22px;height:22px;padding:0;margin:0;border:0;' +
      'border-radius:50%;background:rgba(15,23,42,.55);color:#e5e7eb;cursor:pointer;opacity:.35;display:flex;' +
      'align-items:center;justify-content:center;transition:opacity .2s,background .2s}' +
      '#pldReiniciar:hover,#pldReiniciar:focus-visible{opacity:1;background:rgba(15,23,42,.9);outline:none}' +
      '#pldReiniciar svg{width:13px;height:13px;display:block}' +
      '#pldReiniciar.gira svg{animation:pldGira .7s linear infinite}' +
      '@keyframes pldGira{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'pldReiniciar'; b.type = 'button';
    b.title = 'Reiniciar o sistema'; b.setAttribute('aria-label', 'Reiniciar o sistema');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      b.className = 'gira';
      setTimeout(function () { location.reload(); }, 150);
    }, true);
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', criarReiniciar);
  else criarReiniciar();
  window.addEventListener('load', criarReiniciar);

  // Arrastar link/imagem para fora (abriria em outra janela)
  window.addEventListener('dragstart', function (e) {
    var t = e.target; if (t && (t.tagName === 'A' || t.tagName === 'IMG' || (t.closest && t.closest('a[href]')))) parar(e);
  }, true);
})();
