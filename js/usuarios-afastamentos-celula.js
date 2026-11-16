/* ============================================================
   USUÁRIOS — aba Afastamentos: a caixa da célula
   (RosterWork.usuariosAfastamentosCelula)
   A caixa flutuante da grade da Escala (geral-caixa-flutuante), na
   célula do mês, só para quem administra o militar. No selo de um
   afastamento (as partes dele nos outros meses ficam marcadas junto):
   Mudar o período, Mudar o nome e Mudar o que ele sai abrem as
   perguntas na caixa 2, ao lado (usuarios-afastamentos-campos.js);
   Remover o afastamento vai para o rascunho; nas Férias não há o que
   ele sai; no que começou há mais de uma semana, só o período (o fim)
   e o nome; no que terminou antes disso, o aviso. Na célula vazia,
   Adicionar afastamento. Em todas, Abrir o painel do militar (a ficha
   na aba Afastamentos). As respostas entram no rascunho na hora: a
   grade se redesenha e a caixa acompanha a peça nova.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var PARTES = { periodo: ['periodo'], nome: ['nome'], marcas: ['guarnicao', 'marcas'], adicionar: ['nome', 'periodo', 'guarnicao', 'marcas'] };

  var aberto = null;     // a caixa aberta: { caixa, cpf, pessoa, mes, chave, campos, raiz }
  var abrirFicha = null; // a página abre a ficha do militar (usuarios-afastamentos.js)

  function R() { return RW.usuariosAfastamentosRascunho; }

  /* o afastamento gravado que começou ou terminou antes do limite (hoje − 7) */
  function travas(af) {
    var g = af && af.id ? R().gravado(af.cpf, af.id) : null;
    var lim = R().isoLimite();
    return { inicio: !!(g && g.inicio < lim), fim: !!(g && g.fim < lim) };
  }

  function fechar() {
    var a = aberto;
    aberto = null;
    if (!a) return;
    if (a.chave) R().largar(a.cpf, a.chave);
    if (a.caixa && a.caixa.aberta()) a.caixa.fechar();
  }

  /* a peça da caixa na grade de agora: o selo do afastamento no mês (ou o primeiro dele na linha) ou a célula; e as
     outras partes dele, que vão junto */
  function pecaDe(a) {
    var grade = a.raiz;
    if (!grade) return null;
    var linha = grade.querySelector('.escala-mil-pessoa-linha[data-cpf="' + a.cpf + '"]');
    if (!linha) return null;
    var celula = linha.querySelector('.afastamentos-celula[data-mes="' + a.mes + '"]');
    var selos = a.chave ? linha.querySelectorAll('.afastamentos-selo[data-af="' + a.chave + '"]') : [];
    var peca = (celula && a.chave && celula.querySelector('.afastamentos-selo[data-af="' + a.chave + '"]')) || selos[0] || celula;
    var junto = Array.prototype.filter.call(selos, function (s) { return s !== peca; });
    return peca ? { peca: peca, junto: junto } : null;
  }

  /* o item escolhido: a caixa 2 com as perguntas dele, ou a ação na hora */
  function escolher(a, item) {
    var acao = item.getAttribute('data-acao');
    if (acao === 'painel') {
      var pessoa = a.pessoa;
      fechar();
      if (abrirFicha) abrirFicha(pessoa);
      return;
    }
    if (acao === 'remover') {
      var chave = a.chave;
      a.chave = null;
      fechar();
      R().remover(a.cpf, chave, 'celula');
      return;
    }
    if (!PARTES[acao]) return;
    if (acao === 'adicionar' && !a.chave) a.chave = R().criar(a.cpf);
    var cartao = RW.tpl('tpl-afastamentos-cartao');
    if (!cartao) return;
    a.campos = RW.usuariosAfastamentosCampos.montar(cartao, { cpf: a.cpf, chave: a.chave, partes: PARTES[acao], origem: 'celula' });
    a.caixa.segunda(item, cartao, item.textContent.trim());
    var primeiro = cartao.querySelector('input:not([disabled]), button:not([disabled])');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  /* o clique na célula (quem administra o militar): no selo, a caixa do afastamento; no vazio, o Adicionar */
  function aoClicar(celula, pessoa, evento) {
    var selo = evento.target.closest('.afastamentos-selo');
    var cpf = String(pessoa.usuario_id);
    var chave = selo ? selo.getAttribute('data-af') : null;
    if (aberto && aberto.cpf === cpf && aberto.chave === chave && aberto.mes === Number(celula.getAttribute('data-mes')) && chave) {
      fechar();
      return;
    }
    fechar();
    var af = chave ? R().achar(cpf, chave) : null;
    var t = travas(af);
    var menu = RW.tpl(!af ? 'tpl-afastamentos-menu-vazio' : (t.fim ? 'tpl-afastamentos-menu-travado' : 'tpl-afastamentos-menu'));
    if (!menu) return;
    if (af && !t.fim) {
      /* as férias não têm o que ele sai; o que começou antes do limite não muda as marcas nem sai */
      menu.querySelector('[data-acao="marcas"]').classList.toggle('oculto', af.padrao === 'ferias' || t.inicio);
      menu.querySelector('[data-acao="remover"]').classList.toggle('oculto', t.inicio);
    }
    var a = aberto = { cpf: cpf, pessoa: pessoa, mes: Number(celula.getAttribute('data-mes')), chave: af ? af.chave : null,
      campos: null, raiz: celula.closest('.arvore-unidades') };
    var p = pecaDe(a) || { peca: selo || celula, junto: [] };
    a.caixa = RW.caixaFlutuante.abrir({
      peca: p.peca, junto: p.junto, conteudo: menu,
      titulo: ((pessoa.grau_abreviacao || '') + ' ' + (pessoa.nome_de_guerra || '')).trim(),
      ignorar: '.afastamentos-celula--clicavel',
      aoFechar: function () {
        if (aberto !== a) return;
        aberto = null;
        if (a.chave) R().largar(a.cpf, a.chave);
      }
    });
    if (!a.caixa) { aberto = null; return; }
    menu.addEventListener('click', function (ev) {
      var item = ev.target.closest('[data-acao]');
      if (item && aberto === a) escolher(a, item);
    });
  }

  /* a grade se redesenhou: a caixa acompanha a peça nova (ou fecha, se o militar saiu da tela) e as perguntas
     mostram o resultado */
  function reancorar() {
    var a = aberto;
    if (!a) return;
    a.raiz = document.querySelector('.afastamentos-arvore') || a.raiz;
    var p = pecaDe(a);
    if (!p) { fechar(); return; }
    a.caixa.trocarPeca(p.peca, p.junto);
    if (a.campos) a.campos.pintar();
  }

  /* outra tela mudou o rascunho (a ficha, o Desfazer, a gravação): a caixa fecha */
  function aoMudarRascunho(origem) {
    if (origem !== 'celula' && aberto) fechar();
  }

  function iniciar(opcoes) {
    fechar();
    abrirFicha = opcoes && opcoes.abrirFicha;
    R().ouvir('celula', aoMudarRascunho);
  }

  window.RosterWork.usuariosAfastamentosCelula = { iniciar: iniciar, aoClicar: aoClicar, reancorar: reancorar, fechar: fechar };
})();
