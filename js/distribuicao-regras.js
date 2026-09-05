/* ============================================================
   DISTRIBUIÇÃO / REGRAS — montagem da aba (por militar)
   Reusa o geral-layout-lateral: à esquerda a lista de militares do
   grupo (CIA + PELs); ao clicar, o centro mostra as regras do militar
   em dois grupos — Proibidas e Exclusivas — com adicionar/remover (só
   admin). Cada função vem dos slots da unidade (dist_regras_funcoes).
   Dados: distribuicao-regras-dados.js. Não escreve estilo nem HTML solto.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var grupoAtual = null;      // { cia, unidades: [...] }
  var militares = [];         // efetivo do grupo
  var funcoesPorUnidade = {}; // unidadeId -> [funcao]
  var regras = [];            // regras cadastradas
  var selecionado = null;     // usuario_id do militar aberto no centro
  var termoFiltro = '';       // termo da busca (normalizado)
  var removidos = [];         // ids das regras salvas removidas localmente (só aplicam no Salvar)
  var seqCarregar = 0;        // token da carga: ignora resposta antiga ao trocar de unidade rápido

  // grau + nome (não depende do módulo de Trocas, que só carrega naquela página)
  function nomeMilitar(grau, nome) { return ((grau || '') + ' ' + (nome || '')).trim(); }

  function estado(container, texto) {
    if (!container) return;
    container.textContent = '';
    var no = RosterWork.tpl('tpl-distribuicao-estado');
    if (no) { no.textContent = texto; container.appendChild(no); }
  }
  function carregando(container) {
    if (!container) return;
    container.textContent = '';
    var no = RosterWork.tpl('tpl-distribuicao-carregando');
    if (no) container.appendChild(no);
  }

  function nomeUnidade(unidadeId) {
    if (!grupoAtual) return '';
    for (var i = 0; i < grupoAtual.unidades.length; i++) {
      if (grupoAtual.unidades[i].unidade_id === unidadeId) return grupoAtual.unidades[i].nome || '';
    }
    return '';
  }

  function regrasDoMilitar(usuarioId, tipo) {
    return regras.filter(function (r) { return r.usuario_id === usuarioId && r.tipo === tipo; });
  }


  /* ---------- painel esquerdo: militares AGRUPADOS por unidade (título recolhe/expande) ---------- */
  function montarLista() {
    var lista = document.getElementById('regras-lista-militares');
    if (!lista) return;
    lista.textContent = '';
    if (!militares.length) { estado(lista, 'Sem militares nas unidades selecionadas.'); return; }
    (grupoAtual && grupoAtual.unidades || []).forEach(function (u) {
      var doUnidade = militares.filter(function (m) { return m.unidade_id === u.unidade_id; });
      if (!doUnidade.length) return;
      var bloco = RosterWork.tpl('tpl-regras-unidade');
      if (!bloco) return;
      bloco.setAttribute('data-unidade', u.unidade_id);
      bloco.querySelector('.regras-unidade-nome').textContent = u.nome || '';
      var cab = bloco.querySelector('.regras-unidade-titulo');
      var corpo = bloco.querySelector('.regras-unidade-corpo');
      cab.addEventListener('click', function () {
        var recolhido = bloco.classList.toggle('regras-unidade--recolhido');
        cab.setAttribute('aria-expanded', recolhido ? 'false' : 'true');
      });
      doUnidade.forEach(function (m) {
        var item = RosterWork.tpl('tpl-regras-militar');
        if (!item) return;
        var nome = nomeMilitar(m.grad, m.nome);
        item.querySelector('.regras-militar-nome').textContent = nome;
        var qtd = regrasDoMilitar(m.usuario_id, 'proibido').length + regrasDoMilitar(m.usuario_id, 'exclusivo').length;
        var contagem = item.querySelector('.regras-militar-contagem');
        contagem.textContent = qtd ? String(qtd) : '';
        contagem.classList.toggle('oculto', qtd === 0);
        item.setAttribute('data-usuario', m.usuario_id);
        item.setAttribute('data-busca', RosterWork.busca.normalizar(nome));
        item.classList.toggle('lista-item--ativo', m.usuario_id === selecionado);
        item.addEventListener('click', function () { selecionar(m); });
        corpo.appendChild(item);
      });
      lista.appendChild(bloco);
    });
    aplicarFiltro();
  }

  /* filtro por nome/graduação: esconde quem não casa; a unidade sem resultado some e as com resultado abrem */
  function aplicarFiltro() {
    var lista = document.getElementById('regras-lista-militares');
    if (!lista) return;
    Array.prototype.forEach.call(lista.querySelectorAll('.regras-unidade'), function (bloco) {
      var visiveis = 0;
      Array.prototype.forEach.call(bloco.querySelectorAll('.regras-militar'), function (it) {
        var casa = !termoFiltro || (it.getAttribute('data-busca') || '').indexOf(termoFiltro) !== -1;
        it.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      bloco.classList.toggle('oculto', !!termoFiltro && visiveis === 0);
      if (termoFiltro && visiveis > 0) bloco.classList.remove('regras-unidade--recolhido');
    });
  }

  /* A tela é reconstruída a cada entrada na página (o SPA troca o fragmento), então o campo de
     busca é sempre um elemento NOVO. A marca de "já ligado" fica NO ELEMENTO (não numa trava de
     módulo, que persistiria entre as visitas e barraria o religamento) — assim religa a cada
     reconstrução, sem duplicar dentro da mesma visita. */
  function ligarBusca() {
    var caixa = document.getElementById('regras-busca');
    var entrada = document.getElementById('regras-busca-entrada');
    var limpar = document.getElementById('regras-busca-limpar');
    if (!entrada || entrada.dataset.ligado) return;
    entrada.dataset.ligado = '1';
    entrada.addEventListener('input', function () {
      var v = entrada.value.trim();
      if (caixa) caixa.classList.toggle('busca--com-texto', v !== '');
      termoFiltro = RosterWork.busca.normalizar(v);
      aplicarFiltro();
    });
    if (limpar) limpar.addEventListener('click', function () {
      entrada.value = '';
      if (caixa) caixa.classList.remove('busca--com-texto');
      termoFiltro = '';
      aplicarFiltro();
      entrada.focus();
    });
  }

  /* ---------- centro: regras do militar selecionado ---------- */
  function montarGrupo(destino, militar, tipo, titulo) {
    var grupo = RosterWork.tpl('tpl-regras-grupo');
    if (!grupo) return;
    grupo.querySelector('.regras-grupo-titulo').textContent = titulo;
    var itens = grupo.querySelector('.regras-grupo-itens');
    var doTipo = regrasDoMilitar(militar.usuario_id, tipo);
    if (!doTipo.length) {
      var vazio = RosterWork.tpl('tpl-regras-item');
      vazio.querySelector('.regras-item-texto').textContent = 'Nenhuma';
      vazio.classList.add('regras-item--vazio');
      itens.appendChild(vazio);
    } else {
      doTipo.forEach(function (r) {
        var item = RosterWork.tpl('tpl-regras-item');
        item.querySelector('.regras-item-texto').textContent = r.funcao;
        var rem = item.querySelector('.regras-item-remover');
        if (RosterWork.sessao.ehAdmin()) {
          rem.classList.remove('oculto');
          rem.addEventListener('click', function () { remover(r); });
        }
        itens.appendChild(item);
      });
    }
    if (RosterWork.sessao.ehAdmin()) montarAdicionar(grupo.querySelector('.regras-grupo-add'), militar, tipo);
    destino.appendChild(grupo);
  }

  /* nome que a regra usa: "Efetivo N" vira só "Efetivo" (B4 — vale para todos os efetivos) */
  function nomeCanonico(f) { return /^Efetivo \d+$/.test(f) ? 'Efetivo' : f; }

  /* funções que aceitam regra numa unidade: sem Chefe de Socorro / Oficial de Área (B5 — são sempre os
     mais antigos, regra absoluta), com "Efetivo N" juntado em "Efetivo" (B4), sem repetir */
  function funcoesRegulaveis(unidadeId) {
    var vistos = {}, out = [];
    (funcoesPorUnidade[unidadeId] || []).forEach(function (f) {
      if (/^(chefe de socorro|oficial de área)$/i.test(f)) return;
      var c = nomeCanonico(f);
      if (vistos[c]) return;
      vistos[c] = true;
      out.push(c);
    });
    return out;
  }

  /* o "+ Adicionar" com o menu das funções ainda não usadas nesse tipo */
  function montarAdicionar(destino, militar, tipo) {
    if (!destino) return;
    var add = RosterWork.tpl('tpl-regras-add');
    if (!add) return;
    var menu = add.querySelector('.dropdown-menu');
    var jaTem = regrasDoMilitar(militar.usuario_id, tipo).map(function (r) { return r.funcao; });
    var disponiveis = funcoesRegulaveis(militar.unidade_id).filter(function (f) { return jaTem.indexOf(f) === -1; });
    // proibido especial: bloqueia reforço e acúmulo em outra unidade (não é função de slot; só no proibido)
    if (tipo === 'proibido' && jaTem.indexOf('Acumular em outra unidade') === -1) disponiveis.push('Acumular em outra unidade');
    // exclusivo de Condutor só para quem tem CNH C ou maior (C/D/E); B/A/AB não pode ser exclusivo condutor
    if (tipo === 'exclusivo' && !/[CDE]/i.test(militar.cnh || '')) disponiveis = disponiveis.filter(function (f) { return !/^condutor/i.test(f); });
    if (!disponiveis.length) {
      add.querySelector('.regras-add-gatilho').disabled = true;
    } else {
      disponiveis.forEach(function (f) {
        var opc = RosterWork.tpl('tpl-distribuicao-item');
        opc.textContent = f;
        opc.addEventListener('click', function () { adicionar(militar, tipo, f); });
        menu.appendChild(opc);
      });
    }
    destino.appendChild(add);
  }

  function montarDetalhe() {
    var corpo = document.getElementById('regras-corpo');
    if (!corpo) return;
    corpo.textContent = '';
    if (!selecionado) { estado(corpo, 'Selecione um militar à esquerda para ver as regras.'); return; }
    var militar = null;
    for (var i = 0; i < militares.length; i++) if (militares[i].usuario_id === selecionado) militar = militares[i];
    if (!militar) { estado(corpo, 'Selecione um militar à esquerda para ver as regras.'); return; }

    var detalhe = RosterWork.tpl('tpl-regras-detalhe');
    detalhe.querySelector('.regras-detalhe-nome').textContent = nomeMilitar(militar.grad, militar.nome);
    detalhe.querySelector('.regras-detalhe-unidade').textContent = nomeUnidade(militar.unidade_id);
    var grupos = detalhe.querySelector('.regras-detalhe-grupos');
    montarGrupo(grupos, militar, 'proibido', 'Funções proibidas');
    montarGrupo(grupos, militar, 'exclusivo', 'Funções exclusivas');
    corpo.appendChild(detalhe);
  }

  function selecionar(militar) {
    selecionado = militar.usuario_id;
    montarLista();
    montarDetalhe();
  }

  /* ---------- escrita: alterações LOCAIS até clicar em Salvar (padrão da aba Modelos) ---------- */
  function marcarSujo() { atualizarRodape(); }

  /* adiciona uma regra só na TELA (id null = ainda não salva) */
  function adicionar(militar, tipo, funcao) {
    if (regrasDoMilitar(militar.usuario_id, tipo).some(function (r) { return r.funcao === funcao; })) return;
    regras.push({ id: null, usuario_id: militar.usuario_id, unidade_id: militar.unidade_id, tipo: tipo, funcao: funcao });
    marcarSujo();
    montarLista();
    montarDetalhe();
  }

  /* remove uma regra da TELA (se já estava salva, guarda o id para apagar no Salvar) */
  function remover(regra) {
    if (regra.id != null) removidos.push(regra.id);
    regras = regras.filter(function (x) { return x !== regra; });
    marcarSujo();
    montarLista();
    montarDetalhe();
  }

  /* nº de alterações pendentes (adições ainda não salvas + remoções) — é o "sujo" derivado:
     se você desfizer tudo e voltar ao estado salvo, volta a zero */
  function contarAlteracoes() {
    return regras.filter(function (r) { return r.id == null; }).length + removidos.length;
  }
  /* rodapé Salvar/Cancelar: SEMPRE visível; os botões só habilitam quando há alteração
     (mesmo padrão do Editar da Distribuição) */
  function atualizarRodape() {
    var rod = document.getElementById('regras-rodape');
    if (!rod) return;
    rod.classList.remove('oculto');
    var n = contarAlteracoes();
    var bSalvar = rod.querySelector('.regras-salvar');
    var bCancelar = rod.querySelector('.regras-cancelar');
    if (bSalvar) bSalvar.disabled = (n === 0);
    if (bCancelar) bCancelar.disabled = (n === 0);
    var info = rod.querySelector('.regras-rodape-info');
    if (info) info.textContent = n === 1 ? '1 alteração não salva' : (n ? n + ' alterações não salvas' : '');
  }
  function ligarRodape() {
    var bSalvar = document.querySelector('.regras-salvar');
    var bCancelar = document.querySelector('.regras-cancelar');
    if (!bSalvar || bSalvar.dataset.ligado) return;   // marca no elemento (novo a cada reconstrução da tela), não em trava de módulo
    bSalvar.dataset.ligado = '1';
    bSalvar.addEventListener('click', salvar);
    if (bCancelar) bCancelar.addEventListener('click', function () { confirmarSaida(recarregarRegras); });
  }

  /* grava tudo de uma vez: pede a data de recálculo (modal padrão, começa amanhã), depois
     grava e o banco recalcula só as unidades das regras a partir da data escolhida */
  function salvar() {
    var adds = regras.filter(function (r) { return r.id == null; })
      .map(function (r) { return { usuario_id: r.usuario_id, unidade_id: r.unidade_id, tipo: r.tipo, funcao: r.funcao }; });
    if (!adds.length && !removidos.length) return;
    RW.pedirData({
      mensagem: RW.mensagens.distribuicao.salvarImpacto,
      textoConfirmar: RW.mensagens.botoes.salvar,
      aoConfirmar: function (iso) {
        if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
        RW.distribuicaoRegrasDados.salvar(adds, removidos, RosterWork.sessao.cpf(), iso).then(function (r) {
          if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
          if (r && r._falha === 'servidor') { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }
          if (r && r.success) {
            removidos = [];
            if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Distribuição' });
            recarregarRegras();
          } else if (RW.avisar) {
            RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
          }
        }).catch(function () {
          if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
          if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
        });
      }
    });
  }

  /* descarta as alterações locais e recarrega as regras salvas do banco */
  function recarregarRegras() {
    if (!grupoAtual) { removidos = []; atualizarRodape(); return; }
    removidos = [];
    var ids = grupoAtual.unidades.map(function (u) { return u.unidade_id; });
    RW.distribuicaoRegrasDados.listar(ids).then(function (lista) {
      /* falha (null): avisa e mantém a tela como está, sem fingir "nenhuma regra" */
      if (lista === null) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.distribuicao.falhaCarregarRegras }); return; }
      regras = lista;
      montarLista();
      montarDetalhe();
      atualizarRodape();
    });
  }

  function estaSujo() { return contarAlteracoes() > 0; }
  /* confirma o descarte de alterações não salvas antes de abandonar (ou segue direto) */
  function confirmarSaida(aoSair) {
    if (!estaSujo()) { aoSair(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.distribuicao.descartar,
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { removidos = []; aoSair(); }
    });
  }

  /* ---------- carga (chamada pelo distribuicao.js ao entrar na aba / trocar unidades) ---------- */
  function carregar(grupo) {
    grupoAtual = grupo;
    selecionado = null;
    removidos = [];
    ligarBusca();
    ligarRodape();
    /* reseta a busca ao (re)carregar o grupo */
    termoFiltro = '';
    var entrada = document.getElementById('regras-busca-entrada');
    var caixaBusca = document.getElementById('regras-busca');
    if (entrada) entrada.value = '';
    if (caixaBusca) caixaBusca.classList.remove('busca--com-texto');
    var lista = document.getElementById('regras-lista-militares');
    var corpo = document.getElementById('regras-corpo');
    if (!grupo) { estado(lista, RW.mensagens.distribuicao.selecioneUnidade); if (corpo) corpo.textContent = ''; return; }
    carregando(lista);
    if (corpo) corpo.textContent = '';
    var ids = grupo.unidades.map(function (u) { return u.unidade_id; });
    var req = ++seqCarregar;
    return Promise.all([
      RW.distribuicaoRegrasDados.militares(ids),
      RW.distribuicaoRegrasDados.funcoes(ids),
      RW.distribuicaoRegrasDados.listar(ids)
    ]).then(function (res) {
      if (req !== seqCarregar) return;   /* outra carga (troca de unidade/aba) assumiu */
      /* res[0] === null → a carga falhou (rede/servidor): mostra o erro em vez de "Carregando…" preso */
      if (res[0] === null) { estado(lista, RW.mensagens.distribuicao.falhaCarregarRegras); if (corpo) corpo.textContent = ''; return; }
      militares = res[0] || [];
      funcoesPorUnidade = {};
      (res[1] || []).forEach(function (f) {
        (funcoesPorUnidade[f.unidade_id] = funcoesPorUnidade[f.unidade_id] || []).push(f.funcao);
      });
      regras = res[2] || [];
      montarLista();
      montarDetalhe();
      atualizarRodape();
    });
  }

  RW.distribuicaoRegras = { carregar: carregar, estaSujo: estaSujo, confirmarSaida: confirmarSaida };
})();
