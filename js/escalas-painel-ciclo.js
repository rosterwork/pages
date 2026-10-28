/* ============================================================
   ESCALAS — o ciclo pelo painel do dia (as abas Dia e Ciclo)
   - salvar: grava pelo ciclo (escala_ciclo_salvar_lote), com o véu
     enquanto a escala é recalculada, e abre o resumo; com desfazer,
     o resumo traz o Desfazer (escala_ciclo_desfazer), só para o que
     não cancelou nada: a entrada de quem estava fora do ciclo e o
     cancelamento da saída;
   - confirmar: a lista do que acontece com as trocas, folgas e
     extras a partir do dia (escala_ciclo_retirar_analisar) e a
     confirmação;
   - datas: as três últimas datas de serviço no ciclo atual, em
     bolinhas, com o dia da semana (o último serviço no ciclo antigo
     de quem muda de ciclo);
   - entrar (quem está fora do ciclo, com o Desfazer) e mudar de
     ciclo (com a lista do que é cancelado, sem Desfazer), e as frases
     de quem muda de ciclo: o Adicionar militar da aba Dia e a aba
     Ciclo usam os mesmos.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada lista de datas

  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  /* "2026-10-23" -> "2026-10-24" */
  function diaSeguinte(iso) {
    var p = iso.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 1);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* opcoes = { desfazer: { cpf, acao, saida_em? } | null, aoTerminar() } */
  function salvar(unidadeId, iso, mudancas, opcoes) {
    opcoes = opcoes || {};
    var geral = RosterWork.mensagens.geral;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo e tela travada
    RosterWork.escalasDados.cicloSalvarLote(unidadeId, iso, mudancas).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r._falha === 'conexao') { RosterWork.avisar({ tipo: 'erro', mensagem: geral.semConexao }); return; }
      if (r && r._falha === 'servidor') { RosterWork.avisar({ tipo: 'erro', mensagem: geral.falhaServidor }); return; }
      if (!r || !r.success) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaSalvar }); return; }
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      if (r.log && RosterWork.resumo) {
        var d = opcoes.desfazer;
        RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala', desfazer: d && r.log.id ? function () {
          if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();
          return RosterWork.escalasDados.cicloDesfazer(unidadeId, iso, d.cpf, d.acao, r.log.id, d.saida_em).then(function (res) {
            if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
            var ok = !!(res && res.success);
            if (ok) {
              window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
              if (opcoes.aoTerminar) opcoes.aoTerminar();
            }
            /* o geral-resumo espera { ok, erro } */
            return { ok: ok, erro: res && (res.error || (res._falha === 'conexao' ? geral.semConexao : res._falha ? geral.falhaServidor : '')) };
          });
        } : null });
      }
      if (opcoes.aoTerminar) opcoes.aoTerminar();
    });
  }

  /* textos = { mensagem, escala, botao }; desde = o dia de onde a lista conta (sem ele, o iso) */
  function confirmar(unidadeId, iso, cpf, textos, aoConfirmar, desde) {
    var S = RosterWork.mensagens.saida;
    RosterWork.escalasDados.cicloRetirarAnalisar(unidadeId, cpf, desde || iso).then(function (a) {
      if (!a || !a.success) { RosterWork.avisar({ tipo: 'erro', mensagem: (a && a.error) || S.falhaLista }); return; }
      var aviso = RosterWork.avisoSaida(a.pendencias, { tipo: 'tirar', escala: textos.escala });
      RosterWork.confirmar({ tipo: 'aviso', mensagem: textos.mensagem, itens: aviso.itens, nota: aviso.nota,
        textoConfirmar: textos.botao, aoConfirmar: aoConfirmar });
    });
  }

  /* monta em lugar as datas (do molde tpl-escala-adicionar-data) e devolve marcar(data) */
  function datas(lugar, lista, aoEscolher) {
    lugar.textContent = '';
    var nome = 'escala-ciclo-datas-' + (++conta);
    (lista || []).forEach(function (d) {
      var op = RosterWork.tpl('tpl-escala-adicionar-data');
      if (!op) return;
      var r = op.querySelector('input');
      r.value = d;
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(d); });
      op.querySelector('.escala-adicionar-data-texto').textContent = RosterWork.data.comDiaSemanaExtenso(d);
      lugar.appendChild(op);
    });
    return function marcar(valor) {
      [].forEach.call(lugar.querySelectorAll('input[type="radio"]'), function (r) { r.checked = r.value === valor; });
    };
  }

  /* quem está fora do ciclo entra a partir do dia: a confirmação e a gravação, com o Desfazer no resumo */
  function entrar(unidadeId, iso, m, aoTerminar) {
    RosterWork.confirmar({ tipo: 'aviso', mensagem: L().cicloConfirmarEntrar(nomeDe(m), diaMes(iso)), textoConfirmar: L().botaoNoCiclo,
      aoConfirmar: function () {
        salvar(unidadeId, iso, [{ cpf: m.cpf, acao: 'adicionar' }], { desfazer: { cpf: m.cpf, acao: 'adicionar' }, aoTerminar: aoTerminar });
      } });
  }

  /* quem já está no ciclo muda de ciclo: a lista do que é cancelado depois do último serviço escolhido e a confirmação */
  function mudar(unidadeId, iso, m, ultimo, aoTerminar) {
    var mudanca = { cpf: m.cpf, acao: 'adicionar' }, data = diaMes(iso);
    if (ultimo) mudanca.ultimo_servico = ultimo;
    confirmar(unidadeId, iso, m.cpf, {
      mensagem: L().cicloConfirmarMudar(nomeDe(m), data),
      escala: ultimo ? L().cicloEscalaUltimo(diaMes(ultimo), data) : L().cicloEscalaMudar(data),
      botao: L().botaoMudarCiclo
    }, function () { salvar(unidadeId, iso, [mudanca], { aoTerminar: aoTerminar }); }, ultimo ? diaSeguinte(ultimo) : iso);
  }

  /* as frases de quem muda de ciclo: o que sai da escala dele (o alerta) e o aviso de antes de confirmar */
  function frasesMudar(m, ultimo, iso) {
    var D = RosterWork.data, lista = m.ultimos_servicos || [];
    var alerta = ultimo
      ? L().cicloRemovido(nomeDe(m), D.diaMesExtenso(ultimo), lista.filter(function (d) { return d > ultimo; }).map(D.diaMesExtenso), D.diaMesExtenso(iso))
      : L().cicloMudar(diaMes(m.desde), m.ultimo_servico ? diaMes(m.ultimo_servico) : '', diaMes(iso));
    return { alerta: alerta, info: L().cicloMudarAviso(ultimo ? diaMes(ultimo) : '') };
  }

  window.RosterWork.escalasPainelCiclo = {
    salvar: salvar, confirmar: confirmar, datas: datas, entrar: entrar, mudar: mudar, frasesMudar: frasesMudar
  };
})();
