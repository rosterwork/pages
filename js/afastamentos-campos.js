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
   perguntam só a guarnição (saem do resto). A Autorização de viagem
   (não é afastamento: só tira do sobreaviso) pergunta o período e os
   Destinos: um campo por destino, com o X (com dois ou mais, tira o
   campo; com um só, limpa) e o Adicionar destino. Cada resposta
   entra no rascunho na hora. O que está errado aparece na frase embaixo
   e em vermelho no campo (a data errada, o início, o fim ou as duas,
   até ser corrigida); na caixa da grade, o nome, a data ou o destino em
   branco só aparece quando se tenta fechar, e ela não fecha com o
   erro de uma pergunta que está nela (podeFechar). As letras seguidas
   num campo são um passo só do Desfazer; sair do campo encerra o passo. O que é de mais de uma semana atrás fica
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

  /* o texto da lista (é também o nome do dia) */
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
  /* sem a escolha do administrador, a regra dos dias: a partir de 16 sai da guarnição (as férias também) */
  function sugestao(af, campos) {
    var x = Object.assign({}, af, campos);
    if (x.escolheu) return {};
    return { gua: dias(x) >= 16 };
  }

  /* as perguntas de um afastamento no lugar. opcoes = { cpf, chave, partes ('nome', 'periodo', 'guarnicao', 'marcas',
     'destinos'; sem elas, todas as do afastamento, ou o período e os destinos da autorização de viagem), origem (quem
     pergunta: o rascunho não o redesenha), editavel, brancoNaTentativa (o nome, a data ou o destino em branco só
     aparece quando se tenta fechar: a caixa da grade) }.
     Devolve { pintar() (o que muda sem perder o campo que se digita), podeFechar() (com o erro de uma das perguntas
     à vista, não: a frase aparece e o campo fica vermelho) } ou null */
  function montar(lugar, opcoes) {
    var cpf = String(opcoes.cpf), chave = opcoes.chave;
    var af = R().achar(cpf, chave);
    if (!af || !lugar) return null;
    var partes = opcoes.partes ||
      (af.padrao === 'viagem' ? ['periodo', 'destinos'] : ['nome', 'periodo', 'guarnicao', 'marcas']);
    var g = af.id ? R().gravado(cpf, af.id) : null;
    var lim = R().isoLimite();
    var editavel = opcoes.editavel !== false;
    var fimTravado = !editavel || !!(g && g.fim < lim);
    var iniTravado = fimTravado || !!(g && g.inicio < lim);
    var el = {};
    var tentou = false;   // tentou fechar com algo em branco (brancoNaTentativa)

    function atual() { return R().achar(cpf, chave); }
    function mudar(campos, juntar) {
      var a = atual();
      if (!a) return;
      R().mudar(cpf, chave, Object.assign(campos, sugestao(a, campos)), opcoes.origem, juntar);
    }
    /* sair do campo que se digita (o clique fora, a caixa que fecha) encerra a digitação: a próxima mudança nele é outro
       passo do Desfazer (o campo que saiu da página no redesenho fica de fora) */
    function aoSair(input) {
      input.addEventListener('blur', function () { if (input.isConnected) R().encerrarDigitacao(); });
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
            /* o campo à vista antes do rascunho: a grade se redesenha nele e o Nome segue no Outro */
            el.outro.classList.remove('oculto');
            mudar({ padrao: null, nome: entrada.value.trim() });
            entrada.focus();
            return;
          }
          var campos = { padrao: valor, nome: rotuloDe(valor) };
          /* as marcas do item: as férias e o Litoral saem de tudo; a Op. Verão e a F. Tarefa deixam trocar e tirar extra,
             e a Op. Verão fica também no sobreaviso */
          if (!iniTravado) {
            var deixa = MISSOES.indexOf(valor) >= 0;
            campos.tro = !deixa;
            campos.ext = !deixa;
            campos.sob = valor !== 'op_verao';
          }
          mudar(campos);
          el.outro.classList.add('oculto');
        });
        entrada.addEventListener('input', function () { mudar({ padrao: null, nome: entrada.value.trim() }, 'nome'); });
        aoSair(entrada);
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
        aoSair(input);
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

    /* os Destinos da autorização de viagem: um campo por destino; o Adicionar destino põe um em branco embaixo */
    if (partes.indexOf('destinos') >= 0) {
      el.destinos = RW.tpl('tpl-afastamento-destinos');
      var adicionarDestino = el.destinos.querySelector('[data-af-destino-adicionar]');
      adicionarDestino.disabled = fimTravado;
      adicionarDestino.addEventListener('click', function () {
        mudar({ destinos: destinosDe(atual()).concat(['']) });
        desenharDestinos();
        focarDestino(destinosDe(atual()).length - 1);
      });
      desenharDestinos();
      lugar.appendChild(el.destinos);
    }

    el.nota = RW.tpl('tpl-afastamento-nota');
    if (el.nota) lugar.appendChild(el.nota);
    if (fimTravado && editavel) {
      var travado = RW.tpl('tpl-afastamento-travado');
      if (travado) lugar.appendChild(travado);
    }

    /* os destinos como estão (sempre pelo menos um campo, mesmo em branco) */
    function destinosDe(a) {
      var d = (a && a.destinos) || [];
      return d.length ? d.slice() : [''];
    }
    /* um campo por destino (refeitos quando muda quantos são); o X tira o campo, e com um só, limpa */
    function desenharDestinos() {
      var caixa = el.destinos && el.destinos.querySelector('[data-af-destinos]');
      if (!caixa) return;
      while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
      destinosDe(atual()).forEach(function (valor, i) {
        var linha = RW.tpl('tpl-afastamento-destino');
        if (!linha) return;
        var entrada = linha.querySelector('[data-af-destino]');
        var tirar = linha.querySelector('[data-af-destino-remover]');
        entrada.value = valor;
        entrada.disabled = fimTravado;
        tirar.classList.toggle('oculto', fimTravado);
        entrada.addEventListener('input', function () {
          var d = destinosDe(atual());
          d[i] = entrada.value;
          mudar({ destinos: d }, 'destino-' + i);
        });
        aoSair(entrada);
        tirar.addEventListener('click', function () {
          var d = destinosDe(atual());
          if (d.length > 1) d.splice(i, 1);
          else d = [''];
          mudar({ destinos: d });
          desenharDestinos();
          focarDestino(Math.min(i, destinosDe(atual()).length - 1));
        });
        caixa.appendChild(linha);
      });
    }
    function focarDestino(i) {
      var campo = el.destinos.querySelectorAll('[data-af-destino]')[i];
      if (campo) campo.focus();
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
      /* as férias perguntam só a guarnição (saem do resto) */
      if (el.guarnicao) {
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
      /* os destinos que mudaram por fora (o Desfazer, a outra caixa): os campos refeitos quando muda quantos são; os
         outros só ganham o valor novo, menos o que se digita */
      if (el.destinos) {
        var lista = destinosDe(a);
        var entradas = el.destinos.querySelectorAll('[data-af-destino]');
        if (entradas.length !== lista.length) desenharDestinos();
        else Array.prototype.forEach.call(entradas, function (e, i) {
          if (e !== document.activeElement && e.value !== lista[i]) e.value = lista[i];
        });
      }
      if (el.nota) {
        var erro = R().conferir(a);
        var problema = erro.texto;
        /* o que está em branco (o nome, uma data ou o destino): na caixa da grade, só depois de tentar fechar */
        if (!erro.branco) tentou = false;
        else if (opcoes.brancoNaTentativa && !tentou) problema = '';
        if (el.destinos) el.destinos.classList.toggle('campo--erro', problema === M().viagem.semDestino);
        el.nota.querySelector('.nota-texto').textContent = problema;
        el.nota.classList.toggle('oculto', !problema);
        /* junto da frase, a borda vermelha no campo que falta: o Nome no dia (no Outro) ou a lista */
        if (el.nome) {
          var faltaNome = !a.nome && !!problema;
          var noOutro = !el.outro.classList.contains('oculto');
          el.outro.classList.toggle('campo--erro', faltaNome && noOutro);
          el.nome.classList.toggle('campo--erro', faltaNome && !noOutro);
        }
        /* e na data errada (o início, o fim ou as duas), até ser corrigida */
        if (el.periodo) {
          el.periodo.querySelector('[data-af-inicio]').classList.toggle('campo-entrada--erro', !!problema && erro.inicio);
          el.periodo.querySelector('[data-af-fim]').classList.toggle('campo-entrada--erro', !!problema && erro.fim);
        }
      }
    }

    /* pode fechar? Com as perguntas à vista e um problema que elas corrigem (o nome, uma data, o destino), não: a frase
       aparece e o campo fica vermelho */
    function podeFechar() {
      var a = atual();
      if (!a || !el.nota || !el.nota.isConnected) return true;
      var erro = R().conferir(a);
      if (!erro.texto || !erro.partes.some(function (p) { return partes.indexOf(p) >= 0; })) return true;
      tentou = true;
      pintar();
      return false;
    }

    pintar();
    return { pintar: pintar, podeFechar: podeFechar };
  }

  window.RosterWork.afastamentosCampos = { montar: montar, dias: dias };
})();
