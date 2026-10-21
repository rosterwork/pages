/* ============================================================
   MEU PERFIL — aba "Segurança": troca de senha. Exige a senha
   atual, valida no cliente e troca por RosterWork.trocarSenha
   (que renova a sessão com a senha nova). Também o "Sair de todos
   os aparelhos" (RosterWork.sairDeTodos).
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
      /* o endereço de login da conta (vem do login; não muda quando o e-mail da ficha muda) */
      var email = ((RosterWork.sessao && RosterWork.sessao.perfil()) || usuario).email;
      RosterWork.trocarSenha(email, atual.value, nova.value).then(function (retorno) {
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
        if (retorno && retorno.erro === 'limite') {
          if (erro) erro.textContent = RosterWork.mensagens.geral.muitasEntradas;
          return;
        }
        RosterWork.avisar({
          tipo: 'erro',
          mensagem: (retorno && retorno.erro === 'conexao') ? RosterWork.mensagens.geral.semConexao : M.falhaTrocaSenha
        });
      });
    });

    revisar();

    /* Aparelhos: encerra a sessão em todos os aparelhos (confirmação antes); deu certo, vai ao login */
    var sairTodos = document.getElementById('sair-todos');
    if (sairTodos) {
      sairTodos.addEventListener('click', function () {
        RosterWork.confirmar({
          tipo: 'aviso',
          mensagem: RosterWork.mensagens.sessao.sairTodosConfirmar,
          textoConfirmar: RosterWork.mensagens.botoes.sairDeTodos,
          aoConfirmar: function () {
            RosterWork.iniciarCarregando(sairTodos);
            RosterWork.sairDeTodos().then(function (saiu) {
              if (saiu) return;
              RosterWork.pararCarregando(sairTodos);
              RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.sessao.sairTodosErro });
            });
          }
        });
      });
    }
  }

  RosterWork.perfilSenha = { iniciar: iniciar };
})();
