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
  var escala = null;       // a escala do mês, a mesma da Escala: { comp, cobertura, erro, militares }
  var escalaSeq = 0;
  var escalaLendo = null;  // o mês com a leitura da escala no ar
  var escalaFalhou = null; // o mês em que a leitura da escala falhou (a frase no lugar do calendário)

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
  /* lançada, os Ajustes mudam a escala: o dia de mais de 7 dias atrás fica só para ver (o banco trava igual) */
  function antigo(k) { return modo === 'ajustes' && lancada() && k < somaDia(d.hoje, -7); }
  function voluntarios() { return d.militares.filter(function (m) { return m.voluntario && m.termo && (m.concedidas || 0) > 0; }); }
  function blocos(a) { return a.blocos.map(Number); }
  function F() { return RW.novaExtraFalta; }
  function conduz(m, cnh) { return F().conduz(m, cnh); }
  /* o que impede o militar de tirar extra no dia pela escala dele (serviço, folga, afastamento ou expediente o dia
     todo); null se nada impede */
  function impedimento(m, k) {
    var oc = (m.ocupado || {})[k];
    if (oc) return RW.mensagens.novaExtra.motivos[oc] || oc;
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return msg().expedienteDiaTodo;
    return null;
  }

  /* o dia de verdade: no mês lançado, sem mudança por salvar no dia, a escala de hoje já tem as extras e diz o que sobra */
  function real(k) { return lancada() && !!d.real && !alteracoes().some(function (c) { return mud[c].data === k; }); }
  /* a falta de uma unidade num dia e o que as extras cobrem (nova-extra-falta.js); no dia de verdade, com a cor da escala */
  function faltaDoDia(uid, k, alocs) {
    var e = real(k) && escala && (escala.erro[uid] || {})[k];
    return F().doDia(d, uid, k, alocs, e && e.length === 24 ? e : null);
  }
  function somaFalta(f) { return F().soma(f); }
  function corDe(f) { return F().cor(f); }
  /* as unidades que entram na conta da falta: os pelotões (na companhia, a extra entra só manualmente) */
  function pelotoes(lista) { return (lista || d.unidades).filter(function (x) { return x.pelotao !== false; }); }

  /* ---------- as barras: a escala do mês (a mesma leitura da Escala) e a conta do depois ---------- */
  /* a escala do mês vem com o mês (nova_extra_mes, da conta guardada no banco); com mudança do painel do dia da Escala
     esperando o Salvar, ela é lida com o rascunho (carregarEscala) */
  function escalaDoMes() {
    if (!d.escala || !RW.escalasDados || RW.escalasDados.corpoPrevia('ler_escala_mes', {})) return;
    var r = RW.escalasDados.reorganizar(d.escala);
    escalaSeq++;
    escalaLendo = null;
    escala = { comp: d.competencia, cobertura: r.cobertura, erro: r.erro, militares: r.militares };
  }
  /* uma leitura por vez (o calendário mostra o círculo até ela chegar). Se falhar, a frase fica no lugar do calendário,
     como na Escala, e a mensagem técnica no console; abrir o passo de novo tenta outra vez */
  function carregarEscala() {
    var ids = d.unidades.map(function (x) { return x.id; });
    var comp = d.competencia, req = ++escalaSeq;
    if (!RW.escalasDados) { escala = { comp: comp, cobertura: {}, erro: {}, militares: {} }; redesenhar(); return; }
    escalaLendo = comp;
    function falhou(e) {
      if (req !== escalaSeq) return;
      escalaLendo = null;
      escalaFalhou = comp;
      console.error('[Nova extra] ler_escala_mes falhou' + (e && e.message ? ': ' + e.message : ''));
      if (el && el.isConnected) redesenhar();
    }
    RW.escalasDados.carregar(ids, comp, ultimoDia()).then(function (r) {
      if (req !== escalaSeq) return;
      if (!r) { falhou(); return; }
      escalaLendo = null;
      escala = { comp: comp, cobertura: r.cobertura || {}, erro: r.erro || {}, militares: r.militares || {} };
      if (el && el.isConnected) redesenhar();
    }, falhou);
  }
  function escalaPronta() { return !!escala && escala.comp === d.competencia; }
  /* o antes: com extra na escala (mês lançado ou reaberto), a escala sem elas, do banco (sem_extra); senão, a da Escala */
  function antesDoDia(uid, k) { return ((d.sem_extra || {})[uid] || {})[k] || { cobertura: escala && (escala.cobertura[uid] || {})[k], erro: escala && (escala.erro[uid] || {})[k] }; }
  function antesDe(uid, k) { var c = antesDoDia(uid, k).cobertura; return c && c.length === 24 ? c : null; }
  /* o depois: a escala com as extras (+1 por extra nas horas dele) e o vermelho e o amarelo só onde a falta sobra; no
     dia de verdade, a barra da Escala */
  function depoisDe(uid, k, alocs, falta) {
    var rc = real(k) && escala && (escala.cobertura[uid] || {})[k];
    if (rc && rc.length === 24) return { cobertura: rc.map(Number), erro: ((escala.erro[uid] || {})[k] || []).map(Number) };
    var cob = antesDe(uid, k);
    if (!cob) return null;
    var err = antesDoDia(uid, k).erro || [], c = cob.map(Number), e = [];
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
    return F().situacao(faltaDoDia(uid, k, alocs));
  }
  function porDia() { return RW.novaExtraPorDia; }

  /* muda os horários do militar no dia (o mesmo para o calendário, a lista e o painel do dia). Quem já usou todas as
     cotas só marca depois de tirar um horário de outro dia; sem nenhum horário, ele continua no dia até o Salvar */
  function mudar(m, k, novos, unidade) {
    if (soLeitura() || antigo(k)) return;
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
      mud = {}; sugeridas = []; postas = null; if (modo === 'ajustes') escala = null;   // o ajuste muda a escala: relida com o mês
      q('#p3-motivo').value = '';
      RW.novaExtraOrg.resumo(r);
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
    /* com o Salvar carregando (os textos dele saem e voltam com o pararCarregando), só o que está na tela */
    [['#p3-salvar-dist', ajuste], ['#p3-salvar-ajuste', !ajuste]].forEach(function (t) { var s = q(t[0]); if (s) s.classList.toggle('oculto', t[1]); });
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
      var alvo = q('#p3-cal'), falha = escalaFalhou === d.competencia;
      alvo.textContent = '';
      var no = RW.tpl(falha ? 'tpl-escala-estado' : 'tpl-escala-carregando');
      if (no && falha) no.textContent = msg().falhaEscala;
      if (no) alvo.appendChild(no);
      if (!falha && escalaLendo !== d.competencia) carregarEscala();
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
    escalaFalhou = null;
    escalaDoMes();
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
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, corDe: corDe, travado: travado, soLeitura: soLeitura, antigo: antigo,
    grafico: function (cob, uid, erro) { return porDia().grafico(cob, uid, erro); },
    erroAntes: function (uid, k) { return antesDoDia(uid, k).erro; },
    /* quem está de serviço no dia, na escala (sem as extras já lançadas, que aparecem nas vagas) */
    deServico: function (uid, k) { return ((escala.militares[uid] || {})[k] || []).filter(function (p) { return p.origem !== 'extra'; }); },
    pelotoes: pelotoes, diasDoMes: diasDoMes, dataDe: dataDe, dataLonga: dataLonga, somaDia: somaDia,
    mudar: mudar, marcarAberto: function () { porDia().marcarAberto(); }
  };
})();
