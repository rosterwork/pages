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
   disso, o aviso. Na autorização de viagem (não é afastamento): Mudar o
   período, Mudar os destinos e Remover a autorização de viagem. Na
   célula vazia, Adicionar afastamento e Adicionar autorização de viagem
   (esta pergunta só o período e os destinos; no dia do Mês, já com o
   início e o fim nesse dia). Em todas, Abrir o painel do
   militar. No espaço vazio do bloquinho
   do calendário, os dois Adicionar: a caixa 2 pergunta primeiro o
   Militar (o efetivo da unidade, por antiguidade) e, escolhido ele, as
   outras perguntas aparecem embaixo, com o início e o fim no dia. No
   nome do mês do cabeçalho do Ano, a caixa do mês: Ver o mês e Ver o
   calendário. As respostas entram no rascunho na hora: a grade
   se redesenha e a caixa acompanha a peça nova (sem a peça, a célula
   do militar ou, no Calendário, o bloquinho do dia: ela não fecha
   sozinha). Com o erro de uma pergunta dela (o nome, uma data, o
   destino), o clique fora, o X e o Esc não fecham.
   Na Escala, a mesma caixa (abrirNaEscala): a linha do afastado e a da
   autorização de viagem (quem administra o dia; a caixa espera, com as
   faixas, os afastamentos do militar, lidos uma vez, e acha o do dia
   clicado), com o Abrir o painel do dia no lugar do painel do militar;
   e os dois Adicionar do pelotão (adicionarNaEscala, na caixa 2 da
   caixa do pelotão, escalas-celula-editar-acoes.js), com o Militar
   primeiro, o efetivo da unidade (buscar_efetivo, lido uma vez). O
   rascunho é o da Escala (afastamentos-rascunho.js › naEscala).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var PARTES = { periodo: ['periodo'], nome: ['nome'], marcas: ['guarnicao', 'marcas'], destinos: ['destinos'],
    adicionar: ['nome', 'periodo', 'guarnicao', 'marcas'], viagem: ['periodo', 'destinos'] };
  /* os dois Adicionar: o que cada um cria no rascunho */
  var NOVO = { adicionar: null, viagem: 'viagem' };
  var TOPO_BLOCO = 8;   // a caixa do bloquinho: o topo dela abaixo do topo dele (px), como no pelotão da Escala

  /* a caixa aberta: { tipo ('ano', 'mes', 'cal', 'bloco' ou 'mesNome'), cpf, pessoa, mes, dia, unidadeId, chave, campos,
     caixa } */
  var aberto = null;
  var abrirPainel = null; // a página abre o painel do militar (afastamentos.js)
  /* na Escala: os militares cujos afastamentos já foram lidos (cpf -> true), o efetivo (a promessa da leitura) e o posto e o
     nome de cada militar mexido (o motivo do rodapé) */
  var escala = { lidos: {}, efetivo: null, nomes: {} };

  function R() { return RW.afastamentosRascunho; }
  function M() { return RW.mensagens.afastamentos; }
  function nomeDe(p) { return p ? ((p.grau_abreviacao || '') + ' ' + (p.nome_de_guerra || '')).trim() : ''; }

  /* o afastamento gravado que começou ou terminou antes do limite (hoje − 7) */
  function travas(af) {
    var g = af && af.id ? R().gravado(af.cpf, af.id) : null;
    var lim = R().isoLimite();
    return { inicio: !!(g && g.inicio < lim), fim: !!(g && g.fim < lim) };
  }

  /* a caixa do pelotão da Escala é dela (escalas-celula-editar.js): aqui sai só o que é do afastamento */
  function fechar() {
    var a = aberto;
    aberto = null;
    if (!a) return;
    clearTimeout(a.relogio);
    if (a.chave && a.cpf) R().largar(a.cpf, a.chave);
    if (a.caixa && a.caixa.aberta() && a.tipo !== 'pelotao') a.caixa.fechar();
  }

  /* o que identifica a peça (o segundo clique na mesma peça fecha a caixa) */
  function idDe(a) { return [a.tipo, a.cpf, a.chave, a.mes, a.dia, a.unidadeId].join('|'); }

  function todos(seletor) { return Array.prototype.slice.call(document.querySelectorAll(seletor)); }

  /* a peça da caixa na grade de agora (e as outras partes do afastamento, que vão junto) */
  function pecaDe(a) {
    var linha, celula, selos, peca;
    /* a Escala: a linha do afastado (ou da autorização de viagem) no dia, com o pelotão junto; a data mudada que tirou a
       linha do dia deixa a caixa no pelotão */
    if (a.tipo === 'escala' || a.tipo === 'pelotao') {
      celula = celulaDaEscala(a.unidadeId, a.dia);
      if (!celula) return null;
      var pelotao = pecaDoPelotao(celula);
      linha = a.tipo === 'escala' ? linhaDaEscala(celula, a) : null;
      return linha ? { peca: linha, junto: [pelotao] } : { peca: pelotao, junto: [] };
    }
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
    /* o calendário: a linha do nome no dia (ou o bloquinho), e as linhas do afastamento nos outros dias; a data mudada
       que tirou a linha do calendário (errada ou em outro mês) deixa a caixa no bloquinho do dia */
    var linhas = a.chave ? todos('#afastamentos-calendario .afastamentos-linha[data-af="' + a.chave + '"]') : [];
    var bloco = document.querySelector('#afastamentos-calendario .afastamentos-bloco[data-unidade-id="' + a.unidadeId + '"][data-iso="' + a.dia + '"]');
    if (a.tipo === 'bloco') peca = bloco;
    else peca = (bloco && a.chave && bloco.querySelector('.afastamentos-linha[data-af="' + a.chave + '"]')) || linhas[0] || bloco || null;
    return peca ? { peca: peca, junto: linhas.filter(function (l) { return l !== peca; }) } : null;
  }

  /* a caixa pode fechar? Com o erro de uma pergunta dela (o nome, uma data, o destino), não: a frase aparece e o campo
     fica vermelho; o Cancelar e o Desfazer do rodapé desistem */
  function podeFechar(a, alvo) {
    if (aberto !== a || !a.campos) return true;
    if (alvo && alvo.closest && alvo.closest('#afastamentos-cancelar, #afastamentos-desfazer, .escala-painel-cancelar, .escala-painel-desfazer')) return true;
    return a.campos.podeFechar();
  }

  /* abre a caixa 1 na peça, com o menu; o item escolhido segue em escolher. espera (a Escala): a caixa abre sem o menu, com
     as faixas, e as opções da espera dela (o Tentar de novo) */
  function abrirCaixa(a, peca, junto, menu, titulo, topo, espera) {
    a.caixa = RW.caixaFlutuante.abrir(Object.assign({
      peca: peca, junto: junto || [], conteudo: menu, titulo: titulo, topo: topo,
      aoFechar: function () {
        if (aberto !== a) return;
        aberto = null;
        clearTimeout(a.relogio);
        if (a.chave && a.cpf) R().largar(a.cpf, a.chave);
      },
      /* o erro de uma pergunta da caixa segura o clique fora (e o rodapé), o X e o Esc */
      aoClicarFora: function (alvo) { return podeFechar(a, alvo); },
      aoTentarFechar: function (alvo) { return podeFechar(a, alvo); }
    }, espera || {}));
    if (!a.caixa) { aberto = null; return; }
    if (menu) ligarMenu(a, menu);
  }
  function ligarMenu(a, menu) {
    menu.addEventListener('click', function (ev) {
      var item = ev.target.closest('[data-acao]');
      if (item && aberto === a) escolher(a, item);
    });
  }

  /* as perguntas de um afastamento na caixa 2 (no lugar, depois do que já estiver nele) */
  function perguntas(a, lugar, acao) {
    a.campos = RW.afastamentosCampos.montar(lugar, {
      cpf: a.cpf, chave: a.chave, partes: PARTES[acao], origem: 'celula', brancoNaTentativa: true
    });
  }

  /* o novo do Adicionar escolhido (o afastamento ou a autorização de viagem): o que já estava de outro Adicionar sai, se
     ficou em branco, e o novo entra no rascunho */
  function novoDe(a, acao) {
    var tipo = NOVO[acao];
    var af = a.chave && a.cpf ? R().achar(a.cpf, a.chave) : null;
    if (af && (af.padrao === 'viagem') === (tipo === 'viagem')) return;
    if (af) R().largar(a.cpf, a.chave);
    a.chave = a.cpf ? R().criar(a.cpf, a.dia, tipo) : null;
  }

  /* o Adicionar do bloquinho: o Militar e, escolhido ele, as outras perguntas embaixo (trocar o militar leva o que já
     foi respondido para o novo) */
  function adicionarNoBloco(a, item, acaoDada) {
    var acao = acaoDada || item.getAttribute('data-acao');
    var cartao = RW.tpl('tpl-afastamentos-cartao');
    var campo = RW.tpl('tpl-afastamento-militar');
    if (!cartao || !campo) return;
    var botao = campo.querySelector('[data-af-militar]');
    a.campoMilitar = campo;
    popularMilitares(a);
    RW.campos.ligarSelecao(botao, function (cpf) {
      if (aberto !== a || cpf === a.cpf) return;
      var antes = a.cpf;
      a.cpf = cpf;
      a.pessoa = a.efetivo.filter(function (p) { return String(p.usuario_id) === cpf; })[0] || null;
      if (a.tipo === 'pelotao') marcarNaEscala(a);
      while (campo.nextSibling) cartao.removeChild(campo.nextSibling);
      if (!a.chave) a.chave = R().criar(cpf, a.dia, NOVO[acao]);
      else R().passarNovo(antes, a.chave, cpf, 'celula');
      perguntas(a, cartao, acao);
    });
    /* o outro Adicionar do mesmo bloquinho: o que ficou em branco sai, e o militar escolhido continua */
    if (a.cpf) {
      novoDe(a, acao);
      RW.campos.definirSelecao(botao, a.cpf);
      botao.querySelector('.campo-selecao-texto').textContent =
        ((a.pessoa.grau_abreviacao || '') + ' ' + (a.pessoa.nome_de_guerra || '')).trim();
    }
    cartao.appendChild(campo);
    if (a.cpf) perguntas(a, cartao, acao);
    a.caixa.segunda(item, cartao, item.textContent.trim());
    botao.focus({ preventScroll: true });
  }
  /* a lista do Militar: o efetivo da unidade (na Escala, desligada até a leitura chegar) */
  function popularMilitares(a) {
    var campo = a.campoMilitar;
    if (!campo) return;
    RW.campos.popularOpcoes(campo.querySelector('.dropdown-menu'), (a.efetivo || []).map(function (p) {
      return { rotulo: nomeDe(p), valor: String(p.usuario_id) };
    }));
    campo.querySelector('[data-af-militar]').disabled = !!a.lendo;
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
    /* a Escala: o painel do dia clicado */
    if (acao === 'painel-dia') {
      var aoPainel = a.aoPainel;
      fechar();
      if (aoPainel) aoPainel();
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
    if (NOVO.hasOwnProperty(acao)) novoDe(a, acao);
    var cartao = RW.tpl('tpl-afastamentos-cartao');
    if (!cartao) return;
    perguntas(a, cartao, acao);
    a.caixa.segunda(item, cartao, item.textContent.trim());
    var primeiro = cartao.querySelector('input:not([disabled]), button:not([disabled])');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  /* o menu da caixa 1 do afastamento (af; null: a célula vazia): o que terminou antes do limite (hoje − 7) só tem o aviso;
     o que começou antes não muda as marcas nem sai (nas férias, as marcas são só a guarnição) */
  function menuDe(af) {
    var t = travas(af);
    var menu = RW.tpl(!af ? 'tpl-afastamentos-menu-vazio' : t.fim ? 'tpl-afastamentos-menu-travado'
      : af.padrao === 'viagem' ? 'tpl-afastamentos-menu-viagem' : 'tpl-afastamentos-menu');
    if (menu && af && !t.fim) {
      ['marcas', 'remover'].forEach(function (k) {
        var b = menu.querySelector('[data-acao="' + k + '"]');
        if (b) b.classList.toggle('oculto', t.inicio);
      });
    }
    return menu;
  }

  /* a caixa de um afastamento ou da célula vazia de um militar (a = { tipo, cpf, pessoa, mes ou dia, chave }) */
  function abrirDoMilitar(a, pecaClicada) {
    if (aberto && a.chave && idDe(aberto) === idDe(a)) { fechar(); return; }
    fechar();
    var af = a.chave ? R().achar(a.cpf, a.chave) : null;
    a.chave = af ? af.chave : null;
    var menu = menuDe(af);
    if (!menu) return;
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
    /* o pelotão da Escala: a caixa é dela, e ela acha a peça nova (escalas-celula-editar.js) */
    if (a.tipo === 'pelotao') { if (a.campos) a.campos.pintar(); return; }
    var p = pecaDe(a);
    if (!p) { fechar(); return; }
    a.caixa.trocarPeca(p.peca, p.junto);
    if (a.campos) a.campos.pintar();
  }

  /* outra tela mudou o rascunho (o painel, o Desfazer, a gravação): a caixa fecha; a gravação faz a Escala ler de novo os
     afastamentos de quem for clicado */
  function aoMudarRascunho(origem) {
    if (origem === 'gravou') escala.lidos = {};
    if (origem !== 'celula' && aberto) fechar();
    /* na Escala, a grade só se redesenha com a prévia: as perguntas mostram a resposta na hora (os dias, o erro) */
    else if (aberto && aberto.campos && (aberto.tipo === 'escala' || aberto.tipo === 'pelotao')) aberto.campos.pintar();
  }

  /* ---------- na Escala ---------- */

  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function celulaDaEscala(unidadeId, iso) {
    return document.querySelector('.conteudo .pagina-corpo .escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]');
  }
  /* o pelotão: o bloco do calendário (com o nome dele) ou a célula */
  function pecaDoPelotao(cel) { return cel.closest('.escala-calendario-unidade') || cel; }
  /* a linha do afastado (ou da autorização de viagem) do militar na célula */
  function linhaDaEscala(cel, a) {
    if (!a.cpf) return null;
    return cel.querySelector('.linha-escalado[data-cpf="' + a.cpf + '"].' + (a.viagem ? 'linha-escalado--viagem' : 'linha-escalado--afastamento'));
  }

  /* a Escala aberta: o rascunho dos afastamentos passa a ser o dela (uma vez por entrada na página; o que foi lido em outra
     visita é lido de novo) */
  function entrarNaEscala() {
    if (R().naEscala()) return;
    var modos = document.querySelector('.conteudo #escala-modos');
    R().iniciar(modos ? modos.closest('.pagina') : null, {
      naEscala: true, caixaAberta: aberta, nome: function (cpf) { return escala.nomes[cpf] || ''; }
    });
    escala = { lidos: {}, efetivo: null, nomes: {} };
    R().ouvir('celula', aoMudarRascunho);
  }
  /* o militar mexido na célula: o nome dele no motivo do rodapé e o dia da prévia */
  function marcarNaEscala(a) {
    if (!a.cpf) return;
    escala.nomes[a.cpf] = nomeDe(a.pessoa);
    R().marcarOnde(a.cpf, { unidadeId: a.unidadeId, iso: a.dia, unidadeNome: a.unidadeNome });
  }

  /* o clique na linha do afastado ou da autorização de viagem (escalas-celula-editar.js, quem administra o dia): a caixa
     espera os afastamentos do militar e mostra o menu do que cobre o dia; aoPainel() abre o painel do dia. O mesmo
     clique na mesma linha deixa a caixa como está (como o nome na Escala) */
  function abrirNaEscala(cel, linha, aoPainel) {
    entrarNaEscala();
    var cpf = linha.getAttribute('data-cpf'), viagem = linha.classList.contains('linha-escalado--viagem');
    var b = aberto, iso = cel.getAttribute('data-iso'), unidadeId = cel.getAttribute('data-unidade-id');
    if (b && b.tipo === 'escala' && b.cpf === cpf && b.dia === iso && b.unidadeId === unidadeId && b.viagem === viagem
      && b.caixa && b.caixa.aberta()) return;
    fechar();
    var g = linha.querySelector('.linha-escalado-grad'), n = linha.querySelector('.linha-escalado-nome');
    var a = { tipo: 'escala', cpf: cpf, dia: iso, unidadeId: unidadeId, unidadeNome: cel.getAttribute('data-unidade-nome') || '',
      chave: null, viagem: viagem, aoPainel: aoPainel, texto: linha.textContent || '',
      pessoa: { usuario_id: cpf, grau_abreviacao: g ? g.textContent.trim() : '', nome_de_guerra: n ? n.textContent.trim() : '' } };
    marcarNaEscala(a);
    a.campos = null;
    aberto = a;
    var p = pecaDe(a) || { peca: linha, junto: [pecaDoPelotao(cel)] };
    abrirCaixa(a, p.peca, p.junto, null, nomeDe(a.pessoa), null, {
      esperar: true, falhaTitulo: RW.mensagens.geral.falhaCarregar,
      aoTentar: function () { if (aberto === a) lerMilitar(a); }
    });
    if (aberto === a) lerMilitar(a);
  }

  /* os afastamentos do militar (todos os anos), lidos uma vez; falhou: o aviso da caixa, com o Tentar de novo */
  function lerMilitar(a) {
    if (escala.lidos[a.cpf]) { mostrarNaEscala(a); return; }
    RW.afastamentosDados.listarAno(null, a.cpf).then(function (lista) {
      if (aberto !== a) return;
      if (!lista) { a.caixa.falha(); return; }
      R().conhecer(lista);
      escala.lidos[a.cpf] = true;
      mostrarNaEscala(a);
    });
  }

  /* o menu do afastamento do dia clicado (as faixas que apareceram ficam o mínimo na tela); com dois no dia, o da linha (o
     fim dela). Sem nenhum (a leitura mudou), o painel do dia */
  function mostrarNaEscala(a) {
    var falta = a.caixa.faltaForma();
    if (falta > 0) {
      clearTimeout(a.relogio);
      a.relogio = setTimeout(function () { if (aberto === a) mostrarNaEscala(a); }, falta);
      return;
    }
    var doDia = R().lista(a.cpf).filter(function (x) {
      return x.inicio && x.fim && x.inicio <= a.dia && a.dia <= x.fim && (x.padrao === 'viagem') === a.viagem;
    });
    var af = doDia.filter(function (x) { return a.texto.indexOf(RW.data.isoParaBR(x.fim).slice(0, 5)) >= 0; })[0] || doDia[0] || null;
    if (!af) {
      var aoPainel = a.aoPainel;
      fechar();
      if (aoPainel) aoPainel();
      return;
    }
    a.chave = af.chave;
    var menu = menuDe(af);
    if (!menu) return;
    var doMilitar = menu.querySelector('[data-acao="painel"]'), doDiaItem = menu.querySelector('[data-acao="painel-dia"]');
    if (doMilitar) doMilitar.classList.add('oculto');
    if (doDiaItem) doDiaItem.classList.remove('oculto');
    a.caixa.conteudo(menu);
    ligarMenu(a, menu);
  }

  /* o efetivo de uma unidade, por antiguidade (a ordem do buscar_efetivo), lido uma vez na visita; null: falhou */
  function efetivoDe(unidadeId) {
    if (!escala.efetivo) {
      var esta = escala.efetivo = RW.apiFetch('/rest/v1/rpc/buscar_efetivo', { metodo: 'POST', corpo: {} })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (lista) {
          if (!Array.isArray(lista)) { if (escala.efetivo === esta) escala.efetivo = null; return null; }
          return lista;
        });
    }
    return escala.efetivo.then(function (lista) {
      return lista ? lista.filter(function (p) { return String(p.lotacao_atual) === String(unidadeId); }) : null;
    });
  }

  /* o Adicionar afastamento e o Adicionar autorização de viagem do pelotão da Escala (escalas-celula-editar-acoes.js), na
     caixa 2 da caixa do pelotão (caixa): o mesmo do bloquinho da página Afastamentos, com o Militar primeiro e, escolhido
     ele, as outras perguntas embaixo, com o início e o fim no dia. A lista do Militar fica desligada até o efetivo chegar;
     se a leitura falha, o aviso com o Tentar de novo no lugar dela. d = { unidadeId, iso, unidadeNome }; acao = 'adicionar'
     ou 'viagem' */
  function adicionarNaEscala(caixa, item, d, acao) {
    entrarNaEscala();
    fechar();
    var a = { tipo: 'pelotao', cpf: null, pessoa: null, dia: d.iso, unidadeId: String(d.unidadeId), unidadeNome: d.unidadeNome || '',
      chave: null, efetivo: [], caixa: caixa, lendo: true };
    aberto = a;
    adicionarNoBloco(a, item, acao);
    lerEfetivo(a);
  }
  function lerEfetivo(a) {
    a.lendo = true;
    popularMilitares(a);
    efetivoDe(a.unidadeId).then(function (lista) {
      if (aberto !== a) return;
      var campo = a.campoMilitar, aviso = campo && campo.parentNode && campo.parentNode.querySelector('.falha-leitura');
      if (aviso) aviso.remove();
      a.lendo = false;
      if (!lista) {
        var bloco = RW.falha && RW.falha.bloco(RW.mensagens.geral.falhaCarregar, function () { if (aberto === a) lerEfetivo(a); });
        if (bloco && campo) campo.parentNode.insertBefore(bloco, campo.nextSibling);
        a.lendo = true;
      } else {
        a.efetivo = lista;
      }
      popularMilitares(a);
    });
  }
  /* a caixa do pelotão pode fechar? (o erro de uma pergunta do afastamento segura o clique fora, como aqui) */
  function podeFecharNaEscala(alvo) {
    var a = aberto;
    return !a || a.tipo !== 'pelotao' || podeFechar(a, alvo);
  }

  function iniciar(opcoes) {
    fechar();
    abrirPainel = opcoes && opcoes.abrirPainel;
    R().ouvir('celula', aoMudarRascunho);
  }

  /* o afastamento e o militar da caixa aberta: { cpf, chave } (chave null no Adicionar sem nada ainda), ou null */
  function aberta() {
    return aberto && aberto.cpf ? { cpf: aberto.cpf, chave: aberto.chave || null } : null;
  }

  window.RosterWork.afastamentosCelula = {
    iniciar: iniciar, aoClicar: aoClicar, aoClicarLinha: aoClicarLinha, aoClicarBloco: aoClicarBloco, menuDoMes: menuDoMes,
    reancorar: reancorar, fechar: fechar, aberta: aberta,
    /* na Escala (escalas-celula-editar.js e escalas-celula-editar-acoes.js): a caixa da linha do afastado, os dois Adicionar do
       pelotão, o efetivo já pedido quando a caixa do pelotão aparece, o clique fora da caixa do pelotão e a caixa aberta é a
       da linha? */
    abrirNaEscala: abrirNaEscala, adicionarNaEscala: adicionarNaEscala,
    adiantarEfetivo: function (unidadeId) { entrarNaEscala(); efetivoDe(unidadeId); }, podeFecharNaEscala: podeFecharNaEscala,
    abertaNaEscala: function () { return !!aberto && (aberto.tipo === 'escala' || aberto.tipo === 'pelotao'); }
  };
})();
