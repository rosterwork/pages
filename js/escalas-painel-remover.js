/* ============================================================
   ESCALAS — Remover do dia (o lápis da aba Funções: o Remover do
   dia e o Devolver de quem foi para outra unidade; só admin). O mesmo
   caminho pelas duas entradas (REGRAS §4 › Ações e perguntas):
   - abrir(): a sub-tela em caixas de pergunta. Quem sai; a origem
     vem da escala, e só quem entrou de mais de um jeito escolhe de
     qual lugar (só trocas: no lugar de quem) ou de qual serviço sai. O remanejado (escalas-painel-remanejar.js) responde
     antes se é para Devolver à unidade de origem ou Tirar do dia
     (aí seguem as perguntas de sempre; quem saiu daqui para outra
     unidade, sem serviço aqui, tira o dia todo). O serviço que veio
     de outro dia (a mudança de dia, escalas-painel-mudar-dia.js)
     responde Fica de folga no dia de antes (sai o pedaço inteiro, com a
     pergunta do banco de horas), Muda para outra data (as perguntas do
     Mudar o dia, embaixo) ou Volta ao serviço de antes. Pelo ciclo: só no dia (o horário e o banco de horas,
     que vira folga) ou do ciclo (com a lista do que acontece com as
     trocas, folgas e extras dele, para o rascunho do ciclo). O
     pontual: o horário e, contado no banco, as horas que ele tem lá
     por este dia: saindo todo, Tirar ou Manter as horas; saindo só uma
     parte, Corrigir (para as que ficam) ou Manter, quando as que
     ficam são diferentes das do banco. A troca (uma parte para cada troca): cancelada aqui mesmo,
     na hora, pelo escalas-painel-remover-troca.js, com o rodapé
     próprio da sub-tela. A extra não sai por aqui (muda na
     Extrajornada, em Ajustes): quem só está de extra no dia não entra
     no Quem sai nem tem o Remover do dia (podeTirar).
   - doDia(m, linha): o Remover do dia e o Dar folga do menu da linha
     (já se sabe quem, o horário, o dia todo dele, e a origem): pelo
     ciclo e no Dar folga de quem está por troca (m.folga; a troca
     continua valendo), ele
     já sai do dia, sem descontar, e a pergunta do banco de horas
     abre embaixo da linha com o Não descontar marcado (a resposta
     fica e fecha; o Cancelar volta); o pontual sai na hora, ou com a
     pergunta das horas que ele tem no banco; o resto abre a sub-tela. O
     que fazer vem do analisarDoDia(m), que a célula da grade
     (escalas-celula-editar.js) também usa; o remanejado, na célula, vem
     do analisarRemanejado(cpf): onde ele está, Devolver ou Tirar do dia
     (com as perguntas de sempre, as mesmas do analisarDoDia); quem veio
     de outro dia, do analisarMudanca(cpf), com as três respostas da
     sub-tela.
   - Na sub-tela, a folga começa no Não descontar (primeiro); o
     pontual, no Tirar as horas (no Corrigir, saindo só uma parte).
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
  function textoFolga(periodos, nome, horas, data, troca) { return R().textoFolga(periodos, nome, horas, data, troca); }
  function itensQuem() { return R().itensQuem(); }
  function tirarDoPontual(cpf, periodos, todo, estornar, manter) { R().tirarDoPontual(cpf, periodos, todo, estornar, manter); }
  /* as horas que o pontual gravado e contabilizado tem no banco por este dia (o Manter pode deixar diferente do horário);
     null: não foi contabilizado */
  function creditoDe(cpf) { var g = ed().pontualGravado(cpf); return g && g.contabilizado ? g.minutos : null; }

  /* o remanejado que saiu daqui (sem serviço aqui): os minutos do serviço dele no dia, pela observação do remanejamento */
  function minutosRemanejado(mil) {
    var H = ed().horas, d = ed().dados() || {};
    var o = (d.observacoes || []).filter(function (x) {
      return x.classe === 'remanejado' && x.nome === mil.nome && (x.grad || '') === (mil.grad || '');
    })[0];
    if (!o || !o.hi || o.hi === o.hf) return 1440;
    var f = H.faixa({ hi: o.hi, hf: o.hf });
    return f[1] - f[0];
  }

  /* ---------- a sub-tela ---------- */

  /* opcoes = { cpf, trocaId }: chega com ele escolhido (o Remover do dia que precisa de mais de uma pergunta) e, com
     trocaId, já na parte dessa troca (o Cancelar a troca da linha riscada da célula) */
  function abrir(opcoes) {
    fecharPergunta('guardar');
    var api = ed(), H = api.horas, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    /* banco = 'sim' | 'nao' | null (null: a resposta de começo da pergunta que aparece, a folga sem descontar e o pontual
       tirando as horas) */
    var est = { item: null, mil: null, partes: [], parte: null, alcance: 'dia', periodos: [], banco: null,
      reman: null, remanFazer: null, mudancaFazer: null, motivo: '' };
    var el = {}, combo = null, troca = null, efeito = null;
    var ultimo = null;   // a última resposta posta no rascunho (o Motivo da folga a refaz com o texto novo)
    var outra = null;    // as perguntas do Mudar o dia do Muda para outra data (a mudança de dia), enquanto ela está marcada
    var analise = { chave: '', aviso: null, pedido: 0 };   // o que acontece no ciclo de quem sai do ciclo (lido uma vez)
    var trocaPedida = (opcoes && opcoes.trocaId) || null;   // a parte da troca pedida, só na primeira escolha

    function escolher(item) {
      est.item = item; est.mil = item.mil;
      est.reman = item.mil.remanejado || null;
      est.remanFazer = null;
      est.partes = partesDe(item.mil);
      var pedida = trocaPedida && est.partes.filter(function (p) { return p.origem === 'troca' && p.trocaId === trocaPedida; })[0];
      trocaPedida = null;
      est.parte = est.partes.length === 1 ? est.partes[0] : pedida || null;
      est.motivo = R().motivoNoRascunho(item.mil.cpf);
      el.motivo.querySelector('input').value = est.motivo;
      montarPartes();
      comecarParte();
    }

    /* Tirar de qual lugar (só trocas) ou de qual serviço: só quando ele entrou de mais de um jeito; na troca, no lugar de
       quem (a leitura do dia, trocados) */
    function montarPartes() {
      el.partesLista.textContent = '';
      if (est.partes.length < 2) return;
      var nome = 'escala-remover-parte-' + (++conta), trocados = (api.dados() || {}).trocados || [];
      var soTrocas = est.partes.every(function (p) { return p.origem === 'troca'; });
      el.partesLugar.classList.toggle('oculto', !soTrocas);
      el.partesServico.classList.toggle('oculto', soTrocas);
      el.partesAjuda.textContent = L().vezesNoDia(nomeDe(est.mil), est.partes.length);
      est.partes.forEach(function (p, i) {
        var op = RosterWork.tpl('tpl-escala-remover-parte');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.value = String(i);
        r.checked = est.parte === p;
        r.addEventListener('change', function () { if (r.checked) { est.parte = est.partes[i]; comecarParte(); } });
        var saiu = p.origem === 'troca' ? trocados.filter(function (x) { return x.troca_id === p.trocaId; })[0] : null;
        op.querySelector('.escala-remover-parte-texto').textContent = L().parteTirar(p.origem, H.textoPeriodos(p.periodos), saiu ? nomeDe(saiu) : '');
        el.partesLista.appendChild(op);
      });
    }

    /* a parte escolhida: o horário começa com ela toda */
    function comecarParte() {
      largarOutra();
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
        partesLugar: q('.escala-remover-partes-lugar'), partesServico: q('.escala-remover-partes-servico'),
        partesAjuda: q('.escala-remover-partes-ajuda'),
        alcance: q('.escala-remover-alcance'), horario: q('.escala-remover-horario'), periodos: q('.escala-remover-periodos'),
        banco: q('.escala-remover-banco'),
        bancoTexto: q('.escala-remover-banco-texto'), bancoSim: q('.escala-remover-banco-sim'), bancoNao: q('.escala-remover-banco-nao'),
        erro: q('.escala-remover-erro'), troca: q('.escala-remover-troca'),
        reman: q('.escala-remover-reman'), remanTexto: q('.escala-remover-reman-texto'), remanDevolver: q('.escala-remover-reman-devolver'),
        mudanca: q('.escala-remover-mudanca'), mudancaDevolver: q('.escala-remover-mudanca-devolver'),
        mudancaDevolverAjuda: q('.escala-remover-mudanca-devolver-ajuda'), mudancaTirarAjuda: q('.escala-remover-mudanca-tirar-ajuda'),
        mudancaTirar: q('.escala-remover-mudanca-tirar'), mudancaOutra: q('.escala-remover-mudanca-outra')
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
      el.motivo = R().campoMotivo(el.banco, '', function (t) {
        est.motivo = t;
        if (ultimo && ultimo.fn) api.aoVivo(ultimo.fn, ultimo.travado);
      });
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
      ultimo = { fn: fn, travado: travado };
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
      ['reman', 'mudanca', 'mudancaOutra', 'partes', 'alcance', 'horario', 'banco', 'motivo'].forEach(function (k) { mostra(el[k], false); });
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
          var horasR = H.horasTexto(minutosRemanejado(mil));
          mostra(el.banco, true);
          mostra(el.motivo, true);
          el.bancoTexto.textContent = L().tirarFolga(nome, data, horasR);
          el.bancoSim.textContent = L().descontar(horasR);
          el.bancoNao.textContent = L().naoDescontar;
          naOrdem(el.bancoSim, el.bancoNao, true);
          if (!est.banco) est.banco = 'nao';
          el.marcarBanco(est.banco);
          var descontarR = est.banco === 'sim';
          noRascunho(function () { api.largarRemanejado(cpf); api.darFolga(cpf, descontarR, null, est.motivo); });
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
      var ok = dentro(), toda = ok && inteira(), parcial = false;
      var horas = H.horasTexto(minutos(est.periodos));
      if (p.origem === 'ciclo') {
        mostra(el.banco, ok);
        mostra(el.motivo, true);
        el.bancoTexto.textContent = toda && est.partes.length === 1 && !mil.outraUnidade
          ? L().tirarFolga(nome, data, horas) : textoFolga(est.periodos, nome, horas, data);
        el.bancoSim.textContent = L().descontar(horas);
        el.bancoNao.textContent = L().naoDescontar;
        naOrdem(el.bancoSim, el.bancoNao, true);
        if (!est.banco) est.banco = 'nao';
      } else {
        /* o contabilizado: saindo todo, Tirar as horas ou Manter as horas; saindo só uma parte, o banco de horas das que
           ficam, Corrigir (marcado) ou Manter, quando elas ficam diferentes do que ele tem no banco por este dia */
        var credito = creditoDe(mil.cpf), contado = credito != null;
        var ficam = toda ? 0 : minutos(H.menos(H.uniao(p.periodos.map(H.faixa)), H.uniao(est.periodos.map(H.faixa))).map(H.periodo));
        parcial = ok && !toda && contado && ficam !== credito;
        mostra(el.banco, ok && contado && (toda || parcial));
        if (contado) {
          var hp = H.horasTexto(credito);
          el.bancoTexto.textContent = L().tirarPontualTexto(nome, hp);
          el.bancoSim.textContent = toda ? L().tirarPontualSim(hp) : L().bancoCorrigir(H.horasTexto(ficam));
          el.bancoNao.textContent = toda ? L().tirarPontualNao : L().bancoManter(hp);
        }
        naOrdem(el.bancoSim, el.bancoNao, false);
        if (!est.banco) est.banco = 'sim';
      }
      el.marcarBanco(est.banco);
      /* o horário fora do serviço dele (ou que se cruza) não entra */
      if (!ok) { erro(L().erroRemover); noRascunho(null, true); return; }
      var periodos = H.uniao(est.periodos.map(H.faixa)).map(H.periodo), descontar = est.banco === 'sim';
      var manter = parcial && est.banco === 'nao';
      noRascunho(function () {
        if (rm) api.largarRemanejado(cpf);
        if (p.origem === 'ciclo') api.darFolga(cpf, descontar, toda && est.partes.length === 1 && !mil.outraUnidade ? null : periodos, est.motivo);
        else tirarDoPontual(cpf, periodos, toda, descontar, manter);
      });
    }

    /* a mudança de dia (ele veio de outro dia para este): Fica de folga no dia de antes (sai o pedaço inteiro, contado ou
       não no banco de horas), Muda para outra data (as perguntas do Mudar o dia, embaixo) ou Volta ao serviço de antes (o
       banco de horas não muda); as mesmas respostas da caixa da célula (respostasDaMudanca) */
    function mudancaDeDia(mil, p) {
      var a = respostasDaMudanca(mil, mudancaDaParte(mil, p));
      mostra(el.mudanca, true);
      el.mudancaTirar.textContent = a.folgaTexto;
      el.mudancaDevolver.textContent = a.voltaTexto;
      el.mudancaDevolverAjuda.textContent = L().devolverParaAjuda(a.de, data);
      el.mudancaTirarAjuda.textContent = L().tirarMudancaAjuda(a.de);
      el.marcarMudanca(est.mudancaFazer);
      if (est.mudancaFazer !== 'outra') largarOutra();
      if (!est.mudancaFazer) { noRascunho(null, true); return; }
      if (est.mudancaFazer === 'devolver') { noRascunho(function () { a.volta(); }); return; }
      /* Muda para outra data: as perguntas do Mudar o dia põem a resposta no rascunho sozinhas */
      if (est.mudancaFazer === 'outra') {
        mostra(el.mudancaOutra, true);
        if (!outra) {
          ultimo = null;
          api.rodapeProprio('');
          outra = a.outra(function (tela) { el.mudancaOutra.appendChild(tela); }, { dentro: true });
        }
        return;
      }
      mostra(el.banco, true);
      el.bancoTexto.textContent = a.folga.texto;
      el.bancoSim.textContent = a.folga.sim;
      el.bancoNao.textContent = a.folga.nao;
      naOrdem(el.bancoSim, el.bancoNao, true);
      if (!est.banco) est.banco = a.folga.padrao;
      el.marcarBanco(est.banco);
      var escolha = est.banco;
      noRascunho(function () { a.folga.aplicar(escolha); });
    }
    /* o Muda para outra data sai (outra resposta, outra parte ou outro militar): as perguntas dele somem */
    function largarOutra() {
      if (!outra) return;
      outra = null;
      el.mudancaOutra.textContent = '';
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
     escalas-celula-editar.js, usam o mesmo). m = { cpf, periodos, folga }: quem sai, as horas que saem (o dia todo dele)
     e, no Dar folga, folga = true (por troca, a folga dele, com a troca valendo; sem ele, a troca abre a sub-tela).
     Devolve null (só a extra: nada sai por aqui), { tipo: 'subtela', cpf } (o remanejado, quem entrou de mais de um jeito
     e a troca: a sub-tela, já com ele), { tipo: 'sai', aplicar() } (o pontual sem pergunta: não contado no banco, ou parte
     dele com as horas que ficam iguais às do banco) ou { tipo: 'folga' | 'pontual', texto, sim, nao, padrao, motivo,
     aplicar(escolha, motivo) }: pelo ciclo e no Dar folga da troca, a folga, com o Não descontar de começo e o motivo
     dela já no rascunho; o pontual contado no banco, saindo todo, sem resposta de começo; saindo só uma parte, Corrigir
     (de começo) ou Manter. aplicar muda o rascunho (quem chama o põe no mudar ou no aoVivo) */
  function analisarDoDia(m) {
    var mil = ed().militarDoDia(m.cpf);
    if (!mil) return null;
    if (mil.remanejado) return { tipo: 'subtela', cpf: mil.cpf };
    return analisarPartes(mil, m);
  }

  /* o analisarDoDia pelas partes do serviço dele aqui (também o Tirar do dia do remanejado, analisarRemanejado) */
  function analisarPartes(mil, m) {
    var api = ed(), H = api.horas;
    var nome = nomeDe(mil), cpf = mil.cpf;
    var sem = (m.periodos || []).map(copiar), semF = sem.map(H.faixa);
    var partes = partesDe(mil).filter(function (p) {
      return p.periodos.some(function (pp) { return semF.some(function (s) { return !!H.cruza(H.faixa(pp), s); }); });
    });
    if (!partes.length) return null;   // só a extra (o botão nem aparece; ver podeTirar)
    /* o Dar folga de quem está por troca: a folga é dele, e quem ele cobre continua de folga */
    var folgaNaTroca = !!m.folga && partes.length === 1 && partes[0].origem === 'troca';
    if (partes.length !== 1 || (partes[0].origem !== 'ciclo' && partes[0].origem !== 'pontual' && !folgaNaTroca)) return { tipo: 'subtela', cpf: cpf };
    var p = partes[0];
    var restoPontual = p.origem === 'pontual' ? H.menos(H.uniao(p.periodos.map(H.faixa)), H.uniao(semF)) : [];
    var todoPontual = p.origem === 'pontual' && !restoPontual.length;
    /* o pontual contabilizado: saindo todo, a pergunta de tirar as horas; saindo só uma parte, Corrigir (marcado) ou Manter,
       quando as horas que ficam são diferentes do que ele tem no banco por este dia */
    var credito = p.origem === 'pontual' ? creditoDe(cpf) : null;
    var ficamMin = restoPontual.reduce(function (s, f) { return s + f[1] - f[0]; }, 0);
    if (p.origem === 'pontual' && (credito == null || (!todoPontual && ficamMin === credito))) {
      return { tipo: 'sai', aplicar: function () { tirarDoPontual(cpf, sem, todoPontual, false); } };
    }
    if (p.origem === 'pontual' && !todoPontual) {
      var hc = H.horasTexto(credito);
      return { tipo: 'pontual', texto: L().tirarPontualTexto(nome, hc), sim: L().bancoCorrigir(H.horasTexto(ficamMin)), nao: L().bancoManter(hc),
        padrao: 'sim', aplicar: function (escolha) { tirarDoPontual(cpf, sem, false, false, escolha === 'nao'); } };
    }
    if (p.origem === 'ciclo' || folgaNaTroca) {
      /* a folga dele que já está no rascunho (o horário mudado) entra junto: uma folga só no dia (o banco guarda uma por
         militar), o dia todo quando cobre as 24 horas (fora quem também serve em outra unidade, que folga só daqui) */
      var antes = (api.rascunho().folgas || []).filter(function (f) { return f.cpf === cpf && f.hi && f.hf; }).map(copiar);
      var juntas = H.uniao(semF.concat(antes.map(H.faixa)));
      var minJuntas = juntas.reduce(function (s, f) { return s + f[1] - f[0]; }, 0);
      var todo = !mil.outraUnidade && juntas.length === 1 && minJuntas >= 1440;
      var folgaPeriodos = juntas.map(H.periodo), folgaHoras = H.horasTexto(minJuntas), data = diaMes(api.iso());
      return { tipo: 'folga', texto: todo ? L().tirarFolga(nome, data, folgaHoras, folgaNaTroca) : textoFolga(folgaPeriodos, nome, folgaHoras, data, folgaNaTroca),
        sim: L().descontar(folgaHoras), nao: L().naoDescontar, padrao: 'nao', motivo: R().motivoNoRascunho(cpf),
        aplicar: function (escolha, motivo) { api.darFolga(cpf, escolha === 'sim', todo ? null : folgaPeriodos, motivo); } };
    }
    var hp = H.horasTexto(credito);
    return { tipo: 'pontual', texto: L().tirarPontualTexto(nome, hp), sim: L().tirarPontualSim(hp), nao: L().tirarPontualNao,
      padrao: null, aplicar: function (escolha) { tirarDoPontual(cpf, sem, true, escolha === 'sim'); } };
  }

  /* o remanejado, sem tela (a caixa da célula: o Devolver de quem saiu daqui e o Remover deste dia de quem veio de outra
     unidade): onde ele está, o Devolver à unidade de origem e o Tirar do dia, com as perguntas de sempre. Devolve null (ele
     não está remanejado) ou { texto, devolverTexto, devolver() e tirar }: tirar é o que o analisarDoDia devolveria pelo
     serviço dele aqui ({ tipo: 'subtela' } na troca e em quem entrou de mais de um jeito) ou, sem serviço aqui (ele saiu
     daqui), a folga do dia todo; em todos, o aplicar larga também o Devolver do rascunho (a folga desfaz o remanejamento
     gravado). devolver e aplicar mudam o rascunho (quem chama os põe no aoVivo) */
  function analisarRemanejado(cpf) {
    var api = ed(), H = api.horas, mil = api.militarDoDia(cpf), rm = mil && mil.remanejado;
    if (!rm) return null;
    var nome = nomeDe(mil), data = diaMes(api.iso()), tirar = null;
    if (!partesDe(mil).length) {
      var horas = H.horasTexto(minutosRemanejado(mil));
      tirar = { tipo: 'folga', texto: L().tirarFolga(nome, data, horas), sim: L().descontar(horas), nao: L().naoDescontar, padrao: 'nao',
        motivo: R().motivoNoRascunho(cpf), aplicar: function (escolha, motivo) { api.darFolga(cpf, escolha === 'sim', null, motivo); } };
    } else {
      tirar = analisarPartes(mil, { cpf: cpf, periodos: (mil.janelas || []).map(copiar) });
    }
    if (tirar && tirar.aplicar) {
      var aplicar = tirar.aplicar;
      tirar.aplicar = function (escolha, motivo) { api.largarRemanejado(cpf); aplicar(escolha, motivo); };
    }
    /* quem fica nas duas e o remanejado pelo sistema: a frase de sempre, que diz isso */
    var texto = rm.fica || rm.automatico ? L().remanejadoTexto(nome, rm.de_nome, rm.para_nome, rm.fica, rm.automatico)
      : L().remanejadoEsta(nome, rm.para_nome);
    return { texto: texto, devolverTexto: L().devolverA(rm.de_nome), devolver: function () { api.devolverRemanejado(cpf); }, tirar: tirar };
  }

  /* a mudança da parte dele que veio de outro dia (p, de partesDe): { id, de ("19/11"), deIso, periodos, janelas, troca (o
     serviço era de troca) }, o mesmo formato do escalasPainelMudarDia.mudancaDe */
  function mudancaDaParte(mil, p) {
    var js = (mil.janelas || []).filter(function (j) { return j.origem === 'mudanca' && j.mudanca_id === p.mudancaId; });
    return { id: p.mudancaId, de: p.mudancaDe, deIso: p.mudancaDeIso, periodos: p.periodos, janelas: js,
      troca: js.some(function (j) { return !!j.mudanca_troca; }) };
  }

  /* quem veio de outro dia (v, a mudança dele): a frase de onde veio e as três respostas, as mesmas no painel e na caixa
     da célula: Fica de folga no dia de antes (com a pergunta do banco de horas; na troca, ela continua valendo), Muda para
     outra data (as perguntas do Mudar o dia, escalas-painel-mudar-dia.js, que põem a resposta no rascunho sozinhas) e
     Volta ao serviço de antes. volta() e folga.aplicar(escolha) mudam o rascunho (quem chama os põe no aoVivo);
     outra(pendurar, opcoes) monta as perguntas e devolve { pelaMetade(), marcarFalta() } */
  function respostasDaMudanca(mil, v) {
    var api = ed(), H = api.horas, cpf = mil.cpf, nome = nomeDe(mil);
    var horas = H.horasTexto(H.uniao(v.periodos.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0));
    return {
      de: v.de, texto: L().mudancaVeio(v.de), folgaTexto: L().ficaDeFolga(v.de), voltaTexto: L().voltaAoServico(v.de),
      folga: { texto: L().tirarFolga(nome, v.de, horas, v.troca), sim: L().descontar(horas), nao: L().naoDescontar, padrao: 'nao',
        aplicar: function (escolha) { api.tirarMudanca(v.id, escolha === 'sim', v.deIso, cpf, v.periodos); } },
      volta: function () { api.desfazerMudanca(v.id, v.deIso, cpf, v.periodos); },
      outra: function (pendurar, opcoes) {
        return RosterWork.escalasPainelMudarDia.criar(Object.assign({ cpf: cpf, mudanca: v }, opcoes || {}), pendurar);
      }
    };
  }

  /* quem está no dia só pelo serviço que veio de outro dia, sem tela (a caixa da célula: o Remover deste dia do pontual
     do dia novo): as respostas dele (respostasDaMudanca), ou null nos outros */
  function analisarMudanca(cpf) {
    var mil = ed().militarDoDia(cpf), MD = RosterWork.escalasPainelMudarDia;
    var v = mil && MD ? MD.mudancaDe(mil) : null;
    return v ? respostasDaMudanca(mil, v) : null;
  }

  /* o Dar folga neste dia da linha riscada da mudança de dia, pelo dia de antes (f = a linha da folga do dia, com a
     mudança): ele sai do dia novo e este vira folga, com a pergunta do banco de horas do Tirar do dia (o Não descontar
     marcado; sem o Motivo: o banco escreve o dele). O mesmo no painel (doDia) e na caixa 2 da célula */
  function analisarFolgaDaMudanca(f) {
    var api = ed(), H = api.horas, mud = f && f.mudanca;
    if (!mud || !f.hi || !f.hf) return null;
    var faixa = H.faixa({ hi: f.hi, hf: f.hf }), horas = H.horasTexto(faixa[1] - faixa[0]);
    return { tipo: 'folga', semMotivo: true, cpf: f.cpf, padrao: 'nao', motivo: '',
      texto: L().tirarFolga(nomeDe(f), diaMes(api.iso()), horas), sim: L().descontar(horas), nao: L().naoDescontar,
      aplicar: function (escolha) { api.tirarMudanca(mud.id, escolha === 'sim', String(mud.para_iso || '').slice(0, 10)); } };
  }

  /* m = { cpf, periodos, trocaId }: quem sai e as horas que saem (o dia todo dele, do menu da linha) e, na sub-tela, a
     parte da troca que já vem escolhida (o Cancelar a troca da célula); linha = a linha da lista; pronta: a pergunta já
     pronta (o Dar folga da linha da mudança, analisarFolgaDaMudanca) */
  function doDia(m, linha, pronta) {
    fecharPergunta('guardar');
    var api = ed(), a = linha ? (pronta || analisarDoDia(m)) : null;
    if (!a) return;
    if (a.tipo === 'subtela') { abrir({ cpf: a.cpf, trocaId: (m && m.trocaId) || null }); return; }
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
      /* a folga: ele já sai do dia, sem descontar (ao vivo, com o Não descontar marcado); o Motivo, embaixo das respostas,
         vai junto a cada letra; a resposta, também a já marcada, fica e a pergunta fecha (o Enter no Motivo, o mesmo); o
         Cancelar volta tudo */
      api.comecarVivo();
      var escolha = a.padrao, motivo = a.motivo;
      var aplicar = function () { api.aoVivo(function () { a.aplicar(escolha, motivo); }, false); };
      ligarRadios(el, function () {})(a.padrao);
      aplicar();
      var acoes = q('.pergunta-linha-acoes');
      if (!a.semMotivo) {
        acoes.parentNode.insertBefore(R().campoMotivo(null, motivo, function (t) { motivo = t; aplicar(); },
          function () { aplicar(); fecharPergunta(); }), acoes);
      }
      [].forEach.call(el.querySelectorAll('input[type="radio"]'), function (r) {
        r.addEventListener('click', function () { escolha = r.value; aplicar(); fecharPergunta(); });
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

  window.RosterWork.escalasPainelRemover = { abrir: abrir, doDia: doDia, analisarDoDia: analisarDoDia,
    analisarRemanejado: analisarRemanejado, analisarMudanca: analisarMudanca, analisarFolgaDaMudanca: analisarFolgaDaMudanca,
    fecharPergunta: fecharPergunta,
    /* o menu da linha mostra o Remover do dia só com algo que sai por aqui (a extra muda na Extrajornada) */
    podeTirar: function (cpf) { return podeTirar(ed().militarDoDia(cpf)); } };
})();
