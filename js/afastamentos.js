/* ============================================================
   AFASTAMENTOS — a página
   (RosterWork.paginas.afastamentos)
   O efetivo das unidades escolhidas (a árvore de unidades) com os
   afastamentos de cada militar, em três abas embaixo do título: Ano
   (os 12 meses; o nome de cada mês abre a caixa com o mês na aba Mês
   ou no Calendário), Mês (os dias do mês, com uma barra por
   afastamento; as duas em afastamentos-grade.js; no celular, a lista)
   e Calendário (o da Escala, um bloquinho por unidade em cada dia,
   também nos dias de outro mês das pontas; afastamentos-calendario.js).
   A aba fica guardada na sessão. Na barra, o período (afastamentos-
   periodo.js), os Filtros (Graus; Situação no período, que some no
   Calendário; Afastamento: escolher um nome esconde os outros), a
   busca e, depois do traço, as unidades lado a lado e o tamanho (só no
   Calendário, os da Escala) e a Ordem (a busca, a ordem e os Graus
   vêm do usuarios-exibir.js). O clique no militar abre o painel dele
   (afastamentos-painel.js); quem administra edita na caixa da grade
   (afastamentos-celula.js) ou no painel; o rascunho é um só.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ABAS = ['ano', 'mes', 'calendario'];

  var aba = 'ano';           // 'ano' (os 12 meses), 'mes' (os dias) ou 'calendario'
  var ano = anoAtual();
  var mes = new Date().getMonth();
  var lidos = {};            // ano -> true (o ano já veio do banco para o rascunho)
  var token = 0;             // latest-wins: a resposta de outro ano (ou de outra visita à página) é ignorada
  var filtros = null;
  var seletorAno = null;     // o ano da barra
  var seletorMes = null;     // o mês da barra
  var arvore = null;         // o contêiner da árvore
  var corpoArvore = null;    // o corpo da árvore, que dá lugar ao calendário
  var corpoCalendario = null;
  var elContagem = null;     // a contagem no título
  var barra = {};            // os controles: abas, situacao, disposicao, tamanho
  var naPassada = [];        // no Calendário: as unidades da passada da árvore, com os militares que passam
  var contagem = 0;          // os militares desenhados nesta passada (a contagem do título)
  var termoBusca = '';
  var modoBusca = 'marcar';  // 'marcar' (realça) ou 'filtrar' (esconde quem não bate)
  var aberto = { cpf: null, peca: null };   // o militar do painel aberto e a peça dele na grade (o realce)
  var siglas = {};           // cpf -> a sigla da unidade (ao lado do nome, no painel)
  var setores = {};          // cpf -> o setor (Operacional, Administrativo, Aluno): o Salvar sabe se refaz a escala

  function M() { return RW.mensagens.afastamentos; }
  function R() { return RW.afastamentosRascunho; }
  function G() { return RW.afastamentosGrade; }
  function Cx() { return RW.afastamentosCelula; }
  function X() { return RW.usuariosExibir; }
  function anoAtual() { return new Date().getFullYear(); }
  function celular() { return !!(RW.celular && RW.celular()); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function noCalendario() { return aba === 'calendario'; }
  function noMes() { return aba !== 'ano'; }   // no Mês e no Calendário, o período é o mês
  function naTela() { return !!arvore && document.contains(arvore); }
  function atualizar() { if (RW.arvoreUnidades && naTela()) RW.arvoreUnidades.atualizar(); }

  /* ---------- a aba escolhida, guardada na sessão (rosterwork_preferencias.afastamentos; some no login) ---------- */

  function lerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; }
  }
  function lerEscolha() {
    var e = lerPrefs().afastamentos || {};
    aba = ABAS.indexOf(e.aba) >= 0 ? e.aba : 'ano';
  }
  function guardarEscolha() {
    var p = lerPrefs();
    p.afastamentos = { aba: aba };
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(p)); } catch (_e) {}
  }

  /* ---------- o que aparece ---------- */

  /* o período da tela: o ano inteiro ou o mês */
  function periodo() {
    if (!noMes()) return { inicio: ano + '-01-01', fim: ano + '-12-31' };
    return { inicio: ano + '-' + p2(mes + 1) + '-01', fim: ano + '-' + p2(mes + 1) + '-' + p2(new Date(ano, mes + 1, 0).getDate()) };
  }
  /* os afastamentos do militar que tocam o período p (sem p, o da tela), com o rascunho por cima */
  function doPeriodo(pessoa, p) {
    p = p || periodo();
    return R().lista(pessoa.usuario_id).filter(function (af) { return af.inicio && af.fim && af.inicio <= p.fim && af.fim >= p.inicio; });
  }
  /* o nome no filtro Afastamento: o da lista padrão ou "Outros" */
  function chaveFiltro(af) { return af.padrao || 'outros'; }
  function visiveisEm(pessoa, p) {
    return doPeriodo(pessoa, p).filter(function (af) { return !filtros || filtros.passa('afastamento', chaveFiltro(af)); });
  }
  function visiveis(pessoa) { return visiveisEm(pessoa); }
  function lendo() { return !lidos[ano]; }

  /* a busca: 'marcar' (casa, no marcar) · 'casa' (casa, no filtrar) · 'esconder' (não casa, no filtrar) · '' (sem busca
     ou não casa, no marcar) */
  function busca(pessoa) {
    if (!termoBusca) return '';
    if (X().casaBusca(pessoa, termoBusca)) return modoBusca === 'marcar' ? 'marcar' : 'casa';
    return modoBusca === 'filtrar' ? 'esconder' : '';
  }

  /* o militar entra? graus, a busca e a situação no período (pelos afastamentos à vista; no Calendário não vale: ali só
     aparece quem tem afastamento) */
  function passa(pessoa) {
    if (filtros && !filtros.passa('graus', pessoa.grau_nome)) return false;
    if (busca(pessoa) === 'esconder') return false;
    if (lendo() || noCalendario()) return true;
    return !filtros || filtros.passa('situacao', visiveis(pessoa).length ? 'com' : 'sem');
  }

  /* ---------- o painel do militar e o realce da peça dele ---------- */

  function limparSelecao() {
    if (aberto.peca) aberto.peca.classList.remove('linha-militar--selecionada');
    aberto = { cpf: null, peca: null };
  }
  /* a grade redesenhada: a peça do militar do painel aberto volta a ficar marcada */
  function marcar(el, pessoa) {
    if (aberto.cpf === null || String(pessoa.usuario_id) !== aberto.cpf) return;
    el.classList.add('linha-militar--selecionada');
    aberto.peca = el;
  }
  /* a peça do militar ainda está na tela? (sem peça, como no calendário, o painel fica) */
  function pecaNaTela() {
    return !aberto.peca || (aberto.peca.isConnected && aberto.peca.getClientRects().length > 0);
  }
  /* abre o painel do militar (el = a peça clicada: a coluna do militar na grade ou a linha da lista do celular; a linha
     do nome no calendário não fica marcada) */
  function abrirPainel(el, pessoa) {
    if (aberto.peca) aberto.peca.classList.remove('linha-militar--selecionada');
    aberto = { cpf: String(pessoa.usuario_id), peca: el && !el.classList.contains('afastamentos-linha') ? el : null };
    if (aberto.peca) aberto.peca.classList.add('linha-militar--selecionada');
    RW.afastamentosPainel.abrir(pessoa, { ano: ano, sigla: siglas[aberto.cpf] || '', aoFechar: limparSelecao });
    if (RW.painel) RW.painel.acompanharTela(pecaNaTela);
  }
  /* a coluna do militar na grade da tela, se estiver (o Abrir o painel da caixa) */
  function pecaDoMilitar(pessoa) {
    return document.querySelector('.escala-mil-pessoa-linha[data-cpf="' + pessoa.usuario_id + '"] .afastamentos-pessoa');
  }

  /* o que as grades e o calendário usam daqui */
  function contexto() {
    return {
      ano: ano, mes: mes, periodo: periodo(), lendo: lendo, afastamentos: visiveis, busca: busca,
      contar: function () { contagem++; }, marcar: marcar,
      /* no Calendário, os da grade inteira (com os dias de outro mês das pontas) e se o ano de um dia ainda vem do banco */
      afastamentosEntre: function (pessoa, inicio, fim) { return visiveisEm(pessoa, { inicio: inicio, fim: fim }); },
      lendoAno: function (a) { return !lidos[a]; },
      abrirPainel: abrirPainel,
      podeMudar: function (pessoa) { return !lendo() && RW.sessao.podeAdministrar('pelotao', pessoa.lotacao_atual); },
      podeAdicionar: function (unidadeId) { return !lendo() && RW.sessao.podeAdministrar('pelotao', unidadeId); },
      aoClicarCelula: function (celula, pessoa, evento) { Cx().aoClicar(celula, pessoa, evento); },
      aoClicarMes: function (botao, m) { Cx().menuDoMes(botao, m, function (sub) { abrirMes(m, sub); }); },
      aoClicarLinha: function (linha, pessoa, evento) { Cx().aoClicarLinha(linha, pessoa, evento); },
      aoClicarBloco: function (bloco, unidade, efetivo, iso) { Cx().aoClicarBloco(bloco, unidade, efetivo, iso); }
    };
  }

  /* a unidade: a grade do ano ou do mês (no celular, a lista); no Calendário, ela só entra na lista da passada (o
     calendário se desenha no fim, com todas); sem ninguém pelos filtros, o aviso */
  function renderConteudo(container, unidade, pessoas) {
    pessoas.forEach(function (p) {
      siglas[String(p.usuario_id)] = unidade.nome || '';
      setores[String(p.usuario_id)] = p.tipo || '';
    });
    var lista = X().ordenar(pessoas).filter(passa);
    if (noCalendario()) { naPassada.push({ unidade: unidade, pessoas: lista, efetivo: pessoas }); return; }
    var c = contexto();
    var n = celular() ? G().desenharLista(container, lista, c) : (noMes() ? G().desenharMes(container, lista, c) : G().desenhar(container, lista, c));
    if (pessoas.length && !n) {
      var vazio = RW.tpl('tpl-afastamentos-vazio');
      var bloquinho = RW.tpl('tpl-arvore-bloquinho');
      if (vazio && bloquinho) {
        bloquinho.appendChild(vazio);
        container.appendChild(bloquinho);
      }
    }
  }

  /* a contagem de cada unidade: quantos têm afastamento no ano ou no mês */
  function textoContagem(itens) {
    if (lendo()) return '';
    var n = itens.filter(function (p) { return doPeriodo(p).length; }).length;
    return noMes() ? M().contagemMes(n) : M().contagem(n);
  }

  /* depois de desenhar: os graus e os nomes do período nos Filtros; no Calendário, o calendário com as unidades da
     passada; a caixa aberta acompanha a grade nova; e a contagem do título */
  function aoRenderizar(pessoas) {
    if (filtros) {
      filtros.definir('graus', X().arvoreDeGraus(pessoas || []));
      var tem = {};
      (pessoas || []).forEach(function (p) { doPeriodo(p).forEach(function (af) { tem[chaveFiltro(af)] = true; }); });
      var opcoes = M().padroes.filter(function (x) { return tem[x.valor]; }).map(function (x) { return { rotulo: x.rotulo, valor: x.valor }; });
      if (tem.outros) opcoes.push({ rotulo: M().outros, valor: 'outros' });
      filtros.definir('afastamento', opcoes);
    }
    var unidades = naPassada;
    naPassada = [];
    var desenhou = noCalendario() && unidades.length && RW.afastamentosCalendario
      ? RW.afastamentosCalendario.desenhar(corpoCalendario, unidades, contexto())
      : false;
    mostrarCorpos(desenhou);
    if (Cx()) Cx().reancorar();
    if (elContagem) elContagem.textContent = contagem === 1 ? '1 militar' : contagem + ' militares';
    contagem = 0;
  }

  /* o calendário no lugar da árvore, quando ele se desenhou; sem unidade (ou na falha), a árvore mostra o estado dela */
  function mostrarCorpos(calendario) {
    var cal = !!(calendario && noCalendario());
    if (corpoCalendario) corpoCalendario.classList.toggle('oculto', !cal);
    if (corpoArvore) corpoArvore.classList.toggle('oculto', cal);
  }

  /* ---------- a barra e as abas ---------- */

  /* o período da aba, a aba marcada, as ferramentas do Calendário e a Situação (diz o período; no Calendário, some) */
  function pintarBarra() {
    if (seletorAno) {
      seletorAno.el.classList.toggle('oculto', noMes());
      if (!noMes()) seletorAno.definir(ano);
    }
    if (seletorMes) {
      seletorMes.el.classList.toggle('oculto', !noMes());
      if (noMes()) seletorMes.pintar();
    }
    if (barra.abas) {
      Array.prototype.forEach.call(barra.abas.querySelectorAll('.aba'), function (b) {
        var sim = b.getAttribute('data-aba') === aba;
        b.classList.toggle('aba--ativa', sim);
        b.setAttribute('aria-selected', sim ? 'true' : 'false');
      });
    }
    if (barra.disposicao) barra.disposicao.classList.toggle('oculto', !noCalendario() || celular());
    if (barra.tamanho) barra.tamanho.classList.toggle('oculto', !noCalendario());
    if (filtros) {
      if (barra.situacao) barra.situacao.classList.toggle('oculto', noCalendario());
      filtros.definir('situacao', noCalendario() ? [] : (noMes()
        ? [{ rotulo: M().comNoMes, valor: 'com' }, { rotulo: M().semNoMes, valor: 'sem' }]
        : [{ rotulo: M().comNoAno, valor: 'com' }, { rotulo: M().semNoAno, valor: 'sem' }]));
    }
    if (!noCalendario()) mostrarCorpos(false);
  }

  /* outra aba (as abas ou a caixa do mês): a barra acompanha e a tela redesenha */
  function trocarAba(nova) {
    if (ABAS.indexOf(nova) < 0 || nova === aba) return;
    if (Cx()) Cx().fechar();
    aba = nova;
    guardarEscolha();
    pintarBarra();
    carregar();
  }

  /* o mês (o mês fora do ano passa de ano; outro ano lê de novo) */
  function irParaMes(a, m) {
    var d = new Date(a, m, 1);
    if (d.getFullYear() === ano && d.getMonth() === mes) return;
    if (Cx()) Cx().fechar();
    ano = d.getFullYear();
    mes = d.getMonth();
    pintarBarra();
    carregar();
  }

  /* a caixa do mês do cabeçalho do ano: o mês na aba Mês ou no Calendário */
  function abrirMes(m, sub) {
    mes = m;
    trocarAba(sub === 'calendario' ? 'calendario' : 'mes');
  }

  /* ---------- carregar ---------- */

  /* os anos que a tela pede: o do período e, no Calendário, o vizinho quando a grade passa da virada do ano */
  function anosDaTela() {
    var anos = [ano];
    if (noCalendario() && RW.geralCalendarioMes) {
      var g = RW.geralCalendarioMes.periodo(new Date(ano, mes, 1));
      [g.inicio.getFullYear(), g.fim.getFullYear()].forEach(function (a) { if (anos.indexOf(a) < 0) anos.push(a); });
    }
    return anos;
  }

  /* lê os anos que faltam (uma vez por ano; a gravação esquece) e redesenha */
  function carregar() {
    var faltam = anosDaTela().filter(function (a) { return !lidos[a]; });
    atualizar();   // os nomes já aparecem; os selos chegam com a resposta
    if (!faltam.length) return;
    var meu = ++token;
    faltam.forEach(function (esse) {
      RW.etapas.segurarDesde(performance.now(), RW.afastamentosDados.listarAno(esse)).then(function (lista) {
        if (meu !== token || !naTela()) return;
        if (lista == null) {
          if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().falhaCarregar });
          return;
        }
        R().conhecer(lista);
        lidos[esse] = true;
        if (anosDaTela().indexOf(esse) >= 0) atualizar();
      });
    });
  }

  /* o rascunho mudou: a grade mostra o resultado; gravou: relê o ano */
  function aoMudarRascunho(origem) {
    if (!naTela()) return;
    if (origem === 'gravou') {
      lidos = {};
      carregar();
      return;
    }
    atualizar();
  }

  /* ---------- a página ---------- */

  /* a busca da barra (componente geral: marcar ou filtrar, a espera da digitação, o limpar e o Enter) */
  function ligarBusca(conteudo) {
    var caixa = conteudo.querySelector('#afastamentos-busca');
    if (!caixa || !RW.busca) return;
    RW.busca.criar({
      caixa: caixa,
      aoBuscar: function (termo, modo) {
        termoBusca = termo;
        modoBusca = modo;
        atualizar();
      }
    });
  }

  /* a navegação abriu a página: o rascunho, os Filtros, o período, as abas, a busca, a Ordem e a árvore */
  function iniciar(conteudo) {
    arvore = conteudo.querySelector('#arvore-afastamentos');
    if (!arvore || !RW.arvoreUnidades || !RW.filtros || !X()) return;
    corpoArvore = conteudo.querySelector('.afastamentos-corpo');
    corpoCalendario = conteudo.querySelector('#afastamentos-calendario');
    elContagem = conteudo.querySelector('.pagina-titulo-contagem');
    lidos = {};
    token++;
    ano = anoAtual();
    mes = new Date().getMonth();
    naPassada = [];
    contagem = 0;
    termoBusca = '';
    modoBusca = 'marcar';
    aberto = { cpf: null, peca: null };
    siglas = {};
    setores = {};
    lerEscolha();

    R().iniciar(conteudo, { setor: function (cpf) { return setores[String(cpf)] || ''; } });
    R().ouvir('pagina', aoMudarRascunho);
    if (Cx()) Cx().iniciar({ abrirPainel: function (pessoa) { abrirPainel(pecaDoMilitar(pessoa), pessoa); } });

    var caixa = conteudo.querySelector('#afastamentos-filtros');
    filtros = RW.filtros.criar(caixa, { aoMudar: atualizar });
    barra.situacao = caixa ? caixa.querySelector('[data-filtro="situacao"]') : null;

    /* o período, no começo da barra */
    var sub = conteudo.querySelector('.pagina-subcabecalho');
    seletorAno = RW.afastamentosPeriodo.seletorAno(ano, function (a) {
      if (Cx()) Cx().fechar();
      ano = a;
      carregar();
    });
    seletorMes = RW.afastamentosPeriodo.seletorMes({
      obter: function () { return { ano: ano, mes: mes }; },
      irPara: irParaMes
    });
    [seletorMes, seletorAno].forEach(function (s) { if (s && sub) sub.prepend(s.el); });

    barra.abas = conteudo.querySelector('#afastamentos-abas');
    if (RW.abas && barra.abas) RW.abas.ligar(barra.abas, function (b) { trocarAba(b.getAttribute('data-aba')); });

    ligarBusca(conteudo);
    X().ligarOrdem(conteudo, atualizar);

    /* as unidades lado a lado e o tamanho do calendário: os da Escala (a escolha é uma só para as telas) */
    barra.disposicao = conteudo.querySelector('#afastamentos-disposicao');
    if (RW.visaoGrade) RW.visaoGrade.ligarDisposicao(barra.disposicao, function () { if (noCalendario()) atualizar(); });
    barra.tamanho = conteudo.querySelector('#afastamentos-tamanho');
    if (RW.calendarioTamanho) {
      barra.tamanho = RW.calendarioTamanho.montar(barra.tamanho) || barra.tamanho;
      RW.calendarioTamanho.ligar(corpoCalendario);
    }
    pintarBarra();

    /* a árvore (componente compartilhado) cuida das unidades e do efetivo; cada unidade marcada desenha a grade dela */
    var pronto = RW.arvoreUnidades.montar(arvore, {
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizar,
      textoContagem: textoContagem,
      etapas: 'usuariosAbrir'
    });
    carregar();
    return pronto;
  }

  window.RosterWork.paginas = window.RosterWork.paginas || {};
  window.RosterWork.paginas.afastamentos = { iniciar: iniciar };
})();
