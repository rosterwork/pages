/* ============================================================
   ESCALAS — filtros e busca da barra de controles
   O botão Filtros (componente geral-filtros, com a coluna Situação)
   vale nos modos de grade (Mês, Semana e Colunas) e no Militares,
   onde age nos horários de cada dia e no selo dos dias
   (escalas-militares-dias.js); no Dia e na Minha escala fica
   escondido. A busca (nome/CPF/RG,
   marcar ou filtrar) vale em todos os modos menos o Militares (que
   tem a sua própria) e a Minha escala.
   Filtro e busca se aplicam juntos nas linhas de militar já
   desenhadas: cada linha traz a situação (escalas-celula.js).
   Os afastados vêm escondidos e só aparecem com Incluir afastados marcado.
   A última opção, Falta de gente (desmarcada ao abrir), não esconde
   ninguém: liga a linha dos horários embaixo do gráfico das grades
   (escalas-falta.js; fica fora da nota do PDF).
   A escolha fica guardada na sessão (geral-filtros, chave 'escala'),
   menos nas páginas filtradas (Sobreaviso, Estágios e Op. Verão).
   A linha de quem está logado ganha o realce claro (--voce) nas
   grades e na escala do dia da Minha escala.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* opções do filtro Situação (o valor é o data-situacao da linha, ver escalas-celula.js) */
  var SITUACOES = [
    { rotulo: 'Guarnição', valor: 'prontidao' },
    { rotulo: 'Trocas', valor: 'trocas' },
    { rotulo: 'Extrajornada', valor: 'extra' },
    { rotulo: 'Pontual', valor: 'pontual' },
    { rotulo: 'Estágio', valor: 'estagio' },
    { rotulo: 'Folgas', valor: 'folga' },
    { rotulo: 'Sobreaviso', valor: 'sobreaviso' },
    { rotulo: 'Fora da escala', valor: 'fora' },
    { rotulo: 'Incluir afastados', valor: 'afastamento', separado: true },
    { rotulo: 'Falta de gente', valor: 'falta-gente', separado: true }
  ];
  /* a última opção não filtra ninguém: liga a linha da Falta de gente embaixo do gráfico (escalas-falta.js) */
  var FALTA = SITUACOES[SITUACOES.length - 1];

  /* modos em que os filtros valem (as grades de célula e o Militares) */
  var MODOS_COM_FILTRO = { mes: true, semana: true, colunas: true, militares: true };

  var conteudo = null;
  var obterModo = function () { return 'dia'; };
  var filtros = null;
  var buscaTermo = '';
  var buscaModo = 'marcar';     /* 'marcar' (realça) | 'filtrar' (esconde quem não casa) */
  var observador = null;        /* reaplica quando o corpo muda (render assíncrono, célula atualizada) */
  var agendado = false;

  function filtrosValem() { return !!MODOS_COM_FILTRO[obterModo()]; }

  /* a linha passa nos filtros? Situação: "Todos" (padrão) = todos menos os afastados;
     Incluir afastados é acréscimo ("Todos" + Incluir afastados = todos e os afastados) —
     a regra mora no geral-filtro-arvore */
  function passaFiltros(linha) {
    return passa(linha.getAttribute('data-situacao'));
  }

  function passa(situacao) {
    /* a página filtrada (o Sobreaviso e os Estágios): o filtro fica preso nela (RosterWork.paginaFiltrada) */
    var pf = window.RosterWork.paginaFiltrada && RosterWork.paginaFiltrada();
    if (pf) return situacao === pf.situacao;
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
    if (!conteudo || !filtrosValem() || (window.RosterWork.paginaFiltrada && RosterWork.paginaFiltrada())) return [];
    /* a Falta de gente não sai no PDF, então não entra na nota */
    return Array.prototype.filter.call(conteudo.querySelectorAll('.filtros-ativos:not(.oculto) .filtro-ativo'), function (etiqueta) {
      return etiqueta.querySelector('.filtro-ativo-valor').textContent !== FALTA.rotulo;
    }).map(function (etiqueta) {
      return etiqueta.querySelector('.filtro-ativo-tipo').textContent + ': ' + etiqueta.querySelector('.filtro-ativo-valor').textContent;
    });
  }

  /* a Falta de gente marcada? Só com esta página na tela, nas grades de célula (não no Militares) e fora das páginas
     filtradas (Sobreaviso, Estágios e Op. Verão) */
  function faltaDeGente() {
    if (!filtros || !conteudo || !conteudo.isConnected || obterModo() === 'militares' || !filtrosValem()) return false;
    if (window.RosterWork.paginaFiltrada && RosterWork.paginaFiltrada()) return false;
    return filtros.passa('situacao', FALTA.valor);
  }

  /* a escolha dos filtros mudou: as linhas e a Falta de gente (marcada, a linha embaixo do gráfico; desmarcada, some) */
  function mudou() {
    aplicar();
    if (window.RosterWork.escalasFalta) RosterWork.escalasFalta.atualizar();
  }

  /* a linha é de quem está logado? O data-busca traz o CPF em dígitos, separado por espaço (geral-busca, chave) */
  function ehVoce(linha, cpf) {
    return !!cpf && (' ' + (linha.getAttribute('data-busca') || '') + ' ').indexOf(' ' + cpf + ' ') !== -1;
  }

  /* aplica filtro + busca nas linhas da grade. 'marcar' realça a linha casada e acende a célula;
     'filtrar' esconde as linhas que não casam. No modo Militares, só o filtro, nos horários e no selo dos dias
     (escalas-militares-dias.js; a busca é a dele) */
  function aplicar() {
    if (!conteudo) return;
    if (obterModo() === 'militares') {
      if (window.RosterWork.escalasMilitaresDias) RosterWork.escalasMilitaresDias.aplicar(conteudo.querySelector('.escala-mil-grade'));
      return;
    }
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (!corpo) return;
    var RW = window.RosterWork;
    var cpf = RW.sessao ? String(RW.sessao.cpf() || '').replace(/\D/g, '') : '';
    var minha = obterModo() === 'minha';
    Array.prototype.forEach.call(corpo.querySelectorAll('.escala-mes-celula--busca'), function (cel) {
      cel.classList.remove('escala-mes-celula--busca');
    });
    Array.prototype.forEach.call(corpo.querySelectorAll('.linha-escalado'), function (linha) {
      var passa = passaFiltros(linha);
      var casa = !!buscaTermo && !!RW.busca && RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('linha-escalado--voce', ehVoce(linha, cpf));
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
      /* na Minha escala não há busca: o termo que ficou de outra aba não vale */
      var casa = !minha && !!buscaTermo && !!RW.busca && RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('escala-distribuicao-escalado--voce', minha && ehVoce(linha, cpf));
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

  /* o modo mudou: a busca some no Militares e na Minha escala; os filtros só aparecem nas grades de célula */
  function aplicarModo(modo) {
    if (!conteudo) return;
    var busca = conteudo.querySelector('#escala-busca-geral');
    if (busca) busca.classList.toggle('oculto', modo === 'militares' || modo === 'minha');
    if (filtros) filtros.mostrar(!!MODOS_COM_FILTRO[modo]);
  }

  /* a navegação chama isto a cada visita (o fragmento é novo: a busca volta vazia e os filtros voltam com a escolha
     guardada na sessão; a página filtrada não guarda). modoAtual: função que diz o modo da tela */
  function iniciar(fragmento, modoAtual) {
    conteudo = fragmento;
    obterModo = modoAtual;
    buscaTermo = '';
    buscaModo = 'marcar';
    var caixaFiltros = conteudo.querySelector('#escala-filtros');
    var filtrada = window.RosterWork.paginaFiltrada && RosterWork.paginaFiltrada();
    filtros = (caixaFiltros && window.RosterWork.filtros)
      ? RosterWork.filtros.criar(caixaFiltros, { aoMudar: mudou, guardar: filtrada ? null : 'escala' })
      : null;
    if (filtros) filtros.definir('situacao', SITUACOES);
    /* a página é nova: a Falta de gente lê de novo (e, marcada, pede a conta das células que já estiverem na tela) */
    if (window.RosterWork.escalasFalta) RosterWork.escalasFalta.reiniciar();
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

  /* a situação está escondida pelo filtro? então os filtros voltam ao começo (todos), para quem foi adicionado aparecer
     (o Adicionar estagiário) */
  function mostrarSituacao(situacao) {
    if (filtros && filtrosValem() && !passa(situacao)) { filtros.limpar(); aplicar(); }
  }

  window.RosterWork.escalasFiltros = { iniciar: iniciar, aplicarModo: aplicarModo, passaPessoa: passaPessoa, passaSituacao: passa,
    resumo: resumo, mostrarSituacao: mostrarSituacao, faltaDeGente: faltaDeGente };
})();
