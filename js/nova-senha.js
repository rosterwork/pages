/* ============================================================
   NOVA SENHA — tela pública, em dois modos
   · recuperação (destino do link do email): lê o token do fragmento
     da URL, valida a nova senha e grava via PUT /auth/v1/user. Sem
     token válido, mostra o aviso de link inválido/expirado.
   · senha provisória (?provisoria): quem entrou com a senha criada
     pelo administrador (Redefinir senha) troca a senha antes de
     entrar. Usa a sessão do login e, ao salvar, abre o sistema.
   Nos dois modos, a troca desliga a marca de senha provisória.
   Reusa os helpers de erro de campo do login.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

  /* desliga a marca de senha provisória de quem acabou de trocar a senha.
     Melhor esforço: a senha já mudou; se falhar, a troca é pedida de novo no próximo acesso */
  function concluirProvisoria(token) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/senha_provisoria_concluir', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}'
    }).catch(function () {});
  }

  function sessaoAtual() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) { return null; }
  }

  /* o perfil guardado na sessão deixa de pedir a troca (senão o index manda de volta para cá) */
  function desmarcarProvisoriaNaSessao() {
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      if (usuario) { usuario.senha_provisoria = false; sessionStorage.setItem('rosterwork_user', JSON.stringify(usuario)); }
    } catch (e) {}
  }

  /* sair sem trocar: descarta a sessão (as mesmas chaves que o index limpa) e volta ao login */
  function sair() {
    ['rosterwork_session', 'rosterwork_user', 'rosterwork_preferencias', 'rosterwork_extra_mes']
      .forEach(function (chave) { sessionStorage.removeItem(chave); });
    window.location.replace('login.html');
  }

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
    var btnSair = document.getElementById('btn-sair');
    var provisoria = new URLSearchParams(window.location.search).has('provisoria');

    btnIrLogin.addEventListener('click', function () { window.location.href = 'login.html'; });
    btnPedirNovo.addEventListener('click', function () { window.location.href = 'recuperar-senha.html'; });
    btnSair.addEventListener('click', sair);

    var accessToken = null, tipo = null, erroNoLink = null;
    if (provisoria) {
      /* senha provisória: vale a sessão do login; sem ela, volta a entrar */
      var sessao = sessaoAtual();
      accessToken = sessao && sessao.access_token;
      if (!accessToken) { window.location.replace('login.html'); return; }
      document.getElementById('nova-senha-titulo').classList.add('oculto');
      document.getElementById('nova-senha-titulo-provisoria').classList.remove('oculto');
      document.getElementById('nova-senha-intro-provisoria').classList.remove('oculto');
      btnIrLogin.classList.add('oculto');
      btnSair.classList.remove('oculto');
    } else {
      /* o link do email chega com o token no fragmento (#...); lemos e limpamos
         a barra de endereço para o token não ficar guardado no histórico */
      var fragmento = window.location.hash ? window.location.hash.substring(1) : '';
      var params = new URLSearchParams(fragmento);
      accessToken = params.get('access_token');
      tipo = params.get('type');
      erroNoLink = params.get('error') || params.get('error_code');
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
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

    /* recuperação sem token: o link é inválido ou já expirou */
    if (!provisoria && (erroNoLink || !accessToken || tipo !== 'recovery')) {
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
        if (resp.ok) {
          /* senha trocada: desliga a marca de senha provisória e segue */
          return concluirProvisoria(accessToken).then(function () {
            window.RosterWork.pararCarregando(btnSalvar);
            if (provisoria) { desmarcarProvisoriaNaSessao(); window.location.replace('index.html'); return; }
            mostrarSucesso();
          });
        }
        window.RosterWork.pararCarregando(btnSalvar);
        /* sessão/token expirado ou já usado: na recuperação, link inválido; na provisória, entrar de novo */
        if (resp.status === 401 || resp.status === 403) { if (provisoria) sair(); else mostrarInvalido(); return; }
        /* a mesma senha de antes é recusada pelo servidor */
        return resp.json().catch(function () { return {}; }).then(function (corpo) {
          var igual = corpo && corpo.error_code === 'same_password';
          window.RosterWork.mostrarErroCampo(nova, igual ? M.senhaIgual : M.falhaRedefinir);
        });
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
