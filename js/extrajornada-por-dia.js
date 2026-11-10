/* ============================================================
   EXTRAJORNADA — passos 3 e 4: a Agenda e o Calendário
   Na Agenda, os dias nas linhas e os pelotões nas colunas (os moldes
   da Agenda da Escala); no Calendário, o mês no calendário do site
   (geral-calendario-mes, o mesmo da Escala). Em cada dia, cada
   pelotão (a companhia só quando tem extra) igual ao do Calendário
   da Escala (na Agenda, sem o nome, que fica no alto da coluna): o nome com a
   cor do dia (verde, vermelho, amarelo), o gráfico do dia já com as
   extras (a régua de cada unidade no mês; o painel do dia mostra o sem
   e o com) e uma vaga por militar, com o horário
   escrito (sem nenhum, ele fica no dia até o Salvar). O bloco com
   mudança ainda não salva leva a borda tracejada da Escala. O clique
   no bloco fica com a edição rápida (extrajornada-celula.js): o nome
   abre o cartão com a barra; o pelotão mostra Adicionar militar e
   Abrir o painel do dia. Lê o rascunho por RosterWork.extrajornadaGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaPorDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var alvo = null;         // o lugar do calendário (#p3-cal)
  var diasCal = {};        // a célula de cada dia no calendário { data: celula }
  var desenhadas = '';     // as unidades do calendário desenhado (ids), para saber quando refazer o mês
  /* o que no bloco cuida do próprio clique: o militar em foco, os nomes, o cartão aberto, a barra e as ações */
  var PROPRIOS = '.extrajornada-foco, .extrajornada-escolhivel, .extrajornada-cartao--aberto, .extrajornada-cartao-barra, .extrajornada-bloco-acoes';

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }
  function dia() { return RW.extrajornadaDia; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  /* ---------- a Agenda (também a da aba Extras do mês) ---------- */
  /* o mês (comp, AAAA-MM-01) com os moldes da Agenda da Escala: os dias nas linhas e as unidades nas colunas;
     celula(unidade, dia) devolve a célula de cada uma (feita a partir de celulaVazia). Devolve a grade (.escala-mes) */
  function agenda(lugar, comp, unidades, celula) {
    lugar.textContent = '';
    var wrap = RW.tpl('tpl-escala-mes'), grade = wrap.querySelector('.escala-mes-grade');
    grade.classList.add('escala-mes-grade--' + Math.min(8, Math.max(1, unidades.length)));
    var cab = RW.tpl('tpl-escala-mes-cabecalho');
    unidades.forEach(function (un) { var t = RW.tpl('tpl-escala-mes-titulo'); t.textContent = un.nome; cab.appendChild(t); });
    grade.appendChild(cab);
    var ano = +comp.slice(0, 4), mes = +comp.slice(5, 7) - 1, fim = new Date(ano, mes + 1, 0).getDate();
    for (var n = 1; n <= fim; n++) {
      var data = new Date(ano, mes, n), k = comp.slice(0, 8) + String(n).padStart(2, '0');
      var linha = RW.tpl('tpl-escala-mes-linha');
      linha.querySelector('.escala-mes-data-semana').textContent = SEMANA[data.getDay()];
      linha.querySelector('.escala-mes-data-numero').textContent = String(n);
      linha.classList.toggle('escala-mes-linha--fds', data.getDay() === 0 || data.getDay() === 6);
      linha.setAttribute('data-agenda-dia', k);
      unidades.forEach(function (un) { linha.appendChild(celula(un, k)); });
      grade.appendChild(linha);
    }
    lugar.appendChild(wrap);
    return wrap;
  }
  /* a célula vazia de uma unidade num dia (com a unidade e o dia, que o seletor de unidade do celular lê) */
  function celulaVazia(un, k) {
    var cel = RW.tpl('tpl-escala-mes-celula');
    cel.dataset.iso = k;
    cel.dataset.unidadeId = un.id;
    return cel;
  }

  /* as unidades do calendário: as do dia a dia e a do militar em foco (para as bolinhas dele) */
  function unidadesDoCalendario() {
    var cpf = RW.extrajornadaLista.foco(), m = cpf ? u().militar(cpf) : null;
    return u().doCalendario(G().vagas().concat(m ? [{ unidade: m.unidade_id }] : []));
  }

  function desenhar(lugar) {
    alvo = lugar;
    var d = G().dados(), alocs = G().efetivas(), unidades = unidadesDoCalendario();
    /* com um militar em foco, os outros nomes somem (as vagas e a escala) */
    alvo.classList.toggle('extrajornada-dist-cal--foco', !!RW.extrajornadaLista.foco());
    diasCal = {};
    desenhadas = unidades.map(function (un) { return un.id; }).join(',');
    G().calcularPicos(alocs);
    var marcados = G().naoSalvos();
    /* a Agenda: os dias nas linhas e os pelotões nas colunas, a mesma célula (no celular, um pelotão por tela) */
    if (RW.extrajornada.modo() === 'agenda') {
      RW.extrajornada.grade.unidades(unidades);
      var grade = agenda(alvo, d.competencia, unidades, function (un, k) { return celulaAgenda(un, k, alocs, marcados); });
      Array.prototype.forEach.call(grade.querySelectorAll('[data-agenda-dia]'), function (l) {
        var k = l.getAttribute('data-agenda-dia');
        diasCal[k] = l;
        marcarImpedido(l, k);
      });
      RW.extrajornada.grade.aplicar(grade);
      if (RW.escalasCelula) RW.escalasCelula.ativarGraficos(grade);
      mostrarAberto(false);
      return;
    }
    RW.extrajornada.grade.unidades(null);
    /* os pelotões lado a lado ou um embaixo do outro: a escolha da pessoa, a mesma da Escala (geral-visao-grade.js) */
    var ladoALado = !!(RW.visaoGrade && RW.visaoGrade.disposicao() === 'lado');
    RW.geralCalendarioMes.renderizar(alvo, { dataRef: G().dataDe(d.competencia), unidadesPorDia: Math.max(1, unidades.length), ladoALado: ladoALado, aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = iso(data);
      diasCal[k] = cel;
      unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs, marcados)); });
      marcarImpedido(cel, k);
    } });
    var wrap = alvo.querySelector('.geral-calendario-mes');
    if (wrap && RW.escalasCelula) RW.escalasCelula.ativarGraficos(wrap);
    /* o calendário refeito abre no começo: com o painel do dia aberto, fica no bloco dele */
    mostrarAberto(false);
  }

  /* o bloco do pelotão do dia aberto no painel (ou o da edição rápida: o marcado ou o do cartão aberto) inteiro à vista,
     pelo lado mais perto, abaixo do número do dia (que gruda no alto) (geral-periodo.js); já inteiro, não mexe */
  function mostrarAberto(suave) {
    var ab = dia().aberto() || RW.extrajornadaCelula.ativo(), wrap = alvo && (alvo.querySelector('.geral-calendario-mes') || alvo.querySelector('.escala-mes'));
    var bloco = ab && wrap ? wrap.querySelector('[data-uid="' + ab.uid + '"][data-dia="' + ab.data + '"]') : null;
    if (!bloco || !RW.periodo || !RW.periodo.mostrarInteiro) return;
    var d = bloco.closest('.geral-calendario-mes-dia');
    RW.periodo.mostrarInteiro(wrap, bloco, {
      fixo: d ? [wrap.querySelector('.geral-calendario-mes-cabecalho'), d.querySelector('.geral-calendario-mes-dia-topo')]
        : [wrap.querySelector('.escala-mes-cabecalho')],
      suave: suave
    });
  }

  /* o bloco do pelotão no dia do Calendário, o mesmo do Calendário da Escala: o nome com a cor do dia e o miolo
     (preencher); clicar no bloco abre o painel do dia. marcados = os blocos com mudança não salva
     (RosterWork.extrajornadaGrade.naoSalvos) */
  function blocoUnidade(un, k, alocs, marcados) {
    var b = RW.tpl('tpl-escala-calendario-unidade');
    var falta = G().faltaDoDia(un.id, k, alocs);
    var nome = b.querySelector('.escala-calendario-unidade-nome');
    nome.textContent = un.nome;
    var cor = G().corDe(falta);
    if (cor) nome.classList.add('extrajornada-uni-nome', 'extrajornada-uni-nome--' + cor);
    clicavel(b, un, k);
    preencher(b.querySelector('.escala-mes-celula'), un, k, alocs, marcados, falta, true);
    return b;
  }

  /* a célula da Agenda: a mesma do bloco do Calendário, sem o nome (o pelotão está no alto da coluna) */
  function celulaAgenda(un, k, alocs, marcados) {
    var cel = celulaVazia(un, k);
    clicavel(cel, un, k);
    preencher(cel, un, k, alocs, marcados, G().faltaDoDia(un.id, k, alocs));
    return cel;
  }

  /* o pelotão no dia (clique, Enter ou espaço) fica com a edição rápida: marca o bloco ou abre o painel do dia
     (extrajornada-celula.js). Os nomes, o cartão aberto, a barra e as ações cuidam dos próprios cliques */
  function clicavel(b, un, k) {
    b.setAttribute('data-uid', un.id);
    b.setAttribute('data-dia', k);
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', un.nome + ', ' + u().br(k));
    b.addEventListener('click', function (ev) { if (!ev.target.closest(PROPRIOS)) RW.extrajornadaCelula.cliqueNoBloco(un.id, k); });
    b.addEventListener('keydown', function (ev) { if (ev.target === b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); RW.extrajornadaCelula.cliqueNoBloco(un.id, k); } });
  }

  /* o miolo do pelotão no dia (o bloco do Calendário e a célula da Agenda): o gráfico do dia com as extras (sem extra, a
     escala como está) e uma vaga por militar com o horário escrito. curto: a célula pequena do Calendário, com o posto
     curto (RosterWork.escalasCelula.postoCurto) */
  function preencher(cel, un, k, alocs, marcados, falta, curto) {
    var ab = dia().aberto();
    cel.classList.toggle('escala-mes-celula--selecionada', !!ab && ab.uid === un.id && ab.data === k);
    /* as vagas do dia, inclusive as sem horário (vão para o fim), na ordem do primeiro horário */
    var aqui = G().vagas().filter(function (a) { return +a.unidade === un.id && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, G().blocos(x)) - Math.min.apply(null, G().blocos(y)) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
    var comExtra = aqui.some(function (a) { return a.blocos.length; });
    /* o gráfico (com as extras) e, com o filtro Escala completa, quem está de serviço no dia, em cima das extras */
    var antes = G().antesDe(un.id, k), F = RW.extrajornadaFiltros;
    if (antes) {
      var dep = comExtra ? G().depoisDe(un.id, k, alocs, falta) : null;
      var cob = dep ? dep.cobertura : antes, erro = dep ? dep.erro : G().erroAntes(un.id, k);
      if (F.escalaCompleta() && RW.escalasCelula) RW.escalasCelula.preencherCelula(cel, cob, erro, G().deServico(un.id, k), G().pico(un.id) || 1, null, { postoCurto: !!curto });
      else {
        var g = G().grafico(cob, un.id, erro);
        if (g) cel.appendChild(g);
      }
    }
    var foco = RW.extrajornadaLista.foco();
    aqui.forEach(function (a) {
      var vg = u().vaga(a, un.id, curto), m = u().militar(a.cpf);
      vg.setAttribute('data-cpf', a.cpf);
      /* quem passou da cota: o cartão em vermelho em todos os dias dele, até acertar (o Salvar espera) */
      vg.classList.toggle('extrajornada-vaga--passou', !!m && G().usadas(a.cpf, alocs) > (m.concedidas || 0));
      if (a.cpf === foco) vg.classList.add('extrajornada-foco');
      cel.appendChild(vg);
    });
    if (foco) focoNoBloco(cel, un.id, k, foco, curto);
    else RW.extrajornadaCelula.decorar(cel, un.id, k, curto);
    /* a mudança ainda não salva: a borda tracejada no bloco, a mesma da Escala */
    if (marcados[un.id + '|' + k]) cel.classList.add('escala-celula--nao-salvo');
  }

  /* o militar em foco no bloco de cada pelotão, em todos os dias: onde ele tem extra, o cartão de sempre (posto por
     preencher); onde não tem, só a bolinha do que ele marcou no pedido (verde quer, vermelho não quer, cinza sem
     preferência), com a dica. O clique no cartão ou na bolinha abre o cartão, com o nome, e a barra de horário embaixo:
     as mesmas peças da edição rápida na célula (extrajornada-celula.js, um aberto por vez); onde ele tem extra, também
     o seletor de horas, o cadeado e a lixeira, como no painel do dia. No dia em que ele não pode, nada no bloco (o dia
     todo fica apagado, com o motivo no alto: marcarImpedido). Já de extra em outro pelotão no dia, a barra daqui fica
     apagada e sem clique, e a dica diz para tirar de lá antes (é uma extra por dia). Passar da cota fica no rascunho, e
     o Salvar espera (RosterWork.extrajornadaGrade.mudar). curto: o posto curto da célula pequena do Calendário */
  function focoNoBloco(cel, uid, k, cpf, curto) {
    var m = u().militar(cpf), v = G().vagaDe(cpf, k), C = RW.extrajornadaCelula;
    if (!m || (!v && G().impedimento(m, k))) return;
    var outro = !!v && +v.unidade !== uid, pref = u().pref(m, k), aberto = C.estaAberto(uid, k, cpf);
    var cartao = cel.querySelector('.extrajornada-vaga.extrajornada-foco');
    if (!cartao) {
      cartao = RW.tpl('tpl-extrajornada-foco-ponto');
      if (pref !== 'sem') cartao.querySelector('.extrajornada-painel-ponto').classList.add('extrajornada-painel-ponto--' + pref);
      cartao.setAttribute('data-dica', msg().prefDia[pref]);
      cartao.querySelector('.extrajornada-vaga-grad').textContent = curto && RW.escalasCelula ? RW.escalasCelula.postoCurto(m.grad) : (m.grad || '');
      cartao.querySelector('.extrajornada-vaga-nome').textContent = m.nome || '';
      cartao.querySelector('.extrajornada-vaga-id').classList.toggle('oculto', !aberto);
      cel.appendChild(cartao);
    }
    if (!aberto) { C.ligarClique(cartao, function () { C.abrir(uid, k, cpf); }); return; }
    /* a barra do foco é do foco: clicar nela não tira ninguém do foco (extrajornada-lista.js) */
    var linha = C.barraEmbaixo(cartao, m, k, uid, v && !outro ? G().blocos(v) : [], outro);
    linha.classList.add('extrajornada-foco');
    if (outro) {
      linha.classList.add('extrajornada-cartao-barra--outro');
      linha.setAttribute('data-dica', msg().jaEmOutro((u().unidade(v.unidade) || {}).nome || ''));
    }
  }

  /* o dia em que o militar em foco não pode (serviço, folga, férias e afins): o dia inteiro apagado e o motivo num selo só,
     no centro da linha do número (na Agenda, junto da data) */
  function marcarImpedido(dia, k) {
    var cpf = RW.extrajornadaLista.foco(), m = cpf ? u().militar(cpf) : null;
    var impede = m && !G().vagaDe(cpf, k) ? G().impedimento(m, k) : null;
    dia.classList.toggle('extrajornada-dia--impedido', !!impede);
    var lugar = dia.querySelector('.geral-calendario-mes-dia-topo, .escala-mes-data');
    var velho = lugar && lugar.querySelector('.extrajornada-dia-selo');
    if (velho) velho.parentNode.removeChild(velho);
    if (!impede || !lugar) return;
    var selo = RW.tpl('tpl-extrajornada-dia-selo');
    selo.textContent = impede;
    lugar.appendChild(selo);
  }

  /* refaz só os blocos de um dia (a régua das barras muda ou a companhia entra ou sai do calendário: refaz o mês) */
  function atualizarDia(k) {
    var cel = diasCal[k];
    if (!cel || !cel.isConnected) return;
    var alocs = G().efetivas(), unidades = unidadesDoCalendario(), cresceu = false;
    unidades.forEach(function (un) {
      var dep = G().depoisDe(un.id, k, alocs, G().faltaDoDia(un.id, k, alocs));
      if (dep && dep.cobertura.some(function (n) { return n > G().pico(un.id); })) cresceu = true;
    });
    if (cresceu || unidades.map(function (un) { return un.id; }).join(',') !== desenhadas) { desenhar(alvo); return; }
    Array.prototype.forEach.call(cel.querySelectorAll('[data-uid]'), function (b) { b.parentNode.removeChild(b); });
    var marcados = G().naoSalvos(), agenda = cel.hasAttribute('data-agenda-dia');
    unidades.forEach(function (un) { cel.appendChild(agenda ? celulaAgenda(un, k, alocs, marcados) : blocoUnidade(un, k, alocs, marcados)); });
    marcarImpedido(cel, k);
    /* na Agenda do celular, as células novas das outras unidades somem de novo */
    if (agenda) RW.extrajornada.grade.aplicar(cel.closest('.escala-mes'));
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(cel);
    /* o bloco mudado pode ter crescido para fora da vista */
    mostrarAberto(true);
  }

  /* o bloco do dia aberto no painel (ou o marcado pela edição rápida) fica em destaque */
  function marcarAberto() {
    if (!alvo) return;
    var ab = dia().aberto();
    Array.prototype.forEach.call(alvo.querySelectorAll('[data-uid][data-dia]'), function (b) {
      var cel = b.classList.contains('escala-mes-celula') ? b : b.querySelector('.escala-mes-celula');
      var uid = +b.getAttribute('data-uid'), k = b.getAttribute('data-dia');
      cel.classList.toggle('escala-mes-celula--selecionada', (!!ab && uid === ab.uid && k === ab.data) || RW.extrajornadaCelula.marcado(uid, k));
    });
  }

  RW.extrajornadaPorDia = { desenhar: desenhar, atualizarDia: atualizarDia, marcarAberto: marcarAberto, mostrarAberto: mostrarAberto,
    agenda: agenda, celulaVazia: celulaVazia,
    /* os pelotões da grade da tela (o Imprimir da grade começa com eles marcados) */
    unidades: function () { return unidadesDoCalendario(); } };
})();
