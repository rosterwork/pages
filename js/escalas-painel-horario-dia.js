/* ============================================================
   ESCALAS — Mudar o horário do serviço (o lápis da aba Militares; só
   admin)
   Sub-tela em caixas de pergunta (Guia visual › Ações e perguntas),
   já com ele escolhido: o Horário do serviço dele no dia (um horário
   só, começando no de agora) e o Banco de horas, só quando o horário
   muda.
   - Pelo ciclo: o horário fica dentro do serviço dele; as horas que
     saem viram folga (como no Remover do dia com parte do serviço),
     com a pergunta de descontar ou não no banco de horas (o Não
     descontar vem primeiro e marcado).
   - Pontual: o horário pode diminuir ou ir para as horas livres dele
     no dia (a mesma leitura do Adicionar militar, escala_dia_disponiveis);
     a pergunta é a do Adicionar: contabilizar ou não as horas do
     pontual (começa na escolha de antes).
   A resposta completa entra no rascunho do Dia ao vivo
   (escalas-painel-editar.js › aoVivo) e grava no Salvar do rodapé
   largo; o horário fora das horas livres fica em vermelho, e a
   pergunta sem resposta desliga o Salvar.
   API: RosterWork.escalasPainelHorarioDia.abrir({ cpf }), pode(cpf) (o
   serviço dele no dia é um horário só, pelo ciclo ou pontual) e
   criar(cpf, opcoes) (o cálculo, sem tela, que a célula da grade,
   escalas-celula-editar.js, também usa).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function R() { return RosterWork.escalasPainelRemoverListas; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

  /* o serviço dele no dia que muda por aqui: { mil, origem: 'ciclo' | 'pontual', periodo } (null: um horário só, pelo
     ciclo ou pontual; a troca, a extra, a mudança de dia e o remanejado mudam pelos caminhos deles) */
  function servicoDe(cpf) {
    var api = ed(), mil = cpf && api.dados() ? api.militarDoDia(cpf) : null;
    if (!mil || mil.remanejado || !R()) return null;
    if (mil.janelas.some(function (j) { return ['troca', 'extra', 'mudanca'].indexOf(j.origem) >= 0; })) return null;
    var partes = R().partesDe(mil);
    if (partes.length !== 1 || partes[0].periodos.length !== 1) return null;
    var p = partes[0];
    if (p.origem !== 'ciclo' && p.origem !== 'pontual') return null;
    return { mil: mil, origem: p.origem, periodo: { hi: p.periodos[0].hi, hf: p.periodos[0].hf } };
  }

  function pode(cpf) { return !!servicoDe(cpf); }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-horario-dia-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* ---------- o cálculo, sem tela (a sub-tela daqui e a célula da grade, escalas-celula-editar.js, usam o mesmo) ---------- */

  /* criar(cpf, opcoes) devolve null (o serviço dele não muda por aqui) ou a sessão do horário dele no dia:
     { cpf, nome, pontual, servico (o horário do serviço, para o texto), est: { periodo (o escolhido), livres (onde ele
     pode ficar; no pontual, também as horas livres, lidas), banco: 'sim' | 'nao', motivo (o Motivo da folga, pelo
     ciclo) }, opcoes() (as horas dos campos),
     dentro(), calcular(), aplicar(c), lerLivres(aoLer) }.
     calcular() devolve { ok, mudou, f, saem (as horas que viram folga), texto (a nota da sub-tela), pergunta (o banco de
     horas aparece), sim (o texto do Descontar ou do Contabilizar), folga ({ periodos, horas } ou null) }; aplicar(c) põe a
     resposta no rascunho ao vivo (o horário fora de onde ele pode ficar trava o Salvar).
     Pelo ciclo, o banco começa no Não descontar (ou na escolha da folga dele já no rascunho); no pontual, na escolha de
     antes. opcoes.sempreBanco: no pontual, a pergunta do banco aparece sempre, e mudar só a resposta já muda o rascunho
     (a célula, logo depois do Adicionar somente nesse dia) */
  function criar(cpf, opcoes) {
    opcoes = opcoes || {};
    var api = ed(), H = api.horas;
    var s = servicoDe(cpf);
    if (!s) return null;
    var mil = s.mil, nome = nomeDe(mil), pontual = s.origem === 'pontual', r0 = api.rascunho();
    /* pelo ciclo: as folgas dele já no rascunho voltam a ser serviço se o horário voltar (base = o serviço do ciclo) */
    var folgas = (r0.folgas || []).filter(function (f) { return f.cpf === cpf && f.hi && f.hf; });
    var folgasAntes = folgas.map(function (f) { return { hi: f.hi, hf: f.hf }; });
    var base = H.uniao([H.faixa(s.periodo)].concat(folgasAntes.map(H.faixa)));
    if (base.length !== 1) base = [H.faixa(s.periodo)];
    var pont = pontual ? (r0.pontuais || []).filter(function (x) { return x.cpf === cpf; })[0] : null;
    var est = { periodo: { hi: s.periodo.hi, hf: s.periodo.hf }, livres: pontual ? [H.faixa(s.periodo)] : base,
      banco: pontual ? (pont && pont.contabilizar ? 'sim' : 'nao') : (folgas[0] && folgas[0].contabilizar ? 'sim' : 'nao'),
      motivo: (folgas[0] && folgas[0].motivo) || '' };
    var bancoAntes = est.banco;

    /* o horário cabe num pedaço de onde ele pode ficar */
    function dentro() {
      var f = H.faixa(est.periodo);
      return f[1] > f[0] && est.livres.some(function (w) { return f[0] >= w[0] && f[1] <= w[1]; });
    }
    function minutos(lista) { return lista.reduce(function (t, f) { return t + f[1] - f[0]; }, 0); }

    function calcular() {
      var f = H.faixa(est.periodo), ok = dentro();
      var saem = ok ? H.menos(base, [f]) : [];
      var mudou = ok && (pontual
        ? JSON.stringify(est.periodo) !== JSON.stringify(s.periodo) || (!!opcoes.sempreBanco && est.banco !== bancoAntes)
        : JSON.stringify(saem) !== JSON.stringify(H.uniao(folgasAntes.map(H.faixa))));
      var texto = '';
      if (mudou && !pontual && saem.length) texto = L().horarioDiaFolga(H.textoPeriodos(saem.map(H.periodo)), nome, H.horasTexto(minutos(saem)));
      if (mudou && pontual) texto = L().horarioDiaPontual(nome, msg().dasAs(H.curta(est.periodo.hi), H.curta(est.periodo.hf)), H.horasTexto(f[1] - f[0]));
      /* o banco de horas só com o horário mudado (pelo ciclo, só com horas de folga) */
      var pergunta = ok && (pontual ? mudou || !!opcoes.sempreBanco : mudou && saem.length > 0);
      var sim = !pergunta ? '' : pontual ? L().bancoSim(H.horasTexto(f[1] - f[0])) : L().descontar(H.horasTexto(minutos(saem)));
      var folga = mudou && !pontual && saem.length ? { periodos: saem.map(H.periodo), horas: H.horasTexto(minutos(saem)) } : null;
      return { ok: ok, mudou: mudou, f: f, saem: saem, texto: texto, pergunta: pergunta, sim: sim, folga: folga };
    }

    function aplicar(c) {
      c = c || calcular();
      if (!c.ok) { api.aoVivo(null, true); return; }
      if (!c.mudou) { api.aoVivo(null, false); return; }
      if (c.pergunta && !est.banco) { api.aoVivo(null, true); return; }
      var contabilizar = est.banco === 'sim', novo = { hi: est.periodo.hi, hf: est.periodo.hf }, f = c.f, saem = c.saem;
      api.aoVivo(pontual
        ? function () {
          api.aplicarColocacao({ cpf: cpf, periodos: [novo], sistema: true, pontual: { contabilizar: contabilizar } });
          api.cortarAjustes(cpf, H.menos([H.faixa(s.periodo)], [f]));
        }
        : function () {
          var r = api.rascunho();
          r.folgas = r.folgas.filter(function (x) { return x.cpf !== cpf; });
          if (saem.length) api.darFolga(cpf, contabilizar, saem.map(H.periodo), est.motivo);
        }, false);
    }

    /* no pontual, as horas livres dele no dia (a leitura do Adicionar militar) somam onde o horário pode ficar */
    function lerLivres(aoLer) {
      if (!pontual) return;
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId()).then(function (resp) {
        var m = (resp || []).filter(function (x) { return x.cpf === cpf; })[0];
        if (!m) return;
        var dele = (m.ocupado || []).filter(function (o) { return o.tipo === 'pontual'; });
        est.livres = H.uniao([H.faixa(s.periodo)].concat((m.livres || []).concat(dele).map(H.faixa)));
        if (aoLer) aoLer();
      });
    }

    return { cpf: cpf, nome: nome, pontual: pontual, servico: pontual ? s.periodo : H.periodo(base[0]), est: est,
      opcoes: function () { return H.opcoesHoras(est.livres.map(H.periodo)); },
      dentro: dentro, calcular: calcular, aplicar: aplicar, lerLivres: lerLivres };
  }

  /* ---------- a sub-tela ---------- */

  /* opcoes = { cpf } */
  function abrir(opcoes) {
    var api = ed(), H = api.horas;
    var sessao = criar(opcoes && opcoes.cpf);
    if (!sessao) return;
    var est = sessao.est, el = {};

    function montarHora() {
      el.periodo.textContent = '';
      var linha = RosterWork.horario.linha({
        hi: est.periodo.hi, hf: est.periodo.hf, opcoes: sessao.opcoes(), erro: !sessao.dentro(), semAcoes: true,
        aoInicio: function (h) { est.periodo.hi = h; montarHora(); atualizar(); },
        aoFim: function (h) { est.periodo.hf = h; montarHora(); atualizar(); }
      });
      if (linha) el.periodo.appendChild(linha);
    }

    function atualizar() {
      var c = sessao.calcular();
      mostra(el.erro, !c.ok);
      if (!c.ok) el.erro.querySelector('.nota-texto').textContent = L().horarioDiaOcupado(sessao.nome);
      mostra(el.efeito, !!c.texto);
      el.efeito.querySelector('.nota-texto').textContent = c.texto;
      mostra(el.banco, c.pergunta);
      mostra(el.desconta, !sessao.pontual);
      mostra(el.contabiliza, sessao.pontual);
      if (c.pergunta && !sessao.pontual) el.descontaSim.textContent = c.sim;
      if (c.pergunta && sessao.pontual) el.contabilizaSim.textContent = c.sim;
      sessao.aplicar(c);
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-horario-dia');
      if (!tela) return;
      var q = function (x) { return tela.querySelector(x); };
      el = {
        servico: q('.escala-horario-dia-servico'), periodo: q('.escala-horario-dia-periodo'), efeito: q('.escala-horario-dia-efeito'),
        erro: q('.escala-horario-dia-erro'), banco: q('.escala-horario-dia-banco'), desconta: q('.escala-horario-dia-descontar'),
        contabiliza: q('.escala-horario-dia-contabilizar'), descontaSim: q('.escala-horario-dia-descontar-sim'),
        contabilizaSim: q('.escala-horario-dia-contabilizar-sim')
      };
      var servico = sessao.servico;
      el.servico.textContent = L().horarioDiaServico(sessao.nome, diaMes(api.iso()), sessao.pontual, msg().dasAs(H.curta(servico.hi), H.curta(servico.hf)));
      var marcarDesconta = ligarRadios(el.desconta, function (v) { est.banco = v; atualizar(); });
      /* pelo ciclo, o Motivo da folga, embaixo das respostas (a caixa do Descontar some no pontual) */
      R().campoMotivo(el.desconta, est.motivo, function (t) { est.motivo = t; sessao.aplicar(); });
      var marcarContabiliza = ligarRadios(el.contabiliza, function (v) { est.banco = v; atualizar(); });
      if (sessao.pontual) marcarContabiliza(est.banco);
      else marcarDesconta(est.banco);
      corpo.appendChild(tela);
      montarHora();
      atualizar();
      sessao.lerLivres(function () {
        if (!el.periodo || !el.periodo.isConnected) return;
        montarHora();
        atualizar();
      });
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelHorarioDia = { abrir: abrir, pode: pode, criar: criar };
})();
