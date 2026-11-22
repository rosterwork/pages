/* ============================================================
   ESCALAS — camada de dados (leitura do banco)
   Só chama as RPCs e entrega os dados prontos para a tela. Toda a
   lógica (mescla automático + manuais, fusão de faixas, cobertura,
   vãos, conflitos) fica no BANCO — princípio do projeto: lógica
   inteligente no Supabase; o frontend só exibe e edita.
   Depois do Salvar que relê a grade inteira, o dia salvo vem com o
   dado real, nunca com a cópia guardada velha (os dias certos).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* grade do mês (RPC ler_escala_mes): por unidade×dia devolve militares + fora + cobertura +
     erro (por hora, para o gráfico: 0 verde, 1 vermelho, 2 amarelo). A RPC entrega { unidade: { dia: {...} } };
     aqui só reorganizamos nas tabelas que o render consome. Quem está fora da escala (os operacionais sem guarnição)
     fica à parte: só a Escala o mostra, no fim da célula. Usa a leitura já começada pelo deslize
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
    esquecerGuardados();   // a grade lida de novo: as leituras guardadas saem (as leituras guardadas, abaixo)
    var corpo = { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim };
    /* no treino, o exemplo roda num ensaio do banco e tem de aparecer: sempre o dado real */
    if (daTela && !(RosterWork.treino && RosterWork.treino.ligado())) corpo.p_aceita_copia = true;
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_mes', { metodo: 'POST', corpo: corpo })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })   // falha rejeita: o render mostra erro em vez de grade vazia falsa
      .then(function (grade) { return daTela ? comCertos(grade || {}, ids, inicio, fim) : grade; })
      .then(function (grade) {
        var r = reorganizar(grade || {});
        /* os dias que vieram da cópia guardada: a mesma leitura que os traz diz quais são */
        if (daTela && !semAviso && RosterWork.escalaAtualizando) RosterWork.escalaAtualizando.receberGrade(r.atualizando);
        return r;
      });
  }

  /* { unidade: { dia: { militares, fora, cobertura, erro, oficial, estagiarios } } } -> quatro mapas por unidade/dia (também a
     escala que vem com o mês da Extrajornada) e o Oficial de Área de cada dia ({ dia: {grad, nome} | null }; o mesmo em
     todas as unidades da companhia; o dia sem a chave não tem escala). Os militares vêm na ordem dos grupos da célula
     (escalas-celula-grupos.js); a chave "saidas" (quem saiu da guarnição) fica de lado: ele aparece no Fora da escala */
  function reorganizar(grade) {
    var militares = {}, fora = {}, cobertura = {}, erro = {}, atualizando = [], oficial = {};
    /* quem está de serviço e de extra no mesmo horário: a nota da Escala lê cada leitura (escalas-extra-servico.js) */
    if (RosterWork.escalaExtraServico) RosterWork.escalaExtraServico.anotar(grade);
    /* o sobreaviso da companhia de cada dia: a célula o desenha no lugar dele (escalas-celula-sobreaviso.js) */
    if (RosterWork.escalasCelulaSobreaviso) RosterWork.escalasCelulaSobreaviso.guardar(grade);
    /* a Operação Verão de cada dia: a página Op. Verão a desenha na célula e no título (op-verao-celula.js) */
    if (RosterWork.opVeraoCelula) RosterWork.opVeraoCelula.guardar(grade);
    /* os estagiários que não são efetivo de cada hora: a dica da faixa os mostra embaixo dos militares (escalas-celula.js) */
    if (RosterWork.escalasCelula) RosterWork.escalasCelula.guardarEstagiarios(grade);
    Object.keys(grade).forEach(function (uid) {
      militares[uid] = {}; fora[uid] = {}; cobertura[uid] = {}; erro[uid] = {};
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var c = dias[iso] || {};
        militares[uid][iso] = c.militares || [];
        /* quem tem autorização de viagem no dia (a chave "viagens") vai com o Fora da escala: a célula põe no grupo dela */
        fora[uid][iso] = (c.fora || []).concat(c.viagens || []);
        cobertura[uid][iso] = c.cobertura || [];
        erro[uid][iso] = c.erro || [];
        if (c.atualizando) atualizando.push(uid + '|' + iso);
        /* o Oficial de Área do dia (o da faixa das 08h) e, quando a leitura traz, todos os do dia com o horário (todos) */
        if (Object.prototype.hasOwnProperty.call(c, 'oficial') && !Object.prototype.hasOwnProperty.call(oficial, iso)) {
          oficial[iso] = c.oficial && c.oficiais ? Object.assign({}, c.oficial, { todos: c.oficiais }) : c.oficial;
        }
      });
    });
    return { militares: militares, fora: fora, cobertura: cobertura, erro: erro, atualizando: atualizando, oficial: oficial };
  }

  /* grade do modo Militares (RPC ler_escala_militares): por unidade, a lista de militares
     (grad, nome, ordenados por antiguidade) e, por dia, o estado (serviço + períodos / afastado).
     A RPC entrega { unidade: { militares: [...] } } pronto para o render. estagiarios (o Militares da página Estágios):
     só quem participa dos estágios em vigor, cada um com o estagio_id, e a lista estagios de cada unidade */
  function carregarMilitares(unidadesIds, inicio, fim, estagiarios) {
    var ids = (unidadesIds || []).map(Number);
    var args = { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim };
    if (estagiarios) args.p_estagiarios = true;
    var previa = lerPrevia('ler_escala_militares', args, true);
    if (previa) return previa.then(function (grade) { if (!grade) throw new Error('falha'); return grade; });
    return RosterWork.apiFetch('/rest/v1/rpc/ler_escala_militares', {
      metodo: 'POST', corpo: args
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
    if (rascunho == null) return lerGuardado(chaveDia(unidadeId, iso), 'ler_distribuicao_dia', corpoDia(unidadeId, iso));
    var corpo = corpoDia(unidadeId, iso);
    corpo.p_rascunho = rascunho;
    return emDados(buscarTexto('ler_distribuicao_dia', corpo));
  }
  function corpoDia(unidadeId, iso) { return { p_unidade_id: Number(unidadeId), p_data: iso }; }

  /* a resposta como texto (null em falha), e o texto como dados (cada um com a sua cópia) */
  function buscarTexto(rpc, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; });
  }
  function emDados(texto) {
    return texto.then(function (t) { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } });
  }

  /* ---- as leituras guardadas (a caixa da célula abre na hora) ----
     O dia sem rascunho e as listas da caixa 2 da célula (quem pode entrar no dia, sem a vaga, e quem pode entrar na
     guarnição) ficam guardados por pouco tempo: o mouse parado na célula da grade começa a leitura do dia antes do clique
     (adiantarDia, escalas-celula-adiantar.js), a caixa 1 do pelotão a das listas (adiantarListas), e quem pede a mesma
     leitura depois (a caixa, o painel) usa a que está em curso ou a que já chegou, cada um com a sua cópia. Saem com 1
     minuto, em qualquer Salvar e quando a grade é lida de novo (a entrada, o mês, o Salvar, o Cancelar, o recálculo); a
     falha não fica. No treino, nada fica guardado */
  var GUARDA_MS = 60000;
  var guardados = {};          // 'leitura|unidade|dia...' -> { em (quando começou), texto (a Promise do texto) }
  var adiantando = false;      // a leitura do dia pelo mouse em curso: uma por vez
  var adiantarDepois = null;   // o último dia pedido enquanto ela corria: [unidade, dia]

  function guardavel() { return !(RosterWork.treino && RosterWork.treino.ligado()); }
  function chaveDia(unidadeId, iso) { return 'dia|' + Number(unidadeId) + '|' + iso; }
  function guardado(chave) {
    var g = guardados[chave];
    return g && performance.now() - g.em < GUARDA_MS ? g : null;
  }
  function esquecerGuardados() { guardados = {}; adiantarDepois = null; junta = null; }

  function textoGuardado(chave, rpc, corpo) {
    var g = guardado(chave);
    if (g) return g.texto;
    var item = { em: performance.now(), texto: null };
    item.texto = buscarTexto(rpc, corpo).then(function (t) {
      if (t == null && guardados[chave] === item) delete guardados[chave];
      return t;
    });
    guardados[chave] = item;
    return item.texto;
  }
  function lerGuardado(chave, rpc, corpo) { return emDados(guardavel() ? textoGuardado(chave, rpc, corpo) : buscarTexto(rpc, corpo)); }

  /* o dia começa a ser lido antes do clique: o aperto do mouse na hora; o mouse parado e o dedo (que pode só rolar a
     grade), um por vez, e o último pedido enquanto um corre vai depois dele */
  function adiantarDia(unidadeId, iso, agora) {
    var chave = chaveDia(unidadeId, iso);
    if (!guardavel() || guardado(chave)) return;
    if (agora) { textoGuardado(chave, 'ler_distribuicao_dia', corpoDia(unidadeId, iso)); return; }
    if (adiantando) { adiantarDepois = [unidadeId, iso]; return; }
    adiantando = true;
    textoGuardado(chave, 'ler_distribuicao_dia', corpoDia(unidadeId, iso)).then(function () {
      adiantando = false;
      var proximo = adiantarDepois;
      adiantarDepois = null;
      if (proximo) adiantarDia(proximo[0], proximo[1]);
    });
  }

  /* as listas da caixa 2 do pelotão, lidas quando a caixa 1 aparece (escalas-celula-editar-acoes.js): quais =
     { disponiveis (o Adicionar neste dia e o Adicionar estagiário), guarnicao (o Adicionar à guarnição) } */
  function adiantarListas(unidadeId, iso, quais) {
    if (!guardavel()) return;
    if (quais.disponiveis) disponiveis(unidadeId, iso, unidadeId, null, false);
    if (quais.guarnicao) continuosListar(unidadeId, iso);
  }
  window.addEventListener('rosterwork_escala_salva', esquecerGuardados);
  window.addEventListener('rosterwork_escala_recarregar', esquecerGuardados);

  /* ---- os dias certos depois do Salvar ----
     O Salvar que relê a grade inteira (o Dia que refaz os dias seguintes, a extra mexida na célula) deixa a cópia
     guardada do dia salvo velha até a tarefa de cada minuto refazê-la, e a grade relida mostraria o dia como era antes.
     Por isso, no Salvar, o dia salvo é lido com o dado real (sem a cópia), em todas as unidades dele na tela
     (escalas-painel-salvar.js), e a grade que aceita a cópia o põe no lugar do da cópia antes de desenhar (buscarMes).
     Ele vale até a cópia ficar pronta (esquecerCertos, escalas-atualizando.js) ou por 2 minutos; a leitura que falha
     deixa a cópia. No treino, nada: o treino já lê o dado real */
  var CERTO_MS = 120000;
  var certos = {};   // 'AAAA-MM-DD' -> { ids, em (quando começou), texto (a Promise do texto da leitura real) }

  function lerCerto(unidadesIds, iso) {
    if (!guardavel() || !unidadesIds || !unidadesIds.length) return;
    var ids = unidadesIds.map(Number);
    certos[iso] = { ids: ids, em: performance.now(), texto: buscarTexto('ler_escala_mes', { p_unidade_ids: ids, p_inicio: iso, p_fim: iso }) };
  }

  /* a cópia do dia ficou pronta: ele sai dos dias certos (chaves = ['unidade|dia']; a cópia é da companhia toda no dia) */
  function esquecerCertos(chaves) {
    (chaves || []).forEach(function (k) { delete certos[String(k).split('|')[1]]; });
  }

  /* os dias certos do período lido no lugar dos da cópia: grade = { unidade: { dia: {...} } }, como o banco entrega */
  function comCertos(grade, ids, inicio, fim) {
    var agora = performance.now();
    var dias = Object.keys(certos).filter(function (iso) {
      if (agora - certos[iso].em >= CERTO_MS) { delete certos[iso]; return false; }
      return iso >= inicio && iso <= fim;
    });
    if (!dias.length) return grade;
    return Promise.all(dias.map(function (iso) {
      var certo = certos[iso];
      return emDados(certo.texto).then(function (real) {
        if (!real) return;
        certo.ids.forEach(function (uid) {
          if (ids.indexOf(uid) < 0 || !real[uid] || !real[uid][iso]) return;
          if (!grade[uid]) grade[uid] = {};
          grade[uid][iso] = real[uid][iso];
        });
      });
    })).then(function () { return grade; });
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
     tudo, nada é gravado). leitura = ler_escala_mes, ler_escala_militares, escala_dia_arvore, escala_minha_calendario,
     escala_guarnicoes_listar (a aba Guarnições) ou
     ler_distribuicao_dia (o painel do dia, com erro_simulacao e erro_parte na recusa). Sem mudança, devolve null (a tela lê
     como sempre); a promessa resolve no mesmo que a leitura devolve, ou null em falha.
     Uma prévia por vez: cada uma segura a escala da companhia no banco até terminar, e duas juntas fariam fila lá dentro,
     gastando o tempo-limite de cada pedido. A próxima espera aqui; o pedido igual que ainda espera dá lugar ao mais novo e
     recebe a resposta dele. soAMaisNova: a grade da tela, em que só vale o último período pedido (quem pediu antes já
     desistiu, pelo latest-wins). Sem resposta em LIMITE_PREVIA_MS (um pouco mais que os 60 s que a escala_previa tem no
     banco), a fila anda */
  var LIMITE_PREVIA_MS = 65000;
  var previaNoAr = null;
  var previasEsperando = [];   // { chave, corpo, avisar: [o resolver de cada pedido] }

  function lerPrevia(leitura, args, soAMaisNova) {
    var corpo = corpoPrevia(leitura, args);
    if (!corpo) return null;
    var juntas = previaJunta(leitura, args, corpo);
    if (juntas) return juntas;
    return enfileirar(soAMaisNova ? leitura : leitura + '|' + JSON.stringify(args || {}), corpo);
  }

  /* o painel do dia (ou a célula) e o dia na grade com o mesmo rascunho: o ensaio roda uma vez só (escala_previa ›
     dia_e_grade), e a metade que ninguém pediu ainda fica guardada para quem pedir depois com o mesmo rascunho (a grade
     meio segundo depois do clique; a célula ao fechar a caixa). Se a leitura junta falha, cada uma é pedida sozinha.
     null: não é o caso (a grade não mostra o dia, ou lê mais de um dia) */
  var junta = null;   // { chave, dia, grade: as promessas das duas metades }
  function previaJunta(leitura, args, corpo) {
    var iso = corpo.p_data, ids, D = RosterWork.escalasDiaNaGrade;
    if (leitura === 'ler_distribuicao_dia') ids = D && D.unidadesDoDia ? D.unidadesDoDia(iso) : [];
    else if (leitura === 'ler_escala_mes' && args && args.p_inicio === iso && args.p_fim === iso) ids = (args.p_unidade_ids || []).map(Number);
    else return null;
    if (!ids.length) return null;
    ids = ids.slice().sort(function (a, b) { return a - b; });
    var chave = JSON.stringify([corpo.p_unidade_id, iso, corpo.p_dia, corpo.p_ciclo, corpo.p_extra || null, corpo.p_dias || null, ids]);
    if (!junta || junta.chave !== chave) {
      var pedido = enfileirar('dia_e_grade', Object.assign({}, corpo, { p_leitura: 'dia_e_grade', p_args: { p_unidade_ids: ids } }));
      junta = { chave: chave,
        dia: pedido.then(function (r) { return r && r.dia ? r.dia : null; }),
        grade: pedido.then(function (r) { return r && r.grade ? r.grade : null; }) };
    }
    var parte = leitura === 'ler_distribuicao_dia' ? junta.dia : junta.grade;
    return parte.then(function (r) { return r || enfileirar(leitura + '|' + JSON.stringify(args || {}), corpo); });
  }

  /* a fila das prévias: uma no banco por vez; o pedido igual que ainda espera dá lugar ao mais novo */
  function enfileirar(chave, corpo) {
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
    if (p.dias && p.dias.length) corpo.p_dias = p.dias;   // os outros dias com mudança (o rascunho de vários dias)
    return corpo;
  }
  /* o Salvar do rodapé do painel do dia (RPC escala_painel_salvar): o Dia (o rascunho, com o "antes"), o Ciclo (as
     mudanças) e a Extrajornada ({competencia, mudancas, motivo}) de uma vez, tudo ou nada; a parte sem mudança vai nula
     (a extra, só com mudança). Resolve no objeto da RPC ({success, logs, mudou, dia}, ou {success:false, error, parte,
     desatualizado}) ou num marcador de falha: { _falha: 'conexao' } (sem rede) | { _falha: 'servidor' } (HTTP não-ok). */
  function painelSalvar(unidadeId, iso, dia, ciclo, extra, sobreaviso) {
    var corpo = { p_unidade_id: Number(unidadeId), p_data: iso, p_dia: dia || null, p_ciclo: ciclo || null };
    if (extra) corpo.p_extra = extra;
    if (sobreaviso) corpo.p_sobreaviso = sobreaviso;
    return gravarNoBanco('escala_painel_salvar', corpo);
  }
  /* o Salvar de vários dias (RPC escala_painel_salvar_dias): dias = [{ unidade_id, data, dia, ciclo, sobreaviso, ler }] e a
     Extrajornada do mês, tudo ou nada. Resolve como o painelSalvar ({success, logs, dias: [{unidade_id, data, mudou,
     dia?}]}, ou {success:false, error, parte, unidade_id, data, desatualizado}, ou o marcador de falha) */
  function painelSalvarDias(dias, extra) {
    var corpo = { p_dias: dias };
    if (extra) corpo.p_extra = extra;
    return gravarNoBanco('escala_painel_salvar_dias', corpo);
  }
  /* a gravação: as leituras guardadas saem ao gravar e de novo com a resposta (o que quem chama lê depois já vem do banco) */
  function gravarNoBanco(rpc, corpo) {
    esquecerGuardados();
    salvares++;
    var gravacao = RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : { _falha: 'servidor' }; })
      .catch(function () { return { _falha: 'conexao' }; })
      .then(function (r) {
        esquecerGuardados();
        if (salvarNoAr === gravacao) salvarNoAr = null;
        return r;
      });
    salvarNoAr = gravacao;
    return gravacao;
  }

  /* a prévia pedida antes de um Salvar (ou durante ele) ficou velha: no banco ela corre junto com a gravação e pode bater
     no que ela grava. Quem pede guarda a marca (o número de Salvar começados; -1 com um Salvar no ar) e, com a resposta,
     pergunta se ela vale: null, vale; senão, a promessa que se cumpre quando o Salvar acaba (depois de a tela tratar a
     resposta dele), para pedir de novo se ainda espera */
  var salvares = 0, salvarNoAr = null;
  function marcaDoSalvar() { return salvarNoAr ? -1 : salvares; }
  function depoisDoSalvar(marca) {
    if (marca === salvares && !salvarNoAr) return null;
    return salvarNoAr ? salvarNoAr.then(function () {}) : Promise.resolve();
  }

  /* ---- Guarnições (o ciclo automático) ---- */
  /* quem está fora da escala, em outra guarnição ou de serviço no dia (o campo de militar do Adicionar militar) */
  function continuosListar(unidadeId, iso) {
    return lerGuardado('guarnicao|' + Number(unidadeId) + '|' + iso, 'escala_continuos_listar', corpoDia(unidadeId, iso));
  }
  /* a aba Guarnições (RPC escala_guarnicoes_listar): os períodos a partir do dia, cada um com as guarnições lado a lado e
     as marcas do que muda, e quem está fora da escala. Com mudança do painel esperando o Salvar, já com o rascunho (a
     prévia). null em falha */
  function guarnicoesListar(unidadeId, iso) {
    var previa = lerPrevia('escala_guarnicoes_listar', {});
    if (previa) return previa;
    return RosterWork.apiFetch('/rest/v1/rpc/escala_guarnicoes_listar', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
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
     pode/motivo de cada um. oficial: só os subtenentes e oficiais (o Oficial de Área do título). null em falha */
  function disponiveis(unidadeId, iso, unidadeBusca, vaga, oficial) {
    var corpo = { p_unidade_id: Number(unidadeId), p_data: iso, p_unidade_busca: Number(unidadeBusca) };
    if (vaga) corpo.p_vaga = vaga;
    if (oficial) corpo.p_oficial = true;
    /* sem a vaga, a lista fica guardada (as leituras guardadas, acima) */
    if (vaga) return emDados(buscarTexto('escala_dia_disponiveis', corpo));
    return lerGuardado('disponiveis|' + [Number(unidadeId), iso, Number(unidadeBusca), oficial ? 1 : 0].join('|'), 'escala_dia_disponiveis', corpo);
  }

  /* o calendário do Mudar o dia do serviço (RPC escala_mudar_dia_dias): para cada dia do período (até 63 dias), a
     situação do militar se o serviço pelo ciclo dele em "de" (ou, com mudancaId, o que veio de outro dia) fosse para lá,
     no mesmo horário, e quantos faltam para o mínimo na unidade. { hi, hf, limite, fim, dias: { 'AAAA-MM-DD': { estado,
     tipo, horas, antes, depois, faltas } } }, { erro } na recusa, ou null em falha */
  function mudarDiaDias(unidadeId, cpf, de, inicio, fim, mudancaId) {
    var corpo = { p_unidade_id: Number(unidadeId), p_cpf: String(cpf), p_de: de, p_inicio: inicio, p_fim: fim };
    if (mudancaId) corpo.p_mudanca = mudancaId;   // o Muda para outra data: o serviço que veio de outro dia
    return RosterWork.apiFetch('/rest/v1/rpc/escala_mudar_dia_dias', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* o calendário do Dia da folga (o Pôr um militar aqui da vaga; RPC escala_dia_da_folga_dias): quem cobre a vaga em
     "para" folga num dia de serviço dele; para cada dia do período (até 63 dias), o dia da vaga (para), os dias fora do
     prazo (fora) e os dias de serviço dele que podem virar a folga (servico, com hi, hf, fica e minimo), e quantos
     faltam para o mínimo na unidade. { limite, fim, dias: { 'AAAA-MM-DD': { estado, hi, hf, fica, minimo, faltas } } },
     { erro } na recusa, ou null em falha */
  function diaDaFolgaDias(unidadeId, cpf, para, inicio, fim) {
    var corpo = { p_unidade_id: Number(unidadeId), p_cpf: String(cpf), p_para: para, p_inicio: inicio, p_fim: fim };
    return RosterWork.apiFetch('/rest/v1/rpc/escala_dia_da_folga_dias', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* o porquê de cada linha da grade, para a dica do militar (RPC escala_motivos; escalas-celula-dica.js): por dia, a letra
     da guarnição de cada unidade e, por militar, as trocas (com quem, a Parte e o RW), o motivo da folga e de onde veio e
     para onde foi o remanejado. { 'AAAA-MM-DD': { guarnicao, militares } }, ou null em falha */
  function motivos(unidadesIds, inicio, fim) {
    var corpo = { p_unidade_ids: (unidadesIds || []).map(Number), p_inicio: inicio, p_fim: fim };
    return RosterWork.apiFetch('/rest/v1/rpc/escala_motivos', { metodo: 'POST', corpo: corpo })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* quem pode ficar de sobreaviso no dia (RPC sobreaviso_candidatos), na ordem da fila: { metade, grupos: [{ grupo,
     militares }] }; cpf = quem sai (o Pôr outro no lugar dele; sem ele, o Adicionar). null em falha */
  function sobreavisoCandidatos(unidadeId, iso, cpf) {
    return RosterWork.apiFetch('/rest/v1/rpc/sobreaviso_candidatos', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso, p_cpf: cpf || null } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* a aba Militares da página Sobreaviso (RPC sobreaviso_militares): { unidade: { companhia_id, por_pelotao, militares } };
     a falha rejeita (a grade mostra o erro, como a do Militares) */
  function sobreavisoMilitares(unidadesIds, inicio, fim) {
    return RosterWork.apiFetch('/rest/v1/rpc/sobreaviso_militares', { metodo: 'POST',
      corpo: { p_unidade_ids: (unidadesIds || []).map(Number), p_inicio: inicio, p_fim: fim } })
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
      .then(function (grade) { return grade || {}; });
  }

  /* a leitura da grade (ou do dia) que falhou, mesmo depois de o sistema tentar de novo sozinho: o aviso com o Tentar de
     novo no meio do lugar (geral-falha.js). titulo: o da tela (sem ele, "Não foi possível carregar a escala."); tentar:
     o que lê de novo (sem ele, a Escala inteira lê de novo). Com mudança esperando o Salvar, o aviso diz que ela continua */
  function mostrarFalha(lugar, titulo, tentar) {
    lugar.textContent = '';
    var estado = RosterWork.tpl('tpl-escala-estado'), S = RosterWork.escalasPainelSalvar;
    var aviso = RosterWork.falha.bloco(titulo || RosterWork.mensagens.escala.falhaCarregarMes, tentar || recarregarEscala,
      { rascunho: !!(S && S.paraPrevia()) });
    if (!estado || !aviso) return;
    estado.appendChild(aviso);
    lugar.appendChild(estado);
  }
  function recarregarEscala() { window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar')); }

  window.RosterWork.escalasDados = {
    mostrarFalha: mostrarFalha,
    sobreavisoCandidatos: sobreavisoCandidatos, sobreavisoMilitares: sobreavisoMilitares,
    carregar: carregar, antecipar: antecipar, reorganizar: reorganizar, carregarMilitares: carregarMilitares, lerMilitarDia: lerMilitarDia,
    motivos: motivos,
    lerDiasAtualizando: lerDiasAtualizando, lerDistribuicaoDia: lerDistribuicaoDia, adiantarDia: adiantarDia, adiantarListas: adiantarListas, lerAlteracoesDia: lerAlteracoesDia, lerPrevia: lerPrevia, corpoPrevia: corpoPrevia, painelSalvar: painelSalvar, painelSalvarDias: painelSalvarDias,
    marcaDoSalvar: marcaDoSalvar, depoisDoSalvar: depoisDoSalvar, lerCerto: lerCerto, esquecerCertos: esquecerCertos,
    lerImpressao: lerImpressao, lerImpressaoErros: lerImpressaoErros, lerSysbm: lerSysbm,
    sysbmTermo: sysbmTermo, sysbmDarCiencia: sysbmDarCiencia,
    continuosListar: continuosListar, guarnicoesListar: guarnicoesListar, cicloRetirarAnalisar: cicloRetirarAnalisar,
    disponiveis: disponiveis, mudarDiaDias: mudarDiaDias, diaDaFolgaDias: diaDaFolgaDias
  };
})();
