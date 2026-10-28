/* ============================================================
   NOVA EXTRA — passo 3: Distribuição (o núcleo)
   O rascunho das extras do mês, a falta de cada pelotão (vermelha e
   amarela, com e sem as extras, e o que cada extra cobriu), a escala
   do mês (a mesma leitura da Escala), o resumo e o resultado da
   sugestão. O Por dia é o calendário (nova-extra-por-dia.js), o painel
   do dia fica em nova-extra-dia.js e o Por militar é a grade dos 31
   dias (nova-extra-militares.js). Todos leem daqui (RosterWork.
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
  /* a distribuição só é salva depois que o pedido fecha: antes disso, só dá para tirar extra */
  function travado() { return d.mes.estado !== 'encerrado'; }
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
    var r = { base: {}, cond: {}, total: {}, cnh: [], abase: {}, acond: {}, atotal: {}, acnh: [], cobre: {} };
    /* o que cada extra cobriu (condutor, gente, chefe, ideal), para o relatório do dia */
    function cobriu(a, o) { var l = r.cobre[a.cpf] = r.cobre[a.cpf] || []; if (l.indexOf(o) < 0) l.push(o); }
    [1, 2, 3, 4].forEach(function (b) {
      var conds = (pede[String(b)] || []).slice(), aconds = (apede[String(b)] || []).slice();
      conds.forEach(function (c) { if (c && r.cnh.indexOf(c) < 0) r.cnh.push(c); });
      aconds.forEach(function (c) { if (c && r.acnh.indexOf(c) < 0) r.acnh.push(c); });
      var gente = (base[String(b)] || 0) - conds.length, agente = (abase[String(b)] || 0) - aconds.length;
      aqui.forEach(function (a) {
        if (blocos(a).indexOf(b) < 0) return;
        var m = u().militar(a.cpf) || {};
        if (tira(conds, m)) { cobriu(a, 'condutor'); return; }
        if (gente > 0) { gente--; cobriu(a, 'gente'); return; }
        if (tira(aconds, m)) { cobriu(a, 'chefe'); return; }
        if (agente > 0) { agente--; cobriu(a, 'ideal'); }
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
  /* a cor do dia de um pelotão: 'erro' ou 'alerta' se ainda sobra; 'ok' se tinha erro e as extras cobriram */
  function corDe(f) {
    function tem(o) { return [1, 2, 3, 4].some(function (b) { return o[b] > 0; }); }
    return tem(f.total) ? 'erro' : tem(f.atotal) ? 'alerta' : (tem(f.base) || tem(f.abase)) ? 'ok' : '';
  }
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
  function porDia() { return RW.novaExtraPorDia; }

  function mudar(m, k, novos, unidade) {
    var base = d.alocacoes.filter(function (a) { return a.cpf === m.cpf && a.data === k; })[0];
    var novo = { cpf: m.cpf, data: k, unidade: +unidade, blocos: novos.slice().sort(), origem: 'admin', porque: null };
    if (base && +base.unidade === novo.unidade && JSON.stringify(blocos(base).sort()) === JSON.stringify(novo.blocos)) delete mud[chave(m.cpf, k)];
    else if (!base && !novos.length) delete mud[chave(m.cpf, k)];
    else mud[chave(m.cpf, k)] = novo;
    if (vista === 'dia' && escalaPronta()) porDia().atualizarDia(k);
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
    var aberto = q('#p3-aberto');
    aberto.classList.toggle('oculto', !travado());
    aberto.querySelector('.nota-texto').textContent = travado() ? msg().pedidoAberto(u().br(d.mes.fecha)) : '';
    q('#p3-sugerir').disabled = travado();
    /* o resumo da companhia: as cotas dos militares e os dias com falta nos pelotões */
    var alocs = efetivas();
    var sel = u().escolhidas();
    var vols = voluntarios().filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; });
    var total = vols.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    var colocadas = vols.reduce(function (s, m) { return s + usadas(m.cpf, alocs); }, 0);
    q('#p3-colocadas').textContent = msg().colocadas(colocadas, total);
    var sobra = vols.reduce(function (s, m) { return s + Math.max(0, (m.concedidas || 0) - usadas(m.cpf, alocs)); }, 0);
    q('#p3-sobra').textContent = sobra ? msg().cotasSobrando(sobra) : '';
    var comFalta = escalaPronta() ? diasDoMes().filter(function (k) {
      return pelotoes().some(function (x) { return sel.indexOf(x.id) >= 0 && somaFalta(faltaDoDia(x.id, k, alocs)) > 0; });
    }).length : 0;
    /* depois do Preencher pela sugestão: quantas cotas ela pôs e os dias que ainda ficaram com vermelho ou amarelo */
    var resultado = q('#p3-resultado');
    resultado.classList.toggle('oculto', !sugeridas.length || !escalaPronta());
    if (sugeridas.length && escalaPronta()) {
      var postas = sugeridas.reduce(function (s, kk) { return s + (mud[kk] ? mud[kk].blocos.length : 0); }, 0), vermelho = 0, amarelo = 0;
      diasDoMes().forEach(function (k) {
        var cores = pelotoes().map(function (x) { return corDe(faltaDoDia(x.id, k, alocs)); });
        if (cores.indexOf('erro') >= 0) vermelho++; else if (cores.indexOf('alerta') >= 0) amarelo++;
      });
      resultado.querySelector('.nota-texto').textContent = msg().resultadoSugestao(postas, vermelho, amarelo);
    }
    q('#p3-dias-falta').textContent = msg().diasFalta(comFalta);
    q('#p3-dias-falta').classList.toggle('nova-extra-negativo', comFalta > 0);
    Array.prototype.forEach.call(el.querySelectorAll('#p3-vista [data-vista]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-vista') === vista); });
    /* Por dia sem nenhum pelotão: o vazio no lugar do calendário */
    var nenhuma = !u().doCalendario(alocs).length;
    q('#p3-cal').classList.toggle('oculto', vista !== 'dia' || nenhuma);
    q('#p3-cal-vazio').classList.toggle('oculto', vista !== 'dia' || !nenhuma);
    q('#p3-militares').classList.toggle('oculto', vista !== 'militar');
    if (!escalaPronta()) {
      var alvo = q(vista === 'dia' ? '#p3-cal' : '#p3-gm');
      alvo.textContent = '';
      var car = RW.tpl('tpl-escala-carregando'); if (car) alvo.appendChild(car);
      carregarEscala();
      return;
    }
    if (vista === 'militar') RW.novaExtraMilitares.desenhar(el);
    else if (!soCabeca && !nenhuma) porDia().desenhar(q('#p3-cal'));
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
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, corDe: corDe, travado: travado,
    grafico: function (cob, uid, erro) { return porDia().grafico(cob, uid, erro); },
    coberturaEscala: function () { return escala.cobertura; },
    erroAntes: function (uid, k) { return (escala.erro[uid] || {})[k]; },
    pelotoes: pelotoes, diasDoMes: diasDoMes, dataDe: dataDe, dataLonga: dataLonga, somaDia: somaDia,
    sobra: function (cpf) { return sobras[cpf] || null; },
    mudar: mudar, marcarAberto: function () { porDia().marcarAberto(); }
  };
})();
