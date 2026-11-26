/* ============================================================
   EXTRAJORNADA — as ações da barra (Organizar o mês)
   Os botões ficam no HTML, cada um de um passo (data-passo-acao): o
   extrajornada.js diz o passo aberto (passo) e este arquivo mostra os
   dele conforme o momento do mês e liga só o que já pode (o porquê do
   apagado está na nota ou no rodapé da tela). A tela chama atualizar
   quando o mês é lido de novo ou o rascunho muda.
   Pedidos › Fechar os pedidos agora (só com os pedidos abertos):
   confirma e fecha na hora (extrajornada_pedidos_fechar); o prazo
   "Fecha em" continua valendo para quem não usa o botão.
   Distribuição: o próximo passo, um botão só que muda com o mês.
   · Lançar na escala (com tudo salvo, até o mês começar; dá com cota
     faltando): a conferência no painel direito, com Cancelar e Lançar
     na escala (extrajornada_lancar). Lançada, a Distribuição continua
     mudando e cada Salvar vai direto para a escala.
   · Encerrar a distribuição (lançada, com tudo salvo e todas as cotas
     nas datas): confirma (extrajornada_encerrar); a foto vira o
     relatório inicial e as mudanças passam aos Ajustes. Sem encerrar,
     a virada do mês encerra sozinha.
   · Reabrir a distribuição (encerrada, até o mês começar): confirma
     (extrajornada_reabrir); a escala continua lançada.
   Os Preencher pela sugestão das Cotas e da Distribuição são dos
   módulos deles (extrajornada-cotas.js e extrajornada-montar.js); aqui,
   só quando eles aparecem e ligam.
   Lê o mês pelo RosterWork.extrajornadaOrg.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaAcoes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = null;          // a página
  var passoAtual = null;  // o passo aberto na barra (null: fora do Organizar o mês)
  var mesPronto = false;  // o mês na tela já foi lido (enquanto lê, as ações ficam apagadas)

  function msg() { return RW.mensagens.extrajornada.org; }
  function org() { return RW.extrajornadaOrg; }
  function u() { return RW.extrajornadaUtil; }
  function q(sel) { return el.querySelector(sel); }
  function chave(a) { return a.cpf + '|' + a.data; }

  /* ---------- o que já pode ---------- */
  function sujo() { return !!(RW.extrajornadaMontar && RW.extrajornadaMontar.sujo()); }
  /* as cotas recebidas (voluntários com termo) que ainda não estão em nenhuma data, pelo que já foi salvo */
  function cotasFaltando(d) {
    var usadas = {};
    d.alocacoes.forEach(function (x) { usadas[x.cpf] = (usadas[x.cpf] || 0) + (x.blocos || []).length; });
    return d.militares.reduce(function (s, m) { return s + (m.voluntario && m.termo ? Math.max(0, (m.concedidas || 0) - (usadas[m.cpf] || 0)) : 0); }, 0);
  }
  /* o que cada botão mostra e se liga: { ve, pode } */
  function estado(id, d) {
    var fechados = d.mes.estado === 'encerrado', lancada = u().lancada(d), encerrada = u().encerrada(d);
    switch (id) {
      case '#p1-fechar': return { ve: d.mes.estado === 'aberto', pode: true };
      /* nas Cotas, o Preencher apagaria o Recebe mudado e não salvo */
      case '#p2-sugestao': return { ve: true, pode: fechados && !(RW.extrajornadaCotas && RW.extrajornadaCotas.recebeMudado()) };
      /* até encerrar, mesmo com mudança não salva; depois de o mês começar, a sugestão poria extra em dia que passou */
      case '#p3-sugerir': return { ve: !encerrada, pode: fechados && !d.iniciado };
      case '#p3-lancar': return { ve: !lancada, pode: fechados && !sujo() && d.alocacoes.length > 0 && !d.iniciado };
      case '#p3-encerrar': return { ve: lancada && !encerrada, pode: !sujo() && cotasFaltando(d) === 0 };
      case '#p3-reabrir': return { ve: encerrada && !d.iniciado, pode: true };
    }
    return { ve: false, pode: false };
  }

  /* mostra os botões do passo aberto conforme o mês e liga os que já podem */
  function atualizar() {
    if (!el || !q('#p3-lancar')) return;
    var d = org() && org().dados();
    Array.prototype.forEach.call(el.querySelectorAll('.pagina-subcabecalho [data-passo-acao]'), function (b) {
      var doPasso = passoAtual !== null && (b.getAttribute('data-passo-acao') || '').split(' ').indexOf(String(passoAtual)) >= 0;
      var e = doPasso && d ? estado('#' + b.id, d) : { ve: false, pode: false };
      b.classList.toggle('oculto', !e.ve);
      b.disabled = !mesPronto || !e.pode;
    });
  }

  /* ---------- Pedidos › Fechar os pedidos agora ---------- */
  function fecharPedidos() {
    var d = org().dados();
    if (!d || d.mes.estado !== 'aberto') return;
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarFechar, textoConfirmar: msg().fecharPedidos,
      aoConfirmar: function () {
        RW.rpc('extrajornada_pedidos_fechar', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
          org().resumo(r);
          RW.extrajornada.recarregar();
        }, function () { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }

  /* ---------- Distribuição › Encerrar e Reabrir ---------- */
  /* os dois confirmam e gravam na hora (sem mexer na escala); depois, o mês é lido de novo */
  function confirmarEGravar(id, mensagem, textoConfirmar, rpc) {
    var d = org().dados();
    if (!d || !estado(id, d).pode) return;
    RW.confirmar({
      tipo: 'aviso', mensagem: mensagem, textoConfirmar: textoConfirmar,
      aoConfirmar: function () {
        RW.rpc(rpc, { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
          org().resumo(r);
          org().recarregar();
        }, function () { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }
  function encerrar() {
    confirmarEGravar('#p3-encerrar', msg().confirmarEncerrar(q('#extrajornada-mes').textContent), msg().encerrar, 'extrajornada_encerrar');
  }
  function reabrir() {
    confirmarEGravar('#p3-reabrir', msg().confirmarReabrir, msg().reabrir, 'extrajornada_reabrir');
  }

  /* ---------- Distribuição › Lançar na escala ---------- */
  function item(cont, ok, titulo, texto) {
    var it = RW.tpl('tpl-extrajornada-item');
    it.classList.add(ok ? 'extrajornada-item--ok' : 'extrajornada-item--alerta');
    it.querySelector('b').textContent = titulo;
    it.querySelector('.extrajornada-item-texto span').textContent = texto || '';
    cont.appendChild(it);
  }

  /* a conferência no painel direito, com Cancelar e Lançar na escala (o que falta fica em amarelo, sem impedir) */
  function abrirLancar() {
    var d = org().dados(), o = org();
    if (!d || !estado('#p3-lancar', d).pode) return;
    RW.painel.abrir({ titulo: msg().lancarTitulo, subtitulo: q('#extrajornada-mes').textContent });
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape();
    corpo.appendChild(RW.tpl('tpl-extrajornada-lancar'));
    rodape.appendChild(document.getElementById('tpl-extrajornada-lancar-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    rodape.querySelector('#p4-cancelar').addEventListener('click', function () { RW.painel.fechar(); });
    rodape.querySelector('#p4-lancar').addEventListener('click', lancar);
    function qp(sel) { return corpo.querySelector(sel); }
    var conf = qp('#p4-conferencia');
    var v = o.vols(), termos = v.filter(function (m) { return m.termo; }).length, dadas = o.totalConcedidas();
    item(conf, true, msg().c1ok(d.mes.fechado_em ? d.mes.fechado_em.slice(0, 5) : u().br(d.mes.fecha)), msg().c1texto(v.length, termos));
    item(conf, dadas > 0, msg().c2(dadas, d.mes.cotas_recebidas || 0), '');
    item(conf, o.naGrade() >= dadas && dadas > 0, msg().c3(o.naGrade(), dadas), '');
    var falta = RW.extrajornadaMontar ? RW.extrajornadaMontar.diasComFalta(d) : [];
    item(conf, !falta.length, falta.length ? msg().c4(falta.length) : msg().c4ok, falta.slice(0, 6).join(', ') + (falta.length > 6 ? '…' : ''));
    var lanc = d.lancamento;
    qp('#p4-titulo').textContent = lanc ? msg().lancadoTitulo(lanc.lancado_em, lanc.por || '') : msg().aoLancar;
    if (!lanc) { qp('#p4-texto').textContent = msg().lancarTexto(d.alocacoes.length); return; }
    /* lançada do jeito antigo e reaberta: o que mudou depois do lançamento ainda não está na escala */
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
    /* lançar põe as extras na escala e a refaz: o cartão das etapas na hora; os dias seguintes, o banco refaz sozinho */
    var espera = RW.etapas.acao('extraLancar', null, { doServidor: 2, botao: btn });
    RW.rpc('extrajornada_lancar', { p_competencia: d.competencia }).then(function (r) {
      espera.parar();
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.painel.fechar();
      org().resumo(r);
      org().recarregar();
    }, function () { espera.parar(); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* liga os botões (uma vez por página) */
  function ligar(conteudo) {
    el = conteudo;
    q('#p1-fechar').addEventListener('click', fecharPedidos);
    q('#p3-lancar').addEventListener('click', abrirLancar);
    q('#p3-encerrar').addEventListener('click', encerrar);
    q('#p3-reabrir').addEventListener('click', reabrir);
  }

  RW.extrajornadaAcoes = {
    ligar: ligar,
    atualizar: atualizar,
    /* o passo aberto na barra (extrajornada.js) */
    passo: function (n) { passoAtual = n; atualizar(); },
    /* o mês na tela foi lido (ou começou a ser lido de novo) */
    mesPronto: function (pronto) { mesPronto = !!pronto; atualizar(); },
    cotasFaltando: cotasFaltando
  };
})();
