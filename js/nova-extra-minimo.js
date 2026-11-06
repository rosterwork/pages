/* ============================================================
   NOVA EXTRA — o prazo e o mínimo de dias Quero (passo 1, Pedidos)
   O prazo, o Exigir mínimo, o número de todos os voluntários e as
   exceções (o efetivo administrativo ou um militar), recolhidas com
   o resumo de quantas há. Tudo é rascunho até o Salvar do rodapé
   (nova-extra-organizar.js, nova_extra_pedidos_salvar). O número só
   escolhe de 1 a 5. Com os pedidos fechados, o mínimo fica só para
   ler. Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraMinimo.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var ADMINISTRATIVO = 'administrativo';
  var OPCOES = [1, 2, 3, 4, 5];

  var el = null;              // a página
  var d = null;               // a resposta do nova_extra_mes
  var redesenhar = null;      // redesenha o passo inteiro
  var rodape = null;          // atualiza só o rodapé de salvar
  var regra = null;           // o rascunho: { exige, minimo, excecoes: [{ alvo, dias }] }
  var aberto = false;         // as exceções abertas

  function msg() { return RW.mensagens.novaExtra.org; }
  function q(sel) { return el.querySelector(sel); }
  function data(iso) { return RW.data.isoParaBR(iso); }

  /* o que está salvo no mês; a exceção de quem saiu da companhia não aparece e sai no próximo Salvar */
  function salva() {
    var m = d.mes.minimo || {};
    return {
      exige: m.exige !== false,
      minimo: m.minimo || null,
      excecoes: (m.excecoes || []).filter(function (e) { return e.alvo === ADMINISTRATIVO || RW.novaExtraUtil.militar(e.alvo); })
        .map(function (e) { return { alvo: e.alvo, dias: e.dias }; })
    };
  }

  function preenchida(e) { return !!(e.alvo && e.dias); }
  function regraMudou() { return !!regra && JSON.stringify(regra) !== JSON.stringify(salva()); }
  function prazoMudou() {
    return !!d && (q('#p1-abre').value !== data(d.mes.abre) || q('#p1-fecha').value !== data(d.mes.fecha) || q('#p1-aviso').value !== String(d.mes.aviso_dias));
  }
  /* pela metade: o Salvar fica desligado */
  function incompleto() {
    return !regra || !regra.minimo || !regra.excecoes.every(preenchida) || !RW.data.paraISO(q('#p1-abre').value) || !RW.data.paraISO(q('#p1-fecha').value);
  }

  function parametros() {
    return {
      p_abre: RW.data.paraISO(q('#p1-abre').value), p_fecha: RW.data.paraISO(q('#p1-fecha').value), p_aviso: +q('#p1-aviso').value,
      p_exige_minimo: regra.exige, p_min_quero: regra.minimo, p_excecoes: regra.excecoes
    };
  }

  /* o número de dias: a lista só tem de 1 a 5, então 0 ou 6 não existem na tela */
  function ligarNumero(caixa, valor, leitura, aoEscolher) {
    var texto = caixa.querySelector('.campo-selecao-texto');
    texto.textContent = valor ? msg().dias(valor) : msg().escolhaDias;
    texto.classList.toggle('campo-selecao-texto--vazio', !valor);
    caixa.querySelector('.campo-selecao').disabled = leitura;
    RW.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), { opcoes: OPCOES, valor: valor, formato: msg().dias, aoEscolher: aoEscolher });
  }

  /* a lista do campo de quem: o efetivo administrativo (se ainda não está nas exceções) e as praças da companhia */
  function opcoesDeQuem() {
    var usado = regra.excecoes.some(function (e) { return e.alvo === ADMINISTRATIVO; });
    var grupo = usado ? [] : [{ titulo: msg().tituloGrupo }, { cpf: ADMINISTRATIVO, nome: msg().efetivoAdministrativo }];
    return grupo.concat([{ titulo: msg().tituloMilitares }], d.militares.map(function (m) {
      return { cpf: m.cpf, grad: m.grad, nome: m.nome, info: (RW.novaExtraUtil.unidade(m.unidade_id) || {}).nome || '' };
    }));
  }

  function ligarCampoDeQuem(linha, excecao) {
    var caixa = linha.querySelector('.nova-extra-excecao-combo'), inp = caixa.querySelector('input');
    linha.classList.add('nova-extra-excecao--nova');
    caixa.classList.remove('oculto');
    inp.id = 'p1-excecao-campo';
    RW.comboMilitar.criar(inp, caixa.querySelector('.dropdown-menu'), {
      atual: function () { return null; },
      ignorar: function () { return regra.excecoes.map(function (e) { return e.alvo; }); },
      aoEscolher: function (item) { excecao.alvo = item.cpf; redesenhar(); },
      textos: { selecione: msg().escolhaQuem, filtroVazio: msg().ninguemEncontrado }
    }).preencher(opcoesDeQuem());
  }

  function desenharExcecoes(guardada, leitura) {
    var prontas = regra.excecoes.filter(preenchida).length;
    q('#p1-exc-abrir').setAttribute('aria-expanded', aberto ? 'true' : 'false');
    q('#p1-exc-corpo').classList.toggle('oculto', !aberto);
    q('#p1-exc-resumo').classList.toggle('oculto', aberto);
    q('#p1-exc-resumo').textContent = msg().excecoesResumo(prontas, regra.excecoes.length - prontas);
    q('#p1-exc-adicionar').classList.toggle('oculto', leitura);
    q('#p1-excecoes-vazio').classList.toggle('oculto', regra.excecoes.length > 0);
    var lista = q('#p1-excecoes');
    lista.textContent = '';
    regra.excecoes.forEach(function (e, i) {
      var l = RW.tpl('tpl-ne-p1-excecao');
      var era = guardada.excecoes.filter(function (x) { return x.alvo === e.alvo; })[0];
      var nome = l.querySelector('.nova-extra-excecao-nome'), numero = l.querySelector('.nova-extra-minimo-numero');
      var remover = l.querySelector('.nova-extra-excecao-remover');
      nome.textContent = e.alvo === ADMINISTRATIVO ? msg().efetivoAdministrativo : e.alvo ? RW.novaExtraUtil.nome(e.alvo) : '';
      nome.classList.toggle('oculto', !e.alvo);
      ligarNumero(numero, e.dias, leitura, function (n) { e.dias = n; redesenhar(); });
      numero.classList.toggle('campo--alterado', !era || era.dias !== e.dias);
      remover.classList.toggle('oculto', leitura);
      remover.addEventListener('click', function () { regra.excecoes.splice(i, 1); redesenhar(); });
      lista.appendChild(l);
      if (!e.alvo) ligarCampoDeQuem(l, e);
    });
  }

  function marcarPrazo() {
    [['#p1-abre', data(d.mes.abre)], ['#p1-fecha', data(d.mes.fecha)], ['#p1-aviso', String(d.mes.aviso_dias)]].forEach(function (c) {
      q(c[0]).closest('.campo').classList.toggle('campo--alterado', q(c[0]).value !== c[1]);
    });
  }

  function desenhar() {
    var guardada = salva(), leitura = d.mes.estado === 'encerrado';
    Array.prototype.forEach.call(el.querySelectorAll('#p1-exigir [data-exigir]'), function (b) {
      b.classList.toggle('aba--ativa', (b.getAttribute('data-exigir') === 'sim') === regra.exige);
      b.disabled = leitura;
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-exigir-mostra]'), function (e) { e.classList.toggle('oculto', !regra.exige); });
    q('#p1-minimo-leitura').classList.toggle('oculto', !leitura);
    ligarNumero(q('#p1-minimo-geral'), regra.minimo, leitura, function (n) { regra.minimo = n; redesenhar(); });
    q('#p1-minimo-geral').classList.toggle('campo--alterado', regra.minimo !== guardada.minimo);
    desenharExcecoes(guardada, leitura);
    marcarPrazo();
  }

  /* começa o rascunho a partir do que está salvo (também no Cancelar); as exceções só fecham ao trocar de mês */
  function iniciar(dados) {
    if (!d || d.competencia !== dados.competencia) aberto = false;
    d = dados;
    regra = salva();
    q('#p1-abre').value = data(d.mes.abre);
    q('#p1-fecha').value = data(d.mes.fecha);
    q('#p1-aviso').value = d.mes.aviso_dias;
  }

  function ligar(conteudo, aoRedesenhar, aoRodape) {
    el = conteudo;
    redesenhar = aoRedesenhar;
    rodape = aoRodape;
    d = null; regra = null; aberto = false;
    /* o prazo nos campos de data do site (DD/MM/AAAA, com o calendário do site) */
    RW.campos.ligarData(q('#p1-abre'));
    RW.campos.ligarData(q('#p1-fecha'));
    ['#p1-abre', '#p1-fecha', '#p1-aviso'].forEach(function (s) {
      q(s).addEventListener('input', function () { marcarPrazo(); rodape(); });
    });
    Array.prototype.forEach.call(el.querySelectorAll('#p1-exigir [data-exigir]'), function (b) {
      b.addEventListener('click', function () {
        regra.exige = b.getAttribute('data-exigir') === 'sim';
        /* com o Não, a linha pela metade some junto: escondida, ela prenderia o Salvar */
        if (!regra.exige) regra.excecoes = regra.excecoes.filter(preenchida);
        redesenhar();
      });
    });
    q('#p1-exc-abrir').addEventListener('click', function () { aberto = !aberto; redesenhar(); });
    q('#p1-exc-adicionar').addEventListener('click', function () {
      regra.excecoes.push({ alvo: null, dias: null });
      redesenhar();
      var campo = q('#p1-excecao-campo');
      if (campo) campo.focus();
    });
  }

  RW.novaExtraMinimo = {
    ligar: ligar, iniciar: iniciar, desenhar: desenhar,
    regraMudou: regraMudou, prazoMudou: prazoMudou, incompleto: incompleto, parametros: parametros
  };
})();
