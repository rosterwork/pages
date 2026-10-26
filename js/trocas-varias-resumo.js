/* ============================================================
   TROCAS — o resumo do formulário da troca, dia a dia
   O banco monta (fn_trocas_varias_montar) as duplas, as rodas e o
   que fica sem devolução; aqui, uma linha por dia: a data, quem
   trabalha no lugar de quem (o selo Devolução no dia da devolução
   da dupla), o horário sempre à vista e o lápis, que abre ali mesmo
   o "Serviço inteiro / Parte do serviço" (geral-horario), um dia
   por vez, com o Pronto. No Editar, o dia que já passou fica sem o
   lápis. O horário mora no par do dia (inicio e fim; o serviço
   inteiro = o horário do serviço, vazio quando é 24h) e vai ao
   banco junto com os dias. Mudar o horário refaz só as horas e as
   notas, sem fechar a linha aberta; mudar os dias refaz tudo.
   As notas: a dívida de cada par no fim, somando a que já havia
   (saldos_final); sem dívida, a nota verde. No Cobrar, o primeiro
   dia em que o devedor trabalha no lugar de quem cobra já vem com
   as horas da dívida, do começo do serviço.
   Expõe RosterWork.trocasVariasResumo.{ iniciar, agendar, encerrar }
     iniciar(est) — est = o estado do formulário (pares, editar, ensaio, cobrar)
     agendar() — os dias mudaram: refaz o resumo inteiro
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var est = null;          // o estado do formulário aberto
  var timer = null;
  var req = 0;             // token: só a montagem mais recente vale
  var linhas = {};         // chave do dia -> { li, dia } (o dia como a montagem devolveu)
  var aberta = null;       // a linha em edição: { chave, periodo }

  function M() { return RW.mensagens.trocas.varias; }
  function Reg() { return RW.trocasVariasRegistrar; }
  function q(sel) { return est && est.raiz ? est.raiz.querySelector(sel) : null; }
  function chave(d) { return String(d.data).slice(0, 10) + '|' + d.trabalha + '|' + d.folga; }
  function parDe(d) { var c = chave(d); return est.pares.filter(function (p) { return chave(p) === c; })[0] || null; }
  /* os dias da montagem, na ordem do resumo: as duplas (serviço e devolução), as rodas e o que fica sem devolução */
  function diasDe(r) {
    var dias = [];
    (r.duplas || []).forEach(function (d) { dias.push(d.servico, d.devolucao); });
    (r.rodas || []).forEach(function (roda) { dias = dias.concat(roda); });
    return dias.concat(r.sem_devolucao || []);
  }

  /* ---------- montar: os dias mudaram (tudo) ou só o horário (as horas e as notas) ---------- */
  function agendar() { aberta = null; programar(true); }
  function agendarHoras() { programar(false); }
  function programar(tudo) {
    if (!est) return;
    if (est.ensaio) Reg().agendarAnalise();   // no Registrar e no Editar do administrador de fora, a Análise acompanha
    if (timer) clearTimeout(timer);
    req++;
    if (!est.pares.length) { desenhar(null); return; }
    if (tudo) {
      limpar();
      var carregando = q('#tv-resumo-carregando');
      carregando.textContent = '';
      carregando.appendChild(document.getElementById('carregando-pontos').content.cloneNode(true));
      carregando.classList.remove('oculto');
    }
    timer = setTimeout(function () { montar(tudo); }, 300);
  }
  function montar(tudo) {
    var meu = ++req;
    RW.trocasDados.variasMontar(est.pares, est.editar ? est.editar.registroId : null).then(function (r) {
      if (!est || meu !== req) return;
      if (!r || r.erro) {
        if (tudo) desenhar(null);
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || M().falhaResumo });
        return;
      }
      if (aplicarCobranca(r)) { montar(tudo); return; }   // as horas da dívida entraram: monta de novo
      if (tudo) desenhar(r); else atualizar(r);
    }).catch(function () {
      if (!est || meu !== req) return;
      if (tudo) desenhar(null);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().falhaResumo });
    });
  }

  /* ---------- o desenho: os grupos, uma linha por dia, e as notas ---------- */
  function limpar() {
    ['#tv-duplas', '#tv-sem-devolucao'].forEach(function (s) { q(s).classList.add('oculto'); q(s + ' ol').textContent = ''; });
    q('#tv-rodas').textContent = '';
    q('#tv-notas').textContent = '';
    q('#tv-resumo-vazio').classList.add('oculto');
    q('#tv-resumo-carregando').classList.add('oculto');
    linhas = {};
    aberta = null;
  }
  function desenhar(r) {
    limpar();
    if (!r || !est.pares.length) { q('#tv-resumo-vazio').classList.remove('oculto'); return; }
    (r.duplas || []).forEach(function (d) {
      linha(q('#tv-duplas ol'), d.servico, false, r);
      linha(q('#tv-duplas ol'), d.devolucao, true, r);
    });
    q('#tv-duplas').classList.toggle('oculto', !(r.duplas || []).length);
    (r.rodas || []).forEach(function (roda) {
      var g = RW.tpl('tpl-troca-varias-roda');
      roda.forEach(function (d) { linha(g.querySelector('ol'), d, false, r); });
      q('#tv-rodas').appendChild(g);
    });
    (r.sem_devolucao || []).forEach(function (d) { linha(q('#tv-sem-devolucao ol'), d, false, r); });
    q('#tv-sem-devolucao').classList.toggle('oculto', !(r.sem_devolucao || []).length);
    notas(r);
  }
  function linha(lista, d, devolucao, r) {
    var li = RW.tpl('tpl-troca-varias-linha'), dia = String(d.data).slice(0, 10), c = chave(d);
    var nome = function (cpf) { return (r.nomes && r.nomes[cpf]) || ''; };
    li.querySelector('.trocas-varias-linha-numero').textContent = RW.data.isoParaBR(dia).slice(0, 5);
    li.querySelector('.trocas-varias-linha-semana').textContent = RW.data.comDiaSemana(dia).split(',')[0];
    li.querySelector('.trocas-varias-linha-trabalha').textContent = nome(d.trabalha);
    li.querySelector('.trocas-varias-linha-folga').textContent = nome(d.folga);
    li.querySelector('.trocas-varias-linha-devolucao').classList.toggle('oculto', !devolucao);
    var editar = li.querySelector('.trocas-varias-linha-editar');
    /* no Editar, o dia que já passou não muda: sem o lápis */
    if (RW.trocasVariasCalendario.travado(dia)) editar.remove();
    else {
      editar.setAttribute('aria-label', M().editarHorario(RW.data.isoParaBR(dia).slice(0, 5)));
      editar.addEventListener('click', function () { abrir(c); });
    }
    li.querySelector('.trocas-varias-linha-pronto').addEventListener('click', pronto);
    linhas[c] = { li: li, dia: d };
    horario(li, d);
    lista.appendChild(li);
  }
  /* "Serviço inteiro, 08:00 às 08:00 (24h)" ou, em destaque, "Parte do serviço, 08:00 às 20:00 (12h)" */
  function horario(li, d) {
    var hi = d.inicio || '08:00', hf = d.fim || '08:00', horas = RW.tempo.horas(d.minutos);
    var el = li.querySelector('.trocas-varias-linha-horario');
    el.textContent = d.parte ? M().horarioParte(hi, hf, horas) : M().horarioInteiro(hi, hf, horas);
    el.classList.toggle('trocas-varias-linha-horario--parte', !!d.parte);
  }
  /* só o horário mudou: as horas de cada linha (menos a aberta) e as notas; se os dias não batem, refaz tudo */
  function atualizar(r) {
    var dias = diasDe(r);
    if (dias.length !== Object.keys(linhas).length || dias.some(function (d) { return !linhas[chave(d)]; })) { desenhar(r); return; }
    dias.forEach(function (d) {
      var c = chave(d);
      linhas[c].dia = d;
      if (!aberta || aberta.chave !== c) horario(linhas[c].li, d);
    });
    q('#tv-notas').textContent = '';
    notas(r);
  }
  function nota(molde, texto) { var n = RW.tpl(molde); n.querySelector('.nota-texto').textContent = texto; q('#tv-notas').appendChild(n); }
  /* a dívida de cada par no fim (a que já havia somada); sem dívida, a nota verde */
  function notas(r) {
    var nome = function (cpf) { return (r.nomes && r.nomes[cpf]) || ''; };
    var finais = r.saldos_final || [], antes = r.saldos_antes || [];
    var tinha = function (s) { return antes.some(function (a) { return (a.deve === s.deve && a.a === s.a) || (a.deve === s.a && a.a === s.deve); }); };
    if (!finais.length) {
      var duplas = (r.duplas || []).length > 0, rodas = (r.rodas || []).length > 0;
      nota('tpl-troca-varias-nota-ok', antes.length ? M().fechadoAntes : (duplas && rodas ? M().fechadoTudo : (rodas ? M().fechadoRodas : M().fechadoDuplas)));
      return;
    }
    finais.forEach(function (s) {
      var semDev = !tinha(s) && (r.sem_devolucao || []).some(function (d) { return d.folga === s.deve && d.trabalha === s.a; });
      var horas = RW.tempo.horas(s.minutos);
      nota('tpl-troca-varias-nota-saldo', semDev ? M().semDevolucao(nome(s.deve), horas, nome(s.a)) : M().saldo(nome(s.deve), horas, nome(s.a)));
    });
  }

  /* ---------- o lápis: o horário do dia, ali mesmo ---------- */
  function abrir(c) {
    fechar();
    var x = linhas[c], par = x ? parDe(x.dia) : null;
    if (!x || !par) return;
    var li = x.li, d = x.dia;
    li.classList.add('trocas-varias-linha--editando');
    li.querySelector('.trocas-varias-linha-editar').classList.add('oculto');
    li.querySelector('.trocas-varias-linha-horario').textContent = M().horarioEscolha;
    li.querySelector('.trocas-varias-linha-horario').classList.remove('trocas-varias-linha-horario--parte');
    li.querySelector('.trocas-varias-linha-editor').classList.remove('oculto');
    var periodo = RW.horario.periodoServico(li.querySelector('.trocas-varias-linha-periodo'), {
      /* o serviço inteiro guarda o horário do serviço (vazio quando é 24h), como a montagem devolve */
      aoMudar: function (v) {
        if (!v || !v.valido) return;   // o trecho que não fecha não vale (o Pronto avisa)
        par.inicio = v.total ? (d.servico_inicio || null) : v.hi;
        par.fim = v.total ? (d.servico_fim || null) : v.hf;
        agendarHoras();
      }
    });
    periodo.definirServico({ hi: d.servico_inicio || '08:00', hf: d.servico_fim || '08:00' });
    if (d.parte) periodo.definirParte(d.inicio, d.fim);
    aberta = { chave: c, periodo: periodo };
    var marcado = li.querySelector('.trocas-varias-linha-periodo input:checked');
    if (marcado) marcado.focus();
  }
  /* fecha a linha aberta; o horário volta a ser o texto (o da última montagem) */
  function fechar() {
    if (!aberta) return;
    var x = linhas[aberta.chave];
    aberta = null;
    if (!x) return;
    x.li.classList.remove('trocas-varias-linha--editando');
    x.li.querySelector('.trocas-varias-linha-editor').classList.add('oculto');
    x.li.querySelector('.trocas-varias-linha-periodo').textContent = '';
    var editar = x.li.querySelector('.trocas-varias-linha-editar');
    editar.classList.remove('oculto');
    horario(x.li, x.dia);
    editar.focus();
  }
  function pronto() {
    if (!aberta) return;
    var v = aberta.periodo.valor();
    if (v && !v.valido) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().horarioInvalido }); return; }
    fechar();
  }

  /* ---------- o Cobrar: o primeiro dia em que o devedor trabalha no lugar de quem cobra leva as horas da dívida ---------- */
  function aplicarCobranca(r) {
    var cob = est.cobrar;
    if (!cob || cob.aplicada || !(cob.minutos > 0)) return false;
    var eu = RW.sessao.cpf();
    var d = diasDe(r).filter(function (x) { return x.trabalha === cob.cpf && x.folga === eu; })[0];
    if (!d) return false;
    cob.aplicada = true;
    var par = parDe(d);
    if (!par || d.parte || cob.minutos >= d.minutos) return false;   // a dívida cobre o serviço inteiro: fica como está
    var H = RW.horario, inicio = d.servico_inicio || '08:00';
    par.inicio = inicio;
    par.fim = H.hhmm(H.emMin(inicio) + cob.minutos);
    return true;
  }

  function iniciar(estado) { est = estado; linhas = {}; aberta = null; }
  function encerrar() { if (timer) clearTimeout(timer); req++; est = null; linhas = {}; aberta = null; }

  RW.trocasVariasResumo = { iniciar: iniciar, agendar: agendar, encerrar: encerrar };
})();
