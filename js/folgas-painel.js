/* ============================================================
   FOLGAS — gaveta lateral (geral-painel)
   Detalhe do militar com sub-abas: EXTRATO (saldo + lançamentos)
   e AÇÕES (gestor: Conceder folga / Ajustar saldo). Conceder e Ajustar
   abrem como sub-tela dentro do painel do militar (geral-subtela, com
   "Voltar às ações"); o Solicitar e o Dar folga (com o Quem: a lista dos
   militares das unidades do topo, com o saldo) abrem a gaveta só deles.
   O período da folga usa o horário em campos e a régua (geral-horario).
   O militar é sempre pré-selecionado (nada de picker no topo).
   Expõe RosterWork.folgasPainel.{ ligar, abrirDetalhe, abrirFormFolga,
   abrirFormAjuste, linhaExtrato }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var ctx = null;            // { cpf, admin, aoMudar }
  var form = null;           // formulário aberto (ou null)
  var detalhe = null;        // { militar, dados, aoFechar }
  var aoFecharExterno = null;// limpeza da tela que abriu (ex.: realce do card)
  var ligado = false;

  /* o admin age sobre quem ele administra (o de pelotão no pelotão dele; o de companhia e o geral na área deles).
     Sem militar (o extrato do próprio), vale a lotação de quem está logado */
  function administra(militar) {
    var lotacao = militar ? militar.lotacao_atual : (RosterWork.sessao.perfil() || {}).lotacao_id;
    return !!(ctx && ctx.admin) && RosterWork.sessao.podeAdministrar('pelotao', lotacao);
  }

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }
  function nomeDe(m) { return ((m && m.grau_abreviacao ? m.grau_abreviacao + ' ' : '') + (m && m.nome_de_guerra || '')).trim(); }

  function isoDe(d) { var m = d.getMonth() + 1, dia = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dia < 10 ? '0' + dia : dia); }
  function dataDeIso(iso) { var p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function marcarErro(campo, m) { if (!campo) return; campo.classList.add('campo--erro'); var ctl = campo.querySelector('input, select, textarea'); if (ctl) ctl.setAttribute('aria-invalid', 'true'); var a = campo.querySelector('.campo-erro-texto'); if (a) { a.setAttribute('role', 'alert'); a.textContent = m || ''; } }
  function limparErro(campo) { if (!campo) return; campo.classList.remove('campo--erro'); var ctl = campo.querySelector('input, select, textarea'); if (ctl) ctl.removeAttribute('aria-invalid'); var a = campo.querySelector('.campo-erro-texto'); if (a) a.textContent = ''; }

  /* a unidade acima da lotação, no subtítulo do painel; no celular, a sigla (o nome inteiro não cabe) */
  function unidadePai(unidadeId) {
    if (RW.arvoreUnidades && RW.arvoreUnidades.pai) {
      var pai = RW.arvoreUnidades.pai(unidadeId);
      if (pai) return (RW.celular && RW.celular() ? pai.nome : pai.nome_completo) || pai.nome || '';
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
    if (l.origem === 'pontual') return msg().origemPontual;
    return '';
  }
  function subLinha(l) {
    if (l.origem === 'pontual') return msg().origemPontual;
    if (l.origem === 'ajuste') return l.motivo || '';
    if (l.situacao === 'pendente') return msg().pendenteNaoConta;
    return l.motivo || '';
  }
  function linhaExtrato(l, donoCpf) {
    var linha = RosterWork.tpl('tpl-folga-extrato-linha');
    if (!linha) return null;
    linha.querySelector('.folga-extrato-data').textContent = tituloLinha(l);
    linha.querySelector('.folga-extrato-motivo').textContent = subLinha(l);
    var vEl = linha.querySelector('.folga-extrato-valor');
    var naoContabilizada = l.origem === 'folga' && l.contabilizada === false;   // folga dada sem descontar do banco: não mexe no saldo
    if (l.situacao === 'pendente' || l.situacao === 'recusada' || naoContabilizada) {
      var chave = naoContabilizada ? 'nao_contabilizada' : l.situacao;
      var selo = RosterWork.tpl('tpl-folga-selo');
      selo.classList.add(fmt().situacaoClasse(chave));
      selo.textContent = naoContabilizada ? msg().naoContabilizada : msg().situacao[l.situacao];
      vEl.appendChild(selo);
    } else {
      vEl.textContent = fmt().valorTexto(l.sinal, l.minutos);
      vEl.classList.add(l.sinal === '-' ? 'folga-extrato-valor--negativo' : 'folga-extrato-valor--positivo');
    }
    /* cancelar: o próprio militar cancela a SUA folga pendente; o admin do militar cancela pendente e também já efetivada (some da escala, devolve as horas) */
    var ehMinha = donoCpf && ctx && donoCpf === ctx.cpf;
    var admin = administra(detalhe && detalhe.militar);
    var podeCancelar = l.origem === 'folga' && l.id && ctx && (
      (l.situacao === 'pendente' && (ehMinha || admin)) ||
      ((l.situacao === 'concedida' || l.situacao === 'aprovada') && admin));
    if (podeCancelar) {
      var bc = RosterWork.tpl('tpl-folga-cancelar');
      if (bc) { bc.addEventListener('click', function () { cancelarFolga(l.id, l.situacao); }); linha.appendChild(bc); }
    }
    return linha;
  }

  function cancelarFolga(lancamentoId, situacao) {
    if (!RW.confirmar) return;
    RW.confirmar({
      tipo: 'aviso', mensagem: situacao === 'pendente' ? msg().confirmarCancelarPendente : msg().confirmarCancelar, confirmarPerigo: true,
      aoConfirmar: function () {
        if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // reverte a folga na escala: círculo + tela travada
        RW.folgasDados.cancelar(lancamentoId).then(function (r) {
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
    RW.painel.abrir({ titulo: nomeDe(militar), subtitulo: unidadePai(militar.lotacao_atual), aoFechar: fecharReset, aoTentarFechar: tentarFecharForm });

    var linha = RW.painel.linhaAbas();
    if (linha) {
      linha.textContent = '';
      var abas = RosterWork.tpl('tpl-folga-painel-subabas');
      if (abas) {
        /* Ações só para o admin do militar; sobre si mesmo, ele ajusta o saldo, mas não concede folga a si (o banco também trava) */
        if (!administra(militar)) { var b = abas.querySelector('[data-sub="acoes"]'); if (b) b.remove(); }
        linha.classList.remove('oculto');
        linha.appendChild(abas);
        guardarAbas(abas);
        if (RW.abas) RW.abas.ligar(abas, function (aba) {
          sairDoForm();
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
      lista.forEach(function (l) { var el = linhaExtrato(l, detalhe.militar && detalhe.militar.usuario_id); if (el) linhas.appendChild(el); });
    }
    corpo.appendChild(raiz);
  }

  function mostrarAcoes() {
    var corpo = RW.painel.corpo(); if (!corpo) return;
    corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-painel-acoes'); if (!raiz) return;
    var bConceder = raiz.querySelector('[data-acao="conceder"]');
    var bAjustar = raiz.querySelector('[data-acao="ajustar"]');
    if (bConceder && detalhe.militar && detalhe.militar.usuario_id === (ctx && ctx.cpf)) { bConceder.remove(); bConceder = null; }
    if (bConceder) bConceder.addEventListener('click', function () {
      abrirFormFolga({ modo: 'conceder', militar: detalhe.militar, saldoAtual: saldoDetalhe(), aoVoltar: voltarAcoes });
    });
    if (bAjustar) bAjustar.addEventListener('click', function () {
      abrirFormAjuste({ militar: detalhe.militar, saldoAtual: saldoDetalhe(), aoVoltar: voltarAcoes });
    });
    corpo.appendChild(raiz);
  }

  /* ---------- sub-tela dentro do painel do militar ---------- */

  /* sai do formulário: some com ele e com o rodapé dele */
  function sairDoForm() {
    form = null;
    var rodape = RW.painel.rodape();
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
  }
  function voltarAcoes() { sairDoForm(); mostrarAcoes(); }

  /* trocar de aba com o formulário mexido: segura o clique antes do geral-abas, pergunta e só então troca */
  function guardarAbas(trilho) {
    trilho.addEventListener('click', function (e) {
      var aba = e.target.closest('.aba');
      if (!aba || aba.classList.contains('aba--ativa') || !(form && form.sujo) || !RW.confirmar) return;
      e.preventDefault();
      e.stopPropagation();
      RW.confirmar({
        tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { sairDoForm(); aba.click(); }
      });
    }, true);
  }

  /* põe o formulário no corpo: dentro do painel do militar (com o Voltar) ou numa gaveta só dele (Solicitar) */
  function montarSubtela(raiz, opcoes, titulo) {
    if (opcoes.aoVoltar) {
      sairDoForm();
    } else {
      aoFecharExterno = opcoes.aoFechar || null;
      RW.painel.abrir({ titulo: titulo, subtitulo: nomeDe(opcoes.militar || {}), aoFechar: fecharReset, aoTentarFechar: tentarFecharForm });
      var linha = RW.painel.linhaAbas(); if (linha) { linha.textContent = ''; linha.classList.add('oculto'); }
    }
    var corpo = RW.painel.corpo(); corpo.textContent = '';
    if (opcoes.aoVoltar) {
      var voltar = RosterWork.tpl('tpl-folga-voltar');
      if (voltar) { voltar.addEventListener('click', cancelarForm); corpo.appendChild(voltar); }
    }
    raiz.querySelector('.folga-form-saldo').textContent = msg().saldoAtual(fmt().saldoTexto(opcoes.saldoAtual || 0));
    corpo.appendChild(raiz);
  }

  /* ---------- FORMULÁRIO de folga (solicitar / conceder / dar) ---------- */
  function abrirFormFolga(opcoes) {
    opcoes = opcoes || {};
    var modo = opcoes.modo || 'solicitar';
    var militar = opcoes.militar || {};
    var titulo = modo === 'conceder' ? msg().acaoConceder : (modo === 'dar' ? msg().acaoDar : msg().acaoSolicitar);
    var raiz = RosterWork.tpl('tpl-folga-form'); if (!raiz) return;
    /* dentro do painel do militar o título é o da sub-tela; na gaveta do Solicitar ele já está no alto;
       no Dar folga o militar ainda não foi escolhido (o saldo de cada um está no Quem) */
    var tituloEl = raiz.querySelector('.folga-form-titulo');
    if (opcoes.aoVoltar) tituloEl.textContent = titulo; else tituloEl.classList.add('oculto');
    if (modo === 'dar') {
      raiz.querySelector('.subtela-cab').classList.add('oculto');
      raiz.querySelector('.folga-form-quem').classList.remove('oculto');
    }
    numerarSecoes(raiz);
    montarSubtela(raiz, opcoes, titulo);

    form = { modo: modo, cpfAlvo: militar.usuario_id || null, nome: nomeDe(militar), saldoAtual: opcoes.saldoAtual || 0, dataIso: null,
      servicos: [], sujo: false, btnConfirmar: null, aoVoltar: opcoes.aoVoltar || null, raiz: raiz };
    form.periodo = RosterWork.horario.periodoServico(raiz.querySelector('#ff-periodo'), {
      aoMudar: function () { form.sujo = true; atualizarConsumo(raiz); }
    });

    if (modo === 'dar') {
      raiz.querySelector('#ff-data').disabled = true;   // o dia vem depois de escolher o militar
      ligarQuem(raiz);
    } else {
      carregarServicos();
    }
    ligarFormFolga(raiz);
    montarAcoesForm(function () { enviarFolga(raiz); });
  }

  /* os números das seções que aparecem: "1. Quem", "2. Dia"... */
  function numerarSecoes(raiz) {
    var n = 0;
    [].forEach.call(raiz.querySelectorAll('.folga-form-secao'), function (s) {
      if (!s.classList.contains('oculto')) s.querySelector('.folga-form-num').textContent = String(++n);
    });
  }

  /* dias de serviço do militar → calendário + horário do serviço */
  function carregarServicos() {
    form.servicos = [];
    if (!form.cpfAlvo || !RW.folgasDados.servicos) return;
    var cpf = form.cpfAlvo;
    RW.folgasDados.servicos(cpf).then(function (lista) {
      if (form && form.cpfAlvo === cpf) form.servicos = Array.isArray(lista) ? lista : [];
    }).catch(function () {});
  }

  /* ---------- Quem (Dar folga): os militares das unidades do topo, menos o próprio admin ---------- */
  function ligarQuem(raiz) {
    var busca = raiz.querySelector('#ff-busca');
    var lista = raiz.querySelector('.folga-form-militares');
    function desenhar() {
      lista.textContent = '';
      var todos = (RW.folgasSaldos && RW.folgasSaldos.militares()) || [];
      todos = todos.filter(function (m) { return m.usuario_id !== (ctx && ctx.cpf); });
      var termo = RosterWork.busca.normalizar(busca.value.trim());
      var achados = todos.filter(function (m) {
        return !termo || RosterWork.busca.normalizar((m.grau_abreviacao || '') + ' ' + (m.nome_de_guerra || '')).indexOf(termo) !== -1
          || RosterWork.busca.normalizar(m.nome_completo || '').indexOf(termo) !== -1;
      });
      if (!achados.length) {
        var v = RosterWork.tpl('tpl-folga-form-vazio');
        if (v) { v.textContent = todos.length ? msg().buscaVazia : msg().pickerVazio; lista.appendChild(v); }
        return;
      }
      achados.forEach(function (m) {
        var item = RosterWork.tpl('tpl-folga-form-militar');
        if (!item) return;
        item.querySelector('.folga-form-militar-grad').textContent = m.grau_abreviacao || '';
        item.querySelector('.folga-form-militar-nome').textContent = m.nome_de_guerra || '';
        var selo = item.querySelector('.folga-form-militar-saldo');
        selo.textContent = fmt().saldoTexto(m.saldo_minutos);
        var classe = fmt().saldoSeloClasse(m.saldo_minutos);
        if (classe) selo.classList.add(classe);
        if (m.usuario_id === form.cpfAlvo) item.classList.add('lista-item--ativo');
        item.addEventListener('click', function () { escolherMilitar(raiz, m); desenhar(); });
        lista.appendChild(item);
      });
    }
    busca.addEventListener('input', desenhar);
    desenhar();
  }

  /* militar escolhido: o saldo dele vale para o consumo; o dia e o período recomeçam */
  function escolherMilitar(raiz, m) {
    form.cpfAlvo = m.usuario_id;
    form.nome = nomeDe(m);
    form.saldoAtual = m.saldo_minutos || 0;
    form.sujo = true;
    form.dataIso = null;
    var data = raiz.querySelector('#ff-data');
    data.value = ''; data.disabled = false;
    limparErro(data.closest('.campo'));
    raiz.querySelector('#ff-servico').classList.add('oculto');
    if (form.periodo) form.periodo.limpar();
    carregarServicos();
    atualizarConsumo(raiz);
  }

  function servicoDoDia(iso) { for (var i = 0; i < form.servicos.length; i++) if (String(form.servicos[i].data).slice(0, 10) === iso) return form.servicos[i]; return null; }
  function temServico(iso) { return !!servicoDoDia(iso); }
  /* quanto a folga consome: o período escolhido (0 sem dia ou com a parte fora do serviço) */
  function minutosFolga() {
    var v = form.periodo && form.periodo.valor();
    return v ? v.minutos : 0;
  }

  function atualizarConsumo(raiz) {
    var el = raiz.querySelector('#ff-consumo'); if (!el) return;
    var consumo = minutosFolga();
    el.classList.toggle('oculto', !form.dataIso || !consumo);
    if (!form.dataIso || !consumo) return;
    var ficaria = form.saldoAtual - consumo;
    el.querySelector('.nota-texto').textContent = msg().consumoSaldo(fmt().horasAbs(consumo), fmt().saldoTexto(ficaria));
    el.classList.toggle('nota--alerta', ficaria < 0);
  }

  function ligarFormFolga(raiz) {
    var dataInput = raiz.querySelector('#ff-data');
    if (RW.calendario && dataInput) {
      RW.calendario.ligar(dataInput, {
        obterData: function () { return form.dataIso ? dataDeIso(form.dataIso) : new Date(); },
        permiteDia: function (d) { return temServico(isoDe(d)); },
        aoEscolher: function (d) {
          form.dataIso = isoDe(d); form.sujo = true;
          dataInput.value = fmt().dataNumerica(form.dataIso);
          limparErro(dataInput.closest('.campo'));
          /* dia novo: recomeça no serviço inteiro, com o horário do serviço embaixo do dia */
          var sv = servicoDoDia(form.dataIso);
          if (form.periodo) form.periodo.definirServico(sv ? { hi: sv.hi, hf: sv.hf } : null);
          var ajuda = raiz.querySelector('#ff-servico');
          ajuda.classList.toggle('oculto', !sv);
          if (sv) ajuda.textContent = msg().deServico(RosterWork.horario.curta(sv.hi || '08:00'), RosterWork.horario.curta(sv.hf || '08:00'));
          atualizarConsumo(raiz);
        }
      });
    }
    var motivo = raiz.querySelector('#ff-motivo');
    if (motivo) motivo.addEventListener('input', function () { form.sujo = true; });
  }

  function enviarFolga(raiz) {
    if (!form.cpfAlvo) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().formMilitar }); return; }
    if (!form.dataIso) { marcarErro(raiz.querySelector('#ff-data').closest('.campo'), msg().formData); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    var per = form.periodo && form.periodo.valor();
    if (!per || !per.valido) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().formPeriodo }); return; }
    var hi = per.total ? null : per.hi, hf = per.total ? null : per.hf;
    var motivo = (raiz.querySelector('#ff-motivo') || {}).value || '';
    var btn = form.btnConfirmar;
    if (form.modo === 'solicitar') {
      finalizar(RW.folgasDados.solicitar({ p_data: form.dataIso, p_horario_inicio: hi, p_horario_fim: hf, p_motivo: motivo }), btn, false);   // solicitar não mexe na escala (pontos)
      return;
    }
    /* conceder e dar: o admin escolhe se a folga desconta do banco de horas; recalcula a escala (véu) */
    var conceder = function (contabilizar) {
      finalizar(RW.folgasDados.dar({ p_usuario_id: form.cpfAlvo, p_data: form.dataIso, p_horario_inicio: hi, p_horario_fim: hf, p_motivo: motivo, p_contabilizar: contabilizar }), btn, true);
    };
    var s = servicoDoDia(form.dataIso) || {};
    var periodo = msg().periodoDas(horaCurta(hi || s.hi), horaCurta(hf || s.hf));
    RW.confirmar({
      tipo: 'aviso',
      mensagem: msg().contabilizarFolga(form.nome, diaMes(form.dataIso), periodo, horasTexto(minutosFolga())),
      textoConfirmar: RW.mensagens.botoes.contabilizar,
      textoAlternativo: RW.mensagens.botoes.naoContabilizar,
      textoCancelar: RW.mensagens.botoes.cancelar,
      aoConfirmar: function () { conceder(true); },
      aoAlternativo: function () { conceder(false); }
    });
  }

  /* textos do modal do banco de horas: "08:00" -> "08h"; "2026-10-14" -> "14/10"; 1440 -> "24 horas" */
  function horaCurta(hhmm) { var t = hhmm || '08:00', m = t.substring(3, 5); return t.substring(0, 2) + 'h' + (m && m !== '00' ? m : ''); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function horasTexto(min) { return (min % 60 === 0) ? msg().horasExtenso(min / 60) : fmt().horasAbs(min); }

  /* ---------- FORMULÁRIO de ajuste (adicionar / descontar saldo) ---------- */
  function abrirFormAjuste(opcoes) {
    opcoes = opcoes || {};
    var militar = opcoes.militar || {};
    var raiz = RosterWork.tpl('tpl-folga-form-ajuste'); if (!raiz) return;
    montarSubtela(raiz, opcoes, msg().acaoAjuste);
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
    var delta = minutosAjuste(raiz);
    el.classList.toggle('oculto', delta === null);
    if (delta === null) return;
    var novo = form.saldoAtual + delta;
    el.querySelector('.nota-texto').textContent = msg().saldoPassa(fmt().saldoTexto(form.saldoAtual), fmt().saldoTexto(novo));
    el.classList.toggle('nota--alerta', novo < 0);
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
    finalizar(RW.folgasDados.ajustar(form.cpfAlvo, minutos, motivo), btn, false);   // ajuste de saldo não mexe na escala
  }

  /* ---------- rodapé, envio e fechamento dos formulários ---------- */
  function textoConfirmar() {
    if (!form) return RW.mensagens.botoes.salvar;
    if (form.modo === 'conceder') return msg().botaoConceder;
    if (form.modo === 'dar') return msg().botaoDar;
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

  /* Esc/X do painel: com o formulário mexido, faz a mesma pergunta do Cancelar (e fecha) */
  function tentarFecharForm() {
    if (!(form && form.sujo) || !RW.confirmar) return false;
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { if (form) form.sujo = false; RW.painel.fechar(); }
    });
    return true;
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
