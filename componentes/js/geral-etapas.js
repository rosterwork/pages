/* ============================================================
   COMPONENTE geral-etapas — o carregando que diz o que está sendo feito
   Três formas, com as frases de RosterWork.mensagens.etapas:
   - área: até 0,5 s nada muda na tela; depois, a forma do conteúdo
     (o esqueleto) e, passando de 1,5 s, o cartão das etapas por cima;
   - ação: o cartão sobre a tela, na hora, com o clique travado (as
     gravações que refazem a escala); a tela continua à vista;
   - linha: uma frase com a barra, no rodapé ou no painel.
   O que apareceu não pisca: a forma fica pelo menos 0,4 s e o cartão
   0,8 s. Quem lê segura a leitura (segurar) e só desenha depois; a
   leitura rápida, que chega antes de a forma aparecer, não espera nada.
   Pedir de novo com a forma ainda no lugar continua a espera de antes.
   Quando as etapas acontecem dentro de um pedido só ao banco, a ordem
   é a real e o ritmo é estimado (PASSO_MS); a última etapa do banco
   espera a resposta. Passando de 10 s, entra a frase de demora.
   API: RosterWork.etapas.area(lugar, opcoes) · .acao(chave, valores,
   opcoes) · .linha(lugar, chave, valores, opcoes). Cada uma devolve
   { ir(n), ultima(), parar() }, e a área também segurar(leitura).
   opcoes.doServidor = quantas etapas acontecem no banco (as outras,
   quem chama avança). .segurarDesde(inicio, leitura): a forma que a
   tela pôs na hora (as caixas de um painel) · .falta(formaEm, cartaoEm):
   quanto falta para o mínimo · .abrindoDaCasca(desde): a tela que sai
   da casca já mostra a forma na hora.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var FORMA_MS = 500;           // até aqui, nada muda na tela
  var CARTAO_MS = 1500;         // daqui em diante, o cartão com as etapas
  var DEMORA_MS = 10000;        // daqui em diante, a frase de demora
  var PASSO_MS = 700;           // o ritmo estimado das etapas de dentro de um pedido só ao banco
  var MINIMO_FORMA_MS = 400;    // a forma que apareceu fica pelo menos isto (não pisca)
  var MINIMO_CARTAO_MS = 800;   // o cartão que apareceu fica pelo menos isto (dá para ler o título)

  var daCasca = null;           // a tela abrindo depois da casca: quando a casca apareceu
  var naTela = new WeakMap();   // lugar → a espera dele (de quando começou, quando a forma e o cartão apareceram)

  function agora() { return performance.now(); }

  /* quanto falta para o que já apareceu cumprir o mínimo na tela (0: nada a esperar) */
  function falta(formaEm, cartaoEm) {
    var t = agora();
    return Math.max(0, formaEm == null ? 0 : formaEm + MINIMO_FORMA_MS - t, cartaoEm == null ? 0 : cartaoEm + MINIMO_CARTAO_MS - t);
  }

  /* a leitura cumprida igual (o valor ou a falha), só quando o que apareceu cumpriu o mínimo; quanto() diz, na hora
     em que ela chega, quanto falta */
  function segurarLeitura(leitura, quanto) {
    function esperar() {
      var ms = quanto();
      return ms > 0 ? new Promise(function (ok) { setTimeout(ok, ms); }) : null;
    }
    return Promise.resolve(leitura).then(function (valor) {
      var espera = esperar();
      return espera ? espera.then(function () { return valor; }) : valor;
    }, function (erro) {
      var espera = esperar();
      if (!espera) throw erro;
      return espera.then(function () { throw erro; });
    });
  }

  /* a forma que a tela pôs na hora (as caixas de um painel, a lista vazia que já abre com ela): a leitura espera o
     mínimo dela, contado de inicio */
  function segurarDesde(inicio, leitura) {
    return segurarLeitura(leitura, function () { return falta(inicio, null); });
  }

  /* a tela que sai da casca (index-navegacao.js): enquanto ela abre, a forma das áreas entra na hora, sem um vazio depois
     da casca, e continua a casca (o mínimo conta de quando ela apareceu: a espera é uma só). O cartão conta da espera da
     própria área. desde = quando a casca apareceu; null = a tela terminou de abrir */
  function abrindoDaCasca(desde) { daCasca = desde == null ? null : desde; }

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
    var mostradoEm = agora();
    var passos = condutor(f.passos.length, cartao.pintar, opcoes);
    var demora = setTimeout(function () { cartao.dizer(RW.mensagens.etapas.demoraAcao); }, DEMORA_MS);
    var parado = false;
    /* o cartão sai (se outro já não tomou o lugar dele) e a tela volta a responder */
    function esconder() {
      if (cartao.el.parentNode === camada) {
        camada.textContent = '';
        camada.classList.add('oculto');
      }
      RW.liberarTela();
    }
    return {
      ir: passos.ir,
      ultima: passos.ultima,
      parar: function () {
        if (parado) return;
        parado = true;
        passos.parar();
        clearTimeout(demora);
        if (RW.marcarRecalculoPendente) RW.marcarRecalculoPendente();
        if (RW.drenarRecalculo) RW.drenarRecalculo();
        /* o cartão fica o mínimo para ler o título, com a tela ainda travada */
        var resta = falta(null, mostradoEm);
        if (resta > 0) setTimeout(esconder, resta);
        else esconder();
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
     doServidor }. Quem chama segura a leitura (segurar), para ao receber os dados e desenha; o conteúdo novo toma o
     lugar da forma. A marca data-lendo vale do começo ao fim: o passo a passo sabe que a área ainda vai mudar, mesmo
     antes de a forma aparecer. Andar uma etapa (ir) antes de o cartão aparecer vale: ele abre nela. Com a forma de uma
     espera anterior ainda no lugar (pediu de novo antes de chegar), esta continua a de antes: a forma é refeita na
     hora, o cartão que já estava volta junto, e os tempos contam de quando apareceram */
  function area(lugar, opcoes) {
    opcoes = opcoes || {};
    var cartao = null, camada = null, passos = null, pedida = 0;
    var antes = naTela.get(lugar);
    var continua = !!antes && !!antes.no && antes.no.parentNode === lugar;
    var espera = {
      inicio: continua ? antes.inicio : agora(),
      formaEm: continua ? antes.formaEm : null,
      cartaoEm: continua && opcoes.etapas ? antes.cartaoEm : null,
      no: continua ? antes.no : null
    };
    naTela.set(lugar, espera);
    lugar.setAttribute('data-lendo', '');
    function desenharForma() {
      if (!lugar.isConnected) return;
      if (typeof opcoes.forma === 'function') opcoes.forma(lugar);
      else {
        var forma = opcoes.forma ? RW.tpl(opcoes.forma) : null;
        if (!forma) return;
        lugar.textContent = '';
        lugar.appendChild(forma);
      }
      espera.no = lugar.firstElementChild;
      if (espera.formaEm == null) espera.formaEm = daCasca != null ? daCasca : agora();
    }
    function mostrarCartao() {
      if (!opcoes.etapas || !lugar.isConnected) return;
      var f = frases(opcoes.etapas, opcoes.valores);
      cartao = montarCartao(f);
      camada = RW.tpl('tpl-etapas-camada');
      camada.appendChild(cartao.el);
      lugar.appendChild(camada);
      passos = condutor(f.passos.length, cartao.pintar, opcoes);
      if (pedida) passos.ir(pedida);
      if (espera.cartaoEm == null) espera.cartaoEm = agora();
    }
    var passou = agora() - espera.inicio;
    /* a forma que entra na hora é desenhada já: a casca que sai logo em seguida não deixa um quadro vazio */
    var naHora = continua || daCasca != null;
    if (naHora) desenharForma();
    var relogios = [
      naHora ? null : setTimeout(desenharForma, Math.max(0, FORMA_MS - passou)),
      setTimeout(mostrarCartao, Math.max(0, CARTAO_MS - passou)),
      setTimeout(function () {
        if (cartao) cartao.dizer(RW.mensagens.etapas.demoraLeitura);
      }, Math.max(0, DEMORA_MS - passou))
    ];
    return {
      ir: function (n) { pedida = n; if (passos) passos.ir(n); },
      ultima: function () { if (passos) passos.ultima(); },
      /* a leitura chegou: nada novo aparece, e ela se cumpre quando a forma e o cartão que apareceram cumpriram o mínimo */
      segurar: function (leitura) {
        return segurarLeitura(leitura, function () {
          relogios.forEach(clearTimeout);
          return falta(espera.formaEm, espera.cartaoEm);
        });
      },
      parar: function () {
        relogios.forEach(clearTimeout);
        lugar.removeAttribute('data-lendo');
        if (passos) passos.parar();
        if (camada) camada.remove();
      }
    };
  }

  RW.etapas = {
    area: area, acao: acao, linha: linha, segurarDesde: segurarDesde, falta: falta, abrindoDaCasca: abrindoDaCasca
  };
})();
