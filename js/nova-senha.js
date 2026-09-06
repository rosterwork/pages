/* ============================================================
   NOVA SENHA — tela pública (destino do link do email)
   Lê o token de recuperação do fragmento da URL, valida a nova
   senha e grava via PUT /auth/v1/user. Sem token válido, mostra
   o aviso de link inválido/expirado. Reusa os helpers de erro
   de campo do login.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

  document.addEventListener('DOMContentLoaded', function () {
    var M = window.RosterWork.mensagens.recuperacao;
    var form = document.getElementById('nova-senha-form');
    var blocoOk = document.getElementById('nova-senha-ok');
    var blocoInvalido = document.getElementById('nova-senha-invalido');
    var nova = document.getElementById('senha-nova');
    var confirma = document.getElementById('senha-confirma');
    var btnSalvar = document.getElementById('btn-salvar-senha');
    var btnIrLogin = document.getElementById('btn-ir-login');
    var btnPedirNovo = document.getElementById('btn-pedir-novo');

    btnIrLogin.addEventListener('click', function () { window.location.href = 'login.html'; });
    btnPedirNovo.addEventListener('click', function () { window.location.href = 'recuperar-senha.html'; });

    /* o link do email chega com o token no fragmento (#...); lemos e limpamos
       a barra de endereço para o token não ficar guardado no histórico */
    var fragmento = window.location.hash ? window.location.hash.substring(1) : '';
    var params = new URLSearchParams(fragmento);
    var accessToken = params.get('access_token');
    var tipo = params.get('type');
    var erroNoLink = params.get('error') || params.get('error_code');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    function mostrarInvalido() {
      form.classList.add('oculto');
      blocoOk.classList.add('oculto');
      blocoInvalido.textContent = M.linkInvalido;
      blocoInvalido.classList.remove('oculto');
      btnPedirNovo.classList.remove('oculto');
    }

    function mostrarSucesso() {
      form.classList.add('oculto');
      blocoInvalido.classList.add('oculto');
      blocoOk.textContent = M.redefinida;
      blocoOk.classList.remove('oculto');
      btnPedirNovo.classList.add('oculto');
    }

    /* sem token de recuperação: o link é inválido ou já expirou */
    if (erroNoLink || !accessToken || tipo !== 'recovery') {
      mostrarInvalido();
      return;
    }

    function revisar() {
      btnSalvar.disabled = !(nova.value && confirma.value);
    }

    function salvar() {
      if (btnSalvar.disabled) return;
      window.RosterWork.esconderErroCampo(nova);
      window.RosterWork.esconderErroCampo(confirma);

      if (nova.value.length < 6) { window.RosterWork.mostrarErroCampo(nova, M.senhaCurta); return; }
      if (nova.value !== confirma.value) { window.RosterWork.mostrarErroCampo(confirma, M.senhaNaoConfere); return; }

      window.RosterWork.iniciarCarregando(btnSalvar);
      fetch(SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: nova.value })
      }).then(function (resp) {
        window.RosterWork.pararCarregando(btnSalvar);
        if (resp.ok) { mostrarSucesso(); return; }
        /* token expirado ou já usado: link inválido */
        if (resp.status === 401 || resp.status === 403) { mostrarInvalido(); return; }
        window.RosterWork.mostrarErroCampo(nova, M.falhaRedefinir);
      }).catch(function () {
        window.RosterWork.pararCarregando(btnSalvar);
        window.RosterWork.mostrarErroCampo(nova, M.erroConexao);
      });
    }

    [nova, confirma].forEach(function (campo) {
      campo.addEventListener('input', revisar);
      campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') salvar(); });
    });
    btnSalvar.addEventListener('click', salvar);
    revisar();
  });

})();
