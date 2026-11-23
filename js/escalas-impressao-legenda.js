/* ============================================================
   ESCALAS — a legenda do pé da folha nos PDFs da escala
   Quando os ícones de origem saem no papel (o Mostrar do painel de
   impressão), o PDF do dia (escalas-impressao-pdf.js) e o das grades
   (escalas-impressao-grade-pdf.js) levam, no pé de cada folha (na
   página contínua, no fim), as linhas da legenda: cada ícone que
   aparece no arquivo e o nome dele, na ordem e com os nomes da
   Legenda da tela (o molde #tpl-escala-legenda do index.html, fonte
   única dos nomes; o cadeado da extra que o administrador pôs, na
   Extrajornada, sai como o Fixado pelo adm). Nas grades, quando a
   linha da Falta de gente sai, também as casinhas que aparecem no
   arquivo e o que cada uma quer dizer, com os nomes do grupo "Falta de
   gente" da Legenda da tela (os moldes de legenda da página, fonte
   única) e a casinha da célula (escalas-impressao-grade-celula.js), em
   linhas que cabem na largura da folha. Desenhada para a biblioteca do PDF, como o resto
   do arquivo; as medidas em pontos nas constantes abaixo.
   API: RosterWork.escalasImpressaoLegenda.carregarIcones(c, nomes) (os
        ícones em c.icones), .linhasFalta(tipos, largura, medir),
        .altura(usados, falta), .peca(c, usados, falta)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MOLDE = 'tpl-escala-legenda';
  var ICONE = 7;                      // o ícone, no tamanho dos ícones de origem dos PDFs
  var ICONE_MARGEM = [0, 0.5, 0, 0];   // alinha o ícone ao meio do texto
  var POR_LINHA = 6;                   // itens por linha (cabem na A4 em pé)
  var LINHA = 11;                      // a altura de uma linha da legenda
  var VAO = 6;                         // entre a legenda e o site / "Página X de Y"
  var ENTRE_ITENS = 10;
  var ENTRE_ICONE_E_NOME = 3;
  var CASINHA = 16;                    // a casinha de exemplo da Falta de gente (largura)
  var FOLGA_MEDIDA = 2;                // sobra na conta da largura de cada item (a medida × a da biblioteca)
  /* o horário de exemplo de cada casinha, como os da Legenda da tela: "1", o certo e o certo com o "+1" */
  var EXEMPLO = {
    falta: { estado: 'falta', falta: 1, antes: 1, cobriu: 0, mais: 0 },
    coberta: { estado: 'coberta', falta: 0, antes: 1, cobriu: 1, mais: 0 },
    mais: { estado: 'coberta', falta: 0, antes: 0, cobriu: 0, mais: 1 }
  };

  var nomesCache = null;   // [{ icone, nome }] na ordem da Legenda da tela

  /* os ícones da Legenda da tela e os nomes deles; o primeiro nome de cada ícone vale */
  function nomes() {
    if (nomesCache) return nomesCache;
    var molde = document.getElementById(MOLDE);
    if (!molde) return [];
    var lista = [], vistos = {};
    Array.prototype.forEach.call(molde.content.querySelectorAll('.escala-legenda-item'), function (item) {
      var uso = item.querySelector('use');
      var texto = item.querySelector('span:last-child');
      var icone = uso ? (uso.getAttribute('href') || '').split('#')[1] : '';
      if (!icone || !texto || vistos[icone]) return;
      vistos[icone] = true;
      lista.push({ icone: icone, nome: texto.textContent.trim() });
    });
    nomesCache = lista;
    return lista;
  }

  /* os itens da legenda: os ícones usados no arquivo (usados = { icone: true }) que têm nome e desenho */
  function itens(c, usados) {
    return nomes().filter(function (n) { return usados[n.icone] && (!c || (c.icones && c.icones[n.icone])); });
  }

  /* ---------- a Falta de gente (só nas grades) ---------- */
  /* as casinhas do grupo "Falta de gente" da Legenda da tela, na ordem dela: [{ tipo (falta, coberta ou mais), nome }]; o
     molde é o da página aberta (a Escala ou a Extrajornada, com os mesmos nomes) */
  function nomesFalta() {
    var molde = Array.prototype.find.call(document.querySelectorAll('template'), function (t) {
      return t.content && t.content.querySelector('.escala-legenda-item .falta-gente-hora');
    });
    if (!molde) return [];
    return Array.prototype.map.call(molde.content.querySelectorAll('.escala-legenda-item'), function (item) {
      var casa = item.querySelector('.falta-gente-hora');
      if (!casa || !item.lastElementChild || item.lastElementChild === casa) return null;
      var tipo = casa.classList.contains('falta-gente-hora--falta') ? 'falta' : casa.querySelector('.falta-gente-mais') ? 'mais' : 'coberta';
      return { tipo: tipo, nome: item.lastElementChild.textContent.trim() };
    }).filter(Boolean);
  }

  /* as linhas da legenda da Falta de gente: as casinhas que saem no arquivo (tipos = { falta, coberta, mais }), juntas
     enquanto cabem na largura do pé (medir(texto, tamanho) = a largura na fonte do PDF; sem ela, uma por linha); sem
     nenhuma, null */
  function linhasFalta(tipos, largura, medir) {
    var lista = tipos ? nomesFalta().filter(function (n) { return tipos[n.tipo]; }) : [];
    if (!lista.length) return null;
    var tamanho = RW.escalasImpressaoPdf.medidas.FONTE.rodape;
    var linhas = [], usada = 0;
    lista.forEach(function (n) {
      var texto = medir ? medir(n.nome, tamanho) : null;
      var w = texto == null ? largura : CASINHA + ENTRE_ICONE_E_NOME + texto + FOLGA_MEDIDA;
      if (linhas.length && usada + ENTRE_ITENS + w <= largura) {
        usada += ENTRE_ITENS + w;
        linhas[linhas.length - 1].push(n);
      } else {
        linhas.push([n]);
        usada = w;
      }
    });
    return linhas;
  }

  /* ---------- a peça ---------- */
  /* a altura que a legenda pede no pé da folha: as linhas dos ícones e as da Falta de gente (0 sem nenhuma) */
  function altura(usados, falta) {
    var n = Math.ceil(itens(null, usados).length / POR_LINHA) + (falta ? falta.length : 0);
    return n ? n * LINHA + VAO : 0;
  }

  /* a peça do PDF: as linhas da legenda (o ícone e o nome; a casinha e o nome), em c.suave; null sem nenhuma */
  function peca(c, usados, falta) {
    var lista = itens(c, usados);
    var linhas = [];
    for (var i = 0; i < lista.length; i += POR_LINHA) {
      linhas.push({ columns: lista.slice(i, i + POR_LINHA).map(function (n) {
        return { width: 'auto', columnGap: ENTRE_ICONE_E_NOME, columns: [
          { svg: c.icones[n.icone], width: ICONE, height: ICONE, margin: ICONE_MARGEM },
          { text: n.nome, width: 'auto' }
        ] };
      }), columnGap: ENTRE_ITENS });
    }
    var celula = RW.escalasImpressaoGradeCelula;
    if (falta && celula) {
      /* a casinha no meio da linha do texto */
      var meio = Math.max(0, (LINHA - celula.alturaFalta) / 2 - 1);
      falta.forEach(function (linha) {
        linhas.push({ columns: linha.map(function (n) {
          var casa = celula.casinhaFalta(EXEMPLO[n.tipo], CASINHA, c);
          casa.margin = [0, meio, 0, 0];
          return { width: 'auto', columnGap: ENTRE_ICONE_E_NOME, columns: [casa, { text: n.nome, width: 'auto' }] };
        }), columnGap: ENTRE_ITENS });
      });
    }
    if (!linhas.length) return null;
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

  RW.escalasImpressaoLegenda = { carregarIcones: carregarIcones, linhasFalta: linhasFalta, altura: altura, peca: peca };
})();
