/* ============================================================
   COMPONENTE geral-etapas — o carregando que diz o que está sendo feito
   Três formas, com as frases de RosterWork.mensagens.etapas:
   - área: até 0,3 s nada muda na tela; depois, a forma do conteúdo
     (o esqueleto) e, passando de 1 s, o cartão das etapas por cima;
   - ação: o cartão sobre a tela, na hora, com o clique travado (as
     gravações que refazem a escala); a tela continua à vista;
   - linha: uma frase com a barra, no rodapé ou no painel.
   Quando as etapas acontecem dentro de um pedido só ao banco, a ordem
   é a real e o ritmo é estimado (PASSO_MS); a última etapa do banco
   espera a resposta. Passando de 10 s, entra a frase de demora.
   API: RosterWork.etapas.area(lugar, opcoes) · .acao(chave, valores,
   opcoes) · .linha(lugar, chave, valores, opcoes). Cada uma devolve
   { ir(n), ultima(), parar() }. opcoes.doServidor = quantas etapas
   acontecem no banco (as outras, quem chama avança).
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var FORMA_MS = 300;      // até aqui, nada muda na tela
  var CARTAO_MS = 1000;    // daqui em diante, o cartão com as etapas
  var DEMORA_MS = 10000;   // daqui em diante, a frase de demora
  var PASSO_MS = 700;      // o ritmo estimado das etapas de dentro de um pedido só ao banco

  function frases(chave, valores) {
    var f = RW.mensagens.etapas[chave];
    return typeof f === 'function' ? f(valores || {}) : f;
  }

  /* anda sozinho pelas etapas do banco, sem passar da última delas; pintar(n) mostra a etapa n */
  function condutor(total, pintar, opcoes) {
    var relogios = [];
    var noBanco = Math.min((opcoes && opcoes.doServidor) || total, total);
    function limpar() { relogios.forEach(clearTimeout); relogios = []; }
    function ir(n) { limpar(); pintar(n); }
    pintar(0);
    for (var i = 1; i < noBanco; i++) {
      (function (n) { relogios.push(setTimeout(function () { pintar(n); }, PASSO_MS * n)); })(i);
    }
    return { ir: ir, ultima: function () { ir(total - 1); }, parar: limpar };
  }

  /* o cartão: a barra, o título, as etapas e o pé */
  function montarCartao(f) {
    var el = RW.tpl('tpl-etapas');
    var pe = el.querySelector('.etapas-pe');
    var lista = el.querySelector('.etapas-lista');
    el.querySelector('.etapas-titulo').textContent = f.titulo;
    f.passos.forEach(function (texto) {
      var etapa = RW.tpl('tpl-etapa');
      etapa.querySelector('.etapa-texto').textContent = texto;
      lista.appendChild(etapa);
    });
    function dizer(texto) {
      pe.textContent = texto || '';
      pe.classList.toggle('oculto', !texto);
    }
    dizer(f.pe);
    return {
      el: el,
      dizer: dizer,
      pintar: function (n) {
        Array.prototype.forEach.call(lista.children, function (etapa, i) {
          etapa.classList.toggle('etapa--feita', i < n);
          etapa.classList.toggle('etapa--agora', i === n);
        });
      }
    };
  }

  /* a gravação que refaz a escala: o cartão sobre a tela, com o clique travado. No fim, completa em segundo plano os dias
     distantes do recálculo (a fila em blocos, geral-recalculo.js) */
  function acao(chave, valores, opcoes) {
    var camada = document.getElementById('etapas-camada');
    var f = frases(chave, valores);
    var cartao = montarCartao(f);
    camada.textContent = '';
    camada.appendChild(cartao.el);
    camada.classList.remove('oculto');
    RW.bloquearTela();
    var passos = condutor(f.passos.length, cartao.pintar, opcoes);
    var demora = setTimeout(function () { cartao.dizer(RW.mensagens.etapas.demoraAcao); }, DEMORA_MS);
    var parado = false;
    return {
      ir: passos.ir,
      ultima: passos.ultima,
      parar: function () {
        if (parado) return;
        parado = true;
        passos.parar();
        clearTimeout(demora);
        camada.textContent = '';
        camada.classList.add('oculto');
        RW.liberarTela();
        if (RW.marcarRecalculoPendente) RW.marcarRecalculoPendente();
        if (RW.drenarRecalculo) RW.drenarRecalculo();
      }
    };
  }

  /* a frase com a barra em lugar (o conteúdo dele sai); opcoes.atraso = só aparece depois disso */
  function linha(lugar, chave, valores, opcoes) {
    var f = frases(chave, valores);
    var total = f.passos.length;
    var el = RW.tpl('tpl-etapas-linha');
    var texto = el.querySelector('.etapas-linha-texto');
    var conta = el.querySelector('.etapas-linha-conta');
    conta.classList.toggle('oculto', total < 2);
    function pintar(n) {
      texto.textContent = f.passos[n];
      if (total > 1) conta.textContent = RW.mensagens.etapas.conta(n + 1, total);
    }
    function mostrar() {
      lugar.textContent = '';
      lugar.appendChild(el);
    }
    var aparecer = opcoes && opcoes.atraso ? setTimeout(mostrar, opcoes.atraso) : null;
    if (!aparecer) mostrar();
    var passos = condutor(total, pintar, opcoes);
    var demora = setTimeout(function () {
      conta.textContent = RW.mensagens.etapas.demoraCurta;
      conta.classList.remove('oculto');
      el.classList.add('etapas-linha--demora');
    }, DEMORA_MS);
    return {
      ir: passos.ir,
      ultima: passos.ultima,
      parar: function () {
        clearTimeout(aparecer);
        clearTimeout(demora);
        passos.parar();
        el.remove();
      }
    };
  }

  /* a leitura de uma área: opcoes = { forma (o id do molde, ou uma função que desenha em lugar), etapas, valores,
     doServidor }. Quem chama para ao receber os dados; o conteúdo novo toma o lugar da forma. A marca data-lendo vale do
     começo ao fim: o passo a passo sabe que a área ainda vai mudar, mesmo antes de a forma aparecer. Andar uma etapa (ir)
     antes de o cartão aparecer vale: ele abre nela */
  function area(lugar, opcoes) {
    opcoes = opcoes || {};
    var cartao = null, camada = null, passos = null, pedida = 0;
    lugar.setAttribute('data-lendo', '');
    var relogios = [
      setTimeout(function () {
        if (!lugar.isConnected) return;
        if (typeof opcoes.forma === 'function') { opcoes.forma(lugar); return; }
        var forma = opcoes.forma ? RW.tpl(opcoes.forma) : null;
        if (!forma) return;
        lugar.textContent = '';
        lugar.appendChild(forma);
      }, FORMA_MS),
      setTimeout(function () {
        if (!opcoes.etapas || !lugar.isConnected) return;
        var f = frases(opcoes.etapas, opcoes.valores);
        cartao = montarCartao(f);
        camada = RW.tpl('tpl-etapas-camada');
        camada.appendChild(cartao.el);
        lugar.appendChild(camada);
        passos = condutor(f.passos.length, cartao.pintar, opcoes);
        if (pedida) passos.ir(pedida);
      }, CARTAO_MS),
      setTimeout(function () {
        if (cartao) cartao.dizer(RW.mensagens.etapas.demoraLeitura);
      }, DEMORA_MS)
    ];
    return {
      ir: function (n) { pedida = n; if (passos) passos.ir(n); },
      ultima: function () { if (passos) passos.ultima(); },
      parar: function () {
        relogios.forEach(clearTimeout);
        lugar.removeAttribute('data-lendo');
        if (passos) passos.parar();
        if (camada) camada.remove();
      }
    };
  }

  RW.etapas = { area: area, acao: acao, linha: linha };
})();
