/* ============================================================
   ESCALA — painel do dia › aba Guarnições: o lápis de quem tem a
   saída marcada (a lista é do escalas-painel-guarnicoes.js). A aba é
   para ver: entrar, mudar de guarnição e sair são feitos pela aba
   Militares (o Adicionar militar, na guarnição do dia, e o Remover da
   guarnição do lápis de cada um). O lápis (e a linha inteira) só
   aparece em quem saiu à mão e abre o menu com o título ("Cb. André
   sai da escala em 20/11") e o Cancelar a saída: na hora, como um
   passo do Desfazer (escalas-painel-ciclo.js › marcarPasso); a saída
   que só estava no rascunho só sai dele. A saída pelo afastamento e
   pela transferência não tem o lápis: ela segue as datas deles.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function G() { return RosterWork.escalasPainelGuarnicoes; }
  function C() { return RosterWork.escalasPainelCiclo; }
  function msg() { return RosterWork.mensagens.escala.guarnicoes; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* a linha tem o Cancelar a saída? Na linha de quem sai, só a saída à mão; no período de antes, quem tem a saída marcada */
  function cancela(cfg) {
    if (!G().contexto() || !cfg.saida) return false;
    return cfg.militar.marca !== 'sai' || cfg.militar.motivo === 'saida';
  }

  /* a saída marcada sai na hora (com o Desfazer); a que só existe no rascunho (o Remover da guarnição) só sai dele */
  function cancelarSaida(cfg) {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    var c = G().contexto(), m = cfg.militar;
    if (!cfg.linha.isConnected || !c) return;
    var antes = C().marcado(c.unidadeId, c.iso, m.cpf);
    if (antes && antes.acao === 'tirar') { C().desmarcarPasso(c.unidadeId, c.iso, m.cpf); return; }
    G().verificar();
    C().marcarPasso(c.unidadeId, c.iso, { cpf: m.cpf, acao: 'cancelar_saida', tipo: 'cancelar_saida', data: cfg.saida, itens: [] });
  }

  /* põe o lápis e o menu na linha de quem tem a saída marcada. cfg = { periodo, indice, letra, militar, saida } */
  function lapis(linha, cfg) {
    if (!cancela(cfg)) return;
    var dd = RosterWork.tpl('tpl-escala-guarnicoes-opcoes');
    if (!dd) return;
    var m = cfg.militar, nome = nomeDe(m), botao = dd.querySelector('.escala-edicao-lapis');
    botao.setAttribute('aria-label', L().editar(nome));
    dd.querySelector('.escala-edicao-opcoes-titulo').textContent = m.marca === 'sai'
      ? msg().saiEm(nome, diaMes(cfg.periodo.inicio)) : msg().noPeriodo(nome, cfg.letra, diaMes(cfg.periodo.inicio));
    dd.querySelector('.escala-guarnicoes-opcoes-saida').textContent = diaMes(cfg.saida);
    linha.querySelector('.escala-guarnicoes-nome-acao').appendChild(dd);
    cfg.linha = linha;
    /* o resto da linha também abre o menu (o clique não segue para o document, que fecharia o menu em seguida) */
    linha.addEventListener('click', function (ev) {
      if (ev.target.closest('.dropdown')) return;
      ev.stopPropagation();
      RosterWork.abrirDropdown(dd);
    });
    dd.querySelector('[data-acao="cancelar-saida"]').addEventListener('click', function () { cancelarSaida(cfg); });
  }

  window.RosterWork.escalasPainelGuarnicoesAcoes = { lapis: lapis };
})();
