/* ============================================================
   ESCALAS — Remover do dia (o lápis da aba Militares: o Remover do
   dia e o Devolver de quem foi para outra unidade; só admin). O mesmo
   caminho pelas duas entradas (REGRAS §4 › Ações e perguntas):
   - abrir(): a sub-tela em caixas de pergunta. Quem sai; a origem
     vem da escala, e só quem entrou de mais de um jeito escolhe Qual
     parte sai. O remanejado (escalas-painel-remanejar.js) responde
     antes se é para Devolver à unidade de origem ou Tirar do dia
     (aí seguem as perguntas de sempre; quem saiu daqui para outra
     unidade, sem serviço aqui, tira o dia todo). O serviço que veio
     de outro dia (a mudança de dia, escalas-painel-mudar-dia.js)
     responde Devolver para o dia de antes ou Tirar do dia (sai o
     pedaço inteiro, e o dia de antes vira folga, com a pergunta do
     banco de horas). Pelo ciclo: só no dia (o horário e o banco de horas,
     que vira folga) ou do ciclo (com a lista do que acontece com as
     trocas, folgas e extras dele, para o rascunho do ciclo). O
     pontual: o horário e, saindo todo e contado no banco, as horas
     dele. A troca (uma parte para cada troca): cancelada aqui mesmo,
     na hora, pelo escalas-painel-remover-troca.js, com o rodapé
     próprio da sub-tela. A extra não sai por aqui (muda na
     Extrajornada, em Ajustes): quem só está de extra no dia não entra
     no Quem sai nem tem o Remover do dia (podeTirar).
   - doDia(m, linha): o Remover do dia do menu da linha (já se sabe
     quem, o horário, o dia todo dele, e a origem): pelo ciclo, ele
     já sai do dia, sem descontar, e a pergunta do banco de horas
     abre embaixo da linha com o Não descontar marcado (a resposta
     fica e fecha; o Cancelar volta); o pontual sai na hora, ou com a
     pergunta das horas que ele somou; o resto abre a sub-tela. O
     que fazer vem do analisarDoDia(m), que a célula da grade
     (escalas-celula-editar.js) também usa.
   - Na sub-tela, a folga começa no Não descontar (primeiro); o
     pontual, no Tirar as horas.
   Sem botão próprio: a resposta completa entra no rascunho do Dia ao
   vivo (escalas-painel-editar.js › aoVivo); nada grava até o Salvar
   do rodapé largo (escalas-painel-salvar.js), menos a troca.
   A lista Quem sai, a origem de cada parte do serviço e o pontual que
   sai ficam em escalas-painel-remover-listas.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;        // nome único para os rádios e o campo de cada abertura
  var pergunta = null;  // a pergunta única aberta embaixo de uma linha (uma por vez)

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-remover-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* as duas respostas do banco de horas no mesmo molde (os textos delas): na folga, o Não descontar vem primeiro; no
     pontual, o Tirar as horas */
  function naOrdem(textoSim, textoNao, naoPrimeiro) {
    var sim = textoSim.closest('.geral-opcao'), nao = textoNao.closest('.geral-opcao');
    if (naoPrimeiro) sim.parentNode.insertBefore(nao, sim);
    else nao.parentNode.insertBefore(sim, nao);
  }

  /* as listas e a origem do serviço (escalas-painel-remover-listas.js) */
  function R() { return RosterWork.escalasPainelRemoverListas; }
  function partesDe(mil) { return R().partesDe(mil); }
  function podeTirar(mil) { return R().podeTirar(mil); }
  function textoFolga(periodos, nome, horas, data) { return R().textoFolga(periodos, nome, horas, data); }
  function pontualSalvo(cpf) { return R().pontualSalvo(cpf); }
  function itensQuem() { return R().itensQuem(); }
  function tirarDoPontual(cpf, periodos, todo, estornar) { R().tirarDoPontual(cpf, periodos, todo, estornar); }

  /* ---------- a sub-tela ---------- */

  /* opcoes = { cpf }: chega com ele escolhido (o Remover do dia que precisa de mais de uma pergunta) */
  function abrir(opcoes) {
    fecharPergunta('guardar');
    var api = ed(), H = api.horas, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    /* banco = 'sim' | 'nao' | null (null: a resposta de começo da pergunta que aparece, a folga sem descontar e o pontual
       tirando as horas) */
    var est = { item: null, mil: null, partes: [], parte: null, alcance: 'dia', periodos: [], banco: null,
      reman: null, remanFazer: null, mudancaFazer: null };
    var el = {}, combo = null, troca = null, efeito = null;
    var analise = { chave: '', aviso: null, pedido: 0 };   // o que acontece no ciclo de quem sai do ciclo (lido uma vez)

    function escolher(item) {
      est.item = item; est.mil = item.mil;
      est.reman = item.mil.remanejado || null;
      est.remanFazer = null;
      est.partes = partesDe(item.mil);
      est.parte = est.partes.length === 1 ? est.partes[0] : null;
      montarPartes();
      comecarParte();
    }

    /* o remanejado que saiu daqui (sem serviço aqui): os minutos do serviço dele no dia, pela observação do remanejamento */
    function minutosRemanejado() {
      var mil = est.mil, d = api.dados() || {};
      var o = (d.observacoes || []).filter(function (x) {
        return x.classe === 'remanejado' && x.nome === mil.nome && (x.grad || '') === (mil.grad || '');
      })[0];
      if (!o || !o.hi || o.hi === o.hf) return 1440;
      var f = H.faixa({ hi: o.hi, hf: o.hf });
      return f[1] - f[0];
    }

    /* Qual parte sai: só quando ele entrou de mais de um jeito */
    function montarPartes() {
      el.partesLista.textContent = '';
      if (est.partes.length < 2) return;
      var nome = 'escala-remover-parte-' + (++conta);
      est.partes.forEach(function (p, i) {
        var op = RosterWork.tpl('tpl-escala-remover-parte');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.value = String(i);
        r.addEventListener('change', function () { if (r.checked) { est.parte = est.partes[i]; comecarParte(); } });
        op.querySelector('.escala-remover-parte-texto').textContent = L().parte(p.origem, H.textoPeriodos(p.periodos));
        el.partesLista.appendChild(op);
      });
    }

    /* a parte escolhida: o horário começa com ela toda */
    function comecarParte() {
      var p = est.parte;
      est.alcance = 'dia'; est.banco = null; est.mudancaFazer = null;
      est.periodos = p ? p.periodos.map(copiar) : [];
      atualizar();
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-remover');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      [].forEach.call(tela.querySelectorAll('.escala-remover-data'), function (s) { s.textContent = D.diaMesExtenso(iso); });
      el = {
        combo: q('.escala-remover-combo'), partes: q('.escala-remover-partes'), partesLista: q('.escala-remover-partes-lista'),
        alcance: q('.escala-remover-alcance'), horario: q('.escala-remover-horario'), periodos: q('.escala-remover-periodos'),
        banco: q('.escala-remover-banco'),
        bancoTexto: q('.escala-remover-banco-texto'), bancoSim: q('.escala-remover-banco-sim'), bancoNao: q('.escala-remover-banco-nao'),
        erro: q('.escala-remover-erro'), troca: q('.escala-remover-troca'),
        reman: q('.escala-remover-reman'), remanTexto: q('.escala-remover-reman-texto'), remanDevolver: q('.escala-remover-reman-devolver'),
        mudanca: q('.escala-remover-mudanca'), mudancaDevolver: q('.escala-remover-mudanca-devolver'),
        mudancaDevolverAjuda: q('.escala-remover-mudanca-devolver-ajuda'), mudancaTirarAjuda: q('.escala-remover-mudanca-tirar-ajuda')
      };
      var inp = el.combo.querySelector('input');
      inp.id = 'escala-remover-combo-' + (++conta);
      combo = RosterWork.comboMilitar.criar(inp, el.combo.querySelector('.dropdown-menu'), {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDeServico, filtroVazio: msg().ninguemEncontrado }
      });
      el.marcarAlcance = ligarRadios(el.alcance, function (v) { est.alcance = v; atualizar(); });
      el.marcarBanco = ligarRadios(el.banco, function (v) { est.banco = v; atualizar(); });
      el.marcarReman = ligarRadios(el.reman, function (v) { est.remanFazer = v; atualizar(); });
      el.marcarMudanca = ligarRadios(el.mudanca, function (v) { est.mudancaFazer = v; atualizar(); });
      efeito = C.efeito(q('.escala-remover-efeito'));
      /* a troca grava na hora: o rodapé próprio da sub-tela, com o botão que diz o que faz */
      troca = RosterWork.escalasPainelRemoverTroca.criar({ raiz: el.troca, iso: iso, aoGravar: api.recarregar,
        pronto: function (texto, ligado) { api.rodapeProprio(texto, ligado, aplicarTroca); } });
      corpo.appendChild(tela);
      var itens = itensQuem();
      combo.preencher(itens);
      var pedidoCpf = opcoes && opcoes.cpf;
      var ja = pedidoCpf ? itens.filter(function (i) { return i.cpf === pedidoCpf; })[0] : null;
      if (ja) { escolher(ja); combo.mostrarAtual(); }
      else atualizar();
    }

    /* ---------- desenho ---------- */

    function mostra(caixa, sim) { caixa.classList.toggle('oculto', !sim); }
    function minutos(lista) { return H.uniao(lista.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0); }
    /* o horário escolhido fica dentro da parte (e sem cruzar consigo mesmo) */
    function dentro() {
      var js = est.periodos.map(H.faixa), soma = function (l) { return l.reduce(function (s, f) { return s + f[1] - f[0]; }, 0); };
      if (soma(H.uniao(js)) !== soma(js)) return false;
      return !H.menos(H.uniao(js), est.parte.periodos.map(H.faixa)).length;
    }
    function inteira() { return minutos(est.periodos) >= minutos(est.parte.periodos); }

    /* a resposta vai ao rascunho ao vivo (fn nulo: sem resposta; travado: o Salvar espera) */
    function noRascunho(fn, travado) {
      api.rodapeProprio('');
      api.aoVivo(fn, travado);
    }
    /* o que impede a mudança, numa nota vermelha (vazio: some) */
    function erro(texto) {
      mostra(el.erro, !!texto);
      el.erro.querySelector('.nota-texto').textContent = texto || '';
    }

    function montarHorario() {
      el.periodos.textContent = '';
      var opc = H.opcoesHoras(est.parte.periodos);
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, opcoes: opc, erro: !dentro(),
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null
        });
        if (linha) el.periodos.appendChild(linha);
      });
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      ['reman', 'mudanca', 'partes', 'alcance', 'horario', 'banco'].forEach(function (k) { mostra(el[k], false); });
      efeito.esconder();
      erro('');
      troca.esconder();
      var mil = est.mil;
      if (!mil) { noRascunho(null, false); return; }
      var nome = nomeDe(mil), cpf = mil.cpf;
      /* o remanejado: Devolver à unidade de origem ou Tirar do dia (aí seguem as perguntas de sempre) */
      var rm = est.reman;
      if (rm) {
        mostra(el.reman, true);
        el.remanTexto.textContent = L().remanejadoTexto(nome, rm.de_nome, rm.para_nome, rm.fica, rm.automatico);
        el.remanDevolver.textContent = L().devolverA(rm.de_nome);
        el.marcarReman(est.remanFazer);
        if (!est.remanFazer) { noRascunho(null, true); return; }
        if (est.remanFazer === 'devolver') { noRascunho(function () { api.devolverRemanejado(cpf); }); return; }
        /* saiu daqui para outra unidade (sem serviço aqui): sai do dia todo, com o banco de horas */
        if (!est.partes.length) {
          var horasR = H.horasTexto(minutosRemanejado());
          mostra(el.banco, true);
          el.bancoTexto.textContent = L().tirarFolga(nome, data, horasR);
          el.bancoSim.textContent = L().descontar(horasR);
          el.bancoNao.textContent = L().naoDescontar;
          naOrdem(el.bancoSim, el.bancoNao, true);
          if (!est.banco) est.banco = 'nao';
          el.marcarBanco(est.banco);
          var descontarR = est.banco === 'sim';
          noRascunho(function () { api.largarRemanejado(cpf); api.darFolga(cpf, descontarR, null); });
          return;
        }
      }
      mostra(el.partes, est.partes.length > 1);
      var p = est.parte;
      if (!p) { noRascunho(null, true); return; }

      /* o que veio de outro dia: Devolver para o dia de antes ou Tirar do dia */
      if (p.origem === 'mudanca') { mudancaDeDia(mil, p); return; }
      /* a troca grava na hora, pelo rodapé próprio: nada desta sub-tela fica no rascunho */
      if (p.origem === 'troca') { api.aoVivo(null, false); troca.mostrar(mil, p); return; }
      if (p.origem === 'ciclo') {
        mostra(el.alcance, true);
        el.marcarAlcance(est.alcance);
        if (est.alcance === 'ciclo') { sairDoCiclo(mil); return; }
      }
      /* só no dia (pelo ciclo) ou o pontual: o horário que sai e o banco de horas */
      mostra(el.horario, true);
      montarHorario();
      var ok = dentro(), toda = ok && inteira();
      var horas = H.horasTexto(minutos(est.periodos));
      if (p.origem === 'ciclo') {
        mostra(el.banco, ok);
        el.bancoTexto.textContent = toda && est.partes.length === 1 && !mil.outraUnidade
          ? L().tirarFolga(nome, data, horas) : textoFolga(est.periodos, nome, horas, data);
        el.bancoSim.textContent = L().descontar(horas);
        el.bancoNao.textContent = L().naoDescontar;
        naOrdem(el.bancoSim, el.bancoNao, true);
        if (!est.banco) est.banco = 'nao';
      } else {
        var salvo = pontualSalvo(mil.cpf), contado = !!(salvo && salvo.contabilizado);
        mostra(el.banco, ok && toda && contado);
        if (contado) {
          var hp = H.horasTexto(salvo.minutos);
          el.bancoTexto.textContent = L().tirarPontualTexto(nome, hp);
          el.bancoSim.textContent = L().tirarPontualSim(hp);
          el.bancoNao.textContent = L().tirarPontualNao;
        }
        naOrdem(el.bancoSim, el.bancoNao, false);
        if (!est.banco) est.banco = 'sim';
      }
      el.marcarBanco(est.banco);
      /* o horário fora do serviço dele (ou que se cruza) não entra */
      if (!ok) { erro(L().erroRemover); noRascunho(null, true); return; }
      var periodos = H.uniao(est.periodos.map(H.faixa)).map(H.periodo), descontar = est.banco === 'sim';
      noRascunho(function () {
        if (rm) api.largarRemanejado(cpf);
        if (p.origem === 'ciclo') api.darFolga(cpf, descontar, toda && est.partes.length === 1 && !mil.outraUnidade ? null : periodos);
        else tirarDoPontual(cpf, periodos, toda, descontar);
      });
    }

    /* a mudança de dia (ele veio de outro dia para este): Devolver (o serviço volta para o dia de antes; o banco de horas
       não muda) ou Tirar do dia (sai o pedaço inteiro, e o dia de antes vira folga, contada ou não no banco de horas) */
    function mudancaDeDia(mil, p) {
      var nome = nomeDe(mil), cpf = mil.cpf, de = p.mudancaDe, deIso = p.mudancaDeIso;
      mostra(el.mudanca, true);
      el.mudancaDevolver.textContent = L().devolverPara(de);
      el.mudancaDevolverAjuda.textContent = L().devolverParaAjuda(de, data);
      el.mudancaTirarAjuda.textContent = L().tirarMudancaAjuda(de);
      el.marcarMudanca(est.mudancaFazer);
      if (!est.mudancaFazer) { noRascunho(null, true); return; }
      if (est.mudancaFazer === 'devolver') {
        noRascunho(function () { api.desfazerMudanca(p.mudancaId, deIso, cpf, p.periodos); });
        return;
      }
      var horas = H.horasTexto(minutos(p.periodos));
      mostra(el.banco, true);
      el.bancoTexto.textContent = L().tirarFolga(nome, de, horas);
      el.bancoSim.textContent = L().descontar(horas);
      el.bancoNao.textContent = L().naoDescontar;
      naOrdem(el.bancoSim, el.bancoNao, true);
      if (!est.banco) est.banco = 'nao';
      el.marcarBanco(est.banco);
      var descontar = est.banco === 'sim';
      noRascunho(function () { api.tirarMudanca(p.mudancaId, descontar, deIso, cpf, p.periodos); });
    }

    /* do ciclo: a lista do que acontece com as trocas, folgas e extras dele (lida uma vez) e, com ela, a marca no rascunho
       do ciclo; enquanto lê, o Salvar espera */
    function sairDoCiclo(mil) {
      var chave = mil.cpf;
      if (analise.chave === chave) {
        if (analise.aviso) { efeito.mostrar(analise.aviso); noRascunho(function () { C.marcarSair(uid, iso, mil, analise.aviso.itens); }); }
        else noRascunho(null, true);
        return;
      }
      analise.chave = chave;
      analise.aviso = null;
      var meu = ++analise.pedido;
      noRascunho(null, true);
      C.analisarSair(uid, iso, mil).then(function (aviso) {
        if (meu !== analise.pedido || !el.combo.isConnected) return;
        if (aviso.erro) { analise.chave = ''; RosterWork.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
        analise.aviso = aviso;
        if (est.mil === mil && est.alcance === 'ciclo') atualizar();
      });
    }

    /* o botão do rodapé próprio (a troca): grava na hora */
    function aplicarTroca() {
      if (!est.mil) return;
      if (est.reman) api.largarRemanejado(est.mil.cpf);
      troca.aplicar();
    }

    api.abrir(montar);
  }

  /* ---------- Remover do dia (o menu da linha) ---------- */

  /* a pergunta embaixo da linha sai. Na da folga (ao vivo): 'largar' tira a mudança; 'guardar' a deixa como um passo do
     desfazer; sem modo, também refaz a lista, já com ela */
  function fecharPergunta(modo) {
    var p = pergunta;
    pergunta = null;
    if (!p) return;
    if (p.el.parentNode) p.el.remove();
    if (!p.vivo) return;
    var api = ed();
    if (modo === 'largar') { api.largarVivo(); return; }
    if (api.terminarVivo() && modo !== 'guardar') api.redesenhar();
  }

  /* o Remover do dia de quem já se sabe, sem tela (a pergunta embaixo da linha daqui e a célula da grade,
     escalas-celula-editar.js, usam o mesmo). m = { cpf, periodos }: quem sai e as horas que saem (o dia todo dele).
     Devolve null (só a extra: nada sai por aqui), { tipo: 'subtela', cpf } (o remanejado, quem entrou de mais de um jeito
     e a troca: a sub-tela, já com ele), { tipo: 'sai', aplicar() } (o pontual sem pergunta: parte dele, ou não contado no
     banco) ou { tipo: 'folga' | 'pontual', texto, sim, nao, padrao, aplicar(escolha) }: pelo ciclo, a folga, com o Não
     descontar de começo; o pontual contado no banco, sem resposta de começo. aplicar muda o rascunho (quem chama o põe
     no mudar ou no aoVivo) */
  function analisarDoDia(m) {
    var api = ed(), H = api.horas, mil = api.militarDoDia(m.cpf);
    if (!mil) return null;
    if (mil.remanejado) return { tipo: 'subtela', cpf: mil.cpf };
    var nome = nomeDe(mil), cpf = mil.cpf;
    var sem = (m.periodos || []).map(copiar), semF = sem.map(H.faixa);
    var partes = partesDe(mil).filter(function (p) {
      return p.periodos.some(function (pp) { return semF.some(function (s) { return !!H.cruza(H.faixa(pp), s); }); });
    });
    if (!partes.length) return null;   // só a extra (o botão nem aparece; ver podeTirar)
    if (partes.length !== 1 || (partes[0].origem !== 'ciclo' && partes[0].origem !== 'pontual')) return { tipo: 'subtela', cpf: cpf };
    var p = partes[0];
    var todoPontual = p.origem === 'pontual' && !H.menos(H.uniao(p.periodos.map(H.faixa)), H.uniao(semF)).length;
    var salvo = p.origem === 'pontual' ? pontualSalvo(cpf) : null;
    if (p.origem === 'pontual' && !(todoPontual && salvo && salvo.contabilizado)) {
      return { tipo: 'sai', aplicar: function () { tirarDoPontual(cpf, sem, todoPontual, false); } };
    }
    if (p.origem === 'ciclo') {
      /* a folga dele que já está no rascunho (o horário mudado) entra junto: uma folga só no dia (o banco guarda uma por
         militar), o dia todo quando cobre as 24 horas (fora quem também serve em outra unidade, que folga só daqui) */
      var antes = (api.rascunho().folgas || []).filter(function (f) { return f.cpf === cpf && f.hi && f.hf; }).map(copiar);
      var juntas = H.uniao(semF.concat(antes.map(H.faixa)));
      var minJuntas = juntas.reduce(function (s, f) { return s + f[1] - f[0]; }, 0);
      var todo = !mil.outraUnidade && juntas.length === 1 && minJuntas >= 1440;
      var folgaPeriodos = juntas.map(H.periodo), folgaHoras = H.horasTexto(minJuntas), data = diaMes(api.iso());
      return { tipo: 'folga', texto: todo ? L().tirarFolga(nome, data, folgaHoras) : textoFolga(folgaPeriodos, nome, folgaHoras, data),
        sim: L().descontar(folgaHoras), nao: L().naoDescontar, padrao: 'nao',
        aplicar: function (escolha) { api.darFolga(cpf, escolha === 'sim', todo ? null : folgaPeriodos); } };
    }
    var hp = H.horasTexto(salvo.minutos);
    return { tipo: 'pontual', texto: L().tirarPontualTexto(nome, hp), sim: L().tirarPontualSim(hp), nao: L().tirarPontualNao,
      padrao: null, aplicar: function (escolha) { tirarDoPontual(cpf, sem, true, escolha === 'sim'); } };
  }

  /* m = { cpf, periodos }: quem sai e as horas que saem (o dia todo dele, do menu da linha); linha = a linha da lista */
  function doDia(m, linha) {
    fecharPergunta('guardar');
    var api = ed(), a = linha ? analisarDoDia(m) : null;
    if (!a) return;
    if (a.tipo === 'subtela') { abrir({ cpf: a.cpf }); return; }
    /* o pontual sem pergunta: sai na hora, com o Desfazer */
    if (a.tipo === 'sai') { api.mudar(a.aplicar); return; }
    var el = RosterWork.tpl('tpl-escala-remover-dia');
    if (!el) return;
    var q = function (s) { return el.querySelector(s); };
    q('.escala-remover-dia-texto').textContent = a.texto;
    q('.escala-remover-dia-sim').textContent = a.sim;
    q('.escala-remover-dia-nao').textContent = a.nao;
    naOrdem(q('.escala-remover-dia-sim'), q('.escala-remover-dia-nao'), a.tipo === 'folga');
    if (a.tipo === 'folga') {
      /* a folga: ele já sai do dia, sem descontar (ao vivo, com o Não descontar marcado); a resposta, também a já
         marcada, fica e a pergunta fecha; o Cancelar volta tudo */
      api.comecarVivo();
      var aplicar = function (escolha) { api.aoVivo(function () { a.aplicar(escolha); }, false); };
      ligarRadios(el, function () {})(a.padrao);
      aplicar(a.padrao);
      [].forEach.call(el.querySelectorAll('input[type="radio"]'), function (r) {
        r.addEventListener('click', function () { aplicar(r.value); fecharPergunta(); });
      });
      q('.escala-remover-dia-cancelar').addEventListener('click', function () { api.aoVivo(null, false); fecharPergunta('largar'); });
    } else {
      /* o pontual contado no banco, sem nada marcado: a resposta já o tira do dia, no rascunho (o Desfazer volta) */
      ligarRadios(el, function (escolha) {
        fecharPergunta();
        api.mudar(function () { a.aplicar(escolha); });
      });
      q('.escala-remover-dia-cancelar').addEventListener('click', function () { fecharPergunta(); });
    }
    linha.insertAdjacentElement('afterend', el);
    pergunta = { el: el, vivo: a.tipo === 'folga' };
  }

  window.RosterWork.escalasPainelRemover = { abrir: abrir, doDia: doDia, analisarDoDia: analisarDoDia, fecharPergunta: fecharPergunta,
    /* o menu da linha mostra o Remover do dia só com algo que sai por aqui (a extra muda na Extrajornada) */
    podeTirar: function (cpf) { return podeTirar(ed().militarDoDia(cpf)); } };
})();
