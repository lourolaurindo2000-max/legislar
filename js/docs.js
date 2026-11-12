/* Documentos do Plenário no Firebase (ES5): Ordem do Dia, Atas / Proposições e Arquivos Diversos.
   Cada página define window.DOCCFG = { secao, titulo, item, anoData, pessoal } e carrega este arquivo.
   Dados: legislar/docs/{secao}/itens/{id} = {nome,tamanho,partes,tipo,criadoEm,ano?,data?,dono?,por?}
          legislar/docs/{secao}/arquivos/{id}/{i} = base64 em partes de 1 MB (até 20 MB por PDF).
   Notebook (Mesa) = envia, edita e apaga. Tablet = lê (Ver abre no VerDoc, sem baixar).
   pessoal (Arquivos Diversos): no tablet o vereador entra com a mesma senha de Anotações
   (legislar/anotacoes/senhas) e vê só os documentos dele ou "para todos"; pode enviar os próprios. */
(function () {
  'use strict';
  var CFG = window.DOCCFG || {};
  var RAIZ = window.__DOC_RAIZ || 'legislar';
  var BASE = RAIZ + '/docs/' + CFG.secao;
  var PARTE = 1000000, LIMITE = 20 * 1024 * 1024, VISTO = 'doc_visto_' + CFG.secao;
  var ITEM = CFG.item || 'documento';
  var VERS = [
    { id: 'v1', nome: 'Jackson Costa', ap: 1 }, { id: 'v4', nome: 'Marilene Santos', ap: 2 }, { id: 'v5', nome: 'Nilza Damasceno', ap: 3 },
    { id: 'v9', nome: 'Wilson Freitas', ap: 4 }, { id: 'v6', nome: 'Rogério Gotado', ap: 5 }, { id: 'v2', nome: 'Dilson Junior', ap: 6 },
    { id: 'v3', nome: 'Lucas Cavalcante', ap: 7 }, { id: 'v7', nome: 'Sylas Souza', ap: 8 }, { id: 'v8', nome: 'José Lindomar', ap: 9 }
  ];
  var NOME = {}; VERS.forEach(function (v) { NOME[v.id] = v.nome; });

  var EH_TABLET = false;
  try { EH_TABLET = navigator.maxTouchPoints > 0 && (!matchMedia('(any-pointer: fine)').matches || matchMedia('(pointer: coarse)').matches || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent || '')); } catch (e) {}
  if (window.__DOC_TABLET !== undefined) EH_TABLET = !!window.__DOC_TABLET;   // só para teste automatizado
  // Celular do vereador (só em Arquivos Diversos): nome + senha, sem prender o aparelho
  var EH_CEL = EH_TABLET && !!(window.DOCCFG && window.DOCCFG.pessoal) && !!(window.PldLogin && PldLogin.celular && PldLogin.celular());
  if (window.__DOC_CEL !== undefined) EH_CEL = !!window.__DOC_CEL;

  // ---------- Estilo e estrutura ----------
  var st = document.createElement('style');
  st.textContent =
    ':root{--bg:#0a1022;--bg2:#111a35;--card:#151f3f;--card2:#1b2750;--line:#2a3766;--ink:#eef2fb;--muted:#9aa6c6;--gold:#e6b955;--ok:#34d399;--err:#f87171;--novo:#fbbf24;--pdf:#d4574a;' +
    '--f-display:"Barlow Condensed","Arial Narrow",sans-serif;--f-body:"Source Sans 3","Segoe UI",system-ui,sans-serif}' +
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%}' +
    'body{background:radial-gradient(120% 80% at 50% 0%,var(--bg2),var(--bg) 70%) fixed;color:var(--ink);font-family:var(--f-body);font-size:17px;line-height:1.45;color-scheme:dark}' +
    'button,input,select{font:inherit;color:inherit}button{cursor:pointer}[hidden]{display:none!important}:focus-visible{outline:3px solid var(--gold);outline-offset:2px}' +
    '.top{display:flex;align-items:center;padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left));border-bottom:1px solid var(--line);background:rgba(10,16,34,.85);position:sticky;top:0;z-index:5}' +
    '.top img{width:46px;height:46px;object-fit:contain;margin-right:12px;flex:none}.tit{flex:1;min-width:0}' +
    '.tit b{display:block;font-family:var(--f-display);font-size:26px;letter-spacing:.02em;line-height:1.05;color:var(--gold)}' +
    '.tit small{display:block;color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.pill{font-size:13px;font-weight:700;padding:5px 10px;border-radius:999px;background:rgba(52,211,153,.14);color:var(--ok);margin-left:8px;white-space:nowrap}.pill.off{background:rgba(248,113,113,.14);color:var(--err)}' +
    '.tb{margin-left:8px;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px 12px;font-weight:700;font-size:14px;white-space:nowrap}.tb:hover{border-color:var(--gold);color:var(--gold)}' +
    '.wrap{max-width:1080px;margin:0 auto;padding:18px max(16px,env(safe-area-inset-right)) 60px max(16px,env(safe-area-inset-left))}' +
    'h2{font-family:var(--f-display);font-size:24px;letter-spacing:.03em;margin:22px 0 10px;color:var(--gold);display:flex;align-items:center}' +
    'h2 .n{margin-left:10px;font-family:var(--f-body);font-size:13px;font-weight:700;color:#0a1022;background:var(--novo);border-radius:999px;padding:2px 9px}' +
    '.vazio{color:var(--muted);border:1px dashed var(--line);border-radius:14px;padding:22px;text-align:center}' +
    '.busca{display:flex;align-items:center;flex-wrap:wrap;margin-top:6px}.busca h2{margin:0;flex:1;min-width:200px}' +
    '.busca input{flex:0 1 320px;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:6px 0}' +
    '.chips{display:flex;flex-wrap:wrap;margin-top:10px}.chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 14px;font-weight:700;margin:0 8px 8px 0;font-size:15px}' +
    '.chip small{color:var(--muted);margin-left:6px;font-weight:600}.chip.on{background:var(--gold);color:#0a1022;border-color:var(--gold)}.chip.on small{color:#0a1022}' +
    '.grupo{display:flex;align-items:center;margin:16px 2px 8px;color:var(--muted);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.05em}' +
    '.grupo:after{content:"";flex:1;height:1px;background:var(--line);margin-left:10px}' +
    '.lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));grid-gap:12px}' +
    '.doc{display:flex;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0;flex-wrap:wrap}' +
    '.doc.novo{border-color:var(--novo);box-shadow:inset 4px 0 0 var(--novo)}' +
    '.ico{flex:none;width:44px;height:54px;border-radius:6px 13px 6px 6px;background:var(--pdf);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:7px;margin-right:12px;letter-spacing:.05em}' +
    '.inf{flex:1;min-width:0}.inf b{display:block;overflow-wrap:anywhere;font-size:17px;line-height:1.3}' +
    '.inf small{display:block;color:var(--muted);font-size:13px;margin-top:3px}' +
    '.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;color:#0a1022;background:var(--novo);border-radius:6px;padding:2px 6px;margin-right:6px;vertical-align:1px}' +
    '.tag.ano{background:var(--card2);color:var(--gold);border:1px solid var(--line)}.tag.para{background:rgba(52,211,153,.16);color:var(--ok)}' +
    '.acs{display:flex;flex-direction:column;margin-left:10px}.acs .btn{margin-bottom:6px}' +
    '.btn{border:0;border-radius:10px;padding:10px 16px;font-weight:700}' +
    '.btn-ouro{background:var(--gold);color:#0a1022}.btn-sec{background:transparent;border:1px solid var(--line);color:var(--ink)}' +
    '.btn-del{background:transparent;border:1px solid rgba(248,113,113,.4);color:var(--err)}.btn[disabled]{opacity:.5;cursor:default}' +
    '.ed{width:100%;display:flex;flex-wrap:wrap;align-items:flex-end;border-top:1px dashed var(--line);margin-top:10px;padding-top:10px}' +
    '.ed label,.envio label{display:flex;flex-direction:column;font-size:13px;color:var(--muted);font-weight:700;margin:0 10px 8px 0}' +
    '.ed input,.ed select,.envio input,.envio select{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 10px;color:var(--ink);font-size:16px;margin-top:4px}' +
    '.ed .nm{flex:1;min-width:180px}.ed .btn{margin:0 8px 8px 0}' +
    '.envio{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}' +
    '.envio .linha{display:flex;align-items:flex-end;flex-wrap:wrap}' +
    '.drop{border:2px dashed var(--line);border-radius:12px;padding:22px 16px;text-align:center;cursor:pointer;margin-top:6px}' +
    '.drop.over,.drop:hover{border-color:var(--gold);background:rgba(230,185,85,.08)}.drop b{display:block;font-size:18px}.drop span{color:var(--muted);font-size:14px}' +
    '.prog{color:var(--muted);font-size:14px;margin-top:10px}.barra{height:6px;background:var(--line);border-radius:6px;overflow:hidden;margin-top:6px}.barra i{display:block;height:100%;width:0;background:var(--gold);transition:width .2s}' +
    '.info{color:var(--muted);font-size:14px;margin-top:8px}' +
    '.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));grid-gap:12px;margin-top:12px}' +
    '.ver{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 10px;text-align:center;font-weight:700;font-size:18px}' +
    '.ver small{display:block;color:var(--muted);font-weight:600;font-size:13px;margin-top:4px}.ver.bloq{opacity:.38;filter:grayscale(1);cursor:default}.ver:not(.bloq):hover{border-color:var(--gold)}' +
    '.aviso{color:var(--novo);min-height:24px;margin-top:10px;font-weight:600}' +
    '.senha{max-width:440px;margin:40px auto 0;background:var(--card);border:1px solid var(--gold);border-radius:20px;padding:26px 22px;text-align:center}' +
    '.senha b{display:block;font-family:var(--f-display);font-size:30px;color:var(--gold)}.senha p{color:var(--muted);margin:6px 0 16px}' +
    '.senha input{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:20px;text-align:center;letter-spacing:.1em}' +
    '.senha .btn{width:100%;margin-top:12px;padding:14px;font-size:18px}.senha .erro{color:var(--err);min-height:24px;margin-top:10px;font-weight:600}' +
    '.senha .troca{background:none;border:0;color:var(--muted);text-decoration:underline;margin-top:14px;font-size:14px}' +
    '.modal{position:fixed;top:0;right:0;bottom:0;left:0;z-index:50;background:rgba(5,8,18,.75);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.mbox{background:var(--card);border:1px solid var(--gold);border-radius:18px;padding:22px;max-width:460px;width:100%;text-align:center}' +
    '.mbox b{display:block;font-family:var(--f-display);font-size:28px;color:var(--gold)}.mbox p{margin:10px 0 18px}.mbox .btn{width:100%;margin-top:8px;padding:14px}' +
    '.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;background:var(--ink);color:#0a1022;font-weight:700;padding:12px 18px;border-radius:12px;max-width:calc(100vw - 32px);box-shadow:0 10px 30px rgba(0,0,0,.5)}' +
    '.toast.err{background:var(--err);color:#fff}' +
    '@media (max-width:560px){.tb .lbl{display:none}.tit b{font-size:22px}.lista{grid-template-columns:1fr}.acs{flex-direction:row;width:100%;margin:10px 0 0}.acs .btn{flex:1;margin:0 6px 0 0}}';
  document.head.appendChild(st);

  var pessoal = !!CFG.pessoal, anoData = !!CFG.anoData;
  document.body.innerHTML =
    '<div class="top"><img src="img/brasao.png" alt="" onerror="this.style.display=\'none\'">' +
    '<div class="tit"><b>' + CFG.titulo + '</b><small id="sub">Carregando…</small></div>' +
    '<span class="pill off" id="pill">Conectando</span>' +
    '<button class="tb" id="btnTela" type="button" hidden>⛶ <span class="lbl">Tela cheia</span></button>' +
    '<button class="tb" id="btnSairV" type="button" hidden>🔒 <span class="lbl">Sair</span></button>' +
    '<button class="tb" id="btnVoltar" type="button">← <span class="lbl">Painel</span></button></div>' +
    '<div class="wrap">' +
    '<section id="vEscolha" hidden><h2>De quem é este tablet?</h2><p style="color:var(--muted);margin:0">Toque no seu nome. O tablet fica reservado para você (o mesmo vínculo da Votação, da Presença e de Anotações).</p><div class="grade" id="grade"></div><div class="aviso" id="avisoEsc"></div></section>' +
    '<section id="vSenha" hidden><form class="senha" id="formSenha" autocomplete="off"><b id="sNome"></b><p>Digite a sua senha (a mesma de Anotações do Vereador).</p>' +
    '<input id="sPw" type="password" placeholder="Senha" autocomplete="off"><button class="btn btn-ouro" type="submit" id="sOk">Entrar</button><div class="erro" id="sErr"></div>' +
    '<button class="troca" type="button" id="sTroca" hidden>Não é você? Trocar o nome (modo de ensaio)</button></form></section>' +
    '<section id="vEnvio" hidden><h2 id="envTit">Enviar</h2><div class="envio">' +
    '<div class="linha">' +
    (anoData ? '<label>Data da sessão<input type="date" id="upData"></label><label>Ano<input type="number" id="upAno" min="2000" max="2100" style="width:110px"></label>' : '') +
    (pessoal ? '<label id="upDonoL">Para quem<select id="upDono"></select></label>' : '') +
    '</div>' +
    '<label class="drop" id="drop" for="arq"><b>📤 Toque aqui ou arraste os PDFs</b><span>Até 20 MB por arquivo. Chega na hora em todos os tablets.</span></label>' +
    '<input type="file" id="arq" accept="application/pdf,.pdf" multiple hidden>' +
    '<div class="prog" id="prog" hidden><span id="progTxt"></span><div class="barra"><i id="progBar"></i></div></div>' +
    '<div class="info" id="envInfo"></div></div></section>' +
    '<section id="vLista" hidden><div class="busca"><h2>Documentos <span class="n" id="nNovos" hidden></span><small id="cnt" style="font-family:var(--f-body);font-size:15px;color:var(--muted);margin-left:8px"></small></h2>' +
    '<input type="search" id="q" placeholder="Buscar ' + ITEM + '…" aria-label="Buscar"></div>' +
    '<div class="chips" id="chips"' + (anoData ? '' : ' hidden') + '></div><div id="lista"><div class="vazio">Carregando…</div></div></section>' +
    '</div>' +
    '<div class="modal" id="modal" hidden><div class="mbox"><b id="mdTit"></b><p id="mdTxt"></p><button class="btn btn-ouro" id="mdOk" type="button">Confirmar</button><button class="btn btn-sec" id="mdCanc" type="button">Cancelar</button></div></div>' +
    '<div class="toast" id="toast" hidden></div>';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function quando(t) { if (!t) return ''; var d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dataBr(d) { if (!d) return ''; var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function tamanho(b) { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  var toastT = null;
  function toast(t, err) { var el = $('toast'); el.textContent = t; el.className = 'toast' + (err ? ' err' : ''); el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 3500); }
  var mdOk = null;
  function confirmar(tit, txt, okTxt, fn) { $('mdTit').textContent = tit; $('mdTxt').textContent = txt; $('mdOk').textContent = okTxt || 'Confirmar'; mdOk = fn; $('modal').hidden = false; }
  $('mdCanc').onclick = function () { $('modal').hidden = true; mdOk = null; };
  $('mdOk').onclick = function () { $('modal').hidden = true; var f = mdOk; mdOk = null; if (f) f(); };
  $('btnVoltar').onclick = function () { location.href = EH_CEL ? 'anotacoes.html' : 'dashboard.html'; };
  if (EH_CEL) {
    $('btnVoltar').innerHTML = '📝 <span class="lbl">Anotações</span>';
    $('vEscolha').querySelector('h2').textContent = 'Quem é você?';
    $('vEscolha').querySelector('p').textContent = 'Toque no seu nome e digite a sua senha (a mesma de Anotações). O celular não fica preso a ninguém.';
    $('sTroca').textContent = 'Não é você? Trocar o nome';
  }
  document.title = CFG.titulo + ' — Câmara de Almadina';

  function emTela() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  if (EH_TABLET && !EH_CEL) {
    $('btnTela').hidden = false;
    $('btnTela').onclick = function () { try { var el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {} };
    document.addEventListener('click', function () { if (!emTela()) { try { var el = document.documentElement; var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(function () {}); } catch (e) {} } }, true);
  }

  if (typeof firebase === 'undefined') { $('sub').textContent = 'Sem conexão com o servidor. Recarregue a página.'; return; }
  try {
    if (!firebase.apps.length) firebase.initializeApp({
      apiKey: 'AIzaSyAHawTmb2za8y2Eq70FWejq64-5J6Pbqfo', authDomain: 'projeto-teste-f08c4.firebaseapp.com',
      databaseURL: 'https://projeto-teste-f08c4-default-rtdb.firebaseio.com', projectId: 'projeto-teste-f08c4',
      storageBucket: 'projeto-teste-f08c4.firebasestorage.app', messagingSenderId: '788863562302', appId: '1:788863562302:web:2ddcfb6c2c892770de976f'
    });
  } catch (e) {}
  var db = firebase.database();
  var refItens = db.ref(BASE + '/itens'), refArq = db.ref(BASE + '/arquivos');
  db.ref('.info/connected').on('value', function (s) { var on = s.val() === true; $('pill').textContent = on ? 'Conectado' : 'Sem internet'; $('pill').className = 'pill' + (on ? '' : ' off'); });

  // ---------- Quem está usando ----------
  var MESA = !EH_TABLET;
  var dono = null, liberado = null;   // tablet pessoal: dono do tablet e se já digitou a senha
  function podeVer(d) {
    if (!pessoal || MESA) return true;
    return !!liberado && (d.dono === 'todos' || d.dono === liberado);
  }
  function podeApagar(d) { return MESA || (pessoal && !!liberado && d.por === liberado); }
  function listaAberta() { return MESA || !pessoal || (!!dono && liberado === dono); }

  // ---------- Lista ----------
  var itens = [], porId = {}, carregou = false, conhecidos = null, filtroAno = 'todos', editando = null;
  var vistoNaAbertura = +ls(VISTO) || 0;
  refItens.on('value', function (s) {
    var l = [];
    s.forEach(function (c) { var v = c.val() || {}; v.id = c.key; if (v.criadoEm && v.nome) l.push(v); });
    var novos = [];
    if (conhecidos !== null) l.forEach(function (d) { if (!conhecidos[d.id] && podeVer(d)) novos.push(d); });
    conhecidos = {}; l.forEach(function (d) { conhecidos[d.id] = true; });
    itens = l; porId = {}; l.forEach(function (d) { porId[d.id] = d; });
    carregou = true; render();
    if (novos.length && EH_TABLET && listaAberta()) toast(novos.length > 1 ? novos.length + ' novos documentos' : 'Novo documento: ' + novos[0].nome);
  });
  function chave(d) { return d.data || new Date(d.criadoEm).toISOString().slice(0, 10); }
  function ordenar(l) {
    l.sort(function (a, b) {
      if (anoData) { var ka = chave(a), kb = chave(b); if (ka !== kb) return ka < kb ? 1 : -1; }
      return b.criadoEm - a.criadoEm;
    });
    return l;
  }
  function grupo(d) {
    if (d.data) { var p = d.data.split('-'); return MESES[+p[1] - 1] + ' de ' + p[0]; }
    return d.ano ? d.ano + ' · sem data da sessão' : 'Sem ano definido';
  }
  function renderChips(vis) {
    if (!anoData) return;
    var anos = {}, sem = 0;
    vis.forEach(function (d) { if (d.ano) anos[d.ano] = (anos[d.ano] || 0) + 1; else sem++; });
    var ks = Object.keys(anos).sort().reverse();
    if (filtroAno !== 'todos' && filtroAno !== 'sem' && !anos[filtroAno]) filtroAno = 'todos';
    if (filtroAno === 'sem' && !sem) filtroAno = 'todos';
    var h = '<button type="button" class="chip' + (filtroAno === 'todos' ? ' on' : '') + '" data-ano="todos">Todas<small>' + vis.length + '</small></button>';
    ks.forEach(function (a) { h += '<button type="button" class="chip' + (filtroAno === a ? ' on' : '') + '" data-ano="' + a + '">' + a + '<small>' + anos[a] + '</small></button>'; });
    if (sem) h += '<button type="button" class="chip' + (filtroAno === 'sem' ? ' on' : '') + '" data-ano="sem">Sem ano<small>' + sem + '</small></button>';
    $('chips').innerHTML = h;
  }
  $('chips').onclick = function (e) { var t = e.target && e.target.closest ? e.target.closest('[data-ano]') : null; if (!t) return; filtroAno = t.getAttribute('data-ano'); render(); };
  $('q').oninput = render;
  function edHtml(d) {
    var h = '<div class="ed"><label class="nm">Nome<input type="text" data-f="nome" value="' + esc(d.nome) + '" maxlength="200"></label>';
    if (anoData) h += '<label>Data da sessão<input type="date" data-f="data" value="' + esc(d.data || '') + '"></label><label>Ano<input type="number" data-f="ano" min="2000" max="2100" style="width:100px" value="' + esc(d.ano || '') + '"></label>';
    if (pessoal && MESA) h += '<label>Para quem<select data-f="dono">' + opcoesDono(d.dono || '', true) + '</select></label>';
    return h + '<button class="btn btn-ouro" type="button" data-salvar="' + esc(d.id) + '">Salvar</button><button class="btn btn-sec" type="button" data-cancelar="1">Cancelar</button></div>';
  }
  function render() {
    if (!carregou || !listaAberta()) return;
    var q = $('q').value.replace(/^\s+|\s+$/g, '').toLowerCase();
    var vis = itens.filter(podeVer);
    renderChips(vis);
    var l = ordenar(vis.filter(function (d) {
      if (anoData && filtroAno === 'sem' && d.ano) return false;
      if (anoData && filtroAno !== 'todos' && filtroAno !== 'sem' && String(d.ano) !== filtroAno) return false;
      return !q || (d.nome + ' ' + dataBr(d.data) + ' ' + (d.ano || '') + ' ' + (NOME[d.dono] || '')).toLowerCase().indexOf(q) > -1;
    }));
    $('cnt').textContent = '(' + vis.length + ')';
    var n = 0, h = '', ultimo = '', abriu = false;
    l.forEach(function (d) {
      var novo = EH_TABLET && vistoNaAbertura && d.criadoEm > vistoNaAbertura; if (novo) n++;
      if (anoData) { var g = grupo(d); if (g !== ultimo) { if (abriu) h += '</div>'; h += '<div class="grupo">' + esc(g) + '</div><div class="lista">'; abriu = true; ultimo = g; } }
      else if (!abriu) { h += '<div class="lista">'; abriu = true; }
      var meta = [];
      if (anoData && d.data) meta.push('📅 Sessão de ' + dataBr(d.data));
      meta.push(tamanho(d.tamanho)); meta.push('enviado em ' + quando(d.criadoEm));
      if (pessoal && d.por && NOME[d.por]) meta.push('por ' + NOME[d.por]);
      var tags = (novo ? '<span class="tag">NOVO</span>' : '') + (anoData && d.ano ? '<span class="tag ano">' + esc(d.ano) + '</span>' : '');
      if (pessoal) tags += d.dono === 'todos' ? '<span class="tag para">Para todos</span>' : (MESA ? '<span class="tag para">' + esc(NOME[d.dono] || 'Sem destinatário (oculto)') + '</span>' : '');
      h += '<div class="doc' + (novo ? ' novo' : '') + '"><div class="ico">PDF</div><div class="inf"><b>' + esc(d.nome) + '</b><small>' + tags + esc(meta.join(' · ')) + '</small></div>' +
        '<div class="acs"><button class="btn btn-ouro" type="button" data-ver="' + esc(d.id) + '">Ver</button>' +
        (MESA ? '<button class="btn btn-sec" type="button" data-editar="' + esc(d.id) + '">Editar</button>' : '') +
        (podeApagar(d) ? '<button class="btn btn-del" type="button" data-apagar="' + esc(d.id) + '">Apagar</button>' : '') + '</div>' +
        (editando === d.id ? edHtml(d) : '') + '</div>';
    });
    if (abriu) h += '</div>';
    $('lista').innerHTML = h || '<div class="vazio">' + (vis.length ? 'Nada encontrado nessa busca.' : 'Nenhum documento ainda.' + (MESA ? '' : ' Os PDFs enviados pela Mesa aparecem aqui na hora.')) + '</div>';
    $('nNovos').hidden = !n; $('nNovos').textContent = n === 1 ? '1 novo' : n + ' novos';
    if (EH_TABLET && vis.length) { var mx = 0; vis.forEach(function (d) { if (d.criadoEm > mx) mx = d.criadoEm; }); ls(VISTO, String(Math.max(+ls(VISTO) || 0, mx))); }
  }

  function abrir(id, b) {
    var d = porId[id]; if (!d) return;
    if (b) b.disabled = true; toast('Abrindo ' + d.nome + '…');
    refArq.child(id).once('value').then(function (s) {
      var v = s.val() || {}, dd = '';
      for (var i = 0; i < (d.partes || 0); i++) dd += (v[i] || v[String(i)] || '');
      if (!dd) throw new Error('vazio');
      VerDoc.abrir(dd, d.nome, d.tipo || 'application/pdf');
    }).catch(function () { toast('Não foi possível abrir o arquivo.', true); }).then(function () { if (b) b.disabled = false; });
  }
  $('lista').onclick = function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-ver],[data-editar],[data-apagar],[data-salvar],[data-cancelar]') : null; if (!t) return;
    if (t.hasAttribute('data-ver')) { abrir(t.getAttribute('data-ver'), t); return; }
    if (t.hasAttribute('data-cancelar')) { editando = null; render(); return; }
    if (t.hasAttribute('data-editar')) { var ie = t.getAttribute('data-editar'); editando = editando === ie ? null : ie; render(); return; }
    if (t.hasAttribute('data-salvar')) {
      var id = t.getAttribute('data-salvar'), box = t.parentNode, ch = {};
      var f = function (k) { var el = box.querySelector('[data-f="' + k + '"]'); return el ? el.value : undefined; };
      ch.nome = (f('nome') || '').replace(/^\s+|\s+$/g, '') || porId[id].nome;
      if (anoData) { ch.data = f('data') || null; ch.ano = +f('ano') || (ch.data ? +ch.data.slice(0, 4) : null); }
      if (pessoal && MESA) ch.dono = f('dono') || null;
      t.disabled = true;
      refItens.child(id).update(ch).then(function () { editando = null; toast('Salvo.'); render(); }, function () { t.disabled = false; toast('Não foi possível salvar.', true); });
      return;
    }
    var ia = t.getAttribute('data-apagar'), d = porId[ia]; if (!d) return;
    confirmar('Apagar documento?', '“' + d.nome + '” sai de todos os aparelhos. Esta ação não pode ser desfeita.', 'Apagar', function () {
      refItens.child(ia).remove().then(function () { return refArq.child(ia).remove(); })
        .then(function () { toast('Apagado.'); }, function () { toast('Não foi possível apagar.', true); });
    });
  };

  // ---------- Envio (notebook; e o próprio vereador em Arquivos Diversos) ----------
  function opcoesDono(sel, comVazio) {
    var h = (comVazio ? '<option value=""' + (!sel ? ' selected' : '') + '>— Sem destinatário (oculto) —</option>' : '<option value="">Escolha…</option>') +
      '<option value="todos"' + (sel === 'todos' ? ' selected' : '') + '>Todos os vereadores</option>';
    VERS.forEach(function (v) { h += '<option value="' + v.id + '"' + (sel === v.id ? ' selected' : '') + '>' + esc(v.nome) + '</option>'; });
    return h;
  }
  function ler(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('leitura')); }; r.readAsDataURL(f); }); }
  var enviando = false;
  function enviar(lista) {
    var fs = Array.prototype.slice.call(lista || []).filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!fs.length) { toast('Escolha arquivos em PDF.', true); return; }
    if (enviando) { toast('Aguarde o envio anterior terminar.', true); return; }
    var extra = {};
    if (anoData) { var dt = $('upData').value || null; extra.data = dt; extra.ano = +$('upAno').value || (dt ? +dt.slice(0, 4) : null); }
    if (pessoal) {
      if (MESA) { extra.dono = $('upDono').value; if (!extra.dono) { toast('Escolha para quem é o documento.', true); return; } extra.por = 'mesa'; }
      else { extra.dono = liberado; extra.por = liberado; }
    }
    enviando = true;
    var i = 0, ok = 0, prog = $('prog'), bar = $('progBar');
    prog.hidden = false;
    (function prox() {
      if (i >= fs.length) { $('progTxt').textContent = ok + ' de ' + fs.length + ' enviado(s).'; bar.style.width = '100%'; enviando = false; setTimeout(function () { if (!enviando) prog.hidden = true; }, 4000); if (ok) toast(ok > 1 ? ok + ' documentos enviados.' : 'Documento enviado.'); return; }
      var f = fs[i++];
      if (f.size > LIMITE) { toast(f.name + ': maior que 20 MB.', true); prox(); return; }
      $('progTxt').textContent = 'Enviando ' + f.name + ' (' + i + '/' + fs.length + ')…'; bar.style.width = '0';
      var id = refItens.push().key;
      ler(f).then(function (d) {
        var partes = Math.ceil(d.length / PARTE), feitas = 0, envios = [];
        for (var k = 0; k < partes; k++) envios.push(refArq.child(id).child(String(k)).set(d.slice(k * PARTE, (k + 1) * PARTE)).then(function () { feitas++; bar.style.width = Math.round(feitas / partes * 100) + '%'; }));
        return Promise.all(envios).then(function () { return partes; });
      }).then(function (partes) {
        var m = { nome: f.name.replace(/\.pdf$/i, ''), tamanho: f.size, partes: partes, tipo: 'application/pdf', criadoEm: firebase.database.ServerValue.TIMESTAMP };
        for (var k in extra) if (extra.hasOwnProperty(k) && extra[k] != null) m[k] = extra[k];
        return refItens.child(id).set(m);
      }).then(function () { ok++; prox(); }, function () {
        refArq.child(id).remove().catch(function () {});
        toast(f.name + ': não foi possível enviar. Verifique a internet.', true); prox();
      });
    })();
  }
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.className = 'drop over'; }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.className = 'drop'; }); });
  drop.addEventListener('drop', function (e) { enviar(e.dataTransfer.files); });
  $('arq').onchange = function () { enviar(this.files); this.value = ''; };
  if (anoData) {
    var hoje = new Date(); $('upAno').value = hoje.getFullYear();
    $('upData').onchange = function () { if (this.value) $('upAno').value = this.value.slice(0, 4); };
  }

  function iniciarMesa() {
    $('vEnvio').hidden = false; $('vLista').hidden = false;
    $('envTit').textContent = 'Enviar para os tablets';
    $('sub').textContent = 'Mesa · envio de ' + ITEM + 's para os tablets dos vereadores';
    if (pessoal) { $('upDono').innerHTML = opcoesDono('', false); $('envInfo').textContent = 'Cada vereador vê no tablet só os documentos dele e os “para todos”. Não aparece na Smart TV.'; }
    else $('envInfo').textContent = 'Todos os tablets recebem na hora. Fica guardado até você apagar. Não aparece na Smart TV.';
    render();
  }

  // ---------- Tablet ----------
  var aparelhos = {}, ensaio = false, apOk = false, enOk = false, senhas = {}, seOk = false, falhas = 0, travaAte = 0, avisoT = null;
  function hex(buf) { var a = new Uint8Array(buf), h = ''; for (var i = 0; i < a.length; i++) h += (a[i] < 16 ? '0' : '') + a[i].toString(16); return h; }
  function deHex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function kdf(pw, salt) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: deHex(salt), iterations: 120000, hash: 'SHA-256' }, k, 256);
    }).then(hex);
  }
  function devId() { var d = ls('vp_dev'); if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); ls('vp_dev', d); } return d; }
  function calcDono() {
    if (EH_CEL) { var c = ls('an_cel'); return c && NOME[c] ? c : null; }
    var dev = devId();
    if (!ensaio) { for (var vid in aparelhos) if (aparelhos.hasOwnProperty(vid) && aparelhos[vid] && aparelhos[vid].dev === dev && NOME[vid]) return vid; return null; }
    var m = ls('an_meu'); return m && NOME[m] ? m : null;
  }
  function deOutro(vid) { if (ensaio || EH_CEL) return false; var a = aparelhos[vid]; return !!(a && a.dev && a.dev !== devId()); }
  function trancar() { liberado = null; editando = null; $('sPw').value = ''; $('sErr').textContent = ''; $('lista').innerHTML = ''; }
  function avaliar() {
    if (!apOk || !enOk) return;
    var d = calcDono();
    if (d !== dono) { dono = d; trancar(); }
    var aberto = !!dono && liberado === dono;
    $('vEscolha').hidden = !!dono; $('vSenha').hidden = !dono || aberto; $('vLista').hidden = !aberto; $('vEnvio').hidden = !aberto;
    $('btnSairV').hidden = !aberto; $('sTroca').hidden = !(ensaio || EH_CEL);
    if (dono && !aberto) $('sNome').textContent = NOME[dono];
    $('sub').textContent = dono ? NOME[dono] + (EH_CEL ? ' · celular' : ensaio ? ' · modo de ensaio' : '') : 'Escolha o seu nome';
    if (!dono) renderGrade();
    render();
  }
  function renderGrade() {
    var h = '';
    VERS.forEach(function (v) { var b = deOutro(v.id); h += '<button type="button" class="ver' + (b ? ' bloq' : '') + '" data-vid="' + v.id + '">' + esc(v.nome) + '<small>' + (b ? '🔒 Outro tablet' : EH_CEL ? 'Vereador(a)' : 'Aparelho ' + v.ap) + '</small></button>'; });
    $('grade').innerHTML = h;
  }
  function iniciarTabletPessoal() {
    $('envTit').textContent = 'Enviar um documento meu';
    $('upDonoL').hidden = true;
    $('envInfo').textContent = 'Só você vê os documentos que enviar aqui.';
    $('btnSairV').onclick = function () { trancar(); avaliar(); };
    $('sTroca').onclick = function () { ls(EH_CEL ? 'an_cel' : 'an_meu', null); trancar(); avaliar(); };
    db.ref(RAIZ + '/anotacoes/senhas').on('value', function (s) { senhas = s.val() || {}; seOk = true; });
    $('formSenha').onsubmit = function (e) {
      e.preventDefault();
      var vid = dono, pw = $('sPw').value, err = $('sErr'), b = $('sOk');
      err.textContent = '';
      if (!vid) return;
      if (Date.now() < travaAte) { err.textContent = 'Muitas tentativas. Aguarde ' + Math.ceil((travaAte - Date.now()) / 1000) + ' segundos.'; return; }
      if (!seOk) { err.textContent = 'Carregando… tente de novo em instantes.'; return; }
      var sv = senhas[vid];
      if (!sv || !sv.hash) { err.textContent = 'Sua senha ainda não foi cadastrada. Procure a Mesa.'; return; }
      if (!pw) { err.textContent = 'Digite a sua senha.'; $('sPw').focus(); return; }
      b.disabled = true; b.textContent = 'Verificando…';
      kdf(pw, sv.salt).then(function (h) { return h === sv.hash; }, function () { return false; }).then(function (ok) {
        b.disabled = false; b.textContent = 'Entrar'; $('sPw').value = '';
        if (vid !== dono) return;
        if (!ok) { falhas++; if (falhas >= 5) { travaAte = Date.now() + 30000; falhas = 0; } err.textContent = 'Senha incorreta.'; $('sPw').focus(); return; }
        falhas = 0; liberado = vid; avaliar();
      });
    };
    $('grade').onclick = function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-vid]') : null; if (!t) return;
      var vid = t.getAttribute('data-vid');
      if (deOutro(vid)) { $('avisoEsc').textContent = NOME[vid] + ' já tem o próprio tablet. Cada vereador usa somente o seu.'; clearTimeout(avisoT); avisoT = setTimeout(function () { $('avisoEsc').textContent = ''; }, 4000); return; }
      if (EH_CEL) { ls('an_cel', vid); avaliar(); setTimeout(function () { try { $('sPw').focus(); } catch (e) {} }, 50); return; }
      if (ensaio) { ls('an_meu', vid); avaliar(); return; }
      confirmar(NOME[vid], 'Este tablet ficará reservado para ' + NOME[vid] + ' (Documentos, Anotações, Votação e Presença). Confira se é o seu nome.', 'Sim, sou eu', function () {
        var dev = devId();
        db.ref(RAIZ + '/votacao/aparelhos/' + vid).transaction(function (cur) {
          if (cur && cur.dev && cur.dev !== dev) return;
          return { dev: dev, em: Date.now() };
        }, function (err, ok, snap) {
          var v = snap && snap.val();
          if (err || !ok || !v || v.dev !== dev) { toast(err ? 'Sem internet. Tente de novo.' : NOME[vid] + ' já está vinculado a outro tablet.', true); return; }
          aparelhos[vid] = v; avaliar();
        }, false);
      });
    };
    db.ref(RAIZ + '/votacao/aparelhos').on('value', function (s) { aparelhos = s.val() || {}; apOk = true; avaliar(); });
    db.ref(RAIZ + '/votacao/config/ensaio').on('value', function (s) { var v = s.val(); ensaio = !!(v && v.ligado); enOk = true; avaliar(); });
  }

  if (MESA) iniciarMesa();
  else if (pessoal) iniciarTabletPessoal();
  else { $('vLista').hidden = false; $('sub').textContent = 'Documentos enviados pela Mesa'; render(); }
})();
