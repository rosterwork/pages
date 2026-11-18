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
     nome da companhia; sem nenhuma, a frase do vazio diz o período da
     Operação Verão de cada companhia das unidades escolhidas, ou que
     ela não tem (op_verao_periodos, lido assim que a página abre; para
     quem administra a companhia, também onde ligar);
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

  /* ---------- a frase do mês sem nenhum dia da Operação Verão ---------- */

  var periodos = { chave: null, lista: null };   // a última leitura: as companhias das unidades escolhidas, com o período
  var pedido = 0;                                // latest-wins

  /* as unidades escolhidas no cabeçalho (a fonte é a sessão, como no escalas.js) */
  function escolhidas() {
    try {
      var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {};
      return Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas.map(Number) : [];
    } catch (e) { return []; }
  }

  /* o período das companhias das unidades escolhidas, lido uma vez por escolha (de novo: a página abriu). Se a frase
     provisória já está na tela, ela é trocada quando a leitura chega */
  function lerPeriodos(deNovo) {
    var ids = escolhidas(), chave = ids.join(',');
    if (!deNovo && periodos.chave === chave) return;
    periodos = { chave: chave, lista: null };
    var meu = ++pedido;
    function chegou(lista) {
      if (meu !== pedido) return;
      periodos.lista = lista;
      var el = document.querySelector('.conteudo .escala-pagina--op-verao .pagina-corpo > .escala-mes-estado');
      if (el && el.textContent === RW.mensagens.opVerao.carregando) el.textContent = vazia();
    }
    RW.rpc('op_verao_periodos', { p_unidade_ids: ids }).then(function (r) { chegou(Array.isArray(r) ? r : []); },
      function () { chegou([]); periodos.chave = null; });
  }

  /* a frase: as datas de cada companhia com Operação Verão; sem nenhuma, que a companhia não tem (e, para quem a
     administra, onde ligar); sem companhia nas unidades escolhidas, a frase geral */
  function vazia() {
    var M = RW.mensagens.opVerao;
    lerPeriodos(false);
    var lista = periodos.lista;
    if (!lista) return M.carregando;
    if (!lista.length) return M.paginaVazia;
    var com = lista.filter(function (l) { return l.ativa && l.inicio && l.fim; });
    if (com.length) {
      return com.map(function (l) { return M.periodo(l.nome, RW.data.isoParaBR(l.inicio), RW.data.isoParaBR(l.fim)); }).join(' ');
    }
    var admin = lista.some(function (l) { return !!RW.sessao && RW.sessao.podeAdministrar('companhia', l.companhia_id); });
    var texto = lista.length > 1 ? M.semOpVarias : M.semOp;
    return admin ? texto + ' ' + M.ligar : texto;
  }

  function iniciar(conteudo) {
    lerPeriodos(true);
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
    vazia: vazia,
    impressao: function () { return RW.mensagens.opVerao.impressao; }
  };
  RW.paginas['op-verao'] = { iniciar: iniciar };
})();
