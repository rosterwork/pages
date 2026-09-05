/* ============================================================
   FOLGAS — painel lateral de aprovação de uma solicitação
   Abre o geral-painel com: detalhe da folga (militar, dia, trecho,
   motivo), a análise de impacto na escala (componente compartilhado
   geral-impacto) e o rodapé com Aprovar/Recusar. Espelha o
   trocas-painel.js. Aprovar recalcula (véu) e oferece Desfazer.
   Expõe: RosterWork.folgasAprovacaoPainel.abrir(solicitacao, ctx).
   ctx = { cpf, admin, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var solAtual = null;
  var btnAprovar = null;   // botão Aprovar da solicitação aberta: travado até a análise de impacto chegar

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }
  function hh(t) {
    if (!t) return '';
    var s = String(t).slice(0, 5);   // normaliza p/ HH:MM (o banco pode mandar HH:MM:SS)
    return s.slice(3) === '00' ? s.slice(0, 2) + 'h' : s;
  }
  function trechoTexto(sol) {
    if (!sol.horario_inicio || !sol.horario_fim || sol.horario_inicio === sol.horario_fim) return msg().diaInteiro;
    return hh(sol.horario_inicio) + ' às ' + hh(sol.horario_fim);
  }
  function carregandoEm(alvo) {
    var pts = document.getElementById('carregando-pontos');
    if (pts) alvo.appendChild(pts.content.cloneNode(true));
  }

  /* ---------- corpo (detalhe) ---------- */
  function montarCorpo(sol) {
    var corpo = RW.painel.corpo(); if (!corpo) return;
    corpo.textContent = '';
    var det = RosterWork.tpl('tpl-folga-detalhe'); if (!det) return;
    var m = msg();
    var nome = det.querySelector('[data-nome]'); if (nome) nome.textContent = sol.nome || '';
    var linhas = det.querySelector('[data-linhas]');
    if (linhas) {
      linhas.appendChild(RW.painel.criarLinha(m.linhaDia, fmt().dataLonga(sol.data_ref)));
      linhas.appendChild(RW.painel.criarLinha(m.linhaTrecho, trechoTexto(sol)));
      linhas.appendChild(RW.painel.criarLinha(m.linhaHoras, fmt().horasAbs(sol.minutos)));
      if (sol.motivo) linhas.appendChild(RW.painel.criarLinha(m.linhaMotivo, sol.motivo));
    }
    corpo.appendChild(det);
  }

  /* ---------- análise de impacto (desenho no componente compartilhado geral-impacto) ---------- */
  function carregarAnalise(sol) {
    var corpo = RW.painel.corpo(); if (!corpo) return;
    var sec = corpo.querySelector('[data-secao-analise]');
    var alvo = corpo.querySelector('[data-analise]');
    if (!sec || !alvo) return;
    sec.classList.remove('oculto');
    alvo.textContent = '';
    carregandoEm(alvo);
    RW.folgasDados.analisar(sol.id).then(function (r) {
      if (!RW.painel.estaAberto() || solAtual !== sol) return;
      if (btnAprovar) btnAprovar.disabled = false;   // análise chegou: libera o Aprovar
      if (!r || !r.ok) { alvo.textContent = ''; var e = RW.painel.criarEstado(msg().falhaAnalise); if (e) alvo.appendChild(e); return; }
      sol._analise = r;
      if (RW.impacto) RW.impacto.desenhar(alvo, r);
    }).catch(function () {
      if (!RW.painel.estaAberto() || solAtual !== sol) return;
      if (btnAprovar) btnAprovar.disabled = false;   // falhou a análise: libera o Aprovar (o banco ainda decide)
      alvo.textContent = '';
      var e = RW.painel.criarEstado(msg().falhaAnalise); if (e) alvo.appendChild(e);
    });
  }

  /* ---------- ações ---------- */
  function confirmarEntao(mensagem, perigo, aoConfirmar) {
    if (!RW.confirmar) { aoConfirmar(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: mensagem, confirmarPerigo: !!perigo, aoConfirmar: aoConfirmar });
  }

  /* aprovar recalcula a escala (véu global); recusar não mexe (pontos no botão) */
  function executar(promessa, btn, ctx, extra, recalcula) {
    if (recalcula) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
    else if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    function parar() { if (recalcula) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (btn && RW.pararCarregando) RW.pararCarregando(btn); }
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
      confirmarEntao(m.confirmarRecusar, true, function () { executar(d.decidir(sol.id, false, ctx.cpf), btn, ctx); });
    } else if (acao === 'aprovar') {
      var temProblema = sol._analise && sol._analise.veredito === 'problema';
      confirmarEntao(temProblema ? m.confirmarAprovarComProblema : m.confirmarAprovar, temProblema, function () {
        executar(d.decidir(sol.id, true, ctx.cpf), btn, ctx, {
          /* Desfazer = cancelar a folga aprovada (o militar volta ao serviço e as horas voltam) */
          desfazer: function () {
            if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o desfazer cancela a folga e recalcula a escala: véu global
            return d.cancelar(sol.id, ctx.cpf).then(function (res) {
              if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
              if (res && res.success && ctx.aoMudar) ctx.aoMudar();
              return { ok: !!(res && res.success), erro: res && res.error };   // o geral-resumo espera {ok,erro}, não {success,error}
            }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
          }
        }, true);   // aprovar recalcula a escala → véu
      });
    }
  }

  function montarAcoes(sol, ctx) {
    var rodape = RW.painel.rodape(); if (!rodape) return;
    rodape.textContent = '';
    btnAprovar = null;
    if (!ctx.admin || sol.is_meu) { rodape.classList.add('oculto'); return; }   // admin não decide a própria folga (o banco também trava)
    var tpl = document.getElementById('tpl-folga-aprovacao-acoes');
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
    RW.painel.abrir({
      titulo: msg().painelFolga,
      subtitulo: msg().painelPendente,
      aoFechar: function () { solAtual = null; if (ctx && ctx.aoFechar) ctx.aoFechar(); }
    });
    solAtual = sol;
    montarCorpo(sol);
    montarAcoes(sol, ctx);
    carregarAnalise(sol);
  }

  RW.folgasAprovacaoPainel = { abrir: abrir };
})();
