(function () {
  'use strict';

  /* aplica o tema salvo nas preferências */
  var prefs = null;
  try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}

  if (prefs && prefs.tema === 'escuro') {
    document.documentElement.setAttribute('data-tema', 'escuro');
  } else {
    document.documentElement.removeAttribute('data-tema');
  }

  var btnTema = document.getElementById('cabecalho-btn-tema');
  var iconeLua = document.getElementById('cabecalho-icone-lua');
  var iconeSol = document.getElementById('cabecalho-icone-sol');

  function atualizarIconeTema() {
    var escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
    if (iconeLua) iconeLua.classList.toggle('oculto', escuro);
    if (iconeSol) iconeSol.classList.toggle('oculto', !escuro);
    if (btnTema) btnTema.setAttribute('data-dica', escuro ? 'Tema claro' : 'Tema escuro');
  }

  atualizarIconeTema();

  if (btnTema) {
    btnTema.addEventListener('click', function () {
      var escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
      var novoTema = escuro ? 'claro' : 'escuro';

      if (novoTema === 'escuro') {
        document.documentElement.setAttribute('data-tema', 'escuro');
      } else {
        document.documentElement.removeAttribute('data-tema');
      }

      atualizarIconeTema();

      /* atualiza cache na sessão */
      var prefsAtual = null;
      try { prefsAtual = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}
      prefsAtual = prefsAtual || {};
      prefsAtual.tema = novoTema;
      sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefsAtual));

      /* persiste no banco */
      if (RosterWork.obterToken()) {
        RosterWork.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
          metodo: 'POST',
          corpo: { p_tema: novoTema }
        }).catch(function () {});
      }
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
