/* ============================================================
   USUÁRIOS — correção dos dados da ficha (sub-telas, só admin)
   Corrigir dados pessoais (aba Dados) e Corrigir dados
   institucionais (aba Carreira): um bloco com os campos de UMA
   seção, reaproveitando máscaras, dropdowns, calendário e
   validações do Novo usuário (RosterWork.campos / validacoes). CPF
   só leitura; grau e lotação não entram aqui (mudam por evento:
   promoção e transferência). O campo mudado ganha a canaleta e o
   rodapé conta as alterações. Salva pela RPC atualizar_dados_militar
   (o payload vai completo: o que não está na sub-tela vem da ficha).
   Orquestração no usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, secao, raiz, ctl, campos: [{ c, el, inicial }] }

  var PESSOAIS = [
    { k: 'nome_completo', rotulo: 'Nome completo', tipo: 'nome', max: 100, ph: 'Ex.: João Carlos Andrade' },
    { k: 'rg', rotulo: 'RG', tipo: 'rg', max: 14, num: true, ph: '00.000.000-0' },
    { k: 'data_de_nascimento', rotulo: 'Nascimento', tipo: 'data', max: 10, num: true, ph: 'dd/mm/aaaa', cal: true },
    { k: 'cnh', rotulo: 'CNH', tipo: 'selecao', opcoes: ['Nenhuma', 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] },
    { k: 'celular', rotulo: 'Celular (opcional)', tipo: 'celular', max: 15, num: true, ph: '(00) 00000-0000' },
    /* quem tem conta é identificado pelo e-mail: só é opcional para quem ainda não tem */
    { k: 'email', rotulo: 'E-mail', rotuloSemConta: 'E-mail (opcional)', tipo: 'texto', max: 80, ph: 'nome@exemplo.com' }
  ];
  var INST = [
    { k: 'data_de_inclusao', rotulo: 'Data de inclusão', tipo: 'data', max: 10, num: true, ph: 'dd/mm/aaaa', cal: true, ajuda: true },
    { k: 'nome_de_guerra', rotulo: 'Nome de guerra', tipo: 'texto', max: 40, ph: 'Ex.: Andrade' },
    { k: 'tipo', rotulo: 'Setor', tipo: 'selecao', opcoes: ['Operacional', 'Administrativo', 'Aluno'] },
    { k: 'classificacao', rotulo: 'Colocação', rotuloPorQuadro: true, tipo: 'numero', max: 4, num: true, ph: 'Ex.: 14' }
  ];

  function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  function isoParaBR(iso) { return RosterWork.data.isoParaBR(iso); }
  function formatarCpf(cpf) {
    var n = soDigitos(cpf);
    if (n.length !== 11) return cpf || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function valorInicial(c, dados) {
    var v = dados ? dados[c.k] : null;
    if (v == null || v === '') return '';
    var C = RosterWork.campos;
    if (c.tipo === 'data') return isoParaBR(v);
    if (c.tipo === 'rg') return C.mascararRg(soDigitos(v));
    if (c.tipo === 'celular') return C.mascararCelular(soDigitos(v));
    /* colocação: "0000" = sem colocação, o campo abre vazio */
    if (c.tipo === 'numero') { var n = parseInt(soDigitos(v), 10); return (isNaN(n) || n === 0) ? '' : String(n); }
    return String(v);
  }

  /* o valor de agora de um campo (texto digitado ou opção escolhida) */
  function valorAtual(item) {
    return item.c.tipo === 'selecao' ? (item.el.getAttribute('data-valor') || '') : item.el.value.trim();
  }

  /* quantos campos mudaram; o campo mudado ganha a canaleta */
  function mudancas() {
    if (!ctx) return 0;
    var n = 0;
    ctx.campos.forEach(function (item) {
      var mudou = valorAtual(item) !== item.inicial;
      item.el.closest('.campo').classList.toggle('ficha-campo--alterado', mudou);
      if (mudou) n++;
    });
    return n;
  }

  function aoMudar() { if (ctx && ctx.ctl) ctx.ctl.aoMudar(); }

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
      C.ligarSelecao(gatilho, aoMudar);
      return { no: campoS, el: gatilho };
    }

    var campo = RosterWork.tpl('tpl-ficha-campo');
    if (!campo) return null;
    /* a colocação diz o curso (CFO, CHOE ou CFP), pelo quadro do militar */
    var semConta = !!(ctx && ctx.ficha && ctx.ficha.tem_conta === false);
    campo.querySelector('.campo-rotulo').textContent = (c.rotuloPorQuadro && ctx && ctx.ficha)
      ? C.nomeColocacao((ctx.ficha.institucionais || {}).quadro)
      : ((c.rotuloSemConta && semConta) ? c.rotuloSemConta : c.rotulo);
    if (c.ajuda) { var ajuda = campo.querySelector('[data-ajuda]'); if (ajuda) ajuda.classList.remove('oculto'); }
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
    input.addEventListener('input', function () { C.limparErro(input); aoMudar(); });
    return { no: campo, el: input };
  }

  function campoEl(raiz, k) { return raiz.querySelector('[data-campo="' + k + '"]'); }
  function valorSelecao(raiz, k) { var el = campoEl(raiz, k); return el ? el.getAttribute('data-valor') : null; }

  /* valida só os campos da sub-tela (reusa as validações do cadastro) */
  function validar(raiz) {
    var C = RosterWork.campos, V = RosterWork.validacoes, T = RosterWork.mensagens.cadastro, ok = true;
    C.limparErros(raiz);
    function erro(el, msg) { if (el) { C.marcarErro(el, msg); ok = false; } }

    if (ctx.secao === 'pessoais') {
      var nome = campoEl(raiz, 'nome_completo');
      if (!nome.value.trim()) erro(nome, T.nomeVazio);
      else if (nome.value.trim().split(/\s+/).length < 2) erro(nome, T.nomeIncompleto);

      var rg = campoEl(raiz, 'rg');
      if (!rg.value.trim()) erro(rg, T.rgVazio);
      else if (!V.validarRg(rg.value, ctx.pessoa.usuario_id)) erro(rg, V.soDigitos(rg.value).length === 11 ? T.rgDiferenteCpf : T.rgInvalido);

      var nascEl = campoEl(raiz, 'data_de_nascimento');
      var nasc = V.parseData(nascEl.value);
      if (!nascEl.value.trim()) erro(nascEl, T.nascimentoVazio);
      else if (!nasc) erro(nascEl, T.dataInvalida);
      else if (V.idadeEm(nasc) < 18) erro(nascEl, T.idadeMinima);

      if (!valorSelecao(raiz, 'cnh')) erro(campoEl(raiz, 'cnh'), T.cnhVazia);

      /* celular é opcional; o e-mail também, para quem ainda não tem conta */
      var cel = campoEl(raiz, 'celular');
      if (cel.value.trim() && V.soDigitos(cel.value).length !== 11) erro(cel, T.celularInvalido);

      var email = campoEl(raiz, 'email');
      if (!email.value.trim()) { if (ctx.ficha.tem_conta !== false) erro(email, T.emailVazio); }
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
      else if (!RosterWork.campos.grauValeNaInclusao((ctx.ficha.institucionais || {}).grau_nome, incl)) erro(inclEl, T.inclusaoSd3);
      else {
        /* a data de inclusão (o primeiro posto na corporação) vem antes de todas as promoções */
        var datas = (ctx.ficha.promocoes || []).map(function (pr) { return pr.data; }).filter(Boolean).sort();
        var primeira = datas.length ? V.parseData(isoParaBR(datas[0])) : null;
        if (primeira && incl > primeira) erro(inclEl, T.inclusaoDepoisPromocao);
      }
      /* a colocação pode ficar vazia: sem colocação (o banco grava "0000") */
    }
    return ok;
  }

  /* payload completo: os campos da sub-tela vêm dos inputs; o resto, da ficha */
  function coletar(raiz) {
    var V = RosterWork.validacoes;
    var p = ctx.ficha.pessoais || {}, ins = ctx.ficha.institucionais || {};
    function txt(k) { var el = campoEl(raiz, k); return el ? el.value.trim() : ''; }

    if (ctx.secao === 'pessoais') {
      return {
        p_cpf: ctx.pessoa.usuario_id,
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
      p_cpf: ctx.pessoa.usuario_id,
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

  function salvar(botao) {
    if (!ctx) return;
    var raiz = ctx.raiz;
    if (!validar(raiz)) {
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.camposCorrigir });
      return;
    }
    var corpo = coletar(raiz);
    /* a CNH alimenta o motor (condutor): se ela mudou, pede a data (modal padrão) antes de gravar,
       para o banco recalcular a distribuição da unidade a partir dela, igual às outras telas */
    var cnhAntes = (ctx.ficha && ctx.ficha.pessoais && ctx.ficha.pessoais.cnh) || '';
    if (ctx.secao === 'pessoais'
        && String(corpo.p_cnh || '').toUpperCase() !== String(cnhAntes).toUpperCase()
        && RosterWork.pedirData) {
      RosterWork.pedirData({
        mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
        textoConfirmar: RosterWork.mensagens.botoes.salvar,
        sugerida: true,
        aoConfirmar: function (iso) { corpo.p_recalcular_desde = iso; enviar(corpo, botao); }
      });
      return;
    }
    enviar(corpo, botao);
  }

  /* o administrador trocou o próprio e-mail: as funções do banco identificam quem está logado pelo
     e-mail do token, então a sessão guarda o novo e o token é renovado (o novo já vem com ele) */
  function atualizarEmailDaSessao(corpo, ficha) {
    var eu = RosterWork.sessao && RosterWork.sessao.cpf();
    var antes = String(((ficha && ficha.pessoais) || {}).email || '').toLowerCase();
    var depois = String(corpo.p_email || '').toLowerCase();
    if (!eu || corpo.p_cpf !== eu || !depois || depois === antes) return Promise.resolve();
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      if (usuario) { usuario.email = depois; sessionStorage.setItem('rosterwork_user', JSON.stringify(usuario)); }
    } catch (e) {}
    return RosterWork.renovarSessao ? RosterWork.renovarSessao().catch(function () {}) : Promise.resolve();
  }

  function enviar(corpo, botao) {
    var atual = ctx;
    if (!atual) return;
    /* CNH mudou (p_recalcular_desde) = recalcula a escala: círculo + tela travada;
       demais correções são rápidas: pontos no botão */
    var recalcula = !!corpo.p_recalcular_desde;
    function iniciar() { if (recalcula) { if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal(); } else if (botao && RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao); }
    function parar() { if (recalcula) { if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal(); } else if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao); }
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
          /* a ficha só relê depois da sessão em dia */
          atualizarEmailDaSessao(corpo, atual.ficha).then(function () { atual.ctl.concluir(r); });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaSalvar });
        }
      })
      .catch(function () {
        parar();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* a sub-tela de UMA seção ('pessoais' | 'institucionais') no corpo; devolve o que o rodapé usa */
  function montarSubtela(corpo, ficha, pessoa, secao, ctl) {
    if (!corpo || !ficha || !RosterWork.usuariosPainelLeitura) return null;
    secao = (secao === 'institucionais') ? 'institucionais' : 'pessoais';
    var L = RosterWork.usuariosPainelLeitura;
    var subtela = RosterWork.tpl(secao === 'pessoais' ? 'tpl-ficha-sub-pessoais' : 'tpl-ficha-sub-institucionais');
    if (!subtela) return null;
    ctx = { ficha: ficha, pessoa: pessoa, secao: secao, raiz: subtela, ctl: ctl, campos: [] };

    var dados = secao === 'pessoais' ? (ficha.pessoais || {}) : (ficha.institucionais || {});
    var b = L.bloco(secao === 'pessoais' ? 'Dados pessoais' : 'Dados institucionais');
    if (!b) return null;
    if (secao === 'pessoais') L.linha(b, 'CPF', formatarCpf(dados.cpf));
    (secao === 'pessoais' ? PESSOAIS : INST).forEach(function (c) {
      var inicial = valorInicial(c, dados);
      var montado = montarCampo(c, inicial);
      if (!montado) return;
      b.appendChild(montado.no);
      ctx.campos.push({ c: c, el: montado.el, inicial: inicial });
    });
    subtela.appendChild(b);
    corpo.appendChild(subtela);

    var atual = ctx;
    return {
      textoAplicar: RosterWork.mensagens.botoes.salvar,
      mudancas: function () { return ctx === atual ? mudancas() : 0; },
      podeAplicar: function () { return ctx === atual && mudancas() > 0; },
      sujo: function () { return ctx === atual && mudancas() > 0; },
      aplicar: salvar
    };
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelEditar = { montarSubtela: montarSubtela, reset: reset };
})();
