/* ============================================================
   NOVA EXTRA — o painel Imprimir relatório (Relatórios › Imprimir)
   O painel de impressão comum (componentes/js/geral-impressao.js),
   com as caixas do molde #tpl-ne-imprimir: 1. o relatório (já
   marcado o do botão; o que ainda não liberou fica apagado, com o
   motivo na dica); 2. o pelotão: todos ou um, entre os da área de
   quem imprime (com um só, a caixa some); 3. com todos, separar por
   pelotão ou a lista única. A nota, a prévia e o Gerar PDF são do
   painel comum. Os PDFs são do nova-extra-relatorios-pdf.js.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraImprimir.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var form = null;   // o painel aberto: { d, qual, unidade, modo, atualizar e as caixas }

  function msg() { return RW.mensagens.novaExtra.imprimir; }
  function pdf() { return RW.novaExtraRelatoriosPdf; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  /* o que ainda impede cada relatório (vazio = pode) */
  function motivo(qual, d) {
    var m = msg().indisponivel, c = d.competencia;
    var fechados = d.mes.estado === 'encerrado';
    var repartidas = d.militares.reduce(function (s, x) { return s + (x.voluntario && x.termo ? (x.concedidas || 0) : 0); }, 0);
    var terminou = d.hoje >= iso(new Date(+c.slice(0, 4), +c.slice(5, 7), 1));
    if (qual === 'pedidos') return fechados ? '' : m.pedidos;
    if (qual === 'termos') return fechados && repartidas > 0 ? '' : m.termos;
    if (qual === 'inicial') return d.lancamento ? '' : m.inicial;
    return d.lancamento && (terminou || d.mes.simular_inicio) ? '' : m.final;
  }

  /* os pelotões (e a companhia) da área de quem imprime */
  function unidadesDaArea(d) {
    return d.unidades.filter(function (u) { return !RW.sessao || RW.sessao.podeAdministrar('pelotao', u.id); });
  }

  /* a 2ª caixa só com mais de um pelotão; a 3ª só com todos */
  function mostrarCaixas() {
    form.caixaUnidade.classList.toggle('oculto', unidadesDaArea(form.d).length < 2);
    form.caixaModo.classList.toggle('oculto', !!form.unidade);
  }

  /* o estado para o painel comum: o resumo da nota, a chave do arquivo e como montá-lo, com as folhas */
  function estado() {
    var qual = form.qual, d = form.d, opc = { unidade: form.unidade, modo: form.modo }, r = msg().resumo;
    var c = d.competencia, mes = MESES[+c.slice(5, 7) - 1] + ' de ' + c.slice(0, 4);
    var u = unidadesDaArea(d).filter(function (x) { return String(x.id) === String(opc.unidade); })[0];
    return {
      resumo: r.frase(r.relatorios[qual], mes, u ? u.nome : r.todos, u ? '' : r.modos[opc.modo]),
      chave: qual + '|' + (u ? u.id : 'todos|' + opc.modo),
      montar: function () {
        return pdf().arquivo(qual, d, opc).then(function (arquivo) {
          return RW.impressao.contarFolhas(arquivo).then(function (n) {
            return { arquivo: arquivo, nome: pdf().nomeArquivo(qual, d, opc), folhas: RW.mensagens.impressao.folhas(n, false, false) };
          });
        });
      }
    };
  }

  /* as três caixas e o que cada uma faz */
  function ligar(corpo, atualizar) {
    function peca(nome) { return corpo.querySelector('[data-imprimir-' + nome + ']'); }
    var d = form.d;
    form.atualizar = atualizar;
    form.caixaUnidade = peca('unidade-caixa');
    form.caixaModo = peca('modo-caixa');
    /* 1. o relatório: o do botão marcado; o que ainda não liberou, apagado com o motivo na dica */
    Array.prototype.forEach.call(peca('relatorio').querySelectorAll('[data-relatorio]'), function (b) {
      var q = b.getAttribute('data-relatorio'), porque = motivo(q, d);
      b.classList.toggle('aba--ativa', q === form.qual);
      b.disabled = !!porque;
      if (porque) b.setAttribute('data-dica', porque);
    });
    RW.abas.ligar(peca('relatorio'), function (b) { form.qual = b.getAttribute('data-relatorio'); atualizar(); });
    /* 2. o pelotão: todos ou um da área */
    var seletor = peca('unidade');
    unidadesDaArea(d).forEach(function (u) {
      var b = RW.tpl('tpl-ne-imprimir-unidade');
      b.setAttribute('data-unidade', u.id);
      b.textContent = u.nome;
      seletor.appendChild(b);
    });
    RW.abas.ligar(seletor, function (b) {
      var v = b.getAttribute('data-unidade');
      form.unidade = v ? +v : null;
      mostrarCaixas();
      atualizar();
    });
    /* 3. como organizar (com todos) */
    RW.abas.ligar(peca('modo'), function (b) { form.modo = b.getAttribute('data-modo'); atualizar(); });
    mostrarCaixas();
  }

  function fecharLimpo() {
    if (RW.impressao) RW.impressao.esquecer();
    form = null;
  }

  /* abre o painel com o relatório qual ('pedidos', 'termos', 'inicial' ou 'final') do mês d (nova_extra_mes) */
  function abrir(qual, d, subtitulo) {
    fecharLimpo();
    RW.painel.abrir({ titulo: msg().titulo, subtitulo: subtitulo || '', aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo();
    var area = unidadesDaArea(d);
    form = { d: d, qual: qual, unidade: area.length === 1 ? area[0].id : null, modo: 'separar', atualizar: null };
    RW.impressao.montar(corpo, RW.painel.rodape(), {
      molde: 'tpl-ne-imprimir',
      aoSair: function () { RW.painel.fechar(); },
      ligar: function (peca, atualizar) { ligar(corpo, atualizar); },
      estado: estado
    });
    if (form.atualizar) form.atualizar();
  }

  RW.novaExtraImprimir = { abrir: abrir, motivo: motivo };
})();
