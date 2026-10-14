/* ============================================================
   USUÁRIOS — o painel da correção de dados que o militar pediu
   O pedido abre no painel de decisão (geral-decisao): a caixa
   "Alterações pedidas" com as linhas do cartão de pedido
   (geral-pedido: cada alteração com a caixa de seleção e o
   "Selecionar tudo"); o rodapé Recusar / Aprovar age sobre as
   marcadas (perfil_decidir). Recusar pede o motivo (opcional).
   Abre pela fila (geral-fila) da página Pendências e da aba
   Pendências da Usuários.
   Expõe: RosterWork.usuariosCorrecaoPainel.abrir(pedido, ctx).
   ctx = { posicao?: { n, total }, aoMudar(), aoFechar() }
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* marca/desmarca uma linha (a linha inteira é a caixa: role="checkbox") */
  function marcar(linha, ligado) {
    linha.setAttribute('aria-checked', ligado ? 'true' : 'false');
    var caixa = linha.querySelector('.caixa-selecao');
    if (caixa) caixa.classList.toggle('caixa-selecao--marcada', ligado);
  }
  function estaMarcada(linha) { return linha.getAttribute('aria-checked') === 'true'; }

  function idsMarcados(raiz) {
    return [].filter.call(raiz.querySelectorAll('.pedido-item[data-id]'), estaMarcada)
      .map(function (l) { return l.getAttribute('data-id'); });
  }

  function decidir(ids, aprovar, motivo, botao, ctx) {
    if (!ids.length) return;
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    RW.rpc('perfil_decidir', { p_ids: ids, p_aprovar: aprovar, p_motivo: motivo || null })
      .then(function (r) {
        if (RW.pararCarregando) RW.pararCarregando(botao);
        if (r && r.success) {
          RW.painel.fechar();
          if (ctx.aoMudar) ctx.aoMudar();
          if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.perfil.falhaDados });
      })
      .catch(function () {
        if (RW.pararCarregando) RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function abrir(pedido, ctx) {
    if (!RW.painel || !pedido) return;
    ctx = ctx || {};
    var m = RW.mensagens.correcoes;
    RW.painel.abrir({
      titulo: m.painelTitulo,
      subtitulo: ctx.posicao ? RW.mensagens.decisao.posicao(m.painelSituacao, ctx.posicao.n, ctx.posicao.total) : m.painelSituacao,
      aoFechar: function () { if (ctx.aoFechar) ctx.aoFechar(); }
    });
    var partes = RW.decisao.montar(RW.painel.corpo());
    if (!partes) return;
    partes.analise.classList.add('oculto');   // correção de dados não mexe na escala

    var itens = pedido.itens || [];
    var nome = ((pedido.grad || '') + ' ' + (pedido.nome || '')).trim();
    var caixa = RW.decisao.caixa({ titulo: m.caixaPedido, frase: m.frase(nome, itens.length, RW.data.isoParaBR(pedido.solicitado_em)) });
    if (!caixa) return;
    /* as linhas com seleção vêm do cartão de pedido (geral-pedido) */
    var cartao = RosterWork.tpl('tpl-pedido');
    var todos = cartao.querySelector('.pedido-item--todos');
    var lista = cartao.querySelector('.pedido-itens');
    caixa.appendChild(todos);
    caixa.appendChild(lista);
    partes.pedido.appendChild(caixa);

    /* rodapé Recusar / Aprovar: agem sobre as marcadas */
    var rodape = RW.painel.rodape();
    var tpl = document.getElementById('tpl-decisao-acoes');
    if (!rodape || !tpl) return;
    rodape.textContent = '';
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var btnRecusar = rodape.querySelector('[data-acao="recusar"]');
    var btnAprovar = rodape.querySelector('[data-acao="aprovar"]');

    /* "Selecionar tudo" reflete as linhas; sem nada marcado não dá para decidir */
    function revisar() {
      var marcados = idsMarcados(caixa).length;
      marcar(todos, marcados === itens.length && itens.length > 0);
      btnAprovar.disabled = !marcados;
      btnRecusar.disabled = !marcados;
    }

    itens.forEach(function (item) {
      var linha = RosterWork.tpl('tpl-pedido-item');
      if (!linha) return;
      linha.setAttribute('data-id', item.id);
      linha.querySelector('.pedido-item-rotulo').textContent = item.rotulo;
      linha.querySelector('.pedido-item-de').textContent = item.valor_atual || '-';
      linha.querySelector('.pedido-item-para').textContent = item.valor_novo || '-';
      linha.addEventListener('click', function () { marcar(linha, !estaMarcada(linha)); revisar(); });
      lista.appendChild(linha);
    });
    todos.addEventListener('click', function () {
      var ligar = !estaMarcada(todos);
      [].forEach.call(caixa.querySelectorAll('.pedido-item[data-id]'), function (l) { marcar(l, ligar); });
      revisar();
    });

    btnAprovar.addEventListener('click', function () { decidir(idsMarcados(caixa), true, null, btnAprovar, ctx); });
    btnRecusar.addEventListener('click', function () {
      RW.decisao.recusar(partes, function (motivo, botao) { decidir(idsMarcados(caixa), false, motivo, botao, ctx); });
    });
    revisar();
  }

  RW.usuariosCorrecaoPainel = { abrir: abrir };
})();
