/* ============================================================
   FOLGAS — orquestrador da página
   Liga as abas (Minhas folgas · Equipe · Pendências), a alternância
   Saldos/Histórico da Equipe, e monta os módulos. As ações ficam à
   esquerda do subcabeçalho, em todas as abas: "Solicitar folga"
   (autosserviço) e, no grupo Administração (só admin), "Dar folga".
   Conceder e ajustar também vivem no painel do militar.
   A aba Pendências (só admin) é
   a fila dos pedidos de folga (geral-fila), a mesma da página
   Pendências.
   Registra RosterWork.paginas.folgas = { iniciar }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var estado = { aba: 'minhas', equipeModo: 'saldos' };
  var ctx = null;
  var ouvindo = false;
  var fila = null;   // a fila da aba Pendências (geral-fila)


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
    painelVisivel('pendencias', a === 'pendencias');

    var ctrls = document.querySelector('.folgas-controles[data-controles="equipe"]');
    if (ctrls) ctrls.classList.toggle('oculto', a !== 'equipe');
    var busca = document.getElementById('busca-folgas');
    if (busca) busca.classList.toggle('oculto', !eqSaldos);
    var periodo = document.getElementById('folgas-periodo');
    if (periodo) periodo.classList.toggle('oculto', !eqHist);
  }

  function carregarAba() {
    if (estado.aba === 'minhas' && RW.folgasMinhas) RW.folgasMinhas.carregar();
    else if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
    else if (estado.aba === 'pendencias') carregarPendencias();
  }

  /* a aba Pendências: os pedidos de folga para aprovar (o número vai no selo da aba) */
  function escreverSeloPendencias(n) {
    var s = document.getElementById('folgas-pendencias-contagem');
    if (!s) return;
    s.textContent = n ? String(n) : '';
    s.classList.toggle('oculto', !n);
  }
  function carregarPendencias() {
    if (!fila || !RW.fila) return Promise.resolve();
    return RW.fila.ler().then(function (r) {
      if (!r) return;
      var folgas = RW.fila.doTipo(r.aprovar, ['folga']);
      fila.definir(folgas);
      escreverSeloPendencias(folgas.length);
    });
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
    if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
    else if (estado.aba === 'pendencias') carregarPendencias();
  }

  function iniciar(conteudo) {
    estado.aba = 'minhas';
    estado.equipeModo = 'saldos';
    ctx = { cpf: RosterWork.sessao.cpf(), admin: RosterWork.sessao.ehAdmin(), aoMudar: recarregarAtivo };

    var abas = conteudo.querySelector('#folgas-abas');
    if (RW.abas && abas) RW.abas.ligar(abas, aoTrocarAba);

    var abaEquipe = conteudo.querySelector('#folgas-abas [data-aba="equipe"]');   // Equipe é só do admin
    if (abaEquipe) abaEquipe.classList.toggle('oculto', !ctx.admin);
    var abaPend = conteudo.querySelector('#folgas-aba-pendencias');   // Pendências também
    if (abaPend) abaPend.classList.toggle('oculto', !ctx.admin);
    fila = (ctx.admin && RW.fila) ? RW.fila.criar(conteudo.querySelector('#folgas-pendencias'), {
      vazio: RW.mensagens.pendencias.vazioFolgas,
      /* depois de decidir: a fila, o placar de saldos e as minhas folgas */
      recarregar: function () {
        if (RW.arvoreUnidades) RW.arvoreUnidades.recarregar();
        if (RW.folgasMinhas) RW.folgasMinhas.carregar();
        return carregarPendencias();
      }
    }) : null;
    if (fila) RW.fila.contar().then(function (c) { escreverSeloPendencias(c.aprovar.folga || 0); });

    /* as ações valem em todas as abas; o grupo Administração (Dar folga) só para o admin,
       e no celular é um menu (fecha antes de abrir o painel) */
    var btnSolicitar = conteudo.querySelector('#btn-solicitar-folga');
    if (btnSolicitar) btnSolicitar.addEventListener('click', function () { if (RW.folgasMinhas) RW.folgasMinhas.solicitar(); });
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !ctx.admin);
    var btnDar = conteudo.querySelector('#btn-dar-folga');
    if (btnDar) btnDar.addEventListener('click', function () {
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      if (RW.folgasPainel) RW.folgasPainel.abrirFormFolga({ modo: 'dar' });
    });

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
        if (estado.aba === 'equipe' && estado.equipeModo === 'historico' && RW.folgasListas) RW.folgasListas.carregarHistorico();
        else if (estado.aba === 'pendencias') carregarPendencias();
      });
      ouvindo = true;
    }

    return pronto;
  }

  RW.paginas.folgas = { iniciar: iniciar };
})();
