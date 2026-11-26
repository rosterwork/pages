/* ============================================================
   EXTRAJORNADA — a grade do mês: o rascunho e as contas
   O rascunho das extras do mês, a falta de cada pelotão (vermelha e
   amarela, com e sem as extras, e o que cada extra cobriu), a escala
   do mês (a mesma leitura da Escala), a régua das barras e os erros que
   pintam o gráfico (escala_erros_mes: a dica e o relatório). Quem abre
   entrega o mês por iniciar: a Distribuição e os Ajustes
   (extrajornada-montar.js) e a aba Extrajornada do painel do dia da
   Escala (escalas-painel-extra.js). O calendário, a lista dos
   voluntários e o painel do dia leem e mudam por aqui.
   Tudo fica no rascunho até o Salvar; quem estava salvo e ficou sem
   horário continua no dia, em cinza, até lá, e quem entrou no rascunho
   e ficou sem horário sai de vez. O rascunho aceita passar da cota: quem
   passou aparece em passaram e o Salvar espera acertar. Cada mudança é
   um passo do Desfazer e do Refazer (o Preencher pela sugestão, um só).
   Cada mudança leva o "antes" (a extra salva quando a pessoa mexeu): com
   o mês lido de novo, o rascunho fica por cima, e a mudança da extra que
   outra pessoa ou o sistema mudou no meio sai (reaplicar).
   Não desenha nada. RosterWork.extrajornadaGrade.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'];
  var SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var SEM_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var d = null;
  var modo = 'distribuicao';   // 'distribuicao' (passo 3) ou 'ajustes' (passo 4 e a aba da Escala)
  var aoMudar = null;      // quem abriu redesenha: aoMudar(dia que mudou)
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque, inicio } (blocos [] = sai ao salvar)
  var escala = null;       // a escala do mês, a mesma da Escala: { comp, cobertura, erro, militares }
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)
  var passos = [];         // o Desfazer: o rascunho de antes de cada passo { mud, marca } ('sugestao' no Preencher)
  var refeitos = [];       // o Refazer: os passos desfeitos, o último por cima
  var LIMITE_PASSOS = 100; // os passos guardados (os mais velhos saem)
  var juntando = false;    // mudanças que viram um passo só do Desfazer (o Pôr outro no lugar dele)

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function F() { return RW.extrajornadaFalta; }
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
  function nomeDoMes(k) { return MESES[dataDe(k).getMonth()]; }

  /* as vagas como ficam com o rascunho, inclusive as sem nenhum horário (quem estava salvo e sai ao salvar) */
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
  /* a extra salva (b) que sai do pelotão ao salvar (tirada, ou posta em outro pelotão no mesmo dia): fica em cinza nele
     até o Salvar, e o militar já está livre para outro lugar */
  function saiDe(b, uid) {
    var v = mud[chave(b.cpf, b.data)];
    return +b.unidade === +uid && !!v && !(v.blocos.length && +v.unidade === +uid);
  }
  function sai(cpf, uid, k) { var b = base(cpf, k); return !!b && saiDe(b, uid); }
  /* as vagas que o pelotão mostra no dia: as com horário e, sem horário (em cinza), as salvas que saem ao salvar */
  function doBloco(uid, k) {
    var lista = efetivas().filter(function (a) { return +a.unidade === +uid && a.data === k; });
    d.alocacoes.forEach(function (b) {
      if (b.data !== k || !saiDe(b, uid)) return;
      lista.push({ cpf: b.cpf, data: k, unidade: +uid, blocos: [], origem: mud[chave(b.cpf, k)].origem, porque: null, inicio: null });
    });
    return lista;
  }
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
  function blocos(a) { return a.blocos.map(Number); }
  function mesmosBlocos(a, b) { return blocos(a).sort().join() === blocos(b).sort().join() && (a.inicio || null) === (b.inicio || null); }
  /* a extra como fica para a conferência: { unidade, blocos, inicio }, ou null sem horário. Na mudança, o "antes" é a
     extra salva como a tela mostrava quando a pessoa mexeu; o banco confere ao salvar (extrajornada_distribuicao_salvar) */
  function retrato(a) { return a && a.blocos && a.blocos.length ? { unidade: +a.unidade, blocos: blocos(a).sort(), inicio: a.inicio || null } : null; }
  /* o administrativo no dia em que o expediente termina antes da primeira bolinha livre (a quarta): a hora em que a
     extra pode começar (o fim do expediente), ou null */
  function desde(m, k) { return ((d.desde_adm || {})[m.cpf] || {})[k] || null; }
  /* começar no fim do expediente vale para as bolinhas seguidas desde a primeira livre do dia */
  function inicioCabe(m, k, bs) {
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k] || [], b = bs.map(Number).sort();
    if (!desde(m, k) || !b.length || !livres.length) return false;
    return b[0] === Math.min.apply(null, livres) && b[b.length - 1] - b[0] + 1 === b.length;
  }
  /* as horas de serviço de parte do dia (o pontual e o que sobra da folga de parte do dia): [{ hi, hf }] */
  function horasServico(m, k) { return ((d.horas_servico || {})[m.cpf] || {})[k] || []; }
  /* a autorização de viagem do militar no dia (a nota vermelha da caixa do horário; não impede): { inicio, fim, destinos }
     ou null */
  function viagemDe(cpf, k) {
    return (((d && d.viagens) || {})[cpf] || []).filter(function (v) { return v.inicio <= k && k <= v.fim; })[0] || null;
  }
  /* a extra das horas ini às fim (contadas desde as 08h) fica fora das horas de serviço do dia (o banco confere igual) */
  function foraDoServico(m, k, ini, fim) {
    return horasServico(m, k).every(function (p) { var f = RW.horario.faixa(p); return fim * 60 <= f[0] || ini * 60 >= f[1]; });
  }
  /* o começo fora dos riscos (o horário livre e o do administrativo): hora cheia de 1 a 5 horas antes do primeiro
     horário de 6 h, com os horários seguidos (o banco confere igual) */
  function comecoCabe(bs, inicio) {
    var b = bs.map(Number).sort(), d = b.length ? (b[0] - 1) * 360 - RW.horario.emMin(inicio) : 0;
    return !!b.length && /^\d\d:00$/.test(inicio) && b[b.length - 1] - b[0] + 1 === b.length && d >= 60 && d <= 300;
  }
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
  /* quem passou da cota no rascunho: o Salvar espera acertar */
  function passaram() {
    var alocs = efetivas();
    return voluntarios().filter(function (m) { return usadas(m.cpf, alocs) > (m.concedidas || 0); });
  }
  /* o que o rascunho faz com as cotas, para o rodapé do Salvar: nos Ajustes do mês lançado, de quem muda de número. Quem
     fica com cotas a menos vem antes de quem completou; quem passou da cota é o aviso de passaram() */
  function fraseDasCotas() {
    if (modo !== 'ajustes' || !lancada()) return '';
    var c = RW.mensagens.cotasAviso, alocs = efetivas(), aMenos = [], completos = [];
    voluntarios().forEach(function (m) {
      var agora = usadas(m.cpf, alocs), total = m.concedidas || 0;
      if (agora === usadas(m.cpf, d.alocacoes)) return;
      if (agora < total) aMenos.push({ m: m, n: agora });
      else if (agora === total) completos.push({ m: m, n: agora });
    });
    var lista = aMenos.length ? aMenos : completos;
    if (!lista.length) return '';
    if (lista.length > 1) return aMenos.length ? c.aoSalvarFicam(lista.length) : c.aoSalvarCompletam(lista.length);
    return c.aoSalvarFica((lista[0].m.grad + ' ' + lista[0].m.nome).trim(), lista[0].n, lista[0].m.concedidas || 0);
  }
  function conduz(m, cnh) { return F().conduz(m, cnh); }
  /* o que impede o militar de tirar extra no dia pela escala dele (serviço, troca, afastamento ou expediente o dia
     todo); null se nada impede. O serviço de parte do dia só tira as horas dele (horasServico) */
  function impedimento(m, k) {
    var oc = (m.ocupado || {})[k];
    if (oc) return RW.mensagens.extrajornada.motivos[oc] || oc;
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return msg().expedienteDiaTodo;
    return null;
  }

  /* o dia de verdade: no mês lançado, sem mudança por salvar no dia, a escala de hoje já tem as extras e diz o que sobra */
  function real(k) { return lancada() && !!d.real && !alteracoes().some(function (c) { return mud[c].data === k; }); }
  /* a falta de uma unidade num dia e o que as extras cobrem (extrajornada-falta.js); no dia de verdade, com a cor da escala */
  function faltaDoDia(uid, k, alocs) {
    var e = real(k) && escala && (escala.erro[uid] || {})[k];
    return F().doDia(d, uid, k, alocs, e && e.length === 24 ? e : null);
  }
  function somaFalta(f) { return F().soma(f); }
  function corDe(f) { return F().cor(f); }
  /* as unidades que entram na conta da falta: os pelotões (na companhia, a extra entra só manualmente) */
  function pelotoes(lista) { return (lista || d.unidades).filter(function (x) { return x.pelotao !== false; }); }

  /* ---------- as barras: a escala do mês (a mesma leitura da Escala) e a conta do depois ---------- */
  /* a escala do mês que veio com o mês (extrajornada_mes, da conta guardada no banco) */
  function escalaDoMes() {
    if (!d.escala || !RW.escalasDados) return;
    var r = RW.escalasDados.reorganizar(d.escala);
    escala = { comp: d.competencia, cobertura: r.cobertura, erro: r.erro, militares: r.militares };
  }
  function escalaPronta() { return !!escala && escala.comp === d.competencia; }
  /* o antes: o pelotão com extra na escala do dia (mês lançado ou reaberto), a escala sem elas, do banco (sem_extra);
     sem extra no dia, a escala como está, a da Escala (a conta sem as extras refaz a distribuição do dia e pode mudar
     as funções, como no rodízio) */
  function antesDoDia(uid, k) {
    var sem = temExtraNaEscala(uid, k) && ((d.sem_extra || {})[uid] || {})[k];
    return sem || { cobertura: escala && (escala.cobertura[uid] || {})[k], erro: escala && (escala.erro[uid] || {})[k],
                    estagiarios: estagiariosDaEscala(uid, k) };
  }
  /* alguém de extra na escala do pelotão no dia */
  function temExtraNaEscala(uid, k) {
    var dia = ((d.escala || {})[uid] || {})[k];
    return !!(dia && (dia.militares || []).some(function (m) { return m.origem === 'extra'; }));
  }
  /* os estagiários que não são efetivo, por hora, da escala de hoje (a dica da faixa; escalas-celula.js) */
  function estagiariosDaEscala(uid, k) { return RW.escalasCelula ? RW.escalasCelula.estagiariosDoDia(uid, k) : null; }
  function antesDe(uid, k) { var c = antesDoDia(uid, k).cobertura; return c && c.length === 24 ? c : null; }
  /* o depois: a escala com as extras (+1 por extra nas horas dele) e o vermelho e o amarelo só onde a falta sobra; no
     dia de verdade, a barra da Escala */
  function depoisDe(uid, k, alocs, falta) {
    var rc = real(k) && escala && (escala.cobertura[uid] || {})[k];
    if (rc && rc.length === 24) return { cobertura: rc.map(Number), erro: ((escala.erro[uid] || {})[k] || []).map(Number), estagiarios: estagiariosDaEscala(uid, k),
                                         erros: errosHoje(uid, k) };
    var cob = antesDe(uid, k);
    if (!cob) return null;
    var err = antesDoDia(uid, k).erro || [], c = cob.map(Number), e = [], meias = {}, lista = errosAntes(uid, k), cobre = [];
    alocs.forEach(function (a) {
      if (+a.unidade !== +uid || a.data !== k) return;
      var cheios = u().cheios(a);
      u().horasDe(a).forEach(function (h) {
        c[h]++;
        /* a que começa no fim do expediente: as horas dos horários que ela só toca (a falta deles conta sem ela) */
        if (cheios.indexOf(Math.floor(h / 6) + 1) < 0) meias[h] = (meias[h] || 0) + 1;
      });
    });
    for (var h = 0; h < 24; h++) {
      var b = Math.floor(h / 6) + 1, v = Number(err[h]) || 0, meia = meias[h] || 0;
      /* a hora sai do vermelho só com as pessoas e o condutor cobertos (no amarelo, o ideal e o chefe que dirige) */
      var cobreVermelho = v === 1 && falta.base[b] + falta.cbase[b] > 0 && falta.total[b] - meia <= 0 && falta.cond[b] === 0;
      var cobreAmarelo = v === 2 && falta.abase[b] + falta.acbase[b] > 0 && falta.atotal[b] - meia <= 0 && falta.acond[b] === 0;
      /* as extras cobriram a falta; com outro erro vermelho na hora (alguém sem função), ela continua vermelha */
      if ((cobreVermelho && !outroVermelho(lista, h)) || cobreAmarelo) v = 0;
      cobre.push(cobreVermelho ? 1 : cobreAmarelo ? 2 : 0);
      e.push(v);
    }
    return { cobertura: c, erro: e, estagiarios: antesDoDia(uid, k).estagiarios || null, erros: lista && errosDaHora(lista, cobre) };
  }

  /* ---------- os erros que pintam o gráfico (escala_erros_mes): a dica do gráfico e o relatório do painel do dia ---------- */
  /* os erros de falta, que a extra cobre (os do _falta_por_horario: as pessoas e o condutor; o posto travado fica com a
     escala): no vermelho e no amarelo */
  var FALTA = { 1: ['abaixo_minimo', 'unidade_abaixo_minimo', 'posto_fora', 'sem_condutor', 'sem_condutor_habilitado'],
                2: ['unidade_abaixo_minimo', 'posto_fora', 'chefe_condutor'] };
  var erros = null, errosDe = null;   // { hoje, sem } do banco e o mês lido a que eles pertencem
  function eFalta(p) { return (FALTA[p.nivel] || []).indexOf(p.codigo) >= 0; }
  function naHora(p, h) { var x = RW.horario.faixa(p); return x[0] < (h + 1) * 60 && x[1] > h * 60; }
  /* os erros uma vez por mês lido, com a escala sem as extras; quando chegam, a tela se redesenha (o relatório e a cor
     do depois) */
  function lerErros() {
    if (!d || errosDe === d) return;
    var meu = errosDe = d;
    erros = null;
    /* da cópia guardada, como o mês (extrajornada-organizar.js): o dia que mudou vem da versão de antes, e a nota avisa */
    var corpo = { p_unidade_ids: d.unidades.map(function (x) { return x.id; }), p_inicio: d.competencia, p_fim: ultimoDia(), p_sem: true };
    if (!(RW.treino && RW.treino.ligado())) corpo.p_aceita_copia = true;
    u().chamar('escala_erros_mes', corpo)
      .then(function (r) {
        if (errosDe !== meu || !r) return;
        erros = r;
        if (RW.extrajornadaMontar) RW.extrajornadaMontar.redesenhar();
        else if (RW.extrajornadaDia) RW.extrajornadaDia.redesenhar();
      }).catch(function (x) { console.error('[Extrajornada] escala_erros_mes falhou', x); });
  }
  /* os erros do pelotão no dia (as linhas do _escala_problemas_dia; null enquanto não chegaram): os da escala de hoje e,
     no antes (o dia com extra na escala), os da escala sem as extras, como a barra */
  function errosHoje(uid, k) { return erros ? (((erros.hoje || {})[uid] || {})[k] || []) : null; }
  function errosAntes(uid, k) {
    if (erros && temExtraNaEscala(uid, k) && ((d.sem_extra || {})[uid] || {})[k]) return ((erros.sem || {})[uid] || {})[k] || [];
    return errosHoje(uid, k);
  }
  function outroVermelho(lista, h) { return !!lista && lista.some(function (p) { return p.nivel === 1 && !eFalta(p) && naHora(p, h); }); }
  /* a lista do depois, por hora: sem a falta que as extras cobriram naquela hora (cobre: 1 o vermelho, 2 o amarelo) */
  function errosDaHora(lista, cobre) {
    return function (h) { return lista.filter(function (p) { return !(cobre[h] && cobre[h] === p.nivel && eFalta(p)); }); };
  }
  /* os erros da escala no dia que não são falta (a extra não resolve), para o relatório do painel do dia */
  function errosSemFalta(uid, k) {
    var lista = real(k) ? errosHoje(uid, k) : errosAntes(uid, k);
    return (lista || []).filter(function (p) { return !eFalta(p); });
  }
  /* a situação de cada horário de um pelotão num dia, com as extras: 'falta' (vermelho que sobra), 'ideal'
     (amarelo que sobra), 'ok' ou 'sem' (o dia sem escala) */
  function situacao(uid, k, alocs) {
    if (!antesDe(uid, k)) return ['sem', 'sem', 'sem', 'sem'];
    return F().situacao(faltaDoDia(uid, k, alocs));
  }
  /* a régua das barras de cada unidade no mês, antes e depois das extras */
  function calcularPicos(alocs) {
    picos = {};
    d.unidades.forEach(function (un) {
      var pico = 0;
      diasDoMes().forEach(function (k) {
        (antesDe(un.id, k) || []).forEach(function (n) { if (+n > pico) pico = +n; });
      });
      alocs.forEach(function (a) {
        if (+a.unidade !== un.id) return;
        var dep = depoisDe(un.id, a.data, alocs, faltaDoDia(un.id, a.data, alocs));
        if (dep) dep.cobertura.forEach(function (n) { if (n > pico) pico = n; });
      });
      picos[un.id] = pico;
    });
  }
  /* o gráfico com a lista dos erros da dica (escalas-celula-erros.js; null: ainda não chegou) */
  function grafico(cob, uid, erro, estagiarios, lista) {
    var g = RW.escalasCelula ? RW.escalasCelula.montarGrafico(cob, picos[uid] || 1, erro, estagiarios) : null;
    if (g && RW.escalasCelulaErros) RW.escalasCelulaErros.marcar(g, lista || null);
    return g;
  }

  /* muda os horários do militar no dia (o mesmo para o calendário, a lista e o painel do dia). Passar da cota fica no
     rascunho, e o Salvar espera acertar. Sem nenhum horário: quem estava salvo sai do pelotão salvo ao salvar (em cinza
     até lá); quem entrou no rascunho sai de vez. inicio: a hora em que a extra começa fora dos riscos (o horário livre,
     ou o administrativo no fim do expediente), que vale se couber; sem ele (as bolinhas mudaram), vale o padrão: o
     administrativo com 2 cotas, no fim do expediente (sai à meia-noite); senão, na bolinha */
  function mudar(m, k, novos, unidade, inicio) {
    if (soLeitura() || antigo(k)) return;
    var antes = base(m.cpf, k), bs = novos.slice().sort();
    if (!bs.length && antes) unidade = antes.unidade;
    var dado = inicio !== undefined;
    if (!dado) inicio = bs.length === 2 ? desde(m, k) : null;
    if (inicio && !(dado ? comecoCabe(bs, inicio) : inicioCabe(m, k, bs))) inicio = null;
    var c = chave(m.cpf, k), era = JSON.stringify(mud[c] || null), foto = copia(mud);
    var novo = { cpf: m.cpf, data: k, unidade: +unidade, blocos: bs, origem: 'admin', porque: null, inicio: inicio || null,
      antes: c in mud ? mud[c].antes : retrato(antes) };
    if (antes && +antes.unidade === novo.unidade && JSON.stringify(blocos(antes).sort()) === JSON.stringify(novo.blocos)
        && (antes.inicio || null) === novo.inicio) delete mud[c];
    else if (!antes && !bs.length) delete mud[c];
    else mud[c] = novo;
    /* o passo do Desfazer (o clique que não muda nada não conta) */
    if (juntando) return;
    if (JSON.stringify(mud[c] || null) !== era) guardarPasso(null, foto);
    if (aoMudar) aoMudar(k);
  }

  /* Pôr outro no lugar dele (a caixa da célula): o novo fica com os horários e o começo do outro no dia, e o outro sai;
     um passo só do Desfazer */
  function porNoLugar(de, para, k, unidade) {
    var v = vagaDe(de.cpf, k);
    if (!v || soLeitura() || antigo(k)) return;
    var foto = copia(mud), bs = blocos(v), inicio = v.inicio || undefined;
    juntando = true;
    try {
      mudar(de, k, [], unidade);
      mudar(para, k, bs, unidade, inicio);
    } finally {
      juntando = false;
    }
    if (JSON.stringify(foto) !== JSON.stringify(mud)) guardarPasso(null, foto);
    if (aoMudar) aoMudar(k);
  }

  /* ---------- o Desfazer e o Refazer: cada passo guarda o rascunho de antes ---------- */
  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  /* guarda um passo: o rascunho de antes (foto; sem ela, o de agora, para quem vai mudar muitos de uma vez, como o
     Preencher pela sugestão, com a marca 'sugestao'); o Refazer perde o que guardava */
  function guardarPasso(marca, foto) {
    passos.push({ mud: foto || copia(mud), marca: marca || null });
    if (passos.length > LIMITE_PASSOS) passos.shift();
    refeitos = [];
  }
  /* as mudanças destas extras ({ cpf, data }) saem do rascunho e dos passos do Desfazer e do Refazer */
  function tirar(lista) {
    var chaves = lista.map(function (x) { return chave(x.cpf, x.data); });
    [{ mud: mud }].concat(passos, refeitos).forEach(function (p) { chaves.forEach(function (c) { delete p.mud[c]; }); });
  }
  /* o mês lido de novo com o rascunho na tela: cada mudança fica por cima do mês novo. A que o mês novo já tem igual
     sai; a da extra que mudou depois que a pessoa mexeu (outra pessoa ou o sistema) sai também e volta na lista */
  function reaplicar() {
    var iguais = [], mudaram = [];
    Object.keys(mud).forEach(function (k) {
      var v = mud[k], agora = JSON.stringify(retrato(base(v.cpf, v.data)));
      if (agora === JSON.stringify(retrato(v))) iguais.push(v);
      else if ('antes' in v && agora !== JSON.stringify(v.antes)) mudaram.push(v);
    });
    iguais.forEach(function (v) { delete mud[chave(v.cpf, v.data)]; });
    tirar(mudaram);
    return mudaram;
  }

  /* os dias que mudam de um rascunho para o outro */
  function diasEntre(a, b) {
    var dias = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (c) {
      if (JSON.stringify(a[c] || null) !== JSON.stringify(b[c] || null)) dias[(a[c] || b[c]).data] = true;
    });
    return Object.keys(dias);
  }
  /* volta um passo (de passos para refeitos) ou avança (de refeitos para passos): { dias que mudaram, marca }, ou null */
  function trocarPasso(de, para) {
    var p = de.pop();
    if (!p) return null;
    para.push({ mud: copia(mud), marca: p.marca });
    var dias = diasEntre(mud, p.mud);
    mud = p.mud;
    return { dias: dias, marca: p.marca };
  }

  /* a extra do militar que começa no fim do expediente deixa falta que, começando na bolinha, ela cobriria: { cor
     ('erro' ou 'alerta'), das, ate } das horas que ficam descobertas, ou null */
  function faltaDoInicio(uid, k, cpf) {
    var alocs = efetivas(), a = alocs.filter(function (x) { return x.cpf === cpf && x.data === k; })[0];
    if (!a || !a.inicio || +a.unidade !== +uid) return null;
    var naBolinha = alocs.map(function (x) { return x === a ? { cpf: x.cpf, data: x.data, unidade: x.unidade, blocos: x.blocos, origem: x.origem, inicio: null } : x; });
    /* a conta das duas (sem a cor da escala de hoje, que já tem a extra salva): a diferença é o que o início muda */
    var com = F().doDia(d, uid, k, alocs, null), sem = F().doDia(d, uid, k, naBolinha, null);
    var ultimo = Math.max.apply(null, blocos(a));
    var vermelho = com.total[ultimo] + com.cond[ultimo] > sem.total[ultimo] + sem.cond[ultimo];
    var amarelo = com.atotal[ultimo] + com.acond[ultimo] > sem.atotal[ultimo] + sem.acond[ultimo];
    if (!vermelho && !amarelo) return null;
    return { cor: vermelho ? 'erro' : 'alerta', das: u().horas(blocos(a), a.inicio).split(' às ')[1], ate: u().horas([ultimo]).split(' às ')[1] };
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

  /* o que o calendário, a lista, o painel do dia e quem abriu leem e mudam */
  RW.extrajornadaGrade = {
    INI: INI, SEM_CURTA: SEM_CURTA,
    /* quem abre entrega o mês, o modo ('distribuicao' ou 'ajustes') e o que fazer quando o rascunho muda */
    iniciar: function (dados, modoNovo, quandoMudar) { d = dados; modo = modoNovo || 'distribuicao'; aoMudar = quandoMudar || null; lerErros(); },
    dados: function () { return d; },
    modo: function () { return modo; },
    rascunho: function () { return mud; },
    /* o rascunho vazio e sem passos (o Cancelar, o Salvar, o mês lido de novo) */
    limpar: function () { mud = {}; passos = []; refeitos = []; },
    /* o mês lido de novo: o rascunho por cima (as mudanças da extra que mudou saem e voltam na lista); e o Salvar
       recusado porque a extra mudou: as mudanças dela saem */
    reaplicar: reaplicar, tirar: tirar, retrato: retrato,
    /* o Desfazer e o Refazer: quem chama redesenha os dias que mudaram (a marca 'sugestao' é o Preencher inteiro) */
    guardarPasso: guardarPasso,
    desfazer: function () { return trocarPasso(passos, refeitos); },
    refazer: function () { return trocarPasso(refeitos, passos); },
    podeDesfazer: function () { return passos.length > 0; },
    podeRefazer: function () { return refeitos.length > 0; },
    chave: chave, base: base, alteracoes: alteracoes, passaram: passaram, fraseDasCotas: fraseDasCotas, lancada: lancada, mesmosBlocos: mesmosBlocos,
    vagas: vagas, vagaDe: vagaDe, efetivas: efetivas, alocDe: alocDe, sai: sai, doBloco: doBloco, usadas: usadas, voluntarios: voluntarios, blocos: blocos, naoSalvos: naoSalvos,
    conduz: conduz, impedimento: impedimento, viagemDe: viagemDe,
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, corDe: corDe, travado: travado, soLeitura: soLeitura, antigo: antigo,
    escalaDoMes: escalaDoMes, escalaPronta: escalaPronta,
    /* a escala lida à parte (com o rascunho do painel do dia da Escala); null: ler de novo */
    usarEscala: function (e) { escala = e; },
    calcularPicos: calcularPicos, pico: function (uid) { return picos[uid] || 0; }, grafico: grafico,
    erroAntes: function (uid, k) { return antesDoDia(uid, k).erro; },
    /* os erros do antes (a dica do gráfico) e os que não são falta (o relatório do painel do dia) */
    errosAntes: errosAntes, errosSemFalta: errosSemFalta,
    estagiariosAntes: function (uid, k) { return antesDoDia(uid, k).estagiarios || null; },
    /* quem está de serviço no dia, na escala (sem as extras já lançadas, que aparecem nas vagas) */
    deServico: function (uid, k) { return ((escala.militares[uid] || {})[k] || []).filter(function (p) { return p.origem !== 'extra'; }); },
    pelotoes: pelotoes, diasDoMes: diasDoMes, ultimoDia: ultimoDia, dataDe: dataDe, dataLonga: dataLonga, nomeDoMes: nomeDoMes, somaDia: somaDia,
    mudar: mudar, porNoLugar: porNoLugar, diasComFalta: diasComFalta, desde: desde, inicioCabe: inicioCabe, faltaDoInicio: faltaDoInicio,
    horasServico: horasServico, foraDoServico: foraDoServico
  };
})();
