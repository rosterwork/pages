/* ============================================================
   ESCALAS — a extra na célula da grade (Agenda, Calendário, Colunas e
   Semana), para o administrador da companhia, com o painel do dia
   fechado, no mês lançado, de hoje − 7 em diante: a mesma caixa da
   Extrajornada (extrajornada-celula.js, aqui a tela 'escala').
   - O clique na linha da extra abre a caixa dela: Mudar o horário da
     extrajornada, Pôr outro no lugar dele, Remover da extrajornada
     neste dia, Abrir na Extrajornada (os Ajustes do mês, com o painel
     daquele dia aberto) e Abrir o painel do dia (na aba Extrajornada).
   - A caixa do pelotão (escalas-celula-editar-acoes.js) ganha o
     Adicionar extra neste dia: na caixa 2, o campo de militar (os
     grupos do painel do dia da Extrajornada) e, escolhido o nome, a
     barra dele embaixo, vazia; o clique no horário põe a extra.
   O mês é lido no primeiro clique (escalas-painel-extra.js ›
   carregar) e o rascunho é o do mês, o mesmo da aba Extrajornada do
   painel: a grade mostra a prévia com ele e o Salvar do rodapé largo
   grava junto com o Dia. Não cria HTML (clona moldes) nem escreve
   estilo (só classList). RosterWork.escalasCelulaExtra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  /* o Adicionar extra neste dia aberto: { c (o contexto da caixa do pelotão), a (a caixa dele), uid, k, escolhido, barra } */
  var nova = null;

  function X() { return RW.escalasPainelExtra; }
  function C() { return RW.extrajornadaCelula; }
  function L() { return RW.mensagens.escala.linha; }
  function diaMes(k) { return k.slice(8, 10) + '/' + k.slice(5, 7); }
  /* o texto à vista do item (o título da folha do celular) */
  function textoDo(botao) { var s = botao.querySelector('span'); return s ? s.textContent.trim() : ''; }

  /* a célula do dia na grade da tela, e o dia dela */
  function celula(uid, k) {
    return document.querySelector('.conteudo .pagina-corpo .escala-mes-celula[data-unidade-id="' + uid + '"][data-iso="' + k + '"]');
  }
  function diaDe(cel) {
    return { unidadeId: cel.dataset.unidadeId, iso: cel.dataset.iso, unidadeNome: cel.dataset.unidadeNome || '',
      unidadeCidade: cel.dataset.unidadeCidade || '' };
  }

  /* a extra do pelotão é do administrador da companhia (o papel e a área) */
  function daCompanhia(uid) { return !!RW.sessao && RW.sessao.podeAdministrar('companhia', uid); }

  /* a tela da Escala na caixa da extra: a linha da extra na célula e o pelotão dela */
  C().tela('escala', {
    grade: '.conteudo .escala-mes-celula, .conteudo .escala-calendario-unidade',
    peca: function (uid, k, cpf) {
      var cel = celula(uid, k);
      return cel ? cel.querySelector('.linha-escalado[data-situacao="extra"][data-cpf="' + cpf + '"]') : null;
    },
    junto: function (uid, k) { var cel = celula(uid, k); return cel ? [cel.closest('.escala-calendario-unidade') || cel] : []; },
    painel: function (uid, k) { var cel = celula(uid, k); if (cel) RW.escalasPainel.abrirDia(diaDe(cel), 'extra'); },
    /* os Ajustes do mês, com o painel do dia aberto (extrajornada.js lê o dia pedido) */
    extrajornada: function (uid, k) { if (RW.irParaPagina) RW.irParaPagina('extrajornada', 'organizar', k + '|' + uid); }
  });

  /* o mês do dia lido, com o rascunho começado; a Promise diz se a extra do pelotão se mexe ali (o mês lançado e da
     companhia, de hoje − 7 em diante). O dia fica para o rodapé (o Salvar e o Desfazer da extra) */
  function preparar(d) {
    return X().carregar(d.iso).then(function (lido) {
      var G = RW.extrajornadaGrade, pode = !!lido && X().pronto(d.unidadeId, d.iso) && !G.soLeitura() && !G.antigo(d.iso);
      if (pode) X().usarNaCelula(d);
      return pode;
    });
  }

  /* o clique na linha da extra (escalas-celula-editar.js › clique): a caixa dela, para o administrador da companhia (false:
     o menu de sempre). Sem mudança no Dia, o dia da célula sai: o rodapé e o Desfazer ficam com a extra */
  function clique(cel, linha) {
    var d = diaDe(cel), cpf = linha.getAttribute('data-cpf');
    if (!daCompanhia(d.unidadeId)) return false;
    if (C().estaAberto(+d.unidadeId, d.iso, cpf)) return true;
    var E = RW.escalasCelulaEditar, S = RW.escalasPainelSalvar;
    if (S && S.pendente()) E.fechar(); else E.largar();
    var nome = [linha.querySelector('.linha-escalado-grad').textContent, linha.querySelector('.linha-escalado-nome').textContent].join(' ').trim();
    C().abrirNome('escala', d.unidadeId, d.iso, cpf, L().noDia(nome, diaMes(d.iso)), preparar(d));
    return true;
  }

  /* o item Adicionar extra neste dia da caixa do pelotão: aparece quando a extra do pelotão se mexe ali */
  function prepararItem(item, d) {
    if (!item) return;
    item.classList.add('oculto');
    if (!d || !daCompanhia(d.unidadeId)) return;
    preparar(d).then(function (pode) { item.classList.toggle('oculto', !pode); });
  }

  /* Adicionar extra neste dia: na caixa 2 da caixa do pelotão, o campo de militar e, escolhido o nome, a barra dele */
  function adicionar(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-extra');
    if (!a || !el) return;
    a.acao = 'extra';
    a.botao = botao;
    var n = { c: c, a: a, uid: +a.unidadeId, k: a.iso, escolhido: null, barra: el.querySelector('.escala-celula-extra-barra') };
    nova = n;
    el.querySelector('.escala-celula-extra-campo').appendChild(C().campo(n.uid, n.k,
      function (x) { n.escolhido = x; desenharNova(); },
      function () { return n.escolhido; }));
    a.caixa.segunda(botao, el, textoDo(botao));
  }

  /* a barra do escolhido, de novo a cada mudança do rascunho (enquanto a caixa 2 dele está aberta) */
  function desenharNova() {
    var n = nova;
    if (!n) return;
    if (n.c.a !== n.a || n.a.acao !== 'extra' || !n.barra.isConnected) { nova = null; return; }
    n.barra.textContent = '';
    var h = n.escolhido ? C().montarHorario(n.escolhido.cpf, n.uid, n.k) : null;
    if (h) n.barra.appendChild(h);
  }
  C().aoRedesenhar(desenharNova);

  RW.escalasCelulaExtra = { clique: clique, prepararItem: prepararItem, adicionar: adicionar };
})();
