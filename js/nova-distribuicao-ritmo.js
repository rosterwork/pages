/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1, Ritmo
   O ritmo da escala da unidade escolhida na barra (24/48 · 24/72 ·
   12/36): um cartão que, fechado, mostra o ritmo e, aberto, as três
   opções. A escolha fica guardada até o Salvar do rodapé, que grava
   junto com o resto, a partir da mesma data (nova_distribuicao_salvar,
   p_ritmo). Vendo a mudança agendada, só se lê: o ritmo tem data
   própria e não faz parte da versão. Sempre pronto.
   Na companhia, o cartão do Dia da guarnição A: um dia em que a
   guarnição A está de serviço (o calendário), de onde sai a letra de
   cada dia. A escolha também espera o Salvar do rodapé, que a grava
   depois do resto (ajustes_guarnicao_salvar; ela não refaz a escala).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var unidadeId = null;
  var salvo = null;       // o ritmo gravado da unidade
  var escolhido = null;   // o escolhido e ainda não salvo (null = nenhum)
  var guarnicaoSalva = null;       // o dia da guarnição A gravado da companhia (AAAA-MM-DD, ou null)
  var guarnicaoEscolhida = null;   // o escolhido e ainda não salvo (null = nenhum)

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function D() { return RosterWork.data; }

  /* lista = a de ajustes_ritmo_listar ([{ unidade_id, ritmo, guarnicao_a_em }]); sem a unidade nela, o padrão 24/48 */
  function iniciar(lista, id) {
    var item = (lista || []).filter(function (x) { return x.unidade_id === id; })[0];
    unidadeId = id;
    salvo = (item && item.ritmo) || '24/48';
    escolhido = null;
    guarnicaoSalva = (item && item.guarnicao_a_em) || null;
    guarnicaoEscolhida = null;
  }

  function atual() { return escolhido || salvo; }
  function mudou() { return !!escolhido || !!guarnicaoEscolhida; }
  function descartar() { escolhido = null; guarnicaoEscolhida = null; }
  function paraSalvar() { return escolhido ? { unidade_id: unidadeId, ritmo: escolhido } : null; }
  function guarnicaoParaSalvar() { return guarnicaoEscolhida ? { unidade_id: unidadeId, data: guarnicaoEscolhida } : null; }

  /* '24/48' -> '24/48, 24 h de serviço e 48 h de folga' */
  function resposta(ritmo) {
    var partes = ritmo.split('/');
    return P().texto(M().ritmoResposta, { ritmo: ritmo, servico: partes[0], folga: partes[1] });
  }

  /* o Dia da guarnição A (só na companhia): fechado, o dia; aberto, o campo com o calendário */
  function guarnicao(u, ctx, api, agendada) {
    var dia = guarnicaoEscolhida || guarnicaoSalva;
    P().cartao(u, api, ctx, 'guarnicao', M().guarnicaoTitulo, [dia ? D().isoParaBR(dia) : M().guarnicaoSem], function (lugar) {
      var caixa = P().tpl('guarnicao'), campo = caixa.querySelector('.nova-distribuicao-guarnicao-data');
      var travado = ctx.soLeitura || agendada;
      campo.value = dia ? D().isoParaBR(dia) : '';
      campo.disabled = travado;
      lugar.appendChild(caixa);
      if (travado) {
        if (agendada) P().trava(lugar, M().guarnicaoTrava);
        return;
      }
      RosterWork.calendario.ligar(campo, {
        obterData: function () { return D().paraData(campo.value); },
        aoEscolher: function (data) {
          var iso = D().paraIsoDeData(data);
          guarnicaoEscolhida = iso === guarnicaoSalva ? null : iso;
          api.redesenhar();
        }
      });
    });
  }

  /* o bloco: a unidade (no pelotão, "Só deste pelotão"), o cartão do ritmo e, na companhia, o do dia da guarnição A */
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
    if (ctx.ehCia) guarnicao(u, ctx, api, agendada);
  }

  window.RosterWork.novaDistribuicaoRitmo = {
    iniciar: iniciar, mudou: mudou, descartar: descartar, paraSalvar: paraSalvar, guarnicaoParaSalvar: guarnicaoParaSalvar, ritmo: ritmo
  };
})();
