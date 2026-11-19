/* Assinatura eletrônica das Atas — página Atas / Proposições.
   Arquivo à parte: NÃO altera o docs.js. Ele só acrescenta botões nos cartões que o docs.js desenha.

   Mesa (notebook): botão "✍ Assinaturas" em cada documento
     -> escolhe a Mesa da sessão e abre a ata para assinatura (grava a impressão digital SHA-256 do PDF);
     -> acompanha quem já assinou, em tempo real; pode colher a assinatura de um vereador no próprio notebook;
     -> "Finalizar e lacrar" gera o PDF assinado (folha de assinaturas + manifesto + código de verificação).
     -> "🔎 Verificar" (barra do topo) confere se um PDF ou código é autêntico.
   Tablet: botão "✍ Assinar" -> o vereador lê a ata, digita a senha (a mesma de Anotações) e desenha a assinatura.

   Dados (dentro de legislar/docs/atas, mesmo login do resto do sistema):
     assinaturas/{docId} = {status:'aberta'|'finalizada', mesa:{presidente,vice,sec1,sec2}, pdfHash, abertaEm,
                            sigs:{vid:{vid,nome,cargo,em,imgHash,docHash,hash,rub,emServidor}}, codigo, finalHash, partesFinal, finalizadaEm}
     rubricas/{docId}/{chave} = imagem PNG (dataURL) da assinatura desenhada
     assinadas/{docId}/{i}    = PDF assinado em partes de 1 MB (dataURL) */
