/* ============================================================
   AFASTAMENTOS — a caixa da grade
   (RosterWork.afastamentosCelula)
   A caixa flutuante da grade da Escala (geral-caixa-flutuante), só
   para quem administra o militar, nas três grades: a célula do mês no
   Ano, a célula do dia e a barra no Mês e a linha do nome no
   Calendário. No afastamento (as partes dele nos outros meses
   ou nos outros dias ficam marcadas junto): Mudar o período, Mudar o
   afastamento e Mudar o que ele sai abrem as perguntas na caixa 2, ao lado
   (afastamentos-campos.js); Remover o afastamento vai para o
   rascunho; nas Férias, o que ele sai é só a guarnição; no que começou há mais
   de uma semana, só o período (o fim) e o nome; no que terminou antes
   disso, o aviso. Na célula vazia, Adicionar afastamento (no dia do
   Mês, já com o início e o fim nesse dia). Em todas, Abrir o painel do
   militar. No espaço vazio do bloquinho
   do calendário, Adicionar afastamento: a caixa 2 pergunta primeiro o
   Militar (o efetivo da unidade, por antiguidade) e, escolhido ele, as
   outras perguntas aparecem embaixo, com o início e o fim no dia. No
   nome do mês do cabeçalho do Ano, a caixa do mês: Ver o mês e Ver o
   calendário. As respostas entram no rascunho na hora: a grade
   se redesenha e a caixa acompanha a peça nova.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var PARTES = { periodo: ['periodo'], nome: ['nome'], marcas: ['guarnicao', 'marcas'], adicionar: ['nome', 'periodo', 'guarnicao', 'marcas'] };
  var TOPO_BLOCO = 8;   // a caixa do bloquinho: o topo dela abaixo do topo dele (px), como no pelotão da Escala

  /* a caixa aberta: { tipo ('ano', 'mes', 'cal', 'bloco' ou 'mesNome'), cpf, pessoa, mes, dia, unidadeId, chave, campos,
     caixa } */
  var aberto = null;
  var abrirPainel = null; // a página abre o painel do militar (afastamentos.js)

  function R() { return RW.afastamentosRascunho; }
  function M() { return RW.mensagens.afastamentos; }

  /* o afastamento gravado que começou ou terminou antes do limite (hoje − 7) */
  function travas(af) {
    var g = af && af.id ? R().gravado(af.cpf, af.id) : null;
    var lim = R().isoLimite();
    return { inicio: !!(g && g.inicio < lim), fim: !!(g && g.fim < lim) };
  }

  function fechar() {
    var a = aberto;
    aberto = null;
    if (!a) return;
    if (a.chave && a.cpf) R().largar(a.cpf, a.chave);
    if (a.caixa && a.caixa.aberta()) a.caixa.fechar();
  }

  /* o que identifica a peça (o segundo clique na mesma peça fecha a caixa) */
  function idDe(a) { return [a.tipo, a.cpf, a.chave, a.mes, a.dia, a.unidadeId].join('|'); }

  function todos(seletor) { return Array.prototype.slice.call(document.querySelectorAll(seletor)); }

  /* a peça da caixa na grade de agora (e as outras partes do afastamento, que vão junto) */
  function pecaDe(a) {
    var linha, celula, selos, peca;
    if (a.tipo === 'mesNome') {
      peca = todos('.afastamentos-grade-cabecalho .afastamentos-mes-nome')[a.mes] || null;
      return peca ? { peca: peca, junto: [] } : null;
    }
    if (a.tipo === 'ano' || a.tipo === 'mes') {
      var grade = a.tipo === 'mes' ? '.afastamentos-grade--mes' : '.afastamentos-grade:not(.afastamentos-grade--mes)';
      linha = document.querySelector(grade + ' .escala-mil-pessoa-linha[data-cpf="' + a.cpf + '"]');
      if (!linha) return null;
      celula = a.tipo === 'mes'
        ? linha.querySelector('.afastamentos-celula[data-dia="' + a.dia + '"]')
        : linha.querySelector('.afastamentos-celula[data-mes="' + a.mes + '"]');
      selos = a.chave ? Array.prototype.slice.call(linha.querySelectorAll('.afastamentos-selo[data-af="' + a.chave + '"]')) : [];
      peca = (a.tipo === 'ano' && celula && a.chave && celula.querySelector('.afastamentos-selo[data-af="' + a.chave + '"]')) || selos[0] || celula;
      return peca ? { peca: peca, junto: selos.filter(function (s) { return s !== peca; }) } : null;
    }
    /* o calendário: a linha do nome no dia (ou o bloquinho), e as linhas do afastamento nos outros dias */
    var linhas = a.chave ? todos('#afastamentos-calendario .afastamentos-linha[data-af="' + a.chave + '"]') : [];
    var bloco = document.querySelector('#afastamentos-calendario .afastamentos-bloco[data-unidade-id="' + a.unidadeId + '"][data-iso="' + a.dia + '"]');
    if (a.tipo === 'bloco') peca = bloco;
    else peca = (bloco && a.chave && bloco.querySelector('.afastamentos-linha[data-af="' + a.chave + '"]')) || linhas[0] || null;
    return peca ? { peca: peca, junto: linhas.filter(function (l) { return l !== peca; }) } : null;
  }

  /* a caixa pode fechar? Com o nome em branco, não (a frase aparece); o Cancelar e o Desfazer do rodapé desistem */
  function podeFechar(a, alvo) {
    if (aberto !== a || !a.campos) return true;
    if (alvo && alvo.closest && alvo.closest('#afastamentos-cancelar, #afastamentos-desfazer')) return true;
    return a.campos.podeFechar();
  }

  /* abre a caixa 1 na peça, com o menu; o item escolhido segue em escolher */
  function abrirCaixa(a, peca, junto, menu, titulo, topo) {
    a.caixa = RW.caixaFlutuante.abrir({
      peca: peca, junto: junto || [], conteudo: menu, titulo: titulo, topo: topo,
      aoFechar: function () {
        if (aberto !== a) return;
        aberto = null;
        if (a.chave && a.cpf) R().largar(a.cpf, a.chave);
      },
      /* o nome em branco segura o clique fora (e o rodapé), o X e o Esc */
      aoClicarFora: function (alvo) { return podeFechar(a, alvo); },
      aoTentarFechar: function (alvo) { return podeFechar(a, alvo); }
    });
    if (!a.caixa) { aberto = null; return; }
    menu.addEventListener('click', function (ev) {
      var item = ev.target.closest('[data-acao]');
      if (item && aberto === a) escolher(a, item);
    });
  }

  /* as perguntas de um afastamento na caixa 2 (no lugar, depois do que já estiver nele) */
  function perguntas(a, lugar, acao) {
    a.campos = RW.afastamentosCampos.montar(lugar, {
      cpf: a.cpf, chave: a.chave, partes: PARTES[acao], origem: 'celula', nomeNaTentativa: true
    });
  }

  /* o Adicionar do bloquinho: o Militar e, escolhido ele, as outras perguntas embaixo (trocar o militar leva o que já
     foi respondido para o novo) */
  function adicionarNoBloco(a, item) {
    var cartao = RW.tpl('tpl-afastamentos-cartao');
    var campo = RW.tpl('tpl-afastamento-militar');
    if (!cartao || !campo) return;
    var botao = campo.querySelector('[data-af-militar]');
    RW.campos.popularOpcoes(campo.querySelector('.dropdown-menu'), a.efetivo.map(function (p) {
      return { rotulo: ((p.grau_abreviacao || '') + ' ' + (p.nome_de_guerra || '')).trim(), valor: String(p.usuario_id) };
    }));
    RW.campos.ligarSelecao(botao, function (cpf) {
      if (aberto !== a || cpf === a.cpf) return;
      var antes = a.cpf;
      a.cpf = cpf;
      a.pessoa = a.efetivo.filter(function (p) { return String(p.usuario_id) === cpf; })[0] || null;
      while (campo.nextSibling) cartao.removeChild(campo.nextSibling);
      if (!a.chave) a.chave = R().criar(cpf, a.dia);
      else R().passarNovo(antes, a.chave, cpf, 'celula');
      perguntas(a, cartao, 'adicionar');
    });
    cartao.appendChild(campo);
    a.caixa.segunda(item, cartao, item.textContent.trim());
    botao.focus({ preventScroll: true });
  }

  /* o item escolhido: a caixa 2 com as perguntas dele, ou a ação na hora */
  function escolher(a, item) {
    var acao = item.getAttribute('data-acao');
    if (a.tipo === 'mesNome') {
      var aoEscolher = a.aoEscolher;
      fechar();
      if (aoEscolher) aoEscolher(acao);
      return;
    }
    if (acao === 'painel') {
      var pessoa = a.pessoa;
      fechar();
      if (abrirPainel && pessoa) abrirPainel(pessoa);
      return;
    }
    if (acao === 'remover') {
      var chave = a.chave;
      a.chave = null;
      fechar();
      R().remover(a.cpf, chave, 'celula');
      return;
    }
    if (!PARTES[acao]) return;
    if (a.tipo === 'bloco') { adicionarNoBloco(a, item); return; }
    if (acao === 'adicionar' && !a.chave) a.chave = R().criar(a.cpf, a.dia);
    var cartao = RW.tpl('tpl-afastamentos-cartao');
    if (!cartao) return;
    perguntas(a, cartao, acao);
    a.caixa.segunda(item, cartao, item.textContent.trim());
    var primeiro = cartao.querySelector('input:not([disabled]), button:not([disabled])');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  /* a caixa de um afastamento ou da célula vazia de um militar (a = { tipo, cpf, pessoa, mes ou dia, chave }) */
  function abrirDoMilitar(a, pecaClicada) {
    if (aberto && a.chave && idDe(aberto) === idDe(a)) { fechar(); return; }
    fechar();
    var af = a.chave ? R().achar(a.cpf, a.chave) : null;
    a.chave = af ? af.chave : null;
    var t = travas(af);
    var menu = RW.tpl(!af ? 'tpl-afastamentos-menu-vazio' : (t.fim ? 'tpl-afastamentos-menu-travado' : 'tpl-afastamentos-menu'));
    if (!menu) return;
    if (af && !t.fim) {
      /* o que começou antes do limite não muda as marcas nem sai (nas férias, as marcas são só a guarnição) */
      menu.querySelector('[data-acao="marcas"]').classList.toggle('oculto', t.inicio);
      menu.querySelector('[data-acao="remover"]').classList.toggle('oculto', t.inicio);
    }
    a.campos = null;
    aberto = a;
    var p = pecaDe(a) || { peca: pecaClicada, junto: [] };
    var titulo = ((a.pessoa.grau_abreviacao || '') + ' ' + (a.pessoa.nome_de_guerra || '')).trim();
    abrirCaixa(a, p.peca, p.junto, menu, titulo, null);
  }

  /* o clique na célula ou na barra (quem administra o militar): no afastamento, a caixa dele; no vazio, o Adicionar */
  function aoClicar(celula, pessoa, evento) {
    var selo = evento.target.closest('.afastamentos-selo');
    var mes = celula.getAttribute('data-mes');
    abrirDoMilitar({
      tipo: mes !== null ? 'ano' : 'mes', cpf: String(pessoa.usuario_id), pessoa: pessoa,
      mes: mes !== null ? Number(mes) : null, dia: mes !== null ? null : celula.getAttribute('data-dia'),
      chave: selo ? selo.getAttribute('data-af') : null
    }, selo || celula);
  }

  /* o clique no nome do calendário (quem administra o militar): a caixa do afastamento */
  function aoClicarLinha(linha, pessoa) {
    var bloco = linha.closest('.afastamentos-bloco');
    abrirDoMilitar({
      tipo: 'cal', cpf: String(pessoa.usuario_id), pessoa: pessoa, dia: bloco ? bloco.getAttribute('data-iso') : null,
      unidadeId: bloco ? bloco.getAttribute('data-unidade-id') : null, chave: linha.getAttribute('data-af')
    }, linha);
  }

  /* o clique no espaço vazio do bloquinho (quem administra a unidade): o Adicionar, com o militar a escolher */
  function aoClicarBloco(bloco, unidade, efetivo, dia) {
    var a = { tipo: 'bloco', cpf: null, pessoa: null, dia: dia, unidadeId: String(unidade.unidade_id), chave: null, efetivo: efetivo || [] };
    if (aberto && idDe(aberto) === idDe(a)) { fechar(); return; }
    fechar();
    var menu = RW.tpl('tpl-afastamentos-menu-dia');
    if (!menu) return;
    aberto = a;
    abrirCaixa(a, bloco, [], menu, unidade.nome || '', TOPO_BLOCO);
  }

  /* o nome do mês no cabeçalho do Ano: a caixa com o mês na aba Mês ou no Calendário (aoEscolher('mes' ou
     'calendario')) */
  function menuDoMes(botao, mes, aoEscolher) {
    var a = { tipo: 'mesNome', mes: mes, aoEscolher: aoEscolher };
    if (aberto && idDe(aberto) === idDe(a)) { fechar(); return; }
    fechar();
    var menu = RW.tpl('tpl-afastamentos-menu-mes');
    if (!menu) return;
    menu.querySelector('.afastamentos-menu-titulo').textContent = M().tituloMes(mes);
    aberto = a;
    abrirCaixa(a, botao, [], menu, M().tituloMes(mes), null);
  }

  /* a grade se redesenhou: a caixa acompanha a peça nova (ou fecha, se a peça saiu da tela) e as perguntas mostram o
     resultado */
  function reancorar() {
    var a = aberto;
    if (!a) return;
    var p = pecaDe(a);
    if (!p) { fechar(); return; }
    a.caixa.trocarPeca(p.peca, p.junto);
    if (a.campos) a.campos.pintar();
  }

  /* outra tela mudou o rascunho (o painel, o Desfazer, a gravação): a caixa fecha */
  function aoMudarRascunho(origem) {
    if (origem !== 'celula' && aberto) fechar();
  }

  function iniciar(opcoes) {
    fechar();
    abrirPainel = opcoes && opcoes.abrirPainel;
    R().ouvir('celula', aoMudarRascunho);
  }

  window.RosterWork.afastamentosCelula = {
    iniciar: iniciar, aoClicar: aoClicar, aoClicarLinha: aoClicarLinha, aoClicarBloco: aoClicarBloco, menuDoMes: menuDoMes,
    reancorar: reancorar, fechar: fechar
  };
})();
