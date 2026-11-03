/* ============================================================
   USUÁRIOS — o painel da correção de dados que o militar pediu
   O pedido abre no painel de decisão (geral-decisao): a caixa
   "Alterações pedidas" com as linhas do cartão de pedido
   (geral-pedido: cada alteração com a caixa de seleção e o
   "Selecionar tudo"); o rodapé Recusar / Aprovar age sobre as
   marcadas (perfil_decidir). Recusar pede o motivo (opcional).
   Aprovar o Setor que deixa de ser Operacional pede a data da saída
   da escala e mostra a lista das trocas e folgas canceladas (as
   extras ficam), pelo mesmo confirmarSaidaSetor da ficha.
   Abre pela fila (geral-fila) da página Pendências e da aba
   Pendências da Usuários.
   Expõe: RosterWork.usuariosCorrecaoPainel.abrir(pedido, ctx) e
   .confirmarSaidaSetor(o) (usado também pela ficha).
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

  /* sairDesde = a data da saída da escala (Setor que deixa de ser Operacional): recalcula a escala,
     círculo + tela travada; sem ela, pontos no botão */
  function decidir(ids, aprovar, motivo, botao, ctx, sairDesde) {
    if (!ids.length) return;
    function iniciar() { if (sairDesde) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); } else if (RW.iniciarCarregando) RW.iniciarCarregando(botao); }
    function parar() { if (sairDesde) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (RW.pararCarregando) RW.pararCarregando(botao); }
    iniciar();
    RW.rpc('perfil_decidir', { p_ids: ids, p_aprovar: aprovar, p_motivo: motivo || null, p_sair_desde: sairDesde || null })
      .then(function (r) {
        parar();
        if (r && r.success) {
          RW.painel.fechar();
          if (ctx.aoMudar) ctx.aoMudar();
          if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.perfil.falhaDados });
      })
      .catch(function () {
        parar();
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* o Setor que deixa de ser Operacional tira o militar da escala: pede a data (modal padrão) e mostra a lista
     do que acontece com as trocas e folgas (as extras ficam); sem a lista, não segue. A ficha
     (usuarios-painel-editar) e a aprovação da correção usam este mesmo.
     o = { cpf, unidadeId (sem ela, a do militar no dia), pessoa, setor, textoConfirmar, aoConfirmar(iso) } */
  function confirmarSaidaSetor(o) {
    var M = RW.mensagens;
    RW.pedirData({
      mensagem: M.saida.setorData,
      textoConfirmar: M.botoes.continuar,
      sugerida: true,
      aoConfirmar: function (iso) {
        RW.rpc('escala_ciclo_retirar_analisar', { p_unidade_id: o.unidadeId || null, p_cpf: o.cpf, p_data: iso, p_extras: false })
          .catch(function () { return null; })
          .then(function (a) {
            if (!a || !a.success) {
              RW.avisar({ tipo: 'erro', mensagem: (a && a.error) || M.saida.falhaLista });
              return;
            }
            var aviso = RW.avisoSaida(a.pendencias, { tipo: 'setor', escala: M.saida.escalaSetor });
            RW.confirmar({
              tipo: 'aviso',
              mensagem: M.usuarios.confirmarSetor(o.pessoa, o.setor, RW.data.isoParaBR(iso)),
              itens: aviso.itens,
              nota: aviso.nota,
              textoConfirmar: o.textoConfirmar,
              textoCancelar: M.botoes.cancelar,
              aoConfirmar: function () { o.aoConfirmar(iso); }
            });
          });
      }
    });
  }

  /* aprovar: com o Setor que deixa de ser Operacional entre as marcadas, a data e a lista antes */
  function aprovar(pedido, ids, botao, ctx) {
    var setor = (pedido.itens || []).filter(function (item) {
      return item.campo === 'tipo' && ids.indexOf(String(item.id)) >= 0
        && String(item.valor_atual || '').toUpperCase() === 'OPERACIONAL'
        && String(item.valor_novo || '').toUpperCase() !== 'OPERACIONAL';
    })[0];
    if (!setor || !RW.pedirData) { decidir(ids, true, null, botao, ctx); return; }
    confirmarSaidaSetor({
      cpf: pedido.usuario_id,
      unidadeId: null,
      pessoa: ((pedido.grad || '') + ' ' + (pedido.nome || '')).trim(),
      setor: setor.valor_novo,
      textoConfirmar: RW.mensagens.botoes.aprovar,
      aoConfirmar: function (iso) { decidir(ids, true, null, botao, ctx, iso); }
    });
  }

  function abrir(pedido, ctx) {
    if (!RW.painel || !pedido) return;
    ctx = ctx || {};
    var m = RW.mensagens.correcoes;
    RW.painel.abrir({
      titulo: m.painelTitulo,
      tituloExtra: RW.mensagens.decisao.tituloPelotao(pedido.pelotoes),
      subtitulo: ctx.posicao ? RW.mensagens.decisao.posicao(m.painelSituacao, ctx.posicao.n, ctx.posicao.total) : m.painelSituacao,
      aoFechar: function () { if (ctx.aoFechar) ctx.aoFechar(); }
    });
    var partes = RW.decisao.montar(RW.painel.corpo());   // sem análise: correção de dados não mexe na escala
    if (!partes) return;

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

    btnAprovar.addEventListener('click', function () { aprovar(pedido, idsMarcados(caixa), btnAprovar, ctx); });
    btnRecusar.addEventListener('click', function () {
      RW.decisao.recusar(partes, function (motivo, botao) { decidir(idsMarcados(caixa), false, motivo, botao, ctx); });
    });
    revisar();
  }

  RW.usuariosCorrecaoPainel = { abrir: abrir, confirmarSaidaSetor: confirmarSaidaSetor };
})();
