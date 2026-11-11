/* Aviso nos tablets (ES5): quando a Mesa envia uma mensagem ou arquivo em Anotações do Vereador
   (legislar/anotacoes/mesa/mensagens), o tablet mostra um aviso com o botão "Abrir Anotações".
   Só tablets/celulares (não aparece na Smart TV nem no notebook). Só lê; nunca grava. */
(function () {
  var ehTablet = false;
  try {
    ehTablet = navigator.maxTouchPoints > 0 && (!matchMedia('(any-pointer: fine)').matches || matchMedia('(pointer: coarse)').matches || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent || '')) && window.self === window.top;
  } catch (e) { ehTablet = false; }
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent || '')) ehTablet = false;
  if (window.__AV_TESTE) ehTablet = true;
  if (!ehTablet) return;
  var RAIZ = window.__AN_RAIZ || 'legislar';

  var caixa = null, offset = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function montar() {
    var st = document.createElement('style');
    st.appendChild(document.createTextNode(
      '#an-aviso{position:fixed;left:50%;top:3vmin;transform:translateX(-50%);z-index:2147483000;width:min(92vw,620px);background:#0a1022;color:#eef2fb;' +
      'border:2px solid #e6b955;border-radius:2.4vmin;box-shadow:0 2vmin 6vmin rgba(0,0,0,.6);padding:2.4vmin 2.8vmin;font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif}' +
      '#an-aviso b{display:block;color:#e6b955;font-size:3.4vmin;margin-bottom:.8vmin}' +
      '#an-aviso p{margin:0 0 1.8vmin;font-size:2.6vmin;white-space:pre-wrap;overflow-wrap:anywhere;max-height:16vmin;overflow:hidden}' +
      '#an-aviso .an-l{display:flex;justify-content:flex-end}' +
      '#an-aviso button{border:0;border-radius:1.4vmin;padding:1.6vmin 2.6vmin;font-weight:800;font-size:2.4vmin;margin-left:1.4vmin;cursor:pointer}' +
      '#an-aviso .an-abrir{background:#e6b955;color:#0a1022}#an-aviso .an-fechar{background:transparent;color:#c9d2ea;border:1px solid rgba(255,255,255,.3)}'));
    document.head.appendChild(st);
    caixa = document.createElement('div'); caixa.id = 'an-aviso'; caixa.style.display = 'none';
    document.body.appendChild(caixa);
    caixa.addEventListener('click', function (e) {
      var t = e.target;
      if (t.className === 'an-abrir') location.href = 'anotacoes.html';
      else if (t.className === 'an-fechar') caixa.style.display = 'none';
    });
  }
  function mostrar(m) {
    if (!caixa) montar();
    var a = m.arquivo;
    caixa.innerHTML = '<b>📩 Nova ' + (a ? 'mensagem com arquivo' : 'mensagem') + ' da Mesa</b>' +
      '<p>' + esc(m.texto || '') + (a ? (m.texto ? '\n' : '') + '📎 ' + esc(a.nome) : '') + '</p>' +
      '<div class="an-l"><button type="button" class="an-fechar">Fechar</button><button type="button" class="an-abrir">Abrir Anotações</button></div>';
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
    // o que já existia ao abrir aparece dentro de Anotações; aqui só o que chega depois
    var q = db.ref(RAIZ + '/anotacoes/mesa/mensagens').orderByChild('criadoEm').limitToLast(1), pronto = false;
    q.on('child_added', function (s) {
      var v = s.val() || {};
      if (!pronto || !v.criadoEm) return;
      if (Date.now() + offset - v.criadoEm > 5 * 60000) return;   // sinal antigo
      mostrar(v);
    });
    q.once('value', function () { pronto = true; });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
