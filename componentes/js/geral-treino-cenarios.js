/* ============================================================
   TREINO › EXEMPLOS — a situação que o treino pede (RosterWork.treinoCenarios)
   Alguns treinos precisam de algo que o dia pode não ter: um horário
   sem ninguém, uma folga, uma troca, um ajuste manual ou alguém fora
   do ciclo. O roteiro com data-cenario liga o exemplo quando começa
   no Treinamento (geral-treino.js); enquanto ele está em curso, a
   leitura do dia que volta do banco ganha a situação, só na memória
   desta tela e com militares de verdade da unidade. No ? (fora do
   treino) nada disso existe: o passo explica quando falta a situação.
   - horario-vazio: um militar de uma função (fora da chefia) fica das
     08h às 20h, e das 20h às 08h a função fica sem ninguém;
   - folga: um militar de serviço vai para De folga (a folga de
     mentira, "treino-folga");
   - troca-no-dia: um militar de serviço está no dia por uma troca
     ("treino-troca", com o plano e o ensaio do Desfazer de mentira;
     o dono do serviço é alguém da unidade que serve em outro dia);
   - ajuste-manual: um militar fica fixado na função (o ajuste de
     mentira em ajustes_salvos), e o dia tem o Voltar ao automático;
   - ciclo-fora: sem ninguém de verdade fora do ciclo, um dos que
     servem em outros dias aparece fora (Adicionar vai à prévia como
     mudar para o ciclo deste dia, depois do último serviço dele);
   - extra-<etapa>: o mês de treino da Extrajornada, montado pelo banco
     (geral-treino-extra.js);
   - troca-<nome>, folga-<nome>, cnh-falta e dados-correcao: o exemplo
     montado pelo banco (geral-treino-banco.js).
   O que a tela manda ao banco sai sempre sem as peças de mentira (a
   prévia do painel do dia); a resposta da prévia volta com o exemplo,
   menos o que a pessoa já desfez (a folga cancelada, o ajuste tirado,
   o horário preenchido por ele mesmo). Nada é gravado: o treino só
   deixa passar leituras e ensaios.
   API: ativar(nome, roteiro), passar(nomeRpc, corpo, buscar).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var ID_FOLGA = 'treino-folga';
  var ID_TROCA = 'treino-troca';
  var CHEFIA = /chefe|oficial/i;   // as funções de comando ficam de fora dos exemplos

  var ativo = null;      // { nome, roteiro }
  var escolhas = {};     // a peça de cada exemplo por dia (exemplo|unidade|dia), a mesma em todas as leituras

  function emCurso() { return !!ativo && !!RW.guia && RW.guia.emCurso() === ativo.roteiro; }
  /* o exemplo do roteiro; o da Extrajornada (extra-<etapa>) é o mês de treino, no geral-treino-extra.js, e os das
     trocas, das folgas, da CNH e da correção de dados vêm do banco, no geral-treino-banco.js */
  function ativar(nome, roteiro) {
    ativo = nome ? { nome: nome, roteiro: roteiro } : null;
    escolhas = {};
    if (RW.treinoExtra) RW.treinoExtra.ativar(nome && nome.indexOf('extra-') === 0 ? nome.slice(6) : null);
    if (RW.treinoBanco) RW.treinoBanco.ativar(nome && /^(troca|folga|cnh|dados)-/.test(nome) ? nome : null);
  }
  function copiar(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function chave(uid, iso) { return ativo.nome + '|' + uid + '|' + iso; }
  function resposta(dados) { return new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function diaInteiro(m) { var p = m.periodos || []; return p.length === 1 && p[0].hi.slice(0, 5) === '08:00' && p[0].hf.slice(0, 5) === '08:00'; }
  function maisDias(iso, n) {
    var p = iso.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------- as peças do dia ---------- */
  function cadaFuncao(d, fn) { (d.postos || []).forEach(function (po) { (po.funcoes || []).forEach(function (f) { fn(po, f); }); }); }
  function acharFuncao(d, e) {
    var achou = null;
    cadaFuncao(d, function (po, f) { if (po.id === e.posto && f.nome === e.funcao) achou = f; });
    return achou;
  }
  /* a peça do exemplo: a função com um militar só, no dia inteiro, fora da chefia; soUmaVez = o militar não está em
     outra função (para sair dela sem esvaziar outras). Escolhida na primeira leitura do dia e guardada */
  function escolher(d, uid, iso, soUmaVez) {
    var k = chave(uid, iso);
    if (k in escolhas) return escolhas[k];
    var vezes = {};
    cadaFuncao(d, function (po, f) { (f.militares || []).forEach(function (m) { vezes[m.cpf] = (vezes[m.cpf] || 0) + 1; }); });
    var achou = null;
    cadaFuncao(d, function (po, f) {
      var ms = f.militares || [];
      if (achou || ms.length !== 1 || !diaInteiro(ms[0]) || CHEFIA.test(f.nome) || (soUmaVez && vezes[ms[0].cpf] > 1)) return;
      achou = { posto: po.id, tipo: po.tipo, funcao: f.nome, cpf: ms[0].cpf, grad: ms[0].grad, nome: ms[0].nome };
    });
    escolhas[k] = achou;
    return achou;
  }
  /* minutos de 08h a 08h: "20:00" → 720; o fim "08:00" do dia seguinte → 1440 */
  function minutos(h, fim) {
    var p = h.split(':'), m = (Number(p[0]) * 60 + Number(p[1]) - 480 + 1440) % 1440;
    return fim && m === 0 ? 1440 : m;
  }
  /* alguém cobre das 20h às 08h? */
  function cobreANoite(militares) {
    var coberto = [];
    militares.forEach(function (m) {
      (m.periodos || []).forEach(function (p) {
        for (var x = Math.max(minutos(p.hi), 720); x < minutos(p.hf, true); x++) coberto[x] = true;
      });
    });
    for (var x = 720; x < 1440; x++) if (!coberto[x]) return false;
    return true;
  }

  /* cada exemplo no dia lido (d), com o pedido da prévia (o que a pessoa já fez) ou null na leitura gravada */
  var NO_DIA = {
    'horario-vazio': function (d, e, dia) {
      var f = acharFuncao(d, e);
      var m = f && (f.militares || []).filter(function (x) { return x.cpf === e.cpf; })[0];
      if (!m || !diaInteiro(m)) return;
      /* ele mesmo escolhido para a noite: o exemplo some */
      if (dia && (dia.ajustes || []).some(function (a) { return a.acao === 'colocar' && a.cpf === e.cpf && a.nome_funcao === e.funcao; })) return;
      m.periodos = [{ hi: '08:00', hf: '20:00' }];
      if (cobreANoite(f.militares.filter(function (x) { return x !== m; }))) {
        /* a noite foi preenchida: com ele só até as 20h, ninguém se sobrepõe */
        f.sobreposicao = false;
        d.problemas = (d.problemas || []).filter(function (p) { return !(p.codigo === 'sobreposicao' && (p.cpf === e.cpf || p.funcao === e.funcao)); });
        return;
      }
      f.vao = (f.vao || []).filter(function (v) { return v.hi !== '20:00'; }).concat([{ hi: '20:00', hf: '08:00' }]);
    },
    'folga': function (d, e, dia) {
      if (dia && (dia.folgas_cancelar || []).indexOf(ID_FOLGA) >= 0) return;   // a folga foi cancelada: ele volta
      var f = acharFuncao(d, e);
      if (!f || !(f.militares || []).some(function (x) { return x.cpf === e.cpf; })) return;
      f.militares = f.militares.filter(function (x) { return x.cpf !== e.cpf; });
      if (!f.militares.length) f.vao = [{ hi: '08:00', hf: '08:00' }];
      d.folgas = (d.folgas || []).concat([{ cpf: e.cpf, grad: e.grad, nome: e.nome, hi: '08:00', hf: '08:00',
        lancamento_id: ID_FOLGA, contabilizada: true, dia_inteiro: true }]);
    },
    'troca-no-dia': function (d, e) {
      cadaFuncao(d, function (po, f) { (f.militares || []).forEach(function (m) { if (m.cpf === e.cpf) m.origem = 'troca'; }); });
      (d.picker || []).forEach(function (u) {
        (u.militares || []).forEach(function (m) {
          if (m.cpf === e.cpf) m.disp = (m.disp || []).map(function (j) { return Object.assign({}, j, { origem: 'troca', troca_id: ID_TROCA }); });
        });
      });
    },
    'ajuste-manual': function (d, e, dia) {
      if (dia && !(dia.ajustes || []).some(function (a) { return a.treino; })) return;
      var f = acharFuncao(d, e);
      var m = f && (f.militares || []).filter(function (x) { return x.cpf === e.cpf; })[0];
      if (!m) return;
      m.fixado = true;
      m.automatico = false;
      d.ajustes_salvos = (d.ajustes_salvos || []).concat([{ acao: 'colocar', cpf: e.cpf, nome_funcao: e.funcao,
        viatura_id: e.tipo === 'viatura' ? e.posto : null, instalacao_id: e.tipo === 'instalacao' ? e.posto : null,
        substitui: null, hi: '08:00', hf: '08:00', acumula: true, treino: true }]);
    }
  };

  /* o dono do serviço da troca de mentira: alguém da unidade no ciclo que serve em outro dia */
  function donoDaTroca(uid, iso, e) {
    return RW.escalasDados.continuosListar(uid, iso).then(function (r) {
      var ms = (r && r.militares) || [];
      var dono = ms.filter(function (m) { return m.cpf !== e.cpf && m.estado !== 'fora' && !m.serve_hoje; })[0];
      e.dono = dono ? nomeDe(dono) : RW.mensagens.treino.donoDaTroca;
    }, function () { e.dono = RW.mensagens.treino.donoDaTroca; });
  }

  /* a leitura do dia (a gravada ou a prévia) com o exemplo */
  function noDia(d, uid, iso, dia) {
    var fazer = NO_DIA[ativo.nome];
    if (!fazer || !d || !d.postos) return Promise.resolve(d);
    var e = escolher(d, uid, iso, ativo.nome === 'folga' || ativo.nome === 'troca-no-dia');
    if (!e) return Promise.resolve(d);
    fazer(d, e, dia);
    if (ativo.nome !== 'troca-no-dia' || e.dono) return Promise.resolve(d);
    return donoDaTroca(uid, iso, e).then(function () { return d; });
  }

  /* o ciclo da unidade no dia: sem ninguém fora do ciclo, um dos que servem em outros dias aparece fora */
  function noCiclo(r, uid, iso) {
    var ms = (r && r.militares) || [];
    var k = chave(uid, iso);
    if (!(k in escolhas)) {
      var temFora = ms.some(function (m) { return m.estado === 'fora'; });
      var m = temFora ? null : ms.filter(function (x) { return x.estado !== 'fora' && x.estado !== 'saida_marcada' && !x.serve_hoje && !x.folga_hoje; })[0];
      var lista = m ? (m.ultimos_servicos || []) : [];
      escolhas[k] = m ? { cpf: m.cpf, ultimo: m.ultimo_servico || lista[lista.length - 1] || null } : null;
    }
    var e = escolhas[k];
    if (!e) return r;
    ms.forEach(function (x) {
      if (x.cpf !== e.cpf) return;
      x.estado = 'fora';
      x.afastamento = null;
      x.entra_em = null;
    });
    return r;
  }

  /* ---------- o pedido: sai sem as peças de mentira ---------- */
  function limparPedido(nome, corpo) {
    if (!corpo || (nome !== 'escala_previa' && nome !== 'escala_painel_salvar')) return corpo;
    var c = copiar(corpo), dia = c.p_dia;
    if (dia) {
      if (dia.ajustes) dia.ajustes = dia.ajustes.filter(function (a) { return !a.treino; });
      if (dia.antes && dia.antes.ajustes) dia.antes.ajustes = dia.antes.ajustes.filter(function (a) { return !a.treino; });
      if (dia.folgas_cancelar) {
        dia.folgas_cancelar = dia.folgas_cancelar.filter(function (id) { return id !== ID_FOLGA; });
        if (!dia.folgas_cancelar.length) delete dia.folgas_cancelar;
      }
    }
    /* quem aparece fora do ciclo só no treino já está no ciclo: o Adicionar dele é mudar de ciclo */
    (c.p_ciclo || []).forEach(function (x) {
      Object.keys(escolhas).forEach(function (k) {
        var e = escolhas[k];
        if (e && e.ultimo !== undefined && e.cpf === x.cpf && x.acao === 'adicionar' && !x.ultimo_servico && e.ultimo) x.ultimo_servico = e.ultimo;
      });
    });
    return c;
  }

  /* ---------- o Desfazer da troca de mentira: o plano e o ensaio ---------- */
  function trocaDeMentira(corpo) {
    var e = null;
    Object.keys(escolhas).forEach(function (k) { if (escolhas[k] && escolhas[k].cpf === corpo.p_cpf) e = escolhas[k]; });
    var sai = e ? nomeDe(e) : '', volta = (e && e.dono) || RW.mensagens.treino.donoDaTroca;
    var iso = corpo.p_data, futuro = maisDias(iso, 4);
    if (!corpo.p_ensaio) {
      return { ok: true, registro: { numero: 1, ano: Number(iso.slice(0, 4)) }, minutos: 1440, sai: sai, volta: volta,
        dias: [{ data: iso, este: true, minutos: 1440, cumpre: sai, no_lugar_de: volta },
          { data: futuro, este: false, minutos: 1440, cumpre: volta, no_lugar_de: sai }],
        junto: [{ troca_id: ID_TROCA + '-volta', parte: 'a', data: futuro, minutos: 1440 }] };
    }
    var previa = { dias: [{ data: iso, volta: volta, minutos: 1440 }], saldos: [], banco: null, conflitos: [],
      documentos: [{ numero: 1, ano: Number(iso.slice(0, 4)), parte_numero: null, parte_ano: null }] };
    if (corpo.p_acao === 'troca') previa.dias.push({ data: futuro, volta: sai, minutos: 1440 });
    if (corpo.p_acao === 'saldo') previa.saldos = [{ deve: sai, minutos: 1440, a: volta }];
    if (corpo.p_acao === 'banco') previa.banco = { quem: volta, minutos: 1440, depois: 0 };
    return { ok: true, previa: previa };
  }

  /* a chamada que o treino deixou passar: o pedido vai limpo; a resposta das leituras do dia volta com o exemplo */
  function passar(nome, corpo, buscar) {
    if (nome === 'fn_trocas_cancelar_dia' && corpo && corpo.p_troca_id === ID_TROCA) return Promise.resolve(resposta(trocaDeMentira(corpo)));
    var limpo = limparPedido(nome, corpo);
    var doDia = nome === 'ler_distribuicao_dia' || (nome === 'escala_previa' && corpo && corpo.p_leitura === 'ler_distribuicao_dia');
    var doCiclo = nome === 'escala_continuos_listar' && !!ativo && ativo.nome === 'ciclo-fora';
    if (!emCurso() || !(doDia || doCiclo)) return buscar(limpo);
    return buscar(limpo).then(function (r) {
      if (!r.ok) return r;
      return r.json().then(function (dados) {
        if (!dados || !corpo) return resposta(dados);
        var uid = corpo.p_unidade_id, iso = corpo.p_data;
        if (doCiclo) return resposta(noCiclo(dados, uid, iso));
        return noDia(dados, uid, iso, nome === 'escala_previa' ? corpo.p_dia : null).then(resposta);
      });
    });
  }

  RW.treinoCenarios = { ativar: ativar, passar: passar };
})();
