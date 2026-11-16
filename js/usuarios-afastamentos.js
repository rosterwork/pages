/* ============================================================
   USUÁRIOS — aba Afastamentos
   (RosterWork.usuariosAfastamentos)
   O efetivo das unidades escolhidas (a mesma árvore do Efetivo) com
   os afastamentos do ano de cada militar nos 12 meses (a grade,
   usuarios-afastamentos-grade.js; no celular, a lista). Na barra, o
   ano (‹ 2026 ›, a lista de anos e o Hoje) e os Filtros da aba:
   Graus, Situação no ano (Com ou Sem afastamento) e Afastamento (os
   nomes do ano; escolher um esconde os outros selos, e quem não tem
   continua à vista para planejar). Quem administra o militar edita na
   célula (usuarios-afastamentos-celula.js) ou na ficha; o rascunho é
   um só (usuarios-afastamentos-rascunho.js). O usuarios.js empresta
   a árvore, a busca, a ordem, a contagem do título e a ficha (ctx).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ctx = null;          // o que o usuarios.js empresta: { atualizar, busca, ordenar, arvoreDeGraus, contar, abrirFicha, marcar }
  var ativa = false;       // a aba está à mostra
  var ano = anoAtual();
  var lidos = {};          // ano -> true (o ano já veio do banco para o rascunho)
  var token = 0;           // latest-wins: a resposta de outro ano é ignorada
  var filtros = null;
  var seletor = null;      // o ano da barra
  var arvore = null;       // o contêiner da árvore (largura toda nesta aba)

  function M() { return RW.mensagens.afastamentos; }
  function R() { return RW.usuariosAfastamentosRascunho; }
  function G() { return RW.usuariosAfastamentosGrade; }
  function anoAtual() { return new Date().getFullYear(); }
  function celular() { return !!(RW.celular && RW.celular()); }

  /* o seletor de ano (molde #tpl-usuarios-ano), na barra e na ficha: as setas passam de ano, o ano abre a lista (do
     próximo ano a cinco anos atrás) e o Hoje volta ao ano atual */
  function seletorAno(valor, aoMudar) {
    var el = RW.tpl('tpl-usuarios-ano');
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
        var item = RW.tpl('tpl-usuarios-ano-item');
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

  /* ---------- o que aparece ---------- */

  /* os afastamentos do militar que tocam o ano (com o rascunho por cima) */
  function doAno(pessoa) {
    var ini = ano + '-01-01', fim = ano + '-12-31';
    return R().lista(pessoa.usuario_id).filter(function (af) { return af.inicio && af.fim && af.inicio <= fim && af.fim >= ini; });
  }
  /* o nome no filtro Afastamento: o da lista padrão ou "Outros" */
  function chaveFiltro(af) { return af.padrao || 'outros'; }
  function visiveis(pessoa) {
    return doAno(pessoa).filter(function (af) { return !filtros || filtros.passa('afastamento', chaveFiltro(af)); });
  }
  function lendo() { return !lidos[ano]; }

  /* o militar entra? graus, situação no ano (pelos afastamentos à vista) e a busca */
  function passa(pessoa) {
    if (filtros && !filtros.passa('graus', pessoa.grau_nome)) return false;
    if (ctx.busca(pessoa) === 'esconder') return false;
    if (lendo()) return true;
    return !filtros || filtros.passa('situacao', visiveis(pessoa).length ? 'com' : 'sem');
  }

  /* a unidade: a grade (no celular, a lista); sem ninguém pelos filtros, o aviso */
  function renderConteudo(container, unidade, pessoas) {
    var lista = ctx.ordenar(pessoas).filter(passa);
    var c = {
      ano: ano, lendo: lendo, afastamentos: visiveis, busca: ctx.busca, contar: ctx.contar, marcar: ctx.marcar,
      abrirFicha: function (el, pessoa) { ctx.abrirFicha(el, pessoa, { secao: 'afastamentos', ano: ano }); },
      podeMudar: function (pessoa) { return !lendo() && RW.sessao.podeAdministrar('pelotao', pessoa.lotacao_atual); },
      aoClicarCelula: function (celula, pessoa, evento) { RW.usuariosAfastamentosCelula.aoClicar(celula, pessoa, evento); }
    };
    var n = celular() ? G().desenharLista(container, lista, c) : G().desenhar(container, lista, c);
    if (pessoas.length && !n) {
      var vazio = RW.tpl('tpl-usuario-vazio');
      if (vazio) {
        var bloquinho = RW.tpl('tpl-arvore-bloquinho');
        bloquinho.appendChild(vazio);
        container.appendChild(bloquinho);
      }
    }
  }

  /* a contagem de cada unidade: quantos têm afastamento no ano */
  function textoContagem(itens) {
    if (lendo()) return '';
    return M().contagem(itens.filter(function (p) { return doAno(p).length; }).length);
  }

  /* depois de desenhar: os graus e os nomes do ano nos Filtros, e a caixa aberta acompanha a grade nova */
  function aoRenderizar(pessoas) {
    if (filtros && ctx) {
      filtros.definir('graus', ctx.arvoreDeGraus(pessoas || []));
      var tem = {};
      (pessoas || []).forEach(function (p) { doAno(p).forEach(function (af) { tem[chaveFiltro(af)] = true; }); });
      var opcoes = M().padroes.filter(function (x) { return tem[x.valor]; }).map(function (x) { return { rotulo: x.rotulo, valor: x.valor }; });
      if (tem.outros) opcoes.push({ rotulo: M().outros, valor: 'outros' });
      filtros.definir('afastamento', opcoes);
    }
    if (RW.usuariosAfastamentosCelula) RW.usuariosAfastamentosCelula.reancorar();
  }

  /* ---------- carregar ---------- */

  /* lê o ano (uma vez por ano; a gravação esquece) e redesenha */
  function carregar() {
    if (lidos[ano]) { ctx.atualizar(); return; }
    var meu = ++token, esse = ano;
    ctx.atualizar();   // os nomes já aparecem; os selos chegam com a resposta
    RW.etapas.segurarDesde(performance.now(), RW.usuariosAfastamentosDados.listarAno(esse)).then(function (lista) {
      if (meu !== token) return;
      if (lista == null) {
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().falhaCarregar });
        return;
      }
      R().conhecer(lista);
      lidos[esse] = true;
      if (ativa && esse === ano) ctx.atualizar();
    });
  }

  /* o rascunho mudou: a grade mostra o resultado; gravou: relê o ano */
  function aoMudarRascunho(origem) {
    if (origem === 'gravou') {
      lidos = {};
      if (ativa) carregar();
      return;
    }
    if (ativa) ctx.atualizar();
  }

  /* outra gravação da ficha (a baixa, a transferência): esquece o que foi lido e relê o ano à mostra */
  function recarregar() {
    lidos = {};
    if (ativa) carregar();
  }

  /* a página trocou de aba: nesta, o ano e os Filtros dela aparecem, a árvore fica na largura toda e lê o ano */
  function mostrar(nova) {
    if (RW.usuariosAfastamentosCelula) RW.usuariosAfastamentosCelula.fechar();
    ativa = nova === 'afastamentos';
    if (seletor) seletor.el.classList.toggle('oculto', !ativa);
    if (filtros) filtros.mostrar(ativa);
    if (arvore) arvore.classList.toggle('afastamentos-arvore', ativa);
    if (!ativa) { token++; return; }
    if (filtros) filtros.definir('situacao', [{ rotulo: M().comNoAno, valor: 'com' }, { rotulo: M().semNoAno, valor: 'sem' }]);
    carregar();
  }

  /* a navegação abriu a página: o rascunho, os Filtros da aba e o ano, ainda escondidos */
  function iniciar(conteudo, emprestado) {
    ctx = emprestado;
    ativa = false;
    lidos = {};
    token++;
    ano = anoAtual();
    arvore = conteudo.querySelector('#arvore-usuarios');
    R().iniciar(conteudo);
    R().ouvir('aba', aoMudarRascunho);
    if (RW.usuariosAfastamentosCelula) {
      RW.usuariosAfastamentosCelula.iniciar({
        abrirFicha: function (pessoa) { ctx.abrirFicha(null, pessoa, { secao: 'afastamentos', ano: ano }); }
      });
    }
    var caixa = conteudo.querySelector('#usuarios-afast-filtros');
    filtros = (caixa && RW.filtros) ? RW.filtros.criar(caixa, {
      aoMudar: function () { if (ativa) ctx.atualizar(); }
    }) : null;
    if (filtros) filtros.mostrar(false);
    seletor = seletorAno(ano, function (a) {
      if (RW.usuariosAfastamentosCelula) RW.usuariosAfastamentosCelula.fechar();
      ano = a;
      if (ativa) carregar();
    });
    var barra = conteudo.querySelector('.pagina-subcabecalho');
    if (seletor && barra) {
      seletor.el.classList.add('oculto');
      var admin = barra.querySelector('.acoes-admin');
      if (admin) admin.after(seletor.el); else barra.prepend(seletor.el);
    }
  }

  window.RosterWork.usuariosAfastamentos = {
    iniciar: iniciar, mostrar: mostrar, ativa: function () { return ativa; }, recarregar: recarregar,
    renderConteudo: renderConteudo, aoRenderizar: aoRenderizar, textoContagem: textoContagem,
    /* para a ficha */
    seletorAno: seletorAno, anoAtual: anoAtual
  };
})();
