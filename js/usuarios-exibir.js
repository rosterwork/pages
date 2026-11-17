/* ============================================================
   USUÁRIOS — controles do cabeçalho da página, os dois só de ícone:
   "Exibir" (o olho) e "Ordem" (o ícone mostra a ordem ativa).
   Exibir: identificador (CPF/RG/Telefone/E-mail, um por vez,
   padrão CPF), formato do nome (só guerra ou completo+guerra) e
   hierarquia on/off — o menu fica aberto ao escolher (as opções
   não são .dropdown-item). Ordem: escolha única entre as quatro
   (fecha ao escolher, são .dropdown-item). O estado dos dois vive
   em rosterwork_preferencias.exibir — some no login (volta ao
   padrão). Aqui também as regras da lista do efetivo que Usuários e
   Afastamentos usam iguais: a busca (nome de guerra, nome completo,
   CPF ou RG), a ordem (a do botão) e a árvore de Graus do filtro. A
   página Afastamentos carrega este arquivo e usa a mesma Ordem.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PADRAO = { identificador: 'cpf', hierarquia: true, nome: 'guerra', ordem: 'antiguidade' };

  /* as quatro ordens, na sequência do menu; a dica do botão vem daqui */
  var ORDENS = {
    'antiguidade': 'Ordem: antiguidade (mais antigo primeiro)',
    'antiguidade-inversa': 'Ordem: antiguidade (mais moderno primeiro)',
    'az': 'Ordem: alfabética (de A a Z)',
    'za': 'Ordem: alfabética (de Z a A)'
  };

  function lerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; }
  }

  /* estado atual, com os padrões aplicados quando ainda não há escolha */
  function estado() {
    var e = (lerPrefs().exibir) || {};
    return {
      identificador: e.identificador || PADRAO.identificador,
      hierarquia: e.hierarquia !== false,     // padrão: true
      nome: e.nome || PADRAO.nome,
      ordem: e.ordem || PADRAO.ordem          // padrão: antiguidade
    };
  }

  function salvar(e) {
    var p = lerPrefs();
    p.exibir = e;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(p)); } catch (_e) {}
  }

  /* realça a opção ativa de cada grupo (a check aparece via .exibir-opcao--ativo) */
  function marcar(menu) {
    var e = estado();
    var ids = menu.querySelectorAll('[data-exibir-id]');
    for (var i = 0; i < ids.length; i++) ids[i].classList.toggle('exibir-opcao--ativo', ids[i].getAttribute('data-exibir-id') === e.identificador);
    var noms = menu.querySelectorAll('[data-exibir-nome]');
    for (var j = 0; j < noms.length; j++) noms[j].classList.toggle('exibir-opcao--ativo', noms[j].getAttribute('data-exibir-nome') === e.nome);
    var h = menu.querySelector('[data-exibir-toggle="hierarquia"]');
    if (h) h.classList.toggle('exibir-opcao--ativo', !!e.hierarquia);
  }

  /* realça a ordem escolhida no menu e troca o ícone + a dica do botão */
  function marcarOrdem(conteudo) {
    var ordem = ORDENS[estado().ordem] ? estado().ordem : PADRAO.ordem;
    var opcoes = conteudo.querySelectorAll('[data-ordem]');
    for (var i = 0; i < opcoes.length; i++) {
      opcoes[i].classList.toggle('dropdown-item--ativo', opcoes[i].getAttribute('data-ordem') === ordem);
    }
    var icones = conteudo.querySelectorAll('[data-ordem-icone]');
    for (var j = 0; j < icones.length; j++) {
      icones[j].classList.toggle('oculto', icones[j].getAttribute('data-ordem-icone') !== ordem);
    }
    var botao = conteudo.querySelector('#ordem-seletor');
    if (botao) botao.setAttribute('data-dica', ORDENS[ordem]);
  }

  /* liga o botão de ordem (escolha única; o menu fecha ao escolher) */
  function ligarOrdem(conteudo, aoMudar) {
    var menu = conteudo.querySelector('#ordem-menu');
    if (!menu) return;
    marcarOrdem(conteudo);
    menu.addEventListener('click', function (evento) {
      var opcao = evento.target.closest ? evento.target.closest('[data-ordem]') : null;
      if (!opcao) return;
      var e = estado();
      e.ordem = opcao.getAttribute('data-ordem');
      salvar(e);
      marcarOrdem(conteudo);
      if (aoMudar) aoMudar();
    });
  }

  /* liga o menu; aoMudar é chamado a cada escolha (a página re-renderiza os cards) */
  function ligar(conteudo, aoMudar) {
    var menu = conteudo.querySelector('#exibir-menu');
    if (!menu) return;
    marcar(menu);
    menu.addEventListener('click', function (evento) {
      var op = evento.target.closest ? evento.target.closest('.exibir-opcao') : null;
      if (!op) return;
      var e = estado();
      if (op.hasAttribute('data-exibir-id')) e.identificador = op.getAttribute('data-exibir-id');
      else if (op.hasAttribute('data-exibir-nome')) e.nome = op.getAttribute('data-exibir-nome');
      else if (op.getAttribute('data-exibir-toggle') === 'hierarquia') e.hierarquia = !e.hierarquia;
      else return;
      salvar(e);
      marcar(menu);
      if (aoMudar) aoMudar();
    });
  }

  /* ---------- as regras da lista do efetivo (Usuários e Afastamentos) ---------- */

  /* a pessoa casa com o termo da busca? nome de guerra, nome completo, CPF ou RG */
  function casaBusca(pessoa, termo) {
    if (!termo) return false;
    var alvo = RosterWork.busca.normalizar(termo);
    if (RosterWork.busca.normalizar(pessoa.nome_de_guerra).indexOf(alvo) !== -1) return true;
    if (RosterWork.busca.normalizar(pessoa.nome_completo).indexOf(alvo) !== -1) return true;
    var digitos = termo.replace(/\D/g, '');
    if (digitos) {
      if (String(pessoa.usuario_id || '').indexOf(digitos) !== -1) return true;
      if (String(pessoa.rg || '').replace(/\D/g, '').indexOf(digitos) !== -1) return true;
    }
    return false;
  }

  /* chave alfabética conforme o Exibir (nome de guerra ou completo) */
  function chaveAlfabetica(pessoa) {
    var base = estado().nome === 'completo'
      ? (pessoa.nome_completo || pessoa.nome_de_guerra || '')
      : (pessoa.nome_de_guerra || pessoa.nome_completo || '');
    return RosterWork.busca.normalizar(base);
  }

  /* ordena a lista conforme o botão de Ordem: antiguidade (a lista já vem ordenada do banco, do mais antigo para o mais
     moderno), o inverso dela, ou alfabética pelo nome exibido nos dois sentidos */
  function ordenar(pessoas) {
    var ordem = estado().ordem;
    if (ordem === 'antiguidade') return pessoas;
    var copia = pessoas.slice();
    if (ordem === 'antiguidade-inversa') return copia.reverse();
    copia.sort(function (a, b) { return chaveAlfabetica(a).localeCompare(chaveAlfabetica(b), 'pt'); });
    if (ordem === 'za') copia.reverse();
    return copia;
  }

  /* Oficiais = QOBM/QOEBM; Praças = QPBM */
  function grupoDoQuadro(quadro) {
    return quadro === 'QPBM' ? 'Praças' : 'Oficiais';
  }

  /* a árvore de graus (Oficiais/Praças > patentes) das pessoas visíveis, na ordem de antiguidade (a lista já vem
     ordenada); só patentes presentes */
  function arvoreDeGraus(pessoas) {
    var mapa = { 'Oficiais': [], 'Praças': [] };
    var vistos = {};
    pessoas.forEach(function (p) {
      var valor = p.grau_nome;
      if (!valor || vistos[valor]) return;
      vistos[valor] = true;
      /* na tela mostramos a abreviação; o filtro casa pelo nome por extenso */
      mapa[grupoDoQuadro(p.quadro)].push({ rotulo: p.grau_abreviacao || valor, valor: valor });
    });
    var arvore = [];
    ['Oficiais', 'Praças'].forEach(function (g) {
      if (mapa[g].length) arvore.push({ rotulo: g, filhos: mapa[g] });
    });
    return arvore;
  }

  window.RosterWork.usuariosExibir = {
    ligar: ligar, ligarOrdem: ligarOrdem, estado: estado,
    casaBusca: casaBusca, ordenar: ordenar, arvoreDeGraus: arvoreDeGraus
  };
})();
