/* ============================================================
   TROCAS — o painel do registro de várias trocas (geral-decisao)
   O trocas-painel.js passa para cá a troca que é de um registro de
   várias trocas (registro_varias): a decisão vale para o registro
   inteiro. O pedido em caixas (Escalas trocadas: o RW nº, a Parte e
   uma linha por dia, lidas do fn_trocas_registro; o saldo, quando a
   conta não fecha; Aceites e aprovação: todos os militares), a
   Análise e o "Como fica a escala" do registro inteiro, e o rodapé
   com as ações do papel e da situação de quem olha. Editar (no rodapé,
   só na página Trocas): a aba Várias trocas em modo Editar, com o
   plano que vale hoje (trocas-varias-editar.js), no painel largo.
   Expõe RosterWork.trocasPainelVarias.abrir(troca, ctx) e acao(nome, troca, ctx, botao)
   (as mesmas ações fora do painel: o cartão que abre ali mesmo)
     troca = uma troca do registro (a primeira, nas Pendências);
     ctx = o mesmo do trocas-painel ({ cpf, ehAdmin, decidir?,
     posicao?, aoMudar(), aoFechar() })
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var atual = null;        // a troca aberta
  var partes = null;       // as partes do painel (geral-decisao)
  var registro = null;     // o registro lido do banco (os dias e o saldo)
  var btnAprovar = null;   // travado até a análise chegar
  var comEditar = false;   // o Editar só na página Trocas, onde está o molde da aba Várias trocas

  function P() { return RW.trocasPainel.pecas; }
  function m() { return RW.mensagens.trocas; }
  function mv() { return RW.mensagens.trocas.varias; }
  function rw(t) { return m().registroNumero(t.registro_numero, t.registro_ano); }

  /* ---------- quem é quem no registro ---------- */
  function aceiteDe(t, cpf) { return (t.aceites || []).filter(function (a) { return a.cpf === cpf; })[0] || null; }
  function quemPediu(t) { var a = (t.aceites || []).filter(function (x) { return x.papel === 'pediu'; })[0]; return a ? a.cpf : null; }
  function participa(t, cpf) { return !!cpf && !!aceiteDe(t, cpf); }
  function emAberto(t) { return t.status === 'pendente_confirmacao' || t.status === 'pendente_aprovacao'; }
  function aceitePendente(t, cpf) {
    var a = aceiteDe(t, cpf);
    return !!a && !a.aceito_em && (emAberto(t) || t.status === 'aprovada');
  }
  /* na Pendências (ctx.decidir) a fila já vem só com o que ele decide; nas outras, a área de qualquer militar do registro
     (pela unidade nos aceites; o banco confere troca a troca) */
  function admin(t, ctx) { return !!ctx.ehAdmin && (!!ctx.decidir || RW.trocasFormato.daMinhaArea(t)); }

  /* ---------- o corpo ---------- */
  function caixaEscalas(t) {
    var caixa = RW.decisao.caixa({ titulo: mv().caixaEscalas, extra: P().registroEParte(t.registro_numero, t.registro_ano, t.parte_numero, t.parte_ano) });
    if (!caixa) return null;
    ((registro && registro.itens) || []).forEach(function (i) {
      var linha = RW.tpl('tpl-troca-varias-escala');
      linha.querySelector('.decisao-caixa-data').textContent = RW.data.comDiaSemana(String(i.data).slice(0, 10));
      linha.querySelector('.decisao-caixa-extra').textContent = mv().escalaFrase(i.cumpre, i.no_lugar_de);
      caixa.appendChild(linha);
    });
    return caixa;
  }
  function caixaAceites(t) {
    var caixa = RW.decisao.caixa({ titulo: m().caixaAceites });
    if (!caixa) return null;
    (t.aceites || []).forEach(function (a) {
      var q = a.aceito_em ? P().quando(a.aceito_em) : null;
      var acao = !q ? m().aceitePendente : (a.papel === 'pediu' ? m().aceiteSolicitou(q.dia, q.hora) : m().aceiteAceitou(q.dia, q.hora));
      P().linhaAceite(caixa, a.titulo || '', acao, q ? m().seloAceitou : m().seloAceitePendente, q ? 'selo--sucesso' : 'selo--alerta');
    });
    if (t.status === 'aprovada' && t.aprovado_em) {
      var qa = P().quando(t.aprovado_em);
      P().linhaAceite(caixa, t.aprovado_por_titulo || m().aceiteAdministracao, m().aceiteAprovou(qa.dia, qa.hora), m().seloAprovou, 'selo--sucesso');
    } else if (emAberto(t)) {
      P().linhaAceite(caixa, m().aceiteAdministracao, m().aceiteAguardandoAprovacao, m().seloAceitePendente, 'selo--alerta');
    }
    return caixa;
  }
  function montarCorpo(t, ctx) {
    partes = RW.decisao.montar(RW.painel.corpo());
    if (!partes) return;
    if (aceitePendente(t, ctx.cpf)) partes.pedido.appendChild(P().nota(t.status === 'aprovada' ? mv().faltaAceiteAprovada : mv().faltaAceite));
    var escalas = caixaEscalas(t);
    if (escalas) partes.pedido.appendChild(escalas);
    /* a conta que não fecha: o saldo de horas do registro (como no registro técnico) */
    ((registro && registro.saldo) || []).forEach(function (s) {
      partes.pedido.appendChild(P().nota(mv().saldoRegistro(s.deve, RW.tempo.horas(s.minutos), s.a)));
    });
    var aceites = caixaAceites(t);
    if (aceites) partes.pedido.appendChild(aceites);
  }

  /* ---------- as ações ---------- */
  function desfazerAprovacao(t, ctx) {
    return function () {
      if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();
      return RW.trocasDados.variasCancelar(t.registro_id).then(function (res) {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (res && res.ok && ctx.aoMudar) ctx.aoMudar();
        return res;
      }).catch(function (e) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); throw e; });
    };
  }
  function despachar(acao, t, ctx, btn) {
    var d = RW.trocasDados, reg = t.registro_id, n = rw(t), executar = P().executar, confirmar = P().confirmarEntao;
    var desfazer = { desfazer: desfazerAprovacao(t, ctx) };
    var problema = t._analise && t._analise.veredito === 'problema';
    if (acao === 'editar') {
      RW.painel.editar();   // o aoMudarModo('editar') abre o Editar no lugar da leitura
    } else if (acao === 'imprimir-registro') {
      RW.trocasRegistroPdf.imprimir(t.troca_id, btn);
    } else if (acao === 'aceitar') {
      confirmar(mv().confirmarAceitar(n), false, function () { executar(d.variasResponder(reg, true), btn, ctx); });
    } else if (acao === 'recusar') {
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.variasResponder(reg, false, motivo), botao, ctx); });
    } else if (acao === 'aceitar-depois') {
      confirmar(mv().confirmarAceitarDepois(n), false, function () { executar(d.aceitar(t.troca_id), btn, ctx); });
    } else if (acao === 'aprovar') {
      confirmar(problema ? m().confirmarAprovarComProblema : mv().confirmarAprovar(n), problema, function () {
        executar(d.variasAprovar(reg, true), btn, ctx, desfazer, true);   // aprova e refaz a escala: véu
      });
    } else if (acao === 'aprovar-forcar') {
      confirmar(problema ? m().confirmarAprovarComProblema : mv().confirmarForcar(n), true, function () {
        executar(d.variasAprovar(reg, true, true), btn, ctx, desfazer, true);
      });
    } else if (acao === 'recusar-admin') {
      RW.decisao.recusar(partes, function (motivo, botao) { executar(d.variasAprovar(reg, false, false, motivo), botao, ctx); });
    } else if (acao === 'cancelar-pedido') {
      confirmar(mv().confirmarCancelar(n), true, function () { executar(d.variasCancelar(reg), btn, ctx); });
    } else if (acao === 'cancelar') {
      confirmar(mv().confirmarCancelar(n), true, function () { executar(d.variasCancelar(reg), btn, ctx, null, true); });   // desfaz a escala: véu
    }
  }
  function montarAcoes(t, ctx) {
    var rodape = RW.painel.rodape();
    var frag = document.getElementById('tpl-troca-varias-registro-acoes').content.cloneNode(true);
    var usar = {}, ehAdmin = admin(t, ctx), eu = ctx.cpf, pediu = !!eu && quemPediu(t) === eu;
    btnAprovar = null;
    if (t.status === 'pendente_confirmacao') {
      if (aceitePendente(t, eu)) { usar.aceitar = true; usar.recusar = true; }
      if (pediu) usar['cancelar-pedido'] = true;
      if (ehAdmin) usar['aprovar-forcar'] = true;
    } else if (t.status === 'pendente_aprovacao') {
      if (ehAdmin) { usar.aprovar = true; usar['recusar-admin'] = true; }
      if (pediu) usar['cancelar-pedido'] = true;
    } else if (t.status === 'aprovada') {
      if (ehAdmin) usar.cancelar = true;
      if (aceitePendente(t, eu)) usar['aceitar-depois'] = true;
    }
    usar['imprimir-registro'] = !!RW.trocasRegistroPdf && (participa(t, eu) || ehAdmin);
    usar.editar = comEditar && ['pendente_confirmacao', 'pendente_aprovacao', 'aprovada'].indexOf(t.status) >= 0 && (participa(t, eu) || ehAdmin);
    var espacador = frag.querySelector('[data-espacador]');
    if (espacador && !usar['imprimir-registro']) espacador.parentNode.removeChild(espacador);
    Array.prototype.forEach.call(frag.querySelectorAll('[data-acao]'), function (btn) {
      var acao = btn.getAttribute('data-acao');
      if (!usar[acao]) { btn.parentNode.removeChild(btn); return; }
      btn.addEventListener('click', function () { despachar(acao, t, ctx, btn); });
      if (acao === 'aprovar' || acao === 'aprovar-forcar') { btnAprovar = btn; btn.disabled = true; }
    });
    rodape.textContent = '';
    rodape.appendChild(frag);
    rodape.classList.toggle('oculto', rodape.children.length === 0);
  }

  /* ---------- a leitura: o pedido, as ações e, em aberto, a Análise e o "Como fica a escala" do registro ---------- */
  function carregarAnalise(t) {
    var minhas = partes;
    RW.decisao.analisando(minhas);
    RW.trocasDados.analisar(t.troca_id).then(function (r) {
      if (atual !== t) return;
      if (btnAprovar) btnAprovar.disabled = false;
      if (r && r.ok) t._analise = r;
      RW.decisao.analise(minhas, r && r.ok ? r : null, m().falhaAnalise);
    }).catch(function () {
      if (atual !== t) return;
      if (btnAprovar) btnAprovar.disabled = false;
      RW.decisao.analise(minhas, null, m().falhaAnalise);
    });
  }
  function desenharLeitura(t, ctx) {
    montarCorpo(t, ctx);
    montarAcoes(t, ctx);
    if (emAberto(t)) {
      carregarAnalise(t);
      RW.decisao.escala(partes, function () { return RW.rpc('pedido_escala_comparar', { p_tipo: 'troca', p_id: t.troca_id }); });
    }
  }

  /* ---------- o Editar: a aba Várias trocas com o plano de hoje (quem participa propõe; o admin de fora altera direto) ---------- */
  function abrirEdicao(t, ctx) {
    partes = null; btnAprovar = null;
    RW.trocasVariasEditar.abrir(t, {
      aoSalvar: function (r) {
        RW.painel.fechar();
        if (ctx.aoMudar) ctx.aoMudar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Trocas' });
      }
    });
  }

  /* ---------- abrir: lê o registro (os dias e o saldo) e desenha ---------- */
  function abrir(t, ctx) {
    ctx = ctx || {};
    var situacao = RW.trocasFormato.situacao(t.status, false).texto;
    var subtitulo = ctx.posicao ? RW.mensagens.decisao.posicao(situacao, ctx.posicao.n, ctx.posicao.total) : situacao;
    /* o Editar só na página Trocas, onde está o molde da aba Várias trocas (o JS da Trocas fica carregado depois de sair dela) */
    comEditar = !!RW.trocasVariasEditar && !!document.getElementById('tpl-troca-varias');
    RW.painel.abrir({
      titulo: mv().painelTitulo,
      tituloExtra: RW.mensagens.decisao.tituloPelotao(t.pelotoes),
      subtitulo: subtitulo,
      aoMudarModo: function (modo) {
        if (atual !== t) return;
        if (modo === 'editar') { abrirEdicao(t, ctx); return; }
        RW.painel.largo(false);   // a leitura volta ao painel normal
        desenharLeitura(t, ctx);
      },
      /* o X e o Esc durante a edição: com algo mudado, confirma o descarte */
      aoTentarFechar: function () { return comEditar && RW.painel.modo() === 'editar' && RW.trocasVariasEditar.guardaFechar(); },
      aoFechar: function () {
        atual = null; partes = null; registro = null;
        if (comEditar) RW.trocasVariasEditar.encerrar();
        if (ctx.aoFechar) ctx.aoFechar();
      }
    });
    atual = t;
    registro = null;
    var corpo = RW.painel.corpo(), carregando = RW.painel.criarCarregando();
    if (carregando) corpo.appendChild(carregando);
    RW.trocasDados.registro(t.troca_id).then(function (r) {
      if (atual !== t) return;
      registro = r && r.ok ? r : null;
      desenharLeitura(t, ctx);
    }).catch(function () {
      if (atual !== t) return;
      desenharLeitura(t, ctx);
    });
  }

  RW.trocasPainelVarias = { abrir: abrir, acao: despachar };
})();
