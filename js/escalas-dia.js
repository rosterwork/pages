/* ============================================================
   ESCALAS — modo Dia (árvore de unidades)
   A árvore de unidades (geral-arvore-unidades, igual a Usuários) e,
   dentro do bloco de cada unidade marcada, os militares DISTRIBUÍDOS
   POR POSTO E FUNÇÃO no dia — o mesmo desenho do painel (caixa por
   posto + função à esquerda + militares/horários), reusando as
   peças do escalas-painel (pecas.grupo/linha) e o CSS existente.
   Clicar no bloco da unidade abre o painel do dia (Ver/Editar) —
   o bloco ganha [data-abre-dia] + data-iso/unidade, e o
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

  /* o pedido da prévia do dia (escalas-dados.js), ou null sem mudança do painel do dia esperando o Salvar */
  function corpoDia() {
    var D = RosterWork.escalasDados;
    return D && D.corpoPrevia ? D.corpoPrevia('escala_dia_arvore', { p_unidade_ids: idsAplicados(), p_data: isoAtual }) : null;
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

  /* conteúdo de uma unidade marcada: a distribuição do dia no bloco da árvore, que fica clicável */
  function renderConteudo(container, unidade, itens) {
    var bloco = container.closest('.arvore-bloco');
    if (!bloco) return;
    bloco.setAttribute('data-abre-dia', '');
    bloco.dataset.iso = isoAtual;
    bloco.dataset.unidadeId = unidade.unidade_id;
    bloco.dataset.unidadeNome = nomePainel(unidade);
    bloco.dataset.unidadeCidade = unidade.cidade || '';
    desenharDistribuicao(container, itens.length ? (itens[0].distribuicao || {}) : {});
  }

  /* a distribuição do dia de uma unidade (o JSON do painel): os sem função, uma caixa por posto e as
     Observações; a Minha escala usa o mesmo desenho (escalas-minha.js) */
  function desenharDistribuicao(container, dados) {
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
        container.appendChild(caixaErro);
        vazio = false;
      }
    }

    /* uma caixa por posto com alguém: função à esquerda + militares/horários (posto sem ninguém não aparece) */
    postos.forEach(function (posto) {
      if (!pecas || !RosterWork.painel || !(pecas.temAlguem && pecas.temAlguem(posto))) return;
      var caixa = RosterWork.painel.criarCaixa(posto.nome);
      if (!caixa) return;
      /* troca de viatura com data: "No lugar da ... até ..." embaixo do prefixo */
      var noLugar = pecas.noLugar ? pecas.noLugar(posto) : null;
      if (noLugar) caixa.querySelector('.rotulo-secao').insertAdjacentElement('afterend', noLugar);
      var np = pecas.nivelPosto ? pecas.nivelPosto(posto) : '';
      if (np) caixa.classList.add('grupo-caixa--posto-' + np);
      var funcoes = pecas.mesclarFuncoes ? pecas.mesclarFuncoes(posto) : (posto.funcoes || []);
      /* o que a Central exibe, só para ver, antes e depois das funções dela */
      var exib = pecas.exibidas ? pecas.exibidas(posto, false) : { antes: [], depois: [] };
      exib.antes.concat(funcoes, exib.depois).forEach(function (funcao) {
        var grupo = pecas.grupo(funcao);
        if (grupo) caixa.appendChild(grupo);
      });
      container.appendChild(caixa);
      vazio = false;
    });

    /* Observações do dia (trocas): depois dos cards de posto */
    var caixaObs = pecas && pecas.observacoes ? pecas.observacoes(dados.observacoes || []) : null;
    if (caixaObs) { container.appendChild(caixaObs); vazio = false; }

    if (vazio) mostrarEstado(container, 'Sem distribuição neste dia.');
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
    /* o mesmo dia e a mesma seleção já carregados: a árvore mostra o que tem e revalida por trás.
       Outro dia ou outra seleção: a árvore só monta, com o carregando, e a busca é uma só (a do garantirCarga) */
    var mesmoDia = !carregandoAgora && chaveCarregada === chaveDesejada;
    var pronto = RosterWork.arvoreUnidades.montar(container, {
      /* com mudança do painel do dia esperando o Salvar, a prévia (o dia como vai ficar) */
      rpcConteudo: function () { return corpoDia() ? 'escala_previa' : 'escala_dia_arvore'; },
      corpoRpc: function () { return corpoDia() || { p_unidade_ids: idsAplicados(), p_data: isoAtual }; },
      chaveUnidade: 'unidade_id',
      textoContagem: textoContagem,
      renderConteudo: renderConteudo,
      buscaPelaPagina: !mesmoDia
    });
    if (!mesmoDia) garantirCarga();
    return pronto;
  }

  /* serializa as buscas: uma por vez; se a data/seleção mudar no meio, rebusca ao
     concluir (navegar rápido pelas setas pede ao banco só o dia em que parou) */
  function garantirCarga() {
    if (carregandoAgora || chaveCarregada === chaveDesejada) return;
    if (!document.getElementById('arvore-escala-dia')) return;   // saiu do Dia: a árvore já é de outra tela
    carregandoAgora = true;
    var alvo = chaveDesejada;
    function terminou(desenhou) {
      carregandoAgora = false;
      chaveCarregada = desenhou ? alvo : null;   // descartada (veio um pedido mais novo): não conta como carregada
      garantirCarga();   // mudou enquanto carregava? busca de novo
    }
    Promise.resolve(RosterWork.arvoreUnidades.recarregar()).then(function (r) { terminou(r !== false); }, function () { terminou(false); });
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

  window.RosterWork.escalasDia = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar, desenharDistribuicao: desenharDistribuicao };
})();
