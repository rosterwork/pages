/* ============================================================
   ESCALAS — a extra na célula da grade (Agenda, Calendário, Colunas e
   Semana), para o administrador da companhia, com o painel do dia
   fechado, no mês lançado, de hoje − 7 em diante: a mesma caixa da
   Extrajornada (extrajornada-celula.js, aqui a tela 'escala').
   - O clique na linha da extra abre a caixa dela: Mudar o horário da
     extrajornada, Pôr outro no lugar dele, Remover da extrajornada
     neste dia, Abrir na Extrajornada (os Ajustes do mês, com o painel
     daquele dia aberto) e Abrir o painel do dia (na aba Extrajornada).
     O Mudar a extrajornada do menu do nome abre a mesma caixa.
   - A caixa do pelotão (escalas-celula-editar-acoes.js) ganha o
     Adicionar extra neste dia: na caixa 2, o campo de militar (os
     grupos do painel do dia da Extrajornada) e, escolhido o nome, a
     barra dele embaixo, vazia; o clique no horário põe a extra.
   O mês é lido no clique, só da cópia guardada (no pelotão, junto com
   o dia; escalas-painel-extra.js › carregar, que lê de novo quando um
   dia dele fica pronto): a caixa do pelotão espera por ele só na
   1ª vez no mês, e depois o item vem certo na hora, pelo que ficou
   guardado do mês (sabido), mesmo depois do Salvar e do Cancelar. O
   rascunho é o do mês, o mesmo da aba Extrajornada do
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
    peca: function (uid, k, cpf) {
      var cel = celula(uid, k);
      return cel ? cel.querySelector('.linha-escalado[data-situacao="extra"][data-cpf="' + cpf + '"]') : null;
    },
    junto: function (uid, k) { var cel = celula(uid, k); return cel ? [cel.closest('.escala-calendario-unidade') || cel] : []; },
    painel: function (uid, k) { var cel = celula(uid, k); if (cel) RW.escalasPainel.abrirDia(diaDe(cel), 'extra'); },
    /* os Ajustes do mês, com o painel do dia aberto (extrajornada.js lê o dia pedido) */
    extrajornada: function (uid, k) { if (RW.irParaPagina) RW.irParaPagina('extrajornada', 'organizar', k + '|' + uid); }
  });

  /* a extra do pelotão se mexe no dia (o mês lançado e da companhia, de hoje − 7 em diante)? Pelo mês lido; sem ele, pelo
     que ficou guardado do mês: true, false ou null (o mês nunca foi lido) */
  function seMexe(d) {
    if (!d || !daCompanhia(d.unidadeId)) return false;
    var G = RW.extrajornadaGrade;
    if (X().lido(d.iso)) return X().pronto(d.unidadeId, d.iso) && !G.soLeitura() && !G.antigo(d.iso);
    return X().sabido(d.unidadeId, d.iso);
  }

  /* o mês do dia lido, com o rascunho começado; a Promise diz se a extra do pelotão se mexe ali. O dia fica para o
     rodapé (o Salvar e o Desfazer da extra) */
  function preparar(d) {
    return X().carregar(d.iso).then(function (lido) {
      var pode = !!lido && seMexe(d) === true;
      if (pode) X().usarNaCelula(d);
      return pode;
    });
  }

  /* a caixa do pelotão desta página tem o Adicionar extra neste dia? (o molde vem da escalas-celula-editar-acoes.js; o da
     página Estágios não tem) */
  function temItem() {
    var A = RW.escalasCelulaAcoes;
    var t = A && document.getElementById(A.moldeDoPelotao());
    return !!t && !!t.content.querySelector('[data-acao="extra"]');
  }

  /* o clique no pelotão: o mês do dia já começa a ser lido, junto com o dia (sem mexer no dia do rodapé); a Promise
     termina com a leitura */
  function adiantar(d) { return temItem() && daCompanhia(d.unidadeId) ? X().carregar(d.iso) : Promise.resolve(false); }

  /* a caixa do pelotão espera o mês do dia? Só quando o item existe e nada se sabe do mês ainda (a 1ª vez nele) */
  function falta(d) { return temItem() && seMexe(d) === null; }

  /* o clique na linha da extra (escalas-celula-editar.js › clique): a caixa dela, para o administrador da companhia (false:
     o menu de sempre). Sem mudança no Dia, o dia da célula sai: o rodapé e o Desfazer ficam com a extra */
  function clique(cel, linha) {
    var d = diaDe(cel), cpf = linha.getAttribute('data-cpf');
    if (!daCompanhia(d.unidadeId)) return false;
    if (C().estaAberto(+d.unidadeId, d.iso, cpf)) return true;
    var E = RW.escalasCelulaEditar, S = RW.escalasPainelSalvar;
    if (S && S.pendente()) E.fechar(); else E.largar();
    E.painelNoDia(d);   // com o painel aberto, ele vai junto para o dia
    var nome = [linha.querySelector('.linha-escalado-grad').textContent, linha.querySelector('.linha-escalado-nome').textContent].join(' ').trim();
    C().abrirNome('escala', d.unidadeId, d.iso, cpf, L().noDia(nome, diaMes(d.iso)), preparar(d));
    return true;
  }

  /* a linha da extra dele na célula do dia, à vista, ou null */
  function linhaDaExtra(d, cpf) {
    var cel = d && celula(d.unidadeId, d.iso);
    var linha = cel && cel.querySelector('.linha-escalado[data-situacao="extra"][data-cpf="' + cpf + '"]');
    return linha && linha.getClientRects().length ? linha : null;
  }

  /* o Mudar a extrajornada do menu do nome (escalas-celula-editar-acoes.js): a caixa da extra dele, a mesma do clique na
     linha dela. podeAbrir diz antes (o sinal do item: a seta ou o ícone do painel); abrirDe abre (false: o painel do dia,
     na aba Extrajornada) */
  function podeAbrir(d, cpf) { return !!d && daCompanhia(d.unidadeId) && !!linhaDaExtra(d, cpf); }
  function abrirDe(d, cpf) {
    var linha = podeAbrir(d, cpf) ? linhaDaExtra(d, cpf) : null;
    return !!linha && clique(linha.closest('.escala-mes-celula'), linha);
  }

  /* o item Adicionar extra neste dia da caixa do pelotão: já vem certo, pelo que se sabe do mês (na 1ª vez no mês, a
     caixa espera a leitura dele, escalas-celula-editar.js). Quando o mês chega, o dia fica para o rodapé, e o item só
     muda se o mês mudou entre uma leitura e outra */
  function prepararItem(item, d) {
    if (!item) return;
    item.classList.toggle('oculto', !seMexe(d));
    if (!d || !daCompanhia(d.unidadeId)) return;
    preparar(d).then(function (pode) { item.classList.toggle('oculto', !pode); });
  }

  /* Adicionar extra neste dia: o mês ainda vindo, passando de 0,2 s a caixa 2 abre com as faixas até o campo de militar
     chegar (elas ficam o mínimo na tela); se a extra não se mexe mais ali (o mês reaberto, a leitura que falhou), o painel
     do dia na aba Extrajornada, que diz por quê */
  function adicionar(botao, c) {
    var a = c.a;
    if (!a) return;
    a.acao = 'extra';
    a.botao = botao;
    function vale() { return c.a === a && a.acao === 'extra' && a.botao === botao; }
    var formaEm = null;
    var relogio = setTimeout(function () {
      var forma = vale() && RW.tpl('tpl-caixa-flutuante-forma');
      if (!forma) return;
      formaEm = performance.now();
      a.caixa.segunda(botao, forma, textoDo(botao));
    }, RW.etapas ? RW.etapas.atrasoCaixa : 0);
    preparar(c.dia).then(function (pode) {
      clearTimeout(relogio);
      function seguir() {
        if (!vale()) return;
        if (!pode) { c.fecharTudo('guardar'); c.abrirPainel(null, { secao: 'extra' }); return; }
        abrirCampo(botao, c);
      }
      var falta = formaEm != null && RW.etapas ? RW.etapas.faltaCaixa(formaEm) : 0;
      if (falta > 0) setTimeout(seguir, falta); else seguir();
    });
  }

  /* na caixa 2 da caixa do pelotão, o campo de militar e, escolhido o nome, a barra dele */
  function abrirCampo(botao, c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-extra');
    if (!el) return;
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

  RW.escalasCelulaExtra = { clique: clique, prepararItem: prepararItem, adicionar: adicionar, adiantar: adiantar, falta: falta,
    podeAbrir: podeAbrir, abrirDe: abrirDe };
})();
