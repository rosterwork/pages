/* ============================================================
   ESCALAS — a edição rápida na célula da grade (Agenda, Calendário,
   Colunas e Semana), para quem administra o dia, com o painel
   fechado, na caixa flutuante (geral-caixa-flutuante) e no rascunho
   do Dia (escalas-painel-editar.js sem a lista: a mesma prévia e o
   mesmo Salvar do rodapé largo). O nome abre ao lado o menu dele no
   dia (o do lápis da aba Militares, escalas-painel-linha-menu.js ›
   menuDaCelula, com o Abrir o painel do dia); as linhas riscadas têm
   o menu delas, a troca e o afastamento só o Abrir o painel, e a da
   extra, para o administrador da companhia, a caixa da extra
   (escalas-celula-extra.js). O pelotão abre Adicionar neste dia,
   Adicionar à guarnição (a letra do dia) e Abrir o painel do dia; o
   sobreaviso, a caixa dele (escalas-celula-sobreaviso-caixa.js); o nome
   em vermelho do Fora da escala, a dele (escalas-celula-fora.js); o
   Oficial de Área do título, o dia da companhia (escalas-celula-
   oficial.js). O que cada item faz: escalas-celula-editar-acoes.js. O
   dia, as unidades da companhia e o mês da extra começam a ser lidos
   antes do clique (escalas-celula-adiantar.js); a caixa abre na hora,
   com as faixas enquanto eles chegam; o clique fora e o
   Esc fecham (o concluído fica, o que ficou pela metade sai); um dia
   por vez (outro dia com mudança não salva pergunta antes). O dia de
   mais de 7 dias atrás abre a caixa com o aviso (o painel só por
   ela); quem só lê, o dia na fila do recálculo, o painel aberto e o
   Calendário do celular abrem o painel. Não cria HTML nem escreve
   estilo.
   RosterWork.escalasCelulaEditar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* as linhas riscadas e as do Fora da escala: o tipo do menu delas (as outras são 'militar'); o nome em vermelho do Fora
     da escala tem a caixa dele (escalas-celula-fora.js) */
  var TIPOS = [
    ['.linha-escalado--folga, .linha-escalado--mudou-dia', 'folga'],
    ['.linha-escalado--saiu', 'saida'],
    ['.linha-escalado--remanejado', 'fora'],
    ['.linha-escalado--fora-vermelho, .linha-escalado--fora-aviso', 'fora-escala'],
    ['.linha-escalado--trocado, .linha-escalado--afastamento, .linha-escalado--fora', 'nada']
  ];
  var RISCADAS = '.linha-escalado--folga, .linha-escalado--trocado, .linha-escalado--remanejado, .linha-escalado--mudou-dia, .linha-escalado--saiu, .linha-escalado--afastamento, .linha-escalado--fora';
  /* o clique numa célula ou no Oficial do título é da página (outro nome, o pelotão ou o mesmo): a caixa não fecha por ele */
  var DA_GRADE = '.conteudo .escala-mes-celula, .conteudo .escala-calendario-unidade, .conteudo .escala-oficial--edita';
  /* a caixa do pelotão abre ao lado dele, com o topo 8px abaixo do topo do pelotão (na altura do nome e da faixa) */
  var TOPO_PELOTAO = 8;

  var dia = null;       // o dia da célula, com o rascunho no Dia: { unidadeId, iso, unidadeNome, unidadeCidade }
  var aberto = null;    // a caixa aberta: { tipo: 'nome' | 'pelotao' | 'oficial', unidadeId, iso, cpf, linha (o tipo), caixa, cfg, acao... }
  var refazer = false;  // a peça já vai ser achada de novo no próximo quadro

  function E() { return RW.escalasPainelEditar; }
  function api() { return RW.escalasPainelEditar.sub; }
  function S() { return RW.escalasPainelSalvar; }
  function A() { return RW.escalasCelulaAcoes; }
  function msg() { return RW.mensagens.escala; }
  function L() { return RW.mensagens.escala.linha; }
  function mesmo(a, unidadeId, iso) { return !!a && String(a.unidadeId) === String(unidadeId) && a.iso === iso; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  function diaDe(cel) { var x = cel.dataset; return { unidadeId: x.unidadeId, iso: x.iso, unidadeNome: x.unidadeNome || '', unidadeCidade: x.unidadeCidade || '' }; }

  /* ---------- quando a célula edita ---------- */

  /* a grade da Escala (a Extrajornada também usa o escalas-celula.js; a grade nova pode ser montada antes de entrar na tela) */
  function naEscala(cel) {
    return !!cel && !!document.querySelector('.conteudo #escala-modos') && !cel.closest('#p3-cal');
  }

  /* o dia mais antigo que se mexe (hoje − 7) */
  function limite() {
    var h = new Date();
    return RW.data.paraIsoDeData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 7));
  }

  /* a célula edita este dia? 'antigo': o de mais de 7 dias atrás (a caixa do aviso); false: o painel abre, como sempre */
  function podeNaCelula(cel) {
    if (!naEscala(cel) || !cel.classList.contains('escala-mes-celula')) return false;
    if (RW.painel && RW.painel.estaAberto()) return false;
    var uid = cel.dataset.unidadeId, iso = cel.dataset.iso;
    if (!RW.sessao || !RW.sessao.podeAdministrar('pelotao', uid)) return false;
    if (RW.escalaAtualizando && RW.escalaAtualizando.pendente(uid, iso)) return false;
    if (RW.celular && RW.celular() && cel.closest('.escala-calendario-unidade')) return false;
    return iso < limite() ? 'antigo' : true;
  }

  /* ---------- o dia da célula (o rascunho do Dia, sem a lista) ---------- */

  function ativo() { return !!dia && !!api().celula() && mesmo(api().celula(), dia.unidadeId, dia.iso); }

  /* começa (ou continua) o dia da célula; seguir() roda com o dia já pedido. Mudança não salva em outro dia: a pergunta de
     descartar antes (Continuar editando fica como está). d = { unidadeId, iso, unidadeNome, unidadeCidade } */
  function irPara(d, seguir) {
    if (ativo() && mesmo(dia, d.unidadeId, d.iso)) { seguir(); return; }
    function comecar() {
      fecharTudo('largar');
      dia = d;
      E().montar(null, null, d.unidadeId, d.iso, { admin: true, semLista: true, aoMostrar: chegou });
      seguir();
    }
    if (S() && S().pendente()) {
      RW.escalasPainel.confirmarDescarte(function () { E().reset(); S().descartar(); comecar(); }, S().contarDoDia());
      return;
    }
    comecar();
  }

  /* a leitura do dia (ou a prévia) chegou ao rascunho: a caixa que esperava mostra o menu; a que está sem a caixa 2 refaz o
     menu (o dia mudou); null: a leitura falhou */
  function chegou(dados) {
    if (!dados) { RW.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); fecharTudo('largar'); return; }
    var a = aberto;
    if (!a || !a.caixa) return;
    if (a.esperando || !a.acao) mostrar();
    else A().chegou(contexto());
  }

  /* ---------- a caixa ---------- */

  /* o que as ações (escalas-celula-editar-acoes.js) usam da caixa aberta */
  function contexto() {
    return { a: aberto, dia: dia, fecharTudo: fecharTudo, abrirPainel: abrirPainel, abrirNovo: abrirNovo };
  }

  function nomeDa(linha) {
    var g = linha.querySelector('.linha-escalado-grad'), n = linha.querySelector('.linha-escalado-nome');
    return ((g ? g.textContent : '') + ' ' + (n ? n.textContent : '')).trim();
  }

  /* abre a caixa da peça (titulo: o da folha do celular; junto: o pelotão do nome), já escolhida (a borda forte); ela
     aparece ao lado na hora, com o menu, ou com as faixas até ele chegar (no pelotão, com o topo um pouco abaixo do dele,
     sem cobrir os nomes) */
  function abrirCaixa(a, peca, titulo, junto) {
    aberto = a;
    a.caixa = RW.caixaFlutuante.abrir({
      peca: peca, junto: junto || [], titulo: titulo, esperar: true, topo: a.tipo === 'pelotao' ? TOPO_PELOTAO : null,
      ignorar: DA_GRADE,
      /* o clique fora, o Esc ou a peça que saiu: o que está concluído fica */
      aoFechar: function () { if (aberto === a) fecharTudo(); },
      /* no celular, o Voltar da folha: a pergunta pela metade sai e o menu volta */
      aoVoltar: function () { if (aberto === a) A().encerrar(contexto(), true); }
    });
    if (!a.caixa) { aberto = null; return; }
    mostrar();
  }

  /* os itens à vista de um menu (e a setinha de cada um): o menu só é trocado quando eles mudam */
  function chaveDo(menu) {
    return [].map.call(menu.querySelectorAll('[data-acao]'), function (b) {
      if (b.classList.contains('oculto') || b.closest('.oculto')) return '';
      var seta = b.querySelector('.escala-edicao-opcoes-seta');
      return b.getAttribute('data-acao') + (seta && seta.classList.contains('oculto') ? '-' : '') + ':' + b.textContent;
    }).join('|');
  }

  /* as unidades da companhia (o Mudar de unidade e o Trazer de outra unidade dependem delas): uma leitura por sessão, que
     a caixa espera para o menu chegar completo; se ela falha, o menu vem sem esses itens */
  function unidadesProntas(a) {
    var R = RW.escalasPainelRemanejar;
    if (!R || R.unidadesProntas() || a.semUnidades) return true;
    R.prepararUnidades().then(function (lista) { if (!lista) a.semUnidades = true; if (aberto === a && a.esperando) mostrar(); });
    return false;
  }

  /* o mês da Extrajornada (o Adicionar extra neste dia), pedido já no clique, junto com o dia: a caixa do pelotão espera
     por ele só na 1ª vez no mês (depois, o que se sabe dele fica, mesmo com o Salvar); se a leitura falha, o menu vem sem
     o item */
  function extraPronta(a) {
    var X = RW.escalasCelulaExtra;
    if (a.tipo !== 'pelotao' || a.extraLida || !X || !X.falta(dia)) return true;
    X.adiantar(dia).then(function () { a.extraLida = true; if (aberto === a && a.esperando) mostrar(); });
    return false;
  }

  /* o conteúdo da caixa 1: o menu do nome ou o do pelotão, quando o dia chega. Até lá, a caixa mostra as faixas
     (geral-caixa-flutuante.js), que ficam o mínimo na tela depois de aparecer (Carregando, REGRAS §4) */
  function mostrar() {
    var a = aberto;
    if (!a || !a.caixa) return;
    if (!ativo() || !api().livre() || api().carregando() || !api().dados() || !unidadesProntas(a) || !extraPronta(a)) {
      a.esperando = true;
      return;
    }
    var falta = a.caixa.faltaForma();
    if (falta > 0) {
      a.esperando = true;
      clearTimeout(a.relogio);
      a.relogio = setTimeout(function () { if (aberto === a) mostrar(); }, falta);
      return;
    }
    a.esperando = false;
    a.caixa.espera(false);
    var menu;
    if (a.tipo === 'pelotao') menu = A().menuDoPelotao(contexto());
    else if (a.tipo === 'oficial') menu = RW.escalasCelulaOficial.menu(contexto());
    else if (a.tipo === 'sobreaviso') menu = RW.escalasCelulaSobreavisoCaixa.menu(contexto());
    else if (a.linha === 'fora-escala') menu = RW.escalasCelulaFora.menu(contexto());
    else {
      a.cfg = cfgDe(a);
      menu = RW.escalasPainelLinhaMenu.menuDaCelula(a.cfg, function (acao, botao) {
        if (aberto === a) A().fazer(acao, botao, contexto());
      });
      A().prepararMenu(contexto(), menu);
    }
    /* o dia que não tem o sobreaviso que foi clicado (a leitura mudou): o painel do dia */
    if (!menu && a.tipo === 'sobreaviso') { fecharTudo('guardar'); abrirPainel(null); return; }
    if (!menu) return;
    var chave = chaveDo(menu);
    if (chave !== a.chave) {
      a.chave = chave;
      a.menu = menu;
      a.caixa.conteudo(menu);
    }
    if (a.tipo === 'nome') A().aoMostrarMenu(contexto(), a.menu);
  }

  /* o que o menu precisa saber da pessoa no dia, pelo tipo da linha clicada (a mesma montagem da aba Militares) */
  function cfgDe(a) {
    var dados = api().dados() || {}, cpf = a.cpf, base = { visao: 'celula' };
    var de = function (x) { return x.cpf === cpf; };
    if (a.linha === 'folga') {
      var f = (dados.folgas || []).filter(de)[0];
      if (f) return Object.assign(base, { tipo: 'folga', militar: { cpf: cpf, grad: f.grad, nome: f.nome, periodos: [] }, folga: f });
    } else if (a.linha === 'saida') {
      var s = (dados.saidas || []).filter(de)[0];
      if (s) return Object.assign(base, { tipo: 'saida', militar: { cpf: cpf, grad: s.grad, nome: s.nome, periodos: [{ hi: s.hi, hf: s.hf }] }, saida: s.saida });
    } else if (a.linha === 'fora') {
      var pm = null;
      (dados.picker || []).forEach(function (u) {
        (u.militares || []).forEach(function (x) { if (!pm && x.cpf === cpf && x.remanejado && String(x.remanejado.de) === String(a.unidadeId)) pm = x; });
      });
      if (pm) return Object.assign(base, { tipo: 'fora', militar: { cpf: cpf, grad: pm.grad, nome: pm.nome, periodos: [] }, origem: pm.remanejado.de_nome || '' });
    } else if (a.linha === 'militar') {
      var mil = api().militarDoDia(cpf);
      if (mil) {
        var periodos = (mil.janelas || []).map(copiar);
        return Object.assign(base, { tipo: 'militar', militar: { cpf: cpf, grad: mil.grad, nome: mil.nome, periodos: periodos }, periodos: periodos });
      }
    }
    return Object.assign(base, { tipo: 'nada', militar: { cpf: cpf, grad: '', nome: '', periodos: [] } });
  }

  /* ---------- o painel ---------- */

  /* o painel do dia (cpf: na aba Militares, com o menu dele, ou, com opcoes.fazerAcao, já na tela do item; opcoes.secao: a
     aba; opcoes.trazer: já no Trazer de outra unidade); no mesmo dia, ele continua o que a célula mexeu */
  function abrirPainel(cpf, opcoes) {
    var d = dia;
    opcoes = opcoes || {};
    if (!d) return;
    RW.escalasPainel.abrirDia(d, opcoes.secao || (cpf ? 'militares' : null),
      cpf ? { abrirMenuDe: cpf, fazerAcao: opcoes.fazerAcao || null } : opcoes.trazer ? { trazer: true } : null);
  }

  /* ---------- o clique ---------- */

  function tipoDaLinha(linha) {
    for (var i = 0; i < TIPOS.length; i++) if (linha.matches(TIPOS[i][0])) return TIPOS[i][1];
    return 'militar';
  }

  function cliqueNoNome(cel, linha) {
    var cpf = linha.getAttribute('data-cpf'), d = diaDe(cel), tipo = tipoDaLinha(linha);
    var a = aberto;
    if (a && a.tipo === 'nome' && mesmo(a, d.unidadeId, d.iso) && a.cpf === cpf && a.linha === tipo && a.caixa && a.caixa.aberta()) return;
    fecharTudo();
    irPara(d, function () {
      abrirCaixa({ tipo: 'nome', unidadeId: d.unidadeId, iso: d.iso, cpf: cpf, linha: tipo }, linha, L().noDia(nomeDa(linha), diaMes(d.iso)),
        [pecaDoPelotao(cel)]);
    });
  }

  /* o pelotão: o bloco do calendário (com o nome dele) ou a célula */
  function pecaDoPelotao(cel) { return cel.closest('.escala-calendario-unidade') || cel; }

  /* o sobreaviso: a caixa ao lado do nome (com o pelotão marcado junto) ou do dia */
  function cliqueNoSobreaviso(cel, sob) {
    abrirSobreaviso(diaDe(cel), sob.linha || pecaDoPelotao(cel), sob.cpf,
      L().noDia(sob.linha ? nomeDa(sob.linha) : RW.mensagens.escala.sobreaviso.dica, diaMes(diaDe(cel).iso)), sob.linha ? [pecaDoPelotao(cel)] : null);
  }

  /* a caixa do sobreaviso no dia d (cpf: o nome; null: o dia); fixa: a peça fica a mesma (a aba Militares, fora da grade
     de células) */
  function abrirSobreaviso(d, peca, cpf, titulo, junto, fixa) {
    var a = aberto;
    if (a && a.tipo === 'sobreaviso' && mesmo(a, d.unidadeId, d.iso) && a.cpf === cpf && a.caixa && a.caixa.aberta()) return;
    fecharTudo();
    irPara(d, function () {
      abrirCaixa({ tipo: 'sobreaviso', unidadeId: d.unidadeId, iso: d.iso, cpf: cpf, fixa: fixa ? peca : null }, peca, titulo, junto);
    });
  }

  function cliqueNoBloco(cel) {
    var d = diaDe(cel), a = aberto;
    if (a && a.tipo === 'pelotao' && mesmo(a, d.unidadeId, d.iso) && a.caixa && a.caixa.aberta()) return;
    fecharTudo();
    /* o mês da Extrajornada (o Adicionar extra neste dia) começa a ser lido junto com o dia */
    if (RW.escalasCelulaExtra) RW.escalasCelulaExtra.adiantar(d);
    irPara(d, function () {
      abrirCaixa({ tipo: 'pelotao', unidadeId: d.unidadeId, iso: d.iso }, pecaDoPelotao(cel), L().noDia(d.unidadeNome, diaMes(d.iso)));
    });
  }

  /* o clique numa célula (escalas-painel.js): true quando é da célula; false, o painel abre, como sempre */
  function clique(ev, cel) {
    var pode = podeNaCelula(cel);
    if (!pode) return false;
    /* o sobreaviso (o nome, o que falta ou, na página Sobreaviso, o dia): a caixa dele, para quem mexe nele; para os
       outros, o painel no bloco dele (escalas-celula-sobreaviso-caixa.js) */
    var sob = RW.escalasCelulaSobreavisoCaixa ? RW.escalasCelulaSobreavisoCaixa.alvo(ev, cel) : null;
    if (sob && !sob.pode) return false;
    if (pode === 'antigo') { avisoAntigo(cel); return true; }
    if (sob) { cliqueNoSobreaviso(cel, sob); return true; }
    var linha = ev.target.closest('.linha-escalado[data-cpf]');
    if (!linha || linha.closest('.escala-mes-celula') !== cel) cliqueNoBloco(cel);
    else if (!(linha.getAttribute('data-situacao') === 'extra' && RW.escalasCelulaExtra && RW.escalasCelulaExtra.clique(cel, linha))) cliqueNoNome(cel, linha);
    return true;
  }

  /* o dia de mais de 7 dias atrás: a caixa do pelotão com o aviso; o painel abre só pelo item dela */
  function avisoAntigo(cel) {
    var d = diaDe(cel);
    fecharTudo();
    RW.caixaFlutuante.aviso({ peca: pecaDoPelotao(cel), topo: TOPO_PELOTAO, texto: msg().diaAntigo,
      titulo: L().noDia(d.unidadeNome, diaMes(d.iso)), aoPainel: function () { RW.escalasPainel.abrirDia(d, null); } });
  }

  /* o Oficial de Área do título do dia (escalas-celula-oficial.js): a caixa dele, no dia da companhia (d); cpf: o do título */
  function abrirOficial(d, peca, titulo, cpf) {
    var a = aberto;
    if (a && a.tipo === 'oficial' && mesmo(a, d.unidadeId, d.iso) && a.caixa && a.caixa.aberta()) return;
    fecharTudo();
    irPara(d, function () { abrirCaixa({ tipo: 'oficial', unidadeId: d.unidadeId, iso: d.iso, titulo: cpf }, peca, titulo); });
  }

  /* depois do Adicionar neste dia: a caixa do militar que entrou abre quando o dia vier com ele, já no horário */
  function abrirNovo(cpf) {
    var d = dia;
    if (!d) return;
    aberto = { tipo: 'nome', unidadeId: d.unidadeId, iso: d.iso, cpf: cpf, linha: 'militar', novo: true, caixa: null };
    acharDeNovo();
  }

  /* fecha a caixa (modo: 'guardar', o que está concluído fica sem ler o dia de novo, porque o painel vai abrir nele;
     'largar', sai tudo, porque o rascunho já foi gravado ou descartado; sem modo, o concluído fica) */
  function fecharTudo(modo) {
    var a = aberto;
    aberto = null;
    if (RW.extrajornadaCelula) RW.extrajornadaCelula.esquecer();   // a caixa da extra também
    if (!a) return;
    clearTimeout(a.relogio);
    if (A()) A().fechar(a, modo);
    if (a.caixa) a.caixa.fechar();
  }

  /* ---------- a grade refeita ---------- */

  /* a linha dele no bloco, do tipo da clicada (a de serviço; a riscada, quando é a única) */
  function linhaDe(cel, cpf, tipo) {
    var todas = [].slice.call(cel.querySelectorAll('.linha-escalado[data-cpf="' + cpf + '"]'));
    var doTipo = todas.filter(function (l) { return tipoDaLinha(l) === tipo; })[0];
    var deServico = todas.filter(function (l) { return !l.matches(RISCADAS); })[0];
    return doTipo || deServico || todas[0] || null;
  }

  /* a célula do dia aberto na grade da tela */
  function celulaDe(a) {
    var corpo = document.querySelector('.conteudo .pagina-corpo');
    return corpo ? corpo.querySelector('.escala-mes-celula[data-unidade-id="' + a.unidadeId + '"][data-iso="' + a.iso + '"]') : null;
  }

  /* a peça de agora (a grade refaz a célula a cada mudança): a caixa segue a linha nova; o militar que acabou de entrar
     ganha a caixa quando a linha dele aparece */
  function acharPeca() {
    refazer = false;
    var a = aberto;
    if (!a) return;
    var cel = a.tipo === 'oficial' ? null : celulaDe(a);
    var peca = a.tipo === 'oficial' ? RW.escalasCelulaOficial.peca(a)
      : a.fixa ? (a.fixa.isConnected ? a.fixa : null)
      : !cel ? null : a.tipo === 'pelotao' ? pecaDoPelotao(cel)
      : a.tipo === 'sobreaviso' ? (a.cpf ? cel.querySelector('.linha-escalado--sobreaviso[data-cpf="' + a.cpf + '"]') : pecaDoPelotao(cel))
      : linhaDe(cel, a.cpf, a.linha);
    var junto = cel && !a.fixa && (a.tipo === 'nome' || (a.tipo === 'sobreaviso' && a.cpf)) ? [pecaDoPelotao(cel)] : [];
    if (!a.caixa) {
      if (peca && a.novo) abrirCaixa(a, peca, L().noDia(nomeDa(peca), diaMes(a.iso)), junto);
      return;
    }
    if (!peca) { fecharTudo(); return; }
    a.caixa.trocarPeca(peca, junto);
  }

  function acharDeNovo() {
    if (!refazer) { refazer = true; requestAnimationFrame(acharPeca); }
  }

  /* quem edita o dia na célula (a caixa abre no nome): os nomes ganham a borda ao passar o mouse (escalas-mes.css); para
     quem só lê, o clique abre o painel do dia, e só o pelotão ganha a borda */
  function edita(cel) {
    return !!RW.sessao && RW.sessao.podeAdministrar('pelotao', cel.dataset.unidadeId) && cel.dataset.iso >= limite();
  }

  /* a célula da grade foi refeita (escalas-celula.js): a marca de quem edita; a caixa aberta nela acha a peça nova no
     próximo quadro */
  function decorar(cel) {
    if (!naEscala(cel)) return;
    var pode = edita(cel);
    cel.classList.toggle('escala-mes-celula--edita', pode);
    if (pode && RW.escalasCelulaAdiantar) RW.escalasCelulaAdiantar.aoEntrar(diaDe(cel));
    if (RW.extrajornadaCelula) RW.extrajornadaCelula.procurar(cel.dataset.unidadeId, cel.dataset.iso);
    var a = aberto;
    if (!a) return;
    var d = diaDe(cel);
    if (mesmo(a, d.unidadeId, d.iso)) acharDeNovo();
  }

  /* ---------- a página ---------- */

  /* a entrada na Escala, a troca de mês: a célula começa limpa (o rascunho dela sai) */
  function largar() {
    var tinha = ativo(), a = aberto;
    aberto = null;
    if (a && a.caixa) a.caixa.fechar();
    if (RW.extrajornadaCelula) RW.extrajornadaCelula.esquecer();
    dia = null;
    if (tinha) {
      E().reset();
      if (S()) S().descartar();
    }
  }

  RW.escalasCelulaEditar = {
    clique: clique,
    decorar: decorar,
    /* o dia do rodapé largo, com o painel fechado (escalas-painel-salvar.js): { unidadeId, iso, secao, unidadeNome } */
    contexto: function () {
      return ativo() ? { unidadeId: dia.unidadeId, iso: dia.iso, secao: 'distribuicao', unidadeNome: dia.unidadeNome } : null;
    },
    /* é o dia que a célula está mexendo? (o painel que abre nele continua o rascunho; a leitura antes do clique,
       escalas-celula-adiantar.js, pula esse dia) */
    ehDia: function (unidadeId, iso) { return ativo() && mesmo(dia, unidadeId, iso); },
    /* a célula abre a caixa (true), o aviso do dia antigo ('antigo') ou o painel (false)? (escalas-celula-adiantar.js lê
       o dia antes do clique só na que abre a caixa) */
    podeNaCelula: podeNaCelula,
    /* há mudança não salva no dia da célula? */
    pendente: function () { return ativo() && !!S() && S().pendente(); },
    /* o painel do dia vai abrir: a caixa fecha (o que está concluído fica) e a célula deixa o dia */
    passarAoPainel: function () {
      if (RW.extrajornadaCelula) RW.extrajornadaCelula.esquecer();
      if (!dia && !aberto) return;
      fecharTudo('guardar');
      dia = null;
    },
    /* o Ctrl+Z e o Ctrl+Y do rodapé: a caixa fecha antes */
    fechar: function () { fecharTudo(); },
    /* o Salvar, o Cancelar ou o dia mudado no banco: nada fica aberto (o rascunho já foi gravado ou descartado) */
    esquecer: function () { fecharTudo('largar'); },
    /* a troca de mês: com mudança não salva, o aviso de descartar antes; seguir() troca */
    antesDeMudar: function (seguir) {
      if (!ativo()) { if (aberto) fecharTudo(); seguir(); return; }
      if (!(S() && S().pendente())) { largar(); seguir(); return; }
      RW.escalasPainel.confirmarDescarte(function () { largar(); seguir(); }, S().contarDoDia());
    },
    largar: largar,
    /* o Oficial de Área do título (escalas-celula-oficial.js): a caixa, a peça nova com a grade refeita e o hoje − 7; a
       caixa do sobreaviso fora da grade de células (escalas-celula-sobreaviso-caixa.js) */
    abrirOficial: abrirOficial, acharDeNovo: acharDeNovo, limite: limite, abrirSobreaviso: abrirSobreaviso
  };
})();
