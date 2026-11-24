/* ============================================================
   FOLGAS — painel de aprovação de uma folga (geral-decisao)
   O pedido numa caixa (o dia com o horário, quem folga, a régua e
   o motivo), a Análise (geral-impacto, com a nota do saldo depois
   das notas da escala, quando a lista traz o saldo), o "Como fica a
   escala" (fechado; o dia inteiro só ao abrir) e o rodapé
   Recusar/Aprovar. Recusar pede o motivo opcional no próprio
   painel. Espelha o trocas-painel.js. Aprovar recalcula (véu) e
   oferece Desfazer. Abre pela fila (geral-fila) da página
   Pendências e da aba Pendências da Folgas.
   Expõe: RosterWork.folgasAprovacaoPainel.abrir(solicitacao, ctx) e
   acao(nome, solicitacao, ctx, botao): as mesmas ações fora do painel
   (o cartão que abre ali mesmo), com o Cancelar da folga pendente
   que o próprio militar pediu.
   ctx = { cpf, admin, posicao?: { n, total }, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var solAtual = null;
  var partes = null;       // as partes do painel aberto (geral-decisao)
  var btnAprovar = null;   // botão Aprovar da solicitação aberta: travado até a análise de impacto chegar

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }

  /* ---------- corpo: o pedido numa caixa e a nota do saldo ---------- */
  function montarCorpo(sol) {
    partes = RW.decisao.montar(RW.painel.corpo());
    if (!partes) return;
    var m = msg(), H = RW.horario;
    /* sem horário (ou início = fim) = o serviço inteiro, 08h às 08h */
    var parcial = sol.horario_inicio && sol.horario_fim && sol.horario_inicio !== sol.horario_fim;
    var t = parcial ? { hi: String(sol.horario_inicio).slice(0, 5), hf: String(sol.horario_fim).slice(0, 5) } : { hi: '08:00', hf: '08:00' };
    var caixa = RW.decisao.caixa({
      titulo: m.caixaFolga,
      data: RW.data.comDiaSemana(sol.data_ref),
      hi: t.hi, hf: t.hf,
      frase: parcial ? m.fraseFolgaParte(sol.nome || '', H.curta(t.hi), H.curta(t.hf)) : m.fraseFolgaInteira(sol.nome || ''),
      regua: { servico: { hi: '08:00', hf: '08:00' }, trecho: t },
      extra: sol.motivo ? m.motivoPedido(sol.motivo) : ''
    });
    if (caixa) partes.pedido.appendChild(caixa);
    /* quanto a folga consome e como o saldo fica (a mesma nota do Solicitar folga) */
    if (sol.saldo_minutos != null) {
      var ficaria = sol.saldo_minutos - (sol.minutos || 0);
      RW.decisao.saldo(partes, m.consumoSaldo(fmt().horasAbs(sol.minutos || 0), fmt().saldoTexto(ficaria)), ficaria < 0);
    }
  }

  /* ---------- análise de impacto (desenho no componente compartilhado geral-impacto) ---------- */
  function carregarAnalise(sol) {
    var minhas = partes;
    if (!minhas) return;
    RW.decisao.analisando(minhas, 'folgaAnalisar');
    RW.folgasDados.analisar(sol.id).then(function (r) {
      if (!RW.painel.estaAberto() || solAtual !== sol) return;
      if (btnAprovar) btnAprovar.disabled = false;   // análise chegou: libera o Aprovar
      if (r && r.ok) sol._analise = r;
      RW.decisao.analise(minhas, r && r.ok ? r : null, msg().falhaAnalise);
    }).catch(function () {
      if (!RW.painel.estaAberto() || solAtual !== sol) return;
      if (btnAprovar) btnAprovar.disabled = false;   // falhou a análise: libera o Aprovar (o banco ainda decide)
      RW.decisao.analise(minhas, null, msg().falhaAnalise);
    });
  }

  /* ---------- ações ---------- */
  function confirmarEntao(mensagem, perigo, aoConfirmar) {
    if (!RW.confirmar) { aoConfirmar(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: mensagem, confirmarPerigo: !!perigo, aoConfirmar: aoConfirmar });
  }

  /* o dia do pedido em dd/mm, para as etapas */
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* aprovar recalcula a escala: o cartão das etapas na hora; recusar e cancelar o pedido não mexem: os pontinhos no botão
     na hora e o cartão só se passar de 1,5 s. frase = { chave, valores } (RosterWork.mensagens.etapas) */
  function executar(promessa, btn, ctx, extra, recalcula, frase) {
    var espera = recalcula
      ? RW.etapas.acao(frase.chave, frase.valores, { doServidor: 3 })
      : RW.etapas.acao(frase.chave, frase.valores, { doServidor: 1, botao: btn, atraso: true });
    function parar() { espera.parar(); }
    promessa.then(function (r) {
      parar();
      if (r && r.success) {
        RW.painel.fechar();
        if (ctx && ctx.aoMudar) ctx.aoMudar();
        if (r.log && RW.resumo) {
          var op = { pagina: 'Folgas' };
          if (extra && extra.desfazer) op.desfazer = extra.desfazer;
          RW.resumo.abrirModal(r.log, op);
        }
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaAcao });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function despachar(acao, sol, ctx, btn) {
    var d = RW.folgasDados, m = msg();
    if (acao === 'recusar') {
      /* o motivo (opcional) vai no aviso ao militar */
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.decidir(sol.id, false, motivo), botao, ctx, null, false, { chave: 'folgaRecusar' }); });
    } else if (acao === 'aprovar') {
      var temProblema = sol._analise && sol._analise.veredito === 'problema';
      confirmarEntao(temProblema ? m.confirmarAprovarComProblema : m.confirmarAprovar, temProblema, function () {
        executar(d.decidir(sol.id, true), btn, ctx, {
          /* Desfazer = cancelar a folga aprovada (o militar volta ao serviço e as horas voltam) */
          desfazer: function () {
            /* o desfazer cancela a folga e recalcula a escala: o cartão das etapas na hora */
            var espera = RW.etapas.acao('folgaCancelar', { dia: diaMes(sol.data_ref) }, { doServidor: 3 });
            return d.cancelar(sol.id).then(function (res) {
              espera.parar();
              if (res && res.success && ctx.aoMudar) ctx.aoMudar();
              return { ok: !!(res && res.success), erro: res && res.error };   // o geral-resumo espera {ok,erro}, não {success,error}
            }).catch(function (e) { espera.parar(); throw e; });
          }
        }, true, { chave: 'folgaAprovar', valores: { militar: sol.nome || '', dia: diaMes(sol.data_ref) } });   // aprovar recalcula a escala
      });
    } else if (acao === 'cancelar') {
      /* o militar cancela a própria folga pendente (ainda fora da escala: os pontinhos no botão) */
      confirmarEntao(m.confirmarCancelarPendente, true, function () { executar(d.cancelar(sol.id), btn, ctx, null, false, { chave: 'folgaCancelarPedido' }); });
    }
  }

  function montarAcoes(sol, ctx) {
    var rodape = RW.painel.rodape(); if (!rodape) return;
    rodape.textContent = '';
    btnAprovar = null;
    /* decide o admin do militar (inclusive a própria folga); o banco confere de novo */
    if (!(ctx.admin && RosterWork.sessao.podeAdministrar('pelotao', sol.lotacao_atual))) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-decisao-acoes');
    if (!tpl) return;
    var frag = tpl.content.cloneNode(true);   /* fragmento inteiro (dois botões irmãos), não firstElementChild */
    ['recusar', 'aprovar'].forEach(function (acao) {
      var btn = frag.querySelector('[data-acao="' + acao + '"]');
      if (!btn) return;
      btn.addEventListener('click', function () { despachar(acao, sol, ctx, btn); });
      if (acao === 'aprovar') { btnAprovar = btn; btn.disabled = true; }   // Aprovar depende da análise: trava até ela chegar
    });
    rodape.appendChild(frag);
    rodape.classList.toggle('oculto', rodape.children.length === 0);
  }

  /* ---------- abrir ---------- */
  function abrir(sol, ctx) {
    if (!RW.painel || !sol) return;
    ctx = ctx || {};
    var situacao = msg().painelPendente;
    RW.painel.abrir({
      titulo: msg().painelFolga,
      tituloExtra: RW.mensagens.decisao.tituloPelotao(sol.pelotoes),
      subtitulo: ctx.posicao ? RW.mensagens.decisao.posicao(situacao, ctx.posicao.n, ctx.posicao.total) : situacao,
      aoFechar: function () { solAtual = null; partes = null; if (ctx.aoFechar) ctx.aoFechar(); }
    });
    solAtual = sol;
    montarCorpo(sol);
    montarAcoes(sol, ctx);
    carregarAnalise(sol);
    /* o dia inteiro como fica: fechado; só lê se abrirem */
    RW.decisao.escala(partes, function () { return RW.rpc('pedido_escala_comparar', { p_tipo: 'folga', p_id: sol.id }); });
  }

  RW.folgasAprovacaoPainel = { abrir: abrir, acao: despachar };
})();
