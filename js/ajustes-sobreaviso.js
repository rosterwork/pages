/* ============================================================
   AJUSTES — aba Sobreaviso: as regras do sobreaviso da companhia
   Quatro perguntas (ajustes_sobreaviso_ler): de quem é (da companhia
   ou de cada pelotão), quantos por dia, quem entra na fila (postos e
   graduações; setores) e se cada dia mistura antigos e modernos (as
   metades da antiguidade). As caixas, as bolinhas e a lista de 1 a
   10 estão no ajustes.html; aqui só os valores. Edita na própria
   tela; o Salvar do rodapé largo pergunta a data (pedirData, já
   sugerida) e grava as quatro (ajustes_sobreaviso_salvar → Histórico
   → resumo); a fila é refeita dali. O Salvar fica desligado com
   pergunta sem resposta. Só o administrador da companhia vê a aba
   (ajustes.js); quem não muda só lê (o cadeado).
   RosterWork.ajustesSobreaviso.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do ajustes_sobreaviso_ler
  var regras = null;     // as respostas em edição: { de, por_dia, graus, setores, metades }
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
    return !!regras && !!regras.de && !!regras.por_dia && regras.graus.length > 0 && regras.setores.length > 0 &&
      typeof regras.metades === 'boolean';
  }

  /* as regras gravadas na forma da tela (sem regras: tudo sem resposta) */
  function daLeitura(r) {
    r = r || {};
    return {
      de: r.de || null,
      por_dia: r.por_dia || null,
      graus: ORDEM.graus.filter(function (v) { return (r.graus || []).indexOf(v) >= 0; }),
      setores: ORDEM.setores.filter(function (v) { return (r.setores || []).indexOf(v) >= 0; }),
      metades: typeof r.metades === 'boolean' ? r.metades : null
    };
  }

  /* ---------- ler ---------- */
  function carregar() {
    var meu = ++pedido;
    el.carregando.classList.remove('oculto');
    el.conteudo.classList.add('oculto');
    el.rodape.classList.add('oculto');
    /* a forma entra na hora e fica o mínimo na tela (geral-etapas.js) */
    return RW.etapas.segurarDesde(performance.now(), RW.rpc('ajustes_sobreaviso_ler', {})).then(function (r) {
      if (meu !== pedido || !montada()) return;
      el.carregando.classList.add('oculto');
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      regras = daLeitura(r.regras);
      inicial = JSON.stringify(regras);
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.carregando.classList.add('oculto');
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- desenhar: as respostas, a trava e o rodapé ---------- */
  function desenhar() {
    var travado = !pode();
    el.companhia.textContent = dados.companhia.nome;
    el.trava.classList.toggle('oculto', !travado);
    el.conteudo.classList.remove('oculto');

    /* 1. de quem é (e o "em cada pelotão" do título da 2) */
    marcarBolinhas(el.de, function (v) { return v === regras.de; }, travado);
    el.cadaPelotao.classList.toggle('oculto', regras.de !== 'pelotao');

    /* 2. quantos por dia: o texto do item escolhido */
    var texto = el.quantos.querySelector('.campo-selecao-texto');
    var item = el.quantosMenu.querySelector('.dropdown-item[data-valor="' + regras.por_dia + '"]');
    texto.textContent = item ? item.textContent : textoVazio;
    texto.classList.toggle('campo-selecao-texto--vazio', !item);
    el.quantosMenu.querySelectorAll('.dropdown-item').forEach(function (i) { i.classList.toggle('dropdown-item--ativo', i === item); });
    el.quantos.disabled = travado;

    /* 3. quem entra: as caixas de marcar */
    el.quem.querySelectorAll('[role="checkbox"][data-grupo]').forEach(function (b) {
      var marcado = regras[b.getAttribute('data-grupo')].indexOf(b.getAttribute('data-valor')) >= 0;
      b.setAttribute('aria-checked', marcado ? 'true' : 'false');
      b.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcado);
      b.disabled = travado;
    });

    /* 4. antigos e modernos */
    marcarBolinhas(el.metades, function (v) { return regras.metades === (v === 'sim'); }, travado);

    desenharRodape();
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

  /* o Salvar: a data em que a fila nova começa (já sugerida: o próximo dia de serviço) */
  function salvar() {
    if (!sujo() || !respondida()) return;
    RW.pedirData({
      sugerida: true, titulo: msg().salvarTitulo, sugestaoAntes: msg().salvarAntes, sugestaoDepois: msg().salvarDepois,
      textoConfirmar: msg().botaoSalvar,
      aoConfirmar: enviar
    });
  }

  /* grava as quatro respostas; a fila da companhia é refeita (o véu enquanto grava) */
  function enviar(desde) {
    RW.mostrarVeuGlobal();
    RW.rpc('ajustes_sobreaviso_salvar', { p_unidade: dados.companhia.id, p_regras: regras, p_desde: desde }).then(function (r) {
      RW.esconderVeuGlobal();
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      carregar();
    }, function () {
      RW.esconderVeuGlobal();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- entrada (a cada visita à página) e a aba ---------- */
  function montar(cont) {
    ['conteudo', 'carregando', 'companhia', 'trava', 'rodape', 'cancelar', 'salvar', 'de', 'quantos', 'quem', 'metades',
     'cada-pelotao'].forEach(function (nome) {
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
