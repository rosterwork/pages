/* ============================================================
   EXTRAJORNADA — passo 3: o Exibir e a pesquisa da barra
   O Exibir (o olho; menu do geral-dropdown com o estilo do
   geral-exibir; cada opção com a caixa de marcar, a linha
   .geral-opcao) tem a Escala completa (quem está de serviço no
   dia, em cima das extras, como na Distribuição antiga) e a Falta
   de gente (a linha dos horários embaixo do gráfico,
   extrajornada-por-dia.js). Um clique marca ou desmarca, o menu
   fica aberto e a escolha fica na sessão
   (rosterwork_preferencias.extrajornada_exibir; as duas começam
   desmarcadas).
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
  var falta = false;       // a Falta de gente marcada
  var visivel = false;     // o Exibir à vista (só na Distribuição e nos Ajustes)
  var termo = '';
  var modo = 'marcar';     // 'marcar' (realça) | 'filtrar' (esconde quem não casa)

  function lerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; }
  }

  function guardar() {
    var p = lerPrefs();
    p.extrajornada_exibir = { escala: completa, falta: falta };
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(p)); } catch (e) {}
  }

  /* a caixa de marcar de cada opção acompanha a escolha */
  function marcada(opcao) { return opcao.getAttribute('data-exibir') === 'falta' ? falta : completa; }
  function marcarExibir() {
    if (!exibir) return;
    Array.prototype.forEach.call(exibir.querySelectorAll('[data-exibir]'), function (opcao) {
      opcao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcada(opcao));
      opcao.setAttribute('aria-checked', marcada(opcao) ? 'true' : 'false');
    });
  }

  /* liga o Exibir e a pesquisa (uma vez por página): cada opção do Exibir refaz o calendário; a pesquisa só troca classes */
  function ligar(el) {
    pagina = el;
    termo = '';
    modo = 'marcar';
    var guardado = lerPrefs().extrajornada_exibir || {};
    completa = !!guardado.escala;
    falta = !!guardado.falta;
    exibir = el.querySelector('#extrajornada-exibir');
    if (exibir) {
      exibir.classList.toggle('oculto', !visivel);
      marcarExibir();
      Array.prototype.forEach.call(exibir.querySelectorAll('[data-exibir]'), function (opcao) {
        if (opcao.dataset.ligado) return;
        opcao.dataset.ligado = '1';
        opcao.addEventListener('click', function () {
          if (opcao.getAttribute('data-exibir') === 'falta') falta = !falta;
          else completa = !completa;
          guardar();
          marcarExibir();
          RW.extrajornadaMontar.redesenhar();
        });
      });
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
    escalaCompleta: function () { return completa; },
    faltaDeGente: function () { return falta; }
  };
})();
