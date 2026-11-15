/* ============================================================
   ESCALAS — modo Militares: o selo dos dias e o filtro
   O selo à direita do nome diz em quantos dias do mês o militar
   aparece: o dia com um horário à vista que não é riscado (dois
   horários no mesmo dia contam um; o afastamento e a troca que
   sai, não). A linha "Efetivo de serviço" conta, em cada dia,
   quem tem horário à vista.
   Na Escala, o botão Filtros (escalas-filtros.js) vale também
   aqui: cada horário e cada afastamento traz a situação dele
   (data-situacao: escalas-militares.js e
   escalas-militares-sobreaviso.js) e o das situações desmarcadas
   some. Na página filtrada (o Sobreaviso e os Estágios), a grade
   fica inteira e o número conta o que aparece.
   Roda ao desenhar a grade (escalas-militares.js) e a cada
   mudança na tela (o filtro e a mudança ainda não salva, pelo
   escalas-filtros.js). Não cria HTML nem escreve estilo.
   RosterWork.escalasMilitaresDias.{ aplicar }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o texto só é trocado quando o número muda: a troca avisa o observador do escalas-filtros.js, que chamaria de novo */
  function escrever(el, n) {
    var texto = String(n);
    if (el && el.textContent !== texto) el.textContent = texto;
  }

  /* o horário (ou o afastamento) passa no filtro? Na página filtrada, tudo fica à vista */
  function passa(peca) {
    if (RW.paginaFiltrada && RW.paginaFiltrada()) return true;
    var F = RW.escalasFiltros;
    return !F || F.passaSituacao(peca.getAttribute('data-situacao'));
  }

  /* a célula tem um horário à vista que não é riscado? */
  function temServico(celula) {
    return !!celula.querySelector('.escala-mil-servico:not(.oculto):not(.escala-mil-servico--trocado)');
  }

  /* o filtro nas células, depois o número de cada linha e o efetivo de cada dia, unidade por unidade */
  function aplicar(grade) {
    if (!grade) return;
    Array.prototype.forEach.call(grade.querySelectorAll('.escala-mil-celula [data-situacao]'), function (peca) {
      peca.classList.toggle('oculto', !passa(peca));
    });
    Array.prototype.forEach.call(grade.querySelectorAll('.escala-mil-unidade'), function (bloco) {
      var porDia = [];
      Array.prototype.forEach.call(bloco.querySelectorAll('.escala-mil-pessoa-linha'), function (linha) {
        var dias = 0;
        Array.prototype.forEach.call(linha.querySelectorAll('.escala-mil-celula'), function (celula, i) {
          if (!temServico(celula)) return;
          dias++;
          porDia[i] = (porDia[i] || 0) + 1;
        });
        escrever(linha.querySelector('.escala-mil-pessoa-dias'), dias);
      });
      Array.prototype.forEach.call(bloco.querySelectorAll('.escala-mil-total-valor'), function (valor, i) {
        escrever(valor, porDia[i] || 0);
      });
    });
  }

  RW.escalasMilitaresDias = { aplicar: aplicar };
})();
