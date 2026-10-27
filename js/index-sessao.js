(function () {
  'use strict';

  /* o tema é aplicado antes, pelo componentes/js/geral-tema.js (também síncrono no <head>) */

  /* celular (para todos): no aparelho de tela pequena (o lado menor abaixo de 768px),
     troca a largura da página para a do aparelho e marca o <html> com data-celular,
     que liga o bloco do celular nos CSS (@media até 767px). Tablet e computador seguem
     com a página de 1920px. Roda antes da primeira pintura, como o tema */
  function ligarCelular() {
    try {
      if (!window.RosterWork.aplicativo.celular()) return;   /* a conta do celular mora no geral-aplicativo.js */
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      document.documentElement.setAttribute('data-celular', '');
    } catch (e) {}
  }

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
  sessionStorage.removeItem('rosterwork_extra_mes');   // mês da Extrajornada não sobrevive a uma sessão nova
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
