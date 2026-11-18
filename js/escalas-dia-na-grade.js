/* ============================================================
   ESCALAS — um dia só na grade
   Uma mudança no Dia do painel muda um dia: a grade fica na tela e só
   aquele dia é lido de novo, na prévia do rascunho e depois do Salvar.
   A célula da unidade editada fica apagada, com a barra no lugar do
   gráfico; as outras colunas do dia mudam junto, sem aviso (um
   remanejamento mexe em duas unidades). Se o dia passar do maior
   número de militares da unidade no período, o período todo é lido de
   novo, para o gráfico não ficar errado.
   Também cuida da grade que fica na tela enquanto o mesmo período é
   lido de novo (o Salvar do Ciclo, a prévia da Extrajornada): cada
   modo pergunta mesmaGrade antes de ler e chama desenhou depois.
   Quem entra pelo Adicionar neste dia da célula aparece na hora, no
   grupo dos pontuais (porNova), até a leitura do dia chegar com ele.
   API: RosterWork.escalasDiaNaGrade.{ temCelulas, refazendo, parou,
   previa, salvou, relerPeriodo, mesmaGrade, desenhou, porNova, tirarNova,
   semMudanca, unidadesDoDia }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var AREAS = '.escala-mes, .geral-calendario-mes, .escala-colunas, .escala-mil';
  var LIMITE_MS = 5000;   // quem espera a tela ler segue depois disso; a tela termina sozinha
  var pedidos = {};       // por dia: só a leitura mais nova desenha (latest-wins)
  var lendo = {};         // por dia: a prévia que ainda vem

  function corpoDaGrade() { return document.querySelector('.conteudo .pagina-corpo'); }

  /* a grade na tela tem célula por dia? (o Militares e a Minha escala não têm) */
  function temCelulas() {
    var corpo = corpoDaGrade();
    return !!(corpo && corpo.querySelector('.escala-mes-celula[data-iso]'));
  }

  function celulasDoDia(iso) {
    var corpo = corpoDaGrade();
    return corpo ? Array.prototype.slice.call(corpo.querySelectorAll('.escala-mes-celula[data-iso="' + iso + '"]')) : [];
  }

  function celulaDe(unidadeId, iso) {
    var corpo = corpoDaGrade();
    return corpo ? corpo.querySelector('.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]') : null;
  }

  function unidadesDe(celulas) {
    return celulas.map(function (c) { return c.dataset.unidadeId; }).filter(function (id, i, lista) { return lista.indexOf(id) === i; });
  }

  /* as unidades da grade à vista no dia (a prévia do painel do dia já traz a grade dele junto; escalas-dados.js) */
  function unidadesDoDia(iso) { return unidadesDe(celulasDoDia(iso)).map(Number); }

  /* ---------- a célula que está sendo refeita ---------- */

  /* também na célula refeita por uma leitura de antes da última mudança (a barra volta, e a próxima leitura tira) */
  function marcarCelula(celula) {
    if (!celula) return;
    celula.classList.remove('escala-mes-celula--pronta');
    celula.classList.add('escala-mes-celula--refazendo');
    if (!celula.querySelector('.escala-mes-celula-viva')) celula.appendChild(RosterWork.tpl('tpl-escala-mes-celula-viva'));
  }

  function tirarMarca(celula) {
    if (!celula) return;
    celula.classList.remove('escala-mes-celula--refazendo');
    var viva = celula.querySelector('.escala-mes-celula-viva');
    if (viva) viva.remove();
  }

  function refazendo(unidadeId, iso) { marcarCelula(celulaDe(unidadeId, iso)); }
  function parou(unidadeId, iso) { tirarMarca(celulaDe(unidadeId, iso)); }
  /* o rascunho voltou ao que a tela mostra antes de a prévia ser pedida: a espera sai, se nenhuma prévia do dia ainda vem */
  function semMudanca(unidadeId, iso) { if (!lendo[iso]) parou(unidadeId, iso); }

  /* o dia que acabou de ficar pronto acende verde e volta sozinho à cor de sempre */
  function acender(celula) {
    celula.classList.remove('escala-mes-celula--pronta');
    void celula.offsetWidth;   // para a animação recomeçar, se o dia acendeu há pouco
    celula.classList.add('escala-mes-celula--pronta');
    celula.addEventListener('animationend', function () { celula.classList.remove('escala-mes-celula--pronta'); }, { once: true });
  }

  /* ---------- quem acabou de entrar (o Adicionar neste dia da célula) ---------- */

  /* os grupos da célula que vêm depois do dos pontuais (a ordem do banco, escalas-celula-grupos.js) */
  var DEPOIS_DO_PONTUAL = ['remanejado', 'extra', 'estagio', 'sobreaviso', 'fora'];
  /* as linhas dele que ficam: as riscadas e a do Fora da escala (a caixa aberta nela segue a linha nova quando o dia chega) */
  var FICAM = '.linha-escalado--folga, .linha-escalado--trocado, .linha-escalado--remanejado, .linha-escalado--mudou-dia, '
    + '.linha-escalado--saiu, .linha-escalado--afastamento, .linha-escalado--fora, .linha-escalado--fora-vermelho, .linha-escalado--fora-aviso';

  /* tira do bloco do dia a linha de serviço dele (e o grupo que fica vazio) */
  function tirarNova(unidadeId, iso, cpf) {
    var celula = celulaDe(unidadeId, iso);
    if (!celula) return;
    [].forEach.call(celula.querySelectorAll('.linha-escalado[data-cpf="' + cpf + '"]'), function (linha) {
      if (linha.matches(FICAM)) return;
      var grupo = linha.parentNode;
      linha.remove();
      if (grupo && grupo.classList.contains('escala-grupo') && !grupo.querySelector('.linha-escalado')) grupo.remove();
    });
  }

  /* a linha de quem entrou, na hora, no grupo dos pontuais, antes de o dia chegar com ele (a leitura refaz a célula):
     p = a pessoa como a leitura do mês manda ({ cpf, grad, nome, rg, periodos: [{ inicio, fim }] }) */
  function porNova(unidadeId, iso, p) {
    var celula = celulaDe(unidadeId, iso);
    if (!celula || !RosterWork.escalasCelula || !RosterWork.escalasCelulaGrupos) return;
    tirarNova(unidadeId, iso, p.cpf);
    var Cal = RosterWork.escalasCalendario;
    var curto = !!celula.closest('.geral-calendario-mes') && !!(Cal && Cal.opcoesCelula && Cal.opcoesCelula().postoCurto);
    var linha = RosterWork.escalasCelula.montarPessoa(Object.assign({ grupo: 'pontual', origem: 'pontual' }, p), curto, null);
    if (!linha) return;
    linha.classList.add('linha-escalado--nova');
    var grupo = celula.querySelector('.escala-grupo[data-grupo="pontual"]');
    if (!grupo) {
      grupo = RosterWork.escalasCelulaGrupos.caixa('pontual');
      if (!grupo) return;
      var depois = [].filter.call(celula.children, function (g) {
        return g.classList.contains('escala-grupo') && DEPOIS_DO_PONTUAL.indexOf(g.getAttribute('data-grupo')) >= 0;
      })[0];
      celula.insertBefore(grupo, depois || null);
    }
    grupo.appendChild(linha);
  }

  /* ---------- a régua do gráfico ---------- */

  function maiorDe(lista) {
    return (lista || []).reduce(function (a, b) { return Math.max(a, Number(b) || 0); }, 0);
  }

  /* o maior número de militares da unidade nos outros dias da grade */
  function maiorDosOutrosDias(unidadeId, iso) {
    var maior = 0;
    corpoDaGrade().querySelectorAll('.escala-mes-celula[data-unidade-id="' + unidadeId + '"]:not([data-iso="' + iso + '"]) .escala-mes-grafico').forEach(function (grafico) {
      maior = Math.max(maior, maiorDe((grafico.dataset.cob || '').split(',')));
    });
    return maior;
  }

  /* a régua do gráfico é o maior número de militares da unidade no período: este dia passou dela? com tambemQueda, também
     se ela baixou, porque este dia era o único no topo (a prévia não relê por isso: só o Salvar) */
  function reguaMudou(celulas, r, iso, tambemQueda) {
    return celulas.some(function (celula) {
      var id = celula.dataset.unidadeId;
      var grafico = celula.querySelector('.escala-mes-grafico');
      var regua = grafico ? Number(grafico.dataset.max) : 0;
      var agora = maiorDe(r.cobertura[id] && r.cobertura[id][iso]);
      if (agora > regua) return true;
      return !!tambemQueda && Math.max(agora, maiorDosOutrosDias(id, iso)) < regua;
    });
  }

  /* lê o período de novo, com a grade na tela; a promessa se cumpre com a grade nova */
  function relerPeriodo() {
    return new Promise(function (pronto) {
      var limite = setTimeout(pronto, LIMITE_MS);
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar', {
        detail: { aoTerminar: function () { clearTimeout(limite); pronto(); } }
      }));
    });
  }

  /* ---------- ler um dia ---------- */

  /* a leitura do dia em todas as colunas à vista (o dado real, ou a prévia com rascunho); a resposta de um pedido que um
     mais novo substituiu é descartada */
  function lerDia(iso, celulas) {
    var meu = pedidos[iso] = (pedidos[iso] || 0) + 1;
    var leitura = RosterWork.escalasDados.carregar(unidadesDe(celulas), iso, iso).then(function (r) {
      if (meu !== pedidos[iso]) throw new Error('leitura antiga');
      return r;
    });
    return { leitura: leitura, vigente: function () { return meu === pedidos[iso]; } };
  }

  /* o rascunho do Dia mudou (ou voltou ao gravado): só aquele dia lê de novo. dias = [{ unidadeId, iso }].
     false: é a página que lê o período (mais de um dia, ou uma grade sem célula por dia) */
  function previa(dias) {
    if (!dias || dias.length !== 1 || !temCelulas()) return false;
    var iso = dias[0].iso;
    var celulas = celulasDoDia(iso);
    if (!celulas.length) return true;   // o dia não está na tela: nada a mostrar
    var celula = celulaDe(dias[0].unidadeId, iso);
    marcarCelula(celula);
    var dia = lerDia(iso, celulas);
    lendo[iso] = true;
    dia.leitura.then(function (r) { if (reguaMudou(celulas, r, iso, false)) relerPeriodo(); }, function () {});
    unidadesDe(celulas).forEach(function (id) { RosterWork.escalaAtualizando.atualizarCelula(id, iso, dia.leitura); });
    function fim() {
      if (!dia.vigente()) { marcarCelula(celulaDe(dias[0].unidadeId, iso)); return; }
      delete lendo[iso];
      /* a célula foi refeita: a de agora (a peça antiga saiu da tela) */
      celula = celulaDe(dias[0].unidadeId, iso) || celula;
      tirarMarca(celula);
      RosterWork.escalasPainel.mostrarDia();
    }
    dia.leitura.then(fim, fim);
    return true;
  }

  /* o Salvar só do Dia: lê aquele dia em todas as colunas e acende o dia salvo e o que mudou nas outras colunas. A promessa
     se cumpre com as células trocadas */
  function salvou(unidadeId, iso) {
    var celulas = celulasDoDia(iso);
    if (!celulas.length) return Promise.resolve();
    var celula = celulaDe(unidadeId, iso);
    var antes = celulas.map(function (c) { return c.textContent; });
    var dia = lerDia(iso, celulas);
    var relerTudo = false;
    dia.leitura.then(function (r) { relerTudo = reguaMudou(celulas, r, iso, true); }, function () {});
    unidadesDe(celulas).forEach(function (id) { RosterWork.escalaAtualizando.salvou(id, iso, dia.leitura); });
    var pronto = dia.leitura.then(function () {
      tirarMarca(celula);
      celulas.forEach(function (c, i) { if (c === celula || c.textContent !== antes[i]) acender(c); });
      RosterWork.escalasPainel.mostrarDia();
      if (relerTudo) return relerPeriodo();
    }, function () { if (dia.vigente()) tirarMarca(celula); });
    /* a gravação pode ter deixado dias na fila do recálculo: a conferência os marca na grade */
    RosterWork.escalaAtualizando.conferir();
    return Promise.race([pronto, new Promise(function (seguir) { setTimeout(seguir, LIMITE_MS); })]);
  }

  /* ---------- a grade que fica na tela enquanto lê ---------- */

  /* o mesmo período já está na tela? Devolve a rolagem dele (ele fica até o novo chegar; data-relendo avisa o passo a passo
     que a grade ainda vai mudar; quem tira é a escalas.js, quando o desenho termina) ou null */
  function mesmaGrade(corpo, chave) {
    var area = corpo.getAttribute('data-grade-na-tela') === chave ? corpo.querySelector(AREAS) : null;
    if (!area) return null;
    corpo.setAttribute('data-relendo', '');
    return { topo: area.scrollTop, lado: area.scrollLeft };
  }

  function desenhou(corpo, chave, area, rolagem) {
    corpo.setAttribute('data-grade-na-tela', chave);
    if (!rolagem) return;
    area.scrollTop = rolagem.topo;
    area.scrollLeft = rolagem.lado;
  }

  window.RosterWork.escalasDiaNaGrade = {
    temCelulas: temCelulas, refazendo: refazendo, parou: parou, previa: previa, salvou: salvou,
    relerPeriodo: relerPeriodo, mesmaGrade: mesmaGrade, desenhou: desenhou, porNova: porNova, tirarNova: tirarNova,
    semMudanca: semMudanca, unidadesDoDia: unidadesDoDia
  };
})();
