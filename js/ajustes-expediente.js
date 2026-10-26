/* ============================================================
   AJUSTES — aba Expediente: o expediente dos administrativos
   O mês de cada unidade marcada no seletor (expediente_mes): o dia
   de expediente com o horário quando foge do padrão, a folga em
   cinza com o motivo e quem marcou. O administrador clica no dia e
   marca no painel direito (expediente_salvar: um dia ou até o dia
   escolhido, para as unidades do "Vale para"); o lápis da unidade
   muda o horário padrão (expediente_padrao_salvar). O dia marcado
   por um nível acima só aparece para leitura (o de cima vale).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.ajustesExpediente.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var mes = null;        // primeiro dia do mês da tela (Date)
  var dados = null;      // a resposta do expediente_mes
  var pedido = 0;        // latest-wins
  var edicao = null;     // o painel aberto: { tipo, valores, inicial, btnSalvar, ... }
  var guardaLigada = false;

  function msg() { return RW.mensagens.ajustes.expediente; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDe(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hora(h) { return h ? (h.slice(3) === '00' ? h.slice(0, 2) + 'h' : h.slice(0, 2) + 'h' + h.slice(3)) : ''; }
  function idsSelecionados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* ---------- o mês ---------- */
  function carregar() {
    var meu = ++pedido;
    var nome = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    el.nome.textContent = nome;
    el.unidades.textContent = '';
    RW.rpc('expediente_mes', { p_unidades: idsSelecionados(), p_mes: iso(mes) }).then(function (r) {
      if (meu !== pedido || !el.unidades.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      desenhar();
    }, function () { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function desenhar() {
    el.unidades.textContent = '';
    dados.unidades.forEach(function (u) {
      var bloco = RW.tpl('tpl-exp-unidade');
      bloco.querySelector('.ajustes-exp-bloco-titulo').textContent = u.nome;
      bloco.querySelector('.ajustes-exp-bloco-cidade').textContent = u.cidade;
      bloco.querySelector('.ajustes-exp-padrao').textContent = msg().padrao(u.padrao, hora);
      var lapis = bloco.querySelector('.ajustes-exp-padrao-editar');
      if (u.pode_editar) {
        lapis.classList.remove('oculto');
        lapis.addEventListener('click', function () { abrirPadrao(u); });
      }
      var cal = bloco.querySelector('.ajustes-exp-cal');
      for (var i = 0; i < mes.getDay(); i++) cal.appendChild(RW.tpl('tpl-exp-dia-vazio'));
      var dias = (dados.dias && dados.dias[String(u.id)]) || {};
      Object.keys(dias).sort().forEach(function (k) { cal.appendChild(celula(u, k, dias[k])); });
      el.unidades.appendChild(bloco);
    });
  }

  function celula(u, k, d) {
    var c = RW.tpl('tpl-exp-dia');
    var data = dataDe(k);
    c.querySelector('.ajustes-exp-dia-num').textContent = data.getDate();
    var texto = '';
    if (!d.trabalha) {
      c.classList.add('ajustes-exp-dia--folga');
      texto = d.nome || (d.motivo === 'fim_de_semana' ? '' : msg().motivos[d.motivo]);
    } else if (d.fonte !== 'padrao' || d.das !== u.padrao.das || d.ate !== u.padrao.ate) {
      texto = msg().horas(hora(d.das), hora(d.ate));
    }
    c.querySelector('.ajustes-exp-dia-texto').textContent = texto;
    c.querySelector('.ajustes-exp-dia-origem').textContent = d.fonte === 'nacional' ? msg().nacional : (d.origem || '');
    c.setAttribute('aria-label', msg().diaLongo(data) + ': ' + d.texto);
    if (u.pode_editar) {
      c.classList.add('ajustes-exp-dia--clicavel');
      c.addEventListener('click', function () { abrirDia(u, k, d); });
    } else {
      c.disabled = true;
    }
    return c;
  }

  /* ---------- painel direito ---------- */
  function sujo() { return !!(edicao && JSON.stringify(edicao.valores) !== edicao.inicial); }

  function tentarFechar() {
    if (!sujo()) { RW.painel.fechar(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.sairSemSalvar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { edicao = null; RW.painel.fechar(); }
    });
  }

  function abrirPainel(titulo, subtitulo) {
    RW.painel.abrir({
      titulo: titulo,
      subtitulo: subtitulo,
      aoFechar: function () { edicao = null; },
      aoTentarFechar: function () { if (!sujo()) return false; tentarFechar(); return true; }
    });
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }
  }

  function travado(texto) {
    var t = RW.tpl('tpl-exp-travado');
    t.textContent = texto;
    RW.painel.corpo().appendChild(t);
  }

  function ligarRodape(salvar, validar) {
    var rodape = RW.painel.rodape();
    rodape.appendChild(document.getElementById('tpl-ajuste-painel-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    edicao.btnSalvar = rodape.querySelector('#ajuste-salvar');
    rodape.querySelector('#ajuste-cancelar').addEventListener('click', tentarFechar);
    edicao.btnSalvar.addEventListener('click', salvar);
    edicao.validar = validar;
    atualizar();
  }

  function atualizar() { if (edicao && edicao.btnSalvar) edicao.btnSalvar.disabled = !sujo() || !edicao.validar(); }

  function marcador(botao, marcado, aoMudar) {
    function pintar(v) {
      botao.setAttribute('aria-checked', v ? 'true' : 'false');
      botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', v);
    }
    pintar(marcado);
    botao.addEventListener('click', function () {
      var v = botao.getAttribute('aria-checked') !== 'true';
      pintar(v);
      aoMudar(v);
    });
  }

  /* o dia: Trabalha (das/às) ou Folga (motivo), até o dia escolhido, para as unidades do "Vale para" */
  function abrirDia(u, k, d) {
    var data = dataDe(k);
    abrirPainel(msg().diaLongo(data), u.nome);
    var corpo = RW.painel.corpo();
    if (d.travado) { travado(msg().travadoDia(d.origem || '')); return; }
    var f = RW.tpl('tpl-exp-dia-form');
    f.querySelector('.ajustes-exp-agora').textContent = msg().agora(d.texto);
    var v = {
      tipo: d.fonte === 'marcado' ? (d.trabalha ? 'trabalha' : 'folga') : '',
      das: d.trabalha ? d.das : u.padrao.das, ate: d.trabalha ? d.ate : u.padrao.ate,
      motivo: d.fonte === 'marcado' && !d.trabalha ? d.motivo : '',
      nome: d.fonte === 'marcado' ? (d.nome || '') : '',
      fim: k, todo_ano: d.fonte === 'marcado' && d.todo_ano, unidades: [u.id]
    };
    edicao = { valores: v, inicial: JSON.stringify(v), uid: u.id };

    Array.prototype.forEach.call(f.querySelectorAll('input[name="exp-tipo"]'), function (r) {
      r.checked = r.value === v.tipo;
      r.addEventListener('change', function () { v.tipo = r.value; atualizar(); });
    });
    Array.prototype.forEach.call(f.querySelectorAll('input[name="exp-motivo"]'), function (r) {
      r.checked = r.value === v.motivo;
      r.addEventListener('change', function () { v.motivo = r.value; v.tipo = 'folga'; f.querySelector('input[name="exp-tipo"][value="folga"]').checked = true; atualizar(); });
    });
    [['exp-das', 'das'], ['exp-ate', 'ate'], ['exp-nome', 'nome'], ['exp-fim', 'fim']].forEach(function (p) {
      var inp = f.querySelector('[name="' + p[0] + '"]');
      inp.value = v[p[1]] || '';
      inp.addEventListener('input', function () {
        v[p[1]] = inp.value;
        if (p[1] === 'das' || p[1] === 'ate') { v.tipo = 'trabalha'; f.querySelector('input[name="exp-tipo"][value="trabalha"]').checked = true; }
        atualizar();
      });
    });
    f.querySelector('[name="exp-fim"]').min = k;
    marcador(f.querySelector('[data-campo="todo_ano"]'), v.todo_ano, function (x) { v.todo_ano = x; atualizar(); });

    var vale = f.querySelector('.ajustes-exp-vale');
    dados.unidades.filter(function (x) { return x.pode_editar; }).forEach(function (x) {
      var item = RW.tpl('tpl-exp-vale-item');
      item.querySelector('.ajustes-exp-vale-nome').textContent = x.cidade ? x.nome + ' (' + x.cidade + ')' : x.nome;
      marcador(item, x.id === u.id, function (marcado) {
        v.unidades = v.unidades.filter(function (id) { return id !== x.id; });
        if (marcado) v.unidades.push(x.id);
        v.unidades.sort(function (a, b) { return a - b; });
        atualizar();
      });
      vale.appendChild(item);
    });

    var voltar = f.querySelector('.ajustes-exp-voltar');
    if (d.fonte === 'marcado') {
      voltar.classList.remove('oculto');
      voltar.addEventListener('click', function () { enviarDia(k, 'padrao', voltar); });
    }
    corpo.appendChild(f);
    ligarRodape(function () { enviarDia(k, v.tipo, edicao.btnSalvar); }, function () {
      if (!v.unidades.length || !v.fim || v.fim < k) return false;
      if (v.tipo === 'trabalha') return !!(v.das && v.ate && v.das < v.ate);
      return v.tipo === 'folga' && !!v.motivo;
    });
  }

  function enviarDia(k, acao, botao) {
    var v = edicao.valores;
    RW.iniciarCarregando(botao);
    RW.rpc('expediente_salvar', {
      p_unidades: acao === 'padrao' ? [edicao.uid] : v.unidades,
      p_inicio: k, p_fim: acao === 'padrao' ? k : v.fim, p_acao: acao,
      p_das: acao === 'trabalha' ? v.das : null, p_ate: acao === 'trabalha' ? v.ate : null,
      p_motivo: acao === 'folga' ? v.motivo : null, p_nome: acao === 'padrao' ? null : v.nome, p_todo_ano: acao !== 'padrao' && v.todo_ano
    }).then(concluir(botao), falhou(botao));
  }

  /* o horário padrão da unidade (ou voltar a usar o da unidade de cima) */
  function abrirPadrao(u) {
    abrirPainel(msg().tituloPadrao, u.nome);
    if (u.padrao.travado) { travado(msg().travadoPadrao); return; }
    var f = RW.tpl('tpl-exp-padrao-form');
    f.querySelector('.ajustes-exp-agora').textContent = msg().agora(msg().padrao(u.padrao, hora));
    var v = { das: u.padrao.das, ate: u.padrao.ate, qdas: u.padrao.quarta_das, qate: u.padrao.quarta_ate, herdar: !u.padrao.proprio };
    edicao = { valores: v, inicial: JSON.stringify(v) };
    [['exp-das', 'das'], ['exp-ate', 'ate'], ['exp-qdas', 'qdas'], ['exp-qate', 'qate']].forEach(function (p) {
      var inp = f.querySelector('[name="' + p[0] + '"]');
      inp.value = v[p[1]];
      inp.addEventListener('input', function () { v[p[1]] = inp.value; atualizar(); });
    });
    var herdar = f.querySelector('.ajustes-exp-herdar');
    marcador(herdar, v.herdar, function (x) { v.herdar = x; atualizar(); });
    RW.painel.corpo().appendChild(f);
    ligarRodape(function () {
      RW.iniciarCarregando(edicao.btnSalvar);
      RW.rpc('expediente_padrao_salvar', {
        p_unidade: u.id, p_das: v.das, p_ate: v.ate, p_quarta_das: v.qdas, p_quarta_ate: v.qate, p_herdar: v.herdar
      }).then(concluir(edicao.btnSalvar), falhou(edicao.btnSalvar));
    }, function () { return v.herdar || !!(v.das && v.ate && v.das < v.ate && v.qdas && v.qate && v.qdas < v.qate); });
  }

  function concluir(botao) {
    return function (r) {
      RW.pararCarregando(botao);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      edicao = null;
      RW.painel.fechar();
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Ajustes' });
      carregar();
    };
  }

  function falhou(botao) {
    return function (e) {
      RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao });
    };
  }

  /* ---------- entrada ---------- */
  function montar(cont) {
    el.unidades = cont.querySelector('#exp-unidades');
    el.nome = cont.querySelector('#exp-mes-nome');
    var hoje = new Date();
    mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    cont.querySelector('#exp-mes-anterior').addEventListener('click', function () { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); carregar(); });
    cont.querySelector('#exp-mes-proximo').addEventListener('click', function () { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); carregar(); });
  }

  function ativar() { carregar(); }

  RW.ajustesExpediente = { montar: montar, ativar: ativar };
})();
