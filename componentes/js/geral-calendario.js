(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  /* só um calendário aberto por vez no site inteiro */
  var instanciaAberta = null;

  /* zera as horas para comparar apenas a data */
  function soData(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* domingo da semana que contém a data */
  function inicioSemana(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  }

  /* fecha ao clicar fora ou com Esc — listeners únicos para todas as instâncias */
  document.addEventListener('click', function (evento) {
    if (!instanciaAberta) return;
    if (instanciaAberta.painel.contains(evento.target) || instanciaAberta.gatilho.contains(evento.target)) return;
    instanciaAberta.fechar();
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && instanciaAberta) instanciaAberta.fechar();
  });

  /* prepara um gatilho para abrir o calendário ao ser clicado.
     opcoes.obterData()  → Date a destacar ao abrir (padrão: hoje)
     opcoes.obterModo()  → 'dia' | 'mes' | 'semana' (padrão: 'dia')
     opcoes.aoEscolher(data) → chamado quando uma data é escolhida
     opcoes.ancora       → elemento que ancora o painel (padrão: pai do gatilho)
     opcoes.anoMin/anoMax → faixa do dropdown de ano (padrão: ano de referência ±5)
     opcoes.permiteDia(data) → bool: no modo dia, dias que retornam false ficam apagados e sem clique */
  function ligar(gatilho, opcoes) {
    opcoes = opcoes || {};

    var tplPainel = document.getElementById('tpl-calendario');
    var tplOpcao = document.getElementById('tpl-calendario-opcao');
    var tplDia = document.getElementById('tpl-calendario-dia');
    var tplMes = document.getElementById('tpl-calendario-mes');
    if (!tplPainel || !tplOpcao || !tplDia || !tplMes) return null;

    var ancora = opcoes.ancora || gatilho.parentNode;

    var painel = tplPainel.content.cloneNode(true).firstElementChild;
    ancora.appendChild(painel);

    var elMesTexto = painel.querySelector('[data-tipo="mes"] .calendario-seletor-texto');
    var elAnoTexto = painel.querySelector('[data-tipo="ano"] .calendario-seletor-texto');
    var menuMes = painel.querySelector('[data-tipo="mes"] .calendario-menu');
    var menuAno = painel.querySelector('[data-tipo="ano"] .calendario-menu');
    var elDias = painel.querySelector('.calendario-dias');
    var elMeses = painel.querySelector('.calendario-meses');

    var modo = 'dia';            // 'dia' | 'mes' | 'semana' (definido ao abrir)
    var dataSelecionada = null;  // data destacada
    var mesExibido = 0;          // mês mostrado (0–11)
    var anoExibido = 0;          // ano mostrado

    var inst = {
      painel: painel,
      gatilho: gatilho,
      fechar: function () {
        painel.classList.remove('calendario--aberto');
        if (inst._desligar) { inst._desligar(); inst._desligar = null; }
        if (instanciaAberta === inst) instanciaAberta = null;
        if (window.RosterWork.fecharDropdowns) window.RosterWork.fecharDropdowns();
      }
    };

    /* monta os itens de um dropdown (mês ou ano) clonando o molde de opção */
    function montarOpcoes(menu, itens, aoEscolher) {
      menu.textContent = '';
      for (var i = 0; i < itens.length; i++) {
        (function (item) {
          var botao = tplOpcao.content.cloneNode(true).firstElementChild;
          botao.textContent = item.rotulo;
          botao.setAttribute('data-valor', item.valor);
          botao.addEventListener('click', function () { aoEscolher(item.valor); });
          menu.appendChild(botao);
        })(itens[i]);
      }
    }

    /* destaca, no menu, a opção correspondente ao valor atual */
    function marcarAtivo(menu, valor) {
      var itens = menu.querySelectorAll('.dropdown-item');
      for (var i = 0; i < itens.length; i++) {
        itens[i].classList.toggle('dropdown-item--ativo', itens[i].getAttribute('data-valor') === String(valor));
      }
    }

    /* devolve a data escolhida e fecha */
    function escolher(data) {
      dataSelecionada = soData(data);
      inst.fechar();
      if (opcoes.aoEscolher) opcoes.aoEscolher(new Date(dataSelecionada));
    }

    /* ---------- grade de dias (modos dia e semana; sempre 6 linhas) ---------- */
    function renderizarDias() {
      elDias.textContent = '';
      var primeiro = new Date(anoExibido, mesExibido, 1);
      var inicio = new Date(anoExibido, mesExibido, 1 - primeiro.getDay());   /* recua até o domingo */
      var hoje = soData(new Date());
      var semanaSel = (modo === 'semana' && dataSelecionada) ? inicioSemana(dataSelecionada) : null;

      for (var i = 0; i < 42; i++) {
        var dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        var botao = tplDia.content.cloneNode(true).firstElementChild;
        botao.textContent = String(dia.getDate());
        if (dia.getMonth() !== mesExibido) botao.classList.add('calendario-dia--fora');
        if (mesmoDia(dia, hoje)) botao.classList.add('calendario-dia--hoje');
        var permitido = (modo === 'semana') || !opcoes.permiteDia || opcoes.permiteDia(dia);
        if (modo === 'semana') {
          if (semanaSel && mesmoDia(inicioSemana(dia), semanaSel)) botao.classList.add('calendario-dia--semana-sel');
        } else if (dataSelecionada && mesmoDia(dia, dataSelecionada)) {
          botao.classList.add('calendario-dia--selecionado');
        }
        if (permitido) {
          (function (data) {
            botao.addEventListener('click', function () { escolher(data); });
          })(dia);
        } else {
          botao.classList.add('calendario-dia--inativo');
        }
        elDias.appendChild(botao);
      }
    }

    /* realça a semana inteira sob o mouse (só no modo semana) */
    function aoPassarMouse(e) {
      if (modo !== 'semana') return;
      var alvo = e.target.closest('.calendario-dia');
      var filhos = elDias.children;
      var base = -1;
      if (alvo) {
        var idx = Array.prototype.indexOf.call(filhos, alvo);
        if (idx >= 0) base = idx - (idx % 7);
      }
      for (var i = 0; i < filhos.length; i++) {
        filhos[i].classList.toggle('calendario-dia--semana-hover', base >= 0 && i >= base && i < base + 7);
      }
    }

    function aoSairMouse() {
      if (modo !== 'semana') return;
      var filhos = elDias.children;
      for (var i = 0; i < filhos.length; i++) filhos[i].classList.remove('calendario-dia--semana-hover');
    }

    /* ---------- grade de meses (modo mês) ---------- */
    function renderizarMeses() {
      elMeses.textContent = '';
      var hoje = new Date();
      for (var i = 0; i < 12; i++) {
        (function (mes) {
          var botao = tplMes.content.cloneNode(true).firstElementChild;
          botao.textContent = MESES_ABREV[mes];
          if (mes === hoje.getMonth() && anoExibido === hoje.getFullYear()) botao.classList.add('calendario-mes--hoje');
          if (dataSelecionada && mes === dataSelecionada.getMonth() && anoExibido === dataSelecionada.getFullYear()) botao.classList.add('calendario-mes--selecionado');
          botao.addEventListener('click', function () { escolher(new Date(anoExibido, mes, 1)); });
          elMeses.appendChild(botao);
        })(i);
      }
    }

    /* desenha a visão conforme o modo */
    function renderizar() {
      painel.classList.toggle('calendario--mes', modo === 'mes');
      painel.classList.toggle('calendario--semana', modo === 'semana');
      elAnoTexto.textContent = String(anoExibido);
      marcarAtivo(menuAno, anoExibido);
      if (modo === 'mes') {
        renderizarMeses();
      } else {
        elMesTexto.textContent = MESES[mesExibido];
        marcarAtivo(menuMes, mesExibido);
        renderizarDias();
      }
    }

    /* setas: no modo mês mudam o ano; nos demais, o mês */
    function navegar(delta) {
      if (modo === 'mes') {
        anoExibido += delta;
      } else {
        var d = new Date(anoExibido, mesExibido + delta, 1);
        mesExibido = d.getMonth();
        anoExibido = d.getFullYear();
      }
      renderizar();
    }

    /* ---------- montagem ---------- */

    var itensMes = [];
    for (var m = 0; m < 12; m++) itensMes.push({ rotulo: MESES[m], valor: m });
    montarOpcoes(menuMes, itensMes, function (v) { mesExibido = v; renderizar(); });

    var dataRef = (opcoes.obterData && opcoes.obterData()) ? opcoes.obterData() : new Date();
    var anoMin = opcoes.anoMin || (dataRef.getFullYear() - 5);
    var anoMax = opcoes.anoMax || (dataRef.getFullYear() + 5);
    var itensAno = [];
    for (var y = anoMin; y <= anoMax; y++) itensAno.push({ rotulo: String(y), valor: y });
    montarOpcoes(menuAno, itensAno, function (v) { anoExibido = v; renderizar(); });

    var setas = painel.querySelectorAll('.calendario-nav');
    for (var s = 0; s < setas.length; s++) {
      (function (btn) {
        btn.addEventListener('click', function () { navegar(parseInt(btn.getAttribute('data-nav'), 10)); });
      })(setas[s]);
    }

    elDias.addEventListener('mouseover', aoPassarMouse);
    elDias.addEventListener('mouseleave', aoSairMouse);

    /* abre no clique do gatilho (e fecha se já estava aberto) */
    gatilho.addEventListener('click', function () {
      if (painel.classList.contains('calendario--aberto')) {
        inst.fechar();
        return;
      }
      modo = (opcoes.obterModo && opcoes.obterModo()) || 'dia';
      var base = (opcoes.obterData && opcoes.obterData()) ? opcoes.obterData() : new Date();
      dataSelecionada = soData(base);
      mesExibido = dataSelecionada.getMonth();
      anoExibido = dataSelecionada.getFullYear();
      renderizar();
      if (instanciaAberta && instanciaAberta !== inst) instanciaAberta.fechar();
      instanciaAberta = inst;
      painel.classList.add('calendario--aberto');
      /* posiciona o painel pelo helper compartilhado (flutuante; sem limitar a altura — grade fixa) */
      if (window.RosterWork.flutuante) {
        inst._desligar = window.RosterWork.flutuante.ancorar(gatilho, painel, { limitarAltura: false, aoSair: inst.fechar });
      }
    });

    return inst;
  }

  window.RosterWork.calendario = { ligar: ligar };
})();
