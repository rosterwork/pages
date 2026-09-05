/* ============================================================
   ESCALAS — modo Dia (árvore de unidades, como o site antigo)
   Títulos em árvore (geral-arvore-unidades, igual a Usuários) e,
   dentro de cada unidade marcada, os militares DISTRIBUÍDOS POR
   POSTO E FUNÇÃO no dia — o mesmo desenho do painel (caixa por
   posto + função à esquerda + militares/horários), reusando as
   peças do escalas-painel (pecas.grupo/linha) e o CSS existente.
   Clicar no bloco da unidade abre o painel do dia (Ver/Editar) —
   o bloco carrega [data-abre-dia] + data-iso/unidade, e o
   escalas-painel casa por eles. Dados: RPC escala_dia_arvore
   (uma linha por unidade: ritmo, efetivo e o JSON do painel).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var chaveCarregada = null;   // 'iso|ids' da última carga concluída
  var chaveDesejada = null;    // 'iso|ids' que a tela quer agora
  var carregandoAgora = false; // uma carga por vez (navegação rápida não intercala respostas)
  var isoAtual = null;


  function dataISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function idsAplicados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* nome do painel: o PEL mostra a companhia acima ("2ªCIBM / 1ºPEL") */
  function nomePainel(unidade) {
    if (unidade.tipo === 'PEL' && RosterWork.arvoreUnidades) {
      var pai = RosterWork.arvoreUnidades.pai(unidade.unidade_id);
      if (pai) return pai.nome + ' / ' + unidade.nome;
    }
    return unidade.nome;
  }

  function mostrarEstado(container, texto) {
    var no = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (no) { no.textContent = texto; container.appendChild(no); }
  }

  /* conteúdo de uma unidade marcada: bloco clicável com a distribuição do dia */
  function renderConteudo(container, unidade, itens) {
    var bloco = RosterWork.tpl('tpl-escala-dia-unidade');
    if (!bloco) return;
    bloco.dataset.iso = isoAtual;
    bloco.dataset.unidadeId = unidade.unidade_id;
    bloco.dataset.unidadeNome = nomePainel(unidade);
    bloco.dataset.unidadeCidade = unidade.cidade || '';

    var dados = itens.length ? (itens[0].distribuicao || {}) : {};
    var postos = dados.postos || [];
    var semFuncao = dados.sem_funcao || [];
    var pecas = RosterWork.escalasPainel && RosterWork.escalasPainel.pecas;

    var vazio = true;

    /* os de serviço sem função: caixa de erro acima dos postos (igual ao painel) */
    if (semFuncao.length && pecas && RosterWork.painel) {
      var caixaErro = RosterWork.painel.criarCaixa('Sem função definida', true);
      if (caixaErro) {
        semFuncao.forEach(function (m) {
          var linha = pecas.linha(m);
          if (linha) caixaErro.appendChild(linha);
        });
        bloco.appendChild(caixaErro);
        vazio = false;
      }
    }

    /* uma caixa por posto com distribuição: função à esquerda + militares/horários */
    postos.forEach(function (posto) {
      if (!(posto.funcoes && posto.funcoes.length) || !pecas || !RosterWork.painel) return;
      var caixa = RosterWork.painel.criarCaixa(posto.nome);
      if (!caixa) return;
      var np = pecas.nivelPosto ? pecas.nivelPosto(posto) : '';
      if (np) caixa.classList.add('grupo-caixa--posto-' + np);
      var funcoes = pecas.mesclarFuncoes ? pecas.mesclarFuncoes(posto) : (posto.funcoes || []);
      funcoes.forEach(function (funcao) {
        var grupo = pecas.grupo(funcao);
        if (grupo) caixa.appendChild(grupo);
      });
      bloco.appendChild(caixa);
      vazio = false;
    });

    /* Observações do dia (trocas): depois dos cards de posto */
    var caixaObs = pecas && pecas.observacoes ? pecas.observacoes(dados.observacoes || []) : null;
    if (caixaObs) { bloco.appendChild(caixaObs); vazio = false; }

    if (vazio) mostrarEstado(bloco, 'Sem distribuição neste dia.');
    container.appendChild(bloco);
  }

  /* selo do título: o ritmo (leitura; muda em Ajustes) + o efetivo distribuído */
  function textoContagem(itens) {
    if (!itens.length) return '';
    var n = itens[0].efetivo || 0;
    return itens[0].ritmo + ' · ' + (n === 1 ? '1 de serviço' : n + ' de serviço');
  }

  /* desenha o dia de opcoes.dataRef: monta a árvore e recarrega se a data/seleção mudou */
  function renderizar(corpo, opcoes) {
    if (!corpo || !RosterWork.arvoreUnidades) return;
    var dataRef = (opcoes && opcoes.dataRef) || new Date();
    isoAtual = dataISO(dataRef);

    var wrap = corpo.querySelector('#arvore-escala-dia') ? null : RosterWork.tpl('tpl-escala-dia');
    if (wrap) { corpo.textContent = ''; corpo.appendChild(wrap); }
    var container = corpo.querySelector('#arvore-escala-dia');
    if (!container) return;

    chaveDesejada = isoAtual + '|' + idsAplicados().join(',');
    var pronto = RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'escala_dia_arvore',
      corpoRpc: function () { return { p_unidade_ids: idsAplicados(), p_data: isoAtual }; },
      chaveUnidade: 'unidade_id',
      textoContagem: textoContagem,
      renderConteudo: renderConteudo
    });
    garantirCarga();
    return pronto;
  }

  /* serializa as buscas: uma por vez; se a data/seleção mudar no meio, rebusca ao
     concluir (navegar rápido pelas setas não intercala respostas fora de ordem) */
  function garantirCarga() {
    if (carregandoAgora || chaveCarregada === chaveDesejada) return;
    carregandoAgora = true;
    var alvo = chaveDesejada;
    function terminou() {
      carregandoAgora = false;
      chaveCarregada = alvo;
      garantirCarga();   // mudou enquanto carregava? busca de novo
    }
    Promise.resolve(RosterWork.arvoreUnidades.recarregar()).then(terminou, terminou);
  }

  /* salvou no painel: rebusca a árvore do dia (se ela estiver na tela e for o mesmo dia) */
  function atualizarCelula(unidadeId, iso) {
    if (!document.getElementById('arvore-escala-dia')) return;
    if (iso !== isoAtual || !RosterWork.arvoreUnidades) return;
    chaveCarregada = null;   // força a rebusca pelo serializador
    garantirCarga();
  }

  function limpar(corpo) {
    chaveCarregada = null;
    if (corpo) corpo.textContent = '';
  }

  window.RosterWork.escalasDia = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
