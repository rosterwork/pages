/* ============================================================
   FOLGAS — orquestrador da página
   Liga as abas (Minhas folgas · Equipe · Aprovações), a alternância
   Saldos/Histórico da Equipe, e monta os módulos. "Solicitar folga"
   é o botão do cabeçalho (autosserviço); conceder/ajustar vivem no
   painel do militar.
   Registra RosterWork.paginas.folgas = { iniciar }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var estado = { aba: 'minhas', equipeModo: 'saldos' };
  var ctx = null;
  var ouvindo = false;


  function painelVisivel(nome, mostra) {
    var el = document.querySelector('.folgas-corpo [data-aba-painel="' + nome + '"]');
    if (el) el.classList.toggle('oculto', !mostra);
  }

  function aplicarVisibilidade() {
    var a = estado.aba;
    var eqSaldos = (a === 'equipe' && estado.equipeModo === 'saldos');
    var eqHist = (a === 'equipe' && estado.equipeModo === 'historico');
    painelVisivel('minhas', a === 'minhas');
    painelVisivel('equipe-saldos', eqSaldos);
    painelVisivel('equipe-historico', eqHist);
    painelVisivel('aprovacoes', a === 'aprovacoes');

    var ctrls = document.querySelector('.folgas-controles[data-controles="equipe"]');
    if (ctrls) ctrls.classList.toggle('oculto', a !== 'equipe');
    var busca = document.getElementById('busca-folgas');
    if (busca) busca.classList.toggle('oculto', !eqSaldos);
    var periodo = document.getElementById('folgas-periodo');
    if (periodo) periodo.classList.toggle('oculto', !eqHist);
    /* o +/- de expandir/recolher títulos (criado pela árvore na camada) só faz sentido na Equipe → Saldos,
       que é a única aba com árvore; nas demais (Minhas, Aprovações, Histórico) fica escondido */
    var niveis = document.querySelector('.folgas-corpo .titulos-niveis');
    if (niveis) niveis.classList.toggle('oculto', !eqSaldos);
  }

  function carregarAba() {
    if (estado.aba === 'minhas' && RW.folgasMinhas) RW.folgasMinhas.carregar();
    else if (estado.aba === 'aprovacoes' && RW.folgasListas) RW.folgasListas.carregarAprovacoes();
    else if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
  }

  function aoTrocarAba(aba) {
    estado.aba = aba.getAttribute('data-aba');
    aplicarVisibilidade();
    carregarAba();
  }

  /* uma folga/ajuste muda o saldo: recarrega o placar, o "meu" saldo e a lista ativa */
  function recarregarAtivo() {
    if (RW.arvoreUnidades) RW.arvoreUnidades.recarregar();
    if (RW.folgasMinhas) RW.folgasMinhas.carregar();
    if (estado.aba === 'aprovacoes' && RW.folgasListas) RW.folgasListas.carregarAprovacoes();
    else if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
  }

  function iniciar(conteudo) {
    estado.aba = 'minhas';
    estado.equipeModo = 'saldos';
    ctx = { cpf: RosterWork.sessao.cpf(), admin: RosterWork.sessao.ehAdmin(), aoMudar: recarregarAtivo };

    var abas = conteudo.querySelector('#folgas-abas');
    if (RW.abas && abas) RW.abas.ligar(abas, aoTrocarAba);

    var abaAprov = conteudo.querySelector('#folgas-aba-aprovacoes');
    if (abaAprov) abaAprov.classList.toggle('oculto', !ctx.admin);
    var abaEquipe = conteudo.querySelector('#folgas-abas [data-aba="equipe"]');   // Equipe é só do admin
    if (abaEquipe) abaEquipe.classList.toggle('oculto', !ctx.admin);

    var btnSolicitar = conteudo.querySelector('#btn-solicitar-folga');
    if (btnSolicitar) btnSolicitar.addEventListener('click', function () { if (RW.folgasMinhas) RW.folgasMinhas.solicitar(); });

    var modoTrilho = conteudo.querySelector('#folgas-equipe-modo');
    if (RW.abas && modoTrilho) RW.abas.ligar(modoTrilho, function (aba) {
      estado.equipeModo = aba.getAttribute('data-modo') || 'saldos';
      aplicarVisibilidade();
      if (estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
    });

    if (RW.folgasPainel) RW.folgasPainel.ligar(ctx);
    if (RW.folgasListas) RW.folgasListas.ligar(conteudo, ctx);
    if (RW.folgasMinhas) RW.folgasMinhas.montar(conteudo, ctx);

    /* monta a árvore (Equipe › Saldos) ANTES do aplicarVisibilidade: ela cria o +/− de títulos
       na camada, e o aplicarVisibilidade precisa que ele já exista para escondê-lo fora de Saldos */
    var pronto = (RW.folgasSaldos) ? RW.folgasSaldos.montar(conteudo, ctx) : Promise.resolve();
    aplicarVisibilidade();

    if (!ouvindo) {
      window.addEventListener('rosterwork_units_changed', function () {
        if (estado.aba === 'aprovacoes' && RW.folgasListas) RW.folgasListas.carregarAprovacoes();
        else if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
      });
      ouvindo = true;
    }

    return pronto;
  }

  RW.paginas.folgas = { iniciar: iniciar };
})();
