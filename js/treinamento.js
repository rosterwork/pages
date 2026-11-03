/* ============================================================
   TREINAMENTO — a lista dos treinos (RosterWork.paginas.treinamento)
   Os treinos são os roteiros do passo a passo (os <template
   data-roteiro> do index.html, lidos pelo geral-guia-roteiros.js),
   em duas áreas, a de todos e a do administrador (só para quem
   administra), e, em cada área, pelo grupo (data-grupo). Cada linha
   mostra onde o treino acontece (data-onde) ou quantos caminhos ele
   tem, e o Visto de quem já fez. Os roteiros com o mesmo
   data-conjunto ficam numa linha só (o <template
   data-roteiro-conjunto> dá o nome, o rótulo e o ícone), que abre e
   fecha ali mesmo com as opções dentro; o Visto dela só vem com todas
   as opções concluídas. A busca filtra pelo nome do treino e da
   opção (a linha do conjunto abre só com as opções que casam).
   Clicar começa o treino do começo, desde o menu, no modo treino
   (RosterWork.treino.comecar). No celular, os que só existem no
   computador (data-so-computador) não aparecem.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function chave(texto) { return RW.busca.normalizar(texto || ''); }

  /* a seção do grupo na área (criada na primeira vez) */
  function secaoDe(pagina, t) {
    var area = pagina.querySelector('.treino-area[data-treino-area="' + (t.getAttribute('data-area') === 'admin' ? 'admin' : 'todos') + '"]');
    var grupo = t.getAttribute('data-grupo') || '';
    var secao = Array.prototype.filter.call(area.querySelectorAll('.pedido-secao'), function (s) { return s.getAttribute('data-grupo') === grupo; })[0];
    if (!secao) {
      secao = RW.tpl('tpl-treino-secao');
      secao.setAttribute('data-grupo', grupo);
      secao.querySelector('.rotulo-secao').textContent = grupo;
      area.appendChild(secao);
    }
    return secao.querySelector('.pedido-lista');
  }

  function icone(el, nome) { el.querySelector('.pedido-linha-icone use').setAttribute('href', 'icones/todos.svg#' + (nome || 'icone-ajuda')); }

  /* a linha do conjunto: abre e fecha ali mesmo */
  function novoConjunto(pagina, c) {
    var el = RW.tpl('tpl-treino-conjunto');
    icone(el, c.getAttribute('data-icone'));
    el.querySelector('.treino-conjunto-titulo').textContent = c.getAttribute('data-titulo');
    el.querySelector('.treino-conjunto-rotulo').textContent = c.getAttribute('data-rotulo');
    var cabeca = el.querySelector('.pedido-expansivel-cabeca');
    cabeca.addEventListener('click', function () { abrir(conjunto, cabeca.getAttribute('aria-expanded') !== 'true'); });
    secaoDe(pagina, c).appendChild(el);
    var conjunto = { el: el, chave: chave(c.getAttribute('data-titulo')), opcoes: [] };
    return conjunto;
  }
  function abrir(conjunto, sim) {
    conjunto.el.querySelector('.pedido-expansivel-cabeca').setAttribute('aria-expanded', sim ? 'true' : 'false');
    conjunto.el.querySelector('.pedido-resumo').classList.toggle('oculto', !sim);
  }

  /* as linhas, uma por roteiro (ou uma por conjunto, com as opções dentro) */
  function montar(pagina) {
    var R = RW.guiaRoteiros;
    var itens = [], conjuntos = {};
    R.lista().forEach(function (t) {
      var id = t.getAttribute('data-roteiro');
      var titulo = t.getAttribute('data-titulo');
      var idConjunto = t.getAttribute('data-conjunto');
      var molde = idConjunto ? document.querySelector('template[data-roteiro-conjunto="' + idConjunto + '"]') : null;
      if (molde) {
        var conjunto = conjuntos[idConjunto] = conjuntos[idConjunto] || novoConjunto(pagina, molde);
        var opcao = RW.tpl('tpl-treino-opcao');
        opcao.querySelector('.treino-opcao-titulo').textContent = titulo;
        opcao.querySelector('.treino-opcao-visto').classList.toggle('oculto', !RW.guia.visto(id));
        opcao.addEventListener('click', function () { RW.treino.comecar(id); });
        conjunto.el.querySelector('.treino-conjunto-lista').appendChild(opcao);
        conjunto.opcoes.push({ el: opcao, chave: chave(titulo), visto: RW.guia.visto(id) });
        return;
      }
      var item = RW.tpl('tpl-treino-item');
      icone(item, t.getAttribute('data-icone'));
      item.querySelector('.treino-item-titulo').textContent = titulo;
      var caminhos = R.contarCaminhos(id);
      item.querySelector('.treino-item-meta').textContent = caminhos > 1 ? RW.mensagens.treino.caminhos(caminhos) : (t.getAttribute('data-onde') || '');
      item.querySelector('.treino-item-visto').classList.toggle('oculto', !RW.guia.visto(id));
      item.addEventListener('click', function () { RW.treino.comecar(id); });
      secaoDe(pagina, t).appendChild(item);
      itens.push({ el: item, chave: chave(titulo) });
    });
    var lista = Object.keys(conjuntos).map(function (k) { return conjuntos[k]; });
    lista.forEach(function (c) {
      c.el.querySelector('.treino-conjunto-meta').textContent = RW.mensagens.treino.opcoes(c.opcoes.length);
      c.el.querySelector('.treino-conjunto-visto').classList.toggle('oculto', !c.opcoes.every(function (o) { return o.visto; }));
    });
    return { itens: itens, conjuntos: lista };
  }

  /* mostra só os treinos que casam com a busca: a linha do conjunto que casa pelo nome mostra todas as opções; pelas
     opções, abre só com as que casam. Seção, área e traço sem nenhum somem, e a lista vazia diz */
  function filtrar(pagina, estado, termo) {
    var alvo = chave(termo);
    estado.itens.forEach(function (i) { i.el.classList.toggle('oculto', !!alvo && i.chave.indexOf(alvo) < 0); });
    estado.conjuntos.forEach(function (c) {
      var peloNome = !alvo || c.chave.indexOf(alvo) >= 0;
      var casam = c.opcoes.filter(function (o) { return peloNome || o.chave.indexOf(alvo) >= 0; });
      c.opcoes.forEach(function (o) { o.el.classList.toggle('oculto', casam.indexOf(o) < 0); });
      c.el.classList.toggle('oculto', !casam.length);
      if (alvo && !peloNome && casam.length) abrir(c, true);
    });
    function temVisivel(el, seletor) {
      return Array.prototype.some.call(el.querySelectorAll(seletor), function (x) { return !x.classList.contains('oculto'); });
    }
    Array.prototype.forEach.call(pagina.querySelectorAll('.treino-area .pedido-secao'), function (s) {
      s.classList.toggle('oculto', !temVisivel(s, '.treino-item, .treino-conjunto'));
    });
    Array.prototype.forEach.call(pagina.querySelectorAll('.treino-area'), function (a) { a.classList.toggle('oculto', !temVisivel(a, '.pedido-secao')); });
    var todos = pagina.querySelector('.treino-area[data-treino-area="todos"]');
    var admin = pagina.querySelector('.treino-area[data-treino-area="admin"]');
    pagina.querySelector('.treino-divisor').classList.toggle('oculto', todos.classList.contains('oculto') || admin.classList.contains('oculto'));
    pagina.querySelector('.treino-vazio').classList.toggle('oculto', temVisivel(pagina, '.treino-item, .treino-conjunto'));
  }

  RW.paginas.treinamento = {
    iniciar: function (conteudo) {
      var pagina = conteudo.querySelector('.pagina');
      if (!pagina) return;
      var estado = montar(pagina);
      filtrar(pagina, estado, '');
      RW.busca.criar({ caixa: pagina.querySelector('#treino-busca'), aoBuscar: function (termo) { filtrar(pagina, estado, termo); } });
    }
  };
})();
