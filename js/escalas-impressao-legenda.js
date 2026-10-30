/* ============================================================
   ESCALAS — a legenda do pé da folha nos PDFs da escala
   Quando os ícones de origem saem no papel (o Mostrar do painel de
   impressão), o PDF do dia (escalas-impressao-pdf.js) e o das grades
   (escalas-impressao-grade-pdf.js) levam, no pé de cada folha (na
   página contínua, no fim), as linhas da legenda: cada ícone que
   aparece no arquivo e o nome dele, na ordem e com os nomes da
   Legenda da tela (o molde #tpl-escala-legenda do index.html, fonte
   única dos nomes; na Extrajornada, também o #tpl-ne-legenda-pdf, com
   quem inseriu a extra). Desenhada para a biblioteca do PDF, como o resto
   do arquivo; as medidas em pontos nas constantes abaixo.
   API: RosterWork.escalasImpressaoLegenda.carregarIcones(c, nomes) (os
        ícones em c.icones), .altura(usados), .peca(c, usados)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MOLDES = ['tpl-escala-legenda', 'tpl-ne-legenda-pdf'];   // o segundo só existe na Extrajornada
  var ICONE = 7;                       // o ícone, no tamanho dos ícones de origem dos PDFs
  var ICONE_MARGEM = [0, 0.5, 0, 0];   // alinha o ícone ao meio do texto
  var POR_LINHA = 6;                   // itens por linha (cabem na A4 em pé)
  var LINHA = 11;                      // a altura de uma linha da legenda
  var VAO = 6;                         // entre a legenda e o site / "Página X de Y"
  var ENTRE_ITENS = 10;
  var ENTRE_ICONE_E_NOME = 3;

  var nomesCache = null;   // [{ icone, nome }] na ordem da Legenda da tela
  var cacheMoldes = '';    // os moldes lidos (o da Extrajornada entra e sai com a página)

  /* os ícones da Legenda da tela e os nomes deles; o primeiro nome de cada ícone vale */
  function nomes() {
    var moldes = MOLDES.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var chave = moldes.map(function (m) { return m.id; }).join(',');
    if (nomesCache && cacheMoldes === chave) return nomesCache;
    var lista = [], vistos = {};
    moldes.forEach(function (molde) {
      Array.prototype.forEach.call(molde.content.querySelectorAll('.escala-legenda-item'), function (item) {
        var uso = item.querySelector('use');
        var texto = item.querySelector('span:last-child');
        var icone = uso ? (uso.getAttribute('href') || '').split('#')[1] : '';
        if (!icone || !texto || vistos[icone]) return;
        vistos[icone] = true;
        lista.push({ icone: icone, nome: texto.textContent.trim() });
      });
    });
    nomesCache = lista;
    cacheMoldes = chave;
    return lista;
  }

  /* os itens da legenda: os ícones usados no arquivo (usados = { icone: true }) que têm nome e desenho */
  function itens(c, usados) {
    return nomes().filter(function (n) { return usados[n.icone] && (!c || (c.icones && c.icones[n.icone])); });
  }

  /* a altura que a legenda pede no pé da folha (0 sem ícones) */
  function altura(usados) {
    var n = itens(null, usados).length;
    return n ? Math.ceil(n / POR_LINHA) * LINHA + VAO : 0;
  }

  /* a peça do PDF: as linhas da legenda (o ícone e o nome), em c.suave; null sem ícones */
  function peca(c, usados) {
    var lista = itens(c, usados);
    if (!lista.length) return null;
    var linhas = [];
    for (var i = 0; i < lista.length; i += POR_LINHA) {
      linhas.push({ columns: lista.slice(i, i + POR_LINHA).map(function (n) {
        return { width: 'auto', columnGap: ENTRE_ICONE_E_NOME, columns: [
          { svg: c.icones[n.icone], width: ICONE, height: ICONE, margin: ICONE_MARGEM },
          { text: n.nome, width: 'auto' }
        ] };
      }), columnGap: ENTRE_ITENS });
    }
    return { stack: linhas, margin: [0, 0, 0, VAO] };
  }

  /* os ícones como <svg> solto, no traço do tema e em c.suave (c.icones[nome]); os que já estão não são buscados */
  function carregarIcones(c, lista) {
    var pdf = RW.escalasImpressaoPdf;
    c.icones = c.icones || {};
    var faltam = lista.filter(function (n) { return !c.icones[n]; });
    return Promise.all(faltam.map(pdf.buscarIcone)).then(function (textos) {
      faltam.forEach(function (n, i) { c.icones[n] = pdf.svgDeTraco(textos[i], c.suave); });
      return c;
    });
  }

  RW.escalasImpressaoLegenda = { carregarIcones: carregarIcones, altura: altura, peca: peca };
})();
