/* ============================================================
   PROGRAMADOR — ERROS (só programador)
   Os erros de JavaScript da tela das pessoas, gravados pelo
   geral-erros.js (erros_tela_listar): um item por erro (a mesma
   frase no mesmo arquivo e linha), o que tem vez não vista primeiro.
   O detalhe (no celular, em tela própria) mostra quantas vezes, com
   quantas pessoas e cada vez: quando, quem (com a unidade de hoje),
   a página e o aparelho, para o programador falar com a pessoa.
   Marcar como visto (erros_tela_marcar_visto) tira o Novo até a
   próxima vez; Criar bug deste erro abre o formulário da aba Bugs já
   preenchido (programadorBugs.abrirDeRecado). A página
   (programador.js) liga as abas e chama iniciar().
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var raiz = null;
  var config = {};
  var erros = [];
  var carregou = false;     /* a lista chegou do banco (antes disso, e na falha, o subtítulo fica vazio) */
  var selecionada = null;   /* a assinatura do erro aberto no detalhe */
  var tela = null;          /* as duas telas do celular (programador-telas.js) */

  function M() { return RosterWork.mensagens.programadorErros; }
  function q(seletor) { return raiz.querySelector(seletor); }
  function quando(iso) { return (RosterWork.resumo && RosterWork.resumo.formatarQuando) ? RosterWork.resumo.formatarQuando(iso) : ''; }
  function erroDa(assinatura) {
    for (var i = 0; i < erros.length; i++) if (erros[i].assinatura === assinatura) return erros[i];
    return null;
  }
  function vezesDo(erro) { return Array.isArray(erro.ocorrencias) ? erro.ocorrencias : []; }

  /* o nome da página no menu (a chave, quando a página não está no menu) */
  function nomeDaPagina(chave) {
    if (!chave) return '';
    var item = document.querySelector('.menu-item[data-pagina="' + CSS.escape(String(chave)) + '"] .menu-item-label');
    return item ? item.textContent.trim() : String(chave);
  }

  function avisar(texto) { if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: texto }); }

  /* ---------- carga ---------- */
  function iniciar(conteudo, opcoes) {
    raiz = conteudo;
    config = opcoes || {};
    tela = RosterWork.programadorTelas.ligar(q('[data-aba-painel="erros"]'), q('#erros-voltar'), voltarALista);
    erros = [];
    carregou = false;
    selecionada = null;
    mostrarVazioDetalhe();
    renderLista(M().carregando);
    return carregar();
  }

  /* relê a lista; o erro aberto no detalhe se refaz (depois do Marcar como visto) */
  function carregar() {
    return RosterWork.rpc('erros_tela_listar').then(function (r) {
      carregou = Array.isArray(r);
      erros = carregou ? r : [];
      avisarSubtitulo();
      if (!carregou) { renderLista(M().falhaCarregar); return; }
      if (selecionada && erroDa(selecionada)) selecionar(selecionada);
      else renderLista();
    }).catch(function () {
      erros = [];
      carregou = false;
      avisarSubtitulo();
      renderLista(M().falhaCarregar);
    });
  }

  function avisarSubtitulo() { if (config.aoMudarSubtitulo) config.aoMudarSubtitulo(); }

  /* erros com vez ainda não vista */
  function subtitulo() {
    if (!carregou) return '';
    return M().subtitulo(erros.filter(function (e) { return e.novos > 0; }).length);
  }

  /* ---------- lista ---------- */
  function vazio(texto) {
    var no = RosterWork.tpl('tpl-programador-vazio');
    if (no) no.querySelector('span').textContent = texto;
    return no;
  }

  function renderLista(textoVazio) {
    var lista = q('#erros-lista');
    if (!lista) return;
    lista.textContent = '';
    if (textoVazio || !erros.length) {
      var no = vazio(textoVazio || M().vazioLista);
      if (no) lista.appendChild(no);
      return;
    }
    erros.forEach(function (erro) {
      var item = RosterWork.tpl('tpl-erro-item');
      if (!item) return;
      item.querySelector('.programador-item-assunto').textContent = erro.mensagem;
      item.querySelector('.programador-item-selo').classList.toggle('oculto', !(erro.novos > 0));
      item.querySelector('.programador-bug-item-onde').textContent = erro.onde || '';
      item.querySelector('.programador-bug-item-data').textContent = quando(erro.ultimo_em).slice(0, 10);
      if (erro.assinatura === selecionada) item.classList.add('lista-item--ativo');
      item.addEventListener('click', function () {
        if (erro.assinatura === selecionada && q('#erro-det-criar-bug')) return;   /* já aberto no detalhe */
        selecionar(erro.assinatura);
      });
      lista.appendChild(item);
    });
  }

  /* ---------- detalhe ---------- */
  function mostrarVazioDetalhe() {
    var alvo = q('#erros-detalhe');
    if (!alvo) return;
    alvo.textContent = '';
    var no = vazio(M().vazioDetalhe);
    if (no) alvo.appendChild(no);
    tela.fechar();
  }

  function selecionar(assinatura) {
    selecionada = assinatura;
    renderLista();
    var alvo = q('#erros-detalhe');
    var erro = erroDa(assinatura);
    if (!alvo) return;
    if (!erro) { mostrarVazioDetalhe(); return; }
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-erro-detalhe');
    if (!no) return;

    var novo = erro.novos > 0;
    no.querySelector('.erro-det-selo-novo').classList.toggle('oculto', !novo);
    no.querySelector('.erro-det-selo-visto').classList.toggle('oculto', novo);
    no.querySelector('.erro-det-ultima').textContent = M().ultimaVez(quando(erro.ultimo_em));
    no.querySelector('.erro-det-mensagem').textContent = erro.mensagem;
    no.querySelector('.erro-det-onde').textContent = erro.onde || M().naoInformado;
    no.querySelector('.erro-det-vezes').textContent = M().vezes(erro.vezes, erro.novos);
    no.querySelector('.erro-det-pessoas').textContent = M().pessoas(erro.pessoas);
    no.querySelector('.erro-det-primeira').textContent = quando(erro.primeiro_em);
    montarVezes(no, erro);

    var marcar = no.querySelector('#erro-det-marcar');
    marcar.classList.toggle('oculto', !novo);
    marcar.addEventListener('click', function () { marcarVisto(erro, marcar); });
    no.querySelector('#erro-det-criar-bug').addEventListener('click', function () { criarBug(erro); });

    alvo.appendChild(no);
    tela.abrir(assinatura);
  }

  /* cada vez: quando · quem e a unidade; embaixo, a página e o aparelho (o banco manda as 50 mais recentes) */
  function montarVezes(no, erro) {
    var lista = no.querySelector('.erro-det-lista');
    var vezes = vezesDo(erro);
    vezes.forEach(function (vez) {
      var linha = RosterWork.tpl('tpl-erro-vez');
      if (!linha) return;
      linha.querySelector('.programador-bug-passo-quando').textContent = quando(vez.quando);
      linha.querySelector('.programador-bug-passo-texto').textContent =
        RosterWork.programadorBugsFormulario.rotuloMilitar(vez.militar || M().naoInformado, vez.unidade);
      linha.querySelector('.programador-bug-passo-nota').textContent = M().ondeFoi(nomeDaPagina(vez.pagina), M().aparelhos[vez.aparelho] || '');
      lista.appendChild(linha);
    });
    no.querySelector('.erro-det-mais').classList.toggle('oculto', !(erro.vezes > vezes.length));
  }

  /* o Voltar à lista e o voltar do Android (no celular) */
  function voltarALista() {
    selecionada = null;
    renderLista();
    mostrarVazioDetalhe();
  }

  /* ---------- ações ---------- */
  /* até a última vez que a lista mostrou: a vez que chegou depois continua nova */
  function marcarVisto(erro, botao) {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc('erros_tela_marcar_visto', { p_assinatura: erro.assinatura, p_ate: erro.ultimo_em }).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (!(r && r.success)) { avisar(M().falhaMarcar); return; }
      if (RosterWork.recadosSelo) RosterWork.recadosSelo.atualizar();
      return carregar();
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      avisar(RosterWork.mensagens.geral.semConexao);
    });
  }

  /* o formulário de bug da aba Bugs, como o Criar bug desta mensagem: título, onde (a página da vez mais
     recente) e o que acontece já escritos; ninguém em Relatado por, porque foi o sistema que gravou */
  function criarBug(erro) {
    var bugs = RosterWork.programadorBugs;
    if (!bugs || !config.irParaAba) return;
    var vezes = vezesDo(erro);
    config.irParaAba('bugs');
    bugs.abrirDeRecado({
      id: null,
      assunto: erro.mensagem.slice(0, 80),
      contexto: { pagina: vezes.length ? vezes[0].pagina : '' },
      mensagem: M().descricaoBug({
        mensagem: erro.mensagem, onde: erro.onde, vezes: erro.vezes, pessoas: erro.pessoas,
        primeira: quando(erro.primeiro_em), ultima: quando(erro.ultimo_em)
      })
    });
  }

  window.RosterWork.programadorErros = {
    iniciar: iniciar,
    subtitulo: subtitulo
  };
})();
