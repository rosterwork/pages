/* ============================================================
   POSTOS — aba Viaturas: árvore de unidades com os cards das
   viaturas de cada unidade marcada. Reusa o componente
   geral-arvore-unidades (fonte: RPC listar_viaturas). Card =
   prefixo + selo de status (Ativo/Manutenção/Reserva/Inativo) +
   CNH exigida + guarnição (efetivo mín/ideal/máx). Só admin vê o botão "+" e pode
   clicar num card para editar (painel em postos-viaturas-painel.js).
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

  /* selo do card: janela de manutenção ativa vira "Manutenção até DD/MM" (âmbar,
     derivado — como "Férias até DD/MM"); a janela em aberto (sem data de fim)
     vira só "Em manutenção"; senão, o Estado manual:
     Ativo (verde) / Reserva (escuro) / Inativo (neutro, sem modificador) */
  function preencherSeloViatura(selo, v) {
    if (!selo) return;
    selo.classList.remove('selo--sucesso', 'selo--alerta', 'selo--escuro');
    if (v.em_manutencao) {
      selo.textContent = v.manutencao_ate
        ? 'Manutenção até ' + formatarDataCurta(v.manutencao_ate)
        : 'Em manutenção';
      selo.classList.add('selo--alerta');
      return;
    }
    selo.textContent = v.status || '';
    if (v.status === 'Ativo') selo.classList.add('selo--sucesso');
    else if (v.status === 'Reserva') selo.classList.add('selo--escuro');
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

  /* monta os cards de viatura (+ o botão "+", se admin) de uma unidade marcada.
     Unidade sem viaturas: o admin ainda vê o "+" (para cadastrar a primeira);
     o usuário comum vê a mensagem de vazio. */
  function renderConteudo(container, unidade, viaturas) {
    var admin = RosterWork.sessao.ehAdmin();
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
    /* o botão "+" (só admin) é o último item da fileira — encostado no último card */
    if (admin) {
      var tplBtn = document.getElementById('tpl-viatura-adicionar');
      if (tplBtn) {
        var btn = tplBtn.content.cloneNode(true).firstElementChild;
        btn.addEventListener('click', function () {
          if (window.RosterWork.postosViaturasPainel) window.RosterWork.postosViaturasPainel.abrirNovo(unidade);
        });
        grade.appendChild(btn);
      }
    }
    container.appendChild(grade);
  }

  /* atualização cirúrgica de um card após salvar (sem recarregar a árvore = sem flash):
     recebe o objeto da viatura já fresco e repinta o selo (status/manutenção), a CNH e a guarnição */
  function atualizarCard(id, v) {
    if (id == null || !v) return;
    var card = document.querySelector('.posto-cartao[data-viatura-id="' + id + '"]');
    if (!card) return;
    preencherSeloViatura(card.querySelector('.selo'), v);
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
