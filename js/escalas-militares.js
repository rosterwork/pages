/* ============================================================
   ESCALAS — modo Militares (montagem da grade)
   Clona os moldes e preenche a grade com os dados de
   escalas-dados.js: uma linha-título por unidade selecionada
   (recolhe/expande) e, dentro dela, um militar por linha com a
   faixa de horário do serviço (início e fim) de cada dia do
   mês. Na página Estágios, a mesma grade só com quem participa
   dos estágios em vigor, um bloco por estágio; o dia sem nada abre,
   para quem administra, o Adicionar militar do painel do dia, já
   com ele. Na página Sobreaviso, a mesma grade com a fila e
   os dias de sobreaviso (escalas-militares-sobreaviso.js). O selo
   dos dias de cada militar, o efetivo de cada dia e o filtro ficam
   no escalas-militares-dias.js. Não busca no banco nem escreve
   estilo CSS.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var termoAtual = '';   // termo da busca (persiste entre re-renderizações e navegação)
  var reqSeq = 0;        // token de requisição: ignora resposta antiga quando outra render começou
  var sobreaviso = false; // a grade é a da página Sobreaviso (escalas-militares-sobreaviso.js)

  /* tira acentos e caixa para comparar nomes sem diferença de acentuação */


  function dataISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* "08:00" -> "08" (só a hora cheia, sem o "h") */
  function soHoraNum(t) { return t ? t.split(':')[0] : ''; }

  /* iniciais do avatar: 2 primeiras letras do nome de guerra (mesmo padrão do cabeçalho) */
  function iniciais(nome) {
    return String(nome || '').slice(0, 2).toUpperCase();
  }

  /* "12345678901" -> "123.456.789-01" (mesmo formato dos cards de Usuários) */
  function formatarCpf(cpf) {
    var s = String(cpf || '');
    if (s.length !== 11) return s;
    return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /* "2026-06-14" -> "14/06" (data-limite do afastamento) */
  function dataCurta(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '';
  }

  function mostrarEstado(corpo, texto) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-estado');
    if (!no) return;
    no.textContent = texto;
    corpo.appendChild(no);
  }

  /* um chip (ícone da origem · hora início · ícone de seta · hora fim) por período (disponibilidade
     quebrada = vários, empilhados). trocado = chip riscado (o militar saiu numa troca). estagio = o dia
     de estágio do militar */
  function montarChips(celula, periodos, trocado, extra, estagio) {
    var C = RosterWork.escalasCelula;
    (periodos || []).forEach(function (per) {
      if (!per.inicio) return;
      var chip = RosterWork.tpl('tpl-escala-mil-servico');
      if (!chip) return;
      if (trocado) chip.classList.add('escala-mil-servico--trocado');
      /* o ícone da origem em todo horário, o mesmo do Mês e da Legenda (escalas-celula.js): cada horário traz a
         origem dele (sem ela, a extra pelo horário e o resto pela guarnição); o trocado, o da troca */
      var ehExtra = per.extra !== undefined ? per.extra : extra;
      var origem = trocado ? 'troca_saida' : (per.origem || (ehExtra ? 'extra' : 'sistema'));
      var ico = chip.querySelector('.escala-mil-servico-origem');
      if (ico && C) {
        ico.querySelector('use').setAttribute('href', 'icones/todos.svg#' + C.iconeDaOrigem(C.origemDoIcone({ origem: origem, estagio: estagio })));
        ico.classList.remove('oculto');
      }
      /* a situação do horário para o filtro, a mesma do Mês (escalas-militares-dias.js) */
      if (C) chip.setAttribute('data-situacao', C.situacao({ origem: origem, estagio: estagio }));
      if (ehExtra) chip.setAttribute('title', 'Extrajornada (hora extra)');
      chip.querySelector('.linha-escalado-hora-ini').textContent = soHoraNum(per.inicio);
      var fimEl = chip.querySelector('.linha-escalado-hora-fim');
      var setaEl = chip.querySelector('.linha-escalado-hora-seta');
      if (per.fim) { fimEl.textContent = soHoraNum(per.fim); }
      else { if (fimEl) fimEl.classList.add('oculto'); if (setaEl) setaEl.classList.add('oculto'); }
      celula.appendChild(chip);
    });
  }

  /* preenche uma célula (militar × dia): folga = vazio; afastado = chip;
     serviço = faixas; trocado = faixas riscadas (saiu numa troca, dia inteiro) */
  function preencherCelula(celula, estado) {
    if (!estado) return;   // folga: célula vazia
    if (estado.estado === 'sobreaviso') { RosterWork.escalasMilitaresSobreaviso.chips(celula, estado.periodos); return; }
    if (estado.estado === 'afastado') {
      var chip = RosterWork.tpl('tpl-escala-mil-afast');
      if (!chip) return;
      chip.textContent = estado.sigla || 'FÉR';
      /* a dica: o afastamento (na missão, o nome dela) até a data */
      if (estado.ate) chip.setAttribute('data-dica', (estado.afastamento || 'Férias') + ' até ' + dataCurta(estado.ate));
      chip.setAttribute('data-situacao', estado.missao ? 'missao' : 'afastamento');   // para o filtro
      celula.appendChild(chip);
      return;
    }
    montarChips(celula, estado.periodos, estado.estado === 'trocado', !!estado.is_extra, !!estado.estagio);
  }

  /* liga o clique do título (botão da 1ª coluna) para recolher/expandir os militares da unidade */
  function ligarRecolher(bloco) {
    var botao = bloco.querySelector('.escala-mil-unidade-cab');
    if (!botao) return;
    botao.addEventListener('click', function () {
      var aberto = botao.getAttribute('aria-expanded') !== 'false';
      botao.setAttribute('aria-expanded', aberto ? 'false' : 'true');
      bloco.classList.toggle('escala-mil-unidade--recolhido', aberto);
    });
  }

  var celulaSelecionada = null;
  var abrirDepois = null;    // o militar ({ cpf, iso }) a abrir quando a grade voltar do gravado (o Descartar)
  var abrirNaGrade = null;   // o mesmo, na grade que está sendo desenhada

  function desmarcarCelula() {
    if (celulaSelecionada) { celulaSelecionada.classList.remove('escala-mil-celula--selecionada'); celulaSelecionada = null; }
  }

  /* clique numa célula: realça e abre o painel de detalhe do militar naquele dia. Na aba Estagiários (aba.estagiarios),
     o dia sem nada, para quem administra a unidade, abre o painel do dia no Adicionar militar, já com ele */
  function ligarCelula(celula, militar, coluna, iso, estado, aba) {
    function adicionar() {
      desmarcarCelula();
      RosterWork.escalasPainel.abrirDia({ unidadeId: coluna.id, iso: iso, unidadeNome: coluna.nomeCompleto || coluna.nome,
        unidadeCidade: coluna.cidade }, 'distribuicao', { adicionar: militar.cpf });
    }
    function abrir() {
      desmarcarCelula();
      celula.classList.add('escala-mil-celula--selecionada');
      celulaSelecionada = celula;
      RosterWork.escalasMilitaresPainel.abrir({
        cpf: militar.cpf, grad: militar.grad, nome: militar.nome,
        unidadeNome: coluna.nomeCompleto || coluna.nome, cidade: coluna.cidade,
        iso: iso, estado: estado, aoFechar: desmarcarCelula
      });
      /* a busca esconde a linha do militar que não casa: o painel dele fecha (geral-painel) */
      if (RosterWork.painel) RosterWork.painel.acompanharTela(function () { return celula.isConnected && celula.getClientRects().length > 0; });
    }
    celula.addEventListener('click', function () {
      if (sobreaviso) { RosterWork.escalasMilitaresSobreaviso.clique(celula, militar, coluna, iso, estado); return; }
      if (aba && aba.estagiarios && !estado && RosterWork.escalasPainel && RosterWork.sessao.podeAdministrar('pelotao', coluna.id)) {
        adicionar();
        return;
      }
      if (!window.RosterWork.escalasMilitaresPainel) return;
      /* com mudança esperando o Salvar no painel do dia: a mesma pergunta de trocar de dia. Descartou: a grade lê o
         gravado de novo e o militar abre nela (esta célula ainda mostra a mudança) */
      if (!RosterWork.escalasPainel || !RosterWork.escalasPainel.antesDeSair) { abrir(); return; }
      RosterWork.escalasPainel.antesDeSair(function (descartou) {
        if (descartou) abrirDepois = { cpf: militar.cpf, iso: iso };
        else abrir();
      });
    });
    /* a grade voltou do gravado depois do Descartar: o militar escolhido abre */
    if (abrirNaGrade && abrirNaGrade.cpf === militar.cpf && abrirNaGrade.iso === iso && window.RosterWork.escalasMilitaresPainel) {
      abrirNaGrade = null;
      abrir();
    }
  }

  /* monta o bloco de uma unidade: linha-título + militares + linha de totais. Na aba Estagiários (aba.estagiarios), um
     bloco por estágio: o nome do estágio e, ao lado, a unidade */
  function montarUnidade(coluna, dadosUnidade, dias, aba) {
    var bloco = RosterWork.tpl('tpl-escala-mil-unidade');
    if (!bloco) return null;
    bloco.querySelector('.escala-mil-unidade-nome').textContent = aba ? aba.titulo : (coluna.nomeCompleto || coluna.nome);
    var cidadeEl = bloco.querySelector('.escala-mil-unidade-cidade');
    if (cidadeEl) cidadeEl.textContent = aba ? (coluna.nome || '') : (coluna.cidade || '');
    bloco.dataset.unidadeId = coluna.id;

    var militares = (dadosUnidade && dadosUnidade.militares) || [];
    var corpoU = bloco.querySelector('.escala-mil-unidade-corpo');

    if (!militares.length) {
      var vazio = RosterWork.tpl('tpl-escala-estado');
      if (vazio) {
        vazio.textContent = aba ? RosterWork.mensagens.escala.estagiarios.semEstagiario : 'Nenhum militar nesta unidade.';
        vazio.classList.add('escala-mil-vazio');
        corpoU.appendChild(vazio);
      }
      ligarRecolher(bloco);
      return bloco;
    }

    militares.forEach(function (m) {
      var linha = RosterWork.tpl('tpl-escala-mil-pessoa');
      linha.querySelector('.escala-mil-avatar').textContent = iniciais(m.nome);
      linha.querySelector('.escala-mil-pessoa-grad').textContent = m.grad || '';
      linha.querySelector('.escala-mil-pessoa-nome').textContent = m.nome || '';
      linha.querySelector('.escala-mil-pessoa-cpf').textContent = formatarCpf(m.cpf);
      linha.setAttribute('data-busca', RosterWork.busca.normalizar((m.grad || '') + ' ' + (m.nome || '')));
      linha.dataset.cpf = m.cpf;
      dias.forEach(function (info) {
        var cel = RosterWork.tpl('tpl-escala-mil-celula');
        var estadoDia = m.dias && m.dias[info.iso];
        preencherCelula(cel, estadoDia);
        if (info.fds) cel.classList.add('escala-mil-celula--fds');
        cel.dataset.iso = info.iso;
        ligarCelula(cel, m, coluna, info.iso, estadoDia, aba);
        linha.appendChild(cel);
      });
      corpoU.appendChild(linha);
    });

    /* totais: efetivo de serviço por dia (o número vem do escalas-militares-dias.js, pelo filtro) */
    var total = RosterWork.tpl('tpl-escala-mil-total');
    dias.forEach(function () { total.appendChild(RosterWork.tpl('tpl-escala-mil-total-valor')); });
    corpoU.appendChild(total);

    ligarRecolher(bloco);
    return bloco;
  }

  /* mostra/esconde o aviso "nenhum militar encontrado" no fim da grade */
  function mensagemSemBusca(grade, mostrar) {
    var el = grade.querySelector('.escala-mil-sem-busca');
    if (mostrar && !el) {
      el = RosterWork.tpl('tpl-escala-estado');
      if (!el) return;
      el.textContent = 'Nenhum militar encontrado.';
      el.classList.add('escala-mil-vazio', 'escala-mil-sem-busca');
      grade.appendChild(el);
    } else if (!mostrar && el) {
      el.remove();
    }
  }

  /* aplica o termo atual à grade: esconde militares que não casam, esconde a unidade
     inteira quando nenhum casa, e revela as recolhidas enquanto há busca */
  function aplicarFiltro(grade) {
    if (!grade) return;
    var termo = RosterWork.busca.normalizar(termoAtual);
    grade.classList.toggle('escala-mil-grade--filtrando', termo !== '');
    var totalVisiveis = 0;
    var blocos = grade.querySelectorAll('.escala-mil-unidade');
    for (var i = 0; i < blocos.length; i++) {
      var bloco = blocos[i];
      var linhas = bloco.querySelectorAll('.escala-mil-pessoa-linha');
      var visiveis = 0;
      for (var j = 0; j < linhas.length; j++) {
        var casa = !termo || (linhas[j].getAttribute('data-busca') || '').indexOf(termo) !== -1;
        linhas[j].classList.toggle('oculto', !casa);
        linhas[j].classList.toggle('busca-achado', !!termo && casa);   // o que o Enter da busca percorre (geral-busca.js)
        if (casa) visiveis++;
      }
      bloco.classList.toggle('oculto', !!termo && visiveis === 0);
      if (!(termo && visiveis === 0)) totalVisiveis += visiveis;
    }
    mensagemSemBusca(grade, !!termo && totalVisiveis === 0);
  }

  /* chamado pela busca do sub-cabeçalho (escalas.js); guarda o termo e reaplica */
  function filtrar(termo) {
    termoAtual = termo || '';
    aplicarFiltro(document.querySelector('.escala-mil-grade'));
  }

  /* o mês da referência: do dia 1 ao último dia (uma coluna por dia) */
  function diasDoMes(dataRef) {
    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var total = new Date(ano, mes + 1, 0).getDate();
    var hojeISO = dataISO(new Date());
    var dias = [];
    for (var d = 1; d <= total; d++) {
      var dt = new Date(ano, mes, d);
      var sem = dt.getDay();
      dias.push({ dia: d, iso: dataISO(dt), semana: sem, fds: (sem === 0 || sem === 6), hoje: dataISO(dt) === hojeISO });
    }
    return dias;
  }

  /* desenha o mês de opcoes.dataRef para as unidades (seções) recebidas */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    /* a grade vai ser refeita (outro mês, troca de unidades, troca de modo): fecha o painel
       do militar para não ficar mostrando um militar/dia que a nova grade não tem mais. O painel
       do dia (aberto no Mês, com o rascunho esperando o Salvar) continua aberto */
    var painelDoDia = window.RosterWork.escalasPainel && RosterWork.escalasPainel.contexto();
    if (window.RosterWork.painel && RosterWork.painel.estaAberto() && !painelDoDia) RosterWork.painel.fechar();
    var colunas = (opcoes && opcoes.colunas) || [];
    var dataRef = (opcoes && opcoes.dataRef) || new Date();

    if (!colunas.length) {
      mostrarEstado(corpo, 'Selecione uma companhia ou pelotão no seletor de unidades.');
      return;
    }
    if (!window.RosterWork.escalasDados) {
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
      return;
    }

    var ids = colunas.map(function (c) { return c.id; });

    var dias = diasDoMes(dataRef);
    var inicio = dias[0].iso;
    var fim = dias[dias.length - 1].iso;

    /* o mesmo mês lido de novo: a grade fica até a nova chegar, na mesma rolagem (escalas-dia-na-grade.js) */
    var Dia = window.RosterWork.escalasDiaNaGrade;
    var estagiarios = !!(opcoes && opcoes.estagiarios);
    sobreaviso = !!(opcoes && opcoes.sobreaviso);
    var chaveGrade = (sobreaviso ? 'sobreaviso|' : estagiarios ? 'estagiarios|' : 'militares|') + inicio + '|' + ids.join(',');
    var rolagem = Dia ? Dia.mesmaGrade(corpo, chaveGrade) : null;
    /* outro mês: o que está na tela fica 0,5 s; depois, a forma da nova, que fica o mínimo na tela (escalas-esqueleto.js) */
    var Esqueleto = window.RosterWork.escalasEsqueleto;
    var esperaDaGrade = rolagem ? null : Esqueleto.comecar(corpo, {
      forma: function (lugar) { Esqueleto.militares(lugar, colunas, dias); },
      etapas: 'escalaMilitares'
    });

    var req = ++reqSeq;
    return Esqueleto.segurar(esperaDaGrade, (sobreaviso ? RosterWork.escalasMilitaresSobreaviso.ler(ids, inicio, fim)
      : window.RosterWork.escalasDados.carregarMilitares(ids, inicio, fim, estagiarios))).then(function (dados) {
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;   // saiu da página, outra render começou, ou trocou de modo
      Esqueleto.parar();
      corpo.textContent = '';
      celulaSelecionada = null;   // a grade foi refeita; a seleção antiga não existe mais
      abrirNaGrade = abrirDepois;
      abrirDepois = null;
      /* a aba Estagiários sem estágio em vigor no mês */
      var estagiosDe = function (c) { return ((dados[c.id] || {}).estagios) || []; };
      if (estagiarios && !colunas.some(function (c) { return estagiosDe(c).length; })) {
        mostrarEstado(corpo, RosterWork.mensagens.escala.estagiarios.nenhum);
        return;
      }

      var wrap = RosterWork.tpl('tpl-escala-mil');
      var grade = wrap.querySelector('.escala-mil-grade');

      /* cabeçalho: canto vazio + cada dia */
      var cab = RosterWork.tpl('tpl-escala-mil-cabecalho');
      dias.forEach(function (info) {
        var cel = RosterWork.tpl('tpl-escala-mil-dia');
        cel.querySelector('.escala-mil-dia-semana').textContent = DIAS_ABREV[info.semana];
        cel.querySelector('.escala-mil-dia-numero').textContent = String(info.dia);
        if (info.fds) cel.classList.add('escala-mil-dia--fds');
        if (info.hoje) cel.classList.add('escala-mil-dia--hoje');
        cel.dataset.iso = info.iso;
        /* o dia com mudança do painel do dia ainda não salva, em alguma das unidades: a borda tracejada */
        var S = RosterWork.escalasPainelSalvar;
        if (S && colunas.some(function (c) { return S.marcado(c.id, info.iso); })) cel.classList.add('escala-mil-dia--nao-salvo');
        cab.appendChild(cel);
      });
      grade.appendChild(cab);

      /* uma linha-título por unidade selecionada (ordem da hierarquia); na aba Estagiários, por estágio de cada unidade */
      colunas.forEach(function (c) {
        if (estagiarios) {
          estagiosDe(c).forEach(function (e) {
            var deles = ((dados[c.id] || {}).militares || []).filter(function (m) { return m.estagio_id === e.id; });
            var blocoE = montarUnidade(c, { militares: deles }, dias, { estagiarios: true, titulo: e.nome });
            if (blocoE) grade.appendChild(blocoE);
          });
          return;
        }
        if (sobreaviso && !((dados[c.id] || {}).militares || []).length) return;   // a unidade sem ninguém na fila
        var bloco = montarUnidade(c, dados[c.id], dias);
        if (bloco) grade.appendChild(bloco);
      });

      if (sobreaviso && !grade.querySelector('.escala-mil-unidade')) { mostrarEstado(corpo, RosterWork.mensagens.escala.sobreaviso.paginaVazia); return; }
      RosterWork.escalasMilitaresDias.aplicar(grade);   // o filtro, o selo dos dias e o efetivo, antes de aparecer
      corpo.appendChild(wrap);
      /* a sombra da coluna dos nomes: só com a grade rolada para o lado, quando os dias passam por baixo dela */
      var marcarRolada = function () { wrap.classList.toggle('escala-mil--rolada', wrap.scrollLeft > 0); };
      wrap.addEventListener('scroll', marcarRolada, { passive: true });
      aplicarFiltro(grade);   // reaplica a busca atual (persiste entre navegação/re-render)
      if (RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(grade, { celula: '.escala-mil-celula', linha: '.escala-mil-pessoa-linha' });
      if (Dia) Dia.desenhou(corpo, chaveGrade, wrap, rolagem);
      /* rolarHoje: quando o mês não cabe na largura, abre com hoje à vista e a ponta dos dias antes à esquerda
         (geral-periodo.js) */
      var diaHoje = opcoes.rolarHoje && !rolagem ? cab.querySelector('.escala-mil-dia--hoje') : null;
      if (diaHoje && RosterWork.periodo) {
        var diasAntes = null;
        var vizinho = diaHoje.previousElementSibling;
        for (var k = 0; k < 2 && vizinho && vizinho.classList.contains('escala-mil-dia'); k++) {
          diasAntes = vizinho;
          vizinho = vizinho.previousElementSibling;
        }
        RosterWork.periodo.rolarAteHoje(wrap, diaHoje, diasAntes, { horizontal: true, fixo: cab.querySelector('.escala-mil-canto') });
      }
      marcarRolada();   // a grade já pode abrir rolada (em hoje ou na rolagem de antes)
    }, function () {
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;
      Esqueleto.parar();
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  window.RosterWork.escalasMilitares = { renderizar: renderizar, filtrar: filtrar, diasDoMes: diasDoMes };
})();
