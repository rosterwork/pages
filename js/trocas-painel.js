/* ============================================================
   TROCAS — painel lateral da troca (componente geral-decisao)
   O pedido em caixas (Serviço e Devolução: o dia com o horário,
   quem trabalha no lugar de quem e a régua), a análise vinda do
   banco (geral-impacto: uma nota por ponto), o "Como fica a escala"
   (fechado; o dia inteiro só ao abrir) e o rodapé só com as ações
   do papel/estado de quem olha.
   Recusar (do militar chamado ou da administração) pede o motivo
   opcional no próprio painel. Usado na Trocas e na Pendências.
   Expõe: RosterWork.trocasPainel.abrir(troca, ctx).
   ctx = { cpf, ehAdmin, posicao?: { n, total }, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var trocaAtual = null;
  var partes = null;       // as partes do painel aberto (geral-decisao)
  var btnAprovar = null;   // botão Aprovar da troca aberta: fica travado até a análise de impacto chegar

  function fmt() { return RW.trocasFormato; }
  function msg() { return RW.mensagens.trocas; }

  /* o trecho { hi, hf } ("HH:MM"); sem horário = o serviço inteiro, 08h às 08h */
  function trecho(hi, hf) {
    return hi && hf ? { hi: String(hi).slice(0, 5), hf: String(hf).slice(0, 5) } : { hi: '08:00', hf: '08:00' };
  }

  /* uma perna da troca: o dia, o horário, quem trabalha no lugar de quem e a régua */
  function caixaPerna(titulo, iso, hi, hf, quemTrabalha, quemFolga) {
    var t = trecho(hi, hf);
    return RW.decisao.caixa({
      titulo: titulo,
      data: RW.data.comDiaSemana(iso),
      hi: t.hi, hf: t.hf,
      frase: msg().fraseNoLugar(quemTrabalha, quemFolga),
      regua: { servico: { hi: '08:00', hf: '08:00' }, trecho: t }
    });
  }

  /* ---------- corpo: o pedido em caixas ---------- */
  function montarCorpo(troca) {
    partes = RW.decisao.montar(RW.painel.corpo());
    if (!partes) return;
    var m = msg();
    var sol = fmt().nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    var par = fmt().nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);
    var servico = caixaPerna(m.caixaServico, troca.data_servico_solicitante, troca.horario_inicio, troca.horario_fim, par, sol);
    if (servico) partes.pedido.appendChild(servico);
    var devolucao = troca.data_servico_parceiro
      ? caixaPerna(m.caixaDevolucao, troca.data_servico_parceiro, troca.devolucao_horario_inicio, troca.devolucao_horario_fim, sol, par)
      : RW.decisao.caixa({ titulo: m.caixaDevolucao, frase: m.devolucaoNaoMarcada });
    if (devolucao) partes.pedido.appendChild(devolucao);
  }

  /* ---------- análise (o desenho fica no componente compartilhado geral-impacto) ---------- */
  function carregarAnalise(troca) {
    var minhas = partes;
    if (!minhas) return;
    RW.decisao.analisando(minhas);
    RW.trocasDados.analisar(troca.troca_id).then(function (r) {
      if (!RW.painel.estaAberto() || trocaAtual !== troca) return;
      if (btnAprovar) btnAprovar.disabled = false;   // análise chegou: libera o Aprovar
      if (r && r.ok) troca._analise = r;
      RW.decisao.analise(minhas, r && r.ok ? r : null, msg().falhaAnalise);
    }).catch(function () {
      if (!RW.painel.estaAberto() || trocaAtual !== troca) return;
      if (btnAprovar) btnAprovar.disabled = false;   // falhou a análise: libera o Aprovar (o banco ainda decide)
      RW.decisao.analise(minhas, null, msg().falhaAnalise);
    });
  }

  /* ---------- ações ---------- */
  function confirmarEntao(mensagem, perigo, aoConfirmar) {
    if (!RW.confirmar) { aoConfirmar(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: mensagem, confirmarPerigo: !!perigo, aoConfirmar: aoConfirmar });
  }

  /* recalcula=true (aprovar/cancelar mexem na escala) usa o véu global; senão (aceitar/recusar
     não mexem na escala) são rápidos: pontinhos no botão */
  function executar(promessa, btn, ctx, extra, recalcula) {
    if (recalcula) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
    else if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    function parar() { if (recalcula) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (btn && RW.pararCarregando) RW.pararCarregando(btn); }
    promessa.then(function (r) {
      parar();
      if (r && r.ok) {
        RW.painel.fechar();
        if (ctx && ctx.aoMudar) ctx.aoMudar();
        if (r.log && RW.resumo) {
          var op = { pagina: 'Trocas' };
          if (extra && extra.desfazer) op.desfazer = extra.desfazer;
          RW.resumo.abrirModal(r.log, op);
        }
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || msg().falhaAcao });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* Desfazer de uma aprovação = cancelar a troca aprovada (reverte a escala e redistribui) */
  function desfazerAprovacao(troca, ctx) {
    var d = RW.trocasDados;
    return function () {
      if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o desfazer cancela a troca e recalcula a escala: véu global
      return d.cancelar(troca.troca_id).then(function (res) {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (res && res.ok && ctx.aoMudar) ctx.aoMudar();
        return res;
      }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
    };
  }

  function despachar(acao, troca, ctx, btn) {
    var d = RW.trocasDados;
    var m = msg();
    if (acao === 'aceitar') {
      confirmarEntao(m.confirmarAceitar, false, function () { executar(d.confirmar(troca.troca_id, true), btn, ctx); });
    } else if (acao === 'recusar') {
      /* o militar chamado recusa: o motivo (opcional) vai no aviso a quem pediu */
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.confirmar(troca.troca_id, false, motivo), botao, ctx); });
    } else if (acao === 'aprovar') {
      var temProblema = troca._analise && troca._analise.veredito === 'problema';
      confirmarEntao(temProblema ? m.confirmarAprovarComProblema : m.confirmarAprovar, temProblema, function () {
        executar(d.aprovar(troca.troca_id, true), btn, ctx, { desfazer: desfazerAprovacao(troca, ctx) }, true);   // aprovar recalcula a escala → véu
      });
    } else if (acao === 'aprovar-forcar') {
      confirmarEntao(m.confirmarForcar, true, function () {
        executar(d.aprovar(troca.troca_id, true, true), btn, ctx, { desfazer: desfazerAprovacao(troca, ctx) }, true);   // força também recalcula a escala → véu
      });
    } else if (acao === 'recusar-admin') {
      /* a administração recusa: o motivo (opcional) vai no aviso aos dois */
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.aprovar(troca.troca_id, false, false, motivo), botao, ctx); });
    } else if (acao === 'cancelar') {
      confirmarEntao(m.confirmarCancelar, true, function () { executar(d.cancelar(troca.troca_id), btn, ctx, null, true); });   // cancelar reverte a escala → véu
    }
  }

  function montarAcoes(troca, ctx) {
    var rodape = RW.painel.rodape();
    if (!rodape) return;
    rodape.textContent = '';
    var tpl = document.getElementById('tpl-troca-acoes');
    if (!tpl) return;
    var frag = tpl.content.cloneNode(true);
    btnAprovar = null;

    var souParceiro = ctx.cpf && ctx.cpf === troca.parceiro_cpf;
    var souSolicitante = ctx.cpf && ctx.cpf === troca.solicitante_cpf;
    var usar = {};
    if (troca.status === 'pendente_confirmacao') {
      if (souParceiro) { usar.aceitar = true; usar.recusar = true; }
      if (souSolicitante) usar.cancelar = true;
      if (ctx.ehAdmin && !souSolicitante && !souParceiro) usar['aprovar-forcar'] = true;   /* admin aprova sem esperar o solicitado, mas não uma troca da qual participa (o banco também trava) */
    } else if (troca.status === 'pendente_aprovacao') {
      if (ctx.ehAdmin && !souSolicitante && !souParceiro) { usar.aprovar = true; usar['recusar-admin'] = true; }   /* quem participa não decide (o banco também trava) */
      if (souSolicitante) usar.cancelar = true;
    } else if (troca.status === 'aprovada' && ctx.ehAdmin) {
      usar.cancelar = true;
    }

    ['aceitar', 'recusar', 'aprovar-forcar', 'aprovar', 'recusar-admin', 'cancelar'].forEach(function (acao) {
      var btn = frag.querySelector('[data-acao="' + acao + '"]');
      if (!btn) return;
      if (!usar[acao]) { if (btn.parentNode) btn.parentNode.removeChild(btn); return; }
      btn.addEventListener('click', function () { despachar(acao, troca, ctx, btn); });
      /* Aprovar depende da análise (aviso "pode quebrar a escala"): trava até ela chegar */
      if (acao === 'aprovar') { btnAprovar = btn; btn.disabled = true; }
    });

    rodape.appendChild(frag);
    /* o rodapé nasce escondido (geral-painel.limparConteudo); reexibe quando há ação, esconde quando não há */
    rodape.classList.toggle('oculto', rodape.children.length === 0);
  }

  /* ---------- abrir ---------- */
  function abrir(troca, ctx) {
    if (!RW.painel || !troca) return;
    ctx = ctx || {};
    var situacao = fmt().situacao(troca.status).texto;
    RW.painel.abrir({
      titulo: msg().painelTitulo,
      subtitulo: ctx.posicao ? RW.mensagens.decisao.posicao(situacao, ctx.posicao.n, ctx.posicao.total) : situacao,
      aoFechar: function () { trocaAtual = null; partes = null; if (ctx.aoFechar) ctx.aoFechar(); }
    });
    /* depois do abrir: reabrir outra troca por cima dispara o aoFechar anterior
       (que zera trocaAtual) dentro do abrir — setar aqui preserva a troca nova */
    trocaAtual = troca;
    montarCorpo(troca);
    montarAcoes(troca, ctx);
    if (troca.status === 'pendente_confirmacao' || troca.status === 'pendente_aprovacao') {
      carregarAnalise(troca);
      /* o dia inteiro como fica: fechado; só lê se abrirem */
      RW.decisao.escala(partes, function () { return RW.rpc('pedido_escala_comparar', { p_tipo: 'troca', p_id: troca.troca_id }); });
    } else if (partes) {
      partes.analise.classList.add('oculto');
    }
  }

  RW.trocasPainel = { abrir: abrir };
})();
