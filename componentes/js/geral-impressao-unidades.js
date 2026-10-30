/* ============================================================
   COMPONENTE geral-impressao-unidades — as Unidades do painel de
   impressão (geral-impressao.js), quando o molde da impressão tem a
   árvore. As marcas de começo: as unidades pedidas (a do painel do
   dia, a seleção do cabeçalho ou as unidades da tela) e a companhia
   de cada pelotão; a companhia só fica de fora se a pessoa desmarcar.
   Para quem é lotado em companhia (CIBM ou CIA) ou pelotão, a árvore
   começa na companhia das unidades marcadas, já aberta, e a seta do
   título da caixa abre a árvore toda (e fecha de volta), sem perder
   as marcas. Quem é lotado acima, ou tem unidades de mais de uma
   companhia, vê a árvore toda, sem a seta. Só contam as unidades que
   têm escala (CIA, CIBM, PEL); as outras marcadas são só o caminho.
   API: RosterWork.impressaoUnidades.montar(seletor, seta, ids), .escolhidas(seletor)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var COMPANHIAS = ['CIBM', 'CIA'];
  var LOTACOES_DO_RECORTE = ['CIBM', 'CIA', 'PEL'];
  var TIPOS_COM_ESCALA = ['CIA', 'CIBM', 'PEL'];

  function achar(lista, id) {
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i].unidade_id) === String(id)) return lista[i];
    }
    return null;
  }

  /* a companhia de uma unidade: ela mesma, se for companhia; o pai, se for pelotão de companhia; senão, null */
  function companhiaDe(lista, id) {
    var u = achar(lista, id);
    if (!u) return null;
    if (COMPANHIAS.indexOf(u.tipo) >= 0) return u;
    var pai = u.tipo === 'PEL' ? achar(lista, u.unidade_pai_id) : null;
    return pai && COMPANHIAS.indexOf(pai.tipo) >= 0 ? pai : null;
  }

  /* as marcas de começo: as pedidas e a companhia de cada pelotão */
  function marcasPadrao(lista, ids) {
    var marcas = ids.map(String);
    ids.forEach(function (id) {
      var cia = companhiaDe(lista, id);
      if (cia && marcas.indexOf(String(cia.unidade_id)) < 0) marcas.push(String(cia.unidade_id));
    });
    return marcas;
  }

  /* onde a árvore começa: a companhia das marcas, para quem é lotado em companhia ou pelotão; null = a árvore toda */
  function raizDoRecorte(lista, marcas) {
    var perfil = RW.sessao ? RW.sessao.perfil() : null;
    var lotacao = perfil ? achar(lista, perfil.lotacao_id) : null;
    if (!lotacao || LOTACOES_DO_RECORTE.indexOf(lotacao.tipo) < 0 || !marcas.length) return null;
    var raiz = null;
    for (var i = 0; i < marcas.length; i++) {
      var cia = companhiaDe(lista, marcas[i]);
      if (!cia || (raiz && raiz !== cia)) return null;
      raiz = cia;
    }
    return raiz.unidade_id;
  }

  /* monta a árvore no seletor (geral-seletor-unidades), já marcada, e liga a seta do título da caixa */
  function montar(seletor, seta, ids) {
    return RW.seletorUnidades.buscar().then(function (lista) {
      var marcas = marcasPadrao(lista, ids);
      var raiz = raizDoRecorte(lista, marcas);
      return seletor.montarArvore(raiz).then(function () {
        seletor.aplicarSelecaoPorIds(marcas);
        if (raiz == null || !seta) return;
        seta.classList.remove('oculto');
        seta.addEventListener('click', function () {
          var aberta = seta.getAttribute('aria-expanded') === 'true';
          seta.setAttribute('aria-expanded', aberta ? 'false' : 'true');
          seletor.montarArvore(aberta ? raiz : null);
        });
      });
    });
  }

  /* as unidades marcadas que têm escala, na ordem da árvore */
  function escolhidas(seletor) {
    return seletor.unidadesSelecionadas().filter(function (u) { return TIPOS_COM_ESCALA.indexOf(u.tipo) >= 0; });
  }

  RW.impressaoUnidades = { montar: montar, escolhidas: escolhidas };
})();
