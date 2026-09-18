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

  /* ---------- o envio: cobra tudo de novo ----------
     valida os campos comuns aos dois caminhos e devolve se está tudo certo */
  function validarCampos() {
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

    return ok;
  }

  /* as promoções: uma data por posto já percorrido, em ordem (só o cadastro novo as envia) */
  function coletarPromocoes() {
    var promocoes = [], ok = true;
    var campos = el('cc-promocoes').querySelectorAll('.campo-entrada');
    var anterior = null;
    for (var i = 0; i < campos.length; i++) {
      var d = V.parseData(campos[i].value);
      if (!campos[i].value.trim()) { C.marcarErro(campos[i], T().promocaoVazia); ok = false; continue; }
      if (!d) { C.marcarErro(campos[i], T().dataInvalida); ok = false; continue; }
      if (anterior && d <= anterior) { C.marcarErro(campos[i], T().promocaoOrdem); ok = false; continue; }
      anterior = d;
      promocoes.push(V.paraISO(campos[i].value));
    }
    return { ok: ok, promocoes: promocoes };
  }

  /* deixa a colocação no mesmo formato guardado (4 dígitos, zeros à esquerda),
     senão o banco lê como alteração e pede aprovação à toa */
  function colocacaoNormalizada() {
    var v = valor('cc-colocacao');
    if (!v) return '';
    return v.length >= 4 ? v : ('0000' + v).slice(-4);
  }

  /* resgate por token: os campos que a pessoa pode ter conferido/alterado.
     O banco compara com o valor atual e só manda para aprovação o que mudou;
     e-mail, celular e senha vão fora daqui, valem na hora. */
  function montarCorrecoes() {
    return [
      { campo: 'nome_completo', valor: valor('cc-nome-completo') },
      { campo: 'rg', valor: V.soDigitos(valor('cc-rg')) },
      { campo: 'data_de_nascimento', valor: V.paraISO(valor('cc-nascimento')) },
      { campo: 'cnh', valor: selecao('cc-cnh') },
      { campo: 'nome_de_guerra', valor: valor('cc-nome-guerra') },
      { campo: 'tipo', valor: selecao('cc-setor') },
      { campo: 'data_de_inclusao', valor: V.paraISO(valor('cc-inclusao')) },
      { campo: 'classificacao_cfo_cfp', valor: colocacaoNormalizada() }
    ];
  }

  function irParaLogin() { window.location.href = 'login.html'; }

  /* resgate por token: cria a conta na hora (convite_resgatar_criar) */
  function enviarToken(botao) {
    var ctx = RW.criarConta.contextoToken();
    RW.iniciarCarregando(botao);
    rpc('convite_resgatar_criar', {
      p_cpf: ctx.cpf,
      p_token: ctx.token,
      p_email: valor('cc-email').toLowerCase(),
      p_celular: V.soDigitos(valor('cc-celular')),
      p_senha: el('cc-senha').value,
      p_correcoes: montarCorrecoes()
    })
      .then(function (r) {
        RW.pararCarregando(botao);
        if (r && r.success) {
          if (RW.criarConta && RW.criarConta.marcarEnviado) RW.criarConta.marcarEnviado();
          var msg = (r.correcoes_pendentes > 0)
            ? RW.mensagens.criarConta.contaCriadaComCorrecoes
            : RW.mensagens.criarConta.contaCriada;
          RW.avisar({ tipo: 'sucesso', mensagem: msg, aoConfirmar: irParaLogin });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.criarConta.resgateFalha });
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* cadastro novo: vira um pedido para o admin aprovar (cadastro_solicitar) */
  function enviarNovo(botao, promocoes) {
    RW.iniciarCarregando(botao);
    rpc('cadastro_solicitar', {
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
    })
      .then(function (r) {
        RW.pararCarregando(botao);
        if (r && r.success) {
          /* o pedido foi: o formulário deixa de ter alterações a proteger,
             senão o guarda de saída barra a ida ao login */
          if (RW.criarConta && RW.criarConta.marcarEnviado) RW.criarConta.marcarEnviado();
          RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.criarConta.enviado, aoConfirmar: irParaLogin });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.criarConta.falha });
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function enviar() {
    var botao = el('cc-enviar');
    var modo = (RW.criarConta && RW.criarConta.modo) ? RW.criarConta.modo() : 'novo';

    var camposOk = validarCampos();
    /* só o cadastro novo digita as promoções; no token elas ficam travadas na conferência */
    var promo = (modo === 'novo') ? coletarPromocoes() : { ok: true, promocoes: [] };
    if (!camposOk || !promo.ok) {
      mostrarPrimeiroErro();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir });
      return;
    }

    if (modo === 'token') enviarToken(botao);
    else enviarNovo(botao, promo.promocoes);
  }

  function ligar(fnRpc) {
    rpc = fnRpc;
    ligarValidacoes();
    var botao = el('cc-enviar');
    if (botao) botao.addEventListener('click', enviar);
  }

  RW.criarContaEnvio = { ligar: ligar };
})();
