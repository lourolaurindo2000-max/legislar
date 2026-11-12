/* PLD — Plenário Legislativo Digital: funcionamento SEM INTERNET
 *
 * Guarda no aparelho uma cópia das páginas do sistema e das bibliotecas (Firebase, fontes, ícones).
 * Se a internet cair e alguém recarregar a página (ou abrir de novo), ela abre a partir dessa cópia.
 *
 * - Páginas e arquivos do próprio site: tenta a internet primeiro (sempre a versão mais nova);
 *   se não responder em 4 s ou estiver sem internet, usa a cópia guardada.
 * - Bibliotecas externas (Firebase, Font Awesome, fontes, fotos): usa a cópia guardada e atualiza por trás.
 * - O banco de dados (Firebase Realtime Database) NUNCA passa por aqui.
 */
var VERSAO = 'pld-offline-v41';
var PAGINAS = [
  './', 'index.html', 'dashboard.html', 'votacao.html', 'controle_de_fala.html', 'presenca_plenaria.html',
  'sistema_sorteio.html', 'visualizar.js', 'js/tv-compat.js', 'js/tw-controle.css', 'js/tw-sorteio.css',
  'img/brasao.png', 'img/logoCamara.PNG', 'img/plenario.png', 'js/capa-tablet.js', 'js/fala-tablet.js', 'js/presenca-tablet.js', 'js/bip-tv.js', 'js/sons.js', 'js/login-guard.js', 'manifest.json', 'anotacoes.html', 'js/anotacoes-aviso.js', 'ordem_do_dia.html', 'atas.html', 'arquivos_diversos.html', 'js/docs.js', 'js/docs-aviso.js',
  'img/icone-192.png', 'img/icone-512.png'
];
var EXTERNOS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.tailwindcss.com'
];
var LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|[0-9]\.gravatar\.com|gravatar\.com)/;

function semBusca(url) { var u = new URL(url); u.search = ''; u.hash = ''; return u.href; }

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) {
    var tarefas = PAGINAS.map(function (p) {
      var url = new URL(p, self.registration.scope).href;
      return fetch(url, { cache: 'no-cache' }).then(function (r) { if (r && r.ok) return c.put(semBusca(url), r); }).catch(function () {});
    }).concat(EXTERNOS.map(function (url) {
      return fetch(url, { mode: 'no-cors' }).then(function (r) { if (r && (r.ok || r.type === 'opaque')) return c.put(url, r); }).catch(function () {});
    }));
    return Promise.all(tarefas);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k.indexOf('pld-offline-') === 0 && k !== VERSAO) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* site: internet primeiro (até 4 s), cópia guardada se falhar */
function redePrimeiro(req) {
  var chave = semBusca(req.url);
  return caches.open(VERSAO).then(function (c) {
    return new Promise(function (resolve) {
      var feito = false;
      function daCopia(semCopia) {
        return c.match(chave).then(function (r) { return r || c.match(req, { ignoreSearch: true }); }).then(function (r) {
          if (r) { feito = true; resolve(r); } else if (semCopia) semCopia();
        });
      }
      var t = setTimeout(function () { if (!feito) daCopia(null); }, 4000);
      // no-cache: sempre confere com o servidor (o GitHub manda guardar 10 min; sem isto os tablets ficavam com versão velha)
      var busca = new URL(req.url).origin === self.location.origin ? fetch(req.url, { cache: 'no-cache' }) : fetch(req);
      busca.then(function (r) {
        if (r && r.ok && r.type === 'basic') { var cp = r.clone(); c.put(chave, cp).catch(function () {}); }
        if (!feito) { feito = true; clearTimeout(t); resolve(r); }
      }).catch(function () {
        clearTimeout(t);
        if (feito) return;
        daCopia(function () {
          feito = true;
          resolve(new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sem internet</title>' +
            '<body style="font-family:sans-serif;background:#0a1022;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
            '<div><h1>Sem internet</h1><p>Esta página ainda não foi guardada neste aparelho.<br>Ela abre assim que a conexão voltar.</p>' +
            '<button onclick="location.reload()" style="font-size:1.1rem;padding:12px 22px;border-radius:8px;border:0">Tentar de novo</button></div>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
        });
      });
    });
  });
}

/* bibliotecas externas: cópia guardada na hora, atualiza por trás */
function copiaPrimeiro(req) {
  return caches.open(VERSAO).then(function (c) {
    return c.match(req).then(function (guardado) {
      var rede = fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(function () {});
        return r;
      });
      if (guardado) { rede.catch(function () {}); return guardado; }
      return rede;
    });
  });
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = req.url;
  if (/firebaseio\.com|firebasedatabase\.app|googleapis\.com\/identitytoolkit|securetoken/.test(url)) return;   // banco de dados: nunca
  if (/\.(mov|mp4|webm|m4v)(\?|$)/i.test(url)) return;                                                      // vídeos: não guarda
  if (url.indexOf(self.registration.scope) === 0) { ev.respondWith(redePrimeiro(req).catch(function () { return fetch(req); })); return; }
  if (LIBS.test(url)) { ev.respondWith(copiaPrimeiro(req).catch(function () { return fetch(req); })); return; }
});
