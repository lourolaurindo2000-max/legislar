/* Aviso da Assinatura Digital de Atas (ES5) — carregado no painel (dashboard.html).
   Tablets/celulares: quando a Mesa envia uma ata para assinatura (legislar/assinaturaAtas/enviada),
     aparece "✍ Ata para você assinar" com o botão "Assinar agora". Se o tablet já tem dono
     (mesmo vínculo da Votação), o aviso some quando esse vereador assinar.
   Notebook da Mesa: quando TODOS assinarem a ata enviada, aparece "Ata assinada por todos" com
     "Abrir para imprimir" (a página de assinatura lacra a ata e deixa o PDF pronto).
   Não aparece na Smart TV nem dentro de quadros. Só lê; nunca grava. */
(function () {
  var W = window, D = document;
  try { if (W.self !== W.top) return; } catch (e) { return; }
  var UA = navigator.userAgent || '';
  if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(UA)) return;
  // notebook = mouse/touchpad e não é Android/iPad/celular (mesma regra de js/fb-auth.js); notebook com tela de toque continua notebook
  var ehNotebook = false, ehTablet = false;
  try { ehNotebook = !/Android|iPhone|iPad|iPod|Mobile/i.test(UA) && matchMedia('(any-pointer: fine)').matches; } catch (e) {}
  try { ehTablet = !ehNotebook && navigator.maxTouchPoints > 0; } catch (e) {}

  var RAIZ = (W.__DOC_RAIZ || 'legislar') + '/assinaturaAtas';
  // ids iguais aos da Votação/Anotações
  var NOME = { v1: 'Jackson Costa', v2: 'Dilson Junior', v3: 'Lucas Cavalcante', v4: 'Marilene Santos', v5: 'Nilza Damasceno',
    v6: 'Rogério Gotado', v7: 'Sylas Souza', v8: 'José Lindomar', v9: 'Wilson Freitas' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function chave(n) {
    var s = String(n || '');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function totalVagas(a) {
    var m = a.mesa || {}, mesa = [m.presidente, m.vice, m.sec1, m.sec2], n = 4, vs = a.vereadores || [];
    for (var i = 0; i < vs.length; i++) if (mesa.indexOf(vs[i]) < 0) n++;
    return n;
  }
  function contar(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var caixa = null, destino = '', chaveFechado = '';
  function montar() {
    var st = D.createElement('style');
    st.appendChild(D.createTextNode(
      '#as-aviso{position:fixed;left:50%;bottom:3vmin;transform:translateX(-50%);z-index:2147483002;width:min(92vw,620px);background:#0a1022;color:#eef2fb;' +
      'border:2px solid #e6b955;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.6);padding:16px 20px;font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif}' +
      '#as-aviso b{display:block;color:#e6b955;font-size:clamp(17px,3.2vmin,24px);margin-bottom:6px}' +
      '#as-aviso p{margin:0 0 14px;font-size:clamp(14px,2.5vmin,19px);overflow-wrap:anywhere}' +
      '#as-aviso .as-l{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}' +
      '#as-aviso button{border:0;border-radius:12px;padding:12px 18px;font-weight:800;font-size:clamp(14px,2.4vmin,18px);cursor:pointer;min-height:46px}' +
      '#as-aviso .as-abrir{background:#e6b955;color:#0a1022}#as-aviso .as-fechar{background:transparent;color:#c9d2ea;border:1px solid rgba(255,255,255,.3)}'));
    D.head.appendChild(st);
    caixa = D.createElement('div'); caixa.id = 'as-aviso'; caixa.style.display = 'none';
    D.body.appendChild(caixa);
    caixa.addEventListener('click', function (e) {
      var t = e.target;
      if (t.className === 'as-abrir') location.href = destino;
      else if (t.className === 'as-fechar') { caixa.style.display = 'none'; if (chaveFechado) ss(chaveFechado, '1'); }
    });
  }
  function mostrar(titulo, texto, botao, url, kFechado) {
    if (kFechado && ss(kFechado)) return esconder();
    if (!caixa) montar();
    destino = url; chaveFechado = kFechado || '';
    caixa.innerHTML = '<b>' + esc(titulo) + '</b><p>' + texto + '</p>' +
      '<div class="as-l"><button type="button" class="as-fechar">Depois</button><button type="button" class="as-abrir">' + esc(botao) + '</button></div>';
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
    var meuVid = null, dev = null, env = null, ata = null, refAta = null;
    try { dev = localStorage.getItem('vp_dev'); } catch (e) {}

    function avaliar() {
      if (!env || !ata || ata.status !== 'aberta') return esconder();
      var sigs = ata.assinaturas || {}, aus = ata.ausentes || {}, n = 0, t = 0;
      // presentes = vagas não marcadas como ausentes pelo operador
      var m = ata.mesa || {}, nomes = [m.presidente, m.vice, m.sec1, m.sec2], vs = ata.vereadores || [];
      for (var i = 0; i < vs.length; i++) if (nomes.indexOf(vs[i]) < 0) nomes.push(vs[i]);
      for (var j = 0; j < nomes.length; j++) { var k = chave(nomes[j]); if (aus[k]) continue; t++; if (sigs[k]) n++; }
      var tit = esc(ata.titulo || 'Ata') + (ata.numero ? ' (Nº ' + esc(ata.numero) + ')' : '');
      if (ehMesa()) {
        if (t && n >= t) mostrar('✅ Ata assinada por todos os vereadores presentes', tit + ' — pronta para lacrar e imprimir.',
          'Abrir para imprimir', 'assinatura.html?v=' + Date.now() + '#ata-' + env.id, 'as_mesa_' + env.id);
        else esconder();
        return;
      }
      if (!ehTablet) return esconder();
      var meuNome = meuVid && NOME[meuVid];
      if (meuNome && (sigs[chave(meuNome)] || aus[chave(meuNome)])) return esconder();   // já assinou ou está ausente
      mostrar('✍ Ata para você assinar', tit + '<br><small>A Mesa enviou a ata para assinatura' +
        (meuNome ? ', ' + esc(meuNome) : '') + '. Leia o documento e assine pelo tablet.</small>',
        'Assinar agora', 'assinatura.html?v=' + Date.now(), 'as_tab_' + env.id + '_' + (env.em || ''));
    }

    db.ref((W.__DOC_RAIZ || 'legislar') + '/votacao/aparelhos').on('value', function (s) {
      var a = s.val() || {}; meuVid = null;
      for (var k in a) if (a.hasOwnProperty(k) && a[k] && dev && a[k].dev === dev) meuVid = k;
      avaliar();
    });
    db.ref(RAIZ + '/enviada').on('value', function (s) {
      var v = s.val();
      env = v && v.id ? v : null;
      if (refAta) { refAta.off(); refAta = null; ata = null; }
      if (!env) return esconder();
      refAta = db.ref(RAIZ + '/atas/' + env.id);
      refAta.on('value', function (s2) { ata = s2.val(); avaliar(); });
    });
  }
  if (D.body) iniciar(); else D.addEventListener('DOMContentLoaded', iniciar);
})();
