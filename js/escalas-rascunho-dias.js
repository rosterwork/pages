/* ============================================================
   ESCALAS — o rascunho de vários dias (a gaveta). Cada parte do
   rascunho da Escala trabalha num dia por vez: o Dia
   (escalas-painel-editar.js), o Ciclo (escalas-painel-ciclo.js) e o
   Sobreaviso (escalas-painel-sobreaviso.js, pela chave dele: a
   companhia ou o pelotão, e o dia). Ao passar para outro dia, o que
   ela tinha (mudança ou passo do Desfazer) fica guardado aqui, e
   volta quando o dia é aberto de novo; trocar de dia não pergunta
   nada. O Salvar do rodapé largo (escalas-painel-salvar.js) grava
   todos os dias de uma vez (escala_painel_salvar_dias), e o Cancelar
   descarta todos.
   Aqui fica também a ordem dos passos do Dia, do Ciclo e do Sobreaviso
   de todos os dias: o Desfazer volta o último, em qualquer dia, e o
   Refazer o último desfeito (a aba Guarnições anda pelos passos do
   Ciclo, e a ordem acompanha, andou; a pergunta que desiste tira os
   dela, largou; a Extrajornada tem o Desfazer dela).
   Cada parte dá, na API dela, o objeto gaveta: { vivo() (o dia
   carregado nela, { chave, unidadeId, iso, vivo: true }, ou null),
   contar(item), pode(item, desfazer), andar(item, desfazer) (true:
   deu o passo), limparRefazer(item), soltar(item, gravou) (o item
   guardado sai: descartado ou gravado) }. O item guardado é
   { chave, unidadeId, iso, estado }.
   API: RosterWork.escalasRascunhoDias.{ guardar(parte, item),
   tirar(parte, chave), porDia() ([{ unidadeId, iso, dia, ciclo,
   sobreaviso }], os itens com mudança), contar(), datas() (quantos
   dias diferentes), descartar(gravou), soltar(parte, chave, gravou),
   passou(parte, chave), andou(parte, chave, desfazer),
   largou(parte, chave, n), podeDesfazer(), podeRefazer(), desfazer(),
   refazer() }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var PARTES = ['dia', 'ciclo', 'sobreaviso'];
  var guardados = { dia: {}, ciclo: {}, sobreaviso: {} };   // chave -> o item guardado
  var ordem = [];      // os passos dados, do mais antigo ao último: { parte, chave }
  var refeitos = [];   // os passos desfeitos (o Refazer volta o último)

  /* a parte, pela API do arquivo dela (o arquivo pode não estar na página: a parte fica de fora) */
  function parte(nome) {
    var m = nome === 'dia' ? RW.escalasPainelEditar : nome === 'ciclo' ? RW.escalasPainelCiclo : RW.escalasPainelSobreaviso;
    return m && m.gaveta ? m.gaveta : null;
  }
  function avisar() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'dias' } })); }

  function guardar(nome, item) { guardados[nome][item.chave] = item; }
  function tirar(nome, chave) {
    var item = guardados[nome][chave] || null;
    delete guardados[nome][chave];
    return item;
  }

  /* os itens de uma parte: os guardados e o carregado nela */
  function itens(nome) {
    var lista = Object.keys(guardados[nome]).map(function (k) { return guardados[nome][k]; });
    var p = parte(nome), vivo = p && p.vivo();
    if (vivo) lista.push(vivo);
    return lista;
  }
  function contarItem(nome, item) { var p = parte(nome); return p ? p.contar(item) : 0; }

  /* os dias com mudança, um por unidade e dia, com o item de cada parte (ou null) */
  function porDia() {
    var dias = {}, lista = [];
    PARTES.forEach(function (nome) {
      itens(nome).forEach(function (item) {
        if (!contarItem(nome, item)) return;
        var k = item.unidadeId + '|' + item.iso;
        if (!dias[k]) {
          dias[k] = { unidadeId: item.unidadeId, iso: item.iso, dia: null, ciclo: null, sobreaviso: null };
          lista.push(dias[k]);
        }
        dias[k][nome] = item;
      });
    });
    return lista.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : Number(a.unidadeId) - Number(b.unidadeId); });
  }
  function contar() {
    return PARTES.reduce(function (t, nome) {
      return t + itens(nome).reduce(function (s, item) { return s + contarItem(nome, item); }, 0);
    }, 0);
  }
  function datas() {
    var vistas = {};
    porDia().forEach(function (d) { vistas[d.iso] = true; });
    return Object.keys(vistas).length;
  }

  /* o Salvar (gravou) ou o Cancelar: os guardados saem (os carregados, quem descarta é o escalas-painel-salvar.js) */
  function descartar(gravou) {
    PARTES.forEach(function (nome) {
      var p = parte(nome);
      Object.keys(guardados[nome]).forEach(function (k) { if (p && p.soltar) p.soltar(guardados[nome][k], !!gravou); });
      guardados[nome] = {};
    });
    ordem = [];
    refeitos = [];
  }
  /* um guardado só sai (o dia que mudou no banco depois da leitura) */
  function soltar(nome, chave, gravou) {
    var item = tirar(nome, chave), p = parte(nome);
    if (item && p && p.soltar) p.soltar(item, !!gravou);
  }

  /* ---------- o Desfazer e o Refazer de todos os dias ---------- */

  function achar(nome, chave) { return itens(nome).filter(function (i) { return i.chave === chave; })[0] || null; }
  /* um passo novo: o Refazer de todos os dias zera */
  function passou(nome, chave) {
    ordem.push({ parte: nome, chave: chave });
    refeitos = [];
    PARTES.forEach(function (n) {
      var p = parte(n);
      Object.keys(guardados[n]).forEach(function (k) { if (p && p.limparRefazer) p.limparRefazer(guardados[n][k]); });
    });
  }
  /* o último passo de uma parte num dia, numa das listas (-1: nenhum) */
  function ultimoDa(lista, nome, chave) {
    for (var i = lista.length - 1; i >= 0; i--) if (lista[i].parte === nome && lista[i].chave === chave) return i;
    return -1;
  }
  /* a parte andou um passo pelo Desfazer (ou o Refazer) dela mesma (a aba Guarnições): o passo dela passa para a outra lista */
  function andou(nome, chave, desfazer) {
    var de = desfazer ? ordem : refeitos, i = ultimoDa(de, nome, chave);
    if (i >= 0) de.splice(i, 1);
    (desfazer ? refeitos : ordem).push({ parte: nome, chave: chave });
  }
  /* a parte largou os n últimos passos dela (a pergunta que desistiu): eles saem da ordem */
  function largou(nome, chave, n) {
    for (var k = 0; k < n; k++) {
      var i = ultimoDa(ordem, nome, chave);
      if (i < 0) return;
      ordem.splice(i, 1);
    }
  }
  /* o último passo que ainda dá para andar (o da parte que ficou sem passo, como o recusado pelo banco, fica de fora) */
  function ultimo(pilha, desfazer) {
    for (var i = pilha.length - 1; i >= 0; i--) {
      var x = pilha[i], p = parte(x.parte), item = p && achar(x.parte, x.chave);
      if (item && p.pode && p.pode(item, desfazer)) return i;
    }
    return -1;
  }
  function podeDesfazer() { return ultimo(ordem, true) >= 0; }
  function podeRefazer() { return ultimo(refeitos, false) >= 0; }
  function andar(desfazer) {
    var de = desfazer ? ordem : refeitos;
    var i = ultimo(de, desfazer);
    if (i < 0) return false;
    var x = de[i];
    de.length = i;
    var item = achar(x.parte, x.chave);
    if (!parte(x.parte).andar(item, desfazer)) return false;
    /* o lápis aberto guarda a mudança dele antes (um passo novo, que zera o Refazer): a pilha é lida de novo */
    (desfazer ? refeitos : ordem).push(x);
    if (!item.vivo) avisar();   // o carregado avisa sozinho
    return true;
  }

  RW.escalasRascunhoDias = {
    guardar: guardar, tirar: tirar, porDia: porDia, contar: contar, datas: datas, descartar: descartar, soltar: soltar,
    passou: passou, andou: andou, largou: largou, podeDesfazer: podeDesfazer, podeRefazer: podeRefazer,
    desfazer: function () { return andar(true); }, refazer: function () { return andar(false); }
  };
})();
