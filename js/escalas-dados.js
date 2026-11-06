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

  /* grade do mês (RPC ler_escala_mes): por unidade×dia devolve militares + afastados + cobertura +
     erro (por hora, para o gráfico: 0 verde, 1 vermelho, 2 amarelo). A RPC entrega { unidade: { dia: {...} } };
     aqui só reorganizamos nas tabelas que o render consome. Os afastados (férias, licença, dispensa)
     ficam à parte: só a Escala os mostra, com o filtro Afastamentos. Usa a leitura já começada pelo deslize
     do mês (celular) quando é a do mesmo pedido */
  function carregar(unidadesIds, inicio, fim, opcoes) {
    var ids = (unidadesIds || []).map(Number);
    /* com mudança do painel do dia esperando o Salvar, o mês como vai ficar */
    var previa = lerPrevia('ler_escala_mes', { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }, !!(opcoes && opcoes.daTela && !opcoes.semAviso));
    if (previa) return previa.then(function (grade) { if (!grade) throw new Error('falha'); return reorganizar(grade); });
    /* as grades pedem com daTela: o dia que ainda vai mudar vem da cópia guardada, marcado, e a tela sai na hora; quem
       não pede (a célula depois do Salvar, a impressão) lê o dado real */
    var daTela = !!(opcoes && opcoes.daTela);
    var antecipada = daTela && RosterWork.deslizar && RosterWork.deslizar.usarAntecipada(chaveMes(ids, inicio, fim));
    return antecipada || buscarMes(ids, inicio, fim, daTela, !!(opcoes && opcoes.semAviso));
  }

  /* o deslize do mês (geral-deslizar.js): o dedo passou do ponto, a leitura do mês vizinho já começa */
  function antecipar(unidadesIds, inicio, fim) {
    var ids = (unidadesIds || []).map(Number);
    if (RosterWork.deslizar) RosterWork.deslizar.antecipar(chaveMes(ids, inicio, fim), function () { return buscarMes(ids, inicio, fim, true); });
  }

  function chaveMes(ids, inicio, fim) { return 'ler_escala_mes|' + ids.join(',') + '|' + inicio + '|' + fim; }

  function buscarMes(ids, inicio, fim, daTela, semAviso) {
    var corpo = { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim };
    /* no treino, o exemplo roda num ensaio do banco e tem de aparecer: sempre o dado real */
    if (daTela && !(RosterWork.treino && RosterWork.treino.ligado())) corpo.p_aceita_copia = true;
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_mes', { metodo: 'POST', corpo: corpo })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })   // falha rejeita: o render mostra erro em vez de grade vazia falsa
      .then(function (grade) {
        var r = reorganizar(grade || {});
        /* os dias que vieram da cópia guardada: a mesma leitura que os traz diz quais são */
        if (daTela && !semAviso && RosterWork.escalaAtualizando) RosterWork.escalaAtualizando.receberGrade(r.atualizando);
        return r;
      });
  }

  /* { unidade: { dia: { militares, afastados, cobertura, erro } } } -> quatro mapas por unidade/dia (também a escala que
     vem com o mês da Extrajornada) */
  function reorganizar(grade) {
    var militares = {}, afastados = {}, cobertura = {}, erro = {}, atualizando = [];
    Object.keys(grade).forEach(function (uid) {
      militares[uid] = {}; afastados[uid] = {}; cobertura[uid] = {}; erro[uid] = {};
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var c = dias[iso] || {};
        militares[uid][iso] = c.militares || [];
        afastados[uid][iso] = c.afastados || [];
        cobertura[uid][iso] = c.cobertura || [];
        erro[uid][iso] = c.erro || [];
        if (c.atualizando) atualizando.push(uid + '|' + iso);
      });
    });
    return { militares: militares, afastados: afastados, cobertura: cobertura, erro: erro, atualizando: atualizando };
  }

  /* grade do modo Militares (RPC ler_escala_militares): por unidade, a lista de militares
     (grad, nome, ordenados por antiguidade) e, por dia, o estado (serviço + períodos / afastado).
     A RPC entrega { unidade: { militares: [...] } } pronto para o render. */
  function carregarMilitares(unidadesIds, inicio, fim) {
    var ids = (unidadesIds || []).map(Number);
    var previa = lerPrevia('ler_escala_militares', { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }, true);
    if (previa) return previa.then(function (grade) { if (!grade) throw new Error('falha'); return grade; });
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

  /* os dias que ainda podem mudar (RPC escala_dias_atualizando): [{ unidade, data, fila }], fila = ainda vai ser refeito
     (senão, já foi e só falta a cópia guardada); null em falha */
  function lerDiasAtualizando(ids, inicio, fim) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dias_atualizando', { metodo: 'POST', corpo: { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim } })
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

  /* Lançar no SYSBM: a escala de um pelotão no dia, já nas linhas do SYSBM
     ({ok, data, unidade, funcoes_roster, linhas, avisos} ou {ok:false, erro}). null = falha */
  function lerSysbm(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_sysbm', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* o termo do envio ao SYSBM: a situação de quem está logado ({versao_atual, versao_ciente, pendente})
     e a ciência da versão que a tela mostrou ({success, log} ou {success:false, error}). null = falha */
  function sysbmTermo() {
    return RosterWork.rpc('sysbm_termo_situacao')
      .then(function (r) { return (r && r.success) ? r : null; })
      .catch(function () { return null; });
  }

  function sysbmDarCiencia(unidadeId, versao) {
    return RosterWork.rpc('sysbm_dar_ciencia', { p_unidade_id: Number(unidadeId), p_versao: versao })
      .catch(function () { return null; });
  }

  /* a prévia das telas (RPC escala_previa): com mudança do painel do dia esperando o Salvar (o Dia, o Ciclo e a
     Extrajornada; escalas-painel-salvar.js), a leitura pedida já com o rascunho (o banco roda o Salvar num ensaio e desfaz
     tudo, nada é gravado). leitura = ler_escala_mes, ler_escala_militares, escala_dia_arvore, escala_minha_calendario ou
     ler_distribuicao_dia (o painel do dia, com erro_simulacao e erro_parte na recusa). Sem mudança, devolve null (a tela lê
     como sempre); a promessa resolve no mesmo que a leitura devolve, ou null em falha.
     Uma prévia por vez: cada uma segura a escala da companhia no banco até terminar, e duas juntas fariam fila lá dentro,
     gastando o tempo-limite de cada pedido. A próxima espera aqui; o pedido igual que ainda espera dá lugar ao mais novo e
     recebe a resposta dele. soAMaisNova: a grade da tela, em que só vale o último período pedido (quem pediu antes já
     desistiu, pelo latest-wins). Sem resposta em LIMITE_PREVIA_MS, a fila anda */
  var LIMITE_PREVIA_MS = 30000;
  var previaNoAr = null;
  var previasEsperando = [];   // { chave, corpo, avisar: [o resolver de cada pedido] }

  function lerPrevia(leitura, args, soAMaisNova) {
    var corpo = corpoPrevia(leitura, args);
    if (!corpo) return null;
    var chave = soAMaisNova ? leitura : leitura + '|' + JSON.stringify(args || {});
    return new Promise(function (resolver) {
      var igual = previasEsperando.filter(function (x) { return x.chave === chave; })[0];
      if (igual) { igual.corpo = corpo; igual.avisar.push(resolver); }
      else previasEsperando.push({ chave: chave, corpo: corpo, avisar: [resolver] });
      proximaPrevia();
    });
  }
  function proximaPrevia() {
    if (previaNoAr || !previasEsperando.length) return;
    var vez = previaNoAr = previasEsperando.shift();
    var limite = setTimeout(function () { liberarPrevia(vez); }, LIMITE_PREVIA_MS);
    RosterWork.apiFetch('/rest/v1/rpc/escala_previa', { metodo: 'POST', corpo: vez.corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (dados) {
        clearTimeout(limite);
        vez.avisar.forEach(function (resolver) { resolver(dados); });
        liberarPrevia(vez);
      });
  }
  function liberarPrevia(vez) {
    if (previaNoAr !== vez) return;
    previaNoAr = null;
    proximaPrevia();
  }
  /* o corpo do pedido da prévia (null sem mudança): para quem chama a RPC por conta própria (a árvore do modo Dia) */
  function corpoPrevia(leitura, args) {
    var S = RosterWork.escalasPainelSalvar, p = S && S.paraPrevia();
    if (!p) return null;
    var corpo = { p_unidade_id: Number(p.unidadeId), p_data: p.iso, p_dia: p.dia, p_ciclo: p.ciclo,
      p_leitura: leitura, p_args: args || {} };
    if (p.extra) corpo.p_extra = p.extra;
    return corpo;
  }
  /* o Salvar do rodapé do painel do dia (RPC escala_painel_salvar): o Dia (o rascunho, com o "antes"), o Ciclo (as
     mudanças) e a Extrajornada ({competencia, mudancas, motivo}) de uma vez, tudo ou nada; a parte sem mudança vai nula
     (a extra, só com mudança). Resolve no objeto da RPC ({success, logs, mudou, dia}, ou {success:false, error, parte,
     desatualizado}) ou num marcador de falha: { _falha: 'conexao' } (sem rede) | { _falha: 'servidor' } (HTTP não-ok). */
  function painelSalvar(unidadeId, iso, dia, ciclo, extra) {
    var corpo = { p_unidade_id: Number(unidadeId), p_data: iso, p_dia: dia || null, p_ciclo: ciclo || null };
    if (extra) corpo.p_extra = extra;
    return RosterWork.apiFetch('/rest/v1/rpc/escala_painel_salvar', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }

  /* ---- Contínuos (ciclo automático) ---- */
  function continuosListar(unidadeId, iso) {
    return RosterWork.apiFetch('/rest/v1/rpc/escala_continuos_listar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function cicloAcao(rpc, unidadeId, cpf, iso, extras) {
    var corpo = Object.assign({ p_unidade_id: Number(unidadeId), p_cpf: String(cpf), p_data: iso }, extras || {});
    return RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; });
  }
  /* só leitura: o que quebra (trocas e folgas; as extras ficam) se o militar sair do ciclo na data, só no período
     do dia (o da próxima entrada fica) — para o aviso do modal */
  function cicloRetirarAnalisar(unidadeId, cpf, iso) {
    return cicloAcao('escala_ciclo_retirar_analisar', unidadeId, cpf, iso, { p_so_periodo: true });
  }

  /* quem pode entrar no dia como pontual (RPC escala_dia_disponiveis): de folga na área da unidade buscada
     (pelotão = a companhia inteira), de qualquer setor, sem serviço e sem afastamento; vem por unidade, a buscada
     primeiro; "assume" = vira o Chefe de Socorro / Oficial de Área. Com a vaga ({viatura_id, instalacao_id,
     funcao, periodos, cpf}, o seletor do nome), também quem está de serviço, com o grupo, as funções e o
     pode/motivo de cada um. null em falha */
  function disponiveis(unidadeId, iso, unidadeBusca, vaga) {
    var corpo = { p_unidade_id: Number(unidadeId), p_data: iso, p_unidade_busca: Number(unidadeBusca) };
    if (vaga) corpo.p_vaga = vaga;
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dia_disponiveis', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  window.RosterWork.escalasDados = {
    carregar: carregar, antecipar: antecipar, reorganizar: reorganizar, carregarMilitares: carregarMilitares, lerMilitarDia: lerMilitarDia,
    lerDiasAtualizando: lerDiasAtualizando, lerDistribuicaoDia: lerDistribuicaoDia, lerAlteracoesDia: lerAlteracoesDia, lerPrevia: lerPrevia, corpoPrevia: corpoPrevia, painelSalvar: painelSalvar,
    lerImpressao: lerImpressao, lerImpressaoErros: lerImpressaoErros, lerSysbm: lerSysbm,
    sysbmTermo: sysbmTermo, sysbmDarCiencia: sysbmDarCiencia,
    continuosListar: continuosListar, cicloRetirarAnalisar: cicloRetirarAnalisar,
    disponiveis: disponiveis
  };
})();
