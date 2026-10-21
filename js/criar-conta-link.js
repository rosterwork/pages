/* ============================================================
   CRIAR CONTA › o link de cadastro e o passo 1 (o CPF).
   A tela só funciona pelo link que o administrador gera na ficha
   (criar-conta.html?codigo=...). Ela confere o link
   (acesso_link_buscar), que não diz nada sobre a pessoa:
     - vale       -> o passo 1 pede o CPF;
     - não vale   -> só a mensagem (sem link, expirado, usado ou
                     cancelado) e o caminho para o login.
   O CPF certo (acesso_link_conferir) traz o nome, o posto, o
   celular e o e-mail para o passo 2; errado, conta uma tentativa
   (a 5ª cancela o link).
   Abrir o link não o gasta: só o "Criar conta" gasta.
   O preenchimento e a troca de passos ficam no criar-conta.js
   (RosterWork.criarConta.abrirPasso2).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos, V = RW.validacoes;

  var codigo = '';

  function el(id) { return document.getElementById(id); }
  function M() { return RW.mensagens.linkAcesso; }

  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  /* "AAAA-MM-DDTHH:MM:SS" (Brasília) -> ["DD/MM/AAAA", "HH:MM"] */
  function dataHora(iso) {
    var partes = String(iso || '').slice(0, 16).split('T');
    var d = partes[0].split('-');
    return [d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : '', partes[1] || ''];
  }

  /* o bloco do link: a mensagem e, quando o link não vale, o caminho para o login */
  function mostrarLink(texto, comLogin) {
    el('cc-link-texto').textContent = texto;
    el('cc-link-acoes').classList.toggle('oculto', !comLogin);
    el('cc-link').classList.remove('oculto');
    el('cc-passo1').classList.add('oculto');
    el('cc-corpo').classList.add('oculto');
  }

  /* o link não vale (a resposta do banco diz por quê) */
  function mostrarInvalido(r) {
    var motivo = r && r.motivo;
    if (motivo === 'expirado') {
      var q = dataHora(r.expira_em);
      mostrarLink(M().expiradoCadastro(q[0], q[1]), true);
    } else if (motivo === 'usado') {
      mostrarLink(M().usadoCadastro, true);
    } else {
      mostrarLink(M().invalido, true);
    }
  }

  function mostrarPasso1() {
    el('cc-link').classList.add('oculto');
    el('cc-passo1').classList.remove('oculto');
    el('cc-p1-cpf').focus();
  }

  function validarCpf() {
    C.limparErro(el('cc-p1-cpf'));
    var cpf = el('cc-p1-cpf').value.trim();
    if (!cpf) { C.marcarErro(el('cc-p1-cpf'), M().cpfVazio); return false; }
    /* como no login, basta ter 11 números: quem decide se confere com o link é o banco */
    if (V.soDigitos(cpf).length !== 11) { C.marcarErro(el('cc-p1-cpf'), M().cpfInvalido); return false; }
    return true;
  }

  /* o CPF confere com o link? então a ficha vai para o passo 2 */
  function continuar() {
    if (!validarCpf()) return;
    var botao = el('cc-p1-continuar');
    RW.iniciarCarregando(botao);
    var cpf = V.soDigitos(el('cc-p1-cpf').value);

    rpc('acesso_link_conferir', { p_codigo: codigo, p_tipo: 'cadastro', p_cpf: cpf })
      .then(function (r) {
        if (!r) { RW.pararCarregando(botao); RW.avisar({ tipo: 'erro', mensagem: M().erroConexao }); return; }
        if (r.ok !== true) {
          RW.pararCarregando(botao);
          if (r.motivo === 'cpf') { C.marcarErro(el('cc-p1-cpf'), M().cpfNaoConfere); return; }
          mostrarInvalido(r);
          return;
        }
        RW.pararCarregando(botao);
        if (RW.criarConta) RW.criarConta.abrirPasso2(cpf, codigo, r.dados);
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: M().erroConexao });
      });
  }

  function iniciar() {
    var cpf = el('cc-p1-cpf'), botao = el('cc-p1-continuar');
    if (!cpf || !botao) return;
    C.ligarMascara(cpf, C.mascararCpf);
    botao.addEventListener('click', continuar);
    cpf.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); continuar(); }
    });
    el('cc-link-login').addEventListener('click', function () { window.location.href = 'login.html'; });

    /* o código vem no endereço; sai da barra para não ficar no histórico do navegador */
    codigo = new URLSearchParams(window.location.search).get('codigo') || '';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (!codigo) { mostrarLink(M().semLinkCadastro, true); return; }

    mostrarLink(M().conferindo, false);
    rpc('acesso_link_buscar', { p_codigo: codigo, p_tipo: 'cadastro' })
      .then(function (r) {
        if (!r) { mostrarLink(M().erroConexao, true); return; }
        if (r.ok === true) mostrarPasso1();
        else mostrarInvalido(r);
      })
      .catch(function () { mostrarLink(M().erroConexao, true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
