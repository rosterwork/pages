/* ============================================================
   MANUAL — página de uso do sistema (o item "Manual" do menu do
   perfil navega para cá). Este arquivo vem no shell: liga o botão
   do cabeçalho e registra RosterWork.paginas.manual.
   A página tem DOIS MODELOS: o usuário comum vê só as partes dele;
   as de administrador (classe .manual-admin) aparecem só para admin.
   O iniciar lê a sessão e, se for admin, marca data-perfil="admin"
   no .manual (o CSS revela as partes de admin). Sem sessão de admin,
   fica o modelo comum (padrão seguro).
   Layout lateral (geral-layout-lateral): índice fixo à esquerda +
   documento rolável à direita (.geral-corpo-lateral-rolagem). O
   clique no índice rola essa coluna suave até a seção, e o item da
   seção à vista fica destacado (.lista-item--ativo). Não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var reduzirMovimento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* liga o índice: clique rola a coluna direita até a seção (sem mexer na URL,
     então não recarrega) e destaca o item da seção à vista */
  function ligarIndice(raiz) {
    var rolagem = raiz.querySelector('.geral-corpo-lateral-rolagem');
    if (!rolagem) return;
    var links = Array.prototype.slice.call(raiz.querySelectorAll('.manual-indice a[href^="#"]'));

    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var alvo = document.getElementById(a.getAttribute('href').slice(1));
        if (!alvo) return;
        e.preventDefault();
        var delta = alvo.getBoundingClientRect().top - rolagem.getBoundingClientRect().top;
        rolagem.scrollTo({ top: rolagem.scrollTop + delta - 16, behavior: reduzirMovimento ? 'auto' : 'smooth' });
      });
    });

    var alvos = links.map(function (a) {
      return { link: a, alvo: document.getElementById(a.getAttribute('href').slice(1)) };
    }).filter(function (x) { return x.alvo; });

    /* scrollspy: destaca o item da última seção que passou pelo topo da leitura */
    function marcar() {
      var topo = rolagem.getBoundingClientRect().top;
      var ativo = null;
      for (var i = 0; i < alvos.length; i++) {
        var r = alvos[i].alvo.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;   /* seção escondida (modelo comum) */
        if (r.top - topo <= 24) ativo = alvos[i]; else break;
      }
      for (var j = 0; j < alvos.length; j++) alvos[j].link.classList.toggle('lista-item--ativo', alvos[j] === ativo);
    }

    var agendado = false;
    rolagem.addEventListener('scroll', function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; marcar(); });
    });
    marcar();
  }

  /* renderiza a página (chamado pela navegação SPA) */
  function iniciar(conteudo) {
    var manual = conteudo.querySelector('.manual');
    if (!manual) return;
    var ehAdmin = !!(RosterWork.sessao && RosterWork.sessao.ehAdmin());
    if (ehAdmin) manual.setAttribute('data-perfil', 'admin');
    else manual.removeAttribute('data-perfil');
    ligarIndice(manual);
    /* aberto pelo ? de uma tela (geral-guia): começa na parte daquela tela */
    var secao = RosterWork.referenciaPedida ? RosterWork.referenciaPedida('manual') : null;
    var alvo = secao ? document.getElementById(secao) : null;
    if (alvo) irParaSecao(alvo, 20);
  }

  /* rola a área de leitura até a seção. O CSS da página chega depois do iniciar e as imagens de cima mudam
     a altura enquanto carregam: confere de novo por uns 2 s, e para se a pessoa rolar por conta própria */
  function irParaSecao(alvo, tentativas, esperado) {
    var area = alvo.parentElement;
    while (area && area !== document.body) {
      var rolagem = getComputedStyle(area).overflowY;
      if ((rolagem === 'auto' || rolagem === 'scroll') && area.scrollHeight > area.clientHeight + 1) break;
      area = area.parentElement;
    }
    if (area && area !== document.body) {
      if (esperado !== undefined && Math.abs(area.scrollTop - esperado) > 4) return;
      var diferenca = alvo.getBoundingClientRect().top - area.getBoundingClientRect().top - 16;
      if (Math.abs(diferenca) > 2) area.scrollTop += diferenca;
      esperado = area.scrollTop;
    }
    if (tentativas > 0) setTimeout(function () { irParaSecao(alvo, tentativas - 1, esperado); }, 100);
  }

  /* o item "Manual" do menu do cabeçalho navega para a página */
  function inicializar() {
    var botao = document.getElementById('btn-manual');
    if (botao) botao.addEventListener('click', function () {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      if (RosterWork.irParaPagina) RosterWork.irParaPagina('manual');
    });
  }

  RosterWork.paginas.manual = { iniciar: iniciar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
