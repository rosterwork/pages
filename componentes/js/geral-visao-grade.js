/* ============================================================
   COMPONENTE geral-visao-grade — a visão das grades, lembrada por
   usuário no banco (como o tema): a última visão da Escala e a
   escolha Agenda | Calendário. Essa escolha é uma só para a Escala
   (Mês) e a Extrajornada (Calendário e Distribuição): trocar numa
   tela vale nas outras. Cada tipo de aparelho (o celular, pela tela
   de celular, e o computador) lembra a sua visão, a sua Agenda |
   Calendário e a sua quantidade de colunas. Tudo fica no objeto
   escala_visao das preferências (fn_preferencias_salvar): { modo,
   modo_celular, mes, mes_celular, colunas_tipo, colunas_qtd,
   colunas_qtd_celular, disposicao }; a chave com _celular é a do
   celular, e `mes` é a Agenda | Calendário do computador.
   As unidades nos calendários (disposicao): 'lado' (lado a lado) ou
   'empilhadas' (uma embaixo da outra, o padrão), uma escolha só para
   todos os calendários da Escala e da Extrajornada, só no computador
   (no celular, sempre uma embaixo da outra). O botão da barra
   (ligarDisposicao) mostra no ícone e na dica o que o clique faz.
   API: RosterWork.visaoGrade.ler() · modo() · agendaOuCalendario() ·
   quantasColunas() · disposicao() · ligarDisposicao(botao, aoTrocar) ·
   gravar(mudancas)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function lerPreferencias() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; }
    catch (e) { return {}; }
  }

  /* a visão guardada; vazia = nunca escolheu */
  function ler() {
    var visao = lerPreferencias().escala_visao;
    return (visao && typeof visao === 'object') ? visao : {};
  }

  function noCelular() {
    return !!(window.RosterWork.celular && window.RosterWork.celular());
  }

  /* as escolhas de cada tipo de aparelho: [a chave no computador, a chave no celular] */
  var POR_APARELHO = {
    modo: ['modo', 'modo_celular'],
    agendaOuCalendario: ['mes', 'mes_celular'],
    colunas_qtd: ['colunas_qtd', 'colunas_qtd_celular']
  };

  function chaveDoAparelho(nome) {
    return POR_APARELHO[nome][noCelular() ? 1 : 0];
  }

  /* 'agenda' ou 'calendario', a do tipo de aparelho em uso; sem escolha, a Agenda */
  function agendaOuCalendario() {
    return ler()[chaveDoAparelho('agendaOuCalendario')] === 'calendario' ? 'calendario' : 'agenda';
  }

  /* a última visão da Escala no tipo de aparelho em uso. O celular que ainda não escolheu segue o computador só na Minha
     escala; as grades largas (Militares e Colunas) só abrem no celular de quem as escolheu lá */
  function modo() {
    var visao = ler();
    var escolhido = visao[chaveDoAparelho('modo')];
    if (escolhido || !noCelular()) return escolhido;
    return visao.modo === 'minha' ? 'minha' : 'mes';
  }

  /* quantas colunas o Colunas › Dias mostra no tipo de aparelho em uso; sem escolha, o celular abre com 2, as que cabem
     por tela */
  function quantasColunas() {
    return ler()[chaveDoAparelho('colunas_qtd')] || (noCelular() ? 2 : undefined);
  }

  /* junta as mudanças à visão guardada (o que é do tipo de aparelho vai para a chave dele; a do outro fica como está) e
     grava na sessão e no banco (só com alguém logado) */
  function gravar(mudancas) {
    var prefs = lerPreferencias();
    var visao = ler();
    Object.keys(mudancas).forEach(function (nome) {
      visao[POR_APARELHO[nome] ? chaveDoAparelho(nome) : nome] = mudancas[nome];
    });
    prefs.escala_visao = visao;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    var R = window.RosterWork;
    if (R.apiFetch && R.obterToken && R.obterToken()) {
      R.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_escala_visao: visao }
      }).catch(function () {});   // falhou: só não lembra desta vez (a tela já está certa)
    }
  }

  /* as unidades nos calendários: 'lado' ou 'empilhadas'; no celular, sempre 'empilhadas' (três colunas não cabem no dia) */
  function disposicao() {
    return !noCelular() && ler().disposicao === 'lado' ? 'lado' : 'empilhadas';
  }

  /* o ícone e a dica do botão mostram o que o clique faz: com as unidades uma embaixo da outra, os retângulos em pé
     ("Mostrar as unidades lado a lado"); lado a lado, os deitados */
  function pintarDisposicao(botao) {
    var lado = disposicao() === 'lado';
    var M = window.RosterWork.mensagens.visaoGrade;
    var dica = lado ? M.mostrarEmpilhadas : M.mostrarLadoALado;
    botao.setAttribute('aria-label', dica);
    botao.setAttribute('data-dica', dica);
    var uso = botao.querySelector('use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#' + (lado ? 'icone-unidades-empilhadas' : 'icone-unidades-lado-a-lado'));
  }

  /* o botão da barra (Escala e Extrajornada): o clique troca, grava e chama aoTrocar (a tela redesenha o calendário).
     A marca no botão evita ligar duas vezes o mesmo botão */
  function ligarDisposicao(botao, aoTrocar) {
    if (!botao || botao.hasAttribute('data-disposicao-ligada')) return;
    botao.setAttribute('data-disposicao-ligada', '');
    pintarDisposicao(botao);
    botao.addEventListener('click', function () {
      gravar({ disposicao: disposicao() === 'lado' ? 'empilhadas' : 'lado' });
      pintarDisposicao(botao);
      if (typeof aoTrocar === 'function') aoTrocar();
    });
  }

  window.RosterWork.visaoGrade = {
    ler: ler, modo: modo, agendaOuCalendario: agendaOuCalendario, quantasColunas: quantasColunas,
    disposicao: disposicao, ligarDisposicao: ligarDisposicao, gravar: gravar
  };
})();
