/* ============================================================
   NOVA DISTRIBUIÇÃO — as versões: a em vigor e a mudança agendada
   O aviso do topo ("Mudança agendada para 10/11/2026" ou "Você está
   vendo a mudança agendada"), com Ver a mudança / Voltar para a em
   vigor, Mudar a data (o modal padrão de data, já com a data dela)
   e Cancelar a mudança (confirma). O Salvar (as substituições vão
   junto): na mudança agendada, ou só com substituições, grava direto;
   na em vigor, pede a prévia ao banco (o que muda, o que vai para a
   agendada e os conflitos), abre o modal de data com esse resumo e
   uma caixa de marcar por conflito, e grava a partir da data
   escolhida. E o começo da unidade (com os dados de hoje ou em
   branco). Quem chama passa o contexto: { dados, unidadeId,
   vendoAgendada, itens(), substituicoes(), carregar(versaoId),
   confirmar(seguir), falha(r), semConexao() }.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function D() { return RosterWork.novaDistribuicaoDados; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function br(iso) { return RosterWork.data.isoParaBR(iso); }

  /* "a, b e c" */
  function juntar(itens) {
    var L = M().lista;
    if (itens.length < 2) return itens[0] || '';
    return itens.slice(0, -1).join(L.virgula) + L.e + itens[itens.length - 1];
  }

  function aposGravar(c, r, versaoId) {
    RosterWork.liberarTela();
    if (!r || !r.success) { c.falha(r); return; }
    /* a unidade ligada tem a escala refeita em blocos: o resto termina em segundo plano */
    if (RosterWork.marcarRecalculoPendente) RosterWork.marcarRecalculoPendente();
    if (RosterWork.drenarRecalculo) RosterWork.drenarRecalculo();
    if (r.log) RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
    c.carregar(versaoId || (c.vendoAgendada ? c.dados.atual.id : null));   /* só substituições: fica na versão vista */
  }
  function semRede(c) { RosterWork.liberarTela(); c.semConexao(); }

  /* ---------- o aviso do topo ---------- */

  function aviso(conteudo, c) {
    var ag = c.dados && c.dados.agendada;
    if (!ag) return;
    var no = P().tpl('agendada');
    var data = br(ag.inicio);
    var vendo = !!c.vendoAgendada;
    no.querySelector('.nova-distribuicao-aviso-titulo').textContent = P().texto(vendo ? M().vendoTitulo : M().avisoTitulo, { data: data });
    no.querySelector('.nova-distribuicao-aviso-texto').textContent = vendo ? M().vendoTexto
      : (ag.mudancas || []).length ? P().texto(M().avisoTexto, { lista: juntar(ag.mudancas) }) : M().avisoTextoGeral;
    var ver = no.querySelector('.nova-distribuicao-aviso-ver');
    var voltar = no.querySelector('.nova-distribuicao-aviso-voltar');
    ver.classList.toggle('oculto', vendo);
    voltar.classList.toggle('oculto', !vendo);
    ver.addEventListener('click', function () { c.confirmar(function () { c.carregar(ag.id); }); });
    voltar.addEventListener('click', function () { c.confirmar(function () { c.carregar(null); }); });
    no.querySelector('.nova-distribuicao-aviso-data').addEventListener('click', function () { mudarData(c, ag); });
    no.querySelector('.nova-distribuicao-aviso-cancelar').addEventListener('click', function () { cancelar(c, ag); });
    conteudo.appendChild(no);
  }

  function mudarData(c, ag) {
    c.confirmar(function () {
      RosterWork.pedirData({
        titulo: M().mudarDataTitulo, mensagem: M().mudarDataMensagem, data: ag.inicio, textoConfirmar: M().botaoSalvar,
        aoConfirmar: function (iso) {
          RosterWork.bloquearTela();
          D().agendadaData(c.unidadeId, iso).then(function (r) {
            aposGravar(c, r, c.vendoAgendada && r ? r.periodo_id : null);
          }, function () { semRede(c); });
        }
      });
    });
  }

  function cancelar(c, ag) {
    c.confirmar(function () {
      RosterWork.confirmar({
        tipo: 'aviso', mensagem: P().texto(M().cancelarConfirmar, { data: br(ag.inicio) }),
        textoConfirmar: M().botaoCancelarMudanca, textoCancelar: M().botaoManter,
        aoConfirmar: function () {
          RosterWork.bloquearTela();
          D().agendadaCancelar(c.unidadeId).then(function (r) { aposGravar(c, r, null); }, function () { semRede(c); });
        }
      });
    });
  }

  /* ---------- o Salvar ---------- */

  /* o resumo dentro do modal de data: o que muda (também as substituições), o que vai para a agendada e os
     conflitos para escolher (a escolha fica em escolhidos, como "versão|chave") */
  function montarResumo(itens, escolhidos, substituicoes) {
    var no = P().tpl('salvar');
    var varias = itens.length > 1;
    var lista = no.querySelector('.nova-distribuicao-salvar-lista');
    var vaiLista = no.querySelector('.nova-distribuicao-salvar-vai-lista');
    var conflitos = no.querySelector('.nova-distribuicao-salvar-conflitos-lista');
    var agendada = null;
    function linha(destino, unidade, frase) {
      var p = P().tpl('salvar-item');
      p.textContent = varias ? unidade + ': ' + frase : frase;
      destino.appendChild(p);
    }
    itens.forEach(function (it) {
      (it.mudancas || []).forEach(function (m) { linha(lista, it.unidade, m.rotulo); });
      if (it === itens[0]) (substituicoes || []).forEach(function (frase) { linha(lista, it.unidade, frase); });
      (it.vai || []).forEach(function (frase) { linha(vaiLista, it.unidade, frase); });
      if (it.agendada) agendada = it.agendada;
      (it.conflitos || []).forEach(function (cf) {
        var botao = P().tpl('conflito');
        var chave = it.periodo_id + '|' + cf.chave;
        botao.querySelector('.nova-distribuicao-conflito-rotulo').textContent = varias ? it.unidade + ': ' + cf.rotulo : cf.rotulo;
        botao.querySelector('.nova-distribuicao-conflito-conserto').textContent = cf.conserto;
        botao.querySelector('.nova-distribuicao-conflito-agendada').textContent = cf.agendada;
        botao.addEventListener('click', function () {
          var marcado = botao.getAttribute('aria-checked') !== 'true';
          botao.setAttribute('aria-checked', marcado ? 'true' : 'false');
          botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcado);
          var i = escolhidos.indexOf(chave);
          if (marcado && i < 0) escolhidos.push(chave);
          if (!marcado && i >= 0) escolhidos.splice(i, 1);
        });
        conflitos.appendChild(botao);
      });
    });
    var vai = no.querySelector('.nova-distribuicao-salvar-vai');
    vai.classList.toggle('oculto', !vaiLista.children.length);
    if (agendada) no.querySelector('.nova-distribuicao-salvar-vai-titulo').textContent = P().texto(M().vaiTitulo, { data: br(agendada) });
    no.querySelector('.nova-distribuicao-salvar-conflitos').classList.toggle('oculto', !conflitos.children.length);
    return no;
  }

  function salvar(c, botao) {
    var itens = c.itens();
    var subs = c.substituicoes();
    if (!itens.length && !subs.length) return;
    RosterWork.iniciarCarregando(botao);
    if (c.vendoAgendada || !itens.length) {
      /* a mudança agendada já tem a data dela, e as substituições têm as delas: grava direto */
      D().salvar(itens, null, null, false, subs).then(function (r) {
        RosterWork.pararCarregando(botao);
        aposGravar(c, r, r && r.periodo_id);
      }, function () { RosterWork.pararCarregando(botao); semRede(c); });
      return;
    }
    D().salvar(itens, null, null, true, subs).then(function (previa) {
      RosterWork.pararCarregando(botao);
      if (!previa || !previa.success) { c.falha(previa); return; }
      var escolhidos = [];
      RosterWork.pedirData({
        sugerida: true, titulo: M().salvarTitulo, sugestaoAntes: M().salvarAntes, sugestaoDepois: M().salvarDepois,
        textoConfirmar: M().botaoSalvar, conteudo: montarResumo(previa.itens || [], escolhidos, previa.substituicoes),
        aoConfirmar: function (iso) {
          RosterWork.bloquearTela();
          D().salvar(itens, iso, escolhidos, false, subs).then(function (r) { aposGravar(c, r, null); }, function () { semRede(c); });
        }
      });
    }, function () { RosterWork.pararCarregando(botao); c.semConexao(); });
  }

  /* ---------- o começo da unidade: com os dados de hoje (postos e modelo) ou em branco ---------- */

  function comecar(c, unidadeId, botao) {
    c.confirmar(function () {
      if (botao) RosterWork.iniciarCarregando(botao);
      D().copiarHoje(unidadeId).then(function (r) {
        if (botao) RosterWork.pararCarregando(botao);
        if (!r || !r.success) { c.falha(r); return; }
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        c.carregar(null);
      }, function () {
        if (botao) RosterWork.pararCarregando(botao);
        c.semConexao();
      });
    });
  }

  /* a unidade ainda sem respostas: o convite para começar (com os dados de hoje ou em branco) */
  function semRespostas(c, vazio) {
    var hoje = !!c.dados.tem_dados_hoje;
    vazio.querySelectorAll('.nova-distribuicao-sem-respostas-copiar').forEach(function (n) { n.classList.toggle('oculto', !hoje); });
    vazio.querySelectorAll('.nova-distribuicao-sem-respostas-branco').forEach(function (n) { n.classList.toggle('oculto', hoje); });
    vazio.querySelector('.nova-distribuicao-copiar').addEventListener('click', function () { comecar(c, c.unidadeId, this); });
  }

  window.RosterWork.novaDistribuicaoVersoes = {
    aviso: aviso, salvar: salvar, comecar: comecar, semRespostas: semRespostas
  };
})();
