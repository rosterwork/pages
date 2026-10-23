/* ============================================================
   USUÁRIOS — abas Férias · Licenças · Dispensas
   (RosterWork.usuariosAfastamentos)
   A lista completa do efetivo (a mesma árvore do Efetivo) e, em cada
   militar, uma linha por afastamento do ano escolhido, em ordem de
   data: o tipo e as datas, os dias e, em licença e dispensa, o fluxo.
   Na barra, o ano (‹ 2026 ›, a lista de anos e o Hoje) e os Filtros
   destas abas: Graus, Situação no ano e Tipo (só em Licenças e
   Dispensas). Clicar no militar abre a ficha já na aba e no ano.
   O usuarios.js empresta a árvore, a busca, a ordem, a ficha e a
   contagem do título (ctx); aqui fica só o que é destas abas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var CATEGORIA = { ferias: 'ferias', licencas: 'licenca', dispensas: 'dispensa' };
  var TIPOS = {
    ferias: ['ferias'],
    licenca: ['propria_saude', 'saude_familiar', 'interesses', 'especial', 'capacitacao'],
    dispensa: ['gala', 'nojo', 'comum']
  };

  var ctx = null;          // o que o usuarios.js empresta: { atualizar, busca, ordenar, arvoreDeGraus, abrirFicha, contar }
  var aba = null;          // 'ferias' | 'licencas' | 'dispensas' (null = outra aba)
  var ano = anoAtual();
  var cache = {};          // 'categoria/ano' -> { usuario_id: [afastamentos do ano] }
  var token = 0;           // latest-wins: a resposta de outra aba ou de outro ano é ignorada
  var filtros = null;
  var lugarTipo = null;    // a coluna Tipo do menu de Filtros (some em Férias)
  var seletor = null;      // o ano da barra

  function M() { return RosterWork.mensagens.afastamentos; }
  function D() { return RosterWork.data; }
  function anoAtual() { return new Date().getFullYear(); }
  function categoria() { return CATEGORIA[aba]; }
  function porMilitar() { return cache[categoria() + '/' + ano] || {}; }

  /* "02/10 a 30/11" no ano de referência; a data de outro ano leva o ano ("15/12 a 05/01/2027") */
  function textoDatas(inicio, fim, anoRef) {
    function uma(iso) {
      var br = D().isoParaBR(iso);
      return Number(String(iso).slice(0, 4)) === anoRef ? br.slice(0, 5) : br;
    }
    return uma(inicio) + ' a ' + uma(fim);
  }

  /* o seletor de ano (molde #tpl-usuarios-ano), na barra e na ficha: as setas passam de ano, o ano
     abre a lista (do próximo ano a cinco anos atrás) e o Hoje volta ao ano atual */
  function seletorAno(valor, aoMudar) {
    var el = RosterWork.tpl('tpl-usuarios-ano');
    if (!el) return null;
    var nome = el.querySelector('[data-ano-nome]');
    var lista = el.querySelector('[data-ano-lista]');
    var hoje = el.querySelector('[data-ano-hoje]');
    var atual = valor;
    function pintar() {
      nome.textContent = String(atual);
      hoje.classList.toggle('oculto', atual === anoAtual());
      lista.textContent = '';
      for (var a = anoAtual() + 1; a >= anoAtual() - 5; a--) {
        var item = RosterWork.tpl('tpl-usuarios-ano-item');
        if (!item) return;
        item.textContent = String(a);
        item.classList.toggle('dropdown-item--ativo', a === atual);
        item.addEventListener('click', mudar.bind(null, a));
        lista.appendChild(item);
      }
    }
    function mudar(novo) {
      if (novo === atual) return;
      atual = novo;
      pintar();
      aoMudar(atual);
    }
    el.querySelector('[data-ano-anterior]').addEventListener('click', function () { mudar(atual - 1); });
    el.querySelector('[data-ano-proximo]').addEventListener('click', function () { mudar(atual + 1); });
    hoje.addEventListener('click', function () { mudar(anoAtual()); });
    pintar();
    return { el: el, definir: function (a) { atual = a; pintar(); } };
  }

  /* ---------- filtros ---------- */

  /* o Tipo da aba: os tipos fixos e, quando aparece, a "Licença" (o tipo de saúde escondido pelo banco) */
  function opcoesTipo(lista) {
    var cat = categoria();
    if (cat === 'ferias') return [];
    var opcoes = TIPOS[cat].map(function (t) { return { rotulo: M().tiposCurtos[t], valor: t }; });
    if (lista && lista.some(function (a) { return a.tipo === 'licenca'; })) opcoes.push({ rotulo: M().tiposCurtos.licenca, valor: 'licenca' });
    return opcoes;
  }

  /* com algum tipo escolhido, um valor que não é tipo deixa de passar (filtro sem escolha deixa tudo passar) */
  function filtrandoTipo() { return !!filtros && categoria() !== 'ferias' && !filtros.passa('tipo', ''); }

  /* os afastamentos do militar no ano que passam no Tipo */
  function visiveis(pessoa) {
    return (porMilitar()[pessoa.usuario_id] || []).filter(function (a) { return !filtros || filtros.passa('tipo', a.tipo || ''); });
  }

  /* o militar entra na lista? graus, tipo (com tipo escolhido, só quem teve) e situação no ano */
  function passa(pessoa, lista) {
    if (filtros && !filtros.passa('graus', pessoa.grau_nome)) return false;
    if (filtrandoTipo() && !lista.length) return false;
    return !filtros || filtros.passa('situacao', lista.length ? 'com' : 'sem');
  }

  /* ---------- a lista ---------- */

  function montarLinha(pilha, a) {
    var l = RosterWork.tpl('tpl-usuario-afastamento-linha');
    if (!l) return;
    var tipo = M().tiposCurtos[a.tipo];
    var datas = textoDatas(a.data_inicio, a.data_fim, ano);
    l.querySelector('.usuario-afastamento-texto').textContent = tipo ? tipo + ' · ' + datas : datas;
    l.querySelector('.usuario-afastamento-dias').textContent = M().dias(a.dias);
    var fluxo = l.querySelector('.usuario-afastamento-fluxo');
    if (a.fora_do_fluxo == null) {
      fluxo.classList.add('oculto');
    } else {
      fluxo.textContent = a.fora_do_fluxo ? M().seloFora : M().seloSegue;
      fluxo.classList.add(a.fora_do_fluxo ? 'selo--erro' : 'selo--sucesso');
    }
    pilha.appendChild(l);
  }

  /* o militar à esquerda e, à direita, uma linha por afastamento do ano; o clique abre a ficha na aba e no ano */
  function renderConteudo(container, unidade, pessoas) {
    var bloquinho = RosterWork.tpl('tpl-arvore-bloquinho');
    if (!bloquinho) return;
    var adicionou = 0;
    ctx.ordenar(pessoas).forEach(function (pessoa) {
      var lista = visiveis(pessoa);
      if (!passa(pessoa, lista)) return;
      var busca = ctx.busca(pessoa);
      if (busca === 'esconder') return;
      var item = RosterWork.tpl('tpl-usuario-afastamento-item');
      if (!item) return;
      item.querySelector('.usuario-item-grad').textContent = pessoa.grau_abreviacao || '';
      item.querySelector('.usuario-item-nome').textContent = pessoa.nome_de_guerra || '';
      var pilha = item.querySelector('.usuario-afastamento-pilha');
      lista.forEach(function (a) { montarLinha(pilha, a); });
      if (busca === 'marcar') item.classList.add('linha-militar--marcada');
      if (busca === 'marcar' || busca === 'casa') item.classList.add('busca-achado');   // o que o Enter da busca percorre (geral-busca.js)
      item.addEventListener('click', function () { ctx.abrirFicha(item, pessoa, { secao: aba, ano: ano }); });
      bloquinho.appendChild(item);
      ctx.contar();
      adicionou++;
    });
    /* a unidade tem militares, mas nenhum passou pelos filtros atuais */
    if (pessoas.length && !adicionou) {
      var vazio = RosterWork.tpl('tpl-usuario-vazio');
      if (vazio) bloquinho.appendChild(vazio);
    }
    if (pessoas.length) container.appendChild(bloquinho);
  }

  /* a contagem de cada unidade: quantos tiveram afastamento no ano */
  function textoContagem(itens) {
    var mapa = porMilitar();
    var n = itens.filter(function (p) { return (mapa[p.usuario_id] || []).length; }).length;
    return M().contagem(n, categoria());
  }

  function aoRenderizar(pessoas) {
    if (filtros && ctx) filtros.definir('graus', ctx.arvoreDeGraus(pessoas || []));
  }

  /* ---------- carregar ---------- */

  /* lê a categoria da aba no ano (uma vez por aba e ano; a gravação limpa o cache) e redesenha */
  function carregar() {
    var cat = categoria(), chave = cat + '/' + ano;
    if (cache[chave]) {
      if (filtros) filtros.definir('tipo', opcoesTipo(listaDe(cache[chave])));
      ctx.atualizar();
      return;
    }
    var meu = ++token;
    ctx.atualizar();   // os nomes já aparecem; as linhas chegam com a resposta
    RosterWork.usuariosAfastamentosDados.listar(cat, ano).then(function (lista) {
      if (meu !== token || !aba) return;
      if (lista == null) {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: M().falhaCarregar });
        return;
      }
      var mapa = {};
      lista.forEach(function (a) { (mapa[a.usuario_id] = mapa[a.usuario_id] || []).push(a); });
      cache[chave] = mapa;
      if (filtros) filtros.definir('tipo', opcoesTipo(lista));
      ctx.atualizar();
    });
  }

  function listaDe(mapa) {
    var lista = [];
    Object.keys(mapa).forEach(function (k) { lista.push.apply(lista, mapa[k]); });
    return lista;
  }

  /* a página trocou de aba: nesta, o ano e os Filtros dela aparecem e a lista lê a categoria */
  function mostrar(nova) {
    aba = CATEGORIA[nova] ? nova : null;
    if (seletor) seletor.el.classList.toggle('oculto', !aba);
    if (filtros) filtros.mostrar(!!aba);
    if (!aba) { token++; return; }
    var cat = categoria();
    if (filtros) {
      filtros.definir('situacao', [{ rotulo: M().comNoAno[cat], valor: 'com' }, { rotulo: M().semNoAno[cat], valor: 'sem' }]);
      filtros.definir('tipo', opcoesTipo(null));
    }
    if (lugarTipo) lugarTipo.classList.toggle('oculto', cat === 'ferias');
    carregar();
  }

  /* gravou (na ficha): esquece o que foi lido e relê a aba aberta */
  function recarregar() {
    cache = {};
    if (aba) carregar();
  }

  /* a navegação abriu a página: os Filtros destas abas e o ano, ainda escondidos */
  function iniciar(conteudo, emprestado) {
    ctx = emprestado;
    aba = null;
    cache = {};
    token++;
    ano = anoAtual();
    var caixa = conteudo.querySelector('#usuarios-afast-filtros');
    filtros = (caixa && RosterWork.filtros) ? RosterWork.filtros.criar(caixa, {
      aoMudar: function () { if (aba) ctx.atualizar(); }
    }) : null;
    if (filtros) filtros.mostrar(false);
    lugarTipo = caixa ? caixa.querySelector('[data-filtro="tipo"]') : null;
    seletor = seletorAno(ano, function (a) { ano = a; if (aba) carregar(); });
    var barra = conteudo.querySelector('.pagina-subcabecalho');
    if (seletor && barra) {
      seletor.el.classList.add('oculto');
      var admin = barra.querySelector('.acoes-admin');
      if (admin) admin.after(seletor.el); else barra.prepend(seletor.el);
    }
  }

  window.RosterWork.usuariosAfastamentos = {
    iniciar: iniciar, mostrar: mostrar, ativa: function () { return !!aba; },
    renderConteudo: renderConteudo, aoRenderizar: aoRenderizar, textoContagem: textoContagem, recarregar: recarregar,
    /* para a ficha */
    seletorAno: seletorAno, textoDatas: textoDatas, anoAtual: anoAtual,
    tiposDe: function (cat) { return (TIPOS[cat] || []).slice(); }
  };
})();
