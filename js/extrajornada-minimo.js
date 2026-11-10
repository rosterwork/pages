/* ============================================================
   EXTRAJORNADA — o prazo e o mínimo de dias Quero (passo 1, Pedidos)
   O prazo, o Exigir mínimo, o número de todos os voluntários e as
   exceções (o efetivo administrativo ou um militar), recolhidas com
   o resumo de quantas há. Tudo é rascunho até o Salvar do rodapé
   (extrajornada-organizar.js, extrajornada_pedidos_salvar). O número só
   escolhe de 1 a 5. Com os pedidos fechados, o mínimo fica só para
   ler. Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaMinimo.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var ADMINISTRATIVO = 'administrativo';
  var OPCOES = [1, 2, 3, 4, 5];

  var el = null;              // a página
  var d = null;               // a resposta do extrajornada_mes
  var redesenhar = null;      // redesenha o passo inteiro
  var rodape = null;          // atualiza só o rodapé de salvar
  var regra = null;           // o rascunho: { exige, minimo, excecoes: [{ alvo, dias }] }
  var aberto = false;         // as exceções abertas
  var unidadeNova = null;     // a Unidade escolhida na linha nova (fica entre um desenho e outro)

  function msg() { return RW.mensagens.extrajornada.org; }
  function q(sel) { return el.querySelector(sel); }
  function data(iso) { return RW.data.isoParaBR(iso); }

  /* o que está salvo no mês; a exceção de quem saiu da companhia não aparece e sai no próximo Salvar */
  function salva() {
    var m = d.mes.minimo || {};
    return {
      exige: m.exige !== false,
      minimo: m.minimo || null,
      excecoes: (m.excecoes || []).filter(function (e) { return e.alvo === ADMINISTRATIVO || RW.extrajornadaUtil.militar(e.alvo); })
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
    return !regra || !regra.minimo || !regra.excecoes.every(preenchida) || !RW.data.paraISO(q('#p1-abre').value) || !RW.data.paraISO(q('#p1-fecha').value) || q('#p1-aviso').value === '';
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

  /* a lista do campo de quem: o efetivo administrativo (se ainda não está nas exceções) e as praças da unidade escolhida,
     os dois grupos abertos (a Unidade já separa) */
  function opcoesDeQuem(unidade) {
    var usado = regra.excecoes.some(function (e) { return e.alvo === ADMINISTRATIVO; });
    var grupo = usado ? [] : [{ titulo: msg().tituloGrupo, aberto: true }, { cpf: ADMINISTRATIVO, nome: msg().efetivoAdministrativo }];
    var daUnidade = d.militares.filter(function (m) { return !!unidade && String(m.unidade_id) === String(unidade.id); });
    return grupo.concat([{ titulo: msg().tituloMilitares, aberto: true }], daUnidade.map(function (m) {
      return { cpf: m.cpf, grad: m.grad, nome: m.nome };
    }));
  }

  /* as unidades com praças, na ordem da página */
  function unidadesDeQuem() {
    return d.unidades.filter(function (u) { return d.militares.some(function (m) { return String(m.unidade_id) === String(u.id); }); });
  }

  /* a linha nova: a Unidade à esquerda (a escolhida antes, a sua ou a primeira) e, à direita, quem tem a exceção */
  function ligarCampoDeQuem(linha, excecao) {
    var quem = linha.querySelector('.extrajornada-excecao-quem'), caixa = linha.querySelector('.extrajornada-excecao-combo');
    var dUnidade = linha.querySelector('.extrajornada-excecao-unidade'), inp = caixa.querySelector('input');
    var texto = dUnidade.querySelector('.campo-selecao-texto'), menu = dUnidade.querySelector('.dropdown-menu');
    var unidades = unidadesDeQuem(), perfil = RW.sessao.perfil();
    function achar(id) { return unidades.filter(function (u) { return id != null && String(u.id) === String(id); })[0] || null; }
    linha.classList.add('extrajornada-excecao--nova');
    quem.classList.remove('oculto');
    inp.id = 'p1-excecao-campo';
    var combo = RW.comboMilitar.criar(inp, caixa.querySelector('.dropdown-menu'), {
      atual: function () { return null; },
      ignorar: function () { return regra.excecoes.map(function (e) { return e.alvo; }); },
      aoEscolher: function (item) { excecao.alvo = item.cpf; redesenhar(); },
      textos: { selecione: msg().escolhaQuem, filtroVazio: msg().ninguemEncontrado }
    });
    function escolherUnidade(u) {
      unidadeNova = u ? u.id : null;
      if (u) texto.textContent = u.nome;
      texto.classList.toggle('campo-selecao-texto--vazio', !u);
      combo.preencher(opcoesDeQuem(u));
    }
    unidades.forEach(function (u) {
      var it = RW.tpl('tpl-escala-unidade-item');
      if (!it) return;
      it.textContent = u.nome;
      it.addEventListener('click', function () { escolherUnidade(u); });
      menu.appendChild(it);
    });
    dUnidade.querySelector('.campo-selecao').disabled = !unidades.length;
    escolherUnidade(achar(unidadeNova) || achar(perfil && perfil.lotacao_id) || unidades[0] || null);
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
      var l = RW.tpl('tpl-extrajornada-p1-excecao');
      var era = guardada.excecoes.filter(function (x) { return x.alvo === e.alvo; })[0];
      var nome = l.querySelector('.extrajornada-excecao-nome'), numero = l.querySelector('.extrajornada-minimo-numero');
      var remover = l.querySelector('.extrajornada-excecao-remover');
      nome.textContent = e.alvo === ADMINISTRATIVO ? msg().efetivoAdministrativo : e.alvo ? RW.extrajornadaUtil.nome(e.alvo) : '';
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
    d = null; regra = null; aberto = false; unidadeNova = null;
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

  RW.extrajornadaMinimo = {
    ligar: ligar, iniciar: iniciar, desenhar: desenhar,
    regraMudou: regraMudou, prazoMudou: prazoMudou, incompleto: incompleto, parametros: parametros
  };
})();
