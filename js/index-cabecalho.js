(function () {
  'use strict';

  /* botão lua/sol: fixa claro ou escuro (o tema já foi aplicado pelo geral-tema.js; o
     Automático se escolhe em Meu perfil). O ícone acompanha também a troca do aparelho */
  var btnTema = document.getElementById('cabecalho-btn-tema');
  var iconeLua = document.getElementById('cabecalho-icone-lua');
  var iconeSol = document.getElementById('cabecalho-icone-sol');

  function atualizarIconeTema() {
    var escuro = RosterWork.tema.escuro();
    if (iconeLua) iconeLua.classList.toggle('oculto', escuro);
    if (iconeSol) iconeSol.classList.toggle('oculto', !escuro);
    if (btnTema) btnTema.setAttribute('data-dica', escuro ? 'Tema claro' : 'Tema escuro');
  }

  atualizarIconeTema();
  window.addEventListener('rosterwork_tema', atualizarIconeTema);

  if (btnTema) {
    btnTema.addEventListener('click', function () {
      RosterWork.tema.escolher(RosterWork.tema.escuro() ? 'claro' : 'escuro');
    });
  }

  var btnSair = document.getElementById('btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', function () {
      RosterWork.sair();
    });
  }

  var perfil = null;
  try { perfil = JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) {}
  if (!perfil || !perfil.ok) return;

  var elAvatar = document.querySelector('.cabecalho-usuario-avatar');
  var elNome = document.querySelector('.cabecalho-usuario-nome');
  var elLotacao = document.querySelector('.cabecalho-usuario-lotacao');

  if (elAvatar) {
    elAvatar.textContent = perfil.nome_de_guerra ? perfil.nome_de_guerra.slice(0, 2).toUpperCase() : '';
  }

  if (elNome) {
    elNome.textContent = ((perfil.grau_abreviacao || '') + ' ' + (perfil.nome_de_guerra || '')).trim();
  }

  if (elLotacao) {
    var segmentos = typeof perfil.lotacao_path === 'string' ? perfil.lotacao_path.split(' / ') : [];
    var unidade = segmentos.length > 0 ? segmentos[segmentos.length - 1] : '';
    var cidade = perfil.lotacao_cidade || '';
    elLotacao.textContent = unidade ? (cidade ? unidade + ' - ' + cidade : unidade) : '';
  }
})();
