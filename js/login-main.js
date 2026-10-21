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

    /* Manter-me conectado: a caixinha marca e desmarca (também pelo texto); no app instalado
       no celular já vem marcada */
    var caixaConectado = document.getElementById('login-conectado');
    function marcarConectado(marcada) {
      caixaConectado.setAttribute('aria-checked', marcada ? 'true' : 'false');
      caixaConectado.classList.toggle('caixa-selecao--marcada', marcada);
    }
    function alternarConectado() {
      if (caixaConectado.disabled) return;   /* travada enquanto entra */
      marcarConectado(caixaConectado.getAttribute('aria-checked') !== 'true');
    }
    if (caixaConectado) {
      caixaConectado.addEventListener('click', alternarConectado);
      document.getElementById('login-conectado-rotulo').addEventListener('click', alternarConectado);
      if (window.RosterWork.aplicativo.noCelularInstalado()) marcarConectado(true);
    }

    /* login lembrado neste aparelho: entra sozinho */
    window.RosterWork.entrarLembrado();
  });

})();
