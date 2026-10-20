/* ============================================================
   NOVO USUÁRIO — validação e envio
   Valida o formulário (marca os campos com erro + mensagem) e, na
   etapa de salvar, coleta os dados e chama a RPC. Lê tudo do DOM
   (recebe a raiz da página); é independente do JS de campos.
   Exposto em RosterWork.novoUsuarioEnvio.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* validações e marcação de erro vivem em componentes/js/geral-campos.js */
  var V = RosterWork.validacoes, C = RosterWork.campos;
  var soDigitos = V.soDigitos, validarCpf = V.validarCpf, validarEmail = V.validarEmail, rgValido = V.validarRg;
  var parseData = V.parseData, paraISO = V.paraISO, idadeEm = V.idadeEm;
  var marcar = C.marcarErro, limparErros = C.limparErros;

  /* valida o formulário; marca os erros e retorna true se tudo estiver ok */
  function validar(raiz) {
    limparErros(raiz);
    var ok = true;
    function erro(el, msg) { marcar(el, msg); ok = false; }
    function campo(id) { return raiz.querySelector('#' + id); }
    function selecao(id) { var g = campo(id); return g ? g.getAttribute('data-valor') : null; }
    var textos = window.RosterWork.mensagens.cadastro;

    var nome = campo('nu-nome-completo');
    if (!nome.value.trim()) erro(nome, textos.nomeVazio);
    else if (nome.value.trim().split(/\s+/).length < 2) erro(nome, textos.nomeIncompleto);

    var cpf = campo('nu-cpf');
    if (!cpf.value.trim()) erro(cpf, textos.cpfVazio);
    else if (!validarCpf(cpf.value)) erro(cpf, textos.cpfInvalido);

    var rg = campo('nu-rg');
    if (!rg.value.trim()) erro(rg, textos.rgVazio);
    else if (!rgValido(rg.value, cpf.value)) erro(rg, soDigitos(rg.value).length === 11 ? textos.rgDiferenteCpf : textos.rgInvalido);

    var nascEl = campo('nu-nascimento');
    var nasc = parseData(nascEl.value);
    if (!nascEl.value.trim()) erro(nascEl, textos.nascimentoVazio);
    else if (!nasc) erro(nascEl, textos.dataInvalida);
    else if (idadeEm(nasc) < 18) erro(nascEl, textos.idadeMinima);

    if (!selecao('nu-cnh')) erro(campo('nu-cnh'), textos.cnhVazia);

    /* celular e e-mail são OPCIONAIS no cadastro do admin: são dados da própria
       pessoa, que os informa ao criar a conta pelo link de cadastro.
       Se vierem preenchidos, confere o formato. */
    var cel = campo('nu-celular');
    if (cel.value.trim() && soDigitos(cel.value).length !== 11) erro(cel, textos.celularInvalido);

    var email = campo('nu-email');
    if (email.value.trim() && !validarEmail(email.value)) erro(email, textos.emailInvalido);

    if (!selecao('nu-tipo')) erro(campo('nu-tipo'), textos.tipoVazio);
    if (!selecao('nu-posto')) erro(campo('nu-posto'), textos.postoVazio);

    var guerra = campo('nu-nome-guerra');
    if (!guerra.value.trim()) erro(guerra, textos.guerraVazio);

    var inclEl = campo('nu-inclusao');
    var incl = parseData(inclEl.value);
    if (!inclEl.value.trim()) erro(inclEl, textos.inclusaoVazia);
    else if (!incl) erro(inclEl, textos.dataInvalida);
    else if (nasc && incl <= nasc) erro(inclEl, textos.inclusaoAposNascimento);

    /* a colocação é opcional para o administrador (em branco, o banco grava "0000"); o militar a informa ao entrar */

    if (!selecao('nu-lotacao')) erro(campo('nu-lotacao'), textos.lotacaoVazia);
    if (!selecao('nu-setor')) erro(campo('nu-setor'), textos.setorVazio);

    /* datas de promoção (opcionais), na ordem da carreira: as de praça vêm antes das de oficial */
    if (!C.conferirPromocoes(camposDeData(raiz), incl, inclEl)) ok = false;

    return ok;
  }

  /* os campos de data de promoção, do posto mais baixo ao mais alto (os de praça primeiro) */
  function camposDeData(raiz) {
    var praca = Array.prototype.slice.call(raiz.querySelectorAll('#nu-promocoes-praca input'));
    return praca.concat(Array.prototype.slice.call(raiz.querySelectorAll('#nu-promocoes input')));
  }

  /* limpa o erro de um campo assim que o usuário volta a editá-lo.
     Recebe os nós clonados do formulário (descartados ao fechar), não o corpo
     do painel — que é singleton compartilhado com a ficha */
  function ligarLimpeza(nos) {
    function limpar(evento) {
      var campo = evento.target.closest('.campo');
      if (!campo || !campo.classList.contains('campo--erro')) return;
      campo.classList.remove('campo--erro');
      var alvo = campo.querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    }
    (nos || []).forEach(function (no) {
      no.addEventListener('input', limpar);
      no.addEventListener('click', limpar);
    });
  }

  /* ---------- coleta e envio ---------- */

  /* monta o payload da RPC inserir_usuario_admin a partir do DOM */
  function coletar(raiz) {
    function val(id) { var el = raiz.querySelector('#' + id); return el ? el.value.trim() : ''; }
    function selecao(id) { var el = raiz.querySelector('#' + id); return el ? el.getAttribute('data-valor') : null; }
    /* cada data com o posto dela; a vazia não vai */
    var datas = [];
    camposDeData(raiz).forEach(function (input) {
      var iso = paraISO(input.value);
      if (iso) datas.push({ grau_id: parseInt(input.getAttribute('data-grau'), 10), data: iso });
    });
    return {
      p_cpf: soDigitos(val('nu-cpf')),
      p_nome_completo: val('nu-nome-completo'),
      p_rg: soDigitos(val('nu-rg')),
      p_data_nascimento: paraISO(val('nu-nascimento')),
      p_cnh: selecao('nu-cnh'),
      p_celular: soDigitos(val('nu-celular')),
      p_email: val('nu-email'),
      p_grau_hierarquico: parseInt(selecao('nu-posto'), 10),
      p_nome_de_guerra: val('nu-nome-guerra'),
      p_data_de_inclusao: paraISO(val('nu-inclusao')),
      p_classificacao: val('nu-colocacao'),
      p_lotacao_atual: parseInt(selecao('nu-lotacao'), 10),
      p_tipo: selecao('nu-setor'),
      p_datas: datas
    };
  }

  /* valida e, se ok, envia ao banco; mostra os avisos. aoSucesso roda no OK do sucesso */
  function enviar(raiz, aoSucesso) {
    if (!validar(raiz)) {
      if (window.RosterWork.avisar) {
        window.RosterWork.avisar({ tipo: 'erro', mensagem: window.RosterWork.mensagens.geral.camposCorrigir });
      }
      return;
    }
    if (!window.RosterWork.novoUsuarioDados) return;

    var botao = raiz.querySelector('#nu-salvar');
    if (botao && window.RosterWork.iniciarCarregando) window.RosterWork.iniciarCarregando(botao);

    window.RosterWork.novoUsuarioDados.inserir(coletar(raiz)).then(function (resp) {
      if (botao && window.RosterWork.pararCarregando) window.RosterWork.pararCarregando(botao);
      if (resp && resp.success) {
        if (aoSucesso) aoSucesso();   // limpa o formulário e recarrega a árvore
        if (resp.log && window.RosterWork.resumo) window.RosterWork.resumo.abrirModal(resp.log, { pagina: 'Usuários' });
      } else {
        window.RosterWork.avisar({ tipo: 'erro', mensagem: (resp && resp.error) ? resp.error : window.RosterWork.mensagens.cadastro.falha });
      }
    }).catch(function () {
      if (botao && window.RosterWork.pararCarregando) window.RosterWork.pararCarregando(botao);
      window.RosterWork.avisar({ tipo: 'erro', mensagem: window.RosterWork.mensagens.geral.semConexao });
    });
  }

  window.RosterWork.novoUsuarioEnvio = {
    validar: validar,
    ligarLimpeza: ligarLimpeza,
    enviar: enviar
  };
})();
