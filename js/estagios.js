/* ============================================================
   ESTÁGIOS — a página do menu
   A mesma Escala (escalas.html e os mesmos arquivos; o manifesto em
   index-navegacao.js), só com os estagiários: o iniciar põe a marca
   .escala-pagina--estagios (o css/estagios.css troca o título e
   esconde o que não é dos estagiários), aponta o manual do ? para a
   parte deles e abre a Escala. Ela se registra como página filtrada
   (RosterWork.paginasFiltradas, lida pelo RosterWork.paginaFiltrada
   do escalas.js), como o Sobreaviso:
   - o filtro fica preso no Estágio (escalas-filtros.js);
   - as abas são Mês, Militares e Colunas, com a mesma visão da
     Escala; o Militares é a grade dos estagiários, por estágio
     (escalas-militares.js);
   - as unidades: só as com estágio (a sessão, estagioUnidades, lida de
     novo no banco cada vez que a página abre); sem nenhuma, o vazio;
   - o pelotão marcado na célula traz o Adicionar estagiário, só com
     quem participa de um estágio (escalas-celula-editar-acoes.js);
   - o Imprimir sai com o título Estágios.
   RosterWork.paginas.estagios
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* as unidades da grade: só as da tela com estágio em vigor ou marcado (sem nenhuma, o vazio pede a unidade do estágio) */
  function colunas(lista) {
    var com = RW.sessao.estagioUnidades().map(String);
    return lista.filter(function (c) { return com.indexOf(String(c.id)) >= 0; });
  }

  /* as unidades com estágio, lidas de novo ao abrir (a da entrada pode ser de antes de um estágio novo). A Escala abre
     junto, e a leitura do mês demora mais que esta; quando ela chega com outra lista, a grade é refeita
     (rosterwork_escala_recarregar). Sem conexão, vale a da entrada */
  function lerUnidades() {
    var antes = JSON.stringify(RW.sessao.estagioUnidades());
    RW.rpc('fn_perfil_usuario', { p_email: '' }).then(function (p) {
      if (!p || !p.ok) return;
      RW.sessao.guardarEstagioUnidades(p.estagio_unidades);
      if (JSON.stringify(RW.sessao.estagioUnidades()) === antes || !(RW.paginaAtual && RW.paginaAtual() === 'estagios')) return;
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
    }, function () { /* sem conexão: vale a da entrada */ });
  }

  function iniciar(fragmento) {
    lerUnidades();
    var pagina = fragmento.querySelector('.pagina');
    if (pagina) pagina.classList.add('escala-pagina--estagios');
    var ajuda = fragmento.querySelector('.pagina-ajuda');
    if (ajuda) ajuda.setAttribute('data-manual', 'estagiarios');
    return RW.paginas.escalas.iniciar(fragmento);
  }

  RW.paginasFiltradas = RW.paginasFiltradas || {};
  RW.paginasFiltradas.estagios = {
    situacao: 'estagio',
    militares: 'estagiarios',
    colunas: colunas,
    moldePelotao: 'tpl-escala-celula-pelotao-estagios',
    podeAdicionar: function (item) { return !!(item.m && item.m.estagio); },
    vazia: function () { return RW.mensagens.escala.estagiarios.semUnidade; },
    impressao: function () { return RW.mensagens.escala.estagiarios.impressao; }
  };
  RW.paginas.estagios = { iniciar: iniciar };
})();
