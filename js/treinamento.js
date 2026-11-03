/* ============================================================
   TREINAMENTO — a lista dos treinos (RosterWork.paginas.treinamento)
   Os treinos são os roteiros do passo a passo (os <template
   data-roteiro> do index.html, lidos pelo geral-guia-roteiros.js),
   em duas áreas, a de todos e a do administrador (só para quem
   administra), e, em cada área, um bloco por tela (data-grupo: o
   nome da tela no alto), no desenho dos blocos dos Ajustes
   (componente geral-bloco). Cada treino é um campo com o Visto de
   quem já fez; sem chevron, clicar começa o treino. Os roteiros com
   o mesmo data-conjunto ficam num campo só (o nome vem do <template
   data-roteiro-conjunto>), com chevron, que abre e fecha ali mesmo
   com as opções dentro; o Visto dele só vem com todas as opções
   concluídas. A busca filtra pelo nome do treino e da opção (o campo
   do conjunto abre só com as opções que casam). O treino começa do
   começo, desde o menu, no modo treino (RosterWork.treino.comecar).
   No celular, os que só existem no computador (data-so-computador)
   não aparecem.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function chave(texto) { return RW.busca.normalizar(texto || ''); }

  /* o bloco da tela na área (criado na primeira vez); devolve onde vão os campos */
  function blocoDe(pagina, t) {
    var area = pagina.querySelector('.treino-area[data-treino-area="' + (t.getAttribute('data-area') === 'admin' ? 'admin' : 'todos') + '"]');
    var grupo = t.getAttribute('data-grupo') || '';
    var bloco = Array.prototype.filter.call(area.querySelectorAll('.treino-bloco'), function (s) { return s.getAttribute('data-grupo') === grupo; })[0];
    if (!bloco) {
      bloco = RW.tpl('tpl-treino-bloco');
      bloco.setAttribute('data-grupo', grupo);
      bloco.querySelector('.bloco-nome').textContent = grupo;
      area.appendChild(bloco);
    }
    return bloco.querySelector('.bloco-corpo');
  }

  /* o campo do conjunto: o chevron abre e fecha as opções ali mesmo */
  function novoConjunto(pagina, c) {
    var el = RW.tpl('tpl-treino-conjunto');
    el.querySelector('.treino-conjunto-titulo').textContent = c.getAttribute('data-titulo');
    var conjunto = { el: el, chave: chave(c.getAttribute('data-titulo')), opcoes: [] };
    var cabeca = el.querySelector('.bloco-campo-cabecalho');
    cabeca.addEventListener('click', function () { abrir(conjunto, cabeca.getAttribute('aria-expanded') !== 'true'); });
    blocoDe(pagina, c).appendChild(el);
    return conjunto;
  }
  function abrir(conjunto, sim) {
    conjunto.el.querySelector('.bloco-campo-cabecalho').setAttribute('aria-expanded', sim ? 'true' : 'false');
    conjunto.el.querySelector('.treino-conjunto-lista').classList.toggle('oculto', !sim);
  }

  /* os campos, um por roteiro (ou um por conjunto, com as opções dentro) */
  function montar(pagina) {
    var itens = [], conjuntos = {};
    RW.guiaRoteiros.lista().forEach(function (t) {
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
      item.querySelector('.treino-item-titulo').textContent = titulo;
      item.querySelector('.treino-item-visto').classList.toggle('oculto', !RW.guia.visto(id));
      /* o campo inteiro começa o treino (o botão dentro dele leva o teclado) */
      item.addEventListener('click', function () { RW.treino.comecar(id); });
      blocoDe(pagina, t).appendChild(item);
      itens.push({ el: item, chave: chave(titulo) });
    });
    var lista = Object.keys(conjuntos).map(function (k) { return conjuntos[k]; });
    lista.forEach(function (c) {
      c.el.querySelector('.treino-conjunto-visto').classList.toggle('oculto', !c.opcoes.every(function (o) { return o.visto; }));
    });
    return { itens: itens, conjuntos: lista };
  }

  /* mostra só os treinos que casam com a busca: o campo do conjunto que casa pelo nome mostra todas as opções; pelas
     opções, abre só com as que casam. Bloco, área e traço sem nenhum somem, e a lista vazia diz */
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
    Array.prototype.forEach.call(pagina.querySelectorAll('.treino-bloco'), function (s) {
      s.classList.toggle('oculto', !temVisivel(s, '.treino-item, .treino-conjunto'));
    });
    Array.prototype.forEach.call(pagina.querySelectorAll('.treino-area'), function (a) { a.classList.toggle('oculto', !temVisivel(a, '.treino-bloco')); });
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
