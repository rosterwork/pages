/* ============================================================
   POSTOS — seção Manutenção do painel de viatura (só admin).
   A manutenção é um PERÍODO (janela), como as Férias de um militar:
   um form "Agendar manutenção" (início + fim pelo calendário +
   observação opcional) em cima e a lista de janelas embaixo (período
   + selo Agendada/Em manutenção/Concluída + observação, com Remover).
   Enquanto uma janela cobre hoje, a viatura fica em manutenção
   (o card mostra "Manutenção até DD/MM") — derivado, o Estado não muda.
   Fonte: listar_manutencoes_viatura. Agendar → inserir_manutencao;
   Remover → remover_manutencao. Cada ação avisa o painel (aoMudar)
   e abre o resumo. Moldes em postos.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { viatura, aoMudar, corpo, listaEl, valores, btnAgendar }

  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* datas (ISO AAAA-MM-DD <-> Date <-> DD/MM/AAAA) */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isoDeData(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dataDeIso(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function formatarData(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  /* ---------- form "Agendar manutenção" ---------- */

  /* o fim é opcional (manutenção em aberto); quando há fim, ele não pode ser antes do início */
  function atualizarAgendar() {
    var v = ctx && ctx.valores;
    var ok = !!(v && v.inicio && (!v.fim || v.inicio <= v.fim));
    if (ctx && ctx.btnAgendar) ctx.btnAgendar.disabled = !ok;
    if (ctx && ctx.btnLimparFim) ctx.btnLimparFim.classList.toggle('oculto', !(v && v.fim));
  }

  function ligarData(gatilho, chave, obterPadrao) {
    if (!gatilho || !RosterWork.calendario || !RosterWork.calendario.ligar) return;
    RosterWork.calendario.ligar(gatilho, {
      obterData: function () { return ctx.valores[chave] ? dataDeIso(ctx.valores[chave]) : obterPadrao(); },
      aoEscolher: function (d) { ctx.valores[chave] = isoDeData(d); definirTexto(gatilho, formatarData(ctx.valores[chave])); atualizarAgendar(); }
    });
  }

  function montarForm(slot) {
    var form = RosterWork.tpl('tpl-viatura-manut-form');
    if (!form) return;
    var gIni = form.querySelector('.viatura-manut-inicio');
    var gFim = form.querySelector('.viatura-manut-fim');
    ligarData(gIni, 'inicio', function () { return new Date(); });
    ligarData(gFim, 'fim', function () { return ctx.valores.inicio ? dataDeIso(ctx.valores.inicio) : new Date(); });

    /* "Deixar em aberto": limpa o fim escolhido e volta o campo ao estado vazio */
    ctx.btnLimparFim = form.querySelector('.viatura-manut-fim-limpar');
    if (ctx.btnLimparFim) {
      ctx.btnLimparFim.addEventListener('click', function () {
        ctx.valores.fim = null;
        definirTexto(gFim, 'Em aberto', true);
        atualizarAgendar();
      });
    }

    var obs = form.querySelector('.viatura-manut-obs');
    if (obs) obs.addEventListener('input', function () { ctx.valores.obs = obs.value; });

    ctx.btnAgendar = form.querySelector('.viatura-manut-agendar');
    if (ctx.btnAgendar) ctx.btnAgendar.addEventListener('click', agendar);
    atualizarAgendar();
    slot.appendChild(form);
  }

  /* ---------- lista de janelas ---------- */

  function estado(texto) {
    var el = RosterWork.tpl('tpl-viatura-manut-vazio');
    if (el) el.textContent = texto;
    return el;
  }

  /* "10/07/2026 a 25/07/2026" ou, sem fim, "desde 10/07/2026 (em aberto)" */
  function textoPeriodo(m) {
    return m.data_fim
      ? formatarData(m.data_inicio) + ' a ' + formatarData(m.data_fim)
      : 'desde ' + formatarData(m.data_inicio) + ' (em aberto)';
  }

  function montarItem(m) {
    var item = RosterWork.tpl('tpl-viatura-manut-item');
    if (!item) return null;
    item.querySelector('.viatura-manut-item-periodo').textContent = textoPeriodo(m);
    var selo = item.querySelector('.viatura-manut-item-selo');
    selo.textContent = m.situacao;
    if (m.situacao === 'Em manutenção') selo.classList.add('selo--alerta');
    else if (m.situacao === 'Agendada') selo.classList.add('selo--escuro');
    var obs = item.querySelector('.viatura-manut-item-obs');
    if (m.observacao) obs.textContent = m.observacao; else obs.classList.add('oculto');
    /* só a janela em aberto pode ser encerrada */
    var btnEnc = item.querySelector('.viatura-manut-encerrar');
    if (btnEnc && !m.data_fim) {
      btnEnc.classList.remove('oculto');
      btnEnc.addEventListener('click', function () { confirmarEncerrar(m); });
    }
    var btn = item.querySelector('.viatura-manut-remover');
    if (btn) btn.addEventListener('click', function () { confirmarRemover(m); });
    return item;
  }

  function renderLista(lista) {
    if (!ctx || !ctx.listaEl) return;
    ctx.listaEl.textContent = '';
    if (lista === null) {
      var erro = estado(RosterWork.mensagens.postos.falhaManutencoes);
      if (erro) ctx.listaEl.appendChild(erro);
      return;
    }
    if (!lista.length) {
      var vazio = RosterWork.tpl('tpl-viatura-manut-vazio');
      if (vazio) ctx.listaEl.appendChild(vazio);
      return;
    }
    lista.forEach(function (m) { var el = montarItem(m); if (el) ctx.listaEl.appendChild(el); });
  }

  function carregarLista() {
    if (!ctx || !ctx.listaEl) return;
    RosterWork.apiFetch('/rest/v1/rpc/listar_manutencoes_viatura', { metodo: 'POST', corpo: { p_viatura_id: ctx.viatura.id_viatura } })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (lista) { renderLista(Array.isArray(lista) ? lista : null); })
      .catch(function () { renderLista(null); });
  }

  /* refaz a seção inteira (form limpo + lista atualizada) após agendar/remover */
  function recarregar() {
    if (!ctx || !ctx.corpo) return;
    montar(ctx.corpo, ctx.viatura, { aoMudar: ctx.aoMudar });
  }

  /* ---------- ações ---------- */

  function agendar() {
    if (!ctx || !ctx.valores.inicio) return;   /* o fim é opcional: sem ele, a manutenção fica em aberto */
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/inserir_manutencao', {
      metodo: 'POST',
      corpo: {
        p_viatura_id: ctx.viatura.id_viatura, p_data_inicio: ctx.valores.inicio,
        p_data_fim: ctx.valores.fim, p_observacao: ctx.valores.obs, p_por: RosterWork.sessao.cpf()
      }
    })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          if (ctx.aoMudar) ctx.aoMudar(r.em_manutencao, r.manutencao_ate);
          recarregar();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaAgendarManutencao });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* encerra a janela em aberto (fecha hoje; a viatura volta para a distribuição) */
  function confirmarEncerrar(m) {
    if (!RosterWork.confirmar) { encerrar(m.id_manutencao); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.postos.confirmarEncerrarManutencao
        .replace('{prefixo}', (ctx && ctx.viatura && ctx.viatura.nome) || ''),
      textoConfirmar: 'Encerrar',
      textoCancelar: RosterWork.mensagens.botoes.cancelar,
      aoConfirmar: function () { encerrar(m.id_manutencao); }
    });
  }

  function encerrar(id) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/encerrar_manutencao', {
      metodo: 'POST', corpo: { p_manutencao_id: id, p_por: RosterWork.sessao.cpf() }
    })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          if (ctx.aoMudar) ctx.aoMudar(r.em_manutencao, r.manutencao_ate);
          recarregar();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaEncerrarManutencao });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  function confirmarRemover(m) {
    if (!RosterWork.confirmar) { remover(m.id_manutencao); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.postos.confirmarRemoverManutencao,
      textoConfirmar: RosterWork.mensagens.botoes.remover,
      textoCancelar: RosterWork.mensagens.botoes.cancelar,
      aoConfirmar: function () { remover(m.id_manutencao); }
    });
  }

  function remover(id) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/remover_manutencao', {
      metodo: 'POST', corpo: { p_manutencao_id: id, p_por: RosterWork.sessao.cpf() }
    })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          if (ctx.aoMudar) ctx.aoMudar(r.em_manutencao, r.manutencao_ate);
          recarregar();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaRemoverManutencao });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* ---------- API ---------- */

  /* monta a seção Manutenção dentro de `corpo` (o painel a chama ao abrir) */
  function montar(corpo, viatura, opcoes) {
    if (!corpo || !viatura) return;
    corpo.textContent = '';
    ctx = {
      viatura: viatura,
      aoMudar: opcoes && opcoes.aoMudar,
      corpo: corpo, listaEl: null, btnAgendar: null, btnLimparFim: null,
      valores: { inicio: null, fim: null, obs: '' }
    };
    var raiz = RosterWork.tpl('tpl-viatura-manutencao');
    if (!raiz) return;
    ctx.listaEl = raiz.querySelector('.viatura-manut-lista');
    montarForm(raiz.querySelector('.viatura-manut-form-slot'));
    corpo.appendChild(raiz);
    carregarLista();
  }

  function reset() { ctx = null; }

  window.RosterWork.postosViaturasManutencao = { montar: montar, reset: reset };
})();
