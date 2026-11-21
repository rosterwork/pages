/* ============================================================
   ESCALAS — o menu de cada linha do Dia (o lápis; só admin)
   O lápis de cada linha que o administrador edita abre o menu dela,
   embaixo da linha, e a linha inteira também abre (ela fica cinza
   enquanto o menu está aberto: é ela que mostra de quem é o menu).
   O menu tem até duas partes, cada uma com o título de quem ela é, e
   os itens que valem, cada um com o ícone dele (o que tira alguém por
   último, em vermelho, no fim da parte dele). Na aba Funções, a parte
   do lugar e, depois do traço, a parte do dia da pessoa (os mesmos
   itens da aba Militares):
   - militar numa função ("Condutor da ABT-14935"): Pôr outro no lugar
     dele, Mudar para outra função, Mudar o horário nesta função,
     Voltar ao automático (o fixado) e Remover desta função;
   - o estagiário no Efetivo da viatura: Mudar o horário nesta função;
   - vaga sem ninguém e função aberta: Pôr um militar aqui e Voltar ao
     automático (a vaga que veio de um Remover desta função), sem a
     parte do dia;
   - Sem função: Pôr numa função e, do Chefe de Socorro que saiu da
     cadeira dele, o Voltar ao automático (volta para ela);
   - o Chefe de Socorro e o Oficial de Área na cadeira deles: Mudar
     para outra função (o papel vai junto com ele) e Remover desta
     função (vai para Sem função, ainda com o papel); o papel é sempre
     o mais antigo do dia, que nunca muda à mão; na linha do papel que
     foi junto com ele para outro posto e nas Funções especiais, só a
     parte do dia;
   - as outras linhas que a Central só exibe não têm lápis; a exceção é
     o Oficial de Área da companhia na Central do pelotão, para quem
     administra a companhia: o Ver o dia na companhia ("Ver o dia na
     2ªCIBM") abre o dia da companhia na aba Militares, já com o menu
     dele aberto.
   Na aba Militares, só o dia da pessoa ("Cb. Veloso no dia 21/11"):
   Mudar o horário do serviço, Mudar o dia do serviço, Mudar de
   unidade neste dia, Pôr como Oficial de Área (o Sub.Ten. ou mais
   antigo de serviço num pelotão, para quem administra a companhia: a
   pergunta embaixo da linha, se ele sai daqui ou fica nas duas, e o
   serviço dele vai para ela neste dia, escalas-celula-oficial.js),
   Registrar troca de serviço (o formulário da troca no painel, já com
   ele e o dia; na célula, com o ícone do painel, porque o painel abre), Mudar a
   extrajornada (quem está de extra: abre a
   aba Extrajornada do painel, onde a extra muda; na célula, a caixa da
   extra dele, a mesma do clique na linha da extra, também com o painel
   fechado), Dar folga neste dia
   (quem está no dia pela guarnição ou por troca: sair do dia é a folga,
   na cor normal; na troca, ela continua valendo) e Remover deste dia
   (o resto, em vermelho; na troca, as perguntas dela no painel) e,
   para quem está no dia pela guarnição, Remover da guarnição (a
   pergunta Último serviço, escalas-painel-ciclo.js) ou, no dia do
   último serviço antes da saída marcada à mão, o Mudar a saída (a
   pergunta Último serviço com os dias de serviço dele) e o Cancelar
   a saída no lugar dele; quem foi
   remanejado daqui para outra unidade, o Devolver; quem saiu da
   guarnição (a linha riscada do grupo Saiu da guarnição), o Mudar a
   saída e o Cancelar a saída. No De folga (nas
   duas abas) e na linha riscada da célula (uma por folga e por
   mudança de dia): Cancelar a folga, ou Desfazer a mudança (a folga
   que veio da mudança de dia), na hora, com o Desfazer; na da mudança,
   também o Mudar o dia do serviço (a mudança vai para outra data, o
   Mudar o dia com ela, sem outra folga dele no dia) e o Dar folga
   neste dia (ele não trabalha em nenhum dos dois dias, a pergunta do
   banco de horas embaixo da linha).
   Na Militares, embaixo do traço, o Ver as funções troca de aba já com
   o menu da linha dele aberto.
   A mudança de dia ainda não salva (só no rascunho, sem número no
   banco): quem vem de outro dia tem só o Remover deste dia, e o
   Desfazer a mudança de quem sai; os dois só a largam do rascunho.
   Cada item usa o caminho que já existe: o cartão embaixo da linha
   (escalas-painel-linha.js: o militar, só o horário ou para qual
   função), as sub-telas já com ele escolhido (Mudar o horário do
   serviço, Mudar o dia do serviço, Mudar de unidade neste dia, a do
   Remover do dia para quem foi a outra unidade e, do estagiário, a do
   Mudar onde fica), o
   Dar folga e o Remover deste dia (escalas-painel-remover.js › doDia) e, na hora, com o
   Desfazer, o Voltar ao automático e o Remover desta função.
   Na célula da grade (visao 'celula', escalas-celula-editar.js), o
   mesmo menu vai para a caixa flutuante: os itens do dia da pessoa
   (e do De folga, da saída e do remanejado), sem o Ver as funções, e
   o Abrir o painel do dia em todos; quem faz cada item é a célula.
   API: RosterWork.escalasPainelLinhaMenu.na(linha, cfg) põe o lápis e o
   menu na linha; fazer(linha, acao) faz um item por código (o lugar
   novo do posto abre o cartão sozinho); abrir(linha) abre o menu dela
   (o Ver as funções, na outra aba); menuDaCelula(cfg,
   escolher) devolve o menu pronto para a caixa; largarMudanca(cpf,
   sentido, senao) larga a mudança de dia do rascunho; cancelarFolga(cfg),
   desfazerMudanca(cfg), cancelarSaida(cfg) e mudarSaida(cfg, opcoes)
   (a célula usa as mesmas).
   cfg = { tipo: 'funcao' | 'papel' | 'exibida' (as outras linhas que a Central
   só exibe: sem lápis) | 'vaga' | 'sem' | 'folga' | 'militar'
   (a linha da aba Militares) | 'fora' (remanejado daqui para outra
   unidade) | 'saida' (quem saiu da guarnição; saida = a data da saída; ultimo e dias = o último serviço e os dias do
   Mudar a saída, só na saída à mão) | 'companhia' (o Oficial de Área da companhia na Central do
   pelotão), visao: 'funcoes' | 'militares', exibida (no papel: a linha das
   Funções especiais), levado (no papel: a linha do papel que foi junto com
   ele para outra função do posto), grupo() (o bloco da função
   na lista), posto, funcao, rotulo, militar, periodos, folga (na De
   folga: a linha da folga, com o lancamento_id e a mudança), origem (no
   fora: o nome desta unidade, para onde ele volta), companhia (no
   companhia: { id, nome, cidade }) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var cfgs = new WeakMap();   // linha -> cfg (o item por código)

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function A() { return RosterWork.escalasPainelLinhaAplicar; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* ---------- quais itens valem ---------- */

  /* a parte do dia: o que se faz com o serviço dele no dia (cada sub-tela diz quem ela aceita; a extra muda na aba
     Extrajornada do painel) */
  function itensDoDia(cpf, r) {
    var RW = RosterWork, mil = ed().militarDoDia(cpf);
    r['horario-dia'] = !!RW.escalasPainelHorarioDia && RW.escalasPainelHorarioDia.pode(cpf);
    r['mudar-dia'] = !!RW.escalasPainelMudarDia && RW.escalasPainelMudarDia.podeMudar(cpf);
    r['mudar-unidade'] = !!RW.escalasPainelRemanejar && RW.escalasPainelRemanejar.podeEnviar(cpf);
    r['oficial-area'] = !!RW.escalasCelulaOficial && RW.escalasCelulaOficial.podeSer(cpf);
    /* a troca: quem está de serviço aqui (fora só a extra); no Registrar, o administrador não entra */
    r['registrar-troca'] = !!mil && mil.daUnidade && cpf !== RW.sessao.cpf() && mil.janelas.some(function (j) { return j.origem !== 'extra'; });
    r['mudar-extra'] = !!mil && mil.janelas.some(function (j) { return j.origem === 'extra'; }) && RW.escalasPainel.temAba('extra');
    /* sair do dia: pelo ciclo é a folga (Dar folga neste dia); o pontual e o resto, o Remover deste dia (o mesmo caminho);
       por troca, os dois: a folga dele, com a troca valendo, e o Remover deste dia com as perguntas da troca */
    var tirar = !!RW.escalasPainelRemover && RW.escalasPainelRemover.podeTirar(cpf);
    var periodos = mil ? mil.janelas.map(copiar) : [];
    var analise = tirar && mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: periodos }) : null;
    var folga = tirar && mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: periodos, folga: true }) : null;
    r['folga-dia'] = !!folga && folga.tipo === 'folga';
    r['remover-dia'] = tirar && !(analise && analise.tipo === 'folga');
    /* sair da guarnição: no dia do último serviço antes da saída marcada à mão, o Mudar a saída e o Cancelar a saída no
       lugar do Remover da guarnição */
    var marcada = !!RW.escalasPainelCiclo && RW.escalasPainelCiclo.saidaMarcada(cpf);
    r['remover-guarnicao'] = !marcada && !!RW.escalasPainelCiclo && RW.escalasPainelCiclo.podeSair(cpf);
    r['mudar-saida'] = !!marcada && (marcada.dias || []).length > 1;
    r['cancelar-saida'] = !!marcada;
    /* o estagiário: o Mudar onde fica (os postos do estágio dele), sem troca de serviço e sem mudar de unidade (ele é do
       estágio desta unidade) */
    var dd = ed().dados() || {};
    r['onde-estagio'] = !!(dd.estagios && dd.estagios[cpf]);
    if (r['onde-estagio']) { r['registrar-troca'] = false; r['mudar-unidade'] = false; }
  }

  /* os itens que valem para a linha: { acao: true }. Na aba Funções, o que é do lugar e o dia da pessoa; na Militares,
     só o dia da pessoa (e o Ver as funções); o De folga é igual nas duas */
  function itens(cfg) {
    /* a célula da grade: os mesmos da aba Militares, sem o Ver as funções, e o Abrir o painel do dia em todos */
    if (cfg.visao === 'celula') {
      var c = itens(Object.assign({}, cfg, { visao: 'militares' }));
      delete c['ver-funcoes'];
      c['abrir-painel'] = true;
      /* o Mudar a extrajornada também com o painel fechado (sem a aba Extrajornada), quando a caixa da extra dele abre aqui
         (escalas-celula-extra.js) */
      var X = RosterWork.escalasCelulaExtra, m = cfg.militar;
      if (cfg.tipo === 'militar' && m && X && ed().mudancaNoRascunho(m.cpf) !== 'vem'
          && X.podeAbrir({ unidadeId: ed().unidadeId(), iso: ed().iso() }, m.cpf)) c['mudar-extra'] = true;
      return c;
    }
    var r = {}, m = cfg.militar, militares = cfg.visao === 'militares';
    /* quem vem de outro dia e ainda não foi salvo: só sair deste dia (o rascunho larga a mudança), pela aba Militares */
    if (m && cfg.tipo !== 'folga' && cfg.tipo !== 'saida' && ed().mudancaNoRascunho(m.cpf) === 'vem') {
      return militares ? { 'remover-dia': true, 'ver-funcoes': true } : { 'remover-dia': true };
    }
    /* o estagiário no Efetivo da viatura não é lugar da guarnição: do lugar, só o horário (sem Pôr outro no lugar,
       Outra função e Voltar ao automático); o dia dele, o mesmo da aba Estagiários */
    if (cfg.tipo === 'funcao' && cfg.estagiario && m) {
      r['horario-funcao'] = true;
      itensDoDia(m.cpf, r);
      return r;
    }
    if (cfg.tipo === 'funcao') {
      r['por-outro'] = true;
      r['outra-funcao'] = true;
      r['horario-funcao'] = true;
      r.liberar = A().podeLiberar(cfg);
      r['remover-funcao'] = true;
      if (m) itensDoDia(m.cpf, r);
    } else if (cfg.tipo === 'papel' && m) {
      /* o Chefe de Socorro e o Oficial de Área: o papel é sempre do mais antigo do dia (nunca muda à mão); o lugar dele
         muda como o de qualquer militar, e o papel vai junto. Nas Funções especiais e na linha do papel que já foi junto
         para outra função do posto, só o dia */
      if (!cfg.exibida && !cfg.levado) {
        r['outra-funcao'] = true;
        /* sai da cadeira e fica em Sem função definida, ainda com o papel */
        r['remover-funcao'] = true;
      }
      itensDoDia(m.cpf, r);
    } else if (cfg.tipo === 'vaga') {
      r['por-aqui'] = true;
      r.liberar = A().podeLiberar(cfg);
    } else if (cfg.tipo === 'sem') {
      r['por-funcao'] = true;
      /* o Chefe de Socorro que saiu da cadeira dele: o Voltar ao automático devolve ele para ela */
      r.liberar = A().podeLiberar(cfg);
      if (m) itensDoDia(m.cpf, r);
    } else if (cfg.tipo === 'folga') {
      var mudanca = !!(cfg.folga && cfg.folga.mudanca);
      r['cancelar-folga'] = !mudanca;
      r['desfazer-mudanca'] = mudanca;
      /* a mudança também vai para outra data (sem outra folga dele no dia: o banco não muda o pedaço que sobra dela) ou
         vira folga nos dois dias */
      r['mudar-mudanca'] = mudanca && !((ed().dados() || {}).folgas || []).some(function (x) {
        return x.cpf === cfg.folga.cpf && !x.mudanca;
      });
      r['folga-mudanca'] = mudanca;
    } else if (cfg.tipo === 'militar' && m) {
      itensDoDia(m.cpf, r);
      r['ver-funcoes'] = true;
    } else if (cfg.tipo === 'saida') {
      r['mudar-saida'] = (cfg.dias || []).length > 1;
      r['cancelar-saida'] = true;
    } else if (cfg.tipo === 'fora') {
      r.devolver = true;
    } else if (cfg.tipo === 'companhia') {
      r['ver-companhia'] = true;
    }
    return r;
  }

  /* mostra só os itens que valem; a parte sem nenhum some, e o traço só fica com o Ver embaixo de outra parte. O título de
     cada parte diz de quem ela é: o lugar ("Condutor da ABT-14935"; no Sem função, "Sem função") ou o militar no dia */
  function preparar(dd, cfg) {
    var vale = itens(cfg), tem = {}, m = cfg.militar, nome = m ? nomeDe(m) : '';
    [].forEach.call(dd.querySelectorAll('.escala-edicao-opcoes-parte'), function (parte) {
      var algum = false;
      [].forEach.call(parte.querySelectorAll('[data-acao]'), function (b) {
        var sim = !!vale[b.getAttribute('data-acao')];
        b.classList.toggle('oculto', !sim);
        if (sim) algum = true;
      });
      parte.classList.toggle('oculto', !algum);
      tem[parte.getAttribute('data-parte')] = algum;
    });
    var titulos = dd.querySelectorAll('.escala-edicao-opcoes-titulo');
    titulos[0].textContent = cfg.tipo === 'sem' ? RosterWork.mensagens.escala.semFuncaoRotulo
      : cfg.posto && cfg.funcao ? ed().funcaoNoPosto(cfg.funcao, cfg.posto) : '';
    titulos[1].textContent = m ? L().noDia(nome, diaMes(ed().iso())) : '';
    dd.querySelector('.escala-edicao-opcoes-ver-funcoes').textContent = m ? L().verFuncoesDe(nome) : '';
    dd.querySelector('.escala-edicao-opcoes-ver-companhia').textContent = cfg.companhia ? L().verDiaNa(cfg.companhia.nome) : '';
    dd.querySelector('.escala-edicao-opcoes-devolver').textContent = cfg.origem ? L().devolverA(cfg.origem) : '';
    /* o traço entre a parte do lugar e a do dia, só com as duas */
    dd.querySelector('.escala-edicao-opcoes-traco-dia').classList.toggle('oculto', !(tem.funcao && tem.dia));
    dd.querySelector('.escala-edicao-opcoes-traco').classList.toggle('oculto', !(tem.ver && (tem.funcao || tem.dia)));
    /* o Mudar de unidade depende das unidades da companhia (lidas uma vez): chegando com o menu aberto, ele se refaz */
    var R = RosterWork.escalasPainelRemanejar;
    if (R && !R.unidadesProntas()) {
      R.prepararUnidades().then(function () { if (dd.isConnected && dd.classList.contains('dropdown--aberto')) preparar(dd, cfg); });
    }
  }

  /* ---------- o que cada item faz ---------- */

  /* o cartão embaixo da linha: modo 'quem' (o militar e o horário), 'horario' (só o horário) ou 'funcao' (para qual função) */
  function cartao(cfg, modo) {
    if (!RosterWork.escalasPainelLinha) return;
    RosterWork.escalasPainelLinha.abrir({
      linha: cfg.linha, grupo: cfg.grupo(), modo: modo, tipo: cfg.tipo === 'vaga' ? 'vaga' : cfg.tipo === 'sem' ? 'sem' : 'funcao',
      posto: cfg.posto || null, funcao: cfg.funcao || null, rotulo: cfg.rotulo || null, militar: cfg.militar || null,
      periodos: (cfg.periodos || []).map(copiar)
    });
  }

  /* Remover do dia e Dar folga: o caminho da tela do Remover do dia para o serviço dele no dia todo (pelo ciclo e no Dar
     folga de quem está por troca, a pergunta do banco de horas embaixo da linha; com mais perguntas, a sub-tela já com ele) */
  function removerDoDia(cfg, folga) {
    var api = ed(), mil = api.militarDoDia(cfg.militar.cpf);
    if (!mil || !RosterWork.escalasPainelRemover) return;
    RosterWork.escalasPainelRemover.doDia({ cpf: mil.cpf, periodos: mil.janelas.map(copiar), folga: !!folga }, cfg.linha);
  }

  /* a mudança de dia ainda no rascunho ('vem' ou 'sai'): sair dela é largá-la, na hora, com o Desfazer */
  function largarMudanca(cpf, sentido, senao) {
    if (ed().mudancaNoRascunho(cpf) !== sentido) { senao(); return; }
    ed().mudar(function () { ed().largarMudancaDia(cpf); });
  }

  /* Cancelar a folga (ele volta ao serviço no horário dela) e Desfazer a mudança (o serviço volta para este dia e sai do
     dia novo): na hora, com o Desfazer; a linha da caixa De folga e a riscada da célula usam as mesmas */
  function cancelarFolga(cfg) {
    ed().mudar(function () { ed().cancelarFolga(cfg.folga.lancamento_id); });
  }
  function desfazerMudanca(cfg) {
    var m = cfg.folga && cfg.folga.mudanca;
    largarMudanca(cfg.militar.cpf, 'sai', function () {
      if (m) ed().mudar(function () { ed().desfazerMudanca(m.id, String(m.para_iso || '').slice(0, 10)); });
    });
  }

  /* a saída marcada da linha: a da linha riscada ou a de quem faz neste dia o último serviço antes dela (a leitura do
     dia): { saida, ultimo, dias } */
  function saidaDa(cfg) {
    if (cfg.tipo === 'saida') return { saida: cfg.saida, ultimo: cfg.ultimo || null, dias: cfg.dias || [] };
    return RosterWork.escalasPainelCiclo.saidaMarcada(cfg.militar.cpf);
  }
  /* Cancelar a saída (na hora, com o Desfazer) e Mudar a saída (a pergunta Último serviço embaixo da linha; na célula,
     opcoes = { dentro, aoCancelar }, dentro da caixa 2): as guarnições do painel (escalas-painel-ciclo.js); a célula usa
     as mesmas */
  function cancelarSaida(cfg) {
    var s = saidaDa(cfg);
    if (s) RosterWork.escalasPainelCiclo.cancelarSaida(cfg.militar, s.saida);
  }
  function mudarSaida(cfg, opcoes) {
    var s = saidaDa(cfg);
    if (s) RosterWork.escalasPainelCiclo.perguntarMudarSaida(cfg.militar, s, opcoes && opcoes.dentro ? null : cfg.linha, opcoes);
  }

  var ACOES = {
    'por-outro': function (cfg) { cartao(cfg, 'quem'); },
    'por-aqui': function (cfg) { cartao(cfg, 'quem'); },
    'outra-funcao': function (cfg) { cartao(cfg, 'funcao'); },
    'por-funcao': function (cfg) { cartao(cfg, 'funcao'); },
    'horario-funcao': function (cfg) { cartao(cfg, 'horario'); },
    liberar: function (cfg) { ed().mudar(function () { A().liberar(cfg); }); },
    'remover-funcao': function (cfg) { ed().mudar(function () { A().tirarDaFuncao(cfg, cfg.periodos.map(copiar)); }); },
    'horario-dia': function (cfg) { RosterWork.escalasPainelHorarioDia.abrir({ cpf: cfg.militar.cpf }); },
    'onde-estagio': function (cfg) { RosterWork.escalasPainelOnde.abrirEstagio({ cpf: cfg.militar.cpf }); },
    'mudar-dia': function (cfg) { RosterWork.escalasPainelMudarDia.abrir({ cpf: cfg.militar.cpf }); },
    'mudar-unidade': function (cfg) { RosterWork.escalasPainelRemanejar.abrir({ cpf: cfg.militar.cpf }); },
    'oficial-area': function (cfg) { RosterWork.escalasCelulaOficial.perguntarNaLinha(cfg.militar.cpf, cfg.linha); },
    'registrar-troca': function (cfg) { ed().registrarTroca(cfg.militar.cpf); },
    'mudar-extra': function () { RosterWork.escalasPainel.abrirAba('extra'); },
    'remover-dia': function (cfg) { largarMudanca(cfg.militar.cpf, 'vem', function () { removerDoDia(cfg); }); },
    'folga-dia': function (cfg) { removerDoDia(cfg, true); },
    /* o Remover da guarnição, o Mudar a saída e o Cancelar a saída: as guarnições do painel (escalas-painel-ciclo.js) */
    'remover-guarnicao': function (cfg) { RosterWork.escalasPainelCiclo.perguntarSaida(cfg.militar, cfg.linha); },
    'mudar-saida': function (cfg) { mudarSaida(cfg); },
    'cancelar-saida': cancelarSaida,
    'cancelar-folga': cancelarFolga,
    'desfazer-mudanca': desfazerMudanca,
    /* a linha da mudança, pelo dia de antes: o Mudar o dia com a mudança (a sub-tela) e o Dar folga (embaixo da linha) */
    'mudar-mudanca': function (cfg) {
      var MD = RosterWork.escalasPainelMudarDia;
      MD.abrir({ cpf: cfg.militar.cpf, mudanca: MD.mudancaDaFolga(cfg.folga, ed().iso()) });
    },
    'folga-mudanca': function (cfg) {
      var R = RosterWork.escalasPainelRemover;
      R.doDia(null, cfg.linha, R.analisarFolgaDaMudanca(cfg.folga));
    },
    /* quem foi remanejado daqui: a tela do Remover do dia, já com ele (Devolver ou Tirar do dia) */
    devolver: function (cfg) { RosterWork.escalasPainelRemover.abrir({ cpf: cfg.militar.cpf }); },
    /* a outra aba, já com o menu dele aberto */
    'ver-funcoes': function (cfg) { ed().verMilitar(cfg.militar.cpf, 'funcoes'); },
    /* o Oficial de Área no pelotão: o dia dele é o da companhia; abre o dia dela, na aba Militares, já com o menu dele */
    'ver-companhia': function (cfg) {
      var cia = cfg.companhia;
      RosterWork.escalasPainel.abrirDia({ unidadeId: cia.id, iso: ed().iso(), unidadeNome: cia.nome, unidadeCidade: cia.cidade },
        'militares', { abrirMenuDe: cfg.militar.cpf });
    }
  };

  /* um item da linha (o clique no menu, ou por código) */
  function fazer(linha, acao) {
    var cfg = cfgs.get(linha);
    if (!cfg || !linha.isConnected || !ACOES[acao] || !ed().livre()) return;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    /* a pergunta do Remover da guarnição aberta em outra linha fica respondida; a do Pôr como Oficial de Área fecha */
    if (RosterWork.escalasPainelCiclo && RosterWork.escalasPainelCiclo.fecharPergunta) RosterWork.escalasPainelCiclo.fecharPergunta('guardar');
    if (RosterWork.escalasCelulaOficial) RosterWork.escalasCelulaOficial.fecharPergunta();
    ACOES[acao](cfg);
  }

  /* ---------- a linha ---------- */

  function na(linha, cfg) {
    var lugar = linha && linha.querySelector('.escala-edicao-acoes');
    if (!lugar) return;
    cfg.visao = cfg.visao || 'funcoes';
    /* as unidades da companhia (o Mudar de unidade) já começam a ser lidas para quando o menu abrir */
    if (cfg.visao === 'militares' && RosterWork.escalasPainelRemanejar && !RosterWork.escalasPainelRemanejar.unidadesProntas()) {
      RosterWork.escalasPainelRemanejar.prepararUnidades();
    }
    /* sem nenhum item (o papel especial e a linha que a Central exibe, na aba Funções), a linha fica sem o lápis */
    var vale = itens(cfg);
    if (!Object.keys(vale).some(function (k) { return vale[k]; })) return;
    var dd = RosterWork.tpl('tpl-escala-edicao-opcoes');
    if (!dd) return;
    var lapis = dd.querySelector('.escala-edicao-lapis');
    lapis.setAttribute('aria-label', cfg.militar ? L().editar(nomeDe(cfg.militar)) : L().editarVaga);
    lugar.appendChild(dd);
    linha.classList.add('escala-edicao-linha--menu');
    linha.setAttribute('data-linha', cfg.tipo);   // o tipo da linha (o passo a passo acha a linha certa por ele)
    if (cfg.militar) linha.setAttribute('data-cpf', cfg.militar.cpf);   // o Ver o dia e o Ver as funções acham a linha dele
    cfg.linha = linha;
    cfgs.set(linha, cfg);
    /* o clique no lápis chega aqui antes do ouvinte do document, que abre o menu: antes, só os itens que valem */
    lapis.addEventListener('click', function () { if (!dd.classList.contains('dropdown--aberto')) preparar(dd, cfg); });
    /* o resto da linha também abre o menu (o clique não segue para o document, que fecharia o menu em seguida) */
    linha.addEventListener('click', function (ev) {
      if (ev.target.closest('.dropdown')) return;
      ev.stopPropagation();
      if (!ed().livre()) return;
      if (!dd.classList.contains('dropdown--aberto')) preparar(dd, cfg);
      RosterWork.abrirDropdown(dd);
    });
    [].forEach.call(dd.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(linha, b.getAttribute('data-acao')); });
    });
  }

  /* abre o menu da linha (a outra aba, pelo Ver o dia ou o Ver as funções): ela vai à vista e o menu abre */
  function abrir(linha) {
    var cfg = cfgs.get(linha), dd = linha && linha.querySelector('.escala-edicao-opcoes');
    if (!cfg || !dd || !linha.isConnected) return;
    linha.scrollIntoView({ block: 'nearest' });
    preparar(dd, cfg);
    RosterWork.abrirDropdown(dd);
  }

  /* o menu na caixa flutuante da célula da grade: o mesmo molde e os mesmos itens que valem; escolher(acao, botao) faz o
     item na célula. Devolve o menu (sem o lápis) */
  function menuDaCelula(cfg, escolher) {
    var dd = RosterWork.tpl('tpl-escala-edicao-opcoes');
    if (!dd) return null;
    cfg.visao = 'celula';
    preparar(dd, cfg);
    var menu = dd.querySelector('.escala-edicao-opcoes-menu');
    [].forEach.call(menu.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { escolher(b.getAttribute('data-acao'), b); });
    });
    return menu;
  }

  window.RosterWork.escalasPainelLinhaMenu = { na: na, fazer: fazer, abrir: abrir, menuDaCelula: menuDaCelula,
    largarMudanca: largarMudanca, cancelarFolga: cancelarFolga, desfazerMudanca: desfazerMudanca,
    cancelarSaida: cancelarSaida, mudarSaida: mudarSaida };
})();
