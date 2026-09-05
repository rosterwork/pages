/* ============================================================
   USUÁRIOS › aba "Correções" — a fila de pedidos dos militares
   (só administrador). Cada pedido é um cartão com o militar e as
   alterações que ele enviou juntas; cada alteração tem caixa de
   seleção, com "Selecionar tudo" no topo. Aprovar/Recusar agem
   sobre o que está marcado (perfil_decidir recebe os ids).

   Fica AQUI, e não no Meu perfil, porque Meu perfil é a página do
   próprio militar — uma fila com pedidos de outras pessoas ali é
   erro de dono. É o mesmo padrão da aba "Aprovações" das Folgas:
   fila dedicada, decisão na própria linha.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var lista, aoMudar;

  /* as mesmas unidades marcadas na barra lateral que dirigem a árvore do Efetivo */
  function unidades() {
    try {
      var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* marca/desmarca uma linha (a linha inteira é a caixa: role="checkbox") */
  function marcar(linha, ligado) {
    linha.setAttribute('aria-checked', ligado ? 'true' : 'false');
    var caixa = linha.querySelector('.caixa-selecao');
    if (caixa) caixa.classList.toggle('caixa-selecao--marcada', ligado);
  }

  function estaMarcada(linha) {
    return linha.getAttribute('aria-checked') === 'true';
  }

  function idsMarcados(cartao) {
    var ids = [];
    var linhas = cartao.querySelectorAll('.pedido-item[data-id]');
    for (var i = 0; i < linhas.length; i++) {
      if (estaMarcada(linhas[i])) ids.push(linhas[i].getAttribute('data-id'));
    }
    return ids;
  }

  /* carrega a fila; devolve quantos pedidos há (alimenta a contagem da aba) */
  function carregar() {
    if (!lista || !document.contains(lista)) return Promise.resolve(0);
    var ids = unidades();
    if (!ids.length) { renderizar([]); return Promise.resolve(0); }
    return RosterWork.apiFetch('/rest/v1/rpc/perfil_solicitacoes_listar', {
      metodo: 'POST',
      corpo: { p_contexto_ids: ids }
    })
      .then(function (resposta) { return resposta.ok ? resposta.json() : []; })
      .then(function (pedidos) {
        pedidos = Array.isArray(pedidos) ? pedidos : [];
        renderizar(pedidos);
        return pedidos.length;
      })
      .catch(function () { return 0; });
  }

  function renderizar(pedidos) {
    lista.textContent = '';
    if (!pedidos.length) {
      var vazio = RosterWork.tpl('tpl-pedido-vazio');
      if (vazio) { vazio.textContent = RosterWork.mensagens.perfil.semPedidos; lista.appendChild(vazio); }
      return;
    }
    pedidos.forEach(function (pedido) { lista.appendChild(montarCartao(pedido)); });
  }

  function montarCartao(pedido) {
    var cartao = RosterWork.tpl('tpl-pedido');
    var itens = pedido.itens || [];
    cartao.querySelector('.pedido-quem').textContent =
      ((pedido.grad || '') + ' ' + (pedido.nome || '')).trim();
    cartao.querySelector('.pedido-meta').textContent =
      (itens.length === 1 ? '1 alteração' : itens.length + ' alterações') +
      ' · enviadas em ' + RosterWork.data.isoParaBR(pedido.solicitado_em);

    var todos = cartao.querySelector('.pedido-item--todos');
    var corpo = cartao.querySelector('.pedido-itens');
    var aprovar = cartao.querySelector('.pedido-aprovar');
    var recusar = cartao.querySelector('.pedido-recusar');

    /* o cabeçalho reflete a seleção e habilita os botões */
    function revisar() {
      var marcados = idsMarcados(cartao).length;
      marcar(todos, marcados === itens.length && itens.length > 0);
      aprovar.disabled = !marcados;
      recusar.disabled = !marcados;
    }

    itens.forEach(function (item) {
      var linha = RosterWork.tpl('tpl-pedido-item');
      if (!linha) return;
      linha.setAttribute('data-id', item.id);
      linha.querySelector('.pedido-item-rotulo').textContent = item.rotulo;
      linha.querySelector('.pedido-item-de').textContent = item.valor_atual || '-';
      linha.querySelector('.pedido-item-para').textContent = item.valor_novo || '-';
      linha.addEventListener('click', function () {
        marcar(linha, !estaMarcada(linha));
        revisar();
      });
      corpo.appendChild(linha);
    });

    todos.addEventListener('click', function () {
      var ligar = !estaMarcada(todos);
      var linhas = cartao.querySelectorAll('.pedido-item[data-id]');
      for (var i = 0; i < linhas.length; i++) marcar(linhas[i], ligar);
      revisar();
    });

    aprovar.addEventListener('click', function () { decidir(cartao, aprovar, true); });
    recusar.addEventListener('click', function () {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.perfil.confirmarRecusar,
        textoConfirmar: RosterWork.mensagens.botoes.remover,
        textoCancelar: RosterWork.mensagens.botoes.cancelar,
        aoConfirmar: function () { decidir(cartao, recusar, false); }
      });
    });

    revisar();
    return cartao;
  }

  function decidir(cartao, botao, aprovar) {
    var ids = idsMarcados(cartao);
    if (!ids.length) return;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.apiFetch('/rest/v1/rpc/perfil_decidir', {
      metodo: 'POST',
      corpo: { p_ids: ids, p_aprovar: aprovar }
    })
      .then(function (resposta) { return resposta.ok ? resposta.json() : { _falha: true }; })
      .then(function (retorno) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        if (retorno && retorno.success) {
          if (aoMudar) aoMudar();          /* recarrega a fila, a contagem e a árvore */
          if (retorno.log && RosterWork.resumo) RosterWork.resumo.abrirModal(retorno.log, { pagina: 'Usuários' });
          return;
        }
        RosterWork.avisar({
          tipo: 'erro',
          mensagem: (retorno && retorno.error) || RosterWork.mensagens.perfil.falhaDados
        });
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* onMudou roda depois de cada decisão (recarrega a fila, a contagem e a árvore) */
  function iniciar(conteudo, onMudou) {
    aoMudar = onMudou;
    lista = conteudo.querySelector('#usuarios-correcoes');
  }

  RosterWork.usuariosCorrecoes = { iniciar: iniciar, carregar: carregar };
})();
