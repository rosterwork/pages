/* ============================================================
   AJUSTES — aba Op. Verão: a Operação Verão da companhia
   As perguntas (ajustes_op_verao_ler): se a companhia tem Operação
   Verão e, só com o Sim, o período (de/até, o campo de data padrão),
   os postos dos guarda-vidas (uma linha por posto, do molde
   tpl-op-verao-posto, com a lixeira e o Adicionar posto) e os turnos
   (Manhã, Tarde e Dia todo, com o horário do site em horas inteiras,
   como o Horário de expediente). As caixas estão no ajustes.html;
   aqui só os valores. Edita na própria tela; o Salvar do rodapé largo
   grava tudo (ajustes_op_verao_salvar → Histórico → resumo), sem a
   data (o período é a data dela). Marcar o Não pergunta antes (os
   lançamentos ficam guardados). O Salvar fica desligado com pergunta
   pela metade. Só o administrador da companhia vê a aba (ajustes.js);
   quem não muda só lê (o cadeado).
   RosterWork.ajustesOpVerao.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do ajustes_op_verao_ler
  var cfg = null;        // as respostas em edição: { ativa, inicio, fim, turnos: [{chave, inicio, fim}], postos: [{id, nome}] }
  var inicial = '';      // as gravadas, para saber se mudou
  var pedido = 0;        // latest-wins
  var guardaLigada = false;

  function msg() { return RW.mensagens.ajustes.opVerao; }
  function sujo() { return !!cfg && JSON.stringify(cfg) !== inicial; }
  function montada() { return !!(el.conteudo && el.conteudo.isConnected); }
  function pode() { return !!(dados && dados.pode_editar); }

  /* as horas de um turno, no mesmo dia: o início de 00 a 22 e o fim de 01 a 23 */
  function horas() {
    var lista = { inicios: [], fins: [] };
    for (var h = 0; h <= 23; h++) {
      var t = ('0' + h).slice(-2);
      if (h < 23) lista.inicios.push(t);
      if (h > 0) lista.fins.push(t);
    }
    return lista;
  }

  /* respondida: o Sim/Não; com o Sim, as duas datas (o fim no início ou depois), os nomes dos postos sem repetir e cada
     turno terminando depois de começar */
  function respondida() {
    if (!cfg || typeof cfg.ativa !== 'boolean') return false;
    if (!cfg.ativa) return true;
    if (!cfg.inicio || !cfg.fim || cfg.fim < cfg.inicio) return false;
    var nomes = cfg.postos.map(function (p) { return p.nome.trim().toLowerCase(); });
    if (nomes.some(function (n, i) { return !n || nomes.indexOf(n) !== i; })) return false;
    return cfg.turnos.every(function (t) { return t.fim > t.inicio; });
  }

  /* a configuração gravada na forma da tela (sem resposta ainda: o Sim/Não vazio e os turnos de sempre) */
  function daLeitura(r) {
    var c = r.config || {};
    return {
      ativa: typeof c.ativa === 'boolean' ? c.ativa : null,
      inicio: c.inicio || null,
      fim: c.fim || null,
      turnos: (r.turnos || []).map(function (t) { return { chave: t.chave, inicio: t.inicio, fim: t.fim }; }),
      postos: (r.postos || []).map(function (p) { return { id: p.id, nome: p.nome }; })
    };
  }

  /* ---------- ler ---------- */
  /* gravou: a leitura depois do Salvar, com o cartão das etapas na frente: o que está na tela fica até o novo chegar */
  function carregar(gravou) {
    var meu = ++pedido;
    RW.falha.tirarAntes(el.conteudo);
    var leitura = RW.rpc('ajustes_op_verao_ler', {});
    if (!gravou) {
      el.carregando.classList.remove('oculto');
      el.conteudo.classList.add('oculto');
      el.rodape.classList.add('oculto');
      /* a forma entra na hora e fica o mínimo na tela (geral-etapas.js) */
      leitura = RW.etapas.segurarDesde(performance.now(), leitura);
    }
    return leitura.then(function (r) {
      if (meu !== pedido || !montada()) return;
      el.carregando.classList.add('oculto');
      if (r && r.error) { RW.avisar({ tipo: 'erro', mensagem: r.error }); return; }
      if (!r || !r.ok) { falhou(); return; }
      dados = r;
      cfg = daLeitura(r);
      inicial = JSON.stringify(cfg);
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.carregando.classList.add('oculto');
      falhou();
    });
    /* a leitura que não veio: o aviso com o Tentar de novo antes do conteúdo (geral-falha.js) */
    function falhou() { RW.falha.antes(el.conteudo, RW.mensagens.geral.falhaCarregar, function () { carregar(gravou); }); }
  }

  /* ---------- desenhar: as respostas, a trava e o rodapé ---------- */
  function desenhar() {
    var travado = !pode();
    el.companhia.textContent = dados.companhia.nome;
    el.trava.classList.toggle('oculto', !travado);
    el.conteudo.classList.remove('oculto');

    el.ativa.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.checked = cfg.ativa === (inp.getAttribute('data-valor') === 'sim');
      inp.disabled = travado;
    });
    /* o período, os postos e os turnos só com o Sim */
    [el.periodo, el.postos, el.turnos].forEach(function (caixa) { caixa.classList.toggle('oculto', cfg.ativa !== true); });

    if (document.activeElement !== el.inicio) el.inicio.value = cfg.inicio ? RW.data.isoParaBR(cfg.inicio) : '';
    if (document.activeElement !== el.fim) el.fim.value = cfg.fim ? RW.data.isoParaBR(cfg.fim) : '';
    el.inicio.disabled = travado;
    el.fim.disabled = travado;

    desenharPostos(travado);
    desenharTurnos(travado);
    desenharRodape();
  }

  /* os postos: uma linha por posto (o campo do nome e a lixeira); a lista é refeita a cada desenho, menos o campo em uso */
  function desenharPostos(travado) {
    var foco = document.activeElement && el.postosLista.contains(document.activeElement)
      ? Array.prototype.indexOf.call(el.postosLista.children, document.activeElement.closest('.ajustes-op-verao-posto')) : -1;
    el.postosLista.textContent = '';
    cfg.postos.forEach(function (p, i) {
      var linha = RW.tpl('tpl-op-verao-posto');
      if (!linha) return;
      var campo = linha.querySelector('.campo-entrada');
      var lixeira = linha.querySelector('.nova-distribuicao-remover');
      campo.value = p.nome;
      campo.disabled = travado;
      lixeira.disabled = travado;
      campo.addEventListener('input', function () { p.nome = campo.value; desenharRodape(); });
      lixeira.addEventListener('click', function () { cfg.postos.splice(i, 1); desenhar(); });
      el.postosLista.appendChild(linha);
      if (i === foco) campo.focus();
    });
    el.postosVazio.classList.toggle('oculto', cfg.postos.length > 0);
    el.adicionarPosto.disabled = travado;
  }

  /* os turnos: o horário do site em cada linha (início → fim) */
  function desenharTurnos(travado) {
    el.turnos.querySelectorAll('.ajustes-horario-linha[data-turno]').forEach(function (linha) {
      var turno = cfg.turnos.filter(function (t) { return t.chave === linha.getAttribute('data-turno'); })[0];
      var lugar = linha.querySelector('.ajustes-horario-horas');
      lugar.textContent = '';
      if (!turno) return;
      lugar.appendChild(RW.horario.linha({
        hi: turno.inicio, hf: turno.fim, opcoes: horas(), semAcoes: true, desligado: travado,
        aoInicio: function (h) { turno.inicio = h.slice(0, 5); desenharRodape(); },
        aoFim: function (h) { turno.fim = h.slice(0, 5); desenharRodape(); }
      }));
    });
  }

  /* o rodapé largo aparece só com alteração (e só para quem muda); o Salvar, só com tudo respondido */
  function desenharRodape() {
    el.rodape.classList.toggle('oculto', !(pode() && sujo()));
    el.salvar.disabled = !respondida();
  }

  /* ---------- editar (as peças são fixas no HTML: liga uma vez por visita) ---------- */
  function ligar() {
    el.ativa.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.addEventListener('change', function () { cfg.ativa = inp.getAttribute('data-valor') === 'sim'; desenhar(); });
    });
    [['inicio', el.inicio], ['fim', el.fim]].forEach(function (x) {
      RW.campos.ligarData(x[1]);
      x[1].addEventListener('input', function () {
        var iso = RW.data.paraISO(x[1].value);
        cfg[x[0]] = /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso : null;
        desenharRodape();
      });
    });
    el.adicionarPosto.addEventListener('click', function () {
      cfg.postos.push({ id: null, nome: '' });
      desenhar();
      var campos = el.postosLista.querySelectorAll('.campo-entrada');
      if (campos.length) campos[campos.length - 1].focus();
    });
    el.cancelar.addEventListener('click', function () { confirmarDescarte(function () {}); });
    el.salvar.addEventListener('click', salvar);
  }

  /* volta ao que está gravado */
  function descartar() {
    cfg = JSON.parse(inicial);
    desenhar();
  }

  /* com edição não salva, pergunta antes de seguir; descartando, volta ao gravado */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { descartar(); seguir(); }, aoCancelar: ficar
    });
  }

  /* o Salvar: do Sim para o Não, pergunta antes (os lançamentos ficam guardados) */
  function salvar() {
    if (!sujo() || !respondida()) return;
    var antes = JSON.parse(inicial);
    if (antes.ativa === true && cfg.ativa === false) {
      RW.confirmar({
        tipo: 'aviso', mensagem: msg().desligar,
        textoConfirmar: msg().botaoDesligar, textoCancelar: RW.mensagens.botoes.cancelar,
        aoConfirmar: enviar
      });
      return;
    }
    enviar();
  }

  /* grava as respostas (não refaz a escala: os pontinhos no Salvar e o cartão das etapas só se demorar) e a tela lê de
     novo; no fim, o resumo. Com o Não, só ele vai (o período, os postos e os turnos ficam como estavam) */
  function enviar() {
    var corpo = cfg.ativa
      ? { ativa: true, inicio: cfg.inicio, fim: cfg.fim, turnos: cfg.turnos,
          postos: cfg.postos.map(function (p) { return { id: p.id, nome: p.nome.trim() }; }) }
      : { ativa: false };
    var etapas = RW.etapas.acao('ajustesOpVerao', {}, { doServidor: 1, atraso: true, semFila: true, botao: el.salvar });
    RW.rpc('ajustes_op_verao_salvar', { p_unidade: dados.companhia.id, p_config: corpo }).then(function (r) {
      if (!r || !r.success) {
        etapas.parar();
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      etapas.ultima();
      function fim() {
        etapas.parar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      }
      carregar(true).then(fim, fim);
    }, function () {
      etapas.parar();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- entrada (a cada visita à página) e a aba ---------- */
  function montar(cont) {
    ['conteudo', 'carregando', 'companhia', 'trava', 'rodape', 'cancelar', 'salvar', 'ativa', 'periodo', 'inicio', 'fim',
     'postos', 'postos-lista', 'postos-vazio', 'adicionar-posto', 'turnos'].forEach(function (nome) {
      el[nome.replace(/-(\w)/g, function (x, l) { return l.toUpperCase(); })] = cont.querySelector('#op-verao-' + nome);
    });
    dados = null;
    cfg = null;
    inicial = '';
    ligar();
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return montada() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a 1ª vez que a aba abre na visita, lê */
  function ativar() { return dados ? Promise.resolve() : carregar(); }

  RW.ajustesOpVerao = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
