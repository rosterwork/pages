/* ============================================================
   ESCALAS — militar no dia (o lápis do Dia; só admin)
   Sub-tela do painel do dia: a régua grande do dia do militar (as
   funções com o nome, e o hachurado onde está sem função) e a lista
   "Funções no dia": cada função com a caixa de marcar (marcada ele
   continua; desmarcada ele deixa, e o efeito aparece ali mesmo) e os
   horários em campos, com o Adicionar horário na 1ª linha e o ✕ em
   cada horário quando há mais de um. Horário sem função tem o "Dar
   função". Ações: Nova função (Para onde + Quando) e Tirar do dia
   (do ciclo: folga, com o modal do banco de horas; pontual: sai do
   dia). As mudanças ficam aqui até Aplicar, que as grava
   (escalas-painel-editar.js) e volta ao dia.
   A folga no dia (o lápis da caixa De folga): quem está de folga, o
   horário, o efeito de cancelar e o Cancelar folga, que confirma e
   grava na hora; sem rodapé, a saída é o Voltar ao dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa: não se mexe neles */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function pecas() { return RosterWork.escalasPainel.pecas; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function hojeIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function copiaLinha(l) { var c = {}; for (var k in l) c[k] = l[k]; return c; }
  function chave(l) { return l.posto.tipo + ':' + l.posto.id + '|' + l.funcao; }

  /* as linhas do militar ao abrir: cada colocação manual do rascunho (com quem ela substitui)
     e cada período automático da prévia; em ordem de horário */
  function linhasDoMilitar(cpf) {
    var api = ed(), H = api.horas;
    var linhas = [];
    api.rascunho().ajustes.forEach(function (a) {
      if (a.acao !== 'colocar' || a.cpf !== cpf) return;
      var posto = api.acharPosto(a.viatura_id || null, a.instalacao_id || null);
      if (!posto) return;
      linhas.push({ posto: posto, funcao: a.nome_funcao, hi: a.hi, hf: a.hf, manual: true, subst: a.substitui || null,
        acumula: a.acumula !== false, intacta: true, bloqueada: BLOQUEADAS.test(a.nome_funcao) });
    });
    api.funcoesDoMilitar(cpf).forEach(function (e) {
      if (e.fixado) return;
      e.periodos.forEach(function (per) {
        linhas.push({ posto: e.posto, funcao: e.funcao, hi: per.hi, hf: per.hf, manual: false, subst: cpf,
          acumula: true, intacta: true, bloqueada: e.bloqueado });
      });
    });
    return linhas.sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
  }

  function abrir(cpf) {
    var api = ed(), H = api.horas, p = pecas();
    var mil = api.militarDoDia(cpf);
    if (!mil) return;
    var abertura = linhasDoMilitar(cpf);
    var linhas = abertura.map(copiaLinha);
    var deixa = {};   // funções desmarcadas (ele deixa): chave -> true

    function desenhar() { api.abrir(msg().formBotaoAplicar, montar, aplicar); }

    /* as linhas das funções que ele continua */
    function ativas() { return linhas.filter(function (l) { return !deixa[chave(l)]; }); }

    /* as funções do dia, cada uma com as suas linhas, na ordem do horário */
    function grupos() {
      var lista = [], por = {};
      linhas.slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); }).forEach(function (l) {
        var k = chave(l);
        if (!por[k]) { por[k] = { k: k, posto: l.posto, funcao: l.funcao, bloqueada: l.bloqueada, linhas: [] }; lista.push(por[k]); }
        por[k].linhas.push(l);
      });
      return lista;
    }

    /* os horários do serviço dele sem nenhuma função (das que ele continua) */
    function semFuncao() {
      return H.menos(mil.janelas.map(H.faixa), ativas().map(H.faixa)).map(H.periodo);
    }

    /* os pedaços da régua grande: em cada trecho do dia, as funções que ele tem ali (acumulando, os nomes
       juntos: "Rádio Op. + Rancheiro"); os horários sem função ficam hachurados */
    function pedacosDoDia(livres) {
      var marcos = {};
      var as = ativas();
      as.forEach(function (l) { var f = H.faixa(l); marcos[f[0]] = true; marcos[f[1]] = true; });
      var pontos = Object.keys(marcos).map(Number).sort(function (a, b) { return a - b; });
      var pedacos = [];
      for (var i = 0; i + 1 < pontos.length; i++) {
        var trecho = [pontos[i], pontos[i + 1]];
        var aqui = as.filter(function (l) { return !!H.cruza(H.faixa(l), trecho); });
        if (!aqui.length) continue;
        var texto = aqui.map(function (l) { return p.abreviarFuncao(l.funcao); }).join(' + ');
        var classe = aqui.some(function (l) { return !l.intacta; }) ? 'novo' : '';
        var ult = pedacos[pedacos.length - 1];
        if (ult && ult.fim === trecho[0] && ult.texto === texto && ult.classe === classe) { ult.fim = trecho[1]; continue; }
        pedacos.push({ ini: trecho[0], fim: trecho[1], texto: texto, classe: classe });
      }
      /* trecho curto (menos de 3 horas) fica sem o nome escrito; o nome vai na dica */
      function pedaco(f, texto, classe) {
        var pr = H.periodo(f);
        return { hi: pr.hi, hf: pr.hf, texto: f[1] - f[0] >= 180 ? texto : '', dica: texto, classe: classe };
      }
      return pedacos.map(function (x) { return pedaco([x.ini, x.fim], x.texto, x.classe); })
        .concat(livres.map(function (g) { return pedaco(H.faixa(g), msg().semFuncaoRotulo, 'vazio'); }));
    }

    /* "Adicionar horário" numa função: o próximo horário do serviço dele sem função (uma hora);
       se não houver, o próximo horário do serviço fora desta função (aí ele acumula) */
    function adicionarHorario(g) {
      var janelas = mil.janelas.map(H.faixa);
      var fimUltimo = H.faixa(g.linhas[g.linhas.length - 1])[1];
      function primeiro(livres) { return livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0]; }
      var livre = primeiro(H.menos(janelas, ativas().map(H.faixa))) || primeiro(H.menos(janelas, g.linhas.map(H.faixa)));
      if (!livre) { RosterWork.avisar({ tipo: 'aviso', mensagem: msg().semHorarioLivre }); return; }
      var pr = H.periodo([livre[0], Math.min(livre[0] + 60, livre[1])]);
      var base = g.linhas[0];
      linhas.push({ posto: base.posto, funcao: base.funcao, hi: pr.hi, hf: pr.hf, manual: true, subst: null,
        acumula: true, intacta: false, bloqueada: false });
      desenhar();
    }

    /* uma função da lista: a caixa de marcar, o nome e o posto, os horários e (desmarcada) o efeito */
    function linhaFuncao(lista, g) {
      var el = RosterWork.tpl('tpl-escala-militar-funcao');
      if (!el) return;
      var marcada = !deixa[g.k];
      var caixa = el.querySelector('.caixa-selecao');
      caixa.classList.toggle('caixa-selecao--marcada', marcada);
      caixa.setAttribute('aria-checked', marcada ? 'true' : 'false');
      caixa.setAttribute('aria-label', api.funcaoNoPosto(g.funcao, g.posto));
      if (g.bloqueada) {
        caixa.disabled = true;
      } else {
        caixa.addEventListener('click', function () { deixa[g.k] = !deixa[g.k]; desenhar(); });
      }
      if (!marcada) el.classList.add('escala-militar-funcao--deixa');
      el.querySelector('.escala-militar-funcao-titulo').textContent = g.funcao;
      el.querySelector('.escala-militar-funcao-posto').textContent = g.posto.nome;
      var horarios = el.querySelector('.escala-militar-funcao-horarios');
      /* os horários: campos com as horas do serviço dele, ou fixos (função automática) */
      var mexe = !g.bloqueada && marcada;
      g.linhas.forEach(function (l, i) {
        var h = RosterWork.horario.linha({
          hi: l.hi, hf: l.hf, opcoes: H.opcoesHoras(mil.janelas), fixo: g.bloqueada, desligado: !marcada,
          aoInicio: function (hora) { l.hi = hora; l.intacta = false; desenhar(); },
          aoFim: function (hora) { l.hf = hora; l.intacta = false; desenhar(); },
          aoRemover: mexe && g.linhas.length > 1 ? function () { linhas.splice(linhas.indexOf(l), 1); desenhar(); } : null,
          aoAdicionar: mexe && i === 0 ? function () { adicionarHorario(g); } : null
        });
        if (h) horarios.appendChild(h);
      });
      if (g.bloqueada) {
        var auto = RosterWork.tpl('tpl-escala-militar-funcao-auto');
        if (auto) el.appendChild(auto);
      }
      if (!marcada) {
        var efeito = RosterWork.tpl('tpl-escala-militar-efeito');
        if (efeito) {
          efeito.querySelector('.escala-militar-efeito-texto').textContent =
            msg().militarDeixa(api.funcaoNoPosto(g.funcao, g.posto), H.textoPeriodos(g.linhas.map(function (l) { return { hi: l.hi, hf: l.hf }; })));
          el.appendChild(efeito);
        }
      }
      lista.appendChild(el);
    }

    /* um horário do serviço sem função: o horário e o "Dar função" */
    function linhaSemFuncao(lista, g) {
      var el = RosterWork.tpl('tpl-escala-militar-sem-funcao');
      if (!el) return;
      var h = p.hora(g);
      if (h) el.querySelector('.escala-militar-sem-funcao-horas').appendChild(h);
      el.querySelector('.escala-militar-dar-funcao').addEventListener('click', function () { novaFuncao(g); });
      lista.appendChild(el);
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-militar');
      if (!tela) return;
      var j = mil.janelas;
      tela.querySelector('.escala-distribuicao-grad').textContent = mil.grad;
      tela.querySelector('.escala-militar-nome-texto').textContent = mil.nome;
      /* o serviço dele aqui no dia, cada horário com a origem (ex.: a extra e o pontual) */
      tela.querySelector('.escala-militar-servico').textContent = j.length
        ? msg().servico(j.slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); }).map(function (x) {
          return { hi: H.curta(x.hi), hf: H.curta(x.hf), origem: x.origem || mil.origem };
        }))
        : msg().semServicoNoDia;

      var livres = semFuncao();
      var rg = RosterWork.horario.criarRegua('grande');
      if (rg) { tela.querySelector('.escala-militar-regua').appendChild(rg); H.regua(rg, pedacosDoDia(livres)); }

      var lista = tela.querySelector('.escala-militar-funcoes');
      grupos().forEach(function (g) { linhaFuncao(lista, g); });
      livres.forEach(function (g) { linhaSemFuncao(lista, g); });

      var btNova = tela.querySelector('.escala-militar-nova');
      var btTirar = tela.querySelector('.escala-militar-tirar');
      btNova.disabled = !j.length;
      /* só extra aqui: a extra sai pela aba Extrajornada */
      btTirar.disabled = !mil.pontual && (!j.length || j.every(function (x) { return x.origem === 'extra'; }));
      btNova.addEventListener('click', function () { novaFuncao(livres[0] || j[0]); });
      btTirar.addEventListener('click', tirarDoDia);
      corpo.appendChild(tela);
    }

    function gravar() { api.aplicarMilitar(cpf, abertura, ativas()); }
    function aplicar() { gravar(); api.concluir(); }

    /* Nova função e o "Dar função": grava o que mudou aqui e abre o formulário com ele já escolhido */
    function novaFuncao(per) {
      gravar();
      api.previa(function () { api.abrirFormulario({ modo: 'nova', cpf: cpf, hi: per.hi, hf: per.hf }); });
    }

    /* Tirar do dia: o pontual sai do dia (se as horas dele já foram para o banco de horas, pergunta se tira);
       o do ciclo ganha folga no dia inteiro (pergunta se desconta do banco de horas). Quem também serve em outra
       unidade no dia ganha a folga só nos horários daqui (fora a extra), e o serviço de lá não muda */
    function tirarDoDia() {
      var botoes = RosterWork.mensagens.botoes;
      function perguntar(mensagem, aoSim, aoNao) {
        RosterWork.confirmar({ tipo: 'aviso', mensagem: mensagem,
          textoConfirmar: botoes.contabilizar, textoAlternativo: botoes.naoContabilizar, textoCancelar: botoes.cancelar,
          aoConfirmar: aoSim, aoAlternativo: aoNao });
      }
      if (mil.pontual) {
        var salvo = (api.dados().pontuais || []).filter(function (x) { return x.cpf === cpf; })[0];
        if (api.pontualSalvo(cpf) && salvo && salvo.contabilizado) {
          perguntar(msg().contabilizarTirarPontual(nomeDe(mil), H.horasTexto(salvo.minutos)),
            function () { api.tirarPontual(cpf, true); api.concluir(); },
            function () { api.tirarPontual(cpf, false); api.concluir(); });
          return;
        }
        api.tirarPontual(cpf, false);
        api.concluir();
        return;
      }
      if (cpf === RosterWork.sessao.cpf()) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().folgaSiMesmo }); return; }
      var daqui = mil.outraUnidade
        ? H.uniao(mil.janelas.filter(function (x) { return x.origem !== 'extra'; }).map(H.faixa)).map(H.periodo)
        : null;
      var janelas = daqui || mil.janelas;
      if (!janelas.length) return;
      var min =janelas.reduce(function (s, x) { var f = H.faixa(x); return s + f[1] - f[0]; }, 0);
      var fm = RosterWork.mensagens.folgas;
      var periodo = fm.periodoDas(H.curta(janelas[0].hi), H.curta(janelas[0].hf));
      perguntar(fm.contabilizarFolga(nomeDe(mil), diaMes(api.iso()), periodo, H.horasTexto(min), api.iso() < hojeIso()),
        function () { api.darFolga(cpf, true, daqui); api.concluir(); },
        function () { api.darFolga(cpf, false, daqui); api.concluir(); });
    }

    desenhar();
  }

  /* a folga no dia: id = a folga (lancamento_id); as linhas dela no dia dão o horário */
  function abrirFolga(id) {
    var api = ed(), H = api.horas;
    var linhas = ((api.dados() || {}).folgas || []).filter(function (f) { return f.lancamento_id === id; });
    if (!linhas.length) return;
    var f = linhas[0];
    var contabilizada = !!f.contabilizada;

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-folga-dia');
      if (!tela) return;
      tela.querySelector('.escala-distribuicao-grad').textContent = f.grad || '';
      tela.querySelector('.escala-militar-nome-texto').textContent = f.nome || '';
      tela.querySelector('.escala-folga-dia-periodo').textContent =
        msg().folgaNoDia(f.dia_inteiro ? '' : H.textoPeriodos(linhas), contabilizada);
      tela.querySelector('.nota-texto').textContent = msg().cancelarFolgaEfeito(nomeDe(f), contabilizada);
      tela.querySelector('.escala-folga-dia-cancelar').addEventListener('click', cancelar);
      corpo.appendChild(tela);
    }

    function cancelar() {
      var botoes = RosterWork.mensagens.botoes;
      RosterWork.confirmar({ tipo: 'aviso', mensagem: msg().confirmarCancelarFolga(nomeDe(f), diaMes(api.iso())),
        textoConfirmar: botoes.cancelarFolga, textoCancelar: botoes.manter, confirmarPerigo: true,
        aoConfirmar: function () { api.cancelarFolga(id); api.concluir(); } });
    }

    api.abrir(null, montar, null);
  }

  window.RosterWork.escalasPainelMilitar = { abrir: abrir, abrirFolga: abrirFolga };
})();
