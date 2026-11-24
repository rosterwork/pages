/* ============================================================
   OP. VERÃO — o cadastro do guarda-vidas civil (painel direito)
   Cadastrar (nome completo e o RG ou o CPF) e, num cadastrado,
   mudar ou Remover do cadastro (os dias em que ele já trabalhou
   ficam). O guarda-vidas civil não tem login e não é militar: fica
   só na Op. Verão (guarda_vidas_civis_salvar → Histórico → resumo).
   Os moldes ficam no index.html (#tpl-op-verao-civil-form e
   -acoes); os botões vão no rodapé do shell (#painel-rodape). O
   Salvar fica desligado até o nome e um documento certos. Só o
   administrador da companhia abre (quem chama confere).
   RosterWork.opVeraoCivil.abrir({ unidade, nome, civil, aoMudar }).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var sujo = false;          // o formulário aberto tem o que salvar
  var guardaLigada = false;

  function msg() { return RW.mensagens.opVerao.civil; }
  function digitos(v) { return RW.campos.soDigitos(v || ''); }

  /* fecha perguntando antes, se tem o que salvar */
  function tentarFechar() {
    if (!sujo) { RW.painel.fechar(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { sujo = false; RW.painel.fechar(); }
    });
  }

  /* opcoes = { unidade (a companhia), nome (o nome dela), civil ({ id, nome_completo, rg, cpf } ou nada, para cadastrar),
     aoMudar(civilId) } */
  function abrir(opcoes) {
    var civil = opcoes.civil || null;
    sujo = false;
    RW.painel.abrir({
      titulo: civil ? msg().tituloMudar : msg().tituloNovo,
      subtitulo: msg().subtitulo(opcoes.nome),
      aoFechar: function () { sujo = false; },
      aoTentarFechar: function () { if (!sujo) return false; tentarFechar(); return true; }
    });
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape();
    corpo.appendChild(RW.tpl('tpl-op-verao-civil-form'));
    rodape.appendChild(document.getElementById('tpl-op-verao-civil-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');

    var campo = function (nome) { return corpo.querySelector('[data-civil="' + nome + '"]'); };
    var botao = function (nome) { return rodape.querySelector('[data-civil="' + nome + '"]'); };
    var nome = campo('nome'), rg = campo('rg'), cpf = campo('cpf');
    var gravar = botao(civil ? 'salvar' : 'cadastrar');
    botao('cadastrar').classList.toggle('oculto', !!civil);
    botao('salvar').classList.toggle('oculto', !civil);
    campo('remover-caixa').classList.toggle('oculto', !civil);

    RW.campos.ligarNome(nome);
    RW.campos.ligarMascara(rg, RW.campos.mascararRg);
    RW.campos.ligarMascara(cpf, RW.campos.mascararCpf);
    var antes = civil ? { nome: civil.nome_completo, rg: civil.rg || '', cpf: civil.cpf || '' } : { nome: '', rg: '', cpf: '' };
    nome.value = antes.nome;
    rg.value = antes.rg ? RW.campos.mascararRg(antes.rg) : '';
    cpf.value = antes.cpf ? RW.campos.mascararCpf(antes.cpf) : '';

    /* certo: o nome com 3 letras ou mais; o RG com 8, 9 ou 11 números e o CPF com os dígitos certos; pelo menos um */
    function valores() { return { nome: nome.value.trim().replace(/\s+/g, ' '), rg: digitos(rg.value), cpf: digitos(cpf.value) }; }
    function conferir() {
      var v = valores();
      var rgOk = !v.rg || [8, 9, 11].indexOf(v.rg.length) >= 0;
      var cpfOk = !v.cpf || RW.validacoes.validarCpf(v.cpf);
      sujo = v.nome !== antes.nome || v.rg !== antes.rg || v.cpf !== antes.cpf;
      gravar.disabled = !(sujo && v.nome.length >= 3 && (v.rg || v.cpf) && rgOk && cpfOk);
    }
    [nome, rg, cpf].forEach(function (c) { c.addEventListener('input', conferir); });
    conferir();
    nome.focus();

    /* grava (o cadastro novo, a mudança ou a remoção) e, no fim, o resumo */
    function enviar(corpoCivil, quem) {
      var espera = RW.etapas.acao('opVeraoCivil', { remover: !!corpoCivil.remover }, { doServidor: 1, botao: quem, atraso: true });
      RW.rpc('guarda_vidas_civis_salvar', { p_unidade: opcoes.unidade, p_civil: corpoCivil }).then(function (r) {
        espera.parar();
        if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
        sujo = false;
        RW.painel.fechar();
        if (opcoes.aoMudar) opcoes.aoMudar(r.civil && r.civil.id);
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      }, function () {
        espera.parar();
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
    }

    gravar.addEventListener('click', function () {
      if (gravar.disabled) return;
      var v = valores();
      enviar({ id: civil ? civil.id : null, nome_completo: v.nome, rg: v.rg, cpf: v.cpf }, gravar);
    });
    botao('cancelar').addEventListener('click', tentarFechar);
    campo('remover').addEventListener('click', function () {
      RW.confirmar({
        tipo: 'aviso', mensagem: msg().removerConfirmar(civil.nome_completo),
        textoConfirmar: RW.mensagens.botoes.remover, textoCancelar: RW.mensagens.botoes.cancelar,
        aoConfirmar: function () { enviar({ id: civil.id, remover: true }, campo('remover')); }
      });
    });

    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return sujo; });
      guardaLigada = true;
    }
  }

  RW.opVeraoCivil = { abrir: abrir };
})();
