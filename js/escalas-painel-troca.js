/* ============================================================
   ESCALAS — a troca pelo painel do dia: o Solicitar troca (o botão
   do subcabeçalho, para todos) e o Registrar troca de serviço (o
   menu Editar o dia; só admin). O formulário da troca da página
   Trocas (trocas-varias.js: o mesmo código) abre no lugar da lista
   do dia, com o Voltar ao dia no alto e o rodapé dele (Cancelar ·
   Solicitar troca, ou Registrar troca), e o calendário no mês do
   dia aberto. O Registrar grava na hora, já aprovado, fora do
   rascunho do Dia: por isso só abre sem mudança não salva
   (escalas-painel-editar.js), e o dia e a grade leem de novo
   (também depois do Desfazer do resumo). O pedido do Solicitar só
   vira escala depois de aceito e aprovado: abre com o rascunho e
   não relê nada. Enviou ou registrou: o painel volta ao dia.
   O Voltar ao dia e o Cancelar perguntam antes de descartar o que
   foi preenchido; o X do painel (escalas-painel.js) e o navegador
   (guarda de saída) também, pelo temDados.
   API: RosterWork.escalasPainelTroca.abrir(corpo, rodape, { registrar, iso, com, aoSair, aoRegistrar }),
        .temDados(), .encerrar()
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var aberto = null;   // { rodape, aoSair } enquanto o formulário está na tela

  /* há algo preenchido no formulário aberto? */
  function temDados() { return !!aberto && !!(RW.trocasVarias && RW.trocasVarias.temDados()); }

  /* o formulário sai (o painel fechou, trocou de aba ou voltou ao dia) */
  function encerrar() {
    if (!aberto) return;
    aberto = null;
    if (RW.trocasVarias) RW.trocasVarias.encerrar();
  }

  /* o formulário sai e a lista do dia volta (o rodapé sai limpo daqui) */
  function voltarAoDia() {
    if (!aberto) return;
    var rodape = aberto.rodape, aoSair = aberto.aoSair;
    encerrar();
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    aoSair();
  }

  /* o Voltar ao dia e o Cancelar: com algo preenchido, confirma o descarte antes (o mesmo aviso do formulário nas Trocas) */
  function sair() {
    if (!aberto) return;
    if (!temDados() || !RW.confirmar) { voltarAoDia(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: voltarAoDia
    });
  }

  /* corpo e rodape = os do painel do dia (o rodapé fica com o do formulário); registrar = o modo Registrar; iso = o dia
     aberto (o mês do calendário); com = o militar do Registrar troca de serviço do nome (ele já na lista e o dia
     escolhido). aoSair: a lista do dia volta a desenhar; aoRegistrar: o dia lê de novo */
  function abrir(corpo, rodape, opcoes) {
    if (!corpo || !RW.trocasVarias) return;
    encerrar();
    aberto = { rodape: rodape, aoSair: opcoes.aoSair };
    corpo.textContent = '';
    var voltar = RW.tpl('tpl-escala-sub-voltar');
    if (voltar) { voltar.addEventListener('click', sair); corpo.appendChild(voltar); }
    RW.trocasVarias.montar({
      corpo: corpo, registrar: !!opcoes.registrar, mesInicial: opcoes.iso || null, cancelar: sair, aoConcluir: voltarAoDia,
      com: opcoes.com || null, diaEscolhido: opcoes.com ? opcoes.iso : null,
      aoMudar: opcoes.registrar ? function () {
        window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
        if (opcoes.aoRegistrar) opcoes.aoRegistrar();
      } : null
    });
  }

  /* fechar ou recarregar o navegador, ou ir para outra página, com o formulário preenchido: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(temDados);

  RW.escalasPainelTroca = { abrir: abrir, temDados: temDados, encerrar: encerrar };
})();
