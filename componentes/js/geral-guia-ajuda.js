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
   do manual (o da aba aberta, quando ela tem data-manual; senão, o da
   tela); tela sem roteiro, só o link.
   Na tela em que os roteiros dizem a aba (data-nas-abas), a lista
   muda: primeiro Nesta aba (os da aba aberta e os que valem em todas);
   depois Em outras abas, com o nome da aba à frente. O roteiro leva a
   pessoa até lá, pelo passo "Abra a aba". Roteiro de aba que a pessoa
   não vê fica de fora; parte sem nada some.
   O próximo treino (o fim do treino e o Continuar os treinos): o
   seguinte na ordem da lista ainda sem Visto; acabou a lista, volta
   ao começo; todos com Visto, nenhum.
   API: visto(id), marcarVisto(id), dicaVista(), marcarDica(),
   proximoTreino(id | null), montarMenu(ajuda), secaoDoManual(ajuda). Moldes: #tpl-guia-menu,
   #tpl-guia-menu-abas, #tpl-guia-menu-item, #tpl-guia-menu-grupo, #tpl-guia-menu-conjunto.
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

  /* depois do treino id (null: do começo), o primeiro sem Visto; no fim da lista, volta ao começo */
  function proximoTreino(id) {
    var ids = RW.guiaRoteiros.ordem(), i = ids.indexOf(id);
    var fila = ids.slice(i + 1).concat(ids.slice(0, Math.max(i, 0)));
    return fila.filter(function (x) { return x !== id && !visto(x); })[0] || null;
  }

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
  /* o nome da aba à frente do treino; o conjunto que tem o nome da própria aba não repete */
  function porNomeDaAba(el, titulo, nomeDaAba) {
    if (!nomeDaAba || nomeDaAba === titulo) return;
    el.querySelector('.guia-menu-aba-nome').textContent = nomeDaAba;
    el.querySelector('.guia-menu-aba').classList.remove('oculto');
  }
  function novoItem(it, nomeDaAba) {
    var item = clonar('tpl-guia-menu-item');
    item.setAttribute('data-guia', it.id);
    item.querySelector('.guia-menu-nome').textContent = it.titulo;
    porNomeDaAba(item, it.titulo, nomeDaAba);
    return item;
  }
  function novoConjunto(c, aberto, nomeDaAba) {
    var el = clonar('tpl-guia-menu-conjunto');
    var opcoes = el.querySelector('.guia-menu-opcoes');
    el.querySelector('.guia-menu-nome').textContent = c.titulo;
    porNomeDaAba(el.querySelector('.guia-menu-conjunto-cabecalho'), c.titulo, nomeDaAba);
    c.opcoes.forEach(function (o) { opcoes.appendChild(novoItem(o)); });
    ligarChevron(el.querySelector('.guia-menu-conjunto-cabecalho'), opcoes, !!aberto);
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

  /* ---------- a tela com abas ---------- */
  /* a aba aberta na linha do título (a Escala não entra: as abas dela são modos de ver, sem data-aba) */
  function abaAberta(ajuda) {
    return ajuda.parentElement ? ajuda.parentElement.querySelector('.aba.aba--ativa[data-aba]') : null;
  }
  function abasDoItem(it) {
    var t = RW.guiaRoteiros.roteiro(it.opcoes ? it.opcoes[0].id : it.id);
    return ((t && t.getAttribute('data-nas-abas')) || '').split(' ').filter(Boolean);
  }
  /* a primeira das abas do item que a pessoa vê (a outra pode ser só do administrador, ou não existir no celular) */
  function abaParaIr(ajuda, abas) {
    return abas.map(function (id) { return ajuda.parentElement.querySelector('.aba[data-aba="' + id + '"]'); })
      .filter(function (b) { return !!b && b.getClientRects().length > 0; })[0] || null;
  }
  function nomeDaAba(botao) { return (botao.querySelector('span') || botao).textContent.trim(); }

  /* uma parte da lista: os de todos e, com o título quando os dois aparecem, os do administrador; sem nada, some */
  function montarParte(parte, itens) {
    var todos = itens.filter(function (x) { return x.area !== 'admin'; }), admin = itens.filter(function (x) { return x.area === 'admin'; });
    todos.forEach(function (x) { parte.querySelector('.guia-menu-lista').appendChild(x.el); });
    admin.forEach(function (x) { parte.querySelector('.guia-menu-lista-admin').appendChild(x.el); });
    parte.querySelector('.guia-menu-area').classList.toggle('oculto', !todos.length || !admin.length);
    parte.classList.toggle('oculto', !itens.length);
  }
  function montarPorAba(ajuda, menu, grupos, aba) {
    menu.appendChild(document.getElementById('tpl-guia-menu-abas').content.cloneNode(true));
    var nestaAba = [], emOutras = [];
    grupos.forEach(function (g) {
      g.itens.forEach(function (it) {
        var abas = abasDoItem(it), aqui = !abas.length || abas.indexOf(aba) >= 0;
        var botao = aqui ? null : abaParaIr(ajuda, abas);
        if (!aqui && !botao) return;
        var nome = botao ? nomeDaAba(botao) : null;
        var el = it.opcoes ? novoConjunto(it, aqui, nome) : novoItem(it, nome);
        (aqui ? nestaAba : emOutras).push({ area: g.area, el: el });
      });
    });
    montarParte(menu.querySelector('.guia-menu-nesta-aba'), nestaAba);
    montarParte(menu.querySelector('.guia-menu-em-outras-abas'), emOutras);
    /* sem nada nesta aba, o traço de cima de Em outras abas sobra; sem nada na lista, o de cima do manual */
    menu.querySelector('.guia-menu-em-outras-abas > .dropdown-divisor').classList.toggle('oculto', !nestaAba.length);
    menu.querySelector('.guia-menu-divisor').classList.toggle('oculto', !nestaAba.length && !emOutras.length);
  }

  /* a parte do manual: a da aba aberta, quando ela tem; senão, a da tela */
  function secaoDoManual(ajuda) {
    var aba = abaAberta(ajuda);
    return (aba && aba.getAttribute('data-manual')) || ajuda.getAttribute('data-manual');
  }

  /* a lista do ?: os roteiros que passam pela tela e o manual */
  function montarMenu(ajuda) {
    var menu = ajuda.querySelector('.pagina-ajuda-menu');
    var molde = document.getElementById('tpl-guia-menu');
    if (!menu || !molde) return;
    menu.textContent = '';
    var pagina = RW.paginaAtual ? RW.paginaAtual() : null;
    var roteiros = RW.guiaRoteiros.naPagina(pagina);
    var grupos = RW.guiaRoteiros.grupos(roteiros);
    var aba = abaAberta(ajuda);
    if (aba && roteiros.some(function (t) { return t.hasAttribute('data-nas-abas'); })) {
      montarPorAba(ajuda, menu, grupos, aba.getAttribute('data-aba'));
      return;
    }
    menu.appendChild(molde.content.cloneNode(true));
    var lista = menu.querySelector('.guia-menu-lista');
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

  RW.guiaAjuda = { visto: visto, marcarVisto: marcarVisto, dicaVista: dicaVista, marcarDica: marcarDica, proximoTreino: proximoTreino, montarMenu: montarMenu, secaoDoManual: secaoDoManual };
})();
