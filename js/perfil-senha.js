/* ============================================================
   MEU PERFIL — aba "Segurança": troca de senha. Exige a senha
   atual, valida no cliente e troca por RosterWork.trocarSenha
   (que renova a sessão com a senha nova).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function iniciar(usuario) {
    var atual = document.getElementById('senha-atual');
    var nova = document.getElementById('senha-nova');
    var confirma = document.getElementById('senha-confirma');
    var erro = document.getElementById('senha-erro');
    var salvar = document.getElementById('senha-salvar');
    if (!atual || !nova || !confirma || !salvar) return;
    var M = RosterWork.mensagens.perfil;

    function revisar() {
      if (erro) erro.textContent = '';
      salvar.disabled = !(atual.value && nova.value && confirma.value);
    }
    [atual, nova, confirma].forEach(function (campo) { campo.addEventListener('input', revisar); });

    salvar.addEventListener('click', function () {
      if (salvar.disabled) return;
      if (nova.value.length < 6) { if (erro) erro.textContent = M.senhaCurta; return; }
      if (nova.value !== confirma.value) { if (erro) erro.textContent = M.senhaNaoConfere; return; }
      if (nova.value === atual.value) { if (erro) erro.textContent = M.senhaIgual; return; }

      if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(salvar);
      RosterWork.trocarSenha(usuario.email, atual.value, nova.value).then(function (retorno) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        if (retorno && retorno.ok) {
          atual.value = ''; nova.value = ''; confirma.value = ''; revisar();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: M.senhaTrocada });
          return;
        }
        if (retorno && retorno.erro === 'atual') {
          if (erro) erro.textContent = M.senhaAtualErrada;
          return;
        }
        RosterWork.avisar({
          tipo: 'erro',
          mensagem: (retorno && retorno.erro === 'conexao') ? RosterWork.mensagens.geral.semConexao : M.falhaTrocaSenha
        });
      });
    });

    revisar();
  }

  RosterWork.perfilSenha = { iniciar: iniciar };
})();
