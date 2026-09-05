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
  function selecao(id) { return el(id).getAttribute('data-valor') || ''; }
  function T() { return RW.mensagens.cadastro; }

  /* a data de nascimento é referência para a inclusão */
  function nascimento() { return V.parseData(valor('cc-nascimento')); }

  /* ---------- as regras ----------
     `vazio`   — mensagem quando o campo é obrigatório e está em branco (só no envio)
     `formato` — confere o que foi digitado; roda também ao sair do campo */
  var REGRAS = {
    'cc-nome-completo': {
      vazio: function () { return T().nomeVazio; },
      formato: function (v) { return v.split(/\s+/).length < 2 ? T().nomeIncompleto : null; }
    },
    'cc-cpf': {
      vazio: function () { return T().cpfVazio; },
      formato: function (v) { return V.validarCpf(v) ? null : T().cpfInvalido; }
    },
    'cc-rg': {
      vazio: function () { return T().rgVazio; },
      formato: function (v) { return V.validarRg(v) ? null : T().rgInvalido; }
    },
    'cc-nascimento': {
      vazio: function () { return T().nascimentoVazio; },
      formato: function (v) {
        var d = V.parseData(v);
        if (!d) return T().dataInvalida;
        return V.idadeEm(d) < 18 ? T().idadeMinima : null;
      }
    },
    'cc-celular': {
      vazio: function () { return T().celularVazio; },
      formato: function (v) { return V.soDigitos(v).length !== 11 ? T().celularInvalido : null; }
    },
    'cc-email': {
      vazio: function () { return T().emailVazio; },
      formato: function (v) { return V.validarEmail(v) ? null : T().emailInvalido; }
    },
    'cc-nome-guerra': {
      vazio: function () { return T().guerraVazio; }
    },
    'cc-inclusao': {
      vazio: function () { return T().inclusaoVazia; },
      formato: function (v) {
        var d = V.parseData(v);
        if (!d) return T().dataInvalida;
        var nasc = nascimento();
        return (nasc && d <= nasc) ? T().inclusaoAposNascimento : null;
      }
    },
    'cc-colocacao': {
      vazio: function () { return T().colocacaoVazia; }
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

  /* os de escolha: não têm o que conferir de formato, só se foram escolhidos */
  var ESCOLHAS = {
    'cc-cnh': function () { return T().cnhVazia; },
    'cc-tipo': function () { return T().tipoVazio; },
    'cc-posto': function () { return T().postoVazio; },
    'cc-setor': function () { return T().setorVazio; },
    'cc-lotacao': function () { return T().lotacaoVazia; }
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

  /* ---------- o envio: cobra tudo de novo ---------- */
  function montarPedido() {
    C.limparErros(el('cc-corpo'));
    var ok = true;
    function erro(elemento, msg) { C.marcarErro(elemento, msg); ok = false; }

    Object.keys(REGRAS).forEach(function (id) {
      var regra = REGRAS[id];
      var v = valor(id);
      if (!v) { erro(el(id), regra.vazio()); return; }
      if (regra.formato) {
        var msg = regra.formato(v);
        if (msg) erro(el(id), msg);
      }
    });

    Object.keys(ESCOLHAS).forEach(function (id) {
      if (!selecao(id)) erro(el(id), ESCOLHAS[id]());
    });

    /* as promoções: uma data por posto já percorrido, em ordem */
    var promocoes = [];
    var campos = el('cc-promocoes').querySelectorAll('.campo-entrada');
    var anterior = null;
    for (var i = 0; i < campos.length; i++) {
      var d = V.parseData(campos[i].value);
      if (!campos[i].value.trim()) { erro(campos[i], T().promocaoVazia); continue; }
      if (!d) { erro(campos[i], T().dataInvalida); continue; }
      if (anterior && d <= anterior) { erro(campos[i], T().promocaoOrdem); continue; }
      anterior = d;
      promocoes.push(V.paraISO(campos[i].value));
    }

    if (!ok) return null;

    return {
      p_cpf: V.soDigitos(valor('cc-cpf')),
      p_nome_completo: valor('cc-nome-completo'),
      p_rg: V.soDigitos(valor('cc-rg')),
      p_data_nascimento: V.paraISO(valor('cc-nascimento')),
      p_cnh: selecao('cc-cnh'),
      p_celular: V.soDigitos(valor('cc-celular')),
      p_email: valor('cc-email').toLowerCase(),
      p_grau_hierarquico: parseInt(selecao('cc-posto'), 10),
      p_nome_de_guerra: valor('cc-nome-guerra'),
      p_data_de_inclusao: V.paraISO(valor('cc-inclusao')),
      p_classificacao: valor('cc-colocacao'),
      p_lotacao_atual: parseInt(selecao('cc-lotacao'), 10),
      p_tipo: selecao('cc-setor'),
      p_promocoes: promocoes,
      p_senha: el('cc-senha').value
    };
  }

  function enviar() {
    var botao = el('cc-enviar');
    var pedido = montarPedido();
    if (!pedido) {
      mostrarPrimeiroErro();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir });
      return;
    }
    RW.iniciarCarregando(botao);
    rpc('cadastro_solicitar', pedido)
      .then(function (r) {
        RW.pararCarregando(botao);
        if (r && r.success) {
          /* o pedido foi: o formulário deixa de ter alterações a proteger,
             senão o guarda de saída barra a ida ao login */
          if (RW.criarConta && RW.criarConta.marcarEnviado) RW.criarConta.marcarEnviado();
          RW.avisar({
            tipo: 'sucesso',
            mensagem: RW.mensagens.criarConta.enviado,
            aoConfirmar: function () { window.location.href = 'login.html'; }
          });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.criarConta.falha });
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function ligar(fnRpc) {
    rpc = fnRpc;
    ligarValidacoes();
    var botao = el('cc-enviar');
    if (botao) botao.addEventListener('click', enviar);
  }

  RW.criarContaEnvio = { ligar: ligar };
})();
