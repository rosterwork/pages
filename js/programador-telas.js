/* ============================================================
   PROGRAMADOR — AS DUAS TELAS DO CELULAR (só programador)
   No celular, a lista e o registro de Mensagens, Bugs e Erros são
   duas telas: abrir um registro esconde a lista, e o Voltar à lista e o
   voltar do Android voltam (.programador-telas--registro,
   css/programador.css). No computador a classe não muda nada, e o
   voltar do navegador continua trocando de tela. Cada aba se liga
   com ligar(layout, botaoVoltar, aoVoltar) e recebe { abrir(chave),
   fechar }: aoVoltar é o que ela faz para voltar à lista, e a chave é
   o registro aberto (outro registro, ou um formulário, sem chave,
   começa do alto). pedirTroca(sujo, continuar) é a pergunta antes de
   perder o texto não salvo, a mesma nas duas abas.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var REGISTRO = 'programador-telas--registro';
  var telas = [];

  function celular() { return !!(RosterWork.celular && RosterWork.celular()); }

  /* a aba à vista, quando o registro dela está aberto */
  function registroAVista() {
    return telas.filter(function (tela) {
      return !tela.layout.classList.contains('oculto') && tela.layout.classList.contains(REGISTRO);
    })[0] || null;
  }

  /* o voltar do Android: a aba à vista volta à lista. Com um aviso aberto, ou quando ela pergunta antes de perder o
     texto, o registro fica e a entrada volta */
  function aoVoltarDoCelular() {
    var tela = registroAVista();
    if (!tela) return;
    if (!document.querySelector('.modal-veu--aberto')) tela.aoVoltar();
    if (registroAVista()) RosterWork.voltar.empilhar(aoVoltarDoCelular);
  }

  /* a entrada do voltar acompanha a aba à vista */
  function atualizarVoltar() {
    if (!celular() || !RosterWork.voltar) return;
    if (registroAVista()) RosterWork.voltar.empilhar(aoVoltarDoCelular);
    else RosterWork.voltar.desempilhar(aoVoltarDoCelular);
  }

  /* a aba nova pode abrir um registro logo em seguida (o bug ligado, Criar bug desta mensagem): a conta fica para
     depois, porque tirar a entrada do voltar e criar outra de uma vez embaralha o histórico */
  function aoTrocarDeAba() { setTimeout(atualizarVoltar, 0); }

  /* a lista volta no ponto em que estava, e o topo recolhido reaparece: é outra tela */
  function mudar(tela, aberto) {
    if (tela.layout.classList.contains(REGISTRO) !== aberto) {
      if (aberto) tela.rolagemDaLista = tela.lista.scrollTop;
      tela.layout.classList.toggle(REGISTRO, aberto);
      if (!aberto) tela.lista.scrollTop = tela.rolagemDaLista;
      if (celular() && RosterWork.recolherTopo) RosterWork.recolherTopo.mostrar();
    }
    atualizarVoltar();
  }

  function ligar(layout, botaoVoltar, aoVoltar) {
    telas = telas.filter(function (tela) { return tela.layout.isConnected; });   /* nova visita à página: os fragmentos são outros */
    var tela = {
      layout: layout,
      lista: layout.querySelector('.geral-painel-esquerdo-lista'),
      registro: layout.querySelector('.geral-corpo-lateral-rolagem'),
      aoVoltar: aoVoltar,
      rolagemDaLista: 0,
      chave: undefined
    };
    telas.push(tela);
    botaoVoltar.addEventListener('click', aoVoltar);
    return {
      abrir: function (chave) {
        mudar(tela, true);
        if (chave === undefined || chave !== tela.chave) tela.registro.scrollTop = 0;
        tela.chave = chave;
      },
      fechar: function () {
        tela.chave = undefined;
        mudar(tela, false);
      }
    };
  }

  /* troca o que está no corpo; com texto não salvo, confirma antes de perder */
  function pedirTroca(sujo, continuar) {
    if (!sujo() || !RosterWork.confirmar) { continuar(); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: continuar
    });
  }

  window.RosterWork.programadorTelas = {
    ligar: ligar,
    pedirTroca: pedirTroca,
    aoTrocarDeAba: aoTrocarDeAba
  };
})();
