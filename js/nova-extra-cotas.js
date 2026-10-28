/* ============================================================
   NOVA EXTRA — passo 2: Cotas
   A faixa: Repartir por (Entre todos ou Unidades); as cotas da
   companhia (campo no "Entre todos"; no "Unidades", o texto com a
   soma das unidades); Entregues (amarelo: ainda há cota e voluntário
   que pediu mais; vermelho: passou do recebido), Sobram e Na escala;
   e o Preencher pela sugestão. Embaixo, a grade, com um bloco por
   unidade nos dois jeitos e, no título, o Recebeu, o Entregues e o
   Sobram. O Recebeu é o campo da unidade no "Unidades"; no "Entre
   todos" é o texto com a parte que a fila da companhia dá a ela (a
   soma da Sugestão dos militares dela). A fila é a da companhia no
   "Entre todos" e a de cada unidade no "Unidades". A Sugestão vem do banco e é pedida de novo a cada mudança
   na repartição, sem salvar (nova_extra_mes com p_so_sugestao). O
   Recebe é o campo de seleção (de 0 até o que ele pediu; quem só
   aceita 24 h, de 4 em 4), com a borda forte quando difere do
   salvo. O Preencher põe a Sugestão em todos, com o Desfazer no
   rodapé. Cota abaixo do que ele já tem na distribuição avisa
   embaixo da linha: as extras dele saem ao salvar. Tudo fica no
   rascunho até o Salvar (nova_extra_cotas_salvar), que abre o resumo.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraCotas.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var d = null, el = null, aoSalvar = null;
  var p2 = null;           // o rascunho: { modo, recebidas, unidades, conc, sujo, sug, antes }
  var ligado = null;
  var pedidoSug = 0;       // latest-wins da sugestão
  var esperaSug = null;    // o intervalo antes de pedir a sugestão (enquanto digita)

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function soma(l, f) { return l.reduce(function (s, x) { return s + f(x); }, 0); }
  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  /* os voluntários com termo, na fila da companhia (a menor porcentagem atendida nos 12 meses e, no empate, o mais antigo) */
  function comTermo() { return vols().filter(function (m) { return m.termo; }).sort(function (a, b) { return a.ordem - b.ordem; }); }
  function conc(m) { return m.cpf in p2.conc ? p2.conc[m.cpf] : (m.concedidas || 0); }
  function sugestao(m) { return p2.sug[m.cpf] || 0; }
  /* a companhia (a unidade que não é pelotão) */
  function cia() { return d.unidades.filter(function (x) { return x.pelotao === false; })[0] || d.unidades[0] || {}; }
  /* o que ele já tem na distribuição salva: as cotas e os dias (DD/MM) */
  function naGrade(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  function diasDe(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).map(function (a) { return a.data; }).sort().map(u().br); }
  /* abaixo do que está na grade, as extras dele saem ao salvar */
  function perde(m) { return conc(m) < naGrade(m); }
  /* a lista do Recebe: de 0 até o que ele pediu (quem só aceita 24 h, de 4 em 4) */
  function opcoes(m) { var l = []; for (var n = 0; n <= (m.cotas || 0); n += m.so24 ? 4 : 1) l.push(n); return l; }
  /* por unidades, as cotas da companhia são a soma das unidades */
  function somaUnidades() { return Object.keys(p2.unidades).reduce(function (s, k) { return s + (+p2.unidades[k] || 0); }, 0); }
  function recebido() { return p2.modo === 'por_unidade' ? somaUnidades() : (+p2.recebidas || 0); }
  function repartidoEm(uid) { return soma(comTermo().filter(function (m) { return m.unidade_id === uid; }), conc); }
  /* a cor do Entregues: vermelho passou do recebido; amarelo ainda há cota e voluntário que pediu mais */
  function cor(recebeu, lista) {
    var ent = soma(lista, conc);
    if (ent > recebeu) return 'nova-extra-cor--erro';
    return ent < recebeu && lista.some(function (m) { return conc(m) < (m.cotas || 0); }) ? 'nova-extra-cor--alerta' : '';
  }
  function pintar(e, classe) {
    e.classList.remove('nova-extra-cor--erro', 'nova-extra-cor--alerta');
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

  function iniciarRascunho() {
    p2 = { modo: d.mes.repartir_por || 'grupo', recebidas: d.mes.cotas_recebidas, unidades: Object.assign({}, d.mes.cotas_unidades || {}),
      conc: {}, sujo: false, sug: {}, antes: null };
    d.militares.forEach(function (m) { if (m.sugerido) p2.sug[m.cpf] = m.sugerido; });
  }

  /* a Sugestão com a repartição da tela, sem salvar: o banco refaz a conta (espera um pouco enquanto digita) */
  function pedirSugestao() {
    clearTimeout(esperaSug);
    esperaSug = setTimeout(function () {
      var meu = ++pedidoSug, porUnidade = p2.modo === 'por_unidade', uni = {}, btn = q('#p2-sugestao');
      Object.keys(p2.unidades).forEach(function (k) { uni[k] = +p2.unidades[k] || 0; });
      RW.iniciarCarregando(btn);
      RW.rpc('nova_extra_mes', { p_competencia: d.competencia, p_repartir_por: p2.modo, p_cotas_recebidas: porUnidade ? null : (+p2.recebidas || 0),
        p_cotas_unidades: porUnidade ? uni : null, p_so_sugestao: true }).then(function (r) {
        if (meu !== pedidoSug) return;
        RW.pararCarregando(btn);
        if (!r || !r.ok || !p2 || !el.isConnected) return;
        p2.sug = r.sugerido || {};
        desenhar();
      }, function () { if (meu === pedidoSug) RW.pararCarregando(btn); });
    }, 300);
  }

  function desenhar() {
    if (!p2) iniciarRascunho();
    var porUnidade = p2.modo === 'por_unidade';
    /* a faixa: Repartir por, as cotas da companhia (campo ou a soma das unidades) e os números */
    q('#p2-modo-texto').textContent = q('#p2-modo [data-modo="' + p2.modo + '"]').textContent;
    todos('#p2-modo [data-modo]', function (b) { b.classList.toggle('dropdown-item--ativo', b.getAttribute('data-modo') === p2.modo); });
    todos('.nova-extra-cia', function (e) { e.textContent = cia().nome || ''; });
    var campo = q('#p2-recebidas');
    campo.classList.toggle('oculto', porUnidade);
    if (document.activeElement !== campo) campo.value = p2.recebidas == null ? '' : p2.recebidas;
    q('#p2-recebidas-soma').classList.toggle('oculto', !porUnidade);
    q('#p2-recebidas-soma').textContent = somaUnidades();
    var lista = comTermo(), total = recebido(), ent = soma(lista, conc);
    q('#p2-entregues').textContent = ent;
    pintar(q('#p2-entregues'), cor(total, lista));
    q('#p2-sobram').textContent = total - ent;
    q('#p2-sobram').classList.toggle('extra-vol-numero-valor--erro', total - ent < 0);
    q('#p2-na-escala').textContent = soma(lista, naGrade);

    /* a grade: um bloco por unidade nos dois jeitos */
    var sel = u().escolhidas();
    var visiveis = lista.filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; });
    var alvo = q('#p2-lista');
    alvo.textContent = '';
    if (visiveis.length) alvo.appendChild(RW.tpl('tpl-ne-p2-cab'));
    var ajuste = d.iniciado && !!d.lancamento;
    d.unidades.forEach(function (un) {
      if (sel.indexOf(un.id) < 0) return;
      var daqui = lista.filter(function (m) { return m.unidade_id === un.id; });
      if (!daqui.length) return;
      var bloco = RW.tpl('tpl-ne-p2-bloco');
      bloco.querySelector('.extra-vol-bloco-nome').textContent = un.nome;
      bloco.querySelector('.extra-vol-bloco-detalhe').textContent = un.cidade || '';
      /* o Recebeu: o campo da unidade (por unidades) ou a parte que a fila da companhia dá a ela (entre todos) */
      var inp = bloco.querySelector('.extra-vol-bloco-total'), texto = bloco.querySelector('.nova-extra-bloco-recebeu');
      var recebeu = porUnidade ? (+p2.unidades[un.id] || 0) : soma(daqui, sugestao);
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
      var e = bloco.querySelector('.ne-entregues'), ent = soma(daqui, conc);
      e.textContent = ent;
      pintar(e, cor(recebeu, daqui));
      bloco.querySelector('.ne-sobram').textContent = recebeu - ent;
      /* a fila: a da companhia (entre todos) ou a da unidade (por unidades) */
      var bloquinho = bloco.querySelector('.extra-vol-bloquinho');
      daqui.forEach(function (m) {
        bloquinho.appendChild(linha(m, porUnidade ? daqui.indexOf(m) + 1 : lista.indexOf(m) + 1));
        if (perde(m)) {
          var av = RW.tpl('tpl-ne-p2-aviso');
          av.textContent = msg().retiraCota(conc(m), diasDe(m), ajuste);
          bloquinho.appendChild(av);
        }
      });
      alvo.appendChild(bloco);
    });
    q('#p2-vazio').classList.toggle('oculto', visiveis.length > 0);
    /* o rodapé: repartido acima do recebido diz onde, e o Salvar fica desligado; o Desfazer depois do Preencher */
    var perdem = lista.filter(perde).length, erro = passou();
    q('#p2-mudancas').textContent = erro || (perdem ? msg().naoSalvoRetira(perdem) : (p2.sujo ? msg().naoSalvo : ''));
    q('#p2-mudancas').classList.toggle('nova-extra-negativo', !!erro);
    q('#p2-salvar').disabled = !p2.sujo || !!erro;
    q('#p2-desfazer').classList.toggle('oculto', !p2.antes);
  }

  /* um voluntário: a fila, o militar, o pedido, o atendido em 12 meses, a sugestão, o Recebe e o que já está na escala */
  function linha(m, fila) {
    var l = RW.tpl('tpl-ne-p2-linha');
    l.querySelector('.nova-extra-fila').textContent = msg().fila(fila);
    l.querySelector('.extra-vol-grad').textContent = m.grad;
    l.querySelector('.extra-vol-nome').textContent = m.nome;
    l.querySelector('.extra-vaga-24h').classList.toggle('oculto', !m.so24);
    l.querySelector('.extra-vol-pediu').textContent = m.cotas;
    /* quem pede pela primeira vez conta como 100% na fila; a tela diz "Primeira vez" */
    var primeira = !m.pediu12;
    l.querySelector('.ne-pct').textContent = primeira ? '' : msg().porcento(Math.round(100 * (m.recebeu12 || 0) / m.pediu12));
    l.querySelector('.ne-de').textContent = primeira ? '' : msg().deCotas(m.recebeu12 || 0, m.pediu12);
    l.querySelector('.ne-primeira').classList.toggle('oculto', !primeira);
    l.querySelector('.nova-extra-sug').textContent = sugestao(m);
    l.querySelector('.extra-vol-conc-texto').textContent = conc(m);
    l.querySelector('.extra-vol-conc').classList.toggle('campo--alterado', conc(m) !== (m.concedidas || 0));
    RW.dropdownNumeros.preencher(l.querySelector('.extra-vol-conc-menu'), {
      opcoes: opcoes(m), valor: conc(m),
      aoEscolher: function (n) { p2.conc[m.cpf] = n; p2.sujo = true; desenhar(); }
    });
    l.querySelector('.extra-vol-na-escala').textContent = msg().deCotas(naGrade(m), conc(m));
    return l;
  }

  function salvar() {
    var concedidas = {}, btn = q('#p2-salvar');
    comTermo().forEach(function (m) { concedidas[m.cpf] = conc(m); });
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_cotas_salvar', {
      p_competencia: d.competencia, p_cotas_recebidas: p2.modo === 'por_unidade' ? somaUnidades() : (p2.recebidas === '' || p2.recebidas == null ? null : +p2.recebidas),
      p_repartir_por: p2.modo, p_cotas_unidades: p2.modo === 'por_unidade' ? p2.unidades : null, p_concedidas: concedidas
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.novaExtraOrg.resumo(r);
      aoSalvar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function ligar() {
    /* as cotas da companhia: a cada número, a faixa e a Sugestão se refazem */
    q('#p2-recebidas').addEventListener('input', function () {
      var v = q('#p2-recebidas').value.trim();
      p2.recebidas = v === '' ? null : (parseInt(v, 10) || 0); p2.sujo = true; desenhar(); pedirSugestao();
    });
    /* trocar o jeito: cada unidade já vem com o que ela tem repartido (onde ainda não há total); entre todos volta com a
       soma das unidades */
    todos('#p2-modo [data-modo]', function (b) {
      b.addEventListener('click', function () {
        var modo = b.getAttribute('data-modo');
        if (p2.modo === modo) return;
        if (modo === 'por_unidade') {
          d.unidades.forEach(function (un) {
            var rep = repartidoEm(un.id);
            if ((p2.unidades[un.id] == null || p2.unidades[un.id] === '') && rep > 0) p2.unidades[un.id] = rep;
          });
        } else if (somaUnidades() > 0) p2.recebidas = somaUnidades();
        p2.modo = modo; p2.sujo = true; desenhar(); pedirSugestao();
      });
    });
    /* Preencher pela sugestão: a Sugestão no Recebe de todos, na hora; o Desfazer volta ao de antes */
    q('#p2-sugestao').addEventListener('click', function () {
      p2.antes = { conc: Object.assign({}, p2.conc), sujo: p2.sujo };
      comTermo().forEach(function (m) { p2.conc[m.cpf] = sugestao(m); });
      p2.sujo = true; desenhar();
    });
    q('#p2-desfazer').addEventListener('click', function () {
      if (!p2.antes) return;
      p2.conc = p2.antes.conc; p2.sujo = p2.antes.sujo; p2.antes = null; desenhar();
    });
    q('#p2-cancelar').addEventListener('click', function () { p2 = null; desenhar(); });
    q('#p2-salvar').addEventListener('click', salvar);
  }

  function mostrar(dados, conteudo, recarregar) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    if (ligado !== el) {
      ligado = el; p2 = null; ligar();
      /* com cotas não salvas, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return !!(el && el.isConnected && p2 && p2.sujo); });
    }
    desenhar();
  }

  RW.novaExtraCotas = { mostrar: mostrar, reiniciar: function () { p2 = null; } };
})();
