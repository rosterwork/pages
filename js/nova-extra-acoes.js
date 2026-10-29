/* ============================================================
   NOVA EXTRA — o menu Ações da barra (Organizar o mês)
   As ações do passo aberto num menu só; os itens ficam no HTML, cada
   um de um passo (data-passo-acao), e quem mostra os do passo aberto
   é o nova-extra.js. Ao abrir o menu, cada item confere se já pode e,
   se não, fica apagado com o motivo embaixo, em cinza.
   Pedidos › Fechar os pedidos agora: confirma e fecha na hora
   (nova_extra_pedidos_fechar); o prazo "Fecha em" continua valendo
   para quem não usa o botão.
   Distribuição › Lançar na escala e encerrar: a conferência no painel
   direito, com Cancelar e Lançar e encerrar (nova_extra_lancar;
   simulado: a escala não muda). Depois do lançamento, só lança de novo
   pelo Reabrir a distribuição (confirma; nova_extra_reabrir), até o
   mês começar.
   Os Preencher pela sugestão das Cotas e da Distribuição são dos
   módulos deles (nova-extra-cotas.js e nova-extra-montar.js).
   Lê o mês pelo RosterWork.novaExtraOrg.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraAcoes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = null;          // a página

  function msg() { return RW.mensagens.novaExtra.org; }
  function org() { return RW.novaExtraOrg; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function chave(a) { return a.cpf + '|' + a.data; }

  /* ---------- o estado dos itens ---------- */
  /* o que ainda impede cada item (vazio = pode) */
  function motivoFechar(d) {
    if (d.mes.estado === 'antes') return msg().acao.pedidosNaoAbriram;
    if (d.mes.estado === 'encerrado') return msg().acao.pedidosJaFechados;
    return '';
  }
  function motivoPedidosAbertos(d) { return d.mes.estado !== 'encerrado' ? msg().acao.pedidosAbertos : ''; }
  function lancada(d) { return !!d.lancamento && !d.lancamento.reaberto; }
  function motivoSugerir(d) { return motivoPedidosAbertos(d) || (lancada(d) ? msg().acao.lancadaFechada : ''); }
  /* as cotas recebidas (voluntários com termo) que ainda não estão em nenhuma data, pelo que já foi salvo */
  function cotasFaltando(d) {
    var usadas = {};
    d.alocacoes.forEach(function (x) { usadas[x.cpf] = (usadas[x.cpf] || 0) + (x.blocos || []).length; });
    return d.militares.reduce(function (s, m) { return s + (m.voluntario && m.termo ? Math.max(0, (m.concedidas || 0) - (usadas[m.cpf] || 0)) : 0); }, 0);
  }
  function motivoLancar(d) {
    var a = msg().acao;
    if (d.mes.estado !== 'encerrado') return a.pedidosAbertos;
    if (RW.novaExtraMontar && RW.novaExtraMontar.sujo()) return a.salvarAntes;
    if (!d.alocacoes.length) return a.semExtras;
    /* só lança com todas as cotas colocadas nas datas (o banco também recusa) */
    if (cotasFaltando(d) > 0) return a.faltamCotas(cotasFaltando(d));
    if (d.iniciado) return a.mesComecou;
    if (lancada(d)) return a.jaLancada;
    return '';
  }
  function motivoReabrir(d) {
    var a = msg().acao;
    if (!d.lancamento) return a.naoLancada;
    if (d.lancamento.reaberto) return a.jaReaberta;
    if (d.iniciado) return a.mesComecou;
    return '';
  }
  function marcar(id, motivo) { q(id).disabled = !!motivo; q(id + ' .nova-extra-acao-motivo').textContent = motivo; }

  /* ao abrir o menu */
  function atualizar() {
    var d = org().dados();
    if (!d) return;
    marcar('#p1-fechar', motivoFechar(d));
    marcar('#p2-sugestao', motivoPedidosAbertos(d));
    marcar('#p3-sugerir', motivoSugerir(d));
    marcar('#p3-lancar', motivoLancar(d));
    marcar('#p3-reabrir', motivoReabrir(d));
  }

  /* ---------- Pedidos › Fechar os pedidos agora ---------- */
  function fecharPedidos() {
    var d = org().dados();
    if (!d || motivoFechar(d)) return;
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarFechar, textoConfirmar: msg().fecharPedidos,
      aoConfirmar: function () {
        RW.rpc('nova_extra_pedidos_fechar', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
          org().resumo(r);
          RW.novaExtra.recarregar();
        }, function () { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }

  /* ---------- Distribuição › Reabrir a distribuição ---------- */
  function reabrir() {
    var d = org().dados();
    if (!d || motivoReabrir(d)) return;
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarReabrir, textoConfirmar: msg().reabrir,
      aoConfirmar: function () {
        RW.rpc('nova_extra_reabrir', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
          org().resumo(r);
          org().recarregar();
        }, function () { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }

  /* ---------- Distribuição › Lançar na escala e encerrar ---------- */
  function item(cont, ok, titulo, texto) {
    var it = RW.tpl('tpl-ne-item');
    it.classList.add(ok ? 'nova-extra-item--ok' : 'nova-extra-item--alerta');
    it.querySelector('b').textContent = titulo;
    it.querySelector('.nova-extra-item-texto span').textContent = texto || '';
    cont.appendChild(it);
  }

  /* a conferência no painel direito, com Cancelar e Lançar e encerrar */
  function abrirLancar() {
    var d = org().dados(), o = org();
    if (!d || motivoLancar(d)) return;
    RW.painel.abrir({ titulo: msg().lancarTitulo, subtitulo: q('#nova-extra-mes').textContent });
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape();
    corpo.appendChild(RW.tpl('tpl-ne-lancar'));
    rodape.appendChild(document.getElementById('tpl-ne-lancar-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    rodape.querySelector('#p4-cancelar').addEventListener('click', function () { RW.painel.fechar(); });
    rodape.querySelector('#p4-lancar').addEventListener('click', lancar);
    function qp(sel) { return corpo.querySelector(sel); }
    var conf = qp('#p4-conferencia');
    var v = o.vols(), termos = v.filter(function (m) { return m.termo; }).length, dadas = o.totalConcedidas();
    item(conf, true, msg().c1ok(d.mes.fechado_em ? d.mes.fechado_em.slice(0, 5) : u().br(d.mes.fecha)), msg().c1texto(v.length, termos));
    item(conf, dadas > 0, msg().c2(dadas, d.mes.cotas_recebidas || 0), '');
    item(conf, o.naGrade() >= dadas && dadas > 0, msg().c3(o.naGrade(), dadas), '');
    var falta = RW.novaExtraMontar ? RW.novaExtraMontar.diasComFalta(d) : [];
    item(conf, !falta.length, falta.length ? msg().c4(falta.length) : msg().c4ok, falta.slice(0, 6).join(', ') + (falta.length > 6 ? '…' : ''));
    var lanc = d.lancamento;
    qp('#p4-titulo').textContent = lanc ? msg().lancadoTitulo(lanc.lancado_em, lanc.por || '') : msg().aoLancar;
    if (!lanc) { qp('#p4-texto').textContent = msg().lancarTexto(d.alocacoes.length); return; }
    /* já lançada e mudada depois: o que ainda não está na escala */
    var antes = {}, agora = {}, mudas = o.mudancasDesdeLancamento();
    lanc.foto.forEach(function (a) { antes[chave(a)] = a; });
    d.alocacoes.forEach(function (a) { agora[chave(a)] = a; });
    qp('#p4-texto').textContent = msg().mudouDesde(mudas.length);
    mudas.slice(0, 12).forEach(function (k) {
      var a = antes[k], b = agora[k], x = a || b;
      item(qp('#p4-mudancas'), false, u().nome(x.cpf) + ', ' + u().br(x.data), (a ? u().horas(a.blocos) : msg().nada) + ' para ' + (b ? u().horas(b.blocos) : msg().tirado));
    });
  }

  function lancar() {
    var d = org().dados(), btn = RW.painel.rodape().querySelector('#p4-lancar');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_lancar', { p_competencia: d.competencia }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.painel.fechar();
      RW.avisar({ tipo: 'sucesso', mensagem: msg().lancado(r.extras, r.dias) });
      org().recarregar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* liga o menu e os itens (uma vez por página) */
  function ligar(conteudo) {
    el = conteudo;
    q('#nova-extra-acoes > .botao').addEventListener('click', atualizar);
    q('#p1-fechar').addEventListener('click', fecharPedidos);
    q('#p3-lancar').addEventListener('click', abrirLancar);
    q('#p3-reabrir').addEventListener('click', reabrir);
  }

  RW.novaExtraAcoes = { ligar: ligar };
})();
