/* ============================================================
   GUARDA DE SAÍDA — protege contra perder edição não salva
   Mantém um único "beforeunload". Enquanto algum verificador
   registrado indicar que há alteração não salva, o navegador
   mostra o aviso NATIVO dele ao fechar a aba/janela, recarregar
   (F5) ou ir para outro endereço. O texto e os botões são do
   navegador (não dá para customizar nem trocar pelo nosso modal).
   API: RosterWork.guardaSaida.registrar(verificar) -> cancelar()
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var verificadores = [];

  /* mensagem-reserva lida no momento do evento (não na carga) — assim não depende
     da ordem exata dos <script> no index.html; navegadores modernos exibem a própria */
  function mensagemReserva() {
    var m = window.RosterWork.mensagens;
    return (m && m.edicao && m.edicao.sairSemSalvar) || '';
  }

  /* registra uma função que devolve true quando há edição não salva;
     retorna uma função para cancelar o registro */
  function registrar(verificar) {
    if (typeof verificar !== 'function') return function () {};
    verificadores.push(verificar);
    return function () {
      var i = verificadores.indexOf(verificar);
      if (i >= 0) verificadores.splice(i, 1);
    };
  }

  /* há alguma edição não salva agora? */
  function temPendencia() {
    for (var i = 0; i < verificadores.length; i++) {
      if (verificadores[i]()) return true;
    }
    return false;
  }

  window.addEventListener('beforeunload', function (evento) {
    if (!temPendencia()) return;
    var mensagem = mensagemReserva();
    evento.preventDefault();          /* exige o aviso nativo do navegador */
    evento.returnValue = mensagem;    /* reserva para navegadores antigos */
    return mensagem;
  });

  window.RosterWork.guardaSaida = { registrar: registrar, temPendencia: temPendencia };
})();
