/* ============================================================
   TROCAS — painel lateral de detalhe + análise de impacto
   Abre o geral-painel com: quem troca, dados do serviço e a
   análise (veredito + avisos + antes/depois, vinda do banco).
   O rodapé mostra só as ações do papel/estado de quem olha.
   Expõe: RosterWork.trocasPainel.abrir(troca, ctx).
   ctx = { cpf, ehAdmin, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var trocaAtual = null;
  var btnAprovar = null;   // botão Aprovar da troca aberta: fica travado até a análise de impacto chegar

  function fmt() { return RW.trocasFormato; }

  function estado(texto) {
    return RW.painel.criarEstado ? RW.painel.criarEstado(texto) : null;
  }

  function carregandoEm(alvo) {
    var pts = document.getElementById('carregando-pontos');
    if (pts) alvo.appendChild(pts.content.cloneNode(true));
  }

  /* ---------- corpo ---------- */
  function montarCorpo(troca) {
    var corpo = RW.painel.corpo();
    if (!corpo) return;
    corpo.textContent = '';
    var tpl = document.getElementById('tpl-troca-detalhe');
    if (!tpl) return;
    var det = tpl.content.cloneNode(true).firstElementChild;

    det.querySelector('[data-sol-nome]').textContent = fmt().nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    det.querySelector('[data-par-nome]').textContent = fmt().nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);

    var m = RW.mensagens.trocas;
    var servico = det.querySelector('[data-servico]');
    servico.appendChild(RW.painel.criarLinha(m.linhaDia, fmt().dataLonga(troca.data_servico_solicitante)));
    servico.appendChild(RW.painel.criarLinha(m.linhaHorario, fmt().horario(troca)));
    servico.appendChild(RW.painel.criarLinha(m.linhaDevolucao,
      troca.data_servico_parceiro ? fmt().dataLonga(troca.data_servico_parceiro) : m.devolucaoPendente));

    corpo.appendChild(det);
  }

  /* ---------- análise (o desenho fica no componente compartilhado geral-impacto) ---------- */
  function carregarAnalise(troca) {
    var corpo = RW.painel.corpo();
    if (!corpo) return;
    var sec = corpo.querySelector('[data-secao-analise]');
    var alvo = corpo.querySelector('[data-analise]');
    if (!sec || !alvo) return;
    sec.classList.remove('oculto');
    alvo.textContent = '';
    carregandoEm(alvo);

    RW.trocasDados.analisar(troca.troca_id).then(function (r) {
      if (!RW.painel.estaAberto() || trocaAtual !== troca) return;
      if (btnAprovar) btnAprovar.disabled = false;   // análise chegou: libera o Aprovar
      if (!r || !r.ok) {
        alvo.textContent = '';
        var e = estado(RW.mensagens.trocas.falhaAnalise);
        if (e) alvo.appendChild(e);
        return;
      }
      troca._analise = r;
      if (RW.impacto) RW.impacto.desenhar(alvo, r);
    }).catch(function () {
      if (!RW.painel.estaAberto() || trocaAtual !== troca) return;
      if (btnAprovar) btnAprovar.disabled = false;   // falhou a análise: libera o Aprovar (o banco ainda decide)
      alvo.textContent = '';
      var e = estado(RW.mensagens.trocas.falhaAnalise);
      if (e) alvo.appendChild(e);
    });
  }

  /* ---------- ações ---------- */
  function confirmarEntao(mensagem, perigo, aoConfirmar) {
    if (!RW.confirmar) { aoConfirmar(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: mensagem, confirmarPerigo: !!perigo, aoConfirmar: aoConfirmar });
  }

  /* recalcula=true (aprovar/cancelar mexem na escala) usa o véu global; senão (aceitar/recusar/
     rejeitar não mexem na escala) são rápidos: pontinhos no botão */
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
        RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.trocas.falhaAcao });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function despachar(acao, troca, ctx, btn) {
    var d = RW.trocasDados;
    var m = RW.mensagens.trocas;
    if (acao === 'aceitar') {
      confirmarEntao(m.confirmarAceitar, false, function () { executar(d.confirmar(troca.troca_id, true), btn, ctx); });
    } else if (acao === 'recusar') {
      confirmarEntao(m.confirmarRecusar, true, function () { executar(d.confirmar(troca.troca_id, false), btn, ctx); });
    } else if (acao === 'aprovar') {
      var temProblema = troca._analise && troca._analise.veredito === 'problema';
      confirmarEntao(temProblema ? m.confirmarAprovarComProblema : m.confirmarAprovar, temProblema, function () {
        executar(d.aprovar(troca.troca_id, true, ctx.cpf), btn, ctx, {
          /* Desfazer = cancelar a troca aprovada (reverte a escala e redistribui) */
          desfazer: function () {
            if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o desfazer cancela a troca e recalcula a escala: véu global
            return d.cancelar(troca.troca_id, ctx.cpf).then(function (res) {
              if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
              if (res && res.ok && ctx.aoMudar) ctx.aoMudar();
              return res;
            }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
          }
        }, true);   // aprovar recalcula a escala → véu
      });
    } else if (acao === 'aprovar-forcar') {
      confirmarEntao(m.confirmarForcar, true, function () {
        executar(d.aprovar(troca.troca_id, true, ctx.cpf, true), btn, ctx, {
          /* Desfazer = cancelar a troca aprovada (reverte a escala e redistribui) */
          desfazer: function () {
            if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o desfazer cancela a troca e recalcula a escala: véu global
            return d.cancelar(troca.troca_id, ctx.cpf).then(function (res) {
              if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
              if (res && res.ok && ctx.aoMudar) ctx.aoMudar();
              return res;
            }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
          }
        }, true);   // força também recalcula a escala → véu
      });
    } else if (acao === 'rejeitar') {
      confirmarEntao(m.confirmarRejeitar, true, function () { executar(d.aprovar(troca.troca_id, false, ctx.cpf), btn, ctx); });
    } else if (acao === 'cancelar') {
      confirmarEntao(m.confirmarCancelar, true, function () { executar(d.cancelar(troca.troca_id, ctx.cpf), btn, ctx, null, true); });   // cancelar reverte a escala → véu
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
      if (ctx.ehAdmin && !souSolicitante) usar['aprovar-forcar'] = true;   /* admin aprova sem esperar o solicitado, mas não a própria troca (o banco também trava) */
    } else if (troca.status === 'pendente_aprovacao') {
      if (ctx.ehAdmin && !souSolicitante) { usar.aprovar = true; usar.rejeitar = true; }
      if (souSolicitante) usar.cancelar = true;
    } else if (troca.status === 'aprovada' && ctx.ehAdmin) {
      usar.cancelar = true;
    }

    ['aceitar', 'recusar', 'aprovar-forcar', 'aprovar', 'rejeitar', 'cancelar'].forEach(function (acao) {
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
    RW.painel.abrir({
      titulo: 'Troca',
      subtitulo: fmt().situacao(troca.status).texto,
      aoFechar: function () { trocaAtual = null; if (ctx && ctx.aoFechar) ctx.aoFechar(); }
    });
    /* depois do abrir: reabrir outra troca por cima dispara o aoFechar anterior
       (que zera trocaAtual) dentro do abrir — setar aqui preserva a troca nova */
    trocaAtual = troca;
    montarCorpo(troca);
    montarAcoes(troca, ctx);
    if (troca.status === 'pendente_confirmacao' || troca.status === 'pendente_aprovacao') {
      carregarAnalise(troca);
    }
  }

  RW.trocasPainel = { abrir: abrir };
})();
