/* ============================================================
   EXTRAJORNADA — o Imprimir de cada aba (o botão da barra)
   - Minha extra, Pedidos e Cotas: a cópia da tela no painel de
     impressão comum (componentes/js/geral-impressao.js), com as caixas
     do molde #tpl-extrajornada-imprimir-tela: a orientação (Pedidos e
     Cotas; os Voluntários começam em paisagem, o resto em retrato) e,
     nos Pedidos, como organizar a lista aberta na tela (começa na lista
     única, como a tela). As folhas são do extrajornada-tela-pdf.js, com
     o que a tela mostra (o que ainda não foi salvo também), tirado na
     hora de abrir de quem desenha a tela.
   - Extras do mês, Distribuição e Ajustes: o painel das grades
     (extrajornada-imprimir-grade.js).
   - Pedidos, Cotas, Distribuição e Ajustes: a caixa "O que imprimir"
     no alto (Cópia da tela ou o relatório da aba: de pedidos, de termos
     e cotas, inicial e final), que troca o painel; o relatório abre o
     painel dos Relatórios (extrajornada-imprimir.js), apagado com o
     motivo enquanto não libera.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaImprimirTela.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* o relatório de cada aba */
  var RELATORIO = { pedidos: 'pedidos', cotas: 'termos', distribuicao: 'inicial', ajustes: 'final' };
  /* o que vale do molde em cada cópia */
  var MARCAS = { minha: [], pedidos: ['orientacao', 'organizar'], cotas: ['orientacao'] };

  var form = null;   // a cópia aberta: { qual, d, tela, orientacao, modo, atualizar }

  function msg() { return RW.mensagens.extrajornada.imprimir; }
  function mes() { return RW.extrajornadaOrg.dados(); }
  function nomeDoMes(competencia) { return MESES[+competencia.slice(5, 7) - 1] + ' de ' + competencia.slice(0, 4); }
  function subtitulo(paisagem) { return RW.mensagens.escala.impressao.grade.subtitulo(paisagem, false); }

  /* a caixa "O que imprimir" da aba (só nas que têm relatório): o relatório apagado com o motivo enquanto não libera;
     trocar reabre o painel na outra escolha */
  function escolha(qual, atual, opcoes) {
    var rel = RELATORIO[qual], d = mes();
    if (!rel || !d) return null;
    return { relatorio: msg().resumo.relatorios[rel], motivo: RW.extrajornadaImprimir.motivo(rel, d), atual: atual,
      aoTrocar: function (outra) { abrir(qual, opcoes, outra); } };
  }

  function fecharLimpo() {
    if (RW.impressao) RW.impressao.esquecer();
    form = null;
  }

  /* o estado para o painel comum: o resumo, a chave do arquivo e como montá-lo */
  function estado() {
    var f = form, t = msg().tela, qual = f.qual, comp = f.d.competencia;
    var detalhe = qual === 'pedidos' ? t.daLista(t.listas[f.tela.lista], msg().resumo.modos[f.modo]) : qual === 'cotas' ? t.todos : '';
    var opc = { orientacao: f.orientacao, modo: f.modo, unidade: null, tela: f.tela };
    return {
      resumo: t.resumo(t.telas[qual], nomeDoMes(comp), detalhe),
      chave: [qual, f.orientacao, f.modo].join('|'),
      montar: function () {
        var pdf = RW.extrajornadaTelaPdf;
        return pdf.arquivo(qual, f.d, opc).then(function (arquivo) {
          return RW.impressao.contarFolhas(arquivo).then(function (n) {
            return { arquivo: arquivo, nome: pdf.nomeArquivo(qual, comp), folhas: RW.mensagens.impressao.folhas(n, false, f.orientacao === 'paisagem') };
          });
        });
      }
    };
  }

  /* as caixas da cópia: a orientação (troca o subtítulo) e como organizar */
  function ligar(corpo, atualizar) {
    form.atualizar = atualizar;
    var orientacao = corpo.querySelector('[data-imprimir-orientacao]');
    Array.prototype.forEach.call(orientacao.querySelectorAll('[data-orientacao]'), function (b) {
      b.classList.toggle('aba--ativa', b.getAttribute('data-orientacao') === form.orientacao);
    });
    RW.abas.ligar(orientacao, function (b) {
      form.orientacao = b.getAttribute('data-orientacao');
      RW.painel.definirTitulos(null, subtitulo(form.orientacao === 'paisagem'));
      atualizar();
    });
    RW.abas.ligar(corpo.querySelector('[data-imprimir-modo]'), function (b) { form.modo = b.getAttribute('data-modo'); atualizar(); });
  }

  /* a cópia da tela da Minha extra, dos Pedidos ou das Cotas */
  function abrirCopia(qual, opcoes) {
    var d = qual === 'minha' ? opcoes.minha : mes();
    var tela = qual === 'pedidos' ? RW.extrajornadaOrg.pedidos() : qual === 'cotas' ? RW.extrajornadaCotas.paraImprimir() : null;
    if (!d || (qual !== 'minha' && !tela)) return;
    var orientacao = qual === 'pedidos' && tela.lista === 'vol' ? 'paisagem' : 'retrato';
    fecharLimpo();
    RW.painel.abrir({ titulo: msg().tela.titulos[qual], subtitulo: subtitulo(orientacao === 'paisagem'), aoFechar: fecharLimpo });
    form = { qual: qual, d: d, tela: tela, modo: 'unica', orientacao: orientacao, atualizar: null };
    var corpo = RW.painel.corpo();
    RW.impressao.montar(corpo, RW.painel.rodape(), {
      molde: 'tpl-extrajornada-imprimir-tela',
      marcas: MARCAS[qual],
      escolha: escolha(qual, 'tela', opcoes),
      aoSair: function () { RW.painel.fechar(); },
      ligar: function (peca, atualizar) { ligar(corpo, atualizar); },
      estado: estado
    });
    if (form.atualizar) form.atualizar();
  }

  /* qual: a aba ('minha', 'extras', 'pedidos', 'cotas', 'distribuicao' ou 'ajustes'); opcoes: { modo (Agenda ou
     Calendário, da barra), minha (o pedido do militar, extrajornada_minha) }; escolhido: 'tela' (o padrão) ou 'relatorio' */
  function abrir(qual, opcoes, escolhido) {
    var d = mes();
    if (escolhido === 'relatorio') {
      fecharLimpo();
      RW.extrajornadaImprimir.abrir(RELATORIO[qual], d, MESES[+d.competencia.slice(5, 7) - 1] + ' ' + d.competencia.slice(0, 4), escolha(qual, 'relatorio', opcoes));
      return;
    }
    if (qual === 'extras' || qual === 'distribuicao' || qual === 'ajustes') {
      fecharLimpo();
      RW.extrajornadaImprimirGrade.abrir(qual === 'extras', opcoes.modo, escolha(qual, 'tela', opcoes));
      return;
    }
    abrirCopia(qual, opcoes);
  }

  RW.extrajornadaImprimirTela = { abrir: abrir };
})();
