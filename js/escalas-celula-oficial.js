/* ============================================================
   ESCALAS — o Oficial de Área no título do dia das grades (Agenda,
   Calendário e Colunas), para quem administra a companhia, com o
   painel fechado: o nome (ou o "Sem Oficial de Área") abre ao lado a
   caixa flutuante no dia da companhia (o rascunho do Dia dela, pela
   escalas-celula-editar.js: a mesma prévia e o mesmo Salvar do rodapé
   largo). Com o Oficial pontual: Pôr outro no lugar dele (o campo dos
   subtenentes e oficiais da companhia, livres ou de serviço num
   pelotão; escolhido o nome, quem sai responde, quando vale, se as
   horas saem do banco) e Remover deste dia; com o que veio de um
   pelotão: Pôr outro no lugar dele e o Devolver; sem Oficial:
   Adicionar o Oficial de Área; pelo ciclo ou por troca, só o Abrir o
   painel do dia da companhia, que fica em todos. Quem está de folga
   entra nas horas livres, com o banco em Contabilizar; quem está de
   serviço num pelotão vem pelo remanejamento, só neste dia (o motivo
   já dito), com a frase de que sai de lá. O sistema faz dele o
   Oficial (o mais antigo de serviço na companhia, de Sub.Ten. para
   cima). O menu do dia de quem é Sub.Ten. ou mais antigo, num pelotão,
   tem o Pôr como Oficial de Área, com o mesmo remanejamento (podeSer,
   porComoOficial). O dia de mais de 7
   dias atrás abre o aviso (o painel só por ele); o painel aberto, o
   dia na fila do recálculo e o Calendário do celular abrem o painel.
   O título ganha a borda no mouse (quem mexe) e a tracejada com
   mudança da companhia não salva, quando a célula dela não está na
   tela. Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaOficial.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var OFICIAL = /^oficial de área$/i;
  var marcando = false;   // a marca dos títulos já vai ser posta no próximo quadro
  var graus = null;       // a antiguidade de cada posto, lida uma vez (o Pôr como Oficial de Área)

  function api() { return RW.escalasPainelEditar.sub; }
  function A() { return RW.escalasCelulaAcoes; }
  function C() { return RW.escalasCelulaEditar; }
  function msg() { return RW.mensagens.escala; }
  function L() { return RW.mensagens.escala.linha; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* ---------- o dia do título ---------- */

  function corpo() { return document.querySelector('.conteudo .pagina-corpo'); }

  /* a grade da Escala (o título com o Oficial só existe nela) */
  function naEscala() { return !!document.querySelector('.conteudo #escala-modos'); }

  /* o dia da companhia do título (a de uma unidade da grade nesse dia): { unidadeId, iso, unidadeNome, unidadeCidade } */
  function diaDo(o) {
    var iso = o.dataset.iso, E = RW.paginas && RW.paginas.escalas, c = corpo();
    var cels = c && E && E.companhiaDe ? c.querySelectorAll('.escala-mes-celula[data-iso="' + iso + '"]') : [];
    for (var i = 0; i < cels.length; i++) {
      var cia = E.companhiaDe(cels[i].dataset.unidadeId);
      if (cia) return { unidadeId: String(cia.id), iso: iso, unidadeNome: cia.nome || '', unidadeCidade: cia.cidade || '' };
    }
    return null;
  }

  function podeMexer(d) { return !!d && !!RW.sessao && RW.sessao.podeAdministrar('companhia', d.unidadeId); }

  /* o texto do título (o posto e o nome, ou o "Sem Oficial de Área"): o da folha do celular */
  function nomeDo(o) {
    var g = o.querySelector('.escala-oficial-grad'), n = o.querySelector('.escala-oficial-nome');
    return ((g && !g.classList.contains('oculto') ? g.textContent : '') + ' ' + (n ? n.textContent : '')).trim();
  }

  /* ---------- o clique ---------- */

  /* o clique no Oficial do título (escalas-painel.js): true quando é dele */
  function clique(ev) {
    var o = ev.target.closest ? ev.target.closest('.escala-oficial[data-iso]') : null;
    if (!o || !naEscala()) return false;
    var d = diaDo(o);
    if (!podeMexer(d)) return false;
    function painel() { RW.escalasPainel.abrirDia(d, null); }
    if ((RW.painel && RW.painel.estaAberto()) || (RW.escalaAtualizando && RW.escalaAtualizando.pendente(d.unidadeId, d.iso))
      || (RW.celular && RW.celular() && o.closest('.geral-calendario-mes-dia'))) {
      C().fechar();
      painel();
      return true;
    }
    var titulo = L().noDia(nomeDo(o), diaMes(d.iso));
    if (d.iso < C().limite()) {
      C().fechar();
      RW.caixaFlutuante.aviso({ peca: o, texto: msg().diaAntigo, titulo: titulo, aoPainel: painel });
      return true;
    }
    C().abrirOficial(d, o, titulo, o.dataset.cpf || null);
    return true;
  }

  /* ---------- a caixa 1 ---------- */

  /* quem é o Oficial no dia da companhia (o rascunho): o do título, quando está na função; null sem ninguém */
  function oficialDoDia(cpfTitulo) {
    var p = api().papeis(api().dados()), cpfs = [];
    Object.keys(p).forEach(function (k) { if (OFICIAL.test(p[k].funcao)) cpfs = cpfs.concat(Object.keys(p[k].por)); });
    return !cpfs.length ? null : cpfs.indexOf(cpfTitulo) >= 0 ? cpfTitulo : cpfs[0];
  }

  /* o Remover deste dia dele (escalas-painel-remover › analisarDoDia): o pontual sai na hora ('sai') ou responde antes
     se as horas saem do banco ('pontual'); o resto (o ciclo, a troca, o remanejado) é do painel */
  function remocaoDe(cpf) {
    var mil = cpf ? api().militarDoDia(cpf) : null;
    return mil ? RW.escalasPainelRemover.analisarDoDia({ cpf: cpf, periodos: (mil.janelas || []).map(copiar) }) : null;
  }
  function ehPontual(r) { return !!r && (r.tipo === 'sai' || r.tipo === 'pontual'); }

  /* como ele é o Oficial: 'pontual' (sai pelo Remover deste dia; r = a análise), 'pelotao' (veio de um pelotão da
     companhia pelo remanejamento e volta pelo Devolver; de = o pelotão) ou 'outro' (pelo ciclo ou por troca: o painel) */
  function tipoDo(cpf, cia) {
    var mil = cpf ? api().militarDoDia(cpf) : null;
    if (!mil) return null;
    if (mil.remanejado && String(mil.remanejado.para) === String(cia)) return { tipo: 'pelotao', cpf: cpf, de: mil.remanejado.de_nome || '' };
    var r = remocaoDe(cpf);
    return { tipo: ehPontual(r) ? 'pontual' : 'outro', cpf: cpf, r: r };
  }

  /* a caixa 1, quando o dia chega (escalas-celula-editar.js › mostrar) */
  function menu(c) {
    var a = c.a, el = RW.tpl('tpl-escala-celula-oficial');
    if (!el) return null;
    a.cpf = oficialDoDia(a.titulo);
    var t = tipoDo(a.cpf, c.dia.unidadeId), k = t && t.tipo;
    var mostra = { outro: k === 'pontual' || k === 'pelotao', 'remover-dia': k === 'pontual', devolver: k === 'pelotao', adicionar: !a.cpf };
    Object.keys(mostra).forEach(function (x) { el.querySelector('[data-acao="' + x + '"]').classList.toggle('oculto', !mostra[x]); });
    el.querySelector('.dropdown-divisor').classList.toggle('oculto', !Object.keys(mostra).some(function (x) { return mostra[x]; }));
    el.querySelector('.escala-celula-oficial-devolver').textContent = k === 'pelotao' ? L().devolverA(t.de) : '';
    el.querySelector('.escala-celula-companhia').textContent = c.dia.unidadeNome || '';
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b, c); });
    });
    A().prepararMenu(c, el);   // a setinha do Remover deste dia, só quando ele abre a pergunta
    return el;
  }

  /* um item: o mesmo de novo não faz nada; outro termina o de antes (o concluído fica, o que está pela metade sai). O
     Devolver faz na hora, com o Desfazer */
  function fazer(acao, botao, c) {
    var a = c.a;
    if (!a || !api().livre() || (a.botao === botao && a.acao)) return;
    if (acao === 'remover-dia') { A().fazer('remover-dia', botao, c); return; }
    A().encerrar(c);
    if (acao === 'painel') { c.fecharTudo('guardar'); c.abrirPainel(null); }
    else if (acao === 'devolver') devolver(a.cpf, c);
    else if (acao === 'adicionar') campo(botao, c, 'oficial-adicionar', null);
    else if (acao === 'outro') {
      var t = tipoDo(a.cpf, c.dia.unidadeId);
      if (!t || t.tipo === 'outro') { c.fecharTudo('guardar'); c.abrirPainel(a.cpf); return; }
      campo(botao, c, 'oficial-outro', t);
    }
  }

  /* o Devolver: ele volta ao pelotão dele (lá, o sistema decide a função; o mais antigo é o Chefe de Socorro) */
  function devolver(cpf, c) {
    c.fecharTudo();
    api().mudar(function () { api().devolverRemanejado(cpf); });
  }

  /* ---------- a caixa 2: quem entra ---------- */

  /* o campo dos subtenentes e oficiais da companhia, livres ou de serviço num pelotão (o do Adicionar neste dia, com a
     lista do Oficial); sai = o Oficial de agora, no Pôr outro */
  function campo(botao, c, acao, sai) {
    var el = RW.tpl('tpl-escala-celula-oficial-campo');
    if (!el) return;
    A().nesteDia(botao, c, { el: el, acao: acao, aoEscolher: function (item) { escolheu(item, c, el, sai); } });
  }

  /* escolhido o nome: ele entra e, no Pôr outro, o de antes sai, ao vivo (um passo do desfazer). Quem vem de um pelotão
     deixa a frase embaixo do nome, e a caixa fica; quem sai com as horas no banco responde antes se elas saem dele (até a
     resposta, o Salvar fica desligado, e a caixa fechada sem ela desfaz tudo); sem nada a dizer, a caixa fecha */
  function escolheu(item, c, el, sai) {
    var a = c.a, s = item.m.servico_em, nota = el.querySelector('.escala-celula-oficial-nota');
    a.escolhido = item;
    a.remocao = sai && sai.r ? sai.r : null;
    A().vivo(a);
    aplicar(a, c.dia.unidadeId, sai);
    nota.classList.toggle('oculto', !s);
    if (s) nota.querySelector('.nota-texto').textContent = L().saiDoPelotao(nomeDe(item), s.unidade || '');
    var r = a.remocao, caixa = el.querySelector('.escala-celula-pergunta');
    if (r && r.tipo === 'pontual') {
      if (!caixa.classList.contains('oculto')) return;
      A().pergunta(caixa, { texto: r.texto, sim: r.sim, nao: r.nao, naoPrimeiro: false, escolha: a.escolha }, function (v) {
        a.escolha = v;
        aplicar(a, c.dia.unidadeId, sai);
        c.fecharTudo();
      });
      return;
    }
    if (!s) c.fecharTudo();
  }

  /* o rascunho do Dia volta à foto e recebe a saída do Oficial de antes (o Devolver; o pontual, com a resposta ou sem
     pergunta) e a entrada do escolhido; pela metade, o Salvar fica desligado */
  function aplicar(a, cia, sai) {
    var r = a.remocao, falta = !!r && r.tipo === 'pontual' && !a.escolha;
    api().aoVivo(function () {
      if (sai && sai.tipo === 'pelotao') api().devolverRemanejado(sai.cpf);
      else if (r && !falta) r.aplicar(a.escolha);
      entrar(a.escolhido, cia);
    }, falta);
  }

  /* quem entra: de folga, como pontual, nas horas livres, com o banco em Contabilizar; de serviço num pelotão, o
     remanejamento para a companhia, só neste dia */
  function entrar(item, cia) {
    var s = item.m.servico_em;
    if (s) api().remanejar([remanejamento(item.cpf, s.unidade_id, cia)]);
    else api().aplicarColocacao(A().entrada(item));
  }

  /* o serviço do dia dele de um pelotão para a companhia, inteiro (não fica nas duas), com o motivo já dito */
  function remanejamento(cpf, origem, cia) {
    return { cpf: cpf, origem: Number(origem), destino: Number(cia), fica: false, motivo: L().motivoOficial };
  }

  /* ---------- o Pôr como Oficial de Área do nome ---------- */

  /* a antiguidade dos postos (buscar_graus_hierarquicos), lida uma vez: { 'Sub.Ten.': 9, ... } */
  function lerGraus() {
    if (graus) return;
    graus = {};
    RW.rpc('buscar_graus_hierarquicos').then(function (lista) {
      (lista || []).forEach(function (g) { graus[g.grau_abreviacao] = g.grau_antiguidade; });
    }).catch(function () { graus = null; });
  }
  function podeSerOficial(grad) { return !!graus && graus[grad] != null && graus['Sub.Ten.'] != null && graus[grad] <= graus['Sub.Ten.']; }

  /* ele vira o Oficial do dia? o título do dia na grade: sem Oficial, ou com um de posto mais moderno que o dele (o sistema
     põe o mais antigo; com um mais antigo lá, ele iria para a companhia sem ser o Oficial) */
  function viraOficial(grad, iso) {
    var c = corpo(), t = c && c.querySelector('.escala-oficial[data-iso="' + iso + '"]');
    if (!t) return false;
    if (t.classList.contains('escala-oficial--sem')) return true;
    var atual = t.querySelector('.escala-oficial-grad').textContent;
    return graus[atual] != null && graus[grad] < graus[atual];
  }

  /* o item no menu do dia (escalas-painel-linha-menu.js), no dia de um pelotão de companhia, para quem administra a
     companhia: o Sub.Ten. ou mais antigo de serviço aqui (fora a extra), sem estar remanejado, quando ele vira o Oficial */
  function podeSer(cpf) {
    var E = RW.paginas && RW.paginas.escalas, uid = api().unidadeId(), cia = E && E.companhiaDe ? E.companhiaDe(uid) : null;
    if (!cia || String(cia.id) === String(uid) || !RW.sessao || !RW.sessao.podeAdministrar('companhia', cia.id)) return false;
    var mil = api().militarDoDia(cpf);
    return !!mil && mil.daUnidade && !mil.remanejado && podeSerOficial(mil.grad) && viraOficial(mil.grad, api().iso())
      && (mil.janelas || []).some(function (j) { return j.origem !== 'extra'; });
  }

  /* o serviço dele vai daqui para a companhia, só neste dia, na hora, com o Desfazer (o mesmo remanejamento da caixa do
     título; as colocações à mão dele aqui saem); lá, o sistema faz dele o Oficial */
  function porComoOficial(cpf) {
    var E = RW.paginas.escalas, uid = api().unidadeId(), cia = E.companhiaDe(uid);
    if (!cia) return;
    api().mudar(function () {
      RW.escalasPainelRemanejarListas.cortarNaOrigem(api().rascunho(), cpf, api().dados());
      api().remanejar([remanejamento(cpf, uid, cia.id)]);
    });
  }

  /* ---------- o título refeito ---------- */

  /* a peça da caixa aberta no título do dia dela (a grade refaz o título a cada mudança) */
  function peca(a) {
    var c = corpo();
    return c ? c.querySelector('.escala-oficial[data-iso="' + a.iso + '"]') : null;
  }

  /* o título foi refeito (escalas-celula.js › preencherOficial): o dia e o Oficial nele; a marca vem no próximo quadro,
     com a grade inteira na tela (a Agenda e o Colunas fazem as células do dia depois do título) */
  function decorar(no, iso, oa) {
    lerGraus();
    no.dataset.iso = iso;
    no.dataset.cpf = (oa && oa.cpf) || '';
    if (!marcando) { marcando = true; requestAnimationFrame(marcar); }
  }

  /* a borda no mouse de quem mexe (de hoje − 7 em diante), a tracejada com mudança não salva da companhia sem a célula
     dela na tela, e a caixa aberta acha o título novo */
  function marcar() {
    marcando = false;
    var c = corpo(), S = RW.escalasPainelSalvar;
    if (!c || !naEscala() || !C()) return;
    var limite = C().limite();
    [].forEach.call(c.querySelectorAll('.escala-oficial[data-iso]'), function (o) {
      var d = diaDo(o), iso = o.dataset.iso;
      o.classList.toggle('escala-oficial--edita', podeMexer(d) && iso >= limite);
      o.classList.toggle('escala-oficial--nao-salvo', !!d && !!S && S.marcado(d.unidadeId, iso)
        && !c.querySelector('.escala-mes-celula[data-unidade-id="' + d.unidadeId + '"][data-iso="' + iso + '"]'));
    });
    C().acharDeNovo();
  }

  RW.escalasCelulaOficial = { clique: clique, menu: menu, peca: peca, decorar: decorar, podeSer: podeSer, porComoOficial: porComoOficial };
})();
