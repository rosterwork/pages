/* ============================================================
   COMPONENTE geral-cotas-aviso — as cotas que faltam distribuir
   Quem recebeu cota da extra e ainda não tem todas nas datas, no mês
   lançado: o grupo extra_cotas do pendencias_listar, um por mês, que
   só o administrador da companhia recebe (quem decide é o banco). O
   sino entrega a leitura leve (index-avisos.js chama definir) e a
   página aberta diz onde a nota fica e de quais meses (ligar):
     · a Escala, embaixo da barra: os meses do período na tela, com o
       X. Ele vale até recarregar ou entrar de novo na página, e a nota
       volta se o número mudar (nada fica guardado)
     · a Extrajornada, na Distribuição e nos Ajustes: o mês na tela,
       sem o X, porque é ali que se resolve; nos Ajustes, com o que
       fazer
   A nota só avisa, sem levar a nenhuma tela: o administrador tem mais
   de um caminho para resolver. Ela mostra o que está salvo: o que o
   rascunho vai mudar quem diz é o rodapé (extrajornada-grade.js,
   fraseDasCotas). No modo treino a nota não aparece. A linha da
   Pendências abre os Ajustes do mês, com o militar em foco quando é um
   só.
   API: RosterWork.cotasAviso.definir(grupos) · ligar(lugar, meses,
   opcoes) · atualizar() · irDistribuir(grupo) · pediuAjustes() ·
   focoPedido(competencia)
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* ao entrar na página, lê de novo se a última leitura passou disso: pega o que outro administrador salvou */
  var RELER_MS = 30000;

  var grupos = [];           // a última leitura: um grupo por mês
  var lidoEm = Date.now();   // a primeira leitura sai quando o sistema abre
  var atual = null;          // onde a nota fica agora: { lugar, meses(), opcoes }
  var ocultos = {};          // o X: o mês e a contagem que ele escondeu
  var pedido = null;         // o caminho até os Ajustes: { competencia, cpf } (o cpf só com um militar)

  function M() { return RW.mensagens.cotasAviso; }
  function noTreino() { return !!(RW.treino && RW.treino.ligado()); }

  function doMes(competencia) {
    return grupos.filter(function (g) { return g.competencia === competencia; })[0] || null;
  }

  function montarNota(g) {
    var nota = RW.tpl('tpl-cotas-aviso');
    if (!nota) return null;
    var lista = g.militares || [], primeiro = lista[0] || {}, opcoes = atual.opcoes || {};
    var nome = ((primeiro.grad || '') + ' ' + (primeiro.nome || '')).trim();
    var texto = lista.length > 1 ? M().varios(nome, lista.length - 1) : M().umMilitar(nome, primeiro.colocadas, primeiro.recebidas);
    nota.querySelector('.nota-titulo').textContent = M().titulo(Number(g.contagem) || 0, RW.extrajornadaGrade.nomeDoMes(g.competencia));
    nota.querySelector('.cotas-aviso-texto').textContent = opcoes.comoFazer ? texto + ' ' + M().comoFazer : texto;
    if (!opcoes.acoes) return nota;
    var fechar = nota.querySelector('.cotas-aviso-fechar');
    fechar.classList.remove('oculto');
    fechar.addEventListener('click', function () {
      ocultos[g.competencia] = g.contagem;
      atualizar();
    });
    return nota;
  }

  /* desenha de novo no lugar ligado: uma leitura nova, ou o mês ou a aba mudou na tela */
  function atualizar() {
    if (!atual || !document.contains(atual.lugar)) return;
    atual.lugar.textContent = '';
    if (!noTreino()) {
      atual.meses().forEach(function (competencia) {
        var g = doMes(competencia);
        if (!g || ocultos[competencia] === g.contagem) return;
        var nota = montarNota(g);
        if (nota) atual.lugar.appendChild(nota);
      });
    }
    atual.lugar.classList.toggle('oculto', !atual.lugar.childElementCount);
  }

  /* a leitura nova do sino */
  function definir(lista) {
    grupos = (lista || []).filter(function (g) { return g.tipo === 'extra_cotas'; });
    lidoEm = Date.now();
    atualizar();
  }

  /* a página diz o lugar e os meses (uma função: os meses mudam com a tela); opcoes = { acoes: com o X, comoFazer }. O lugar
     novo é uma visita nova à página: o X recomeça. A leitura antiga é refeita, sem esperar por ela */
  function ligar(lugar, meses, opcoes) {
    if (!atual || atual.lugar !== lugar) ocultos = {};
    atual = { lugar: lugar, meses: meses, opcoes: opcoes };
    if (RW.sessao && RW.sessao.temPapel('pelotao') && RW.avisosSino && Date.now() - lidoEm > RELER_MS) RW.avisosSino.recarregar();
    atualizar();
  }

  /* a linha da Pendências: os Ajustes do mês */
  function irDistribuir(g) {
    var lista = g.militares || [];
    pedido = { competencia: g.competencia, cpf: lista.length === 1 ? lista[0].cpf : null };
    if (RW.irParaPagina) RW.irParaPagina('extrajornada', 'organizar', g.competencia);
  }

  /* chegou aos Ajustes: o militar para pôr em foco, se o pedido é deste mês (vale uma vez) */
  function focoPedido(competencia) {
    var chegou = pedido;
    pedido = null;
    return chegou && chegou.competencia === competencia ? chegou.cpf : null;
  }

  RW.cotasAviso = {
    definir: definir, ligar: ligar, atualizar: atualizar, irDistribuir: irDistribuir, focoPedido: focoPedido,
    pediuAjustes: function () { return !!pedido; }
  };
})();
