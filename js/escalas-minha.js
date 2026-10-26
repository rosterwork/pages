/* ============================================================
   ESCALAS — Minha escala (o seu mês)
   À esquerda, o mês de quem está logado (escala_minha_calendario:
   a mesma leitura do mês da Escala, filtrada por ele) no mês em
   miniatura (geral-mini-calendario), com os ícones da Escala em
   cada dia; ao lado (embaixo, no celular), a escala inteira da
   unidade no dia escolhido (escala_dia_arvore, com o desenho do
   Dia: escalas-dia.js), só de leitura, com você realçado
   (escalas-filtros.js). Abre no próximo serviço; "hoje" é o dia
   de serviço (vira às 08h). O mês sem serviço diz por quê e leva
   à aba Mês. O período, as setas e o deslize do mês no celular são
   os da página (escalas.js); daqui vem a leitura antecipada do mês
   vizinho. Só clona moldes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /* origem da linha -> ícone (os mesmos da Escala) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base', saida: 'icone-origem-saida', troca: 'icone-origem-troca', troca_saida: 'icone-origem-troca',
    pontual: 'icone-origem-pontual', sistema: 'icone-origem-sistema', folga: 'icone-folgas', extra: 'icone-extrajornada'
  };
  /* as linhas de quem saiu do serviço (riscadas na Escala) */
  var RISCADA = { folga: true, troca_saida: true };

  var el = {};
  var estado = { mes: null, dados: null, selecionado: null, pedidoDia: 0 };

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hojeIso() { return iso(RW.data.diaDeServico()); }
  function chaveMes(mes) { return 'escala_minha_calendario|' + iso(mes); }

  function buscarMes(mes) {
    var fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    return RW.rpc('escala_minha_calendario', { p_inicio: iso(mes), p_fim: iso(fim) });
  }

  /* o deslize do celular pede o mês vizinho antes da troca (geral-deslizar.js) */
  function antecipar(mes) {
    if (RW.deslizar) RW.deslizar.antecipar(chaveMes(mes), function () { return buscarMes(mes); });
  }

  /* um estado (carregando ou a falha) no lugar de um conteúdo */
  function mostrarEstado(alvo, idMolde, texto) {
    alvo.textContent = '';
    var no = RW.tpl(idMolde);
    if (!no) return;
    if (texto) no.textContent = texto;
    alvo.appendChild(no);
  }

  /* ---------- calendário ---------- */

  function icone(nome) {
    var svg = RW.tpl('tpl-escala-mes-origem');
    if (svg) svg.querySelector('use').setAttribute('href', 'icones/todos.svg#' + nome);
    return svg;
  }

  function temServico(dia) {
    return (dia.linhas || []).some(function (l) { return !RISCADA[l.origem] && l.origem !== 'afastamento'; });
  }

  /* um dia no quadradinho: os ícones das linhas dele (folga e troca de saída apagados); o afastado,
     listrado com a sigla (FÉR, LIC, DIS) */
  function desenharDia(botao, diaIso) {
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var linhas = dia.linhas || [];
    var texto = botao.querySelector('.mini-calendario-texto');
    if (diaIso === hojeIso()) botao.classList.add('mini-calendario-dia--hoje');
    if (diaIso === estado.selecionado) botao.classList.add('mini-calendario-dia--selecionado');

    var afast = linhas.filter(function (l) { return l.origem === 'afastamento'; })[0];
    if (afast) {
      botao.classList.add('mini-calendario-dia--afastado');
      texto.textContent = String(afast.afastamento || '').slice(0, 3).toUpperCase();
      return;
    }
    linhas.forEach(function (l) {
      var ic = icone(ICONE_ORIGEM[l.origem] || ICONE_ORIGEM.sistema);
      if (!ic) return;
      if (RISCADA[l.origem]) ic.classList.add('escala-minha-icone--riscado');
      texto.appendChild(ic);
    });
  }

  /* o dia que abre com o mês: o próximo serviço de hoje em diante; sem ele, hoje; fora do mês de hoje, o primeiro
     dia com algo marcado */
  function diaPadrao() {
    var dias = estado.dados.dias;
    var hoje = hojeIso();
    var chaves = Object.keys(dias).sort();
    var proximo = chaves.filter(function (k) { return k >= hoje && temServico(dias[k]); })[0];
    if (proximo) return proximo;
    if (dias[hoje]) return hoje;
    return chaves.filter(function (k) { return (dias[k].linhas || []).length; })[0] || chaves[0] || null;
  }

  /* o mês sem serviço: a nota diz por quê (o botão leva à aba Mês) */
  function mostrarSemServico() {
    var dias = estado.dados.dias;
    var algum = Object.keys(dias).some(function (k) { return temServico(dias[k]); });
    el.semServico.classList.toggle('oculto', algum);
    el.semServicoTexto.textContent = algum ? '' : RW.mensagens.escala.minhaSemServico(MESES[estado.mes.getMonth()]);
  }

  /* ---------- a escala do dia escolhido ---------- */

  /* a unidade do dia: a da primeira linha; sem linha, onde ele está no dia */
  function unidadeDoDia(dia) { return (dia.linhas && dia.linhas.length) ? dia.linhas[0].unidade : dia.unidade; }

  /* a escala inteira da unidade no dia (só de leitura); só a última leitura pedida desenha */
  function mostrarDia(diaIso) {
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var unidadeId = unidadeDoDia(dia);
    var meu = ++estado.pedidoDia;
    el.dia.classList.toggle('oculto', !unidadeId);
    if (!unidadeId) return;
    var d = dataDeIso(diaIso);
    var u = estado.dados.unidades[unidadeId] || {};
    el.diaTitulo.textContent = DIAS_CURTOS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    el.diaUnidade.textContent = [u.nome_painel || u.nome || '', u.cidade || ''].filter(Boolean).join(' · ');
    mostrarEstado(el.diaCorpo, 'tpl-escala-carregando');
    RW.rpc('escala_dia_arvore', { p_unidade_ids: [unidadeId], p_data: diaIso }).then(function (linhas) {
      if (meu !== estado.pedidoDia || !el.diaCorpo.isConnected) return;
      var linha = (linhas || []).filter(function (x) { return String(x.unidade_id) === String(unidadeId); })[0];
      el.diaCorpo.textContent = '';
      RW.escalasDia.desenharDistribuicao(el.diaCorpo, (linha && linha.distribuicao) || {});
    }, function () {
      if (meu !== estado.pedidoDia || !el.diaCorpo.isConnected) return;
      mostrarEstado(el.diaCorpo, 'tpl-escala-estado', RW.mensagens.escala.falhaCarregar);
    });
  }

  /* o clique (ou o toque) escolhe o dia */
  function selecionar(diaIso) {
    estado.selecionado = diaIso;
    Array.prototype.forEach.call(el.calendario.querySelectorAll('.mini-calendario-dia--selecionado'), function (b) {
      b.classList.remove('mini-calendario-dia--selecionado');
    });
    var botao = el.calendario.querySelector('.mini-calendario-dia[data-iso="' + diaIso + '"]');
    if (botao) botao.classList.add('mini-calendario-dia--selecionado');
    mostrarDia(diaIso);
  }

  /* ---------- a moldura e o mês ---------- */

  /* a moldura entra uma vez por visita à aba; trocar de mês só redesenha dentro dela */
  function montarMoldura(corpo) {
    var raiz = RW.tpl('tpl-escala-minha');
    if (!raiz) return false;
    corpo.textContent = '';
    corpo.appendChild(raiz);
    el = {
      raiz: raiz,
      calendario: raiz.querySelector('.escala-minha-calendario'),
      semServico: raiz.querySelector('.escala-minha-sem-servico'),
      semServicoTexto: raiz.querySelector('.escala-minha-sem-servico-texto'),
      dia: raiz.querySelector('.escala-minha-dia'),
      diaTitulo: raiz.querySelector('.escala-minha-dia-titulo'),
      diaUnidade: raiz.querySelector('.escala-minha-dia-unidade'),
      diaCorpo: raiz.querySelector('.escala-minha-dia-corpo')
    };
    el.calendario.addEventListener('click', function (e) {
      var botao = e.target.closest('.mini-calendario-dia');
      if (botao && estado.dados) selecionar(botao.dataset.iso);
    });
    /* Ver a escala de todos: a aba Mês (a troca de aba é a da página) */
    raiz.querySelector('.escala-minha-ver-todos').addEventListener('click', function () {
      var pagina = raiz.closest('.pagina');
      var mes = pagina && pagina.querySelector('#escala-modos .aba[data-modo="mes"]');
      if (mes) mes.click();
    });
    mostrarEstado(el.calendario, 'tpl-escala-carregando');
    return true;
  }

  /* desenha o mês de opcoes.dataRef (com a leitura antecipada pelo deslize, quando é a deste mês); o mês anterior
     fica na tela até o novo chegar. opcoes.vigente (latest-wins da página) diz se a tela ainda quer este desenho.
     A promessa se cumpre com o mês desenhado, com falha também */
  function renderizar(corpo, opcoes) {
    opcoes = opcoes || {};
    var ref = opcoes.dataRef || new Date();
    var vigente = opcoes.vigente || function () { return true; };
    if (!corpo.querySelector('.escala-minha') && !montarMoldura(corpo)) return Promise.resolve();
    var mes = new Date(ref.getFullYear(), ref.getMonth(), 1);
    var antecipada = RW.deslizar && RW.deslizar.usarAntecipada(chaveMes(mes));
    return (antecipada || buscarMes(mes)).then(function (r) {
      if (!vigente() || !el.calendario.isConnected) return;
      if (!r || !r.dias) { mostrarEstado(el.calendario, 'tpl-escala-estado', RW.mensagens.escala.falhaCarregarMes); return; }
      estado.mes = mes;
      estado.dados = { dias: r.dias, unidades: r.unidades || {} };
      estado.selecionado = diaPadrao();
      RW.miniCalendario.renderizar(el.calendario, { dataRef: mes, aoDia: desenharDia });
      mostrarSemServico();
      if (estado.selecionado) mostrarDia(estado.selecionado);
      else el.dia.classList.add('oculto');
    }, function () {
      if (!vigente() || !el.calendario.isConnected) return;
      mostrarEstado(el.calendario, 'tpl-escala-estado', RW.mensagens.escala.falhaCarregarMes);
    });
  }

  RW.escalasMinha = { renderizar: renderizar, antecipar: antecipar };
})();
