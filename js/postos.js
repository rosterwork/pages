(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* ---------- perfil do usuário (permissão) ---------- */
  var cardSelecionado = null;   /* card cuja gaveta está aberta (realce) */

  /* o painel chama isto ao fechar (X, Esc ou troca de página): tira o realce */
  function limparSelecao() {
    if (cardSelecionado) {
      cardSelecionado.classList.remove('posto-cartao--selecionado');
      cardSelecionado = null;
    }
  }

  /* ---------- formatação ---------- */

  /* data ISO (AAAA-MM-DD) -> DD/MM/AAAA */
  function formatarData(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  /* período como texto (regra aprovada):
     sem datas -> "Permanente"; só início -> "desde DD/MM/AAAA";
     início e fim -> "DD/MM/AAAA → DD/MM/AAAA"; só fim -> "até DD/MM/AAAA" */
  function textoPeriodo(inicio, fim) {
    if (!inicio && !fim) return 'Permanente';
    if (inicio && !fim) return 'desde ' + formatarData(inicio);
    if (!inicio && fim) return 'até ' + formatarData(fim);
    return formatarData(inicio) + ' a ' + formatarData(fim);
  }

  /* selo de status: Ativo (verde) / Inativo (neutro, sem modificador) */
  function preencherStatus(selo, status) {
    if (!selo) return;
    selo.textContent = status || '';
    if (status === 'Ativo') selo.classList.add('selo--sucesso');
  }

  /* adiciona uma linha rótulo→valor em .posto-dados */
  function adicionarDado(container, rotulo, valor) {
    var tpl = document.getElementById('tpl-posto-dado');
    if (!tpl) return;
    var linha = tpl.content.cloneNode(true).firstElementChild;
    linha.querySelector('.posto-dado-rotulo').textContent = rotulo;
    linha.querySelector('.posto-dado-valor').textContent = valor;
    container.appendChild(linha);
  }

  /* ---------- cards ---------- */

  /* monta os cards de instalação (+ o botão "+", se admin) dentro de uma unidade marcada.
     Unidade sem instalações: o admin ainda vê o "+" (para cadastrar a primeira);
     o usuário comum vê a mensagem de vazio. */
  function renderConteudo(container, unidade, instalacoes) {
    var admin = RosterWork.sessao.ehAdmin();
    if ((!instalacoes || instalacoes.length === 0) && !admin) {
      var tplVazio = document.getElementById('tpl-postos-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tpl = document.getElementById('tpl-posto-cartao');
    var tplGrade = document.getElementById('tpl-postos-cards');
    if (!tpl || !tplGrade) return;
    /* abre o painel da instalação e realça o card (mesmo padrão da ficha do militar) */
    function abrirPainel(card, unidade, inst) {
      if (cardSelecionado) cardSelecionado.classList.remove('posto-cartao--selecionado');
      cardSelecionado = card;
      card.classList.add('posto-cartao--selecionado');
      if (window.RosterWork.postosPainel) window.RosterWork.postosPainel.abrir(unidade, inst, limparSelecao);
    }
    var grade = tplGrade.content.cloneNode(true).firstElementChild;
    (instalacoes || []).forEach(function (inst) {
      var card = tpl.content.cloneNode(true).firstElementChild;
      card.setAttribute('data-instalacao-id', inst.id_instalacao);
      card.querySelector('.posto-nome').textContent = inst.nome || '';
      preencherStatus(card.querySelector('.selo'), inst.status);
      card.querySelector('.posto-periodo').textContent = textoPeriodo(inst.data_inicio, inst.data_exclusao);
      var dados = card.querySelector('.posto-dados');
      adicionarDado(dados, 'Efetivo mínimo', inst.efetivo_minimo);
      adicionarDado(dados, 'Efetivo ideal', inst.efetivo_ideal);
      adicionarDado(dados, 'Efetivo máximo', inst.efetivo_maximo);
      if (admin) {
        card.classList.add('posto-cartao--clicavel');
        card.addEventListener('click', function () {
          abrirPainel(card, unidade, inst);
        });
      }
      grade.appendChild(card);
    });
    /* o botão "+" (só admin) é o último item da fileira — encostado no último card */
    if (admin) {
      var tplBtn = document.getElementById('tpl-posto-adicionar');
      if (tplBtn) {
        var btn = tplBtn.content.cloneNode(true).firstElementChild;
        btn.addEventListener('click', function () {
          if (window.RosterWork.postosPainel) window.RosterWork.postosPainel.abrirNovo(unidade);
        });
        grade.appendChild(btn);
      }
    }
    container.appendChild(grade);
  }

  /* atualização cirúrgica de um card após salvar (sem recarregar a árvore = sem flash):
     repinta o selo de status e os três valores de efetivo */
  function atualizarCard(id, dados) {
    if (id == null || !dados) return;
    var card = document.querySelector('.posto-cartao[data-instalacao-id="' + id + '"]');
    if (!card) return;
    var selo = card.querySelector('.selo');
    if (selo) {
      selo.classList.remove('selo--sucesso');
      preencherStatus(selo, dados.status);
    }
    var valores = card.querySelectorAll('.posto-dado-valor');
    if (valores[0]) valores[0].textContent = dados.min;
    if (valores[1]) valores[1].textContent = dados.ideal;
    if (valores[2]) valores[2].textContent = dados.max;
  }

  /* contagem mostrada no título da unidade: "N instalações" */
  function textoContagem(itens) {
    return itens.length === 1 ? '1 instalação' : itens.length + ' instalações';
  }

  /* ---------- abas ---------- */

  /* monta a árvore de instalações no seu container */
  function montarInstalacoes(conteudo) {
    var container = conteudo.querySelector('#arvore-postos');
    if (!container || !window.RosterWork.arvoreUnidades) return;
    return window.RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'listar_instalacoes',
      chaveUnidade: 'unidade_id',
      textoContagem: textoContagem,
      renderConteudo: renderConteudo
    });
  }

  /* alterna os painéis conforme a aba escolhida (Instalações / Viaturas).
     A árvore de unidades é singleton (um container ativo por vez): ao trocar de
     aba, remonta a árvore da aba mostrada para ela voltar a ser a ativa. */
  function ligarAbas(conteudo) {
    var trilho = conteudo.querySelector('#postos-abas');
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    if (!trilho || !window.RosterWork.abas) return;
    window.RosterWork.abas.ligar(trilho, function (aba) {
      var alvo = aba.getAttribute('data-aba');
      for (var i = 0; i < paineis.length; i++) {
        paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== alvo);
      }
      if (alvo === 'instalacoes') montarInstalacoes(conteudo);
      else if (alvo === 'viaturas' && RosterWork.paginas.postosViaturas) RosterWork.paginas.postosViaturas.montar(conteudo);
    });
  }

  /* a navegação chama iniciar() toda vez que a página de postos é exibida */
  function iniciar(conteudo) {
    ligarAbas(conteudo);
    return montarInstalacoes(conteudo);   // Instalações é a aba ativa por padrão
  }

  window.RosterWork.paginas.postos = { iniciar: iniciar, atualizarCard: atualizarCard };
})();
