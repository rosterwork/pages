/* ============================================================
   POSTOS — mudanças de estado com data (instalação e viatura)
   Cada mudança de estado e a exclusão valem a partir de uma data
   (tabela postos_estados). Aqui ficam, no card, a linha do período
   real (primeiro e último dia: "desde 05/10/2026", "até 06/10/2026")
   e a da próxima mudança de estado ("Reserva a partir de 07/10"), e
   a caixa "Mudanças marcadas" do painel, com o Cancelar de cada uma
   (RPC cancelar_mudanca_posto). Moldes em postos.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* data ISO (AAAA-MM-DD) -> DD/MM (card, como os selos) ou DD/MM/AAAA (painel) */
  function dataCurta(iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '';
  }
  function dataLonga(iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  /* "Reserva a partir de 07/10/2026" ou "Transferência para 2ºPEL a partir de 07/10/2026" */
  function textoMudanca(m, formatar) {
    var t = RosterWork.mensagens.postos;
    if (m.tipo === 'transferencia') {
      return t.transferenciaAPartir.replace('{unidade}', m.destino || '').replace('{data}', formatar(m.data));
    }
    return t.mudancaAPartir.replace('{estado}', m.estado || '').replace('{data}', formatar(m.data));
  }

  /* período real: "Permanente", "desde 05/10/2026", "até 06/10/2026" ou "05/10/2026 a 06/10/2026" */
  function textoPeriodo(inicio, fim) {
    var t = RosterWork.mensagens.postos;
    if (!inicio && !fim) return t.periodoPermanente;
    if (inicio && !fim) return t.periodoDesde.replace('{data}', dataLonga(inicio));
    if (!inicio && fim) return t.periodoAte.replace('{data}', dataLonga(fim));
    return t.periodoIntervalo.replace('{inicio}', dataLonga(inicio)).replace('{fim}', dataLonga(fim));
  }

  /* linha da mudança no card: a próxima mudança de estado ou transferência (o começo e a exclusão já estão no período) */
  function textoMudancaCard(posto) {
    var proxima = (posto.mudancas || []).filter(function (m) { return m.estado !== 'Excluída'; })[0];
    return proxima ? textoMudanca(proxima, dataCurta) : '';
  }

  function preencherCard(card, posto) {
    if (!card || !posto) return;
    var periodo = card.querySelector('.posto-periodo');
    if (periodo) periodo.textContent = textoPeriodo(posto.periodo_inicio, posto.periodo_fim);
    var el = card.querySelector('.posto-mudanca');
    if (!el) return;
    var texto = textoMudancaCard(posto);
    el.textContent = texto;
    el.classList.toggle('oculto', !texto);
  }

  /* guarda no objeto do card o estado devolvido pelo banco (selo, campo do painel, período, mudanças) */
  function aplicarResumo(posto, r) {
    if (!posto || !r) return;
    if (r.status) posto.status = r.status;
    if (r.estado_final) posto.estado_final = r.estado_final;
    posto.periodo_inicio = r.periodo_inicio || null;
    posto.periodo_fim = r.periodo_fim || null;
    posto.mudancas = r.mudancas || [];
  }

  /* ---------- cancelar uma mudança marcada ---------- */

  function cancelar(m, aoCancelada) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // refaz a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/cancelar_mudanca_posto', { metodo: 'POST', corpo: { p_mudanca_id: m.id } })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          if (aoCancelada) aoCancelada(r.posto, r.log);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaCancelarMudanca });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  function confirmarCancelar(m, aoCancelada) {
    if (!RosterWork.confirmar) return;
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.postos.confirmarCancelarMudanca.replace('{mudanca}', textoMudanca(m, dataLonga)),
      textoConfirmar: RosterWork.mensagens.botoes.cancelarMudanca,
      textoCancelar: RosterWork.mensagens.botoes.manter,
      aoConfirmar: function () { cancelar(m, aoCancelada); }
    });
  }

  /* caixa "Mudanças marcadas" do painel (null quando não há nenhuma) */
  function criarLista(posto, aoCancelada) {
    var lista = (posto && posto.mudancas) || [];
    if (!lista.length) return null;
    var caixa = RosterWork.tpl('tpl-posto-mudancas');
    if (!caixa) return null;
    lista.forEach(function (m) {
      var linha = RosterWork.tpl('tpl-posto-mudanca-item');
      if (!linha) return;
      linha.querySelector('.linha-info-rotulo').textContent = textoMudanca(m, dataLonga);
      linha.querySelector('.posto-mudanca-cancelar').addEventListener('click', function () {
        confirmarCancelar(m, aoCancelada);
      });
      caixa.appendChild(linha);
    });
    return caixa;
  }

  window.RosterWork.postosMudancas = {
    preencherCard: preencherCard,
    aplicarResumo: aplicarResumo,
    criarLista: criarLista
  };
})();
