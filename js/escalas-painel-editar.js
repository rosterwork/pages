/* ============================================================
   ESCALAS — o Dia do painel (abas Funções e Militares): a lista do
   dia, a mesma para todos, só de leitura; na aba Funções, por posto e
   função; na Militares, por pessoa (escalas-painel-militares.js, com
   as peças daqui, .sub.lista). As duas usam o mesmo dia lido, o mesmo
   rascunho e o mesmo desfazer: trocar de uma para a outra só refaz a
   lista (opcoes.visao). O admin edita a partir dela: o menu Editar o
   dia (só o que é do dia todo: Adicionar militar, Trazer de outra
   unidade, Registrar troca de serviço e Voltar o dia ao automático, à
   esquerda) e o desfazer/refazer (à direita) ficam no subcabeçalho;
   cada linha que ele edita tem o lápis, que abre o menu da linha
   (escalas-painel-linha-menu.js: na Funções, o que é do lugar; na
   Militares, o dia da pessoa), e a linha inteira também abre; quem o
   admin fixou ganha o selo Fixado; as observações também se editam
   aqui.
   Quem não é admin só lê (os postos mudam na Distribuição). Na
   Escala, o subcabeçalho tem para todos o Imprimir, à direita (antes
   do desfazer/refazer), que abre a sub-tela de impressão
   (escalas-impressao.js), e o Solicitar troca, à esquerda (à direita
   do menu Editar o dia, para o admin). O Solicitar troca e o
   Registrar troca de serviço abrem ali o formulário da troca
   (escalas-painel-troca.js); o Registrar grava na hora, fora do
   rascunho: só sem mudança não salva.
   Cada mudança vai para o rascunho do dia, e a lista mostra o dia
   como vai ficar (a prévia, escala_previa, já com o Ciclo que
   espera o Salvar), com a nota O que
   mudou no topo; o desfazer/refazer anda no rascunho. Nada grava até
   o Salvar do rodapé do painel (escalas-painel-salvar.js), que grava
   junto com o Ciclo. O rascunho fica ao trocar de
   aba e de dia: o do dia de antes fica guardado na gaveta
   (escalas-rascunho-dias.js) e volta quando ele é aberto de novo, e
   o Salvar grava todos os dias (fechar o painel pergunta antes). Rascunho:
   { ajustes, pontuais, estornar, folgas, folgas_cancelar,
   observacoes, abertas (as funções abertas sem ninguém, só na
   prévia: salvas vazias, somem), remanejar, devolver, mudar_dia
   ([{ cpf, de, para, periodos, onde }]: o serviço pelo ciclo passa
   daqui para outro dia ou, com "de", de outro dia para este (a Folga
   em outro dia do Quem cobre da vaga); a prévia e o Salvar mudam os
   dois dias),
   desfazer_mudanca ([{ id, dia }]: volta ao dia de antes; dia = o
   outro dia da mudança), tirar_mudanca ([{ id, contabilizar, dia }]:
   sai do dia novo e o de antes vira folga), automatico (o
   sistema decide o dia de novo, sem devolver cada um ao lugar de
   antes: o Voltar ao automático e o Adicionar com O sistema
   distribui) }.
   O menu da linha e o cartão embaixo dela, o Adicionar militar, o
   Remover do dia, o Mudar de unidade neste dia, o Mudar o horário do
   serviço e o Mudar o dia do serviço (sub-telas) e a folga no dia
   (sub-tela) ficam em
   escalas-painel-linha-menu.js, -linha.js, -adicionar.js,
   -remover.js, -remanejar.js, -horario-dia.js, -mudar-dia.js e
   -militar.js e usam a API daqui (.sub). Não têm
   botão próprio: enquanto se responde, a mudança entra no rascunho
   ao vivo (.sub.aoVivo, sobre a foto de quando a sub-tela ou o
   cartão abriu) e as telas mostram como fica; o Voltar ao dia e o X
   do cartão guardam o que foi respondido como um passo do desfazer,
   e o Salvar do rodapé grava tudo.
   A célula da grade (escalas-celula-editar.js) usa o mesmo rascunho
   com o painel fechado: montar sem o corpo, com opcoes.semLista; o
   dia é lido e a prévia refeita como no painel, sem a lista, só
   quando uma mudança pendente toca o dia (precisaPrevia); no dia
   que ela não toca, a caixa fica com o dia gravado, o mesmo da grade.
   O dia que vai mostrar a prévia já a pede junto com a leitura dele
   (pedirPrevia). opcoes.aoMostrar(dados) recebe cada leitura (null: falhou). O
   painel que abre no mesmo dia continua o rascunho. Com o painel
   aberto no dia, a caixa da célula trabalha no rascunho dele: ela
   pede as leituras com sub.ouvir(fn), e o que muda numa aparece na
   outra.
   O "Como fica a escala" do painel de decisão (Trocas e Folgas) também,
   no modo comparação (opção comparar): só leitura, com quem saiu
   riscado na função de onde saiu, quem entra pelo pedido com o "Novo"
   e quem o sistema remanejou só com a barra cinza (as marcas vêm do
   banco, pedido_escala_comparar).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;       // { corpo, rodape, unidadeId, iso, admin, comparar, dados, dadosAntes, chaveDados, emSub, comHistorico,
                        //   historico (o bloco das Alterações manuais, no fim do corpo), salvando,
                        //   sugestao, ultima: { mudou, sugestao } (a nota O que mudou da última gravação),
                        //   lugarNovo (o lugar que o Adicionar mais um militar neste posto abriu: o cartão dele abre quando a
                        //   lista volta), semLista (o dia da célula, com o painel fechado), aoMostrar (a célula recebe cada
                        //   leitura) }
  var base = null;      // o dia gravado (a última leitura): { dados, ajustes, pontuais }
  var rasc = null;      // a mudança em andamento, sobre o dia gravado
  var vivo = null;      // a sub-tela ou o lápis aberto: { foto (o rascunho do Dia quando abriu), ciclo (o do Ciclo),
                        //   mudou (o Dia mudou ao vivo), travado (pergunta pela metade ou conflito: o Salvar desliga) }
  var pilhaDesfazer = [];  // os rascunhos de antes de cada mudança ainda não salva (o Desfazer volta um passo)
  var pilhaRefazer = [];   // os rascunhos desfeitos
  var dono = '';        // o dia do rascunho (unidade|dia): voltar de outra aba ao mesmo dia o encontra
  var pedido = 0;       // só a última leitura, prévia ou gravação pedida desenha
  var listaApagada = null;   // a lista esperando a prévia: { corpo, caixa, frase (as etapas da linha) }

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa (o mais antigo do dia) */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }
  function pecas() { return (RosterWork.escalasPainel && RosterWork.escalasPainel.pecas) || {}; }
  function copiar(o) { return JSON.parse(JSON.stringify(o)); }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  /* a gaveta dos dias (escalas-rascunho-dias.js; só na Escala) */
  function G() { return RosterWork.escalasRascunhoDias || null; }
  /* a unidade e o dia do rascunho (dono = unidade|dia) */
  function donoUnidade() { return dono ? dono.split('|')[0] : ''; }
  function donoIso() { return dono ? dono.split('|')[1] : ''; }

  /* ---------- o rascunho de outro dia (guardado na gaveta) ---------- */

  function exportar() { return { base: base, rasc: rasc, pilhaDesfazer: pilhaDesfazer, pilhaRefazer: pilhaRefazer, dono: dono }; }
  function importar(est) {
    base = est.base; rasc = est.rasc; pilhaDesfazer = est.pilhaDesfazer; pilhaRefazer = est.pilhaRefazer; dono = est.dono;
  }
  /* o rascunho de agora, com mudança ou passo, vai para a gaveta (antes de outro dia entrar) */
  function guardarAgora() {
    if (!G() || !base || !rasc || !dono || !(haMudanca() || pilhaDesfazer.length || pilhaRefazer.length)) return;
    fecharLinha('guardar');
    terminarVivo();
    G().guardar('dia', { chave: dono, unidadeId: donoUnidade(), iso: donoIso(), estado: exportar() });
  }
  /* o dia guardado volta (com a guarnição no subtítulo do painel) */
  function trazerGuardado(chave) {
    var item = G() && G().tirar('dia', chave);
    if (!item) return;
    importar(item.estado);
    if (ctx && RosterWork.escalasPainel.mostrarGuarnicao) {
      RosterWork.escalasPainel.mostrarGuarnicao(ctx.unidadeId, ctx.iso, (base.dados || {}).guarnicao || null);
    }
  }
  /* fn roda com o rascunho de um dia guardado no lugar do de agora (as contas do Salvar e da prévia), sem desenhar nada */
  function comEstado(est, fn) {
    var agora = exportar(), vivoAgora = vivo;
    importar(est);
    vivo = null;
    try { return fn(); } finally { importar(agora); vivo = vivoAgora; }
  }

  /* ---------- horas no dia de serviço (minutos desde as 08h): contas do componente geral-horario ---------- */

  var horario = RosterWork.horario;
  var emMin = horario.emMin, faixa = horario.faixa, hhmm = horario.hhmm, periodo = horario.periodo, curta = horario.curta,
    cruza = horario.cruza, menos = horario.menos, uniao = horario.uniao, regua = horario.regua, opcoesHoras = horario.opcoesHoras;

  /* 1440 -> "24 horas"; 90 -> "1h30" (texto dos modais do banco de horas e do total do formulário) */
  function horasTexto(min) {
    return (min % 60 === 0) ? RosterWork.mensagens.folgas.horasExtenso(min / 60) : RosterWork.tempo.horas(min);
  }
  /* "das 20h às 21h e das 00h às 08h" (vazio quando é o dia todo) */
  function textoPeriodos(periodos) {
    if (periodos.length === 1 && periodos[0].hi === periodos[0].hf) return '';
    return periodos.map(function (p) { return msg().dasAs(curta(p.hi), curta(p.hf)); }).join(' e ');
  }

  /* ---------- rascunho ---------- */

  function vidPosto(posto) { return posto.tipo === 'viatura' ? posto.id : null; }
  function iidPosto(posto) { return posto.tipo === 'instalacao' ? posto.id : null; }
  function noLocal(a, posto, nomeFuncao) {
    return a.nome_funcao === nomeFuncao
      && (a.viatura_id || null) === vidPosto(posto)
      && (a.instalacao_id || null) === iidPosto(posto);
  }
  /* "da AA-01", "do Rancho": viatura é feminino; instalação pelo nome */
  function postoFeminino(posto) {
    if (!posto) return false;
    if (posto.tipo === 'viatura') return true;
    return /^(central|sala|base|casa|sede|guarita)/i.test(posto.nome || '') || /a$/i.test(posto.nome || '');
  }
  /* "Efetivo da ABTR-14462": a função com o nome da tela (sem o número do lugar; o estagiário, "Estagiário") */
  function funcaoNoPosto(funcao, posto) {
    return msg().funcaoNoPosto(pecas().rotuloDaFuncao(posto, funcao), posto.nome, postoFeminino(posto));
  }

  /* chave de um ajuste (compara rascunho × salvo) */
  function chave(a) {
    return [a.acao, a.cpf, a.nome_funcao, a.viatura_id || '', a.instalacao_id || '', a.substitui || '',
      a.hi || '', a.hf || '', a.acumula === false ? 'deixa' : 'acumula'].join('|');
  }
  function contagem(lista) {
    var c = {};
    lista.forEach(function (a) { var k = chave(a); c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function mesmosAjustes(a, b) {
    var ca = contagem(a), cb = contagem(b), ka = Object.keys(ca);
    return ka.length === Object.keys(cb).length && ka.every(function (k) { return ca[k] === cb[k]; });
  }

  function mapaPontuais(lista) {
    var m = {};
    (lista || []).forEach(function (x) { m[x.cpf] = JSON.stringify(x.periodos || []); });
    return m;
  }
  function difPontuais() {
    var a = mapaPontuais(base.pontuais), b = mapaPontuais(rasc.pontuais), n = 0;
    Object.keys(b).forEach(function (k) { if (a[k] !== b[k]) n++; });
    Object.keys(a).forEach(function (k) { if (!(k in b)) n++; });
    return n;
  }

  /* o Onde fica dos estagiários: os que mudaram, {cpf: as linhas marcadas | null (o sistema distribui)} */
  function ondeMudou() {
    var a = base.estagio_onde || {}, b = rasc.estagio_onde || {}, r = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
      if (JSON.stringify(a[k] || null) !== JSON.stringify(b[k] || null)) r[k] = b[k] || null;
    });
    return r;
  }
  function difOnde() { return Object.keys(ondeMudou()).length; }

  /* a mudança de dia no rascunho (mudar, desfazer ou tirar)? */
  function comMudancaDeDia() {
    return rasc.mudar_dia.length > 0 || rasc.desfazer_mudanca.length > 0 || rasc.tirar_mudanca.length > 0;
  }

  /* o rascunho mudou o dia gravado? (funções, pontuais, folgas dadas ou canceladas, observações, remanejados ou
     devolvidos, a mudança de dia, ou o Voltar ao automático) */
  function haMudanca() {
    if (!rasc || !base) return false;
    return !!rasc.automatico || !mesmosAjustes(base.ajustes, rasc.ajustes) || difPontuais() > 0 || difOnde() > 0 || rasc.folgas.length > 0
      || rasc.folgas_cancelar.length > 0 || rasc.observacoes.adicionar.length > 0 || rasc.observacoes.remover.length > 0
      || rasc.abertas.length > 0 || rasc.remanejar.length > 0 || rasc.devolver.length > 0 || comMudancaDeDia();
  }

  /* o rascunho recomeça do dia gravado */
  function novoRascunho() {
    rasc = { ajustes: copiar(base.ajustes), pontuais: copiar(base.pontuais), estagio_onde: copiar(base.estagio_onde || {}),
      estornar: [], folgas: [], folgas_cancelar: [],
      observacoes: { adicionar: [], remover: [] }, abertas: [], remanejar: [], devolver: [],
      mudar_dia: [], desfazer_mudanca: [], tirar_mudanca: [] };
  }

  /* o dia gravado (a leitura, ou o que o banco devolve ao gravar) vira a base */
  function aceitar(dados) {
    base = {
      dados: dados,
      ajustes: dados.ajustes_salvos || [],
      pontuais: (dados.pontuais || []).map(function (x) { return { cpf: x.cpf, periodos: x.periodos || [] }; }),
      /* o Onde fica dos estagiários (os postos do estágio marcados para cada um; sem ele, o sistema distribui) */
      estagio_onde: dados.estagio_onde || {}
    };
    novoRascunho();
    if (!ctx) return;
    dono = ctx.unidadeId + '|' + ctx.iso;
    ctx.dados = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
    /* a guarnição de serviço no dia vai ao subtítulo do painel */
    if (RosterWork.escalasPainel.mostrarGuarnicao) RosterWork.escalasPainel.mostrarGuarnicao(ctx.unidadeId, ctx.iso, dados.guarnicao || null);
  }

  /* o que vai à prévia (o dia como vai ficar; as observações e o motivo do remanejamento não mudam a escala: escrever
     não refaz a prévia) */
  function paraPrevia() {
    var r = { ajustes: rasc.ajustes, folgas: rasc.folgas };
    if (difPontuais() > 0) r.pontuais = rasc.pontuais;
    if (difOnde() > 0) r.estagio_onde = ondeMudou();
    if (rasc.folgas_cancelar.length) r.folgas_cancelar = rasc.folgas_cancelar;
    if (rasc.abertas.length) r.abertas = rasc.abertas;
    if (rasc.remanejar.length) {
      r.remanejar = rasc.remanejar.map(function (x) { return { cpf: x.cpf, origem: x.origem, destino: x.destino, fica: x.fica }; });
    }
    if (rasc.devolver.length) r.devolver = rasc.devolver;
    /* a mudança de dia, no formato do banco (o outro dia de cada uma fica só aqui, para as telas) */
    if (rasc.mudar_dia.length) r.mudar_dia = copiar(rasc.mudar_dia);
    if (rasc.desfazer_mudanca.length) r.desfazer_mudanca = rasc.desfazer_mudanca.map(function (x) { return x.id; });
    if (rasc.tirar_mudanca.length) {
      r.tirar_mudanca = rasc.tirar_mudanca.map(function (x) { return { id: x.id, contabilizar: !!x.contabilizar }; });
    }
    if (rasc.automatico) r.automatico = true;
    return r;
  }
  /* o que vai ao banco no Salvar (com o automatico, o sistema distribui o dia de novo; o remanejar, com o motivo); as
     funções abertas não vão: a que ficou vazia some */
  function paraSalvar() {
    var r = paraPrevia();
    delete r.abertas;
    if (rasc.remanejar.length) r.remanejar = copiar(rasc.remanejar);
    r.estornar = rasc.estornar;
    r.folgas_cancelar = rasc.folgas_cancelar;
    r.observacoes = rasc.observacoes;
    if (rasc.automatico) r.automatico = true;
    return r;
  }

  /* ---------- leitura da prévia ---------- */

  /* dados = a leitura do dia de outra unidade (o Remanejar); sem ela, a do painel */
  function acharPosto(vi, ii, dados) {
    var lista = ((dados || (ctx && ctx.dados)) || {}).postos || [];
    for (var i = 0; i < lista.length; i++) {
      var po = lista[i];
      if ((po.tipo === 'viatura' && po.id === vi) || (po.tipo === 'instalacao' && po.id === ii)) return po;
    }
    return null;
  }
  function acharFuncao(posto, nomeFuncao, dados) {
    var po = posto && acharPosto(vidPosto(posto), iidPosto(posto), dados);
    var fs = (po && po.funcoes) || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].nome === nomeFuncao) return fs[i];
    return null;
  }

  /* as funções do militar no dia (prévia atual): [{ posto, funcao, periodos, fixado, bloqueado, m }] */
  function funcoesDoMilitar(cpf, dados) {
    var lista = [];
    (((dados || (ctx && ctx.dados)) || {}).postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          if (m.cpf === cpf) lista.push({ posto: po, funcao: f.nome, periodos: m.periodos || [], fixado: !!m.fixado, bloqueado: !!m.bloqueado, m: m });
        });
      });
    });
    return lista;
  }

  /* o militar de serviço no dia: { cpf, grad, nome, janelas, unidade, daUnidade, origem, pontual, outraUnidade, remanejado }
     (null se não está de serviço). janelas = os horários de serviço dele nesta unidade, cada um com a origem;
     outraUnidade = também serve em outra unidade no dia; remanejado = { de, para, de_nome, para_nome, fica, automatico }
     (null sem remanejamento) */
  function militarDoDia(cpf) {
    var d = (ctx && ctx.dados) || {};
    var mil = null;
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (m) {
        if (m.cpf === cpf) mil = { cpf: cpf, grad: m.grad || '', nome: m.nome || '', janelas: m.disp || [], unidade: u.unidade_nome, daUnidade: !!u.editando, deFolga: false,
          outraUnidade: !!m.outra_unidade, remanejado: m.remanejado || null };
      });
    });
    if (!mil) return null;
    var fs = funcoesDoMilitar(cpf);
    var sf = (d.sem_funcao || []).filter(function (m) { return m.cpf === cpf; })[0];
    mil.origem = (fs[0] && fs[0].m.origem) || (sf && sf.origem) || 'sistema';
    mil.pontual = (rasc.pontuais || []).some(function (x) { return x.cpf === cpf; });
    return mil;
  }

  /* quem ocupa o Chefe de Socorro / Oficial de Área no dia: { "posto|função": { posto, funcao, por: { cpf: { nome, periodos } } } } */
  function papeis(dados) {
    var r = {};
    ((dados && dados.postos) || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        if (!BLOQUEADAS.test(f.nome)) return;
        var k = po.id + '|' + f.nome;
        r[k] = r[k] || { posto: po, funcao: f.nome, por: {} };
        /* o mesmo militar em mais de uma linha (outro no meio): os horários de todas */
        (f.militares || []).forEach(function (m) {
          var ja = r[k].por[m.cpf];
          r[k].por[m.cpf] = { nome: nomeDe(m), periodos: (ja ? ja.periodos : []).concat(m.periodos || []) };
        });
      });
    });
    return r;
  }

  /* ---------- operações (chamadas pela lista e pelas sub-telas) ---------- */

  function colocacao(c, f, substitui) {
    var pr = periodo(f);
    return { acao: 'colocar', cpf: c.cpf, nome_funcao: c.funcao, viatura_id: vidPosto(c.posto), instalacao_id: iidPosto(c.posto),
      substitui: substitui || null, hi: pr.hi, hf: pr.hf, acumula: true };
  }

  /* corta o trecho x das colocações manuais do militar que passam o filtro */
  function aparar(cpf, filtro, x) {
    var novos = [];
    rasc.ajustes.forEach(function (a) {
      if (a.acao !== 'colocar' || a.cpf !== cpf || !filtro(a) || !cruza(faixa(a), x)) { novos.push(a); return; }
      menos([faixa(a)], [x]).forEach(function (f) {
        var b = copiar(a), pr = periodo(f);
        b.hi = pr.hi; b.hf = pr.hf;
        novos.push(b);
      });
    });
    rasc.ajustes = novos;
  }

  /* põe o militar numa função nos horários escolhidos (formulário). Quem estava lá fica sem função naquele
     trecho: o automático é substituído só naquela parte; a colocação manual é cortada.
     c = { cpf, posto, funcao, periodos, sistema, refazer (o sistema refaz o dia do zero; o fixado fica),
     pontual: { contabilizar, manter (o pontual gravado e contabilizado que muda as horas: o banco de horas fica como
     estava) } | null, dados (a leitura do dia da unidade do posto, quando não é a do painel) } */
  function aplicarColocacao(c) {
    if (c.pontual) {
      var entra = { cpf: c.cpf, periodos: c.periodos, contabilizar: !!c.pontual.contabilizar };
      if (c.pontual.manter) entra.manter_banco = true;
      rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== c.cpf; }).concat([entra]);
      rasc.estornar = rasc.estornar.filter(function (x) { return x !== c.cpf; });
    }
    if (c.refazer) rasc.automatico = true;
    if (c.sistema) return;
    var janelas = c.periodos.map(faixa);
    var alvo = acharFuncao(c.posto, c.funcao, c.dados);
    janelas.forEach(function (w) {
      var resto = [w];
      ((alvo && alvo.militares) || []).forEach(function (m) {
        if (m.cpf === c.cpf) return;
        (m.periodos || []).forEach(function (per) {
          var x = cruza(w, faixa(per));
          if (!x) return;
          if (m.fixado) {
            aparar(m.cpf, function (a) { return noLocal(a, c.posto, c.funcao); }, x);
            rasc.ajustes.push(colocacao(c, x, m.substitui && m.substitui !== m.cpf ? m.substitui : null));
          } else {
            rasc.ajustes.push(colocacao(c, x, m.cpf));
          }
          resto = menos(resto, [x]);
        });
      });
      resto.forEach(function (x) { rasc.ajustes.push(colocacao(c, x, null)); });
    });
  }

  /* tira o militar de uma função num trecho (o seletor, na vaga vazia: quem entra deixa o que tinha): o trecho
     manual é cortado; o automático ganha o "tirar" */
  function deixarFuncao(cpf, posto, nomeFuncao, per) {
    var x = faixa(per);
    var alvo = acharFuncao(posto, nomeFuncao);
    var m = ((alvo && alvo.militares) || []).filter(function (o) { return o.cpf === cpf; })[0];
    if (m && m.fixado) { aparar(cpf, function (a) { return noLocal(a, posto, nomeFuncao); }, x); return; }
    var pr = periodo(x);
    rasc.ajustes.push({ acao: 'tirar', cpf: cpf, nome_funcao: nomeFuncao, viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto), hi: pr.hi, hf: pr.hf });
  }

  /* grava no rascunho o que mudou no militar no dia. abertura e linhas =
     [{ posto, funcao, hi, hf, manual, subst, acumula, intacta }]; só mexe nas funções que mudaram */
  function aplicarMilitar(cpf, abertura, linhas) {
    function chaveDe(l) { return l.posto.tipo + ':' + l.posto.id + '|' + l.funcao; }
    function cobertura(ls) { return JSON.stringify(uniao(ls.map(function (l) { return faixa(l); }))); }
    function manuais(ls) { return ls.filter(function (l) { return l.manual; }).map(function (l) { return l.hi + '-' + l.hf + '-' + (l.subst || ''); }).sort().join(','); }
    var refs = {};
    abertura.concat(linhas).forEach(function (l) { refs[chaveDe(l)] = l; });
    Object.keys(refs).forEach(function (k) {
      var ref = refs[k];
      var antes = abertura.filter(function (l) { return chaveDe(l) === k; });
      var depois = linhas.filter(function (l) { return chaveDe(l) === k; });
      /* a mesma cobertura com as mesmas colocações manuais (ex.: só dividiu, sem mudar as horas): nada muda */
      if (cobertura(antes) === cobertura(depois) && manuais(antes) === manuais(depois)) return;
      rasc.ajustes = rasc.ajustes.filter(function (a) {
        return !(a.acao === 'colocar' && a.cpf === cpf && noLocal(a, ref.posto, ref.funcao));
      });
      var mexidas = depois.filter(function (l) { return !l.intacta; });
      depois.forEach(function (l) {
        /* o automático intacto fica como está, a não ser que um trecho mexido passe por cima dele */
        var tocada = mexidas.some(function (x) { return x !== l && cruza(faixa(x), faixa(l)); });
        if (!l.manual && l.intacta && !tocada) return;
        rasc.ajustes.push({ acao: 'colocar', cpf: cpf, nome_funcao: ref.funcao, viatura_id: vidPosto(ref.posto), instalacao_id: iidPosto(ref.posto),
          substitui: l.subst || null, hi: l.hi, hf: l.hf, acumula: l.acumula !== false });
      });
      var cobertas = depois.map(function (l) { return faixa(l); });
      antes.filter(function (l) { return !l.manual; }).forEach(function (l) {
        menos([faixa(l)], cobertas).forEach(function (f) {
          var pr = periodo(f);
          rasc.ajustes.push({ acao: 'tirar', cpf: cpf, nome_funcao: ref.funcao, viatura_id: vidPosto(ref.posto), instalacao_id: iidPosto(ref.posto), hi: pr.hi, hf: pr.hf });
        });
      });
    });
  }

  /* tira das colocações e dos cortes manuais do militar os trechos dados (o resto de cada um continua) */
  function cortarAjustes(cpf, trechos) {
    var novos = [];
    rasc.ajustes.forEach(function (a) {
      if (a.cpf !== cpf) { novos.push(a); return; }
      menos([faixa(a)], trechos).forEach(function (f) {
        var b = copiar(a), pr = periodo(f);
        b.hi = pr.hi; b.hf = pr.hf;
        novos.push(b);
      });
    });
    rasc.ajustes = novos;
  }

  /* Remover do dia (militar do ciclo): folga do dia inteiro e as colocações dele saem. Com periodos (quem também
     serve em outra unidade no dia), a folga e o corte valem só nesses horários: o serviço de lá não muda. motivo: o
     Motivo da folga (opcional; vazio não vai) */
  function darFolga(cpf, contabilizar, periodos, motivo) {
    var texto = String(motivo || '').trim();
    var folga = function (hi, hf) {
      var f = { cpf: cpf, hi: hi, hf: hf, contabilizar: !!contabilizar };
      if (texto) f.motivo = texto;
      return f;
    };
    rasc.folgas = rasc.folgas.filter(function (f) { return f.cpf !== cpf; });
    if (periodos && periodos.length) {
      periodos.forEach(function (p) { rasc.folgas.push(folga(p.hi, p.hf)); });
      cortarAjustes(cpf, periodos.map(faixa));
      return;
    }
    rasc.folgas.push(folga(null, null));
    rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
  }

  /* Remover do dia (pontual): sai do dia; estornar = as horas que ele somou saem do banco de horas.
     Quem tem outro serviço aqui no dia (ex.: a extra) perde só os ajustes manuais das horas do pontual */
  function tirarPontual(cpf, estornar) {
    var mil = militarDoDia(cpf);
    var pont = rasc.pontuais.filter(function (x) { return x.cpf === cpf; })[0];
    var horas = ((pont && pont.periodos) || []).map(faixa);
    var outras = mil ? menos(mil.janelas.map(faixa), horas) : [];
    rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== cpf; });
    if (outras.length) cortarAjustes(cpf, horas);
    else rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
    if (estornar && rasc.estornar.indexOf(cpf) < 0) rasc.estornar.push(cpf);
  }

  /* Cancelar folga (a folga no dia): a folga sai e o militar volta ao serviço; o desfazer a dá de novo igual */
  function cancelarFolga(id) {
    if (rasc.folgas_cancelar.indexOf(id) < 0) rasc.folgas_cancelar.push(id);
  }

  /* os ajustes manuais do militar nos postos desta unidade (aqui = true) ou nos das outras (aqui = false) saem */
  function cortarAjustesDaUnidade(cpf, aqui) {
    rasc.ajustes = rasc.ajustes.filter(function (a) {
      return a.cpf !== cpf || !!acharPosto(a.viatura_id || null, a.instalacao_id || null) !== aqui;
    });
  }

  /* Devolver (o Remover do remanejado): ele volta só para a unidade de origem (vai no devolver). As colocações manuais
     dele na unidade de destino saem (no painel do destino, as daqui; no da origem, as das outras) */
  function devolverRemanejado(cpf) {
    var mil = militarDoDia(cpf);
    if (rasc.devolver.indexOf(cpf) < 0) rasc.devolver.push(cpf);
    var daqui = !!(mil && mil.remanejado && String(mil.remanejado.de) === String(ctx.unidadeId));
    cortarAjustesDaUnidade(cpf, !daqui);
  }

  /* Tirar do dia o remanejado: a folga desfaz o remanejamento gravado (no banco), então o rascunho só larga o devolver
     dele */
  function largarRemanejado(cpf) {
    rasc.devolver = rasc.devolver.filter(function (x) { return x !== cpf; });
  }

  /* Mudar de unidade neste dia (o remanejamento): lista = [{ cpf, origem, destino, fica, motivo }] (o banco refaz as duas unidades no dia) */
  function remanejar(lista) {
    var cpfs = lista.map(function (x) { return x.cpf; });
    rasc.remanejar = rasc.remanejar.filter(function (x) { return cpfs.indexOf(x.cpf) < 0; }).concat(copiar(lista));
  }

  /* Mudar o dia do serviço: x = { cpf, de (o dia de antes, quando não é este: a Folga em outro dia do Quem cobre da vaga
     traz para cá o serviço do dia escolhido), para (o dia novo, AAAA-MM-DD), periodos ([{ hi, hf }], as horas que mudam;
     vazio, o serviço inteiro), onde (o Onde fica do dia novo, no formato do banco) }. O serviço que sai daqui leva junto as colocações
     manuais dele nessas horas; o banco põe a marca no dia de antes e o serviço no dia novo */
  function mudarDia(x) {
    if (!x.de || x.de === ctx.iso) cortarAjustes(x.cpf, x.periodos.map(faixa));
    rasc.mudar_dia = rasc.mudar_dia.filter(function (m) { return m.cpf !== x.cpf; }).concat([copiar(x)]);
  }
  /* a mudança de dia dele ainda no rascunho (a prévia a mostra, mas ela só ganha número no banco ao salvar): 'sai' (o
     serviço daqui vai para outro dia), 'vem' (o de outro dia vem para este) ou null */
  function mudancaNoRascunho(cpf) {
    var x = rasc && rasc.mudar_dia.filter(function (m) { return m.cpf === cpf; })[0];
    if (!x) return null;
    return x.de && x.de !== ctx.iso ? 'vem' : 'sai';
  }
  /* larga a mudança de dia dele que ainda está no rascunho (o Remover do dia de quem vem e o Desfazer a mudança de quem
     sai, antes de salvar) */
  function largarMudancaDia(cpf) {
    rasc.mudar_dia = rasc.mudar_dia.filter(function (m) { return m.cpf !== cpf; });
  }

  /* desfazer a mudança de dia (o lápis da folga no dia de antes, ou o Devolver do Remover no dia novo): id = a mudança,
     dia = o outro dia dela (as telas o marcam e o leem de novo). No dia novo, as colocações manuais dele nas horas que
     saem (periodos) saem deste dia */
  function desfazerMudanca(id, dia, cpf, periodos) {
    if (cpf && periodos) cortarAjustes(cpf, periodos.map(faixa));
    rasc.desfazer_mudanca = rasc.desfazer_mudanca.filter(function (x) { return x.id !== id; }).concat([{ id: id, dia: dia }]);
  }

  /* tirar do dia novo quem mudou de dia (o Tirar do dia do Remover): ele sai daqui e o dia de antes vira folga, contada
     ou não no banco de horas */
  function tirarMudanca(id, contabilizar, dia, cpf, periodos) {
    if (cpf && periodos) cortarAjustes(cpf, periodos.map(faixa));
    rasc.tirar_mudanca = rasc.tirar_mudanca.filter(function (x) { return x.id !== id; })
      .concat([{ id: id, contabilizar: !!contabilizar, dia: dia }]);
  }

  /* os outros dias que o rascunho do Dia muda (a mudança de dia mexe em dois dias): AAAA-MM-DD, sem repetir */
  function outrosDias() {
    if (!rasc) return [];
    var dias = [], iso = donoIso();
    rasc.mudar_dia.map(function (x) { return x.de && x.de !== iso ? x.de : x.para; })
      .concat(rasc.desfazer_mudanca.map(function (x) { return x.dia; }), rasc.tirar_mudanca.map(function (x) { return x.dia; }))
      .forEach(function (d) { if (d && d !== iso && dias.indexOf(d) < 0) dias.push(d); });
    return dias;
  }

  /* quem passa o serviço daqui para outro dia no rascunho (a frase da nota O que mudou; quem vem de outro dia entra na
     frase de quem entrou numa função): { cpf: { para: 'DD/MM', horas } } */
  function mapaMudancas() {
    var r = {};
    ((rasc && rasc.mudar_dia) || []).forEach(function (x) {
      if (x.de && x.de !== donoIso()) return;
      var p = String(x.para || '').split('-');
      r[x.cpf] = { para: p.length === 3 ? p[2] + '/' + p[1] : '', horas: textoPeriodos(x.periodos || []) };
    });
    return r;
  }

  function pontualSalvo(cpf) { return (base.pontuais || []).some(function (x) { return x.cpf === cpf; }); }
  /* o pontual gravado no dia, como a leitura do dia gravado traz: { periodos, contabilizado, minutos (as horas que ele
     tem no banco de horas por este dia; sem o número na leitura, as do horário) } ou null */
  function pontualGravado(cpf) {
    var x = base && ((base.dados || {}).pontuais || []).filter(function (p) { return p.cpf === cpf; })[0];
    if (!x) return null;
    var minutos = x.contabilizado_min != null ? Number(x.contabilizado_min)
      : uniao((x.periodos || []).map(faixa)).reduce(function (t, f) { return t + f[1] - f[0]; }, 0);
    return { periodos: x.periodos || [], contabilizado: !!x.contabilizado, minutos: minutos };
  }

  /* uma mudança da lista: o rascunho de antes entra no desfazer, o refazer zera, e a lista mostra a prévia; nada grava
     até o Salvar do rodapé. O lápis aberto guarda a mudança dele antes (um passo próprio) */
  function passo(antes) {
    pilhaDesfazer.push(antes);
    pilhaRefazer = [];
    if (G()) G().passou('dia', dono);   // a ordem dos passos de todos os dias (o Desfazer do rodapé)
  }
  function mudar(fn) { if (!rasc) return; fecharLinha('guardar'); terminarVivo(); passo(copiar(rasc)); fn(); desenhar(); }

  /* ---------- ao vivo (as sub-telas e o lápis) ---------- */

  /* o lápis aberto e as perguntas embaixo da linha (o Remover do dia e o Remover da guarnição): 'guardar' (a mudança
     fica, sem redesenhar a lista), 'largar' (depois de salvar ou descartar) ou sem modo (fica e a lista mostra o dia como
     vai ficar) */
  function fecharLinha(modo) {
    if (RosterWork.escalasPainelLinha) RosterWork.escalasPainelLinha.fechar(modo);
    if (RosterWork.escalasPainelRemover) RosterWork.escalasPainelRemover.fecharPergunta(modo);
    if (RosterWork.escalasPainelCiclo && RosterWork.escalasPainelCiclo.fecharPergunta) RosterWork.escalasPainelCiclo.fecharPergunta(modo);
  }

  /* abre a mudança ao vivo: a foto do rascunho do Dia e do Ciclo de agora */
  function comecarVivo() {
    if (!rasc) return;
    var C = RosterWork.escalasPainelCiclo;
    vivo = { foto: copiar(rasc), ciclo: C ? C.copia() : null, mudou: false, travado: false };
  }
  /* a resposta mudou: o rascunho volta à foto e fn põe nele a mudança de agora (fn nulo: pergunta sem resposta).
     travado = pergunta pela metade ou conflito: o Salvar do rodapé fica desligado até resolver */
  function aoVivo(fn, travado) {
    if (!vivo || !rasc) return;
    var C = RosterWork.escalasPainelCiclo;
    rasc = copiar(vivo.foto);
    if (C && vivo.ciclo) C.voltarA(vivo.ciclo);
    if (fn) fn();
    vivo.mudou = JSON.stringify(rasc) !== JSON.stringify(vivo.foto);
    vivo.travado = !!travado;
    avisarRascunho();
  }
  /* o Voltar ao dia e o X do lápis: o que foi respondido fica, como um passo do desfazer. Devolve true quando o Dia
     mudou (a mudança do Ciclo fica no rascunho do Ciclo) */
  function terminarVivo() {
    if (!vivo) return false;
    var v = vivo;
    vivo = null;
    if (v.mudou) passo(v.foto);
    if (v.travado) avisarRascunho();   // o Salvar volta a ligar
    return v.mudou;
  }

  /* ---------- prévia e gravação ---------- */

  /* enquanto a lista carrega, o menu Editar o dia e o Imprimir esperam (a sub-tela abriria com o dia de antes) */
  function mostrarCarregando() {
    ctx.carregando = true;
    if (ctx.semLista) return;   // a célula mostra a espera dela
    ctx.listaNaTela = false;
    acenderLista();
    var menu = document.querySelector('.painel-lateral .escala-edicao-menu > .botao');
    if (menu) menu.disabled = true;
    ctx.corpo.textContent = '';
    var no = RosterWork.painel.criarCarregando();
    if (no) ctx.corpo.appendChild(no);
  }
  function mostrarFalha() {
    pronta();
    if (ctx.semLista) { avisarCelula(null); return; }
    ctx.listaNaTela = false;
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (no) { no.textContent = msg().falhaCarregar; ctx.corpo.appendChild(no); }
    avisarCelula(null);   // a caixa da célula aberta no mesmo dia, sobre a lista do painel (sub.ouvir)
  }

  /* a lista que já está na tela espera a prévia: fica, apagada e sem responder, na mesma rolagem, com a frase por cima,
     sem empurrar nada */
  function apagarLista() {
    ctx.carregando = true;
    var menu = document.querySelector('.painel-lateral .escala-edicao-menu > .botao');
    if (menu) menu.disabled = true;
    if (listaApagada) return;
    var corpo = ctx.corpo, caixa = RosterWork.tpl('tpl-painel-etapa');
    corpo.classList.add('painel-corpo--refazendo');
    corpo.inert = true;
    corpo.setAttribute('aria-busy', 'true');
    corpo.insertBefore(caixa, corpo.firstChild);
    listaApagada = { corpo: corpo, caixa: caixa, frase: RosterWork.etapas.linha(caixa.querySelector('.painel-etapa-caixa'), 'previaDia') };
  }
  function acenderLista() {
    if (!listaApagada) return;
    var apagada = listaApagada;
    listaApagada = null;
    apagada.frase.parar();
    apagada.caixa.remove();
    apagada.corpo.classList.remove('painel-corpo--refazendo');
    apagada.corpo.inert = false;
    apagada.corpo.removeAttribute('aria-busy');
  }

  /* (re)desenha a lista do dia: com mudança no rascunho, o dia como vai ficar (a prévia); sem mudança, o dia gravado.
     A 1ª vez lê o dia */
  function desenhar() {
    if (!ctx) return;
    /* a lista é refeita: o lápis aberto e a sub-tela guardam o que já foi respondido */
    fecharLinha('guardar');
    terminarVivo();
    var vinhaDaSub = ctx.emSub;
    ctx.emSub = false;
    /* de volta à lista: o rodapé próprio da sub-tela (o da troca) sai, e o Salvar do rodapé largo volta */
    if (ctx.rodape) { ctx.rodape.textContent = ''; ctx.rodape.classList.add('oculto'); }
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (base) {
      if (!ctx.semLista) montarSubcabecalho();
      avisarRascunho();
      /* com mudança em qualquer aba, o dia como vai ficar; sem nenhuma, o dia gravado */
      if (precisaPrevia()) { mostrarPrevia(vinhaDaSub); return; }
      exibir(base.dados);
      return;
    }
    if (!ctx.semLista) montarSubcabecalho();
    mostrarCarregando();
    var meu = ++pedido, c = ctx;
    /* o dia que vai mostrar a prévia já a pede junto com a leitura dele, e não depois dela (a tela espera as duas) */
    var previa = editavel() && precisaPrevia() ? pedirPrevia() : null;
    RosterWork.painel.segurar(RosterWork.escalasDados.lerDistribuicaoDia(ctx.unidadeId, ctx.iso)).then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      if (!dados) { mostrarFalha(); return; }
      comecar(dados, previa);
    });
  }

  /* o dia mostra a prévia (o dia como vai ficar)? Com mudança esperando o Salvar em algum dia; na caixa da célula, só
     quando uma delas toca este dia (escalas-painel-salvar.js › tocaODia): no dia que ela não toca, quem está de serviço é o
     do dia gravado, que é o que a grade mostra nele, e a caixa abre sem esperar a prévia. O painel mostra sempre a prévia */
  function precisaPrevia() {
    var S = RosterWork.escalasPainelSalvar;
    if (!S || !S.paraPrevia()) return false;
    return !ctx.semLista || S.tocaODia(ctx.iso);
  }

  /* o pedido da prévia do dia, com a marca do Salvar de quando ele saiu: { marca, pedido } (pedido nulo sem mudança) */
  function pedirPrevia() {
    var D = RosterWork.escalasDados;
    return { marca: D.marcaDoSalvar(), pedido: D.lerPrevia('ler_distribuicao_dia', {}) };
  }

  /* o dia lido: vira a base e desenha; previa: o pedido dela que já saiu junto com a leitura */
  function comecar(dados, previa) {
    aceitar(dados);
    ctx.dadosAntes = dados;
    /* com mudança esperando o Salvar (em outro dia ou na outra aba, o Ciclo), o dia já como vai ficar */
    if (editavel() && precisaPrevia()) { mostrarPrevia(false, previa); return; }
    pronta();
    if (ctx.semLista) { avisarCelula(dados); return; }
    renderLista(dados);
    avisarCelula(dados);   // a caixa da célula aberta no mesmo dia, sobre a lista do painel (sub.ouvir)
  }

  /* o rodapé do painel (escalas-painel-salvar.js) conta as mudanças das duas abas */
  function avisarRascunho() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'dia' } })); }

  /* o dia da célula, sem a lista: a leitura (o gravado ou a prévia) vai para ela; null, a leitura falhou */
  function avisarCelula(dados) { if (ctx && ctx.aoMostrar) ctx.aoMostrar(dados); }

  /* o dia como vai ficar com os rascunhos das duas abas (escala_previa: o Salvar num ensaio, nada é gravado). A mudança
     do Dia que a gravação recusaria (ex.: efetivo acima do máximo, a folga recusada) dá o aviso, e o rascunho do Dia volta
     um passo; a recusa do Ciclo só avisa (desmarca-se lá). Com a lista na tela, ela fica até a prévia chegar; quem volta da
     sub-tela vê o dia de antes até lá. previa: o pedido que já saiu junto com a leitura do dia (pedirPrevia) */
  function mostrarPrevia(vinhaDaSub, previa) {
    var c = ctx, meu = ++pedido;
    if (vinhaDaSub && ctx.dados) renderLista(ctx.dados);
    if (ctx.listaNaTela) apagarLista();
    else mostrarCarregando();
    var D = RosterWork.escalasDados, p = previa || pedirPrevia(), marca = p.marca, pedidoPrevia = p.pedido;
    if (!pedidoPrevia) { exibir(base.dados); return; }
    RosterWork.painel.segurar(pedidoPrevia).then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      /* a resposta de antes do Salvar não desenha nem avisa; gravado, o dia gravado já está na tela; recusado, pede de novo */
      var depois = D.depoisDoSalvar(marca);
      if (depois) {
        depois.then(function () {
          if (ctx !== c || meu !== pedido || !c.carregando) return;
          if (base) mostrarPrevia(); else desenhar();
        });
        return;
      }
      if (!dados) { mostrarFalha(); return; }
      if (dados.erro_simulacao) {
        RosterWork.avisar({ tipo: 'erro', mensagem: dados.erro_simulacao });
        if (dados.erro_parte === 'dia' && pilhaDesfazer.length) { rasc = pilhaDesfazer.pop(); desenhar(); return; }
      }
      if (c.semLista) { exibir(dados); return; }
      var rolagem = c.corpo.scrollTop;
      exibir(dados);
      c.corpo.scrollTop = rolagem;
    });
  }

  /* a lista chegou: o menu Editar o dia volta a ligar */
  function pronta() {
    ctx.carregando = false;
    acenderLista();
    var menu = document.querySelector('.painel-lateral .escala-edicao-menu > .botao');
    if (menu) menu.disabled = !!ctx.salvando;
  }

  /* desenha o dia (o gravado ou a prévia); a nota O que mudou compara com o que estava na tela */
  function exibir(dados) {
    pronta();
    var antes = ctx.dados, sugestao = ctx.sugestao || null;
    ctx.sugestao = null;
    ctx.ultima = null;
    if (antes && antes !== dados) {
      /* com o Mudar de unidade que acabou de entrar no rascunho, a outra unidade também (a conta que o banco conferiu) */
      var o = outraNaPrevia();
      if (o) o.usada = true;
      var mudou = o && o.depois ? diferenca([antes, o.antes], [dados, o.depois]) : diferenca(antes, dados);
      if (mudou.length || sugestao) ctx.ultima = { mudou: mudou, sugestao: sugestao, mudancas: mapaMudancas() };
    }
    ctx.dadosAntes = antes || dados;   // o aviso de quem assume o Chefe de Socorro compara com o dia antes desta mudança
    ctx.dados = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
    if (ctx.semLista) { avisarCelula(dados); return; }
    renderLista(dados);
    avisarCelula(dados);   // a caixa da célula aberta no mesmo dia, sobre a lista do painel (sub.ouvir)
  }

  /* as funções e os horários de cada militar numa leitura do dia, ou em várias juntas (as duas unidades do Mudar de
     unidade: quem sai de uma e entra na outra fica numa entrada só); quem está sem função entra sem nada */
  function lugaresPorMilitar(leituras) {
    var r = {};
    [].concat(leituras || []).forEach(function (dados) {
      ((dados && dados.postos) || []).forEach(function (po) {
        (po.funcoes || []).forEach(function (f) {
          (f.militares || []).forEach(function (m) {
            var x = r[m.cpf] = r[m.cpf] || { nome: nomeDe(m), lista: [] };
            (m.periodos || []).forEach(function (pr) { x.lista.push({ funcao: f.nome, posto: po.nome, posto_id: po.id, hi: pr.hi, hf: pr.hf }); });
          });
        });
      });
      ((dados && dados.sem_funcao) || []).forEach(function (m) { r[m.cpf] = r[m.cpf] || { nome: nomeDe(m), lista: [] }; });
    });
    return r;
  }
  /* quem mudou de função ou de horário entre duas leituras (ou dois grupos de leituras, os mesmos dias de unidades
     diferentes): [{ cpf, nome, antes:[{funcao, posto, posto_id, hi, hf}], depois, sem_funcao (sem função depois) }] */
  function diferenca(antes, depois) {
    var a = lugaresPorMilitar(antes), d = lugaresPorMilitar(depois), cpfs = {}, sem = {};
    Object.keys(a).concat(Object.keys(d)).forEach(function (k) { cpfs[k] = true; });
    [].concat(depois || []).forEach(function (dd) { ((dd && dd.sem_funcao) || []).forEach(function (m) { sem[m.cpf] = true; }); });
    function marca(l) { return l.map(function (x) { return [x.funcao, x.posto_id || x.posto, x.hi, x.hf].join('|'); }).sort().join(';'); }
    return Object.keys(cpfs).map(function (cpf) {
      var x = a[cpf] || { lista: [] }, y = d[cpf] || { lista: [] };
      return { cpf: cpf, nome: y.nome || x.nome || '', antes: x.lista, depois: y.lista, sem_funcao: !!sem[cpf] };
    }).filter(function (m) { return marca(m.antes) !== marca(m.depois); });
  }

  /* a conta da outra unidade do Mudar de unidade (a conferência, escalas-painel-remanejar-conferir.js): { iso, unidadeId (a do
     painel), antes, depois (as leituras do dia dela, a gravada e a prévia), marca (o rascunho da conta), usada (a nota O que
     mudou da lista já a mostrou) }. A nota da lista e a do Salvar acham nela os postos dela */
  var outra = null;
  function outraUnidade(antes, depois, marca) {
    if (!ctx) return;
    outra = { iso: ctx.iso, unidadeId: ctx.unidadeId, antes: antes, depois: depois, marca: marca, usada: false };
  }
  /* o rascunho do Dia como a prévia o vê (o que diz se a conta da outra unidade ainda vale) */
  function marcaDaPrevia() { return rasc && base ? JSON.stringify(previaDia()) : ''; }
  /* a conta da outra unidade que vale para a prévia de agora: a do mesmo dia e do mesmo rascunho, uma vez só */
  function outraNaPrevia() {
    if (!outra || outra.usada || !ctx || outra.iso !== ctx.iso || String(outra.unidadeId) !== String(ctx.unidadeId)) return null;
    return outra.marca && outra.marca === marcaDaPrevia() ? outra : null;
  }
  /* as leituras do dia onde achar os postos das frases: a desta unidade e, com o Mudar de unidade, as da outra */
  function leiturasDoDia() {
    var l = [ctx && ctx.dados];
    if (outra && ctx && outra.iso === ctx.iso && String(outra.unidadeId) === String(ctx.unidadeId)) l.push(outra.depois, outra.antes);
    return l.filter(Boolean);
  }

  function podeDesfazer() { return !!ctx && ctx.admin && !ctx.emSub && !!base && pilhaDesfazer.length > 0; }
  function podeRefazer() { return !!ctx && ctx.admin && !ctx.emSub && !!base && pilhaRefazer.length > 0; }

  /* um passo do Desfazer (ou do Refazer) num rascunho est = { rasc, pilhaDesfazer, pilhaRefazer }: o de agora ou o de um dia
     guardado na gaveta. false: sem passo */
  function andarEm(est, desfazer) {
    var de = desfazer ? est.pilhaDesfazer : est.pilhaRefazer, para = desfazer ? est.pilhaRefazer : est.pilhaDesfazer;
    if (!de.length) return false;
    para.push(copiar(est.rasc));
    est.rasc = de.pop();
    return true;
  }
  /* no rascunho de agora (a lista desenha de novo) */
  function andarAgora(desfazer) {
    var est = { rasc: rasc, pilhaDesfazer: pilhaDesfazer, pilhaRefazer: pilhaRefazer };
    var andou = andarEm(est, desfazer);
    rasc = est.rasc;
    return andou;
  }

  /* desfazer: o rascunho volta um passo (nada foi gravado) */
  function desfazerPasso() {
    if (!podeDesfazer()) return;
    fecharLinha('guardar');   // a mudança do lápis aberto vira o passo que se desfaz
    andarAgora(true);
    desenhar();
  }

  /* refazer: o passo desfeito volta ao rascunho */
  function refazerPasso() {
    if (!podeRefazer()) return;
    fecharLinha('guardar');   // a mudança do lápis aberto é um passo novo: o refazer some
    andarAgora(false);
    desenhar();
  }

  /* subcabeçalho do Dia (só na lista): para o admin, o menu Editar o dia; para todos, só na Escala (os moldes moram lá),
     o Solicitar troca, à esquerda (à direita do menu), e, à direita, o Como a escala foi feita e o Imprimir (o Desfazer e
     o Refazer ficam no rodapé largo, escalas-painel-salvar.js). Enquanto grava, os botões ficam desligados */
  function montarSubcabecalho() {
    var sub = RosterWork.painel.subcabecalho();
    if (!sub) return;
    sub.textContent = '';
    /* só para consulta (o dia ainda vai mudar): nenhuma ação */
    if (ctx.consulta) { sub.classList.add('oculto'); return; }
    var imprimir = !ctx.emSub && !ctx.comparar && RosterWork.escalasImpressao
      ? RosterWork.escalasImpressao.botaoDoDia(abrirImpressao) : null;
    var como = !ctx.emSub && !ctx.comparar && RosterWork.escalasPainelComo
      ? RosterWork.escalasPainelComo.botaoDoDia(abrirComo) : null;
    var solicitar = !ctx.emSub && !ctx.comparar && ctx.visao !== 'estagiarios' && RosterWork.escalasPainelTroca ? RosterWork.tpl('tpl-escala-dia-solicitar') : null;
    /* a aba Estagiários num dia sem estágio na unidade: sem o Editar o dia */
    var editar = ctx.admin && !(ctx.visao === 'estagiarios' && !((ctx.dados || {}).estagios_unidade || []).length);
    if (ctx.emSub || (!editar && !imprimir && !como && !solicitar)) { sub.classList.add('oculto'); return; }
    /* o menu Editar o dia, só com o que é do dia todo: Adicionar militar e Trazer de outra unidade abrem as perguntas;
       Registrar troca de serviço abre o formulário da troca ali mesmo; Voltar o dia ao automático (só com ajuste manual)
       confirma. O que é de um militar fica no lápis dele, na aba Militares */
    var menu = editar ? RosterWork.tpl('tpl-escala-edicao-acoes') : null;
    if (menu) {
      var botaoMenu = menu.querySelector('.botao'), itemAutomatico = menu.querySelector('[data-acao="automatico"]');
      botaoMenu.disabled = !!ctx.salvando || !!ctx.carregando;
      /* o clique no botão chega aqui antes do ouvinte do document, que abre o menu: o Voltar ao automático vale agora? */
      itemAutomatico.classList.toggle('oculto', !podeVoltarAoAutomatico());
      botaoMenu.addEventListener('click', function () { itemAutomatico.classList.toggle('oculto', !podeVoltarAoAutomatico()); });
      /* na aba Estagiários, o menu tem só o Adicionar estagiário */
      var soEstagiario = ctx.visao === 'estagiarios';
      var titulo = menu.querySelector('.dropdown-titulo');
      [].forEach.call(menu.querySelector('.dropdown-menu').children, function (filho) {
        if (filho.getAttribute('data-acao') === 'adicionar-estagiario') filho.classList.toggle('oculto', !soEstagiario);
        else if (soEstagiario && filho !== titulo) filho.classList.add('oculto');
      });
      if (soEstagiario) botaoMenu.addEventListener('click', function () { itemAutomatico.classList.add('oculto'); });
      var acoes = {
        adicionar: function () { if (RosterWork.escalasPainelAdicionar) RosterWork.escalasPainelAdicionar.abrir(); },
        'adicionar-estagiario': function () { if (RosterWork.escalasPainelAdicionar) RosterWork.escalasPainelAdicionar.abrir({ estagiario: true }); },
        trazer: function () { abrirRemanejar({ fazer: 'trazer' }); },
        troca: function () { abrirTroca(true); },
        automatico: voltarAoAutomatico
      };
      [].forEach.call(menu.querySelectorAll('[data-acao]'), function (b) {
        b.addEventListener('click', function () { if (ctx && !ctx.salvando && !ctx.carregando) acoes[b.getAttribute('data-acao')](); });
      });
      sub.appendChild(menu);
    }
    if (solicitar) {
      solicitar.disabled = !!ctx.salvando;
      solicitar.addEventListener('click', function () { if (ctx && !ctx.salvando) abrirTroca(false); });
      sub.appendChild(solicitar);
    }
    if (como) sub.appendChild(como);
    if (imprimir) sub.appendChild(imprimir);
    sub.classList.remove('oculto');
  }

  /* ---------- lista do dia ---------- */

  /* o período cabe em alguma janela de serviço do militar? */
  function foraDaDisponibilidade(per, m) {
    var janelas = m.disp || [];
    if (!janelas.length) return true;
    var f = faixa(per);
    return !janelas.some(function (j) { var g = faixa(j); return f[0] >= g[0] && f[1] <= g[1]; });
  }

  /* o bloco de uma função: o rótulo à esquerda, no meio da altura das linhas dela (dois empilhados quando o
     mesmo militar acumula), e o lugar das linhas. nivel 'alerta' = amarelo (ressalva), 'erro' = vermelho.
     Sem rótulos (Sem função, De folga), só alinha as linhas com as das funções. Devolve { el, linhas } */
  function novoGrupo(rotulos, nivel) {
    var el = RosterWork.tpl('tpl-escala-edicao-grupo');
    if (!el) return null;
    var fn = el.querySelector('.escala-edicao-funcao');
    (rotulos || []).forEach(function (nm) {
      var r = RosterWork.tpl('tpl-escala-edicao-funcao-rotulo');
      if (r) { r.textContent = pecas().abreviarFuncao(nm); fn.appendChild(r); }
    });
    if (nivel && rotulos && rotulos.length) fn.classList.add('escala-edicao-funcao--' + nivel);
    return { el: el, linhas: el.querySelector('.escala-edicao-linhas') };
  }

  /* a linha vazia do molde; quem só lê não tem a coluna das ações */
  function novaLinha() {
    var linha = RosterWork.tpl('tpl-escala-edicao-linha');
    if (linha && !ctx.admin) {
      linha.classList.add('escala-edicao-linha--leitura');
      linha.querySelector('.escala-edicao-acoes').remove();
    }
    return linha;
  }

  /* a dica do Fixado (o selo ou o cadeado): quem fixou, "Adm: Fulano" */
  function dicaFixado(el, nome) { if (el && nome) el.setAttribute('data-dica', msg().fixadoPor(nome)); }

  /* o Fixado da função vazia de propósito: para quem edita, o selo depois do texto; para quem lê, o cadeado */
  function fixadoNoVazio(linha, fv) {
    if (!linha || !fv) return;
    if (ctx.admin) {
      var selo = RosterWork.tpl('tpl-escala-edicao-fixado');
      if (selo) { dicaFixado(selo, fv.por); linha.querySelector('.escala-edicao-pessoa').appendChild(selo); }
      return;
    }
    var cad = RosterWork.tpl('tpl-escala-mes-origem');
    if (cad) { pecas().definirIcone(cad, 'icone-cadeado'); dicaFixado(cad, fv.por); linha.querySelector('.escala-edicao-pessoa').appendChild(cad); }
  }

  /* uma linha do dia: militar · horário · ações (a função fica no bloco dela; o lápis entra depois, menuNaLinha).
     op = { ghost, folga, icone, novo, alterada }: novo = o selo "Novo" e a barra cinza; alterada = só a barra */
  function linhaMilitar(m, op) {
    op = op || {};
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    var ic = p.iconeDaLinha(m, op.icone);
    if (ic) icones.appendChild(ic);
    /* a colocação manual: para o admin, o selo Fixado depois do nome; para quem só lê, o cadeado (na linha com
       "Novo" ele sai para caber) */
    if (m.fixado && !op.novo && !ctx.admin) {
      var cad = RosterWork.tpl('tpl-escala-mes-origem');
      if (cad) { p.definirIcone(cad, 'icone-cadeado'); dicaFixado(cad, m.fixado_por); icones.appendChild(cad); }
    }
    if (!op.ghost && !op.folga) { p.marcarRegras(linha, m); p.marcarOutraUnidade(linha, m); }
    linha.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (m.fixado && !op.novo && ctx.admin) {
      var fixado = RosterWork.tpl('tpl-escala-edicao-fixado');
      if (fixado) { dicaFixado(fixado, m.fixado_por); linha.querySelector('.escala-edicao-pessoa').appendChild(fixado); }
    }
    if (op.novo) {
      var selo = RosterWork.tpl('tpl-escala-edicao-novo');
      if (selo) linha.querySelector('.escala-edicao-pessoa').appendChild(selo);
    }
    if (op.novo || op.alterada) linha.classList.add('escala-edicao-linha--alterada');
    var horas = linha.querySelector('.escala-distribuicao-horas');
    (m.periodos || []).forEach(function (per) { var h = p.hora(per); if (h) horas.appendChild(h); });
    if (op.ghost) linha.classList.add('escala-edicao-linha--original');
    if (op.folga) linha.classList.add('escala-edicao-linha--folga');
    if (!op.ghost && !op.folga) {
      p.marcarConflito(linha, m, null, null);
      p.marcarAviso(linha, m);
      p.marcarProblemas(linha, m);
    }
    return linha;
  }

  /* a lista edita só no Dia do admin (não na comparação) */
  function editavel() { return ctx.admin && !ctx.comparar; }

  /* o lápis e o menu da linha (escalas-painel-linha-menu.js), só no Dia de quem edita. cfg = { tipo, grupo, posto, funcao,
     rotulo, militar, periodos, folga } */
  function menuNaLinha(linha, cfg) {
    if (linha && editavel() && RosterWork.escalasPainelLinhaMenu) RosterWork.escalasPainelLinhaMenu.na(linha, cfg);
    return linha;
  }

  /* horário sem ninguém na função ou cadeira vazia do motor (o banco só manda o que falta para o mínimo e a função
     obrigatória): o texto vermelho e, para o admin, o lápis (Pôr um militar aqui). O lugar aberto sem ninguém (o Adicionar
     mais um lugar neste posto): "Vazio", em cinza, e já abre o cartão (ctx.lugarNovo, no
     fim da lista) */
  function linhaVazia(posto, nomeFuncao, per, ancora, aberta) {
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    var pessoa = linha.querySelector('.escala-edicao-pessoa');
    pessoa.textContent = '';
    var t = RosterWork.tpl('tpl-escala-edicao-vazio-leitura');
    if (t) {
      t.textContent = aberta ? msg().vagaVazia('aberta') : msg().semNinguemTexto;
      if (aberta) t.classList.add('escala-edicao-vazio-leitura--aberta');
      pessoa.appendChild(t);
    }
    /* a marca do horário sem ninguém (o passo a passo acha a linha por ela) */
    if (!aberta) linha.classList.add('escala-edicao-linha--vaga');
    var h = p.hora(per);
    if (h) linha.querySelector('.escala-distribuicao-horas').appendChild(h);
    menuNaLinha(linha, { tipo: 'vaga', grupo: ancora, posto: posto, funcao: nomeFuncao, militar: null, periodos: [{ hi: per.hi, hf: per.hf }] });
    var novo = ctx.lugarNovo;
    if (aberta && novo && novo.chave === posto.tipo + ':' + posto.id && novo.funcao === nomeFuncao) novo.linha = linha;
    return linha;
  }

  /* cpfs dos militares cuja faixa se sobrepõe a outra na mesma função */
  function cpfsSobrepostos(funcao) {
    var set = {};
    if (!funcao || !funcao.sobreposicao) return set;
    var ms = funcao.militares || [];
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) {
        var cruzam = (ms[i].periodos || []).some(function (a) {
          return (ms[j].periodos || []).some(function (b) { return !!cruza(faixa(a), faixa(b)); });
        });
        if (cruzam) { set[ms[i].cpf] = true; set[ms[j].cpf] = true; }
      }
    }
    return set;
  }

  /* o bloco de uma função: militares e os horários sem ninguém, com a função no meio da altura de todas as linhas
     (na comparação, também quem saiu, riscado). O grupo sem número ("Efetivo", "Rádio Operador", "Estagiário") junta os
     lugares da mesma função (f.partes, do mesclarFuncoes): as pessoas na ordem de antiguidade, cada linha com o lápis do
     lugar dela, e os lugares vazios no fim. No Chefe de Socorro com o Condutor (o mesmo militar), o menu é o do
     Condutor; o Chefe de Socorro e o Oficial de Área sozinhos têm o Mudar para outra função e a parte do dia (o papel
     é sempre do mais antigo do dia e vai junto com ele); o papel que já foi junto com ele para outra função do posto,
     só a parte do dia (o lugar dele muda pela linha dessa função) */
  function linhasFuncao(caixa, posto, f) {
    var partes = f.partes || [f];
    var p = pecas();
    var temErro = partes.some(function (pt) { return (!!pt.vazio && pt.vazio_motivo !== 'aberta') || (pt.vao || []).length > 0; });
    var rotulos = (f.nomes && f.nomes.length) ? f.nomes : [f.nome];
    var grupo = novoGrupo(rotulos, temErro ? 'erro' : p.nivelFuncao(f));
    if (!grupo) return;
    /* o nome da função: para quem edita o dia, o clique abre o menu do nome (o Adicionar mais um lugar neste posto e o
       Como foi escolhido); para quem só vê, o Como foi escolhido (a escala gravada; na comparação, não; a busca pelos
       nomes guardados dos lugares, o título com o nome da tela) */
    var elFuncao = grupo.el.querySelector('.escala-edicao-funcao');
    var como = (RosterWork.escalasPainelComo && !ctx.comparar && !ctx.consulta)
      ? { unidadeId: ctx.unidadeId, iso: ctx.iso, posto: posto.nome, rotulos: rotulos,
          funcoes: f.partes ? partes.map(function (pt) { return pt.nome; }) : rotulos } : null;
    if (editavel()) menuNoNome(elFuncao, posto, como);
    else if (como) RosterWork.escalasPainelComo.rotulo(elFuncao, como);
    function ancora() { return grupo.el; }
    function por(linha) { if (linha) grupo.linhas.appendChild(linha); }
    var sobrepostos = {};
    partes.forEach(function (pt) { Object.assign(sobrepostos, cpfsSobrepostos(pt)); });
    var condutor = rotulos.length > 1 ? rotulos[1] : null;
    (f.militares || []).forEach(function (m) {
      var cfg = { tipo: 'funcao', grupo: ancora, posto: posto, funcao: m.funcaoDoLugar || f.nome, militar: m, periodos: m.periodos || [] };
      if (condutor) {
        var fc = acharFuncao(posto, condutor);
        var mc = ((fc && fc.militares) || []).filter(function (o) { return o.cpf === m.cpf; })[0] || m;
        cfg = { tipo: 'funcao', grupo: ancora, posto: posto, funcao: condutor, rotulo: rotulos.join(' e '), militar: mc, periodos: mc.periodos || [] };
      } else if (BLOQUEADAS.test(f.nome)) {
        cfg.tipo = 'papel';
        cfg.levado = (posto.funcoes || []).some(function (o) {
          return !BLOQUEADAS.test(o.nome) && (o.militares || []).some(function (x) { return x.cpf === m.cpf; });
        });
      } else if (f.partes) {
        /* o grupo sem número: o cartão mostra o nome da tela; o estagiário, o menu dele (escalas-painel-linha-menu.js) */
        cfg.rotulo = rotulos[0];
        if (f.estagiario) cfg.estagiario = true;
      }
      /* na comparação, as marcas vêm do banco ("Novo" = quem entra pelo pedido; só a barra = quem o
         sistema remanejou); na edição não há marca, porque cada mudança já está gravada */
      var linha = menuNaLinha(linhaMilitar(m, { novo: !!(ctx.comparar && m.novo), alterada: ctx.comparar && !!m.mudou }), cfg);
      if (linha && (sobrepostos[m.cpf] || (m.periodos || []).some(function (per) { return foraDaDisponibilidade(per, m); }))) {
        linha.classList.add('escala-edicao-linha--erro');
      }
      por(linha);
    });
    /* riscados: na comparação, quem saiu */
    if (ctx.comparar) (f.ghosts || []).forEach(function (g) { por(linhaMilitar(g, { ghost: true })); });
    /* os lugares sem ninguém, cada um com o lápis dele; a linha vermelha da função obrigatória vazia de propósito leva o
       Fixado (com quem fez na dica) */
    partes.forEach(function (pt) {
      var aberta = pt.vazio_motivo === 'aberta';
      function fixar(l, cinza) { if (!cinza) fixadoNoVazio(l, pt.fixado_vazio); return l; }
      if (pt.vazio) por(fixar(linhaVazia(posto, pt.nome, { hi: '08:00', hf: '08:00' }, ancora, aberta), aberta));
      (pt.vao || []).forEach(function (v) { por(fixar(linhaVazia(posto, pt.nome, v, ancora, false), false)); });
    });
    if (grupo.linhas.children.length) caixa.appendChild(grupo.el);
  }

  /* o título do posto: o posto sem nenhuma função, para quem edita o dia, mostra o "Vazio, fora da escala", e o clique
     nele abre o menu do nome (o Adicionar mais um lugar neste posto); na troca de viatura com data, embaixo vem "No
     lugar da ... até ..." */
  function montarTituloPosto(caixa, posto) {
    var ancora = caixa.querySelector('.rotulo-secao');
    if (editavel() && ancora && !(posto.funcoes || []).length) {
      var linha = RosterWork.tpl('tpl-escala-posto-titulo');
      if (linha) {
        caixa.insertBefore(linha, ancora);
        linha.insertBefore(ancora, linha.firstChild);
        menuNoNome(linha.querySelector('.escala-posto-vazio'), posto, null);
        ancora = linha;
      }
    }
    var noLugar = pecas().noLugar ? pecas().noLugar(posto) : null;
    if (noLugar && ancora) ancora.insertAdjacentElement('afterend', noLugar);
  }

  /* o nome da função (ou o "Vazio, fora da escala" do posto sem função), para quem edita o dia: o clique abre embaixo o
     Adicionar mais um lugar neste posto (o mesmo do menu da linha: abre o próximo lugar e o cartão de quem entra; some
     com o posto cheio) e o Como foi escolhido (como = a informação do escalas-painel-como.js; sem ela, o item não
     aparece). Sem nenhum dos dois, o nome fica como está */
  function menuNoNome(el, posto, como) {
    var temLugar = ((posto && posto.livres) || []).length > 0;
    var temComo = !!(como && RosterWork.escalasPainelComo);
    if (!el || (!temLugar && !temComo)) return null;
    var dd = RosterWork.tpl('tpl-escala-funcao-menu');
    if (!dd) return null;
    var botao = dd.querySelector('.escala-funcao-menu-botao');
    while (el.firstChild) botao.appendChild(el.firstChild);
    el.appendChild(dd);
    var mais = dd.querySelector('.escala-funcao-menu-mais'), item = dd.querySelector('.escala-como-item');
    if (temLugar) mais.addEventListener('click', function () { abrirLugar(posto); });
    else mais.remove();
    if (temComo) RosterWork.escalasPainelComo.item(item, botao, como);
    else item.remove();
    if (!temLugar || !temComo) dd.querySelector('.escala-funcao-menu-traco').remove();
    return dd;
  }

  /* a função sem ninguém aberta (ou fechada) no rascunho, com o Desfazer; salva vazia, a função some */
  function abrirOuFechar(posto, mudanca) {
    mudar(function () {
      var alvo = { viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto), nome_funcao: mudanca.abrir || mudanca.fechar };
      rasc.abertas = rasc.abertas.filter(function (a) {
        return !(a.nome_funcao === alvo.nome_funcao && a.viatura_id === alvo.viatura_id && a.instalacao_id === alvo.instalacao_id);
      });
      if (mudanca.abrir) rasc.abertas.push(alvo);
    });
  }

  /* Adicionar mais um lugar neste posto (o menu da linha e o do nome da função): abre o próximo lugar livre do posto e,
     quando a lista volta com ele, o cartão do lugar novo abre para escolher quem entra */
  function abrirLugar(posto) {
    var livre = posto && (posto.livres || [])[0];
    if (!ctx || ctx.salvando || !livre) return;
    ctx.lugarNovo = { chave: posto.tipo + ':' + posto.id, funcao: livre, linha: null };
    abrirOuFechar(posto, { abrir: livre });
  }

  function caixaPosto(posto) {
    var p = pecas();
    /* posto sem nenhuma função no dia (a reserva sem ninguém, o que fica fora da escala): só quem edita o dia vê, numa
       linha só, com o "Vazio, fora da escala" (montarTituloPosto); o Adicionar militar também chega nele pelo Onde */
    if (!(posto.funcoes || []).length && !editavel()) return null;
    var caixa = RosterWork.painel.criarCaixa(posto.nome);
    if (!caixa) return null;
    montarTituloPosto(caixa, posto);
    /* o posto sem ninguém fica na cor do que falta nele (o fora da escala, na cor escolhida na Distribuição; a reserva
       sem cor) */
    var np = p.nivelPosto(posto);
    if (!(posto.funcoes || []).length) {
      if (np) caixa.classList.add('grupo-caixa--posto-' + np);
      return caixa;
    }
    /* o vermelho (cadeira vazia ou horário sem ninguém abaixo do mínimo) vence o amarelo; a função aberta sem ninguém não
       é erro */
    if (np !== 'erro' && (posto.funcoes || []).some(function (f) {
      return (f.vazio && f.vazio_motivo !== 'aberta') || (f.vao || []).length > 0;
    })) np = 'erro';
    if (np) caixa.classList.add('grupo-caixa--posto-' + np);
    p.mesclarFuncoes(posto).forEach(function (f) { linhasFuncao(caixa, posto, f); });
    return caixa;
  }

  /* um bloco só para ver, antes das viaturas: as Funções especiais e a Extrajornada (o que a Central exibe) ou os
     Estagiários; cada pessoa continua no posto dela. Sem ninguém, o bloco não aparece */
  function caixaExibida(titulo, funcoes) {
    if (!funcoes.length) return null;
    var caixa = RosterWork.painel.criarCaixa(titulo);
    if (!caixa) return null;
    var antes = caixa.children.length;
    funcoes.forEach(function (f) { linhasExibida(caixa, f); });
    return caixa.children.length > antes ? caixa : null;
  }

  /* uma função de um bloco só para ver (o Oficial de Área, o Chefe de Socorro, o Cabo de Dia, a Extrajornada, o
     estagiário): a pessoa está no posto dela, então o Chefe de Socorro e o Oficial de Área de quem serve nesta unidade
     no dia têm o lápis só com a parte do dia do menu (os outros, sem lápis); o Oficial de Área da companhia, para quem
     administra a companhia, traz o Ver o dia na companhia (o dia dele mora lá; a aba Militares de lá abre com o menu
     dele); o Cabo de Dia sem ninguém, só para quem administra, em amarelo */
  function linhasExibida(caixa, f) {
    var grupo = novoGrupo([f.nome], f.semNinguem.length ? 'alerta' : null);
    if (!grupo) return;
    var semFuncao = ((ctx.dados || {}).sem_funcao || []).map(function (m) { return m.cpf; });
    var E = RosterWork.paginas && RosterWork.paginas.escalas;
    var cia = /^(oficial de área|of\. área)$/i.test(f.nome || '') && RosterWork.sessao.temPapel('companhia') && E && E.companhiaDe
      ? E.companhiaDe(ctx.unidadeId) : null;
    var papel = /^(chefe de socorro|chef\. soc\.|oficial de área|of\. área)$/i.test(f.nome || '');
    f.militares.forEach(function (m) {
      var linha = linhaMilitar(m, {});
      if (linha && (funcoesDoMilitar(m.cpf).length || semFuncao.indexOf(m.cpf) >= 0)) {
        menuNaLinha(linha, { tipo: papel ? 'papel' : 'exibida', exibida: true, militar: m, periodos: m.periodos || [] });
      } else if (linha && cia && String(cia.id) !== String(ctx.unidadeId)) {
        menuNaLinha(linha, { tipo: 'companhia', militar: m, periodos: m.periodos || [], companhia: cia });
      }
      if (linha) grupo.linhas.appendChild(linha);
    });
    f.semNinguem.forEach(function (per) {
      var linha = novaLinha();
      if (!linha) return;
      var pessoa = linha.querySelector('.escala-edicao-pessoa');
      pessoa.textContent = '';
      var t = RosterWork.tpl('tpl-escala-edicao-vazio-leitura');
      if (t) {
        t.textContent = msg().semCaboDia;
        t.classList.add('escala-edicao-vazio-leitura--alerta');
        pessoa.appendChild(t);
      }
      var h = pecas().hora(per);
      if (h) linha.querySelector('.escala-distribuicao-horas').appendChild(h);
      grupo.linhas.appendChild(linha);
    });
    if (grupo.linhas.children.length) caixa.appendChild(grupo.el);
  }

  /* Sem função: quem está de serviço sem função em algum horário (título vermelho, depois dos postos; só com o Chefe de
     Socorro ou o Oficial de Área que saiu da cadeira dele, m.papel, sem o vermelho: não é erro). Para o admin, o lápis
     de cada um abre o menu (Pôr numa função e a parte do dia, escalas-painel-linha-menu.js) */
  function caixaSemFuncao(sem) {
    if (!sem.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().semFuncaoRotulo);
    if (!caixa) return null;
    caixa.classList.add('escala-edicao-sem-funcao');   // a classe nomeia a caixa para o passo a passo
    if (sem.some(function (m) { return !m.papel; })) caixa.classList.add('grupo-caixa--posto-erro');
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    function ancora() { return grupo.el; }
    sem.forEach(function (m) {
      var l = menuNaLinha(linhaMilitar(m, {}),
        { tipo: 'sem', grupo: ancora, rotulo: msg().semFuncaoRotulo, militar: m, periodos: m.periodos || [] });
      if (l) grupo.linhas.appendChild(l);
    });
    caixa.appendChild(grupo.el);
    return caixa;
  }

  /* De folga: nome riscado, ícone de folga e o período; para o admin, o lápis abre o menu da folga (Cancelar a folga, ou
     Desfazer a mudança). A folga que veio da mudança de dia leva o ícone da mudança e, no lugar do período, o dia para
     onde o serviço passou. titulo = o da aba Militares, com quantos ("De folga (5)"); sem ele, "De folga" */
  function caixaFolgas(folgas, titulo) {
    if (!folgas.length) return null;
    var caixa = RosterWork.painel.criarCaixa(titulo || msg().deFolga);
    if (!caixa) return null;
    caixa.classList.add('escala-edicao-folgas');   // nomeia a caixa para o passo a passo
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    folgas.forEach(function (f) {
      var passou = f.mudanca && f.mudanca.para;
      var mil = { cpf: f.cpf, grad: f.grad, nome: f.nome, periodos: passou ? [] : [{ hi: f.hi, hf: f.hf }] };
      var linha = linhaMilitar(mil, { folga: true, icone: passou ? 'icone-origem-mudanca' : 'icone-folgas' });
      if (linha && passou) {
        var texto = RosterWork.tpl('tpl-escala-edicao-passou');
        if (texto) { texto.textContent = msg().passouPara(f.mudanca.para); linha.querySelector('.escala-distribuicao-horas').appendChild(texto); }
      }
      if (f.lancamento_id) menuNaLinha(linha, { tipo: 'folga', militar: mil, folga: f });
      if (linha) grupo.linhas.appendChild(linha);
    });
    caixa.appendChild(grupo.el);
    return caixa;
  }

  /* Observações do dia: o admin escreve e tira as dele, e cada uma grava na hora */
  function caixaObservacoes(dados) {
    /* no Dia de quem edita, as do rascunho aparecem já: as tiradas saem e as novas entram no grupo Administração */
    var lista = dados.observacoes || [];
    if (editavel() && rasc) {
      lista = lista.filter(function (o) { return !(o.id && rasc.observacoes.remover.indexOf(o.id) >= 0); })
        .concat(rasc.observacoes.adicionar.map(function (t) { return { classe: 'admin', texto: t, id: null }; }));
    }
    return pecas().observacoes(lista, {
      editar: ctx.admin,
      aoAdicionar: function (texto) { mudar(function () { rasc.observacoes.adicionar.push(texto); }); },
      aoRemover: function (o) {
        mudar(function () {
          if (o.id) { rasc.observacoes.remover.push(o.id); return; }
          var i = rasc.observacoes.adicionar.indexOf(o.texto);
          if (i >= 0) rasc.observacoes.adicionar.splice(i, 1);
        });
      }
    });
  }

  /* há mudança deste dia ainda não salva, em qualquer aba (o Lançar no SYSBM espera o Salvar) */
  function diaComMudanca() {
    var C = RosterWork.escalasPainelCiclo;
    return haMudanca() || !!(C && C.doDia(ctx.unidadeId, ctx.iso).length);
  }

  /* aviso quando o Chefe de Socorro ou o Oficial de Área muda por causa da última mudança */
  function notasPapeis(corpo, dados) {
    var antes = papeis(ctx.dadosAntes), agora = papeis(dados);
    Object.keys(agora).forEach(function (k) {
      var a = agora[k], b = antes[k] || { por: {} };
      var entram = Object.keys(a.por).filter(function (cpf) { return !b.por[cpf]; });
      if (!entram.length) return;
      var saem = Object.keys(b.por).filter(function (cpf) { return !a.por[cpf]; }).map(function (cpf) { return b.por[cpf].nome; });
      entram.forEach(function (cpf) {
        var nota = RosterWork.tpl('tpl-escala-nota');
        if (!nota) return;
        nota.querySelector('.nota-texto').textContent = msg().assumePapel(a.por[cpf].nome, funcaoNoPosto(a.funcao, a.posto),
          textoPeriodos(a.por[cpf].periodos), saem.join(' e '));
        corpo.appendChild(nota);
      });
    });
  }

  /* "Condutor da ABT-01" (o posto pelo id ou pelo nome, nas leituras do dia: a desta unidade e, com o Mudar de unidade,
     as da outra) */
  function lugarTexto(x, leituras) {
    var po = null;
    (leituras || leiturasDoDia()).some(function (d) {
      po = ((d && d.postos) || []).filter(function (o) { return x.posto_id ? o.id === x.posto_id : o.nome === x.posto; })[0] || null;
      return !!po;
    });
    return po ? funcaoNoPosto(x.funcao, po) : [pecas().nomeSemNumero(x.funcao), x.posto].filter(Boolean).join(' ');
  }

  /* a frase de um militar no O que mudou (a nota da lista): x = { cpf, nome, antes,
     depois, sem_funcao } (diferenca ou o banco); leituras = onde achar os postos; semFuncao = { cpf: true } de quem ficou
     sem função. Só o que mudou: as funções que ele deixou e as que ganhou (as que continuam ficam de fora); null quando,
     juntando as horas, nada mudou para ele */
  function fraseMudou(x, leituras, semFuncao) {
    var L = msg().linha;
    /* cada lugar com as horas juntas (o dia cortado em trechos repete a mesma função), pelo posto e pelo texto */
    function porLugar(lista) {
      var r = {};
      lista.forEach(function (l) {
        var texto = lugarTexto(l, leituras), k = (l.posto_id || l.posto) + '|' + texto;
        r[k] = r[k] || { texto: texto, faixas: [] };
        r[k].faixas.push(faixa(l));
      });
      Object.keys(r).forEach(function (k) { r[k].faixas = uniao(r[k].faixas); });
      return r;
    }
    function textos(r, chaves) {
      var t = chaves.map(function (k) { return r[k].texto; });
      return t.filter(function (n, i) { return t.indexOf(n) === i; });
    }
    var a = porLugar(x.antes || []), d = porLugar(x.depois || []);
    var antes = Object.keys(a), depois = Object.keys(d);
    var mesmos = antes.length === depois.length && antes.every(function (k) { return d[k]; });
    if (mesmos && antes.every(function (k) { return JSON.stringify(a[k].faixas) === JSON.stringify(d[k].faixas); })) return null;
    var horas = uniao([].concat.apply([], depois.map(function (k) { return d[k].faixas; }))).map(periodo);
    var deixou = antes.filter(function (k) { return !d[k]; }), ganhou = depois.filter(function (k) { return !a[k]; });
    var sem = x.sem_funcao || !!(semFuncao && semFuncao[x.cpf]);
    return !antes.length ? L.mudouEntrou(x.nome, textos(d, depois))
      : !depois.length ? (sem ? L.mudouSemFuncao(x.nome, textos(a, antes)) : L.mudouSaiu(x.nome, textos(a, antes)))
      : mesmos ? L.mudouHorario(x.nome, textoPeriodos(horas))
      : !ganhou.length ? L.mudouDeixou(x.nome, textos(a, deixou))
      : !deixou.length ? L.mudouGanhou(x.nome, textos(d, ganhou))
      : L.mudouPassou(x.nome, textos(a, deixou), textos(d, ganhou));
  }

  /* O que mudou na última gravação: uma frase por militar que mudou de lugar e, quando a troca deixou alguém sem
     função, o atalho de pô-lo no lugar que o outro deixou */
  function notaMudou(corpo) {
    var u = ctx.ultima;
    if (!u) return;
    var nota = RosterWork.tpl('tpl-escala-edicao-mudou');
    if (!nota) return;
    var L = msg().linha, lista = nota.querySelector('.escala-edicao-mudou-lista');
    var semFuncao = {}, leituras = leiturasDoDia();
    ((ctx.dados && ctx.dados.sem_funcao) || []).forEach(function (m) { semFuncao[m.cpf] = true; });
    u.mudou.forEach(function (x) {
      /* quem passou o serviço para outro dia: a frase da mudança de dia */
      var md = u.mudancas && u.mudancas[x.cpf];
      if (md) {
        var it = RosterWork.tpl('tpl-escala-edicao-mudou-item');
        if (it) { it.textContent = L.mudouDia(x.nome, md.para, md.horas); lista.appendChild(it); }
        return;
      }
      var frase = fraseMudou(x, leituras, semFuncao);
      if (!frase) return;
      var item = RosterWork.tpl('tpl-escala-edicao-mudou-item');
      if (item) { item.textContent = frase; lista.appendChild(item); }
    });
    var s = u.sugestao, atalho = nota.querySelector('.escala-edicao-mudou-atalho');
    if (s && semFuncao[s.cpf]) {
      atalho.textContent = s.texto;
      atalho.classList.remove('oculto');
      atalho.addEventListener('click', function () {
        if (!ctx || ctx.salvando) return;
        mudar(function () {
          s.lugares.forEach(function (l) {
            var posto = acharPosto(vidPosto(l.posto), iidPosto(l.posto));
            if (posto) aplicarColocacao({ cpf: s.cpf, posto: posto, funcao: l.funcao, periodos: l.periodos, sistema: false, pontual: null });
          });
        });
      });
    }
    if (!lista.children.length && atalho.classList.contains('oculto')) return;
    corpo.appendChild(nota);
  }

  /* os ajustes manuais que caem nos postos desta unidade (o Voltar o dia ao automático tira só esses) */
  function ajustesDaUnidade(lista) {
    var postos = (ctx.dados && ctx.dados.postos) || [];
    return lista.filter(function (a) {
      return postos.some(function (po) { return (po.tipo === 'viatura' && po.id === a.viatura_id) || (po.tipo === 'instalacao' && po.id === a.instalacao_id); });
    });
  }

  /* Voltar o dia ao automático (o item do Editar o dia, só com ajuste manual da unidade no dia): confirma, tira os
     ajustes manuais da unidade e o sistema distribui tudo de novo */
  function podeVoltarAoAutomatico() { return editavel() && !!base && !!ctx.dados && ajustesDaUnidade(base.ajustes).length > 0; }
  function voltarAoAutomatico() {
    if (!ctx || ctx.salvando || !podeVoltarAoAutomatico()) return;
    var L = msg().linha;
    RosterWork.confirmar({ tipo: 'aviso', mensagem: L.automaticoConfirmar(ctx.iso.split('-').reverse().slice(0, 2).join('/')),
      textoConfirmar: L.automaticoBotao,
      aoConfirmar: function () {
        mudar(function () {
          var daqui = ajustesDaUnidade(rasc.ajustes);
          rasc.ajustes = rasc.ajustes.filter(function (a) { return daqui.indexOf(a) < 0; });
          rasc.automatico = true;
        });
      } });
  }

  function renderLista(dados) {
    var p = pecas();
    var corpo = ctx.corpo;
    fecharLinha('guardar');
    corpo.textContent = '';
    p.anexarProblemas(dados);   // CNH, regra, exclusivo e grau de cada militar (do banco)
    if (editavel()) notaMudou(corpo);
    /* as abas Militares e Estagiários: o mesmo dia, por pessoa (escalas-painel-militares.js) */
    if ((ctx.visao === 'militares' || ctx.visao === 'estagiarios') && RosterWork.escalasPainelMilitares) {
      ctx.lugarNovo = null;
      /* a aba Estagiários: o Editar o dia depende dos estágios do dia, que chegam com a leitura */
      if (ctx.visao === 'estagiarios' && !ctx.emSub) montarSubcabecalho();
      RosterWork.escalasPainelMilitares.montar(corpo, dados, { estagiarios: ctx.visao === 'estagiarios' });
      ctx.listaNaTela = true;
      abrirMenuPedido();
      return;
    }
    var aviso = p.montarAvisoProblemas(dados.problemas, dados.postos, dados.faltam_modelos, dados.modelos_com_erro, ctx.admin);
    if (aviso) corpo.appendChild(aviso);
    if (ctx.admin) notasPapeis(corpo, dados);
    var alguem = false;
    function por(caixa) { if (caixa) { corpo.appendChild(caixa); alguem = true; } }
    /* o posto sem ninguém (só para quem edita) entra na lista, mas não tira o "Sem distribuição" do dia vazio */
    function porPosto(posto) {
      var caixa = caixaPosto(posto);
      if (caixa && !(posto.funcoes || []).length) corpo.appendChild(caixa);
      else por(caixa);
    }
    /* a ordem: Funções especiais, as instalações (Central, Rancho, Almoxarifado e as outras), Extrajornada,
       Estagiários, Sobreaviso, as viaturas, Sem função e De folga */
    var blocos = p.blocosDoDia(dados.postos, ctx.admin);
    por(caixaExibida(msg().blocoEspeciais, blocos.especiais));
    blocos.instalacoes.forEach(porPosto);
    por(caixaExibida(msg().blocoExtra, blocos.extra));
    por(caixaExibida(msg().blocoEstagiarios, blocos.estagiarios.length
      ? [{ nome: msg().rotuloEstagiario, militares: blocos.estagiarios, semNinguem: [] }] : []));
    /* o sobreaviso da companhia (escalas-painel-sobreaviso.js) */
    if (RosterWork.escalasPainelSobreaviso && !ctx.comparar) RosterWork.escalasPainelSobreaviso.montar(corpo, dados, ctx);
    blocos.viaturas.forEach(porPosto);
    por(caixaSemFuncao(dados.sem_funcao || []));
    por(caixaFolgas(dados.folgas || []));
    /* dia sem ninguém: o estado vazio, nunca a tela em branco */
    if (!alguem) {
      var vazio = RosterWork.tpl('tpl-escala-distribuicao-estado');
      if (vazio) { vazio.textContent = msg().semDistribuicao; corpo.appendChild(vazio); }
    }
    var obs = caixaObservacoes(dados);
    if (obs) corpo.appendChild(obs);
    /* Lançar no SYSBM: o último bloco do Dia gravado, para quem administra o pelotão (escalas-sysbm.js) */
    if (ctx.admin && !ctx.comparar && RosterWork.escalasSysbm) {
      RosterWork.escalasSysbm.montar(corpo, ctx.unidadeId, ctx.iso, { desligado: diaComMudanca() });
    }
    mostrarHistorico();
    /* o lugar que o Adicionar mais um lugar neste posto abriu: o cartão para escolher quem entra */
    var novo = ctx.lugarNovo;
    ctx.lugarNovo = null;
    if (novo && novo.linha && RosterWork.escalasPainelLinhaMenu) RosterWork.escalasPainelLinhaMenu.fazer(novo.linha, 'por-aqui');
    ctx.listaNaTela = true;
    abrirMenuPedido();
  }

  /* o Ver o dia (da aba Funções) e o Ver as funções (da aba Militares): a outra aba abre e, quando a lista dela chega, o
     menu da primeira linha dele */
  function verMilitar(cpf, visao) {
    if (!ctx || !cpf) return;
    ctx.abrirMenuDe = cpf;
    /* o estagiário fica na aba Estagiários */
    var estagiario = visao === 'militares' && ctx.dados && ctx.dados.estagios && ctx.dados.estagios[cpf]
      && RosterWork.escalasPainel.temAba('estagiarios');
    RosterWork.escalasPainel.abrirAba(estagiario ? 'estagiarios' : visao === 'militares' ? 'militares' : 'distribuicao');
  }
  /* o menu abre depois do clique que o pediu: o clique no item ainda chega ao document, e o geral-dropdown fecharia o
     menu recém-aberto */
  function abrirMenuPedido() {
    var cpf = ctx.abrirMenuDe, corpo = ctx.corpo, acao = ctx.fazerAcao, adicionar = ctx.adicionar;
    ctx.abrirMenuDe = null;
    ctx.fazerAcao = null;
    ctx.adicionar = null;
    /* o dia vazio da grade dos estagiários: o Adicionar estagiário, já com ele (quem administra) */
    if (adicionar && ctx.admin && RosterWork.escalasPainelAdicionar) {
      setTimeout(function () { RosterWork.escalasPainelAdicionar.abrir({ cpf: adicionar, estagiario: true }); }, 0);
      return;
    }
    if (!cpf || !RosterWork.escalasPainelLinhaMenu) return;
    setTimeout(function () {
      var linha = corpo.querySelector('.escala-edicao-linha--menu[data-cpf="' + cpf + '"]');
      if (!linha) return;
      /* o item pedido pela célula da grade (o Devolver, o Remover deste dia e o que não cabe na caixa): a sub-tela dele, já
         com ele */
      if (acao) RosterWork.escalasPainelLinhaMenu.fazer(linha, acao);
      else RosterWork.escalasPainelLinhaMenu.abrir(linha);
    }, 0);
  }

  /* ---------- o fim do dia: quem já mexeu no dia (as Alterações manuais, relidas depois de salvar), o último bloco do
     corpo do painel (o painel não tem rodapé próprio; o Salvar é o rodapé largo da página, escalas-painel-salvar.js).
     O bloco é lido uma vez e volta para o fim do corpo a cada redesenho da lista ---------- */

  function mostrarHistorico() {
    if (!ctx || ctx.emSub || !ctx.rodape) return;   // sem rodapé (a prévia "Como fica a escala"), sem histórico
    if (!ctx.comHistorico || !ctx.historico) {
      ctx.comHistorico = true;
      ctx.historico = RosterWork.tpl('tpl-escala-painel-historico');
      var vale = function () { return !!ctx && ctx.comHistorico && !ctx.emSub; };
      if (ctx.historico) pecas().alteracoes(ctx.historico, ctx.unidadeId, ctx.iso, vale);
    }
    if (ctx.historico) ctx.corpo.appendChild(ctx.historico);
  }

  /* lê o dia de novo e zera o desfazer/refazer */
  function recarregar() {
    if (!ctx) return;
    montar(ctx.corpo, ctx.rodape, ctx.unidadeId, ctx.iso, { admin: ctx.admin, semLista: ctx.semLista, aoMostrar: ctx.aoMostrar });
  }

  /* ---------- sub-telas (Adicionar militar, Remover do dia, Mudar de unidade neste dia e a folga no dia) ---------- */

  /* troca a lista por uma sub-tela: "Voltar ao dia" no topo e, embaixo, só o rodapé largo da página (Cancelar e
     Salvar). montar(corpo) desenha o conteúdo; cada resposta põe a mudança no rascunho ao vivo (aoVivo) */
  function abrirSub(montarConteudo) {
    if (!ctx || !rasc || !ctx.admin || ctx.salvando) return;
    fecharLinha('guardar');
    comecarVivo();
    ctx.emSub = true;
    ctx.comHistorico = false;
    ctx.acaoPropria = null;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    montarSubcabecalho();
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var voltar = RosterWork.tpl('tpl-escala-sub-voltar');
    if (voltar) { voltar.addEventListener('click', concluirSub); corpo.appendChild(voltar); }
    if (ctx.rodape) { ctx.rodape.textContent = ''; ctx.rodape.classList.add('oculto'); }
    montarConteudo(corpo);
    avisarRascunho();
  }
  /* o rodapé próprio da sub-tela, só para o que grava na hora (o Remover › por troca): Cancelar (volta ao dia) e o
     botão que diz o que faz; enquanto ele aparece, o rodapé largo some. texto vazio: some */
  function rodapeProprio(texto, ligado, aoClicar) {
    var rodape = ctx && ctx.rodape;
    if (!rodape) return;
    if (!texto) { ctx.acaoPropria = null; rodape.textContent = ''; rodape.classList.add('oculto'); return; }
    ctx.acaoPropria = aoClicar || null;
    var b = rodape.querySelector('.escala-sub-aplicar');
    if (!b) {
      rodape.textContent = '';
      var tpl = document.getElementById('tpl-escala-sub-acoes');
      if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
      var cancelar = rodape.querySelector('.escala-sub-cancelar');
      b = rodape.querySelector('.escala-sub-aplicar');
      if (cancelar) cancelar.addEventListener('click', concluirSub);
      if (b) b.addEventListener('click', function () { if (ctx && ctx.acaoPropria) ctx.acaoPropria(); });
    }
    if (b) { b.textContent = texto; b.disabled = !ligado; }
    rodape.classList.remove('oculto');
  }
  /* Voltar ao dia: o que foi respondido fica no rascunho, como um passo do desfazer, e a lista mostra como fica */
  function concluirSub() { if (!ctx || ctx.salvando) return; terminarVivo(); desenhar(); }

  /* o Imprimir do subcabeçalho (escalas-impressao.js): o formulário de impressão no lugar da lista, marcado com o dia e a
     unidade; o Voltar ao dia, o Cancelar e o fim do Gerar PDF voltam à lista. O rascunho não muda (com mudança, o botão
     fica desligado) */
  function abrirImpressao() {
    if (!ctx || !base || ctx.salvando || ctx.carregando || !RosterWork.escalasImpressao) return;
    fecharLinha('guardar');
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    pedido++;   // a lista que ainda carregava não desenha por cima
    ctx.emSub = true;
    ctx.comHistorico = false;
    montarSubcabecalho();
    var c = ctx;
    RosterWork.escalasImpressao.abrirNoDia(ctx.corpo, ctx.rodape, {
      unidadeId: ctx.unidadeId, iso: ctx.iso,
      aoSair: function () { if (ctx === c) desenhar(); }
    });
  }

  /* o Como a escala foi feita (escalas-painel-como.js): o texto no lugar da lista, com o Voltar ao dia, como o Imprimir */
  function abrirComo() {
    if (!ctx || ctx.salvando || ctx.carregando || !RosterWork.escalasPainelComo) return;
    fecharLinha('guardar');
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    pedido++;   // a lista que ainda carregava não desenha por cima
    ctx.emSub = true;
    ctx.comHistorico = false;
    montarSubcabecalho();
    var c = ctx;
    RosterWork.escalasPainelComo.abrirNoDia(ctx.corpo, ctx.rodape, {
      unidadeId: ctx.unidadeId, iso: ctx.iso,
      aoSair: function () { if (ctx === c) desenhar(); }
    });
  }

  /* o Solicitar troca e o Registrar troca de serviço (escalas-painel-troca.js): o formulário da troca no lugar da lista,
     com o Voltar ao dia e o calendário no mês do dia. O Registrar grava na hora, fora do rascunho, então com mudança não
     salva (Dia ou Ciclo) o aviso pede o Salvar antes (o lápis aberto guarda a mudança dele e a lista mostra como fica);
     registrou, volta ao dia e lê de novo (também depois do Desfazer do resumo, se o painel segue no dia). O pedido do
     Solicitar não muda a escala: abre com o rascunho, que fica. com = o militar do menu do nome (o Registrar troca de
     serviço dele: o formulário começa com ele e com o dia escolhido) */
  function abrirTroca(registrar, com) {
    if (!ctx || ctx.salvando || ctx.carregando || !RosterWork.escalasPainelTroca || (registrar && !base)) return;
    if (registrar && RosterWork.escalasPainelSalvar && RosterWork.escalasPainelSalvar.contar()) {
      fecharLinha();
      RosterWork.avisar({ tipo: 'aviso', mensagem: msg().registrarSalveAntes });
      return;
    }
    fecharLinha('guardar');
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    pedido++;
    ctx.emSub = true;
    ctx.comHistorico = false;
    montarSubcabecalho();
    var c = ctx, uid = ctx.unidadeId, iso = ctx.iso;
    RosterWork.escalasPainelTroca.abrir(ctx.corpo, ctx.rodape, {
      registrar: registrar, iso: iso, com: com || null,
      aoSair: function () { if (ctx === c) desenhar(); },
      aoRegistrar: function () { if (ctx && ctx.unidadeId === uid && ctx.iso === iso && !ctx.emSub) recarregar(); }
    });
  }

  /* o Mudar de unidade neste dia (escalas-painel-remanejar.js): uma sub-tela como as outras; opcoes = { fazer: 'trazer' }
     (o Trazer de outra unidade do Editar o dia) */
  function abrirRemanejar(opcoes) {
    if (!ctx || ctx.salvando || !base || !RosterWork.escalasPainelRemanejar) return;
    RosterWork.escalasPainelRemanejar.abrir(opcoes);
  }

  /* o atalho que a próxima gravação mostra na nota O que mudou (a edição da linha pede antes de mudar) */
  function sugerir(s) { if (ctx) ctx.sugestao = s || null; }

  /* ---------- ciclo de vida ---------- */

  /* opcoes = { admin, comparar, consulta, visao: 'funcoes' | 'militares', semLista, aoMostrar(dados) }: o admin edita o
     dia; os outros só leem. Sem rodape, o rodapé não é usado. semLista: o dia da célula (corpo nulo), sem a lista */
  function montar(corpo, rodape, unidadeId, iso, opcoes) {
    opcoes = opcoes || {};
    var visao = opcoes.visao === 'militares' || opcoes.visao === 'estagiarios' ? opcoes.visao : 'funcoes';
    /* a outra aba do mesmo dia (Funções e Militares): só a lista se refaz, com o dia que já está na tela; o rascunho e o
       desfazer ficam. Com a prévia para refazer (ou uma sub-tela aberta), o caminho de sempre */
    if (corpo && ctx && ctx.corpo === corpo && ctx.unidadeId === unidadeId && ctx.iso === iso && !ctx.comparar && !opcoes.comparar
        && ctx.admin === !!opcoes.admin && ctx.consulta === !!opcoes.consulta && base && ctx.dados) {
      ctx.visao = visao;
      if (opcoes.adicionar) ctx.adicionar = opcoes.adicionar;
      if (ctx.emSub || ctx.carregando || ctx.chaveDados !== JSON.stringify(paraPrevia())) { desenhar(); return; }
      montarSubcabecalho();
      renderLista(ctx.dados);
      return;
    }
    acenderLista();
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, admin: !!opcoes.admin,
      comparar: !!opcoes.comparar, consulta: !!opcoes.consulta, visao: visao,
      dados: null, dadosAntes: null, chaveDados: null, emSub: false, comHistorico: false, salvando: false,
      sugestao: null, ultima: null, abrirMenuDe: opcoes.abrirMenuDe || null, fazerAcao: opcoes.fazerAcao || null,
      adicionar: opcoes.adicionar || null,
      semLista: !!opcoes.semLista, aoMostrar: opcoes.aoMostrar || null };
    /* voltou de outra aba ao mesmo dia: o rascunho continua; outro dia: o de agora vai para a gaveta e o novo começa do
       que estava guardado nela ou do dia gravado (quem só lê, sempre do gravado) */
    var mesmo = !!(base && rasc && dono === unidadeId + '|' + iso && haMudanca());
    if (!(mesmo && ctx.admin && !ctx.comparar)) {
      guardarAgora();
      rasc = null; base = null; pilhaDesfazer = []; pilhaRefazer = []; dono = '';
      if (ctx.admin && !ctx.comparar) trazerGuardado(unidadeId + '|' + iso);
    }
    vivo = null;
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    desenhar();
  }

  /* outra aba abriu (ou o painel fechou): o Dia para de desenhar; o rascunho fica até o Salvar ou o descarte (o lápis e
     a sub-tela abertos guardam o que já foi respondido) */
  function reset() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    fecharLinha('guardar');
    terminarVivo();
    if (RosterWork.escalasPainelTroca) RosterWork.escalasPainelTroca.encerrar();
    acenderLista();
    ctx = null;
    pedido++;
  }

  /* ---------- o Salvar do rodapé (escalas-painel-salvar.js) ---------- */

  /* quantas mudanças o rascunho do dia tem (os passos, com a da sub-tela ou do lápis aberto; 0 = nada a salvar) */
  function pendentes() { return haMudanca() ? Math.max(1, pilhaDesfazer.length + (vivo && vivo.mudou ? 1 : 0)) : 0; }
  /* a sub-tela ou o lápis com pergunta pela metade ou conflito: o Salvar do rodapé fica desligado */
  function travado() { return !!(vivo && vivo.travado); }
  /* gravar este rascunho muda quem está de serviço no dia, e o banco refaz a distribuição? (pontual, folga, remanejamento,
     mudança de dia e o Voltar ao automático; trocar quem está numa função e escrever uma observação, não) */
  function refazDistribuicao() {
    if (!rasc || !base) return false;
    return !!rasc.automatico || difPontuais() > 0 || difOnde() > 0 || rasc.folgas.length > 0 || rasc.folgas_cancelar.length > 0
      || rasc.remanejar.length > 0 || rasc.devolver.length > 0 || comMudancaDeDia();
  }
  /* gravar este rascunho muda a escala do dia, e o banco refaz os dias seguintes? (o rodízio conta o que cada um fez no
     dia: as funções, além de tudo o que refaz a distribuição; escrever uma observação, não) */
  function refazDiasSeguintes() {
    if (!rasc || !base) return false;
    return !mesmosAjustes(base.ajustes, rasc.ajustes) || refazDistribuicao();
  }
  /* o rascunho do Dia para a prévia das telas: o da gravação e as funções abertas (só na prévia) */
  function previaDia() {
    var r = copiar(paraSalvar());
    if (rasc.abertas.length) r.abertas = copiar(rasc.abertas);
    /* o motivo do remanejamento não muda a escala: fica fora (escrever não refaz a prévia) */
    if (r.remanejar) r.remanejar.forEach(function (x) { delete x.motivo; });
    return r;
  }
  /* o que vai ao banco: o rascunho e o dia como a tela leu ("antes": se mudou depois, nada é gravado) */
  function paraGravar() {
    var r = copiar(paraSalvar());
    r.antes = antesDoDia();
    /* a frase da mudança de dia na nota O que mudou, depois de gravar (só a do dia na tela) */
    if (ctx && dono === ctx.unidadeId + '|' + ctx.iso) ctx.mudancasGravando = mapaMudancas();
    return r;
  }
  /* o dia como a tela leu (o banco confere se mudou e, no Salvar de vários dias, junta a camada manual sobre ele) */
  function antesDoDia() { return { ajustes: base.ajustes, pontuais: base.pontuais }; }
  /* gravou: o dia gravado vira a base, o rascunho e o desfazer recomeçam e a nota O que mudou vem do banco */
  function aposGravar(r) {
    fecharLinha('largar');
    vivo = null;
    pilhaDesfazer = []; pilhaRefazer = [];
    acenderLista();
    if (!ctx || !ctx.admin || ctx.comparar || !r || !r.dia) { base = null; rasc = null; dono = ''; return; }
    var antes = ctx.dados;
    aceitar(r.dia);
    ctx.dadosAntes = antes || r.dia;
    ctx.sugestao = null;
    ctx.ultima = (r.mudou || []).length ? { mudou: r.mudou, sugestao: null, mudancas: ctx.mudancasGravando || {} } : null;
    ctx.mudancasGravando = null;
    ctx.comHistorico = false;   // o fim do corpo relê o histórico, já com o que foi salvo
    ctx.emSub = false;
    ctx.carregando = false;
    if (ctx.semLista) { avisarCelula(r.dia); return; }
    /* gravou de dentro de uma sub-tela: ela sai, e a lista mostra o dia gravado */
    if (ctx.rodape) { ctx.rodape.textContent = ''; ctx.rodape.classList.add('oculto'); }
    montarSubcabecalho();
    renderLista(r.dia);
    avisarCelula(r.dia);   // a caixa da célula aberta no mesmo dia, sobre a lista do painel (sub.ouvir)
  }
  /* o Cancelar do rodapé, outro dia ou o dia mudou no banco: o rascunho sai; com o Dia aberto, ele lê o dia de novo */
  function descartar() {
    fecharLinha('largar');
    vivo = null;
    pilhaDesfazer = []; pilhaRefazer = [];
    base = null; rasc = null; dono = '';
    if (ctx && ctx.admin && !ctx.comparar) recarregar();
    avisarRascunho();
  }

  window.RosterWork.escalasPainelEditar = {
    montar: montar,
    reset: reset,
    /* o Salvar do rodapé do painel (escalas-painel-salvar.js), com o Desfazer e o Refazer das Funções e da Militares */
    pendentes: pendentes,
    travado: travado,
    podeDesfazer: podeDesfazer,
    podeRefazer: podeRefazer,
    desfazer: desfazerPasso,
    refazer: refazerPasso,
    refazDistribuicao: refazDistribuicao,
    refazDiasSeguintes: refazDiasSeguintes,
    outrosDias: outrosDias,
    previaDia: previaDia,
    paraGravar: paraGravar,
    aposGravar: aposGravar,
    descartar: descartar,
    antesDoDia: antesDoDia,
    /* uma lista aberta numa sub-tela (o Desfazer do rodapé espera ela fechar) */
    emSub: function () { return !!ctx && !!ctx.emSub; },
    /* fn (paraGravar, previaDia, outrosDias, antesDoDia...) com o rascunho de um item da gaveta: o de agora ou um guardado */
    noDia: function (item, fn) { return item.vivo ? fn() : comEstado(item.estado, fn); },
    /* para a gaveta dos dias (escalas-rascunho-dias.js) */
    gaveta: {
      vivo: function () { return base && rasc && dono ? { chave: dono, unidadeId: donoUnidade(), iso: donoIso(), vivo: true } : null; },
      contar: function (item) { return item.vivo ? pendentes() : comEstado(item.estado, pendentes); },
      pode: function (item, desfazer) {
        if (!item.vivo) return (desfazer ? item.estado.pilhaDesfazer : item.estado.pilhaRefazer).length > 0;
        if (ctx && ctx.admin && !ctx.comparar) return desfazer ? podeDesfazer() : podeRefazer();
        return (desfazer ? pilhaDesfazer : pilhaRefazer).length > 0;
      },
      andar: function (item, desfazer) {
        if (!item.vivo) return andarEm(item.estado, desfazer);
        if (ctx && ctx.admin && !ctx.comparar) {
          if (desfazer) desfazerPasso(); else refazerPasso();
          return true;
        }
        var andou = andarAgora(desfazer);   // sem a lista na tela (outra aba aberta)
        avisarRascunho();
        return andou;
      },
      limparRefazer: function (item) { item.estado.pilhaRefazer = []; },
      soltar: function () {}
    },
    /* para a edição da linha (escalas-painel-linha.js: ao vivo, como as sub-telas), o Remover do dia (mudar põe a
       mudança no rascunho como um passo só) e as sub-telas (escalas-painel-adicionar.js, -remover.js, -remanejar.js,
       -mudar-dia.js e -militar.js: aoVivo a cada resposta) */
    sub: {
      /* dá para mexer no dia agora (fora da gravação; enquanto a lista refaz, ela não responde) */
      livre: function () { return !!ctx && !!rasc && ctx.admin && !ctx.comparar && !ctx.salvando; },
      /* o dia da célula (sem a lista) está aberto: { unidadeId, iso } ou null; carregando: a leitura ou a prévia ainda vem */
      celula: function () { return ctx && ctx.semLista ? { unidadeId: ctx.unidadeId, iso: ctx.iso } : null; },
      /* o dia aberto para editar, na célula ou na lista do painel: { unidadeId, iso, lista } ou null (quem só lê, o "Como
         fica" das decisões) */
      diaAberto: function () {
        return ctx && ctx.admin && !ctx.comparar && !ctx.consulta ? { unidadeId: ctx.unidadeId, iso: ctx.iso, lista: !ctx.semLista } : null;
      },
      /* a caixa da célula aberta no dia do painel recebe cada leitura dele (o dado ou null) */
      ouvir: function (fn) { if (ctx && !ctx.semLista) ctx.aoMostrar = fn; },
      /* a caixa da célula vai abrir no dia do painel: o lápis ou a sub-tela aberta nele fecha guardando o que foi respondido */
      fecharAbertos: function () {
        if (!ctx || ctx.semLista) return;
        if (ctx.emSub || vivo || (RosterWork.escalasPainelLinha && RosterWork.escalasPainelLinha.aberta())) desenhar();
      },
      carregando: function () { return !!ctx && !!ctx.carregando; },
      abrirLugar: abrirLugar,
      /* o Voltar o dia ao automático (o do Editar o dia e o do pelotão na célula): vale agora? e a confirmação */
      podeVoltarAoAutomatico: function () { return !!ctx && podeVoltarAoAutomatico(); },
      voltarAoAutomatico: voltarAoAutomatico,
      /* o Registrar troca de serviço do menu do nome: o formulário da troca, já com ele e com o dia */
      registrarTroca: function (cpf) {
        var mil = militarDoDia(cpf);
        abrirTroca(true, mil ? { cpf: cpf, grad: mil.grad, nome: mil.nome, unidade: mil.unidade || '', unidadeId: ctx.unidadeId } : null);
      },
      mudar: mudar,
      comecarVivo: comecarVivo,
      aoVivo: aoVivo,
      terminarVivo: terminarVivo,
      largarVivo: function () { vivo = null; },
      vivoMudou: function () { return !!(vivo && vivo.mudou); },
      redesenhar: desenhar,
      deixarFuncao: deixarFuncao,
      cortarAjustes: cortarAjustes,
      sugerir: sugerir,
      recarregar: recarregar,
      dados: function () { return ctx && ctx.dados; },
      iso: function () { return ctx && ctx.iso; },
      unidadeId: function () { return ctx && ctx.unidadeId; },
      rascunho: function () { return rasc; },
      abrir: abrirSub,
      rodapeProprio: rodapeProprio,
      concluir: concluirSub,
      aplicarColocacao: aplicarColocacao,
      aplicarMilitar: aplicarMilitar,
      darFolga: darFolga,
      cancelarFolga: cancelarFolga,
      remanejar: remanejar,
      devolverRemanejado: devolverRemanejado,
      largarRemanejado: largarRemanejado,
      mudarDia: mudarDia,
      mudancaNoRascunho: mudancaNoRascunho,
      largarMudancaDia: largarMudancaDia,
      desfazerMudanca: desfazerMudanca,
      tirarMudanca: tirarMudanca,
      postoFeminino: postoFeminino,
      tirarPontual: tirarPontual,
      pontualSalvo: pontualSalvo,
      pontualGravado: pontualGravado,
      funcoesDoMilitar: funcoesDoMilitar,
      militarDoDia: militarDoDia,
      acharFuncao: acharFuncao,
      acharPosto: acharPosto,
      papeis: papeis,
      funcaoNoPosto: funcaoNoPosto,
      /* a conferência do Mudar de unidade entrega a conta da outra unidade (outraUnidade(antes, depois, marcaDaPrevia())) */
      outraUnidade: outraUnidade,
      marcaDaPrevia: marcaDaPrevia,
      noLocal: noLocal,
      verMilitar: verMilitar,
      /* as peças da lista, para a aba Militares (escalas-painel-militares.js) */
      lista: { linhaMilitar: linhaMilitar, novoGrupo: novoGrupo, menuNaLinha: menuNaLinha, caixaFolgas: caixaFolgas, editavel: function () { return !!ctx && editavel(); } },
      horas: { emMin: emMin, faixa: faixa, hhmm: hhmm, periodo: periodo, curta: curta, cruza: cruza, menos: menos,
        uniao: uniao, regua: regua, opcoesHoras: opcoesHoras, horasTexto: horasTexto, textoPeriodos: textoPeriodos }
    }
  };
})();
