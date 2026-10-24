/* ============================================================
   NOVA DISTRIBUIÇÃO — Novo período e Excluir período
   O Novo período abre no painel da direita: começo e fim (máscara e
   calendário do jeito padrão, ou Sem fim) e de qual período copiar as
   respostas. O Excluir pede confirmação. As regras de datas (7 dias,
   divisão do período de antes) moram no banco; a tela só confere o
   preenchimento. Quem chama passa o contexto:
   { dados, periodo, unidadeId, aoTerminar(periodoId), falha(r), semConexao() }.
   Também desenha o período na barra (o nome, as setas e a lista).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var form = null;   /* o Novo período aberto no painel */

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function B() { return RosterWork.mensagens.botoes; }
  function D() { return RosterWork.novaDistribuicaoDados; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function el(id) { return document.getElementById(id); }

  function rotulo(p) {
    if (!p) return '';
    var br = RosterWork.data.isoParaBR;
    return p.fim ? P().texto(M().periodoIntervalo, { inicio: br(p.inicio), fim: br(p.fim) })
                 : P().texto(M().periodoDesde, { inicio: br(p.inicio) });
  }

  /* o período na barra: o nome, as setas e a lista; escolher outro chama aoEscolher(p) */
  function desenharBarra(periodos, atual, aoEscolher) {
    var i = atual ? periodos.map(function (p) { return p.id; }).indexOf(atual.id) : -1;
    el('nova-distribuicao-periodo').classList.toggle('oculto', !atual);
    el('nova-distribuicao-periodo-nome').textContent = rotulo(atual);
    el('nova-distribuicao-periodo-anterior').disabled = i <= 0;
    el('nova-distribuicao-periodo-proximo').disabled = i < 0 || i >= periodos.length - 1;
    var lista = el('nova-distribuicao-periodo-lista');
    lista.textContent = '';
    periodos.forEach(function (p) {
      var item = P().tpl('periodo-item');
      item.textContent = rotulo(p);
      if (atual && p.id === atual.id) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () { aoEscolher(p); });
      lista.appendChild(item);
    });
    el('nova-distribuicao-novo-periodo').disabled = !atual;
    el('nova-distribuicao-excluir-periodo').disabled = !atual || periodos.length < 2;
  }

  function erro(input, frase) {
    var campo = input.closest('.campo');
    campo.classList.toggle('campo--erro', !!frase);
    campo.querySelector('.campo-erro-texto').textContent = frase || '';
  }

  function abrirNovo(c) {
    var painel = RosterWork.painel;
    var caixa = P().tpl('novo-periodo');
    var rodape = P().tpl('novo-periodo-rodape');
    var inicio = caixa.querySelector('.nova-distribuicao-inicio');
    var fim = caixa.querySelector('.nova-distribuicao-fim');
    var semFim = caixa.querySelector('.nova-distribuicao-sem-fim');
    var origens = c.dados.periodos.map(function (p) { return { valor: p.id, texto: rotulo(p) }; });
    form = { semFim: true, origem: c.periodo.id, sujo: false };

    function montarOrigem() {
      var lugar = caixa.querySelector('[data-espaco="origem"]');
      lugar.textContent = '';
      lugar.appendChild(P().selecao(origens, form.origem, function (v) { form.origem = v; form.sujo = true; montarOrigem(); }, { rotulo: M().novoPeriodoOrigem }));
    }
    function marcarSemFim() {
      P().marcar(semFim, form.semFim, null, false);
      caixa.querySelector('.nova-distribuicao-fim-campo').classList.toggle('oculto', form.semFim);
    }

    painel.abrir({ titulo: M().novoPeriodoTitulo, subtitulo: c.dados.unidade.nome, aoFechar: function () { form = null; } });
    painel.corpo().appendChild(caixa);
    painel.rodape().appendChild(rodape);
    painel.rodape().classList.remove('oculto');
    [inicio, fim].forEach(function (input) {
      RosterWork.campos.ligarData(input);
      input.addEventListener('input', function () { form.sujo = true; erro(input, ''); });
    });
    montarOrigem();
    marcarSemFim();
    semFim.addEventListener('click', function () { form.semFim = !form.semFim; form.sujo = true; marcarSemFim(); });

    rodape.querySelector('.nova-distribuicao-painel-cancelar').addEventListener('click', function () { painel.fechar(); });
    var criar = rodape.querySelector('.nova-distribuicao-painel-criar');
    criar.addEventListener('click', function () {
      var de = RosterWork.data.paraISO(inicio.value);
      var ate = form.semFim ? null : RosterWork.data.paraISO(fim.value);
      if (!de) { erro(inicio, M().erroInicio); return; }
      if (!form.semFim && !ate) { erro(fim, M().erroFim); return; }
      if (ate && ate < de) { erro(fim, M().erroOrdemDatas); return; }
      RosterWork.iniciarCarregando(criar);
      D().criarPeriodo(c.unidadeId, de, ate, form.origem).then(function (r) {
        RosterWork.pararCarregando(criar);
        if (!r || !r.success) { c.falha(r); return; }
        form = null;
        painel.fechar();
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        c.aoTerminar(r.periodo_id);
      }, function () {
        RosterWork.pararCarregando(criar);
        c.semConexao();
      });
    });
  }

  function excluir(c) {
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: P().texto(M().excluirPeriodo, { periodo: rotulo(c.periodo) }),
      textoConfirmar: M().botaoExcluirPeriodo, textoCancelar: B().cancelar,
      aoConfirmar: function () {
        RosterWork.bloquearTela();
        D().excluirPeriodo(c.periodo.id).then(function (r) {
          RosterWork.liberarTela();
          if (!r || !r.success) { c.falha(r); return; }
          RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
          c.aoTerminar(null);
        }, function () {
          RosterWork.liberarTela();
          c.semConexao();
        });
      }
    });
  }

  window.RosterWork.novaDistribuicaoPeriodo = {
    rotulo: rotulo,
    desenharBarra: desenharBarra,
    abrirNovo: abrirNovo,
    excluir: excluir,
    /* o painel do Novo período tem algo digitado (para o guarda de saída) */
    sujo: function () { return !!(form && form.sujo && RosterWork.painel.estaAberto()); }
  };
})();
