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
     que vira folga) ou do ciclo (a lista do que é cancelado e a
     confirmação, para o rascunho do ciclo). O pontual: o horário e,
     saindo todo e contado no banco, as horas dele. A extra: os
     horários, no rascunho do mês da aba Extrajornada. A troca (uma
     parte para cada troca): cancelada aqui mesmo, na hora, pelo
     escalas-painel-remover-troca.js.
   - doDia(m, linha): quem está sem função (já se sabe quem, o
     horário e a origem): pelo ciclo, a pergunta do banco de horas
     abre embaixo da linha; o pontual sai na hora, ou com a pergunta
     das horas que ele somou; o resto abre a sub-tela.
   As mudanças do dia vão ao rascunho do Dia; nada grava até o Salvar
   do rodapé do painel (escalas-painel-salvar.js), menos a troca.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;        // nome único para os rádios e o campo de cada abertura
  var pergunta = null;  // a pergunta única aberta embaixo de uma linha (uma por vez)

  /* os 4 horários de 6 h da extra */
  var BLOCOS = [{ n: 1, hi: '08h', hf: '14h' }, { n: 2, hi: '14h', hf: '20h' }, { n: 3, hi: '20h', hf: '02h' }, { n: 4, hi: '02h', hf: '08h' }];

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function R() { return RosterWork.escalasExtraRascunho; }
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

  /* ---------- de onde ele veio ---------- */

  /* as partes do serviço dele no dia, pela origem: [{ origem: 'ciclo' | 'pontual' | 'troca' | 'extra', periodos, trocaId }]
     (por troca, uma parte para cada troca) */
  function partesDe(mil) {
    var api = ed(), H = api.horas;
    var pont = (api.rascunho().pontuais || []).filter(function (x) { return x.cpf === mil.cpf; })[0];
    var doPontual = pont ? H.uniao((pont.periodos || []).map(H.faixa)) : [];
    function janelas(filtro) { return H.uniao(mil.janelas.filter(filtro).map(H.faixa)); }
    var ciclo = H.menos(janelas(function (j) { return ['pontual', 'troca', 'extra'].indexOf(j.origem) < 0; }), doPontual);
    var r = [], trocas = [];
    function por(origem, faixas, trocaId) { if (faixas.length) r.push({ origem: origem, periodos: faixas.map(H.periodo), trocaId: trocaId || null }); }
    por('ciclo', ciclo);
    por('pontual', doPontual);
    mil.janelas.forEach(function (j) { if (j.origem === 'troca' && trocas.indexOf(j.troca_id) < 0) trocas.push(j.troca_id); });
    trocas.forEach(function (id) { por('troca', janelas(function (j) { return j.origem === 'troca' && j.troca_id === id; }), id); });
    por('extra', janelas(function (j) { return j.origem === 'extra'; }));
    return r;
  }

  /* a frase da folga: "Das 20h às 08h, o Cb. X fica de folga (12 horas)."; o dia todo (sem horário no texto), "em 29/10" */
  function textoFolga(periodos, nome, horas, data) {
    var t = ed().horas.textoPeriodos(periodos);
    return t ? L().folgaParte(t, nome, horas) : L().tirarFolga(nome, data, horas);
  }

  /* o pontual como está gravado (o banco diz se as horas dele foram contadas) */
  function pontualSalvo(cpf) {
    var api = ed();
    if (!api.pontualSalvo(cpf)) return null;
    return ((api.dados() || {}).pontuais || []).filter(function (x) { return x.cpf === cpf; })[0] || null;
  }

  /* quem está no dia aqui (nas funções ou sem função), com o serviço dele ("das 08h às 08h, pelo ciclo"), e quem foi
     remanejado daqui para outra unidade (sem serviço aqui no dia) */
  function itensQuem() {
    var api = ed(), H = api.horas, d = api.dados() || {}, noDia = {}, lista = [], uid = String(api.unidadeId());
    (d.postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) { (f.militares || []).forEach(function (m) { noDia[m.cpf] = true; }); });
    });
    (d.sem_funcao || []).forEach(function (m) { noDia[m.cpf] = true; });
    var visto = {};
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        var rm = pm.remanejado;
        if (rm && !rm.fica && String(rm.de) === uid && !visto[pm.cpf]) {
          var mr = api.militarDoDia(pm.cpf);
          if (!mr) return;
          visto[pm.cpf] = true;
          lista.push({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, mil: mr, info: L().remanejadoPara(rm.para_nome) });
          return;
        }
        if (!noDia[pm.cpf] || visto[pm.cpf]) return;
        var mil = api.militarDoDia(pm.cpf);
        if (!mil || !mil.janelas.length) return;
        visto[pm.cpf] = true;
        var jan = mil.janelas.slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
        lista.push({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, mil: mil,
          info: L().servicoTexto(jan.map(function (j) { return { hi: H.curta(j.hi), hf: H.curta(j.hf), origem: j.origem }; })) });
      });
    });
    return lista;
  }

  /* ---------- a sub-tela ---------- */

  /* opcoes = { cpf }: chega com ele escolhido (o Remover do dia que precisa de mais de uma pergunta) */
  function abrir(opcoes) {
    fecharPergunta();
    var api = ed(), H = api.horas, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    var est = { item: null, mil: null, partes: [], parte: null, alcance: 'dia', periodos: [], banco: 'sim', extra: null, blocos: [],
      reman: null, remanFazer: null };
    var el = {}, combo = null, pedido = 0, troca = null;

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

    /* a parte escolhida: o horário começa com ela toda; a extra lê os horários dela */
    function comecarParte() {
      var p = est.parte;
      est.alcance = 'dia'; est.banco = 'sim'; est.blocos = []; est.extra = null;
      est.periodos = p ? p.periodos.map(copiar) : [];
      if (p && p.origem === 'extra') carregarExtra();
      atualizar();
    }

    function carregarExtra() {
      var meu = ++pedido;
      el.blocosLista.textContent = '';
      RosterWork.escalasDados.extraLista(uid, iso).then(function (d) {
        if (meu !== pedido || !el.blocosLista.isConnected) return;
        if (!d || !d.ok) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
        var m = (d.militares || []).filter(function (x) { return x.cpf === est.mil.cpf; })[0];
        var hoje = m && (m.extras || []).filter(function (e) { return e.data === iso && String(e.unidade_id) === String(uid); })[0];
        est.extra = { d: d, m: m, hoje: hoje || null };
        est.blocos = hoje ? hoje.blocos.slice() : [];
        RosterWork.escalasPainelQuem.marcar(el.blocosLista, BLOCOS.filter(function (b) { return hoje && hoje.blocos.indexOf(b.n) >= 0; }).map(function (b) {
          return { texto: L().blocoExtra(b.hi, b.hf), marcado: true };
        }), function (marcados) {
          var deHoje = BLOCOS.filter(function (b) { return hoje && hoje.blocos.indexOf(b.n) >= 0; });
          est.blocos = marcados.map(function (i) { return deHoje[i].n; });
          atualizar();
        });
        atualizar();
      });
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-remover');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      [].forEach.call(tela.querySelectorAll('.escala-remover-data'), function (s) { s.textContent = D.diaMesExtenso(iso); });
      el = {
        combo: q('.escala-remover-combo'), partes: q('.escala-remover-partes'), partesLista: q('.escala-remover-partes-lista'),
        alcance: q('.escala-remover-alcance'), horario: q('.escala-remover-horario'), periodos: q('.escala-remover-periodos'),
        blocos: q('.escala-remover-blocos'), blocosLista: q('.escala-remover-blocos-lista'), banco: q('.escala-remover-banco'),
        bancoTexto: q('.escala-remover-banco-texto'), bancoSim: q('.escala-remover-banco-sim'), bancoNao: q('.escala-remover-banco-nao'),
        motivo: q('.escala-remover-motivo'), ciclo: q('.escala-remover-ciclo'), troca: q('.escala-remover-troca'),
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
      el.marcarBanco = ligarRadios(el.banco, function (v) { est.banco = v; });
      el.marcarReman = ligarRadios(el.reman, function (v) { est.remanFazer = v; atualizar(); });
      el.motivo.querySelector('input').value = R() ? R().motivo() : '';
      troca = RosterWork.escalasPainelRemoverTroca.criar({ raiz: el.troca, iso: iso, pronto: pronto, aoGravar: api.recarregar });
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

    function pronto(texto, ligado) {
      api.rotuloAplicar(texto);
      api.travarAplicar(!ligado);
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
      ['reman', 'partes', 'alcance', 'horario', 'blocos', 'banco', 'motivo', 'ciclo'].forEach(function (k) { mostra(el[k], false); });
      troca.esconder();
      var mil = est.mil;
      if (!mil) { pronto(L().escolhaQuemSai, false); return; }
      var nome = nomeDe(mil);
      /* o remanejado: Devolver à unidade de origem ou Tirar do dia (aí seguem as perguntas de sempre) */
      var rm = est.reman;
      if (rm) {
        mostra(el.reman, true);
        el.remanTexto.textContent = L().remanejadoTexto(nome, rm.de_nome, rm.para_nome, rm.fica, rm.automatico);
        el.remanDevolver.textContent = L().devolverA(rm.de_nome);
        el.marcarReman(est.remanFazer);
        if (!est.remanFazer) { pronto(L().escolhaFazer, false); return; }
        if (est.remanFazer === 'devolver') { pronto(L().devolver(nome, rm.de_nome), true); return; }
        /* saiu daqui para outra unidade (sem serviço aqui): sai do dia todo, com o banco de horas */
        if (!est.partes.length) {
          var horasR = H.horasTexto(minutosRemanejado());
          mostra(el.banco, true);
          el.bancoTexto.textContent = L().tirarFolga(nome, data, horasR);
          el.bancoSim.textContent = L().descontar(horasR);
          el.bancoNao.textContent = L().naoDescontar;
          el.marcarBanco(est.banco);
          pronto(L().removerDoDia(nome), true);
          return;
        }
      }
      mostra(el.partes, est.partes.length > 1);
      var p = est.parte;
      if (!p) { pronto(L().escolhaParte, false); return; }

      if (p.origem === 'troca') { troca.mostrar(mil, p); return; }
      if (p.origem === 'extra') {
        mostra(el.blocos, true);
        mostra(el.motivo, !!(est.extra && est.extra.d.iniciado));
        pronto(est.blocos.length ? L().removerExtra(nome) : L().marqueHorario, est.blocos.length > 0 && !!est.extra);
        return;
      }
      if (p.origem === 'ciclo') {
        mostra(el.alcance, true);
        el.marcarAlcance(est.alcance);
        if (est.alcance === 'ciclo') { mostra(el.ciclo, true); pronto(L().botaoContinuar, true); return; }
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
      pronto(toda ? L().removerDoDia(nome) : L().removerHorario(nome), ok);
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      var mil = est.mil, p = est.parte, rm = est.reman;
      if (!mil) return;
      var cpf = mil.cpf;
      if (rm && est.remanFazer === 'devolver') { api.devolverRemanejado(cpf); api.concluir(); return; }
      if (rm && est.remanFazer === 'tirar' && !est.partes.length) {
        if (cpf === RosterWork.sessao.cpf()) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().folgaSiMesmo }); return; }
        var descontarR = est.banco === 'sim';
        api.mudar(function () { api.largarRemanejado(cpf); api.darFolga(cpf, descontarR, null); });
        return;
      }
      if (!p) return;
      if (p.origem === 'troca') { if (rm) api.largarRemanejado(cpf); troca.aplicar(); return; }
      if (p.origem === 'extra') { aplicarExtra(mil); return; }
      if (p.origem === 'ciclo' && est.alcance === 'ciclo') {
        /* do ciclo: a lista do que é cancelado e a confirmação; vai para o rascunho do ciclo e volta ao dia */
        C.sair(uid, iso, mil, api.voltar);
        return;
      }
      if (!dentro()) { RosterWork.avisar({ tipo: 'erro', mensagem: L().erroRemover }); return; }
      if (p.origem === 'ciclo' && cpf === RosterWork.sessao.cpf()) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().folgaSiMesmo }); return; }
      var periodos = H.uniao(est.periodos.map(H.faixa)).map(H.periodo), toda = inteira();
      var descontar = est.banco === 'sim';
      api.mudar(function () {
        if (rm) api.largarRemanejado(cpf);
        if (p.origem === 'ciclo') api.darFolga(cpf, descontar, toda && est.partes.length === 1 && !mil.outraUnidade ? null : periodos);
        else tirarDoPontual(cpf, periodos, toda, descontar);
      });
    }

    /* a extra: o mesmo rascunho do mês da aba Extrajornada (sem mudança de outro mês); volta ao dia, e o Salvar do rodapé
       grava */
    function aplicarExtra(mil) {
      var x = est.extra;
      if (!x || !x.hoje || !est.blocos.length || !R()) return;
      if (R().sujo() && R().competencia() && R().competencia() !== x.d.competencia) {
        RosterWork.avisar({ tipo: 'aviso', mensagem: L().extraPendente });
        return;
      }
      var ficam = x.hoje.blocos.filter(function (b) { return est.blocos.indexOf(b) < 0; });
      R().mes(x.d.competencia);
      R().motivo(el.motivo.querySelector('input').value || '');
      R().definir({ cpf: mil.cpf, data: iso, unidade: uid, blocos: ficam,
        antes: { unidade: x.hoje.unidade_id, blocos: x.hoje.blocos }, militar: { grad: mil.grad, nome: mil.nome } });
      api.voltar();
    }

    api.abrir(L().escolhaQuemSai, montar, aplicar);
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
    /* mais de um jeito, extra ou troca: a sub-tela, com ele já escolhido */
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
    var escolha = 'sim';
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
    ligarRadios(el, function (v) { escolha = v; })(escolha);
    q('.escala-remover-dia-cancelar').addEventListener('click', fecharPergunta);
    q('.escala-remover-dia-confirmar').addEventListener('click', function () {
      if (p.origem === 'ciclo' && cpf === RosterWork.sessao.cpf()) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().folgaSiMesmo }); return; }
      fecharPergunta();
      api.mudar(function () {
        if (p.origem === 'ciclo') api.darFolga(cpf, escolha === 'sim', sem);
        else tirarDoPontual(cpf, sem, true, escolha === 'sim');
      });
    });
    linha.insertAdjacentElement('afterend', el);
    pergunta = el;
  }

  window.RosterWork.escalasPainelRemover = { abrir: abrir, doDia: doDia };
})();
