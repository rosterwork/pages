/* ============================================================
   NOVA EXTRA — passo 3: o filtro e a pesquisa da barra
   Os componentes da Escala (geral-filtros e geral-busca). O filtro
   Exibir, só com o ícone, tem só a Escala completa: quem está de
   serviço no dia, em cima das extras, como na Distribuição antiga.
   A pesquisa de militar marca (realça a vaga, a linha da
   escala e o bloco) ou filtra (esconde as outras) no calendário e,
   com texto, deixa na lista dos voluntários só quem casa.
   Não cria HTML (os componentes clonam os moldes) nem escreve estilo
   (só classList).
   RosterWork.novaExtraFiltros.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a opção do Exibir: a Escala completa, um acréscimo (começa desmarcada; sem opção comum, o filtro não tem "Todos") */
  var EXIBIR = [{ rotulo: 'Escala completa', valor: 'escala', separado: true }];

  var pagina = null;
  var filtros = null;
  var visivel = false;     // o filtro à vista (só na Distribuição)
  var termo = '';
  var modo = 'marcar';     // 'marcar' (realça) | 'filtrar' (esconde quem não casa)

  /* liga o filtro e a pesquisa (uma vez por página): mudar o filtro refaz o calendário; a pesquisa só troca classes */
  function ligar(el) {
    pagina = el;
    termo = '';
    modo = 'marcar';
    filtros = RW.filtros ? RW.filtros.criar(el.querySelector('#p3-filtros'), { aoMudar: function () { RW.novaExtraMontar.redesenhar(); } }) : null;
    if (filtros) {
      filtros.definir('exibir', EXIBIR);
      filtros.mostrar(visivel);
    }
    if (RW.busca) RW.busca.criar({ caixa: el.querySelector('#p3-busca'), aoBuscar: function (t, m) { termo = t; modo = m; aplicar(); } });
  }

  /* realça ou esconde pelo termo, no calendário (vagas e linhas da escala) e na lista dos voluntários */
  function aplicar() {
    if (!pagina) return;
    var cal = pagina.querySelector('#p3-cal');
    Array.prototype.forEach.call(cal.querySelectorAll('.escala-mes-celula--busca'), function (c) { c.classList.remove('escala-mes-celula--busca'); });
    Array.prototype.forEach.call(cal.querySelectorAll('.nova-extra-vaga, .linha-escalado'), function (linha) {
      var casa = !!termo && RW.busca.casaTexto(termo, linha.getAttribute('data-busca'));
      var vaga = linha.classList.contains('nova-extra-vaga');
      linha.classList.toggle(vaga ? 'nova-extra-vaga--busca' : 'linha-escalado--busca', casa && modo === 'marcar');
      linha.classList.toggle('busca-achado', casa);   // o que o Enter da busca percorre (geral-busca.js)
      linha.classList.toggle('oculto', !!termo && !casa && modo === 'filtrar');
      if (casa) linha.closest('.escala-mes-celula').classList.add('escala-mes-celula--busca');
    });
    Array.prototype.forEach.call(pagina.querySelectorAll('#p3-esq .nova-extra-esq-item'), function (item) {
      item.classList.toggle('oculto', !!termo && !RW.busca.casaTexto(termo, item.getAttribute('data-busca')));
    });
  }

  RW.novaExtraFiltros = {
    ligar: ligar,
    aplicar: aplicar,
    /* o filtro e a linha "Filtros:" só na Distribuição (a escolha fica guardada) */
    mostrar: function (sim) { visivel = !!sim; if (filtros) filtros.mostrar(visivel); },
    escalaCompleta: function () { return !!filtros && filtros.passa('exibir', 'escala'); }
  };
})();
