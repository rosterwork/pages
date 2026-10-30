/* ============================================================
   ESCALAS — Imprimir escala (as folhas do dia → PDF)
   Usa o painel de impressão comum (componentes/js/geral-impressao.js,
   com as caixas do molde #tpl-escala-impressao do escalas.html), com
   o que é desta impressão: o período (datas De/Até, já com o dia
   exibido, e os atalhos; até 31 dias por arquivo, o banco confere de
   novo), o Mostrar (os ícones de origem, com a legenda no pé da
   folha) e o arquivo: a escala buscada no banco em blocos pequenos
   (escala_impressao) e montada pelo escalas-impressao-pdf.js.
   Abre no painel próprio (o Imprimir da barra no Militares) ou, pelo
   Imprimir do painel do dia (subcabeçalho da aba Dia, só na Escala),
   numa sub-tela no lugar da lista, marcada com o dia e a unidade do
   painel; esse botão fica desligado enquanto há alteração não salva
   (o PDF sai do que está gravado). Aqui também a conferência do erro
   grave do período, o aviso do painel nas duas impressões da escala.
   API: RosterWork.escalasImpressao.abrir({ data }), .abrirNoDia(corpo, rodape, { unidadeId, iso, aoSair }),
        .botaoDoDia(aoClicar), .conferirErros(escolhas, estado)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var LIMITE_DIAS = 31;
  var UNIDADE_DIAS_POR_BLOCO = 28;   // cada chamada ao banco cobre até ~28 unidade×dia (fica em poucos segundos)
  var BLOCOS_SIMULTANEOS = 3;

  var cacheDados = null;   // { chave, promessa }: ligar ou desligar os ícones não busca a escala de novo

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.impressao) || {}; }
  function painel() { return RW.impressao; }

  /* ---------- datas ---------- */
  function somarDias(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function diasEntre(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }

  function idsAplicados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* ---------- a escala do banco, em blocos ---------- */
  function blocosDoPeriodo(inicio, fim, nUnidades) {
    var porBloco = Math.max(1, Math.floor(UNIDADE_DIAS_POR_BLOCO / Math.max(1, nUnidades)));
    var blocos = [];
    for (var d = inicio; diasEntre(d, fim) >= 0; d = somarDias(d, porBloco)) {
      var f = somarDias(d, porBloco - 1);
      if (diasEntre(f, fim) < 0) f = fim;
      blocos.push([RW.data.paraIsoDeData(d), RW.data.paraIsoDeData(f)]);
    }
    return blocos;
  }

  /* busca os blocos (no máximo BLOCOS_SIMULTANEOS ao mesmo tempo); rejeita se algum falhar */
  function buscarPeriodo(ids, blocos) {
    var resultados = new Array(blocos.length);
    var proximo = 0;
    function trabalhar() {
      if (proximo >= blocos.length) return Promise.resolve();
      var i = proximo++;
      return RW.escalasDados.lerImpressao(ids, blocos[i][0], blocos[i][1]).then(function (r) {
        if (!r || !Array.isArray(r.dias)) throw new Error('falha');
        resultados[i] = r;
        return trabalhar();
      });
    }
    var filas = [];
    for (var k = 0; k < Math.min(BLOCOS_SIMULTANEOS, blocos.length); k++) filas.push(trabalhar());
    return Promise.all(filas).then(function () {
      return {
        unidades: resultados[0].unidades || [],
        dias: resultados.reduce(function (acc, r) { return acc.concat(r.dias); }, [])
      };
    });
  }

  /* a mesma escala (unidades e período) não é buscada de novo; a que falhou, sim */
  function carregarDados(ids, inicio, fim) {
    var chave = ids.join(',') + '|' + RW.data.paraIsoDeData(inicio) + '|' + RW.data.paraIsoDeData(fim);
    if (cacheDados && cacheDados.chave === chave) return cacheDados.promessa;
    var promessa = buscarPeriodo(ids, blocosDoPeriodo(inicio, fim, ids.length));
    cacheDados = { chave: chave, promessa: promessa };
    promessa.catch(function () { if (cacheDados && cacheDados.promessa === promessa) cacheDados = null; });
    return promessa;
  }

  /* ---------- o erro grave do período (o aviso do painel; o dia e as grades) ---------- */
  /* resolve em { titulo, descricao } ou null: "13/10 (2ºPEL), 14/10 (2ºPEL e 3ºPEL)", agrupado por dia */
  function conferirErros(escolhas, estado) {
    if (!RW.escalasDados) return null;
    return RW.escalasDados.lerImpressaoErros(escolhas.ids, estado.inicio, estado.fim).then(function (lista) {
      if (!Array.isArray(lista) || !lista.length) return null;
      var porDia = {}, ordem = [];
      lista.forEach(function (e) {
        if (!porDia[e.data]) { porDia[e.data] = []; ordem.push(e.data); }
        porDia[e.data].push(e.unidade);
      });
      var partes = ordem.map(function (iso) {
        var nomes = porDia[iso];
        var unidades = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
        return iso.slice(8, 10) + '/' + iso.slice(5, 7) + ' (' + unidades + ')';
      });
      return { titulo: msg().avisoTitulo(ordem.length), descricao: msg().avisoDescricao(partes.join(', ')) };
    });
  }

  /* ---------- o formulário (o que é desta impressão) ---------- */
  /* monta o painel comum em corpo e rodape. opcoes: { data, ids, aoSair } = a data padrão, as unidades marcadas no
     começo e a saída (Cancelar e o fim do Gerar PDF) */
  function montarFormulario(corpo, rodape, opcoes) {
    var campos = {};   // De e Até
    painel().montar(corpo, rodape, {
      molde: 'tpl-escala-impressao',
      marcas: ['dia'],
      conferir: conferirErros,
      ids: opcoes.ids,
      mostrar: { icones: true },
      aoSair: opcoes.aoSair,
      ligar: function (peca, atualizar) {
        campos.inicio = peca('inicio');
        campos.fim = peca('fim');
        campos.inicio.value = RW.data.paraBR(opcoes.data);
        campos.fim.value = RW.data.paraBR(opcoes.data);
        if (RW.campos) { RW.campos.ligarData(campos.inicio); RW.campos.ligarData(campos.fim); }
        [campos.inicio, campos.fim].forEach(function (el) {
          el.addEventListener('input', function () { if (RW.campos) RW.campos.limparErro(el); atualizar(); });
        });
        /* atalhos: o período sempre parte da data "De" */
        Array.prototype.forEach.call(corpo.querySelectorAll('[data-impressao-atalho]'), function (b) {
          b.addEventListener('click', function () {
            var inicio = RW.data.paraData(campos.inicio.value);
            if (!inicio) return;
            var tipo = b.getAttribute('data-impressao-atalho');
            var fim = inicio;
            if (tipo === 'semana') fim = somarDias(inicio, 6);
            if (tipo === 'mes') fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
            campos.fim.value = RW.data.paraBR(fim);
            if (RW.campos) { RW.campos.limparErro(campos.inicio); RW.campos.limparErro(campos.fim); }
            atualizar();
          });
        });
      },
      /* o período (com marcarErros, os erros ficam nos campos), o resumo e o arquivo das escolhas */
      estado: function (escolhas, marcarErros) {
        var m = msg();
        var inicio = RW.data.paraData(campos.inicio.value);
        var fim = RW.data.paraData(campos.fim.value);
        var primeiro = '';
        function erro(el, texto) { if (!primeiro) primeiro = texto; if (marcarErros && RW.campos) RW.campos.marcarErro(el, texto); }
        if (!inicio) erro(campos.inicio, m.dataInvalida);
        if (!fim) erro(campos.fim, m.dataInvalida);
        if (inicio && fim && diasEntre(inicio, fim) < 0) erro(campos.fim, m.fimAntesInicio);
        if (inicio && fim && diasEntre(inicio, fim) >= LIMITE_DIAS) erro(campos.fim, m.limiteDias);
        if (primeiro) return { erro: primeiro };
        var icones = !!escolhas.mostrar.icones;
        var nomes = escolhas.unidades.map(function (u) { return u.nome; });
        return {
          resumo: m.resumo(m.periodo(RW.data.paraBR(inicio), RW.data.paraBR(fim)), m.grade.juntar(nomes)),
          inicio: RW.data.paraIsoDeData(inicio),
          fim: RW.data.paraIsoDeData(fim),
          chave: escolhas.ids.join(',') + '|' + RW.data.paraIsoDeData(inicio) + '|' + RW.data.paraIsoDeData(fim) + '|' + icones,
          montar: function () {
            return carregarDados(escolhas.ids, inicio, fim).then(function (dados) {
              dados.inicio = RW.data.paraIsoDeData(inicio);
              dados.fim = RW.data.paraIsoDeData(fim);
              return RW.escalasImpressaoPdf.montar(dados, { icones: icones });
            }).then(function (r) {
              return { arquivo: r.arquivo, nome: r.nome, folhas: RW.mensagens.impressao.folhas(r.folhas, false, false) };
            });
          }
        };
      }
    });
  }

  /* o painel próprio (o Imprimir da barra no Militares). opcoes: { data } = o dia que a escala mostra (a data padrão);
     as unidades vêm marcadas com a seleção do cabeçalho (e a companhia de cada pelotão) */
  function abrir(opcoes) {
    if (!RW.painel || !painel()) return;
    var m = msg();
    cacheDados = null;
    RW.painel.abrir({ titulo: m.titulo, subtitulo: m.subtitulo, aoFechar: painel().esquecer });
    montarFormulario(RW.painel.corpo(), RW.painel.rodape(), {
      data: (opcoes && opcoes.data) || new Date(),
      ids: idsAplicados(),
      aoSair: function () { RW.painel.fechar(); }
    });
  }

  /* ---------- o Imprimir do painel do dia (subcabeçalho da aba Dia; escalas-painel-editar.js) ---------- */

  /* com alteração não salva (o rodapé largo da página à vista, também enquanto grava), o PDF sairia sem ela: o botão
     fica desligado e a dica diz o motivo */
  function atualizarBotaoDoDia(botao) {
    var b = botao || document.querySelector('#painel .escala-dia-imprimir');
    if (!b) return;
    if (!b.dataset.dicaPadrao) b.dataset.dicaPadrao = b.getAttribute('data-dica') || '';
    var pendente = !!(RW.escalasPainelSalvar && RW.escalasPainelSalvar.contar());
    b.disabled = pendente;
    b.setAttribute('data-dica', pendente ? msg().salveAntes : b.dataset.dicaPadrao);
  }

  /* o botão do subcabeçalho; null fora da Escala (o formulário mora no escalas.html). aoClicar abre a sub-tela */
  function botaoDoDia(aoClicar) {
    if (!document.getElementById('tpl-escala-impressao')) return null;
    var b = RW.tpl('tpl-escala-dia-imprimir');
    if (!b) return null;
    atualizarBotaoDoDia(b);
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* a sub-tela, no lugar da lista do dia: o Voltar ao dia e o formulário marcado com o dia e a unidade do painel.
     opcoes: { unidadeId, iso, aoSair } (aoSair: o Voltar ao dia, o Cancelar e o fim do Gerar PDF; a lista volta a
     desenhar o corpo e o rodapé, que sai limpo daqui) */
  function abrirNoDia(corpo, rodape, opcoes) {
    if (!corpo || !painel()) return;
    cacheDados = null;
    corpo.textContent = '';
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    function fim() {
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
      opcoes.aoSair();
    }
    var voltar = RW.tpl('tpl-escala-sub-voltar');
    if (voltar) {
      voltar.addEventListener('click', function () { painel().esquecer(); fim(); });
      corpo.appendChild(voltar);
    }
    montarFormulario(corpo, rodape, {
      data: RW.data.paraData(RW.data.isoParaBR(opcoes.iso)),
      ids: [opcoes.unidadeId],
      aoSair: fim
    });
  }

  /* o rascunho do painel do dia mudou, ou foi salvo: o Imprimir liga ou desliga */
  ['rosterwork_escala_rascunho', 'rosterwork_escala_salva'].forEach(function (nome) {
    window.addEventListener(nome, function () { atualizarBotaoDoDia(); });
  });

  RW.escalasImpressao = { abrir: abrir, botaoDoDia: botaoDoDia, abrirNoDia: abrirNoDia, conferirErros: conferirErros };
})();
