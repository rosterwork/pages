/* ============================================================
   NOVA SENHA — tela pública, destino do link de nova senha que o
   administrador gera na ficha (nova-senha.html?codigo=...).
   Confere o link (acesso_link_buscar, que não diz nada sobre a
   pessoa), pede o CPF (acesso_link_conferir: errado conta uma
   tentativa, a 5ª cancela o link), mostra de quem é a conta e grava
   a senha nova (acesso_link_definir_senha). O link vale uma vez e
   por 24 horas; abrir não o gasta. Vencido, usado ou cancelado, a
   tela só explica e leva ao login: o link novo se pede pessoalmente
   ao administrador.
   Reusa os helpers de erro de campo e o carregando do login.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork;

  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) throw new Error('http');
        return resp.json();
      });
  }

  /* "AAAA-MM-DDTHH:MM:SS" (Brasília) -> ["DD/MM/AAAA", "HH:MM"] */
  function dataHora(iso) {
    var partes = String(iso || '').slice(0, 16).split('T');
    var d = partes[0].split('-');
    return [d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : '', partes[1] || ''];
  }

  document.addEventListener('DOMContentLoaded', function () {
    var M = RW.mensagens.novaSenha, L = RW.mensagens.linkAcesso;
    var V = RW.validacoes, C = RW.campos;
    var conferindo = document.getElementById('nova-senha-conferindo');
    var passoCpf = document.getElementById('nova-senha-cpf');
    var cpf = document.getElementById('cpf-conferir');
    var btnCpf = document.getElementById('btn-conferir-cpf');
    var form = document.getElementById('nova-senha-form');
    var conta = document.getElementById('nova-senha-conta');
    var blocoOk = document.getElementById('nova-senha-ok');
    var blocoInvalido = document.getElementById('nova-senha-invalido');
    var nova = document.getElementById('senha-nova');
    var confirma = document.getElementById('senha-confirma');
    var btnSalvar = document.getElementById('btn-salvar-senha');
    var btnIrLogin = document.getElementById('btn-ir-login');
    var cpfConferido = '';

    btnIrLogin.addEventListener('click', function () { window.location.href = 'login.html'; });

    /* o código vem no endereço; tiramos da barra para não ficar no histórico do navegador */
    var codigo = new URLSearchParams(window.location.search).get('codigo') || '';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    /* o link não vale: some o formulário e fica só a explicação */
    function mostrarInvalido(texto) {
      conferindo.classList.add('oculto');
      passoCpf.classList.add('oculto');
      form.classList.add('oculto');
      blocoOk.classList.add('oculto');
      blocoInvalido.textContent = texto;
      blocoInvalido.classList.remove('oculto');
    }

    /* a resposta do banco diz por que o link não vale */
    function invalidoPor(r) {
      if (r && r.motivo === 'expirado') { var q = dataHora(r.expira_em); mostrarInvalido(L.expiradoSenha(q[0], q[1])); return; }
      if (r && r.motivo === 'usado') { mostrarInvalido(L.usadoSenha); return; }
      mostrarInvalido(L.invalido);
    }

    function mostrarSucesso() {
      form.classList.add('oculto');
      blocoInvalido.classList.add('oculto');
      blocoOk.textContent = M.redefinida;
      blocoOk.classList.remove('oculto');
    }

    /* ---------- passo 1: o CPF ---------- */

    function conferirCpf() {
      RW.esconderErroCampo(cpf);
      if (!cpf.value.trim()) { RW.mostrarErroCampo(cpf, L.cpfVazio); return; }
      /* como no login, basta ter 11 números: quem decide se confere com o link é o banco */
      if (V.soDigitos(cpf.value).length !== 11) { RW.mostrarErroCampo(cpf, L.cpfInvalido); return; }
      var digitos = V.soDigitos(cpf.value);
      RW.iniciarCarregando(btnCpf);
      rpc('acesso_link_conferir', { p_codigo: codigo, p_tipo: 'senha', p_cpf: digitos }).then(function (r) {
        RW.pararCarregando(btnCpf);
        if (r && r.ok) {
          cpfConferido = digitos;
          conta.textContent = r.nome || '';
          passoCpf.classList.add('oculto');
          form.classList.remove('oculto');
          revisar();
          nova.focus();
          return;
        }
        if (r && r.motivo === 'cpf') { RW.mostrarErroCampo(cpf, L.cpfNaoConfere); return; }
        invalidoPor(r);
      }).catch(function () {
        RW.pararCarregando(btnCpf);
        RW.mostrarErroCampo(cpf, L.erroConexao);
      });
    }

    C.ligarMascara(cpf, C.mascararCpf);
    cpf.addEventListener('keydown', function (e) { if (e.key === 'Enter') conferirCpf(); });
    btnCpf.addEventListener('click', conferirCpf);

    /* ---------- passo 2: a senha nova ---------- */

    function revisar() {
      btnSalvar.disabled = !(nova.value && confirma.value);
    }

    function salvar() {
      if (btnSalvar.disabled) return;
      RW.esconderErroCampo(nova);
      RW.esconderErroCampo(confirma);

      if (nova.value.length < 6) { RW.mostrarErroCampo(nova, M.senhaCurta); return; }
      if (nova.value !== confirma.value) { RW.mostrarErroCampo(confirma, M.senhaNaoConfere); return; }

      RW.iniciarCarregando(btnSalvar);
      rpc('acesso_link_definir_senha', { p_codigo: codigo, p_cpf: cpfConferido, p_senha: nova.value }).then(function (r) {
        RW.pararCarregando(btnSalvar);
        if (r && r.ok) { mostrarSucesso(); return; }
        var motivo = r && r.motivo;
        if (motivo === 'invalido' || motivo === 'cpf') { mostrarInvalido(L.invalido); return; }
        if (motivo === 'curta') { RW.mostrarErroCampo(nova, M.senhaCurta); return; }
        if (motivo === 'igual') { RW.mostrarErroCampo(nova, M.senhaIgual); return; }
        RW.mostrarErroCampo(nova, M.falhaRedefinir);
      }).catch(function () {
        RW.pararCarregando(btnSalvar);
        RW.mostrarErroCampo(nova, L.erroConexao);
      });
    }

    [nova, confirma].forEach(function (campo) {
      campo.addEventListener('input', revisar);
      campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') salvar(); });
    });
    btnSalvar.addEventListener('click', salvar);

    /* ---------- o link ---------- */

    /* sem código no endereço, nem pergunta ao banco */
    if (!codigo) { mostrarInvalido(L.semLinkSenha); return; }

    RW.iniciarCarregando(conferindo);
    rpc('acesso_link_buscar', { p_codigo: codigo, p_tipo: 'senha' }).then(function (r) {
      RW.pararCarregando(conferindo);
      if (!r || !r.ok) { invalidoPor(r); return; }
      conferindo.classList.add('oculto');
      passoCpf.classList.remove('oculto');
      cpf.focus();
    }).catch(function () {
      RW.pararCarregando(conferindo);
      mostrarInvalido(L.erroConexao);
    });
  });

})();
