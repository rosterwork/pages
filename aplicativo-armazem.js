/* ============================================================
   ARMAZÉM DO APP — service worker (o site guardado no aparelho)
   Guarda no aparelho os arquivos do sistema (páginas, estilos,
   código, ícones, fontes e os ícones do app) e os entrega dali,
   sem ir à internet. Os pedidos ao banco (Supabase, outro
   endereço) passam reto: dado nunca é guardado. Fica na raiz
   do site para cuidar dele inteiro (exceção às pastas, REGRAS §1).
   A publicação (.github/workflows/deploy-site.yml) carimba a
   VERSAO, a lista ARQUIVOS (caminho → impressão digital) e a
   lista SOB_DEMANDA; sem carimbo (no computador, nos testes) ele
   não faz nada.
   Versão nova: baixa só o que mudou (copia o resto da versão
   anterior) e espera o sinal "ativar" da página, que troca de
   versão sem misturar a velha com a nova (geral-aplicativo.js).
   SOB_DEMANDA (as bibliotecas, como a do PDF): nunca baixadas na
   instalação; guardadas no primeiro uso e levadas para a versão
   nova enquanto a impressão digital não mudar.
   Botão de emergência: REGRAS §8.1.
   ============================================================ */
(function () {
  'use strict';

  var VERSAO = '__VERSAO__';
  var ARQUIVOS = {/*__ARQUIVOS__*/};
  var SOB_DEMANDA = {/*__SOB_DEMANDA__*/};

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

  /* a cópia de um arquivo numa versão anterior com a mesma impressão digital (ou null) */
  function copiaAnterior(anteriores, caminho, impressao) {
    var url = endereco(caminho);
    return anteriores.reduce(function (achou, v) {
      return achou.then(function (guardado) {
        if (guardado || v.impressoes[caminho] !== impressao) return guardado;
        return v.cache.match(url).then(function (r) { return r || null; });
      });
    }, Promise.resolve(null));
  }

  /* guarda esta versão: o arquivo igual vem da versão anterior; o que mudou, da internet (sem o
     cache do navegador e, pelo ?v=, sem cópia velha no caminho), guardado no endereço sem o ?v=.
     O sob demanda só vem da versão anterior (se já foi usado e não mudou); nunca da internet aqui.
     Uma falha desfaz a instalação e a versão velha continua */
  function guardarVersao() {
    return Promise.all([caches.open(NOME), versoesAnteriores()]).then(function (r) {
      var novo = r[0];
      var anteriores = r[1];
      var doSite = Object.keys(ARQUIVOS).map(function (caminho) {
        var url = endereco(caminho);
        return copiaAnterior(anteriores, caminho, ARQUIVOS[caminho]).then(function (guardado) {
          if (guardado) return novo.put(url, guardado);
          return fetch(url + '?v=' + ARQUIVOS[caminho], { cache: 'reload' }).then(function (resposta) {
            if (!resposta.ok) throw new Error('não baixou ' + caminho);
            return novo.put(url, resposta);
          });
        });
      });
      var usados = Object.keys(SOB_DEMANDA).map(function (caminho) {
        return copiaAnterior(anteriores, caminho, SOB_DEMANDA[caminho]).then(function (guardado) {
          if (guardado) return novo.put(endereco(caminho), guardado);
        });
      });
      return Promise.all(doSite.concat(usados)).then(function () {
        return novo.put(endereco(IMPRESSOES), new Response(JSON.stringify(Object.assign({}, ARQUIVOS, SOB_DEMANDA))));
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

  /* arquivo do site: do aparelho; o sob demanda ainda não usado, da internet pela impressão digital
     e guardado; fora das listas (as imagens do manual), da internet e guardado ao usar */
  function responder(pedido) {
    var url = new URL(pedido.url);
    var chave = /\/$/.test(url.pathname) ? endereco('index.html') : pedido;   /* a raiz do site é o index.html */
    var caminho = (url.origin + url.pathname).slice(self.registration.scope.length);
    return caches.open(NOME).then(function (cache) {
      return cache.match(chave, { ignoreSearch: true }).then(function (guardado) {
        if (guardado) return guardado;
        if (SOB_DEMANDA[caminho]) {
          return fetch(endereco(caminho) + '?v=' + SOB_DEMANDA[caminho], { cache: 'reload' }).then(function (resposta) {
            if (resposta.ok) cache.put(endereco(caminho), resposta.clone());
            return resposta;
          });
        }
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

  /* ---------- notificações no celular (enviadas pelo programa notificacoes-enviar) ----------
     Funcionam com ou sem carimbo: chegam mesmo com o app fechado */
  self.addEventListener('push', function (evento) {
    var aviso = {};
    try { aviso = evento.data ? evento.data.json() : {}; } catch (e) {}
    evento.waitUntil(self.registration.showNotification(aviso.titulo || 'Roster Work', {
      body: aviso.texto || '',
      icon: endereco('logos/aplicativo-192.png'),
      badge: endereco('logos/aplicativo-selo.png'),
      tag: aviso.id ? 'aviso-' + aviso.id : undefined,
      lang: 'pt-BR',
      data: {
        id: aviso.id, tipo: aviso.tipo, escopo: aviso.escopo, acao: aviso.acao,
        pagina: aviso.pagina, aba: aviso.aba, referencia_id: aviso.referencia_id
      }
    }));
  });

  /* tocar na notificação: abre o sistema com o aviso (index.html?aviso=…), que faz o mesmo que o
     clique no sino (marca como lido e abre a tela do assunto); usa a tela do app já aberta, se houver */
  self.addEventListener('notificationclick', function (evento) {
    evento.notification.close();
    var aviso = evento.notification.data || {};
    var destino = endereco('index.html') + (aviso.id ? '?aviso=' + encodeURIComponent(JSON.stringify(aviso)) : '');
    evento.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (telas) {
      var tela = telas[0];
      if (tela && tela.navigate) {
        return tela.navigate(destino).then(function (aberta) { return (aberta || tela).focus(); });
      }
      return self.clients.openWindow(destino);
    }));
  });
})();
