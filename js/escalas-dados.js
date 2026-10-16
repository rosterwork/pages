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
     erro (por hora, para o gráfico: 0 verde, 1 vermelho, 2 amarelo). A RPC entrega { unidade: { dia: {...} } };
     aqui só reorganizamos nas três tabelas que o render consome. */
  function carregar(unidadesIds, inicio, fim) {
    var ids = (unidadesIds || []).map(Number);
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_mes', {
      metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }
    })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })   // falha rejeita: o render mostra erro em vez de grade vazia falsa
      .then(function (grade) { return reorganizar(grade || {}); });
  }

  /* { unidade: { dia: { militares, cobertura, erro } } } -> três mapas por unidade/dia */
  function reorganizar(grade) {
    var militares = {}, cobertura = {}, erro = {};
    Object.keys(grade).forEach(function (uid) {
      militares[uid] = {}; cobertura[uid] = {}; erro[uid] = {};
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var c = dias[iso] || {};
        militares[uid][iso] = c.militares || [];
        cobertura[uid][iso] = c.cobertura || [];
        erro[uid][iso] = c.erro || [];
      });
    });
    return { militares: militares, cobertura: cobertura, erro: erro };
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

  /* alterações manuais do dia de uma unidade (RPC escala_alteracoes_dia): [{ autor, criado_em, resumo }]
     do mais novo ao mais antigo; null em falha (o rodapé então não aparece) */
  function lerAlteracoesDia(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_alteracoes_dia', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* impressão (PDF): a escala do período para as unidades marcadas, como no modo Dia
     ({unidades, dias}); o painel pede em blocos pequenos. null = falha */
  function lerImpressao(ids, inicio, fim) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_impressao', { metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* impressão: dias do período com erro grave nas unidades marcadas ([{data, unidade_id, unidade}]). null = falha */
  function lerImpressaoErros(ids, inicio, fim) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_impressao_erros', { metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* prévia do Editar do Dia (RPC escala_dia_simular): o dia como ficaria com o rascunho
     {ajustes, pontuais?, folgas}; pontuais e folgas entram num ensaio no banco (nada é gravado) */
  function simularDia(unidadeId, iso, rascunho) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dia_simular', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_rascunho: rascunho || {} } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  /* Salvar do Editar do Dia (RPC escala_dia_salvar): pontuais, folgas e funções num salvamento só.
     Resolve no objeto da RPC ({success,log}) ou num marcador de falha:
     { _falha: 'conexao' } (sem rede) | { _falha: 'servidor' } (HTTP não-ok). */
  function salvarDia(unidadeId, iso, rascunho) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dia_salvar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_rascunho: rascunho || {} } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- Contínuos (ciclo automático) ---- */
  function continuosListar(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_continuos_listar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function cicloAcao(rpc, unidadeId, cpf, iso, horario) {
    var corpo = { p_unidade_id: Number(unidadeId), p_cpf: String(cpf), p_data: iso };
    if (horario != null) corpo.p_horario = horario;
    return RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }
  /* só leitura: o que quebra (trocas/folgas) se o militar sair na data — para o aviso do modal */
  function cicloRetirarAnalisar(unidadeId, cpf, iso) { return cicloAcao('escala_ciclo_retirar_analisar', unidadeId, cpf, iso); }
  /* Salvar em lote das mudanças do ciclo acumuladas na tela (recalcula uma vez) */
  function cicloSalvarLote(unidadeId, iso, mudancas) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_salvar_lote', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_mudancas: mudancas || [] } })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- Extrajornada do dia (aba do painel do dia, na Escala e na Extrajornada) ---- */
  function rpcExtra(nome, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  /* quem tira extra nesta unidade no dia, os ajustes do dia e a cobertura sem e com extra; com o
     rascunho (ops), a cobertura e os dias mexidos já com as mudanças (ensaio no motor, nada é gravado) */
  function extraPainel(unidadeId, iso, ops) {
    return rpcExtra('extra_dia_painel', { p_unidade: Number(unidadeId), p_data: iso, p_ops: ops || [] });
  }
  /* a lista do dia: os voluntários com termo e cota, a preferência, as extras deles no mês e quem não pode (o motivo) */
  function extraLista(unidadeId, iso) {
    return rpcExtra('extra_dia_lista', { p_unidade: Number(unidadeId), p_data: iso });
  }

  /* quem pode entrar no dia como pontual (RPC escala_dia_disponiveis): de folga na unidade buscada (e nas de
     baixo dela), sem serviço e sem afastamento; "assume" = vira o Chefe de Socorro / Oficial de Área.
     null em falha */
  function disponiveis(unidadeId, iso, unidadeBusca) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dia_disponiveis', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_unidade_busca: Number(unidadeBusca) } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  window.RosterWork.escalasDados = {
    carregar: carregar, carregarMilitares: carregarMilitares, lerMilitarDia: lerMilitarDia,
    lerDistribuicaoDia: lerDistribuicaoDia, lerAlteracoesDia: lerAlteracoesDia, simularDia: simularDia, salvarDia: salvarDia,
    lerImpressao: lerImpressao, lerImpressaoErros: lerImpressaoErros,
    continuosListar: continuosListar, cicloRetirarAnalisar: cicloRetirarAnalisar, cicloSalvarLote: cicloSalvarLote,
    extraPainel: extraPainel, extraLista: extraLista,
    disponiveis: disponiveis
  };
})();
