/* ============================================================
   ESCALAS — camada de dados (leitura do banco)
   Só chama as RPCs e entrega os dados prontos para a tela. Toda a
   lógica (mescla automático + manuais, fusão de faixas, cobertura,
   vãos, conflitos) fica no BANCO — princípio do projeto: lógica
   inteligente no Supabase; o frontend só exibe e edita.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* grade do mês (RPC ler_escala_mes): por unidade×dia devolve militares + cobertura +
     erro (por hora, para o gráfico) + conflito. A RPC entrega { unidade: { dia: {...} } };
     aqui só reorganizamos nas quatro tabelas que o render consome. */
  function carregar(unidadesIds, inicio, fim) {
    var ids = (unidadesIds || []).map(Number);
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_mes', {
      metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }
    })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })   // falha rejeita: o render mostra erro em vez de grade vazia falsa
      .then(function (grade) { return reorganizar(grade || {}); });
  }

  /* { unidade: { dia: { militares, cobertura, erro, conflito } } } -> quatro mapas por unidade/dia */
  function reorganizar(grade) {
    var militares = {}, cobertura = {}, erro = {}, conflito = {};
    Object.keys(grade).forEach(function (uid) {
      militares[uid] = {}; cobertura[uid] = {}; erro[uid] = {}; conflito[uid] = {};
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var c = dias[iso] || {};
        militares[uid][iso] = c.militares || [];
        cobertura[uid][iso] = c.cobertura || [];
        erro[uid][iso] = c.erro || [];
        conflito[uid][iso] = c.conflito || false;
      });
    });
    return { militares: militares, cobertura: cobertura, erro: erro, conflito: conflito };
  }

  /* grade do modo Militares (RPC ler_escala_militares): por unidade, a lista de militares
     (grad, nome, ordenados por antiguidade) e, por dia, o estado (serviço + períodos / afastado).
     A RPC entrega { unidade: { militares: [...] } } pronto para o render. */
  function carregarMilitares(unidadesIds, inicio, fim) {
    var ids = (unidadesIds || []).map(Number);
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_militares', {
      metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }
    })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })   // falha rejeita: o render mostra erro em vez de grade vazia falsa
      .then(function (grade) { return grade || {}; });
  }

  /* ONDE de um militar num dia (RPC ler_militar_dia): as funções que ele exerce em todo o
     contexto (auto + manuais), com posto, origem e períodos — cobre também reforço em posto de
     outra unidade. Devolve um array (vazio = de serviço sem função) ou null em falha. */
  function lerMilitarDia(cpf, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/ler_militar_dia', { metodo: 'POST', corpo: { p_cpf: String(cpf), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* distribuição de um dia (RPC ler_distribuicao_dia): automático + manuais (e o rascunho,
     quando editando). Sem rascunho = salvo (modo Ver); com rascunho = simulação (modo Editar). */
  function lerDistribuicaoDia(unidadeId, iso, rascunho) {
    var corpo = { p_unidade_id: Number(unidadeId), p_data: iso };
    if (rascunho != null) corpo.p_rascunho = rascunho;
    return RosterWork.apiFetch('/rest/v1/rpc/ler_distribuicao_dia', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* grava os ajustes do dia (lista de Colocar/Tirar) na escalas_manuais via RPC.
     Resolve no objeto da RPC ({success,log}) ou num marcador de falha:
     { _falha: 'conexao' } (sem rede) | { _falha: 'servidor' } (HTTP não-ok). */
  function salvarAjustesDia(contextoId, iso, ajustes, autorCpf) {
    return RosterWork.apiFetch('/rest/v1/rpc/salvar_ajustes_dia', { metodo: 'POST', corpo: { p_contexto_id: Number(contextoId), p_data: iso, p_ajustes: ajustes || [], p_autor_cpf: autorCpf || null } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- Contínuos (ciclo automático) ---- */
  function continuosListar(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_continuos_listar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function cicloAcao(rpc, unidadeId, cpf, iso, autorCpf, horario) {
    var corpo = { p_admin_cpf: autorCpf || null, p_unidade_id: Number(unidadeId), p_cpf: String(cpf), p_data: iso };
    if (horario != null) corpo.p_horario = horario;
    return RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }
  function cicloAdicionar(unidadeId, cpf, iso, autorCpf, horario) { return cicloAcao('escala_ciclo_adicionar', unidadeId, cpf, iso, autorCpf, horario || '08:00'); }
  function cicloRetirar(unidadeId, cpf, iso, autorCpf) { return cicloAcao('escala_ciclo_retirar', unidadeId, cpf, iso, autorCpf); }
  /* só leitura: o que quebra (trocas/folgas) se o militar sair na data — para o aviso do modal */
  function cicloRetirarAnalisar(unidadeId, cpf, iso, autorCpf) { return cicloAcao('escala_ciclo_retirar_analisar', unidadeId, cpf, iso, autorCpf); }
  function cicloCancelarSaida(unidadeId, cpf, iso, autorCpf) { return cicloAcao('escala_ciclo_cancelar_saida', unidadeId, cpf, iso, autorCpf); }
  /* Salvar em lote das mudanças do ciclo acumuladas na tela (recalcula uma vez) */
  function cicloSalvarLote(unidadeId, iso, mudancas, autorCpf) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_salvar_lote', { metodo: 'POST', corpo: { p_admin_cpf: autorCpf || null, p_unidade_id: Number(unidadeId), p_data: iso, p_mudancas: mudancas || [] } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- Pontuais (militar avulso no dia) ---- */
  function pontuaisListar(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_pontuais_listar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function pontuaisSalvar(unidadeId, iso, entradas, autorCpf) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_pontuais_salvar', { metodo: 'POST', corpo: { p_admin_cpf: autorCpf || null, p_unidade_id: Number(unidadeId), p_data: iso, p_entradas: entradas || [] } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- nota da manutenção (editada inline no painel do dia) ---- */
  function atualizarManutencaoObs(manutencaoId, obs, autorCpf) {
    return RosterWork.apiFetch('/rest/v1/rpc/atualizar_manutencao_observacao', { metodo: 'POST', corpo: { p_manutencao_id: manutencaoId, p_observacao: obs || '', p_por: autorCpf || null } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- observações manuais do admin no dia (Editar) ---- */
  function observacaoAdicionar(unidadeId, iso, texto) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_observacao_adicionar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_texto: texto || '' } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }
  function observacaoRemover(id) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_observacao_remover', { metodo: 'POST', corpo: { p_id: id } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  window.RosterWork.escalasDados = {
    carregar: carregar, carregarMilitares: carregarMilitares, lerMilitarDia: lerMilitarDia,
    lerDistribuicaoDia: lerDistribuicaoDia, salvarAjustesDia: salvarAjustesDia,
    continuosListar: continuosListar, cicloAdicionar: cicloAdicionar, cicloRetirar: cicloRetirar,
    cicloRetirarAnalisar: cicloRetirarAnalisar,
    cicloCancelarSaida: cicloCancelarSaida, cicloSalvarLote: cicloSalvarLote,
    pontuaisListar: pontuaisListar, pontuaisSalvar: pontuaisSalvar,
    atualizarManutencaoObs: atualizarManutencaoObs,
    observacaoAdicionar: observacaoAdicionar, observacaoRemover: observacaoRemover
  };
})();
