/* ============================================================
   ESCALAS — Remover militar (o botão do subcabeçalho do Dia e o
   Remover do dia da caixa Sem função; só admin). O mesmo caminho
   pelas duas entradas (REGRAS §4 › Ações e perguntas):
   - abrir(): a sub-tela em caixas de pergunta. Quem sai; a origem
     vem da escala, e só quem entrou de mais de um jeito escolhe Qual
     parte sai. O remanejado (escalas-painel-remanejar.js) responde
     antes se é para Devolver à unidade de origem ou Tirar do dia
     (aí seguem as perguntas de sempre; quem saiu daqui para outra
     unidade, sem serviço aqui, tira o dia todo). Pelo ciclo: só no dia (o horário e o banco de horas,
     que vira folga) ou do ciclo (com a lista do que acontece com as
     trocas, folgas e extras dele, para o rascunho do ciclo). O
     pontual: o horário e, saindo todo e contado no banco, as horas
     dele. A troca (uma parte para cada troca): cancelada aqui mesmo,
     na hora, pelo escalas-painel-remover-troca.js, com o rodapé
     próprio da sub-tela. A extra não sai por aqui (muda na
     Extrajornada, em Ajustes): quem só está de extra no dia não entra
     no Quem sai nem tem o Remover do dia (podeTirar).
   - doDia(m, linha): quem está sem função (já se sabe quem, o
     horário e a origem): pelo ciclo, a pergunta do banco de horas
     abre embaixo da linha, e a resposta já o tira do dia; o pontual
     sai na hora, ou com a pergunta das horas que ele somou; o resto
     abre a sub-tela.
   Sem botão próprio: a resposta completa entra no rascunho do Dia ao
   vivo (escalas-painel-editar.js › aoVivo); nada grava até o Salvar
   do rodapé largo (escalas-painel-salvar.js), menos a troca.
   A lista Quem sai e a origem de cada parte do serviço ficam em
   escalas-painel-remover-listas.js.
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

  /* as listas e a origem do serviço (escalas-painel-remover-listas.js) */
  function R() { return RosterWork.escalasPainelRemoverListas; }
  function partesDe(mil) { return R().partesDe(mil); }
  function podeTirar(mil) { return R().podeTirar(mil); }
  function textoFolga(periodos, nome, horas, data) { return R().textoFolga(periodos, nome, horas, data); }
  function pontualSalvo(cpf) { return R().pontualSalvo(cpf); }
  function itensQuem() { return R().itensQuem(); }

  /* ---------- a sub-tela ---------- */

  /* opcoes = { cpf }: chega com ele escolhido (o Remover do dia que precisa de mais de uma pergunta) */
  function abrir(opcoes) {
    fecharPergunta();
    var api = ed(), H = api.horas, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    var est = { item: null, mil: null, partes: [], parte: null, alcance: 'dia', periodos: [], banco: 'sim',
      reman: null, remanFazer: null };
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
      est.alcance = 'dia'; est.banco = 'sim';
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
        reman: q('.escala-remover-reman'), remanTexto: q('.escala-remover-reman-texto'), remanDevolver: q('.escala-remover-reman-devolver')
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
      ['reman', 'partes', 'alcance', 'horario', 'banco'].forEach(function (k) { mostra(el[k], false); });
      efeito.esconder();
      erro('');
      troca.esconder();
      var mil = est.mil;
      if (!mil) { noRascunho(null, false); return; }
      var nome = nomeDe(mil), cpf = mil.cpf, eu = cpf === RosterWork.sessao.cpf();
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
          el.marcarBanco(est.banco);
          if (eu) { erro(msg().folgaSiMesmo); noRascunho(null, true); return; }
          var descontarR = est.banco === 'sim';
          noRascunho(function () { api.largarRemanejado(cpf); api.darFolga(cpf, descontarR, null); });
          return;
        }
      }
      mostra(el.partes, est.partes.length > 1);
      var p = est.parte;
      if (!p) { noRascunho(null, true); return; }

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
      } else {
        var salvo = pontualSalvo(mil.cpf), contado = !!(salvo && salvo.contabilizado);
        mostra(el.banco, ok && toda && contado);
        if (contado) {
          var hp = H.horasTexto(salvo.minutos);
          el.bancoTexto.textContent = L().tirarPontualTexto(nome, hp);
          el.bancoSim.textContent = L().tirarPontualSim(hp);
          el.bancoNao.textContent = L().tirarPontualNao;
        }
      }
      el.marcarBanco(est.banco);
      /* o horário fora do serviço dele (ou que se cruza) e a folga a si mesmo não entram */
      if (!ok) { erro(L().erroRemover); noRascunho(null, true); return; }
      if (p.origem === 'ciclo' && eu) { erro(msg().folgaSiMesmo); noRascunho(null, true); return; }
      var periodos = H.uniao(est.periodos.map(H.faixa)).map(H.periodo), descontar = est.banco === 'sim';
      noRascunho(function () {
        if (rm) api.largarRemanejado(cpf);
        if (p.origem === 'ciclo') api.darFolga(cpf, descontar, toda && est.partes.length === 1 && !mil.outraUnidade ? null : periodos);
        else tirarDoPontual(cpf, periodos, toda, descontar);
      });
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

  /* o pontual: todo sai (com as horas que ele somou, se o admin quis), ou só os horários dados */
  function tirarDoPontual(cpf, periodos, todo, estornar) {
    var api = ed(), H = api.horas, r = api.rascunho();
    if (todo) {
      var salvo = pontualSalvo(cpf);
      api.tirarPontual(cpf, !!(salvo && salvo.contabilizado) && estornar);
      return;
    }
    var pont = (r.pontuais || []).filter(function (x) { return x.cpf === cpf; })[0];
    if (!pont) return;
    var salvo2 = pontualSalvo(cpf);
    var sai = periodos.map(H.faixa), ficam = H.menos(H.uniao((pont.periodos || []).map(H.faixa)), sai);
    r.pontuais = r.pontuais.filter(function (x) { return x.cpf !== cpf; })
      .concat([{ cpf: cpf, periodos: ficam.map(H.periodo), contabilizar: !!(salvo2 && salvo2.contabilizado) }]);
    api.cortarAjustes(cpf, sai);
  }

  /* ---------- Remover do dia (caixa Sem função) ---------- */

  function fecharPergunta() {
    if (pergunta && pergunta.parentNode) pergunta.remove();
    pergunta = null;
  }

  /* m = a linha de quem está sem função (os horários sem função); linha = a linha da lista */
  function doDia(m, linha) {
    fecharPergunta();
    var api = ed(), H = api.horas, mil = api.militarDoDia(m.cpf);
    if (!mil || !linha) return;
    /* o remanejado: a sub-tela, com ele já escolhido (Devolver ou Tirar do dia) */
    if (mil.remanejado) { abrir({ cpf: mil.cpf }); return; }
    var nome = nomeDe(mil), cpf = mil.cpf;
    var sem = (m.periodos || []).map(copiar), semF = sem.map(H.faixa);
    var partes = partesDe(mil).filter(function (p) {
      return p.periodos.some(function (pp) { return semF.some(function (s) { return !!H.cruza(H.faixa(pp), s); }); });
    });
    if (!partes.length) return;   // só a extra (o botão nem aparece; ver podeTirar)
    /* mais de um jeito, ou a troca: a sub-tela, com ele já escolhido */
    if (partes.length !== 1 || (partes[0].origem !== 'ciclo' && partes[0].origem !== 'pontual')) { abrir({ cpf: cpf }); return; }
    var p = partes[0];
    var horas = H.horasTexto(H.uniao(semF).reduce(function (s, f) { return s + f[1] - f[0]; }, 0));
    var todoPontual = p.origem === 'pontual' && !H.menos(H.uniao(p.periodos.map(H.faixa)), H.uniao(semF)).length;
    var salvo = p.origem === 'pontual' ? pontualSalvo(cpf) : null;
    /* o pontual sem pergunta (parte dele, ou não contado no banco): sai na hora, com o Desfazer */
    if (p.origem === 'pontual' && !(todoPontual && salvo && salvo.contabilizado)) {
      api.mudar(function () { tirarDoPontual(cpf, sem, todoPontual, false); });
      return;
    }
    var el = RosterWork.tpl('tpl-escala-remover-dia');
    if (!el) return;
    var q = function (s) { return el.querySelector(s); };
    if (p.origem === 'ciclo') {
      q('.escala-remover-dia-texto').textContent = textoFolga(sem, nome, horas, diaMes(api.iso()));
      q('.escala-remover-dia-sim').textContent = L().descontar(horas);
      q('.escala-remover-dia-nao').textContent = L().naoDescontar;
    } else {
      var hp = H.horasTexto(salvo.minutos);
      q('.escala-remover-dia-texto').textContent = L().tirarPontualTexto(nome, hp);
      q('.escala-remover-dia-sim').textContent = L().tirarPontualSim(hp);
      q('.escala-remover-dia-nao').textContent = L().tirarPontualNao;
    }
    /* sem nada marcado: a resposta já o tira do dia, no rascunho (o Desfazer volta) */
    var marcar = ligarRadios(el, function (escolha) {
      if (p.origem === 'ciclo' && cpf === RosterWork.sessao.cpf()) {
        marcar(null);
        RosterWork.avisar({ tipo: 'erro', mensagem: msg().folgaSiMesmo });
        return;
      }
      fecharPergunta();
      api.mudar(function () {
        if (p.origem === 'ciclo') api.darFolga(cpf, escolha === 'sim', sem);
        else tirarDoPontual(cpf, sem, true, escolha === 'sim');
      });
    });
    q('.escala-remover-dia-cancelar').addEventListener('click', fecharPergunta);
    linha.insertAdjacentElement('afterend', el);
    pergunta = el;
  }

  window.RosterWork.escalasPainelRemover = { abrir: abrir, doDia: doDia,
    /* quem está sem função tem o Remover do dia só com algo que sai por aqui (a extra muda na Extrajornada) */
    podeTirar: function (cpf) { return podeTirar(ed().militarDoDia(cpf)); } };
})();
