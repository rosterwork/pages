/* ============================================================
   AVISOS › aba "Para mim" — o histórico dos seus avisos.
   O que aconteceu COMIGO: troca confirmada, folga decidida,
   correção de dados aprovada… Cada uma sabe para onde ir ao
   clicar, e o clique marca como lida. Não lidas em negrito, com
   um ponto à esquerda; agrupadas por dia (Hoje · Ontem · data).
   Os últimos 90 dias, de 50 em 50: maisAntigos() traz o lote
   seguinte e continua o grupo do dia onde o anterior parou.
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

  /* o histórico na tela: a lista, quem avisar ao marcar lida, o último aviso mostrado
     (o ponto de partida do lote seguinte) e o dia do último grupo */
  var historico = { lista: null, aoMudar: null, ultimo: null, diaAtual: '', leitura: 0 };

  /* continuar = acrescenta o lote embaixo, sem repetir o rótulo do dia */
  function renderizar(itens, continuar) {
    var lista = historico.lista;
    if (!continuar) {
      lista.textContent = '';
      historico.diaAtual = '';
      if (!itens.length) {
        var vazio = RosterWork.tpl('tpl-avisos-vazio');
        if (vazio) { vazio.textContent = RW.mensagens.avisos.semNotificacoes; lista.appendChild(vazio); }
        return;
      }
    }
    itens.forEach(function (n) {
      var data = new Date(n.criado_em);
      var dia = rotuloDoDia(data);
      if (dia !== historico.diaAtual) {
        historico.diaAtual = dia;
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
        abrir(n, historico.aoMudar);
      });
      lista.appendChild(el);
    });
    if (itens.length) historico.ultimo = itens[itens.length - 1];
  }

  /* marca como lida e navega para a tela do assunto */
  function abrir(n, aoMudar) {
    function irPara() {
      if (n.pagina && RW.irParaPagina) RW.irParaPagina(n.pagina, n.aba, n.referencia_id);
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

  var LOTE = 50;

  /* um lote do histórico; com "antes", o que vem depois do último já mostrado */
  function ler(antes) {
    var corpo = { p_limite: LOTE };
    if (antes) { corpo.p_antes = antes.criado_em; corpo.p_antes_id = antes.id; }
    return RW.apiFetch('/rest/v1/rpc/notificacoes_listar', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  /* lê o primeiro lote; devolve { emAberto, mais }: quantos avisos estão EM ABERTO (o número
     ao lado do título, o mesmo do sino; com algum, o "Marcar todas" aparece) e se há lote
     mais antigo (o "Mostrar mais antigos"). A última leitura vence: a de antes devolve null */
  function carregar(lista, aoMudar) {
    var minha = ++historico.leitura;
    historico.lista = lista;
    historico.aoMudar = aoMudar;
    historico.ultimo = null;
    return ler(null)
      .then(function (caixa) {
        if (minha !== historico.leitura) return null;
        renderizar((caixa && caixa.itens) || [], false);
        return {
          emAberto: (caixa && caixa.abertos && caixa.abertos.total) || 0,
          mais: !!(caixa && caixa.mais)
        };
      })
      .catch(function () {
        if (minha !== historico.leitura) return null;
        var vazio = RosterWork.tpl('tpl-avisos-vazio');
        lista.textContent = '';
        if (vazio) { vazio.textContent = RW.mensagens.avisos.falhaCarregar; lista.appendChild(vazio); }
        return { emAberto: 0, mais: false };
      });
  }

  /* o lote seguinte, embaixo do que já está na tela; devolve { mais } (null se a lista foi
     relida no meio). Na falha, o botão fica para tentar de novo */
  function maisAntigos() {
    var minha = historico.leitura;
    return ler(historico.ultimo)
      .then(function (caixa) {
        if (minha !== historico.leitura) return null;
        renderizar((caixa && caixa.itens) || [], true);
        return { mais: !!(caixa && caixa.mais) };
      })
      .catch(function () { return minha !== historico.leitura ? null : { mais: true }; });
  }

  function marcarTodas() {
    return RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: null } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  RW.avisosNotificacoes = { carregar: carregar, maisAntigos: maisAntigos, marcarTodas: marcarTodas };
})();
