/* ============================================================
   ESCALAS — filtros e busca da barra de controles
   O botão Filtros (componente geral-filtros, com a coluna Situação)
   vale nos modos de grade (Mês, Semana e Colunas); no Dia
   e no Militares fica escondido. A busca (nome/CPF/RG, marcar ou filtrar) vale
   em todos os modos menos o Militares (que tem a sua própria).
   Filtro e busca se aplicam juntos nas linhas de militar já
   desenhadas: cada linha traz a situação (escalas-celula.js).
   Os afastados vêm escondidos e só aparecem com Afastamentos marcado.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* opções do filtro Situação (o valor é o data-situacao da linha, ver escalas-celula.js) */
  var SITUACOES = [
    { rotulo: 'Prontidão', valor: 'prontidao' },
    { rotulo: 'Trocas', valor: 'trocas' },
    { rotulo: 'Extrajornada', valor: 'extra' },
    { rotulo: 'Pontual', valor: 'pontual' },
    { rotulo: 'Folgas', valor: 'folga' },
    { rotulo: 'Afastamentos', valor: 'afastamento', separado: true }
  ];

  /* modos em que os filtros valem (as grades de célula) */
  var MODOS_COM_FILTRO = { mes: true, semana: true, colunas: true };

  var conteudo = null;
  var obterModo = function () { return 'dia'; };
  var filtros = null;
  var buscaTermo = '';
  var buscaModo = 'marcar';     /* 'marcar' (realça) | 'filtrar' (esconde quem não casa) */
  var observador = null;        /* reaplica quando o corpo muda (render assíncrono, célula atualizada) */
  var agendado = false;

  function filtrosValem() { return !!MODOS_COM_FILTRO[obterModo()]; }

  /* a linha passa nos filtros? Situação: "Todos" (padrão) = todos menos os afastados;
     Afastamentos é um acréscimo ("Todos" + Afastamentos = todos e os afastados; desmarcar
     o "Todos" deixa só os afastados) — a regra mora no geral-filtro-arvore */
  function passaFiltros(linha) {
    return passa(linha.getAttribute('data-situacao'));
  }

  function passa(situacao) {
    if (!filtros || !filtrosValem()) return situacao !== 'afastamento';
    return filtros.passa('situacao', situacao);
  }

  /* a pessoa (dado da grade) passa nos filtros da tela? O PDF das grades sai igual à tela */
  function passaPessoa(p) {
    var celula = window.RosterWork.escalasCelula;
    return passa(celula ? celula.situacao(p) : 'prontidao');
  }

  /* os filtros ligados, como as etiquetas da linha "Filtros:" (["Situação: Afastamentos", ...]; nenhum = []),
     para a nota do painel de impressão */
  function resumo() {
    if (!conteudo || !filtrosValem()) return [];
    return Array.prototype.map.call(conteudo.querySelectorAll('.filtros-ativos:not(.oculto) .filtro-ativo'), function (etiqueta) {
      return etiqueta.querySelector('.filtro-ativo-tipo').textContent + ': ' + etiqueta.querySelector('.filtro-ativo-valor').textContent;
    });
  }

  /* aplica filtro + busca nas linhas da grade. 'marcar' realça a linha casada e acende a célula;
     'filtrar' esconde as linhas que não casam. No modo Militares não age (busca própria) */
  function aplicar() {
    if (!conteudo || obterModo() === 'militares') return;
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (!corpo) return;
    var RW = window.RosterWork;
    Array.prototype.forEach.call(corpo.querySelectorAll('.escala-mes-celula--busca'), function (cel) {
      cel.classList.remove('escala-mes-celula--busca');
    });
    Array.prototype.forEach.call(corpo.querySelectorAll('.linha-escalado'), function (linha) {
      var passa = passaFiltros(linha);
      var casa = !!buscaTermo && !!RW.busca && RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('linha-escalado--busca', passa && casa && buscaModo === 'marcar');
      linha.classList.toggle('busca-achado', passa && casa);   // o que o Enter da busca percorre (geral-busca.js)
      linha.classList.toggle('oculto', !passa || (!!buscaTermo && !casa && buscaModo === 'filtrar'));
      if (passa && casa) {
        var cel = linha.closest('.escala-mes-celula');
        if (cel) cel.classList.add('escala-mes-celula--busca');
      }
    });
    /* modo Dia: a árvore usa a linha do painel (não há célula de grade); só a busca, que realça/esconde a linha */
    Array.prototype.forEach.call(corpo.querySelectorAll('.escala-distribuicao-escalado'), function (linha) {
      var casa = !!buscaTermo && !!RW.busca && RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('escala-distribuicao-escalado--busca', casa && buscaModo === 'marcar');
      linha.classList.toggle('busca-achado', casa);
      linha.classList.toggle('oculto', !!buscaTermo && !casa && buscaModo === 'filtrar');
    });
  }

  /* reaplica depois que o corpo muda, no próximo quadro (não reprocessa a cada mutação isolada) */
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () { agendado = false; aplicar(); });
  }

  /* o modo mudou: a busca some no Militares; os filtros só aparecem nas grades de célula */
  function aplicarModo(modo) {
    if (!conteudo) return;
    var busca = conteudo.querySelector('#escala-busca-geral');
    if (busca) busca.classList.toggle('oculto', modo === 'militares');
    if (filtros) filtros.mostrar(!!MODOS_COM_FILTRO[modo]);
  }

  /* a navegação chama isto a cada visita (o fragmento é novo: filtros e busca voltam vazios).
     modoAtual: função que diz o modo da tela */
  function iniciar(fragmento, modoAtual) {
    conteudo = fragmento;
    obterModo = modoAtual;
    buscaTermo = '';
    buscaModo = 'marcar';
    var caixaFiltros = conteudo.querySelector('#escala-filtros');
    filtros = (caixaFiltros && window.RosterWork.filtros) ? RosterWork.filtros.criar(caixaFiltros, { aoMudar: aplicar }) : null;
    if (filtros) filtros.definir('situacao', SITUACOES);
    var caixaBusca = conteudo.querySelector('#escala-busca-geral');
    if (caixaBusca && window.RosterWork.busca) {
      RosterWork.busca.criar({
        caixa: caixaBusca,
        aoBuscar: function (termo, modo) { buscaTermo = termo; buscaModo = modo; aplicar(); }
      });
    }
    /* observa só childList (filtro e busca só trocam classes) para não entrar em laço */
    if (observador) observador.disconnect();
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (corpo && window.MutationObserver) {
      observador = new MutationObserver(agendar);
      observador.observe(corpo, { childList: true, subtree: true });
    }
  }

  window.RosterWork.escalasFiltros = { iniciar: iniciar, aplicarModo: aplicarModo, passaPessoa: passaPessoa, resumo: resumo };
})();
