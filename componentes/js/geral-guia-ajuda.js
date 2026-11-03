/* ============================================================
   GUIA › AJUDA — o que a pessoa já viu e a lista do ? (RosterWork.guiaAjuda)
   O que a pessoa já viu fica em preferencias_usuario.ajuda
   ({ dica_vista, vistos }), na sessão e no banco pelo
   fn_preferencias_salvar (falhou: vale nesta sessão). A lista do ?
   (.pagina-ajuda-menu) traz os roteiros que passam pela tela, nos
   grupos do Treinamento (RosterWork.guiaRoteiros.grupos): os de
   todos e, depois do título Administrador, os do administrador; um
   grupo por tela, com o chevron que abre e fecha sem fechar o menu
   (um aberto por vez: abrir um fecha o outro; começa aberto só o
   grupo desta tela; sem ele, o primeiro); o
   conjunto é uma linha com chevron e as opções embaixo. Sem o Visto:
   o ? é a ajuda para fazer a tarefa, não o treino. Embaixo, o link
   do manual; tela sem roteiro, só o link.
   API: visto(id), marcarVisto(id), dicaVista(), marcarDica(),
   montarMenu(ajuda). Moldes: #tpl-guia-menu, #tpl-guia-menu-item,
   #tpl-guia-menu-grupo, #tpl-guia-menu-conjunto.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function lerPrefs() { try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; } }
  function lerAjuda() { var a = lerPrefs().ajuda; return (a && typeof a === 'object') ? a : {}; }
  function gravarAjuda(mudar) {
    var atual = lerAjuda();
    var nova = { dica_vista: !!atual.dica_vista, vistos: Array.isArray(atual.vistos) ? atual.vistos.slice() : [] };
    mudar(nova);
    var prefs = lerPrefs();
    prefs.ajuda = nova;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    if (RW.apiFetch) {
      RW.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', { metodo: 'POST', corpo: { p_ajuda: nova } })
        .catch(function () {});   // falhou: vale nesta sessão, só não lembra em outro aparelho
    }
  }
  function marcarVisto(id) { gravarAjuda(function (a) { a.dica_vista = true; if (a.vistos.indexOf(id) < 0) a.vistos.push(id); }); }
  function visto(id) { return (lerAjuda().vistos || []).indexOf(id) >= 0; }
  function dicaVista() { return !!lerAjuda().dica_vista; }
  function marcarDica() { if (!dicaVista()) gravarAjuda(function (a) { a.dica_vista = true; }); }

  function clonar(id) { var t = document.getElementById(id); return t ? t.content.firstElementChild.cloneNode(true) : null; }

  /* o chevron do ?: abre e fecha ali mesmo; o clique não chega ao menu (que fecharia no clique de um item). aoAbrir: o
     que mais acontece quando abre (no grupo, os outros fecham) */
  function abrir(cabeca, corpo, sim) {
    cabeca.setAttribute('aria-expanded', sim ? 'true' : 'false');
    corpo.classList.toggle('oculto', !sim);
  }
  function ligarChevron(cabeca, corpo, aberto, aoAbrir) {
    abrir(cabeca, corpo, aberto);
    cabeca.addEventListener('click', function (evento) {
      evento.stopPropagation();
      var sim = cabeca.getAttribute('aria-expanded') !== 'true';
      if (sim && aoAbrir) aoAbrir();
      abrir(cabeca, corpo, sim);
    });
  }
  function novoItem(it) {
    var item = clonar('tpl-guia-menu-item');
    item.setAttribute('data-guia', it.id);
    item.querySelector('.guia-menu-nome').textContent = it.titulo;
    return item;
  }
  function novoConjunto(c) {
    var el = clonar('tpl-guia-menu-conjunto');
    var opcoes = el.querySelector('.guia-menu-opcoes');
    el.querySelector('.guia-menu-nome').textContent = c.titulo;
    c.opcoes.forEach(function (o) { opcoes.appendChild(novoItem(o)); });
    ligarChevron(el.querySelector('.guia-menu-conjunto-cabecalho'), opcoes, false);
    return el;
  }
  /* o grupo da tela: abrir um fecha os outros do menu */
  function novoGrupo(menu, g, aberto) {
    var el = clonar('tpl-guia-menu-grupo');
    var itens = el.querySelector('.guia-menu-grupo-itens');
    el.querySelector('.guia-menu-grupo-nome').textContent = g.grupo;
    g.itens.forEach(function (it) { itens.appendChild(it.opcoes ? novoConjunto(it) : novoItem(it)); });
    ligarChevron(el.querySelector('.guia-menu-grupo-cabecalho'), itens, aberto, function () {
      Array.prototype.forEach.call(menu.querySelectorAll('.guia-menu-grupo'), function (outro) {
        if (outro !== el) abrir(outro.querySelector('.guia-menu-grupo-cabecalho'), outro.querySelector('.guia-menu-grupo-itens'), false);
      });
    });
    return el;
  }
  /* o grupo que começa aberto: o de todos com roteiro desta tela; sem ele, o primeiro */
  function grupoDaTela(grupos, pagina) {
    function daTela(it) { return it.pagina === pagina || (it.opcoes || []).some(daTela); }
    var todos = grupos.filter(function (g) { return g.area === 'todos'; });
    return todos.filter(function (g) { return g.itens.some(daTela); })[0] || todos[0] || grupos[0];
  }

  /* a lista do ?: os roteiros que passam pela tela, em grupos, e o manual */
  function montarMenu(ajuda) {
    var menu = ajuda.querySelector('.pagina-ajuda-menu');
    var molde = document.getElementById('tpl-guia-menu');
    if (!menu || !molde) return;
    menu.textContent = '';
    menu.appendChild(molde.content.cloneNode(true));
    var lista = menu.querySelector('.guia-menu-lista');
    var pagina = RW.paginaAtual ? RW.paginaAtual() : null;
    var grupos = RW.guiaRoteiros.grupos(RW.guiaRoteiros.naPagina(pagina));
    var aberto = grupoDaTela(grupos, pagina);
    grupos.forEach(function (g) {
      (g.area === 'admin' ? menu.querySelector('.guia-menu-lista-admin') : lista).appendChild(novoGrupo(menu, g, g === aberto));
    });
    menu.querySelector('.guia-menu-admin').classList.toggle('oculto', !grupos.some(function (g) { return g.area === 'admin'; }));
    var sem = !grupos.length;
    menu.querySelector('.guia-menu-titulo').classList.toggle('oculto', sem);
    lista.classList.toggle('oculto', sem);
    menu.querySelector('.guia-menu-divisor').classList.toggle('oculto', sem);
  }

  RW.guiaAjuda = { visto: visto, marcarVisto: marcarVisto, dicaVista: dicaVista, marcarDica: marcarDica, montarMenu: montarMenu };
})();
