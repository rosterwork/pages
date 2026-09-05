(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    /* a guarda de sessão (redireciona se já logado) roda síncrona no <head>
       via login-sessao.js — aqui só montamos o formulário */
    var inputId = document.getElementById('entrada-identificador');
    var btnEntrar = document.getElementById('btn-entrar');

    if (inputId) {
      inputId.addEventListener('input', function () {
        var cursorPos = this.selectionStart;
        var valorAntigo = this.value;
        var digitosAntesCursor = valorAntigo.substring(0, cursorPos).replace(/\D/g, '').length;
        var nums = valorAntigo.replace(/\D/g, '').substring(0, 11);
        var formatado = window.RosterWork.mascaraCpfRg(nums);
        this.value = formatado;
        var novoPos = 0;
        var contagem = 0;
        for (var i = 0; i < formatado.length; i++) {
          if (/\d/.test(formatado[i])) {
            contagem++;
            if (contagem === digitosAntesCursor) {
              novoPos = i + 1;
              break;
            }
          }
        }
        if (contagem < digitosAntesCursor) novoPos = formatado.length;
        this.setSelectionRange(novoPos, novoPos);
      });
    }

    if (btnEntrar) {
      btnEntrar.addEventListener('click', window.RosterWork.fazerLogin);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.RosterWork.fazerLogin();
    });
  });

})();

/* "Criar conta" leva à tela pública de cadastro (fora do sistema) */
(function () {
  'use strict';
  var botao = document.getElementById('btn-criar-conta');
  if (botao) botao.addEventListener('click', function () { window.location.href = 'criar-conta.html'; });
})();
