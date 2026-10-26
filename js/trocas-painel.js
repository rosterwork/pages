/* ============================================================
   TROCAS — painel lateral da troca (componente geral-decisao)
   O pedido em caixas (Serviço e Devolução: o dia com o horário,
   quem trabalha no lugar de quem e a régua), a análise vinda do
   banco (geral-impacto: uma nota por ponto), o "Como fica a escala"
   (fechado; o dia inteiro só ao abrir) e o rodapé só com as ações
   do papel/estado de quem olha.
   Recusar (do militar chamado ou da administração) pede o motivo
   opcional no próprio painel. Usado na Trocas e na Pendências.
   Na alteração de uma troca aprovada, a caixa "Antes" mostra como
   ela era; a troca com uma alteração esperando traz o aviso no topo.
   Editar (no rodapé, junto das ações, para os dois militares e o admin
   da área): o formulário do trocas-editar.js, que só vem na página
   Trocas; Salvar ou Cancelar volta à leitura.
   O registro de várias trocas abre o painel próprio (trocas-painel-varias.js).
   Expõe: RosterWork.trocasPainel.abrir(troca, ctx), acao(nome, troca, ctx, botao)
   (as mesmas ações fora do painel: o cartão que abre ali mesmo) e as peças (pecas).
   ctx = { cpf, ehAdmin, decidir?, posicao?: { n, total }, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var trocaAtual = null;
  var partes = null;       // as partes do painel aberto (geral-decisao)
  var btnAprovar = null;   // botão Aprovar (ou Aprovar com pendências) da troca aberta: travado até a análise chegar

  function fmt() { return RW.trocasFormato; }
  function msg() { return RW.mensagens.trocas; }

  /* o trecho { hi, hf } ("HH:MM"); sem horário = o serviço inteiro, 08h às 08h */
  function trecho(hi, hf) {
    return hi && hf ? { hi: String(hi).slice(0, 5), hf: String(hf).slice(0, 5) } : { hi: '08:00', hf: '08:00' };
  }

  /* uma perna da troca: o dia, o horário, quem trabalha no lugar de quem, a régua e um texto extra */
  function caixaPerna(titulo, iso, hi, hf, quemTrabalha, quemFolga, extra) {
    var t = trecho(hi, hf);
    return RW.decisao.caixa({
      titulo: titulo,
      data: RW.data.comDiaSemana(iso),
      hi: t.hi, hf: t.hf,
      frase: msg().fraseNoLugar(quemTrabalha, quemFolga),
      regua: { servico: { hi: '08:00', hf: '08:00' }, trecho: t },
      extra: extra
    });
  }

  /* "serviço inteiro" ou "das 08h às 20h" */
  function trechoTexto(hi, hf) {
    var p = RW.mensagens.pendencias;
    if (!hi || !hf) return p.servicoInteiro;
    return p.trechoHoras(RW.horario.curta(String(hi).slice(0, 5)), RW.horario.curta(String(hf).slice(0, 5)));
  }

  /* "Registro RW nº 1/2026 · Parte nº 287/2026": o registro e a parte do E-protocolo, o que houver */
  function registroEParte(numero, ano, parteNumero, parteAno) {
    var m = msg();
    return [numero ? m.registroCaixa(numero, ano) : '', parteNumero ? m.parteNumero(parteNumero, parteAno) : '']
      .filter(Boolean).join(' · ');
  }

  /* a alteração: como a troca era antes (o serviço com o horário, a devolução, o registro e a parte) */
  function caixaAntes(o) {
    var m = msg(), t = trecho(o.horario_inicio, o.horario_fim);
    return RW.decisao.caixa({
      titulo: m.caixaAntes,
      data: RW.data.comDiaSemana(o.data_servico_solicitante),
      hi: t.hi, hf: t.hf,
      frase: o.data_servico_parceiro
        ? m.antesDevolucao(RW.data.comDiaSemana(o.data_servico_parceiro), trechoTexto(o.devolucao_horario_inicio, o.devolucao_horario_fim))
        : m.antesDevolucaoPendente,
      extra: registroEParte(o.registro_numero, o.registro_ano, o.parte_numero, o.parte_ano)
    });
  }

  function nota(texto) {
    var el = RosterWork.tpl('tpl-troca-nota');
    if (el) el.querySelector('.nota-texto').textContent = texto;
    return el;
  }

  /* ---------- os aceites do registro ---------- */
  /* o aceite de quem olha está pendente (o pedido que espera a confirmação dele segue pelo Aceitar de sempre) */
  function aceitePendente(troca, cpf) {
    if (!cpf || ['pendente_confirmacao', 'pendente_aprovacao', 'aprovada'].indexOf(troca.status) < 0) return false;
    if (troca.status === 'pendente_confirmacao' && cpf === quemAceita(troca)) return false;
    return (troca.aceites || []).some(function (a) { return a.cpf === cpf && !a.aceito_em; });
  }

  /* o momento (ISO do banco) no fuso de quem olha: { dia: "07/10/2026", hora: "19h30" } */
  function quando(iso) {
    var d = new Date(iso);
    function p2(n) { return ('0' + n).slice(-2); }
    return { dia: RW.data.paraBR(d), hora: RW.horario.curta(p2(d.getHours()) + ':' + p2(d.getMinutes())) };
  }

  function linhaAceite(caixa, quem, acao, seloTexto, seloClasse) {
    var linha = RosterWork.tpl('tpl-troca-aceite');
    if (!linha) return;
    linha.querySelector('.decisao-caixa-data').textContent = quem;
    linha.querySelector('.decisao-caixa-extra').textContent = acao;
    var selo = linha.querySelector('.selo');
    selo.textContent = seloTexto;
    selo.classList.add(seloClasse);
    caixa.appendChild(linha);
  }

  /* "Aceites e aprovação": cada militar com o aceite (ou pendente) e, embaixo, a aprovação */
  function caixaAceites(troca) {
    var m = msg();
    var caixa = RW.decisao.caixa({ titulo: m.caixaAceites });
    if (!caixa) return null;
    var nomes = {};
    nomes[troca.solicitante_cpf] = fmt().nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    nomes[troca.parceiro_cpf] = fmt().nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);
    /* no pedido do militar, o aceite de quem pediu é o próprio pedido */
    var pediu = troca.registro_origem === 'pedido' && !troca.substitui_troca_id;
    (troca.aceites || []).forEach(function (a) {
      var q = a.aceito_em ? quando(a.aceito_em) : null;
      var acao = !q ? m.aceitePendente
        : (pediu && a.papel === 'solicitante' ? m.aceiteSolicitou(q.dia, q.hora) : m.aceiteAceitou(q.dia, q.hora));
      linhaAceite(caixa, nomes[a.cpf] || '', acao, q ? m.seloAceitou : m.seloAceitePendente, q ? 'selo--sucesso' : 'selo--alerta');
    });
    if ((troca.status === 'aprovada' || troca.status === 'substituida') && troca.aprovado_em) {
      var qa = quando(troca.aprovado_em);
      var registrou = troca.registro_origem === 'administracao' && troca.criado_em === troca.aprovado_em;
      linhaAceite(caixa, troca.aprovado_por_titulo || m.aceiteAdministracao,
        registrou ? m.aceiteRegistrou(qa.dia, qa.hora) : m.aceiteAprovou(qa.dia, qa.hora), m.seloAprovou, 'selo--sucesso');
    } else if (troca.status === 'pendente_confirmacao' || troca.status === 'pendente_aprovacao') {
      linhaAceite(caixa, m.aceiteAdministracao, m.aceiteAguardandoAprovacao, m.seloAceitePendente, 'selo--alerta');
    }
    return caixa;
  }

  /* ---------- corpo: o pedido em caixas (o registro e a parte do E-protocolo vão na caixa Serviço, para conferir) ---------- */
  function montarCorpo(troca, ctx) {
    partes = RW.decisao.montar(RW.painel.corpo());
    if (!partes) return;
    var m = msg();
    var sol = fmt().nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    var par = fmt().nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);
    var parte = registroEParte(troca.registro_numero, troca.registro_ano, troca.parte_numero, troca.parte_ano);
    /* o aceite de quem olha faltando: a nota no alto (o botão Aceitar fica no rodapé) */
    if (aceitePendente(troca, ctx.cpf)) {
      var falta = nota(troca.status === 'aprovada' ? m.faltaAceiteAprovada : m.faltaAceite);
      if (falta) partes.pedido.appendChild(falta);
    }
    /* a troca com uma alteração esperando (o Editar fica fechado até ela ser decidida) */
    if (troca.alteracao_pendente_id) { var aviso = nota(m.alteracaoAguardando); if (aviso) partes.pedido.appendChild(aviso); }
    if (troca.original) { var antes = caixaAntes(troca.original); if (antes) partes.pedido.appendChild(antes); }
    var servico = caixaPerna(m.caixaServico, troca.data_servico_solicitante, troca.horario_inicio, troca.horario_fim, par, sol, parte);
    if (servico) partes.pedido.appendChild(servico);
    var devolucao = troca.data_servico_parceiro
      ? caixaPerna(m.caixaDevolucao, troca.data_servico_parceiro, troca.devolucao_horario_inicio, troca.devolucao_horario_fim, sol, par)
      : RW.decisao.caixa({ titulo: m.caixaDevolucao, frase: m.devolucaoNaoMarcada });
    if (devolucao) partes.pedido.appendChild(devolucao);
    var aceites = caixaAceites(troca);
    if (aceites) partes.pedido.appendChild(aceites);
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

  /* Desfazer de uma aprovação = cancelar a troca aprovada (reverte a escala e redistribui);
     na alteração, a troca de antes volta a valer (o banco refaz só os dias que mudaram) */
  function desfazerAprovacao(troca, ctx) {
    var d = RW.trocasDados;
    return function () {
      if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o desfazer cancela a troca e recalcula a escala: véu global
      return d.cancelar(troca.troca_id, !!troca.substitui_troca_id).then(function (res) {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (res && res.ok && ctx.aoMudar) ctx.aoMudar();
        return res;
      }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
    };
  }

  function despachar(acao, troca, ctx, btn) {
    var d = RW.trocasDados;
    var m = msg();
    var alteracao = !!troca.substitui_troca_id;
    var desfazer = { desfazer: desfazerAprovacao(troca, ctx) };
    if (acao === 'editar') {
      RW.painel.editar();   // o aoMudarModo('editar') troca a leitura pelo formulário
    } else if (acao === 'aceitar') {
      confirmarEntao(m.confirmarAceitar, false, function () { executar(d.confirmar(troca.troca_id, true), btn, ctx); });
    } else if (acao === 'imprimir-registro') {
      RW.trocasRegistroPdf.imprimir(troca.troca_id, btn);
    } else if (acao === 'aceitar-depois') {
      /* o aceite que falta: só entra no registro (a escala não muda) */
      confirmarEntao(m.confirmarAceitarDepois, false, function () { executar(d.aceitar(troca.troca_id), btn, ctx); });
    } else if (acao === 'recusar') {
      /* o militar chamado recusa: o motivo (opcional) vai no aviso a quem pediu */
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.confirmar(troca.troca_id, false, motivo), botao, ctx); });
    } else if (acao === 'aprovar') {
      var temProblema = troca._analise && troca._analise.veredito === 'problema';
      confirmarEntao(temProblema ? m.confirmarAprovarComProblema : (alteracao ? m.confirmarAprovarAlteracao : m.confirmarAprovar), temProblema, function () {
        executar(d.aprovar(troca.troca_id, true), btn, ctx, desfazer, true);   // aprovar recalcula a escala → véu
      });
    } else if (acao === 'aprovar-forcar') {
      /* com pendências: sem o aceite do solicitado; quando a análise apontou problema, o mesmo aviso do Aprovar */
      var forcarComProblema = troca._analise && troca._analise.veredito === 'problema';
      confirmarEntao(forcarComProblema ? m.confirmarAprovarComProblema : m.confirmarForcar, true, function () {
        executar(d.aprovar(troca.troca_id, true, true), btn, ctx, desfazer, true);   // força também recalcula a escala → véu
      });
    } else if (acao === 'cancelar-alteracao') {
      /* a alteração esperando não mexe na escala: a troca de antes continua */
      confirmarEntao(m.confirmarCancelarAlteracao, true, function () { executar(d.cancelar(troca.troca_id), btn, ctx); });
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

    /* aceita quem foi chamado; cancela o pedido quem pediu (na alteração, só a alteração) */
    var souChamado = ctx.cpf && ctx.cpf === quemAceita(troca);
    var souQuemPediu = ctx.cpf && ctx.cpf === quemPediu(troca);
    var cancelarPedido = troca.substitui_troca_id ? 'cancelar-alteracao' : 'cancelar';
    var admin = adminDaTroca(troca, ctx);
    var usar = {};
    if (troca.status === 'pendente_confirmacao') {
      if (souChamado) { usar.aceitar = true; usar.recusar = true; }
      if (souQuemPediu) usar[cancelarPedido] = true;
      if (admin) usar['aprovar-forcar'] = true;   /* admin aprova sem esperar o solicitado, inclusive a troca da qual participa */
    } else if (troca.status === 'pendente_aprovacao') {
      if (admin) { usar.aprovar = true; usar['recusar-admin'] = true; }   /* o admin decide inclusive a troca da qual participa */
      if (souQuemPediu) usar[cancelarPedido] = true;
    } else if (troca.status === 'aprovada' && admin) {
      usar.cancelar = true;
    }
    /* o aceite de quem olha faltando no registro (inclusive na aprovada) */
    if (aceitePendente(troca, ctx.cpf)) usar['aceitar-depois'] = true;
    /* o registro técnico: os dois militares e o administrador da área, em qualquer situação */
    var participa = !!ctx.cpf && (ctx.cpf === troca.solicitante_cpf || ctx.cpf === troca.parceiro_cpf);
    usar['imprimir-registro'] = !!RW.trocasRegistroPdf && (participa || admin);
    usar.editar = comEditar && podeEditar(troca, ctx);
    var espacador = frag.querySelector('[data-espacador]');
    if (espacador && !usar['imprimir-registro']) espacador.parentNode.removeChild(espacador);

    ['imprimir-registro', 'editar', 'cancelar-alteracao', 'aceitar', 'aceitar-depois', 'recusar', 'aprovar-forcar', 'aprovar', 'recusar-admin', 'cancelar'].forEach(function (acao) {
      var btn = frag.querySelector('[data-acao="' + acao + '"]');
      if (!btn) return;
      if (!usar[acao]) { if (btn.parentNode) btn.parentNode.removeChild(btn); return; }
      btn.addEventListener('click', function () { despachar(acao, troca, ctx, btn); });
      /* Aprovar (e Aprovar com pendências) depende da análise (aviso "pode quebrar a escala"): trava até ela chegar */
      if (acao === 'aprovar' || acao === 'aprovar-forcar') { btnAprovar = btn; btn.disabled = true; }
    });

    rodape.appendChild(frag);
    /* o rodapé nasce escondido (geral-painel.limparConteudo); reexibe quando há ação, esconde quando não há */
    rodape.classList.toggle('oculto', rodape.children.length === 0);
  }

  /* ---------- quem faz o quê ---------- */
  /* quem aceita: o solicitado, ou o solicitante quando foi o solicitado quem alterou; quem pediu é o outro */
  function quemAceita(troca) { return troca.confirma_cpf || troca.parceiro_cpf; }
  function quemPediu(troca) { return quemAceita(troca) === troca.solicitante_cpf ? troca.parceiro_cpf : troca.solicitante_cpf; }
  /* quem administra um dos dois militares: na Pendências (ctx.decidir) a lista já vem só com o que ele
     decide; nas outras, a área de qualquer um dos dois (pela unidade nos aceites; o banco confere de novo) */
  function adminDaTroca(troca, ctx) {
    return !!ctx.ehAdmin && (!!ctx.decidir || RW.trocasFormato.daMinhaArea(troca));
  }
  /* editam os dois militares e o admin da área, na troca em aberto ou aprovada, uma alteração por vez */
  function podeEditar(troca, ctx) {
    if (['pendente_confirmacao', 'pendente_aprovacao', 'aprovada'].indexOf(troca.status) < 0) return false;
    if (troca.alteracao_pendente_id) return false;
    var participa = !!ctx.cpf && (ctx.cpf === troca.solicitante_cpf || ctx.cpf === troca.parceiro_cpf);
    return participa || adminDaTroca(troca, ctx);
  }

  /* ---------- abrir ---------- */
  var subtituloLeitura = '';
  var comEditar = false;   // o Editar só existe onde está o formulário (a página Trocas, com o molde do pedido)

  /* a leitura: o pedido, as ações e, na troca em aberto, a Análise e o "Como fica a escala" */
  function desenharLeitura(troca, ctx) {
    RW.painel.definirTitulos(msg().painelTitulo, subtituloLeitura);
    montarCorpo(troca, ctx);
    montarAcoes(troca, ctx);
    if (troca.status === 'pendente_confirmacao' || troca.status === 'pendente_aprovacao') {
      carregarAnalise(troca);
      /* o dia inteiro como fica: fechado; só lê se abrirem */
      RW.decisao.escala(partes, function () { return RW.rpc('pedido_escala_comparar', { p_tipo: 'troca', p_id: troca.troca_id }); });
    }
  }

  /* Editar: o formulário no lugar da leitura; quem participa propõe, o admin de fora da troca altera direto */
  function abrirEdicao(troca, ctx) {
    partes = null;
    btnAprovar = null;
    var participa = !!ctx.cpf && (ctx.cpf === troca.solicitante_cpf || ctx.cpf === troca.parceiro_cpf);
    RW.trocasEditar.abrir(troca, {
      admin: !participa && adminDaTroca(troca, ctx),
      aoSalvar: function (r) {
        RW.painel.fechar();
        if (ctx.aoMudar) ctx.aoMudar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Trocas' });
      }
    });
  }

  function abrir(troca, ctx) {
    if (!RW.painel || !troca) return;
    /* o registro de várias trocas tem o painel próprio (a decisão vale para o registro inteiro) */
    if (troca.registro_varias && RW.trocasPainelVarias) { RW.trocasPainelVarias.abrir(troca, ctx); return; }
    ctx = ctx || {};
    var situacao = fmt().situacao(troca.status, !!troca.substitui_troca_id).texto;
    subtituloLeitura = ctx.posicao ? RW.mensagens.decisao.posicao(situacao, ctx.posicao.n, ctx.posicao.total) : situacao;
    /* o Editar só aparece onde o formulário existe (a página Trocas, com o molde do pedido);
       o trocas-editar.js continua carregado depois de sair da página */
    comEditar = !!RW.trocasEditar && !!document.getElementById('tpl-troca-solicitar');
    RW.painel.abrir({
      titulo: msg().painelTitulo,
      tituloExtra: RW.mensagens.decisao.tituloPelotao(troca.pelotoes),
      subtitulo: subtituloLeitura,
      aoMudarModo: function (modo) {
        if (trocaAtual !== troca) return;
        if (modo === 'editar') abrirEdicao(troca, ctx); else desenharLeitura(troca, ctx);
      },
      /* o X e o Esc durante a edição: com algo mudado, confirma o descarte */
      aoTentarFechar: function () { return comEditar && RW.painel.modo() === 'editar' && RW.trocasEditar.guardaFechar(); },
      aoFechar: function () {
        trocaAtual = null; partes = null;
        if (comEditar) RW.trocasEditar.encerrar();
        if (ctx.aoFechar) ctx.aoFechar();
      }
    });
    /* depois do abrir: reabrir outra troca por cima dispara o aoFechar anterior
       (que zera trocaAtual) dentro do abrir — setar aqui preserva a troca nova */
    trocaAtual = troca;
    desenharLeitura(troca, ctx);
  }

  RW.trocasPainel = {
    abrir: abrir,
    acao: function (nome, troca, ctx, botao) { (troca.registro_varias ? RW.trocasPainelVarias.acao : despachar)(nome, troca, ctx || {}, botao); },
    /* as peças que o painel do registro de várias trocas (trocas-painel-varias.js) também usa */
    pecas: { quando: quando, linhaAceite: linhaAceite, nota: nota, registroEParte: registroEParte, confirmarEntao: confirmarEntao, executar: executar }
  };
})();
