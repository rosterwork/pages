/* ============================================================
   NOVA EXTRA — o painel Imprimir relatório (Relatórios › Imprimir)
   No molde do Imprimir trocas: o painel direito com as perguntas em
   caixas numeradas, a prévia do PDF e, no rodapé, Cancelar e Baixar
   PDF. 1. o relatório (já marcado o do botão; o que ainda não liberou
   fica apagado, com o motivo na dica); 2. o pelotão: todos ou um,
   entre os da área de quem imprime (com um só, a caixa some); 3. com
   todos, separar por pelotão ou a lista única. Cada mudança refaz a
   prévia (a última pedida vale). No celular, sem a prévia (o
   navegador não mostra PDF dentro da página). Os PDFs são do
   nova-extra-relatorios-pdf.js.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraImprimir.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var form = null;   // o painel aberto: { d, qual, unidade, modo, pedido, url e as peças }
  var token = 0;     // a última prévia pedida (as anteriores são ignoradas)

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

  function opcoes() { return { unidade: form.unidade, modo: form.modo }; }
  function mostrarCarregando(sim) { form.carregando.classList.toggle('carregando-veu--visivel', sim); }
  function mostrarAviso(texto) { form.aviso.textContent = texto; form.aviso.classList.remove('oculto'); mostrarCarregando(false); }

  /* a 2ª caixa só com mais de um pelotão; a 3ª só com todos */
  function mostrarCaixas() {
    form.caixaUnidade.classList.toggle('oculto', unidadesDaArea(form.d).length < 2);
    form.caixaModo.classList.toggle('oculto', !!form.unidade);
  }

  /* refaz a prévia com as escolhas de agora */
  function refazer() {
    var meu = ++token, ref = form;
    form.pedido = null;
    if (RW.celular && RW.celular()) return;
    mostrarCarregando(true);
    form.pedido = { token: meu, promessa: pdf().arquivo(form.qual, form.d, opcoes()) };
    form.pedido.promessa.then(function (arquivo) {
      if (form !== ref || meu !== token) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(arquivo);
      /* o leitor do navegador sem a barra dele, na largura do quadro */
      form.previa.src = form.url + '#toolbar=0&navpanes=0&view=FitH';
      form.aviso.classList.add('oculto');
      mostrarCarregando(false);
    }, function () {
      if (form !== ref || meu !== token) return;
      mostrarAviso(msg().falhaPrevia);
    });
  }

  /* baixa o arquivo da prévia (ou monta agora, no celular) e fecha o painel */
  function gerar() {
    var botao = form.gerar, nome = pdf().nomeArquivo(form.qual, form.d, opcoes());
    var promessa = form.pedido && form.pedido.token === token ? form.pedido.promessa : pdf().arquivo(form.qual, form.d, opcoes());
    RW.iniciarCarregando(botao);
    promessa.then(function (arquivo) {
      RW.pararCarregando(botao);
      RW.escalasImpressaoPdf.baixar(arquivo, nome);
      RW.painel.fechar();
    }, function () {
      RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: msg().falhaGerar });
    });
  }

  function fecharLimpo() {
    token++;
    if (form && form.url) URL.revokeObjectURL(form.url);
    form = null;
  }

  /* abre o painel com o relatório qual ('pedidos', 'termos', 'inicial' ou 'final') do mês d (nova_extra_mes) */
  function abrir(qual, d, subtitulo) {
    fecharLimpo();
    RW.painel.abrir({ titulo: msg().titulo, subtitulo: subtitulo || '', aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape();
    corpo.appendChild(document.getElementById('tpl-ne-imprimir').content.cloneNode(true));
    rodape.appendChild(document.getElementById('tpl-ne-imprimir-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    function peca(nome) { return corpo.querySelector('[data-imprimir-' + nome + ']') || rodape.querySelector('[data-imprimir-' + nome + ']'); }
    var area = unidadesDaArea(d);
    form = {
      d: d, qual: qual, unidade: area.length === 1 ? area[0].id : null, modo: 'separar', pedido: null, url: null,
      previa: peca('previa'), aviso: peca('previa-aviso'), carregando: peca('previa-carregando'), gerar: peca('gerar'),
      caixaUnidade: peca('unidade-caixa'), caixaModo: peca('modo-caixa')
    };
    /* 1. o relatório: o do botão marcado; o que ainda não liberou, apagado com o motivo na dica */
    Array.prototype.forEach.call(peca('relatorio').querySelectorAll('[data-relatorio]'), function (b) {
      var q = b.getAttribute('data-relatorio'), porque = motivo(q, d);
      b.classList.toggle('aba--ativa', q === qual);
      b.disabled = !!porque;
      if (porque) b.setAttribute('data-dica', porque);
    });
    RW.abas.ligar(peca('relatorio'), function (b) { form.qual = b.getAttribute('data-relatorio'); refazer(); });
    /* 2. o pelotão: todos ou um da área */
    var seletor = peca('unidade');
    area.forEach(function (u) {
      var b = RW.tpl('tpl-ne-imprimir-unidade');
      b.setAttribute('data-unidade', u.id);
      b.textContent = u.nome;
      seletor.appendChild(b);
    });
    RW.abas.ligar(seletor, function (b) {
      var v = b.getAttribute('data-unidade');
      form.unidade = v ? +v : null;
      mostrarCaixas();
      refazer();
    });
    /* 3. como organizar (com todos) */
    RW.abas.ligar(peca('modo'), function (b) { form.modo = b.getAttribute('data-modo'); refazer(); });
    peca('cancelar').addEventListener('click', function () { RW.painel.fechar(); });
    form.gerar.addEventListener('click', gerar);
    mostrarCaixas();
    refazer();
  }

  RW.novaExtraImprimir = { abrir: abrir, motivo: motivo };
})();
