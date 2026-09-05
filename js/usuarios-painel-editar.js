/* ============================================================
   USUÁRIOS — edição dos dados da ficha (modo Editar)
   Só admin. Monta os campos editáveis de UMA seção por vez:
   'pessoais' (aba Dados) ou 'institucionais' (aba Carreira),
   reaproveitando máscaras/dropdowns/calendário/validações do Novo
   usuário (RosterWork.campos / RosterWork.validacoes). CPF é só
   leitura; grau e lotação não entram aqui (mudam por evento —
   promoção / transferência). Salva pela RPC atualizar_dados_militar
   (o payload sempre vai completo: o que não está na aba vem da
   própria ficha). Orquestração no usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;     // { ficha, pessoa, aoSalvar, aoVoltar, btnSalvar, secao }
  var sujo = false;   // há alteração não salva?

  var PESSOAIS = [
    { k: 'nome_completo', rotulo: 'Nome completo', tipo: 'nome', max: 100, ph: 'Ex.: João Carlos Andrade' },
    { k: 'rg', rotulo: 'RG', tipo: 'rg', max: 13, num: true, ph: '00.000.000-0' },
    { k: 'data_de_nascimento', rotulo: 'Nascimento', tipo: 'data', max: 10, num: true, ph: 'dd/mm/aaaa', cal: true },
    { k: 'cnh', rotulo: 'CNH', tipo: 'selecao', opcoes: ['Nenhuma', 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] },
    { k: 'celular', rotulo: 'Celular', tipo: 'celular', max: 15, num: true, ph: '(00) 00000-0000' },
    { k: 'email', rotulo: 'Email', tipo: 'texto', max: 80, ph: 'nome@exemplo.com' }
  ];
  var INST = [
    { k: 'nome_de_guerra', rotulo: 'Nome de guerra', tipo: 'texto', max: 40, ph: 'Ex.: Andrade' },
    { k: 'tipo', rotulo: 'Setor', tipo: 'selecao', opcoes: ['Operacional', 'Administrativo'] },
    { k: 'data_de_inclusao', rotulo: 'Inclusão', tipo: 'data', max: 10, num: true, ph: 'dd/mm/aaaa', cal: true },
    { k: 'classificacao', rotulo: 'Colocação', tipo: 'numero', max: 4, num: true, ph: 'Ex.: 14' }
  ];

  function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  function isoParaBR(iso) { return RosterWork.data.isoParaBR(iso); }
  function formatarCpf(cpf) {
    var n = soDigitos(cpf);
    if (n.length !== 11) return cpf || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function marcarSujo() {
    sujo = true;
    if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = false;
  }

  function valorInicial(c, dados) {
    var v = dados ? dados[c.k] : null;
    if (v == null || v === '') return '';
    var C = RosterWork.campos;
    if (c.tipo === 'data') return isoParaBR(v);
    if (c.tipo === 'rg') return C.mascararRg(soDigitos(v));
    if (c.tipo === 'celular') return C.mascararCelular(soDigitos(v));
    if (c.tipo === 'numero') { var n = parseInt(soDigitos(v), 10); return isNaN(n) ? '' : String(n); }
    return String(v);
  }

  function montarCampo(c, valor) {
    var C = RosterWork.campos;
    if (c.tipo === 'selecao') {
      var campoS = RosterWork.tpl('tpl-ficha-campo-selecao');
      if (!campoS) return null;
      campoS.querySelector('.campo-rotulo').textContent = c.rotulo;
      var gatilho = campoS.querySelector('.campo-selecao');
      gatilho.setAttribute('data-campo', c.k);
      var texto = gatilho.querySelector('.campo-selecao-texto');
      if (valor) { texto.textContent = valor; gatilho.setAttribute('data-valor', valor); }
      else { texto.textContent = 'Selecione'; texto.classList.add('campo-selecao-texto--vazio'); }
      var menu = campoS.querySelector('.dropdown-menu');
      C.popularOpcoes(menu, c.opcoes.map(function (o) { return { rotulo: o, valor: o }; }));
      C.ligarSelecao(gatilho, marcarSujo);
      return campoS;
    }

    var campo = RosterWork.tpl('tpl-ficha-campo');
    if (!campo) return null;
    campo.querySelector('.campo-rotulo').textContent = c.rotulo;
    var input = campo.querySelector('.campo-entrada');
    input.setAttribute('data-campo', c.k);
    input.value = valor || '';
    if (c.max) input.maxLength = c.max;
    if (c.ph) input.placeholder = c.ph;
    if (c.num) input.setAttribute('inputmode', 'numeric');

    if (c.tipo === 'nome') C.ligarNome(input);
    else if (c.tipo === 'rg') C.ligarMascara(input, C.mascararRg);
    else if (c.tipo === 'celular') C.ligarMascara(input, C.mascararCelular);
    else if (c.tipo === 'data') { C.ligarMascara(input, C.mascararData); if (c.cal) C.ligarCalendario(input); }
    else if (c.tipo === 'numero') input.addEventListener('input', function () { input.value = soDigitos(input.value); });
    input.addEventListener('input', marcarSujo);
    return campo;
  }

  function marcar(el, msg) {
    var campo = el ? el.closest('.campo') : null;
    if (!campo) return;
    campo.classList.add('campo--erro');
    var alvo = campo.querySelector('.campo-erro-texto');
    if (alvo) alvo.textContent = msg;
  }
  function limparErros(raiz) {
    var campos = raiz.querySelectorAll('.campo--erro');
    for (var i = 0; i < campos.length; i++) {
      campos[i].classList.remove('campo--erro');
      var alvo = campos[i].querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    }
  }
  function campoEl(raiz, k) { return raiz.querySelector('[data-campo="' + k + '"]'); }
  function valorSelecao(raiz, k) { var el = campoEl(raiz, k); return el ? el.getAttribute('data-valor') : null; }

  /* valida só os campos da seção montada (reusa as validações do cadastro) */
  function validar(raiz) {
    limparErros(raiz);
    var V = RosterWork.validacoes, T = RosterWork.mensagens.cadastro, ok = true;
    function erro(el, msg) { if (el) { marcar(el, msg); ok = false; } }

    if (ctx.secao === 'pessoais') {
      var nome = campoEl(raiz, 'nome_completo');
      if (!nome.value.trim()) erro(nome, T.nomeVazio);
      else if (nome.value.trim().split(/\s+/).length < 2) erro(nome, T.nomeIncompleto);

      var rg = campoEl(raiz, 'rg');
      if (!rg.value.trim()) erro(rg, T.rgVazio);
      else if (!V.validarRg(rg.value)) erro(rg, T.rgInvalido);

      var nascEl = campoEl(raiz, 'data_de_nascimento');
      var nasc = V.parseData(nascEl.value);
      if (!nascEl.value.trim()) erro(nascEl, T.nascimentoVazio);
      else if (!nasc) erro(nascEl, T.dataInvalida);
      else if (V.idadeEm(nasc) < 18) erro(nascEl, T.idadeMinima);

      if (!valorSelecao(raiz, 'cnh')) erro(campoEl(raiz, 'cnh'), T.cnhVazia);

      var cel = campoEl(raiz, 'celular');
      if (!cel.value.trim()) erro(cel, T.celularVazio);
      else if (V.soDigitos(cel.value).length !== 11) erro(cel, T.celularInvalido);

      var email = campoEl(raiz, 'email');
      if (!email.value.trim()) erro(email, T.emailVazio);
      else if (!V.validarEmail(email.value)) erro(email, T.emailInvalido);
    } else {
      var guerra = campoEl(raiz, 'nome_de_guerra');
      if (!guerra.value.trim()) erro(guerra, T.guerraVazio);

      if (!valorSelecao(raiz, 'tipo')) erro(campoEl(raiz, 'tipo'), T.setorVazio);

      var inclEl = campoEl(raiz, 'data_de_inclusao');
      var incl = V.parseData(inclEl.value);
      var nascIso = (ctx.ficha.pessoais || {}).data_de_nascimento;
      var nascD = nascIso ? V.parseData(isoParaBR(nascIso)) : null;
      if (!inclEl.value.trim()) erro(inclEl, T.inclusaoVazia);
      else if (!incl) erro(inclEl, T.dataInvalida);
      else if (nascD && incl <= nascD) erro(inclEl, T.inclusaoAposNascimento);

      var coloc = campoEl(raiz, 'classificacao');
      if (!coloc.value.trim()) erro(coloc, T.colocacaoVazia);
    }
    return ok;
  }

  /* payload completo: os campos da seção vêm dos inputs; o resto, da ficha */
  function coletar(raiz) {
    var V = RosterWork.validacoes;
    var p = ctx.ficha.pessoais || {}, ins = ctx.ficha.institucionais || {};
    function txt(k) { var el = campoEl(raiz, k); return el ? el.value.trim() : ''; }

    if (ctx.secao === 'pessoais') {
      return {
        p_admin_cpf: RosterWork.sessao.cpf(), p_cpf: ctx.pessoa.usuario_id,
        p_nome_completo: txt('nome_completo'),
        p_rg: V.soDigitos(txt('rg')),
        p_data_nascimento: V.paraISO(txt('data_de_nascimento')),
        p_cnh: valorSelecao(raiz, 'cnh'),
        p_celular: V.soDigitos(txt('celular')),
        p_email: txt('email'),
        p_nome_de_guerra: ins.nome_de_guerra,
        p_tipo: ins.tipo,
        p_data_de_inclusao: ins.data_de_inclusao,
        p_classificacao: ins.classificacao
      };
    }
    return {
      p_admin_cpf: RosterWork.sessao.cpf(), p_cpf: ctx.pessoa.usuario_id,
      p_nome_completo: p.nome_completo,
      p_rg: V.soDigitos(p.rg),
      p_data_nascimento: p.data_de_nascimento,
      p_cnh: p.cnh,
      p_celular: V.soDigitos(p.celular),
      p_email: p.email,
      p_nome_de_guerra: txt('nome_de_guerra'),
      p_tipo: valorSelecao(raiz, 'tipo'),
      p_data_de_inclusao: V.paraISO(txt('data_de_inclusao')),
      p_classificacao: txt('classificacao')
    };
  }

  function salvar() {
    var raiz = RosterWork.painel.corpo();
    if (!raiz || !ctx) return;
    if (!validar(raiz)) {
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.camposCorrigir });
      return;
    }
    var corpo = coletar(raiz);
    /* a CNH alimenta o motor (condutor): se ela mudou, pede a data (modal padrão) antes de gravar,
       para o banco recalcular a distribuição da unidade a partir dela — igual às outras telas */
    var cnhAntes = (ctx.ficha && ctx.ficha.pessoais && ctx.ficha.pessoais.cnh) || '';
    if (ctx.secao === 'pessoais'
        && String(corpo.p_cnh || '').toUpperCase() !== String(cnhAntes).toUpperCase()
        && RosterWork.pedirData) {
      RosterWork.pedirData({
        mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
        textoConfirmar: RosterWork.mensagens.botoes.salvar,
        aoConfirmar: function (iso) { corpo.p_recalcular_desde = iso; enviar(corpo); }
      });
      return;
    }
    enviar(corpo);
  }

  function enviar(corpo) {
    /* CNH mudou (p_recalcular_desde) = recalcula a escala: círculo + tela travada;
       demais edições são rápidas: pontos no botão */
    var recalcula = !!corpo.p_recalcular_desde;
    var btn = ctx.btnSalvar;
    function iniciar() { if (recalcula) { if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal(); } else if (btn && RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(btn); }
    function parar() { if (recalcula) { if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal(); } else if (btn && RosterWork.pararCarregando) RosterWork.pararCarregando(btn); }
    iniciar();
    RosterWork.apiFetch('/rest/v1/rpc/atualizar_dados_militar', { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        parar();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          sujo = false;
          if (ctx && ctx.aoSalvar) ctx.aoSalvar();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaSalvar });
        }
      })
      .catch(function () {
        parar();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  function cancelar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { sujo = false; if (ctx && ctx.aoVoltar) ctx.aoVoltar(); }
      });
    } else if (ctx && ctx.aoVoltar) {
      ctx.aoVoltar();
    }
  }

  function montarRodape() {
    var rodape = RosterWork.painel.rodape();
    var tpl = document.getElementById('tpl-ficha-editar-acoes');
    if (!rodape || !tpl) return;
    rodape.textContent = '';
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var btnCancelar = rodape.querySelector('.ficha-editar-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', cancelar);
    ctx.btnSalvar = rodape.querySelector('.ficha-editar-salvar');
    if (ctx.btnSalvar) { ctx.btnSalvar.disabled = true; ctx.btnSalvar.addEventListener('click', salvar); }
  }

  /* monta os campos de UMA seção + o rodapé. secao = 'pessoais' | 'institucionais'.
     Não limpa o corpo (o orquestrador já fez e pode anexar ações depois). */
  function montar(corpo, ficha, pessoa, opcoes, secao) {
    if (!corpo || !ficha) return;
    secao = (secao === 'institucionais') ? 'institucionais' : 'pessoais';
    ctx = { ficha: ficha, pessoa: pessoa, aoSalvar: opcoes && opcoes.aoSalvar, aoVoltar: opcoes && opcoes.aoVoltar, btnSalvar: null, secao: secao };
    sujo = false;

    if (secao === 'pessoais') {
      var p = ficha.pessoais || {};
      var secP = RosterWork.painel.criarSecaoColapsavel('Dados pessoais', { aberta: true });
      if (secP) {
        var alvoP = secP.querySelector('.painel-secao-corpo');
        alvoP.appendChild(RosterWork.painel.criarLinha('CPF', formatarCpf(p.cpf)));
        PESSOAIS.forEach(function (c) { var el = montarCampo(c, valorInicial(c, p)); if (el) alvoP.appendChild(el); });
        corpo.appendChild(secP);
      }
    } else {
      var ins = ficha.institucionais || {};
      var secI = RosterWork.painel.criarSecaoColapsavel('Dados institucionais', { aberta: true });
      if (secI) {
        var alvoI = secI.querySelector('.painel-secao-corpo');
        INST.forEach(function (c) { var el = montarCampo(c, valorInicial(c, ins)); if (el) alvoI.appendChild(el); });
        corpo.appendChild(secI);
      }
    }
    montarRodape();
  }

  function reset() {
    ctx = null;
    sujo = false;
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujo; });
  }

  window.RosterWork.usuariosPainelEditar = { montar: montar, reset: reset, sujo: function () { return sujo; } };
})();
