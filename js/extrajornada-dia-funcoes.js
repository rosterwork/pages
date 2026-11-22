/* ============================================================
   EXTRAJORNADA — as abas do painel do dia: Extrajornada · Funções
   Na Distribuição e nos Ajustes, embaixo do título do painel do dia:
   a Extrajornada (o painel do dia de sempre, extrajornada-dia.js) e as
   Funções, a lista do painel do dia da Escala, por posto e função, só
   para ver (escalas-painel-editar.js, o mesmo código, sem ações nem
   histórico). Ela mostra a escala gravada: na Distribuição, ainda sem
   as extras; nos Ajustes, com as já salvas. A aba escolhida continua
   ao abrir outro dia.
   Não cria HTML (clona o molde) nem escreve estilo.
   RosterWork.extrajornadaDiaFuncoes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var secao = 'extra';   // a aba aberta: 'extra' ou 'funcoes'

  /* as abas na linha do painel que acabou de abrir, com a aba aberta mostrada; mostrarExtra desenha a Extrajornada do dia */
  function ligar(uid, k, mostrarExtra) {
    var linha = RW.painel.linhaAbas(), abas = RW.tpl('tpl-extrajornada-painel-abas');
    if (!linha || !abas || !RW.escalasPainelEditar) { secao = 'extra'; mostrarExtra(); return; }
    linha.textContent = '';
    linha.appendChild(abas);
    linha.classList.remove('oculto');
    Array.prototype.forEach.call(abas.querySelectorAll('.aba'), function (a) {
      a.classList.toggle('aba--ativa', a.getAttribute('data-secao') === secao);
    });
    if (RW.abas) RW.abas.ligar(abas, function (aba) { secao = aba.getAttribute('data-secao'); mostrar(uid, k, mostrarExtra); });
    mostrar(uid, k, mostrarExtra);
  }

  /* a aba aberta no corpo do painel: as Funções sem a busca (o subcabeçalho é da Extrajornada) */
  function mostrar(uid, k, mostrarExtra) {
    if (secao !== 'funcoes') { RW.escalasPainelEditar.reset(); mostrarExtra(); return; }
    var sub = RW.painel.subcabecalho();
    if (sub) { sub.textContent = ''; sub.classList.add('oculto'); }
    RW.escalasPainelEditar.montar(RW.painel.corpo(), null, uid, k, {});
  }

  RW.extrajornadaDiaFuncoes = {
    ligar: ligar,
    /* a aba Funções está aberta (a Extrajornada do dia não desenha por cima dela) */
    naFuncoes: function () { return secao === 'funcoes' && !!RW.escalasPainelEditar; },
    /* o painel fechou: a lista das Funções para de desenhar */
    soltar: function () { if (RW.escalasPainelEditar) RW.escalasPainelEditar.reset(); }
  };
})();
