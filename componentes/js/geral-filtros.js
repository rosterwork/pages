/* ============================================================
   FILTROS — o botão Filtros da barra de controles + a linha "Filtros:"
   A página escreve, dentro da caixa .filtros da barra, um lugar por filtro:
     <div data-filtro="graus" data-filtro-nome="Grau" data-filtro-titulo="Graus"></div>
   criar(caixa, { aoMudar }) põe na caixa o botão Filtros (#tpl-filtros: o funil,
   o número de filtros ligados e a seta) e leva cada lugar para o menu do botão,
   como uma coluna (#tpl-filtro: título, "Todos", divisória e a árvore do
   geral-filtro-arvore). Cria a linha "Filtros:" logo abaixo da barra
   (#tpl-filtros-ativos, uma etiqueta #tpl-filtro-ativo por escolha, com o "x"
   que tira só ela, e o "Limpar filtros") e chama aoMudar a cada mudança.
   A página dá as opções (definir) e pergunta se um valor passa (passa).
   Opção com `separado: true` (ex.: Inativos, Afastamentos) fica fora do
   "Todos", depois de uma divisória, e é um acréscimo (ver geral-filtro-arvore).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function criar(caixa, opcoes) {
    var aoMudar = (opcoes && opcoes.aoMudar) || function () {};
    var filtros = {};       /* chave -> { api, nome } (nome = o tipo na etiqueta) */
    var ordem = [];
    var visivel = true;
    var emLote = false;     /* "Limpar filtros" limpa todos e avisa uma vez só */
    var linha = null;
    var lista = null;

    var botao = RosterWork.tpl('tpl-filtros');
    if (!botao || !RosterWork.filtroArvore) return null;
    var menu = botao.querySelector('.filtros-menu');
    var contagem = botao.querySelector('.filtros-contagem');

    /* as etiquetas da linha "Filtros:" e o número no botão; a linha some sem filtro ligado
       (ou com os filtros escondidos) */
    function pintarLinha() {
      var n = 0;
      if (lista) lista.textContent = '';
      ordem.forEach(function (chave) {
        var f = filtros[chave];
        if (!f.api.temFiltro()) return;
        f.api.resumo().forEach(function (item) {
          n++;
          if (!lista) return;
          var etiqueta = RosterWork.tpl('tpl-filtro-ativo');
          if (!etiqueta) return;
          etiqueta.querySelector('.filtro-ativo-tipo').textContent = f.nome;
          etiqueta.querySelector('.filtro-ativo-valor').textContent = item.rotulo;
          etiqueta.querySelector('.filtro-ativo-tirar').addEventListener('click', function () { f.api.desmarcar(item.valores); });
          lista.appendChild(etiqueta);
        });
      });
      contagem.textContent = n ? String(n) : '';
      contagem.classList.toggle('oculto', !n);
      if (linha) linha.classList.toggle('oculto', !n || !visivel);
    }

    function mudou() {
      if (emLote) return;
      pintarLinha();
      aoMudar();
    }

    function limparTodos() {
      emLote = true;
      ordem.forEach(function (chave) { filtros[chave].api.limpar(); });
      emLote = false;
      mudou();
    }

    /* cada lugar vira uma coluna do menu */
    Array.prototype.forEach.call(caixa.querySelectorAll('[data-filtro]'), function (lugar) {
      var coluna = RosterWork.tpl('tpl-filtro');
      if (!coluna) return;
      coluna.querySelector('.dropdown-titulo').textContent = lugar.getAttribute('data-filtro-titulo') || '';
      lugar.appendChild(coluna);
      menu.appendChild(lugar);
      var chave = lugar.getAttribute('data-filtro');
      var api = RosterWork.filtroArvore.criar({
        arvoreEl: coluna.querySelector('.filtro-arvore'),
        mestreEl: coluna.querySelector('.filtro-todos'),
        colapsarTudo: true,
        onChange: mudou
      });
      filtros[chave] = { api: api, nome: lugar.getAttribute('data-filtro-nome') || '' };
      ordem.push(chave);
    });
    caixa.appendChild(botao);

    /* a linha "Filtros:" entra logo abaixo da barra de controles */
    var barra = caixa.closest('.pagina-subcabecalho');
    linha = RosterWork.tpl('tpl-filtros-ativos');
    if (linha && barra) {
      lista = linha.querySelector('.filtros-ativos-lista');
      linha.querySelector('.filtros-ativos-limpar').addEventListener('click', limparTodos);
      barra.after(linha);
    } else {
      linha = null;
    }

    return {
      /* as opções de um filtro: [{ rotulo, valor, separado? }] ou grupos [{ rotulo, filhos: [...] }] */
      definir: function (chave, arvore) { if (filtros[chave]) filtros[chave].api.definir(arvore); },
      /* o valor passa no filtro? (filtro sem escolha = passa) */
      passa: function (chave, valor) { return !filtros[chave] || filtros[chave].api.passa(valor); },
      temFiltro: function () { return ordem.some(function (chave) { return filtros[chave].api.temFiltro(); }); },
      /* esconde o botão e a linha (ex.: num modo da tela em que não valem); a escolha fica guardada */
      mostrar: function (sim) {
        visivel = !!sim;
        caixa.classList.toggle('oculto', !visivel);
        pintarLinha();
      },
      limpar: limparTodos
    };
  }

  window.RosterWork.filtros = { criar: criar };
})();
