/* ============================================================
   AFASTAMENTOS — os campos de um afastamento
   (RosterWork.afastamentosCampos)
   As perguntas de um afastamento, iguais na caixa 2 da célula da
   grade e no painel do militar (a mesma ação nos dois lugares): o Nome (o campo com a lista padrão e o Outro, que abre o
   "Nome no dia", até 10 letras), o Período (início → fim e os dias),
   a Guarnição em bolinhas (sem a escolha do administrador, sai a
   partir de 16 dias) e o que ele deixa nesses dias, em caixas de
   marcar. Escolher um nome da lista preenche as marcas dele (a
   Op. Verão e a F. Tarefa deixam trocar e tirar extra, e a Op. Verão
   também fica no sobreaviso; o Litoral sai de tudo); as Férias
   perguntam só a guarnição (saem do resto); a Autorização de
   viagem, que não é afastamento e só tira do sobreaviso, pergunta
   só o período. Cada resposta
   entra no rascunho na hora. Na caixa da grade, o nome em branco só
   aparece quando se tenta fechar (podeFechar). O que é de mais de uma semana atrás fica
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
  function R() { return RW.afastamentosRascunho; }

  function padraoDe(valor) { return M().padroes.filter(function (x) { return x.valor === valor; })[0]; }
  /* o texto da lista; o do dia ("nome") só difere na Autorização de viagem */
  function rotuloDe(padrao) {
    var p = padraoDe(padrao);
    return p ? p.rotulo : '';
  }
  function nomeDe(padrao) {
    var p = padraoDe(padrao);
    return p ? (p.nome || p.rotulo) : '';
  }
  function dias(af) {
    if (!af.inicio || !af.fim || af.fim < af.inicio) return 0;
    return Math.round((new Date(af.fim + 'T12:00:00') - new Date(af.inicio + 'T12:00:00')) / 86400000) + 1;
  }
  function isoDoCampo(valor) {
    var d = D().paraData(valor);
    return d ? D().paraIsoDeData(d) : '';
  }
  /* sem a escolha do administrador, a regra dos dias: a partir de 16 sai da guarnição (as férias também) */
  function sugestao(af, campos) {
    var x = Object.assign({}, af, campos);
    if (x.escolheu) return {};
    return { gua: dias(x) >= 16 };
  }

  /* as perguntas de um afastamento no lugar. opcoes = { cpf, chave, partes ('nome', 'periodo', 'guarnicao', 'marcas';
     sem elas, todas), origem (quem pergunta: o rascunho não o redesenha), editavel, nomeNaTentativa (o nome em branco
     só aparece quando se tenta fechar: a caixa da grade) }.
     Devolve { pintar() (o que muda sem perder o campo que se digita), podeFechar() (com o nome em branco, não: a
     frase aparece) } ou null */
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
    var tentou = false;   // tentou fechar com o nome em branco (nomeNaTentativa)

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
          /* quem sai da Autorização de viagem volta às marcas de um afastamento novo e à regra dos 16 dias */
          var deViagem = !iniTravado && (atual() || {}).padrao === 'viagem';
          if (valor === 'outro') {
            /* o campo à vista antes do rascunho: a grade se redesenha nele e o Nome segue no Outro */
            el.outro.classList.remove('oculto');
            mudar(Object.assign({ padrao: null, nome: entrada.value.trim() },
              deViagem ? { tro: true, ext: true, sob: true, escolheu: false } : {}));
            entrada.focus();
            return;
          }
          var campos = { padrao: valor, nome: nomeDe(valor) };
          /* as marcas do item: as férias e o Litoral saem de tudo; a Op. Verão e a F. Tarefa deixam trocar e tirar extra,
             e a Op. Verão fica também no sobreaviso; a Autorização de viagem só tira do sobreaviso e não mexe na guarnição */
          if (!iniTravado) {
            var deixa = MISSOES.indexOf(valor) >= 0 || valor === 'viagem';
            campos.tro = !deixa;
            campos.ext = !deixa;
            campos.sob = valor !== 'op_verao';
            if (valor === 'viagem') {
              campos.gua = false;
              campos.escolheu = true;
            } else if (deViagem) {
              campos.escolheu = false;
            }
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
      var viagem = a.padrao === 'viagem';
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
      /* as férias perguntam só a guarnição (saem do resto); a Autorização de viagem, só o período */
      if (el.guarnicao) {
        el.guarnicao.classList.toggle('oculto', viagem);
        Array.prototype.forEach.call(el.guarnicao.querySelectorAll('input[type="radio"]'), function (radio) {
          radio.checked = (radio.value === 'sim') === !!a.gua;
        });
      }
      if (el.marcas) {
        el.marcas.classList.toggle('oculto', ferias || viagem);
        Array.prototype.forEach.call(el.marcas.querySelectorAll('[data-af-marca]'), function (b) {
          var ligado = !!a[b.getAttribute('data-af-marca')];
          b.setAttribute('aria-checked', String(ligado));
          b.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', ligado);
        });
      }
      if (el.nota) {
        var problema = R().problemaDe(a);
        /* o nome em branco (o problema do afastamento sem nome): na caixa da grade, só depois de tentar fechar */
        if (a.nome) tentou = false;
        else if (opcoes.nomeNaTentativa && !tentou) problema = '';
        el.nota.querySelector('.nota-texto').textContent = problema;
        el.nota.classList.toggle('oculto', !problema);
        /* junto da frase, a borda vermelha no campo que falta: o Nome no dia (no Outro) ou a lista */
        if (el.nome) {
          var faltaNome = !a.nome && !!problema;
          var noOutro = !el.outro.classList.contains('oculto');
          el.outro.classList.toggle('campo--erro', faltaNome && noOutro);
          el.nome.classList.toggle('campo--erro', faltaNome && !noOutro);
        }
      }
    }

    /* pode fechar? Com as perguntas à vista e o nome em branco, não: a frase aparece */
    function podeFechar() {
      var a = atual();
      if (!a || a.nome || !el.nota || !el.nota.isConnected || !R().problemaDe(a)) return true;
      tentou = true;
      pintar();
      return false;
    }

    pintar();
    return { pintar: pintar, podeFechar: podeFechar };
  }

  window.RosterWork.afastamentosCampos = { montar: montar, dias: dias };
})();
