/* ============================================================
   TREINAMENTO — a lista dos treinos (RosterWork.paginas.treinamento)
   Os treinos são os roteiros do passo a passo (os <template
   data-roteiro> do index.html), em grupos pelo
   RosterWork.guiaRoteiros.grupos (o mesmo agrupamento do ?): a área
   de todos e a do administrador (só para quem administra) e, em
   cada área, um bloco por tela (o nome da tela no alto), no desenho
   dos blocos dos Ajustes (componente geral-bloco). O nome do bloco
   tem o chevron, que abre e fecha o bloco; um aberto por vez (abrir
   um fecha o outro), e começa aberto o primeiro, como no ?. Cada
   treino é um campo com o Visto de quem já fez; sem
   chevron, clicar começa o treino. Os roteiros do mesmo conjunto
   ficam num campo só, com chevron, que abre e fecha ali mesmo com as
   opções dentro; o Visto dele só vem com todas as opções concluídas.
   A busca filtra pelo nome do treino e da opção, e abre todos os
   blocos e os campos do conjunto que têm o que foi procurado. O
   treino começa do
   começo, desde o menu, no modo treino (RosterWork.treino.comecar).
   No celular, os que só existem no computador (data-so-computador)
   não aparecem.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function chave(texto) { return RW.busca.normalizar(texto || ''); }

  /* o chevron: abre ou fecha a parte de baixo (o corpo do bloco ou as opções do conjunto) */
  function abrir(cabeca, corpo, sim) {
    cabeca.setAttribute('aria-expanded', sim ? 'true' : 'false');
    corpo.classList.toggle('oculto', !sim);
  }
  /* aoAbrir: o que mais acontece quando abre (no bloco, os outros fecham) */
  function ligarChevron(cabeca, corpo, aoAbrir) {
    cabeca.addEventListener('click', function () {
      var sim = cabeca.getAttribute('aria-expanded') !== 'true';
      if (sim && aoAbrir) aoAbrir();
      abrir(cabeca, corpo, sim);
    });
  }

  /* o bloco da tela, na área dele: abrir um fecha os outros */
  function novoBloco(pagina, g, blocos) {
    var el = RW.tpl('tpl-treino-bloco');
    el.querySelector('.bloco-nome').textContent = g.grupo;
    pagina.querySelector('.treino-area[data-treino-area="' + g.area + '"]').appendChild(el);
    var bloco = { el: el, cabeca: el.querySelector('.bloco-cabecalho'), corpo: el.querySelector('.bloco-corpo') };
    ligarChevron(bloco.cabeca, bloco.corpo, function () {
      blocos.forEach(function (b) { if (b !== bloco) abrir(b.cabeca, b.corpo, false); });
    });
    blocos.push(bloco);
    return bloco;
  }

  /* o campo sem chevron: o campo inteiro começa o treino (o botão dentro dele leva o teclado) */
  function novoItem(lugar, it) {
    var el = RW.tpl('tpl-treino-item');
    el.querySelector('.treino-item-titulo').textContent = it.titulo;
    el.querySelector('.treino-item-visto').classList.toggle('oculto', !RW.guia.visto(it.id));
    el.addEventListener('click', function () { RW.treino.comecar(it.id); });
    lugar.appendChild(el);
    return { el: el, chave: chave(it.titulo) };
  }

  /* o campo do conjunto: o chevron abre e fecha as opções ali mesmo */
  function novoConjunto(lugar, c) {
    var el = RW.tpl('tpl-treino-conjunto');
    el.querySelector('.treino-conjunto-titulo').textContent = c.titulo;
    var conjunto = { el: el, chave: chave(c.titulo), cabeca: el.querySelector('.bloco-campo-cabecalho'),
      corpo: el.querySelector('.treino-conjunto-lista'), opcoes: [] };
    ligarChevron(conjunto.cabeca, conjunto.corpo);
    c.opcoes.forEach(function (o) {
      var op = RW.tpl('tpl-treino-opcao');
      op.querySelector('.treino-opcao-titulo').textContent = o.titulo;
      op.querySelector('.treino-opcao-visto').classList.toggle('oculto', !RW.guia.visto(o.id));
      op.addEventListener('click', function () { RW.treino.comecar(o.id); });
      conjunto.corpo.appendChild(op);
      conjunto.opcoes.push({ el: op, chave: chave(o.titulo), visto: RW.guia.visto(o.id) });
    });
    el.querySelector('.treino-conjunto-visto').classList.toggle('oculto', !conjunto.opcoes.every(function (o) { return o.visto; }));
    lugar.appendChild(el);
    return conjunto;
  }

  /* os blocos, com os campos dentro (um por roteiro, ou um por conjunto, com as opções); o primeiro bloco abre */
  function montar(pagina) {
    var estado = { blocos: [], itens: [], conjuntos: [] };
    RW.guiaRoteiros.grupos(RW.guiaRoteiros.lista()).forEach(function (g) {
      var bloco = novoBloco(pagina, g, estado.blocos);
      g.itens.forEach(function (it) {
        if (it.opcoes) estado.conjuntos.push(novoConjunto(bloco.corpo, it));
        else estado.itens.push(novoItem(bloco.corpo, it));
      });
    });
    if (estado.blocos.length) abrir(estado.blocos[0].cabeca, estado.blocos[0].corpo, true);
    return estado;
  }

  /* mostra só os treinos que casam com a busca: o campo do conjunto que casa pelo nome mostra todas as opções; pelas
     opções, abre só com as que casam. Todo bloco com resultado abre (na busca, mais de um pode ficar aberto); bloco,
     área e traço sem nenhum somem, e a lista vazia diz */
  function filtrar(pagina, estado, termo) {
    var alvo = chave(termo);
    estado.itens.forEach(function (i) { i.el.classList.toggle('oculto', !!alvo && i.chave.indexOf(alvo) < 0); });
    estado.conjuntos.forEach(function (c) {
      var peloNome = !alvo || c.chave.indexOf(alvo) >= 0;
      var casam = c.opcoes.filter(function (o) { return peloNome || o.chave.indexOf(alvo) >= 0; });
      c.opcoes.forEach(function (o) { o.el.classList.toggle('oculto', casam.indexOf(o) < 0); });
      c.el.classList.toggle('oculto', !casam.length);
      if (alvo && !peloNome && casam.length) abrir(c.cabeca, c.corpo, true);
    });
    function temVisivel(el, seletor) {
      return Array.prototype.some.call(el.querySelectorAll(seletor), function (x) { return !x.classList.contains('oculto'); });
    }
    estado.blocos.forEach(function (b) {
      var tem = temVisivel(b.corpo, '.treino-item, .treino-conjunto');
      b.el.classList.toggle('oculto', !tem);
      if (alvo && tem) abrir(b.cabeca, b.corpo, true);
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
