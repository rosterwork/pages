/* ============================================================
   ESCALAS — o nome como seletor na lista do Dia (só admin)
   Cada militar numa função de posto (fora o Chefe de Socorro e o
   Oficial de Área) fica numa caixa com a setinha; a vaga vazia também,
   em vermelho. A caixa abre ali mesmo a lista de quem pode sentar na
   função, lida do banco (escala_dia_disponiveis com a vaga): em grupos
   (mesma viatura, sem função, outro posto, de folga por unidade) e, no
   fim, apagados, os que não podem, com o motivo. Escolher grava na hora,
   numa mudança só (um passo do desfazer): quem tem função no horário
   troca de lugar com quem sai (na vaga vazia, deixa a função dele);
   quem está sem função entra e quem sai fica sem função; quem está de
   folga entra só neste dia, com a pergunta do banco de horas. O Mais
   opções abre o formulário "Quem fica no" (escalas-painel-formulario.js)
   com a função e os horários da linha.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var pedido = 0;   // só a última lista pedida desenha

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function juntar(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }

  /* cfg = { posto, funcao, periodos: [{ hi, hf }], militar }: militar = o da linha (null na vaga vazia) */

  /* a vaga como o banco pede */
  function vagaDe(cfg) {
    return {
      viatura_id: cfg.posto.tipo === 'viatura' ? cfg.posto.id : null,
      instalacao_id: cfg.posto.tipo === 'instalacao' ? cfg.posto.id : null,
      funcao: cfg.funcao,
      periodos: cfg.periodos.map(function (p) { return { hi: p.hi, hf: p.hf }; }),
      cpf: cfg.militar ? cfg.militar.cpf : null
    };
  }

  /* as funções de quem entra, em texto: "Efetivo 3" no mesmo posto, "Condutor da AA-01" em outro */
  function lugares(c, cfg) {
    var api = ed();
    var nomes = [];
    (c.funcoes || []).forEach(function (f) {
      var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
      var t = !posto || posto.id === cfg.posto.id ? f.funcao : api.funcaoNoPosto(f.funcao, posto);
      if (nomes.indexOf(t) < 0) nomes.push(t);
    });
    return juntar(nomes);
  }

  /* o motivo de quem não pode, do código que o banco manda */
  function motivoTexto(c, cfg) {
    var mm = msg().seletorMotivo, H = ed().horas, mo = c.motivo || {};
    var sai = cfg.militar ? nomeDe(cfg.militar) : '';
    if (mo.codigo === 'papel') return mm.papel(mo.funcao);
    if (mo.codigo === 'horario') return mm.horario(H.textoPeriodos(mo.servico || []));
    if (mo.codigo === 'ocupado') {
      var ocupado = (mo.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
      return ocupado.length ? msg().ocupadoNoDia(ocupado) : '';
    }
    if (mo.codigo === 'regra') return mm.regra(mo.funcao);
    if (mo.codigo === 'cnh') return mm.cnh(mo.cnh);
    if (mo.codigo === 'troca_regra') return mm.trocaRegra(sai, mo.funcao);
    if (mo.codigo === 'troca_cnh') return mm.trocaCnh(sai, mo.cnh, mo.posto);
    return '';
  }

  /* o que aparece ao lado do nome: o motivo de quem não pode, ou o que acontece ao escolher */
  function textoAoLado(c, cfg) {
    var m = msg();
    if (!c.pode) return motivoTexto(c, cfg);
    if (c.grupo === 'folga') return c.assume ? m.seletorAssume[c.assume] || m.seletorEntra : m.seletorEntra;
    if (c.grupo === 'sem_funcao') return m.seletorSemFuncao;
    return cfg.militar ? m.seletorTrocam(lugares(c, cfg)) : m.seletorDeixa(lugares(c, cfg));
  }

  /* o título do grupo de cada um (os de folga, um por unidade; quem não pode, todos juntos no fim) */
  function rotuloGrupo(c, cfg) {
    var g = msg().seletorGrupo;
    if (!c.pode) return g.naoPodem;
    if (c.grupo === 'folga') return msg().seletorFolga(c.unidade || '');
    if (c.grupo === 'posto') return cfg.posto.tipo === 'instalacao' ? g.instalacao : g.posto;
    return c.grupo === 'sem_funcao' ? g.semFuncao : g.outroPosto;
  }

  /* ---------- a lista ---------- */

  /* a busca: esconde quem não casa e o título do grupo que fica sem ninguém */
  function filtrar(el) {
    var est = el._seletor;
    if (!est) return;
    var entrada = el.querySelector('.busca-entrada');
    var termo = entrada ? entrada.value.trim() : '';
    var pilula = el.querySelector('.escala-secao-busca');
    if (pilula) pilula.classList.toggle('busca--com-texto', !!termo);
    var visiveis = 0;
    est.grupos.forEach(function (g) {
      var algum = false;
      g.itens.forEach(function (it) {
        var casa = RosterWork.busca.casaTexto(termo, it.getAttribute('data-busca'));
        it.classList.toggle('oculto', !casa);
        if (casa) { algum = true; visiveis++; }
      });
      if (g.el) g.el.classList.toggle('oculto', !algum);
    });
    if (est.vazio) est.vazio.classList.toggle('oculto', visiveis > 0);
  }

  /* a lista que o banco mandou (já na ordem: quem pode, por grupo; depois quem não pode). null = falhou */
  function desenharLista(el, cfg, resp) {
    var lista = el.querySelector('.escala-seletor-lista');
    lista.textContent = '';
    var grupos = [], atual = null;
    (resp || []).forEach(function (c) {
      var rotulo = rotuloGrupo(c, cfg);
      if (!atual || atual.rotulo !== rotulo) {
        var titulo = RosterWork.tpl('tpl-escala-form-unidade');
        if (titulo) { titulo.textContent = rotulo; lista.appendChild(titulo); }
        atual = { rotulo: rotulo, el: titulo, itens: [] };
        grupos.push(atual);
      }
      var item = RosterWork.tpl('tpl-escala-form-militar');
      if (!item) return;
      item.querySelector('.escala-distribuicao-grad').textContent = c.grad || '';
      item.querySelector('.escala-distribuicao-nome').textContent = c.nome || '';
      item.querySelector('.escala-form-militar-extra').textContent = textoAoLado(c, cfg);
      item.setAttribute('data-busca', RosterWork.busca.chave(c) + ' ' + RosterWork.busca.normalizar(c.grad));
      if (c.pode) item.addEventListener('click', function () { escolher(cfg, c); });
      else { item.disabled = true; item.classList.add('escala-form-militar--apagado'); }
      lista.appendChild(item);
      atual.itens.push(item);
    });
    var vazio = RosterWork.tpl('tpl-escala-secao-vazio');
    if (vazio) {
      vazio.classList.add('escala-form-vazio');
      vazio.textContent = resp ? msg().ninguemEncontrado : msg().falhaCarregar;
      lista.appendChild(vazio);
    }
    el._seletor = { grupos: grupos, vazio: vazio };
    filtrar(el);
  }

  /* a cada abertura, a lista é lida de novo (o dia pode ter mudado); enquanto lê, o carregando */
  function abrir(el, cfg) {
    var api = ed();
    var lista = el.querySelector('.escala-seletor-lista');
    var entrada = el.querySelector('.busca-entrada');
    el._seletor = null;
    lista.textContent = '';
    var giro = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (giro) lista.appendChild(giro);
    if (entrada) entrada.value = '';
    var meu = ++pedido;
    RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vagaDe(cfg)).then(function (resp) {
      if (meu !== pedido || !lista.isConnected) return;
      desenharLista(el, cfg, resp);
    });
    /* no computador, a busca já recebe o foco (no celular, abriria o teclado) */
    if (entrada && !document.documentElement.hasAttribute('data-celular')) {
      setTimeout(function () { if (el.classList.contains('dropdown--aberto')) entrada.focus(); }, 0);
    }
  }

  /* ---------- escolher ---------- */

  /* uma mudança só (um passo do desfazer): quem entra senta na vaga; quem sai vai para as funções que quem entra
     tinha no horário (troca de lugar) ou, na vaga vazia, quem entra deixa essas funções */
  function trocar(cfg, c, pontual) {
    var api = ed();
    if (!api.dados()) return;
    api.mudar(function () {
      api.aplicarColocacao({ cpf: c.cpf, posto: cfg.posto, funcao: cfg.funcao, periodos: cfg.periodos, sistema: false, pontual: pontual });
      (c.funcoes || []).forEach(function (f) {
        var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
        if (!posto) return;
        var per = { hi: f.hi, hf: f.hf };
        if (cfg.militar) api.aplicarColocacao({ cpf: cfg.militar.cpf, posto: posto, funcao: f.funcao, periodos: [per], sistema: false, pontual: null });
        else api.deixarFuncao(c.cpf, posto, f.funcao, per);
      });
    });
  }

  /* de folga entra como pontual: pergunta antes se as horas vão para o banco de horas */
  function escolher(cfg, c) {
    var api = ed(), H = api.horas;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (c.grupo !== 'folga') { trocar(cfg, c, null); return; }
    var minutos = cfg.periodos.reduce(function (s, p) { var f = H.faixa(p); return s + f[1] - f[0]; }, 0);
    var botoes = RosterWork.mensagens.botoes;
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: msg().contabilizarPontual(nomeDe(c), H.horasTexto(minutos), diaMes(api.iso())),
      textoConfirmar: botoes.contabilizar,
      textoAlternativo: botoes.naoContabilizar,
      textoCancelar: botoes.cancelar,
      aoConfirmar: function () { trocar(cfg, c, { contabilizar: true }); },
      aoAlternativo: function () { trocar(cfg, c, { contabilizar: false }); }
    });
  }

  /* ---------- a caixa ---------- */

  function criar(cfg) {
    var el = RosterWork.tpl('tpl-escala-edicao-seletor');
    if (!el) return null;
    var api = ed(), H = api.horas;
    var gatilho = el.querySelector('.escala-seletor-gatilho');
    gatilho.setAttribute('aria-label', msg().seletorRotulo(api.funcaoNoPosto(cfg.funcao, cfg.posto), cfg.militar ? nomeDe(cfg.militar) : ''));
    el.querySelector('.escala-seletor-titulo').textContent =
      msg().seletorTitulo(cfg.funcao, H.textoPeriodos(cfg.periodos) || msg().dasAs('08h', '08h'));
    var busca = RosterWork.tpl('tpl-escala-secao-busca');
    if (busca) {
      var entrada = busca.querySelector('.busca-entrada');
      entrada.addEventListener('input', function () { filtrar(el); });
      busca.querySelector('.busca-limpar').addEventListener('click', function () { entrada.value = ''; entrada.focus(); filtrar(el); });
      el.querySelector('.escala-seletor-busca').appendChild(busca);
    }
    /* o geral-dropdown abre e fecha; aqui, só a leitura da lista ao abrir */
    gatilho.addEventListener('click', function () { if (!el.classList.contains('dropdown--aberto')) abrir(el, cfg); });
    el.querySelector('.escala-seletor-mais').addEventListener('click', function () {
      api.abrirFormulario({ modo: 'preencher', posto: cfg.posto, funcao: cfg.funcao, periodos: cfg.periodos });
    });
    return el;
  }

  /* a caixa na linha do militar: os ícones, a graduação e o nome da linha passam para dentro dela */
  function encaixar(linha, cfg) {
    var el = criar(cfg);
    if (!el) return;
    var pessoa = linha.querySelector('.escala-edicao-pessoa');
    var gatilho = el.querySelector('.escala-seletor-gatilho');
    var texto = el.querySelector('.escala-seletor-texto');
    while (pessoa.firstChild) gatilho.insertBefore(pessoa.firstChild, texto);
    pessoa.appendChild(el);
  }

  /* a caixa da vaga vazia: em vermelho, com o texto ("Sem ninguém, escolher") */
  function encaixarVazio(linha, cfg, texto) {
    var el = criar(cfg);
    if (!el) return;
    el.classList.add('campo--erro');
    el.querySelector('.escala-seletor-texto').textContent = texto;
    var pessoa = linha.querySelector('.escala-edicao-pessoa');
    pessoa.textContent = '';
    pessoa.appendChild(el);
  }

  window.RosterWork.escalasPainelSeletor = { encaixar: encaixar, encaixarVazio: encaixarVazio };
})();
