/* ============================================================
   ESCALAS — o Oficial de Área no título do dia das grades (Agenda,
   Calendário e Colunas), para quem administra a companhia, com o
   painel fechado: o nome (ou o "Sem Oficial de Área") abre ao lado a
   caixa flutuante no dia da companhia (o rascunho do Dia dela, pela
   escalas-celula-editar.js: a mesma prévia e o mesmo Salvar do rodapé
   largo). Cada linha do título (um Oficial, com o horário quando não
   é o dia todo, ou a linha vermelha de um pedaço sem ninguém) abre a
   sua caixa. Quem tem um horário só no dia: Mudar o horário do
   serviço (o da célula). Com o Oficial pontual: Pôr outro no lugar
   dele (o campo dos subtenentes e oficiais da companhia, livres ou de
   serviço num pelotão; escolhido o nome, quem sai responde, quando
   vale, se as horas saem do banco) e Remover deste dia; com o que
   veio de um pelotão: Pôr outro no lugar dele e o Devolver; sem
   Oficial: Adicionar o Oficial de Área (na linha vermelha, naquele
   horário); pelo ciclo ou por troca, só o Abrir o painel do dia da
   companhia, que fica em todos. Quem está de folga entra nas horas
   livres (no lugar de quem tem horário, só nele), com o banco em
   Contabilizar; quem está de serviço num pelotão vem pelo
   remanejamento, só neste dia (o motivo já dito), e responde antes se
   sai de lá (o próximo mais antigo vira o Chefe de Socorro) ou fica
   nas duas unidades (Na unidade de origem, as frases do painel). O
   sistema faz dele o Oficial (o mais antigo de serviço na companhia,
   de Sub.Ten. para cima, em cada hora). Feita a mudança, o título já
   mostra quem entrou ou saiu, até a prévia chegar (tituloNaHora). O
   menu do dia de quem é Sub.Ten. ou mais antigo, num pelotão, tem o
   Pôr como Oficial de Área, com a mesma pergunta e o mesmo
   remanejamento (podeSer, perguntarComo na caixa 2 da célula,
   perguntarNaLinha embaixo da linha do painel). O dia de mais de 7
   dias atrás abre o aviso (o painel só por ele); o painel aberto, o
   dia na fila do recálculo e o Calendário do celular abrem o painel.
   O título ganha a borda no mouse (quem mexe) e a tracejada com
   mudança da companhia não salva, quando a célula dela não está na
   tela. Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaOficial.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var OFICIAL = /^oficial de área$/i;
  var marcando = false;   // a marca dos títulos já vai ser posta no próximo quadro
  var graus = null;       // a antiguidade de cada posto, lida uma vez (o Pôr como Oficial de Área)
  var pergunta = null;    // a pergunta do Pôr como Oficial de Área aberta embaixo de uma linha do painel (uma por vez)
  var conta = 0;          // nome único para as bolinhas de cada pergunta

  function api() { return RW.escalasPainelEditar.sub; }
  function A() { return RW.escalasCelulaAcoes; }
  function C() { return RW.escalasCelulaEditar; }
  function msg() { return RW.mensagens.escala; }
  function L() { return RW.mensagens.escala.linha; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* ---------- o dia do título ---------- */

  function corpo() { return document.querySelector('.conteudo .pagina-corpo'); }

  /* a grade da Escala (o título com o Oficial só existe nela) */
  function naEscala() { return !!document.querySelector('.conteudo #escala-modos'); }

  /* o dia da companhia do título (a de uma unidade da grade nesse dia): { unidadeId, iso, unidadeNome, unidadeCidade } */
  function diaDo(o) {
    var iso = o.dataset.iso, E = RW.paginas && RW.paginas.escalas, c = corpo();
    var cels = c && E && E.companhiaDe ? c.querySelectorAll('.escala-mes-celula[data-iso="' + iso + '"]') : [];
    for (var i = 0; i < cels.length; i++) {
      var cia = E.companhiaDe(cels[i].dataset.unidadeId);
      if (cia) return { unidadeId: String(cia.id), iso: iso, unidadeNome: cia.nome || '', unidadeCidade: cia.cidade || '' };
    }
    return null;
  }

  function podeMexer(d) { return !!d && !!RW.sessao && RW.sessao.podeAdministrar('companhia', d.unidadeId); }

  /* o texto do título (o posto e o nome, ou o "Sem Oficial de Área"): o da folha do celular */
  function nomeDo(o) {
    var g = o.querySelector('.escala-oficial-grad'), n = o.querySelector('.escala-oficial-nome');
    return ((g && !g.classList.contains('oculto') ? g.textContent : '') + ' ' + (n ? n.textContent : '')).trim();
  }

  /* ---------- o clique ---------- */

  /* o clique no Oficial do título (escalas-painel.js): true quando é dele */
  function clique(ev) {
    var o = ev.target.closest ? ev.target.closest('.escala-oficial[data-iso]') : null;
    if (!o || !naEscala()) return false;
    var d = diaDo(o);
    if (!podeMexer(d)) return false;
    function painel() { RW.escalasPainel.abrirDia(d, null); }
    /* com o painel aberto, a caixa abre do mesmo jeito e o painel vai junto para o dia (escalas-celula-editar.js ›
       painelNoDia); no celular, o painel cobre a tela e vai para o dia */
    var painelAberto = !!(RW.painel && RW.painel.estaAberto()), celular = !!(RW.celular && RW.celular());
    if ((painelAberto && celular) || (RW.escalaAtualizando && RW.escalaAtualizando.pendente(d.unidadeId, d.iso))
      || (celular && o.closest('.geral-calendario-mes-dia')) || (painelAberto && d.iso < C().limite())) {
      C().fechar();
      painel();
      return true;
    }
    var titulo = L().noDia(nomeDo(o), diaMes(d.iso));
    if (d.iso < C().limite()) {
      C().fechar();
      RW.caixaFlutuante.aviso({ peca: o, texto: msg().diaAntigo, titulo: titulo, aoPainel: painel });
      return true;
    }
    C().abrirOficial(d, o, titulo, o.dataset.cpf || null);
    return true;
  }

  /* ---------- a caixa 1 ---------- */

  /* quem é o Oficial no dia da companhia (o rascunho): o do título, quando está na função; null sem ninguém */
  function oficialDoDia(cpfTitulo) {
    var p = api().papeis(api().dados()), cpfs = [];
    Object.keys(p).forEach(function (k) { if (OFICIAL.test(p[k].funcao)) cpfs = cpfs.concat(Object.keys(p[k].por)); });
    return !cpfs.length ? null : cpfs.indexOf(cpfTitulo) >= 0 ? cpfTitulo : cpfs[0];
  }

  /* o Remover deste dia dele (escalas-painel-remover › analisarDoDia): o pontual sai na hora ('sai') ou responde antes
     se as horas saem do banco ('pontual'); o resto (o ciclo, a troca, o remanejado) é do painel */
  function remocaoDe(cpf) {
    var mil = cpf ? api().militarDoDia(cpf) : null;
    return mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: (mil.janelas || []).map(copiar) }) : null;
  }
  function ehPontual(r) { return !!r && (r.tipo === 'sai' || r.tipo === 'pontual'); }

  /* como ele é o Oficial: 'pontual' (sai pelo Remover deste dia; r = a análise), 'pelotao' (veio de um pelotão da
     companhia pelo remanejamento e volta pelo Devolver; de = o pelotão) ou 'outro' (pelo ciclo ou por troca: o painel) */
  function tipoDo(cpf, cia) {
    var mil = cpf ? api().militarDoDia(cpf) : null;
    if (!mil) return null;
    if (mil.remanejado && String(mil.remanejado.para) === String(cia)) return { tipo: 'pelotao', cpf: cpf, de: mil.remanejado.de_nome || '' };
    var r = remocaoDe(cpf);
    return { tipo: ehPontual(r) ? 'pontual' : 'outro', cpf: cpf, r: r };
  }

  /* a caixa 1, quando o dia chega (escalas-celula-editar.js › mostrar). A linha vermelha de um pedaço do dia sem ninguém
     (a lacuna, com o horário dela, decorar) abre só o Adicionar, que entra naquele horário */
  function menu(c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-oficial');
    if (!el) return null;
    var p = a.caixa && a.caixa.peca ? a.caixa.peca() : null;
    a.lacuna = p && p.dataset.inicio ? { inicio: p.dataset.inicio, fim: p.dataset.fim } : null;
    a.cpf = a.lacuna ? null : oficialDoDia(a.titulo);
    var t = tipoDo(a.cpf, c.dia.unidadeId), k = t && t.tipo, H = RW.escalasPainelHorarioDia;
    var mostra = { 'horario-dia': !!a.cpf && !!H && H.pode(a.cpf), outro: k === 'pontual' || k === 'pelotao', 'remover-dia': k === 'pontual',
      devolver: k === 'pelotao', adicionar: !a.cpf };
    Object.keys(mostra).forEach(function (x) { el.querySelector('[data-acao="' + x + '"]').classList.toggle('oculto', !mostra[x]); });
    el.querySelector('.dropdown-divisor').classList.toggle('oculto', !Object.keys(mostra).some(function (x) { return mostra[x]; }));
    el.querySelector('.escala-celula-oficial-devolver').textContent = k === 'pelotao' ? L().devolverA(t.de) : '';
    el.querySelector('.escala-celula-companhia').textContent = c.dia.unidadeNome || '';
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b, c); });
    });
    A().prepararMenu(c, el);   // a setinha do Remover deste dia, só quando ele abre a pergunta
    return el;
  }

  /* um item: o mesmo de novo não faz nada; outro termina o de antes (o concluído fica, o que está pela metade sai). O
     Devolver faz na hora, com o Desfazer. O Mudar o horário e o Remover deste dia são os da célula
     (escalas-celula-editar-acoes.js); o Remover tira ele do título na hora (aoTirarDoDia) */
  function fazer(acao, botao, c) {
    var a = c.a;
    if (!a || !api().livre() || (a.botao === botao && a.acao)) return;
    a.aoTirarDoDia = null;
    if (acao === 'remover-dia') {
      var sai = a.cpf, iso = c.dia.iso;
      a.aoTirarDoDia = function () { tituloNaHora(iso, function (l) { return !!l.pessoa && l.pessoa.cpf === sai; }, null); };
    }
    if (acao === 'remover-dia' || acao === 'horario-dia') { A().fazer(acao, botao, c); return; }
    A().encerrar(c);
    if (acao === 'painel') { c.fecharTudo('guardar'); c.abrirPainel(null); }
    else if (acao === 'devolver') devolver(a.cpf, c);
    else if (acao === 'adicionar') campo(botao, c, 'oficial-adicionar', null);
    else if (acao === 'outro') {
      var t = tipoDo(a.cpf, c.dia.unidadeId);
      if (!t || t.tipo === 'outro') { c.fecharTudo('guardar'); c.abrirPainel(a.cpf); return; }
      campo(botao, c, 'oficial-outro', t);
    }
  }

  /* o Devolver: ele volta ao pelotão dele (lá, o sistema decide a função; o mais antigo é o Chefe de Socorro) */
  function devolver(cpf, c) {
    c.fecharTudo();
    api().mudar(function () { api().devolverRemanejado(cpf); });
  }

  /* ---------- a caixa 2: quem entra ---------- */

  /* o campo dos subtenentes e oficiais da companhia, livres ou de serviço num pelotão (o do Adicionar neste dia, com a
     lista do Oficial); sai = o Oficial de agora, no Pôr outro */
  function campo(botao, c, acao, sai) {
    var el = RW.tpl('tpl-escala-celula-oficial-campo');
    if (!el) return;
    A().nesteDia(botao, c, { el: el, acao: acao, aoEscolher: function (item) { escolheu(item, c, el, sai); } });
  }

  /* escolhido o nome: ele entra e, no Pôr outro, o de antes sai, ao vivo (um passo do desfazer). Quem vem de um pelotão
     responde antes se sai de lá ou fica nas duas (até a resposta, nada muda e o Salvar fica desligado); quem sai com as
     horas no banco responde se elas saem dele (até a resposta, o Salvar fica desligado). A caixa fechada com pergunta sem
     resposta desfaz tudo; tudo respondido, ou sem nada a perguntar, a caixa fecha e o título já mostra quem entrou */
  function escolheu(item, c, el, sai) {
    var a = c.a, s = item.m.servico_em, cia = c.dia.unidadeId;
    a.escolhido = item;
    a.remocao = sai && sai.r ? sai.r : null;
    a.fica = false;
    a.origemFalta = !!s;
    a.faixa = faixaDe(a, sai);
    A().vivo(a);
    aplicar(a, cia, sai);
    var r = a.remocao, banco = !!r && r.tipo === 'pontual';
    function fim() {
      if (a.origemFalta || (banco && !a.escolha)) return;
      c.fecharTudo();
      naHora(c, item, sai, s, a.fica);
    }
    var origem = el.querySelector('.escala-celula-oficial-origem');
    origem.classList.toggle('oculto', !s);
    if (s) {
      perguntarOrigem(origem, nomeDe(item), s.unidade || '', c.dia.unidadeNome, function (fica) {
        a.fica = fica;
        a.origemFalta = false;
        aplicar(a, cia, sai);
        fim();
      });
    }
    var caixa = el.querySelector('.escala-celula-oficial-banco');
    if (banco && caixa.classList.contains('oculto')) {
      A().pergunta(caixa, { texto: r.texto, sim: r.sim, nao: r.nao, naoPrimeiro: false, escolha: a.escolha }, function (v) {
        a.escolha = v;
        aplicar(a, cia, sai);
        fim();
      });
    }
    if (!s && !banco) fim();
  }

  /* o horário em que quem entra fica: o da linha vermelha escolhida, ou o de quem sai, quando ele não é o dia todo */
  function faixaDe(a, sai) {
    if (a.lacuna) return a.lacuna;
    var E = RW.escalasCelula, H = RW.horario;
    if (!sai || !E) return null;
    var l = E.linhasDoOficial(E.oficialLido(a.iso)).filter(function (x) { return x.pessoa && x.pessoa.cpf === sai.cpf; })[0];
    return l && l.hora ? { inicio: H.hhmm(l.de), fim: H.hhmm(l.ate) } : null;
  }

  /* Na unidade de origem (as frases do painel): ele sai do pelotão neste dia (lá, o próximo mais antigo vira o Chefe de
     Socorro) ou fica nas duas unidades; nenhuma marcada. aoResponder(fica) */
  function perguntarOrigem(caixa, nome, de, para, aoResponder) {
    A().pergunta(caixa, { texto: L().remanejarSai(nome, de), sim: L().remanejarSoNa(para), nao: L().remanejarNasDuas(de, para),
      naoPrimeiro: false, escolha: null }, function (v) { aoResponder(v === 'nao'); });
  }

  /* o rascunho do Dia volta à foto e recebe a saída do Oficial de antes (o Devolver; o pontual, com a resposta ou sem
     pergunta) e a entrada do escolhido; pela metade, o Salvar fica desligado (sem a resposta da origem, nada entra) */
  function aplicar(a, cia, sai) {
    var r = a.remocao, faltaBanco = !!r && r.tipo === 'pontual' && !a.escolha;
    if (a.origemFalta) { api().aoVivo(function () {}, true); return; }
    api().aoVivo(function () {
      if (sai && sai.tipo === 'pelotao') api().devolverRemanejado(sai.cpf);
      else if (r && !faltaBanco) r.aplicar(a.escolha);
      entrar(a.escolhido, cia, a.fica, a.faixa);
    }, faltaBanco);
  }

  /* quem entra: de folga, como pontual, nas horas livres (com faixa, só dentro dela, quando ele cabe), com o banco em
     Contabilizar; de serviço num pelotão, o remanejamento para a companhia, só neste dia (fica = continua também no
     pelotão; o dia dele vai inteiro, e o sistema faz Oficial o mais antigo de cada hora) */
  function entrar(item, cia, fica, faixa) {
    var s = item.m.servico_em;
    if (s) { api().remanejar([remanejamento(item.cpf, s.unidade_id, cia, fica)]); return; }
    var e = A().entrada(item), H = RW.horario;
    if (faixa) {
      var f = H.faixa({ hi: faixa.inicio, hf: faixa.fim });
      var dentro = e.periodos.map(function (p) { return H.cruza(H.faixa(p), f); }).filter(Boolean).map(H.periodo);
      if (dentro.length) e.periodos = dentro;
    }
    api().aplicarColocacao(e);
  }

  /* ---------- o título na hora ---------- */

  /* o título do dia como vai ficar, até a leitura chegar (escalas-dia-na-grade.js › porOficial): nas linhas da última
     leitura (escalas-celula.js › linhasDoOficial), a que passa no teste fica com quem entra (nulo: o pedaço fica sem
     ninguém); o mesmo Oficial em horários seguidos vira uma linha só */
  function tituloNaHora(iso, troca, entra) {
    var E = RW.escalasCelula, G = RW.escalasDiaNaGrade, H = RW.horario;
    if (!E || !G || !G.porOficial || E.oficialLido(iso) === undefined) return;
    var todos = [];
    E.linhasDoOficial(E.oficialLido(iso)).forEach(function (l) {
      var p = troca(l) ? entra : l.pessoa, ultimo = todos[todos.length - 1];
      if (!p) return;
      if (ultimo && ultimo.cpf === p.cpf && ultimo.fim === H.hhmm(l.de)) { ultimo.fim = H.hhmm(l.ate); return; }
      todos.push({ cpf: p.cpf, grad: p.grad || '', nome: p.nome || '', inicio: H.hhmm(l.de), fim: H.hhmm(l.ate) });
    });
    G.porOficial(iso, todos.length ? Object.assign({}, todos[0], { todos: todos }) : null);
  }

  /* o Pôr outro e o Adicionar na hora: quem entra no título (no lugar de quem saiu, na linha vermelha escolhida ou, sem
     ninguém, no dia todo); vindo de um pelotão, a espera na célula de lá e, saindo de lá, o nome riscado */
  function naHora(c, item, sai, s, fica) {
    var iso = c.dia.iso, lacuna = c.a.lacuna, G = RW.escalasDiaNaGrade;
    tituloNaHora(iso, function (l) {
      if (sai) return !!l.pessoa && l.pessoa.cpf === sai.cpf;
      return !l.pessoa && (!lacuna || RW.horario.hhmm(l.de) === lacuna.inicio);
    }, { cpf: item.cpf, grad: item.grad, nome: item.nome });
    if (!s || !G) return;
    G.refazendo(s.unidade_id, iso);
    if (!fica) G.riscar(s.unidade_id, iso, item.cpf);
  }

  /* o serviço do dia dele de um pelotão para a companhia (inteiro, ou ficando também no pelotão), com o motivo já dito */
  function remanejamento(cpf, origem, cia, fica) {
    return { cpf: cpf, origem: Number(origem), destino: Number(cia), fica: !!fica, motivo: L().motivoOficial };
  }

  /* ---------- o Pôr como Oficial de Área do nome ---------- */

  /* a antiguidade dos postos (buscar_graus_hierarquicos), lida uma vez: { 'Sub.Ten.': 9, ... } */
  function lerGraus() {
    if (graus) return;
    graus = {};
    RW.rpc('buscar_graus_hierarquicos').then(function (lista) {
      (lista || []).forEach(function (g) { graus[g.grau_abreviacao] = g.grau_antiguidade; });
    }).catch(function () { graus = null; });
  }
  function podeSerOficial(grad) { return !!graus && graus[grad] != null && graus['Sub.Ten.'] != null && graus[grad] <= graus['Sub.Ten.']; }

  /* ele vira o Oficial do dia (ou de um pedaço dele)? as linhas do título do dia na grade: uma sem Oficial, ou uma com um de
     posto mais moderno que o dele (o sistema põe o mais antigo de cada hora; com um mais antigo o dia todo, ele iria para a
     companhia sem ser o Oficial) */
  function viraOficial(grad, iso) {
    var c = corpo(), linhas = c ? [].slice.call(c.querySelectorAll('.escala-oficial[data-iso="' + iso + '"]')) : [];
    return linhas.some(function (t) {
      if (t.classList.contains('escala-oficial--sem')) return true;
      var atual = t.querySelector('.escala-oficial-grad').textContent;
      return graus[atual] != null && graus[grad] < graus[atual];
    });
  }

  /* o item no menu do dia (escalas-painel-linha-menu.js), no dia de um pelotão de companhia, para quem administra a
     companhia: o Sub.Ten. ou mais antigo de serviço aqui (fora a extra), sem estar remanejado, quando ele vira o Oficial */
  function podeSer(cpf) {
    var E = RW.paginas && RW.paginas.escalas, uid = api().unidadeId(), cia = E && E.companhiaDe ? E.companhiaDe(uid) : null;
    if (!cia || String(cia.id) === String(uid) || !RW.sessao || !RW.sessao.podeAdministrar('companhia', cia.id)) return false;
    var mil = api().militarDoDia(cpf);
    return !!mil && mil.daUnidade && !mil.remanejado && podeSerOficial(mil.grad) && viraOficial(mil.grad, api().iso())
      && (mil.janelas || []).some(function (j) { return j.origem !== 'extra'; });
  }

  /* o serviço dele vai daqui para a companhia, só neste dia, na hora, com o Desfazer (o mesmo remanejamento da caixa do
     título; saindo daqui, as colocações à mão dele aqui saem; ficando nas duas, continuam); lá, o sistema faz dele o Oficial.
     O título já mostra ele (nos pedaços sem ninguém ou, sem nenhum, no dia todo) e, saindo daqui, o nome fica riscado */
  function porComoOficial(cpf, fica) {
    var E = RW.paginas.escalas, uid = api().unidadeId(), cia = E.companhiaDe(uid), mil = api().militarDoDia(cpf), iso = api().iso();
    if (!cia) return;
    api().mudar(function () {
      if (!fica) RW.escalasPainelRemanejarListas.cortarNaOrigem(api().rascunho(), cpf, api().dados());
      api().remanejar([remanejamento(cpf, uid, cia.id, fica)]);
    });
    var celulas = RW.escalasCelula, G = RW.escalasDiaNaGrade;
    if (!mil || !celulas || !G) return;
    var vazio = celulas.linhasDoOficial(celulas.oficialLido(iso)).some(function (l) { return !l.pessoa; });
    tituloNaHora(iso, function (l) { return !vazio || !l.pessoa; }, { cpf: cpf, grad: mil.grad, nome: mil.nome });
    if (!fica) G.riscar(uid, iso, cpf);
  }

  /* os nomes da pergunta do Pôr como Oficial de Área: ele, o pelotão do dia aberto e a companhia */
  function textosDe(cpf) {
    var E = RW.paginas.escalas, uid = api().unidadeId(), cia = E.companhiaDe(uid), mil = api().militarDoDia(cpf);
    var aqui = ((api().dados().picker || []).filter(function (u) { return u.editando; })[0] || {}).unidade_nome || '';
    return cia && mil ? { nome: nomeDe(mil), de: aqui, para: cia.nome || '' } : null;
  }

  /* na caixa 2 da célula (escalas-celula-editar-acoes.js): a pergunta na caixa dada; a resposta chama aoFim (a caixa
     fecha) e faz na hora, com o Desfazer */
  function perguntarComo(caixa, cpf, aoFim) {
    var t = textosDe(cpf);
    if (!t) return;
    perguntarOrigem(caixa, t.nome, t.de, t.para, function (fica) { aoFim(); porComoOficial(cpf, fica); });
  }

  /* no lápis do painel (escalas-painel-linha-menu.js): a pergunta única embaixo da linha, sem nada marcado (Guia visual ›
     Pergunta única embaixo da linha); a resposta fecha a pergunta e faz na hora, com o Desfazer; o Cancelar fecha sem
     mudar nada. Uma aberta por vez (a do Remover do dia também fecha) */
  function perguntarNaLinha(cpf, linha) {
    fecharPergunta();
    if (RW.escalasPainelRemover) RW.escalasPainelRemover.fecharPergunta('guardar');
    var el = RW.tpl('tpl-escala-oficial-origem'), t = textosDe(cpf);
    if (!el || !t || !linha) return;
    var q = function (s) { return el.querySelector(s); };
    q('.escala-oficial-origem-texto').textContent = L().remanejarSai(t.nome, t.de);
    q('.escala-oficial-origem-sim').textContent = L().remanejarSoNa(t.para);
    q('.escala-oficial-origem-nao').textContent = L().remanejarNasDuas(t.de, t.para);
    var nome = 'escala-oficial-origem-' + (++conta);
    [].forEach.call(el.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) { fecharPergunta(); porComoOficial(cpf, r.value === 'nao'); } });
    });
    q('.escala-oficial-origem-cancelar').addEventListener('click', fecharPergunta);
    linha.insertAdjacentElement('afterend', el);
    pergunta = el;
  }

  function fecharPergunta() {
    var p = pergunta;
    pergunta = null;
    if (p && p.parentNode) p.remove();
  }

  /* ---------- o título refeito ---------- */

  /* a peça da caixa aberta no título do dia dela (a grade refaz o título a cada mudança): a linha do mesmo Oficial, ou a
     do mesmo pedaço sem ninguém; senão, a primeira */
  function peca(a) {
    var c = corpo();
    if (!c) return null;
    var linhas = [].slice.call(c.querySelectorAll('.escala-oficial[data-iso="' + a.iso + '"]'));
    return linhas.filter(function (o) {
      return a.lacuna ? o.dataset.inicio === a.lacuna.inicio : !!a.titulo && o.dataset.cpf === a.titulo;
    })[0] || linhas[0] || null;
  }

  /* uma linha do título foi refeita (escalas-celula.js › preencherOficial; l = a linha: a pessoa, ou nenhuma, e o horário):
     o dia, o Oficial e, na linha vermelha de um pedaço do dia, o horário dele (o Adicionar entra nele); a marca vem no
     próximo quadro, com a grade inteira na tela (a Agenda e o Colunas fazem as células do dia depois do título) */
  function decorar(no, iso, l) {
    lerGraus();
    no.dataset.iso = iso;
    no.dataset.cpf = (l && l.pessoa && l.pessoa.cpf) || '';
    if (l && !l.pessoa && l.hora) {
      no.dataset.inicio = RW.horario.hhmm(l.de);
      no.dataset.fim = RW.horario.hhmm(l.ate);
    }
    if (!marcando) { marcando = true; requestAnimationFrame(marcar); }
  }

  /* a borda no mouse de quem mexe (de hoje − 7 em diante), a tracejada com mudança não salva da companhia sem a célula
     dela na tela, e a caixa aberta acha o título novo */
  function marcar() {
    marcando = false;
    var c = corpo(), S = RW.escalasPainelSalvar;
    if (!c || !naEscala() || !C()) return;
    var limite = C().limite();
    [].forEach.call(c.querySelectorAll('.escala-oficial[data-iso]'), function (o) {
      var d = diaDo(o), iso = o.dataset.iso;
      o.classList.toggle('escala-oficial--edita', podeMexer(d) && iso >= limite);
      o.classList.toggle('escala-oficial--nao-salvo', !!d && !!S && S.marcado(d.unidadeId, iso)
        && !c.querySelector('.escala-mes-celula[data-unidade-id="' + d.unidadeId + '"][data-iso="' + iso + '"]'));
    });
    C().acharDeNovo();
  }

  RW.escalasCelulaOficial = { clique: clique, menu: menu, peca: peca, decorar: decorar, podeSer: podeSer, perguntarComo: perguntarComo,
    perguntarNaLinha: perguntarNaLinha, fecharPergunta: fecharPergunta };
})();
