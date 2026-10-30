/* ============================================================
   ESCALAS — o Dia do painel (aba Dia): a lista do dia, a mesma
   para todos, só de leitura. O admin edita a partir dela: o menu
   Editar o dia (Adicionar e Remover militar, Editar extrajornada e
   Registrar troca de serviço, à esquerda) e o desfazer/refazer (à
   direita) ficam no subcabeçalho, cada linha de função e de horário
   sem ninguém tem o lápis, que abre a edição ali mesmo
   (escalas-painel-linha.js), quem está sem função tem o Remover do
   dia (escalas-painel-remover.js), quem o admin fixou ganha o selo
   Fixado e o Liberar para o sistema, quem está de folga tem o
   lápis da folga no dia (com o Cancelar folga), o fim da lista tem o
   Voltar o dia ao automático e as observações também se editam aqui.
   Quem não é admin só lê (os postos mudam na Distribuição).
   Cada mudança vai para o rascunho do dia, e a lista mostra o dia
   como vai ficar (a prévia, escala_previa, já com o Ciclo e a
   Extrajornada que esperam o Salvar), com a nota O que
   mudou no topo; o desfazer/refazer anda no rascunho. Nada grava até
   o Salvar do rodapé do painel (escalas-painel-salvar.js), que grava
   junto com o Ciclo e a Extrajornada. O rascunho fica ao trocar de
   aba (trocar de dia e fechar o painel perguntam antes). Rascunho:
   { ajustes, pontuais, estornar, folgas, folgas_cancelar,
   observacoes, abertas (as funções abertas sem ninguém, só na
   prévia: salvas vazias, somem), remanejar, devolver, automatico }.
   A edição da linha, o Adicionar e o Remover militar (sub-telas) e a
   folga no dia (sub-tela) ficam em escalas-painel-linha.js,
   -adicionar.js, -remover.js e -militar.js e usam a API daqui
   (.sub); o botão que confirma põe a mudança no rascunho.
   A aba Dia da Extrajornada usa o mesmo desenho,
   só de leitura, com o dia já lido (opções dados e semAvisos). O
   "Como fica a escala" do painel de decisão (Trocas e Folgas) também,
   no modo comparação (opção comparar): só leitura, com quem saiu
   riscado na função de onde saiu, quem entra pelo pedido com o "Novo"
   e quem o sistema remanejou só com a barra cinza (as marcas vêm do
   banco, pedido_escala_comparar).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;       // { corpo, rodape, unidadeId, iso, admin, comparar, dados, dadosAntes, chaveDados, emSub, comHistorico, salvando,
                        //   sugestao, ultima: { mudou, sugestao } (a nota O que mudou da última gravação) }
  var base = null;      // o dia gravado (a última leitura): { dados, ajustes, pontuais }
  var rasc = null;      // a mudança em andamento, sobre o dia gravado
  var foto = null;      // rascunho ao abrir uma sub-tela (o Cancelar volta a ele)
  var pilhaDesfazer = [];  // os rascunhos de antes de cada mudança ainda não salva (o Desfazer volta um passo)
  var pilhaRefazer = [];   // os rascunhos desfeitos
  var dono = '';        // o dia do rascunho (unidade|dia): voltar de outra aba ao mesmo dia o encontra
  var pedido = 0;       // só a última leitura, prévia ou gravação pedida desenha

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa (o mais antigo do dia) */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }
  function pecas() { return (RosterWork.escalasPainel && RosterWork.escalasPainel.pecas) || {}; }
  function copiar(o) { return JSON.parse(JSON.stringify(o)); }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

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
  function funcaoNoPosto(funcao, posto) { return msg().funcaoNoPosto(funcao, posto.nome, postoFeminino(posto)); }

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

  /* o rascunho mudou o dia gravado? (funções, pontuais, folgas dadas ou canceladas, observações, remanejamentos, ou o
     Voltar ao automático) */
  function haMudanca() {
    if (!rasc || !base) return false;
    return !!rasc.automatico || !mesmosAjustes(base.ajustes, rasc.ajustes) || difPontuais() > 0 || rasc.folgas.length > 0
      || rasc.folgas_cancelar.length > 0 || rasc.observacoes.adicionar.length > 0 || rasc.observacoes.remover.length > 0
      || rasc.abertas.length > 0 || rasc.remanejar.length > 0 || rasc.devolver.length > 0;
  }

  /* o rascunho recomeça do dia gravado */
  function novoRascunho() {
    rasc = { ajustes: copiar(base.ajustes), pontuais: copiar(base.pontuais), estornar: [], folgas: [], folgas_cancelar: [],
      observacoes: { adicionar: [], remover: [] }, abertas: [], remanejar: [], devolver: [] };
  }

  /* o dia gravado (a leitura, ou o que o banco devolve ao gravar) vira a base */
  function aceitar(dados) {
    base = {
      dados: dados,
      ajustes: dados.ajustes_salvos || [],
      pontuais: (dados.pontuais || []).map(function (x) { return { cpf: x.cpf, periodos: x.periodos || [] }; })
    };
    novoRascunho();
    if (!ctx) return;
    dono = ctx.unidadeId + '|' + ctx.iso;
    ctx.dados = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
  }

  /* o que vai à prévia (o dia como vai ficar; as observações não mudam a escala) */
  function paraPrevia() {
    var r = { ajustes: rasc.ajustes, folgas: rasc.folgas };
    if (difPontuais() > 0) r.pontuais = rasc.pontuais;
    if (rasc.folgas_cancelar.length) r.folgas_cancelar = rasc.folgas_cancelar;
    if (rasc.abertas.length) r.abertas = rasc.abertas;
    if (rasc.remanejar.length) r.remanejar = rasc.remanejar;
    if (rasc.devolver.length) r.devolver = rasc.devolver;
    if (rasc.automatico) r.automatico = true;
    return r;
  }
  /* o que vai ao banco no Salvar (no Voltar ao automático, o sistema distribui tudo de novo); as funções abertas não vão:
     a que ficou vazia some */
  function paraSalvar() {
    var r = paraPrevia();
    delete r.abertas;
    r.estornar = rasc.estornar;
    r.folgas_cancelar = rasc.folgas_cancelar;
    r.observacoes = rasc.observacoes;
    if (rasc.automatico) r.automatico = true;
    return r;
  }

  /* ---------- leitura da prévia ---------- */

  function acharPosto(vi, ii) {
    var lista = (ctx && ctx.dados && ctx.dados.postos) || [];
    for (var i = 0; i < lista.length; i++) {
      var po = lista[i];
      if ((po.tipo === 'viatura' && po.id === vi) || (po.tipo === 'instalacao' && po.id === ii)) return po;
    }
    return null;
  }
  function acharFuncao(posto, nomeFuncao) {
    var po = posto && acharPosto(vidPosto(posto), iidPosto(posto));
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
        (f.militares || []).forEach(function (m) { r[k].por[m.cpf] = { nome: nomeDe(m), periodos: m.periodos || [] }; });
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
     c = { cpf, posto, funcao, periodos, sistema, pontual: { contabilizar } | null } */
  function aplicarColocacao(c) {
    if (c.pontual) {
      rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== c.cpf; })
        .concat([{ cpf: c.cpf, periodos: c.periodos, contabilizar: !!c.pontual.contabilizar }]);
      rasc.estornar = rasc.estornar.filter(function (x) { return x !== c.cpf; });
    }
    if (c.sistema) return;
    var janelas = c.periodos.map(faixa);
    var alvo = acharFuncao(c.posto, c.funcao);
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
     serve em outra unidade no dia), a folga e o corte valem só nesses horários: o serviço de lá não muda */
  function darFolga(cpf, contabilizar, periodos) {
    rasc.folgas = rasc.folgas.filter(function (f) { return f.cpf !== cpf; });
    if (periodos && periodos.length) {
      periodos.forEach(function (p) { rasc.folgas.push({ cpf: cpf, hi: p.hi, hf: p.hf, contabilizar: !!contabilizar }); });
      cortarAjustes(cpf, periodos.map(faixa));
      return;
    }
    rasc.folgas.push({ cpf: cpf, hi: null, hf: null, contabilizar: !!contabilizar });
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

  /* Remanejar (só no dia): o serviço do dia dele vai para outra unidade da companhia; fica = continua também aqui.
     Quem sai daqui perde as colocações manuais daqui */
  function remanejar(cpf, destino, fica) {
    rasc.remanejar = rasc.remanejar.filter(function (r) { return r.cpf !== cpf; })
      .concat([{ cpf: cpf, destino: Number(destino), fica: !!fica }]);
    if (!fica) cortarAjustesDaUnidade(cpf, true);
  }

  /* Devolver (o Remover do remanejado): ele volta só para a unidade de origem. O remanejamento ainda não salvo sai do
     rascunho; o gravado vai no devolver. As colocações manuais dele na unidade de destino saem (no painel do destino, as
     daqui; no da origem, as das outras) */
  function devolverRemanejado(cpf) {
    var mil = militarDoDia(cpf);
    var pendente = rasc.remanejar.some(function (r) { return r.cpf === cpf; });
    rasc.remanejar = rasc.remanejar.filter(function (r) { return r.cpf !== cpf; });
    if (!pendente && rasc.devolver.indexOf(cpf) < 0) rasc.devolver.push(cpf);
    var daqui = !!(mil && mil.remanejado && String(mil.remanejado.de) === String(ctx.unidadeId));
    cortarAjustesDaUnidade(cpf, !daqui);
  }

  /* Tirar do dia o remanejado: a folga desfaz o remanejamento gravado (no banco), então o rascunho só larga o que tinha
     dele (o remanejar ainda não salvo e o devolver) */
  function largarRemanejado(cpf) {
    rasc.remanejar = rasc.remanejar.filter(function (r) { return r.cpf !== cpf; });
    rasc.devolver = rasc.devolver.filter(function (x) { return x !== cpf; });
  }

  function pontualSalvo(cpf) { return (base.pontuais || []).some(function (x) { return x.cpf === cpf; }); }

  /* uma mudança (na lista ou numa sub-tela): o rascunho de antes entra no desfazer, o refazer zera, e a lista mostra a
     prévia; nada grava até o Salvar do rodapé */
  function passo(antes) { pilhaDesfazer.push(antes); pilhaRefazer = []; }
  function mudar(fn) { if (!rasc) return; passo(copiar(rasc)); fn(); desenhar(); }

  /* ---------- prévia e gravação ---------- */

  function mostrarCarregando() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (no) ctx.corpo.appendChild(no);
    /* enquanto a prévia carrega, o Aplicar da sub-tela fica desligado */
    var b = ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar');
    if (b) b.disabled = true;
  }
  function mostrarFalha() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (no) { no.textContent = msg().falhaCarregar; ctx.corpo.appendChild(no); }
  }

  /* (re)desenha a lista do dia: com mudança no rascunho, o dia como vai ficar (a prévia); sem mudança, o dia gravado.
     A 1ª vez lê o dia */
  function desenhar() {
    if (!ctx) return;
    ctx.emSub = false;
    foto = null;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (base) {
      montarSubcabecalho();
      avisarRascunho();
      /* com mudança em qualquer aba, o dia como vai ficar; sem nenhuma, o dia gravado */
      if (RosterWork.escalasPainelSalvar && RosterWork.escalasPainelSalvar.paraPrevia()) { mostrarPrevia(); return; }
      exibir(base.dados);
      return;
    }
    montarSubcabecalho();
    /* dados já prontos (ex.: o dia com os extras, na Extrajornada): desenha na hora, sem ler o banco */
    if (ctx.dadosProntos) { comecar(ctx.dadosProntos); return; }
    mostrarCarregando();
    var meu = ++pedido, c = ctx;
    RosterWork.escalasDados.lerDistribuicaoDia(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      if (!dados) { mostrarFalha(); return; }
      comecar(dados);
    });
  }

  /* o dia lido: vira a base e desenha */
  function comecar(dados) {
    aceitar(dados);
    ctx.dadosAntes = dados;
    /* com mudança esperando o Salvar em outra aba (o Ciclo, a Extrajornada), o dia já como vai ficar */
    if (editavel() && RosterWork.escalasPainelSalvar && RosterWork.escalasPainelSalvar.paraPrevia()) { mostrarPrevia(); return; }
    renderLista(dados);
  }

  /* o rodapé do painel (escalas-painel-salvar.js) conta as mudanças das três abas */
  function avisarRascunho() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'dia' } })); }

  /* o dia como vai ficar com os rascunhos das três abas (escala_previa: o Salvar num ensaio, nada é gravado). A mudança
     do Dia que a gravação recusaria (ex.: efetivo acima do máximo, a folga recusada) dá o aviso, e o rascunho do Dia volta
     um passo; a recusa do Ciclo ou da Extrajornada só avisa (desmarca-se lá) */
  function mostrarPrevia() {
    var c = ctx, meu = ++pedido;
    mostrarCarregando();
    var pedidoPrevia = RosterWork.escalasDados.lerPrevia('ler_distribuicao_dia', {});
    if (!pedidoPrevia) { exibir(base.dados); return; }
    pedidoPrevia.then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      if (!dados) { mostrarFalha(); return; }
      if (dados.erro_simulacao) {
        RosterWork.avisar({ tipo: 'erro', mensagem: dados.erro_simulacao });
        if (dados.erro_parte === 'dia' && pilhaDesfazer.length) { rasc = pilhaDesfazer.pop(); desenhar(); return; }
      }
      exibir(dados);
    });
  }

  /* desenha o dia (o gravado ou a prévia); a nota O que mudou compara com o que estava na tela */
  function exibir(dados) {
    var antes = ctx.dados, sugestao = ctx.sugestao || null;
    ctx.sugestao = null;
    ctx.ultima = null;
    if (antes && antes !== dados) {
      var mudou = diferenca(antes, dados);
      if (mudou.length || sugestao) ctx.ultima = { mudou: mudou, sugestao: sugestao };
    }
    ctx.dadosAntes = antes || dados;   // o aviso de quem assume o Chefe de Socorro compara com o dia antes desta mudança
    ctx.dados = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
    renderLista(dados);
  }

  /* as funções e os horários de cada militar desta unidade numa leitura do dia (quem está sem função entra sem nada) */
  function lugaresPorMilitar(dados) {
    var r = {};
    ((dados && dados.postos) || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          var x = r[m.cpf] = r[m.cpf] || { nome: nomeDe(m), lista: [] };
          (m.periodos || []).forEach(function (pr) { x.lista.push({ funcao: f.nome, posto: po.nome, hi: pr.hi, hf: pr.hf }); });
        });
      });
    });
    ((dados && dados.sem_funcao) || []).forEach(function (m) { r[m.cpf] = r[m.cpf] || { nome: nomeDe(m), lista: [] }; });
    return r;
  }
  /* quem mudou de função ou de horário entre duas leituras: [{ cpf, nome, antes:[{funcao, posto, hi, hf}], depois }] */
  function diferenca(antes, depois) {
    var a = lugaresPorMilitar(antes), d = lugaresPorMilitar(depois), cpfs = {};
    Object.keys(a).concat(Object.keys(d)).forEach(function (k) { cpfs[k] = true; });
    function marca(l) { return l.map(function (x) { return [x.funcao, x.posto, x.hi, x.hf].join('|'); }).sort().join(';'); }
    return Object.keys(cpfs).map(function (cpf) {
      var x = a[cpf] || { lista: [] }, y = d[cpf] || { lista: [] };
      return { cpf: cpf, nome: y.nome || x.nome || '', antes: x.lista, depois: y.lista };
    }).filter(function (m) { return marca(m.antes) !== marca(m.depois); });
  }

  function podeDesfazer() { return !!ctx && ctx.admin && !ctx.emSub && !!base && pilhaDesfazer.length > 0; }
  function podeRefazer() { return !!ctx && ctx.admin && !ctx.emSub && !!base && pilhaRefazer.length > 0; }

  /* desfazer: o rascunho volta um passo (nada foi gravado) */
  function desfazerPasso() {
    if (!podeDesfazer()) return;
    pilhaRefazer.push(copiar(rasc));
    rasc = pilhaDesfazer.pop();
    desenhar();
  }

  /* refazer: o passo desfeito volta ao rascunho */
  function refazerPasso() {
    if (!podeRefazer()) return;
    pilhaDesfazer.push(copiar(rasc));
    rasc = pilhaRefazer.pop();
    desenhar();
  }

  /* subcabeçalho do Dia (só o admin, só na lista): o Adicionar militar e, à direita, o desfazer/refazer.
     Enquanto grava, os botões ficam desligados */
  function montarSubcabecalho() {
    var sub = RosterWork.painel.subcabecalho();
    if (!sub) return;
    sub.textContent = '';
    if (!ctx.admin || ctx.emSub) { sub.classList.add('oculto'); return; }
    /* o menu Editar o dia: Adicionar, Remover e Remanejar abrem as perguntas; Editar extrajornada vai à aba Extrajornada
       do painel; Registrar troca de serviço leva ao Registrar troca das Trocas */
    var menu = RosterWork.tpl('tpl-escala-edicao-acoes');
    if (menu) {
      menu.querySelector('.botao').disabled = !!ctx.salvando;
      var acoes = {
        adicionar: function () { if (RosterWork.escalasPainelAdicionar) RosterWork.escalasPainelAdicionar.abrir(); },
        remover: function () { if (RosterWork.escalasPainelRemover) RosterWork.escalasPainelRemover.abrir(); },
        remanejar: function () { if (RosterWork.escalasPainelRemanejar) RosterWork.escalasPainelRemanejar.abrir(); },
        extra: function () { if (RosterWork.escalasPainel.irParaSecao) RosterWork.escalasPainel.irParaSecao('extra'); },
        troca: function () { if (RosterWork.irParaPagina) RosterWork.irParaPagina('trocas', null, 'registrar'); }
      };
      [].forEach.call(menu.querySelectorAll('[data-acao]'), function (b) {
        b.addEventListener('click', function () { if (ctx && !ctx.salvando) acoes[b.getAttribute('data-acao')](); });
      });
      sub.appendChild(menu);
    }
    var hist = RosterWork.tpl('tpl-escala-edicao-historico');
    if (hist) {
      var bDesfazer = hist.querySelector('.escala-edicao-historico-desfazer');
      var bRefazer = hist.querySelector('.escala-edicao-historico-refazer');
      bDesfazer.disabled = !podeDesfazer();
      bRefazer.disabled = !podeRefazer();
      bDesfazer.addEventListener('click', desfazerPasso);
      bRefazer.addEventListener('click', refazerPasso);
      sub.appendChild(hist);
    }
    sub.classList.remove('oculto');
  }

  /* ---------- lista do dia ---------- */

  function botao(idTpl, aoClicar) {
    var b = RosterWork.tpl(idTpl);
    if (b) b.addEventListener('click', function (ev) { ev.stopPropagation(); aoClicar(); });
    return b;
  }

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

  /* uma linha do dia: militar · horário · ações (a função fica no bloco dela).
     op = { ghost, folga, icone, novo, alterada, acoes }: novo = o selo "Novo" e a barra cinza; alterada = só a barra */
  function linhaMilitar(m, op) {
    op = op || {};
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    var ic = RosterWork.tpl('tpl-escala-mes-origem');
    if (ic) { p.definirIcone(ic, op.icone || p.iconeOrigem[m.origem] || p.iconeOrigem.sistema); icones.appendChild(ic); }
    /* a colocação manual: para o admin, o selo Fixado depois do nome; para quem só lê, o cadeado (na linha com
       "Novo" ele sai para caber) */
    if (m.fixado && !op.novo && !ctx.admin) {
      var cad = RosterWork.tpl('tpl-escala-mes-origem');
      if (cad) { p.definirIcone(cad, 'icone-cadeado'); icones.appendChild(cad); }
    }
    if (!op.ghost && !op.folga) { p.marcarRegras(linha, m); p.marcarOutraUnidade(linha, m); }
    linha.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (m.fixado && !op.novo && ctx.admin) {
      var fixado = RosterWork.tpl('tpl-escala-edicao-fixado');
      if (fixado) linha.querySelector('.escala-edicao-pessoa').appendChild(fixado);
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
    var acoes = linha.querySelector('.escala-edicao-acoes');
    if (acoes) (op.acoes || []).forEach(function (b) { if (b) acoes.appendChild(b); });
    return linha;
  }

  /* a lista edita só no Dia do admin (não na prévia da Extrajornada nem na comparação) */
  function editavel() { return ctx.admin && !ctx.comparar && !ctx.dadosProntos; }

  /* o lápis da linha: abre a edição num cartão que engloba a linha (escalas-painel-linha.js). cfg sem grupo e lapis */
  function lapisDaLinha(ancora, cfg) {
    if (!editavel() || !RosterWork.escalasPainelLinha) return null;
    var b = RosterWork.tpl('tpl-escala-edicao-lapis');
    if (!b) return null;
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!ctx || ctx.salvando) return;
      cfg.grupo = ancora();
      cfg.lapis = b;
      RosterWork.escalasPainelLinha.abrir(cfg);
    });
    return b;
  }

  /* Liberar para o sistema: na linha fixada e no vazio que veio do "Ninguém"; faz na hora, com o Desfazer */
  function liberarDaLinha(cfg) {
    var A = RosterWork.escalasPainelLinhaAplicar;
    if (!editavel() || !A || !A.podeLiberar(cfg)) return null;
    return botao('tpl-escala-edicao-liberar', function () { if (ctx && !ctx.salvando) mudar(function () { A.liberar(cfg); }); });
  }

  /* horário sem ninguém na função (dentro do que o modelo pede) ou cadeira vazia do motor: o texto vermelho e,
     para o admin, o lápis (quem fica ali). A função aberta sem ninguém (Funções do posto): "Vazio", em cinza */
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
    var h = p.hora(per);
    if (h) linha.querySelector('.escala-distribuicao-horas').appendChild(h);
    var cfg = { tipo: 'vaga', posto: posto, funcao: nomeFuncao, militar: null, periodos: [{ hi: per.hi, hf: per.hf }] };
    var acoes = linha.querySelector('.escala-edicao-acoes');
    if (acoes) [lapisDaLinha(ancora, cfg), liberarDaLinha(cfg)].forEach(function (b) { if (b) acoes.appendChild(b); });
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
     (na comparação, também quem saiu, riscado). O lápis de cada linha abre a edição embaixo do bloco; no Chefe de
     Socorro com o Condutor (o mesmo militar), a edição é a do Condutor; o Chefe de Socorro e o Oficial de Área
     sozinhos não têm lápis (são sempre do mais antigo do dia) */
  function linhasFuncao(caixa, posto, f) {
    var p = pecas();
    var aberta = f.vazio_motivo === 'aberta';
    var temVao = (!!f.vazio && !aberta) || (f.vao || []).length > 0;
    var rotulos = (f.nomes && f.nomes.length) ? f.nomes : [f.nome];
    var grupo = novoGrupo(rotulos, temVao ? 'erro' : p.nivelFuncao(f));
    if (!grupo) return;
    function ancora() { return grupo.el; }
    function por(linha) { if (linha) grupo.linhas.appendChild(linha); }
    var sobrepostos = cpfsSobrepostos(f);
    var condutor = rotulos.length > 1 ? rotulos[1] : null;
    (f.militares || []).forEach(function (m) {
      var cfg = { tipo: 'funcao', posto: posto, funcao: f.nome, militar: m, periodos: m.periodos || [] };
      if (condutor) {
        var fc = acharFuncao(posto, condutor);
        var mc = ((fc && fc.militares) || []).filter(function (o) { return o.cpf === m.cpf; })[0] || m;
        cfg = { tipo: 'funcao', posto: posto, funcao: condutor, rotulo: rotulos.join(' e '), militar: mc, periodos: mc.periodos || [] };
      } else if (BLOQUEADAS.test(f.nome)) {
        cfg.tipo = 'papel';
      }
      /* na comparação, as marcas vêm do banco ("Novo" = quem entra pelo pedido; só a barra = quem o
         sistema remanejou); na edição não há marca, porque cada mudança já está gravada */
      var acoes = cfg.tipo === 'papel' ? [] : [lapisDaLinha(ancora, cfg), liberarDaLinha(cfg)];
      var linha = linhaMilitar(m, { novo: !!(ctx.comparar && m.novo), alterada: ctx.comparar && !!m.mudou, acoes: acoes });
      if (linha && (sobrepostos[m.cpf] || (m.periodos || []).some(function (per) { return foraDaDisponibilidade(per, m); }))) {
        linha.classList.add('escala-edicao-linha--erro');
      }
      por(linha);
    });
    /* riscados: na comparação, quem saiu */
    if (ctx.comparar) (f.ghosts || []).forEach(function (g) { por(linhaMilitar(g, { ghost: true })); });
    if (f.vazio) por(linhaVazia(posto, f.nome, { hi: '08:00', hf: '08:00' }, ancora, aberta));
    (f.vao || []).forEach(function (v) { por(linhaVazia(posto, f.nome, v, ancora)); });
    if (grupo.linhas.children.length) caixa.appendChild(grupo.el);
  }

  /* o título do posto: para quem edita o dia, a linha com o ícone Funções do posto (escalas-painel-funcoes.js); na troca
     de viatura com data, embaixo vem "No lugar da ... até ..." */
  function montarTituloPosto(caixa, posto) {
    var ancora = caixa.querySelector('.rotulo-secao');
    var F = editavel() && RosterWork.escalasPainelFuncoes;
    if (F) {
      var menu = F.titulo(caixa, posto, mudarFuncao);
      if (menu) {
        ancora = caixa.querySelector('.escala-posto-titulo');
        /* depois da mudança do menu (a prévia), ele volta aberto no mesmo posto */
        if (ctx.funcoesMenu === posto.tipo + ':' + posto.id) ctx.reabrirMenu = menu;
      }
    }
    var noLugar = pecas().noLugar ? pecas().noLugar(posto) : null;
    if (noLugar && ancora) ancora.insertAdjacentElement('afterend', noLugar);
  }

  /* o clique numa caixa do menu Funções do posto: abre a função sem ninguém ou fecha a aberta, no rascunho (com o
     Desfazer); salva vazia, a função some */
  function mudarFuncao(posto, mudanca) {
    if (!ctx || ctx.salvando) return;
    ctx.funcoesMenu = posto.tipo + ':' + posto.id;
    mudar(function () {
      var alvo = { viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto), nome_funcao: mudanca.abrir || mudanca.fechar };
      rasc.abertas = rasc.abertas.filter(function (a) {
        return !(a.nome_funcao === alvo.nome_funcao && a.viatura_id === alvo.viatura_id && a.instalacao_id === alvo.instalacao_id);
      });
      if (mudanca.abrir) rasc.abertas.push(alvo);
    });
  }

  function caixaPosto(posto) {
    var p = pecas();
    /* posto sem nenhuma função no dia (a reserva sem ninguém, o que fica fora da escala): só quem edita o dia vê, numa
       linha só, com o ícone Funções do posto; o Adicionar militar também chega nele pelo Onde */
    if (!(posto.funcoes || []).length && !editavel()) return null;
    var caixa = RosterWork.painel.criarCaixa(posto.nome);
    if (!caixa) return null;
    montarTituloPosto(caixa, posto);
    /* o posto sem ninguém fica sem cor (o que falta nele vai no aviso do topo do dia) */
    if (!(posto.funcoes || []).length) return caixa;
    /* o vermelho (cadeira vazia ou horário sem ninguém) vence o amarelo; a função aberta sem ninguém não é erro */
    var np = p.nivelPosto(posto);
    if (np !== 'erro' && (posto.funcoes || []).some(function (f) {
      return (f.vazio && f.vazio_motivo !== 'aberta') || (f.vao || []).length;
    })) np = 'erro';
    if (np) caixa.classList.add('grupo-caixa--posto-' + np);
    p.mesclarFuncoes(posto).forEach(function (f) { linhasFuncao(caixa, posto, f); });
    return caixa;
  }

  /* Sem função: quem está de serviço sem função em algum horário (título vermelho, depois dos postos). Para o admin,
     o Remover do dia (escalas-painel-remover.js); para pô-lo numa função, o lápis da função */
  function caixaSemFuncao(sem) {
    if (!sem.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().semFuncaoRotulo);
    if (!caixa) return null;
    caixa.classList.add('grupo-caixa--posto-erro');
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    sem.forEach(function (m) {
      var l = null;
      var remover = editavel() && RosterWork.escalasPainelRemover
        ? botao('tpl-escala-edicao-remover', function () { if (ctx && !ctx.salvando && l) RosterWork.escalasPainelRemover.doDia(m, l); })
        : null;
      l = linhaMilitar(m, { acoes: [remover] });
      if (l) grupo.linhas.appendChild(l);
    });
    caixa.appendChild(grupo.el);
    return caixa;
  }

  /* De folga: nome riscado, ícone de folga e o período; para o admin, o lápis abre a folga no dia */
  function caixaFolgas(folgas) {
    if (!folgas.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().deFolga);
    if (!caixa) return null;
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    folgas.forEach(function (f) {
      var acoes = ctx.admin && f.lancamento_id ? [botao('tpl-escala-edicao-lapis', function () { abrirFolga(f.lancamento_id); })] : [];
      var linha = linhaMilitar({ cpf: f.cpf, grad: f.grad, nome: f.nome, periodos: [{ hi: f.hi, hf: f.hf }] },
        { folga: true, icone: 'icone-folgas', acoes: acoes });
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
    var C = RosterWork.escalasPainelCiclo, R = RosterWork.escalasExtraRascunho;
    return haMudanca() || !!(C && C.doDia(ctx.unidadeId, ctx.iso).length) || !!(R && R.doDia(ctx.iso).length);
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

  /* "Condutor da ABT-01" (o posto pelo nome, na leitura do dia) */
  function lugarTexto(x) {
    var po = ((ctx.dados && ctx.dados.postos) || []).filter(function (o) { return o.nome === x.posto; })[0];
    return po ? funcaoNoPosto(x.funcao, po) : [x.funcao, x.posto].filter(Boolean).join(' ');
  }

  /* O que mudou na última gravação: uma frase por militar que mudou de lugar e, quando a troca deixou alguém sem
     função, o atalho de pô-lo no lugar que o outro deixou */
  function notaMudou(corpo) {
    var u = ctx.ultima;
    if (!u) return;
    var nota = RosterWork.tpl('tpl-escala-edicao-mudou');
    if (!nota) return;
    var L = msg().linha, lista = nota.querySelector('.escala-edicao-mudou-lista');
    var semFuncao = {};
    ((ctx.dados && ctx.dados.sem_funcao) || []).forEach(function (m) { semFuncao[m.cpf] = true; });
    /* cada lugar com as horas juntas (o dia cortado em trechos repete a mesma função): { "Condutor da ABT-01": [[ini, fim]] } */
    function porLugar(lista) {
      var r = {};
      lista.forEach(function (x) { var k = lugarTexto(x); r[k] = (r[k] || []).concat([faixa(x)]); });
      Object.keys(r).forEach(function (k) { r[k] = uniao(r[k]); });
      return r;
    }
    u.mudou.forEach(function (x) {
      var a = porLugar(x.antes || []), d = porLugar(x.depois || []);
      var antes = Object.keys(a), depois = Object.keys(d);
      var mesmos = antes.length === depois.length && antes.every(function (k) { return d[k]; });
      if (mesmos && antes.every(function (k) { return JSON.stringify(a[k]) === JSON.stringify(d[k]); })) return;
      var horas = uniao([].concat.apply([], depois.map(function (k) { return d[k]; }))).map(periodo);
      /* só o que mudou: as funções que ele deixou e as que ganhou (as que continuam ficam de fora) */
      var deixou = antes.filter(function (k) { return !d[k]; }), ganhou = depois.filter(function (k) { return !a[k]; });
      var frase = !antes.length ? L.mudouEntrou(x.nome, depois)
        : !depois.length ? (semFuncao[x.cpf] ? L.mudouSemFuncao(x.nome, antes) : L.mudouSaiu(x.nome, antes))
        : mesmos ? L.mudouHorario(x.nome, textoPeriodos(horas))
        : !ganhou.length ? L.mudouDeixou(x.nome, deixou)
        : !deixou.length ? L.mudouGanhou(x.nome, ganhou)
        : L.mudouPassou(x.nome, deixou, ganhou);
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

  /* Voltar o dia ao automático: confirma, tira os ajustes manuais da unidade e o sistema distribui tudo de novo */
  function botaoAutomatico() {
    if (!editavel() || !base || !ajustesDaUnidade(base.ajustes).length) return null;
    var b = RosterWork.tpl('tpl-escala-edicao-automatico');
    if (!b) return null;
    b.addEventListener('click', function () {
      if (!ctx || ctx.salvando) return;
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
    });
    return b;
  }

  function renderLista(dados) {
    var p = pecas();
    var corpo = ctx.corpo;
    if (RosterWork.escalasPainelLinha) RosterWork.escalasPainelLinha.fechar();
    corpo.textContent = '';
    p.anexarProblemas(dados);   // CNH, regra, exclusivo e grau de cada militar (do banco)
    if (editavel()) notaMudou(corpo);
    if (!ctx.semAvisos) {
      var aviso = p.montarAvisoProblemas(dados.problemas, dados.postos, dados.faltam_modelos, dados.modelos_com_erro);
      if (aviso) corpo.appendChild(aviso);
    }
    if (ctx.admin) notasPapeis(corpo, dados);
    var alguem = false;
    function por(caixa) { if (caixa) { corpo.appendChild(caixa); alguem = true; } }
    /* o posto sem ninguém (só para quem edita) entra na lista, mas não tira o "Sem distribuição" do dia vazio */
    ctx.reabrirMenu = null;
    (dados.postos || []).forEach(function (posto) {
      var caixa = caixaPosto(posto);
      if (caixa && !(posto.funcoes || []).length) corpo.appendChild(caixa);
      else por(caixa);
    });
    por(caixaSemFuncao(dados.sem_funcao || []));
    por(caixaFolgas(dados.folgas || []));
    /* dia sem ninguém: o estado vazio, nunca a tela em branco */
    if (!alguem) {
      var vazio = RosterWork.tpl('tpl-escala-distribuicao-estado');
      if (vazio) { vazio.textContent = msg().semDistribuicao; corpo.appendChild(vazio); }
    }
    var automatico = botaoAutomatico();
    if (automatico) corpo.appendChild(automatico);
    var obs = caixaObservacoes(dados);
    if (obs) corpo.appendChild(obs);
    /* Lançar no SYSBM: o último bloco do Dia gravado (não o de dados prontos, como a prévia da Extrajornada),
       para quem administra o pelotão (escalas-sysbm.js) */
    if (ctx.admin && !ctx.dadosProntos && !ctx.comparar && RosterWork.escalasSysbm) {
      RosterWork.escalasSysbm.montar(corpo, ctx.unidadeId, ctx.iso, { desligado: diaComMudanca() });
    }
    atualizarRodape();
    /* o menu Funções do posto que fez a mudança volta aberto */
    ctx.funcoesMenu = null;
    if (ctx.reabrirMenu && RosterWork.abrirDropdown) RosterWork.abrirDropdown(ctx.reabrirMenu);
    ctx.reabrirMenu = null;
  }

  /* ---------- rodapé do dia: quem já mexeu no dia (relido depois de salvar; o Salvar é o rodapé largo da página,
     escalas-painel-salvar.js) ---------- */

  function atualizarRodape() {
    if (!ctx || ctx.emSub || !ctx.rodape) return;
    var vale = function () { return !!ctx && ctx.comHistorico && !ctx.emSub; };
    var S = editavel() && RosterWork.escalasPainelSalvar;
    if (S) {
      if (ctx.comHistorico) return;
      ctx.comHistorico = true;
      var el = ctx.rodape, lugar = S.rodape(el, true);
      if (lugar) pecas().alteracoes(lugar, ctx.unidadeId, ctx.iso, vale, function () { S.historicoMudou(el); });
      return;
    }
    if (ctx.comHistorico) return;
    ctx.comHistorico = true;
    pecas().alteracoes(ctx.rodape, ctx.unidadeId, ctx.iso, vale);
  }

  /* lê o dia de novo e zera o desfazer/refazer */
  function recarregar() {
    if (!ctx) return;
    montar(ctx.corpo, ctx.rodape, ctx.unidadeId, ctx.iso, { admin: ctx.admin });
  }

  /* ---------- sub-telas (Adicionar militar e a folga no dia) ---------- */

  /* troca a lista por uma sub-tela: "Voltar ao dia" no topo e Cancelar · Aplicar no rodapé.
     montar(corpo) desenha o conteúdo; aoAplicar() faz a mudança e chama concluirSub(). Sem textoAplicar (a folga
     no dia, que grava pelo botão dela), a sub-tela fica sem rodapé e a saída é o Voltar ao dia */
  function abrirSub(textoAplicar, montarConteudo, aoAplicar) {
    if (!ctx || !rasc || !ctx.admin || ctx.salvando) return;
    if (!ctx.emSub) foto = copiar(rasc);   // de uma sub-tela para outra, a foto continua a do dia
    ctx.emSub = true;
    ctx.comHistorico = false;
    ctx.aplicarTravado = false;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    montarSubcabecalho();
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var voltar = RosterWork.tpl('tpl-escala-sub-voltar');
    if (voltar) { voltar.addEventListener('click', cancelarSub); corpo.appendChild(voltar); }
    montarConteudo(corpo);
    var rodape = ctx.rodape;
    if (!rodape) return;
    rodape.textContent = '';
    if (!textoAplicar) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-escala-sub-acoes');
    if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-sub-cancelar');
    var aplicar = rodape.querySelector('.escala-sub-aplicar');
    if (cancelar) cancelar.addEventListener('click', cancelarSub);
    if (aplicar) {
      aplicar.textContent = textoAplicar;
      aplicar.disabled = ctx.aplicarTravado;
      aplicar.addEventListener('click', function () { aoAplicar(); });
    }
  }
  /* a sub-tela desliga o botão de confirmar enquanto há conflito (ex.: horário que cruza o que o militar já tem) */
  function travarAplicar(travado) {
    if (!ctx) return;
    ctx.aplicarTravado = !!travado;
    var aplicar = ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar');
    if (aplicar) aplicar.disabled = ctx.aplicarTravado;
  }
  /* o texto do botão de confirmar muda com a escolha da sub-tela (ex.: Adicionar e Continuar) */
  function rotuloAplicar(texto) {
    var aplicar = ctx && ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar');
    if (aplicar) aplicar.textContent = texto;
  }
  /* Cancelar: volta ao rascunho de antes da sub-tela. Aplicar: a mudança fica no rascunho, como um passo do desfazer */
  function cancelarSub() {
    if (!ctx || ctx.salvando) return;
    if (foto) rasc = foto;
    else if (base) novoRascunho();
    desenhar();
  }
  function concluirSub() { if (!ctx) return; if (foto) passo(foto); desenhar(); }

  function abrirFolga(id) { if (RosterWork.escalasPainelMilitar) RosterWork.escalasPainelMilitar.abrirFolga(id); }

  /* o atalho que a próxima gravação mostra na nota O que mudou (a edição da linha pede antes de mudar) */
  function sugerir(s) { if (ctx) ctx.sugestao = s || null; }

  /* ---------- ciclo de vida ---------- */

  /* opcoes = { admin, dados, semAvisos }: o admin edita o dia; os outros só leem. dados = o dia já lido (não busca no banco); semAvisos = sem a
     lista de avisos do topo (a página tem a sua). Sem rodape, o rodapé não é usado */
  function montar(corpo, rodape, unidadeId, iso, opcoes) {
    opcoes = opcoes || {};
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, admin: !!opcoes.admin,
      comparar: !!opcoes.comparar,
      dadosProntos: opcoes.dados || null, semAvisos: !!opcoes.semAvisos,
      dados: null, dadosAntes: null, chaveDados: null, emSub: false, comHistorico: false, salvando: false,
      sugestao: null, ultima: null };
    /* voltou de outra aba ao mesmo dia: o rascunho continua; outro dia, ou quem só lê, começa do dia gravado */
    var mesmo = !!(base && rasc && dono === unidadeId + '|' + iso && haMudanca());
    if (!(mesmo && ctx.admin && !ctx.comparar && !ctx.dadosProntos)) {
      rasc = null; base = null; pilhaDesfazer = []; pilhaRefazer = []; dono = '';
    }
    foto = null;
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    desenhar();
  }

  /* outra aba abriu (ou o painel fechou): o Dia para de desenhar; o rascunho fica até o Salvar ou o descarte */
  function reset() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (RosterWork.escalasPainelLinha) RosterWork.escalasPainelLinha.fechar();
    ctx = null; foto = null;
    pedido++;
  }

  /* ---------- o Salvar do rodapé (escalas-painel-salvar.js) ---------- */

  /* quantas mudanças o rascunho do dia tem (os passos; 0 = nada a salvar) */
  function pendentes() { return haMudanca() ? Math.max(1, pilhaDesfazer.length) : 0; }
  /* o rascunho do Dia para a prévia das telas: o da gravação e as funções abertas (só na prévia) */
  function previaDia() {
    var r = copiar(paraSalvar());
    if (rasc.abertas.length) r.abertas = copiar(rasc.abertas);
    return r;
  }
  /* o que vai ao banco: o rascunho e o dia como a tela leu ("antes": se mudou depois, nada é gravado) */
  function paraGravar() {
    var r = copiar(paraSalvar());
    r.antes = { ajustes: base.ajustes, pontuais: base.pontuais };
    return r;
  }
  /* gravou: o dia gravado vira a base, o rascunho e o desfazer recomeçam e a nota O que mudou vem do banco */
  function aposGravar(r) {
    pilhaDesfazer = []; pilhaRefazer = [];
    if (!ctx || !ctx.admin || ctx.comparar || ctx.dadosProntos || !r || !r.dia) { base = null; rasc = null; dono = ''; return; }
    var antes = ctx.dados;
    aceitar(r.dia);
    ctx.dadosAntes = antes || r.dia;
    ctx.sugestao = null;
    ctx.ultima = (r.mudou || []).length ? { mudou: r.mudou, sugestao: null } : null;
    ctx.comHistorico = false;   // o rodapé relê o histórico, já com o que foi salvo
    foto = null;
    ctx.emSub = false;
    montarSubcabecalho();
    renderLista(r.dia);
  }
  /* o Cancelar do rodapé, outro dia ou o dia mudou no banco: o rascunho sai; com o Dia aberto, ele lê o dia de novo */
  function descartar() {
    pilhaDesfazer = []; pilhaRefazer = []; foto = null;
    base = null; rasc = null; dono = '';
    if (ctx && ctx.admin && !ctx.comparar && !ctx.dadosProntos) recarregar();
    avisarRascunho();
  }

  /* atalhos: Ctrl+Z desfaz, Ctrl+Y ou Ctrl+Shift+Z refaz. Só na lista do Dia do admin, sem edição de linha aberta,
     fora dos campos de texto e sem janela de aviso aberta. O keydown vive no document (liga uma vez só) */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !ctx || !ctx.admin || ctx.emSub) return;
    if (RosterWork.escalasPainelLinha && RosterWork.escalasPainelLinha.aberta()) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    var sub = RosterWork.painel && RosterWork.painel.subcabecalho();
    if (!RosterWork.painel.estaAberto() || !sub || !sub.querySelector('.escala-edicao-historico')) return;
    var tecla = (e.key || '').toLowerCase();
    if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); desfazerPasso(); }
    else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) { e.preventDefault(); refazerPasso(); }
  });

  window.RosterWork.escalasPainelEditar = {
    montar: montar,
    reset: reset,
    /* o Salvar do rodapé do painel (escalas-painel-salvar.js) */
    pendentes: pendentes,
    previaDia: previaDia,
    paraGravar: paraGravar,
    aposGravar: aposGravar,
    descartar: descartar,
    /* para a edição da linha (escalas-painel-linha.js: mudar põe a mudança no rascunho como um passo só), o Remover do
       dia e as sub-telas (escalas-painel-adicionar.js, -remover.js, -remanejar.js e -militar.js) */
    sub: {
      mudar: mudar,
      deixarFuncao: deixarFuncao,
      cortarAjustes: cortarAjustes,
      sugerir: sugerir,
      recarregar: recarregar,
      dados: function () { return ctx && ctx.dados; },
      iso: function () { return ctx && ctx.iso; },
      unidadeId: function () { return ctx && ctx.unidadeId; },
      rascunho: function () { return rasc; },
      abrir: abrirSub,
      travarAplicar: travarAplicar,
      rotuloAplicar: rotuloAplicar,
      botaoAplicar: function () { return ctx && ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar'); },
      concluir: concluirSub,
      cancelar: cancelarSub,
      /* volta ao dia sem mudar o rascunho do Dia (a mudança foi para o rascunho do Ciclo ou da Extrajornada) */
      voltar: cancelarSub,
      aplicarColocacao: aplicarColocacao,
      aplicarMilitar: aplicarMilitar,
      darFolga: darFolga,
      cancelarFolga: cancelarFolga,
      remanejar: remanejar,
      devolverRemanejado: devolverRemanejado,
      largarRemanejado: largarRemanejado,
      tirarPontual: tirarPontual,
      pontualSalvo: pontualSalvo,
      funcoesDoMilitar: funcoesDoMilitar,
      militarDoDia: militarDoDia,
      acharFuncao: acharFuncao,
      acharPosto: acharPosto,
      papeis: papeis,
      funcaoNoPosto: funcaoNoPosto,
      noLocal: noLocal,
      horas: { emMin: emMin, faixa: faixa, hhmm: hhmm, periodo: periodo, curta: curta, cruza: cruza, menos: menos,
        uniao: uniao, regua: regua, opcoesHoras: opcoesHoras, horasTexto: horasTexto, textoPeriodos: textoPeriodos }
    }
  };
})();
