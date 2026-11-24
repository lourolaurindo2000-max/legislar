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
  var infoBase = '', pin = null, ultToque = { t: 0, x: 0, y: 0 };
  var TOQUE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  function css() {
    if (document.getElementById('verdoc-css')) return;
    var st = document.createElement('style'); st.id = 'verdoc-css';
    st.textContent =
      '.verdoc{position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(6,10,22,.94);display:flex;flex-direction:column;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#eef1f8}' +
      '.verdoc-top{position:relative;z-index:2;display:flex;align-items:center;padding:10px 14px;background:#0f1730;border-bottom:1px solid rgba(230,185,85,.35)}' +
      '.verdoc-top .t{flex:1;min-width:0;margin-right:10px}' +
      '.verdoc-top .t b{display:block;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.verdoc-top .t small{color:#9aa4bf;font-size:.82rem}' +
      '.verdoc-top button{font:inherit;font-weight:700;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;min-width:46px;min-height:46px;padding:6px 12px;margin-left:8px;cursor:pointer;touch-action:manipulation}' +
      '.verdoc-top .fechar{background:#e6b955;color:#1d1405;border-color:#e6b955}' +
      '.verdoc-corpo{position:relative;flex:1;overflow-y:scroll;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:16px;text-align:center;touch-action:pan-x pan-y}' +
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
    gestos();
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
  // foco = posição de rolagem desejada depois de redesenhar (mantém o mesmo trecho na tela ao ampliar)
  function desenharPdf(foco) {
    if (!docAtual) return;
    var meu = ++renderId, doc = docAtual;
    var largura = Math.max(280, (corpo.clientWidth || window.innerWidth) - 32);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (zoom > 2) dpr = Math.min(dpr, 1.5);   // poupa memória do celular com zoom alto
    var ps = [];
    for (var i = 1; i <= doc.numPages; i++) ps.push(doc.getPage(i));
    Promise.all(ps).then(function (pgs) {
      if (meu !== renderId) return;
      var frag = document.createDocumentFragment(), itens = [];
      pgs.forEach(function (pg) {
        var v1 = pg.getViewport({ scale: 1 });
        var vp = pg.getViewport({ scale: (largura / v1.width) * zoom * dpr });
        var c = document.createElement('canvas');
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        c.style.width = Math.floor(vp.width / dpr) + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px';
        frag.appendChild(c); itens.push({ pg: pg, c: c, vp: vp });
      });
      corpo.innerHTML = ''; corpo.appendChild(frag); corpo.style.transform = '';
      if (foco) { corpo.scrollLeft = Math.max(0, foco.x); corpo.scrollTop = Math.max(0, foco.y); }
      // desenha primeiro a página que está na tela, depois as seguintes e por último as anteriores
      var topo = corpo.scrollTop, ini = 0;
      for (var k = 0; k < itens.length; k++) { if (itens[k].c.offsetTop + itens[k].c.offsetHeight > topo) { ini = k; break; } }
      var ordem = itens.slice(ini).concat(itens.slice(0, ini).reverse());
      function proxima() {
        if (meu !== renderId || !ordem.length) return;
        var it = ordem.shift();
        it.pg.render({ canvasContext: it.c.getContext('2d'), viewport: it.vp }).promise.then(proxima, proxima);
      }
      proxima();
    }).catch(function () { if (meu === renderId) { corpo.style.transform = ''; msg('Não foi possível abrir este PDF. Verifique a internet e tente de novo.'); } });
  }
  function mostrarZoom() {
    if (info) info.textContent = infoBase + (Math.abs(zoom - 1) > 0.01 ? ' · ' + Math.round(zoom * 100) + '%' : '');
  }
  // amplia/reduz mantendo parado o ponto (mx,my) da tela; sem ponto, usa o centro
  function zoomPara(novo, mx, my) {
    novo = Math.max(0.5, Math.min(3, novo));
    if (Math.abs(novo - zoom) < 0.01) { corpo.style.transform = ''; return; }
    if (mx == null) { mx = corpo.clientWidth / 2; my = corpo.clientHeight / 2; }
    var r = novo / zoom;
    var foco = { x: (corpo.scrollLeft + mx) * r - mx, y: (corpo.scrollTop + my) * r - my };
    zoom = novo; mostrarZoom();
    if (docAtual) { desenharPdf(foco); return; }
    corpo.style.transform = '';
    var im = corpo.querySelector('img'); if (im) { im.style.width = Math.round(zoom * 100) + '%'; im.style.maxWidth = 'none'; }
    var pre = corpo.querySelector('pre'); if (pre) pre.style.fontSize = zoom + 'rem';
    corpo.scrollLeft = Math.max(0, foco.x); corpo.scrollTop = Math.max(0, foco.y);
  }
  function mudarZoom(f) { zoomPara(zoom * f); }

  // Celular/tablet: pinça com dois dedos amplia; toque duplo alterna 100% ↔ 200%
  function gestos() {
    function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy) || 1; }
    corpo.addEventListener('touchstart', function (e) {
      var r = corpo.getBoundingClientRect();
      if (e.touches.length === 2) {
        e.preventDefault();
        pin = { d0: dist(e.touches), s: 1,
          mx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
          my: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top };
        corpo.style.transformOrigin = pin.mx + 'px ' + pin.my + 'px';
        ultToque.t = 0;
      } else if (e.touches.length === 1 && !pin) {
        var t = e.touches[0], agora = Date.now();
        if (agora - ultToque.t < 320 && Math.abs(t.clientX - ultToque.x) < 40 && Math.abs(t.clientY - ultToque.y) < 40) {
          e.preventDefault(); ultToque.t = 0;
          zoomPara(zoom > 1.05 ? 1 : 2, t.clientX - r.left, t.clientY - r.top);
        } else ultToque = { t: agora, x: t.clientX, y: t.clientY };
      }
    }, { passive: false });
    corpo.addEventListener('touchmove', function (e) {
      if (!pin || e.touches.length < 2) return;
      e.preventDefault();
      var s = dist(e.touches) / pin.d0;
      s = Math.max(0.5 / zoom, Math.min(3 / zoom, s));
      pin.s = s; corpo.style.transform = 'scale(' + s + ')';   // prévia instantânea; redesenha nítido ao soltar
    }, { passive: false });
    function soltar(e) {
      if (!pin || e.touches.length >= 2) return;
      var p = pin; pin = null;
      zoomPara(zoom * p.s, p.mx, p.my);
    }
    corpo.addEventListener('touchend', soltar);
    corpo.addEventListener('touchcancel', soltar);
    // iPhone/iPad: impede o zoom da página inteira por cima do visualizador
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { ov.addEventListener(n, function (e) { e.preventDefault(); }); });
  }

  window.VerDoc = {
    abrir: function (dataUrl, nome, tipo) {
      montar(); renderId++; docAtual = null; zoom = 1;
      ov.style.display = 'flex'; document.documentElement.style.overflow = 'hidden';
      titulo.textContent = nome || 'Documento'; corpo.style.transform = ''; pin = null;
      infoBase = 'Somente leitura' + (TOQUE ? ' · use dois dedos para ampliar' : ''); mostrarZoom();
      tipo = tipo || (dataUrl.slice(5, dataUrl.indexOf(';')) || '');
      var ext = ((nome || '').split('.').pop() || '').toLowerCase();
      if (tipo === 'application/pdf' || ext === 'pdf') {
        msg('Abrindo o documento…');
        carregarPdfJs().then(function (lib) {
          return lib.getDocument({ data: bytes(dataUrl) }).promise;
        }).then(function (doc) {
          docAtual = doc; infoBase = doc.numPages + (doc.numPages > 1 ? ' páginas' : ' página') + (TOQUE ? ' · dois dedos ampliam' : ' · somente leitura'); mostrarZoom();
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
  window.addEventListener('resize', function () { if (docAtual && ov && ov.style.display !== 'none' && !pin) desenharPdf({ x: corpo.scrollLeft, y: corpo.scrollTop }); });
})();
