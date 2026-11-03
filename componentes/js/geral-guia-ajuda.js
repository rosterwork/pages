/* ============================================================
   GUIA › AJUDA — o que a pessoa já viu e a lista do ? (RosterWork.guiaAjuda)
   O que a pessoa já viu fica em preferencias_usuario.ajuda
   ({ dica_vista, vistos }), na sessão e no banco pelo
   fn_preferencias_salvar (falhou: vale nesta sessão). A lista do ?
   (.pagina-ajuda-menu) traz os roteiros que passam pela tela, com o
   Visto, e o link do manual; tela sem roteiro, só o link.
   API: visto(id), marcarVisto(id), dicaVista(), marcarDica(),
   montarMenu(ajuda). Moldes: #tpl-guia-menu, #tpl-guia-menu-item.
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

  /* a lista do ?: os roteiros que passam pela tela e o manual */
  function montarMenu(ajuda) {
    var menu = ajuda.querySelector('.pagina-ajuda-menu');
    var molde = document.getElementById('tpl-guia-menu');
    if (!menu || !molde) return;
    menu.textContent = '';
    menu.appendChild(molde.content.cloneNode(true));
    var lista = menu.querySelector('.guia-menu-lista');
    var roteiros = RW.guiaRoteiros.naPagina(RW.paginaAtual ? RW.paginaAtual() : null);
    roteiros.forEach(function (t) {
      var item = clonar('tpl-guia-menu-item');
      if (!item) return;
      item.setAttribute('data-guia', t.getAttribute('data-roteiro'));
      item.querySelector('.guia-menu-nome').textContent = t.getAttribute('data-titulo');
      item.querySelector('.guia-menu-visto').classList.toggle('oculto', !visto(t.getAttribute('data-roteiro')));
      lista.appendChild(item);
    });
    var sem = !roteiros.length;
    menu.querySelector('.guia-menu-titulo').classList.toggle('oculto', sem);
    lista.classList.toggle('oculto', sem);
    menu.querySelector('.guia-menu-divisor').classList.toggle('oculto', sem);
  }

  RW.guiaAjuda = { visto: visto, marcarVisto: marcarVisto, dicaVista: dicaVista, marcarDica: marcarDica, montarMenu: montarMenu };
})();
