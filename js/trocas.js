/* ============================================================
   TROCAS — orquestrador da página
   Três visões: Todas (árvore de unidades — a troca fica na unidade
   de quem solicitou), Minhas (as trocas em que eu entro) e
   Pendentes (dívidas de devolução). "Solicitar" é o botão do
   cabeçalho (abre o formulário inline). As ações (aceitar / aprovar /
   aprovar sem confirmação / rejeitar / cancelar) ficam no painel,
   conforme o papel de quem olha.
   Registra RosterWork.paginas.trocas = { iniciar }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var estado = { aba: 'todas' };
  var conteudo = null;
  var contexto = null;
  var itemSelecionado = null;
  var ouvindoUnidades = false;
  var arvoreMontada = false;
  var reqSeq = 0;   // token de requisição das listas (ignora resposta antiga ao trocar de aba/unidade)

  function unidades() {
    try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : []; } catch (e) { return []; }
  }
  function fmt() { return RW.trocasFormato; }

  function limparSelecao() {
    if (itemSelecionado) { itemSelecionado.classList.remove('troca-item--selecionada'); itemSelecionado = null; }
  }

  function abrirTroca(item, troca) {
    /* abre primeiro: reabrir por cima dispara o aoFechar (limparSelecao) da troca anterior,
       que apagaria o destaque novo se marcássemos antes */
    if (RW.trocasPainel) RW.trocasPainel.abrir(troca, contexto);
    if (itemSelecionado) itemSelecionado.classList.remove('troca-item--selecionada');
    itemSelecionado = item;
    item.classList.add('troca-item--selecionada');
  }

  /* uma linha de troca (compartilhada por Todas e Minhas) */
  function montarItemTroca(troca) {
    var tpl = document.getElementById('tpl-troca-item');
    if (!tpl) return null;
    var item = tpl.content.cloneNode(true).firstElementChild;
    item.querySelector('.troca-item-a').textContent = fmt().nomeMilitar(troca.solicitante_grau, troca.solicitante_nome);
    item.querySelector('.troca-item-b').textContent = fmt().nomeMilitar(troca.parceiro_grau, troca.parceiro_nome);
    item.querySelector('.troca-item-meta').textContent = fmt().metaLista(troca);
    var selo = item.querySelector('.troca-item-situacao');
    var info = fmt().situacao(troca.status);
    selo.textContent = info.texto;
    selo.classList.add(info.classe);
    item.addEventListener('click', function () { abrirTroca(item, troca); });
    return item;
  }

  function mostrarVazio(lista, msg) {
    lista.textContent = '';
    var tpl = document.getElementById('tpl-troca-vazio');
    if (!tpl) return;
    var el = tpl.content.cloneNode(true).firstElementChild;
    el.textContent = msg || '';
    lista.appendChild(el);
  }
  function mostrarCarregando(lista) {
    lista.textContent = '';
    var tpl = document.getElementById('tpl-troca-vazio');
    if (!tpl) return;
    var el = tpl.content.cloneNode(true).firstElementChild;
    var pts = document.getElementById('carregando-pontos');
    if (pts) el.appendChild(pts.content.cloneNode(true));
    lista.appendChild(el);
  }

  /* ---------- Todas: árvore de unidades ---------- */
  function renderTrocasNaUnidade(container, unidade, trocas) {
    trocas.forEach(function (t) { var el = montarItemTroca(t); if (el) container.appendChild(el); });
  }
  function contagemTrocas(trocas) { return trocas.length === 1 ? '1 troca' : trocas.length + ' trocas'; }

  function montarArvoreTodas() {
    var alvo = conteudo.querySelector('#trocas-arvore');
    if (!alvo || !RW.arvoreUnidades) return;
    limparSelecao();
    arvoreMontada = true;
    RW.arvoreUnidades.montar(alvo, {
      rpcConteudo: 'fn_trocas_listar',
      chaveUnidade: 'solicitante_lotacao',
      corpoRpc: function () { return { p_contexto_ids: unidades() }; },
      textoContagem: contagemTrocas,
      renderConteudo: renderTrocasNaUnidade
    });
  }

  /* ---------- Minhas: lista das trocas em que eu entro ---------- */
  function carregarMinhas() {
    var lista = conteudo.querySelector('#trocas-minhas-lista');
    if (!lista) return;
    mostrarCarregando(lista);
    var req = ++reqSeq;
    RW.trocasDados.listar(unidades()).then(function (todas) {
      if (!document.contains(lista) || req !== reqSeq) return;
      if (!Array.isArray(todas)) { mostrarVazio(lista, RW.mensagens.trocas.falhaCarregar); return; }   // null = falha (Postgres devolve [] p/ vazio)
      var cpf = RosterWork.sessao.cpf();
      var minhas = todas.filter(function (t) {
        return t.solicitante_cpf === cpf || t.parceiro_cpf === cpf;
      });
      if (!minhas.length) { mostrarVazio(lista, RW.mensagens.trocas.vazio.minhas); return; }
      lista.textContent = '';
      minhas.forEach(function (t) { var el = montarItemTroca(t); if (el) lista.appendChild(el); });
    }).catch(function () { if (document.contains(lista) && req === reqSeq) mostrarVazio(lista, RW.mensagens.trocas.falhaCarregar); });
  }

  /* ---------- Pendentes: dívidas de devolução (cards) ---------- */
  function montarPendente(p) {
    var tpl = document.getElementById('tpl-troca-pendente');
    if (!tpl) return null;
    var el = tpl.content.cloneNode(true).firstElementChild;
    el.querySelector('.troca-pendente-devedor').textContent = fmt().nomeMilitar(p.devedor_grau, p.devedor_nome);
    el.querySelector('.troca-pendente-credor').textContent = fmt().nomeMilitar(p.credor_grau, p.credor_nome);
    el.querySelector('.troca-pendente-horas').textContent = RW.mensagens.trocas.pendHoras(Math.round((p.minutos || 0) / 60));
    var dias = (p.dias || []).map(function (d) { return fmt().dataCurta(d); }).join(', ');
    el.querySelector('.troca-pendente-dias-lista').textContent = dias;
    return el;
  }
  function carregarPendentes() {
    var lista = conteudo.querySelector('#trocas-pendentes-lista');
    if (!lista) return;
    mostrarCarregando(lista);
    var req = ++reqSeq;
    RW.trocasDados.pendencias().then(function (linhas) {
      if (!document.contains(lista) || req !== reqSeq) return;
      if (!Array.isArray(linhas)) { mostrarVazio(lista, RW.mensagens.trocas.falhaCarregar); return; }   // null = falha
      if (!linhas.length) { mostrarVazio(lista, RW.mensagens.trocas.vazio.pendentes); return; }
      lista.textContent = '';
      linhas.forEach(function (p) { var el = montarPendente(p); if (el) lista.appendChild(el); });
    }).catch(function () { if (document.contains(lista) && req === reqSeq) mostrarVazio(lista, RW.mensagens.trocas.falhaCarregar); });
  }

  /* ---------- troca de vista ---------- */
  function mostrarVista(nome) {
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    for (var i = 0; i < paineis.length; i++) {
      paineis[i].classList.toggle('oculto', nome !== paineis[i].getAttribute('data-aba-painel'));
    }
    var solic = conteudo.querySelector('[data-painel="solicitar"]');
    if (solic) solic.classList.toggle('oculto', nome !== 'solicitar');
  }

  function carregarAba(nome) {
    if (nome === 'todas') { if (arvoreMontada && RW.arvoreUnidades) RW.arvoreUnidades.recarregar(); else montarArvoreTodas(); }
    else if (nome === 'minhas') carregarMinhas();
    else if (nome === 'pendentes') carregarPendentes();
  }

  function aoTrocarAba(aba) {
    var nome = aba.getAttribute('data-aba');
    estado.aba = nome;
    mostrarVista(nome);
    carregarAba(nome);
  }

  /* vai para uma aba pelo código (após solicitar/cancelar) e ativa o botão */
  function irParaAba(nome) {
    estado.aba = nome;
    var abas = conteudo.querySelector('#trocas-abas');
    if (abas) {
      var botoes = abas.querySelectorAll('.aba');
      for (var i = 0; i < botoes.length; i++) botoes[i].classList.toggle('aba--ativa', botoes[i].getAttribute('data-aba') === nome);
    }
    mostrarVista(nome);
    carregarAba(nome);
  }

  /* recarrega a vista atual (após uma ação no painel ou troca de unidades) */
  function recarregar() {
    if (estado.aba === 'solicitar') return;
    carregarAba(estado.aba);
  }

  /* Solicitar: o botão do cabeçalho abre o formulário no corpo */
  function abrirSolicitar() {
    estado.aba = 'solicitar';
    mostrarVista('solicitar');
    if (RW.trocasSolicitar) RW.trocasSolicitar.ativar();
  }

  function iniciar(conteudoEl) {
    conteudo = conteudoEl;
    estado.aba = 'todas';
    arvoreMontada = false;
    itemSelecionado = null;
    contexto = { cpf: RosterWork.sessao.cpf(), ehAdmin: RosterWork.sessao.ehAdmin(), aoMudar: recarregar, aoFechar: limparSelecao };

    var abas = conteudo.querySelector('#trocas-abas');
    if (RW.abas && abas) {
      /* sair do Solicitar com dados não salvos: confirma o descarte antes de trocar de aba
         (mesmo aviso do botão Cancelar). Captura: roda antes de o geral-abas trocar. */
      abas.addEventListener('click', function (e) {
        if (estado.aba !== 'solicitar') return;
        var aba = e.target.closest('.aba');
        if (!aba || !(RW.trocasSolicitar && RW.trocasSolicitar.temDados && RW.trocasSolicitar.temDados())) return;
        e.preventDefault();
        e.stopPropagation();
        if (!RW.confirmar) { RW.trocasSolicitar.descartar(); aba.click(); return; }
        RW.confirmar({
          tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
          textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
          aoConfirmar: function () { RW.trocasSolicitar.descartar(); aba.click(); }
        });
      }, true);
      RW.abas.ligar(abas, aoTrocarAba);
    }

    var btn = conteudo.querySelector('#btn-solicitar-troca');
    if (btn) btn.addEventListener('click', abrirSolicitar);

    if (RW.trocasSolicitar) RW.trocasSolicitar.ligar(conteudo, {
      aoSolicitar: function () { irParaAba('minhas'); },
      aoCancelar: function () { irParaAba('todas'); },
      aoMudar: recarregar
    });

    if (!ouvindoUnidades) { window.addEventListener('rosterwork_units_changed', recarregar); ouvindoUnidades = true; }

    mostrarVista('todas');
    montarArvoreTodas();
  }

  RW.paginas.trocas = { iniciar: iniciar };
})();
