/* Visualizador de documentos do Plenário (Votação, Dashboard e Presença).
   Abre o arquivo enviado pela Mesa para LEITURA na própria tela, sem baixar.
   PDF: desenhado página por página com o PDF.js (funciona em tablets Android, iPad, notebook e TV).
   Imagens e textos também abrem. Outros formatos (Word etc.) mostram um aviso.
   Uso: VerDoc.abrir(dataUrl, nome, tipo) */
(function () {
  if (window.VerDoc) return;
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var carregando = null, ov = null, corpo = null, titulo = null, info = null, zoom = 1, docAtual = null, renderId = 0;

  function css() {
    if (document.getElementById('verdoc-css')) return;
    var st = document.createElement('style'); st.id = 'verdoc-css';
    st.textContent =
      '.verdoc{position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(6,10,22,.94);display:flex;flex-direction:column;font-family:"Segoe UI",system-ui,sans-serif;color:#eef1f8}' +
      '.verdoc-top{display:flex;align-items:center;padding:10px 14px;background:#0f1730;border-bottom:1px solid rgba(230,185,85,.35)}' +
      '.verdoc-top .t{flex:1;min-width:0;margin-right:10px}' +
      '.verdoc-top .t b{display:block;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.verdoc-top .t small{color:#9aa4bf;font-size:.82rem}' +
      '.verdoc-top button{font:inherit;font-weight:700;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;min-width:46px;min-height:46px;padding:6px 12px;margin-left:8px;cursor:pointer;touch-action:manipulation}' +
      '.verdoc-top .fechar{background:#e6b955;color:#1d1405;border-color:#e6b955}' +
      '.verdoc-corpo{flex:1;overflow-y:scroll;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:16px;text-align:center}' +
      '.verdoc-corpo canvas,.verdoc-corpo img{display:block;margin:0 auto 14px;max-width:none;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.5);border-radius:4px}' +
      '.verdoc-corpo img{max-width:100%}' +
      '.verdoc-corpo pre{white-space:pre-wrap;text-align:left;background:#fff;color:#111;padding:20px;border-radius:6px;max-width:900px;margin:0 auto;font-size:1rem;line-height:1.5}' +
      '.verdoc-msg{max-width:560px;margin:60px auto;font-size:1.1rem;line-height:1.5;color:#dfe4f2}' +
      '.verdoc-msg b{color:#e6b955}';
    document.head.appendChild(st);
  }
  function montar() {
    if (ov) return;
    css();
    ov = document.createElement('div'); ov.className = 'verdoc'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="verdoc-top"><div class="t"><b></b><small></small></div>' +
      '<button type="button" data-z="-" aria-label="Diminuir">A−</button><button type="button" data-z="+" aria-label="Aumentar">A+</button>' +
      '<button type="button" class="fechar" aria-label="Fechar">Fechar ✕</button></div><div class="verdoc-corpo"></div>';
    document.body.appendChild(ov);
    corpo = ov.querySelector('.verdoc-corpo'); titulo = ov.querySelector('.t b'); info = ov.querySelector('.t small');
    ov.querySelector('.fechar').onclick = fechar;
    ov.querySelector('[data-z="+"]').onclick = function () { mudarZoom(1.25); };
    ov.querySelector('[data-z="-"]').onclick = function () { mudarZoom(0.8); };
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // sem "salvar imagem/arquivo"
    document.addEventListener('keydown', function (e) { if (ov && ov.style.display !== 'none' && (e.key === 'Escape' || e.keyCode === 27)) fechar(); });
  }
  function fechar() { renderId++; docAtual = null; if (ov) { ov.style.display = 'none'; corpo.innerHTML = ''; } document.documentElement.style.overflow = ''; }
  function msg(html) { corpo.innerHTML = '<div class="verdoc-msg">' + html + '</div>'; }
  function bytes(dataUrl) {
    var i = dataUrl.indexOf(','), bin = atob(dataUrl.slice(i + 1)), n = bin.length, arr = new Uint8Array(n);
    for (var k = 0; k < n; k++) arr[k] = bin.charCodeAt(k);
    return arr;
  }
  function carregarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (carregando) return carregando;
    carregando = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = PDFJS;
      s.onload = function () {
        if (!window.pdfjsLib) return rej(new Error('pdfjs'));
        // o navegador não deixa abrir um "worker" direto de outro site: cria um local que importa o do cdnjs
        var src = WORKER;
        try { src = URL.createObjectURL(new Blob(["importScripts('" + WORKER + "');"], { type: 'application/javascript' })); } catch (e) {}
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = src;
        res(window.pdfjsLib);
      };
      s.onerror = function () { carregando = null; rej(new Error('pdfjs')); };
      document.head.appendChild(s);
    });
    return carregando;
  }
  function desenharPdf() {
    if (!docAtual) return;
    var meu = ++renderId, doc = docAtual;
    corpo.innerHTML = '';
    var largura = Math.max(280, (corpo.clientWidth || window.innerWidth) - 32);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var n = 1;
    function proxima() {
      if (meu !== renderId || n > doc.numPages) return;
      doc.getPage(n).then(function (pg) {
        if (meu !== renderId) return;
        var v1 = pg.getViewport({ scale: 1 });
        var escala = (largura / v1.width) * zoom;
        var vp = pg.getViewport({ scale: escala * dpr });
        var c = document.createElement('canvas');
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        c.style.width = Math.floor(vp.width / dpr) + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px';
        corpo.appendChild(c);
        return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }).then(function () { n++; proxima(); }, function () { n++; proxima(); });
    }
    proxima();
  }
  function mudarZoom(f) {
    zoom = Math.max(0.5, Math.min(3, zoom * f));
    if (docAtual) desenharPdf();
    else { var im = corpo.querySelector('img'); if (im) im.style.width = Math.round(zoom * 100) + '%', im.style.maxWidth = 'none'; var pre = corpo.querySelector('pre'); if (pre) pre.style.fontSize = zoom + 'rem'; }
  }

  window.VerDoc = {
    abrir: function (dataUrl, nome, tipo) {
      montar(); renderId++; docAtual = null; zoom = 1;
      ov.style.display = 'flex'; document.documentElement.style.overflow = 'hidden';
      titulo.textContent = nome || 'Documento'; info.textContent = 'Somente leitura';
      tipo = tipo || (dataUrl.slice(5, dataUrl.indexOf(';')) || '');
      var ext = ((nome || '').split('.').pop() || '').toLowerCase();
      if (tipo === 'application/pdf' || ext === 'pdf') {
        msg('Abrindo o documento…');
        carregarPdfJs().then(function (lib) {
          return lib.getDocument({ data: bytes(dataUrl) }).promise;
        }).then(function (doc) {
          docAtual = doc; info.textContent = doc.numPages + (doc.numPages > 1 ? ' páginas' : ' página') + ' · somente leitura';
          desenharPdf();
        }).catch(function () { msg('Não foi possível abrir este PDF. Verifique a internet e tente de novo.'); });
      } else if (/^image\//.test(tipo) || /^(png|jpe?g|gif|webp|bmp)$/.test(ext)) {
        corpo.innerHTML = ''; var im = new Image(); im.alt = nome || ''; im.src = dataUrl; corpo.appendChild(im);
      } else if (/^text\//.test(tipo) || ext === 'txt') {
        var txt = ''; try { txt = decodeURIComponent(escape(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)))); } catch (e) { txt = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)); }
        corpo.innerHTML = ''; var pre = document.createElement('pre'); pre.textContent = txt; corpo.appendChild(pre);
      } else {
        msg('Este tipo de arquivo (<b>.' + (ext || '?') + '</b>) não pode ser aberto para leitura na tela.<br><br>Peça à Mesa para enviar o documento em <b>PDF</b>.');
      }
    },
    fechar: fechar
  };
  window.addEventListener('resize', function () { if (docAtual && ov && ov.style.display !== 'none') desenharPdf(); });
})();
