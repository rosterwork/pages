/* ============================================================
   AJUSTES — aba Sobreaviso: as regras do sobreaviso da companhia
   As perguntas (ajustes_sobreaviso_ler): de quem é (da companhia ou
   de cada pelotão), onde aparece (só no da companhia: uma caixa de
   marcar por unidade, do molde tpl-ajustes-onde; sem resposta, o
   pelotão de número menor), quantos por dia, quem entra na fila
   (postos e graduações; setores) e se cada dia mistura antigos e
   modernos (as metades da antiguidade). As outras caixas, as bolinhas
   e a lista de 1 a 10 estão no ajustes.html; aqui só os valores.
   Edita na própria tela; o Salvar do rodapé largo pergunta a data
   (pedirData, já sugerida) e grava todas (ajustes_sobreaviso_salvar →
   Histórico → resumo); a fila é refeita dali. Só o Onde aparece
   mudou: grava sem a data (vale para todos os dias; a fila fica). O
   Salvar fica desligado com pergunta sem resposta. Só o administrador
   da companhia vê a aba (ajustes.js); quem não muda só lê (o cadeado).
   RosterWork.ajustesSobreaviso.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do ajustes_sobreaviso_ler
  var regras = null;     // as respostas em edição: { de, exibir, por_dia, graus, setores, metades }
  var inicial = '';      // as gravadas, para saber se mudou
  var pedido = 0;        // latest-wins
  var textoVazio = '';   // o "Escolha" do HTML, que volta quando a pergunta 2 fica sem resposta
  var guardaLigada = false;

  /* a ordem das caixas de marcar, para comparar e gravar sempre igual */
  var ORDEM = {
    graus: ['oficiais', 'subtenentes_sargentos', 'cabos', 'soldados'],
    setores: ['operacional', 'administrativo', 'aluno']
  };

  function msg() { return RW.mensagens.ajustes.sobreaviso; }
  function sujo() { return !!regras && JSON.stringify(regras) !== inicial; }
  function montada() { return !!(el.conteudo && el.conteudo.isConnected); }
  function pode() { return !!(dados && dados.pode_editar); }
  function respondida() {
    return !!regras && !!regras.de && (regras.de !== 'companhia' || regras.exibir.length > 0) && !!regras.por_dia &&
      regras.graus.length > 0 && regras.setores.length > 0 && typeof regras.metades === 'boolean';
  }
  /* mudou só o Onde aparece (grava sem a data: a fila não muda) */
  function soOnde() {
    var antes = JSON.parse(inicial);
    antes.exibir = regras.exibir;
    return JSON.stringify(antes) === JSON.stringify(regras);
  }

  /* as unidades da companhia, na ordem da leitura (a companhia, depois os pelotões pelo número) */
  function ordemUnidades() { return ((dados && dados.unidades) || []).map(function (u) { return u.id; }); }

  /* as regras gravadas na forma da tela (sem regras: tudo sem resposta; sem o Onde aparece, o pelotão de número menor) */
  function daLeitura(r) {
    r = r || {};
    var primeiro = ((dados && dados.unidades) || []).filter(function (u) { return u.tipo === 'PEL'; })[0];
    return {
      de: r.de || null,
      exibir: Array.isArray(r.exibir)
        ? ordemUnidades().filter(function (id) { return r.exibir.indexOf(id) >= 0; })
        : (primeiro ? [primeiro.id] : []),
      por_dia: r.por_dia || null,
      graus: ORDEM.graus.filter(function (v) { return (r.graus || []).indexOf(v) >= 0; }),
      setores: ORDEM.setores.filter(function (v) { return (r.setores || []).indexOf(v) >= 0; }),
      metades: typeof r.metades === 'boolean' ? r.metades : null
    };
  }

  /* ---------- ler ---------- */
  /* gravou: a leitura depois do Salvar, com o cartão das etapas na frente: o que está na tela fica até o novo chegar */
  function carregar(gravou) {
    var meu = ++pedido;
    RW.falha.tirarAntes(el.conteudo);
    var leitura = RW.rpc('ajustes_sobreaviso_ler', {});
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
      regras = daLeitura(r.regras);
      inicial = JSON.stringify(regras);
      montarOnde();
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

    /* de quem é (e o "em cada pelotão" do título do Quantos por dia) */
    marcarBolinhas(el.de, function (v) { return v === regras.de; }, travado);
    el.cadaPelotao.classList.toggle('oculto', regras.de !== 'pelotao');

    /* onde aparece: só no sobreaviso da companhia (no de cada pelotão, cada um mostra o seu) */
    el.onde.classList.toggle('oculto', regras.de !== 'companhia');
    el.onde.querySelectorAll('[role="checkbox"][data-unidade]').forEach(function (b) {
      marcarCaixa(b, regras.exibir.indexOf(Number(b.getAttribute('data-unidade'))) >= 0, travado);
    });

    /* quantos por dia: o texto do item escolhido */
    var texto = el.quantos.querySelector('.campo-selecao-texto');
    var item = el.quantosMenu.querySelector('.dropdown-item[data-valor="' + regras.por_dia + '"]');
    texto.textContent = item ? item.textContent : textoVazio;
    texto.classList.toggle('campo-selecao-texto--vazio', !item);
    el.quantosMenu.querySelectorAll('.dropdown-item').forEach(function (i) { i.classList.toggle('dropdown-item--ativo', i === item); });
    el.quantos.disabled = travado;

    /* quem entra: as caixas de marcar */
    el.quem.querySelectorAll('[role="checkbox"][data-grupo]').forEach(function (b) {
      marcarCaixa(b, regras[b.getAttribute('data-grupo')].indexOf(b.getAttribute('data-valor')) >= 0, travado);
    });

    /* antigos e modernos */
    marcarBolinhas(el.metades, function (v) { return regras.metades === (v === 'sim'); }, travado);

    desenharRodape();
  }

  function marcarCaixa(b, marcado, travado) {
    b.setAttribute('aria-checked', marcado ? 'true' : 'false');
    b.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcado);
    b.disabled = travado;
  }

  /* as caixas do Onde aparece: uma por unidade da companhia (a cada leitura; o clique liga e desliga a unidade) */
  function montarOnde() {
    el.onde.querySelectorAll('[role="checkbox"][data-unidade]').forEach(function (b) { b.remove(); });
    (dados.unidades || []).forEach(function (u) {
      var b = RW.tpl('tpl-ajustes-onde');
      if (!b) return;
      b.setAttribute('data-unidade', String(u.id));
      b.querySelector('.nova-distribuicao-marca-texto').textContent = u.nome;
      b.addEventListener('click', function () {
        var ligado = regras.exibir.indexOf(u.id) < 0;
        regras.exibir = ordemUnidades().filter(function (id) { return id === u.id ? ligado : regras.exibir.indexOf(id) >= 0; });
        desenhar();
      });
      el.onde.appendChild(b);
    });
  }

  function marcarBolinhas(caixa, marcado, travado) {
    caixa.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.checked = marcado(inp.getAttribute('data-valor'));
      inp.disabled = travado;
    });
  }

  /* o rodapé largo aparece só com alteração (e só para quem muda); o Salvar, só com as quatro respondidas */
  function desenharRodape() {
    el.rodape.classList.toggle('oculto', !(pode() && sujo()));
    el.salvar.disabled = !respondida();
  }

  /* ---------- editar (as peças são fixas no HTML: liga uma vez por visita) ---------- */
  function ligar() {
    el.de.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.addEventListener('change', function () { regras.de = inp.getAttribute('data-valor'); desenhar(); });
    });
    RW.campos.ligarSelecao(el.quantos, function (valor) { regras.por_dia = Number(valor); desenhar(); });
    el.quem.querySelectorAll('[role="checkbox"][data-grupo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var grupo = b.getAttribute('data-grupo');
        var valor = b.getAttribute('data-valor');
        var marcados = regras[grupo];
        var ligado = marcados.indexOf(valor) < 0;
        regras[grupo] = ORDEM[grupo].filter(function (v) { return v === valor ? ligado : marcados.indexOf(v) >= 0; });
        desenhar();
      });
    });
    el.metades.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.addEventListener('change', function () { regras.metades = inp.getAttribute('data-valor') === 'sim'; desenhar(); });
    });
    el.cancelar.addEventListener('click', function () { confirmarDescarte(function () {}); });
    el.salvar.addEventListener('click', salvar);
  }

  /* volta ao que está gravado */
  function descartar() {
    regras = JSON.parse(inicial);
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

  /* o Salvar: a data em que a fila nova começa (já sugerida: o próximo dia de serviço); só o Onde aparece mudou, sem a
     data (vale para todos os dias e a fila fica) */
  function salvar() {
    if (!sujo() || !respondida()) return;
    if (soOnde()) { enviar(null); return; }
    RW.pedirData({
      sugerida: true, titulo: msg().salvarTitulo, sugestaoAntes: msg().salvarAntes, sugestaoDepois: msg().salvarDepois,
      textoConfirmar: msg().botaoSalvar,
      aoConfirmar: enviar
    });
  }

  /* grava as respostas; a fila da companhia é refeita, menos quando só o Onde aparece mudou (desde: null) (o cartão das
     etapas enquanto grava e a tela lê de novo); no fim, o resumo */
  function enviar(desde) {
    var etapas = RW.etapas.acao('ajustesSobreaviso', { soOnde: !desde }, { doServidor: desde ? 2 : 1 });
    RW.rpc('ajustes_sobreaviso_salvar', { p_unidade: dados.companhia.id, p_regras: regras, p_desde: desde }).then(function (r) {
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
    ['conteudo', 'carregando', 'companhia', 'trava', 'rodape', 'cancelar', 'salvar', 'de', 'onde', 'quantos', 'quem',
     'metades', 'cada-pelotao'].forEach(function (nome) {
      el[nome.replace(/-(\w)/g, function (x, l) { return l.toUpperCase(); })] = cont.querySelector('#sobreaviso-' + nome);
    });
    el.quantosMenu = el.quantos.closest('.dropdown').querySelector('.dropdown-menu');
    textoVazio = el.quantos.querySelector('.campo-selecao-texto').textContent;
    dados = null;
    regras = null;
    inicial = '';
    ligar();
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return montada() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a 1ª vez que a aba abre na visita, lê */
  function ativar() { return dados ? Promise.resolve() : carregar(); }

  RW.ajustesSobreaviso = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
