/* ============================================================
   CRIAR CONTA › regras dos campos, validação e envio.

   A regra de cada campo mora num lugar só (o mapa REGRAS) e é
   usada duas vezes: ao SAIR do campo (o erro aparece perto de
   onde foi cometido) e no ENVIO (que ainda cobra os obrigatórios).
   Sem isso a mesma regra ficaria escrita em dois lugares e um dia
   sairiam diferentes.

   O banco valida tudo de novo: aqui é conveniência, lá é a regra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos, V = RW.validacoes;

  var rpc = null;

  function el(id) { return document.getElementById(id); }
  function valor(id) { return (el(id).value || '').trim(); }
  function T() { return RW.mensagens.cadastro; }

  /* ---------- as regras ----------
     `vazio`   — mensagem quando o campo é obrigatório e está em branco (só no envio)
     `formato` — confere o que foi digitado; roda também ao sair do campo */
  var REGRAS = {
    'cc-celular': {
      vazio: function () { return T().celularVazio; },
      formato: function (v) { return V.soDigitos(v).length !== 11 ? T().celularInvalido : null; }
    },
    'cc-email': {
      vazio: function () { return T().emailVazio; },
      formato: function (v) { return V.validarEmail(v) ? null : T().emailInvalido; }
    },
    'cc-senha': {
      vazio: function () { return RW.mensagens.perfil.senhaCurta; },
      formato: function (v) { return v.length < 6 ? RW.mensagens.perfil.senhaCurta : null; }
    },
    'cc-senha-confirma': {
      vazio: function () { return RW.mensagens.perfil.senhaNaoConfere; },
      formato: function (v) { return v !== el('cc-senha').value ? RW.mensagens.perfil.senhaNaoConfere : null; }
    }
  };

  /* ---------- ao sair do campo ---------- */
  function ligarValidacoes() {
    Object.keys(REGRAS).forEach(function (id) {
      var regra = REGRAS[id];
      if (!regra.formato) return;   /* só cobra "vazio" — e isso é no envio */
      C.ligarValidacao(el(id), regra.formato);
    });
    /* mexer na senha revalida a confirmação — senão ela fica vermelha à toa
       depois que a pessoa corrige a de cima */
    el('cc-senha').addEventListener('blur', function () {
      var conf = el('cc-senha-confirma');
      if (!conf.value.trim()) return;
      var erro = REGRAS['cc-senha-confirma'].formato(conf.value.trim());
      if (erro) C.marcarErro(conf, erro); else C.limparErro(conf);
    });
  }

  /* leva a tela até o primeiro campo vermelho — o erro não pode ficar escondido */
  function mostrarPrimeiroErro() {
    var campo = document.querySelector('.campo--erro');
    if (campo && campo.scrollIntoView) campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- o envio: cobra tudo de novo ----------
     valida os campos e devolve se está tudo certo */
  function validarCampos() {
    C.limparErros(el('cc-corpo'));
    var ok = true;
    function erro(elemento, msg) { C.marcarErro(elemento, msg); ok = false; }

    Object.keys(REGRAS).forEach(function (id) {
      var regra = REGRAS[id];
      var v = valor(id);
      if (!v) { var msgVazio = regra.vazio(); if (msgVazio) erro(el(id), msgVazio); return; }
      if (regra.formato) {
        var msg = regra.formato(v);
        if (msg) erro(el(id), msg);
      }
    });

    /* a ciência dos termos é obrigatória */
    if (el('cc-termos').getAttribute('aria-checked') !== 'true') erro(el('cc-termos'), RW.mensagens.termos.obrigatorio);

    return ok;
  }

  function irParaLogin() { window.location.href = 'login.html'; }

  /* cria a conta pelo link (acesso_link_criar_conta); e-mail e celular valem na hora */
  function enviar() {
    var botao = el('cc-enviar');
    if (!validarCampos()) {
      mostrarPrimeiroErro();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir });
      return;
    }
    var ctx = RW.criarConta.contexto();
    RW.iniciarCarregando(botao);
    rpc('acesso_link_criar_conta', {
      p_codigo: ctx.codigo,
      p_cpf: ctx.cpf,
      p_email: valor('cc-email').toLowerCase(),
      p_celular: V.soDigitos(valor('cc-celular')),
      p_senha: el('cc-senha').value,
      p_termos_ciente: true
    })
      .then(function (r) {
        RW.pararCarregando(botao);
        if (r && r.success) {
          /* a conta nasceu: o formulário deixa de ter alterações a proteger,
             senão o guarda de saída barra a ida ao login */
          if (RW.criarConta && RW.criarConta.marcarEnviado) RW.criarConta.marcarEnviado();
          RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.criarConta.contaCriada, aoConfirmar: irParaLogin });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.criarConta.falha });
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* ---------- ciência dos termos ----------
     a caixinha marca e desmarca (também pelo texto); "Ler os termos" abre a página
     em outra aba, para o formulário preenchido não se perder */
  function ligarTermos() {
    var caixa = el('cc-termos');
    function alternar() {
      var marcada = caixa.getAttribute('aria-checked') !== 'true';
      caixa.setAttribute('aria-checked', marcada ? 'true' : 'false');
      caixa.classList.toggle('caixa-selecao--marcada', marcada);
      if (marcada) C.limparErro(caixa);
    }
    caixa.addEventListener('click', alternar);
    el('cc-termos-rotulo').addEventListener('click', alternar);
    el('cc-termos-ler').addEventListener('click', function () { window.open('termos.html', '_blank', 'noopener'); });
  }

  function ligar(fnRpc) {
    rpc = fnRpc;
    ligarValidacoes();
    ligarTermos();
    var botao = el('cc-enviar');
    if (botao) botao.addEventListener('click', enviar);
  }

  RW.criarContaEnvio = { ligar: ligar };
})();
