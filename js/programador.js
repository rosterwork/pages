/* ============================================================
   PROGRAMADOR — MENSAGENS (só programador)
   Lista os recados (recados_listar), filtra por status, mostra o
   detalhe à direita (com o contexto), permite mudar o status
   (manual), editar/salvar assunto+mensagem e criar lembretes.
   Atualiza o selo do menu (RosterWork.recadosSelo).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var raiz = null;
  var recados = [];
  var filtro = 'todos';
  var selecionadoId = null;

  var SELO_STATUS = { nao_lido: 'selo--alerta', lido: '', resolvido: 'selo--sucesso' };

  function M() { return RosterWork.mensagens.programador; }
  function labelTipo(t) { return (M().tipos && M().tipos[t]) || t; }
  function labelStatus(s) { return (M().status && M().status[s]) || s; }
  function autorDe(rec) { return ((rec.autor_grad ? rec.autor_grad + ' ' : '') + (rec.autor_nome || '')).trim(); }

  /* ---------- carga ---------- */
  function iniciar(conteudo) {
    raiz = conteudo;
    ligarFiltro();
    ligarNovo();
    return carregar();
  }

  function carregar() {
    mostrarVazioDetalhe();
    return RosterWork.rpc('recados_listar').then(function (r) {
      recados = Array.isArray(r) ? r : [];
      renderLista();
      atualizarSubtitulo();
    }).catch(function () {
      recados = [];
      renderLista();
    });
  }

  function atualizarSubtitulo() {
    var sub = raiz.querySelector('.pagina-subtitulo');
    if (!sub) return;
    var n = recados.filter(function (r) { return r.status !== 'resolvido'; }).length;
    sub.textContent = n ? (n === 1 ? '1 não resolvida' : n + ' não resolvidas') : 'Tudo resolvido';
  }

  /* ---------- lista ---------- */
  function filtrados() {
    if (filtro === 'todos') return recados;
    return recados.filter(function (r) { return r.status === filtro; });
  }

  function renderLista() {
    var lista = raiz.querySelector('#programador-lista');
    if (!lista) return;
    lista.textContent = '';
    var itens = filtrados();
    if (!itens.length) {
      var vazio = RosterWork.tpl('tpl-programador-vazio');
      if (vazio) {
        var sp = vazio.querySelector('span');
        if (sp) sp.textContent = M().vazioLista;
        lista.appendChild(vazio);
      }
      return;
    }
    itens.forEach(function (rec) {
      var item = RosterWork.tpl('tpl-programador-item');
      if (!item) return;
      item.querySelector('.programador-item-assunto').textContent = rec.assunto || '';
      var selo = item.querySelector('.programador-item-selo');
      selo.textContent = labelStatus(rec.status);
      if (SELO_STATUS[rec.status]) selo.classList.add(SELO_STATUS[rec.status]);
      item.querySelector('.programador-item-tipo').textContent = labelTipo(rec.tipo);
      item.querySelector('.programador-item-autor').textContent = autorDe(rec);
      if (rec.id === selecionadoId) item.classList.add('lista-item--ativo');
      item.addEventListener('click', function () { selecionar(rec.id); });
      lista.appendChild(item);
    });
  }

  function recadoPorId(id) {
    for (var i = 0; i < recados.length; i++) if (recados[i].id === id) return recados[i];
    return null;
  }

  /* ---------- detalhe ---------- */
  function selecionar(id) {
    selecionadoId = id;
    renderLista();
    var rec = recadoPorId(id);
    var alvo = raiz.querySelector('#programador-detalhe');
    if (!alvo || !rec) return;
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-programador-detalhe');
    if (!no) return;

    var seloTipo = no.querySelector('.programador-detalhe-tipo');
    seloTipo.textContent = labelTipo(rec.tipo);
    if (rec.tipo === 'problema') seloTipo.classList.add('selo--alerta');
    else if (rec.tipo === 'lembrete') seloTipo.classList.add('selo--escuro');

    no.querySelector('.programador-detalhe-quando').textContent =
      (RosterWork.resumo && RosterWork.resumo.formatarQuando) ? RosterWork.resumo.formatarQuando(rec.criado_em) : '';
    no.querySelector('.programador-detalhe-autor').textContent = autorDe(rec);

    var inAssunto = no.querySelector('#programador-det-assunto');
    var inMensagem = no.querySelector('#programador-det-mensagem');
    inAssunto.value = rec.assunto || '';
    inMensagem.value = rec.mensagem || '';

    var trilho = no.querySelector('#programador-det-status');
    var abasStatus = trilho.querySelectorAll('.aba');
    abasStatus.forEach(function (b) {
      b.classList.toggle('aba--ativa', b.getAttribute('data-status') === rec.status);
      b.addEventListener('click', function () { mudarStatus(rec.id, b.getAttribute('data-status')); });
    });

    montarContexto(no, rec);

    var btnSalvar = no.querySelector('#programador-det-salvar');
    function revisar() {
      var mudou = (inAssunto.value.trim() !== (rec.assunto || '')) || (inMensagem.value !== (rec.mensagem || ''));
      btnSalvar.disabled = !mudou || !inAssunto.value.trim() || !inMensagem.value.trim();
    }
    inAssunto.addEventListener('input', revisar);
    inMensagem.addEventListener('input', revisar);
    btnSalvar.addEventListener('click', function () {
      salvarEdicao(rec, inAssunto.value.trim(), inMensagem.value.trim(), btnSalvar);
    });
    revisar();

    alvo.appendChild(no);
  }

  function montarContexto(no, rec) {
    var sec = no.querySelector('.programador-detalhe-contexto');
    var lista = no.querySelector('#programador-det-contexto');
    var ctx = rec.contexto;
    if (!ctx || typeof ctx !== 'object') { sec.classList.add('oculto'); return; }
    lista.textContent = '';
    var rot = M().contexto || {};
    ['pagina', 'aba', 'unidades', 'tela', 'tema', 'navegador', 'url'].forEach(function (k) {
      var v = ctx[k];
      if (v == null || v === '') return;
      if (k === 'unidades') {
        v = Array.isArray(v) ? (v.length + (v.length === 1 ? ' unidade' : ' unidades')) : String(v);
      }
      var linha = RosterWork.tpl('tpl-programador-contexto-linha');
      if (!linha) return;
      linha.querySelector('.linha-info-rotulo').textContent = rot[k] || k;
      linha.querySelector('.linha-info-valor').textContent = String(v);
      lista.appendChild(linha);
    });
    sec.classList.remove('oculto');
  }

  function mudarStatus(id, status) {
    RosterWork.rpc('recado_status', { p_id: id, p_status: status }).then(function (r) {
      if (r && r.success) {
        var rec = recadoPorId(id);
        if (rec) rec.status = status;
        var trilho = raiz.querySelector('#programador-det-status');
        if (trilho) trilho.querySelectorAll('.aba').forEach(function (b) {
          b.classList.toggle('aba--ativa', b.getAttribute('data-status') === status);
        });
        renderLista();
        atualizarSubtitulo();
        if (RosterWork.recadosSelo) RosterWork.recadosSelo.atualizar();
      } else if (RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || M().falhaSalvar });
      }
    }).catch(function () {
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  function salvarEdicao(rec, assunto, mensagem, btn) {
    if (!assunto || !mensagem) return;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(btn);
    RosterWork.rpc('recado_salvar', { p_id: rec.id, p_assunto: assunto, p_mensagem: mensagem }).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(btn);
      if (r && r.success) {
        rec.assunto = assunto.slice(0, 50);
        rec.mensagem = mensagem;
        renderLista();
        btn.disabled = true;
      } else if (RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || M().falhaSalvar });
      }
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(btn);
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* ---------- filtro + novo ---------- */
  function ligarFiltro() {
    var trilho = raiz.querySelector('#programador-filtro');
    if (!trilho) return;
    trilho.querySelectorAll('.aba').forEach(function (b) {
      b.addEventListener('click', function () {
        filtro = b.getAttribute('data-filtro') || 'todos';
        trilho.querySelectorAll('.aba').forEach(function (x) { x.classList.remove('aba--ativa'); });
        b.classList.add('aba--ativa');
        renderLista();
      });
    });
  }

  function ligarNovo() {
    var btn = raiz.querySelector('#programador-novo');
    if (btn) btn.addEventListener('click', abrirNovo);
  }

  function abrirNovo() {
    selecionadoId = null;
    renderLista();
    var alvo = raiz.querySelector('#programador-detalhe');
    if (!alvo) return;
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-programador-novo');
    if (!no) return;
    var inA = no.querySelector('#programador-novo-assunto');
    var inM = no.querySelector('#programador-novo-mensagem');
    var btnSalvar = no.querySelector('#programador-novo-salvar');
    var btnCancelar = no.querySelector('#programador-novo-cancelar');

    function erroCampo(el, msg) {
      var c = el.closest('.campo'); if (!c) return;
      c.classList.add('campo--erro');
      var e = c.querySelector('.campo-erro-texto'); if (e) e.textContent = msg;
    }
    function limpar(el) {
      var c = el.closest('.campo'); if (!c) return;
      c.classList.remove('campo--erro');
      var e = c.querySelector('.campo-erro-texto'); if (e) e.textContent = '';
    }
    inA.addEventListener('input', function () { limpar(inA); });
    inM.addEventListener('input', function () { limpar(inM); });
    btnCancelar.addEventListener('click', mostrarVazioDetalhe);
    btnSalvar.addEventListener('click', function () {
      limpar(inA); limpar(inM);
      var a = inA.value.trim(), m = inM.value.trim();
      if (!a) { erroCampo(inA, M().assuntoVazio); return; }
      if (!m) { erroCampo(inM, M().mensagemVazia); return; }
      if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(btnSalvar);
      RosterWork.rpc('recado_criar_lembrete', { p_assunto: a, p_mensagem: m }).then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(btnSalvar);
        if (r && r.success) {
          var novoId = r.id;
          carregar().then(function () {
            if (novoId) selecionar(novoId);
            if (RosterWork.recadosSelo) RosterWork.recadosSelo.atualizar();
          });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || M().falhaSalvar });
        }
      }).catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(btnSalvar);
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
    });
    alvo.appendChild(no);
  }

  function mostrarVazioDetalhe() {
    var alvo = raiz.querySelector('#programador-detalhe');
    if (!alvo) return;
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-programador-detalhe-vazio');
    if (no) {
      var sp = no.querySelector('span');
      if (sp) sp.textContent = M().vazioDetalhe;
      alvo.appendChild(no);
    }
  }

  window.RosterWork.paginas.programador = { iniciar: iniciar };
})();
