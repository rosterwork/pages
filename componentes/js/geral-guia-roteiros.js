/* ============================================================
   GUIA › ROTEIROS — os passo a passo do sistema (RosterWork.guiaRoteiros)
   Cada roteiro é um <template data-roteiro data-titulo data-area> no
   index.html, um <p> por passo, e pode passar por várias telas:
   data-pagina (no template, numa <section> ou no <p>) diz em que tela
   o passo acontece ("qualquer" = o menu, em qualquer tela).
   Passo com escolha (data-avanca="escolha"): os caminhos são as
   <section data-caminho data-entrada> logo depois dele; as entradas
   acendem juntas e a que a pessoa clica escolhe o caminho. Depois do
   caminho, o roteiro segue com o que vem depois das seções; o
   <p data-fim> de dentro da seção, quando há, é o fim daquele caminho.
   <p data-trecho="nome"> repete os passos de um <template
   data-roteiro-trecho="nome"> (as aberturas comuns: abrir a Escala,
   a aba, o dia). Nos seletores, {unidade} vira a unidade da pessoa,
   {hoje}, a data de hoje (aaaa-mm-dd), {cpf}, o CPF dela, e {exemplo}, o id do exemplo
   que o banco monta no treino (a troca, a folga ou o pedido de
   correção; geral-treino-banco.js; fora dele, nenhum: o
   data-alvo-senao vale).
   data-area="admin": só para quem administra (data-papel="companhia":
   só para quem administra a companhia, ou mais); data-so-computador
   (no template): fora do celular. data-nas-abas (no template): as abas
   da tela em que o roteiro acontece, a primeira é para onde ele leva;
   sem ele, o roteiro vale em qualquer aba (o ? usa isso, geral-guia-ajuda.js).
   A <section data-segurar> é o caminho
   cuja entrada já grava: no treino, o clique nela fica com o guia e o
   roteiro vai ao fim.
   O passo: data-alvo (seletores separados por vírgula; acende todos
   os que estão na tela), data-alvo-senao (quando nenhum está),
   data-um (só o primeiro à vista), data-anel ("campo": o campo com o
   rótulo; "caixa": a caixa da pergunta), data-clique (o que se clica,
   quando o aceso é maior) e data-avanca: clique · preenchido (o
   data-condicao ou o alvo ganhou valor; bolinha e caixa de marcar,
   marcada) · aparece (o data-condicao apareceu) · proximo (o botão do
   balão) · some (o data-condicao saiu; com o resumo aberto, foi
   enviado) · escolha. Pula: data-pular-se (o seletor existe),
   data-opcional (o alvo não aparece), data-so-celular e
   data-so-computador. data-segurar, no treino: o clique que gravaria
   não chega à tela e o roteiro vai ao fim. data-livre: dá para mexer
   em todo o aceso (no passo de olhar, nada responde; no de clique e no
   de gravar, só o botão que ele pede). data-escrever (no treino): o
   campo de texto; o passo anda pelo Próximo, que aparece quando há
   texto. <p data-fim>: o balão final (no treino, o <p data-fim-treino>,
   quando há).
   No treino (geral-guia-vidro.js), só a porta do passo responde. No
   passo: data-porta (os estágios, com ponto e vírgula; vale o último à
   vista), data-treino-alvo (acende e abre só o primeiro que achar),
   data-exemplo (o elemento do exemplo, com as opções em ponto e vírgula;
   sem nenhuma, o passo fica sem alvo; o texto dele preenche o
   [data-exemplo-nome]), data-so-mouse (o alvo deixa o mouse passar, e
   o clique não responde), data-sem-alvo-treino (a frase de parada) e
   <span data-so-treino> (o texto do passo, no lugar do de fora do
   treino). O <p data-so-treino> só vale no treino, e o <p data-so-ajuda>,
   só no ?. Na seção: data-treino-entrada (a entrada do caminho; acende
   a primeira que achar). Fora do treino, nada disso vale.
   API: lista() (os roteiros que a pessoa pode fazer), naPagina(p)
   (os que passam pela tela), grupos(roteiros) (a lista como a pessoa
   vê, no Treinamento e no ?), ordem() (os ids nessa ordem, um a um,
   com as opções dos conjuntos), idsDoGrupo(g) (os ids de um bloco,
   nessa ordem: a posição é o número do treino, que recomeça em cada
   bloco), ondeFica(id) ({ area, grupo, numero, total }), aSeguir(id)
   (a frase do "A seguir"), passos(id, pagina) (do começo, ou a
   partir da tela pedida), caminho(passo, alvo) (os passos e o fim do
   caminho clicado), entradas(passo), fimDe(container, treino),
   seletores(texto), celular(), roteiro(id), exemplo(p).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a mesma condição do bloco de celular do CSS: a marca no <html> e a tela até 767px */
  function celular() {
    return document.documentElement.hasAttribute('data-celular') && !!window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  }

  function hojeIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function seletores(texto) {
    var u = RW.sessao ? RW.sessao.perfil() : null;
    var unidade = u && u.lotacao_id != null ? String(u.lotacao_id) : '';
    var hoje = hojeIso();
    var cpf = u && u.cpf ? String(u.cpf) : 'nenhum';
    var exemplo = (RW.treinoBanco && RW.treinoBanco.exemplo()) || 'nenhum';
    return (texto || '').split(',').map(function (s) {
      return s.trim().replace(/\{unidade\}/g, unidade).replace(/\{hoje\}/g, hoje).replace(/\{cpf\}/g, cpf).replace(/\{exemplo\}/g, exemplo);
    }).filter(Boolean);
  }

  function roteiro(id) { return document.querySelector('template[data-roteiro="' + id + '"]'); }

  /* a pessoa pode fazer este roteiro aqui? */
  function pode(t) {
    var papel = t.getAttribute('data-papel') || (t.getAttribute('data-area') === 'admin' ? 'pelotao' : null);
    if (papel && !(RW.sessao && RW.sessao.temPapel(papel))) return false;
    return !(t.hasAttribute('data-so-computador') && celular());
  }

  /* os passos de um trecho do roteiro, em fila: { p, pagina, caminhos: [<section>] } */
  function linear(container, pagina) {
    var lista = [];
    Array.prototype.forEach.call(container.children, function (el) {
      if (el.tagName === 'SECTION') {
        if (lista.length) lista[lista.length - 1].caminhos.push(el);
        return;
      }
      if (el.tagName !== 'P' || el.hasAttribute('data-fim') || el.hasAttribute('data-fim-treino')) return;
      var trecho = el.getAttribute('data-trecho');
      if (trecho) {
        var t = document.querySelector('template[data-roteiro-trecho="' + trecho + '"]');
        if (t) lista = lista.concat(linear(t.content, el.getAttribute('data-pagina') || pagina));
        return;
      }
      lista.push({ p: el, pagina: el.getAttribute('data-pagina') || pagina, caminhos: [] });
    });
    return lista;
  }

  /* o balão final do trecho (o template ou a seção): o <p data-fim-treino> no treino, o <p data-fim> fora dele */
  function fimDe(container, treino) {
    var atributo = treino ? 'data-fim-treino' : 'data-fim';
    return Array.prototype.filter.call(container.children, function (el) { return el.tagName === 'P' && el.hasAttribute(atributo); })[0] || null;
  }

  function passosDoCaminho(secao, passo) { return linear(secao, secao.getAttribute('data-pagina') || passo.pagina); }

  /* a fila a partir do primeiro passo na tela pedida (entrando no caminho que passa por ela) */
  function aPartirDe(lista, pagina) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].pagina === pagina) return lista.slice(i);
      for (var c = 0; c < lista[i].caminhos.length; c++) {
        var achou = aPartirDe(passosDoCaminho(lista[i].caminhos[c], lista[i]), pagina);
        if (achou) return achou.concat(lista.slice(i + 1));
      }
    }
    return null;
  }

  function passos(id, pagina) {
    var t = roteiro(id);
    if (!t) return null;
    var lista = linear(t.content, t.getAttribute('data-pagina'));
    return pagina ? aPartirDe(lista, pagina) : lista;
  }

  /* o caminho que a pessoa clicou num passo com escolha: { passos, fim, fimTreino } (o fim próprio do caminho,
     quando ele tem); null: o clique não foi numa entrada */
  function caminho(passo, alvo) {
    for (var c = 0; c < passo.caminhos.length; c++) {
      var secao = passo.caminhos[c];
      var entradasDaSecao = seletores(secao.getAttribute('data-entrada')).concat(seletores(secao.getAttribute('data-treino-entrada')));
      var acertou = entradasDaSecao.some(function (s) { return alvo.closest(s); });
      if (acertou) return { passos: passosDoCaminho(secao, passo), fim: fimDe(secao, false), fimTreino: fimDe(secao, true),
        segurar: secao.hasAttribute('data-segurar') };
    }
    return null;
  }

  function entradas(passo) {
    return passo.caminhos.reduce(function (todas, secao) { return todas.concat(seletores(secao.getAttribute('data-entrada'))); }, []);
  }

  /* o elemento do exemplo do passo: vale a primeira opção do data-exemplo que existe na tela */
  function exemplo(p) {
    var opcoes = (p.getAttribute('data-exemplo') || '').split(';');
    for (var i = 0; i < opcoes.length; i++) {
      var s = seletores(opcoes[i])[0], el = s ? document.querySelector(s) : null;
      if (el) return el;
    }
    return null;
  }

  function lista() {
    return Array.prototype.filter.call(document.querySelectorAll('template[data-roteiro]'), pode);
  }

  function naPagina(pagina) {
    return lista().filter(function (t) { return !!passos(t.getAttribute('data-roteiro'), pagina); });
  }

  /* a lista em grupos: primeiro a área de todos, depois a do administrador; em cada área, um grupo por tela
     (data-grupo), na ordem em que aparecem; os roteiros do mesmo data-conjunto viram um item só, com as opções dentro (o
     nome, a tela e a área vêm do <template data-roteiro-conjunto>).
     [{ area, grupo, itens: [{ id, titulo, pagina } | { conjunto, titulo, opcoes: [{ id, titulo, pagina }] }] }] */
  function grupos(roteiros) {
    var todos = [];
    function area(t) { return t.getAttribute('data-area') === 'admin' ? 'admin' : 'todos'; }
    function grupoDe(t) {
      var a = area(t), nome = t.getAttribute('data-grupo') || '';
      var g = todos.filter(function (x) { return x.area === a && x.grupo === nome; })[0];
      if (!g) { g = { area: a, grupo: nome, itens: [] }; todos.push(g); }
      return g;
    }
    roteiros.forEach(function (t) {
      var item = { id: t.getAttribute('data-roteiro'), titulo: t.getAttribute('data-titulo'), pagina: t.getAttribute('data-pagina') };
      var id = t.getAttribute('data-conjunto');
      var molde = id ? document.querySelector('template[data-roteiro-conjunto="' + id + '"]') : null;
      if (!molde) { grupoDe(t).itens.push(item); return; }
      var g = grupoDe(molde);
      var c = g.itens.filter(function (x) { return x.conjunto === id; })[0];
      if (!c) { c = { conjunto: id, titulo: molde.getAttribute('data-titulo'), opcoes: [] }; g.itens.push(c); }
      c.opcoes.push(item);
    });
    return todos.filter(function (g) { return g.area === 'todos'; }).concat(todos.filter(function (g) { return g.area === 'admin'; }));
  }

  /* os ids de um bloco, um a um: no conjunto, opção a opção */
  function idsDoGrupo(g) {
    var ids = [];
    g.itens.forEach(function (it) { (it.opcoes || [it]).forEach(function (o) { ids.push(o.id); }); });
    return ids;
  }

  /* os ids na ordem da lista do Treinamento: bloco a bloco */
  function ordem() {
    return grupos(lista()).reduce(function (ids, g) { return ids.concat(idsDoGrupo(g)); }, []);
  }

  /* o bloco do treino na lista da pessoa e o número dele no bloco */
  function ondeFica(id) {
    var achou = null;
    grupos(lista()).forEach(function (g) {
      var ids = idsDoGrupo(g), i = ids.indexOf(id);
      if (i >= 0) achou = { area: g.area, grupo: g.grupo, numero: i + 1, total: ids.length };
    });
    return achou;
  }

  function aSeguir(id) {
    var onde = ondeFica(id), t = roteiro(id);
    return (onde && t) ? RW.mensagens.treino.seguinte(onde, t.getAttribute('data-titulo')) : '';
  }

  RW.guiaRoteiros = {
    lista: lista, naPagina: naPagina, grupos: grupos, ordem: ordem, idsDoGrupo: idsDoGrupo, ondeFica: ondeFica, aSeguir: aSeguir,
    passos: passos, caminho: caminho, entradas: entradas, fimDe: fimDe, seletores: seletores, celular: celular, roteiro: roteiro,
    exemplo: exemplo
  };
})();
