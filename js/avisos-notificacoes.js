/* ============================================================
   AVISOS › aba "Para mim" — o histórico dos seus avisos.
   O que aconteceu COMIGO: troca confirmada, folga decidida,
   correção de dados aprovada… Cada uma sabe para onde ir ao
   clicar, e o clique marca como lida. Não lidas em negrito, com
   um ponto à esquerda; agrupadas por dia (Hoje · Ontem · data).
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];


  /* "Hoje" · "Ontem" · "6 jul 2026" */
  function rotuloDoDia(data) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    var diferenca = Math.round((hoje - dia) / 86400000);
    if (diferenca === 0) return 'Hoje';
    if (diferenca === 1) return 'Ontem';
    return dia.getDate() + ' ' + MESES[dia.getMonth()] + ' ' + dia.getFullYear();
  }

  function hora(data) {
    return String(data.getHours()).padStart(2, '0') + ':' + String(data.getMinutes()).padStart(2, '0');
  }

  /* o assunto vira ícone: os quatro moram no molde e só um fica visível */
  var TIPOS = { troca: true, folga: true, dados: true };
  function mostrarIcone(el, tipo) {
    var qual = TIPOS[tipo] ? tipo : 'outro';
    var icones = el.querySelectorAll('.avisos-notificacao-icone .icone');
    for (var i = 0; i < icones.length; i++) {
      icones[i].classList.toggle('oculto', icones[i].getAttribute('data-tipo') !== qual);
    }
  }

  function renderizar(lista, itens, aoMudar) {
    lista.textContent = '';
    if (!itens.length) {
      var vazio = RosterWork.tpl('tpl-avisos-vazio');
      if (vazio) { vazio.textContent = RW.mensagens.avisos.semNotificacoes; lista.appendChild(vazio); }
      return;
    }
    var diaAtual = '';
    itens.forEach(function (n) {
      var data = new Date(n.criado_em);
      var dia = rotuloDoDia(data);
      if (dia !== diaAtual) {
        diaAtual = dia;
        var titulo = RosterWork.tpl('tpl-avisos-dia');
        if (titulo) { titulo.textContent = dia; lista.appendChild(titulo); }
      }
      var el = RosterWork.tpl('tpl-avisos-notificacao');
      if (!el) return;
      el.classList.toggle('avisos-notificacao--nao-lida', !n.lida);
      mostrarIcone(el, n.tipo);
      el.querySelector('.avisos-notificacao-titulo').textContent = n.titulo || '';
      el.querySelector('.avisos-notificacao-texto').textContent = n.texto || '';
      el.querySelector('.avisos-notificacao-hora').textContent = hora(data);
      el.addEventListener('click', function () {
        abrir(n, aoMudar);
      });
      lista.appendChild(el);
    });
  }

  /* marca como lida e navega para a tela do assunto */
  function abrir(n, aoMudar) {
    function irPara() {
      if (n.pagina && RW.irParaPagina) RW.irParaPagina(n.pagina, n.aba);
    }
    if (n.lida) { irPara(); return; }
    RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: [n.id] } })
      .then(function () {
        if (aoMudar) aoMudar();
        if (RW.avisosSino) RW.avisosSino.recarregar();   /* o badge do sino zera junto */
        irPara();
      })
      .catch(irPara);
  }

  /* carrega os últimos 30 dias; devolve quantos avisos estão EM ABERTO
     (é o número do subtítulo e o que decide se o "Marcar todas" aparece) */
  function carregar(lista, aoMudar) {
    return RW.apiFetch('/rest/v1/rpc/notificacoes_listar', { metodo: 'POST', corpo: { p_limite: 100, p_dias: 30 } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (caixa) {
        var itens = (caixa && caixa.itens) || [];
        renderizar(lista, itens, aoMudar);
        return (caixa && caixa.abertos && caixa.abertos.total) || 0;
      })
      .catch(function () {
        var vazio = RosterWork.tpl('tpl-avisos-vazio');
        lista.textContent = '';
        if (vazio) { vazio.textContent = RW.mensagens.avisos.falhaCarregar; lista.appendChild(vazio); }
        return 0;
      });
  }

  function marcarTodas() {
    return RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: null } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  RW.avisosNotificacoes = { carregar: carregar, marcarTodas: marcarTodas };
})();
