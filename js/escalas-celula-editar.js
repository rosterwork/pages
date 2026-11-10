/* ============================================================
   ESCALAS — a edição rápida na célula da grade (Agenda, Calendário,
   Colunas e Semana), para quem administra o dia, com o painel do dia
   fechado. O mais feito se faz no próprio bloco do pelotão, no
   rascunho do Dia (escalas-painel-editar.js, sem a lista: o mesmo
   rascunho, a mesma prévia e o mesmo Salvar do rodapé largo):
   - o clique no nome de quem tem um horário só no dia, pelo ciclo ou
     pontual, abre o cartão dele ali: o nome e, colado embaixo, no
     mesmo fundo cinza, o horário em campos (sem barra e sem cadeado)
     e, no canto direito, a lixeira (Remover do dia). O horário é o
     cálculo do Mudar o horário do serviço do painel
     (escalas-painel-horario-dia.js › criar): pelo ciclo, as horas que
     saem viram folga, com a pergunta do banco de horas (o Não
     descontar primeiro e marcado); no pontual, o banco começa na
     escolha de antes. A lixeira é o Remover do dia do menu da linha
     (escalas-painel-remover.js › analisarDoDia): pelo ciclo, ele sai
     do dia, de folga, com a mesma pergunta; o pontual sai, ou antes
     responde se as horas dele saem do banco;
   - o clique em quem não muda por aqui (troca, extra, remanejado,
     mudança de dia, dois horários, folga) abre o painel do dia na
     aba Militares, com o menu dele;
   - o clique no pelotão, fora dos nomes, marca o bloco com Adicionar
     somente nesse dia (o campo de militar com quem tem horas livres
     no dia, por pelotão, o do bloco primeiro: escolhido, ele entra
     nas horas livres dele, o sistema distribui o dia, como o
     Adicionar do painel, e o cartão dele abre, com o banco de horas
     em Contabilizar) e Abrir o painel do dia (o painel continua o
     que a célula mexeu).
   Enquanto se responde, a mudança fica no rascunho ao vivo; o clique
   fora e o Esc fecham: o que está concluído fica (um passo do
   desfazer), o que ficou pela metade sai. Um dia por vez: mexer em
   outro dia com mudança não salva pergunta antes, como no painel.
   Quem só lê, o dia de mais de 7 dias atrás, o dia na fila do
   recálculo, o painel já aberto e o Calendário do celular abrem o
   painel, como sempre. Não cria HTML (clona os moldes do
   escalas.html) nem escreve estilo (só classList).
   RosterWork.escalasCelulaEditar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* as linhas riscadas (e a do afastado): não mudam pela célula */
  var RISCADAS = '.linha-escalado--folga, .linha-escalado--trocado, .linha-escalado--remanejado, .linha-escalado--mudou-dia, .linha-escalado--saiu, .linha-escalado--afastamento';

  var dia = null;       // o dia da célula, com o rascunho no Dia: { unidadeId, iso, unidadeNome, unidadeCidade }
  var marcado = null;   // o pelotão marcado, com as ações: { unidadeId, iso, adicionando }
  var aberto = null;    // o cartão aberto: { cpf, esperando, novo, modo: 'horario' | 'remover', sessao, remocao, escolha }
  var livres = null;    // quem tem horas livres no dia do pelotão marcado (o Adicionar): a leitura, false (falhou) ou null
  var pedido = 0;       // só a leitura mais nova das horas livres vale
  var conta = 0;        // nome único para os rádios e o campo de cada cartão
  var ligado = false;   // o clique fora e o Esc, ligados uma vez

  function E() { return RW.escalasPainelEditar; }
  function api() { return RW.escalasPainelEditar.sub; }
  function S() { return RW.escalasPainelSalvar; }
  function msg() { return RW.mensagens.escala; }
  function L() { return RW.mensagens.escala.linha; }
  function mesmo(a, unidadeId, iso) { return !!a && String(a.unidadeId) === String(unidadeId) && a.iso === iso; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  function diaDe(cel) {
    return { unidadeId: cel.dataset.unidadeId, iso: cel.dataset.iso, unidadeNome: cel.dataset.unidadeNome || '',
      unidadeCidade: cel.dataset.unidadeCidade || '' };
  }

  /* ---------- quando a célula edita ---------- */

  /* a grade da Escala (a Extrajornada também preenche células com o escalas-celula.js; a grade nova pode ser montada antes
     de entrar na tela) */
  function naEscala(cel) {
    return !!cel && !!document.querySelector('.conteudo #escala-modos') && !cel.closest('#p3-cal');
  }

  /* o dia mais antigo que se mexe (hoje − 7) */
  function limite() {
    var h = new Date();
    return RW.data.paraIsoDeData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 7));
  }

  /* a célula edita este dia? Senão, o painel abre, como sempre */
  function podeNaCelula(cel) {
    if (!naEscala(cel) || !cel.classList.contains('escala-mes-celula')) return false;
    if (RW.painel && RW.painel.estaAberto()) return false;
    var uid = cel.dataset.unidadeId, iso = cel.dataset.iso;
    if (!RW.sessao || !RW.sessao.podeAdministrar('pelotao', uid)) return false;
    if (iso < limite()) return false;
    if (RW.escalaAtualizando && RW.escalaAtualizando.pendente(uid, iso)) return false;
    if (RW.celular && RW.celular() && cel.closest('.escala-calendario-unidade')) return false;
    return true;
  }

  /* ---------- o dia da célula (o rascunho do Dia, sem a lista) ---------- */

  function ativo() { return !!dia && !!api().celula() && mesmo(api().celula(), dia.unidadeId, dia.iso); }

  /* começa (ou continua) o dia da célula; seguir() roda com o dia já aberto. Mudança não salva em outro dia: a pergunta de
     descartar antes (Continuar editando fica como está) */
  function irPara(cel, seguir) {
    var d = diaDe(cel);
    if (ativo() && mesmo(dia, d.unidadeId, d.iso)) { seguir(); return; }
    function comecar() {
      fecharTudo('largar');
      dia = d;
      E().montar(null, null, d.unidadeId, d.iso, { admin: true, semLista: true, aoMostrar: chegou });
      seguir();
    }
    if (S() && S().pendente()) {
      RW.escalasPainel.confirmarDescarte(function () {
        E().reset();
        S().descartar();
        comecar();
      }, S().contarDoDia());
      return;
    }
    comecar();
  }

  /* a leitura do dia (ou a prévia) chegou ao rascunho: o cartão que esperava abre, e o campo do Adicionar ganha a lista;
     null: a leitura falhou */
  function chegou(dados) {
    if (!dados) {
      RW.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar });
      fecharTudo('largar');
      return;
    }
    if (aberto && aberto.esperando) { abrirCartao(); return; }
    if (marcado && marcado.adicionando) redesenhar();
  }

  /* ---------- o cartão do militar ---------- */

  /* o cartão abre com o horário dele (a sessão do Mudar o horário do serviço). Quem não muda por aqui: o painel, com o
     menu dele (quem acabou de entrar com dois pedaços de horas livres fica só na grade) */
  function abrirCartao() {
    var a = aberto;
    if (!a) return;
    if (!api().livre() || api().carregando()) { a.esperando = true; redesenhar(); return; }
    var sessao = RW.escalasPainelHorarioDia.criar(a.cpf, { sempreBanco: !!a.novo });
    if (!sessao) {
      aberto = null;
      redesenhar();
      if (!a.novo && dia) abrirPainel(dia, a.cpf);
      return;
    }
    a.esperando = false;
    a.modo = 'horario';
    a.sessao = sessao;
    api().comecarVivo();
    sessao.lerLivres(function () { if (aberto === a && a.modo === 'horario') redesenhar(); });
    redesenhar();
  }

  /* a resposta do cartão está pela metade? (o horário fora de onde ele pode ficar, ou a pergunta do pontual sem resposta) */
  function pelaMetade(a) {
    if (a.modo === 'horario') {
      var c = a.sessao.calcular();
      return !c.ok || (c.pergunta && !a.sessao.est.banco);
    }
    return a.modo === 'remover' && a.remocao.tipo === 'pontual' && !a.escolha;
  }

  /* o cartão fecha: o que está concluído fica no rascunho (um passo do desfazer) e o dia é lido de novo com ele; o que
     ficou pela metade sai. 'guardar': fica, sem ler de novo (o painel vai abrir no dia); 'largar': sai tudo (o rascunho já
     foi gravado ou descartado) */
  function fecharCartao(modo) {
    var a = aberto;
    aberto = null;
    if (!a || !a.modo || !api().celula()) return;
    if (modo === 'largar') { api().largarVivo(); return; }
    if (pelaMetade(a)) api().aoVivo(null, false);
    if (api().terminarVivo() && modo !== 'guardar') api().redesenhar();
  }

  /* o horário mudou num campo: a mudança vai ao rascunho ao vivo, e o cartão mostra a pergunta, quando vale */
  function mudouHorario() {
    var a = aberto;
    if (!a || a.modo !== 'horario') return;
    a.sessao.aplicar();
    redesenhar();
  }

  /* a lixeira: o Remover do dia do menu da linha, para o dia todo dele (o horário mexido no cartão sai antes). Pelo ciclo, ele
     sai de folga, com o Não descontar já escolhido; o pontual sai, ou antes responde se as horas saem do banco */
  function lixeira() {
    var a = aberto;
    if (!a || a.modo !== 'horario') return;
    api().aoVivo(null, false);
    var mil = api().militarDoDia(a.cpf);
    var r = mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: mil.cpf, periodos: mil.janelas.map(copiar) }) : null;
    if (!r || r.tipo === 'subtela') {
      var d = dia;
      fecharTudo();
      if (r && d) abrirPainel(d, a.cpf);
      return;
    }
    if (r.tipo === 'sai') {
      api().aoVivo(r.aplicar, false);
      fecharTudo();
      return;
    }
    a.modo = 'remover';
    a.sessao = null;
    a.remocao = r;
    a.escolha = r.padrao;
    if (r.padrao) api().aoVivo(function () { r.aplicar(r.padrao); }, false);
    redesenhar();
  }

  /* a resposta da pergunta do cartão */
  function responder(valor) {
    var a = aberto;
    if (!a) return;
    if (a.modo === 'horario') {
      a.sessao.est.banco = valor;
      mudouHorario();
      return;
    }
    if (a.modo !== 'remover') return;
    a.escolha = valor;
    api().aoVivo(function () { a.remocao.aplicar(valor); }, false);
    /* o pontual respondido sai do dia: não sobra linha para o cartão */
    if (a.remocao.tipo === 'pontual') { fecharTudo(); return; }
    redesenhar();
  }

  /* a pergunta do cartão: a frase (vazia, só as respostas) e as duas respostas; naoPrimeiro: a folga (o Não descontar em
     cima); o Contabilizar e o Tirar as horas vêm em cima */
  function pergunta(caixa, cfg) {
    var q = function (s) { return caixa.querySelector(s); };
    var texto = q('.escala-celula-pergunta-texto'), sim = q('.escala-celula-pergunta-sim'), nao = q('.escala-celula-pergunta-nao');
    texto.textContent = cfg.texto || '';
    texto.classList.toggle('oculto', !cfg.texto);
    sim.textContent = cfg.sim;
    nao.textContent = cfg.nao;
    var opSim = sim.closest('.geral-opcao'), opNao = nao.closest('.geral-opcao');
    if (cfg.naoPrimeiro) opSim.parentNode.insertBefore(opNao, opSim);
    else opNao.parentNode.insertBefore(opSim, opNao);
    var nome = 'escala-celula-pergunta-' + (++conta);
    [].forEach.call(caixa.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.checked = r.value === cfg.escolha;
      r.addEventListener('change', function () { if (r.checked) responder(r.value); });
    });
    caixa.classList.remove('oculto');
  }

  /* o cartão embaixo do nome: os pontos enquanto o dia é lido; depois, o horário em campos e a lixeira, e a pergunta do
     banco de horas, quando vale; no Remover do dia, só a pergunta */
  function cartao() {
    var a = aberto, el = RW.tpl('tpl-escala-celula-cartao');
    if (!el) return null;
    var q = function (s) { return el.querySelector(s); };
    var horario = q('.escala-celula-cartao-horario'), espera = q('.escala-celula-espera'), caixa = q('.escala-celula-pergunta');
    if (a.esperando || !a.modo) { horario.classList.add('oculto'); return el; }
    espera.classList.add('oculto');
    if (a.modo === 'remover') {
      horario.classList.add('oculto');
      pergunta(caixa, { texto: a.remocao.texto, sim: a.remocao.sim, nao: a.remocao.nao, naoPrimeiro: a.remocao.tipo === 'folga',
        escolha: a.escolha });
      return el;
    }
    var s = a.sessao, c = s.calcular();
    var campos = RW.horario.linha({
      hi: s.est.periodo.hi, hf: s.est.periodo.hf, opcoes: s.opcoes(), erro: !c.ok, semAcoes: true,
      aoInicio: function (h) { s.est.periodo.hi = h; mudouHorario(); },
      aoFim: function (h) { s.est.periodo.hf = h; mudouHorario(); }
    });
    if (campos) horario.insertBefore(campos, horario.firstChild);
    q('.escala-celula-remover').addEventListener('click', lixeira);
    if (c.pergunta) {
      pergunta(caixa, s.pontual
        ? { texto: '', sim: c.sim, nao: RW.mensagens.botoes.naoContabilizar, naoPrimeiro: false, escolha: s.est.banco }
        : { texto: RW.escalasPainelRemoverListas.textoFolga(c.folga.periodos, s.nome, c.folga.horas, diaMes(dia.iso)),
          sim: c.sim, nao: L().naoDescontar, naoPrimeiro: true, escolha: s.est.banco });
    }
    return el;
  }

  /* ---------- o pelotão marcado ---------- */

  function cliqueNoBloco(cel) {
    var d = diaDe(cel);
    if (marcado && mesmo(marcado, d.unidadeId, d.iso)) return;
    fecharTudo();
    marcado = { unidadeId: d.unidadeId, iso: d.iso, adicionando: false };
    redesenhar();
  }

  /* as ações embaixo dos nomes: Adicionar somente nesse dia (ou o campo, já aberto) e Abrir o painel do dia */
  function acoes(cel) {
    var caixa = RW.tpl('tpl-escala-celula-acoes'), d = diaDe(cel);
    if (!caixa) return null;
    var adicionar = caixa.querySelector('[data-acao="adicionar"]');
    caixa.querySelector('[data-acao="painel"]').addEventListener('click', function () { fecharTudo(); abrirPainel(d, null); });
    if (marcado.adicionando) caixa.replaceChild(campo(), adicionar);
    else adicionar.addEventListener('click', function () { comecarAdicionar(cel); });
    return caixa;
  }

  /* o Adicionar somente nesse dia: o dia da célula abre (com a pergunta de descartar, se outro dia tem mudança) e a lista
     de quem tem horas livres é lida */
  function comecarAdicionar(cel) {
    var d = diaDe(cel);
    irPara(cel, function () {
      marcado = { unidadeId: d.unidadeId, iso: d.iso, adicionando: true };
      lerLivres();
      redesenhar();
    });
  }

  function lerLivres() {
    var m = marcado, meu = ++pedido;
    livres = null;
    RW.escalasDados.disponiveis(m.unidadeId, m.iso, m.unidadeId).then(function (r) {
      if (meu !== pedido || marcado !== m) return;
      livres = r || false;
      redesenhar();
    });
  }

  /* quem tem horas livres no dia, por pelotão (o do bloco primeiro; a leitura já vem nessa ordem), fora quem já entrou */
  function lista() {
    var Ls = RW.escalasPainelAdicionarListas, r = [];
    Ls.unidadesDia(livres).forEach(function (u) {
      var itens = Ls.dia(livres, u.id);
      if (itens.length) r = r.concat([{ titulo: u.nome }], itens);
    });
    return r;
  }

  /* o campo de militar no lugar do Adicionar: a lista, quando o dia e as horas livres chegam (antes, o Carregando) */
  function campo() {
    var caixa = RW.tpl('tpl-escala-celula-adicionar');
    var inp = caixa.querySelector('input'), menu = caixa.querySelector('.dropdown-menu');
    inp.id = 'escala-celula-adicionar-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return null; },
      aoEscolher: escolher,
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
    });
    if (livres === false) { combo.habilitar(false); combo.definir(msg().falhaCarregar, true); return caixa; }
    if (!livres || !api().livre() || api().carregando()) { combo.habilitar(false); combo.definir(L().carregando, true); return caixa; }
    if (!combo.preencher(lista())) return caixa;
    /* o campo abre com a lista depois que o bloco volta à tela */
    requestAnimationFrame(function () { if (!inp.isConnected || inp.disabled) return; inp.focus(); combo.abrir(); });
    return caixa;
  }

  /* escolhido o nome: ele entra no dia nas horas livres dele, o sistema distribui o dia (como o Adicionar do painel), com
     as horas no banco; o cartão dele abre quando o dia vem com ele */
  function escolher(item) {
    var m = item.m;
    var periodos = (m.livres || []).length ? m.livres.map(copiar) : [{ hi: '08:00', hf: '08:00' }];
    marcado = null;
    livres = null;
    aberto = { cpf: item.cpf, esperando: true, novo: true };
    api().mudar(function () {
      api().aplicarColocacao({ cpf: item.cpf, periodos: periodos, sistema: true, refazer: true, pontual: { contabilizar: true } });
    });
    redesenhar();
  }

  /* ---------- o painel ---------- */

  /* o painel do dia (cpf: na aba Militares, com o menu dele); no mesmo dia, ele continua o que a célula mexeu */
  function abrirPainel(d, cpf) {
    RW.escalasPainel.abrirDia(d, cpf ? 'militares' : null, cpf ? { abrirMenuDe: cpf } : null);
  }

  /* ---------- o clique ---------- */

  function cliqueNoNome(cel, linha) {
    var cpf = linha.getAttribute('data-cpf'), d = diaDe(cel);
    if (aberto && mesmo(dia, d.unidadeId, d.iso) && aberto.cpf === cpf) return;   // o mesmo cartão: fica
    fecharTudo();
    if (linha.matches(RISCADAS)) { abrirPainel(d, cpf); return; }
    irPara(cel, function () {
      aberto = { cpf: cpf, esperando: true };
      abrirCartao();
    });
  }

  /* o clique numa célula (escalas-painel.js): true quando é da célula; false, o painel abre, como sempre */
  function clique(ev, cel) {
    if (!podeNaCelula(cel)) return false;
    ligar();
    var t = ev.target;
    if (t.closest('.escala-celula-cartao, .escala-celula-acoes')) return true;   // os botões do cartão e do bloco
    var linha = t.closest('.linha-escalado[data-cpf]');
    if (linha) cliqueNoNome(cel, linha);
    else cliqueNoBloco(cel);
    return true;
  }

  /* fecha o cartão e tira a marca do pelotão (modo: o do fecharCartao) */
  function fecharTudo(modo) {
    fecharCartao(modo);
    marcado = null;
    livres = null;
    pedido++;
    redesenhar();
  }

  /* o clique fora das células e do que é delas, e o Esc, fecham (ligados uma vez) */
  function ligar() {
    if (ligado) return;
    ligado = true;
    document.addEventListener('click', function (ev) {
      if (!aberto && !marcado) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('.escala-celula-cartao, .escala-celula-acoes, .dropdown-menu, .modal-veu, .guia-balao, .guia-vidro, .treino-barra')) return;
      /* o clique numa célula é dela (outro nome, o pelotão ou o mesmo nome) */
      if (t.closest('.conteudo .escala-mes-celula, .conteudo .escala-calendario-unidade')) return;
      fecharTudo();
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || (!aberto && !marcado)) return;
      if (document.querySelector('.dropdown--aberto, .modal-veu--aberto')) return;
      fecharTudo();
    });
  }

  /* ---------- o desenho ---------- */

  /* tira da célula o que é daqui (o cartão, as ações, o nome aberto e a marca do pelotão) */
  function tirar(cel) {
    [].forEach.call(cel.querySelectorAll('.escala-celula-cartao, .escala-celula-acoes'), function (e) { e.remove(); });
    [].forEach.call(cel.querySelectorAll('.linha-escalado--aberta'), function (l) { l.classList.remove('linha-escalado--aberta'); });
    if (cel.hasAttribute('data-celula-marcada')) {
      cel.removeAttribute('data-celula-marcada');
      cel.classList.remove('escala-mes-celula--selecionada');
    }
  }

  /* a linha dele no bloco: a de serviço; a riscada da folga só quando é a única (depois da lixeira) */
  function linhaDe(cel, cpf) {
    var todas = cel.querySelectorAll('.linha-escalado[data-cpf="' + cpf + '"]');
    var deServico = [].filter.call(todas, function (l) { return !l.matches(RISCADAS); })[0];
    return deServico || todas[0] || null;
  }

  /* a célula da grade (refeita pelo escalas-celula.js, ou depois de uma mudança daqui): o cartão aberto embaixo do nome
     dele e, no pelotão marcado, a marca e as ações */
  function decorar(cel) {
    /* nada aberto nem marcado, e nada daqui na célula (a grade inteira passa por aqui): segue */
    if (!aberto && !marcado && !cel.hasAttribute('data-celula-marcada')
      && !cel.querySelector('.escala-celula-cartao, .escala-celula-acoes, .linha-escalado--aberta')) return;
    if (!naEscala(cel)) return;
    tirar(cel);
    var d = diaDe(cel);
    if (aberto && mesmo(dia, d.unidadeId, d.iso)) {
      var linha = linhaDe(cel, aberto.cpf), el = linha ? cartao() : null;
      if (el) {
        linha.classList.add('linha-escalado--aberta');
        linha.parentNode.insertBefore(el, linha.nextSibling);
      }
    }
    if (marcado && mesmo(marcado, d.unidadeId, d.iso)) {
      var caixa = acoes(cel);
      if (caixa) {
        cel.setAttribute('data-celula-marcada', '');
        cel.classList.add('escala-mes-celula--selecionada');
        cel.appendChild(caixa);
      }
    }
  }

  /* refaz o que é daqui nas células na tela: as que têm algo daqui e as do dia aberto e do pelotão marcado */
  function redesenhar() {
    var corpo = document.querySelector('.conteudo .pagina-corpo');
    if (!corpo) return;
    var cels = [].map.call(corpo.querySelectorAll('.escala-celula-cartao, .escala-celula-acoes, .linha-escalado--aberta, [data-celula-marcada]'),
      function (e) { return e.closest('.escala-mes-celula'); });
    [dia, marcado].forEach(function (x) {
      if (x) cels.push(corpo.querySelector('.escala-mes-celula[data-unidade-id="' + x.unidadeId + '"][data-iso="' + x.iso + '"]'));
    });
    cels.filter(function (c, i) { return c && cels.indexOf(c) === i; }).forEach(decorar);
  }

  /* ---------- a página ---------- */

  /* a entrada na Escala, a troca de mês: a célula começa limpa (o rascunho dela sai) */
  function largar() {
    var tinha = ativo();
    aberto = null;
    marcado = null;
    livres = null;
    pedido++;
    dia = null;
    if (tinha) {
      E().reset();
      if (S()) S().descartar();
    }
  }

  RW.escalasCelulaEditar = {
    clique: clique,
    decorar: decorar,
    /* o dia do rodapé largo, com o painel fechado (escalas-painel-salvar.js): { unidadeId, iso, secao, unidadeNome } */
    contexto: function () {
      return ativo() ? { unidadeId: dia.unidadeId, iso: dia.iso, secao: 'distribuicao', unidadeNome: dia.unidadeNome } : null;
    },
    /* é o dia que a célula está mexendo? (o painel que abre nele continua o rascunho) */
    ehDia: function (unidadeId, iso) { return ativo() && mesmo(dia, unidadeId, iso); },
    /* há mudança não salva no dia da célula? */
    pendente: function () { return ativo() && !!S() && S().pendente(); },
    /* o painel do dia vai abrir: o cartão fecha (o que está concluído fica) e a célula deixa o dia */
    passarAoPainel: function () {
      if (!dia && !aberto && !marcado) return;
      fecharCartao('guardar');
      marcado = null;
      livres = null;
      pedido++;
      dia = null;
      redesenhar();
    },
    /* o Ctrl+Z e o Ctrl+Y do rodapé: o cartão fecha antes */
    fechar: function () { fecharTudo(); },
    /* o Salvar, o Cancelar ou o dia mudado no banco: nada fica aberto nem marcado (o rascunho já foi gravado ou descartado) */
    esquecer: function () { fecharTudo('largar'); },
    /* a troca de mês: com mudança não salva, o aviso de descartar antes; seguir() troca */
    antesDeMudar: function (seguir) {
      if (!ativo()) { if (aberto || marcado) fecharTudo(); seguir(); return; }
      if (!(S() && S().pendente())) { largar(); seguir(); return; }
      RW.escalasPainel.confirmarDescarte(function () { largar(); seguir(); }, S().contarDoDia());
    },
    largar: largar
  };
})();
