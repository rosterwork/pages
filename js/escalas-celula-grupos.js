/* ============================================================
   ESCALAS — os grupos da célula da grade (Agenda, Calendário e
   Colunas da Escala)
   O banco (ler_escala_mes) manda quem está no dia já na ordem dos
   grupos, cada um com o "grupo" dele: Guarnição, Trocas, Pontual,
   Remanejados, Extrajornada e Estágio (o riscado fica no grupo de
   onde saiu). Aqui cada grupo vira uma caixa, com a linha tracejada
   em cima; depois vêm o Sobreaviso (escalas-celula-sobreaviso.js) e
   o Fora da escala (escalas-celula-fora.js), nas mesmas caixas. A
   linha só aparece quando há outro grupo à vista antes, e o grupo
   que o filtro esvazia some com ela (escalas-mes.css). Parando o
   mouse na linha, a dica diz o grupo de baixo. Quem está afastado
   (férias, licença, dispensa ou missão) nunca fica na Guarnição: vai
   para o Fora da escala.
   Fora da Escala (a grade da Extrajornada usa a mesma célula), as
   linhas vão uma embaixo da outra, como sempre.
   Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaGrupos.{ naEscala, caixa, preencher }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a grade da Escala (a Extrajornada desenha a mesma célula) */
  function naEscala(celula) { return !!document.querySelector('.conteudo #escala-modos') && !celula.closest('#p3-cal'); }

  /* a caixa de um grupo (nome: a chave do grupo), com a dica da linha tracejada */
  function caixa(nome) {
    var el = RW.tpl('tpl-escala-grupo');
    if (!el) return null;
    el.setAttribute('data-grupo', nome || '');
    var dica = nome && RW.mensagens.escala.grupoCelula[nome];
    if (dica) el.querySelector('.escala-grupo-linha').setAttribute('data-dica', dica);
    return el;
  }

  /* quem está no dia, na ordem do banco: cada grupo seguido numa caixa (curto: o posto curto das células pequenas; D: a
     dica das linhas, escalas-celula-dica.js) */
  function preencher(celula, pessoas, curto, D) {
    var escala = naEscala(celula), atual = null, nome = null;
    (pessoas || []).forEach(function (p) {
      var linha = RW.escalasCelula.montarPessoa(p, curto, D);
      if (!linha) return;
      if (!escala) { celula.appendChild(linha); return; }
      var grupo = p.grupo || '';
      if (!atual || grupo !== nome) {
        atual = caixa(grupo);
        nome = grupo;
        if (!atual) return;
        celula.appendChild(atual);
      }
      atual.appendChild(linha);
    });
  }

  RW.escalasCelulaGrupos = { naEscala: naEscala, caixa: caixa, preencher: preencher };
})();
