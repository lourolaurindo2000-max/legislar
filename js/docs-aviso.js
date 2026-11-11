/* Aviso nos tablets (ES5): quando a Mesa envia um PDF para Ordem do Dia, Atas / Proposições ou
   Arquivos Diversos (legislar/docs/{secao}/itens), o tablet mostra um aviso com o botão "Abrir".
   Arquivos Diversos: só avisa se o documento for "para todos" ou para o dono deste tablet.
   Só tablets/celulares (não aparece na Smart TV nem no notebook). Só lê; nunca grava. */
(function () {
  var ehTablet = false;
  try {
    ehTablet = navigator.maxTouchPoints > 0 && (!matchMedia('(any-pointer: fine)').matches || matchMedia('(pointer: coarse)').matches || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent || '')) && window.self === window.top;
  } catch (e) { ehTablet = false; }
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent || '')) ehTablet = false;
  if (window.__AV_TESTE) ehTablet = true;
  if (!ehTablet) return;
  var RAIZ = window.__DOC_RAIZ || 'legislar';
  var SECOES = [
    { id: 'ordem', nome: 'Ordem do Dia', pag: 'ordem_do_dia.html' },
    { id: 'atas', nome: 'Atas / Proposições', pag: 'atas.html' },
    { id: 'diversos', nome: 'Arquivos Diversos', pag: 'arquivos_diversos.html', pessoal: true }
  ];

  var caixa = null, offset = 0, meuVid = null, destino = '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function montar() {
    var st = document.createElement('style');
    st.appendChild(document.createTextNode(
      '#dc-aviso{position:fixed;left:50%;top:3vmin;transform:translateX(-50%);z-index:2147483001;width:min(92vw,620px);background:#0a1022;color:#eef2fb;' +
      'border:2px solid #e6b955;border-radius:2.4vmin;box-shadow:0 2vmin 6vmin rgba(0,0,0,.6);padding:2.4vmin 2.8vmin;font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif}' +
      '#dc-aviso b{display:block;color:#e6b955;font-size:3.4vmin;margin-bottom:.8vmin}' +
      '#dc-aviso p{margin:0 0 1.8vmin;font-size:2.6vmin;overflow-wrap:anywhere;max-height:16vmin;overflow:hidden}' +
      '#dc-aviso .dc-l{display:flex;justify-content:flex-end}' +
      '#dc-aviso button{border:0;border-radius:1.4vmin;padding:1.6vmin 2.6vmin;font-weight:800;font-size:2.4vmin;margin-left:1.4vmin;cursor:pointer}' +
      '#dc-aviso .dc-abrir{background:#e6b955;color:#0a1022}#dc-aviso .dc-fechar{background:transparent;color:#c9d2ea;border:1px solid rgba(255,255,255,.3)}'));
    document.head.appendChild(st);
    caixa = document.createElement('div'); caixa.id = 'dc-aviso'; caixa.style.display = 'none';
    document.body.appendChild(caixa);
    caixa.addEventListener('click', function (e) {
      var t = e.target;
      if (t.className === 'dc-abrir') location.href = destino;
      else if (t.className === 'dc-fechar') caixa.style.display = 'none';
    });
  }
  function mostrar(sec, d) {
    if (!caixa) montar();
    destino = sec.pag;
    caixa.innerHTML = '<b>📄 Novo documento em ' + esc(sec.nome) + '</b><p>' + esc(d.nome || '') + '</p>' +
      '<div class="dc-l"><button type="button" class="dc-fechar">Fechar</button><button type="button" class="dc-abrir">Abrir ' + esc(sec.nome) + '</button></div>';
    caixa.style.display = 'block';
  }

  var tentativas = 0;
  function iniciar() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      if (++tentativas < 120) setTimeout(iniciar, 500);
      return;
    }
    var db; try { db = firebase.database(); } catch (e) { return; }
    db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
    var dev = null; try { dev = localStorage.getItem('vp_dev'); } catch (e) {}
    db.ref(RAIZ + '/votacao/aparelhos').on('value', function (s) {
      var a = s.val() || {}; meuVid = null;
      for (var k in a) if (a.hasOwnProperty(k) && a[k] && dev && a[k].dev === dev) meuVid = k;
    });
    SECOES.forEach(function (sec) {
      // o que já existia ao abrir aparece dentro da página; aqui só o que chega depois
      var q = db.ref(RAIZ + '/docs/' + sec.id + '/itens').orderByChild('criadoEm').limitToLast(1), pronto = false;
      function ver(s) {
        var v = s.val() || {};
        if (!pronto || !v.criadoEm || !v.nome) return;
        if (Date.now() + offset - v.criadoEm > 5 * 60000) return;   // sinal antigo
        if (sec.pessoal && !(v.dono === 'todos' || (meuVid && v.dono === meuVid))) return;
        if (sec.pessoal && v.por === meuVid) return;   // o próprio vereador enviou
        mostrar(sec, v);
      }
      q.on('child_added', ver);
      q.once('value', function () { pronto = true; });
    });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
