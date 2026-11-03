/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1, Ritmo
   O ritmo da escala da unidade escolhida na barra (24/48 · 24/72 ·
   12/36): um cartão que, fechado, mostra o ritmo e, aberto, as três
   opções. A escolha fica guardada até o Salvar do rodapé, que grava
   junto com o resto, a partir da mesma data (nova_distribuicao_salvar,
   p_ritmo). Vendo a mudança agendada, só se lê: o ritmo tem data
   própria e não faz parte da versão. Sempre pronto.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var unidadeId = null;
  var salvo = null;       // o ritmo gravado da unidade
  var escolhido = null;   // o escolhido e ainda não salvo (null = nenhum)

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  /* lista = a de ajustes_ritmo_listar ([{ unidade_id, ritmo }]); sem a unidade nela, o padrão 24/48 */
  function iniciar(lista, id) {
    var item = (lista || []).filter(function (x) { return x.unidade_id === id; })[0];
    unidadeId = id;
    salvo = (item && item.ritmo) || '24/48';
    escolhido = null;
  }

  function atual() { return escolhido || salvo; }
  function mudou() { return !!escolhido; }
  function descartar() { escolhido = null; }
  function paraSalvar() { return escolhido ? { unidade_id: unidadeId, ritmo: escolhido } : null; }

  /* '24/48' -> '24/48, 24 h de serviço e 48 h de folga' */
  function resposta(ritmo) {
    var partes = ritmo.split('/');
    return P().texto(M().ritmoResposta, { ritmo: ritmo, servico: partes[0], folga: partes[1] });
  }

  /* o bloco: a unidade (no pelotão, "Só deste pelotão") e o cartão do ritmo */
  function ritmo(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-ritmo'));
    var u = P().unidade(corpo, ctx, ctx.ehCia ? '' : M().soDeste);
    var agendada = !!(ctx.agenda && ctx.agenda.vendo);
    P().cartao(u, api, ctx, 'ritmo', M().ritmoTitulo, [resposta(atual())], function (lugar) {
      var opcoes = P().tpl('ritmo');
      P().bolinhas(opcoes, 'nova-distribuicao-ritmo', function (v) { return v === atual(); }, function (v) {
        escolhido = v === salvo ? null : v;
        api.redesenhar();
      }, ctx.soLeitura || agendada);
      lugar.appendChild(opcoes);
      if (agendada) P().trava(lugar, M().ritmoTrava);
    });
  }

  window.RosterWork.novaDistribuicaoRitmo = {
    iniciar: iniciar, mudou: mudou, descartar: descartar, paraSalvar: paraSalvar, ritmo: ritmo
  };
})();
