/* ============================================================
   EXTRAJORNADA — passo 2: Cotas
   A faixa: as cotas da companhia (campo no "Entre todos"; no "Unidades", o texto com a
   soma das unidades; o jeito de repartir é o dos Ajustes › Extrajornada); Entregues (amarelo: ainda há cota e voluntário
   que pediu mais; vermelho: passou do recebido), Sobram e Na escala;
   na ponta direita, a caixa da Sugestão só com pares (no rascunho, como o total: refaz a Sugestão e só o Salvar
   grava); e o Preencher pela sugestão. Embaixo, a grade, com um bloco por
   unidade nos dois jeitos e, no título, o Recebeu, o Entregues e o
   Sobram. O Recebeu é o campo da unidade no "Unidades"; no "Entre
   todos" é o texto com a parte que a fila da companhia dá a ela (a
   soma da Sugestão dos militares dela). A fila é a da companhia no
   "Entre todos" e a de cada unidade no "Unidades". A Sugestão vem do banco e é pedida de novo a cada mudança
   na repartição, sem salvar (extrajornada_mes com p_so_sugestao). O
   Recebe é o campo de seleção (de 0 a 10 para todos, mesmo acima
   do que ele pediu), com a borda forte quando difere do
   salvo, e o cadeado ao lado quando o número foi escolhido no campo
   (a marca é guardada no salvar). O Preencher põe a Sugestão em todos
   e tira o cadeado, com o Desfazer no rodapé; com algum Recebe mudado
   e não salvo, ele trava (apagaria a mudança). Cota abaixo do que ele já tem na distribuição avisa
   embaixo da linha: as extras dele saem ao salvar. Tudo fica no
   rascunho até o Salvar (extrajornada_cotas_salvar), que abre o resumo.
   A cópia da tela (o Imprimir da barra) lê o mesmo, com o rascunho.
   No mês antes da escala no sistema (antes de outubro de 2026), só para
   ver: as cotas da companhia são a soma do que cada um recebeu, o
   Recebe é texto, e a Sugestão, o Na escala e a caixa dos pares somem.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaCotas.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var d = null, el = null, aoSalvar = null;
  var p2 = null;           // o rascunho: { modo, recebidas, unidades, conc, manual, sujo, sug, antes, pares }
  var guardaLigada = false;
  var pedidoSug = 0;       // latest-wins da sugestão
  var esperaSug = null;    // o intervalo antes de pedir a sugestão (enquanto digita)

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function q(sel) { return el.querySelector(sel); }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function soma(l, f) { return l.reduce(function (s, x) { return s + f(x); }, 0); }
  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  /* os voluntários com termo, na fila da companhia (a menor porcentagem atendida nos 12 meses e, no empate, o mais antigo) */
  function comTermo() { return vols().filter(function (m) { return m.termo; }).sort(function (a, b) { return a.ordem - b.ordem; }); }
  function conc(m) { return m.cpf in p2.conc ? p2.conc[m.cpf] : (m.concedidas || 0); }
  /* o cadeado: o Recebe foi escolhido no campo (o do Preencher fica sem) */
  function manual(m) { return m.cpf in p2.manual ? p2.manual[m.cpf] : !!m.manual; }
  /* algum Recebe difere do salvo (o total não conta: é o que a sugestão usa na conta) */
  function recebeMudado() { return !!p2 && comTermo().some(function (m) { return conc(m) !== (m.concedidas || 0); }); }
  function sugestao(m) { return p2.sug[m.cpf] || 0; }
  /* a companhia (a unidade que não é pelotão) */
  function cia() { return d.unidades.filter(function (x) { return x.pelotao === false; })[0] || d.unidades[0] || {}; }
  /* o que ele já tem na distribuição salva: as cotas e os dias (DD/MM) */
  function naGrade(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  function diasDe(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).map(function (a) { return a.data; }).sort().map(u().br); }
  /* abaixo do que está na grade, as extras dele saem ao salvar */
  function perde(m) { return conc(m) < naGrade(m); }
  /* a lista do Recebe: de 0 a 10 para todos, mesmo acima do que ele pediu (a Sugestão nunca passa do pedido) */
  var RECEBE_MAXIMO = 10;
  function opcoes() { var l = []; for (var n = 0; n <= RECEBE_MAXIMO; n++) l.push(n); return l; }
  /* por unidades, as cotas da companhia são a soma das unidades */
  function somaUnidades() { return Object.keys(p2.unidades).reduce(function (s, k) { return s + (+p2.unidades[k] || 0); }, 0); }
  function recebido() { return p2.modo === 'por_unidade' ? somaUnidades() : (+p2.recebidas || 0); }
  function repartidoEm(uid) { return soma(comTermo().filter(function (m) { return m.unidade_id === uid; }), conc); }
  /* a cor do Entregues: vermelho passou do recebido; amarelo ainda há cota e voluntário que pediu mais */
  function cor(recebeu, lista) {
    var ent = soma(lista, conc);
    if (ent > recebeu) return 'extrajornada-cor--erro';
    return ent < recebeu && lista.some(function (m) { return conc(m) < (m.cotas || 0); }) ? 'extrajornada-cor--alerta' : '';
  }
  function pintar(e, classe) {
    e.classList.remove('extrajornada-cor--erro', 'extrajornada-cor--alerta');
    if (classe) e.classList.add(classe);
  }
  /* o repartido não passa do recebido (a mesma conta do banco): a frase do primeiro que passa, ou nada */
  function passou() {
    if (p2.modo !== 'por_unidade') {
      var rep = soma(comTermo(), conc);
      return rep > recebido() ? msg().cotasPassaram(rep, recebido()) : '';
    }
    var un = d.unidades.filter(function (x) { return repartidoEm(x.id) > (+p2.unidades[x.id] || 0); })[0];
    return un ? msg().cotasPassaramUnidade(un.nome, repartidoEm(un.id), +p2.unidades[un.id] || 0) : '';
  }

  /* o mês antes da escala no sistema: só para ver o que cada um pediu e recebeu */
  function antesDaEscala() { return !!d.antes_da_escala; }

  /* a grade da tela: um bloco por unidade escolhida que tem voluntário com termo (o desenho e a cópia da tela usam os
     mesmos) */
  function blocosDaTela(lista) {
    var sel = u().escolhidas();
    return d.unidades.filter(function (un) { return sel.indexOf(un.id) >= 0; }).map(function (un) {
      return { un: un, daqui: lista.filter(function (m) { return m.unidade_id === un.id; }) };
    }).filter(function (b) { return b.daqui.length; });
  }
  /* o Recebeu da unidade: o campo dela (por unidades) ou a parte que a fila da companhia dá a ela (entre todos); antes da
     escala no sistema, a soma do que os militares dela receberam */
  function recebeuDa(un, daqui) { return p2.modo === 'por_unidade' ? (+p2.unidades[un.id] || 0) : soma(daqui, antesDaEscala() ? conc : sugestao); }
  /* a posição na fila: a da companhia (entre todos) ou a da unidade (por unidades) */
  function filaDe(m, daqui, lista) { return p2.modo === 'por_unidade' ? daqui.indexOf(m) + 1 : lista.indexOf(m) + 1; }
  /* o atendido nos 12 meses: quem pede pela primeira vez conta como 100% na fila; a tela diz "Primeira vez" */
  function atendido(m) {
    var primeira = !m.pediu12;
    return { primeira: primeira, porcento: primeira ? '' : msg().porcento(Math.round(100 * (m.recebeu12 || 0) / m.pediu12)),
      de: primeira ? '' : msg().deCotas(m.recebeu12 || 0, m.pediu12) };
  }

  function iniciarRascunho() {
    p2 = { modo: d.mes.repartir_por || 'grupo', recebidas: d.mes.cotas_recebidas, unidades: Object.assign({}, d.mes.cotas_unidades || {}),
      conc: {}, manual: {}, sujo: false, sug: {}, antes: null, pares: !!d.mes.sugestao_pares };
    d.militares.forEach(function (m) { if (m.sugerido) p2.sug[m.cpf] = m.sugerido; });
    /* antes da escala no sistema, o total não foi guardado: as cotas da companhia são a soma do que cada um recebeu */
    if (antesDaEscala()) { p2.modo = 'grupo'; p2.recebidas = soma(comTermo(), function (m) { return m.concedidas || 0; }); }
  }

  /* a frase "Calculando a sugestão" no rodapé, no lugar do texto dele, só se a conta passar de 0,3 s (sem travar a tela:
     quem digita continua digitando) */
  var calculando = null, relogioCalculando = null;
  function mostrarCalculando() {
    if (calculando || relogioCalculando) return;
    relogioCalculando = setTimeout(function () {
      relogioCalculando = null;
      var texto = q('#p2-mudancas'), lugar = q('#p2-calculando');
      if (!texto || !lugar) return;
      texto.classList.add('oculto');
      lugar.classList.remove('oculto');
      calculando = RW.etapas.linha(lugar, 'cotasSugestao');
    }, 300);
  }
  function pararCalculando() {
    clearTimeout(relogioCalculando);
    relogioCalculando = null;
    if (calculando) calculando.parar();
    calculando = null;
    var texto = q('#p2-mudancas'), lugar = q('#p2-calculando');
    if (texto) texto.classList.remove('oculto');
    if (lugar) lugar.classList.add('oculto');
  }

  /* a Sugestão com a repartição e a caixa dos pares da tela, sem salvar: o banco refaz a conta (espera um pouco
     enquanto digita) */
  function pedirSugestao() {
    clearTimeout(esperaSug);
    esperaSug = setTimeout(function () {
      var meu = ++pedidoSug, porUnidade = p2.modo === 'por_unidade', uni = {};
      Object.keys(p2.unidades).forEach(function (k) { uni[k] = +p2.unidades[k] || 0; });
      mostrarCalculando();
      RW.rpc('extrajornada_mes', { p_competencia: d.competencia, p_repartir_por: p2.modo, p_cotas_recebidas: porUnidade ? null : (+p2.recebidas || 0),
        p_cotas_unidades: porUnidade ? uni : null, p_so_sugestao: true, p_sugestao_pares: p2.pares }).then(function (r) {
        if (meu !== pedidoSug) return;
        pararCalculando();
        if (!r || !r.ok || !p2 || !q('#p2-salvar')) return;
        p2.sug = r.sugerido || {};
        desenhar();
      }, function () { if (meu === pedidoSug) pararCalculando(); });
    }, 300);
  }

  function desenhar() {
    if (!p2) iniciarRascunho();
    var porUnidade = p2.modo === 'por_unidade', antes = antesDaEscala();
    /* a faixa: as cotas da companhia (campo ou a soma das unidades; antes da escala no sistema, a soma do que cada um
       recebeu, em texto), os números e a caixa dos pares */
    var pares = q('#p2-pares');
    pares.classList.toggle('oculto', antes);
    pares.setAttribute('aria-checked', p2.pares ? 'true' : 'false');
    pares.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', p2.pares);
    todos('.extrajornada-cia', function (e) { e.textContent = cia().nome || ''; });
    var campo = q('#p2-recebidas');
    campo.classList.toggle('oculto', porUnidade || antes);
    if (document.activeElement !== campo) campo.value = p2.recebidas == null ? '' : p2.recebidas;
    q('#p2-recebidas-soma').classList.toggle('oculto', !porUnidade && !antes);
    q('#p2-recebidas-soma').textContent = porUnidade ? somaUnidades() : recebido();
    var lista = comTermo(), total = recebido(), ent = soma(lista, conc);
    q('#p2-entregues').textContent = ent;
    pintar(q('#p2-entregues'), cor(total, lista));
    q('#p2-sobram').textContent = total - ent;
    q('#p2-sobram').classList.toggle('extrajornada-voluntarios-numero-valor--erro', total - ent < 0);
    q('#p2-na-escala').textContent = soma(lista, naGrade);
    q('#p2-na-escala').parentNode.classList.toggle('oculto', antes);

    /* a grade: um bloco por unidade nos dois jeitos (antes da escala no sistema, sem a Sugestão e o Na escala) */
    var sel = u().escolhidas();
    var visiveis = lista.filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; });
    var alvo = q('#p2-lista');
    alvo.textContent = '';
    alvo.classList.toggle('extrajornada-grade--antes', antes);
    if (visiveis.length) {
      var cab = RW.tpl('tpl-extrajornada-p2-cab');
      cab.querySelector('.extrajornada-p2-col-sug').classList.toggle('oculto', antes);
      cab.querySelector('.extrajornada-p2-col-escala').classList.toggle('oculto', antes);
      alvo.appendChild(cab);
    }
    var ajuste = d.iniciado && !!d.lancamento;
    blocosDaTela(lista).forEach(function (b) {
      var un = b.un, daqui = b.daqui;
      var bloco = RW.tpl('tpl-extrajornada-p2-bloco');
      bloco.querySelector('.extrajornada-voluntarios-bloco-nome').textContent = un.nome;
      bloco.querySelector('.extrajornada-voluntarios-bloco-detalhe').textContent = un.cidade || '';
      /* o Recebeu: o campo da unidade (por unidades) ou a parte que a fila da companhia dá a ela (entre todos); antes da
         escala no sistema, a soma do que os militares dela receberam */
      var inp = bloco.querySelector('.extrajornada-voluntarios-bloco-total'), texto = bloco.querySelector('.extrajornada-bloco-recebeu');
      var recebeu = recebeuDa(un, daqui);
      inp.classList.toggle('oculto', !porUnidade);
      texto.classList.toggle('oculto', porUnidade);
      texto.textContent = recebeu;
      if (porUnidade) {
        inp.value = p2.unidades[un.id] == null ? '' : p2.unidades[un.id];
        inp.addEventListener('change', function () {
          p2.unidades[un.id] = inp.value.trim() === '' ? 0 : (parseInt(inp.value, 10) || 0);
          p2.sujo = true; desenhar(); pedirSugestao();
        });
      }
      var e = bloco.querySelector('.extrajornada-p2-entregues'), ent = soma(daqui, conc);
      e.textContent = ent;
      pintar(e, cor(recebeu, daqui));
      bloco.querySelector('.extrajornada-p2-sobram').textContent = recebeu - ent;
      /* a fila: a da companhia (entre todos) ou a da unidade (por unidades) */
      var bloquinho = bloco.querySelector('.extrajornada-voluntarios-bloquinho');
      daqui.forEach(function (m) {
        bloquinho.appendChild(linha(m, filaDe(m, daqui, lista)));
        if (perde(m)) {
          var av = RW.tpl('tpl-extrajornada-p2-aviso');
          av.textContent = msg().retiraCota(conc(m), diasDe(m), ajuste);
          bloquinho.appendChild(av);
        }
      });
      alvo.appendChild(bloco);
    });
    q('#p2-vazio').classList.toggle('oculto', visiveis.length > 0);
    /* o rodapé, que aparece só com alteração (ou com o repartido acima do recebido): o repartido acima do recebido diz
       onde, e o Salvar fica desligado; o Desfazer depois do Preencher */
    var perdem = lista.filter(perde).length, erro = passou();
    q('#p2-rodape').classList.toggle('oculto', !p2.sujo && !erro);
    q('#p2-mudancas').textContent = erro || (perdem ? msg().naoSalvoRetira(perdem) : (p2.sujo ? msg().naoSalvo : ''));
    q('#p2-mudancas').classList.toggle('extrajornada-negativo', !!erro);
    q('#p2-salvar').disabled = !p2.sujo || !!erro;
    q('#p2-desfazer').classList.toggle('oculto', !p2.antes);
    /* com os pedidos abertos, o aviso no alto e os campos travados (o banco também recusa); antes da escala no sistema,
       travados também (só para ver) */
    var aberto = d.mes.estado !== 'encerrado';
    q('#p2-topo').classList.toggle('oculto', !aberto);
    todos('[data-aba-painel="cotas"] input, .extrajornada-voluntarios-conc-gatilho, #p2-pares', function (e) { e.disabled = aberto || antes; });
  }

  /* um voluntário: a fila, o militar, o pedido, o atendido em 12 meses, a sugestão, o Recebe e o que já está na escala */
  function linha(m, fila) {
    var l = RW.tpl('tpl-extrajornada-p2-linha');
    l.querySelector('.extrajornada-fila').textContent = msg().fila(fila);
    l.querySelector('.extrajornada-voluntarios-grad').textContent = m.grad;
    l.querySelector('.extrajornada-voluntarios-nome').textContent = m.nome;
    l.querySelector('.extrajornada-vaga-24h').classList.toggle('oculto', !m.so24);
    l.querySelector('.extrajornada-voluntarios-pediu').textContent = m.cotas;
    var at = atendido(m);
    l.querySelector('.extrajornada-p2-porcento').textContent = at.porcento;
    l.querySelector('.extrajornada-p2-de-cotas').textContent = at.de;
    l.querySelector('.extrajornada-p2-primeira-vez').classList.toggle('oculto', !at.primeira);
    var sug = l.querySelector('.extrajornada-sug');
    sug.textContent = sugestao(m);
    /* a sugestão parou no que cabe nos dias livres dele: a dica diz quanto cabe */
    if (m.cabem != null && m.cabem < (m.cotas || 0)) sug.setAttribute('data-dica', msg().sugCabe(m.cabem));
    /* antes da escala no sistema, só para ver: sem a Sugestão e o Na escala, e o Recebe em texto no lugar do campo */
    var antes = antesDaEscala();
    sug.classList.toggle('oculto', antes);
    l.querySelector('.extrajornada-voluntarios-na-escala').classList.toggle('oculto', antes);
    l.querySelector('.extrajornada-voluntarios-conc').classList.toggle('oculto', antes);
    l.querySelector('.extrajornada-p2-recebe-texto').classList.toggle('oculto', !antes);
    l.querySelector('.extrajornada-p2-recebe-texto').textContent = conc(m);
    l.querySelector('.extrajornada-voluntarios-conc-texto').textContent = conc(m);
    l.querySelector('.extrajornada-voluntarios-conc').classList.toggle('campo--alterado', conc(m) !== (m.concedidas || 0));
    l.querySelector('.extrajornada-p2-cadeado').classList.toggle('oculto', !manual(m) || antes);
    RW.dropdownNumeros.preencher(l.querySelector('.extrajornada-voluntarios-conc-menu'), {
      opcoes: opcoes(), valor: conc(m),
      aoEscolher: function (n) { p2.conc[m.cpf] = n; p2.manual[m.cpf] = true; p2.sujo = true; desenhar(); }
    });
    l.querySelector('.extrajornada-voluntarios-na-escala').textContent = msg().deCotas(naGrade(m), conc(m));
    return l;
  }

  function salvar() {
    var concedidas = {}, manuais = [], btn = q('#p2-salvar');
    comTermo().forEach(function (m) {
      concedidas[m.cpf] = conc(m);
      if (manual(m)) manuais.push(m.cpf);
    });
    /* os pontinhos no botão na hora e o cartão das etapas só se passar de 1,5 s; com o mês lançado, a extra que sai vai
       para a escala, e os dias seguintes o banco refaz sozinho (a rotina de fundo) */
    var espera = RW.etapas.acao('extraCotas', null, { doServidor: 1, botao: btn, atraso: true });
    RW.rpc('extrajornada_cotas_salvar', {
      p_competencia: d.competencia, p_cotas_recebidas: p2.modo === 'por_unidade' ? somaUnidades() : (p2.recebidas === '' || p2.recebidas == null ? null : +p2.recebidas),
      p_repartir_por: p2.modo, p_cotas_unidades: p2.modo === 'por_unidade' ? p2.unidades : null, p_concedidas: concedidas,
      p_sugestao_pares: p2.pares, p_manuais: manuais
    }).then(function (r) {
      espera.parar();
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.extrajornadaOrg.resumo(r);
      aoSalvar();
    }, function () { espera.parar(); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function ligar() {
    /* as cotas da companhia: a cada número, a faixa e a Sugestão se refazem */
    q('#p2-recebidas').addEventListener('input', function () {
      var v = q('#p2-recebidas').value.trim();
      p2.recebidas = v === '' ? null : (parseInt(v, 10) || 0); p2.sujo = true; desenhar(); pedirSugestao();
    });
    /* a caixa dos pares: vai para o rascunho e a Sugestão se refaz (o Recebe só muda pelo Preencher) */
    q('#p2-pares').addEventListener('click', function () {
      p2.pares = !p2.pares; p2.sujo = true; desenhar(); pedirSugestao();
    });
    /* Preencher pela sugestão: a Sugestão no Recebe de todos, na hora, sem o cadeado; o Desfazer volta ao de antes. Com
       algum Recebe mudado e não salvo, não preenche (o menu Ações mostra o motivo) */
    q('#p2-sugestao').addEventListener('click', function () {
      if (recebeMudado()) return;
      p2.antes = { conc: Object.assign({}, p2.conc), manual: Object.assign({}, p2.manual), sujo: p2.sujo };
      comTermo().forEach(function (m) { p2.conc[m.cpf] = sugestao(m); p2.manual[m.cpf] = false; });
      p2.sujo = true; desenhar();
    });
    q('#p2-desfazer').addEventListener('click', function () {
      if (!p2.antes) return;
      p2.conc = p2.antes.conc; p2.manual = p2.antes.manual; p2.sujo = p2.antes.sujo; p2.antes = null; desenhar();
    });
    q('#p2-cancelar').addEventListener('click', function () { p2 = null; desenhar(); });
    q('#p2-salvar').addEventListener('click', salvar);
  }

  function mostrar(dados, conteudo, recarregar) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    /* a marca no botão vale por visita: a página nova chega sem ela, com o rascunho zerado e os botões a ligar */
    var botaoSalvar = q('#p2-salvar');
    if (!botaoSalvar.dataset.ligado) {
      botaoSalvar.dataset.ligado = '1';
      p2 = null; ligar();
      /* com cotas não salvas, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida && !guardaLigada) {
        guardaLigada = true;
        RW.guardaSaida.registrar(function () {
          var botao = el && q('#p2-salvar');
          return !!(botao && botao.dataset.ligado && p2 && p2.sujo);
        });
      }
    }
    desenhar();
  }

  /* as Cotas como a tela (com o que ainda não foi salvo), para a cópia da tela (extrajornada-imprimir-tela.js): a faixa e
     um bloco por unidade, com as mesmas contas do desenho */
  function paraImprimir() {
    if (!d) return null;
    if (!p2) iniciarRascunho();
    var lista = comTermo(), total = recebido(), ent = soma(lista, conc);
    return {
      cia: cia().nome || '', recebidas: total, entregues: ent, sobram: total - ent, naEscala: soma(lista, naGrade),
      blocos: blocosDaTela(lista).map(function (b) {
        var recebeu = recebeuDa(b.un, b.daqui), entregues = soma(b.daqui, conc);
        return { nome: b.un.nome, cidade: b.un.cidade || '', recebeu: recebeu, entregues: entregues, sobram: recebeu - entregues,
          linhas: b.daqui.map(function (m) {
            var at = atendido(m);
            return { fila: msg().fila(filaDe(m, b.daqui, lista)), grad: m.grad, nome: m.nome, so24: !!m.so24, pediu: m.cotas, primeira: at.primeira,
              porcento: at.porcento, deCotas: at.de, sugestao: sugestao(m), recebe: conc(m), naEscala: msg().deCotas(naGrade(m), conc(m)) };
          }) };
      })
    };
  }

  RW.extrajornadaCotas = { mostrar: mostrar, reiniciar: function () { p2 = null; }, recebeMudado: recebeMudado, paraImprimir: paraImprimir };
})();
