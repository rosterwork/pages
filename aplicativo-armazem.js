/* ============================================================
   ARMAZÉM DO APP — service worker (o site guardado no aparelho)
   Guarda no aparelho os arquivos do sistema (páginas, estilos,
   código, ícones, fontes e os ícones do app) e os entrega dali,
   sem ir à internet. Os pedidos ao banco (Supabase, outro
   endereço) passam reto: dado nunca é guardado. Fica na raiz
   do site para cuidar dele inteiro (exceção às pastas, REGRAS §1).
   A publicação (.github/workflows/deploy-site.yml) carimba a
   VERSAO e a lista ARQUIVOS (caminho → impressão digital); sem
   carimbo (no computador, nos testes) ele não faz nada.
   Versão nova: baixa só o que mudou (copia o resto da versão
   anterior) e espera o sinal "ativar" da página, que troca de
   versão sem misturar a velha com a nova (geral-aplicativo.js).
   Botão de emergência: REGRAS §8.1.
   ============================================================ */
(function () {
  'use strict';

  var VERSAO = '__VERSAO__';
  var ARQUIVOS = {/*__ARQUIVOS__*/};

  var PREFIXO = 'rosterwork-';
  var NOME = PREFIXO + VERSAO;
  var IMPRESSOES = 'armazem-impressoes';    /* a lista desta versão, guardada junto (para a próxima comparar) */
  var CARIMBADO = VERSAO.indexOf('__') !== 0;

  function endereco(caminho) {
    return new URL(caminho, self.registration.scope).href;
  }

  /* as versões já guardadas, cada uma com a sua lista de impressões digitais */
  function versoesAnteriores() {
    return caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (nome) {
        return nome.indexOf(PREFIXO) === 0 && nome !== NOME;
      }).map(function (nome) {
        return caches.open(nome).then(function (cache) {
          return cache.match(endereco(IMPRESSOES)).then(function (resposta) {
            return resposta ? resposta.json() : {};
          }).then(function (impressoes) { return { cache: cache, impressoes: impressoes }; });
        });
      }));
    });
  }

  /* guarda esta versão: o arquivo igual vem da versão anterior; o que mudou, da internet (sem o
     cache do navegador e, pelo ?v=, sem cópia velha no caminho), guardado no endereço sem o ?v=.
     Uma falha desfaz a instalação e a versão velha continua */
  function guardarVersao() {
    return Promise.all([caches.open(NOME), versoesAnteriores()]).then(function (r) {
      var novo = r[0];
      var anteriores = r[1];
      return Promise.all(Object.keys(ARQUIVOS).map(function (caminho) {
        var url = endereco(caminho);
        var igual = null;
        anteriores.forEach(function (v) { if (!igual && v.impressoes[caminho] === ARQUIVOS[caminho]) igual = v; });
        var copia = igual ? igual.cache.match(url) : Promise.resolve(null);
        return copia.then(function (guardado) {
          if (guardado) return novo.put(url, guardado);
          return fetch(url + '?v=' + ARQUIVOS[caminho], { cache: 'reload' }).then(function (resposta) {
            if (!resposta.ok) throw new Error('não baixou ' + caminho);
            return novo.put(url, resposta);
          });
        });
      })).then(function () {
        return novo.put(endereco(IMPRESSOES), new Response(JSON.stringify(ARQUIVOS)));
      });
    }).catch(function (erro) {
      return caches.delete(NOME).then(function () { throw erro; });
    });
  }

  self.addEventListener('install', function (evento) {
    if (CARIMBADO) evento.waitUntil(guardarVersao());
  });

  /* a página manda "ativar" quando é hora de trocar de versão */
  self.addEventListener('message', function (evento) {
    if (evento.data === 'ativar') self.skipWaiting();
  });

  /* versão nova no ar: apaga as anteriores */
  self.addEventListener('activate', function (evento) {
    evento.waitUntil(caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (nome) {
        return nome.indexOf(PREFIXO) === 0 && nome !== NOME;
      }).map(function (nome) { return caches.delete(nome); }));
    }).then(function () { return self.clients.claim(); }));
  });

  /* arquivo do site: do aparelho; fora da lista (as imagens do manual), da internet e guardado ao usar */
  function responder(pedido) {
    var url = new URL(pedido.url);
    var chave = /\/$/.test(url.pathname) ? endereco('index.html') : pedido;   /* a raiz do site é o index.html */
    return caches.open(NOME).then(function (cache) {
      return cache.match(chave, { ignoreSearch: true }).then(function (guardado) {
        if (guardado) return guardado;
        return fetch(pedido).then(function (resposta) {
          if (resposta.ok && url.href.indexOf(endereco('manual/imagens/')) === 0) cache.put(pedido, resposta.clone());
          return resposta;
        });
      });
    });
  }

  self.addEventListener('fetch', function (evento) {
    if (!CARIMBADO || evento.request.method !== 'GET') return;
    if (new URL(evento.request.url).origin !== self.location.origin) return;   /* o banco e o resto: sempre pela internet */
    evento.respondWith(responder(evento.request));
  });
})();
