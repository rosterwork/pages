/* ============================================================
   TROCAS — o painel Solicitar troca / Registrar troca
   Abre o painel com o formulário da troca (trocas-varias.js:
   os militares, os dias no calendário e o resumo com o horário de
   cada dia, num registro só). Solicitar: o logado pede (é o
   primeiro militar). Registrar (só admin): grava já aprovado, com a
   Análise antes. Cobrar (o credor, na aba Saldos): o devedor entra
   sozinho e o dia em que ele cobre já vem com as horas da dívida.
   O X, o Esc e o Cancelar confirmam o descarte quando há dados.
   Aqui ficam também as peças do formulário que o Editar das trocas
   de uma (trocas-editar.js, no molde #tpl-troca-solicitar) e o
   formulário da troca usam.
   Expõe RosterWork.trocasSolicitar.{ ligar, abrir, formulario }.
     ligar({ aoSolicitar, aoMudar }) — guarda os callbacks (1x)
     abrir(opcoes) — {} = Solicitar · { registrar: true } = Registrar ·
       { cobrar: { cpf, nome, grau, minutos } } = Solicitar em modo
       cobrança
     formulario — mostrarModo, ligarSoNumeros, parteNumero,
       parteAno, validarParte, ligarLimpezaErros
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var guardaLigado = false;
  var cbs = {};            // callbacks da página (aoSolicitar, aoMudar), guardados no ligar
  var aberto = false;      // painel aberto? (zera o temDados depois de fechar)

  function C() { return RW.trocasCampos; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }

  /* ---------- o formulário: os modos e o E-protocolo (o Editar troca usa os mesmos) ---------- */
  /* mostra só o que é do modo (data-modo traz os modos em que o campo aparece, separados por espaço) */
  function mostrarModo(raiz, modo) {
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-modo]'), function (el) {
      el.classList.toggle('oculto', el.getAttribute('data-modo').split(' ').indexOf(modo) < 0);
    });
  }
  function ligarSoNumeros(inp) {
    if (!inp) return;
    inp.addEventListener('input', function () { var v = inp.value.replace(/\D/g, ''); if (v !== inp.value) inp.value = v; });
  }
  function valorDe(raiz, sel) { var el = raiz ? raiz.querySelector(sel) : null; return el ? el.value || '' : ''; }
  function parteDigitada(raiz) { return valorDe(raiz, '#ts-parte').trim() !== ''; }
  function parteNumero(raiz) { var v = valorDe(raiz, '#ts-parte'); return /^\d{1,7}$/.test(v) && Number(v) > 0 ? Number(v) : null; }
  function parteAno(raiz) { var v = valorDe(raiz, '#ts-parte-ano'); return /^\d{4}$/.test(v) ? Number(v) : null; }
  /* a Parte é opcional; preenchida, precisa ser válida e levar o Ano */
  function validarParte(raiz) {
    var ok = true;
    if (parteDigitada(raiz) && !parteNumero(raiz)) { C().marcarErro(raiz.querySelector('#ts-parte'), txt('novaParte')); ok = false; }
    if (parteDigitada(raiz) && !parteAno(raiz)) { C().marcarErro(raiz.querySelector('#ts-parte-ano'), txt('novaAno')); ok = false; }
    return ok;
  }
  function ligarLimpezaErros(raiz) {
    var form = raiz.querySelector('.troca-solicitar-form') || raiz;
    form.addEventListener('click', function (ev) {
      var campo = ev.target.closest('.campo');
      if (!campo || !campo.classList.contains('campo--erro')) return;
      campo.classList.remove('campo--erro');
      var alvo = campo.querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    });
  }

  /* ---------- estado, cancelar, fechar ---------- */
  function temDados() { return aberto && !!(RW.trocasVarias && RW.trocasVarias.temDados()); }
  function confirmarDescarte() {
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { if (RW.painel) RW.painel.fechar(); }
    });
  }
  /* fecha o painel; com dados preenchidos, confirma o descarte antes (mesmo aviso do X/Esc) */
  function cancelar() {
    if (!temDados() || !RW.confirmar) { if (RW.painel) RW.painel.fechar(); return; }
    confirmarDescarte();
  }
  /* o X e o Esc do painel passam por aqui: segura o fechamento se houver dados a descartar */
  function guardaFechar() {
    if (!temDados() || !RW.confirmar) return false;
    confirmarDescarte();
    return true;
  }
  /* o painel avisa ao fechar (X/Esc/Cancelar/sucesso): o formulário some, então marca fechado */
  function aoFecharReset() { aberto = false; if (RW.trocasVarias) RW.trocasVarias.encerrar(); }

  /* ---------- abrir: o painel com o formulário da troca ---------- */
  function abrir(opcoes) {
    if (!RW.painel || !RW.trocasVarias) return;
    opcoes = opcoes || {};
    var registrar = !!opcoes.registrar;
    RW.painel.abrir({ titulo: registrar ? txt('tituloRegistrar') : txt('tituloPainel'), aoFechar: aoFecharReset, aoTentarFechar: guardaFechar });
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    aberto = true;
    RW.trocasVarias.montar({
      corpo: corpo, registrar: registrar, cobrar: (!registrar && opcoes.cobrar) || null,
      aoSolicitar: cbs.aoSolicitar, aoMudar: cbs.aoMudar, cancelar: cancelar
    });
  }

  /* guarda os callbacks da página e registra o guarda de saída (uma vez) */
  function ligar(callbacks) {
    cbs = callbacks || {};
    if (!guardaLigado && RW.guardaSaida && RW.guardaSaida.registrar) {
      RW.guardaSaida.registrar(temDados);
      guardaLigado = true;
    }
  }

  RW.trocasSolicitar = {
    ligar: ligar, abrir: abrir,
    formulario: { mostrarModo: mostrarModo, ligarSoNumeros: ligarSoNumeros, parteNumero: parteNumero, parteAno: parteAno,
                  validarParte: validarParte, ligarLimpezaErros: ligarLimpezaErros }
  };
})();
