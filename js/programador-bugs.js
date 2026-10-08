/* ============================================================
   PROGRAMADOR — BUGS (só programador)
   Lista os bugs (bugs_listar) filtrando por situação, gravidade e
   período; mostra o detalhe à direita (andamento e mensagens
   ligadas) com as ações de cada situação: assumir, devolver,
   marcar corrigido, descartar e reabrir. O formulário (novo,
   editar, criar da mensagem) fica em programador-bugs-formulario.js;
   aqui ele é aberto e gravado (bug_salvar). A página
   (programador.js) liga as abas e chama iniciar().
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var raiz = null;
  var config = {};
  var bugs = [];
  var filtroSituacao = 'aberto';
  var filtroGravidade = '';
  var filtroDias = 0;
  var selecionadoId = null;
  var carga = null;   /* a leitura mais recente dos bugs, para quem precisa esperar a lista */

  var ORDEM_GRAVIDADE = { grave: 0, moderado: 1, leve: 2 };
  var SELO_GRAVIDADE = { grave: 'selo--erro', moderado: 'selo--alerta', leve: '' };
  var SELO_SITUACAO = { aberto: '', em_correcao: 'selo--escuro', corrigido: 'selo--sucesso', descartado: '' };

  function M() { return RosterWork.mensagens.programadorBugs; }
  function F() { return RosterWork.programadorBugsFormulario; }
  function q(seletor) { return raiz.querySelector(seletor); }
  function quando(iso) { return (RosterWork.resumo && RosterWork.resumo.formatarQuando) ? RosterWork.resumo.formatarQuando(iso) : ''; }
  function dataCurta(iso) { return quando(iso).slice(0, 10); }
  function tempo(iso) { var t = new Date(iso).getTime(); return isNaN(t) ? 0 : t; }
  function bugPorId(id) {
    for (var i = 0; i < bugs.length; i++) if (bugs[i].id === id) return bugs[i];
    return null;
  }

  function pintarSelo(el, texto, classe) {
    el.textContent = texto || '';
    if (classe) el.classList.add(classe);
  }
  function pintarGravidade(el, gravidade) { pintarSelo(el, M().gravidades[gravidade], SELO_GRAVIDADE[gravidade]); }
  function pintarSituacao(el, situacao) { pintarSelo(el, M().situacoes[situacao], SELO_SITUACAO[situacao]); }

  function avisarErro(r) {
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.programador.falhaSalvar });
  }
  function avisarSemConexao() {
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
  }

  /* ---------- carga ---------- */
  function iniciar(conteudo, opcoes) {
    raiz = conteudo;
    config = opcoes || {};
    bugs = [];
    filtroSituacao = 'aberto';
    filtroGravidade = '';
    filtroDias = 0;
    selecionadoId = null;
    F().reiniciar();
    ligarFiltros();
    var btnNovo = q('#bugs-novo');
    if (btnNovo) btnNovo.addEventListener('click', function () {
      pedirTroca(function () { abrirFormulario(null, null); });
    });
    mostrarVazioDetalhe();
    renderLista(M().carregando);
    return carregar(null);
  }

  /* relê os bugs; com `idMostrar`, abre esse bug já na situação em que ele está */
  function carregar(idMostrar) {
    carga = RosterWork.rpc('bugs_listar').then(function (r) {
      if (!Array.isArray(r)) { bugs = []; renderLista(M().falhaCarregar); avisarSubtitulo(); return; }
      bugs = r;
      avisarSubtitulo();
      var bug = idMostrar ? bugPorId(idMostrar) : null;
      if (bug) {
        marcarSituacao(bug.situacao);
        selecionar(bug.id);
      } else {
        renderLista();
      }
    }).catch(function () {
      bugs = [];
      renderLista(M().falhaCarregar);
    });
    return carga;
  }

  /* resolve quando a leitura em andamento terminar (ou na hora, se não houver) */
  function quandoCarregado() { return carga || Promise.resolve(); }

  function avisarSubtitulo() { if (config.aoMudarSubtitulo) config.aoMudarSubtitulo(); }

  /* bugs ainda a corrigir (abertos + em correção) */
  function subtitulo() {
    var n = bugs.filter(function (b) { return b.situacao === 'aberto' || b.situacao === 'em_correcao'; }).length;
    return M().subtitulo(n);
  }

  /* ---------- filtros ---------- */
  function ligarFiltros() {
    var trilho = q('#bugs-filtro-situacao');
    if (trilho && RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) {
        filtroSituacao = aba.getAttribute('data-situacao') || 'aberto';
        renderLista();
      });
    }
    ligarMenu('#bugs-gravidade-menu', '#bugs-gravidade-texto', 'data-gravidade', function (valor) { filtroGravidade = valor; });
    ligarMenu('#bugs-periodo-menu', '#bugs-periodo-texto', 'data-dias', function (valor) { filtroDias = Number(valor) || 0; });
  }

  /* menu de escolha única: marca o item, escreve no seletor e refiltra */
  function ligarMenu(seletorMenu, seletorTexto, atributo, aoEscolher) {
    var menu = q(seletorMenu);
    var texto = q(seletorTexto);
    if (!menu || !texto) return;
    var itens = menu.querySelectorAll('.dropdown-item');
    Array.prototype.forEach.call(itens, function (item) {
      item.addEventListener('click', function () {
        Array.prototype.forEach.call(itens, function (x) { x.classList.toggle('dropdown-item--ativo', x === item); });
        texto.textContent = item.textContent;
        aoEscolher(item.getAttribute(atributo) || '');
        if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
        renderLista();
      });
    });
  }

  /* põe o filtro de situação numa aba sem clique (o bug mudou de situação) */
  function marcarSituacao(situacao) {
    filtroSituacao = situacao;
    var trilho = q('#bugs-filtro-situacao');
    if (!trilho) return;
    Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (b) {
      var ativa = b.getAttribute('data-situacao') === situacao;
      b.classList.toggle('aba--ativa', ativa);
      if (b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }

  function filtrados() {
    var limite = filtroDias ? Date.now() - filtroDias * 86400000 : 0;
    var fechados = filtroSituacao === 'corrigido' || filtroSituacao === 'descartado';
    return bugs.filter(function (b) {
      if (b.situacao !== filtroSituacao) return false;
      if (filtroGravidade && b.gravidade !== filtroGravidade) return false;
      if (limite && tempo(b.criado_em) < limite) return false;
      return true;
    }).sort(function (a, b) {
      /* fechados: o mais recente primeiro; a corrigir: o mais grave e, nele, o mais antigo */
      return fechados ? tempo(b.fechado_em) - tempo(a.fechado_em) : porGravidade(a, b);
    });
  }

  function porGravidade(a, b) {
    return (ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade]) || (tempo(a.criado_em) - tempo(b.criado_em));
  }

  /* bugs ainda a corrigir, na ordem da lista (para "Ligar a bug existente" da aba Mensagens) */
  function abertos() {
    return bugs.filter(function (b) { return b.situacao === 'aberto' || b.situacao === 'em_correcao'; }).sort(porGravidade);
  }

  /* relê depois de ligar/desligar: o bug aberto no detalhe se refaz; formulário na tela fica como está */
  function recarregar() { return carregar(q('#bug-det-editar') ? selecionadoId : null); }

  /* ---------- lista ---------- */
  function vazio(texto) {
    var no = RosterWork.tpl('tpl-programador-vazio');
    if (no) no.querySelector('span').textContent = texto;
    return no;
  }

  function renderLista(textoVazio) {
    var lista = q('#bugs-lista');
    if (!lista) return;
    lista.textContent = '';
    var itens = textoVazio ? [] : filtrados();
    if (!itens.length) {
      var no = vazio(textoVazio || M().vazioLista);
      if (no) lista.appendChild(no);
      return;
    }
    itens.forEach(function (bug) {
      var item = RosterWork.tpl('tpl-bug-item');
      if (!item) return;
      item.querySelector('.programador-item-assunto').textContent = bug.titulo;
      pintarGravidade(item.querySelector('.programador-item-selo'), bug.gravidade);
      item.querySelector('.programador-bug-item-onde').textContent = bug.onde || '';
      item.querySelector('.programador-bug-item-data').textContent = dataCurta(bug.fechado_em || bug.criado_em);
      if (bug.id === selecionadoId) item.classList.add('lista-item--ativo');
      item.addEventListener('click', function () {
        if (bug.id === selecionadoId && q('#bug-det-editar')) return;   /* já aberto no detalhe */
        pedirTroca(function () { selecionar(bug.id); });
      });
      lista.appendChild(item);
    });
  }

  /* ---------- detalhe ---------- */
  function mostrarVazioDetalhe() {
    var alvo = q('#bugs-detalhe');
    if (!alvo) return;
    alvo.textContent = '';
    var no = vazio(M().vazioDetalhe);
    if (no) alvo.appendChild(no);
  }

  function selecionar(id) {
    F().fechar();
    selecionadoId = id;
    renderLista();
    var alvo = q('#bugs-detalhe');
    var bug = bugPorId(id);
    if (!alvo) return;
    if (!bug) { mostrarVazioDetalhe(); return; }
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-bug-detalhe');
    if (!no) return;

    pintarGravidade(no.querySelector('.bug-det-gravidade'), bug.gravidade);
    pintarSituacao(no.querySelector('.bug-det-situacao'), bug.situacao);
    no.querySelector('.bug-det-registro').textContent = M().registro(bug.criado_por_titulo || '', quando(bug.criado_em));
    no.querySelector('.bug-det-titulo').textContent = bug.titulo;
    no.querySelector('.bug-det-relator').textContent = bug.relator_titulo ? F().rotuloMilitar(bug.relator_titulo, bug.relator_unidade) : M().naoInformado;
    no.querySelector('.bug-det-onde').textContent = bug.onde || M().naoInformado;
    no.querySelector('.bug-det-responsavel').textContent = bug.responsavel_titulo || M().ninguem;
    no.querySelector('.bug-det-descricao').textContent = bug.descricao;

    RosterWork.programadorBugLigado.montarMensagens(no, bug, config.aoAbrirMensagem);
    montarAndamento(no, bug);
    montarAcoes(no, bug);
    alvo.appendChild(no);
  }

  function montarAndamento(no, bug) {
    var lista = no.querySelector('.bug-det-andamento');
    (Array.isArray(bug.andamento) ? bug.andamento : []).forEach(function (passo) {
      var linha = RosterWork.tpl('tpl-bug-passo');
      if (!linha) return;
      linha.querySelector('.programador-bug-passo-quando').textContent = quando(passo.quando);
      linha.querySelector('.programador-bug-passo-texto').textContent = (M().passos[passo.acao] || passo.acao) + ' ' + (passo.autor || '');
      var nota = linha.querySelector('.programador-bug-passo-nota');
      if (passo.texto) nota.textContent = passo.texto;
      else nota.classList.add('oculto');
      lista.appendChild(linha);
    });
  }

  /* botões de cada situação + o campo de nota (o que foi feito / motivo do descarte) */
  function montarAcoes(no, bug) {
    var s = bug.situacao;
    var aCorrigir = s === 'aberto' || s === 'em_correcao';
    var visiveis = {
      '#bug-det-assumir': s === 'aberto',
      '#bug-det-corrigir': s === 'em_correcao',
      '#bug-det-devolver': s === 'em_correcao',
      '#bug-det-descartar': aCorrigir,
      '#bug-det-reabrir': !aCorrigir
    };
    Object.keys(visiveis).forEach(function (seletor) {
      no.querySelector(seletor).classList.toggle('oculto', !visiveis[seletor]);
    });

    /* em correção o campo fica à vista; aberto, só aparece ao pedir o descarte */
    var campos = RosterWork.campos;
    var campoNota = no.querySelector('.bug-det-nota-campo');
    var nota = no.querySelector('#bug-det-nota');
    campoNota.classList.toggle('oculto', s !== 'em_correcao');
    no.querySelector('.bug-det-nota-rotulo-correcao').classList.toggle('oculto', s !== 'em_correcao');
    no.querySelector('.bug-det-nota-rotulo-descarte').classList.toggle('oculto', s === 'em_correcao');
    nota.addEventListener('input', function () { campos.limparErro(nota); });

    no.querySelector('#bug-det-editar').addEventListener('click', function () { abrirFormulario(bug, null); });
    no.querySelector('#bug-det-assumir').addEventListener('click', function () { executar('bug_assumir', { p_id: bug.id }, this); });
    no.querySelector('#bug-det-devolver').addEventListener('click', function () { executar('bug_devolver', { p_id: bug.id }, this); });
    no.querySelector('#bug-det-reabrir').addEventListener('click', function () { executar('bug_reabrir', { p_id: bug.id }, this); });

    no.querySelector('#bug-det-corrigir').addEventListener('click', function () {
      var botao = this;
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: M().confirmarCorrigido,
        textoConfirmar: M().botaoCorrigido,
        aoConfirmar: function () { executar('bug_corrigir', { p_id: bug.id, p_texto: nota.value.trim() || null }, botao); }
      });
    });

    no.querySelector('#bug-det-descartar').addEventListener('click', function () {
      var botao = this;
      if (!nota.value.trim()) {
        campoNota.classList.remove('oculto');
        campos.marcarErro(nota, M().motivoVazio);
        nota.focus();
        return;
      }
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: M().confirmarDescartar,
        textoConfirmar: M().botaoDescartar,
        confirmarPerigo: true,
        aoConfirmar: function () { executar('bug_descartar', { p_id: bug.id, p_motivo: nota.value.trim() }, botao); }
      });
    });
  }

  /* ação de situação: grava, relê e mostra o bug onde ele foi parar
     (a recusa "já mudou de situação" também relê, para a tela alcançar o banco) */
  function executar(nome, corpo, botao) {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc(nome, corpo).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (r && r.success) {
        if (config.aoMudarRecados) config.aoMudarRecados();
      } else {
        avisarErro(r);
      }
      return carregar(corpo.p_id);
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      avisarSemConexao();
    });
  }

  /* ---------- formulário (novo / editar / da mensagem) ---------- */
  function pedirTroca(continuar) { F().pedirTroca(continuar); }

  /* bug: editar · recado: criar a partir da mensagem · nenhum: novo em branco */
  function abrirFormulario(bug, recado) {
    selecionadoId = bug ? bug.id : null;
    renderLista();
    var alvo = q('#bugs-detalhe');
    if (!alvo) return;
    F().abrir(alvo, {
      bug: bug,
      recado: recado,
      aoCancelar: function () {
        pedirTroca(function () {
          F().fechar();
          if (bug) { selecionar(bug.id); return; }
          selecionadoId = null;
          renderLista();
          mostrarVazioDetalhe();
        });
      },
      aoSalvar: salvarBug
    });
  }

  function salvarBug(dados, botao) {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc('bug_salvar', dados).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (!(r && r.success)) { avisarErro(r); return; }
      F().fechar();
      if (config.aoMudarRecados) config.aoMudarRecados();
      carregar(r.id);
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      avisarSemConexao();
    });
  }

  /* ---------- entradas vindas da aba Mensagens ---------- */
  function abrirDeRecado(recado) {
    pedirTroca(function () {
      marcarSituacao('aberto');
      abrirFormulario(null, recado);
    });
  }

  function mostrarBug(id) {
    pedirTroca(function () {
      if (!bugPorId(id)) { carregar(id); return; }
      marcarSituacao(bugPorId(id).situacao);
      selecionar(id);
    });
  }

  window.RosterWork.programadorBugs = {
    iniciar: iniciar,
    recarregar: recarregar,
    abertos: abertos,
    quandoCarregado: quandoCarregado,
    pintarGravidade: pintarGravidade,
    subtitulo: subtitulo,
    pintarSituacao: pintarSituacao,
    abrirDeRecado: abrirDeRecado,
    mostrarBug: mostrarBug
  };
})();
