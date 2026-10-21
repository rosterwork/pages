/* ============================================================
   POSTOS — aba Viaturas: árvore de unidades com os cards das
   viaturas de cada unidade marcada. Reusa o componente
   geral-arvore-unidades (fonte: RPC listar_viaturas). Card =
   prefixo + selo de status (Ativo/Inativo; na troca de viatura com
   data, "Substituída até DD/MM") + período + a viatura que está no
   lugar ou a próxima mudança (postos-mudancas.js) + CNH exigida +
   guarnição (efetivo mín/ideal/máx). Só admin vê o grupo Administração
   (Adicionar viatura) e pode clicar num card para editar (painel em postos-viaturas-painel.js).
   A árvore é singleton: postos.js remonta esta ao abrir a aba.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var cardSelecionado = null;   /* card cuja gaveta está aberta (realce) */

  /* ---------- formatação ---------- */

  /* data ISO (AAAA-MM-DD) -> DD/MM (curta, como o selo "Férias até DD/MM") */
  function formatarDataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }

  /* selo do card: na troca de viatura com data, "Substituída até DD/MM" (âmbar, como "Férias até DD/MM");
     senão, o Estado: Ativo (verde) / Inativo (neutro, sem modificador) */
  function preencherSeloViatura(selo, v) {
    if (!selo) return;
    selo.classList.remove('selo--sucesso', 'selo--alerta');
    if (v.hoje_ate && v.hoje_prefixo && v.hoje_prefixo !== v.nome) {
      selo.textContent = RosterWork.mensagens.postos.substituidaAte.replace('{data}', formatarDataCurta(v.hoje_ate));
      selo.classList.add('selo--alerta');
      return;
    }
    selo.textContent = v.status || '';
    if (v.status === 'Ativo') selo.classList.add('selo--sucesso');
  }

  /* abre o painel da viatura e realça o card clicado (mesmo padrão da ficha do militar) */
  function abrirPainel(card, unidade, v) {
    if (cardSelecionado) cardSelecionado.classList.remove('posto-cartao--selecionado');
    cardSelecionado = card;
    card.classList.add('posto-cartao--selecionado');
    if (window.RosterWork.postosViaturasPainel) {
      window.RosterWork.postosViaturasPainel.abrir(unidade, v, limparSelecao);
    }
  }

  /* o painel chama isto ao fechar (X, Esc ou troca de página): tira o realce */
  function limparSelecao() {
    if (cardSelecionado) {
      cardSelecionado.classList.remove('posto-cartao--selecionado');
      cardSelecionado = null;
    }
  }

  /* adiciona uma linha rótulo→valor em .posto-dados (reusa o molde das instalações) */
  function adicionarDado(container, rotulo, valor) {
    var tpl = document.getElementById('tpl-posto-dado');
    if (!tpl) return;
    var linha = tpl.content.cloneNode(true).firstElementChild;
    linha.querySelector('.posto-dado-rotulo').textContent = rotulo;
    linha.querySelector('.posto-dado-valor').textContent = valor;
    container.appendChild(linha);
  }

  /* ---------- cards ---------- */

  /* monta os cards de viatura (+ o grupo Administração, se admin) de uma unidade marcada.
     Unidade sem viaturas: o admin ainda vê o grupo (para cadastrar a primeira);
     o usuário comum vê a mensagem de vazio. Admin aqui é quem tem esta unidade na área
     do papel; os demais só consultam. */
  function renderConteudo(container, unidade, viaturas) {
    var admin = RosterWork.sessao.podeAdministrar('pelotao', unidade.unidade_id);
    if ((!viaturas || viaturas.length === 0) && !admin) {
      var tplVazio = document.getElementById('tpl-viatura-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tpl = document.getElementById('tpl-viatura-cartao');
    var tplGrade = document.getElementById('tpl-postos-cards');
    if (!tpl || !tplGrade) return;
    var grade = tplGrade.content.cloneNode(true).firstElementChild;
    (viaturas || []).forEach(function (v) {
      var card = tpl.content.cloneNode(true).firstElementChild;
      card.setAttribute('data-viatura-id', v.id_viatura);
      card.querySelector('.posto-nome').textContent = v.nome || '';
      preencherSeloViatura(card.querySelector('.selo'), v);
      if (RosterWork.postosMudancas) RosterWork.postosMudancas.preencherCard(card, v);
      var dados = card.querySelector('.posto-dados');
      adicionarDado(dados, 'CNH exigida', v.cnh || '');
      adicionarDado(dados, 'Efetivo mínimo', v.efetivo_minimo);
      adicionarDado(dados, 'Efetivo ideal', v.efetivo_ideal);
      adicionarDado(dados, 'Efetivo máximo', v.efetivo_maximo);
      if (admin) {
        card.classList.add('posto-cartao--clicavel');
        card.addEventListener('click', function () { abrirPainel(card, unidade, v); });
      }
      grade.appendChild(card);
    });
    /* o grupo Administração (só admin) é o último item da fileira, com o Adicionar viatura;
       no celular o grupo é um menu: fecha antes de abrir o painel */
    if (admin) {
      var grupo = RosterWork.tpl('tpl-viatura-adicionar');
      if (grupo) {
        grupo.querySelector('.acoes-admin-menu .botao').addEventListener('click', function () {
          if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
          if (window.RosterWork.postosViaturasPainel) window.RosterWork.postosViaturasPainel.abrirNovo(unidade);
        });
        grade.appendChild(grupo);
      }
    }
    container.appendChild(grade);
  }

  /* atualização cirúrgica de um card após salvar (sem recarregar a árvore = sem flash):
     recebe o objeto da viatura já fresco e repinta o prefixo, o selo, a linha da troca ou da
     mudança marcada, a CNH e a guarnição */
  function atualizarCard(id, v) {
    if (id == null || !v) return;
    var card = document.querySelector('.posto-cartao[data-viatura-id="' + id + '"]');
    if (!card) return;
    if (v.nome) card.querySelector('.posto-nome').textContent = v.nome;
    preencherSeloViatura(card.querySelector('.selo'), v);
    if (RosterWork.postosMudancas) RosterWork.postosMudancas.preencherCard(card, v);
    var valores = card.querySelectorAll('.posto-dado-valor');
    if (v.cnh !== undefined && valores[0]) valores[0].textContent = v.cnh || '';
    if (v.efetivo_minimo !== undefined && valores[1]) valores[1].textContent = v.efetivo_minimo;
    if (v.efetivo_ideal !== undefined && valores[2]) valores[2].textContent = v.efetivo_ideal;
    if (v.efetivo_maximo !== undefined && valores[3]) valores[3].textContent = v.efetivo_maximo;
  }

  /* contagem mostrada no título da unidade: "N viaturas" */
  function textoContagem(itens) {
    return itens.length === 1 ? '1 viatura' : itens.length + ' viaturas';
  }

  /* monta (ou remonta) a árvore de viaturas — chamada por postos.js ao abrir a aba */
  function montar(conteudo) {
    var container = conteudo.querySelector('#arvore-viaturas');
    if (!container || !window.RosterWork.arvoreUnidades) return;
    return window.RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'listar_viaturas',
      chaveUnidade: 'unidade_id',
      textoContagem: textoContagem,
      renderConteudo: renderConteudo
    });
  }

  window.RosterWork.paginas.postosViaturas = { montar: montar, atualizarCard: atualizarCard };
})();
