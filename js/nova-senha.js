/* ============================================================
   NOVA SENHA — tela pública, destino do link que o administrador
   gera na ficha (nova-senha.html?codigo=...). Confere o link
   (senha_link_buscar), mostra de quem é a conta e grava a senha
   nova (senha_link_definir). O link vale uma vez e por 24 horas;
   vencido ou usado, a tela oferece pedir outro.
   Reusa os helpers de erro de campo e o carregando do login.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

  function rpc(nome, corpo) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + nome, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (resp) {
      if (!resp.ok) throw new Error('http');
      return resp.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var M = window.RosterWork.mensagens.recuperacao;
    var conferindo = document.getElementById('nova-senha-conferindo');
    var form = document.getElementById('nova-senha-form');
    var conta = document.getElementById('nova-senha-conta');
    var blocoOk = document.getElementById('nova-senha-ok');
    var blocoInvalido = document.getElementById('nova-senha-invalido');
    var nova = document.getElementById('senha-nova');
    var confirma = document.getElementById('senha-confirma');
    var btnSalvar = document.getElementById('btn-salvar-senha');
    var btnIrLogin = document.getElementById('btn-ir-login');
    var btnPedirNovo = document.getElementById('btn-pedir-novo');

    btnIrLogin.addEventListener('click', function () { window.location.href = 'login.html'; });
    btnPedirNovo.addEventListener('click', function () { window.location.href = 'recuperar-senha.html'; });

    /* o código vem no endereço; tiramos da barra para não ficar no histórico do navegador */
    var codigo = new URLSearchParams(window.location.search).get('codigo') || '';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    /* link sem uso: some o formulário; "Pedir novo link" só quando o problema é o link (não a conexão) */
    function mostrarInvalido(texto, semPedirNovo) {
      conferindo.classList.add('oculto');
      form.classList.add('oculto');
      blocoOk.classList.add('oculto');
      blocoInvalido.textContent = texto;
      blocoInvalido.classList.remove('oculto');
      btnPedirNovo.classList.toggle('oculto', !!semPedirNovo);
    }

    function mostrarSucesso() {
      form.classList.add('oculto');
      blocoInvalido.classList.add('oculto');
      blocoOk.textContent = M.redefinida;
      blocoOk.classList.remove('oculto');
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
      rpc('senha_link_definir', { p_token: codigo, p_senha: nova.value }).then(function (r) {
        window.RosterWork.pararCarregando(btnSalvar);
        if (r && r.ok) { mostrarSucesso(); return; }
        var motivo = r && r.motivo;
        if (motivo === 'invalido') { mostrarInvalido(M.linkInvalido); return; }
        if (motivo === 'curta') { window.RosterWork.mostrarErroCampo(nova, M.senhaCurta); return; }
        if (motivo === 'igual') { window.RosterWork.mostrarErroCampo(nova, M.senhaIgual); return; }
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

    /* sem código no endereço, nem pergunta ao banco */
    if (!codigo) { mostrarInvalido(M.linkInvalido); return; }

    window.RosterWork.iniciarCarregando(conferindo);
    rpc('senha_link_buscar', { p_token: codigo }).then(function (r) {
      window.RosterWork.pararCarregando(conferindo);
      if (!r || !r.ok) { mostrarInvalido(M.linkInvalido); return; }
      conta.textContent = r.nome || '';
      conferindo.classList.add('oculto');
      form.classList.remove('oculto');
      revisar();
      nova.focus();
    }).catch(function () {
      window.RosterWork.pararCarregando(conferindo);
      mostrarInvalido(M.erroConexao, true);
    });
  });

})();
