/* ============================================================
   RECUPERAR SENHA — tela pública (antes da sessão)
   Pede o CPF/RG e chama senha_pedir_ajuda: o banco avisa os
   administradores da unidade (um aviso por pessoa, sem repetir),
   e um deles entrega o link de nova senha. Sem e-mail.
   Reusa a máscara e os helpers de erro de campo do login.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

  document.addEventListener('DOMContentLoaded', function () {
    var M = window.RosterWork.mensagens.recuperacao;
    var input = document.getElementById('entrada-identificador');
    var btnEnviar = document.getElementById('btn-enviar-pedido');
    var blocoPedido = document.getElementById('recuperar-pedido');
    var sucesso = document.getElementById('recuperar-sucesso');
    var btnVoltar = document.getElementById('btn-voltar-login');

    btnVoltar.addEventListener('click', function () { window.location.href = 'login.html'; });

    /* máscara de CPF/RG ao digitar */
    input.addEventListener('input', function () {
      var nums = this.value.replace(/\D/g, '').substring(0, 11);
      this.value = window.RosterWork.mascaraCpfRg(nums);
    });

    function enviar() {
      if (btnEnviar.disabled) return;
      window.RosterWork.esconderErroCampo(input);

      var identificador = input.value.replace(/\D/g, '');
      if (!identificador) {
        window.RosterWork.mostrarErroCampo(input, M.identificadorVazio);
        return;
      }
      if (identificador.length !== 8 && identificador.length !== 9 && identificador.length !== 11) {
        window.RosterWork.mostrarErroCampo(input, M.identificadorInvalido);
        return;
      }

      window.RosterWork.iniciarCarregando(btnEnviar);
      fetch(SUPABASE_URL + '/rest/v1/rpc/senha_pedir_ajuda', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_identificador: identificador })
      }).then(function (resp) {
        if (!resp.ok) throw new Error('http');
        return resp.json();
      }).then(function (resultado) {
        window.RosterWork.pararCarregando(btnEnviar);
        if (resultado && resultado.ok) {
          sucesso.textContent = M.pedidoEnviado;
          blocoPedido.classList.add('oculto');
          sucesso.classList.remove('oculto');
          return;
        }
        var motivo = resultado && resultado.motivo;
        if (motivo === 'sem_conta') { window.RosterWork.mostrarErroCampo(input, M.semConta); return; }
        if (motivo === 'nao_encontrado') { window.RosterWork.mostrarErroCampo(input, M.naoEncontrado); return; }
        window.RosterWork.mostrarErroCampo(input, M.falha);
      }).catch(function () {
        window.RosterWork.pararCarregando(btnEnviar);
        window.RosterWork.mostrarErroCampo(input, M.erroConexao);
      });
    }

    btnEnviar.addEventListener('click', enviar);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') enviar(); });
  });

})();
