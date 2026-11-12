/* ============================================================
   EXTRAJORNADA — a edição rápida da extra na célula do calendário, na
   caixa flutuante (o mesmo jeito da célula da Escala; componente
   geral-caixa-flutuante). Vale nas duas telas: no Calendário e na
   Agenda da Distribuição e dos Ajustes da Extrajornada (aqui) e na
   grade da Escala (escalas-celula-extra.js, que registra a tela dela).
   O nome abre a caixa dele: Mudar o horário (na caixa 2, a barra, os
   campos e o cadeado; quem passou da cota vê a nota e os outros dias
   dele), Pôr outro no lugar dele (o escolhido fica com o horário),
   Remover deste dia (na hora, com o Desfazer), na Escala o Abrir na
   Extrajornada, e Abrir o painel do dia. Na Extrajornada, o pelotão
   abre Adicionar neste dia (o campo de militar com os grupos do
   painel; escolhido, ele entra no bloco e a caixa passa para ele, com
   a barra vazia) e Abrir o painel do dia; o militar em foco abre já
   com a barra. Tudo vai ao rascunho (RosterWork.extrajornadaGrade) e
   só o Salvar grava. O dia que não muda (a Distribuição lançada e o de
   mais de 7 dias atrás) abre a caixa com o aviso, e o painel só abre
   por ela; com o painel aberto ou o pedido aberto, o pelotão abre o
   painel. Não cria HTML nem escreve estilo. RosterWork.extrajornadaCelula.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TOPO_PELOTAO = 8;   // a caixa do pelotão abre com o topo 8px abaixo do topo dele

  /* a caixa aberta: { tela, tipo: 'nome' | 'pelotao', uid, k, cpf, foco (o militar em foco), novo (o escolhido no
     Adicionar, à espera do horário), pode (false: só os itens de abrir), caixa, menu, acao ('horario', 'outro' ou
     'adicionar': a caixa 2), botao } */
  var a = null;
  var procurando = false;   // a peça nova é procurada no próximo quadro
  var depoisDeRedesenhar = [];   // quem também desenha a barra da extra numa caixa (a Escala: o Adicionar extra)

  function msg() { return RW.mensagens.extrajornada.org; }
  function L() { return RW.mensagens.escala.linha; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }
  function B() { return RW.extrajornadaBarra; }
  function dia() { return RW.extrajornadaDia; }
  function porDia() { return RW.extrajornadaPorDia; }
  function diaMes(k) { return k.slice(8, 10) + '/' + k.slice(5, 7); }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function chaveBarra(cpf, k) { return cpf + '|' + k + '|caixa'; }
  /* o texto à vista do item (o título da folha do celular) */
  function textoDo(botao) {
    var s = [].filter.call(botao.querySelectorAll('span'), function (x) { return !x.classList.contains('oculto'); })[0];
    return s ? s.textContent.trim() : '';
  }

  /* pela célula: tirar e mudar o horário; pôr, só sem o pedido aberto */
  function editavel(k) { return !G().soLeitura() && !G().antigo(k); }
  function podePor(k) { return editavel(k) && !G().travado(); }

  /* o clique e o Enter (ou o espaço) num nome ou numa bolinha */
  function ligarClique(el, fazer) {
    el.classList.add('extrajornada-escolhivel');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', fazer);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fazer(); } });
  }

  /* ---------- as telas: onde está a peça de cada militar e o que os itens de abrir fazem ---------- */

  /* o bloco do pelotão no dia da Extrajornada e a peça do militar nele (a vaga, ou a bolinha do militar em foco) */
  function blocoDe(uid, k) { return document.querySelector('#p3-cal [data-uid="' + uid + '"][data-dia="' + k + '"]'); }
  function pecaDe(bloco, cpf) {
    return bloco ? bloco.querySelector('.extrajornada-vaga[data-cpf="' + cpf + '"], .extrajornada-foco-ponto[data-cpf="' + cpf + '"]') : null;
  }

  /* cada tela: { grade (os cliques dela cuidam da caixa: não a fecham por fora), peca(uid, k, cpf), junto(uid, k) (o
     pelotão do nome), painel(uid, k), extrajornada(uid, k) (só na Escala) } */
  var TELAS = {
    extrajornada: {
      grade: '#p3-cal [data-uid][data-dia]',
      peca: function (uid, k, cpf) { return pecaDe(blocoDe(uid, k), cpf); },
      junto: function (uid, k) { var b = blocoDe(uid, k); return b ? [b] : []; },
      painel: function (uid, k) { dia().abrir(uid, k); }
    }
  };
  function T(c) { return TELAS[c.tela]; }

  /* ---------- a caixa ---------- */

  /* abre a caixa da peça (a de antes fecha; titulo: o da folha do celular; junto: o pelotão do nome). Com espera (a Escala
     lendo o mês), a caixa aparece com o menu quando a leitura chega (os pontos passando de 0,5 s) */
  function abrirCaixa(c, peca, junto, titulo, espera) {
    var antes = a;
    a = c;
    c.caixa = RW.caixaFlutuante.abrir({
      peca: peca, junto: junto, titulo: titulo, conteudo: espera ? null : c.menu, esperar: !!espera,
      topo: c.tipo === 'pelotao' ? TOPO_PELOTAO : null, ignorar: T(c).grade,
      /* o clique fora, o Esc ou a peça que saiu: o que está no rascunho fica */
      aoFechar: function () { if (a === c) fechar(); },
      /* no celular, o Voltar da folha: o menu volta */
      aoVoltar: function () { if (a === c) { c.acao = null; c.botao = null; } }
    });
    if (!c.caixa) a = null;
    soltar(antes);
    if (a !== c) return;
    /* o militar em foco mostra o nome enquanto a caixa dele está aberta */
    if (c.foco) porDia().atualizarDia(c.k);
    if (!espera) return;
    var pontos = setTimeout(function () { if (a === c && c.caixa) c.caixa.espera(true); }, 500);
    espera.then(function (pode) {
      clearTimeout(pontos);
      if (a !== c || !c.caixa) return;
      c.pode = !!pode;
      prepararMenu(c);
      c.caixa.espera(false);
      c.caixa.conteudo(c.menu);
    });
  }

  /* fecha a caixa (o que está no rascunho fica) */
  function fechar() {
    var c = a;
    a = null;
    if (!c) return;
    if (c.caixa) c.caixa.fechar();
    soltar(c);
  }

  /* a caixa que deixou de ser a aberta: a barra dela deixa de ser a escolhida; na Extrajornada, o escolhido no Adicionar
     que ficou sem horário sai do bloco, e a bolinha do militar em foco esconde o nome */
  function soltar(c) {
    if (!c || c === a) return;
    if (c.cpf && B().escolhida() === chaveBarra(c.cpf, c.k)) B().escolher('');
    if (c.tela === 'extrajornada' && ((c.novo && !G().vagaDe(c.cpf, c.k)) || c.foco)) porDia().atualizarDia(c.k);
  }

  /* um item do menu: o mesmo item de novo não faz nada */
  function fazer(c, acao, botao) {
    if (a !== c || !ACOES[acao]) return;
    if (c.botao === botao && c.acao) return;
    ACOES[acao](c, botao);
  }

  var ACOES = {
    horario: function (c, botao) { c.acao = 'horario'; c.botao = botao; desenharHorario(c); },
    outro: function (c, botao) {
      c.acao = 'outro'; c.botao = botao;
      c.caixa.segunda(botao, campo(c.uid, c.k, function (x) { porOutro(c, x.cpf); }), textoDo(botao));
    },
    /* sai na hora (na Extrajornada, fica em cinza até o Salvar); o Desfazer do rodapé volta */
    remover: function (c) {
      var m = u().militar(c.cpf), uid = c.uid, k = c.k;
      fechar();
      if (m) G().mudar(m, k, [], uid);
    },
    painel: function (c) { var t = T(c), uid = c.uid, k = c.k; fechar(); t.painel(uid, k); },
    'abrir-extrajornada': function (c) { var t = T(c), uid = c.uid, k = c.k; fechar(); if (t.extrajornada) t.extrajornada(uid, k); },
    adicionar: function (c, botao) {
      c.acao = 'adicionar'; c.botao = botao;
      c.caixa.segunda(botao, campo(c.uid, c.k, function (x) { abrirNovo(c.uid, c.k, x.cpf); }), textoDo(botao));
    }
  };

  /* o menu do militar: os textos e os itens da tela dele e o clique de cada item */
  function menuDoNome(c) {
    var menu = RW.tpl('tpl-extrajornada-caixa-menu');
    [].forEach.call(menu.querySelectorAll('[data-tela]'), function (e) { e.classList.toggle('oculto', e.getAttribute('data-tela') !== c.tela); });
    ligarItens(c, menu);
    return menu;
  }

  function ligarItens(c, menu) {
    [].forEach.call(menu.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(c, b.getAttribute('data-acao'), b); });
    });
  }

  /* os itens que valem agora (o menu fica o mesmo; só os itens aparecem ou somem): o Mudar o horário, quando a extra se
     mexe ali; com horário neste pelotão, o Pôr outro (sem o pedido aberto) e o Remover */
  function prepararMenu(c) {
    var v = c.pode ? G().vagaDe(c.cpf, c.k) : null, tem = !!v && +v.unidade === c.uid && G().blocos(v).length > 0;
    c.menu.querySelector('[data-acao="horario"]').classList.toggle('oculto', !c.pode);
    c.menu.querySelector('[data-acao="outro"]').classList.toggle('oculto', !(tem && podePor(c.k)));
    c.menu.querySelector('[data-acao="remover"]').classList.toggle('oculto', !tem);
  }

  /* a barra da extra de um militar num dia, para uma caixa (a escolhida, com os campos e o cadeado), na cor do pedido; já
     de extra em outro pelotão no dia, a barra apagada e a nota; passou da cota, a nota e os outros dias dele */
  function montarHorario(cpf, uid, k) {
    var m = u().militar(cpf);
    if (!m) return null;
    var v = G().vagaDe(cpf, k), outro = !!v && +v.unidade !== +uid && G().blocos(v).length > 0;
    var el = RW.tpl('tpl-extrajornada-caixa-horario'), pref = u().pref(m, k);
    if (pref !== 'sem') el.classList.add('extrajornada-caixa-horario--' + pref);
    el.classList.toggle('extrajornada-caixa-horario--outro', outro);
    if (!outro && B().escolhida() !== chaveBarra(cpf, k)) B().escolher(chaveBarra(cpf, k));
    dia().ligarMarcas(el.querySelector('.extrajornada-painel-marcas'), m, k, v && !outro ? G().blocos(v) : [], +uid,
      { desligado: outro, campos: true, lugar: 'caixa', semLixeira: true });
    if (outro) {
      var nota = RW.tpl('tpl-escala-nota');
      nota.querySelector('.nota-texto').textContent = msg().jaEmOutro((u().unidade(v.unidade) || {}).nome || '');
      el.appendChild(nota);
    } else {
      var passou = G().usadas(m.cpf) - (m.concedidas || 0);
      if (passou > 0) RW.extrajornadaDiaOutros.listar(el, m, k, passou, true);
    }
    return el;
  }

  /* a caixa 2 do Mudar o horário */
  function desenharHorario(c) {
    var el = c.caixa ? montarHorario(c.cpf, c.uid, c.k) : null;
    if (el) c.caixa.segunda(c.botao, el, textoDo(c.botao));
  }

  function abrirHorario(c) { fazer(c, 'horario', c.menu.querySelector('[data-acao="horario"]')); }

  /* ---------- o campo de militar (o Adicionar neste dia e o Pôr outro no lugar dele) ---------- */

  /* um nome da lista: a bolinha do pedido, o posto e o nome; à direita, o pelotão e as cotas */
  function item(x) {
    var el = RW.tpl('tpl-extrajornada-adicionar-item');
    var ponto = el.querySelector('.extrajornada-painel-ponto');
    if (x.grupo === 'querem') ponto.classList.add('extrajornada-painel-ponto--quer');
    if (x.grupo === 'naoQuerem') ponto.classList.add('extrajornada-painel-ponto--nao');
    el.querySelector('.combo-militar-grad').textContent = x.grad || '';
    el.querySelector('.combo-militar-guerra').textContent = x.nome || '';
    el.querySelector('.combo-militar-info').textContent = x.info;
    return el;
  }

  /* os grupos do painel do dia (quem já está no dia ou não pode fica fora), todos abertos; em cada grupo, quem ainda tem
     cota primeiro, depois o pelotão do bloco, depois o nome. O campo abre com a lista. atual: o escolhido, que fica
     escrito no campo (a Escala) */
  function campo(uid, k, aoEscolher, atual) {
    var caixa = RW.tpl('tpl-extrajornada-adicionar');
    var inp = caixa.querySelector('input'), menu = caixa.querySelector('.dropdown-menu');
    var alocs = G().efetivas(), grupos = { querem: [], disp: [], naoQuerem: [] }, lista = [];
    uid = +uid;
    G().voluntarios().forEach(function (m) {
      var g = dia().grupoDe(m, uid, k).nome;
      if (grupos[g]) grupos[g].push({ cpf: m.cpf, grad: m.grad, nome: m.nome, grupo: g, m: m, usou: G().usadas(m.cpf, alocs) });
    });
    ['querem', 'disp', 'naoQuerem'].forEach(function (g) {
      if (!grupos[g].length) return;
      grupos[g].sort(function (x, y) {
        var temX = x.usou < (x.m.concedidas || 0), temY = y.usou < (y.m.concedidas || 0);
        return (temY - temX) || ((y.m.unidade_id === uid) - (x.m.unidade_id === uid)) || x.nome.localeCompare(y.nome);
      });
      lista.push({ titulo: msg().grupos[g], aberto: true });
      grupos[g].forEach(function (x) {
        x.info = ((u().unidade(x.m.unidade_id) || {}).nome || '') + ' · ' + msg().deCotas(x.usou, x.m.concedidas || 0);
        lista.push(x);
      });
    });
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: atual || function () { return null; },
      aoEscolher: aoEscolher,
      criarItem: item,
      textos: { selecione: msg().pesquisarMilitar, semNinguem: msg().ninguemParaPor, filtroVazio: msg().ninguemEncontrado }
    });
    combo.preencher(lista);
    requestAnimationFrame(function () { if (!inp.isConnected || inp.disabled) return; inp.focus(); combo.abrir(); });
    return caixa;
  }

  /* Pôr outro no lugar dele: o escolhido fica com o horário do outro, que sai (um passo do Desfazer) */
  function porOutro(c, cpf) {
    var de = u().militar(c.cpf), para = u().militar(cpf), uid = c.uid, k = c.k;
    if (a !== c || !de || !para) return;
    fechar();
    G().porNoLugar(de, para, k, uid);
  }

  /* escolhido no Adicionar neste dia: ele entra no fim do bloco, sem horário, e a caixa passa para ele já com a barra
     vazia; nada muda até o clique no horário */
  function abrirNovo(uid, k, cpf) {
    a = { tela: 'extrajornada', tipo: 'nome', uid: uid, k: k, cpf: cpf, novo: true, foco: false, pode: true, caixa: null };
    porDia().atualizarDia(k);
  }

  /* ---------- os cliques na grade da Extrajornada ---------- */

  /* o nome (a vaga, ou a bolinha do militar em foco): a caixa dele; com o painel do dia aberto, o painel vai para o dia */
  function cliqueNoNome(uid, k, cpf) {
    if (dia().aberto()) { fechar(); dia().abrir(uid, k); return; }
    if (a && a.tipo === 'nome' && a.caixa && a.uid === uid && a.k === k && a.cpf === cpf) return;
    var bloco = blocoDe(uid, k), peca = pecaDe(bloco, cpf), m = u().militar(cpf);
    if (!peca || !m) return;
    var c = { tela: 'extrajornada', tipo: 'nome', uid: uid, k: k, cpf: cpf, foco: RW.extrajornadaLista.foco() === cpf, novo: false, pode: true };
    c.menu = menuDoNome(c);
    prepararMenu(c);
    abrirCaixa(c, peca, [bloco], L().noDia(nomeDe(m), diaMes(k)));
    if (a === c && c.foco) abrirHorario(c);
  }

  /* o pelotão, fora dos nomes: a caixa dele. Com o painel do dia aberto, ele troca de dia; sem nada a pôr na célula,
     abre o painel. Com um militar em foco, o pelotão é a peça dele naquele bloco */
  function cliqueNoBloco(uid, k) {
    if (dia().aberto()) { fechar(); dia().abrir(uid, k); return; }
    if (!editavel(k)) { avisar(uid, k); return; }
    if (!podePor(k)) { fechar(); dia().abrir(uid, k); return; }
    var foco = RW.extrajornadaLista.foco(), bloco = blocoDe(uid, k);
    if (foco) { if (pecaDe(bloco, foco)) cliqueNoNome(uid, k, foco); return; }
    if (!bloco || (a && a.tipo === 'pelotao' && a.caixa && a.uid === uid && a.k === k)) return;
    var c = { tela: 'extrajornada', tipo: 'pelotao', uid: uid, k: k };
    c.menu = RW.tpl('tpl-extrajornada-caixa-pelotao');
    ligarItens(c, c.menu);
    abrirCaixa(c, bloco, [], L().noDia((u().unidade(uid) || {}).nome || '', diaMes(k)));
  }

  /* o dia que não muda (lançada ou de mais de 7 dias atrás): a caixa do pelotão com o aviso; o painel só abre por ela */
  function avisar(uid, k) {
    var bloco = blocoDe(uid, k);
    if (!bloco) return; fechar();
    RW.caixaFlutuante.aviso({ peca: bloco, topo: TOPO_PELOTAO, texto: G().soLeitura() ? msg().lancadaNaoMuda : msg().diaAntigo,
      titulo: L().noDia((u().unidade(uid) || {}).nome || '', diaMes(k)), aoPainel: function () { dia().abrir(uid, k); } });
  }

  /* ---------- a tela refeita ---------- */

  /* a peça de agora (a tela é refeita a cada mudança): a caixa segue a peça nova e a caixa 2 do horário se refaz; o
     escolhido no Adicionar ganha a caixa quando aparece, já com a barra */
  function acharPeca() {
    procurando = false;
    var c = a;
    if (!c) return;
    var peca = c.tipo === 'pelotao' ? blocoDe(c.uid, c.k) : T(c).peca(c.uid, c.k, c.cpf);
    var junto = c.tipo === 'pelotao' ? [] : T(c).junto(c.uid, c.k);
    if (!c.caixa) {
      var m = u().militar(c.cpf);
      if (!peca || !m) { a = null; return; }
      c.menu = menuDoNome(c);
      prepararMenu(c);
      abrirCaixa(c, peca, junto, L().noDia(nomeDe(m), diaMes(c.k)));
      if (a === c) abrirHorario(c);
      return;
    }
    if (!peca) { fechar(); return; }
    c.caixa.trocarPeca(peca, junto);
    if (c.tipo === 'nome' && c.pode) prepararMenu(c);
    if (c.acao === 'horario') desenharHorario(c);
  }

  function procurar() {
    if (procurando) return;
    procurando = true;
    requestAnimationFrame(acharPeca);
  }

  /* a célula do bloco (extrajornada-por-dia.js, depois das vagas e da bolinha do militar em foco): a marca de quem edita
     (a borda nos nomes, escalas-mes.css), o clique dos nomes e o escolhido no Adicionar à espera do horário; a caixa
     aberta neste bloco acha a peça nova no próximo quadro. curto: o posto curto da célula pequena do Calendário */
  function decorar(cel, uid, k, curto) {
    var pode = editavel(k);
    cel.classList.toggle('escala-mes-celula--edita', pode);
    if (pode && a && a.novo && a.uid === uid && a.k === k && !G().vagaDe(a.cpf, k) && u().militar(a.cpf)) {
      var novo = u().vaga({ cpf: a.cpf, unidade: uid, data: k, blocos: [], origem: 'admin' }, uid, curto);
      novo.classList.remove('extrajornada-vaga--sai');
      novo.removeAttribute('data-dica');
      novo.setAttribute('data-cpf', a.cpf);
      cel.appendChild(novo);
    }
    if (pode) {
      [].forEach.call(cel.querySelectorAll('.extrajornada-vaga[data-cpf], .extrajornada-foco-ponto[data-cpf]'), function (el) {
        var cpf = el.getAttribute('data-cpf');
        if (u().militar(cpf)) ligarClique(el, function () { cliqueNoNome(uid, k, cpf); });
      });
    }
    if (a && a.uid === uid && a.k === k) procurar();
  }

  RW.extrajornadaCelula = {
    decorar: decorar,
    cliqueNoBloco: cliqueNoBloco,
    /* a caixa aberta é a deste militar neste bloco? (a bolinha do militar em foco mostra o nome) */
    estaAberto: function (uid, k, cpf) { return !!a && a.tipo === 'nome' && a.uid === uid && a.k === k && a.cpf === cpf; },
    /* o bloco da caixa aberta, que fica à vista quando cresce, e o dia que o rascunho refaz (extrajornada-por-dia.js e
       extrajornada-montar.js) */
    ativo: function () { return a ? { uid: a.uid, data: a.k } : null; },
    /* a barra pediu para se refazer (extrajornada-barra.js: o cadeado) ou o rascunho mudou (a Escala) */
    redesenhar: function () {
      if (a && a.acao === 'horario') desenharHorario(a);
      depoisDeRedesenhar.forEach(function (fn) { fn(); });
    },
    /* outro dia no painel, o Salvar, o Cancelar, a sugestão ou o Desfazer: a caixa fecha (quem chama refaz a tela) */
    esquecer: function () { var c = a; a = null; if (c && c.caixa) c.caixa.fechar(); },
    /* ---------- para a Escala (escalas-celula-extra.js) ---------- */
    /* a tela dela: { grade, peca(uid, k, cpf), junto(uid, k), painel(uid, k), extrajornada(uid, k) } */
    tela: function (nome, def) { TELAS[nome] = def; },
    /* a caixa do nome numa tela registrada; espera: a Promise da leitura do mês (true: a extra se mexe ali) */
    abrirNome: function (tela, uid, k, cpf, titulo, espera) {
      var t = TELAS[tela], peca = t ? t.peca(uid, k, cpf) : null;
      if (!peca) return;
      var c = { tela: tela, tipo: 'nome', uid: +uid, k: k, cpf: cpf, foco: false, novo: false, pode: false };
      c.menu = menuDoNome(c);
      abrirCaixa(c, peca, t.junto(uid, k), titulo, espera);
    },
    /* a tela refez o dia: a caixa aberta nele acha a peça nova */
    procurar: function (uid, k) { if (a && a.uid === +uid && a.k === k) procurar(); },
    campo: campo,
    montarHorario: montarHorario,
    aoRedesenhar: function (fn) { depoisDeRedesenhar.push(fn); }
  };
})();
