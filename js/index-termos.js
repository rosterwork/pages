/* ============================================================
   TERMOS DE USO E PRIVACIDADE — no sistema (shell)
   Ao abrir o sistema, confere se quem está logado já deu ciência
   da versão vigente (termos_situacao). Se falta, abre a janela de
   ciência, que só fecha por "Estou ciente" (termos_dar_ciencia,
   grava no Histórico; a própria janela confirma, sem o resumo) ou
   por "Sair". Liga o item "Termos e privacidade" do menu do usuário
   e expõe RosterWork.termos para o Meu perfil.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* a página pública abre em outra aba: o que está na tela não se perde */
  function abrirPagina() {
    window.open('termos.html', '_blank', 'noopener');
  }

  /* devolve a situação ({versao_atual, versao_ciente, ciente_em_br, pendente}) ou null na falha */
  function situacao() {
    return RosterWork.rpc('termos_situacao')
      .then(function (r) { return (r && r.success) ? r : null; })
      .catch(function () { return null; });
  }

  function darCiencia(botao) {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc('termos_dar_ciencia')
      .then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        if (r && r.success) {
          if (RosterWork.fecharModais) RosterWork.fecharModais();
          return;
        }
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.termos.falhaCiencia });
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* abre a janela depois que a primeira página termina de carregar: o véu de
     carregamento fica acima dos modais e cobriria a janela (espera até ~5 s) */
  function abrirQuandoLivre(tentativas) {
    if (document.querySelector('.carregando-veu--visivel') && tentativas > 0) {
      setTimeout(function () { abrirQuandoLivre(tentativas - 1); }, 200);
      return;
    }
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-termos');
  }

  function inicializar() {
    var itemMenu = document.getElementById('btn-termos');
    if (itemMenu) itemMenu.addEventListener('click', function () {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      abrirPagina();
    });

    var ler = document.getElementById('termos-ciencia-ler');
    var sair = document.getElementById('termos-ciencia-sair');
    var confirmar = document.getElementById('termos-ciencia-confirmar');
    if (ler) ler.addEventListener('click', abrirPagina);
    if (sair) sair.addEventListener('click', function () { if (RosterWork.sair) RosterWork.sair(); });
    if (confirmar) confirmar.addEventListener('click', function () { darCiencia(confirmar); });

    situacao().then(function (s) {
      if (s && s.pendente) abrirQuandoLivre(25);
    });
  }

  window.RosterWork.termos = { situacao: situacao, abrirPagina: abrirPagina };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
