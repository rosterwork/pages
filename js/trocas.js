/* ============================================================
   TROCAS — orquestrador da página
   Quatro visões: Todas (árvore de unidades — a troca fica na unidade
   de quem solicitou), Minhas (as trocas em que eu entro), Saldos
   (as dívidas de horas) e Pendências (a fila do que espera decisão:
   a troca que pediram a você e, para o administrador, as trocas para
   aprovar; componente geral-fila, a mesma da página Pendências).
   "Solicitar" é o botão da barra. As ações (aceitar / aprovar /
   aprovar sem confirmação / recusar / cancelar) ficam no painel,
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
  var filaMinhas = null, filaAprovar = null;   // as filas da aba Pendências (geral-fila)

  function unidades() {
    try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : []; } catch (e) { return []; }
  }
  function fmt() { return RW.trocasFormato; }

  function limparSelecao() {
    if (itemSelecionado) { itemSelecionado.classList.remove('troca-item--selecionada', 'troca-pendente--selecionada'); itemSelecionado = null; }
  }

  function abrirTroca(item, troca) {
    /* abre primeiro: reabrir por cima dispara o aoFechar (limparSelecao) da troca anterior,
       que apagaria o destaque novo se marcássemos antes */
    if (RW.trocasPainel) RW.trocasPainel.abrir(troca, contexto);
    if (itemSelecionado) itemSelecionado.classList.remove('troca-item--selecionada', 'troca-pendente--selecionada');
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

  /* ---------- Todas: árvore de unidades (as trocas da unidade num bloquinho branco) ---------- */
  function renderTrocasNaUnidade(container, unidade, trocas) {
    var bloquinho = trocas.length ? RW.tpl('tpl-arvore-bloquinho') : null;
    if (!bloquinho) return;
    trocas.forEach(function (t) { var el = montarItemTroca(t); if (el) bloquinho.appendChild(el); });
    container.appendChild(bloquinho);
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
    el.querySelector('.troca-pendente-resumo').textContent = RW.mensagens.trocas.pendResumo(p.total_trocas || 0);
    el.addEventListener('click', function () { abrirPendencia(el, p); });
    return el;
  }

  /* abre o extrato da pendência no painel (destaca o card, como na lista de trocas) */
  function abrirPendencia(item, p) {
    if (RW.trocasPendenciaPainel) RW.trocasPendenciaPainel.abrir(p, contexto);
    if (itemSelecionado) itemSelecionado.classList.remove('troca-item--selecionada', 'troca-pendente--selecionada');
    itemSelecionado = item;
    item.classList.add('troca-pendente--selecionada');
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
  }

  function carregarAba(nome) {
    if (nome === 'todas') { if (arvoreMontada && RW.arvoreUnidades) RW.arvoreUnidades.recarregar(); else montarArvoreTodas(); }
    else if (nome === 'minhas') carregarMinhas();
    else if (nome === 'saldos') carregarPendentes();
    else if (nome === 'pendencias') carregarPendencias();
  }

  /* ---------- Pendências: a fila do que espera decisão (o número vai no selo da aba) ---------- */
  function escreverSeloPendencias(n) {
    var s = conteudo.querySelector('#trocas-pendencias-contagem');
    if (!s) return;
    s.textContent = n ? String(n) : '';
    s.classList.toggle('oculto', !n);
  }
  function carregarPendencias() {
    if (!filaMinhas || !RW.fila) return Promise.resolve();
    return RW.fila.ler().then(function (r) {
      if (!r || !document.contains(conteudo)) return;
      var minhas = RW.fila.doTipo(r.minhas, ['troca']);
      var aprovar = contexto.ehAdmin ? RW.fila.doTipo(r.aprovar, ['troca']) : [];
      filaMinhas.definir(minhas);
      if (filaAprovar) filaAprovar.definir(aprovar);
      escreverSeloPendencias(minhas.length + aprovar.length);
    });
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
    carregarAba(estado.aba);
  }

  /* Solicitar e Registrar (só admin): os botões da barra abrem o formulário no painel lateral;
     o Registrar fica no grupo Administração, que no celular é um menu (fecha antes de abrir) */
  function abrirSolicitar() {
    if (RW.trocasSolicitar) RW.trocasSolicitar.abrir();
  }
  function abrirRegistrar() {
    if (RW.fecharDropdowns) RW.fecharDropdowns();
    if (RW.trocasSolicitar) RW.trocasSolicitar.abrir({ registrar: true });
  }

  function iniciar(conteudoEl) {
    conteudo = conteudoEl;
    estado.aba = 'todas';
    arvoreMontada = false;
    itemSelecionado = null;
    /* ehAdmin: tem algum papel (aprovar e registrar); cada troca ainda confere a área no painel e no banco */
    contexto = { cpf: RosterWork.sessao.cpf(), ehAdmin: RosterWork.sessao.temPapel('pelotao'), aoMudar: recarregar, aoFechar: limparSelecao };

    var abas = conteudo.querySelector('#trocas-abas');
    if (RW.abas && abas) RW.abas.ligar(abas, aoTrocarAba);

    /* a aba Pendências: para todos a troca que pediram a você; para o administrador, também as trocas para aprovar */
    var m = RW.mensagens.pendencias;
    filaMinhas = RW.fila ? RW.fila.criar(conteudo.querySelector('#trocas-pendencias-minhas'), { vazio: m.vazioTrocasMinhas, recarregar: carregarPendencias }) : null;
    filaAprovar = (RW.fila && contexto.ehAdmin) ? RW.fila.criar(conteudo.querySelector('#trocas-pendencias-aprovar'), { vazio: m.vazioTrocasAprovar, recarregar: carregarPendencias }) : null;
    conteudo.querySelector('#trocas-pendencias-secao-aprovar').classList.toggle('oculto', !contexto.ehAdmin);
    if (RW.fila) RW.fila.contar().then(function (c) { escreverSeloPendencias((c.minhas.troca || 0) + (contexto.ehAdmin ? (c.aprovar.troca || 0) : 0)); });

    var btn = conteudo.querySelector('#btn-solicitar-troca');
    if (btn) btn.addEventListener('click', abrirSolicitar);
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !contexto.ehAdmin);
    var btnRegistrar = conteudo.querySelector('#btn-registrar-troca');
    if (btnRegistrar) btnRegistrar.addEventListener('click', abrirRegistrar);

    if (RW.trocasSolicitar) RW.trocasSolicitar.ligar({
      aoSolicitar: function () { irParaAba('minhas'); },
      aoMudar: recarregar
    });

    if (!ouvindoUnidades) { window.addEventListener('rosterwork_units_changed', recarregar); ouvindoUnidades = true; }

    mostrarVista('todas');
    montarArvoreTodas();
  }

  RW.paginas.trocas = { iniciar: iniciar };
})();
