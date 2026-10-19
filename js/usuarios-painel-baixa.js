/* ============================================================
   USUÁRIOS — Dar baixa e Readmitir (sub-telas da aba Carreira, só admin)
   Dar baixa do sistema (militar ativo): a data "A partir de"
   (padrão hoje, não pode ser futura) e, no Dar baixa do rodapé, o
   modal vermelho com o nome, o CPF e a lista do que a baixa
   cancela (escala_ciclo_retirar_analisar); grava por
   dar_baixa_militar. Readmitir ao efetivo (militar inativo): a
   data e a confirmação; grava por readmitir_militar. Nos dois, o
   painel fecha, as listas releem e o resumo abre. Orquestração no
   usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, ctl, dataEl }

  function hojeBR() { return RosterWork.data.paraBR(new Date()); }

  function formatarCpf(cpf) {
    var n = String(cpf == null ? '' : cpf).replace(/\D/g, '');
    if (n.length !== 11) return cpf || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /* "Cabo João Carlos Andrade" (o posto por extenso e o nome completo, como nos avisos) */
  function nomePessoa(c) {
    var ins = (c.ficha && c.ficha.institucionais) || {};
    var p = (c.ficha && c.ficha.pessoais) || {};
    return ((ins.grau_nome || (c.pessoa && c.pessoa.grau_nome) || '') + ' ' +
            (p.nome_completo || (c.pessoa && c.pessoa.nome_completo) || '')).trim();
  }

  /* valida o "A partir de": devolve o ISO ou null (marca o erro no campo) */
  function dataIso() {
    var V = RosterWork.validacoes, C = RosterWork.campos;
    if (!ctx || !ctx.dataEl) return null;
    C.limparErro(ctx.dataEl);
    var dt = V.parseData(ctx.dataEl.value);
    if (!dt) { C.marcarErro(ctx.dataEl, RosterWork.mensagens.cadastro.dataInvalida); return null; }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (dt > hoje) { C.marcarErro(ctx.dataEl, RosterWork.mensagens.usuarios.dataFutura); return null; }
    return V.paraISO(ctx.dataEl.value);
  }

  /* grava (baixa ou readmissão); no sucesso o painel fecha (o militar sai da lista em que estava) */
  function gravar(atual, rpc, corpo, falha) {
    RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          ctx = null;
          atual.ctl.concluir(r, { fechar: true });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || falha });
        }
      })
      .catch(function () {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* modal vermelho da baixa: nome, CPF e a lista do que vai acontecer; sem a lista, não dá baixa */
  function confirmarBaixa() {
    var atual = ctx;
    if (!atual || !RosterWork.confirmar) return;
    var iso = dataIso();
    if (!iso) return;   /* data inválida/futura: o campo já mostra o erro */
    var ins = atual.ficha.institucionais || {};
    var M = RosterWork.mensagens;
    var mensagem = M.usuarios.confirmarBaixa
      .replace('{pessoa}', nomePessoa(atual)).replace('{cpf}', formatarCpf(atual.pessoa.usuario_id)).replace('{data}', atual.dataEl.value);
    /* a data da baixa não passa de hoje; o que ela cancela conta a partir de hoje (o que já aconteceu fica),
       e a disponibilidade de extra sai a partir deste mês */
    var hojeIso = RosterWork.data.paraIsoDeData(new Date());
    var cotas = M.saida.cotasBaixa(hojeIso.slice(5, 7) + '/' + hojeIso.slice(0, 4));
    RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_retirar_analisar', {
      metodo: 'POST',
      corpo: { p_unidade_id: Number(ins.lotacao_id) || null, p_cpf: atual.pessoa.usuario_id, p_data: hojeIso }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (a) {
        if (ctx !== atual) return;
        if (!a || !a.success) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (a && a.error) || M.saida.falhaLista });
          return;
        }
        var aviso = RosterWork.avisoSaida(a.pendencias, { tipo: 'baixa', escala: M.saida.escalaBaixa, cotas: cotas });
        RosterWork.confirmar({
          tipo: 'erro',
          mensagem: mensagem,
          itens: aviso.itens,
          nota: aviso.nota,
          textoConfirmar: M.botoes.darBaixa,
          textoCancelar: M.botoes.cancelar,
          confirmarPerigo: true,
          aoConfirmar: function () {
            gravar(atual, 'dar_baixa_militar', { p_cpf: atual.pessoa.usuario_id, p_data: iso }, M.usuarios.falhaBaixa);
          }
        });
      });
  }

  function confirmarReadmissao() {
    var atual = ctx;
    if (!atual || !RosterWork.confirmar) return;
    var iso = dataIso();
    if (!iso) return;
    var M = RosterWork.mensagens;
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: M.usuarios.confirmarReadmissao.replace('{pessoa}', nomePessoa(atual)),
      textoConfirmar: M.botoes.readmitir,
      textoCancelar: M.botoes.cancelar,
      aoConfirmar: function () {
        gravar(atual, 'readmitir_militar', { p_cpf: atual.pessoa.usuario_id, p_data: iso }, M.usuarios.falhaReadmissao);
      }
    });
  }

  /* a sub-tela com a data "A partir de" (padrão hoje); devolve o que o rodapé usa */
  function montar(molde, corpo, ficha, pessoa, ctl, cfg) {
    if (!corpo || !ficha || !pessoa) return null;
    var subtela = RosterWork.tpl(molde);
    if (!subtela) return null;
    ctx = { ficha: ficha, pessoa: pessoa, ctl: ctl, dataEl: subtela.querySelector('[data-vigencia-data]') };
    if (ctx.dataEl) {
      RosterWork.campos.ligarData(ctx.dataEl);
      ctx.dataEl.value = hojeBR();
      ctx.dataEl.addEventListener('input', function () { RosterWork.campos.limparErro(ctx.dataEl); ctl.aoMudar(); });
    }
    corpo.appendChild(subtela);
    var atual = ctx;
    return {
      textoAplicar: cfg.textoAplicar,
      perigo: !!cfg.perigo,
      podeAplicar: function () { return ctx === atual; },
      /* a data mudada do padrão (hoje) e ainda não confirmada */
      sujo: function () { return ctx === atual && !!atual.dataEl && atual.dataEl.value !== hojeBR(); },
      aplicar: cfg.aplicar
    };
  }

  function montarBaixa(corpo, ficha, pessoa, ctl) {
    return montar('tpl-ficha-sub-baixa', corpo, ficha, pessoa, ctl,
      { textoAplicar: RosterWork.mensagens.botoes.darBaixa, perigo: true, aplicar: confirmarBaixa });
  }

  function montarReadmitir(corpo, ficha, pessoa, ctl) {
    return montar('tpl-ficha-sub-readmitir', corpo, ficha, pessoa, ctl,
      { textoAplicar: RosterWork.mensagens.botoes.readmitir, aplicar: confirmarReadmissao });
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelBaixa = { montarBaixa: montarBaixa, montarReadmitir: montarReadmitir, reset: reset };
})();
