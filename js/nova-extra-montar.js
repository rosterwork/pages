/* ============================================================
   NOVA EXTRA — passo 3: Distribuição (Por dia e Por militar)
   Por dia: o calendário do mês (geral-calendario-mes) com um bloco
   por unidade em cada dia: a barra antes (a escala sem extra, da
   leitura do mês da Escala), a barra depois (a conta com as extras:
   soma 1 por extra no horário e o vermelho sai onde a extra cobre a
   falta; falta de condutor só com a CNH que a viatura pede) e só as
   extras. Clicar no bloco abre o painel do dia daquela unidade, com
   os moldes da aba Extrajornada do painel do dia: a cobertura, a
   falta que sobra e a lista em grupos, com os 4 horários que marcam
   e desmarcam. Por militar: quem tem cota, as cotas e os dias.
   Tudo fica num rascunho até o Salvar (nova_extra_distribuicao_salvar);
   "Preencher pela sugestão" pede o rascunho ao motor (nova_extra_sugerir).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraMontar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'];
  var SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var SEM_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var GRUPOS = ['neste', 'querem', 'disp', 'naoQuerem', 'indisp'];
  var FECHADOS = { naoQuerem: true, indisp: true };

  var d = null, el = null, aoSalvar = null;
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque } (blocos [] = tira)
  var sugeridas = [];      // as chaves que a última sugestão pôs
  var vista = 'dia';
  var aberto = null;       // o painel do dia: { uid, data }
  var abertos = {};        // no painel, os outros dias abertos embaixo do nome { cpf: true }
  var gruposAbertos = {};  // no painel, os grupos fechados que o Mostrar abriu { grupo: true }
  var escala = null;       // a escala do mês sem extra: { comp, cobertura, erro }
  var escalaSeq = 0;
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)
  var diasCal = {};        // a célula de cada dia no calendário { data: celula }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function chave(cpf, data) { return cpf + '|' + data; }
  function dataDe(k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function somaDia(k, n) { var x = dataDe(k); x.setDate(x.getDate() + n); return iso(x); }
  function ultimoDia() { var c = d.competencia; return iso(new Date(+c.slice(0, 4), +c.slice(5, 7), 0)); }
  function diasDoMes() {
    var lista = [], k = d.competencia, fim = ultimoDia();
    while (k <= fim) { lista.push(k); k = somaDia(k, 1); }
    return lista;
  }
  function dataLonga(k) { var x = dataDe(k); return SEMANA[x.getDay()] + ', ' + x.getDate() + ' de ' + MESES[x.getMonth()]; }

  /* as alocações como ficam com o rascunho */
  function efetivas() {
    var mapa = {};
    d.alocacoes.forEach(function (a) { mapa[chave(a.cpf, a.data)] = a; });
    Object.keys(mud).forEach(function (k) { mapa[k] = mud[k]; });
    return Object.keys(mapa).map(function (k) { return mapa[k]; }).filter(function (a) { return a.blocos && a.blocos.length; });
  }
  function alocDe(cpf, data) {
    var k = chave(cpf, data);
    if (k in mud) return mud[k].blocos.length ? mud[k] : null;
    return d.alocacoes.filter(function (a) { return a.cpf === cpf && a.data === data; })[0] || null;
  }
  function usadas(cpf, alocs) { return (alocs || efetivas()).filter(function (a) { return a.cpf === cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  function voluntarios() { return d.militares.filter(function (m) { return m.voluntario && m.termo && (m.concedidas || 0) > 0; }); }
  function blocos(a) { return a.blocos.map(Number); }
  /* a CNH que a viatura pede ('' = qualquer uma) está entre as que ele conduz (o banco diz quais) */
  function conduz(m, cnh) { return !cnh || (m.conduz || []).indexOf(cnh) >= 0; }

  /* a falta de uma unidade num dia, por horário: base (a da escala), cond (condutor que sobra) e total
     (o que sobra com as extras: cada extra cobre primeiro um condutor que ele conduz, senão um lugar de gente) */
  function faltaDoDia(uid, k, alocs) {
    var base = (d.falta[String(uid)] || {})[k] || {};
    var pede = ((d.falta_condutor || {})[String(uid)] || {})[k] || {};
    var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; });
    var r = { base: {}, cond: {}, total: {}, cnh: [] };
    [1, 2, 3, 4].forEach(function (b) {
      var conds = (pede[String(b)] || []).slice();
      conds.forEach(function (c) { if (c && r.cnh.indexOf(c) < 0) r.cnh.push(c); });
      var gente = (base[String(b)] || 0) - conds.length;
      aqui.forEach(function (a) {
        if (blocos(a).indexOf(b) < 0) return;
        var m = u().militar(a.cpf) || {};
        for (var i = 0; i < conds.length; i++) { if (conduz(m, conds[i])) { conds.splice(i, 1); return; } }
        gente--;
      });
      r.base[b] = base[String(b)] || 0;
      r.cond[b] = conds.length;
      r.total[b] = Math.max(0, gente) + conds.length;
    });
    return r;
  }
  function somaFalta(f) { return f.total[1] + f.total[2] + f.total[3] + f.total[4]; }

  /* ---------- as barras: a escala do mês (a mesma leitura da Escala) e a conta do depois ---------- */
  function carregarEscala() {
    var ids = d.unidades.map(function (x) { return x.id; });
    var comp = d.competencia, req = ++escalaSeq;
    if (!RW.escalasDados) { escala = { comp: comp, cobertura: {}, erro: {} }; redesenhar(); return; }
    RW.escalasDados.carregar(ids, comp, ultimoDia()).then(function (r) {
      if (req !== escalaSeq || !el || !el.isConnected) return;
      escala = { comp: comp, cobertura: (r && r.cobertura) || {}, erro: (r && r.erro) || {} };
      redesenhar();
    }, function () {
      if (req !== escalaSeq) return;
      escala = { comp: comp, cobertura: {}, erro: {} };
      redesenhar();
    });
  }
  function antesDe(uid, k) { var c = escala && (escala.cobertura[uid] || {})[k]; return c && c.length === 24 ? c : null; }
  /* o depois: a escala com as extras (+1 por extra nas horas dele) e o vermelho só onde a falta sobra */
  function depoisDe(uid, k, alocs, falta) {
    var cob = antesDe(uid, k);
    if (!cob) return null;
    var err = (escala.erro[uid] || {})[k] || [], c = cob.map(Number), e = [];
    alocs.forEach(function (a) {
      if (+a.unidade !== +uid || a.data !== k) return;
      blocos(a).forEach(function (b) { for (var h = (b - 1) * 6; h < b * 6; h++) c[h]++; });
    });
    for (var h = 0; h < 24; h++) {
      var b = Math.floor(h / 6) + 1, v = Number(err[h]) || 0;
      if (v === 1 && falta.base[b] > 0 && falta.total[b] === 0) v = 0;
      e.push(v);
    }
    return { cobertura: c, erro: e };
  }
  function calcularPicos(alocs) {
    picos = {};
    d.unidades.forEach(function (un) {
      var pico = 0;
      Object.keys(escala.cobertura[un.id] || {}).forEach(function (k) {
        (escala.cobertura[un.id][k] || []).forEach(function (n) { if (+n > pico) pico = +n; });
      });
      alocs.forEach(function (a) {
        if (+a.unidade !== un.id) return;
        var dep = depoisDe(un.id, a.data, alocs, faltaDoDia(un.id, a.data, alocs));
        if (dep) dep.cobertura.forEach(function (n) { if (n > pico) pico = n; });
      });
      picos[un.id] = pico;
    });
  }
  function grafico(cob, uid, erro) { return RW.escalasCelula ? RW.escalasCelula.montarGrafico(cob, picos[uid] || 1, erro) : null; }

  /* ---------- Por dia: o calendário ---------- */
  function desenharCalendario() {
    var alvo = q('#p3-cal');
    diasCal = {};
    if (!escala || escala.comp !== d.competencia) {
      alvo.textContent = '';
      var car = RW.tpl('tpl-escala-carregando'); if (car) alvo.appendChild(car);
      carregarEscala();
      return;
    }
    var alocs = efetivas();
    calcularPicos(alocs);
    RW.geralCalendarioMes.renderizar(alvo, { dataRef: dataDe(d.competencia), unidadesPorDia: d.unidades.length, aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = iso(data);
      diasCal[k] = cel;
      d.unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    } });
    var wrap = alvo.querySelector('.geral-calendario-mes');
    if (wrap && RW.escalasCelula) RW.escalasCelula.ativarGraficos(wrap);
  }

  function blocoUnidade(un, k, alocs) {
    var b = RW.tpl('tpl-ne-cal-uni');
    b.setAttribute('data-uid', un.id);
    b.setAttribute('data-dia', k);
    b.setAttribute('aria-label', un.nome + ', ' + u().br(k));
    b.classList.toggle('nova-extra-cal-uni--aberto', !!aberto && aberto.uid === un.id && aberto.data === k);
    b.querySelector('.nova-extra-cal-uni-nome').textContent = un.nome;
    var falta = faltaDoDia(un.id, k, alocs);
    var aqui = alocs.filter(function (a) { return +a.unidade === un.id && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, blocos(x)) - Math.min.apply(null, blocos(y)) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
    var antes = antesDe(un.id, k);
    if (antes) {
      var gA = grafico(antes, un.id, (escala.erro[un.id] || {})[k]);
      if (gA) b.querySelector('.ne-antes').appendChild(gA);
      if (aqui.length) {
        var dep = depoisDe(un.id, k, alocs, falta);
        var gD = grafico(dep.cobertura, un.id, dep.erro);
        if (gD) { b.querySelector('.nova-extra-cal-sem').classList.add('oculto'); b.querySelector('.ne-depois').appendChild(gD); }
      }
    } else b.querySelector('.nova-extra-cal-barras').classList.add('oculto');
    aqui.forEach(function (a) {
      var m = u().militar(a.cpf) || {};
      var p = RW.tpl('tpl-ne-dia-pessoa');
      p.querySelector('small').textContent = m.grad || '';
      p.querySelector('b').textContent = m.nome || a.cpf;
      p.querySelector('.ne-de').textContent = m.unidade_id && m.unidade_id !== un.id ? msg().de((u().unidade(m.unidade_id) || {}).nome || '') : '';
      p.querySelector('.ne-hora').textContent = u().horas(a.blocos);
      b.querySelector('.nova-extra-cal-extras').appendChild(p);
    });
    b.addEventListener('click', function () { abrirDia(un.id, k); });
    b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirDia(un.id, k); } });
    return b;
  }

  /* refaz só os blocos de um dia (a régua das barras muda: refaz o mês) */
  function atualizarDia(k) {
    var cel = diasCal[k];
    if (vista !== 'dia' || !cel || !escala) return;
    var alocs = efetivas(), cresceu = false;
    d.unidades.forEach(function (un) {
      var dep = depoisDe(un.id, k, alocs, faltaDoDia(un.id, k, alocs));
      if (dep && dep.cobertura.some(function (n) { return n > (picos[un.id] || 0); })) cresceu = true;
    });
    if (cresceu) { desenharCalendario(); return; }
    Array.prototype.forEach.call(cel.querySelectorAll('.nova-extra-cal-uni'), function (b) { b.parentNode.removeChild(b); });
    d.unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(cel);
  }

  function marcarAberto() {
    Array.prototype.forEach.call(el.querySelectorAll('.nova-extra-cal-uni'), function (b) {
      b.classList.toggle('nova-extra-cal-uni--aberto', !!aberto && +b.getAttribute('data-uid') === aberto.uid && b.getAttribute('data-dia') === aberto.data);
    });
  }

  /* ---------- o painel do dia (uma unidade num dia) ---------- */
  function abrirDia(uid, k) {
    RW.painel.abrir({ titulo: dataLonga(k), subtitulo: (u().unidade(uid) || {}).nome || '', aoFechar: function () { aberto = null; marcarAberto(); } });
    aberto = { uid: uid, data: k };
    abertos = {}; gruposAbertos = {};
    marcarAberto();
    desenharPainel();
  }

  function desenharPainel() {
    if (!aberto) return;
    var uid = aberto.uid, k = aberto.data, alocs = efetivas();
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    corpo.appendChild(caixaCobertura(uid, k, alocs));
    var grupos = {};
    GRUPOS.forEach(function (g) { grupos[g] = []; });
    voluntarios().forEach(function (m) { var g = grupoDe(m, uid, k, alocs); grupos[g.nome].push({ m: m, motivo: g.motivo }); });
    GRUPOS.forEach(function (g) {
      var lista = grupos[g];
      if (!lista.length) return;
      lista.sort(function (x, y) { return (x.m.unidade_id === uid ? 0 : 1) - (y.m.unidade_id === uid ? 0 : 1) || (x.m.ordem || 0) - (y.m.ordem || 0); });
      var caixa = RW.tpl('tpl-escala-extra-grupo');
      caixa.querySelector('.escala-extra-grupo-nome').textContent = msg().grupos[g];
      caixa.querySelector('.escala-extra-grupo-conta').textContent = lista.length;
      var fechado = !!FECHADOS[g] && !gruposAbertos[g];
      caixa.querySelector('.escala-extra-horas').classList.toggle('oculto', g === 'indisp');
      var mostrar = caixa.querySelector('.escala-extra-mostrar');
      mostrar.classList.toggle('oculto', !fechado);
      mostrar.addEventListener('click', function () { gruposAbertos[g] = true; desenharPainel(); });
      var linhas = caixa.querySelector('.escala-extra-grupo-linhas');
      linhas.classList.toggle('oculto', fechado);
      lista.forEach(function (x) { linhas.appendChild(g === 'indisp' ? linhaIndisponivel(x.m, uid, x.motivo) : linhaMilitar(x.m, uid, k, alocs)); });
      corpo.appendChild(caixa);
    });
  }

  /* em que grupo o militar fica no dia desta unidade */
  function grupoDe(m, uid, k, alocs) {
    var a = alocDe(m.cpf, k);
    if (a && +a.unidade === uid) return { nome: 'neste' };
    if (a) return { nome: 'indisp', motivo: msg().extraEm((u().unidade(a.unidade) || {}).nome || '') };
    var oc = (m.ocupado || {})[k];
    if (oc) return { nome: 'indisp', motivo: RW.mensagens.novaExtra.motivos[oc] || oc };
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return { nome: 'indisp', motivo: msg().expedienteDiaTodo };
    if (usadas(m.cpf, alocs) >= m.concedidas) return { nome: 'indisp', motivo: msg().semCotas };
    if ((m.nao_posso || []).indexOf(k) >= 0) return { nome: 'naoQuerem' };
    if ((m.quer || []).indexOf(k) >= 0) return { nome: 'querem' };
    return { nome: 'disp' };
  }

  function caixaCobertura(uid, k, alocs) {
    var caixa = RW.painel.criarCaixa(msg().cobertura);
    var falta = faltaDoDia(uid, k, alocs);
    var antes = antesDe(uid, k);
    if (antes) {
      var cob = RW.tpl('tpl-escala-extra-cobertura');
      var gA = grafico(antes, uid, (escala.erro[uid] || {})[k]);
      var dep = depoisDe(uid, k, alocs, falta);
      var gD = grafico(dep.cobertura, uid, dep.erro);
      if (gA) cob.querySelector('.escala-extra-cob-sem').appendChild(gA);
      if (gD) cob.querySelector('.escala-extra-cob-com').appendChild(gD);
      caixa.appendChild(cob);
    }
    var gente = [], cond = [];
    [1, 2, 3, 4].forEach(function (b) { if (falta.total[b] - falta.cond[b] > 0) gente.push(b); if (falta.cond[b] > 0) cond.push(b); });
    var tinha = falta.base[1] + falta.base[2] + falta.base[3] + falta.base[4] > 0;
    function frase(texto, classe) { var t = RW.tpl('tpl-ne-texto'); t.textContent = texto; t.classList.add(classe); caixa.appendChild(t); }
    if (gente.length) frase(msg().faltaGenteHoras(u().horas(gente)), 'nova-extra-falta-sobra');
    if (cond.length) frase(msg().faltaCondutorHoras(u().horas(cond), falta.cnh.join(', ')), 'nova-extra-falta-sobra');
    if (tinha && !gente.length && !cond.length) frase(msg().faltaCoberta, 'nova-extra-falta-ok');
    if (RW.escalasCelula) setTimeout(function () { RW.escalasCelula.desenharGraficos(caixa); }, 0);
    return caixa;
  }

  function linhaMilitar(m, uid, k, alocs) {
    var lin = RW.tpl('tpl-escala-extra-militar');
    var ponto = lin.querySelector('.escala-extra-ponto');
    if ((m.quer || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--quer');
    else if ((m.nao_posso || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--nao');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    if (m.unidade_id !== uid) {
      var un = lin.querySelector('.escala-extra-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
    }
    var a = alocDe(m.cpf, k), marcados = a ? blocos(a) : [];
    var quem = lin.querySelector('.escala-extra-quem');
    var selos = RW.tpl('tpl-ne-selos');
    function selo(texto, classe) { var s = RW.tpl('tpl-ne-selo'); s.textContent = texto; if (classe) s.classList.add(classe); selos.appendChild(s); }
    if ((m.ocupado || {})[somaDia(k, -1)] === 'servico') selo(msg().saiServico);
    if ((m.ocupado || {})[somaDia(k, 1)] === 'servico') selo(msg().entraServico);
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && livres.length && livres.length < 4) {
      selo(msg().expedienteAte(INI[livres[0] - 1]), marcados.some(function (b) { return livres.indexOf(b) < 0; }) ? 'selo--alerta' : '');
    }
    if (m.so24) selo(msg().so24);
    var pede = ((d.falta_condutor || {})[String(uid)] || {})[k] || {};
    if (Object.keys(pede).some(function (b) { return pede[b].some(function (c) { return conduz(m, c); }); })) selo(msg().condutor, 'selo--sucesso');
    if (selos.children.length) quem.appendChild(selos);
    if (a && a.origem === 'sugestao' && a.porque && a.porque.length) {
      a.porque.forEach(function (p) { var t = RW.tpl('tpl-ne-texto'); t.textContent = p; quem.appendChild(t); });
    }

    var outros = alocs.filter(function (x) { return x.cpf === m.cpf && x.data !== k; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var dias = lin.querySelector('.escala-extra-dias');
    outros.forEach(function (x) {
      var chip = RW.tpl('tpl-escala-extra-dia');
      chip.querySelector('.escala-extra-dia-texto').textContent = msg().diaOutro(x.data.slice(8, 10));
      chip.querySelector('.escala-extra-dia-horas').textContent = msg().horasN(x.blocos.length * 6);
      dias.appendChild(chip);
    });
    dias.disabled = !outros.length;
    var usou = usadas(m.cpf, alocs), passou = usou > m.concedidas;
    var cota = lin.querySelector('.escala-extra-cota');
    cota.textContent = msg().deCotas(usou, m.concedidas);
    cota.classList.toggle('escala-extra-cota--erro', passou);
    var aberta = outros.length && (abertos[m.cpf] || passou);
    dias.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    dias.addEventListener('click', function () { abertos[m.cpf] = !aberta; desenharPainel(); });

    ligarMarcas(lin.querySelector('.escala-extra-marcas'), m, k, marcados, uid);
    var lista = lin.querySelector('.escala-extra-outros');
    if (aberta) {
      lista.classList.remove('oculto');
      outros.forEach(function (x) {
        var o = RW.tpl('tpl-escala-extra-outro');
        o.querySelector('.escala-extra-outro-dia').textContent = msg().diaSemana(x.data.slice(8, 10), SEM_CURTA[dataDe(x.data).getDay()]);
        ligarMarcas(o.querySelector('.escala-extra-marcas'), m, x.data, blocos(x), +x.unidade);
        lista.appendChild(o);
      });
    }
    return lin;
  }

  /* os 4 horários: clicar marca ou desmarca (quem só quer 24 h vai com os 4 juntos) */
  function ligarMarcas(caixa, m, k, marcados, uid) {
    Array.prototype.forEach.call(caixa.querySelectorAll('.escala-extra-marca'), function (bt) {
      var b = +bt.getAttribute('data-bloco'), on = marcados.indexOf(b) >= 0;
      bt.classList.toggle('escala-extra-marca--on', on);
      bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      bt.addEventListener('click', function () {
        var novo = m.so24 ? (marcados.length ? [] : [1, 2, 3, 4]) : (on ? marcados.filter(function (x) { return x !== b; }) : marcados.concat([b]));
        mudar(m, k, novo, uid);
      });
    });
  }

  function linhaIndisponivel(m, uid, motivo) {
    var lin = RW.tpl('tpl-escala-extra-indisponivel');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    if (m.unidade_id !== uid) {
      var un = lin.querySelector('.escala-extra-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
    }
    lin.querySelector('.escala-extra-motivo-texto').textContent = motivo || '';
    return lin;
  }

  function mudar(m, k, novos, unidade) {
    var base = d.alocacoes.filter(function (a) { return a.cpf === m.cpf && a.data === k; })[0];
    var novo = { cpf: m.cpf, data: k, unidade: +unidade, blocos: novos.slice().sort(), origem: 'admin', porque: null };
    if (base && +base.unidade === novo.unidade && JSON.stringify(blocos(base).sort()) === JSON.stringify(novo.blocos)) delete mud[chave(m.cpf, k)];
    else if (!base && !novos.length) delete mud[chave(m.cpf, k)];
    else mud[chave(m.cpf, k)] = novo;
    atualizarDia(k);
    redesenhar(true);
  }

  /* ---------- Por militar ---------- */
  function desenharMilitares() {
    var tb = q('#p3-mil-lista');
    tb.textContent = '';
    var alocs = efetivas();
    var ordemUni = d.unidades.map(function (x) { return x.id; });
    var lista = voluntarios().sort(function (x, y) { return ordemUni.indexOf(x.unidade_id) - ordemUni.indexOf(y.unidade_id) || (x.ordem || 0) - (y.ordem || 0); });
    lista.forEach(function (m) {
      var tr = RW.tpl('tpl-ne-pm-linha');
      tr.querySelector('small').textContent = m.grad;
      tr.querySelector('b').textContent = m.nome;
      tr.querySelector('.ne-uni').textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      var usou = usadas(m.cpf, alocs);
      tr.querySelector('.ne-cotas').textContent = msg().deCotas(usou, m.concedidas);
      tr.querySelector('.ne-cotas').classList.toggle('nova-extra-negativo', usou > m.concedidas);
      var dias = tr.querySelector('.nova-extra-pm-dias');
      alocs.filter(function (a) { return a.cpf === m.cpf; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; }).forEach(function (a) {
        var bt = RW.tpl('tpl-ne-pm-dia');
        bt.textContent = msg().pmDia(u().br(a.data), a.blocos.length * 6);
        bt.addEventListener('click', function () { abrirDia(+a.unidade, a.data); });
        dias.appendChild(bt);
      });
      if (!dias.children.length) dias.textContent = msg().nenhumDia;
      tb.appendChild(tr);
    });
    q('#p3-mil-vazio').classList.toggle('oculto', lista.length > 0);
  }

  /* ---------- sugestão, salvar e o resto ---------- */
  function sugerir() {
    var btn = q('#p3-sugerir');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_sugerir', { p_competencia: d.competencia, p_atuais: efetivas() }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      sugeridas = [];
      var n24 = 0, emenda = 0, fora = 0, cotas = 0;
      r.propostas.forEach(function (p) {
        var k = chave(p.cpf, p.data);
        mud[k] = { cpf: p.cpf, data: p.data, unidade: p.unidade, blocos: p.blocos, origem: 'sugestao', porque: p.porque };
        sugeridas.push(k);
        cotas += p.blocos.length;
        if (p.blocos.length === 4) n24++;
        if (p.porque.some(function (x) { return /^Emenda/.test(x); })) emenda++;
        if (p.porque.some(function (x) { return /^Em outro/.test(x); })) fora++;
      });
      var sobra = r.nao_coube.map(function (x) { return msg().sobrou(u().nome(x.cpf), x.faltam, x.motivo); }).join(' ');
      q('#p3-nota').textContent = msg().sugestaoFeita(cotas, n24, emenda, fora) + (sobra ? ' ' + sobra : '');
      q('#p3-nota').classList.remove('oculto');
      redesenhar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function desfazerSugestao() {
    sugeridas.forEach(function (k) { if (mud[k] && mud[k].origem === 'sugestao') delete mud[k]; });
    sugeridas = [];
    q('#p3-nota').classList.add('oculto');
    redesenhar();
  }

  function salvar() {
    var btn = q('#p3-salvar');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_distribuicao_salvar', {
      p_competencia: d.competencia,
      p_mudancas: Object.keys(mud).map(function (k) { return mud[k]; }),
      p_motivo: q('#p3-motivo').value || null
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      mud = {}; sugeridas = [];
      q('#p3-motivo').value = '';
      q('#p3-nota').classList.add('oculto');
      aoSalvar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* o resumo, o rodapé e a vista; soCabeca = o calendário já foi refeito no dia que mudou */
  function redesenhar(soCabeca) {
    var n = Object.keys(mud).length;
    var ajuste = d.iniciado && !!d.lancamento;
    q('#p3-texto').textContent = n ? (ajuste ? msg().ajusteTexto(n) : msg().alteracoes(n)) : (ajuste ? msg().ajusteModo : '');
    q('#p3-motivo-campo').classList.toggle('oculto', !ajuste);
    q('#p3-salvar').disabled = !n;
    q('#p3-cancelar').disabled = !n;
    q('#p3-desfazer-sugestao').classList.toggle('oculto', !sugeridas.length);
    var alocs = efetivas();
    var total = voluntarios().reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    q('#p3-colocadas').textContent = msg().colocadas(alocs.reduce(function (s, a) { return s + a.blocos.length; }, 0), total);
    var comFalta = diasDoMes().filter(function (k) { return d.unidades.some(function (x) { return somaFalta(faltaDoDia(x.id, k, alocs)) > 0; }); }).length;
    q('#p3-dias-falta').textContent = msg().diasFalta(comFalta);
    q('#p3-dias-falta').classList.toggle('nova-extra-negativo', comFalta > 0);
    Array.prototype.forEach.call(el.querySelectorAll('#p3-vista [data-vista]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-vista') === vista); });
    q('#p3-cal').classList.toggle('oculto', vista !== 'dia');
    q('#p3-militares').classList.toggle('oculto', vista !== 'militar');
    if (vista === 'militar') desenharMilitares();
    else if (!soCabeca) desenharCalendario();
    desenharPainel();
  }

  var ligado = null;
  function mostrar(dados, conteudo, recarregar) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    if (ligado !== el) {
      ligado = el; mud = {}; sugeridas = []; vista = 'dia'; aberto = null; escala = null;
      q('#p3-sugerir').addEventListener('click', sugerir);
      q('#p3-desfazer-sugestao').addEventListener('click', desfazerSugestao);
      q('#p3-salvar').addEventListener('click', salvar);
      q('#p3-cancelar').addEventListener('click', function () {
        RW.confirmar({ tipo: 'aviso', mensagem: msg().descartarRascunho, textoConfirmar: RW.mensagens.botoes.descartar,
          aoConfirmar: function () { mud = {}; sugeridas = []; q('#p3-nota').classList.add('oculto'); redesenhar(); } });
      });
      Array.prototype.forEach.call(el.querySelectorAll('#p3-vista [data-vista]'), function (b) {
        b.addEventListener('click', function () { vista = b.getAttribute('data-vista'); redesenhar(); });
      });
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return el && el.isConnected && Object.keys(mud).length > 0; });
    }
    redesenhar();
  }

  /* os dias com falta que sobram (para a conferência do passo 4) */
  function diasComFalta(dados) {
    var guarda = d; d = dados;
    var alocs = efetivas(), lista = [];
    diasDoMes().forEach(function (k) {
      dados.unidades.forEach(function (x) { if (somaFalta(faltaDoDia(x.id, k, alocs)) > 0) lista.push(u().br(k) + ' ' + x.nome); });
    });
    d = guarda || dados;
    return lista;
  }

  RW.novaExtraMontar = {
    mostrar: mostrar,
    sujo: function () { return Object.keys(mud).length > 0; },
    descartar: function () { mud = {}; sugeridas = []; },
    /* o painel do dia fecha ao sair do passo 3 ou da aba */
    fecharPainel: function () { if (aberto && RW.painel.estaAberto()) RW.painel.fechar(); aberto = null; },
    diasComFalta: diasComFalta
  };
})();
