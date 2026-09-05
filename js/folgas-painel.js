/* ============================================================
   FOLGAS — gaveta lateral (geral-painel)
   Detalhe do militar com sub-abas: EXTRATO (saldo + lançamentos)
   e AÇÕES (gestor: Conceder folga / Ajustar saldo). Os formulários
   (solicitar / conceder / ajuste) reaproveitam a mesma gaveta.
   O militar é sempre pré-selecionado (nada de picker no topo).
   Expõe RosterWork.folgasPainel.{ ligar, abrirDetalhe, abrirFormFolga,
   abrirFormAjuste, linhaExtrato }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  var TOTAL = 1440;

  var ctx = null;            // { cpf, admin, aoMudar }
  var form = null;           // formulário aberto (ou null)
  var detalhe = null;        // { militar, dados, aoFechar }
  var aoFecharExterno = null;// limpeza da tela que abriu (ex.: realce do card)
  var ligado = false;

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }
  function nomeDe(m) { return ((m && m.grau_abreviacao ? m.grau_abreviacao + ' ' : '') + (m && m.nome_de_guerra || '')).trim(); }

  function isoDe(d) { var m = d.getMonth() + 1, dia = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dia < 10 ? '0' + dia : dia); }
  function dataDeIso(iso) { var p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function marcarErro(campo, m) { if (!campo) return; campo.classList.add('campo--erro'); var ctl = campo.querySelector('input, select, textarea'); if (ctl) ctl.setAttribute('aria-invalid', 'true'); var a = campo.querySelector('.campo-erro-texto'); if (a) { a.setAttribute('role', 'alert'); a.textContent = m || ''; } }
  function limparErro(campo) { if (!campo) return; campo.classList.remove('campo--erro'); var ctl = campo.querySelector('input, select, textarea'); if (ctl) ctl.removeAttribute('aria-invalid'); var a = campo.querySelector('.campo-erro-texto'); if (a) a.textContent = ''; }

  function unidadePai(unidadeId) {
    if (RW.arvoreUnidades && RW.arvoreUnidades.pai) {
      var pai = RW.arvoreUnidades.pai(unidadeId);
      if (pai) return pai.nome_completo || pai.nome || '';
    }
    return '';
  }

  /* fecha a gaveta zerando o estado do módulo + a limpeza externa */
  function fecharReset() {
    form = null; detalhe = null;
    var cb = aoFecharExterno; aoFecharExterno = null;
    if (cb) cb();
  }

  /* ---------- linhas do extrato (reusadas por Minhas folgas) ---------- */
  function tituloLinha(l) {
    var d = fmt().dataNumerica(l.data_ref);
    if (d) return d;
    if (l.origem === 'ajuste') return msg().origemAjuste;
    if (l.origem === 'escala') return msg().origemEscala;
    return '';
  }
  function subLinha(l) {
    if (l.origem === 'escala') return msg().origemEscala;
    if (l.origem === 'ajuste') return l.motivo || '';
    if (l.situacao === 'pendente') return msg().pendenteNaoConta;
    return l.motivo || '';
  }
  function linhaExtrato(l) {
    var linha = RosterWork.tpl('tpl-folga-extrato-linha');
    if (!linha) return null;
    linha.querySelector('.folga-extrato-data').textContent = tituloLinha(l);
    linha.querySelector('.folga-extrato-motivo').textContent = subLinha(l);
    var vEl = linha.querySelector('.folga-extrato-valor');
    if (l.situacao === 'pendente' || l.situacao === 'recusada') {
      var selo = RosterWork.tpl('tpl-folga-selo');
      selo.classList.add(fmt().situacaoClasse(l.situacao));
      selo.textContent = msg().situacao[l.situacao];
      vEl.appendChild(selo);
    } else {
      vEl.textContent = fmt().valorTexto(l.sinal, l.minutos);
      vEl.classList.add(l.sinal === '-' ? 'folga-extrato-valor--negativo' : 'folga-extrato-valor--positivo');
    }
    /* admin pode cancelar uma folga já efetivada (some da escala, devolve as horas) */
    if (l.origem === 'folga' && (l.situacao === 'concedida' || l.situacao === 'aprovada') && ctx && ctx.admin && l.id) {
      var bc = RosterWork.tpl('tpl-folga-cancelar');
      if (bc) { bc.addEventListener('click', function () { cancelarFolga(l.id); }); linha.appendChild(bc); }
    }
    return linha;
  }

  function cancelarFolga(lancamentoId) {
    if (!RW.confirmar) return;
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarCancelar, confirmarPerigo: true,
      aoConfirmar: function () {
        if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // reverte a folga na escala: círculo + tela travada
        RW.folgasDados.cancelar(lancamentoId, ctx.cpf).then(function (r) {
          if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
          if (r && r.success) {
            RW.painel.fechar();
            if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Folgas' });
            if (ctx && ctx.aoMudar) ctx.aoMudar();
          } else if (RW.avisar) {
            RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaAcao });
          }
        }).catch(function () { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }

  /* ---------- DETALHE (sub-abas Extrato / Ações) ---------- */
  function abrirDetalhe(militar, aoFechar) {
    if (!RW.painel || !militar) return;
    form = null;
    detalhe = { militar: militar, dados: null, aoFechar: aoFechar };
    aoFecharExterno = aoFechar || null;
    RW.painel.abrir({ titulo: nomeDe(militar), subtitulo: unidadePai(militar.lotacao_atual), aoFechar: fecharReset });

    var subcab = RW.painel.subcabecalho();
    if (subcab) {
      subcab.textContent = '';
      var abas = RosterWork.tpl('tpl-folga-painel-subabas');
      if (abas) {
        if (!ctx.admin) { var b = abas.querySelector('[data-sub="acoes"]'); if (b) b.remove(); }
        subcab.classList.remove('oculto');
        subcab.appendChild(abas);
        if (RW.abas) RW.abas.ligar(abas, function (aba) {
          if (aba.getAttribute('data-sub') === 'acoes') mostrarAcoes(); else mostrarExtrato();
        });
      }
    }

    var corpo = RW.painel.corpo(); corpo.textContent = '';
    var estado = RW.painel.criarCarregando(); if (estado) corpo.appendChild(estado);
    RW.folgasDados.extrato(militar.usuario_id).then(function (r) {
      if (!RW.painel.estaAberto() || form || !detalhe || detalhe.militar !== militar) return;
      detalhe.dados = r || { saldo_minutos: 0, linhas: [] };
      mostrarExtrato();
    }).catch(function () {
      if (!RW.painel.estaAberto() || form || !detalhe || detalhe.militar !== militar) return;   // guard completo: não sobrescreve o painel de outro militar
      corpo.textContent = '';
      var e = RW.painel.criarEstado(msg().falhaExtrato); if (e) corpo.appendChild(e);
    });
  }

  function saldoDetalhe() { return detalhe && detalhe.dados ? (detalhe.dados.saldo_minutos || 0) : 0; }

  function mostrarExtrato() {
    var corpo = RW.painel.corpo(); if (!corpo) return;
    corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-extrato'); if (!raiz) return;
    var saldo = saldoDetalhe();
    var valor = raiz.querySelector('.folga-saldo-bloco-valor');
    valor.textContent = fmt().saldoTexto(saldo);
    if (saldo > 0) valor.classList.add('folga-saldo-bloco-valor--positivo');
    else if (saldo < 0) valor.classList.add('folga-saldo-bloco-valor--negativo');
    var linhas = raiz.querySelector('.folga-extrato-linhas');
    var lista = (detalhe.dados && Array.isArray(detalhe.dados.linhas)) ? detalhe.dados.linhas : [];
    if (!lista.length) {
      var vazio = RW.painel.criarEstado(msg().extratoVazio); if (vazio) linhas.appendChild(vazio);
    } else {
      lista.forEach(function (l) { var el = linhaExtrato(l); if (el) linhas.appendChild(el); });
    }
    corpo.appendChild(raiz);
  }

  function mostrarAcoes() {
    var corpo = RW.painel.corpo(); if (!corpo) return;
    corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-painel-acoes'); if (!raiz) return;
    var bConceder = raiz.querySelector('[data-acao="conceder"]');
    var bAjustar = raiz.querySelector('[data-acao="ajustar"]');
    var voltar = function () { abrirDetalhe(detalhe.militar, detalhe.aoFechar); };
    if (bConceder) bConceder.addEventListener('click', function () {
      abrirFormFolga({ modo: 'conceder', militar: detalhe.militar, saldoAtual: saldoDetalhe(), aoFechar: detalhe.aoFechar, aoVoltar: voltar });
    });
    if (bAjustar) bAjustar.addEventListener('click', function () {
      abrirFormAjuste({ militar: detalhe.militar, saldoAtual: saldoDetalhe(), aoFechar: detalhe.aoFechar, aoVoltar: voltar });
    });
    corpo.appendChild(raiz);
  }

  /* ---------- FORMULÁRIO de folga (solicitar / conceder) ---------- */
  function abrirFormFolga(opcoes) {
    opcoes = opcoes || {};
    var modo = opcoes.modo || 'solicitar';
    var militar = opcoes.militar || {};
    var titulo = modo === 'conceder' ? msg().acaoConceder : msg().acaoSolicitar;
    aoFecharExterno = opcoes.aoFechar || null;
    RW.painel.abrir({ titulo: titulo, subtitulo: nomeDe(militar), aoFechar: fecharReset });
    var subcab = RW.painel.subcabecalho(); if (subcab) { subcab.textContent = ''; subcab.classList.add('oculto'); }
    var corpo = RW.painel.corpo(); corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-form'); corpo.appendChild(raiz);

    form = { modo: modo, cpfAlvo: militar.usuario_id, saldoAtual: opcoes.saldoAtual || 0, dataIso: null, mexeu: false, barra: null, servicos: [], sujo: false, btnConfirmar: null, aoVoltar: opcoes.aoVoltar || null };

    /* dias de serviço do militar → calendário + janela da barra de período */
    if (RW.folgasDados.servicos) RW.folgasDados.servicos(form.cpfAlvo).then(function (lista) { form.servicos = Array.isArray(lista) ? lista : []; }).catch(function () {});

    ligarFormFolga(raiz);
    montarAcoesForm(function () { enviarFolga(raiz); });
  }

  function servicoDoDia(iso) { for (var i = 0; i < form.servicos.length; i++) if (String(form.servicos[i].data).slice(0, 10) === iso) return form.servicos[i]; return null; }
  function temServico(iso) { return !!servicoDoDia(iso); }
  function horaParaMin(hhmm) { var h = parseInt(hhmm.substring(0, 2), 10), m = parseInt(hhmm.substring(3, 5) || '0', 10); var min = (h - 8) * 60 + m; return min < 0 ? min + TOTAL : min; }
  function limiteDoDia(s) { var a = horaParaMin(s.hi || '08:00'), b = horaParaMin(s.hf || '08:00'); if (b <= a) b += TOTAL; if (b > TOTAL) b = TOTAL; return { inicioMin: a, fimMin: b }; }
  /* a barra nasce travada (24h); ao escolher o dia ela assume a janela do serviço e liga */
  function ativarBarraNoDia() {
    if (!form.barra || !form.dataIso) return;
    var s = servicoDoDia(form.dataIso); if (!s) return;
    var lim = limiteDoDia(s);
    form.barra.definirLimite(lim.inicioMin, lim.fimMin);
    form.barra.ativar();
    form.mexeu = false;   // dia novo recomeça como "dia inteiro"
  }
  function minutosFolga() { return (form.barra && form.dataIso) ? form.barra.valor().minutos : 0; }
  function atualizarConsumo(raiz) {
    var el = raiz.querySelector('#ff-consumo'); if (!el) return;
    el.classList.remove('folga-form-consumo--alerta');
    if (!form.dataIso) { el.textContent = ''; return; }
    var consumo = minutosFolga();
    var texto = msg().consome(fmt().horasAbs(consumo));
    var ficaria = form.saldoAtual - consumo;
    if (ficaria < 0) { texto += ' · ' + msg().saldoFicaria(fmt().saldoTexto(ficaria)); el.classList.add('folga-form-consumo--alerta'); }
    el.textContent = texto;
  }

  function ligarFormFolga(raiz) {
    /* barra de período sempre presente, travada até escolher o dia; mexer nela = "parte do dia" */
    if (RW.barraPeriodo) {
      form.barra = RW.barraPeriodo.criar(raiz.querySelector('#ff-barra'), {
        desativado: true,
        aoMudar: function () { atualizarConsumo(raiz); },
        aoMexer: function () { form.mexeu = true; form.sujo = true; atualizarConsumo(raiz); }
      });
    }
    var dataInput = raiz.querySelector('#ff-data');
    if (RW.calendario && dataInput) {
      RW.calendario.ligar(dataInput, {
        obterData: function () { return form.dataIso ? dataDeIso(form.dataIso) : new Date(); },
        permiteDia: function (d) { return temServico(isoDe(d)); },
        aoEscolher: function (d) {
          form.dataIso = isoDe(d); form.sujo = true;
          dataInput.value = fmt().dataNumerica(form.dataIso);
          limparErro(dataInput.closest('.campo'));
          ativarBarraNoDia();
          atualizarConsumo(raiz);
        }
      });
    }
    var motivo = raiz.querySelector('#ff-motivo');
    if (motivo) motivo.addEventListener('input', function () { form.sujo = true; });
  }

  function enviarFolga(raiz) {
    if (!form.dataIso) { marcarErro(raiz.querySelector('#ff-data').closest('.campo'), msg().formData); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    if (form.mexeu && form.barra && form.barra.valor().minutos <= 0) { marcarErro(raiz.querySelector('#ff-data').closest('.campo'), msg().formPeriodo); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    var hi = null, hf = null;
    if (form.mexeu && form.barra) { var v = form.barra.valor(); hi = v.hi; hf = v.hf; }
    var motivo = (raiz.querySelector('#ff-motivo') || {}).value || '';
    var btn = form.btnConfirmar;
    var promessa = (form.modo === 'conceder')
      ? RW.folgasDados.dar({ p_usuario_id: form.cpfAlvo, p_data: form.dataIso, p_horario_inicio: hi, p_horario_fim: hf, p_motivo: motivo, p_dado_por: ctx.cpf })
      : RW.folgasDados.solicitar({ p_usuario_id: ctx.cpf, p_data: form.dataIso, p_horario_inicio: hi, p_horario_fim: hf, p_motivo: motivo });
    finalizar(promessa, btn, form.modo === 'conceder');   // conceder recalcula a escala (véu); solicitar não (pontos)
  }

  /* ---------- FORMULÁRIO de ajuste (adicionar / descontar saldo) ---------- */
  function abrirFormAjuste(opcoes) {
    opcoes = opcoes || {};
    var militar = opcoes.militar || {};
    aoFecharExterno = opcoes.aoFechar || null;
    RW.painel.abrir({ titulo: msg().acaoAjuste, subtitulo: nomeDe(militar), aoFechar: fecharReset });
    var subcab = RW.painel.subcabecalho(); if (subcab) { subcab.textContent = ''; subcab.classList.add('oculto'); }
    var corpo = RW.painel.corpo(); corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-form-ajuste'); corpo.appendChild(raiz);
    form = { modo: 'ajuste', cpfAlvo: militar.usuario_id, saldoAtual: opcoes.saldoAtual || 0, tipo: 'adicionar', sujo: false, btnConfirmar: null, aoVoltar: opcoes.aoVoltar || null };

    var toggle = raiz.querySelector('#fa-tipo');
    if (RW.abas && toggle) RW.abas.ligar(toggle, function (aba) {
      form.tipo = aba.getAttribute('data-tipo') || 'adicionar';
      form.sujo = true;
      atualizarPreviaAjuste(raiz);
    });
    var horas = raiz.querySelector('#fa-horas');
    if (horas) horas.addEventListener('input', function () { form.sujo = true; atualizarPreviaAjuste(raiz); });
    var motivo = raiz.querySelector('#fa-motivo');
    if (motivo) motivo.addEventListener('input', function () { form.sujo = true; });
    montarAcoesForm(function () { enviarAjuste(raiz); });
  }

  /* delta em minutos (com sinal) do formulário de ajuste, ou null se inválido */
  function minutosAjuste(raiz) {
    var str = (raiz.querySelector('#fa-horas') || {}).value || '';
    var h = parseFloat(str.replace(',', '.'));
    if (!str.trim() || isNaN(h) || h <= 0) return null;
    return Math.round(h * 60) * (form.tipo === 'descontar' ? -1 : 1);
  }

  function atualizarPreviaAjuste(raiz) {
    var el = raiz.querySelector('#fa-previa'); if (!el) return;
    el.textContent = '';
    el.classList.remove('folga-form-consumo--alerta');
    var delta = minutosAjuste(raiz);
    if (delta === null) return;
    var novo = form.saldoAtual + delta;
    el.appendChild(document.createTextNode(msg().saldoPrefixo + ' '));
    el.appendChild(fmt().dePara(fmt().saldoTexto(form.saldoAtual), fmt().saldoTexto(novo)));
    if (novo < 0) el.classList.add('folga-form-consumo--alerta');
  }

  function enviarAjuste(raiz) {
    var campoH = raiz.querySelector('#fa-horas').closest('.campo');
    var campoM = raiz.querySelector('#fa-motivo').closest('.campo');
    var motivo = (raiz.querySelector('#fa-motivo') || {}).value || '';
    var minutos = minutosAjuste(raiz);
    var ok = true;
    if (minutos === null) { marcarErro(campoH, msg().formHorasInvalida); ok = false; }
    if (!motivo.trim()) { marcarErro(campoM, msg().formMotivo); ok = false; }
    if (!ok) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    var btn = form.btnConfirmar;
    finalizar(RW.folgasDados.ajustar(form.cpfAlvo, minutos, motivo, ctx.cpf), btn, false);   // ajuste de saldo não mexe na escala
  }

  /* ---------- rodapé, envio e fechamento dos formulários ---------- */
  function textoConfirmar() {
    if (!form) return RW.mensagens.botoes.salvar;
    if (form.modo === 'conceder') return msg().botaoConceder;
    if (form.modo === 'ajuste') return msg().botaoAjuste;
    return msg().botaoSolicitar;
  }

  function montarAcoesForm(aoConfirmar) {
    var rodape = RW.painel.rodape(); if (!rodape) return;
    rodape.textContent = ''; rodape.classList.remove('oculto');
    var tpl = document.getElementById('tpl-folga-form-acoes'); if (!tpl) return;
    var frag = tpl.content.cloneNode(true);
    var bCancelar = frag.querySelector('[data-acao="cancelar"]');
    var bConfirmar = frag.querySelector('[data-acao="confirmar"]');
    bConfirmar.textContent = textoConfirmar();
    bCancelar.addEventListener('click', cancelarForm);
    bConfirmar.addEventListener('click', aoConfirmar);
    if (form) form.btnConfirmar = bConfirmar;
    rodape.appendChild(frag);
  }

  /* recalcula=true (conceder folga) usa o véu global (recalcula a escala); senão (solicitar,
     ajuste de saldo) são rápidos: pontinhos no botão */
  function finalizar(promessa, btn, recalcula) {
    if (recalcula) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
    else if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    function parar() { if (recalcula) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (btn && RW.pararCarregando) RW.pararCarregando(btn); }
    promessa.then(function (r) {
      parar();
      if (r && r.success) {
        form = null;
        RW.painel.fechar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Folgas' });
        if (ctx.aoMudar) ctx.aoMudar();
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaAcao });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function cancelarForm() {
    function segue() { if (form && form.aoVoltar) { form.aoVoltar(); } else { RW.painel.fechar(); } }
    if (form && form.sujo && RW.confirmar) {
      RW.confirmar({
        tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
        aoConfirmar: segue
      });
      return;
    }
    segue();
  }

  function ligar(contexto) {
    ctx = contexto || {};
    if (!ligado && RW.guardaSaida && RW.guardaSaida.registrar) {
      RW.guardaSaida.registrar(function () { return !!(form && form.sujo); });
      ligado = true;
    }
  }

  RW.folgasPainel = {
    ligar: ligar,
    abrirDetalhe: abrirDetalhe,
    abrirFormFolga: abrirFormFolga,
    abrirFormAjuste: abrirFormAjuste,
    linhaExtrato: linhaExtrato
  };
})();
