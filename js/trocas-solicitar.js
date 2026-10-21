/* ============================================================
   TROCAS — formulário Solicitar / Registrar (painel lateral)
   Solicitar: o logado pede (Solicitante em leitura), só dias
   futuros; o solicitado confirma (sem conta, vai direto para a
   aprovação). Registrar (só admin): escolhe o solicitante,
   aceita dias de até 7 dias atrás e grava a troca já aprovada,
   depois da análise de impacto (a mesma do Aprovar).
   Nos dois: o E-protocolo (Parte opcional; com ela, o Ano), o dia e
   o período do serviço, o solicitado e a devolução (Pendência
   ou Marcar dia). Os campos ficam em trocas-solicitar-campos.js;
   aqui ficam a abertura, os modos, o E-protocolo, a análise, a
   validação e o envio. Ações no rodapé do painel; o X/Esc
   confirmam o descarte quando há dados.
   Expõe RosterWork.trocasSolicitar.{ ligar, abrir, formulario }.
     ligar({ aoSolicitar, aoMudar }) — guarda os callbacks (1x)
     abrir(opcoes) — abre o painel e monta o formulário:
       {} = Solicitar · { registrar: true } = Registrar ·
       { cobrar: { cpf, nome, grau, minutos } } = Solicitar em
       modo cobrança (o devedor entra como parceiro e o período
       já nasce com as horas da dívida)
     formulario — as peças que o Editar troca (trocas-editar.js)
       usa no mesmo molde: mostrarModo, ligarSoNumeros, parteNumero,
       parteAno, validarParte, ligarLimpezaErros
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var guardaLigado = false;
  var ctx = null;
  var cbs = {};            // callbacks da página (aoSolicitar, aoMudar), guardados no ligar
  var aberto = false;      // painel aberto? (zera o temDados depois de fechar)
  var timerAnalise = null;
  var reqAnalise = 0;      // token: ignora a análise antiga quando o pedido muda no meio

  function C() { return RW.trocasCampos; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }
  function perfilLotacao() { var u = RosterWork.sessao.perfil(); return u ? u.lotacao_id : null; }
  function q(sel) { return ctx && ctx.raiz ? ctx.raiz.querySelector(sel) : null; }

  /* ---------- o formulário: os modos e o E-protocolo (o Editar troca usa os mesmos) ---------- */
  /* mostra só o que é do modo (data-modo traz os modos em que o campo aparece, separados por espaço) */
  function mostrarModo(raiz, modo) {
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-modo]'), function (el) {
      el.classList.toggle('oculto', el.getAttribute('data-modo').split(' ').indexOf(modo) < 0);
    });
  }
  function ligarSoNumeros(inp) {
    if (!inp) return;
    inp.addEventListener('input', function () { var v = inp.value.replace(/\D/g, ''); if (v !== inp.value) inp.value = v; });
  }
  function valorDe(raiz, sel) { var el = raiz ? raiz.querySelector(sel) : null; return el ? el.value || '' : ''; }
  function parteDigitada(raiz) { return valorDe(raiz, '#ts-parte').trim() !== ''; }
  function parteNumero(raiz) { var v = valorDe(raiz, '#ts-parte'); return /^\d{1,7}$/.test(v) && Number(v) > 0 ? Number(v) : null; }
  function parteAno(raiz) { var v = valorDe(raiz, '#ts-parte-ano'); return /^\d{4}$/.test(v) ? Number(v) : null; }
  /* a Parte é opcional; preenchida, precisa ser válida e levar o Ano */
  function validarParte(raiz) {
    var ok = true;
    if (parteDigitada(raiz) && !parteNumero(raiz)) { C().marcarErro(raiz.querySelector('#ts-parte'), txt('novaParte')); ok = false; }
    if (parteDigitada(raiz) && !parteAno(raiz)) { C().marcarErro(raiz.querySelector('#ts-parte-ano'), txt('novaAno')); ok = false; }
    return ok;
  }

  /* ---------- unidades (do grupo da lotação de quem está logado) ---------- */
  function carregarUnidades() {
    var meu = ctx;
    C().carregarGrupo(perfilLotacao()).then(function (grupo) {
      if (ctx !== meu || !q('#ts-unidade-menu')) return;   // painel fechado ou reaberto no meio
      var propria = C().preencherUnidades(q('#ts-unidade-menu'), q('#ts-unidade'), grupo, perfilLotacao(), function (u) {
        ctx.unidadeSel = u.unidade_id;
        C().carregarParceiros();
      });
      if (propria) ctx.unidadeSel = propria.unidade_id;
      if (!ctx.registrar) return;
      /* a unidade do solicitado acompanha a do solicitante (como no Solicitar, a mesma unidade); pode ser mudada depois */
      var propriaSol = C().preencherUnidades(q('#ts-sol-unidade-menu'), q('#ts-sol-unidade'), grupo, perfilLotacao(), function (u) {
        ctx.solUnidadeSel = u.unidade_id;
        ctx.unidadeSel = u.unidade_id;
        C().definirTexto(q('#ts-unidade'), u.nome, false);
        C().carregarSolicitantes();
        C().carregarParceiros();
      });
      if (propriaSol) { ctx.solUnidadeSel = propriaSol.unidade_id; C().carregarSolicitantes(); }
    });
  }

  /* ---------- análise de impacto (só no Registrar): roda quando o pedido está completo;
     o Registrar fica travado até ela chegar, igual ao Aprovar ---------- */
  function camposCompletos() {
    var devolucaoOk = !C().devMarcarDia() || (ctx.devDia && ctx.devSel && ctx.devSel.minutos > 0);
    return !!(ctx.solicitanteSel && ctx.servicoDia && ctx.servicoSel && ctx.servicoSel.minutos > 0 && ctx.parceiroSel && devolucaoOk);
  }
  function partesAnalise() {
    var s = q('#ts-analise');
    return s ? { analiseSecao: s, analiseSelo: s.querySelector('.decisao-analise-selo'), analise: s.querySelector('.decisao-analise'), saldo: null } : null;
  }
  function travarEnvio(travado) { if (ctx && ctx.registrar && ctx.btnEnviar) ctx.btnEnviar.disabled = travado; }
  function agendarAnalise() {
    if (!ctx || !ctx.registrar) return;
    if (timerAnalise) clearTimeout(timerAnalise);
    reqAnalise++;   // a análise anterior deixa de valer
    ctx.analise = null;
    var partes = partesAnalise();
    if (!partes) return;
    if (!camposCompletos()) { partes.analiseSecao.classList.add('oculto'); travarEnvio(false); return; }
    travarEnvio(true);
    RW.decisao.analisando(partes);
    timerAnalise = setTimeout(analisar, 350);
  }
  function analisar() {
    var req = ++reqAnalise, partes = partesAnalise();
    var corpo = montarCorpo();
    corpo.p_ensaio = true;
    RW.trocasDados.registrar(corpo).then(function (r) {
      if (req !== reqAnalise || !q('#ts-analise')) return;
      ctx.analise = r && r.ok ? r : null;
      RW.decisao.analise(partes, ctx.analise, (r && r.erro) || txt('falhaAnalise'));
      travarEnvio(false);   // chegou: libera o Registrar (o banco ainda decide)
    }).catch(function () {
      if (req !== reqAnalise || !q('#ts-analise')) return;
      RW.decisao.analise(partes, null, txt('falhaAnalise'));
      travarEnvio(false);
    });
  }

  /* ---------- validação e envio ---------- */
  function montarCorpo() {
    var servTotal = ctx.servicoSel.total;
    var devTotal = ctx.devSel ? ctx.devSel.total : true;
    var corpo = {
      p_contexto_id: ctx.servicoCtx,
      p_parceiro_cpf: ctx.parceiroSel.cpf,
      p_data_servico_solicitante: ctx.servicoDia,
      p_horario_inicio: servTotal ? null : ctx.servicoSel.hi,
      p_horario_fim: servTotal ? null : ctx.servicoSel.hf,
      p_data_servico_parceiro: ctx.devDia || null,
      p_devolucao_horario_inicio: (ctx.devDia && !devTotal) ? ctx.devSel.hi : null,
      p_devolucao_horario_fim: (ctx.devDia && !devTotal) ? ctx.devSel.hf : null,
      p_parte_numero: parteNumero(ctx.raiz),
      p_parte_ano: parteNumero(ctx.raiz) ? parteAno(ctx.raiz) : null   // sem a Parte, o Ano não vai
    };
    if (ctx.registrar) corpo.p_solicitante_cpf = ctx.solicitanteSel.cpf;
    return corpo;
  }
  function validar() {
    var ok = validarParte(ctx.raiz), erro = C().marcarErro;
    if (ctx.registrar && !ctx.solicitanteSel) { erro(q('#ts-solicitante'), txt('novaSolicitante')); ok = false; }
    if (!ctx.servicoDia) { erro(q('#ts-data'), ctx.registrar ? txt('novaDataRegistrar') : txt('novaData')); ok = false; }
    else if (!ctx.servicoSel || ctx.servicoSel.minutos <= 0) { erro(q('#ts-data'), txt('novaServicoVazio')); ok = false; }
    if (C().devMarcarDia() && !ctx.devDia) { erro(q('#ts-dev-data'), txt('modalDevAjuda')); ok = false; }
    else if (ctx.devDia && ctx.devSel && ctx.devSel.minutos <= 0) { erro(q('#ts-dev-data'), txt('novaDevolucaoVazia')); ok = false; }
    if (!ctx.parceiroSel) { erro(q('#ts-parceiro'), txt('novaParceiro')); ok = false; }
    if (ctx.parceiroSel && ctx.parceiroSel.cpf === C().cpfSolicitante()) { erro(q('#ts-parceiro'), txt('novaMesmaPessoa')); ok = false; }
    return ok;
  }
  function mostrarVeu() { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
  function esconderVeu() { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); }
  /* depois de gravar: fecha, recarrega a página e abre o resumo com o Desfazer (apaga a troca recém-criada
     por completo, como se nunca tivesse existido; a registrada também volta a escala, então usa o véu) */
  function concluir(r, depois, aoMudar, comVeu) {
    var trocaId = r.troca_id;
    if (RW.painel) RW.painel.fechar();
    if (depois) depois();
    if (!r.log || !RW.resumo) return;
    RW.resumo.abrirModal(r.log, {
      pagina: 'Trocas',
      desfazer: trocaId ? function () {
        if (comVeu) mostrarVeu();
        return RW.trocasDados.cancelar(trocaId, true).then(function (res) {
          if (comVeu) esconderVeu();
          if (res && res.ok && aoMudar) aoMudar();
          return res;
        }).catch(function (e) { if (comVeu) esconderVeu(); throw e; });
      } : null
    });
  }
  function enviar(btn) {
    if (!validar()) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    if (ctx.registrar) { confirmarRegistro(); return; }
    if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    var aoSolicitar = ctx.aoSolicitar, aoMudar = ctx.aoMudar;
    RW.trocasDados.solicitar(montarCorpo()).then(function (r) {
      if (btn && RW.pararCarregando) RW.pararCarregando(btn);
      if (r && r.ok) concluir(r, aoSolicitar, aoMudar, false);
      else if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || txt('falhaAcao') });
    }).catch(function () {
      if (btn && RW.pararCarregando) RW.pararCarregando(btn);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }
  /* Registrar: confirma (avisando quando a análise apontou problema) e grava já aprovada */
  function confirmarRegistro() {
    var temProblema = !!(ctx.analise && ctx.analise.veredito === 'problema');
    if (!RW.confirmar) { gravarRegistro(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: temProblema ? txt('confirmarRegistrarComProblema') : txt('confirmarRegistrar'),
      confirmarPerigo: temProblema, aoConfirmar: gravarRegistro
    });
  }
  function gravarRegistro() {
    var corpo = montarCorpo();
    corpo.p_ensaio = false;
    var aoMudar = ctx.aoMudar;
    mostrarVeu();   // grava e recalcula a escala: véu global
    RW.trocasDados.registrar(corpo).then(function (r) {
      esconderVeu();
      if (r && r.ok) concluir(r, aoMudar, aoMudar, true);
      else if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || txt('falhaAcao') });
    }).catch(function () {
      esconderVeu();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- estado, cancelar, reset ---------- */
  function temDados() {
    if (!aberto || !ctx) return false;
    var parte = q('#ts-parte');
    return !!(ctx.servicoDia || ctx.parceiroSel || ctx.solicitanteSel || (parte && parte.value.trim()));
  }
  function confirmarDescarte() {
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { if (RW.painel) RW.painel.fechar(); }
    });
  }
  /* fecha o painel; com dados digitados, confirma o descarte antes (mesmo aviso do X/Esc) */
  function cancelar() {
    if (!temDados() || !RW.confirmar) { if (RW.painel) RW.painel.fechar(); return; }
    confirmarDescarte();
  }
  /* o X e o Esc do painel passam por aqui: segura o fechamento se houver dados a descartar */
  function guardaFechar() {
    if (!temDados() || !RW.confirmar) return false;
    confirmarDescarte();
    return true;
  }
  /* o painel avisa ao fechar (X/Esc/Cancelar/sucesso): o formulário some, então marca fechado */
  function aoFecharReset() { aberto = false; }
  /* o formulário recém-montado: tudo vazio, o Ano no ano atual (pode ser mudado) */
  function prepararCampos() {
    q('#ts-parte-ano').value = String(new Date().getFullYear());
    C().montarPeriodoServico();   /* o período começa desligado */
    ctx.comboParceiro.habilitar(false);
    ctx.comboParceiro.definir(txt('modalDiaAntes'), true);
    if (!ctx.registrar) return;
    var data = q('#ts-data');
    data.disabled = true;   // no Registrar, o dia espera o solicitante
    data.placeholder = txt('modalSolicitanteAntes');
    ctx.comboSolicitante.habilitar(false);
    ctx.comboSolicitante.definir(txt('modalUnidadeAntes'), true);
  }

  /* ---------- abrir ---------- */
  function abrir(opcoes) {
    if (!RW.painel) return;
    var registrar = !!(opcoes && opcoes.registrar);
    RW.painel.abrir({ titulo: registrar ? txt('tituloRegistrar') : txt('tituloPainel'), aoFechar: aoFecharReset, aoTentarFechar: guardaFechar });

    var corpo = RW.painel.corpo(); corpo.textContent = '';
    var molde = document.getElementById('tpl-troca-solicitar');
    if (molde) corpo.appendChild(molde.content.cloneNode(true));
    /* mostra só o que é do modo (Solicitar: o logado em leitura; Registrar: escolher o solicitante) */
    mostrarModo(corpo, registrar ? 'registrar' : 'solicitar');

    ctx = {
      raiz: corpo, registrar: registrar, aoSolicitar: cbs.aoSolicitar, aoMudar: cbs.aoMudar,
      meusServicos: [], parceiroServicos: [],
      servicoDia: null, servicoCtx: null, servicoSel: null, periodoServico: null, unidadeSel: null, parceiroSel: null,
      solUnidadeSel: null, solicitanteSel: null,
      devDia: null, devSel: null, periodoDevolucao: null,
      saldoEntre: null, saldoCarregando: false, analise: null, btnEnviar: null,
      cobrar: (!registrar && opcoes && opcoes.cobrar) || null
    };
    aberto = true;
    C().iniciar(ctx, { aoMudarPedido: agendarAnalise });

    montarAcoes();

    ctx.comboParceiro = C().comboMilitar(q('#ts-parceiro'), q('#ts-parceiro-menu'), {
      atual: function () { return ctx.parceiroSel; },
      aoEscolher: function (mil) { ctx.parceiroSel = mil; C().aoTrocarParceiro(); },
      aoPerder: function () { ctx.parceiroSel = null; C().aoTrocarParceiro(); },
      ignorar: function () { return [RosterWork.sessao.cpf(), C().cpfSolicitante()]; }   // nem quem pede nem o admin que registra
    });
    if (registrar) {
      ctx.comboSolicitante = C().comboMilitar(q('#ts-solicitante'), q('#ts-solicitante-menu'), {
        atual: function () { return ctx.solicitanteSel; },
        aoEscolher: function (mil) { ctx.solicitanteSel = mil; C().aoTrocarSolicitante(); },
        aoPerder: function () { ctx.solicitanteSel = null; C().aoTrocarSolicitante(); },
        ignorar: function () { return [RosterWork.sessao.cpf()]; }   // quem participa não registra a própria troca
      });
    }

    if (RW.calendario) {
      RW.calendario.ligar(q('#ts-data'), {
        obterData: function () { return ctx.servicoDia ? C().dataDeIso(ctx.servicoDia) : (ctx.meusServicos[0] ? C().dataDeIso(ctx.meusServicos[0].data) : new Date()); },
        permiteDia: function (d) { return !!C().servicoDoDia(ctx.meusServicos, C().isoDe(d)); },
        aoEscolher: C().escolherDiaServico
      });
      RW.calendario.ligar(q('#ts-dev-data'), {
        obterData: function () { return ctx.devDia ? C().dataDeIso(ctx.devDia) : (ctx.parceiroServicos[0] ? C().dataDeIso(ctx.parceiroServicos[0].data) : new Date()); },
        permiteDia: function (d) { return !!C().servicoDoDia(ctx.parceiroServicos, C().isoDe(d)); },
        aoEscolher: C().escolherDiaDevolucao
      });
    }

    C().ligarDevToggle();
    ligarLimpezaErros(corpo);
    ligarSoNumeros(q('#ts-parte'));
    ligarSoNumeros(q('#ts-parte-ano'));
    prepararCampos();

    if (!registrar) {
      var u = RosterWork.sessao.perfil();
      q('#ts-minha-unidade').textContent = (u && u.lotacao_path) || '';
      q('#ts-meu-nome').textContent = u ? C().nomeMil(u) : '';
      var meu = ctx;
      RW.trocasDados.meusServicos(RosterWork.sessao.cpf(), null).then(function (l) { if (ctx === meu) ctx.meusServicos = Array.isArray(l) ? l : []; }).catch(function () {});
    }
    carregarUnidades();
  }

  /* rodapé do painel: Cancelar / Solicitar troca (ou Registrar troca) */
  function montarAcoes() {
    var rodape = RW.painel.rodape(); if (!rodape) return;
    rodape.textContent = ''; rodape.classList.remove('oculto');
    var tpl = document.getElementById(ctx.registrar ? 'tpl-troca-registrar-acoes' : 'tpl-troca-solicitar-acoes'); if (!tpl) return;
    var frag = tpl.content.cloneNode(true);
    var bCancelar = frag.querySelector('[data-acao="cancelar"]');
    var bEnviar = frag.querySelector('[data-acao="solicitar"]');
    if (bCancelar) bCancelar.addEventListener('click', cancelar);
    if (bEnviar) bEnviar.addEventListener('click', function () { enviar(bEnviar); });
    ctx.btnEnviar = bEnviar;
    rodape.appendChild(frag);
  }

  function ligarLimpezaErros(raiz) {
    var form = raiz.querySelector('.troca-solicitar-form') || raiz;
    form.addEventListener('click', function (ev) {
      var campo = ev.target.closest('.campo');
      if (!campo || !campo.classList.contains('campo--erro')) return;
      campo.classList.remove('campo--erro');
      var alvo = campo.querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    });
  }

  /* guarda os callbacks da página e registra o guarda de saída (uma vez) */
  function ligar(callbacks) {
    cbs = callbacks || {};
    if (!guardaLigado && RW.guardaSaida && RW.guardaSaida.registrar) {
      RW.guardaSaida.registrar(temDados);
      guardaLigado = true;
    }
  }

  RW.trocasSolicitar = {
    ligar: ligar, abrir: abrir,
    formulario: { mostrarModo: mostrarModo, ligarSoNumeros: ligarSoNumeros, parteNumero: parteNumero, parteAno: parteAno,
                  validarParte: validarParte, ligarLimpezaErros: ligarLimpezaErros }
  };
})();