(function () {
  'use strict';
  if (!window.firebase || !window.DOCCFG || window.DOCCFG.secao !== 'atas') return;
  var lista = document.getElementById('lista');
  if (!lista) return;
  var db;
  try { db = firebase.database(); } catch (e) { return; }

  var RAIZ = window.__DOC_RAIZ || 'legislar';
  var BASE = RAIZ + '/docs/atas';
  var rAss = db.ref(BASE + '/assinaturas'), rRub = db.ref(BASE + '/rubricas'), rFin = db.ref(BASE + '/assinadas');
  var rItens = db.ref(BASE + '/itens'), rArq = db.ref(BASE + '/arquivos');
  var PARTE = 1000000;
  var CAMARA = 'CÂMARA MUNICIPAL DE ALMADINA', PLENARIO = 'PLENÁRIO DA CÂMARA MUNICIPAL DE ALMADINA';
  var PDFLIB = ['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'];

  // Ordem dos "Demais vereadores" na folha de assinaturas (ids iguais aos da Votação/Anotações)
  var VERS = [['v8', 'José Lindomar'], ['v9', 'Wilson Freitas'], ['v4', 'Marilene Santos'], ['v7', 'Sylas Souza'], ['v1', 'Jackson Costa'],
    ['v6', 'Rogério Gotado'], ['v3', 'Lucas Cavalcante'], ['v2', 'Dilson Junior'], ['v5', 'Nilza Damasceno']];
  var NOME = {}; VERS.forEach(function (v) { NOME[v[0]] = v[1]; });
  var CARGOS = [['presidente', 'Presidente'], ['vice', 'Vice-presidente'], ['sec1', '1º secretário'], ['sec2', '2º secretário']];

  var EH_TABLET = false;
  try { EH_TABLET = navigator.maxTouchPoints > 0 && (!matchMedia('(any-pointer: fine)').matches || matchMedia('(pointer: coarse)').matches || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent || '')); } catch (e) {}
  if (window.__DOC_TABLET !== undefined) EH_TABLET = !!window.__DOC_TABLET;
  var MESA = !EH_TABLET;

  // ---------- utilidades ----------
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  function horaBR(t) { if (!t) return ''; var d = new Date(t); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function dataBR(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataExtenso(iso) { if (!iso) return ''; var p = iso.split('-'); return (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0]; }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var toastT = null;
  function toast(t, err) {
    var el = $('toast'); if (!el) return;
    el.textContent = t; el.className = 'toast' + (err ? ' err' : ''); el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 4000);
  }
  async function sha256Hex(data) {
    var buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    var h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    return Array.prototype.map.call(h, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  function duParaBytes(du) {
    var b64 = du.slice(du.indexOf(',') + 1), bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesParaDu(bytes, tipo) {
    var s = '', T = 0x8000;
    for (var i = 0; i < bytes.length; i += T) s += String.fromCharCode.apply(null, bytes.subarray(i, i + T));
    return 'data:' + (tipo || 'application/pdf') + ';base64,' + btoa(s);
  }
  function deHex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  async function kdf(pw, salt) {   // igual ao das Anotações (PBKDF2, 120 mil voltas)
    var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: deHex(salt), iterations: 120000, hash: 'SHA-256' }, k, 256);
    return Array.prototype.map.call(new Uint8Array(bits), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  function juntar(v, n) { var s = ''; v = v || {}; for (var i = 0; i < n; i++) s += (v[i] || v[String(i)] || ''); return s; }
  function baixarArquivo(bytes, nome) {
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    var a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  function nomeArquivo(s) { return String(s || 'ata').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80); }

  // ---------- regras da folha de assinaturas ----------
  function vagas(rec) {
    var m = (rec && rec.mesa) || {}, l = [], usados = {};
    CARGOS.forEach(function (c) { var vid = m[c[0]]; if (vid && NOME[vid]) { l.push({ vid: vid, nome: NOME[vid], cargo: c[1], rotulo: c[1] }); usados[vid] = 1; } });
    var primeiro = true;
    VERS.forEach(function (v) { if (!usados[v[0]]) { l.push({ vid: v[0], nome: v[1], cargo: 'Vereador(a)', rotulo: primeiro ? 'Demais vereadores' : '' }); primeiro = false; } });
    return l;
  }
  function sigsDe(rec) { return (rec && rec.sigs) || {}; }
  function contagem(rec) { var s = sigsDe(rec), n = 0; vagas(rec).forEach(function (v) { if (s[v.vid]) n++; }); return { n: n, t: vagas(rec).length }; }
  function baseAssinatura(id, s) {   // ordem fixa dos campos: é o que entra no hash da assinatura
    return JSON.stringify({ ata: id, docHash: s.docHash, vid: s.vid, nome: s.nome, cargo: s.cargo, em: s.em, imgHash: s.imgHash });
  }
  async function codigoDe(rec) {
    var s = sigsDe(rec), regs = vagas(rec).map(function (v) { return (s[v.vid] && s[v.vid].hash) || ''; }).join('|');
    var h = await sha256Hex(rec.pdfHash + '|' + regs);
    return h.slice(0, 12).toUpperCase().match(/.{4}/g).join('-');
  }

  // ---------- dados ao vivo ----------
  var ASS = {}, ITENS = {}, assOk = false, itensOk = false;
  rAss.on('value', function (s) { ASS = s.val() || {}; assOk = true; agendar(); atualizarPainel(); limparOrfaos(); });
  rItens.on('value', function (s) { ITENS = s.val() || {}; itensOk = true; agendar(); limparOrfaos(); });

  function limparOrfaos() {   // documento apagado pela Mesa -> some também o registro de assinaturas dele
    if (!MESA || !assOk || !itensOk || !Object.keys(ITENS).length) return;
    Object.keys(ASS).forEach(function (id) {
      if (ITENS[id]) return;
      rAss.child(id).remove().catch(function () {}); rRub.child(id).remove().catch(function () {}); rFin.child(id).remove().catch(function () {});
    });
  }

  // tablet: de quem é este tablet (mesmo vínculo da Votação / Presença / Anotações)
  var aparelhos = {}, ensaio = false, dono = null;
  function calcDono() {
    var dev = ls('vp_dev');
    if (ensaio) { var m = ls('an_meu'); return m && NOME[m] ? m : null; }
    if (!dev) return null;
    for (var vid in aparelhos) if (aparelhos.hasOwnProperty(vid) && aparelhos[vid] && aparelhos[vid].dev === dev && NOME[vid]) return vid;
    return null;
  }
  function deOutroTablet(vid) { if (ensaio) return false; var a = aparelhos[vid], dev = ls('vp_dev'); return !!(a && a.dev && a.dev !== dev); }
  if (!MESA) {
    db.ref(RAIZ + '/votacao/aparelhos').on('value', function (s) { aparelhos = s.val() || {}; dono = calcDono(); agendar(); });
    db.ref(RAIZ + '/votacao/config/ensaio').on('value', function (s) { var v = s.val(); ensaio = !!(v && v.ligado); dono = calcDono(); agendar(); });
  }

  // ---------- estilo ----------
  var st = document.createElement('style');
  st.textContent =
    '.asx-tag{background:rgba(230,185,85,.16)!important;color:var(--gold)!important}.asx-tag.ok{background:rgba(52,211,153,.18)!important;color:var(--ok)!important}' +
    '.btn.asx-b{white-space:nowrap}.btn.asx-fin{background:rgba(52,211,153,.16);border:1px solid var(--ok);color:var(--ok)}' +
    '.asx-feito{display:flex;align-items:center;justify-content:center;border-radius:10px;padding:9px 12px;margin-bottom:6px;font-weight:800;font-size:14px;background:rgba(52,211,153,.18);border:1px solid var(--ok);color:var(--ok);white-space:nowrap}' +
    '.asx-fundo{position:fixed;top:0;right:0;bottom:0;left:0;z-index:70;background:rgba(5,8,18,.8);display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '.asx-box{background:var(--card);border:1px solid var(--gold);border-radius:18px;width:100%;max-width:640px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.55);text-align:left}' +
    '.asx-cab{display:flex;align-items:flex-start;padding:18px 20px 12px;border-bottom:1px solid var(--line)}.asx-cab div{flex:1;min-width:0}' +
    '.asx-cab b{display:block;font-family:var(--f-display);font-size:26px;letter-spacing:.02em;color:var(--gold);line-height:1.1}' +
    '.asx-cab small{display:block;color:var(--muted);font-size:14px;margin-top:4px;overflow-wrap:anywhere}' +
    '.asx-x{background:none;border:0;color:var(--muted);font-size:30px;line-height:1;padding:0 0 0 12px}.asx-x:hover{color:var(--ink)}' +
    '.asx-corpo{padding:16px 20px}.asx-pe{display:flex;flex-wrap:wrap;justify-content:flex-end;padding:12px 20px 18px;border-top:1px solid var(--line)}.asx-pe .btn{margin:6px 0 0 8px}' +
    '.asx-campo{display:flex;flex-direction:column;font-size:13px;color:var(--muted);font-weight:700;margin-bottom:12px}' +
    '.asx-campo select,.asx-campo input{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:11px 12px;color:var(--ink);font-size:17px;margin-top:5px}' +
    '.asx-g2{display:grid;grid-template-columns:1fr 1fr;grid-gap:0 12px}@media (max-width:520px){.asx-g2{grid-template-columns:1fr}}' +
    '.asx-info{color:var(--muted);font-size:14px;margin:4px 0 12px}' +
    '.asx-al{border-radius:12px;padding:11px 13px;font-size:15px;margin-bottom:12px;border:1px solid var(--line);background:var(--card2)}' +
    '.asx-al.ok{border-color:var(--ok);background:rgba(52,211,153,.12)}.asx-al.err{border-color:var(--err);background:rgba(248,113,113,.12);color:#fecaca}.asx-al.av{border-color:var(--novo);background:rgba(251,191,36,.1)}' +
    '.asx-barra{height:8px;background:var(--line);border-radius:8px;overflow:hidden;margin:6px 0 14px}.asx-barra i{display:block;height:100%;background:var(--ok);transition:width .3s}' +
    '.asx-lin{display:flex;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)}.asx-lin:last-child{border-bottom:0}' +
    '.asx-lin .q{flex:1;min-width:0}.asx-lin .q b{display:block;font-size:16px}.asx-lin .q small{color:var(--muted);font-size:13px}' +
    '.asx-lin .s{font-size:13px;font-weight:700;color:var(--ok);text-align:right;white-space:nowrap;margin-left:8px}.asx-lin .s.p{color:var(--muted)}' +
    '.asx-lin .btn{padding:7px 12px;font-size:14px;margin-left:8px}' +
    '.asx-pad{position:relative;background:#fff;border-radius:12px;height:190px;touch-action:none;margin-top:5px}' +
    '.asx-pad canvas{position:absolute;top:0;left:0;width:100%;height:100%;border-radius:12px;cursor:crosshair}' +
    '.asx-pad .ln{position:absolute;left:22px;right:22px;bottom:44px;border-bottom:1.5px solid #9ca3af;pointer-events:none}' +
    '.asx-pad .dc{position:absolute;left:0;right:0;bottom:16px;text-align:center;color:#9ca3af;font-size:14px;pointer-events:none}' +
    '.asx-chk{display:flex;align-items:flex-start;font-size:15px;margin:14px 0 4px;cursor:pointer}.asx-chk input{width:22px;height:22px;margin:1px 10px 0 0;flex:none;accent-color:#e6b955}' +
    '.asx-hash{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;word-break:break-all;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--muted);margin:4px 0 10px}' +
    '.asx-cod{font-family:var(--f-display);font-size:30px;letter-spacing:.08em;color:var(--gold)}' +
    '.asx-spin{display:inline-block;width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:asxg .7s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes asxg{to{transform:rotate(360deg)}}' +
    '.asx-det summary{cursor:pointer;color:var(--muted);font-size:14px;font-weight:700;margin:6px 0}';
  document.head.appendChild(st);

  // ---------- botões nos cartões do docs.js ----------
  var agendado = false;
  function agendar() { if (agendado) return; agendado = true; setTimeout(function () { agendado = false; decorar(); }, 0); }
  new MutationObserver(agendar).observe(lista, { childList: true, subtree: true });

  function decorar() {
    var bts = lista.querySelectorAll('[data-ver]');
    for (var i = 0; i < bts.length; i++) {
      var b = bts[i], id = b.getAttribute('data-ver'), acs = b.parentNode, card = acs && acs.parentNode;
      if (!card || !card.classList || !card.classList.contains('doc')) continue;
      var rec = ASS[id], c = rec ? contagem(rec) : null;
      var meu = !MESA && rec && dono ? !!sigsDe(rec)[dono] : false;
      var chave = [rec ? rec.status : '-', c ? c.n + '/' + c.t : '', dono || '', meu ? 1 : 0].join('|');
      if (card.getAttribute('data-asx') === chave && card.querySelector('.asx-el')) continue;
      if (card.getAttribute('data-asx') === chave && !rec && MESA === false) continue;
      card.setAttribute('data-asx', chave);
      var velhos = card.querySelectorAll('.asx-el');
      for (var k = 0; k < velhos.length; k++) velhos[k].parentNode.removeChild(velhos[k]);

      var tag = '', bt = '';
      if (rec && rec.status === 'finalizada') {
        tag = '<span class="tag asx-tag ok asx-el">ASSINADA</span>';
        bt = '<button class="btn asx-b asx-fin asx-el" type="button" data-asx-ver="' + esc(id) + '">📜 Ata assinada</button>';
      } else if (rec) {
        tag = '<span class="tag asx-tag asx-el">ASSINATURAS ' + c.n + '/' + c.t + '</span>';
        if (MESA) bt = '<button class="btn btn-ouro asx-b asx-el" type="button" data-asx-painel="' + esc(id) + '">✍ Assinaturas ' + c.n + '/' + c.t + '</button>';
        else if (meu) bt = '<div class="asx-feito asx-el" role="status">✔ Você assinou</div>';
        else bt = '<button class="btn btn-ouro asx-b asx-el" type="button" data-asx-assinar="' + esc(id) + '">✍ Assinar</button>';
      } else if (MESA) {
        bt = '<button class="btn btn-sec asx-b asx-el" type="button" data-asx-painel="' + esc(id) + '">✍ Assinaturas</button>';
      }
      if (bt) b.insertAdjacentHTML('afterend', bt);
      var sm = card.querySelector('.inf small');
      if (tag && sm) sm.insertAdjacentHTML('afterbegin', tag);
    }
  }

  lista.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-asx-painel],[data-asx-assinar],[data-asx-ver]') : null;
    if (!t) return;
    e.stopPropagation();
    if (t.hasAttribute('data-asx-painel')) painel(t.getAttribute('data-asx-painel'));
    else if (t.hasAttribute('data-asx-assinar')) modalAssinar(t.getAttribute('data-asx-assinar'), dono);
    else verAssinada(t.getAttribute('data-asx-ver'), t);
  });

  // Mesa: botão "Verificar" no topo
  if (MESA) {
    var volta = $('btnVoltar');
    if (volta) {
      volta.insertAdjacentHTML('beforebegin', '<button class="tb" id="asxVerif" type="button" title="Verificar a autenticidade de uma ata assinada">🔎 <span class="lbl">Verificar</span></button>');
      $('asxVerif').onclick = modalVerificar;
    }
  }

  // ---------- janelas ----------
  var fundo = null, painelId = null, ocupado = false;
  function abrirJanela(html) {
    fecharJanela();
    fundo = document.createElement('div'); fundo.className = 'asx-fundo';
    fundo.innerHTML = '<div class="asx-box" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', function (e) { if (e.target === fundo && !ocupado) fecharJanela(); });
    var x = fundo.querySelector('.asx-x'); if (x) x.onclick = function () { if (!ocupado) fecharJanela(); };
    return fundo;
  }
  function fecharJanela() { if (fundo && fundo.parentNode) fundo.parentNode.removeChild(fundo); fundo = null; painelId = null; ocupado = false; }
  document.addEventListener('keydown', function (e) {
    var vd = document.querySelector('.verdoc-top'); // o leitor de PDF trata o próprio Esc
    if (fundo && !ocupado && (e.key === 'Escape') && !(vd && vd.offsetParent)) fecharJanela();
  });
  function cab(titulo, sub) { return '<div class="asx-cab"><div><b>' + esc(titulo) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><button class="asx-x" type="button" aria-label="Fechar">×</button></div>'; }
  function q(sel) { return fundo ? fundo.querySelector(sel) : null; }
  function confirmar(titulo, texto, rotulo, perigo) {
    return new Promise(function (res) {
      var antes = painelId;
      abrirJanela(cab(titulo) + '<div class="asx-corpo">' + texto + '</div><div class="asx-pe"><button class="btn btn-sec" type="button" data-n>Cancelar</button><button class="btn ' + (perigo ? 'btn-del' : 'btn-ouro') + '" type="button" data-s>' + esc(rotulo) + '</button></div>');
      var fim = function (v) { fecharJanela(); if (antes && !v) painel(antes); res(v); };
      q('[data-n]').onclick = function () { fim(false); };
      q('.asx-x').onclick = function () { fim(false); };
      q('[data-s]').onclick = function () { fim(true); };
    });
  }
  function nomeDoc(id) { var d = ITENS[id] || {}; return d.nome || 'Ata'; }
  function subDoc(id) { var d = ITENS[id] || {}; return esc(nomeDoc(id)) + (d.data ? ' · Sessão de ' + dataBR(d.data) : ''); }

  // ---------- arquivos ----------
  async function lerOriginal(id) {
    var d = ITENS[id]; if (!d) throw new Error('Documento não encontrado.');
    var s = await rArq.child(id).once('value');
    var du = juntar(s.val(), d.partes || 0);
    if (!du) throw new Error('Não foi possível baixar o PDF da ata. Verifique a internet.');
    return du;
  }
  async function lerAssinada(id) {
    var rec = ASS[id]; if (!rec || !rec.partesFinal) throw new Error('PDF assinado não encontrado.');
    var s = await rFin.child(id).once('value');
    var du = juntar(s.val(), rec.partesFinal);
    if (!du) throw new Error('PDF assinado não encontrado.');
    var bytes = duParaBytes(du);
    if (await sha256Hex(bytes) !== rec.finalHash) throw new Error('O PDF assinado guardado não confere com o registro!');
    return { du: du, bytes: bytes };
  }
  function lerAta(id, botao) {
    if (botao) { botao.disabled = true; }
    toast('Abrindo ' + nomeDoc(id) + '…');
    lerOriginal(id).then(function (du) { if (window.VerDoc) VerDoc.abrir(du, nomeDoc(id), 'application/pdf'); })
      .catch(function (e) { toast(e.message, true); })
      .then(function () { if (botao) botao.disabled = false; });
  }
  function verAssinada(id, botao) {
    if (botao) botao.disabled = true;
    toast('Abrindo a ata assinada…');
    lerAssinada(id).then(function (r) { if (window.VerDoc) VerDoc.abrir(r.du, nomeDoc(id) + ' (assinada)', 'application/pdf'); })
      .catch(function (e) { toast(e.message, true); })
      .then(function () { if (botao) botao.disabled = false; });
  }

  // ---------- painel da Mesa ----------
  function atualizarPainel() { if (painelId && !ocupado && fundo) painel(painelId); }
  function painel(id) {
    var rec = ASS[id];
    if (!rec) return painelAbrir(id);
    var sigs = sigsDe(rec), c = contagem(rec), fin = rec.status === 'finalizada';
    var linhas = vagas(rec).map(function (v) {
      var s = sigs[v.vid];
      return '<div class="asx-lin"><div class="q"><b>' + esc(v.nome) + '</b><small>' + esc(v.cargo) + '</small></div>' +
        (s ? '<span class="s">✔ ' + esc(horaBR(s.em)) + '</span>'
          : '<span class="s p">' + (fin ? 'não assinou' : 'aguardando') + '</span>' + (fin ? '' : '<button class="btn btn-sec" type="button" data-aqui="' + v.vid + '">Assinar aqui</button>')) + '</div>';
    }).join('');
    var topo = fin
      ? '<div class="asx-al ok">Ata <b>lacrada</b> em ' + esc(horaBR(rec.finalizadaEm)) + '. Código de verificação:<div class="asx-cod">' + esc(rec.codigo) + '</div></div>'
      : '<div class="asx-al av">Aberta para assinatura desde ' + esc(horaBR(rec.abertaEm)) + '. Os vereadores assinam pelo tablet, no botão <b>✍ Assinar</b> desta ata.</div>';
    var det = '<details class="asx-det"><summary>Impressões digitais (SHA-256)</summary><div class="asx-info" style="margin:6px 0 2px">PDF original:</div><div class="asx-hash">' + esc(rec.pdfHash) + '</div>' +
      (rec.finalHash ? '<div class="asx-info" style="margin:6px 0 2px">PDF assinado:</div><div class="asx-hash">' + esc(rec.finalHash) + '</div>' : '') + '</details>';
    var pe = fin
      ? '<button class="btn btn-sec" type="button" data-ler>📄 PDF original</button><button class="btn btn-sec" type="button" data-baixar>⬇ Baixar PDF assinado</button><button class="btn btn-ouro" type="button" data-ver>📜 Ver ata assinada</button>'
      : '<button class="btn btn-del" type="button" data-cancelar>Cancelar coleta</button><button class="btn btn-sec" type="button" data-ler>📄 Ler a ata</button><button class="btn btn-ouro" type="button" data-finalizar>Finalizar e lacrar</button>';
    abrirJanela(cab('Assinaturas da ata', subDoc(id)) +
      '<div class="asx-corpo">' + topo +
      '<div style="display:flex;justify-content:space-between;font-weight:700"><span>' + c.n + ' de ' + c.t + ' assinaturas</span><span style="color:var(--muted)">' + Math.round(c.n / c.t * 100) + '%</span></div>' +
      '<div class="asx-barra"><i style="width:' + (c.n / c.t * 100) + '%"></i></div>' + linhas + det + '</div>' +
      '<div class="asx-pe">' + pe + '</div>');
    painelId = id;
    var on = function (sel, fn) { var el = q(sel); if (el) el.onclick = fn; };
    on('[data-ler]', function () { lerAta(id, this); });
    on('[data-ver]', function () { verAssinada(id, this); });
    on('[data-baixar]', function () {
      var bt = this; bt.disabled = true;
      lerAssinada(id).then(function (r) { baixarArquivo(r.bytes, nomeArquivo(nomeDoc(id)) + '_assinada.pdf'); }).catch(function (e) { toast(e.message, true); }).then(function () { bt.disabled = false; });
    });
    on('[data-finalizar]', function () { finalizar(id); });
    on('[data-cancelar]', function () {
      confirmar('Cancelar a coleta?', '<p style="margin:0">As <b>' + c.n + '</b> assinatura(s) já feitas nesta ata serão apagadas e ela volta a ser um documento comum. Isso não pode ser desfeito.</p>', 'Apagar assinaturas', true).then(function (ok) {
        if (!ok) return;
        Promise.all([rAss.child(id).remove(), rRub.child(id).remove()]).then(function () { toast('Coleta cancelada.'); }, function () { toast('Não foi possível cancelar. Verifique a internet.', true); });
      });
    });
    var aqui = fundo.querySelectorAll('[data-aqui]');
    for (var i = 0; i < aqui.length; i++) aqui[i].onclick = function () { modalAssinar(id, this.getAttribute('data-aqui'), true); };
  }

  function painelAbrir(id) {
    var ops = '<option value="">—</option>' + VERS.map(function (v) { return '<option value="' + v[0] + '">' + esc(v[1]) + '</option>'; }).join('');
    abrirJanela(cab('Coletar assinaturas', subDoc(id)) +
      '<div class="asx-corpo"><div class="asx-info" style="margin-top:0">Escolha a composição da Mesa nesta sessão. Os demais vereadores entram automaticamente como “Demais vereadores”. Ao abrir, o sistema grava a impressão digital do PDF: a ata não pode mais ser trocada sem invalidar as assinaturas.</div>' +
      '<div class="asx-g2">' + CARGOS.map(function (c) { return '<label class="asx-campo">' + c[1] + '<select data-cargo="' + c[0] + '">' + ops + '</select></label>'; }).join('') + '</div>' +
      '<div id="asxErr"></div></div>' +
      '<div class="asx-pe"><button class="btn btn-sec" type="button" data-n>Fechar</button><button class="btn btn-ouro" type="button" data-s>Abrir para assinatura</button></div>');
    painelId = null;
    // sugere a última Mesa usada
    var ult = null; Object.keys(ASS).forEach(function (k) { var r = ASS[k]; if (r && r.mesa && (!ult || (r.abertaEm || 0) > (ult.abertaEm || 0))) ult = r; });
    if (ult) CARGOS.forEach(function (c) { var s = q('[data-cargo="' + c[0] + '"]'); if (s && ult.mesa[c[0]]) s.value = ult.mesa[c[0]]; });
    q('[data-n]').onclick = fecharJanela;
    q('[data-s]').onclick = async function () {
      var err = function (m) { q('#asxErr').innerHTML = '<div class="asx-al err">' + m + '</div>'; };
      var mesa = {}, vistos = {};
      for (var i = 0; i < CARGOS.length; i++) {
        var v = q('[data-cargo="' + CARGOS[i][0] + '"]').value;
        if (!v) return err('Escolha o(a) ' + CARGOS[i][1].toLowerCase() + '.');
        if (vistos[v]) return err(NOME[v] + ' foi escolhido(a) em dois cargos.');
        vistos[v] = 1; mesa[CARGOS[i][0]] = v;
      }
      var bt = this; bt.disabled = true; bt.innerHTML = '<span class="asx-spin"></span>Conferindo o PDF…'; ocupado = true;
      try {
        var bytes = duParaBytes(await lerOriginal(id));
        var h = await sha256Hex(bytes);
        var rec = { status: 'aberta', mesa: mesa, pdfHash: h, pdfTamanho: bytes.length, nome: nomeDoc(id), data: (ITENS[id] || {}).data || '', abertaEm: Date.now() };
        var r = await rAss.child(id).transaction(function (cur) { return cur ? undefined : rec; });
        ocupado = false;
        var gravado = r.snapshot && r.snapshot.val();
        if (gravado) ASS[id] = gravado;   // não espera o aviso do banco para mostrar o painel
        if (!r.committed) { toast('Esta ata já estava aberta para assinatura.'); }
        else toast('Ata aberta para assinatura. Já aparece nos tablets.');
        painel(id);
      } catch (e) {
        ocupado = false; bt.disabled = false; bt.textContent = 'Abrir para assinatura'; err(esc(e.message || 'Erro ao abrir.'));
      }
    };
  }

  // ---------- assinar ----------
  var falhas = 0, travaAte = 0;
  function modalAssinar(id, vidFixo, daMesa) {
    var rec = ASS[id];
    if (!rec || rec.status !== 'aberta') { toast('Esta ata não está aberta para assinatura.', true); return; }
    var sigs = sigsDe(rec), vs = vagas(rec), pend = vs.filter(function (v) { return !sigs[v.vid]; });
    var fixo = vidFixo ? vs.filter(function (v) { return v.vid === vidFixo; })[0] : null;
    if (vidFixo && !fixo) { toast(NOME[vidFixo] + ' não está na lista de assinaturas desta ata.', true); return; }
    if (fixo && sigs[fixo.vid]) { toast(fixo.nome + ' já assinou esta ata.'); return; }
    if (!fixo && !pend.length) { toast('Todos já assinaram esta ata.'); return; }
    var escolha = fixo
      ? '<div class="asx-al">Assinando como <b>' + esc(fixo.nome) + '</b> · ' + esc(fixo.cargo) + '</div>'
      : '<label class="asx-campo">Quem está assinando?<select id="asxQuem"><option value="">Toque para escolher o seu nome</option>' +
        pend.map(function (v) { var bloq = !MESA && deOutroTablet(v.vid); return '<option value="' + v.vid + '"' + (bloq ? ' disabled' : '') + '>' + esc(v.nome) + ' — ' + esc(v.cargo) + (bloq ? ' (usa outro tablet)' : '') + '</option>'; }).join('') + '</select></label>';
    abrirJanela(cab('Assinar a ata', subDoc(id)) +
      '<div class="asx-corpo">' + escolha +
      '<button class="btn btn-sec" type="button" id="asxLer" style="width:100%;margin-bottom:14px">📄 Ler a ata antes de assinar</button>' +
      '<label class="asx-campo">Sua senha (a mesma de Anotações)<input type="password" id="asxPw" autocomplete="off" placeholder="Senha"></label>' +
      '<div class="asx-campo" style="margin-bottom:0">Desenhe sua assinatura com o dedo ou a caneta' +
      '<div class="asx-pad"><canvas id="asxPad"></canvas><div class="ln"></div><div class="dc" id="asxDica">assine aqui</div></div></div>' +
      '<div style="text-align:right;margin-top:6px"><button class="btn btn-sec" type="button" id="asxLimpar" style="padding:6px 12px;font-size:14px">Limpar</button></div>' +
      '<label class="asx-chk"><input type="checkbox" id="asxAceite"><span>Declaro que li a ata e concordo com seu teor. Reconheço esta assinatura eletrônica como minha, com a mesma validade da assinatura manuscrita.</span></label>' +
      '<div id="asxErr"></div></div>' +
      '<div class="asx-pe"><button class="btn btn-sec" type="button" data-n>Cancelar</button><button class="btn btn-ouro" type="button" id="asxOk">✍ Assinar a ata</button></div>');
    painelId = null;
    var voltar = function () { fecharJanela(); if (daMesa) painel(id); };
    q('[data-n]').onclick = voltar; q('.asx-x').onclick = voltar;
    q('#asxLer').onclick = function () { lerAta(id, this); };
    var pad = criarPad(q('#asxPad'), function () { var d = $('asxDica'); if (d) d.style.display = 'none'; });
    q('#asxLimpar').onclick = function () { pad.limpar(); var d = $('asxDica'); if (d) d.style.display = ''; };
    q('#asxOk').onclick = async function () {
      var bt = this, errEl = q('#asxErr');
      var err = function (m) { errEl.innerHTML = '<div class="asx-al err">' + m + '</div>'; };
      errEl.innerHTML = '';
      var vid = fixo ? fixo.vid : q('#asxQuem').value;
      var vaga = vs.filter(function (v) { return v.vid === vid; })[0];
      if (!vaga) return err('Escolha o seu nome.');
      if (Date.now() < travaAte) return err('Muitas tentativas. Aguarde ' + Math.ceil((travaAte - Date.now()) / 1000) + ' segundos.');
      var pw = q('#asxPw').value;
      if (!pw) { q('#asxPw').focus(); return err('Digite a sua senha.'); }
      if (pad.vazio()) return err('Desenhe a sua assinatura no quadro branco.');
      if (!q('#asxAceite').checked) return err('Marque a declaração de leitura e concordância.');
      bt.disabled = true; bt.innerHTML = '<span class="asx-spin"></span>Conferindo a senha…'; ocupado = true;
      var parar = function (m) { ocupado = false; bt.disabled = false; bt.textContent = '✍ Assinar a ata'; err(m); };
      try {
        var sv = (await db.ref(RAIZ + '/anotacoes/senhas/' + vid).once('value')).val();
        if (!sv || !sv.hash || !sv.salt) return parar('A senha de ' + esc(vaga.nome) + ' ainda não foi cadastrada (é a mesma de Anotações). Procure a Mesa.');
        if (await kdf(pw, sv.salt) !== sv.hash) {
          falhas++; if (falhas >= 5) { falhas = 0; travaAte = Date.now() + 30000; }
          q('#asxPw').value = ''; q('#asxPw').focus();
          return parar('Senha incorreta.');
        }
        falhas = 0;
        bt.innerHTML = '<span class="asx-spin"></span>Conferindo o documento…';
        var docHash = await sha256Hex(duParaBytes(await lerOriginal(id)));
        var atual = ASS[id];
        if (!atual || atual.status !== 'aberta') return parar('A ata não está mais aberta para assinatura.');
        if (docHash !== atual.pdfHash) return parar('O PDF desta ata foi trocado depois de aberto para assinatura. Assinatura bloqueada — avise a Mesa.');
        bt.innerHTML = '<span class="asx-spin"></span>Assinando…';
        var img = pad.png(), imgHash = await sha256Hex(img);
        var reg = { vid: vid, nome: vaga.nome, cargo: vaga.cargo, em: Date.now(), imgHash: imgHash, docHash: docHash, rub: vid + '_' + imgHash.slice(0, 16),
          aparelho: (MESA ? 'Notebook da Mesa · ' : 'Tablet · ') + String(navigator.userAgent || '').slice(0, 150) };
        reg.hash = await sha256Hex(baseAssinatura(id, reg));
        await rRub.child(id).child(reg.rub).set(img);
        var r = await rAss.child(id).transaction(function (cur) {
          if (cur === null) return null;
          if (!cur || cur.status !== 'aberta') return;
          cur.sigs = cur.sigs || {};
          if (cur.sigs[vid]) return;
          cur.sigs[vid] = reg; return cur;
        });
        var depois = r.snapshot && r.snapshot.val();
        var ok = depois && depois.sigs && depois.sigs[vid] && depois.sigs[vid].hash === reg.hash;
        if (!ok) {
          if (!(depois && depois.sigs && depois.sigs[vid])) rRub.child(id).child(reg.rub).remove().catch(function () {});
          return parar(depois && depois.sigs && depois.sigs[vid] ? esc(vaga.nome) + ' já tinha assinado esta ata.' : 'A ata não está mais aberta para assinatura.');
        }
        rAss.child(id).child('sigs').child(vid).child('emServidor').set(firebase.database.ServerValue.TIMESTAMP).catch(function () {});
        ocupado = false; fecharJanela();
        toast('✔ Ata assinada por ' + vaga.nome + '.');
        if (daMesa) painel(id);
      } catch (e) {
        parar(esc((e && e.message) || 'Não foi possível assinar. Verifique a internet.'));
      }
    };
  }

  function criarPad(canvas, aoDesenhar) {
    var ctx = canvas.getContext('2d'), desenhando = false, tracos = 0, ult = null;
    function ajustar() {
      var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (!r.width) return;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f4d'; ctx.fillStyle = '#0b1f4d';
      tracos = 0;
    }
    requestAnimationFrame(ajustar);
    var pos = function (e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }; };
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      desenhando = true; ult = pos(e); tracos++; if (aoDesenhar) aoDesenhar();
      ctx.beginPath(); ctx.arc(ult.x, ult.y, 1.2, 0, Math.PI * 2); ctx.fill();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!desenhando) return; e.preventDefault();
      var p = pos(e);
      ctx.lineWidth = 1.6 + p.p * 2.2; ctx.beginPath(); ctx.moveTo(ult.x, ult.y);
      var mx = (ult.x + p.x) / 2, my = (ult.y + p.y) / 2; ctx.quadraticCurveTo(ult.x, ult.y, mx, my); ctx.lineTo(p.x, p.y); ctx.stroke(); ult = p;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { desenhando = false; }); });
    return {
      limpar: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); tracos = 0; },
      vazio: function () { return tracos === 0; },
      png: function () {   // recorta o espaço em branco em volta da assinatura
        var w = canvas.width, h = canvas.height, d = ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        var m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
        var c = document.createElement('canvas'), mx = 900, esc2 = Math.min(1, mx / Math.max(1, x1 - x0));
        c.width = Math.max(1, Math.round((x1 - x0) * esc2)); c.height = Math.max(1, Math.round((y1 - y0) * esc2));
        c.getContext('2d').drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
        return c.toDataURL('image/png');
      }
    };
  }

  // ---------- finalizar e gerar o PDF assinado ----------
  var libPromessa = null;
  function carregarPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (libPromessa) return libPromessa;
    libPromessa = new Promise(function (res, rej) {
      var i = 0;
      (function tentar() {
        if (i >= PDFLIB.length) { libPromessa = null; rej(new Error('Não foi possível carregar o gerador de PDF. Verifique a internet.')); return; }
        var s = document.createElement('script'); s.src = PDFLIB[i++];
        s.onload = function () { window.PDFLib ? res(window.PDFLib) : tentar(); };
        s.onerror = tentar;
        document.head.appendChild(s);
      })();
    });
    return libPromessa;
  }

  async function finalizar(id) {
    var rec = ASS[id], c = contagem(rec);
    var ok = await confirmar('Finalizar e lacrar a ata?',
      (c.n < c.t ? '<div class="asx-al av">Faltam <b>' + (c.t - c.n) + '</b> assinatura(s). Quem não assinou aparecerá como “não assinou”.</div>' : '') +
      '<p style="margin:0">Depois de lacrada, ninguém mais assina. O sistema gera o PDF assinado, com a folha de assinaturas, o manifesto de autenticidade e o código de verificação.</p>',
      'Finalizar e lacrar');
    if (!ok) return;
    abrirJanela(cab('Gerando a ata assinada', subDoc(id)) + '<div class="asx-corpo"><div class="asx-al"><span class="asx-spin"></span><span id="asxEtapa">Preparando…</span></div></div>');
    ocupado = true;
    var etapa = function (t) { var el = $('asxEtapa'); if (el) el.textContent = t; };
    try {
      rec = ASS[id];
      if (!rec || rec.status !== 'aberta') throw new Error('A ata não está mais aberta.');
      etapa('Carregando o gerador de PDF…');
      var PDFLib = await carregarPdfLib();
      etapa('Conferindo o PDF original…');
      var orig = duParaBytes(await lerOriginal(id));
      if (await sha256Hex(orig) !== rec.pdfHash) throw new Error('O PDF da ata não confere com o registro aberto para assinatura. Finalização bloqueada.');
      etapa('Conferindo as assinaturas…');
      var rubs = (await rRub.child(id).once('value')).val() || {}, sigs = sigsDe(rec), vs = vagas(rec);
      for (var i = 0; i < vs.length; i++) {
        var s = sigs[vs[i].vid]; if (!s) continue;
        if (!rubs[s.rub] || await sha256Hex(rubs[s.rub]) !== s.imgHash) throw new Error('A imagem da assinatura de ' + s.nome + ' não confere.');
        if (await sha256Hex(baseAssinatura(id, s)) !== s.hash) throw new Error('O registro da assinatura de ' + s.nome + ' não confere.');
      }
      var finalizadaEm = Date.now(), codigo = await codigoDe(rec);
      var usadas = Object.keys(sigs).sort().join(',');
      etapa('Montando o PDF assinado…');
      var bytes = await gerarPdf(PDFLib, orig, Object.assign({}, rec, { id: id, codigo: codigo, finalizadaEm: finalizadaEm, nome: nomeDoc(id), data: (ITENS[id] || {}).data || rec.data }), rubs);
      var finalHash = await sha256Hex(bytes);
      etapa('Guardando no sistema…');
      var du = bytesParaDu(bytes), partes = Math.ceil(du.length / PARTE), obj = {};
      for (var k = 0; k < partes; k++) obj[k] = du.slice(k * PARTE, (k + 1) * PARTE);
      await rFin.child(id).set(obj);
      var r = await rAss.child(id).transaction(function (cur) {
        if (cur === null) return null;
        if (!cur || cur.status !== 'aberta') return;
        if (Object.keys(cur.sigs || {}).sort().join(',') !== usadas) return;   // chegou assinatura nova no meio
        cur.status = 'finalizada'; cur.finalizadaEm = finalizadaEm; cur.codigo = codigo; cur.finalHash = finalHash; cur.partesFinal = partes;
        return cur;
      });
      var v = r.snapshot && r.snapshot.val();
      if (!v || v.status !== 'finalizada' || v.finalHash !== finalHash) {
        rFin.child(id).remove().catch(function () {});
        throw new Error('Uma assinatura chegou durante a finalização. Confira e clique em Finalizar de novo.');
      }
      ocupado = false;
      toast('✔ Ata lacrada. Código ' + codigo + '.');
      painel(id);
    } catch (e) {
      ocupado = false; fecharJanela(); toast((e && e.message) || 'Erro ao finalizar.', true); painel(id);
    }
  }

  async function gerarPdf(PDFLib, orig, ata, rubs) {
    var PDFDocument = PDFLib.PDFDocument, StandardFonts = PDFLib.StandardFonts, rgb = PDFLib.rgb;
    var doc = await PDFDocument.load(orig, { ignoreEncryption: true });
    var fN = await doc.embedFont(StandardFonts.Helvetica), fB = await doc.embedFont(StandardFonts.HelveticaBold), fM = await doc.embedFont(StandardFonts.Courier);
    var preto = rgb(0, 0, 0), cinza = rgb(0.35, 0.35, 0.35), azul = rgb(0.06, 0.16, 0.29), verm = rgb(0.6, 0.1, 0.1);
    var sigs = sigsDe(ata), vs = vagas(ata), totalPag = doc.getPageCount() + 2;
    var rodape = function (pg, i) {
      var w = pg.getSize().width, txt = 'Documento assinado eletronicamente · Código de verificação ' + ata.codigo + ' · Página ' + i + ' de ' + totalPag;
      pg.drawText(txt, { x: (w - fN.widthOfTextAtSize(txt, 7)) / 2, y: 14, size: 7, font: fN, color: cinza });
    };
    doc.getPages().forEach(function (pg, i) { rodape(pg, i + 1); });

    // folha de assinaturas (modelo da Câmara)
    var W = 595.28, H = 841.89, pg = doc.addPage([W, H]);
    var cabTxt = PLENARIO + (ata.data ? ', ' + dataExtenso(ata.data) : '') + '.';
    var tam = 11.5; while (fB.widthOfTextAtSize(cabTxt, tam) > W - 80) tam -= 0.5;
    pg.drawText(cabTxt, { x: (W - fB.widthOfTextAtSize(cabTxt, tam)) / 2, y: H - 70, size: tam, font: fB, color: preto });
    var y = H - 140, xRot = 150, xFim = 520;
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i], s = sigs[v.vid];
      var xLinha = v.rotulo ? xRot + fN.widthOfTextAtSize(v.rotulo + ': ', 11) : xRot + 15;
      if (v.rotulo) pg.drawText(v.rotulo + ':', { x: xRot, y: y, size: 11, font: fN, color: preto });
      pg.drawLine({ start: { x: xLinha, y: y - 2 }, end: { x: xFim, y: y - 2 }, thickness: 0.9, color: preto });
      if (s && rubs[s.rub]) {
        var png = await doc.embedPng(rubs[s.rub]);
        var alt = 40, larg = Math.min(png.width * alt / png.height, xFim - xLinha - 10), altR = png.height * larg / png.width;
        pg.drawImage(png, { x: xLinha + (xFim - xLinha - larg) / 2, y: y - 1, width: larg, height: altR });
      }
      var leg = s ? v.nome + ' — assinado eletronicamente em ' + horaBR(s.em) : v.nome + ' — não assinou';
      pg.drawText(leg, { x: xLinha, y: y - 12, size: 7, font: fN, color: s ? cinza : verm });
      y -= 62;
    }
    rodape(pg, totalPag - 1);

    // manifesto
    var mf = doc.addPage([W, H]), my = H - 60;
    var t = function (txt, o) {
      o = o || {};
      var f = o.font || fN, sz = o.size || 9, larg = W - 100, linhas = [], atual = '';
      String(txt).split(' ').forEach(function (p) { var tst = atual ? atual + ' ' + p : p; if (f.widthOfTextAtSize(tst, sz) > larg && atual) { linhas.push(atual); atual = p; } else atual = tst; });
      if (atual) linhas.push(atual);
      linhas.forEach(function (l, k) { mf.drawText(l, { x: 50, y: my, size: sz, font: f, color: o.color || preto }); my -= (k < linhas.length - 1 ? sz + 3 : (o.gap || 14)); });
    };
    t('MANIFESTO DE ASSINATURAS ELETRÔNICAS', { font: fB, size: 14, color: azul, gap: 22 });
    t(CAMARA, { font: fB, size: 10 });
    t(ata.nome + (ata.data ? ' · Sessão de ' + dataBR(ata.data) : ''), { size: 10, gap: 20 });
    t('Código de verificação: ' + ata.codigo, { font: fB, size: 12, color: azul, gap: 18 });
    t('SHA-256 do documento original:');
    t(ata.pdfHash, { font: fM, size: 8.2, gap: 16 });
    t('Aberta para assinatura em ' + horaBR(ata.abertaEm) + ' · Lacrada em ' + horaBR(ata.finalizadaEm), { gap: 24 });
    mf.drawLine({ start: { x: 50, y: my + 10 }, end: { x: W - 50, y: my + 10 }, thickness: 0.5, color: cinza });
    vs.filter(function (v) { return sigs[v.vid]; }).sort(function (a, b) { return sigs[a.vid].em - sigs[b.vid].em; }).forEach(function (v) {
      var s = sigs[v.vid];
      t(s.nome + ' — ' + s.cargo, { font: fB, size: 10, gap: 13 });
      t('Assinado em ' + horaBR(s.em) + ' (horário de Brasília) · Senha pessoal confirmada · Declaração de leitura aceita', { size: 8, color: cinza, gap: 11 });
      t('Hash da assinatura: ' + s.hash, { font: fM, size: 7.2, color: cinza, gap: 18 });
    });
    var faltam = vs.filter(function (v) { return !sigs[v.vid]; });
    if (faltam.length) t('Não assinaram: ' + faltam.map(function (v) { return v.nome; }).join(', '), { size: 9, color: verm, gap: 20 });
    my -= 6;
    ['Este documento foi assinado eletronicamente no Sistema Plenário da Câmara Municipal de Almadina.',
      'Cada assinatura vincula o signatário, o cargo, a data/hora e a impressão digital SHA-256 do documento original.',
      'Qualquer alteração no conteúdo da ata invalida as impressões digitais acima. Para conferir a autenticidade,',
      'use a opção "Verificar" da página Atas / Proposições com o código de verificação ou com este arquivo PDF.'
    ].forEach(function (l) { t(l, { size: 8.5, color: cinza, gap: 12 }); });
    rodape(mf, totalPag);

    doc.setTitle(ata.nome + ' — assinada'); doc.setSubject('Código de verificação ' + ata.codigo);
    doc.setProducer('Sistema Plenário — Câmara Municipal de Almadina'); doc.setCreator('Sistema Plenário');
    doc.setCreationDate(new Date(ata.finalizadaEm)); doc.setModificationDate(new Date(ata.finalizadaEm));
    return doc.save();
  }

  // ---------- verificar autenticidade ----------
  function modalVerificar() {
    abrirJanela(cab('Verificar autenticidade', 'Confere se uma ata assinada é original') +
      '<div class="asx-corpo"><div class="asx-info" style="margin-top:0">Escolha o PDF da ata (o assinado ou o original) <b>ou</b> digite o código de verificação impresso no rodapé. Qualquer alteração no arquivo, mesmo de uma vírgula, é detectada.</div>' +
      '<label class="asx-campo">Arquivo PDF<input type="file" id="asxVArq" accept="application/pdf,.pdf"></label>' +
      '<label class="asx-campo">ou código de verificação<input type="text" id="asxVCod" placeholder="XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.08em"></label>' +
      '<div id="asxVRes"></div></div>' +
      '<div class="asx-pe"><button class="btn btn-sec" type="button" data-n>Fechar</button><button class="btn btn-ouro" type="button" data-s>Verificar</button></div>');
    q('[data-n]').onclick = fecharJanela;
    q('[data-s]').onclick = async function () {
      var out = q('#asxVRes'), f = q('#asxVArq').files[0], cod = q('#asxVCod').value.trim().toUpperCase();
      if (!f && !cod) { out.innerHTML = '<div class="asx-al av">Escolha um PDF ou digite o código.</div>'; return; }
      out.innerHTML = '<div class="asx-al"><span class="asx-spin"></span>Verificando…</div>';
      try {
        var id = null, como = '';
        var ids = Object.keys(ASS);
        if (f) {
          var h = await sha256Hex(new Uint8Array(await f.arrayBuffer()));
          id = ids.filter(function (k) { return ASS[k].finalHash === h; })[0]; como = 'PDF assinado';
          if (!id) { id = ids.filter(function (k) { return ASS[k].pdfHash === h; })[0]; como = 'PDF original da ata'; }
          if (!id) { out.innerHTML = '<div class="asx-al err"><b>Documento NÃO reconhecido.</b> Este arquivo não corresponde a nenhuma ata assinada no sistema — ou foi alterado depois de assinado.<div class="asx-hash">SHA-256: ' + h + '</div></div>'; return; }
        } else {
          id = ids.filter(function (k) { return ASS[k].codigo === cod; })[0]; como = 'código de verificação';
          if (!id) { out.innerHTML = '<div class="asx-al err"><b>Código não encontrado.</b> Confira se foi digitado corretamente.</div>'; return; }
        }
        var rec = ASS[id], sigs = sigsDe(rec), integro = true;
        var rubs = (await rRub.child(id).once('value')).val() || {};
        var vs = vagas(rec);
        for (var i = 0; i < vs.length; i++) {
          var s = sigs[vs[i].vid]; if (!s) continue;
          if (await sha256Hex(baseAssinatura(id, s)) !== s.hash || s.docHash !== rec.pdfHash || !rubs[s.rub] || await sha256Hex(rubs[s.rub]) !== s.imgHash) integro = false;
        }
        if (rec.codigo && await codigoDe(rec) !== rec.codigo) integro = false;
        out.innerHTML = '<div class="asx-al ' + (integro ? 'ok' : 'err') + '"><b>' + (integro ? '✔ Documento AUTÊNTICO' : '✖ Registro com divergência') + '</b> — identificado pelo ' + como + '.<br>' +
          subDoc(id) + ' · ' + (rec.status === 'finalizada' ? 'Lacrada em ' + esc(horaBR(rec.finalizadaEm)) : 'Ainda em assinatura') +
          (rec.codigo ? '<br>Código: <b>' + esc(rec.codigo) + '</b>' : '') + '</div>' +
          vs.map(function (v) { var s = sigs[v.vid]; return '<div class="asx-lin"><div class="q"><b>' + esc(v.nome) + '</b><small>' + esc(v.cargo) + '</small></div>' + (s ? '<span class="s">✔ ' + esc(horaBR(s.em)) + '</span>' : '<span class="s p">não assinou</span>') + '</div>'; }).join('');
      } catch (e) {
        out.innerHTML = '<div class="asx-al err">' + esc((e && e.message) || 'Erro ao verificar.') + '</div>';
      }
    };
  }
})();
