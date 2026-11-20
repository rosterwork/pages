/* ============================================================
   ESCALAS — o que cada item faz na caixa flutuante da célula da grade
   (escalas-celula-editar.js), no rascunho do Dia, com o mesmo código
   do painel:
   - na caixa 2: Mudar o horário do serviço (escalas-painel-horario-dia
     › criar), Mudar onde fica do estagiário (escalas-painel-onde ›
     estagio), Dar folga neste dia e Remover deste dia (escalas-painel-
     remover › analisarDoDia), Remover da guarnição (escalas-painel-ciclo
     › perguntarSaida), Cancelar a folga e Desfazer a mudança
     (escalas-painel-militar › perguntas);
   - na hora, com o Desfazer: Cancelar a saída da guarnição, o pontual
     que sai sem pergunta e a mudança de dia ainda no rascunho;
   - o painel do dia, já na tela do item: Mudar o dia, Mudar de
     unidade, Registrar troca, Devolver, o Remover deste dia de quem
     entrou de mais de um jeito, Mudar a extrajornada e o painel;
   - o pelotão: Adicionar neste dia (escolhido o nome, ele já entra no
     dia, ao vivo, nas horas livres, e a linha dele aparece na célula na
     hora; a caixa continua com o horário e o banco de horas, com o
     Contabilizar marcado; o mesmo no nome em vermelho do Fora da
     escala, já com ele), Adicionar à guarnição
     (escalas-painel-adicionar › lerGuarnicao e desenharGuarnicao; o
     mesmo no nome em vermelho do Fora da escala, escalas-celula-fora.js),
     Adicionar extra neste dia (escalas-celula-extra.js), Trazer de
     outra unidade (o painel, já no Trazer), Voltar o dia ao automático
     (a confirmação do painel) e Abrir o painel do dia. O Oficial de Área do título (escalas-celula-
     oficial.js) usa o campo do Adicionar, o Remover e a pergunta, e o
     Pôr como Oficial de Área do nome vai para ele. A lista do campo de
     militar da caixa 2 mostra as faixas enquanto chega, e as do pelotão
     já começam a ser lidas quando a caixa 1 dele aparece. Trocar
     de item: o concluído fica (um passo do desfazer) e o que estava pela
     metade sai. Não cria HTML (clona os moldes) nem escreve estilo.
     RosterWork.escalasCelulaAcoes.
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

  function vivo(a) { if (!a.vivo) { a.vivo = true; api().comecarVivo(); } }

  /* a resposta está pela metade? (o horário fora de onde ele pode ficar, a pergunta do pontual sem resposta, ou a do
     Oficial de Área que vem de um pelotão, se sai de lá ou fica nas duas, escalas-celula-oficial.js) */
  function pelaMetade(a) {
    if (a.acao === 'horario') {
      var c = a.sessao.calcular();
      return !c.ok || (c.pergunta && !a.sessao.est.banco);
    }
    return (!!a.remocao && a.remocao.tipo === 'pontual' && !a.escolha) || !!a.origemFalta;
  }

  /* o item termina: o que está concluído fica no rascunho (um passo do desfazer) e o dia é lido de novo com ele; o que
     ficou pela metade sai. modo 'guardar': fica, sem ler de novo (o painel vai abrir no dia); 'largar': sai tudo */
  function terminar(a, modo) {
    var acao = a.acao, tinha = a.vivo;
    if (acao === 'remover-guarnicao') RW.escalasPainelCiclo.fecharPergunta(modo === 'largar' ? 'largar' : 'guardar');
    var metade = tinha && (acao === 'horario' || !!a.remocao || !!a.origemFalta) && pelaMetade(a);
    a.origemFalta = false;
    a.vivo = false;
    a.acao = null;
    if (!tinha || !api().diaAberto()) return;   // o dia da célula, ou o do painel aberto nele
    if (modo === 'largar') { api().largarVivo(); return; }
    if (metade) api().aoVivo(null, false);
    if (api().terminarVivo() && modo !== 'guardar') api().redesenhar();
  }

  /* a caixa fecha (escalas-celula-editar.js › fecharTudo) */
  function fechar(a, modo) { if (a.acao) terminar(a, modo); }

  /* troca de item (ou o Voltar da folha): o item de antes termina e a caixa 2 fecha */
  function encerrar(c, doVoltar) {
    var a = c.a;
    if (!a) return;
    terminar(a);
    a.sessao = null;
    a.remocao = null;
    a.entrada = null;
    a.sairam = null;
    a.escolha = a.escolhido = null;
    a.botao = null;
    if (!doVoltar && a.caixa) a.caixa.fecharSegunda();
  }

  /* ---------- a caixa 2 do horário e do Remover do dia ---------- */

  /* a pergunta: a frase (vazia, só as respostas) e as duas respostas; naoPrimeiro: a folga (o Não descontar em cima, e o
     Motivo dela embaixo das respostas: cfg.motivo, de motivoDaFolga) */
  function pergunta(caixa, cfg, aoResponder) {
    var q = function (s) { return caixa.querySelector(s); };
    var texto = q('.escala-celula-pergunta-texto'), sim = q('.escala-celula-pergunta-sim'), nao = q('.escala-celula-pergunta-nao');
    texto.textContent = cfg.texto || '';
    texto.classList.toggle('oculto', !cfg.texto);
    if (cfg.motivo) RW.escalasPainelRemoverListas.campoMotivo(caixa, cfg.motivo.valor, cfg.motivo.aoMudar, cfg.motivo.aoEnter, true);
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
        escolha: a.escolha, motivo: a.remocao.tipo === 'folga' && motivoDaFolga(c) }, function (v) { responder(c, v); });
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
          ? { texto: '', sim: calc.sim, nao: calc.nao, naoPrimeiro: false, escolha: s.est.banco }
          : { texto: RW.escalasPainelRemoverListas.textoFolga(calc.folga.periodos, s.nome, calc.folga.horas, diaMes(a.iso)),
            sim: calc.sim, nao: L().naoDescontar, naoPrimeiro: true, escolha: s.est.banco, motivo: motivoDaFolga(c) }, function (v) { responder(c, v); });
      }
    }
    a.el2 = el;   // a pergunta que falta é marcada nela (mostrarFalta)
    a.caixa.segunda(a.botao, el, textoDo(a.botao));
  }

  /* o clique fora (ou no rodapé largo) pode fechar a caixa? Com a resposta pela metade, não: a pergunta que falta fica
     marcada e a frase aparece embaixo (escalas-celula-editar.js › aoClicarFora). O Cancelar do rodapé fecha (desiste) */
  function podeFechar(c, alvo) {
    var a = c.a;
    if (!a || !a.acao || !a.vivo || (alvo && alvo.closest && alvo.closest('.escala-painel-cancelar'))) return true;
    if (!pelaMetade(a)) return true;
    mostrarFalta(a);
    return false;
  }
  /* a pergunta que falta (a do banco de horas, ou a do Remover do dia) com a borda de erro; o horário fora de onde ele
     pode ficar já está em vermelho. Embaixo da caixa 2, a frase de responder ou fechar */
  function mostrarFalta(a) {
    var el = a.el2;
    if (!el || !el.isConnected) return;
    var p = el.querySelector('.escala-celula-pergunta:not(.oculto)');
    if (p) p.classList.add('escala-celula-pergunta--falta');
    if (el.querySelector('.escala-celula-falta')) return;
    var nota = RW.tpl('tpl-escala-nota');
    if (!nota) return;
    nota.classList.add('nota--erro', 'escala-celula-falta');
    nota.querySelector('.nota-texto').textContent = msg().responderOuDesistir;
    el.appendChild(nota);
  }

  /* o Motivo da folga (a do Remover do dia e as horas que viram folga no horário): ao rascunho a cada letra; o Enter fecha */
  function motivoDaFolga(c) {
    var a = c.a, s = a.acao === 'horario' ? a.sessao : null;
    return { valor: s ? s.est.motivo : a.motivo, aoEnter: function () { c.fecharTudo(); }, aoMudar: function (t) {
      if (s) { s.est.motivo = t; s.aplicar(); } else { a.motivo = t; api().aoVivo(function () { a.remocao.aplicar(a.escolha, t); }, false); }
    } };
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
    api().aoVivo(function () { a.remocao.aplicar(valor, a.motivo); }, false);
    /* o pontual respondido sai do dia: não sobra nada para a caixa (o Oficial do título sai dele na hora) */
    if (a.remocao.tipo === 'pontual') { c.fecharTudo(); if (a.aoTirarDoDia) a.aoTirarDoDia(); return; }
    desenhar(c);
  }

  function horario(botao, c) {
    var a = c.a, sessao = RW.escalasPainelHorarioDia.criar(a.cpf);
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
    if (r.tipo === 'sai') { api().mudar(r.aplicar); c.fecharTudo(); if (a.aoTirarDoDia) a.aoTirarDoDia(); return; }
    vivo(a);
    a.acao = 'remover';
    a.remocao = r;
    a.escolha = r.padrao;
    a.motivo = r.motivo || '';
    a.botao = botao;
    if (r.padrao) api().aoVivo(function () { r.aplicar(r.padrao, a.motivo); }, false);
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

  /* ---------- a caixa 2 do Mudar onde fica (o estagiário) ---------- */

  /* uma caixa de marcar por posto do estágio dele (todas = o sistema distribui; pelo menos uma); a escolha vai na hora ao
     rascunho (a mesma do Onde fica do Adicionar: RosterWork.escalasPainelOnde.estagio) */
  function ondeFica(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-onde'), E = RW.escalasPainelOnde.estagio;
    var dados = api().dados(), linhas = dados && dados.estagios && dados.estagios[a.cpf];
    if (!el || !linhas) return;
    var lista = E.postos(linhas, dados), atuais = E.marcadas(a.cpf, linhas, dados);
    var marcar = RW.escalasPainelQuem.marcar(el.querySelector('.escala-marcar-lista'),
      lista.map(function (v, i) { return { texto: v.texto, marcado: atuais.indexOf(i) >= 0 }; }),
      function (indices) {
        if (!indices.length) { marcar(atuais); return; }
        atuais = indices;
        api().aoVivo(function () { E.aplicar(a.cpf, indices, linhas, dados); }, false);
      });
    vivo(a);
    a.acao = 'onde';
    a.botao = botao;
    a.caixa.segunda(botao, el, textoDo(botao));
  }

  /* ---------- os itens do nome ---------- */

  var ACOES = {
    'horario-dia': horario,
    'onde-estagio': ondeFica,
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
    'registrar-troca': painelNo('registrar-troca'),
    /* a caixa 2 com a pergunta se ele sai daqui ou fica nas duas (o cartão da célula, sem o horário); a resposta faz */
    'oficial-area': function (botao, c) {
      var a = c.a, el = RW.tpl('tpl-escala-celula-cartao');
      if (!el) return;
      a.acao = 'oficial-area';
      a.botao = botao;
      el.querySelector('.escala-celula-cartao-horario').classList.add('oculto');
      RW.escalasCelulaOficial.perguntarComo(el.querySelector('.escala-celula-pergunta'), a.cpf, function () { c.fecharTudo(); });
      a.caixa.segunda(botao, el, textoDo(botao));
    },
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

  /* o sinal do Remover deste dia: a setinha quando ele abre a caixa 2 (o Dar folga sempre abre), o ícone do painel quando
     vai ao painel (quem entrou de mais de um jeito, o remanejado e a troca) e nenhum quando sai na hora */
  function prepararMenu(c, menu) {
    var a = c.a;
    if (!a || !menu) return;
    var mil = api().militarDoDia(a.cpf);
    var r = mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: a.cpf, periodos: mil.janelas.map(copiar) }) : null;
    var seta = menu.querySelector('[data-acao="remover-dia"] .escala-edicao-opcoes-seta');
    var painel = menu.querySelector('[data-acao="remover-dia"] .escala-edicao-opcoes-painel');
    if (seta) seta.classList.toggle('oculto', !r || r.tipo === 'sai' || r.tipo === 'subtela');
    if (painel) painel.classList.toggle('oculto', !r || r.tipo !== 'subtela');
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
  function chegou(c) { var a = c.a; if (a && (a.acao === 'horario' || a.acao === 'remover')) desenhar(c); }

  /* ---------- o pelotão ---------- */

  /* o molde da caixa 1 do pelotão nesta página: o da Escala, ou o da página Estágios (o Adicionar estagiário e o Abrir o
     painel do dia; RosterWork.paginaFiltrada) */
  function moldeDoPelotao() {
    var pf = RW.paginaFiltrada && RW.paginaFiltrada();
    return (pf && pf.moldePelotao) || 'tpl-escala-celula-pelotao';
  }

  /* a caixa 1 do pelotão, com a letra da guarnição do dia */
  function menuDoPelotao(c) {
    var el = RW.tpl(moldeDoPelotao());
    if (!el) return null;
    var letra = (api().dados() || {}).guarnicao || null, comLetra = el.querySelector('.escala-celula-letra');
    if (comLetra) {
      comLetra.textContent = letra || '';
      el.querySelector('.escala-celula-sem-letra').classList.toggle('oculto', !!letra);
    }
    var extra = el.querySelector('[data-acao="extra"]');
    if (extra) RW.escalasCelulaExtra.prepararItem(extra, c.dia);
    /* o Trazer, para quem administra outra unidade da companhia; o Voltar ao automático, com ajuste manual no dia */
    var trazer = el.querySelector('[data-acao="trazer"]'), automatico = el.querySelector('[data-acao="automatico"]');
    if (trazer) trazer.classList.toggle('oculto', !(RW.escalasPainelRemanejar && RW.escalasPainelRemanejar.podeTrazer()));
    if (automatico) automatico.classList.toggle('oculto', !api().podeVoltarAoAutomatico());
    /* o Adicionar estagiário: a unidade tem estágio no dia */
    var estagiario = el.querySelector('[data-acao="estagiario"]');
    if (estagiario) estagiario.classList.toggle('oculto', !((api().dados() || {}).estagios_unidade || []).length);
    /* as listas da caixa 2 dos itens à vista já começam a ser lidas (escalas-dados.js guarda): quase sempre chegam antes do
       clique no item */
    var aVista = function (s) { var b = el.querySelector(s); return !!b && !b.classList.contains('oculto'); };
    if (RW.escalasDados && c.a) {
      RW.escalasDados.adiantarListas(c.a.unidadeId, c.a.iso, { disponiveis: aVista('[data-acao="neste-dia"]') || aVista('[data-acao="estagiario"]'),
        guarnicao: aVista('[data-acao="guarnicao"]') });
    }
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
    else if (acao === 'trazer') { c.fecharTudo('guardar'); c.abrirPainel(null, { trazer: true }); }
    else if (acao === 'automatico') { c.fecharTudo(); api().voltarAoAutomatico(); }
    else if (acao === 'neste-dia') nesteDia(botao, c);
    else if (acao === 'estagiario') adicionarEstagiario(botao, c);
    else if (acao === 'guarnicao') naGuarnicao(botao, c);
    else if (acao === 'extra') RW.escalasCelulaExtra.adicionar(botao, c);
  }

  /* a lista do campo de militar da caixa 2 enquanto chega: o campo desligado e, se ela não chegou até a caixa 2 parar no
     lugar, o menu aberto com as faixas (a forma da caixa flutuante). Devolve quandoChegar(fn): fn põe a lista, com a caixa
     parada e quando as faixas que apareceram cumpriram o mínimo na tela (não piscam) */
  function faixasNaLista(combo, menu) {
    var esperando = true, em = null;
    combo.habilitar(false);
    combo.definir(L().digiteOuEscolha, true);
    /* com a caixa 2 parada (o clique do item, que fecha os menus abertos, também já passou) */
    quandoParada(menu, function () {
      var forma = esperando && menu.isConnected && RW.tpl('tpl-caixa-flutuante-forma');
      if (!forma) return;
      menu.textContent = '';
      menu.appendChild(forma);
      combo.abrir();
      em = performance.now();
    });
    return function quandoChegar(fn) {
      esperando = false;
      quandoParada(menu, function () {
        var falta = em != null && RW.etapas ? RW.etapas.falta(em, null) : 0;
        if (falta > 0) setTimeout(fn, falta); else fn();
      });
    };
  }
  /* o menu do campo é fixo na tela: aberto enquanto a caixa 2 ainda entra (a animação mexe no transform dela), ele ficaria
     fora do lugar até ela parar; e aberto dentro do clique do item, o próprio clique o fecharia (geral-dropdown.js). fn roda
     no quadro seguinte, ou no primeiro em que ela já parou (no máximo uns 30 quadros) */
  function quandoParada(el, fn) {
    var caixa = el.closest('.caixa-flutuante'), quadros = 0;
    requestAnimationFrame(function ver() {
      if (!caixa || !caixa.isConnected || getComputedStyle(caixa).transform === 'none' || ++quadros > 30) { fn(); return; }
      requestAnimationFrame(ver);
    });
  }
  /* a lista não abre (a leitura falhou ou ninguém pode entrar; comItens: ele já vem escolhido, e a lista fica para trocar):
     o menu das faixas fecha */
  function fecharLista(combo, comItens) {
    if (!comItens) combo.esvaziar();
    if (RW.fecharDropdowns) RW.fecharDropdowns();
  }

  /* Adicionar neste dia: o campo, com quem tem horas livres no dia, por pelotão (o do bloco primeiro). oficial (o Oficial
     de Área do título, escalas-celula-oficial.js): { el, acao, aoEscolher }, só os subtenentes e oficiais. cpf: quem está
     fora da escala, clicado na grade (escalas-celula-fora.js), já vem escolhido; sem horas livres, o aviso */
  function nesteDia(botao, c, oficial, cpf) {
    var a = c.a, el = oficial ? oficial.el : RW.tpl('tpl-escala-celula-adicionar');
    if (!el) return;
    a.acao = oficial ? oficial.acao : 'neste-dia';
    a.botao = botao;
    var inp = el.querySelector('input'), menu = el.querySelector('.dropdown-menu');
    inp.id = 'escala-celula-adicionar-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return a.escolhido || null; },
      aoEscolher: function (item) { if (oficial) oficial.aoEscolher(item); else escolherNaCaixa(item, c, el); },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
    });
    a.caixa.segunda(botao, el, textoDo(botao));
    var quandoChegar = faixasNaLista(combo, menu);
    /* fora da escala sem horas livres no dia: o aviso, e a caixa 2 fecha */
    function semHoras() { RW.avisar({ tipo: 'aviso', mensagem: msg().foraSemHoras }); a.acao = null; a.botao = null; a.caixa.fecharSegunda(); }
    RW.escalasDados.disponiveis(a.unidadeId, a.iso, a.unidadeId, null, !!oficial).then(function (r) {
      quandoChegar(function () {
        if (c.a !== a || a.acao !== (oficial ? oficial.acao : 'neste-dia') || !el.isConnected) return;
        if (!r) { fecharLista(combo); combo.definir(msg().falhaCarregar, true); return; }
        var Ls = RW.escalasPainelAdicionarListas, lista = [];
        /* quem seria estagiário fica fora: ele entra pelo Adicionar estagiário */
        Ls.unidadesDia(r).forEach(function (u) {
          var itens = Ls.dia(r, u.id).filter(function (it) { return oficial || !(it.m && it.m.estagio); });
          if (itens.length) lista = lista.concat([{ titulo: u.nome }], itens);
        });
        var dele = cpf ? lista.filter(function (x) { return x.cpf === cpf; })[0] : null;
        if (!combo.preencher(lista)) { fecharLista(combo); if (cpf) semHoras(); return; }
        if (cpf && !dele) { fecharLista(combo); semHoras(); return; }
        if (dele) { fecharLista(combo, true); escolherNaCaixa(dele, c, el); combo.mostrarAtual(); return; }
        inp.focus(); combo.abrir();
      });
    });
  }

  /* ---------- quem entra pelo Adicionar neste dia: o horário e o banco de horas, na mesma caixa ---------- */

  /* escolhido o nome: ele já entra no dia, ao vivo, nas horas livres dele (sem elas, o dia todo; o sistema distribui o
     dia), com o Contabilizar marcado (o estagiário, sem pergunta: as horas dele são só registro); a linha dele aparece na
     célula na hora, e a caixa ganha o horário e a pergunta. Outro nome no campo põe o novo no lugar */
  function escolherNaCaixa(item, c, el) {
    var a = c.a;
    if (!a || a.acao !== 'neste-dia') return;
    if (a.escolhido && a.escolhido.cpf !== item.cpf) {
      a.sairam = (a.sairam || []).concat([a.escolhido.cpf]);
      RW.escalasDiaNaGrade.tirarNova(a.unidadeId, a.iso, a.escolhido.cpf);
    }
    a.escolhido = item;
    var livres = (item.m.livres || []).length ? item.m.livres.map(copiar) : [{ hi: '08:00', hf: '08:00' }];
    a.entrada = { livres: livres, periodos: livres.map(copiar), valido: livres.map(copiar), ok: true,
      banco: item.m.estagio ? null : 'sim' };
    vivo(a);
    aplicarEntrada(c);
    desenharEntrada(c, el);
  }

  /* cada horário cabe no seu pedaço de horas livres */
  function entradaOk(e) {
    var H = api().horas;
    return e.periodos.every(function (p, i) {
      var f = H.faixa(p), w = H.faixa(e.livres[i]);
      return f[1] > f[0] && f[0] >= w[0] && f[1] <= w[1];
    });
  }

  /* a entrada no rascunho, ao vivo, e a linha dele na célula; o horário fora das horas livres fica vermelho, o rascunho
     guarda o último que cabia e o Salvar fica desligado até resolver (ao fechar a caixa, vale o último que cabia) */
  function aplicarEntrada(c) {
    var a = c.a, e = a.entrada, item = a.escolhido;
    e.ok = entradaOk(e);
    if (e.ok) e.valido = e.periodos.map(copiar);
    var periodos = e.valido.map(copiar);
    api().aoVivo(function () {
      api().aplicarColocacao({ cpf: item.cpf, periodos: periodos, sistema: true, refazer: true, pontual: { contabilizar: e.banco === 'sim' } });
    }, !e.ok);
    porNovaDe(a);
  }

  /* a linha dele na célula, com o horário do rascunho */
  function porNovaDe(a) {
    var item = a.escolhido;
    RW.escalasDiaNaGrade.porNova(a.unidadeId, a.iso, { cpf: item.cpf, grad: item.m.grad, nome: item.m.nome, rg: item.m.rg,
      periodos: a.entrada.valido.map(function (p) { return { inicio: p.hi, fim: p.hf }; }) });
  }

  /* a célula do dia foi refeita com a caixa do Adicionar aberta (a leitura pode ser de antes da última mudança): a linha
     de quem está entrando volta com o horário do rascunho, e a de quem foi trocado no campo sai */
  function reporNova(c) {
    var a = c.a;
    if (!a || a.acao !== 'neste-dia' || !a.entrada || !a.escolhido) return;
    (a.sairam || []).forEach(function (cpf) { if (cpf !== a.escolhido.cpf) RW.escalasDiaNaGrade.tirarNova(a.unidadeId, a.iso, cpf); });
    porNovaDe(a);
  }

  /* o horário (um campo por pedaço de horas livres) e a pergunta do banco de horas, embaixo do campo do nome */
  function desenharEntrada(c, el) {
    var a = c.a, e = a.entrada, H = api().horas;
    var lugar = el.querySelector('.escala-celula-adicionar-entrada'), cartao = RW.tpl('tpl-escala-celula-cartao');
    if (!lugar || !cartao) return;
    var horario = cartao.querySelector('.escala-celula-cartao-horario');
    e.periodos.forEach(function (p, i) {
      var linha = RW.horario.linha({ hi: p.hi, hf: p.hf, opcoes: H.opcoesHoras([e.livres[i]]), erro: !e.ok, semAcoes: true,
        aoInicio: function (h) { p.hi = h; mudouEntrada(c, el); },
        aoFim: function (h) { p.hf = h; mudouEntrada(c, el); } });
      if (linha) horario.appendChild(linha);
    });
    if (e.banco) {
      var minutos = H.uniao(e.valido.map(H.faixa)).reduce(function (t, f) { return t + f[1] - f[0]; }, 0);
      pergunta(cartao.querySelector('.escala-celula-pergunta'), { texto: '', sim: L().bancoSim(H.horasTexto(minutos)),
        nao: RW.mensagens.botoes.naoContabilizar, naoPrimeiro: false, escolha: e.banco }, function (v) { e.banco = v; mudouEntrada(c, el); });
    }
    lugar.textContent = '';
    lugar.appendChild(cartao);
    lugar.classList.remove('oculto');
  }

  function mudouEntrada(c, el) {
    var a = c.a;
    if (!a || a.acao !== 'neste-dia' || !a.entrada) return;
    aplicarEntrada(c);
    desenharEntrada(c, el);
  }

  /* Adicionar estagiário: o campo com quem participa do estágio, livre no dia; com mais de um estágio na unidade no dia, a
     escolha do estágio em cima (as bolinhas), e o campo mostra só os dele. Escolhido, ele entra como no Adicionar neste dia
     (o sistema distribui; as horas, só registro) e, se o filtro da Escala esconde os estagiários, ele volta a mostrar */
  function adicionarEstagiario(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-estagiario');
    if (!el) return;
    a.acao = 'estagiario';
    a.botao = botao;
    var estagios = (api().dados() || {}).estagios_unidade || [], escolhido = estagios.length ? estagios[0].id : null;
    var inp = el.querySelector('input'), menu = el.querySelector('.dropdown-menu'), resposta = null;
    inp.id = 'escala-celula-estagiario-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return a.escolhido || null; },
      aoEscolher: function (item) {
        if (RW.escalasFiltros && RW.escalasFiltros.mostrarSituacao) RW.escalasFiltros.mostrarSituacao('estagio');
        escolher(item, c);
      },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
    });
    /* a lista do estágio escolhido, com o nome dele em cima */
    function preencher() {
      if (!resposta) return;
      var est = estagios.filter(function (e) { return e.id === escolhido; })[0];
      var itens = [];
      RW.escalasPainelAdicionarListas.unidadesDia(resposta).forEach(function (u) {
        itens = itens.concat(RW.escalasPainelAdicionarListas.dia(resposta, u.id)
          .filter(function (it) { return it.m && it.m.estagio && it.m.estagio_id === escolhido; }));
      });
      combo.preencher(itens.length ? [{ titulo: est ? est.nome : '' }].concat(itens) : []);
    }
    /* dois estágios ou mais: as bolinhas */
    var lugar = el.querySelector('.escala-celula-estagios');
    if (estagios.length > 1) {
      var nome = 'escala-celula-estagio-' + (++conta);
      estagios.forEach(function (e) {
        var op = RW.tpl('tpl-escala-onde-fica-vaga');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.checked = e.id === escolhido;
        op.querySelector('.escala-onde-fica-vaga-texto').textContent = e.nome;
        r.addEventListener('change', function () { if (r.checked) { escolhido = e.id; preencher(); inp.focus(); combo.abrir(); } });
        lugar.appendChild(op);
      });
      lugar.classList.remove('oculto');
    }
    a.caixa.segunda(botao, el, textoDo(botao));
    var quandoChegar = faixasNaLista(combo, menu);
    RW.escalasDados.disponiveis(a.unidadeId, a.iso, a.unidadeId, null, false).then(function (r) {
      quandoChegar(function () {
        if (c.a !== a || a.acao !== 'estagiario' || !el.isConnected) return;
        if (!r) { fecharLista(combo); combo.definir(msg().falhaCarregar, true); return; }
        resposta = r;
        preencher();
        inp.focus(); combo.abrir();
      });
    });
  }

  /* quem entra pelo Adicionar: nas horas livres dele (sem elas, o dia todo), e o sistema distribui o dia (como o Adicionar
     do painel), com as horas no banco (o estagiário, não: as horas dele são só registro) */
  function entrada(item) {
    var livres = item.m.livres || [];
    return { cpf: item.cpf, periodos: livres.length ? livres.map(copiar) : [{ hi: '08:00', hf: '08:00' }], sistema: true,
      refazer: true, pontual: { contabilizar: !item.m.estagio } };
  }

  /* escolhido o estagiário: ele entra no dia, e a caixa dele abre quando o dia vem com ele */
  function escolher(item, c) {
    c.fecharTudo();
    api().mudar(function () { api().aplicarColocacao(entrada(item)); });
    c.abrirNovo(item.cpf);
  }

  /* Adicionar à guarnição: o campo de quem pode entrar na guarnição do dia e, escolhido, a peça do Adicionar militar do
     painel (a frase e, para quem muda de guarnição, o que acontece), no rascunho das guarnições, ao vivo */
  function naGuarnicao(botao, c, cpf) {
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
      mudar: q('.escala-celula-guarnicao-mudar'), info: q('.escala-celula-guarnicao-info'), quando: q('.escala-celula-guarnicao-quando'),
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
    a.caixa.segunda(botao, el, textoDo(botao));
    var quandoChegar = faixasNaLista(combo, menu);
    P.lerGuarnicao(a.unidadeId, a.iso, letra).then(function (r) {
      quandoChegar(function () {
        if (c.a !== a || a.acao !== 'guarnicao' || !el.isConnected) return;
        if (!r) { fecharLista(combo); combo.definir(msg().falhaCarregar, true); return; }
        if (!combo.preencher(r)) { fecharLista(combo); return; }
        /* quem está fora da escala, clicado na grade (cpf, escalas-celula-fora.js): já vem escolhido */
        var dele = cpf && r.filter(function (x) { return x.cpf === cpf && !x.inativo; })[0];
        if (dele) { fecharLista(combo, true); escolhido = dele; combo.mostrarAtual(); P.desenharGuarnicao(dele.m, g); return; }
        inp.focus(); combo.abrir();
      });
    });
  }

  RW.escalasCelulaAcoes = {
    fazer: fazer, menuDoPelotao: menuDoPelotao, prepararMenu: prepararMenu, aoMostrarMenu: aoMostrarMenu, chegou: chegou,
    encerrar: encerrar, fechar: fechar, reporNova: reporNova, podeFechar: podeFechar,
    /* o molde da caixa do pelotão, que também diz se ela tem o Adicionar extra neste dia (escalas-celula-extra.js) */
    moldeDoPelotao: moldeDoPelotao,
    /* o Adicionar à guarnição do dia e o Adicionar neste dia, também com quem está fora da escala já escolhido
       (escalas-celula-fora.js) */
    naGuarnicao: naGuarnicao, nesteDia: nesteDia,
    /* e o que o Oficial de Área do título usa (escalas-celula-oficial.js) */ entrada: entrada, pergunta: pergunta, vivo: vivo
  };
})();
