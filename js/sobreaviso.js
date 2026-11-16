/* ============================================================
   SOBREAVISO — a página do menu
   A mesma Escala (escalas.html e os mesmos arquivos; o manifesto em
   index-navegacao.js), só com quem está de sobreaviso: o iniciar põe
   a marca .escala-pagina--sobreaviso (o css/sobreaviso.css troca o
   título e esconde o que não é do sobreaviso), aponta o manual do ?
   para a parte dele e abre a Escala. Nos arquivos da Escala, o que
   muda pergunta RosterWork.paginaSobreaviso.ativa():
   - o filtro fica preso no Sobreaviso (escalas-filtros.js);
   - as abas são Mês, Militares e Colunas, com a mesma visão da
     Escala (escalas.js); o Militares é a fila
     (escalas-militares-sobreaviso.js);
   - as unidades: só as em que o sobreaviso aparece, uma por companhia
     (colunas(), nas grades e no Imprimir);
   - o clique no nome ou no dia abre a caixa do sobreaviso
     (escalas-celula-sobreaviso-caixa.js).
   RosterWork.paginaSobreaviso.{ ativa, colunas }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* a página aberta é o Sobreaviso */
  function ativa() { return !!(RW.paginaAtual && RW.paginaAtual() === 'sobreaviso'); }

  /* as unidades da grade: só as que mostram o sobreaviso (as marcadas nos Ajustes › Sobreaviso › Onde aparece). No da
     companhia, uma só por companhia, a primeira da tela (a lista é a mesma em todas); no de cada pelotão, os pelotões
     (cada um, o seu). Fora da página, as de sempre */
  function colunas(lista) {
    var S = RW.escalasCelulaSobreaviso;
    if (!ativa() || !S) return lista;
    var vistas = {};
    return lista.filter(function (c) {
      if (!S.mostra(c.id)) return false;
      var cia = S.companhia(c.id);
      if (cia == null) return true;
      if (vistas[cia]) return false;
      vistas[cia] = true;
      return true;
    });
  }

  function iniciar(fragmento) {
    var pagina = fragmento.querySelector('.pagina');
    if (pagina) pagina.classList.add('escala-pagina--sobreaviso');
    var ajuda = fragmento.querySelector('.pagina-ajuda');
    if (ajuda) ajuda.setAttribute('data-manual', 'sobreaviso');
    return RW.paginas.escalas.iniciar(fragmento);
  }

  RW.paginaSobreaviso = { ativa: ativa, colunas: colunas };
  /* a página filtrada (RosterWork.paginaFiltrada, escalas.js): o filtro, a grade do Militares, as unidades e o Imprimir */
  RW.paginasFiltradas = RW.paginasFiltradas || {};
  RW.paginasFiltradas.sobreaviso = { situacao: 'sobreaviso', militares: 'sobreaviso', colunas: colunas,
    vazia: function () { return RW.mensagens.escala.sobreaviso.paginaVazia; },
    impressao: function () { return RW.mensagens.escala.sobreaviso.impressao; } };
  RW.paginas.sobreaviso = { iniciar: iniciar };
})();
