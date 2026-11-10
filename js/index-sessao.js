(function () {
  'use strict';

  /* o tema é aplicado antes, pelo componentes/js/geral-tema.js (também síncrono no <head>) */

  /* celular (para todos): na tela pequena de um aparelho de dedo (o lado menor abaixo de 768px),
     troca a largura da página para a do aparelho e marca o <html> com data-celular,
     que liga o bloco do celular nos CSS (@media até 767px). Tablet e computador seguem
     com a página de 1920px. Roda antes da primeira pintura, como o tema */
  function ligarCelular() {
    try {
      if (!window.RosterWork.aplicativo.celular()) return;   /* a conta do celular mora no geral-aplicativo.js */
      document.documentElement.setAttribute('data-celular', '');
      aplicarTela();
    } catch (e) {}
  }

  /* o Tamanho da tela no celular (a escolha da pessoa, no menu das iniciais; js/index-cabecalho.js): Normal, a página na
     largura do aparelho; Menor, tudo a 85% (a página fica mais larga que o aparelho e o navegador desenha tudo menor, na
     mesma proporção). No Menor, a marca data-tela-menor no <html> dá à barra de baixo o lugar a mais, e as telas que
     moram nele (data-lugar-celular-menor) saem da folha Mais e vão para a barra (css/index-sidebar.css) */
  var TELA_MENOR = 0.85;

  function lerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; }
  }

  /* 'normal' (sem escolha) ou 'menor' */
  function telaEscolhida() { return lerPrefs().tela_celular === 'menor' ? 'menor' : 'normal'; }

  function aplicarTela() {
    if (!document.documentElement.hasAttribute('data-celular')) return;
    var menor = telaEscolhida() === 'menor';
    var viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=' + (menor ? TELA_MENOR : 1));
    if (menor) document.documentElement.setAttribute('data-tela-menor', '');
    else document.documentElement.removeAttribute('data-tela-menor');
    Array.prototype.forEach.call(document.querySelectorAll('[data-lugar-celular-menor]'), function (item) {
      if (!item.hasAttribute('data-lugar-celular-normal')) item.setAttribute('data-lugar-celular-normal', item.getAttribute('data-lugar-celular'));
      item.setAttribute('data-lugar-celular', item.getAttribute(menor ? 'data-lugar-celular-menor' : 'data-lugar-celular-normal'));
    });
  }

  /* troca a escolha: aplica na hora, guarda na sessão e grava no banco (só com alguém logado) */
  function escolherTela(valor) {
    var prefs = lerPrefs();
    prefs.tela_celular = valor === 'menor' ? 'menor' : 'normal';
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    aplicarTela();
    var R = window.RosterWork;
    if (R.apiFetch && R.obterToken && R.obterToken()) {
      R.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_tela_celular: prefs.tela_celular }
      }).catch(function () {});   // falhou: só não lembra desta vez (a tela já está certa)
    }
  }

  /* o menu das iniciais aplica de novo quando o sistema abre (na entrada pelo Manter-me conectado, as preferências
     chegam depois da primeira pintura) e troca pela escolha */
  window.RosterWork.tamanhoTela = { escolha: telaEscolhida, aplicar: aplicarTela, escolher: escolherTela };

  /* menu recolhido (preferência da pessoa): marca o <html> com data-menu-recolhido antes da primeira
     pintura, como o tema; sem isso o menu aparece aberto e fecha quando o js/index-sidebar.js roda.
     Na entrada pelo login lembrado as preferências chegam depois, e quem marca é o index-sidebar.js */
  function marcarMenuRecolhido() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      if (prefs && prefs.sidebar_recolhido) document.documentElement.setAttribute('data-menu-recolhido', '');
    } catch (e) {}
  }

  var RW = window.RosterWork;
  var sessao = null;
  try { sessao = JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) {}

  /* a sessão desta aba vale: o js/index-carregar.js roda o sistema na hora */
  if (sessao && sessao.access_token) {
    try {
      var payload = JSON.parse(atob(sessao.access_token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        ligarCelular();
        marcarMenuRecolhido();
        RW.sessaoPronta = Promise.resolve({ ok: true });
        return;
      }
    } catch (e) {}
  }

  sessionStorage.removeItem('rosterwork_session');
  sessionStorage.removeItem('rosterwork_user');
  sessionStorage.removeItem('rosterwork_preferencias');
  sessionStorage.removeItem('rosterwork_treino');
  /* veio de uma notificação do celular (?aviso=…): guarda para abrir o assunto depois da entrada (index-avisos.js) */
  try {
    var aviso = new URLSearchParams(location.search).get('aviso');
    if (aviso) sessionStorage.setItem('rosterwork_aviso_pendente', aviso);
  } catch (e) {}

  /* sem sessão nesta aba, mas com o login lembrado no aparelho (Manter-me conectado): entra direto, sem
     passar pelo login. A tela "entrando" cobre o sistema enquanto o acesso é renovado (componentes/js/
     geral-entrada.js), e o js/index-carregar.js roda o sistema quando a sessão fica pronta, ou mostra a falha */
  if (RW.conectado && RW.conectado.lembrado() && RW.entrada) {
    ligarCelular();
    document.documentElement.setAttribute('data-entrando', '');
    RW.sessaoPronta = RW.entrada.renovarLembrado();
    return;
  }

  window.location.replace('login.html');
})();
