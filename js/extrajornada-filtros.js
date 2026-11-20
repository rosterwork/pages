/* ============================================================
   EXTRAJORNADA — passo 3: o Exibir e a pesquisa da barra
   O Exibir (o olho; menu do geral-dropdown com o estilo do
   geral-exibir) tem só a Escala completa: quem está de serviço no
   dia, em cima das extras, como na Distribuição antiga. Um clique
   marca ou desmarca, o menu fica aberto e a escolha fica na sessão
   (rosterwork_preferencias.extrajornada_exibir; começa desmarcada).
   A pesquisa de militar (geral-busca) marca (realça a vaga, a linha da
   escala e o bloco) ou filtra (esconde as outras) no calendário e,
   com texto, deixa na lista dos voluntários só quem casa.
   Não cria HTML nem escreve estilo (só classList).
   RosterWork.extrajornadaFiltros.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var pagina = null;
  var exibir = null;       // o menu Exibir (o olho)
  var completa = false;    // a Escala completa marcada
  var visivel = false;     // o Exibir à vista (só na Distribuição e nos Ajustes)
  var termo = '';
  var modo = 'marcar';     // 'marcar' (realça) | 'filtrar' (esconde quem não casa)

  function lerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; }
  }

  function guardarCompleta() {
    var p = lerPrefs();
    p.extrajornada_exibir = { escala: completa };
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(p)); } catch (e) {}
  }

  /* a marca da opção acompanha a escolha */
  function marcarExibir() {
    var opcao = exibir && exibir.querySelector('.exibir-opcao[data-exibir="escala"]');
    if (!opcao) return;
    opcao.classList.toggle('exibir-opcao--ativo', completa);
    opcao.setAttribute('aria-pressed', completa ? 'true' : 'false');
  }

  /* liga o Exibir e a pesquisa (uma vez por página): a Escala completa refaz o calendário; a pesquisa só troca classes */
  function ligar(el) {
    pagina = el;
    termo = '';
    modo = 'marcar';
    completa = !!(lerPrefs().extrajornada_exibir || {}).escala;
    exibir = el.querySelector('#extrajornada-exibir');
    if (exibir) {
      exibir.classList.toggle('oculto', !visivel);
      marcarExibir();
      var opcao = exibir.querySelector('.exibir-opcao[data-exibir="escala"]');
      if (opcao && !opcao.dataset.ligado) {
        opcao.dataset.ligado = '1';
        opcao.addEventListener('click', function () {
          completa = !completa;
          guardarCompleta();
          marcarExibir();
          RW.extrajornadaMontar.redesenhar();
        });
      }
    }
    if (RW.busca) RW.busca.criar({ caixa: el.querySelector('#p3-busca'), aoBuscar: function (t, m) { termo = t; modo = m; aplicar(); } });
  }

  /* realça ou esconde pelo termo, no calendário (vagas e linhas da escala) e na lista dos voluntários */
  function aplicar() {
    if (!pagina) return;
    var cal = pagina.querySelector('#p3-cal');
    Array.prototype.forEach.call(cal.querySelectorAll('.escala-mes-celula--busca'), function (c) { c.classList.remove('escala-mes-celula--busca'); });
    Array.prototype.forEach.call(cal.querySelectorAll('.extrajornada-vaga, .linha-escalado'), function (linha) {
      var casa = !!termo && RW.busca.casaTexto(termo, linha.getAttribute('data-busca'));
      var vaga = linha.classList.contains('extrajornada-vaga');
      linha.classList.toggle(vaga ? 'extrajornada-vaga--busca' : 'linha-escalado--busca', casa && modo === 'marcar');
      linha.classList.toggle('busca-achado', casa);   // o que o Enter da busca percorre (geral-busca.js)
      linha.classList.toggle('oculto', !!termo && !casa && modo === 'filtrar');
      if (casa) linha.closest('.escala-mes-celula').classList.add('escala-mes-celula--busca');
    });
    Array.prototype.forEach.call(pagina.querySelectorAll('#p3-esq .extrajornada-esq-item'), function (item) {
      item.classList.toggle('oculto', !!termo && !RW.busca.casaTexto(termo, item.getAttribute('data-busca')));
    });
  }

  RW.extrajornadaFiltros = {
    ligar: ligar,
    aplicar: aplicar,
    /* o Exibir só na Distribuição e nos Ajustes (a escolha fica guardada) */
    mostrar: function (sim) { visivel = !!sim; if (exibir) exibir.classList.toggle('oculto', !visivel); },
    escalaCompleta: function () { return completa; }
  };
})();
