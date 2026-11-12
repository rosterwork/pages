/* ============================================================
   ESCALAS — o que cada item faz na caixa flutuante da célula da grade
   (escalas-celula-editar.js), no rascunho do Dia, com o mesmo código
   do painel:
   - na caixa 2: Mudar o horário do serviço (escalas-painel-horario-dia
     › criar), Dar folga neste dia e Remover deste dia (escalas-painel-
     remover › analisarDoDia), Remover da guarnição (escalas-painel-ciclo
     › perguntarSaida), Cancelar a folga e Desfazer a mudança
     (escalas-painel-militar › perguntas);
   - na hora, com o Desfazer: Cancelar a saída da guarnição, o pontual
     que sai sem pergunta e a mudança de dia ainda no rascunho;
   - o painel do dia, já na tela do item: Mudar o dia, Mudar de
     unidade, Devolver, o Remover deste dia de quem entrou de mais de um
     jeito, Mudar a extrajornada e Abrir o painel do dia;
   - o pelotão: Adicionar neste dia (ele entra nas horas livres, já no
     horário, com o banco em Contabilizar), Adicionar à guarnição
     (escalas-painel-adicionar › lerGuarnicao e desenharGuarnicao),
     Adicionar extra neste dia (escalas-celula-extra.js) e Abrir o
     painel do dia. Trocar de item: o concluído fica (um passo do
     desfazer) e o que estava pela metade sai. Não cria HTML (clona os
     moldes) nem escreve estilo. RosterWork.escalasCelulaAcoes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e os campos de cada caixa

  function api() { return RW.escalasPainelEditar.sub; }
  function msg() { return RW.mensagens.escala; }
  function L() { return RW.mensagens.escala.linha; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  /* o texto à vista do item (o título da folha do celular) */
  function textoDo(botao) { var s = botao && botao.querySelector('span'); return s ? (s.innerText || s.textContent).trim() : ''; }

  /* ---------- o ao vivo (o horário, o Remover do dia, a folga e a guarnição) ---------- */

  function vivo(a) {
    if (a.vivo) return;
    a.vivo = true;
    api().comecarVivo();
  }

  /* a resposta está pela metade? (o horário fora de onde ele pode ficar, ou a pergunta do pontual sem resposta) */
  function pelaMetade(a) {
    if (a.acao === 'horario') {
      var c = a.sessao.calcular();
      return !c.ok || (c.pergunta && !a.sessao.est.banco);
    }
    return a.acao === 'remover' && a.remocao.tipo === 'pontual' && !a.escolha;
  }

  /* o item termina: o que está concluído fica no rascunho (um passo do desfazer) e o dia é lido de novo com ele; o que
     ficou pela metade sai. modo 'guardar': fica, sem ler de novo (o painel vai abrir no dia); 'largar': sai tudo */
  function terminar(a, modo) {
    var acao = a.acao, tinha = a.vivo;
    if (acao === 'remover-guarnicao') RW.escalasPainelCiclo.fecharPergunta(modo === 'largar' ? 'largar' : 'guardar');
    var metade = tinha && (acao === 'horario' || acao === 'remover') && pelaMetade(a);
    a.vivo = false;
    a.acao = null;
    if (!tinha || !api().celula()) return;
    if (modo === 'largar') { api().largarVivo(); return; }
    if (metade) api().aoVivo(null, false);
    if (api().terminarVivo() && modo !== 'guardar') api().redesenhar();
  }

  /* a caixa fecha (escalas-celula-editar.js › fecharTudo) */
  function fechar(a, modo) {
    if (a.acao) terminar(a, modo);
  }

  /* troca de item (ou o Voltar da folha): o item de antes termina e a caixa 2 fecha */
  function encerrar(c, doVoltar) {
    var a = c.a;
    if (!a) return;
    terminar(a);
    a.sessao = null;
    a.remocao = null;
    a.escolha = null;
    a.botao = null;
    if (!doVoltar && a.caixa) a.caixa.fecharSegunda();
  }

  /* ---------- a caixa 2 do horário e do Remover do dia ---------- */

  /* a pergunta: a frase (vazia, só as respostas) e as duas respostas; naoPrimeiro: a folga (o Não descontar em cima) */
  function pergunta(caixa, cfg, aoResponder) {
    var q = function (s) { return caixa.querySelector(s); };
    var texto = q('.escala-celula-pergunta-texto'), sim = q('.escala-celula-pergunta-sim'), nao = q('.escala-celula-pergunta-nao');
    texto.textContent = cfg.texto || '';
    texto.classList.toggle('oculto', !cfg.texto);
    sim.textContent = cfg.sim;
    nao.textContent = cfg.nao;
    var opSim = sim.closest('.geral-opcao'), opNao = nao.closest('.geral-opcao');
    if (cfg.naoPrimeiro) opSim.parentNode.insertBefore(opNao, opSim);
    else opNao.parentNode.insertBefore(opSim, opNao);
    var nome = 'escala-celula-pergunta-' + (++conta);
    [].forEach.call(caixa.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.checked = r.value === cfg.escolha;
      r.addEventListener('change', function () { if (r.checked) aoResponder(r.value); });
    });
    caixa.classList.remove('oculto');
  }

  /* o conteúdo da caixa 2: no horário, os campos e a pergunta do banco de horas, quando vale; no Remover do dia, só a
     pergunta */
  function desenhar(c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-cartao');
    if (!el || !a || !a.caixa) return;
    var q = function (s) { return el.querySelector(s); };
    var horario = q('.escala-celula-cartao-horario'), caixa = q('.escala-celula-pergunta');
    if (a.acao === 'remover') {
      horario.classList.add('oculto');
      pergunta(caixa, { texto: a.remocao.texto, sim: a.remocao.sim, nao: a.remocao.nao, naoPrimeiro: a.remocao.tipo === 'folga',
        escolha: a.escolha }, function (v) { responder(c, v); });
    } else {
      var s = a.sessao, calc = s.calcular();
      var campos = RW.horario.linha({
        hi: s.est.periodo.hi, hf: s.est.periodo.hf, opcoes: s.opcoes(), erro: !calc.ok, semAcoes: true,
        aoInicio: function (h) { s.est.periodo.hi = h; mudouHorario(c); },
        aoFim: function (h) { s.est.periodo.hf = h; mudouHorario(c); }
      });
      if (campos) horario.appendChild(campos);
      if (calc.pergunta) {
        pergunta(caixa, s.pontual
          ? { texto: '', sim: calc.sim, nao: RW.mensagens.botoes.naoContabilizar, naoPrimeiro: false, escolha: s.est.banco }
          : { texto: RW.escalasPainelRemoverListas.textoFolga(calc.folga.periodos, s.nome, calc.folga.horas, diaMes(a.iso)),
            sim: calc.sim, nao: L().naoDescontar, naoPrimeiro: true, escolha: s.est.banco }, function (v) { responder(c, v); });
      }
    }
    a.caixa.segunda(a.botao, el, textoDo(a.botao));
  }

  /* o horário mudou num campo: a mudança vai ao rascunho ao vivo, e a caixa 2 mostra a pergunta, quando vale */
  function mudouHorario(c) {
    var a = c.a;
    if (!a || a.acao !== 'horario') return;
    a.sessao.aplicar();
    desenhar(c);
  }

  /* a resposta da pergunta da caixa 2 */
  function responder(c, valor) {
    var a = c.a;
    if (!a) return;
    if (a.acao === 'horario') {
      a.sessao.est.banco = valor;
      mudouHorario(c);
      return;
    }
    if (a.acao !== 'remover') return;
    a.escolha = valor;
    api().aoVivo(function () { a.remocao.aplicar(valor); }, false);
    /* o pontual respondido sai do dia: não sobra nada para a caixa */
    if (a.remocao.tipo === 'pontual') { c.fecharTudo(); return; }
    desenhar(c);
  }

  function horario(botao, c) {
    var a = c.a, sessao = RW.escalasPainelHorarioDia.criar(a.cpf, { sempreBanco: !!a.novo });
    if (!sessao) { c.fecharTudo('guardar'); c.abrirPainel(a.cpf, { fazerAcao: 'horario-dia' }); return; }
    vivo(a);
    a.acao = 'horario';
    a.sessao = sessao;
    a.botao = botao;
    sessao.lerLivres(function () { if (c.a === a && a.acao === 'horario') desenhar(c); });
    desenhar(c);
  }

  /* Dar folga (o ciclo): sai de folga, com o Não descontar marcado. Remover deste dia: o pontual sai, ou antes responde se
     as horas saem do banco; quem entrou de mais de um jeito, o remanejado e a troca: a sub-tela do painel, já com ele */
  function remover(botao, c) {
    var a = c.a, cpf = a.cpf;
    if (api().mudancaNoRascunho(cpf) === 'vem') {
      RW.escalasPainelLinhaMenu.largarMudanca(cpf, 'vem', function () {});
      c.fecharTudo();
      return;
    }
    var mil = api().militarDoDia(cpf);
    var r = mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: mil.janelas.map(copiar) }) : null;
    if (!r) return;
    if (r.tipo === 'subtela') { c.fecharTudo('guardar'); c.abrirPainel(cpf, { fazerAcao: 'remover-dia' }); return; }
    if (r.tipo === 'sai') { api().mudar(r.aplicar); c.fecharTudo(); return; }
    vivo(a);
    a.acao = 'remover';
    a.remocao = r;
    a.escolha = r.padrao;
    a.botao = botao;
    if (r.padrao) api().aoVivo(function () { r.aplicar(r.padrao); }, false);
    desenhar(c);
  }

  /* ---------- a caixa 2 das perguntas do painel (a guarnição, a folga e a mudança) ---------- */

  /* Remover da guarnição: a pergunta Último serviço do painel, dentro da caixa 2 (o Cancelar dela volta e fecha a caixa 2) */
  function sairDaGuarnicao(botao, c) {
    var a = c.a, caixa = RW.tpl('tpl-escala-celula-perguntas');
    if (!caixa) return;
    a.acao = 'remover-guarnicao';
    a.botao = botao;
    RW.escalasPainelCiclo.perguntarSaida(a.cfg.militar, null, {
      dentro: caixa,
      aoCancelar: function () { if (c.a === a) { a.acao = null; a.caixa.fecharSegunda(); } }
    });
    a.caixa.segunda(botao, caixa, textoDo(botao));
  }

  /* Cancelar a folga e Desfazer a mudança: a pergunta do painel, já com a escolha (que já vale, ao vivo) */
  function folga(botao, c, escolha) {
    var a = c.a, caixa = RW.tpl('tpl-escala-celula-perguntas');
    if (!caixa || !a.cfg.folga) return;
    vivo(a);
    a.acao = 'folga';
    a.botao = botao;
    if (!RW.escalasPainelMilitar.perguntas(caixa, a.cfg.folga.lancamento_id, escolha)) { encerrar(c); return; }
    a.caixa.segunda(botao, caixa, textoDo(botao));
  }

  /* ---------- os itens do nome ---------- */

  var ACOES = {
    'horario-dia': horario,
    'remover-dia': remover,
    'folga-dia': remover,
    'remover-guarnicao': sairDaGuarnicao,
    'cancelar-folga': function (botao, c) { folga(botao, c, 'cancelar'); },
    'desfazer-mudanca': function (botao, c) {
      var cpf = c.a.cpf;
      if (api().mudancaNoRascunho(cpf) === 'sai') {
        RW.escalasPainelLinhaMenu.largarMudanca(cpf, 'sai', function () {});
        c.fecharTudo();
        return;
      }
      folga(botao, c, 'desfazer');
    },
    /* a saída marcada sai do rascunho, na hora (o Desfazer volta) */
    'cancelar-saida': function (botao, c) {
      RW.escalasPainelCiclo.cancelarSaida(c.a.cfg.militar, c.a.cfg.saida);
      c.fecharTudo();
    },
    'mudar-dia': painelNo('mudar-dia'),
    'mudar-unidade': painelNo('mudar-unidade'),
    devolver: painelNo('devolver'),
    'mudar-extra': function (botao, c) { c.fecharTudo('guardar'); c.abrirPainel(null, { secao: 'extra' }); },
    'abrir-painel': function (botao, c) { var cpf = c.a.cpf; c.fecharTudo('guardar'); c.abrirPainel(cpf); }
  };

  /* o painel do dia, já na tela do item, com ele */
  function painelNo(acao) {
    return function (botao, c) { var cpf = c.a.cpf; c.fecharTudo('guardar'); c.abrirPainel(cpf, { fazerAcao: acao }); };
  }

  /* um item do menu do nome: o mesmo item de novo não faz nada; outro termina o de antes */
  function fazer(acao, botao, c) {
    var a = c.a;
    if (!a || !ACOES[acao] || !api().livre()) return;
    if (a.botao === botao && a.acao) return;
    encerrar(c);
    ACOES[acao](botao, c);
  }

  /* a setinha do Remover deste dia só quando ele abre a caixa 2 (o Dar folga sempre abre); o resto sai na hora ou no painel */
  function prepararMenu(c, menu) {
    var a = c.a;
    if (!a || !menu) return;
    var mil = api().militarDoDia(a.cpf);
    var r = mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: a.cpf, periodos: mil.janelas.map(copiar) }) : null;
    var seta = menu.querySelector('[data-acao="remover-dia"] .escala-edicao-opcoes-seta');
    if (seta) seta.classList.toggle('oculto', !r || r.tipo === 'sai' || r.tipo === 'subtela');
  }

  /* o militar que acabou de entrar já abre no horário */
  function aoMostrarMenu(c, menu) {
    var a = c.a;
    if (!a || !menu || !a.novo) return;
    var b = menu.querySelector('[data-acao="horario-dia"]');
    if (b && !b.classList.contains('oculto')) fazer('horario-dia', b, c);
    a.novo = false;
  }

  /* o dia chegou de novo com a caixa 2 aberta: o horário e a pergunta se refazem com ele */
  function chegou(c) {
    var a = c.a;
    if (a && (a.acao === 'horario' || a.acao === 'remover')) desenhar(c);
  }

  /* ---------- o pelotão ---------- */

  /* a caixa 1 do pelotão, com a letra da guarnição do dia */
  function menuDoPelotao(c) {
    var el = RW.tpl('tpl-escala-celula-pelotao');
    if (!el) return null;
    var letra = (api().dados() || {}).guarnicao || null;
    el.querySelector('.escala-celula-letra').textContent = letra || '';
    el.querySelector('.escala-celula-sem-letra').classList.toggle('oculto', !!letra);
    RW.escalasCelulaExtra.prepararItem(el.querySelector('[data-acao="extra"]'), c.dia);
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazerNoPelotao(b.getAttribute('data-acao'), b, c); });
    });
    return el;
  }

  function fazerNoPelotao(acao, botao, c) {
    var a = c.a;
    if (!a || a.caixa === null || !api().livre()) return;
    if (a.botao === botao && a.acao) return;
    encerrar(c);
    if (acao === 'painel') { c.fecharTudo('guardar'); c.abrirPainel(null); }
    else if (acao === 'neste-dia') nesteDia(botao, c);
    else if (acao === 'guarnicao') naGuarnicao(botao, c);
    else if (acao === 'extra') RW.escalasCelulaExtra.adicionar(botao, c);
  }

  /* Adicionar neste dia: o campo, com quem tem horas livres no dia, por pelotão (o do bloco primeiro) */
  function nesteDia(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-adicionar');
    if (!el) return;
    a.acao = 'neste-dia';
    a.botao = botao;
    var inp = el.querySelector('input'), menu = el.querySelector('.dropdown-menu');
    inp.id = 'escala-celula-adicionar-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return null; },
      aoEscolher: function (item) { escolher(item, c); },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
    });
    combo.habilitar(false);
    combo.definir(L().carregando, true);
    a.caixa.segunda(botao, el, textoDo(botao));
    RW.escalasDados.disponiveis(a.unidadeId, a.iso, a.unidadeId).then(function (r) {
      if (c.a !== a || a.acao !== 'neste-dia' || !el.isConnected) return;
      if (!r) { combo.definir(msg().falhaCarregar, true); return; }
      var Ls = RW.escalasPainelAdicionarListas, lista = [];
      Ls.unidadesDia(r).forEach(function (u) {
        var itens = Ls.dia(r, u.id);
        if (itens.length) lista = lista.concat([{ titulo: u.nome }], itens);
      });
      if (!combo.preencher(lista)) return;
      inp.focus(); combo.abrir();
    });
  }

  /* escolhido o nome: ele entra no dia nas horas livres dele, o sistema distribui o dia (como o Adicionar do painel), com
     as horas no banco; a caixa dele abre quando o dia vem com ele */
  function escolher(item, c) {
    var m = item.m;
    var periodos = (m.livres || []).length ? m.livres.map(copiar) : [{ hi: '08:00', hf: '08:00' }];
    c.fecharTudo();
    api().mudar(function () {
      api().aplicarColocacao({ cpf: item.cpf, periodos: periodos, sistema: true, refazer: true, pontual: { contabilizar: true } });
    });
    c.abrirNovo(item.cpf);
  }

  /* Adicionar à guarnição: o campo de quem pode entrar na guarnição do dia e, escolhido, a peça do Adicionar militar do
     painel (a frase e, para quem muda de guarnição, o que acontece), no rascunho das guarnições, ao vivo */
  function naGuarnicao(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-guarnicao');
    if (!el) return;
    var q = function (s) { return el.querySelector(s); };
    var P = RW.escalasPainelAdicionar, letra = (api().dados() || {}).guarnicao || null;
    vivo(a);
    a.acao = 'guarnicao';
    a.botao = botao;
    var escolhido = null;
    var g = {
      uid: a.unidadeId, iso: a.iso, letra: letra,
      mudar: q('.escala-celula-guarnicao-mudar'), info: q('.escala-celula-guarnicao-info'),
      efeito: RW.escalasPainelCiclo.efeito(q('.escala-celula-guarnicao-efeito')),
      analise: { chave: '', aviso: null, pedido: 0 },
      vale: function () { return el.isConnected; },
      aoLer: function (m) { if (escolhido && escolhido.m === m) P.desenharGuarnicao(m, g); }
    };
    var inp = el.querySelector('input'), menu = el.querySelector('.dropdown-menu');
    inp.id = 'escala-celula-guarnicao-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return escolhido; },
      aoEscolher: function (item) { escolhido = item; g.efeito.esconder(); P.desenharGuarnicao(item.m, g); },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
    });
    combo.habilitar(false);
    combo.definir(L().carregando, true);
    a.caixa.segunda(botao, el, textoDo(botao));
    P.lerGuarnicao(a.unidadeId, a.iso, letra).then(function (r) {
      if (c.a !== a || a.acao !== 'guarnicao' || !el.isConnected) return;
      if (!r) { combo.definir(msg().falhaCarregar, true); return; }
      if (!combo.preencher(r)) return;
      inp.focus(); combo.abrir();
    });
  }

  RW.escalasCelulaAcoes = {
    fazer: fazer, menuDoPelotao: menuDoPelotao, prepararMenu: prepararMenu, aoMostrarMenu: aoMostrarMenu, chegou: chegou,
    encerrar: encerrar,
    fechar: fechar
  };
})();
