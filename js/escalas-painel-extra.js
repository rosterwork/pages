/* ============================================================
   ESCALA — painel do dia › aba EXTRAJORNADA (só leitura)
   Quem está de extrajornada no dia, tirando o extra nesta unidade
   (RPC extra_dia_listar): um militar por linha, com os horários
   dele; o extra planejado que ainda não foi inserido na escala
   leva o selo "Não inserido na escala". Todos veem. A mesma aba
   aparece no painel do dia da Escala e da Extrajornada.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { corpo, unidadeId, iso }

  function msg() { return (RosterWork.mensagens && RosterWork.mensagens.escala) || {}; }

  function estado(corpo, texto) {
    var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = texto; corpo.appendChild(e); }
  }

  function desenhar(corpo, lista) {
    corpo.textContent = '';
    if (!lista.length) { estado(corpo, msg().extraVazio); return; }
    var pecas = RosterWork.escalasPainel && RosterWork.escalasPainel.pecas;
    var caixa = RosterWork.painel.criarCaixa(msg().extraDoDia);
    if (!caixa || !pecas) return;
    lista.forEach(function (m) {
      /* a linha da distribuição, com a origem "extra" (ícone da Extrajornada) */
      var linha = pecas.linha({ origem: 'extra', grad: m.grad, nome: m.nome, de_unidade: m.de_unidade, periodos: m.periodos });
      if (!linha) return;
      if (!m.inserido) {
        var selo = RosterWork.tpl('tpl-escala-extra-selo');
        var nome = linha.querySelector('.escala-distribuicao-nome');
        if (selo && nome) nome.insertAdjacentElement('afterend', selo);
      }
      caixa.appendChild(linha);
    });
    corpo.appendChild(caixa);
  }

  /* monta a aba no corpo do painel; a aba não tem ações (rodapé escondido) */
  function montar(corpo, rodape, unidadeId, iso) {
    ctx = { corpo: corpo, unidadeId: unidadeId, iso: iso };
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    corpo.textContent = '';
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);
    RosterWork.escalasDados.extraDia(unidadeId, iso).then(function (lista) {
      if (!ctx || ctx.corpo !== corpo || ctx.unidadeId !== unidadeId || ctx.iso !== iso) return;   // outra aba/dia abriu enquanto carregava
      if (!Array.isArray(lista)) { corpo.textContent = ''; estado(corpo, msg().falhaCarregar); return; }
      desenhar(corpo, lista);
    });
  }

  function reset() { ctx = null; }

  window.RosterWork.escalasPainelExtra = { montar: montar, reset: reset };
})();
