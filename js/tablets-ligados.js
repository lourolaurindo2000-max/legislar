/* Tablets ligados (ES5)
   - TABLETS (todas as páginas que carregam este arquivo): avisam que estão ligados em
     legislar/tablets/online/{dev} = {pagina, em, visivel, bateria, carregando}  (some sozinho quando a conexão cai)
     e obedecem ao comando do operador em legislar/tablets/comandos/{dev} ou /todos = {acao:'desligar', em, id}:
     saem da tela cheia, param de manter a tela acesa e vão para desligado.html (tela preta, sem banco),
     então a tela apaga sozinha pelo tempo de descanso do próprio tablet.
   - NOTEBOOK DO OPERADOR (só no dashboard, script com data-painel="1"): botão discreto ⏻ abaixo do botão de tela cheia;
     abre o mapa dos 9 tablets em miniatura (vínculo da Votação: legislar/votacao/aparelhos/{vid}.dev):
     VERDE = ligado (clique → confirma → desliga), VERMELHO = desligado, AMARELO = desligando.
   - Smart TV e quadro da TV: nada acontece.
   dev = mesmo id do tablet usado pela Votação (localStorage vp_dev). */
(function () {
  var W = window, D = document;
  if (W.__tlCarregado) return;
  W.__tlCarregado = true;

  var scriptAtual = D.currentScript || (function () { var s = D.getElementsByTagName('script'); return s[s.length - 1]; })();
  var querPainel = !!(scriptAtual && scriptAtual.getAttribute('data-painel') === '1');

  var UA = navigator.userAgent || '';
  var TV_RE = /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i;
  var emQuadro = false; try { emQuadro = W.self !== W.top; } catch (e) { emQuadro = true; }

  function mm(q) { try { return W.matchMedia(q).matches; } catch (e) { return false; } }
  var papel = '';
  if (!emQuadro && !TV_RE.test(UA)) {
    if (navigator.maxTouchPoints > 0 && (!mm('(any-pointer: fine)') || mm('(pointer: coarse)') || /Android|iPad|iPhone|Mobile/i.test(UA))) papel = 'tablet';
    else if (!/Android|iPhone|iPad|iPod|Mobile/i.test(UA) && mm('(any-pointer: fine)')) papel = 'notebook';
  }
  if (W.__TL_PAPEL) papel = W.__TL_PAPEL;          // só para teste automatizado
  if (papel === 'notebook' && !querPainel) return;
  if (!papel || typeof firebase === 'undefined') return;

  var RAIZ = (W.__TL_RAIZ || 'legislar') + '/tablets';
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp({
      apiKey: 'AIzaSyAHawTmb2za8y2Eq70FWejq64-5J6Pbqfo',
      authDomain: 'projeto-teste-f08c4.firebaseapp.com',
      databaseURL: 'https://projeto-teste-f08c4-default-rtdb.firebaseio.com',
      projectId: 'projeto-teste-f08c4',
      storageBucket: 'projeto-teste-f08c4.firebasestorage.app',
      messagingSenderId: '788863562302',
      appId: '1:788863562302:web:2ddcfb6c2c892770de976f'
    });
  } catch (e) {}
  var db; try { db = firebase.database(); } catch (e) { return; }
  var TS = firebase.database.ServerValue.TIMESTAMP;
  var offset = 0, offsetOk = false, aoAcertarHora = [];
  try { db.ref('.info/serverTimeOffset').on('value', function (s) {
    offset = s.val() || 0; offsetOk = true;
    var f = aoAcertarHora; aoAcertarHora = []; for (var i = 0; i < f.length; i++) f[i]();
  }); } catch (e) {}
  function agora() { return Date.now() + offset; }

  if (papel === 'tablet') tablet(); else painel();

  /* ====================== TABLET ====================== */
  function tablet() {
    var dev = '';
    try { dev = localStorage.getItem('vp_dev') || ''; } catch (e) {}
    if (!dev) {
      dev = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem('vp_dev', dev); } catch (e) {}
    }
    var meu = db.ref(RAIZ + '/online/' + dev);
    var pagina = (location.pathname.split('/').pop() || 'dashboard.html') + (location.hash || '');
    var bat = null, carregando = null, desligando = false, conectado = false;

    function enviar() {
      if (desligando || !conectado) return;
      var d = { pagina: pagina, em: TS, visivel: D.visibilityState !== 'hidden' };
      if (bat !== null) { d.bateria = bat; d.carregando = !!carregando; }
      try { meu.set(d); } catch (e) {}
    }
    try {
      db.ref('.info/connected').on('value', function (s) {
        conectado = s.val() === true;
        if (!conectado || desligando) return;
        try { meu.onDisconnect().remove(); } catch (e) {}
        enviar();
      });
    } catch (e) {}
    setInterval(enviar, 60000);
    D.addEventListener('visibilitychange', enviar);
    W.addEventListener('hashchange', function () { pagina = (location.pathname.split('/').pop() || 'dashboard.html') + (location.hash || ''); enviar(); });
    try {
      if (navigator.getBattery) navigator.getBattery().then(function (b) {
        function ler() { bat = Math.round(b.level * 100); carregando = b.charging; enviar(); }
        ler(); b.addEventListener('levelchange', ler); b.addEventListener('chargingchange', ler);
      }, function () {});
    } catch (e) {}

    // Comandos: só valem se foram dados DEPOIS que esta página abriu (hora do servidor) e ainda não foram cumpridos aqui.
    // Assim, quem liga o tablet de novo depois do "Desligar todos" não é desligado outra vez.
    var abriuLocal = Date.now();
    function avaliar(c) {
      if (!c || c.acao !== 'desligar' || !c.id || desligando || typeof c.em !== 'number') return;
      if (!offsetOk) { aoAcertarHora.push(function () { avaliar(c); }); return; }
      if (c.em < abriuLocal + offset - 2000) return;
      var feito = ''; try { feito = localStorage.getItem('tl_feito') || ''; } catch (e) {}
      if (feito.indexOf('|' + c.id + '|') >= 0) return;
      try { localStorage.setItem('tl_feito', ('|' + c.id + '|' + feito).slice(0, 400)); } catch (e) {}
      desligar();
    }
    function ouvir(caminho) {
      db.ref(RAIZ + '/comandos/' + caminho).on('value', function (s) { avaliar(s.val()); });
    }
    ouvir(dev);
    ouvir('todos');

    function desligar() {
      desligando = true;
      // a Votação guarda a trava de tela acesa em "wakeLock"; ao sair da página o navegador solta as demais
      try { if (typeof wakeLock !== 'undefined' && wakeLock && wakeLock.release) wakeLock.release(); } catch (e) {}
      try {
        if (D.fullscreenElement && D.exitFullscreen) D.exitFullscreen();
        else if (D.webkitFullscreenElement && D.webkitExitFullscreen) D.webkitExitFullscreen();
      } catch (e) {}
      var foi = false;
      function sair() {
        if (foi) return; foi = true;
        try { db.goOffline(); } catch (e) {}
        try { W.close(); } catch (e) {}
        setTimeout(function () { if (!W.closed) location.replace('desligado.html'); }, 300);
      }
      try { meu.remove().then(sair, sair); } catch (e) { sair(); }
      setTimeout(sair, 1500);   // sem resposta do banco: sai assim mesmo
    }
    W.__tlDev = dev;
  }

  /* ====================== NOTEBOOK (mapa dos 9 tablets, do operador) ====================== */
  function painel() {
    // ordem dos aparelhos igual à Votação (ids v1..v9 seguem a pessoa)
    var VERS = [
      { id: 'v1', ap: 1, nome: 'Jackson Costa' }, { id: 'v4', ap: 2, nome: 'Marilene Santos' }, { id: 'v5', ap: 3, nome: 'Nilza Damasceno' },
      { id: 'v9', ap: 4, nome: 'Wilson Freitas' }, { id: 'v6', ap: 5, nome: 'Rogério Gotado' }, { id: 'v2', ap: 6, nome: 'Dilson Junior' },
      { id: 'v3', ap: 7, nome: 'Lucas Cavalcante' }, { id: 'v7', ap: 8, nome: 'Sylas Souza' }, { id: 'v8', ap: 9, nome: 'José Lindomar' }
    ];
    var PAGS = { 'dashboard.html': 'Painel', 'votacao.html': 'Votação', 'anotacoes.html': 'Anotações', 'atas.html': 'Atas',
      'ordem_do_dia.html': 'Ordem do dia', 'arquivos_diversos.html': 'Arquivos', 'assinatura.html': 'Assinatura', 'index.html': 'Entrada' };
    var online = {}, aparelhos = {}, pedidos = {}, aberto = false;

    var css = '' +
      '#tl-btn{position:fixed;top:74px;right:22px;z-index:1000;width:36px;height:36px;border:none;border-radius:50%;cursor:pointer;' +
      'background:rgba(255,255,255,.10);color:rgba(255,255,255,.55);font-size:15px;line-height:36px;padding:0;text-align:center;transition:background .2s,color .2s}' +
      '#tl-btn:hover{background:rgba(255,255,255,.25);color:#fff}' +
      '#tl-btn b{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#16a34a;color:#fff;font:700 10px/16px Arial,sans-serif;display:none}' +
      '#tl-btn.tem b{display:block}' +
      '#tl-ov{position:fixed;left:0;top:0;right:0;bottom:0;z-index:7000;background:rgba(10,20,40,.65);display:none;align-items:center;justify-content:center;font-family:Inter,system-ui,"Segoe UI",Arial,sans-serif}' +
      '#tl-ov.on{display:flex}' +
      '#tl-cx{position:relative;background:#0f1b33;color:#fff;border:1px solid rgba(230,185,85,.45);border-radius:16px;width:min(760px,95vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.5)}' +
      '#tl-cx h3{margin:0;padding:14px 20px;font-size:17px;color:#e6b955;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center}' +
      '#tl-cx h3 span{flex:1}' +
      '#tl-cx h3 button{background:none;border:none;color:#c9d2ea;font-size:22px;cursor:pointer;line-height:1}' +
      '#tl-leg{padding:10px 20px 0;font-size:12.5px;color:#9fb0d0;text-align:center}' +
      '#tl-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 5px 0 14px;vertical-align:-1px}' +
      '#tl-mapa{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 18px;padding:16px 26px 10px;overflow:auto}' +
      /* miniatura do tablet: moldura escura, câmera, tela colorida */
      '.tl-tb{display:flex;flex-direction:column;align-items:center;user-select:none;-webkit-user-select:none}' +
      '.tl-mold{position:relative;width:100%;max-width:178px;aspect-ratio:16/11;background:linear-gradient(150deg,#3a4250,#1b2029);border-radius:14px;padding:8px 10px;box-sizing:border-box;' +
      'box-shadow:0 6px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.10);transition:transform .15s ease,box-shadow .15s ease}' +
      '.tl-mold:before{content:"";position:absolute;top:50%;left:3.5px;width:3px;height:3px;margin-top:-1.5px;border-radius:50%;background:#5b6475}' +
      '.tl-tela{position:relative;width:100%;height:100%;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;padding:4px;overflow:hidden}' +
      '.tl-tela:before{content:"";position:absolute;left:0;top:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0));pointer-events:none}' +
      '.tl-tela svg{position:relative;width:26px;height:26px;flex:0 0 auto}' +
      '.tl-tela strong{position:relative;display:block;font-size:11px;letter-spacing:.14em;margin-top:5px;font-weight:700}' +
      '.tl-tela small{position:relative;display:block;font-size:10px;margin-top:2px;line-height:1.25;opacity:.85}' +
      '.tl-tb.verde .tl-tela{background:linear-gradient(160deg,#16a34a,#15803d 60%,#166534);color:#fff}' +
      '.tl-tb.verde .tl-mold{cursor:pointer}' +
      '.tl-tb.verde .tl-mold:hover{transform:translateY(-3px);box-shadow:0 10px 20px rgba(0,0,0,.5),0 0 0 2px #22c55e,inset 0 0 0 1px rgba(255,255,255,.12)}' +
      '.tl-tb.verde .tl-mold:active{transform:translateY(0) scale(.98)}' +
      '.tl-tb.vermelho .tl-tela{background:linear-gradient(160deg,#b91c1c,#991b1b 60%,#7f1d1d);color:#fee2e2}' +
      '.tl-tb.espera .tl-tela{background:linear-gradient(160deg,#d97706,#b45309);color:#fff;animation:tl-pisca 1.2s ease-in-out infinite}' +
      '@keyframes tl-pisca{50%{opacity:.7}}' +
      '.tl-nm{margin-top:7px;font-size:13.5px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.tl-nm span{color:#e6b955;font-weight:600;margin-right:4px}' +
      '#tl-outros{padding:0 22px 6px;font-size:12.5px;color:#9fb0d0;text-align:center}' +
      '#tl-outros button{margin:4px 4px 0;border:1px solid #22c55e;background:rgba(34,197,94,.14);color:#bbf7d0;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px}' +
      '#tl-outros button:disabled{border-color:#f59e0b;color:#fcd34d;cursor:default}' +
      '.tl-pe{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid rgba(255,255,255,.1)}' +
      '.tl-pe button{border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px}' +
      '.tl-pe .tl-todos{background:transparent;color:#fca5a5;border:1px solid rgba(239,68,68,.55)}' +
      '.tl-pe .tl-todos:disabled{opacity:.35;cursor:default}' +
      '.tl-pe .tl-fechar{background:rgba(255,255,255,.1);color:#fff}' +
      '#tl-conf{position:absolute;left:0;top:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);border-radius:16px}' +
      '#tl-conf.on{display:flex}' +
      '#tl-conf div{background:#13213f;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:20px;max-width:86%;text-align:center}' +
      '#tl-conf p{margin:0 0 16px;font-size:15px;line-height:1.45}' +
      '#tl-conf button{margin:0 6px;border:none;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer}';
    var st = D.createElement('style'); st.textContent = css; D.head.appendChild(st);

    var btn = D.createElement('button');
    btn.id = 'tl-btn'; btn.type = 'button'; btn.title = 'Tablets';
    btn.innerHTML = '&#x23FB;<b></b>';
    var ov = D.createElement('div'); ov.id = 'tl-ov';
    ov.innerHTML = '<div id="tl-cx"><h3><span id="tl-tit">Tablets</span><button type="button" id="tl-x" title="Fechar">&times;</button></h3>' +
      '<div id="tl-leg"><i style="background:#16a34a;margin-left:0"></i>ligado — clique para desligar<i style="background:#b91c1c"></i>desligado<i style="background:#d97706"></i>desligando</div>' +
      '<div id="tl-mapa"></div><div id="tl-outros"></div>' +
      '<div class="tl-pe"><button type="button" class="tl-fechar" id="tl-fechar">Fechar</button><button type="button" class="tl-todos" id="tl-todos">&#x23FB; Desligar todos os ligados</button></div>' +
      '<div id="tl-conf"><div><p id="tl-conf-t"></p><button type="button" id="tl-nao" style="background:rgba(255,255,255,.12);color:#fff">Cancelar</button><button type="button" id="tl-sim" style="background:#dc2626;color:#fff">Desligar</button></div></div></div>';
    function montar() { D.body.appendChild(btn); D.body.appendChild(ov); render(); }
    if (D.body) montar(); else D.addEventListener('DOMContentLoaded', montar);

    function $(id) { return D.getElementById(id); }
    function devDe(vid) { var a = aparelhos[vid]; return a && a.dev ? a.dev : ''; }
    function ligados() { var a = []; for (var dev in online) if (online.hasOwnProperty(dev) && online[dev]) a.push(dev); return a; }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function info(d) {
      var t = PAGS[String(d.pagina || '').split('#')[0]] || 'Sistema';
      if (typeof d.bateria === 'number') t += ' · ' + d.bateria + '%' + (d.carregando ? ' ⚡' : '');
      if (d.visivel === false || agora() - (d.em || 0) > 150000) t += ' · tela apagada';
      return t;
    }

    var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>';
    function render() {
      if (!$('tl-mapa')) return;
      var lig = ligados();
      var b = btn.getElementsByTagName('b')[0];
      b.textContent = lig.length; btn.className = lig.length ? 'tem' : '';
      btn.title = lig.length ? lig.length + (lig.length === 1 ? ' tablet ligado' : ' tablets ligados') : 'Nenhum tablet ligado';
      if (!aberto) return;
      $('tl-tit').textContent = 'Tablets dos vereadores — ' + lig.length + ' ligado' + (lig.length === 1 ? '' : 's');
      $('tl-todos').disabled = !lig.length;
      var h = '', usados = {};
      for (var i = 0; i < VERS.length; i++) {
        var v = VERS[i], dev = devDe(v.id), d = dev ? online[dev] : null, cls, sub, rotulo;
        if (dev) usados[dev] = 1;
        if (d && pedidos[dev]) { cls = 'espera'; rotulo = 'DESLIGANDO'; sub = (Date.now() - pedidos[dev] > 20000) ? 'Sem resposta' : 'aguarde…'; }
        else if (d) { cls = 'verde'; rotulo = 'LIGADO'; sub = esc(info(d)); }
        else { cls = 'vermelho'; rotulo = 'DESLIGADO'; sub = dev ? '' : 'sem vínculo'; }
        h += '<div class="tl-tb ' + cls + '"><div class="tl-mold"' +
          (cls === 'verde' ? ' data-dev="' + esc(dev) + '" data-nome="' + esc(v.nome) + '" title="Clique para desligar o tablet de ' + esc(v.nome) + '"' : '') +
          '><div class="tl-tela">' + ICONE + '<strong>' + rotulo + '</strong><small>' + sub + '</small></div></div>' +
          '<div class="tl-nm"><span>' + v.ap + '</span>' + esc(v.nome) + '</div></div>';
      }
      $('tl-mapa').innerHTML = h;
      // tablets ligados que ainda não têm vereador vinculado (ninguém entrou na Votação neles)
      var o = '';
      for (var j = 0; j < lig.length; j++) if (!usados[lig[j]]) {
        var dv = lig[j], esp = !!pedidos[dv];
        o += '<button type="button" data-dev="' + esc(dv) + '" data-nome=""' + (esp ? ' disabled' : '') + '>' +
          (esp ? 'Desligando… ' : '⏻ ') + 'Aparelho ' + esc(dv.slice(-4)) + ' · ' + esc(info(online[dv])) + '</button>';
      }
      $('tl-outros').innerHTML = o ? 'Ligados sem vereador vinculado:<br>' + o : '';
    }

    function comando(caminho) {
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      return db.ref(RAIZ + '/comandos/' + caminho).set({ acao: 'desligar', em: TS, id: id });
    }
    var confirmar = null;
    function perguntar(t, f) { $('tl-conf-t').textContent = t; confirmar = f; $('tl-conf').className = 'on'; }
    function fechar() { aberto = false; ov.className = ''; $('tl-conf').className = ''; confirmar = null; }

    btn.onclick = function () { aberto = true; ov.className = 'on'; render(); };
    ov.onclick = function (e) {
      var t = e.target;
      if (t === ov || t.id === 'tl-x' || t.id === 'tl-fechar') { fechar(); return; }
      if (t.id === 'tl-nao') { $('tl-conf').className = ''; confirmar = null; return; }
      if (t.id === 'tl-sim') { $('tl-conf').className = ''; var f = confirmar; confirmar = null; if (f) f(); return; }
      if (t.id === 'tl-todos') {
        var n = ligados().length; if (!n) return;
        perguntar('Desligar ' + (n === 1 ? 'o tablet ligado' : 'os ' + n + ' tablets ligados') + '? O sistema será fechado neles.', function () {
          var a = ligados(); for (var i = 0; i < a.length; i++) pedidos[a[i]] = Date.now();
          comando('todos'); render();
        });
        return;
      }
      while (t && t !== ov && !(t.getAttribute && t.getAttribute('data-dev'))) t = t.parentNode;
      if (!t || t === ov || t.disabled) return;
      var dev = t.getAttribute('data-dev'), nome = t.getAttribute('data-nome');
      if (!online[dev] || pedidos[dev]) return;
      perguntar('Desligar o tablet de ' + (nome || 'aparelho sem vereador vinculado') + '?', function () {
        pedidos[dev] = Date.now(); comando(dev); render();
      });
    };

    db.ref(RAIZ + '/online').on('value', function (s) {
      online = s.val() || {};
      for (var k in pedidos) if (pedidos.hasOwnProperty(k) && !online[k]) delete pedidos[k];
      render();
    });
    db.ref((W.__TL_RAIZ || 'legislar') + '/votacao/aparelhos').on('value', function (s) { aparelhos = s.val() || {}; render(); });
    setInterval(render, 5000);
  }
})();
