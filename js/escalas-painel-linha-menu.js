/* ============================================================
   ESCALAS — o menu de cada linha do Dia (o lápis; só admin)
   O lápis de cada linha que o administrador edita abre o menu dela,
   embaixo da linha, e a linha inteira também abre (ela fica cinza
   enquanto o menu está aberto: é ela que mostra de quem é o menu).
   Cada menu tem um assunto só, com o título de quem ele é, e os
   itens que valem, cada um com o ícone dele (o que tira alguém por
   último, em vermelho). Na aba Funções, o que é do lugar:
   - militar numa função ("Condutor da ABT-14935"): Pôr outro no lugar
     dele, Mudar para outra função, Mudar o horário nesta função,
     Adicionar mais um lugar neste posto (com lugar livre no posto),
     Liberar para o sistema (o fixado) e Remover desta função;
   - vaga sem ninguém e função aberta: Pôr um militar aqui e Liberar
     para o sistema (a vaga que veio de um Remover desta função);
   - Sem função: Pôr numa função;
   - o Chefe de Socorro e o Oficial de Área sozinhos, e as linhas que a
     Central só exibe, não têm lápis (o lugar é do sistema; o dia
     da pessoa muda na aba Militares); a exceção é o Oficial de Área
     da companhia na Central do pelotão, para quem administra a
     companhia: o Ver o dia na companhia ("Ver o dia na 2ªCIBM") abre o
     dia da companhia na aba Militares, já com o menu dele aberto.
   Na aba Militares, o dia da pessoa ("Cb. Veloso no dia 21/11"):
   Mudar o horário do serviço, Mudar o dia do serviço, Mudar de
   unidade neste dia, Mudar a extrajornada (quem está de extra: abre a
   aba Extrajornada do painel, onde a extra muda), Dar folga neste dia
   (quem está no dia pela guarnição: sair do dia é a folga, na cor
   normal) ou Remover deste dia (o resto, em vermelho) e,
   para quem está no dia pela guarnição, Remover da guarnição (a
   pergunta Último serviço, escalas-painel-ciclo.js); quem foi
   remanejado daqui para outra unidade, o Devolver; quem saiu da
   guarnição (a linha riscada do grupo Saiu da guarnição), o
   Cancelar a saída. No De folga (nas
   duas abas): Cancelar a folga, ou Desfazer a mudança (a folga que
   veio da mudança de dia).
   Embaixo do traço, o Ver o dia (na Funções) ou o Ver as funções (na
   Militares) troca de aba já com o menu dele aberto.
   A mudança de dia ainda não salva (só no rascunho, sem número no
   banco): quem vem de outro dia tem só o Remover deste dia (na Funções,
   só o Ver o dia), e o Desfazer a mudança de quem sai; os dois só a
   largam do rascunho.
   Cada item usa o caminho que já existe: o cartão embaixo da linha
   (escalas-painel-linha.js: o militar, só o horário ou para qual
   função), as sub-telas já com ele escolhido (Mudar o horário do
   serviço, Mudar o dia do serviço, Mudar de unidade neste dia, a do
   Remover do dia para quem foi a outra unidade e a folga no dia), o
   Dar folga e o Remover deste dia (escalas-painel-remover.js › doDia) e, na hora, com o
   Desfazer, o Liberar e o Remover desta função.
   Na célula da grade (visao 'celula', escalas-celula-editar.js), o
   mesmo menu vai para a caixa flutuante: os itens do dia da pessoa
   (e do De folga, da saída e do remanejado), sem o Ver as funções, e
   o Abrir o painel do dia em todos; quem faz cada item é a célula.
   API: RosterWork.escalasPainelLinhaMenu.na(linha, cfg) põe o lápis e o
   menu na linha; fazer(linha, acao) faz um item por código (o lugar
   novo do posto abre o cartão sozinho); abrir(linha) abre o menu dela
   (o Ver o dia e o Ver as funções, na outra aba); menuDaCelula(cfg,
   escolher) devolve o menu pronto para a caixa; largarMudanca(cpf,
   sentido, senao) larga a mudança de dia do rascunho.
   cfg = { tipo: 'funcao' | 'papel' | 'vaga' | 'sem' | 'folga' | 'militar'
   (a linha da aba Militares) | 'fora' (remanejado daqui para outra
   unidade) | 'saida' (quem saiu da guarnição; saida = a data da saída) | 'companhia' (o Oficial de Área da companhia na Central do
   pelotão), visao: 'funcoes' | 'militares', grupo() (o bloco da função
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
    r['mudar-extra'] = !!mil && mil.janelas.some(function (j) { return j.origem === 'extra'; }) && RW.escalasPainel.temAba('extra');
    /* sair do dia: pelo ciclo é a folga (Dar folga neste dia); o pontual e o resto, o Remover deste dia (o mesmo caminho) */
    var tirar = !!RW.escalasPainelRemover && RW.escalasPainelRemover.podeTirar(cpf);
    var analise = tirar && mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: mil.janelas.map(copiar) }) : null;
    r['folga-dia'] = !!analise && analise.tipo === 'folga';
    r['remover-dia'] = tirar && !r['folga-dia'];
    r['remover-guarnicao'] = !!RW.escalasPainelCiclo && RW.escalasPainelCiclo.podeSair(cpf);
  }

  /* os itens que valem para a linha: { acao: true }. Na aba Funções, só o que é do lugar (e o Ver o dia); na Militares,
     só o dia da pessoa (e o Ver as funções); o De folga é igual nas duas */
  function itens(cfg) {
    /* a célula da grade: os mesmos da aba Militares, sem o Ver as funções, e o Abrir o painel do dia em todos */
    if (cfg.visao === 'celula') {
      var c = itens(Object.assign({}, cfg, { visao: 'militares' }));
      delete c['ver-funcoes'];
      delete c['ver-dia'];
      c['abrir-painel'] = true;
      return c;
    }
    var r = {}, m = cfg.militar, militares = cfg.visao === 'militares';
    /* quem vem de outro dia e ainda não foi salvo: só sair deste dia (o rascunho larga a mudança), pela aba Militares */
    if (m && cfg.tipo !== 'folga' && cfg.tipo !== 'saida' && ed().mudancaNoRascunho(m.cpf) === 'vem') {
      return militares ? { 'remover-dia': true, 'ver-funcoes': true } : cfg.tipo === 'papel' ? {} : { 'ver-dia': true };
    }
    if (cfg.tipo === 'funcao') {
      r['por-outro'] = true;
      r['outra-funcao'] = true;
      r['horario-funcao'] = true;
      r['mais-um'] = ((cfg.posto && cfg.posto.livres) || []).length > 0;
      r.liberar = A().podeLiberar(cfg);
      r['remover-funcao'] = true;
      r['ver-dia'] = true;
    } else if (cfg.tipo === 'vaga') {
      r['por-aqui'] = true;
      r.liberar = A().podeLiberar(cfg);
    } else if (cfg.tipo === 'sem') {
      r['por-funcao'] = true;
      r['ver-dia'] = true;
    } else if (cfg.tipo === 'folga') {
      var mudanca = !!(cfg.folga && cfg.folga.mudanca);
      r['cancelar-folga'] = !mudanca;
      r['desfazer-mudanca'] = mudanca;
    } else if (cfg.tipo === 'militar' && m) {
      itensDoDia(m.cpf, r);
      r['ver-funcoes'] = true;
    } else if (cfg.tipo === 'saida') {
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
    dd.querySelector('.escala-edicao-opcoes-ver-dia').textContent = m ? L().verDiaDe(nome) : '';
    dd.querySelector('.escala-edicao-opcoes-ver-funcoes').textContent = m ? L().verFuncoesDe(nome) : '';
    dd.querySelector('.escala-edicao-opcoes-ver-companhia').textContent = cfg.companhia ? L().verDiaNa(cfg.companhia.nome) : '';
    dd.querySelector('.escala-edicao-opcoes-devolver').textContent = cfg.origem ? L().devolverA(cfg.origem) : '';
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

  /* Remover do dia: o caminho da tela do Remover do dia para o serviço dele no dia todo (pelo ciclo, a pergunta do banco de horas
     embaixo da linha; com mais perguntas, a sub-tela já com ele) */
  function removerDoDia(cfg) {
    var api = ed(), mil = api.militarDoDia(cfg.militar.cpf);
    if (!mil || !RosterWork.escalasPainelRemover) return;
    RosterWork.escalasPainelRemover.doDia({ cpf: mil.cpf, periodos: mil.janelas.map(copiar) }, cfg.linha);
  }

  function folga(cfg, escolha) {
    if (RosterWork.escalasPainelMilitar) RosterWork.escalasPainelMilitar.abrirFolga(cfg.folga.lancamento_id, { escolha: escolha });
  }

  /* a mudança de dia ainda no rascunho ('vem' ou 'sai'): sair dela é largá-la, na hora, com o Desfazer */
  function largarMudanca(cpf, sentido, senao) {
    if (ed().mudancaNoRascunho(cpf) !== sentido) { senao(); return; }
    ed().mudar(function () { ed().largarMudancaDia(cpf); });
  }

  var ACOES = {
    'por-outro': function (cfg) { cartao(cfg, 'quem'); },
    'por-aqui': function (cfg) { cartao(cfg, 'quem'); },
    'outra-funcao': function (cfg) { cartao(cfg, 'funcao'); },
    'por-funcao': function (cfg) { cartao(cfg, 'funcao'); },
    'horario-funcao': function (cfg) { cartao(cfg, 'horario'); },
    'mais-um': function (cfg) { ed().abrirLugar(cfg.posto); },
    liberar: function (cfg) { ed().mudar(function () { A().liberar(cfg); }); },
    'remover-funcao': function (cfg) { ed().mudar(function () { A().tirarDaFuncao(cfg, cfg.periodos.map(copiar)); }); },
    'horario-dia': function (cfg) { RosterWork.escalasPainelHorarioDia.abrir({ cpf: cfg.militar.cpf }); },
    'mudar-dia': function (cfg) { RosterWork.escalasPainelMudarDia.abrir({ cpf: cfg.militar.cpf }); },
    'mudar-unidade': function (cfg) { RosterWork.escalasPainelRemanejar.abrir({ cpf: cfg.militar.cpf }); },
    'mudar-extra': function () { RosterWork.escalasPainel.abrirAba('extra'); },
    'remover-dia': function (cfg) { largarMudanca(cfg.militar.cpf, 'vem', function () { removerDoDia(cfg); }); },
    'folga-dia': function (cfg) { removerDoDia(cfg); },
    /* o Remover da guarnição e o Cancelar a saída (a linha riscada de quem saiu): as guarnições do painel (escalas-painel-ciclo.js) */
    'remover-guarnicao': function (cfg) { RosterWork.escalasPainelCiclo.perguntarSaida(cfg.militar, cfg.linha); },
    'cancelar-saida': function (cfg) { RosterWork.escalasPainelCiclo.cancelarSaida(cfg.militar, cfg.saida); },
    'cancelar-folga': function (cfg) { folga(cfg, 'cancelar'); },
    'desfazer-mudanca': function (cfg) { largarMudanca(cfg.militar.cpf, 'sai', function () { folga(cfg, 'desfazer'); }); },
    /* quem foi remanejado daqui: a tela do Remover do dia, já com ele (Devolver ou Tirar do dia) */
    devolver: function (cfg) { RosterWork.escalasPainelRemover.abrir({ cpf: cfg.militar.cpf }); },
    /* a outra aba, já com o menu dele aberto */
    'ver-dia': function (cfg) { ed().verMilitar(cfg.militar.cpf, 'militares'); },
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
    /* a pergunta do Remover da guarnição aberta em outra linha fica respondida */
    if (RosterWork.escalasPainelCiclo && RosterWork.escalasPainelCiclo.fecharPergunta) RosterWork.escalasPainelCiclo.fecharPergunta('guardar');
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
    largarMudanca: largarMudanca };
})();
