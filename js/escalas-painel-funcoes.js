/* ============================================================
   ESCALAS — painel do dia › Funções do posto (só para quem edita
   o dia). O título de cada posto vira uma linha com o nome, o
   texto "Vazio, fora da escala" (o posto sem ninguém) e, na ponta
   direita, o ícone com o menu das funções em caixas de marcar, na
   ordem do painel, até o máximo:
     · marcada e travada: a função com alguém (o nome ao lado), a
       vazia do mínimo ("Mínimo") e a que ficou sem ninguém;
     · a aberta sem ninguém: desmarca só a última do posto
       (fechar, do banco); a do meio fica travada;
     · os lugares livres (posto.livres, do banco): marca só o
       primeiro.
   Cada clique grava na hora pelo caminho do dia, com Desfazer; o
   banco confere as mesmas regras (escala_dia_salvar).
   API: RosterWork.escalasPainelFuncoes.titulo(caixa, posto,
   aoMudar(posto, { abrir | fechar: nome da função })) devolve o
   menu (para reabrir depois de gravar)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PAPEL = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* as caixas do menu: as funções de agora (com os rótulos do painel, o papel e o Condutor do mesmo militar juntos) e
     depois os lugares livres */
  function itensDoPosto(posto) {
    var M = msg();
    var itens = [];
    RosterWork.escalasPainel.pecas.mesclarFuncoes(posto).forEach(function (f) {
      var rotulo = ((f.nomes && f.nomes.length) ? f.nomes : [f.nome]).join(' e ');
      var gente = (f.militares || []).map(nomeDe);
      if (gente.length) {
        /* o Chefe de Socorro e o Oficial de Área sozinhos não têm lápis (são do mais antigo do dia): sem a dica */
        var papel = PAPEL.test(f.nome) && !(f.nomes && f.nomes.length > 1);
        itens.push({ texto: rotulo + ' · ' + gente.join(' e '), marcado: true, desligado: true, dica: papel ? '' : M.funcoesDicaOcupada });
      } else if (f.vazio_motivo === 'aberta') {
        itens.push(f.fechar ? { texto: rotulo, marcado: true, fechar: f.nome }
          : { texto: rotulo, marcado: true, desligado: true, dica: M.funcoesDicaSeguinte });
      } else if (f.vazio) {
        itens.push({ texto: rotulo + ' · ' + M.funcoesMinimo, marcado: true, desligado: true, dica: M.funcoesDicaMinimo });
      } else if ((f.vao || []).length) {
        itens.push({ texto: rotulo + ' · ' + M.semNinguemTexto, marcado: true, desligado: true, dica: M.funcoesDicaLapis });
      }
    });
    (posto.livres || []).forEach(function (nome, i) {
      itens.push(i === 0 ? { texto: nome, marcado: false, abrir: nome }
        : { texto: nome, marcado: false, desligado: true, dica: M.funcoesDicaAnterior });
    });
    return itens;
  }

  /* a linha do título no lugar do nome da caixa; o posto sem nenhuma função mostra o "Vazio, fora da escala" */
  function titulo(caixa, posto, aoMudar) {
    var linha = RosterWork.tpl('tpl-escala-posto-titulo');
    var rotulo = caixa.querySelector('.rotulo-secao');
    if (!linha || !rotulo) return null;
    caixa.insertBefore(linha, rotulo);
    linha.insertBefore(rotulo, linha.firstChild);
    if (!(posto.funcoes || []).length) linha.querySelector('.escala-posto-vazio').classList.remove('oculto');
    var menu = linha.querySelector('.escala-posto-funcoes');
    linha.querySelector('.dropdown-titulo').textContent = msg().funcoesTitulo(posto.nome);
    var itens = itensDoPosto(posto);
    RosterWork.escalasPainelQuem.marcar(linha.querySelector('.escala-posto-funcoes-lista'), itens, function (marcados) {
      itens.some(function (it, i) {
        var agora = marcados.indexOf(i) >= 0;
        if (it.abrir && agora) { aoMudar(posto, { abrir: it.abrir }); return true; }
        if (it.fechar && !agora) { aoMudar(posto, { fechar: it.fechar }); return true; }
        return false;
      });
    });
    return menu;
  }

  window.RosterWork.escalasPainelFuncoes = { titulo: titulo };
})();
