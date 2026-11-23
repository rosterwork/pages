/* ============================================================
   AFASTAMENTOS — o Imprimir da barra
   (RosterWork.afastamentosImpressao.abrir)
   Abre o painel de impressão da aba da tela, no painel comum
   (componentes/js/geral-impressao.js, com as caixas do molde
   #tpl-escala-impressao do index.html, marca afastamentos):
   - Ano e Mês: as Unidades (começam com as da tela), o Formato
     (Folhas A4 ou Página contínua) e a Prévia; a folha é a do
     afastamentos-impressao-pdf.js, em A4 paisagem.
   - Calendário: o painel das grades da Escala
     (escalas-impressao-grade.js), com as Semanas e sem a Orientação
     nem o Mostrar; em cada dia, os afastados de cada unidade, sem
     riscar, com "Férias até DD/MM" (a célula do PDF das grades); os
     dias de outro mês saem vazios.
   O que sai é o que a tela mostra: o ano ou o mês e a aba de quando o
   painel abriu, os filtros, a busca, a ordem e o que ainda não foi
   salvo. A unidade marcada no painel que não está na tela sai com as
   mesmas regras. Com o ano ainda chegando do banco, a prévia espera.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var form = null;   // o painel aberto (Ano e Mês): a vista da tela e o formato

  function M() { return RW.mensagens.afastamentos; }
  function T() { return RW.mensagens.afastamentos.impressao; }
  function G() { return RW.mensagens.escala.impressao.grade; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }

  /* as unidades pedidas, cada uma com os militares que a tela mostra (na ordem da tela), depois que o ano chegou; sem o
     ano (a leitura falhou), a frase da falha */
  function unidadesProntas(o, ids) {
    return o.pronto().then(function (ok) {
      if (!ok) throw { mensagem: M().falhaCarregar };
      return ids.map(o.unidade).filter(Boolean);
    });
  }

  /* ---------- Calendário ---------- */
  /* a leitura do calendário no formato da leitura da escala: em cada dia, os afastados da unidade, na ordem da tela, sem
     riscar e sem os filtros da Escala (a lista já vem filtrada pela tela); sem gráfico */
  function leituraDoCalendario(o) {
    return function (ids, inicio, fim) {
      return unidadesProntas(o, ids).then(function (unidades) {
        var r = { militares: {}, fora: {}, cobertura: {}, erro: {}, jaFiltrada: true };
        unidades.forEach(function (u) {
          var uid = u.unidade.unidade_id;
          r.militares[uid] = {};
          for (var d = new Date(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10)); iso(d) <= fim; d.setDate(d.getDate() + 1)) {
            var dia = iso(d), lista = [];
            u.pessoas.forEach(function (p) {
              o.afastamentos(p, dia, dia).forEach(function (af) {
                lista.push({ cpf: p.usuario_id, grad: p.grau_abreviacao || '', nome: p.nome_de_guerra || '', ate: af.fim, afastamento: af.nome,
                  origem: RW.afastamentosGrade.afastado(af) ? 'afastamento' : 'viagem', semRisco: true });
              });
            });
            r.militares[uid][dia] = lista;
          }
        });
        return r;
      });
    };
  }

  function abrirCalendario(o) {
    RW.escalasImpressaoGrade.abrir({
      formato: 'calendario',
      data: new Date(o.ano, o.mes, 1),
      unidades: o.naTela,
      filtros: o.filtros,
      dados: leituraDoCalendario(o),
      titulo: T().titulo,
      prefixo: T().arquivo,
      conferir: null,
      semOficial: true,
      mostrar: {},
      marcas: ['afastamentos'],
      semOrientacao: true
    });
  }

  /* ---------- Ano e Mês ---------- */
  /* o período da folha ("dezembro de 2026" ou "2026") e o do nome do arquivo ("01-12 a 31-12-2026") */
  function textoPeriodo(o) { return o.aba === 'ano' ? String(o.ano) : G().comAno(M().mesesExtenso[o.mes], o.ano); }
  function periodoDoArquivo(o) {
    if (o.aba === 'ano') return '01-01 a 31-12-' + o.ano;
    return '01-' + p2(o.mes + 1) + ' a ' + p2(new Date(o.ano, o.mes + 1, 0).getDate()) + '-' + p2(o.mes + 1) + '-' + o.ano;
  }

  /* o estado das escolhas para o painel comum: o resumo e o arquivo (o mesmo pedido não monta de novo) */
  function estado(escolhas) {
    var o = form.o, continua = form.continua;
    var texto = textoPeriodo(o);
    var ids = escolhas.ids.slice();
    var nome = T().nomes[o.aba];
    return {
      resumo: G().resumo(nome, G().doMesDaTela(texto), G().juntar(escolhas.unidades.map(function (u) { return u.nome; })), o.filtros),
      chave: [ids.join(','), o.aba, continua, texto].join('|'),
      montar: function () {
        return unidadesProntas(o, ids).then(function (unidades) {
          unidades = unidades.filter(function (u) { return u.pessoas.length; });
          if (!unidades.length) throw { mensagem: T().vazio };
          return RW.afastamentosImpressaoPdf.gerar({
            aba: o.aba, ano: o.ano, mes: o.mes, continua: continua, texto: texto, nome: nome,
            unidades: unidades.map(function (u) {
              return { unidade: u.unidade, contagem: u.contagem,
                pessoas: u.pessoas.map(function (p) { return { pessoa: p, afastamentos: o.afastamentos(p, o.inicio, o.fim) }; }) };
            })
          });
        }).then(function (r) {
          return {
            arquivo: r.arquivo,
            nome: G().arquivo(nome, periodoDoArquivo(o), escolhas.unidades.length === 1 ? escolhas.unidades[0].nome : '', T().arquivo),
            folhas: RW.mensagens.impressao.folhas(r.folhas, continua, true)
          };
        });
      }
    };
  }

  function abrirGrade(o) {
    RW.painel.abrir({ titulo: T().titulos[o.aba], subtitulo: G().subtitulo(true, false),
      aoFechar: function () { RW.impressao.esquecer(); form = null; } });
    form = { o: o, continua: false };
    var meu = form;
    RW.impressao.montar(RW.painel.corpo(), RW.painel.rodape(), {
      molde: 'tpl-escala-impressao',
      marcas: ['afastamentos'],
      conferir: null,
      ids: o.naTela.map(function (u) { return u.unidade_id; }),
      mostrar: {},
      aoSair: function () { RW.painel.fechar(); },
      ligar: function (peca) {
        /* formato: Folhas A4 ou Página contínua */
        RW.abas.ligar(peca('formato'), function (aba) {
          form.continua = aba.getAttribute('data-formato') === 'continua';
          RW.painel.definirTitulos(null, G().subtitulo(true, form.continua));
          RW.impressao.atualizar();
        });
      },
      estado: function (escolhas) { return form === meu ? estado(escolhas) : { erro: ' ' }; }
    });
  }

  /* o = { aba ('ano' | 'mes' | 'calendario'), ano, mes, inicio e fim (o período da tela), naTela ([{ unidade_id, nome }]:
     as unidades da tela, marcadas no começo), filtros (os ligados, em texto), pronto() (promessa: true quando o ano
     chegou), unidade(id) ({ unidade, contagem, pessoas } com os militares que a tela mostraria, ou null) e
     afastamentos(pessoa, inicio, fim) (os à vista, com o rascunho) } */
  function abrir(o) {
    if (!RW.painel || !RW.impressao) return;
    if (o.aba === 'calendario') {
      if (RW.escalasImpressaoGrade) abrirCalendario(o);
      return;
    }
    if (RW.afastamentosImpressaoPdf) abrirGrade(o);
  }

  RW.afastamentosImpressao = { abrir: abrir };
})();
