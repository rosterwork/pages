/* ============================================================
   SELETOR DE UNIDADE — componente compartilhado do celular (a Agenda
   da Escala e da Extrajornada)
   No celular a Agenda mostra uma unidade por tela. Com mais de uma
   unidade, o seletor fica na barra da página e, no celular, vira o
   menu "2ºPEL ▾" (geral-abas.js), de largura fixa, na linha dos
   ícones, à esquerda (geral-seletor-unidade.css); deslizar o dedo
   para o lado na grade troca de mês (geral-deslizar.js). As
   células das outras unidades somem (escalas-mes.css) sem refazer a
   grade, e a grade é rolada para o mesmo dia continuar no mesmo
   lugar. Começa na unidade do próprio militar (se estiver entre as da
   grade), senão na primeira, e lembra a escolhida entre os meses. O
   Calendário não usa o seletor: mostra todas as unidades no dia, como
   no computador. O seletor é o molde #tpl-seletor-unidade
   (index.html). Clona moldes; não cria HTML nem escreve estilo.
   API: RosterWork.seletorUnidade.iniciar(conteudo) · mostrar(unidades) · aplicar(wrap) e, para o Enter
   da busca: unidadeDe(el) · ordem(id) · escolhida() · escolher(id)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conteudo = null;       // o fragmento da página atual (recriado a cada visita)
  var unidades = [];         // as unidades da Agenda, na ordem do seletor ({ id, nome })
  var escolhida = null;      // id (texto) da unidade na tela

  function posicaoEscolhida() {
    for (var i = 0; i < unidades.length; i++) {
      if (String(unidades[i].id) === escolhida) return i;
    }
    return -1;
  }

  /* a unidade do próprio militar, se estiver entre as da grade; senão a primeira */
  function unidadeInicial() {
    var perfil = RosterWork.sessao && RosterWork.sessao.perfil();
    var propria = perfil && perfil.lotacao_id != null ? String(perfil.lotacao_id) : null;
    for (var i = 0; i < unidades.length; i++) {
      if (String(unidades[i].id) === propria) return propria;
    }
    return String(unidades[0].id);
  }

  /* marca a aba da escolhida (o menu do celular acompanha o seletor sozinho) */
  function marcar() {
    Array.prototype.forEach.call(conteudo.querySelectorAll('.seletor-unidade .aba'), function (aba) {
      var ativa = aba.getAttribute('data-unidade') === escolhida;
      aba.classList.toggle('aba--ativa', ativa);
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }

  /* a Agenda na tela com o seletor: a área que rola, o cabeçalho que gruda no alto dela, os dias e as
     células de cada unidade */
  function gradeComSeletor() {
    var agenda = conteudo.querySelector('.escala-mes-grade--com-seletor');
    if (!agenda) return null;
    return { area: agenda.closest('.escala-mes'), pintar: agenda, cabecalho: agenda.querySelector('.escala-mes-cabecalho'),
      linhas: '.escala-mes-linha:not(.escala-mes-cabecalho)' };
  }

  /* só as células da unidade escolhida ficam (a unidade de cada célula: data-unidade-id) */
  function esconderOutras(grade) {
    Array.prototype.forEach.call(grade.area.querySelectorAll('.escala-mes-celula'), function (celula) {
      celula.classList.toggle('escala-mes-celula--outra-unidade', celula.dataset.unidadeId !== escolhida);
    });
  }

  /* onde a grade começa a aparecer: logo abaixo do cabeçalho que gruda no alto */
  function topoVisivel(grade) {
    if (grade.cabecalho && grade.cabecalho.getClientRects().length) return grade.cabecalho.getBoundingClientRect().bottom;
    return grade.area.getBoundingClientRect().top;
  }

  /* o dia que está no alto da tela (o primeiro que ainda aparece) */
  function linhaNoTopo(grade, topo) {
    var linhas = grade.area.querySelectorAll(grade.linhas);
    for (var i = 0; i < linhas.length; i++) {
      if (linhas[i].getBoundingClientRect().bottom > topo) return linhas[i];
    }
    return null;
  }

  /* troca a unidade da tela. Cada unidade tem a sua altura por dia, então a grade é rolada para a mesma
     data continuar no alto, no mesmo ponto do dia (se o alto da tela cortava o dia na metade, continua na
     metade); os gráficos que aparecem são pintados agora */
  function escolher(id) {
    if (!id || id === escolhida) return;
    escolhida = id;
    marcar();
    var grade = gradeComSeletor();
    if (!grade || !grade.area) return;
    var topo = topoVisivel(grade);
    var linha = linhaNoTopo(grade, topo);
    var caixa = linha ? linha.getBoundingClientRect() : null;
    var fracao = (caixa && caixa.top < topo && caixa.height) ? (topo - caixa.top) / caixa.height : 0;
    var distancia = caixa ? caixa.top - topo : 0;
    esconderOutras(grade);
    if (caixa) {
      var nova = linha.getBoundingClientRect();
      grade.area.scrollTop += fracao ? (nova.top + fracao * nova.height) - topo : (nova.top - topo) - distancia;
    }
    if (RosterWork.escalasCelula) RosterWork.escalasCelula.desenharGraficos(grade.pintar);
  }

  /* as unidades da Agenda no celular; null (fora da Agenda ou fora do celular) ou uma unidade só: o seletor some */
  function mostrar(lista) {
    var seletor = conteudo && conteudo.querySelector('.seletor-unidade');
    if (!seletor) return;
    unidades = lista || [];
    if (unidades.length && posicaoEscolhida() === -1) escolhida = unidadeInicial();
    var comSeletor = unidades.length > 1;
    seletor.classList.toggle('oculto', !comSeletor);
    if (!comSeletor) return;

    seletor.textContent = '';
    unidades.forEach(function (u) {
      var aba = RosterWork.tpl('tpl-seletor-unidade-aba');
      if (!aba) return;
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', String(u.id));
      seletor.appendChild(aba);
    });
    marcar();
  }

  /* gancho aoTerminar da Agenda (antes de pintar): a coluna da unidade ocupa a tela e, com o seletor, só a
     escolhida aparece. Em outra grade (o Calendário), não faz nada */
  function aplicar(wrap) {
    var agenda = wrap && wrap.querySelector('.escala-mes-grade');
    if (!agenda) return;
    agenda.classList.add('escala-mes-grade--uma-unidade');
    if (unidades.length > 1) agenda.classList.add('escala-mes-grade--com-seletor');
    var grade = gradeComSeletor();
    if (grade) esconderOutras(grade);
  }

  /* para o Enter da busca da barra (geral-busca.js), que percorre as unidades: a unidade de um elemento da
     Agenda com o seletor (null fora dela), a posição da unidade no seletor e a unidade na tela */
  function unidadeDe(elemento) {
    var celula = elemento.closest('.escala-mes-grade--com-seletor .escala-mes-celula');
    return celula ? celula.dataset.unidadeId : null;
  }

  function ordem(id) {
    for (var i = 0; i < unidades.length; i++) {
      if (String(unidades[i].id) === id) return i;
    }
    return -1;
  }

  function unidadeNaTela() {
    return (conteudo && conteudo.isConnected && gradeComSeletor()) ? escolhida : null;
  }

  /* a página chama isto a cada visita (o fragmento é novo): o seletor entra no começo da barra, para ficar à
     esquerda da linha dos ícones */
  function iniciar(fragmento) {
    conteudo = fragmento;
    unidades = [];
    var barra = conteudo.querySelector('.pagina-subcabecalho');
    if (barra && !conteudo.querySelector('.seletor-unidade')) {
      var seletor = RosterWork.tpl('tpl-seletor-unidade');
      if (seletor) barra.insertBefore(seletor, barra.firstChild);
    }
    var trilho = conteudo.querySelector('.seletor-unidade');
    if (trilho && RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) { escolher(aba.getAttribute('data-unidade')); });
    }
  }

  window.RosterWork.seletorUnidade = { iniciar: iniciar, mostrar: mostrar, aplicar: aplicar,
    unidadeDe: unidadeDe, ordem: ordem, escolhida: unidadeNaTela, escolher: escolher };
})();
