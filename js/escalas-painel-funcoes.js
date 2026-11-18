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

  /* as caixas do menu: os lugares de agora, com os rótulos do painel (sem o número do lugar; o papel e o Condutor do
     mesmo militar juntos), um por lugar, e depois o próximo lugar livre ("Mais um Efetivo"; os outros livres vêm depois
     dele, um de cada vez) */
  function itensDoPosto(posto) {
    var M = msg(), P = RosterWork.escalasPainel.pecas;
    var itens = [];
    P.mesclarFuncoes(posto).forEach(function (g) {
      var rotulo = ((g.nomes && g.nomes.length) ? g.nomes : [g.nome]).join(' e ');
      /* o Chefe de Socorro e o Oficial de Área sozinhos não têm lápis (são do mais antigo do dia): sem a dica */
      var papel = PAPEL.test(g.nome) && !(g.nomes && g.nomes.length > 1);
      (g.partes || [g]).forEach(function (f) {
        var gente = (f.militares || []).map(nomeDe);
        if (gente.length) {
          itens.push({ texto: rotulo + ' · ' + gente.join(' e '), marcado: true, desligado: true, dica: papel ? '' : M.funcoesDicaOcupada });
        } else if (f.vazio_motivo === 'aberta') {
          itens.push(f.fechar ? { texto: rotulo, marcado: true, fechar: f.nome }
            : { texto: rotulo, marcado: true, desligado: true, dica: M.funcoesDicaSeguinte });
        } else if (f.vazio) {
          itens.push({ texto: rotulo + ' · ' + M.funcoesMinimo, marcado: true, desligado: true, dica: M.funcoesDicaMinimo });
        } else if ((f.vao || []).length) {
          /* sem ninguém abaixo do mínimo (vermelho) */
          itens.push({ texto: rotulo + ' · ' + M.semNinguemTexto, marcado: true, desligado: true, dica: M.funcoesDicaLapis });
        }
      });
    });
    var livre = (posto.livres || [])[0];
    if (livre) {
      var base = P.nomeSemNumero(livre);
      var ja = (posto.funcoes || []).some(function (f) { return P.nomeSemNumero(f.nome) === base; });
      itens.push({ texto: ja ? M.maisUm(base) : base, marcado: false, abrir: livre });
    }
    return itens;
  }

  /* o título e as caixas de marcar do menu (o do título do posto e o do nome da função usam o mesmo) */
  function preencherMenu(menu, posto, aoMudar) {
    menu.querySelector('.dropdown-titulo').textContent = msg().funcoesTitulo(posto.nome);
    var itens = itensDoPosto(posto);
    RosterWork.escalasPainelQuem.marcar(menu.querySelector('.escala-posto-funcoes-lista'), itens, function (marcados) {
      itens.some(function (it, i) {
        var agora = marcados.indexOf(i) >= 0;
        if (it.abrir && agora) { aoMudar(posto, { abrir: it.abrir }); return true; }
        if (it.fechar && !agora) { aoMudar(posto, { fechar: it.fechar }); return true; }
        return false;
      });
    });
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
    preencherMenu(menu, posto, aoMudar);
    return menu;
  }

  /* o nome da função na lista, para quem edita o dia (el = o .escala-edicao-funcao): o clique abre o mesmo menu Funções
     do posto, embaixo do nome, e o último item é o Como foi escolhido (como = a informação do escalas-painel-como.js;
     sem ela, o item não aparece). Devolve o menu */
  function noNome(el, posto, aoMudar, como) {
    var dd = RosterWork.tpl('tpl-escala-funcao-menu');
    if (!el || !dd) return null;
    var botao = dd.querySelector('.escala-funcao-menu-botao');
    while (el.firstChild) botao.appendChild(el.firstChild);
    el.appendChild(dd);
    preencherMenu(dd, posto, aoMudar);
    var item = dd.querySelector('.escala-como-item');
    if (como && RosterWork.escalasPainelComo) RosterWork.escalasPainelComo.item(item, botao, como);
    else { item.remove(); dd.querySelector('.escala-funcao-menu-traco').remove(); }
    return dd;
  }

  window.RosterWork.escalasPainelFuncoes = { titulo: titulo, noNome: noNome };
})();
