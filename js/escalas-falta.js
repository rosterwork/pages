/* ============================================================
   ESCALAS — a Falta de gente (a última opção dos Filtros)
   Marcada, embaixo do gráfico de cada unidade nas grades (Mês, Semana
   e Colunas), a linha dos horários de 6 h, a mesma da Extrajornada
   (o componente geral-falta-gente): quantos ainda faltam para o
   mínimo ("1 de 2" quando as extras cobriram parte), o certo quando
   não falta ninguém e o "+1" das extras a mais. Os números vêm do
   banco (escala_falta_mes: a falta sem as extras que já estão na
   escala e com elas), lidos só com a opção marcada, numa leitura só
   para as unidades e os dias da tela, e guardados aqui; a célula
   refeita com o gráfico diferente (a escala mudou) lê de novo. Como a
   grade, o dia que mudou e ainda não foi refeito vem da cópia de antes
   (a célula está com a borda amarela) e é lido de novo quando a cópia
   fica pronta; o dia que o Salvar acabou de gravar (certo na tela) vem
   do dado real, numa leitura à parte. A grade sai como sempre e a
   linha chega logo depois. Sem a leitura (o banco falhou), a linha não
   aparece.
   Não cria HTML (o componente clona o molde) nem escreve estilo.
   RosterWork.escalasFalta.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var dados = {};          // 'unidade|dia' -> { sem, com, marca } (marca: o gráfico da célula quando a conta foi pedida)
  var pendentes = {};      // 'unidade|dia' -> a marca do gráfico, à espera da leitura
  var agendada = false;
  var SELETOR = '.escala-mes-celula[data-iso][data-unidade-id]';

  function ligada() { return !!(RW.escalasFiltros && RW.escalasFiltros.faltaDeGente && RW.escalasFiltros.faltaDeGente()); }
  function chave(cel) { return cel.dataset.unidadeId + '|' + cel.dataset.iso; }
  function marca(g) { return (g.dataset.cob || '') + '/' + (g.dataset.erro || ''); }
  function celulas() { return document.querySelectorAll(SELETOR); }

  /* as extras de cada horário de 6 h (1 a 4): quantos de extra no dia cobrem o horário inteiro */
  function extrasDe(pessoas) {
    var e = { 1: 0, 2: 0, 3: 0, 4: 0 };
    (pessoas || []).forEach(function (p) {
      if (p.origem !== 'extra') return;
      var horas = {};
      (p.periodos || []).forEach(function (per) {
        if (!per.inicio || !per.fim) return;
        var f = RW.horario.faixa({ hi: per.inicio, hf: per.fim });
        for (var m = f[0]; m < Math.min(f[1], 1440); m += 60) horas[Math.floor(m / 60)] = true;
      });
      [1, 2, 3, 4].forEach(function (b) {
        for (var h = (b - 1) * 6; h < b * 6; h++) if (!horas[h]) return;
        e[b]++;
      });
    });
    return e;
  }

  /* a linha de uma célula: tira a que estiver e, marcada a opção e com a conta do gráfico de agora, desenha */
  function desenhar(cel) {
    var velha = cel.querySelector('.falta-gente');
    if (velha) velha.parentNode.removeChild(velha);
    var g = cel.querySelector('.escala-mes-grafico'), d = dados[chave(cel)];
    if (!ligada() || !g || !d || d.marca !== marca(g)) return;
    var x = (cel.dataset.faltaExtras || '0,0,0,0').split(',').map(Number);
    RW.faltaGente.linha(g, RW.faltaGente.porHorario(d.sem, d.com, { 1: x[0], 2: x[1], 3: x[2], 4: x[3] }, g.dataset.erro));
  }

  /* a célula pede a conta do banco (as que pedirem juntas vão numa leitura só) */
  function pedir(cel) {
    var g = cel.querySelector('.escala-mes-grafico');
    if (!g) return;
    var d = dados[chave(cel)];
    if (d && d.marca === marca(g)) { desenhar(cel); return; }
    pendentes[chave(cel)] = marca(g);
    if (agendada) return;
    agendada = true;
    setTimeout(ler, 0);
  }

  /* lê a conta das células que esperam: as dos dias certos na tela (o Salvar acabou de gravar) com o dado real, as outras
     aceitando a cópia de antes, como a grade */
  function ler() {
    agendada = false;
    var marcas = pendentes, chaves = Object.keys(marcas);
    pendentes = {};
    if (!chaves.length || !ligada()) return;
    var at = RW.escalaAtualizando;
    var certas = chaves.filter(function (k) { var p = k.split('|'); return !!(at && at.certo(p[0], p[1])); });
    lerGrupo(chaves.filter(function (k) { return certas.indexOf(k) < 0; }), marcas, true);
    lerGrupo(certas, marcas, false);
  }

  /* uma leitura: as unidades das células, do primeiro ao último dia */
  function lerGrupo(chaves, marcas, copia) {
    if (!chaves.length) return;
    var unidades = [], ini = null, fim = null;
    chaves.forEach(function (k) {
      var p = k.split('|'), uid = +p[0], dia = p[1];
      if (unidades.indexOf(uid) < 0) unidades.push(uid);
      if (!ini || dia < ini) ini = dia;
      if (!fim || dia > fim) fim = dia;
    });
    var corpo = { p_unidade_ids: unidades, p_inicio: ini, p_fim: fim };
    /* o modo treino não pede a cópia (escalas-dados.js › carregar) */
    if (copia && !(RW.treino && RW.treino.ligado())) corpo.p_aceita_copia = true;
    RW.rpc('escala_falta_mes', corpo).then(function (r) {
      if (!r) { console.error('[Escala] Falta de gente: a leitura escala_falta_mes não veio'); return; }
      chaves.forEach(function (k) {
        var p = k.split('|');
        dados[k] = { sem: ((r.sem || {})[p[0]] || {})[p[1]] || {}, com: ((r.com || {})[p[0]] || {})[p[1]] || {}, marca: marcas[k] };
      });
      Array.prototype.forEach.call(celulas(), function (cel) { if (chaves.indexOf(chave(cel)) >= 0) desenhar(cel); });
    }).catch(function (e) { console.error('[Escala] Falta de gente: a leitura escala_falta_mes falhou', e); });
  }

  /* a célula acabou de ser feita (escalas-celula.js › preencherCelula): guarda as extras do dia (para quando a opção for
     marcada) e, marcada, desenha ou pede a conta */
  function decorar(cel, pessoas) {
    if (!cel.dataset.iso || !cel.dataset.unidadeId) return;
    var e = extrasDe(pessoas);
    cel.dataset.faltaExtras = [e[1], e[2], e[3], e[4]].join(',');
    if (ligada()) pedir(cel);
  }

  /* a opção mudou: marcada, as células da tela desenham ou pedem a conta; desmarcada, as linhas somem */
  function atualizar() {
    var sim = ligada();
    Array.prototype.forEach.call(celulas(), function (cel) { if (sim) pedir(cel); else desenhar(cel); });
  }

  RW.escalasFalta = {
    decorar: decorar,
    atualizar: atualizar,
    /* a cópia dos dias ficou pronta (escalas-atualizando.js): a célula refeita lê a conta de novo. chaves = ['unidade|dia'] */
    esquecer: function (chaves) { (chaves || []).forEach(function (k) { delete dados[k]; }); },
    /* a página é nova (a visita): esquece a conta guardada e confere a opção */
    reiniciar: function () { dados = {}; pendentes = {}; atualizar(); }
  };
})();
