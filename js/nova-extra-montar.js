/* ============================================================
   NOVA EXTRA — passo 3: Distribuição (o núcleo e o Por dia)
   O rascunho das extras do mês, a falta de cada pelotão (vermelha e
   amarela, com e sem as extras), a escala do mês (a mesma leitura da
   Escala) e o Por dia: o calendário do mês (geral-calendario-mes) com
   um bloco por unidade em cada dia: a barra antes (sem extra), a barra
   depois (a conta com as extras: soma 1 por extra no horário e a cor
   sai onde a extra cobre a falta) e só as extras. Clicar no bloco abre
   o painel do dia (nova-extra-dia.js); o Por militar é a grade dos 31
   dias (nova-extra-militares.js). Os dois leem daqui (RosterWork.
   novaExtraGrade). Tudo fica no rascunho até o Salvar
   (nova_extra_distribuicao_salvar); "Preencher pela sugestão" pede o
   rascunho ao motor (nova_extra_sugerir).
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

  var d = null, el = null, aoSalvar = null;
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque } (blocos [] = tira)
  var sugeridas = [];      // as chaves que a última sugestão pôs
  var sobras = {};         // o que a última sugestão não conseguiu pôr { cpf: { faltam, motivo } }
  var vista = 'dia';
  var escala = null;       // a escala do mês sem extra: { comp, cobertura, erro }
  var escalaSeq = 0;
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)
  var diasCal = {};        // a célula de cada dia no calendário { data: celula }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function dia() { return RW.novaExtraDia; }
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

  /* a falta de uma unidade num dia, por horário, a vermelha e a amarela (a que começa com "a"): base (a da escala),
     cond (condutor que sobra) e total (o que sobra com as extras). Cada extra cobre, na ordem da sugestão, um
     condutor vermelho que ele conduz, a gente vermelha, um condutor amarelo (o chefe dirigindo) e a gente amarela */
  function faltaDoDia(uid, k, alocs) {
    function ler(mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; }
    function tira(lista, m) { for (var i = 0; i < lista.length; i++) { if (conduz(m, lista[i])) { lista.splice(i, 1); return true; } } return false; }
    var base = ler(d.falta), pede = ler(d.falta_condutor), abase = ler(d.falta_amarela), apede = ler(d.falta_amarela_condutor);
    var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; });
    var r = { base: {}, cond: {}, total: {}, cnh: [], abase: {}, acond: {}, atotal: {}, acnh: [] };
    [1, 2, 3, 4].forEach(function (b) {
      var conds = (pede[String(b)] || []).slice(), aconds = (apede[String(b)] || []).slice();
      conds.forEach(function (c) { if (c && r.cnh.indexOf(c) < 0) r.cnh.push(c); });
      aconds.forEach(function (c) { if (c && r.acnh.indexOf(c) < 0) r.acnh.push(c); });
      var gente = (base[String(b)] || 0) - conds.length, agente = (abase[String(b)] || 0) - aconds.length;
      aqui.forEach(function (a) {
        if (blocos(a).indexOf(b) < 0) return;
        var m = u().militar(a.cpf) || {};
        if (tira(conds, m)) return;
        if (gente > 0) { gente--; return; }
        if (tira(aconds, m)) return;
        if (agente > 0) agente--;
      });
      r.base[b] = base[String(b)] || 0;
      r.cond[b] = conds.length;
      r.total[b] = Math.max(0, gente) + conds.length;
      r.abase[b] = abase[String(b)] || 0;
      r.acond[b] = aconds.length;
      r.atotal[b] = Math.max(0, agente) + aconds.length;
    });
    return r;
  }
  function somaFalta(f) { return f.total[1] + f.total[2] + f.total[3] + f.total[4]; }
  /* as unidades que entram na conta da falta: os pelotões (na companhia, a extra entra só manualmente) */
  function pelotoes(lista) { return (lista || d.unidades).filter(function (x) { return x.pelotao !== false; }); }

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
  function escalaPronta() { return !!escala && escala.comp === d.competencia; }
  function antesDe(uid, k) { var c = escala && (escala.cobertura[uid] || {})[k]; return c && c.length === 24 ? c : null; }
  /* o depois: a escala com as extras (+1 por extra nas horas dele) e o vermelho e o amarelo só onde a falta sobra */
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
      else if (v === 2 && falta.abase[b] > 0 && falta.atotal[b] === 0) v = 0;
      e.push(v);
    }
    return { cobertura: c, erro: e };
  }
  /* a situação de cada horário de um pelotão num dia, com as extras: 'falta' (vermelho que sobra), 'ideal'
     (amarelo que sobra), 'ok' ou 'sem' (o dia sem escala) */
  function situacao(uid, k, alocs) {
    if (!antesDe(uid, k)) return ['sem', 'sem', 'sem', 'sem'];
    var f = faltaDoDia(uid, k, alocs);
    return [1, 2, 3, 4].map(function (b) { return f.total[b] > 0 ? 'falta' : f.atotal[b] > 0 ? 'ideal' : 'ok'; });
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
    var ab = dia().aberto();
    b.setAttribute('data-uid', un.id);
    b.setAttribute('data-dia', k);
    b.setAttribute('aria-label', un.nome + ', ' + u().br(k));
    b.classList.toggle('nova-extra-cal-uni--aberto', !!ab && ab.uid === un.id && ab.data === k);
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
    b.addEventListener('click', function () { dia().abrir(un.id, k); });
    b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); dia().abrir(un.id, k); } });
    return b;
  }

  /* refaz só os blocos de um dia (a régua das barras muda: refaz o mês) */
  function atualizarDia(k) {
    var cel = diasCal[k];
    if (vista !== 'dia' || !cel || !escalaPronta()) return;
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

  /* o bloco do dia aberto no painel fica em destaque */
  function marcarAberto() {
    var ab = dia().aberto();
    Array.prototype.forEach.call(el.querySelectorAll('.nova-extra-cal-uni'), function (b) {
      b.classList.toggle('nova-extra-cal-uni--aberto', !!ab && +b.getAttribute('data-uid') === ab.uid && b.getAttribute('data-dia') === ab.data);
    });
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

  /* ---------- sugestão, salvar e o resto ---------- */
  function sugerir() {
    var btn = q('#p3-sugerir');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_sugerir', { p_competencia: d.competencia, p_atuais: efetivas() }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      sugeridas = [];
      r.propostas.forEach(function (p) {
        var k = chave(p.cpf, p.data);
        mud[k] = { cpf: p.cpf, data: p.data, unidade: p.unidade, blocos: p.blocos, origem: 'sugestao', porque: p.porque };
        sugeridas.push(k);
      });
      sobras = {};
      r.nao_coube.forEach(function (x) { sobras[x.cpf] = { faltam: x.faltam, motivo: x.motivo }; });
      redesenhar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function desfazerSugestao() {
    sugeridas.forEach(function (k) { if (mud[k] && mud[k].origem === 'sugestao') delete mud[k]; });
    sugeridas = []; sobras = {};
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
      mud = {}; sugeridas = []; sobras = {};
      q('#p3-motivo').value = '';
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
    var vols = voluntarios();
    var total = vols.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    var colocadas = alocs.reduce(function (s, a) { return s + a.blocos.length; }, 0);
    q('#p3-colocadas').textContent = msg().colocadas(colocadas, total);
    var sobra = vols.reduce(function (s, m) { return s + Math.max(0, (m.concedidas || 0) - usadas(m.cpf, alocs)); }, 0);
    q('#p3-sobra').textContent = sobra ? msg().cotasSobrando(sobra) : '';
    var comFalta = escalaPronta() ? diasDoMes().filter(function (k) { return pelotoes().some(function (x) { return somaFalta(faltaDoDia(x.id, k, alocs)) > 0; }); }).length : 0;
    q('#p3-dias-falta').textContent = msg().diasFalta(comFalta);
    q('#p3-dias-falta').classList.toggle('nova-extra-negativo', comFalta > 0);
    Array.prototype.forEach.call(el.querySelectorAll('#p3-vista [data-vista]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-vista') === vista); });
    q('#p3-cal').classList.toggle('oculto', vista !== 'dia');
    q('#p3-militares').classList.toggle('oculto', vista !== 'militar');
    if (!escalaPronta()) {
      var alvo = q(vista === 'dia' ? '#p3-cal' : '#p3-gm');
      alvo.textContent = '';
      var car = RW.tpl('tpl-escala-carregando'); if (car) alvo.appendChild(car);
      carregarEscala();
      return;
    }
    if (vista === 'militar') RW.novaExtraMilitares.desenhar(el);
    else if (!soCabeca) desenharCalendario();
    dia().redesenhar();
  }

  var ligado = null;
  function mostrar(dados, conteudo, recarregar) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    if (ligado !== el) {
      ligado = el; mud = {}; sugeridas = []; sobras = {}; vista = 'dia'; escala = null;
      q('#p3-sugerir').addEventListener('click', sugerir);
      q('#p3-desfazer-sugestao').addEventListener('click', desfazerSugestao);
      q('#p3-salvar').addEventListener('click', salvar);
      q('#p3-cancelar').addEventListener('click', function () {
        RW.confirmar({ tipo: 'aviso', mensagem: msg().descartarRascunho, textoConfirmar: RW.mensagens.botoes.descartar,
          aoConfirmar: function () { mud = {}; sugeridas = []; sobras = {}; redesenhar(); } });
      });
      Array.prototype.forEach.call(el.querySelectorAll('#p3-vista [data-vista]'), function (b) {
        b.addEventListener('click', function () { RW.novaExtraMilitares.fecharCaixa(); vista = b.getAttribute('data-vista'); redesenhar(); });
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
      pelotoes(dados.unidades).forEach(function (x) { if (somaFalta(faltaDoDia(x.id, k, alocs)) > 0) lista.push(u().br(k) + ' ' + x.nome); });
    });
    d = guarda || dados;
    return lista;
  }

  RW.novaExtraMontar = {
    mostrar: mostrar,
    sujo: function () { return Object.keys(mud).length > 0; },
    descartar: function () { mud = {}; sugeridas = []; sobras = {}; },
    /* o painel do dia e a caixa do quadrado fecham ao sair do passo 3 ou da aba */
    fecharPainel: function () { if (RW.novaExtraMilitares) RW.novaExtraMilitares.fecharCaixa(); if (dia()) dia().fechar(); },
    diasComFalta: diasComFalta
  };

  /* o que o painel do dia e o Por militar leem e mudam */
  RW.novaExtraGrade = {
    INI: INI, SEM_CURTA: SEM_CURTA,
    dados: function () { return d; },
    efetivas: efetivas, alocDe: alocDe, usadas: usadas, voluntarios: voluntarios, blocos: blocos, conduz: conduz,
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, grafico: grafico,
    erroAntes: function (uid, k) { return (escala.erro[uid] || {})[k]; },
    pelotoes: pelotoes, diasDoMes: diasDoMes, dataDe: dataDe, dataLonga: dataLonga, somaDia: somaDia,
    sobra: function (cpf) { return sobras[cpf] || null; },
    mudar: mudar, marcarAberto: marcarAberto
  };
})();
