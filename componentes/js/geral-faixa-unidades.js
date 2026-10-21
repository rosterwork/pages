/* ============================================================
   FAIXA DE UNIDADES — componente compartilhado do celular (a grade
   do mês da Escala e da Extrajornada: Agenda e Calendário)
   No celular a grade do mês mostra uma unidade por tela. Com mais
   de uma unidade, a faixa entre a barra e a grade (o seletor de
   sempre, rolando para os lados) mostra a unidade da tela no meio e
   "3 de 8". Tocar num nome troca a unidade; na Agenda, deslizar o
   dedo para o lado também (no Calendário o deslizar rola a semana).
   As peças das outras unidades somem (escalas-mes.css e
   geral-faixa-unidades.css) sem refazer a grade, e a grade é rolada
   para o mesmo dia continuar no mesmo lugar. Começa na unidade do
   próprio militar (se estiver entre as da grade), senão na primeira,
   e lembra a escolhida entre os meses e entre Agenda e Calendário.
   A faixa é o molde #tpl-faixa-unidades (index.html), posto antes
   do .pagina-corpo da página. Clona moldes; não cria HTML nem
   escreve estilo (só o número de unidades por dia do calendário,
   dado da tela).
   API: RosterWork.faixaUnidades.iniciar(conteudo, { pecaCalendario }) ·
   mostrar(unidades) · aplicar(wrap). pecaCalendario = o seletor do
   bloco de uma unidade dentro do dia do Calendário (o da página).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DESLIZE_MINIMO = 48;   // quanto o dedo anda para o lado (px) para contar como deslizar

  var conteudo = null;       // o fragmento da página atual (recriado a cada visita)
  var pecaCalendario = null; // o bloco de uma unidade no dia do Calendário (seletor da página)
  var unidades = [];         // as unidades do Mês, na ordem da faixa ({ id, nome })
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

  /* deixa a escolhida no meio da faixa */
  function centralizar(suave) {
    var trilho = conteudo.querySelector('.faixa-unidades-trilho');
    var ativa = conteudo.querySelector('.faixa-unidades-abas .aba--ativa');
    if (!trilho || !ativa) return;
    var caixaTrilho = trilho.getBoundingClientRect();
    var caixaAtiva = ativa.getBoundingClientRect();
    var esquerda = trilho.scrollLeft + (caixaAtiva.left + caixaAtiva.width / 2) - (caixaTrilho.left + caixaTrilho.width / 2);
    trilho.scrollTo({ left: esquerda, behavior: suave ? 'smooth' : 'auto' });
  }

  /* marca a aba da escolhida e o "N de M" */
  function marcarFaixa() {
    Array.prototype.forEach.call(conteudo.querySelectorAll('.faixa-unidades-abas .aba'), function (aba) {
      var ativa = aba.getAttribute('data-unidade') === escolhida;
      aba.classList.toggle('aba--ativa', ativa);
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    var posicao = conteudo.querySelector('.faixa-unidades-posicao');
    if (posicao) posicao.textContent = String(posicaoEscolhida() + 1);
  }

  /* a grade na tela com a faixa: a área que rola, o cabeçalho que gruda no alto dela, as linhas
     (dias da Agenda, semanas do Calendário) e as peças de cada unidade (a célula da Agenda, o bloco do
     dia do Calendário) */
  function gradeComFaixa() {
    var agenda = conteudo.querySelector('.escala-mes-grade--com-faixa');
    if (agenda) {
      return { area: agenda.closest('.escala-mes'), pintar: agenda, cabecalho: agenda.querySelector('.escala-mes-cabecalho'),
        linhas: '.escala-mes-linha:not(.escala-mes-cabecalho)', pecas: '.escala-mes-celula', classe: 'escala-mes-celula--outra-unidade' };
    }
    var calendario = conteudo.querySelector('.faixa-unidades-calendario');
    if (calendario && pecaCalendario) {
      return { area: calendario, pintar: calendario, cabecalho: calendario.querySelector('.geral-calendario-mes-cabecalho'),
        linhas: '.geral-calendario-mes-semana', pecas: pecaCalendario, classe: 'faixa-unidades-outra' };
    }
    return null;
  }

  /* só as peças da unidade escolhida ficam (a unidade de cada peça vem da célula: data-unidade-id) */
  function esconderOutras(grade) {
    Array.prototype.forEach.call(grade.area.querySelectorAll(grade.pecas), function (peca) {
      var celula = peca.matches('.escala-mes-celula') ? peca : peca.querySelector('.escala-mes-celula');
      peca.classList.toggle(grade.classe, !celula || celula.dataset.unidadeId !== escolhida);
    });
  }

  /* onde a grade começa a aparecer: logo abaixo do cabeçalho que gruda no alto */
  function topoVisivel(grade) {
    if (grade.cabecalho && grade.cabecalho.getClientRects().length) return grade.cabecalho.getBoundingClientRect().bottom;
    return grade.area.getBoundingClientRect().top;
  }

  /* a linha que está no alto da tela (a primeira que ainda aparece) */
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
    marcarFaixa();
    centralizar(true);
    var grade = gradeComFaixa();
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

  /* as unidades da grade no celular; null (fora da grade do mês ou fora do celular) ou uma unidade só: a faixa some */
  function mostrar(lista) {
    var faixa = conteudo && conteudo.querySelector('.faixa-unidades');
    if (!faixa) return;
    unidades = lista || [];
    if (unidades.length && posicaoEscolhida() === -1) escolhida = unidadeInicial();
    var comFaixa = unidades.length > 1;
    faixa.classList.toggle('oculto', !comFaixa);
    if (!comFaixa) return;

    var trilho = conteudo.querySelector('.faixa-unidades-abas');
    trilho.textContent = '';
    unidades.forEach(function (u) {
      var aba = RosterWork.tpl('tpl-faixa-unidades-aba');
      if (!aba) return;
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', String(u.id));
      trilho.appendChild(aba);
    });
    var total = conteudo.querySelector('.faixa-unidades-total');
    if (total) total.textContent = String(unidades.length);
    marcarFaixa();
    centralizar(false);
  }

  /* gancho aoTerminar da Agenda e do Calendário (antes de pintar). Agenda: a coluna da unidade ocupa a
     tela e, com a faixa, só a escolhida aparece. Calendário: com a faixa, cada dia fica com o bloco da
     escolhida (um bloco por dia: o número de unidades por dia do calendário passa a 1) */
  function aplicar(wrap) {
    if (!wrap) return;
    var agenda = wrap.querySelector('.escala-mes-grade');
    if (agenda) {
      agenda.classList.add('escala-mes-grade--uma-unidade');
      if (unidades.length > 1) agenda.classList.add('escala-mes-grade--com-faixa');
    } else if (wrap.classList.contains('geral-calendario-mes') && unidades.length > 1) {
      wrap.classList.add('faixa-unidades-calendario');
      wrap.style.setProperty('--calendario-unidades', '1');
    }
    var grade = gradeComFaixa();
    if (grade) esconderOutras(grade);
  }

  /* na Agenda, deslizar o dedo para o lado troca para a unidade vizinha (para a esquerda, a próxima);
     o movimento precisa ser mais para o lado que para baixo, senão é a rolagem. Ligado uma vez por corpo */
  function ligarDeslize(corpo) {
    if (!corpo || corpo.dataset.deslizeLigado) return;
    corpo.dataset.deslizeLigado = '1';
    var inicioX = null;
    var inicioY = 0;
    corpo.addEventListener('touchstart', function (evento) {
      inicioX = null;
      if (evento.touches.length !== 1 || !evento.target.closest('.escala-mes-grade--com-faixa')) return;
      inicioX = evento.touches[0].clientX;
      inicioY = evento.touches[0].clientY;
    }, { passive: true });
    corpo.addEventListener('touchcancel', function () { inicioX = null; }, { passive: true });
    corpo.addEventListener('touchend', function (evento) {
      if (inicioX === null) return;
      var toque = evento.changedTouches[0];
      var andouX = toque.clientX - inicioX;
      var andouY = toque.clientY - inicioY;
      inicioX = null;
      if (Math.abs(andouX) < DESLIZE_MINIMO || Math.abs(andouX) < 2 * Math.abs(andouY)) return;
      var vizinha = unidades[posicaoEscolhida() + (andouX < 0 ? 1 : -1)];
      if (vizinha) escolher(String(vizinha.id));
    }, { passive: true });
  }

  /* a página chama isto a cada visita (o fragmento é novo): a faixa entra antes do .pagina-corpo */
  function iniciar(fragmento, opcoes) {
    conteudo = fragmento;
    pecaCalendario = (opcoes && opcoes.pecaCalendario) || null;
    unidades = [];
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (corpo && !conteudo.querySelector('.faixa-unidades')) {
      var faixa = RosterWork.tpl('tpl-faixa-unidades');
      if (faixa) corpo.parentNode.insertBefore(faixa, corpo);
    }
    var trilho = conteudo.querySelector('.faixa-unidades-abas');
    if (trilho && RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) { escolher(aba.getAttribute('data-unidade')); });
    }
    ligarDeslize(conteudo.querySelector('.pagina-corpo'));
  }

  window.RosterWork.faixaUnidades = { iniciar: iniciar, mostrar: mostrar, aplicar: aplicar };
})();
