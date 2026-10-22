/* ============================================================
   TROCAS — Editar troca (no painel da troca, pelo botão Editar)
   O mesmo formulário do Solicitar (molde #tpl-troca-solicitar, modo
   "editar"): o solicitante e o solicitado só em leitura; mudam a
   parte do E-protocolo, o dia e o período do serviço e a devolução.
   Os campos vêm do trocas-solicitar-campos.js e as peças do
   formulário (modos, parte, erros) do trocas-solicitar.js.
   O banco (fn_trocas_editar) decide o caminho: só a parte grava na
   hora; a troca em aberto muda e volta para o aceite do outro; a
   aprovada vira uma alteração (aceite do outro e aprovação); o
   administrador de fora da troca altera direto, com a Análise antes
   de salvar (como no Registrar). O dia que já passou fica como está.
   Cancelar volta à leitura; com algo mudado, confirma o descarte.
   Expõe RosterWork.trocasEditar.{ abrir, guardaFechar, encerrar }.
     abrir(troca, { admin, aoSalvar(r) }) — admin = altera direto
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var ctx = null;            // o formulário aberto (o mesmo estado que o trocas-solicitar-campos.js usa)
  var guardaLigado = false;
  var timerAnalise = null;
  var reqAnalise = 0;        // token: ignora a análise antiga quando o pedido muda no meio

  function C() { return RW.trocasCampos; }
  function F() { return RW.trocasSolicitar.formulario; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }
  function q(sel) { return ctx && ctx.raiz ? ctx.raiz.querySelector(sel) : null; }
  function hhmm(t) { return t ? String(t).slice(0, 5) : null; }

  /* ---------- o pedido ---------- */
  function montarCorpo() {
    var serv = ctx.servicoSel, dev = ctx.devSel;
    var devDia = C().devMarcarDia() ? ctx.devDia : null;
    var parte = F().parteNumero(ctx.raiz);
    return {
      p_troca_id: ctx.troca.troca_id,
      p_data_servico_solicitante: ctx.servicoDia,
      p_horario_inicio: serv && !serv.total ? serv.hi : null,
      p_horario_fim: serv && !serv.total ? serv.hf : null,
      p_data_servico_parceiro: devDia || null,
      p_devolucao_horario_inicio: devDia && dev && !dev.total ? dev.hi : null,
      p_devolucao_horario_fim: devDia && dev && !dev.total ? dev.hf : null,
      p_parte_numero: parte,
      p_parte_ano: parte ? F().parteAno(ctx.raiz) : null   // sem a Parte, o Ano não vai
    };
  }
  /* o pedido mexe no dia, no horário ou na devolução (só aí a escala muda e a Análise faz sentido) */
  function mudaEscala() {
    var t = ctx.troca, c = montarCorpo();
    return c.p_data_servico_solicitante !== t.data_servico_solicitante
      || hhmm(c.p_horario_inicio) !== hhmm(t.horario_inicio) || hhmm(c.p_horario_fim) !== hhmm(t.horario_fim)
      || (c.p_data_servico_parceiro || null) !== (t.data_servico_parceiro || null)
      || hhmm(c.p_devolucao_horario_inicio) !== hhmm(t.devolucao_horario_inicio)
      || hhmm(c.p_devolucao_horario_fim) !== hhmm(t.devolucao_horario_fim);
  }
  function completo() {
    var devOk = !C().devMarcarDia() || (ctx.devDia && ctx.devSel && ctx.devSel.minutos > 0);
    return !!(ctx.servicoDia && ctx.servicoSel && ctx.servicoSel.minutos > 0 && devOk);
  }
  function validar() {
    var ok = F().validarParte(ctx.raiz), erro = C().marcarErro;
    if (!ctx.servicoDia) { erro(q('#ts-data'), txt('novaDataRegistrar')); ok = false; }
    else if (!ctx.servicoSel || ctx.servicoSel.minutos <= 0) { erro(q('#ts-data'), txt('novaServicoVazio')); ok = false; }
    if (C().devMarcarDia() && !ctx.devDia) { erro(q('#ts-dev-data'), txt('modalDevAjuda')); ok = false; }
    else if (ctx.devDia && ctx.devSel && ctx.devSel.minutos <= 0) { erro(q('#ts-dev-data'), txt('novaDevolucaoVazia')); ok = false; }
    return ok;
  }

  /* ---------- análise de impacto (só o administrador que altera direto, quando a escala muda) ---------- */
  function partesAnalise() {
    var s = q('#ts-analise');
    return s ? { analiseSecao: s, analiseSelo: s.querySelector('.decisao-analise-selo'), analise: s.querySelector('.decisao-analise'), saldo: null } : null;
  }
  function travarSalvar(travado) { if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = travado; }
  function agendarAnalise() {
    if (!ctx || !ctx.admin) return;
    if (timerAnalise) clearTimeout(timerAnalise);
    reqAnalise++;   // a análise anterior deixa de valer
    ctx.analise = null;
    var partes = partesAnalise();
    if (!partes) return;
    if (!completo() || !mudaEscala()) { partes.analiseSecao.classList.add('oculto'); travarSalvar(false); return; }
    travarSalvar(true);
    RW.decisao.analisando(partes);
    timerAnalise = setTimeout(analisar, 350);
  }
  function analisar() {
    if (!ctx) return;
    var req = ++reqAnalise, partes = partesAnalise(), corpo = montarCorpo();
    corpo.p_ensaio = true;
    RW.trocasDados.editar(corpo).then(function (r) {
      if (!ctx || req !== reqAnalise || !q('#ts-analise')) return;
      ctx.analise = r && r.ok ? r : null;
      RW.decisao.analise(partes, ctx.analise, (r && r.erro) || txt('falhaAnalise'));
      travarSalvar(false);   // chegou: libera o Salvar (o banco ainda decide)
    }).catch(function () {
      if (!ctx || req !== reqAnalise || !q('#ts-analise')) return;
      RW.decisao.analise(partes, null, txt('falhaAnalise'));
      travarSalvar(false);
    });
  }

  /* qualquer mudança no pedido (o preenchimento inicial não conta) */
  function aoMudar() {
    if (!ctx || ctx.preenchendo) return;
    ctx.mudou = true;
    agendarAnalise();
  }
  function temMudanca() { return !!ctx && ctx.mudou; }

  /* ---------- salvar, cancelar, encerrar ---------- */
  function salvar(btn) {
    if (!validar()) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    /* o administrador muda a escala da troca aprovada na hora: confirma antes, como no Registrar */
    if (ctx.admin && ctx.troca.status === 'aprovada' && mudaEscala() && RW.confirmar) {
      var temProblema = !!(ctx.analise && ctx.analise.veredito === 'problema');
      RW.confirmar({
        tipo: 'aviso', mensagem: temProblema ? txt('confirmarEditarComProblema') : txt('confirmarEditar'),
        confirmarPerigo: temProblema, aoConfirmar: function () { gravar(null, true); }
      });
      return;
    }
    gravar(btn, false);
  }
  /* comVeu: a escala é recalculada (véu global); senão, os pontinhos no botão */
  function gravar(btn, comVeu) {
    var meu = ctx;
    if (comVeu) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
    else if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    function parar() { if (comVeu) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (btn && RW.pararCarregando) RW.pararCarregando(btn); }
    RW.trocasDados.editar(montarCorpo()).then(function (r) {
      parar();
      if (r && r.ok) {
        var aoSalvar = meu.aoSalvar;
        encerrar();
        if (aoSalvar) aoSalvar(r);
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || txt('falhaAcao') });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }
  function confirmarDescarte(aoConfirmar) {
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }
  function voltarParaLeitura() { encerrar(); RW.painel.voltarParaLeitura(); }
  function cancelar() {
    if (!temMudanca() || !RW.confirmar) { voltarParaLeitura(); return; }
    confirmarDescarte(voltarParaLeitura);
  }
  /* o X e o Esc do painel durante a edição: segura o fechamento se houver algo mudado */
  function guardaFechar() {
    if (!temMudanca() || !RW.confirmar) return false;
    confirmarDescarte(function () { encerrar(); RW.painel.fechar(); });
    return true;
  }
  function encerrar() {
    if (timerAnalise) clearTimeout(timerAnalise);
    reqAnalise++;
    ctx = null;
  }

  /* ---------- preencher com a troca ---------- */
  /* o dia que não está entre os que ainda podem mudar (já passou): fica escrito, com o horário da troca */
  function diaFixo(campo, iso, periodo) {
    q(campo).value = RW.trocasFormato.dataNumerica(iso);
    periodo.definirServico({ hi: '08:00', hf: '08:00' });
  }
  function preencher() {
    var t = ctx.troca;
    if (C().servicoDoDia(ctx.meusServicos, t.data_servico_solicitante)) C().escolherDiaServico(C().dataDeIso(t.data_servico_solicitante));
    else { ctx.servicoDia = t.data_servico_solicitante; diaFixo('#ts-data', t.data_servico_solicitante, ctx.periodoServico); }
    if (t.horario_inicio && t.horario_fim) ctx.periodoServico.definirParte(hhmm(t.horario_inicio), hhmm(t.horario_fim));
    ctx.servicoSel = ctx.periodoServico.valor();

    if (t.data_servico_parceiro) {
      var marcarDia = q('#ts-dev-toggle [data-dev="dia"]');
      if (marcarDia) marcarDia.click();   // o seletor da devolução em "Marcar dia" (mostra o dia e o período)
      if (C().servicoDoDia(ctx.parceiroServicos, t.data_servico_parceiro)) C().escolherDiaDevolucao(C().dataDeIso(t.data_servico_parceiro));
      else {
        ctx.devDia = t.data_servico_parceiro;
        diaFixo('#ts-dev-data', t.data_servico_parceiro, ctx.periodoDevolucao);
        q('#ts-periodo-devolucao').classList.remove('oculto');
      }
      if (t.devolucao_horario_inicio && t.devolucao_horario_fim) ctx.periodoDevolucao.definirParte(hhmm(t.devolucao_horario_inicio), hhmm(t.devolucao_horario_fim));
      ctx.devSel = ctx.periodoDevolucao.valor();
    } else {
      var pendente = q('#ts-dev-toggle [data-dev="pendente"]');
      if (pendente) pendente.click();   // a troca sem devolução: o seletor em "Pendência" (o molde abre em "Marcar dia")
    }
    ctx.preenchendo = false;
    travarSalvar(false);
  }

  /* ---------- abrir ---------- */
  function abrir(troca, opcoes) {
    if (!RW.painel || !troca) return;
    opcoes = opcoes || {};
    if (!guardaLigado && RW.guardaSaida && RW.guardaSaida.registrar) { RW.guardaSaida.registrar(temMudanca); guardaLigado = true; }
    RW.painel.definirTitulos(txt('tituloEditar'));

    var corpo = RW.painel.corpo(); corpo.textContent = '';
    var molde = document.getElementById('tpl-troca-solicitar');
    if (molde) corpo.appendChild(molde.content.cloneNode(true));
    F().mostrarModo(corpo, 'editar');

    ctx = {
      raiz: corpo, troca: troca, admin: !!opcoes.admin, aoSalvar: opcoes.aoSalvar,
      registrar: false, cobrar: null, meusServicos: [], parceiroServicos: [],
      servicoDia: null, servicoCtx: troca.contexto_id, servicoSel: null, periodoServico: null, unidadeSel: null, parceiroSel: null,
      devDia: null, devSel: null, periodoDevolucao: null,
      analise: null, btnSalvar: null, preenchendo: true, mudou: false
    };
    C().iniciar(ctx, { aoMudarPedido: aoMudar });
    montarAcoes();
    travarSalvar(true);   // até os dias de serviço chegarem e o formulário ser preenchido

    q('#ts-meu-nome').textContent = RW.trocasFormato.nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    q('#ts-parceiro-nome').textContent = RW.trocasFormato.nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);
    q('#ts-parte').value = troca.parte_numero || '';
    q('#ts-parte-ano').value = troca.parte_ano ? String(troca.parte_ano) : String(new Date().getFullYear());
    F().ligarSoNumeros(q('#ts-parte'));
    F().ligarSoNumeros(q('#ts-parte-ano'));
    q('#ts-parte').addEventListener('input', aoMudar);
    q('#ts-parte-ano').addEventListener('input', aoMudar);
    F().ligarLimpezaErros(corpo);
    C().montarPeriodoServico();
    C().ligarDevToggle();

    if (RW.calendario) {
      RW.calendario.ligar(q('#ts-data'), {
        obterData: function () { return ctx && ctx.servicoDia ? C().dataDeIso(ctx.servicoDia) : new Date(); },
        permiteDia: function (d) { return !!ctx && !!C().servicoDoDia(ctx.meusServicos, C().isoDe(d)); },
        aoEscolher: C().escolherDiaServico
      });
      RW.calendario.ligar(q('#ts-dev-data'), {
        obterData: function () { return ctx && ctx.devDia ? C().dataDeIso(ctx.devDia) : new Date(); },
        permiteDia: function (d) { return !!ctx && !!C().servicoDoDia(ctx.parceiroServicos, C().isoDe(d)); },
        aoEscolher: C().escolherDiaDevolucao
      });
    }

    /* os dias de serviço dos dois como se esta troca não existisse (o administrador de fora vê até 7 dias atrás) */
    var meu = ctx;
    Promise.all([
      RW.trocasDados.meusServicos(troca.solicitante_cpf, null, ctx.admin, troca.troca_id),
      RW.trocasDados.meusServicos(troca.parceiro_cpf, null, ctx.admin, troca.troca_id)
    ]).then(function (r) {
      if (ctx !== meu) return;
      ctx.meusServicos = Array.isArray(r[0]) ? r[0] : [];
      ctx.parceiroServicos = Array.isArray(r[1]) ? r[1] : [];
      preencher();
    }).catch(function () { if (ctx === meu) preencher(); });
  }

  /* rodapé do painel: Cancelar (volta à leitura) / Salvar */
  function montarAcoes() {
    var rodape = RW.painel.rodape(); if (!rodape) return;
    rodape.textContent = ''; rodape.classList.remove('oculto');
    var tpl = document.getElementById('tpl-troca-editar-acoes'); if (!tpl) return;
    var frag = tpl.content.cloneNode(true);
    var bCancelar = frag.querySelector('[data-acao="cancelar"]');
    var bSalvar = frag.querySelector('[data-acao="salvar"]');
    if (bCancelar) bCancelar.addEventListener('click', cancelar);
    if (bSalvar) bSalvar.addEventListener('click', function () { salvar(bSalvar); });
    ctx.btnSalvar = bSalvar;
    rodape.appendChild(frag);
  }

  RW.trocasEditar = { abrir: abrir, guardaFechar: guardaFechar, encerrar: encerrar };
})();
