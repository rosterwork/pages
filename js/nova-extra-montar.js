/* ============================================================
   NOVA EXTRA — passos 3 e 4: Distribuição e Ajustes (o núcleo)
   O rascunho das extras do mês, a falta de cada pelotão (vermelha e
   amarela, com e sem as extras, e o que cada extra cobriu), a escala
   do mês (a mesma leitura da Escala), o resumo e o resultado da
   sugestão. O calendário fica em nova-extra-por-dia.js, o painel do
   dia em nova-extra-dia.js e a lista dos voluntários (o painel
   esquerdo) em nova-extra-lista.js. Todos leem daqui (RosterWork.
   novaExtraGrade). Tudo fica no rascunho até o Salvar
   (nova_extra_distribuicao_salvar); o militar sem nenhum horário
   continua no dia até lá. "Preencher pela sugestão" (só com tudo
   salvo) mantém as extras que o administrador pôs ou mudou e pede ao
   motor (nova_extra_sugerir) que refaça as que o sistema pôs. O bloco
   do pelotão no dia com mudança não salva leva a borda tracejada da Escala.
   Os Ajustes são a mesma tela (o modo ajustes): abrem depois do
   lançamento, com o motivo no rodapé.
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
  var modo = 'distribuicao';   // 'distribuicao' (passo 3) ou 'ajustes' (passo 4)
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque } (blocos [] = sai ao salvar)
  var sugeridas = [];      // as chaves que a última sugestão mudou (as extras novas, as refeitas e as que saem)
  var postas = null;       // as cotas que a última sugestão pôs no mês (a nota do resultado); null = sem sugestão
  var foraSug = {};        // quem ficou com cota na última sugestão: cpf -> motivo (o grupo Faltam da lista mostra)
  var reserva = false;     // a última sugestão usou o cálculo simples do banco
  var resultadoFechado = false;   // o resultado da sugestão fechado no X (volta no próximo Preencher)
  var escala = null;       // a escala do mês sem extra: { comp, cobertura, erro }
  var escalaSeq = 0;
  var esperaEscala = null; // a leitura da escala no ar (promessa)

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

  /* as vagas como ficam com o rascunho, inclusive as sem nenhum horário (o militar fica no dia até o Salvar) */
  function vagas() {
    var mapa = {};
    d.alocacoes.forEach(function (a) { mapa[chave(a.cpf, a.data)] = a; });
    Object.keys(mud).forEach(function (k) { mapa[k] = mud[k]; });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }
  /* as alocações como ficam com o rascunho: só as que têm horário */
  function efetivas() { return vagas().filter(function (a) { return a.blocos && a.blocos.length; }); }
  function base(cpf, data) { return d.alocacoes.filter(function (a) { return a.cpf === cpf && a.data === data; })[0] || null; }
  function vagaDe(cpf, data) { var k = chave(cpf, data); return k in mud ? mud[k] : base(cpf, data); }
  function alocDe(cpf, data) { var v = vagaDe(cpf, data); return v && v.blocos.length ? v : null; }
  /* as mudanças do rascunho que mexem na escala (a data nova ainda sem horário não mexe) */
  function alteracoes() {
    return Object.keys(mud).filter(function (k) { return mud[k].blocos.length || !!base(mud[k].cpf, mud[k].data); });
  }
  /* os blocos (pelotão|dia) com mudança ainda não salva, para a borda tracejada (como na Escala): a extra nova, mudada ou
     tirada marca o pelotão onde ela fica e o de onde ela saiu */
  function naoSalvos() {
    var r = {};
    alteracoes().forEach(function (k) {
      var v = mud[k], b = base(v.cpf, v.data);
      r[+v.unidade + '|' + v.data] = true;
      if (b) r[+b.unidade + '|' + b.data] = true;
    });
    return r;
  }
  function mesmosBlocos(a, b) { return blocos(a).sort().join() === blocos(b).sort().join(); }
  function usadas(cpf, alocs) { return (alocs || efetivas()).filter(function (a) { return a.cpf === cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  /* a distribuição só é salva depois que o pedido fecha: antes disso, só dá para tirar extra */
  function travado() { return d.mes.estado !== 'encerrado'; }
  /* lançada e não reaberta: o lançamento vale e as mudanças vão pelos Ajustes */
  function lancada() { return !!d.lancamento && !d.lancamento.reaberto; }
  /* a Distribuição depois do lançamento: só para ver (as bolinhas sem clique) */
  function soLeitura() { return modo === 'distribuicao' && lancada(); }
  function voluntarios() { return d.militares.filter(function (m) { return m.voluntario && m.termo && (m.concedidas || 0) > 0; }); }
  function blocos(a) { return a.blocos.map(Number); }
  /* a CNH que a viatura pede ('' = qualquer uma) está entre as que ele conduz (o banco diz quais) */
  function conduz(m, cnh) { return !cnh || (m.conduz || []).indexOf(cnh) >= 0; }
  /* o que impede o militar de tirar extra no dia pela escala dele (serviço, folga, afastamento ou expediente o dia
     todo); null se nada impede */
  function impedimento(m, k) {
    var oc = (m.ocupado || {})[k];
    if (oc) return RW.mensagens.novaExtra.motivos[oc] || oc;
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return msg().expedienteDiaTodo;
    return null;
  }

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
  /* a leitura da escala no ar fica guardada: a troca de mês espera por ela antes de tirar o véu. Se falhar, avisa e
     anota no console */
  function carregarEscala() {
    var ids = d.unidades.map(function (x) { return x.id; });
    var comp = d.competencia, req = ++escalaSeq;
    if (!RW.escalasDados) { escala = { comp: comp, cobertura: {}, erro: {}, militares: {} }; redesenhar(); return; }
    function falhou(e) {
      console.error('[Nova extra] ler_escala_mes falhou' + (e && e.message ? ': ' + e.message : ''));
      RW.avisar({ tipo: 'erro', mensagem: msg().falhaEscala });
    }
    esperaEscala = RW.escalasDados.carregar(ids, comp, ultimoDia()).then(function (r) {
      if (req !== escalaSeq || !el || !el.isConnected) return;
      if (!r) falhou();
      escala = { comp: comp, cobertura: (r && r.cobertura) || {}, erro: (r && r.erro) || {}, militares: (r && r.militares) || {} };
      redesenhar();
    }, function (e) {
      if (req !== escalaSeq) return;
      falhou(e);
      escala = { comp: comp, cobertura: {}, erro: {}, militares: {} };
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

  /* muda os horários do militar no dia (o mesmo para o calendário, a lista e o painel do dia). Quem já usou todas as
     cotas só marca depois de tirar um horário de outro dia; sem nenhum horário, ele continua no dia até o Salvar */
  function mudar(m, k, novos, unidade) {
    if (soLeitura()) return;
    var atual = vagaDe(m.cpf, k), tem = atual ? atual.blocos.length : 0;
    if (novos.length > tem && usadas(m.cpf) - tem + novos.length > (m.concedidas || 0)) {
      var nome = (m.grad + ' ' + m.nome).trim();
      RW.avisar({ tipo: 'aviso', mensagem: m.so24 ? msg().cotaCheia24(nome) : msg().cotaCheia(nome, m.concedidas || 0) });
      return;
    }
    var antes = base(m.cpf, k);
    var novo = { cpf: m.cpf, data: k, unidade: +unidade, blocos: novos.slice().sort(), origem: 'admin', porque: null };
    if (antes && +antes.unidade === novo.unidade && JSON.stringify(blocos(antes).sort()) === JSON.stringify(novo.blocos)) delete mud[chave(m.cpf, k)];
    else mud[chave(m.cpf, k)] = novo;
    if (escalaPronta()) porDia().atualizarDia(k);
    redesenhar(true);
  }

  /* ---------- sugestão, salvar e o resto ---------- */
  /* Preencher pela sugestão, só com tudo salvo: as extras que o administrador pôs ou mudou ficam; as que o sistema
     salvou saem e o otimizador (nova-extra-otimizador.js, com o véu e o cálculo simples de reserva) refaz tudo com as
     cotas que sobram. A extra refeita igual à salva não é mudança */
  function sugerir() {
    if (alteracoes().length || RW.novaExtraOtimizador.calculando()) return;
    var fixas = d.alocacoes.filter(function (a) { return a.origem !== 'sugestao'; });
    RW.novaExtraOtimizador.preencher(d.competencia, fixas, q('#p3-calculo'), function (r, usouReserva) {
      mud = {};
      resultadoFechado = false;
      d.alocacoes.forEach(function (a) {
        if (a.origem === 'sugestao') mud[chave(a.cpf, a.data)] = { cpf: a.cpf, data: a.data, unidade: +a.unidade, blocos: [], origem: 'sugestao', porque: null };
      });
      postas = 0;
      r.propostas.forEach(function (p) {
        var k = chave(p.cpf, p.data), antes = base(p.cpf, p.data);
        postas += p.blocos.length;
        if (antes && antes.origem === 'sugestao' && +antes.unidade === +p.unidade && mesmosBlocos(antes, p)) delete mud[k];
        else mud[k] = { cpf: p.cpf, data: p.data, unidade: p.unidade, blocos: p.blocos, origem: 'sugestao', porque: p.porque };
      });
      foraSug = {};
      (r.nao_coube || []).forEach(function (n) { foraSug[n.cpf] = n.motivo; });
      reserva = usouReserva;
      sugeridas = Object.keys(mud);
      redesenhar();
    });
  }

  /* o Desfazer da sugestão volta ao salvo: as extras do sistema que saíram voltam (as mudanças do administrador ficam) */
  function desfazerSugestao() {
    sugeridas.forEach(function (k) { if (mud[k] && mud[k].origem === 'sugestao') delete mud[k]; });
    sugeridas = []; postas = null;
    redesenhar();
  }

  function salvar() {
    var btn = q('#p3-salvar');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_distribuicao_salvar', {
      p_competencia: d.competencia,
      p_mudancas: alteracoes().map(function (k) { return mud[k]; }),
      p_motivo: q('#p3-motivo').value || null
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      mud = {}; sugeridas = []; postas = null;
      q('#p3-motivo').value = '';
      aoSalvar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* o resumo, o rodapé, a lista e o calendário; soCabeca = o calendário já foi refeito no dia que mudou. Nos Ajustes
     antes do lançamento, só o aviso de que eles abrem depois */
  function redesenhar(soCabeca) {
    var semLancamento = modo === 'ajustes' && !lancada();
    q('#p3-sem-lancamento').classList.toggle('oculto', !semLancamento);
    q('#p3-lateral').classList.toggle('oculto', semLancamento);
    if (semLancamento) { q('#p3-rodape').classList.add('oculto'); return; }
    var n = alteracoes().length;
    /* o rodapé de salvar aparece só com alteração; nos Ajustes, com o motivo e o "Salvar e enviar para a escala" */
    q('#p3-rodape').classList.toggle('oculto', !n);
    var ajuste = modo === 'ajustes';
    q('#p3-texto').textContent = n ? (ajuste ? msg().ajusteTexto(n) : msg().alteracoes(n)) : '';
    q('#p3-motivo-campo').classList.toggle('oculto', !ajuste);
    q('#p3-salvar-dist').classList.toggle('oculto', ajuste);
    q('#p3-salvar-ajuste').classList.toggle('oculto', !ajuste);
    q('#p3-salvar').disabled = !n;
    q('#p3-cancelar').disabled = !Object.keys(mud).length;
    q('#p3-desfazer-sugestao').classList.toggle('oculto', !sugeridas.length);
    var aberto = q('#p3-aberto');
    aberto.classList.toggle('oculto', !travado());
    aberto.querySelector('.nota-texto').textContent = travado() ? msg().pedidoAberto(u().br(d.mes.fecha)) : '';
    q('#p3-sugerir').disabled = travado() || soLeitura() || n > 0;
    var lancadaNota = q('#p3-lancada');
    lancadaNota.classList.toggle('oculto', !soLeitura());
    lancadaNota.querySelector('.nota-texto').textContent = soLeitura() ? msg().distLancada(d.lancamento.lancado_em, d.lancamento.por || '') : '';
    /* o resumo da companhia: as cotas colocadas dos militares */
    var alocs = efetivas();
    var sel = u().escolhidas();
    var vols = voluntarios().filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; });
    var total = vols.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    var colocadas = vols.reduce(function (s, m) { return s + usadas(m.cpf, alocs); }, 0);
    q('#p3-colocadas').textContent = msg().colocadas(colocadas, total);
    /* todas as cotas colocadas e salvas, com o pedido fechado e ainda sem lançar */
    q('#p3-pronta').classList.toggle('oculto', !(modo === 'distribuicao' && !lancada() && !travado() && !n && total > 0 && colocadas >= total));
    /* depois do Preencher pela sugestão: quantas cotas o sistema pôs no mês e os dias que ainda ficaram com vermelho ou
       amarelo */
    var resultado = q('#p3-resultado');
    resultado.classList.toggle('oculto', postas === null || !escalaPronta() || resultadoFechado);
    if (postas !== null && escalaPronta()) {
      var vermelho = 0, amarelo = 0;
      diasDoMes().forEach(function (k) {
        var cores = pelotoes().map(function (x) { return corDe(faltaDoDia(x.id, k, alocs)); });
        if (cores.indexOf('erro') >= 0) vermelho++; else if (cores.indexOf('alerta') >= 0) amarelo++;
      });
      resultado.querySelector('.nota-texto').textContent = (reserva ? msg().reservaUsada + ' ' : '') + msg().resultadoSugestao(postas, vermelho, amarelo);
    }
    RW.novaExtraLista.desenhar(el);
    /* sem nenhum pelotão: o vazio no lugar do calendário */
    var nenhuma = !u().doCalendario(alocs).length;
    q('#p3-cal').classList.toggle('oculto', nenhuma);
    q('#p3-cal-vazio').classList.toggle('oculto', !nenhuma);
    if (!escalaPronta()) {
      var alvo = q('#p3-cal');
      alvo.textContent = '';
      var car = RW.tpl('tpl-escala-carregando'); if (car) alvo.appendChild(car);
      carregarEscala();
      return;
    }
    if (!soCabeca && !nenhuma) porDia().desenhar(q('#p3-cal'));
    dia().redesenhar();
    RW.novaExtraFiltros.aplicar();
  }

  var ligado = null;
  /* modoNovo: 'distribuicao' (passo 3) ou 'ajustes' (passo 4), a mesma tela */
  function mostrar(dados, conteudo, recarregar, modoNovo) {
    d = dados; el = conteudo; aoSalvar = recarregar; modo = modoNovo || 'distribuicao';
    if (ligado !== el) {
      ligado = el; mud = {}; sugeridas = []; postas = null; escala = null;
      q('#p3-sugerir').addEventListener('click', sugerir);
      q('#p3-resultado-fechar').addEventListener('click', function () { resultadoFechado = true; q('#p3-resultado').classList.add('oculto'); });
      q('#p3-desfazer-sugestao').addEventListener('click', desfazerSugestao);
      q('#p3-salvar').addEventListener('click', salvar);
      q('#p3-cancelar').addEventListener('click', function () {
        RW.confirmar({ tipo: 'aviso', mensagem: msg().descartarRascunho, textoConfirmar: RW.mensagens.botoes.descartar,
          aoConfirmar: function () { mud = {}; sugeridas = []; postas = null; redesenhar(); } });
      });
      RW.novaExtraLista.ligar(el);
      RW.novaExtraFiltros.ligar(el);
      /* com mudança não salva ou no meio do cálculo da sugestão, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return el && el.isConnected && (alteracoes().length > 0 || RW.novaExtraOtimizador.calculando()); });
    }
    redesenhar();
  }

  /* os dias com falta que sobram (para a conferência do lançamento) */
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
    sujo: function () { return !!d && alteracoes().length > 0; },
    descartar: function () { mud = {}; sugeridas = []; postas = null; },
    /* a leitura da escala no ar (ou já terminada): a troca de mês tira o véu quando ela chega */
    esperarEscala: function () { return esperaEscala || Promise.resolve(); },
    /* refaz o calendário (o filtro Exibir mudou) */
    redesenhar: function () { if (d && el && el.isConnected) redesenhar(); },
    /* o painel do dia fecha ao sair da Distribuição, dos Ajustes ou da aba */
    fecharPainel: function () { if (dia()) dia().fechar(); },
    diasComFalta: diasComFalta
  };

  /* o que o calendário, o painel do dia e a lista leem e mudam */
  RW.novaExtraGrade = {
    INI: INI, SEM_CURTA: SEM_CURTA,
    dados: function () { return d; },
    vagas: vagas, vagaDe: vagaDe, efetivas: efetivas, alocDe: alocDe, usadas: usadas, voluntarios: voluntarios, blocos: blocos, naoSalvos: naoSalvos,
    /* por que o militar ficou com cota na última sugestão (enquanto ela está na tela): 'solta', 'nao_quero', 'sem_dia' */
    foraDaSugestao: function (cpf) { return postas !== null ? foraSug[cpf] || null : null; },
    conduz: conduz, impedimento: impedimento,
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, corDe: corDe, travado: travado, soLeitura: soLeitura,
    grafico: function (cob, uid, erro) { return porDia().grafico(cob, uid, erro); },
    coberturaEscala: function () { return escala.cobertura; },
    erroAntes: function (uid, k) { return (escala.erro[uid] || {})[k]; },
    /* quem está de serviço no dia, na escala (sem as extras já lançadas, que aparecem nas vagas) */
    deServico: function (uid, k) { return ((escala.militares[uid] || {})[k] || []).filter(function (p) { return p.origem !== 'extra'; }); },
    pelotoes: pelotoes, diasDoMes: diasDoMes, dataDe: dataDe, dataLonga: dataLonga, somaDia: somaDia,
    mudar: mudar, marcarAberto: function () { porDia().marcarAberto(); }
  };
})();
