/* ============================================================
   USUÁRIOS — afastamentos: os campos de um afastamento
   (RosterWork.usuariosAfastamentosCampos)
   As perguntas de um afastamento, iguais na caixa 2 da célula da
   grade e na aba Afastamentos da ficha (a mesma ação nos dois
   lugares): o Nome (o campo com a lista padrão e o Outro, que abre o
   "Nome no dia", até 10 letras), o Período (início → fim e os dias),
   a Guarnição em bolinhas (sem a escolha do administrador, sai a
   partir de 16 dias) e o que ele deixa nesses dias, em caixas de
   marcar. Escolher um nome da lista preenche as marcas dele (a
   Op. Verão e a F. Tarefa deixam trocar e tirar extra); as Férias não
   perguntam a guarnição nem as marcas (saem de tudo). Cada resposta
   entra no rascunho na hora. O que é de mais de uma semana atrás fica
   travado (o mesmo limite do banco): o que terminou antes não muda; o
   que começou antes muda só o fim e o nome.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MISSOES = ['op_verao', 'forca_tarefa'];
  var grupos = 0;   // o nome de cada par de bolinhas (as setas do teclado andam dentro dele)

  function M() { return RW.mensagens.afastamentos; }
  function D() { return RW.data; }
  function R() { return RW.usuariosAfastamentosRascunho; }

  function rotuloDe(padrao) {
    var p = M().padroes.filter(function (x) { return x.valor === padrao; })[0];
    return p ? p.rotulo : '';
  }
  function dias(af) {
    if (!af.inicio || !af.fim || af.fim < af.inicio) return 0;
    return Math.round((new Date(af.fim + 'T12:00:00') - new Date(af.inicio + 'T12:00:00')) / 86400000) + 1;
  }
  function isoDoCampo(valor) {
    var d = D().paraData(valor);
    return d ? D().paraIsoDeData(d) : '';
  }
  /* sem a escolha do administrador, a regra dos dias: a partir de 16 sai da guarnição (as férias sempre saem) */
  function sugestao(af, campos) {
    var x = Object.assign({}, af, campos);
    if (x.padrao === 'ferias') return { gua: true };
    if (x.escolheu) return {};
    return { gua: dias(x) >= 16 };
  }

  /* as perguntas de um afastamento no lugar. opcoes = { cpf, chave, partes ('nome', 'periodo', 'guarnicao', 'marcas';
     sem elas, todas), origem (quem pergunta: o rascunho não o redesenha), editavel }.
     Devolve { pintar() } (o que muda sem perder o campo que se digita) ou null */
  function montar(lugar, opcoes) {
    var cpf = String(opcoes.cpf), chave = opcoes.chave;
    var partes = opcoes.partes || ['nome', 'periodo', 'guarnicao', 'marcas'];
    var af = R().achar(cpf, chave);
    if (!af || !lugar) return null;
    var g = af.id ? R().gravado(cpf, af.id) : null;
    var lim = R().isoLimite();
    var editavel = opcoes.editavel !== false;
    var fimTravado = !editavel || !!(g && g.fim < lim);
    var iniTravado = fimTravado || !!(g && g.inicio < lim);
    var el = {};

    function atual() { return R().achar(cpf, chave); }
    function mudar(campos, juntar) {
      var a = atual();
      if (!a) return;
      R().mudar(cpf, chave, Object.assign(campos, sugestao(a, campos)), opcoes.origem, juntar);
    }

    /* o Nome: a lista padrão e o Outro */
    if (partes.indexOf('nome') >= 0) {
      el.nome = RW.tpl('tpl-afastamento-nome');
      el.outro = RW.tpl('tpl-afastamento-outro');
      var botao = el.nome.querySelector('[data-af-nome]');
      var itens = M().padroes.map(function (p) { return { rotulo: p.rotulo, valor: p.valor }; })
        .concat([{ rotulo: M().outro, valor: 'outro' }]);
      RW.campos.popularOpcoes(el.nome.querySelector('.dropdown-menu'), itens);
      var entrada = el.outro.querySelector('[data-af-outro]');
      entrada.value = !af.padrao ? af.nome : '';
      if (fimTravado) {
        botao.disabled = true;
        entrada.disabled = true;
      } else {
        RW.campos.ligarSelecao(botao, function (valor) {
          if (valor === 'outro') {
            mudar({ padrao: null, nome: entrada.value.trim() });
            el.outro.classList.remove('oculto');
            entrada.focus();
            return;
          }
          var campos = { padrao: valor, nome: rotuloDe(valor) };
          /* as marcas do item: as férias saem de tudo; a Op. Verão e a F. Tarefa deixam trocar e tirar extra */
          if (!iniTravado) {
            var deixa = MISSOES.indexOf(valor) >= 0;
            campos.tro = !deixa;
            campos.ext = !deixa;
            campos.sob = true;
          }
          mudar(campos);
          el.outro.classList.add('oculto');
        });
        entrada.addEventListener('input', function () { mudar({ padrao: null, nome: entrada.value.trim() }, 'nome'); });
      }
      lugar.appendChild(el.nome);
      lugar.appendChild(el.outro);
    }

    /* o Período */
    if (partes.indexOf('periodo') >= 0) {
      el.periodo = RW.tpl('tpl-afastamento-periodo');
      [['inicio', '[data-af-inicio]', iniTravado], ['fim', '[data-af-fim]', fimTravado]].forEach(function (x) {
        var input = el.periodo.querySelector(x[1]);
        input.value = af[x[0]] ? D().isoParaBR(af[x[0]]) : '';
        input.disabled = x[2];
        if (x[2]) return;
        RW.campos.ligarData(input);
        input.addEventListener('input', function () {
          var campos = {};
          campos[x[0]] = isoDoCampo(input.value);
          mudar(campos, x[0]);
        });
      });
      lugar.appendChild(el.periodo);
    }

    /* a Guarnição */
    if (partes.indexOf('guarnicao') >= 0) {
      el.guarnicao = RW.tpl('tpl-afastamento-guarnicao');
      grupos++;
      Array.prototype.forEach.call(el.guarnicao.querySelectorAll('input[type="radio"]'), function (radio) {
        radio.name = 'afastamento-guarnicao-' + grupos;
        radio.disabled = iniTravado;
        radio.addEventListener('change', function () {
          if (radio.checked) mudar({ gua: radio.value === 'sim', escolheu: true });
        });
      });
      lugar.appendChild(el.guarnicao);
    }

    /* o que ele deixa nesses dias */
    if (partes.indexOf('marcas') >= 0) {
      el.marcas = RW.tpl('tpl-afastamento-marcas');
      Array.prototype.forEach.call(el.marcas.querySelectorAll('[data-af-marca]'), function (b) {
        b.disabled = iniTravado;
        b.addEventListener('click', function () {
          var a = atual(), k = b.getAttribute('data-af-marca');
          var campos = {};
          campos[k] = !(a && a[k]);
          mudar(campos);
        });
      });
      lugar.appendChild(el.marcas);
    }

    el.nota = RW.tpl('tpl-afastamento-nota');
    if (el.nota) lugar.appendChild(el.nota);
    if (fimTravado && editavel) {
      var travado = RW.tpl('tpl-afastamento-travado');
      if (travado) lugar.appendChild(travado);
    }

    /* o que muda com a resposta, sem tocar nos campos que se digitam */
    function pintar() {
      var a = atual();
      if (!a) return;
      var ferias = a.padrao === 'ferias';
      if (el.nome) {
        var gatilho = el.nome.querySelector('[data-af-nome]');
        var valor = a.padrao || (a.nome || !el.outro.classList.contains('oculto') ? 'outro' : '');
        RW.campos.definirSelecao(gatilho, valor);
        if (valor) gatilho.querySelector('.campo-selecao-texto').textContent = valor === 'outro' ? M().outro : rotuloDe(valor);
        el.outro.classList.toggle('oculto', valor !== 'outro');
      }
      if (el.periodo) {
        var n = dias(a);
        var selo = el.periodo.querySelector('[data-af-dias]');
        selo.textContent = n ? M().dias(n) : '';
        selo.classList.toggle('oculto', !n);
      }
      /* as férias não perguntam a guarnição nem as marcas */
      if (el.guarnicao) {
        el.guarnicao.classList.toggle('oculto', ferias);
        Array.prototype.forEach.call(el.guarnicao.querySelectorAll('input[type="radio"]'), function (radio) {
          radio.checked = (radio.value === 'sim') === !!a.gua;
        });
      }
      if (el.marcas) {
        el.marcas.classList.toggle('oculto', ferias);
        Array.prototype.forEach.call(el.marcas.querySelectorAll('[data-af-marca]'), function (b) {
          var ligado = !!a[b.getAttribute('data-af-marca')];
          b.setAttribute('aria-checked', String(ligado));
          b.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', ligado);
        });
      }
      if (el.nota) {
        var problema = R().problemaDe(a);
        el.nota.querySelector('.nota-texto').textContent = problema;
        el.nota.classList.toggle('oculto', !problema);
      }
    }
    pintar();
    return { pintar: pintar };
  }

  window.RosterWork.usuariosAfastamentosCampos = { montar: montar, dias: dias };
})();
