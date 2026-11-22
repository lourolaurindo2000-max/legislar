/* Aviso da Lista de Presença do Vereador (ES5) — carregado no painel (dashboard.html).
   Mesmo jeito do aviso da Assinatura Digital de Atas (js/assinatura-aviso.js):
   Tablets/celulares: quando a Mesa envia a lista (legislar/listaPresenca/enviada), aparece
     "📝 Lista de presença para você assinar" com "Assinar agora". Some quando o dono do tablet assinar.
   Notebook da Mesa: a cada nova presença assinada, aparece o aviso com "Abrir para imprimir".
   Não aparece na Smart TV nem dentro de quadros. Só lê; nunca grava. */
(function () {
  var W = window, D = document;
  try { if (W.self !== W.top) return; } catch (e) { return; }
  var UA = navigator.userAgent || '';
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(UA)) return;
  var ehNotebook = false, ehTablet = false;
  try { ehNotebook = !/Android|iPhone|iPad|iPod|Mobile/i.test(UA) && matchMedia('(any-pointer: fine)').matches; } catch (e) {}
  try { ehTablet = !ehNotebook && navigator.maxTouchPoints > 0; } catch (e) {}

  var RAIZ = (W.__DOC_RAIZ || 'legislar') + '/listaPresenca';
  var NOME = { v1: 'Jackson Costa', v2: 'Dilson Junior', v3: 'Lucas Cavalcante', v4: 'Marilene Santos', v5: 'Nilza Damasceno',
    v6: 'Rogério Gotado', v7: 'Sylas Souza', v8: 'José Lindomar', v9: 'Wilson Freitas' };
  var FASE = { pequeno: 'Pequeno Expediente', grande: 'Grande Expediente' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function chave(n) {
    var s = String(n || '');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function contar(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function dataBR(iso) { return String(iso || '').split('-').reverse().join('/'); }

  var caixa = null, destino = '', chaveFechado = '';
  function montar() {
    var st = D.createElement('style');
    st.appendChild(D.createTextNode(
      '#lp-aviso{position:fixed;left:50%;bottom:calc(3vmin + 4px);transform:translateX(-50%);z-index:2147483001;width:min(92vw,620px);background:#0a1022;color:#eef2fb;' +
      'border:2px solid #3fb27f;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.6);padding:16px 20px;font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif}' +
      '#lp-aviso b{display:block;color:#7fdcae;font-size:clamp(17px,3.2vmin,24px);margin-bottom:6px}' +
      '#lp-aviso p{margin:0 0 14px;font-size:clamp(14px,2.5vmin,19px);overflow-wrap:anywhere}' +
      '#lp-aviso .lp-l{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}' +
      '#lp-aviso button{border:0;border-radius:12px;padding:12px 18px;font-weight:800;font-size:clamp(14px,2.4vmin,18px);cursor:pointer;min-height:46px}' +
      '#lp-aviso .lp-abrir{background:#3fb27f;color:#0a1022}#lp-aviso .lp-fechar{background:transparent;color:#c9d2ea;border:1px solid rgba(255,255,255,.3)}'));
    D.head.appendChild(st);
    caixa = D.createElement('div'); caixa.id = 'lp-aviso'; caixa.style.display = 'none';
    D.body.appendChild(caixa);
    caixa.addEventListener('click', function (e) {
      var t = e.target;
      if (t.className === 'lp-abrir') location.href = destino;
      else if (t.className === 'lp-fechar') { caixa.style.display = 'none'; if (chaveFechado) ss(chaveFechado, '1'); }
    });
  }
  function mostrar(titulo, texto, botao, url, kFechado) {
    if (kFechado && ss(kFechado)) return esconder();
    if (!caixa) montar();
    destino = url; chaveFechado = kFechado || '';
    caixa.innerHTML = '<b>' + esc(titulo) + '</b><p>' + texto + '</p>' +
      '<div class="lp-l"><button type="button" class="lp-fechar">Depois</button><button type="button" class="lp-abrir">' + esc(botao) + '</button></div>';
    caixa.style.display = 'block';
  }
  function esconder() { if (caixa) caixa.style.display = 'none'; }
  function ehMesa() {
    var c = null; try { c = W.PldAuth && PldAuth.conta(); } catch (e) {}
    return c === 'mesa' || (ehNotebook && c !== 'tv');
  }

  var tentativas = 0;
  function iniciar() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      if (++tentativas < 120) setTimeout(iniciar, 500);
      return;
    }
    var db; try { db = firebase.database(); } catch (e) { return; }
    var meuVid = null, dev = null, env = null, lista = null, refLista = null;
    try { dev = localStorage.getItem('vp_dev'); } catch (e) {}

    function avaliar() {
      if (!env || !lista) return esconder();
      var sigs = lista[env.fase] || {}, n = contar(sigs);
      var tit = esc(lista.titulo || 'Sessão') + ' — ' + dataBR(lista.data) + ' · ' + FASE[env.fase];
      if (ehMesa()) {
        if (!n) return esconder();
        mostrar('📝 Lista de presença: ' + n + ' assinatura(s)', tit + ' — pronta para imprimir.',
          'Abrir para imprimir', 'presenca-lista.html?v=' + Date.now() + '#lista-' + env.id, 'lp_mesa_' + env.id + '_' + env.fase + '_' + n);
        return;
      }
      if (!ehTablet) return esconder();
      var meuNome = meuVid && NOME[meuVid];
      if (meuNome && sigs[chave(meuNome)]) return esconder();   // já assinou este expediente
      mostrar('📝 Lista de presença para você assinar', tit + '<br><small>A Mesa enviou a lista de presença' +
        (meuNome ? ', ' + esc(meuNome) : '') + '. Assine pelo tablet.</small>',
        'Assinar agora', 'presenca-lista.html?v=' + Date.now(), 'lp_tab_' + env.id + '_' + env.fase + '_' + (env.em || ''));
    }

    db.ref((W.__DOC_RAIZ || 'legislar') + '/votacao/aparelhos').on('value', function (s) {
      var a = s.val() || {}; meuVid = null;
      for (var k in a) if (a.hasOwnProperty(k) && a[k] && dev && a[k].dev === dev) meuVid = k;
      avaliar();
    });
    db.ref(RAIZ + '/enviada').on('value', function (s) {
      var v = s.val();
      env = v && v.id ? v : null;
      if (refLista) { refLista.off(); refLista = null; lista = null; }
      if (!env) return esconder();
      refLista = db.ref(RAIZ + '/listas/' + env.id);
      refLista.on('value', function (s2) { lista = s2.val(); avaliar(); });
    });
  }
  if (D.body) iniciar(); else D.addEventListener('DOMContentLoaded', iniciar);
})();
