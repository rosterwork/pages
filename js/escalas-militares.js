/* ============================================================
   ESCALAS — modo Militares (montagem da grade)
   Clona os moldes e preenche a grade com os dados de
   escalas-dados.js: uma linha-título por unidade selecionada
   (recolhe/expande) e, dentro dela, um militar por linha com a
   faixa de horário do serviço (início e fim) de cada dia da
   quinzena. Não busca no banco nem escreve estilo CSS.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var termoAtual = '';   // termo da busca (persiste entre re-renderizações e navegação)
  var reqSeq = 0;        // token de requisição: ignora resposta antiga quando outra render começou

  /* tira acentos e caixa para comparar nomes sem diferença de acentuação */


  function dataISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* domingo da semana da data (a semana vai de domingo a sábado, como no modo Semana) */
  function inicioSemana(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
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

  function mostrarCarregando(corpo) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-carregando');
    if (no) corpo.appendChild(no);
  }

  /* um chip (hora início · ícone de seta · hora fim) por período (disponibilidade
     quebrada = vários, empilhados). trocado = chip riscado (o militar saiu numa troca). */
  function montarChips(celula, periodos, trocado, extra) {
    (periodos || []).forEach(function (per) {
      if (!per.inicio) return;
      var chip = RosterWork.tpl('tpl-escala-mil-servico');
      if (!chip) return;
      if (trocado) chip.classList.add('escala-mil-servico--trocado');
      if (extra) {   // serviço de extrajornada: revela o ícone próprio + dica
        var ico = chip.querySelector('.escala-mil-servico-extra');
        if (ico) ico.classList.remove('oculto');
        chip.setAttribute('title', 'Extrajornada (hora extra)');
      }
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
    if (estado.estado === 'afastado') {
      var chip = RosterWork.tpl('tpl-escala-mil-afast');
      if (!chip) return;
      chip.textContent = estado.sigla || 'FÉR';
      if (estado.ate) chip.setAttribute('title', (estado.afastamento || 'Férias') + ' até ' + dataCurta(estado.ate));
      celula.appendChild(chip);
      return;
    }
    montarChips(celula, estado.periodos, estado.estado === 'trocado', !!estado.is_extra);
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

  function desmarcarCelula() {
    if (celulaSelecionada) { celulaSelecionada.classList.remove('escala-mil-celula--selecionada'); celulaSelecionada = null; }
  }

  /* clique numa célula: realça e abre o painel de detalhe do militar naquele dia */
  function ligarCelula(celula, militar, coluna, iso, estado) {
    celula.addEventListener('click', function () {
      if (!window.RosterWork.escalasMilitaresPainel) return;
      desmarcarCelula();
      celula.classList.add('escala-mil-celula--selecionada');
      celulaSelecionada = celula;
      RosterWork.escalasMilitaresPainel.abrir({
        cpf: militar.cpf, grad: militar.grad, nome: militar.nome,
        unidadeNome: coluna.nomeCompleto || coluna.nome, cidade: coluna.cidade,
        iso: iso, estado: estado, aoFechar: desmarcarCelula
      });
    });
  }

  /* monta o bloco de uma unidade: linha-título + militares + linha de totais */
  function montarUnidade(coluna, dadosUnidade, dias) {
    var bloco = RosterWork.tpl('tpl-escala-mil-unidade');
    if (!bloco) return null;
    bloco.querySelector('.escala-mil-unidade-nome').textContent = coluna.nomeCompleto || coluna.nome;
    var cidadeEl = bloco.querySelector('.escala-mil-unidade-cidade');
    if (cidadeEl) cidadeEl.textContent = coluna.cidade || '';

    var militares = (dadosUnidade && dadosUnidade.militares) || [];
    var corpoU = bloco.querySelector('.escala-mil-unidade-corpo');

    if (!militares.length) {
      var vazio = RosterWork.tpl('tpl-escala-estado');
      if (vazio) { vazio.textContent = 'Nenhum militar nesta unidade.'; vazio.classList.add('escala-mil-vazio'); corpoU.appendChild(vazio); }
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
      dias.forEach(function (info) {
        var cel = RosterWork.tpl('tpl-escala-mil-celula');
        var estadoDia = m.dias && m.dias[info.iso];
        preencherCelula(cel, estadoDia);
        if (info.fds) cel.classList.add('escala-mil-celula--fds');
        ligarCelula(cel, m, coluna, info.iso, estadoDia);
        linha.appendChild(cel);
      });
      corpoU.appendChild(linha);
    });

    /* totais: efetivo de serviço por dia */
    var total = RosterWork.tpl('tpl-escala-mil-total');
    dias.forEach(function (info) {
      var v = RosterWork.tpl('tpl-escala-mil-total-valor');
      var n = 0;
      militares.forEach(function (m) {
        var e = m.dias && m.dias[info.iso];
        if (e && e.estado === 'servico') n++;
      });
      v.textContent = String(n);
      total.appendChild(v);
    });
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

  /* desenha a quinzena de opcoes.dataRef para as unidades (seções) recebidas */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    /* a grade vai ser refeita (nova quinzena, troca de unidades, troca de modo): fecha o painel
       do militar para não ficar mostrando um militar/dia que a nova grade não tem mais */
    if (window.RosterWork.painel && RosterWork.painel.estaAberto()) RosterWork.painel.fechar();
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

    mostrarCarregando(corpo);

    var ids = colunas.map(function (c) { return c.id; });

    /* quinzena: 14 dias a partir do domingo da semana da referência (uma coluna por dia) */
    var domingo = inicioSemana(dataRef);
    var inicio = dataISO(domingo);
    var fim = dataISO(new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + 13));
    var hojeISO = dataISO(new Date());
    var dias = [];
    for (var d = 0; d < 14; d++) {
      var dt = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + d);
      var sem = dt.getDay();
      dias.push({ dia: dt.getDate(), iso: dataISO(dt), semana: sem, fds: (sem === 0 || sem === 6), hoje: dataISO(dt) === hojeISO });
    }

    var req = ++reqSeq;
    window.RosterWork.escalasDados.carregarMilitares(ids, inicio, fim).then(function (dados) {
      if (!document.contains(corpo) || req !== reqSeq) return;   // saiu da página, ou outra render começou
      corpo.textContent = '';
      celulaSelecionada = null;   // a grade foi refeita; a seleção antiga não existe mais

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
        cab.appendChild(cel);
      });
      grade.appendChild(cab);

      /* uma linha-título por unidade selecionada (ordem da hierarquia) */
      colunas.forEach(function (c) {
        var bloco = montarUnidade(c, dados[c.id], dias);
        if (bloco) grade.appendChild(bloco);
      });

      corpo.appendChild(wrap);
      aplicarFiltro(grade);   // reaplica a busca atual (persiste entre navegação/re-render)
      if (RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(grade, { celula: '.escala-mil-celula', linha: '.escala-mil-pessoa-linha' });
    }, function () {
      if (document.contains(corpo) && req === reqSeq) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  window.RosterWork.escalasMilitares = { renderizar: renderizar, filtrar: filtrar };
})();
