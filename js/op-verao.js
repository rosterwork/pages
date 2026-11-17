/* ============================================================
   OP. VERÃO — a página do menu
   A mesma Escala (escalas.html e os mesmos arquivos; o manifesto em
   index-navegacao.js), só com a Operação Verão: o iniciar põe a marca
   .escala-pagina--op-verao (o css/op-verao.css troca os textos e
   esconde o que não é dela), põe na barra o Cadastrar guarda-vidas
   civil (op-verao-militares.js mostra) e liga o rodapé
   (op-verao-rascunho.js). Ela se registra como página filtrada
   (RosterWork.paginasFiltradas, lida pelo RosterWork.paginaFiltrada
   do escalas.js), como o Sobreaviso e os Estágios:
   - as abas são Mês (Agenda e Calendário) e Guarda-vidas (a grade
     do Militares, op-verao-militares.js);
   - as unidades: uma por companhia com Operação Verão no mês, com o
     nome da companhia (sem nenhuma, o vazio);
   - a célula e o título do dia são os da Op. Verão
     (op-verao-celula.js) e o clique abre as caixas dela
     (op-verao-caixa.js), nunca o painel do dia.
   RosterWork.paginas['op-verao']
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* as unidades da grade: a primeira da tela de cada companhia com Operação Verão no mês, com o nome da companhia */
  function colunas(lista) {
    var C = RW.opVeraoCelula, E = RW.paginas.escalas, vistas = {}, saida = [];
    (lista || []).forEach(function (c) {
      var cia = C.companhia(c.id);
      if (cia == null || vistas[cia]) return;
      vistas[cia] = true;
      var info = E && E.companhiaDe ? E.companhiaDe(c.id) : null;
      saida.push(Object.assign({}, c, info ? { nome: info.nome, nomePainel: info.nome, nomeCompleto: info.nome,
        cidade: info.cidade } : {}));
    });
    C.colunas(saida);
    return saida;
  }

  function iniciar(conteudo) {
    var pagina = conteudo.querySelector('.pagina');
    if (pagina) pagina.classList.add('escala-pagina--op-verao');
    var ajuda = conteudo.querySelector('.pagina-ajuda');
    if (ajuda) ajuda.setAttribute('data-manual', 'op-verao');
    /* o Cadastrar guarda-vidas civil, na frente da barra (só na aba Guarda-vidas, pelo CSS; só para quem administra) */
    var barra = conteudo.querySelector('.escala-barra'), botao = RW.tpl('tpl-op-verao-barra-cadastrar');
    if (barra && botao) {
      botao.classList.add('oculto');
      barra.insertBefore(botao, barra.firstChild);
    }
    RW.opVeraoRascunho.ligar(pagina);
    return RW.paginas.escalas.iniciar(conteudo);
  }

  RW.paginasFiltradas = RW.paginasFiltradas || {};
  RW.paginasFiltradas['op-verao'] = {
    situacao: 'op-verao',
    militares: 'op-verao',
    semColunas: true,
    colunas: colunas,
    vazia: function () { return RW.mensagens.opVerao.paginaVazia; },
    impressao: function () { return RW.mensagens.opVerao.impressao; }
  };
  RW.paginas['op-verao'] = { iniciar: iniciar };
})();
