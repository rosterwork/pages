/* ============================================================
   NOVA EXTRA — passo 3: o calendário
   O mês no calendário do site (geral-calendario-mes, o mesmo da
   Escala) com, em cada dia, o bloco de cada pelotão (a companhia só
   quando tem extra) igual ao do Calendário da Escala: o nome com a
   cor do dia (verde, vermelho, amarelo), o gráfico do dia já com as
   extras (a régua de cada unidade no mês; o painel do dia mostra o sem
   e o com) e uma vaga por militar, com o horário
   escrito (sem nenhum, ele fica no dia até o Salvar). As bolinhas ficam
   no painel do dia, que abre ao clicar no bloco, e na lista dos
   voluntários. Lê o rascunho por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraPorDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var alvo = null;         // o lugar do calendário (#p3-cal)
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)
  var diasCal = {};        // a célula de cada dia no calendário { data: celula }
  var desenhadas = '';     // as unidades do calendário desenhado (ids), para saber quando refazer o mês

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }
  function dia() { return RW.novaExtraDia; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  function calcularPicos(alocs) {
    var d = G().dados(), cob = G().coberturaEscala();
    picos = {};
    d.unidades.forEach(function (un) {
      var pico = 0;
      Object.keys(cob[un.id] || {}).forEach(function (k) {
        (cob[un.id][k] || []).forEach(function (n) { if (+n > pico) pico = +n; });
      });
      alocs.forEach(function (a) {
        if (+a.unidade !== un.id) return;
        var dep = G().depoisDe(un.id, a.data, alocs, G().faltaDoDia(un.id, a.data, alocs));
        if (dep) dep.cobertura.forEach(function (n) { if (n > pico) pico = n; });
      });
      picos[un.id] = pico;
    });
  }
  function grafico(cob, uid, erro) { return RW.escalasCelula ? RW.escalasCelula.montarGrafico(cob, picos[uid] || 1, erro) : null; }

  /* as unidades do calendário: as do dia a dia e a do militar em foco (para as bolinhas dele) */
  function unidadesDoCalendario() {
    var cpf = RW.novaExtraLista.foco(), m = cpf ? u().militar(cpf) : null;
    return u().doCalendario(G().vagas().concat(m ? [{ unidade: m.unidade_id }] : []));
  }

  function desenhar(lugar) {
    alvo = lugar;
    var d = G().dados(), alocs = G().efetivas(), unidades = unidadesDoCalendario();
    /* com um militar em foco, os outros nomes somem (as vagas e a escala) */
    alvo.classList.toggle('nova-extra-dist-cal--foco', !!RW.novaExtraLista.foco());
    diasCal = {};
    desenhadas = unidades.map(function (un) { return un.id; }).join(',');
    calcularPicos(alocs);
    RW.geralCalendarioMes.renderizar(alvo, { dataRef: G().dataDe(d.competencia), unidadesPorDia: Math.max(1, unidades.length), aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = iso(data);
      diasCal[k] = cel;
      unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    } });
    var wrap = alvo.querySelector('.geral-calendario-mes');
    if (wrap && RW.escalasCelula) RW.escalasCelula.ativarGraficos(wrap);
  }

  /* o bloco do pelotão no dia, o mesmo do Calendário da Escala: o nome com a cor do dia, o gráfico do dia com as
     extras (sem extra, a escala como está) e uma vaga por militar com o horário escrito; clicar no bloco abre o painel
     do dia */
  function blocoUnidade(un, k, alocs) {
    var b = RW.tpl('tpl-escala-calendario-unidade');
    var ab = dia().aberto();
    var cel = b.querySelector('.escala-mes-celula');
    b.setAttribute('data-uid', un.id);
    b.setAttribute('data-dia', k);
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', un.nome + ', ' + u().br(k));
    cel.classList.toggle('escala-mes-celula--selecionada', !!ab && ab.uid === un.id && ab.data === k);
    var falta = G().faltaDoDia(un.id, k, alocs);
    var nome = b.querySelector('.escala-calendario-unidade-nome');
    nome.textContent = un.nome;
    var cor = G().corDe(falta);
    if (cor) nome.classList.add('nova-extra-uni-nome', 'nova-extra-uni-nome--' + cor);
    /* as vagas do dia, inclusive as sem horário (vão para o fim), na ordem do primeiro horário */
    var aqui = G().vagas().filter(function (a) { return +a.unidade === un.id && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, G().blocos(x)) - Math.min.apply(null, G().blocos(y)) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
    var comExtra = aqui.some(function (a) { return a.blocos.length; });
    /* o gráfico (com as extras) e, com o filtro Escala completa, quem está de serviço no dia, em cima das extras */
    var antes = G().antesDe(un.id, k), F = RW.novaExtraFiltros;
    if (antes) {
      var dep = comExtra ? G().depoisDe(un.id, k, alocs, falta) : null;
      var cob = dep ? dep.cobertura : antes, erro = dep ? dep.erro : G().erroAntes(un.id, k);
      if (F.escalaCompleta() && RW.escalasCelula) RW.escalasCelula.preencherCelula(cel, cob, erro, G().deServico(un.id, k), picos[un.id] || 1);
      else {
        var g = grafico(cob, un.id, erro);
        if (g) cel.appendChild(g);
      }
    }
    var foco = RW.novaExtraLista.foco();
    aqui.forEach(function (a) {
      var vg = u().vaga(a, un.id);
      if (a.cpf === foco) vg.classList.add('nova-extra-foco');
      cel.appendChild(vg);
    });
    if (foco) focoNoBloco(cel, un.id, k, foco);
    b.addEventListener('click', function () { dia().abrir(un.id, k); });
    b.addEventListener('keydown', function (ev) { if (ev.target === b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); dia().abrir(un.id, k); } });
    return b;
  }

  /* o militar em foco no bloco de cada pelotão, em todos os dias: as bolinhas grandes numa linha só delas, embaixo do
     nome quando ele já está ali, na cor do que ele marcou no pedido; no dia em que não pode, o motivo (serviço, folga,
     férias e afins). Já de extra em outro pelotão no dia, as bolinhas daqui ficam apagadas e a dica diz para tirar de lá
     antes (é uma extra por dia). As bolinhas seguem a trava das cotas (RosterWork.novaExtraGrade.mudar) */
  function focoNoBloco(cel, uid, k, cpf) {
    var m = u().militar(cpf), v = G().vagaDe(cpf, k);
    if (!m) return;
    var impede = v ? null : G().impedimento(m, k);
    if (impede) {
      var selo = RW.tpl('tpl-ne-foco-selo');
      selo.querySelector('.selo').textContent = impede;
      cel.appendChild(selo);
      return;
    }
    var linha = RW.tpl('tpl-ne-foco-marcas'), outro = !!v && +v.unidade !== uid;
    linha.classList.add('nova-extra-foco-linha--' + u().pref(m, k));
    var marcas = linha.querySelector('.escala-extra-marcas');
    RW.novaExtraDia.ligarMarcas(marcas, m, k, v && !outro ? G().blocos(v) : [], uid);
    if (outro) {
      linha.classList.add('nova-extra-foco-linha--outro');
      linha.setAttribute('data-dica', msg().jaEmOutro((u().unidade(v.unidade) || {}).nome || ''));
      Array.prototype.forEach.call(marcas.querySelectorAll('.escala-extra-marca'), function (bt) { bt.disabled = true; });
    }
    cel.appendChild(linha);
  }

  /* refaz só os blocos de um dia (a régua das barras muda ou a companhia entra ou sai do calendário: refaz o mês) */
  function atualizarDia(k) {
    var cel = diasCal[k];
    if (!cel || !cel.isConnected) return;
    var alocs = G().efetivas(), unidades = unidadesDoCalendario(), cresceu = false;
    unidades.forEach(function (un) {
      var dep = G().depoisDe(un.id, k, alocs, G().faltaDoDia(un.id, k, alocs));
      if (dep && dep.cobertura.some(function (n) { return n > (picos[un.id] || 0); })) cresceu = true;
    });
    if (cresceu || unidades.map(function (un) { return un.id; }).join(',') !== desenhadas) { desenhar(alvo); return; }
    Array.prototype.forEach.call(cel.querySelectorAll('[data-uid]'), function (b) { b.parentNode.removeChild(b); });
    unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(cel);
  }

  /* o bloco do dia aberto no painel fica em destaque */
  function marcarAberto() {
    if (!alvo) return;
    var ab = dia().aberto();
    Array.prototype.forEach.call(alvo.querySelectorAll('[data-uid][data-dia]'), function (b) {
      b.querySelector('.escala-mes-celula').classList.toggle('escala-mes-celula--selecionada', !!ab && +b.getAttribute('data-uid') === ab.uid && b.getAttribute('data-dia') === ab.data);
    });
  }

  RW.novaExtraPorDia = { desenhar: desenhar, atualizarDia: atualizarDia, marcarAberto: marcarAberto, grafico: grafico };
})();
