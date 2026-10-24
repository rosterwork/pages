/* ============================================================
   NOVA DISTRIBUIÇÃO — os períodos
   O período na barra (o nome, as setas e a lista com o que muda em
   cada um), o primeiro período (com os dados de hoje ou em branco),
   o Novo período e o Excluir. O Novo abre no painel da direita só
   com as datas (máscara e calendário, ou Sem fim); o Continuar leva
   o período novo para a tela como rascunho, e o Salvar da página o
   cria (criar). As regras de datas (7 dias, divisão do período de
   antes, igual ao que já vale) moram no banco. Quem chama passa o
   contexto: { dados, periodo, unidadeId, aoTerminar(periodoId),
   aoContinuar(inicio, fim), confirmar(seguir), falha(r), semConexao() }.
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

  /* o período que vale num dia (senão o último antes dele, senão o primeiro) */
  function base(periodos, dia) {
    return periodos.filter(function (p) { return p.inicio <= dia && (!p.fim || p.fim >= dia); })[0]
      || periodos.filter(function (p) { return p.inicio < dia; }).pop() || periodos[0];
  }

  /* o período antes (passo −1) ou depois (+1) do atual */
  function vizinho(periodos, atual, passo) {
    return periodos[periodos.map(function (p) { return p.id; }).indexOf(atual && atual.id) + passo];
  }

  /* o período na barra: o nome, as setas e a lista (com o que muda); escolher outro chama aoEscolher(p) */
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
      item.querySelector('.nova-distribuicao-periodo-datas').textContent = rotulo(p);
      item.querySelector('.nova-distribuicao-periodo-muda').textContent = (p.mudancas || []).length
        ? P().texto(M().periodoMuda, { lista: p.mudancas.join(', ') }) : M().periodoPrimeiro;
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
    form = { semFim: true, sujo: false };

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
    marcarSemFim();
    semFim.addEventListener('click', function () { form.semFim = !form.semFim; form.sujo = true; marcarSemFim(); });

    rodape.querySelector('.nova-distribuicao-painel-cancelar').addEventListener('click', function () { painel.fechar(); });
    rodape.querySelector('.nova-distribuicao-painel-criar').addEventListener('click', function () {
      var de = RosterWork.data.paraISO(inicio.value);
      var ate = form.semFim ? null : RosterWork.data.paraISO(fim.value);
      if (!de) { erro(inicio, M().erroInicio); return; }
      if (!form.semFim && !ate) { erro(fim, M().erroFim); return; }
      if (ate && ate < de) { erro(fim, M().erroOrdemDatas); return; }
      form = null;
      painel.fechar();
      c.aoContinuar(de, ate);
    });
  }

  /* o Salvar do período novo: a parte da companhia (quando mudou) e depois o período, com as respostas da tela */
  function criar(c, respostas, daCia, botao) {
    RosterWork.iniciarCarregando(botao);
    var antes = daCia ? D().salvar([daCia]) : Promise.resolve({ success: true });
    antes.then(function (rc) {
      if (!rc || !rc.success) { RosterWork.pararCarregando(botao); c.falha(rc); return; }
      return D().criarPeriodo(c.unidadeId, c.periodo.inicio, c.periodo.fim, respostas).then(function (r) {
        RosterWork.pararCarregando(botao);
        if (!r || !r.success) { c.falha(r); return; }
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        c.aoTerminar(r.periodo_id);
      });
    }).catch(function () {
      RosterWork.pararCarregando(botao);
      c.semConexao();
    });
  }

  /* o primeiro período da unidade: com os dados de hoje (postos e modelo) ou em branco */
  function comecar(c, unidadeId, botao) {
    c.confirmar(function () {
      if (botao) RosterWork.iniciarCarregando(botao);
      D().copiarHoje(unidadeId).then(function (r) {
        if (botao) RosterWork.pararCarregando(botao);
        if (!r || !r.success) { c.falha(r); return; }
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        c.aoTerminar(c.periodo && c.periodo.id);
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
    base: base,
    vizinho: vizinho,
    desenharBarra: desenharBarra,
    abrirNovo: abrirNovo,
    criar: criar,
    comecar: comecar,
    semRespostas: semRespostas,
    excluir: excluir,
    /* o painel do Novo período tem algo digitado (para o guarda de saída) */
    sujo: function () { return !!(form && form.sujo && RosterWork.painel.estaAberto()); }
  };
})();
