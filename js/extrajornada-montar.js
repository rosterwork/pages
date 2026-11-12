/* ============================================================
   EXTRAJORNADA — passos 3 e 4: Distribuição e Ajustes (a tela)
   A sugestão, o Salvar, o rodapé e o resumo do alto. O rascunho e as
   contas ficam em extrajornada-grade.js, o calendário em
   extrajornada-por-dia.js, o painel do dia em extrajornada-dia.js e a
   lista dos voluntários (o painel esquerdo) em extrajornada-lista.js.
   Tudo fica no rascunho até o Salvar (extrajornada_distribuicao_salvar),
   que espera acertar quem passou da cota. "Preencher pela sugestão"
   (só com tudo salvo) mantém as extras que o administrador pôs ou mudou
   e pede ao motor (extrajornada_sugerir) que refaça as que o sistema pôs.
   O Desfazer e o Refazer do rodapé (e o Ctrl+Z e o Ctrl+Y) andam pelos
   passos do rascunho; o Preencher inteiro é um passo só.
   Os Ajustes são a mesma tela (o modo ajustes): abrem depois do
   lançamento.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaMontar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var d = null, el = null, aoSalvar = null;
  var sugestaoGuardada = null;   // o resultado da sugestão desfeita (o Refazer o põe de volta)
  var postas = null;       // as cotas que a última sugestão pôs no mês (a nota do resultado); null = sem sugestão
  var foraSug = {};        // quem ficou com cota na última sugestão: cpf -> motivo (o grupo Faltam da lista mostra)
  var reserva = false;     // a última sugestão usou o cálculo simples do banco
  var resultadoFechado = false;   // o resultado da sugestão fechado no X (volta no próximo Preencher)
  var escalaSeq = 0;
  var esperaDaEscala = null;   // a leitura da escala do mês (geral-etapas.js)
  var escalaLendo = null;  // o mês com a leitura da escala no ar
  var escalaFalhou = null; // o mês em que a leitura da escala falhou (a frase no lugar do calendário)

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }
  function dia() { return RW.extrajornadaDia; }
  function porDia() { return RW.extrajornadaPorDia; }
  function q(sel) { return el.querySelector(sel); }
  /* o "conteudo" é o do shell, sempre o mesmo, e a página é nova a cada visita: quem diz se ela está na tela é o botão */
  function naPagina() { return !!el && !!q('#p3-sugerir'); }

  /* ---------- a escala do mês ---------- */
  /* a escala do mês vem com o mês (extrajornada_mes, da conta guardada no banco); com mudança do painel do dia da Escala
     esperando o Salvar, ela é lida com o rascunho (carregarEscala) */
  function escalaDoMes() {
    if (!d.escala || !RW.escalasDados || RW.escalasDados.corpoPrevia('ler_escala_mes', {})) return;
    G().escalaDoMes();
    escalaSeq++;
    escalaLendo = null;
  }
  /* uma leitura por vez (o calendário mostra a forma até ela chegar). Se falhar, a frase fica no lugar do calendário,
     como na Escala, e a mensagem técnica no console; abrir o passo de novo tenta outra vez */
  function pararEsperaDaEscala() {
    if (esperaDaEscala) esperaDaEscala.parar();
    esperaDaEscala = null;
  }

  function carregarEscala() {
    var ids = d.unidades.map(function (x) { return x.id; });
    var comp = d.competencia, req = ++escalaSeq;
    if (!RW.escalasDados) { G().usarEscala({ comp: comp, cobertura: {}, erro: {}, militares: {} }); redesenhar(); return; }
    escalaLendo = comp;
    function falhou(e) {
      if (req !== escalaSeq) return;
      escalaLendo = null;
      escalaFalhou = comp;
      console.error('[Extrajornada] ler_escala_mes falhou' + (e && e.message ? ': ' + e.message : ''));
      if (naPagina()) redesenhar();
    }
    /* a forma da grade que apareceu fica o mínimo na tela (geral-etapas.js) */
    var leitura = RW.escalasDados.carregar(ids, comp, G().ultimoDia()), esta = esperaDaEscala;
    (esta ? esta.segurar(leitura) : leitura).then(function (r) {
      if (req !== escalaSeq) return;
      if (!r) { falhou(); return; }
      escalaLendo = null;
      G().usarEscala({ comp: comp, cobertura: r.cobertura || {}, erro: r.erro || {}, militares: r.militares || {} });
      if (naPagina()) redesenhar();
    }, falhou);
  }

  /* ---------- sugestão, salvar e o resto ---------- */
  /* Preencher pela sugestão, só com tudo salvo: as extras que o administrador pôs ou mudou ficam; as que o sistema
     salvou saem e o otimizador (extrajornada-otimizador.js, com o véu e o cálculo simples de reserva) refaz tudo com as
     cotas que sobram. A extra refeita igual à salva não é mudança */
  function sugerir() {
    if (G().alteracoes().length || RW.extrajornadaOtimizador.calculando()) return;
    var fixas = d.alocacoes.filter(function (a) { return a.origem !== 'sugestao'; });
    var botao = q('#p3-sugerir');
    RW.extrajornadaOtimizador.preencher(d.competencia, fixas, function (r, usouReserva) {
      /* a pessoa saiu da página durante o cálculo: o resultado fica para trás */
      if (q('#p3-sugerir') !== botao) return;
      /* o Preencher inteiro é um passo só do Desfazer */
      G().limpar();
      G().guardarPasso('sugestao');
      sugestaoGuardada = null;
      var mud = G().rascunho();
      resultadoFechado = false;
      d.alocacoes.forEach(function (a) {
        if (a.origem === 'sugestao') mud[G().chave(a.cpf, a.data)] = { cpf: a.cpf, data: a.data, unidade: +a.unidade, blocos: [], origem: 'sugestao', porque: null, inicio: null };
      });
      postas = 0;
      r.propostas.forEach(function (p) {
        var k = G().chave(p.cpf, p.data), antes = G().base(p.cpf, p.data);
        postas += p.blocos.length;
        if (antes && antes.origem === 'sugestao' && +antes.unidade === +p.unidade && G().mesmosBlocos(antes, p)) delete mud[k];
        else mud[k] = { cpf: p.cpf, data: p.data, unidade: p.unidade, blocos: p.blocos, origem: 'sugestao', porque: p.porque, inicio: p.inicio || null };
      });
      foraSug = {};
      (r.nao_coube || []).forEach(function (n) { foraSug[n.cpf] = n.motivo; });
      reserva = usouReserva;
      dia().reorganizar();
      redesenhar();
    });
  }

  /* o resultado da sugestão (a nota e quem ficou com cota) sai com o Desfazer do Preencher e volta com o Refazer: troca
     com o guardado */
  function trocarSugestao() {
    var agora = { postas: postas, foraSug: foraSug, reserva: reserva };
    var volta = sugestaoGuardada || { postas: null, foraSug: {}, reserva: false };
    postas = volta.postas; foraSug = volta.foraSug; reserva = volta.reserva;
    sugestaoGuardada = agora;
  }

  /* o Desfazer e o Refazer do rodapé (e o Ctrl+Z e o Ctrl+Y): o rascunho volta ou avança um passo e a tela refaz os dias
     que mudaram (o que estava aberto no painel do dia e na célula fecha) */
  function voltar(desfazer) {
    if (!d || RW.extrajornadaOtimizador.calculando()) return;
    var ativo = RW.extrajornadaCelula ? RW.extrajornadaCelula.ativo() : null;
    var r = desfazer ? G().desfazer() : G().refazer();
    if (!r) return;
    if (r.marca === 'sugestao') trocarSugestao();
    dia().reorganizar();
    var dias = r.dias.slice();
    if (ativo && dias.indexOf(ativo.data) < 0) dias.push(ativo.data);
    diasDosQuePassaram().forEach(function (x) { if (dias.indexOf(x) < 0) dias.push(x); });
    if (!G().escalaPronta() || dias.length > 3) { redesenhar(); return; }
    dias.forEach(function (k) { porDia().atualizarDia(k); });
    redesenhar(true);
  }

  function salvar() {
    var btn = q('#p3-salvar');
    RW.iniciarCarregando(btn);
    RW.rpc('extrajornada_distribuicao_salvar', {
      p_competencia: d.competencia,
      p_mudancas: G().alteracoes().map(function (k) { return G().rascunho()[k]; }),
      p_motivo: null   // o banco aceita o ajuste sem motivo
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      G().limpar(); postas = null; sugestaoGuardada = null; if (G().modo() === 'ajustes') G().usarEscala(null);   // o ajuste muda a escala: relida com o mês
      dia().reorganizar();
      RW.extrajornadaOrg.resumo(r);
      aoSalvar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* o resumo, o rodapé, a lista e o calendário; soCabeca = o calendário já foi refeito no dia que mudou. Nos Ajustes
     antes do lançamento, só o aviso de que eles abrem depois */
  function redesenhar(soCabeca) {
    var ajuste = G().modo() === 'ajustes', lancada = G().lancada(), travado = G().travado(), soLeitura = G().soLeitura();
    var semLancamento = ajuste && !lancada;
    q('#p3-sem-lancamento').classList.toggle('oculto', !semLancamento);
    q('#p3-lateral').classList.toggle('oculto', semLancamento);
    if (semLancamento) { q('#p3-rodape').classList.add('oculto'); return; }
    var n = G().alteracoes().length;
    /* o rodapé de salvar aparece com alteração e enquanto há o que refazer; nos Ajustes, com o "Salvar e enviar para a
       escala". Quem passou da cota segura o Salvar, com o motivo escrito */
    q('#p3-rodape').classList.toggle('oculto', !n && !G().podeRefazer());
    var passou = n ? G().passaram()[0] : null, texto = q('#p3-texto');
    /* o que o rascunho faz com as cotas, em amarelo; quem passou da cota vem primeiro */
    var frase = !passou && n ? G().fraseDasCotas() : '';
    texto.textContent = passou ? msg().passouRodape((passou.grad + ' ' + passou.nome).trim(), G().usadas(passou.cpf) - passou.concedidas)
      : n ? (ajuste ? msg().ajusteTexto(n) : msg().alteracoes(n)) + (frase ? ' ' + frase : '') : '';
    texto.classList.toggle('extrajornada-painel-rodape-erro', !!passou);
    texto.classList.toggle('extrajornada-painel-rodape-alerta', !!frase);
    /* com o Salvar carregando (os textos dele saem e voltam com o pararCarregando), só o que está na tela */
    [['#p3-salvar-dist', ajuste], ['#p3-salvar-ajuste', !ajuste]].forEach(function (t) { var s = q(t[0]); if (s) s.classList.toggle('oculto', t[1]); });
    q('#p3-salvar').disabled = !n || !!passou;
    q('#p3-cancelar').disabled = !Object.keys(G().rascunho()).length;
    q('#p3-desfazer').disabled = !G().podeDesfazer();
    q('#p3-refazer').disabled = !G().podeRefazer();
    var aberto = q('#p3-aberto');
    aberto.classList.toggle('oculto', !travado);
    aberto.querySelector('.nota-texto').textContent = travado ? msg().pedidoAberto(u().br(d.mes.fecha)) : '';
    q('#p3-sugerir').disabled = travado || soLeitura || n > 0;
    var lancadaNota = q('#p3-lancada');
    lancadaNota.classList.toggle('oculto', !soLeitura);
    lancadaNota.querySelector('.nota-texto').textContent = soLeitura ? msg().distLancada(d.lancamento.lancado_em, d.lancamento.por || '') : '';
    /* o resumo da companhia: as cotas colocadas dos militares */
    var alocs = G().efetivas();
    var sel = u().escolhidas();
    var vols = G().voluntarios().filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; });
    var total = vols.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    var colocadas = vols.reduce(function (s, m) { return s + G().usadas(m.cpf, alocs); }, 0);
    q('#p3-colocadas').textContent = msg().colocadas(colocadas, total);
    /* todas as cotas colocadas e salvas, com o pedido fechado e ainda sem lançar */
    q('#p3-pronta').classList.toggle('oculto', !(!ajuste && !lancada && !travado && !n && total > 0 && colocadas >= total));
    /* depois do Preencher pela sugestão: quantas cotas o sistema pôs no mês e os dias que ainda ficaram com vermelho ou
       amarelo */
    var resultado = q('#p3-resultado'), pronta = G().escalaPronta();
    resultado.classList.toggle('oculto', postas === null || !pronta || resultadoFechado);
    if (postas !== null && pronta) {
      var vermelho = 0, amarelo = 0;
      G().diasDoMes().forEach(function (k) {
        var cores = G().pelotoes().map(function (x) { return G().corDe(G().faltaDoDia(x.id, k, alocs)); });
        if (cores.indexOf('erro') >= 0) vermelho++; else if (cores.indexOf('alerta') >= 0) amarelo++;
      });
      resultado.querySelector('.nota-texto').textContent = (reserva ? msg().reservaUsada + ' ' : '') + msg().resultadoSugestao(postas, vermelho, amarelo);
    }
    RW.extrajornadaLista.desenhar(el);
    /* sem nenhum pelotão: o vazio no lugar do calendário */
    var nenhuma = !u().doCalendario(alocs).length;
    q('#p3-cal').classList.toggle('oculto', nenhuma);
    q('#p3-cal-vazio').classList.toggle('oculto', !nenhuma);
    if (!pronta) {
      var alvo = q('#p3-cal'), falha = escalaFalhou === d.competencia;
      if (falha) {
        pararEsperaDaEscala();
        alvo.textContent = '';
        var no = RW.tpl('tpl-escala-estado');
        if (no) { no.textContent = msg().falhaEscala; alvo.appendChild(no); }
      } else if (!esperaDaEscala) {
        /* passando de 0,5 s, a forma da grade, com os dias e os pelotões de verdade (escalas-esqueleto.js) */
        var unidades = u().doCalendario(alocs), mesDaGrade = new Date(+d.competencia.slice(0, 4), +d.competencia.slice(5, 7) - 1, 1);
        esperaDaEscala = RW.etapas.area(alvo, { forma: function (lugar) {
          if (RW.extrajornada.modo() === 'agenda') RW.escalasEsqueleto.agenda(lugar, unidades, mesDaGrade);
          else RW.escalasEsqueleto.calendario(lugar, unidades, mesDaGrade);
        } });
      }
      if (!falha && escalaLendo !== d.competencia) carregarEscala();
      return;
    }
    pararEsperaDaEscala();
    if (!soCabeca && !nenhuma) {
      porDia().desenhar(q('#p3-cal'));
      passaramAntes = G().passaram().map(function (m) { return m.cpf; });   // o calendário inteiro já pintou quem passou
    }
    dia().redesenhar();
    RW.extrajornadaFiltros.aplicar();
  }

  /* o rascunho mudou no calendário, na lista ou no painel do dia */
  function aoMudar(k) {
    if (G().escalaPronta()) {
      /* o dia que mudou; o cartão aberto na célula de outro dia (a nota de quem passou da cota e os outros dias dele); e
         os dias de quem passou da cota ou voltou a ela (o cartão vermelho em todos os dias dele) */
      var ativo = RW.extrajornadaCelula ? RW.extrajornadaCelula.ativo() : null, dias = [k];
      if (ativo && ativo.data !== k) dias.push(ativo.data);
      diasDosQuePassaram().forEach(function (x) { if (dias.indexOf(x) < 0) dias.push(x); });
      dias.forEach(function (x) { porDia().atualizarDia(x); });
    }
    redesenhar(true);
  }

  /* os dias de quem entrou ou saiu da lista dos que passaram da cota desde o último desenho (o cartão dele muda de cor
     em todos os dias) */
  var passaramAntes = [];
  function diasDosQuePassaram() {
    var agora = G().passaram().map(function (m) { return m.cpf; });
    var mudaram = agora.filter(function (c) { return passaramAntes.indexOf(c) < 0; })
      .concat(passaramAntes.filter(function (c) { return agora.indexOf(c) < 0; }));
    passaramAntes = agora;
    var dias = [];
    if (mudaram.length) G().vagas().forEach(function (v) { if (mudaram.indexOf(v.cpf) >= 0 && dias.indexOf(v.data) < 0) dias.push(v.data); });
    return dias;
  }

  var guardaLigada = false, tecladoLigado = false;
  /* modoNovo: 'distribuicao' (passo 3) ou 'ajustes' (passo 4), a mesma tela. A marca no botão vale por visita: a página
     nova chega sem ela, com o rascunho zerado e os botões a ligar */
  function mostrar(dados, conteudo, recarregar, modoNovo) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    G().iniciar(dados, modoNovo || 'distribuicao', aoMudar);
    var botaoSugerir = q('#p3-sugerir');
    if (!botaoSugerir.dataset.ligado) {
      botaoSugerir.dataset.ligado = '1';
      G().limpar(); G().usarEscala(null); postas = null; foraSug = {}; sugestaoGuardada = null;
      botaoSugerir.addEventListener('click', sugerir);
      q('#p3-resultado-fechar').addEventListener('click', function () { resultadoFechado = true; q('#p3-resultado').classList.add('oculto'); });
      q('#p3-desfazer').addEventListener('click', function () { voltar(true); });
      q('#p3-refazer').addEventListener('click', function () { voltar(false); });
      q('#p3-salvar').addEventListener('click', salvar);
      q('#p3-cancelar').addEventListener('click', function () {
        RW.confirmar({ tipo: 'aviso', mensagem: msg().descartarRascunho, textoConfirmar: RW.mensagens.botoes.descartar,
          aoConfirmar: function () { G().limpar(); postas = null; sugestaoGuardada = null; dia().reorganizar(); redesenhar(); } });
      });
      RW.extrajornadaLista.ligar(el);
      RW.extrajornadaFiltros.ligar(el);
      /* com mudança não salva ou no meio do cálculo da sugestão, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida && !guardaLigada) {
        guardaLigada = true;
        RW.guardaSaida.registrar(function () {
          var botao = el && q('#p3-sugerir');
          return !!botao && !!botao.dataset.ligado && (G().alteracoes().length > 0 || RW.extrajornadaOtimizador.calculando());
        });
      }
      /* o Ctrl+Z desfaz e o Ctrl+Y (ou o Ctrl+Shift+Z) refaz, com a Distribuição ou os Ajustes na tela, fora dos campos de
         texto e sem janela de aviso aberta */
      if (!tecladoLigado) {
        tecladoLigado = true;
        document.addEventListener('keydown', function (ev) {
          if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || !d || !el || !el.isConnected) return;
          var cal = q('#p3-cal'), alvo = ev.target;
          if (!cal || !cal.getClientRects().length || document.querySelector('.modal-veu--aberto')) return;
          if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
          var tecla = (ev.key || '').toLowerCase();
          if (tecla === 'z' && !ev.shiftKey) { ev.preventDefault(); voltar(true); }
          else if (tecla === 'y' || (tecla === 'z' && ev.shiftKey)) { ev.preventDefault(); voltar(false); }
        });
      }
    }
    escalaFalhou = null;
    escalaDoMes();
    /* as cotas que faltam distribuir, no alto; nos Ajustes, com o que fazer */
    if (RW.cotasAviso) RW.cotasAviso.ligar(q('#p3-cotas-aviso'), function () { return [d.competencia]; }, { comoFazer: modoNovo === 'ajustes' });
    redesenhar();
    /* veio do botão da nota ou da linha da Pendências: o militar, quando é um só, já em foco. Depois do clique em curso,
       porque o clique fora tira o foco */
    var pedido = RW.cotasAviso && modoNovo === 'ajustes' ? RW.cotasAviso.focoPedido(d.competencia) : null;
    if (pedido) setTimeout(function () { RW.extrajornadaLista.focar(pedido); }, 0);
    /* veio do Abrir na Extrajornada da célula da Escala: o painel daquele dia */
    var diaPedido = modoNovo === 'ajustes' ? RW.extrajornada.diaPedido() : null;
    if (diaPedido && diaPedido.comp === d.competencia) {
      RW.extrajornada.diaPedido(true);
      setTimeout(function () { dia().abrir(diaPedido.uid, diaPedido.k); }, 0);
    }
  }

  RW.extrajornadaMontar = {
    mostrar: mostrar,
    sujo: function () { return !!d && G().alteracoes().length > 0; },
    descartar: function () { G().limpar(); postas = null; sugestaoGuardada = null; },
    /* refaz o calendário (o filtro Exibir mudou) */
    redesenhar: function () { if (d && naPagina()) redesenhar(); },
    /* o painel do dia fecha ao sair da Distribuição, dos Ajustes ou da aba */
    fecharPainel: function () { if (dia()) dia().fechar(); },
    diasComFalta: function (dados) { return G().diasComFalta(dados); },
    /* por que o militar ficou com cota na última sugestão (enquanto ela está na tela): 'solta', 'nao_quero', 'sem_dia' */
    foraDaSugestao: function (cpf) { return postas !== null ? foraSug[cpf] || null : null; }
  };
})();
