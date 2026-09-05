(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Popula um .dropdown-menu com opções numéricas (estilo estreito, rolável) e
     liga a escolha. O gatilho fica por conta de quem chama (via aoEscolher):
     no painel é o gatilho enxuto das horas; no modal de postos é um .campo-selecao.
     config = { opcoes, valor, formato, aoEscolher } */
  function preencher(menu, config) {
    config = config || {};
    var opcoes = config.opcoes || [];
    var valor = config.valor;
    var formato = config.formato || function (v) { return String(v); };
    var aoEscolher = config.aoEscolher;
    if (!menu) return;
    menu.classList.add('dropdown-numeros-menu');
    menu.textContent = '';
    var tplOp = document.getElementById('tpl-dropdown-numeros-opcao');
    opcoes.forEach(function (op) {
      var item = tplOp ? tplOp.content.cloneNode(true).firstElementChild : null;
      if (!item) return;
      item.textContent = formato(op);
      if (op === valor) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () {
        var ativos = menu.querySelectorAll('.dropdown-item--ativo');
        for (var i = 0; i < ativos.length; i++) ativos[i].classList.remove('dropdown-item--ativo');
        item.classList.add('dropdown-item--ativo');
        if (aoEscolher) aoEscolher(op);
      });
      menu.appendChild(item);
    });
  }

  /* Cria um dropdown de números completo (gatilho enxuto + menu) e o devolve (um
     .dropdown). Usado no Editar das escalas (horas). O geral-dropdown cuida de
     abrir/fechar/posicionar. config = { opcoes, valor, formato, aoEscolher } */
  function criar(config) {
    config = config || {};
    var formato = config.formato || function (v) { return String(v); };
    var tpl = document.getElementById('tpl-dropdown-numeros');
    if (!tpl) return null;
    var drop = tpl.content.cloneNode(true).firstElementChild;
    var btn = drop.querySelector('.dropdown-numeros-btn');
    var menu = drop.querySelector('.dropdown-menu');
    if (btn) btn.textContent = formato(config.valor);
    preencher(menu, {
      opcoes: config.opcoes,
      valor: config.valor,
      formato: formato,
      aoEscolher: function (op) {
        if (btn) btn.textContent = formato(op);
        if (config.aoEscolher) config.aoEscolher(op);
      }
    });
    return drop;
  }

  window.RosterWork.dropdownNumeros = { criar: criar, preencher: preencher };
})();
