/* PLD — Login no banco (Firebase Authentication). Carregado pelo __fb() de js/tv-compat.js, logo depois do Firebase.
 *
 * Cada aparelho é "liberado" UMA vez com a senha da sua conta e fica liberado para sempre:
 *   notebook da Mesa  -> mesa@camara-almadina.app        (senha do operador)
 *   tablets/celulares -> vereadores@camara-almadina.app  (senha da conta dos vereadores)
 *   Smart TV          -> tv@camara-almadina.app          (senha da TV)
 * Para quem usa, nada muda depois disso: as senhas de cada tela continuam as mesmas.
 *
 * Enquanto o login do aparelho não termina de carregar, as leituras/gravações das páginas esperam
 * (assim, com o banco fechado, nada é pedido sem login). Páginas dentro do quadro da TV não mostram a tela de liberação.
 * ES5 — a Smart TV antiga também carrega este arquivo.
 */
(function () {
  var W = window, D = document;
  if (!W.firebase || W.__pldAuth) return;
  W.__pldAuth = true;

  var DOMINIO = '@camara-almadina.app';
  var CONTAS = {
    mesa: { email: 'mesa' + DOMINIO, nome: 'Mesa (notebook do operador)', dica: 'a senha do operador' },
    vereadores: { email: 'vereadores' + DOMINIO, nome: 'Vereadores (tablets e celulares)', dica: 'a senha da conta dos vereadores' },
    tv: { email: 'tv' + DOMINIO, nome: 'Smart TV', dica: 'a senha da TV' }
  };
  var PERMITIR_DEPOIS = false;  // banco fechado (18/11/2026): todo aparelho precisa estar liberado

  function emQuadro() { try { return W.top !== W.self; } catch (e) { return true; } }
  function ehTV() {
    if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|SonyDTV|\bAFT[A-Z]|GoogleTV|Google TV|Android ?TV|CrKey|Roku|VIDAA|NETTV|Viera|AQUOS|Opera TV|LG Browser|Large Screen|PhilipsTV|Hisense.*TV|TV Safari/i.test(navigator.userAgent || '')) return true;
    try { if (localStorage.getItem('pld_tv') === '1' && !(navigator.maxTouchPoints > 0)) return true; } catch (e) {}
    return false;
  }
  function ehNotebook() {
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return false;
    try { return W.matchMedia('(any-pointer: fine)').matches; } catch (e) { return false; }
  }
  function contaPadrao() { return ehTV() ? 'tv' : (ehNotebook() ? 'mesa' : 'vereadores'); }

  // ---------- fila: leituras e gravações esperam o login do aparelho carregar ----------
  var pronto = false, fila = [];
  function liberarFila() {
    if (pronto) return;
    pronto = true;
    var f = fila; fila = [];
    for (var i = 0; i < f.length; i++) { try { f[i](); } catch (e) { if (W.console) console.error(e); } }
  }
  function adiarPromessa(orig) {
    return function () {
      if (pronto) return orig.apply(this, arguments);
      var self = this, args = arguments;
      return new Promise(function (res, rej) { fila.push(function () { var p = orig.apply(self, args); if (p && p.then) p.then(res, rej); else res(p); }); });
    };
  }
  function embrulhar(db) {
    var R = Object.getPrototypeOf(db.ref()), Q = Object.getPrototypeOf(R);
    if (!Q || !Q.on || Q.__pld) return;
    Q.__pld = true;
    var on0 = Q.on, off0 = Q.off, pend = [];
    Q.on = function (ev, cb) {
      if (pronto) return on0.apply(this, arguments);
      var self = this, args = arguments, item = { q: self, ev: ev, cb: cb, fora: false };
      pend.push(item);
      fila.push(function () { if (!item.fora) on0.apply(self, args); });
      return cb;
    };
    Q.off = function (ev, cb) {
      for (var i = 0; i < pend.length; i++) {
        var it = pend[i];
        if (it.q === this || (it.q.isEqual && it.q.isEqual(this))) { if ((!ev || ev === it.ev) && (!cb || cb === it.cb)) it.fora = true; }
      }
      return off0.apply(this, arguments);
    };
    Q.once = adiarPromessa(Q.once);
    ['set', 'update', 'remove', 'transaction', 'setPriority', 'setWithPriority'].forEach(function (m) { if (R[m]) R[m] = adiarPromessa(R[m]); });
    try {
      var O = Object.getPrototypeOf(db.ref('pld_tmp').onDisconnect());
      ['set', 'update', 'remove', 'cancel', 'setWithPriority'].forEach(function (m) { if (O && O[m]) O[m] = adiarPromessa(O[m]); });
    } catch (e) {}
  }

  // ---------- tela "Liberar este aparelho" ----------
  var tela = null;
  function esconderTela() { if (tela && tela.parentNode) tela.parentNode.removeChild(tela); tela = null; }
  function mostrarTela(auth) {
    if (tela || emQuadro()) return;
    if (PERMITIR_DEPOIS) { try { if (sessionStorage.getItem('pld_auth_depois') === '1') return; } catch (e) {} }
    if (!D.body) { D.addEventListener('DOMContentLoaded', function () { mostrarTela(auth); }); return; }
    var conta = contaPadrao();
    tela = D.createElement('div');
    tela.id = 'pldAuthTela';
    tela.setAttribute('style', 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(6,12,28,.92);display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;padding:16px;font-family:Segoe UI,Tahoma,sans-serif');
    var ops = '';
    for (var k in CONTAS) ops += '<option value="' + k + '"' + (k === conta ? ' selected' : '') + '>' + CONTAS[k].nome + '</option>';
    tela.innerHTML =
      '<form id="pldAuthForm" autocomplete="off" style="width:100%;max-width:420px;background:#111a35;border:1px solid #e6b955;border-radius:18px;padding:24px 22px;color:#eef2fb;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
      '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e6b955" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>' +
      '<div style="font-size:22px;font-weight:700;margin:8px 0 4px">Liberar este aparelho</div>' +
      '<div id="pldAuthDica" style="color:#9aa6c6;font-size:15px;margin-bottom:14px">Só na primeira vez. Digite ' + CONTAS[conta].dica + '.</div>' +
      '<select id="pldAuthConta" style="width:100%;margin-bottom:10px;background:#0a1022;color:#eef2fb;border:1px solid #2a3766;border-radius:10px;padding:10px;font-size:15px">' + ops + '</select>' +
      '<input id="pldAuthSenha" type="password" placeholder="Senha" style="width:100%;box-sizing:border-box;background:#0a1022;color:#eef2fb;border:1px solid #2a3766;border-radius:10px;padding:13px;font-size:19px;text-align:center">' +
      '<div id="pldAuthErro" style="color:#f87171;min-height:22px;margin-top:8px;font-weight:600;font-size:14px"></div>' +
      '<button type="submit" id="pldAuthOk" style="width:100%;margin-top:6px;background:#e6b955;color:#0a1022;border:0;border-radius:10px;padding:13px;font-size:17px;font-weight:700;cursor:pointer">Liberar</button>' +
      (PERMITIR_DEPOIS ? '<button type="button" id="pldAuthDepois" style="margin-top:12px;background:none;border:0;color:#9aa6c6;text-decoration:underline;font-size:14px;cursor:pointer">Agora não</button>' : '') +
      '</form>';
    D.body.appendChild(tela);
    var sel = D.getElementById('pldAuthConta'), pw = D.getElementById('pldAuthSenha'), err = D.getElementById('pldAuthErro'), ok = D.getElementById('pldAuthOk');
    sel.onchange = function () { D.getElementById('pldAuthDica').textContent = 'Só na primeira vez. Digite ' + CONTAS[sel.value].dica + '.'; pw.focus(); };
    try { pw.focus(); } catch (e) {}
    if (PERMITIR_DEPOIS) D.getElementById('pldAuthDepois').onclick = function () { try { sessionStorage.setItem('pld_auth_depois', '1'); } catch (e) {} esconderTela(); };
    D.getElementById('pldAuthForm').onsubmit = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!pw.value) { err.textContent = 'Digite a senha.'; return false; }
      ok.disabled = true; err.textContent = ''; ok.textContent = 'Liberando…';
      auth.signInWithEmailAndPassword(CONTAS[sel.value].email, pw.value).then(function () {
        ok.textContent = 'Liberado!';
        setTimeout(function () { location.reload(); }, 400);
      }, function (x) {
        ok.disabled = false; ok.textContent = 'Liberar';
        var c = (x && x.code) || '';
        err.textContent = /wrong-password|invalid-credential|invalid-login|user-not-found|invalid-email/.test(c) ? 'Senha incorreta.' :
          /too-many-requests/.test(c) ? 'Muitas tentativas. Espere alguns minutos.' :
          /network/.test(c) ? 'Sem internet. Tente de novo.' : 'Não foi possível liberar (' + c + ').';
        pw.select && pw.select();
      });
      return false;
    };
  }

  // ---------- liga tudo quando a página inicia o Firebase ----------
  function preparar() {
    var db, auth;
    try { db = firebase.database(); embrulhar(db); } catch (e) { liberarFila(); return; }
    try { auth = firebase.auth(); } catch (e) { liberarFila(); return; }
    var t = setTimeout(liberarFila, 6000);   // se o login não responder, segue (sem travar a sessão)
    var primeira = true;
    auth.onAuthStateChanged(function (u) {
      if (primeira) { primeira = false; clearTimeout(t); liberarFila(); }
      if (u) esconderTela(); else mostrarTela(auth);
    });
    W.PldAuth = {
      usuario: function () { return auth.currentUser; },
      conta: function () { var u = auth.currentUser; return u && u.email ? u.email.split('@')[0] : null; },
      sair: function () { return auth.signOut(); }
    };
  }
  var init0 = firebase.initializeApp;
  firebase.initializeApp = function () {
    var app = init0.apply(this, arguments);
    if (!W.__pldAuthPronto) { W.__pldAuthPronto = true; try { preparar(); } catch (e) { liberarFila(); } }
    return app;
  };
  if (firebase.apps && firebase.apps.length && !W.__pldAuthPronto) { W.__pldAuthPronto = true; preparar(); }
})();
