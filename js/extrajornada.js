/* ============================================================
   EXTRAJORNADA — orquestrador da página
   Liga as abas (Calendário | Voluntários · Distribuição · Relatórios), mostra
   o conteúdo da aba ativa e é o DONO do seletor de mês ÚNICO (compartilhado
   pelas abas): as setas andam pelo alcance vindo do banco (extra_nav_meses),
   para trás só meses com dados, para frente para no próximo mês. Todos
   veem Calendário e Voluntários; Distribuição e Relatórios são só do
   administrador (sem elas, os dois grupos de abas viram um só, sem o
   traço). Clicar num dia (Calendário ou Distribuição) abre o painel do
   dia, o mesmo da Escala (escalas-painel.js). A Legenda acompanha a aba.
   Ao abrir a página, o rascunho da extra começa vazio.
   Registra RosterWork.paginas.extrajornada = { iniciar }.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var ABAS = ['calendario', 'voluntarios', 'montagem', 'relatorios'];
  var LEGENDA = { calendario: 'tpl-extra-legenda-calendario', montagem: 'tpl-extra-legenda-montagem' };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var el = {};
  var abaAtual = 'calendario';
  var navAnt = null;   // Date do mês anterior alcançável (ou null = seta travada)
  var navProx = null;  // Date do próximo mês alcançável (ou null)
  var ouvintesLigados = false;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function dataMes(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, 1); }
  function rotuloMes(d) { var n = MESES[d.getMonth()]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + d.getFullYear(); }

  /* ---------- mês compartilhado pelas abas (fonte única) ----------
     Começa no mês atual (o calendário do que está acontecendo). Mudou o mês, as abas seguem. */
  var mesComp = null;
  var MES_KEY = 'rosterwork_extra_mes';   // mês escolhido, guardado na sessão: sobrevive ao F5; some no logout (sessionStorage.clear)
  function mesInicial() { var hj = new Date(); return new Date(hj.getFullYear(), hj.getMonth(), 1); }
  RW.extrajornadaMes = {
    obter: function () { if (!mesComp) mesComp = mesInicial(); return new Date(mesComp.getFullYear(), mesComp.getMonth(), 1); },
    definir: function (d) {
      mesComp = new Date(d.getFullYear(), d.getMonth(), 1);
      try { sessionStorage.setItem(MES_KEY, iso(mesComp)); } catch (e) {}
    },
    restaurar: function () {   // ao abrir a página: usa o mês guardado (F5); sem nada guardado, o mês atual
      var salvo = null; try { salvo = sessionStorage.getItem(MES_KEY); } catch (e) {}
      var d = salvo ? dataMes(salvo) : null;
      mesComp = (d && !isNaN(d.getTime())) ? new Date(d.getFullYear(), d.getMonth(), 1) : mesInicial();
    },
    atualizarSeletor: function () { atualizarSeletor(); }
  };

  /* as unidades marcadas no seletor do cabeçalho (ids em texto); o seletor ainda não pronto usa a preferência do login */
  RW.extrajornadaUnidades = {
    selecionadas: function () {
      var sel = null;
      try { if (RW.seletorUnidadesCabecalho && RW.seletorUnidadesCabecalho.idsSelecionados) sel = RW.seletorUnidadesCabecalho.idsSelecionados(); } catch (e) {}
      if (!sel || !sel.length) { try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); sel = (p && p.unidades_selecionadas) || []; } catch (e2) { sel = []; } }
      return (sel || []).map(String);
    }
  };

  function modulosDa(aba) {
    if (aba === 'voluntarios') return [RW.extrajornadaVoluntarios];
    if (aba === 'montagem') return [RW.extrajornadaEscala, RW.extrajornadaEscalar, RW.extrajornadaLancar];
    if (aba === 'relatorios') return [RW.extrajornadaRelatorios];
    return [RW.extrajornadaCalendario];
  }
  function moduloAtivo() { return modulosDa(abaAtual)[0]; }

  /* ---------- seletor de mês (dono: o orquestrador) ---------- */
  function atualizarSeletor() {
    var comp = RW.extrajornadaMes.obter();
    if (el.periodoNome) el.periodoNome.textContent = rotuloMes(comp);
    if (el.ant) el.ant.disabled = true;
    if (el.prox) el.prox.disabled = true;
    if (!RW.extrajornadaDados) return;
    RW.extrajornadaDados.carregarNavMeses(iso(comp)).then(function (r) {
      r = r || {};
      navAnt = r.nav_anterior ? dataMes(r.nav_anterior) : null;
      navProx = r.nav_proximo ? dataMes(r.nav_proximo) : null;
      if (el.ant) el.ant.disabled = !navAnt;
      if (el.prox) el.prox.disabled = !navProx;
    });
  }

  /* troca o mês compartilhado (com guarda de edição não salva da aba ativa) e recarrega a aba */
  function irParaMes(nova) {
    var mods = modulosDa(abaAtual);
    function aplicar() {
      if (RW.painel && RW.painel.estaAberto()) RW.painel.fechar();
      RW.extrajornadaMes.definir(nova);
      atualizarSeletor();
      mods.forEach(function (m) { if (m && m.renderMes) m.renderMes(); });
    }
    var mod = mods[0];
    if (mod && mod.estaSujo && mod.estaSujo() && RW.confirmar) {
      RW.confirmar({
        tipo: 'aviso',
        mensagem: RW.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RW.mensagens.botoes.descartar,
        textoCancelar: RW.mensagens.botoes.continuarEditando,
        aoConfirmar: aplicar
      });
    } else {
      aplicar();
    }
  }

  function painelVisivel(conteudo, nome, mostra) {
    var e = conteudo.querySelector('.pagina-corpo [data-aba-painel="' + nome + '"]');
    if (e) e.classList.toggle('oculto', !mostra);
  }

  /* as abas ficam em dois grupos que valem como uma escolha só: marca a escolhida e desmarca a do outro grupo */
  function marcarAba(conteudo, nome) {
    Array.prototype.forEach.call(conteudo.querySelectorAll('#extrajornada-abas .aba'), function (a) {
      var ativa = a.getAttribute('data-aba') === nome;
      a.classList.toggle('aba--ativa', ativa);
      a.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }

  /* a Legenda: só no Calendário e na Distribuição, com o conteúdo da aba */
  function atualizarLegenda() {
    if (!el.legenda) return;
    var id = LEGENDA[abaAtual];
    el.legenda.classList.toggle('oculto', !id);
    var alvo = el.legenda.querySelector('[data-legenda-conteudo]');
    if (!alvo) return;
    alvo.textContent = '';
    var t = id && document.getElementById(id);
    if (t) alvo.appendChild(t.content.cloneNode(true));
  }

  function aoTrocarAba(conteudo, aba) {
    var anterior = abaAtual;
    abaAtual = aba ? aba.getAttribute('data-aba') : 'calendario';
    marcarAba(conteudo, abaAtual);
    /* o painel lateral é de uma aba só (o militar em Voluntários, o dia no Calendário e na Distribuição): troca de aba, fecha */
    if (anterior !== abaAtual && RW.painel && RW.painel.estaAberto()) RW.painel.fechar();
    ABAS.forEach(function (n) { painelVisivel(conteudo, n, n === abaAtual); });
    atualizarLegenda();
    /* desliga primeiro quem sai e depois liga quem entra (as buscas e os seletores da barra não se cruzam) */
    ABAS.forEach(function (n) { if (n !== abaAtual) modulosDa(n).forEach(function (m) { if (m && m.desativar) m.desativar(); }); });
    modulosDa(abaAtual).forEach(function (m) { if (m && m.ativar) m.ativar(); });
  }

  /* o painel do dia salvou extras (ou o Dia): a aba ativa relê o mês em silêncio */
  function aposMudarEscala() {
    if (!el.periodo || !el.periodo.isConnected) return;
    modulosDa(abaAtual).forEach(function (m) { if (m && m.recarregar) m.recarregar(); });
  }

  function iniciar(conteudo) {
    if (RW.escalasExtraRascunho) RW.escalasExtraRascunho.zerar();
    var abas = conteudo.querySelector('#extrajornada-abas');
    /* Distribuição e Relatórios são só do administrador; sem elas, os dois grupos viram um só (sem o traço entre eles) */
    var ehAdmin = RosterWork.sessao.ehAdmin();
    ['montagem', 'relatorios'].forEach(function (n) {
      var a = conteudo.querySelector('#extrajornada-abas [data-aba="' + n + '"]');
      if (a) a.classList.toggle('oculto', !ehAdmin);
    });
    if (abas) abas.classList.toggle('extra-abas--comum', !ehAdmin);
    if (RW.abas && abas) {
      /* sair de uma aba com edição não salva: confirma o descarte antes de trocar.
         Captura: roda antes de o geral-abas trocar. */
      abas.addEventListener('click', function (e) {
        var aba = e.target.closest('.aba');
        if (!aba || aba.getAttribute('data-aba') === abaAtual) return;
        var mod = moduloAtivo();
        if (!mod || !mod.estaSujo || !mod.estaSujo()) return;
        e.preventDefault();
        e.stopPropagation();
        RW.confirmar({
          tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
          textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
          aoConfirmar: function () { if (mod.descartar) mod.descartar(); aba.click(); }
        });
      }, true);
      Array.prototype.forEach.call(abas.querySelectorAll('.abas'), function (trilho) {
        RW.abas.ligar(trilho, function (aba) { aoTrocarAba(conteudo, aba); });
      });
    }

    el.periodo = conteudo.querySelector('#extra-periodo');
    el.periodoNome = conteudo.querySelector('#extra-periodo-nome');
    el.ant = conteudo.querySelector('#extra-periodo-anterior');
    el.prox = conteudo.querySelector('#extra-periodo-proximo');
    el.legenda = conteudo.querySelector('#extra-legenda');
    if (el.ant) el.ant.addEventListener('click', function () { if (navAnt) irParaMes(navAnt); });
    if (el.prox) el.prox.addEventListener('click', function () { if (navProx) irParaMes(navProx); });

    RW.extrajornadaMes.restaurar();   // ao reabrir a página, usa o mês guardado na sessão (F5); sem nada, o mês atual
    [RW.extrajornadaCalendario, RW.extrajornadaEscala, RW.extrajornadaVoluntarios, RW.extrajornadaEscalar,
      RW.extrajornadaLancar, RW.extrajornadaRelatorios].forEach(function (m) { if (m && m.montar) m.montar(conteudo); });

    /* clicar num dia abre o painel do dia (o mesmo da Escala, com a aba Extrajornada aberta) */
    if (RW.escalasPainel) RW.escalasPainel.ligar(conteudo);
    if (!ouvintesLigados) {
      ouvintesLigados = true;
      window.addEventListener('rosterwork_escala_recarregar', aposMudarEscala);
      window.addEventListener('rosterwork_escala_salva', aposMudarEscala);
    }

    atualizarSeletor();
    /* o aviso do prazo (sino) pede a solicitação aberta */
    if (RW.referenciaPedida && RW.referenciaPedida('extrajornada') === 'solicitar' && RW.extrajornadaSolicitar) RW.extrajornadaSolicitar.abrir();
    abaAtual = 'calendario';
    var ativa = conteudo.querySelector('#extrajornada-abas .aba--ativa');
    aoTrocarAba(conteudo, ativa || (abas && abas.querySelector('.aba')));

    return Promise.resolve();
  }

  RW.paginas.extrajornada = { iniciar: iniciar };
})();
