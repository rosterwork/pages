/* ============================================================
   INÍCIO — o calendário do militar e os avisos
   O mês de quem está logado (inicio_calendario: a mesma leitura do
   mês da Escala, filtrada por ele) no mês em miniatura do Solicitar
   extra (geral-mini-calendario). No computador, cada dia traz as
   linhas da Escala (ícone, Serviço/Extra/Troca e o horário, pelo
   escalas-celula.js) e o clique abre o painel do dia; no celular, o
   dia mostra só os ícones e o toque leva o dia à caixa embaixo, com
   o botão que abre o painel. O painel do dia abre só de leitura,
   com o militar destacado (escalas-painel.js). "Hoje" é o dia de
   serviço (vira às 08h). Abaixo, os 3 comunicados mais recentes
   (fn_avisos_listar) e, ao lado (computador), os atalhos. Só clona
   moldes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /* origem da linha -> ícone (os mesmos da Escala) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base', saida: 'icone-origem-saida', troca: 'icone-origem-troca', troca_saida: 'icone-origem-troca',
    pontual: 'icone-origem-pontual', sistema: 'icone-origem-sistema', folga: 'icone-folgas', extra: 'icone-extrajornada'
  };
  /* as linhas de quem saiu do serviço (riscadas na Escala) */
  var RISCADA = { folga: true, troca_saida: true };
  var AVISOS_NO_INICIO = 3;

  var el = {};
  var estado = { mes: null, dados: null, selecionado: null, pedido: 0 };

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ddmm(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function celular() { return !!(RW.celular && RW.celular()); }
  function hojeIso() { return iso(RW.data.diaDeServico()); }
  function cpfLogado() { var u = RW.sessao.perfil(); return u ? u.cpf : null; }

  /* ---------- o dia e o painel do dia ---------- */

  /* as linhas do dia no formato da linha da Escala (escalas-celula.js) */
  function pessoas(linhas) {
    var r = RW.mensagens.inicio.rotulos;
    return linhas.map(function (l) {
      if (l.origem === 'afastamento') return { origem: 'afastamento', afastamento: l.afastamento, ate: l.ate, grad: '', nome: '' };
      return {
        origem: l.origem, origem_base: l.origem_base, grad: '', periodos: l.periodos || [],
        nome: l.origem === 'extra' ? r.extra : (l.origem === 'troca' ? r.troca : r.servico)
      };
    });
  }

  /* as linhas da Escala num lugar; o afastado fica à vista (na Escala, só com o filtro) */
  function preencherLinhas(cont, linhas) {
    RW.escalasCelula.preencherCelula(cont, null, null, pessoas(linhas), 0, []);
    Array.prototype.forEach.call(cont.querySelectorAll('.linha-escalado--afastamento'), function (l) { l.classList.remove('oculto'); });
  }

  /* as linhas agrupadas pela unidade onde ele tira cada uma, na ordem do dia: [{ unidade, linhas }] */
  function porUnidade(linhas) {
    var grupos = [];
    linhas.forEach(function (l) {
      var g = grupos.filter(function (x) { return x.unidade === l.unidade; })[0];
      if (!g) { g = { unidade: l.unidade, linhas: [] }; grupos.push(g); }
      g.linhas.push(l);
    });
    return grupos;
  }

  /* a unidade do painel de um dia: a da primeira linha; sem linha, onde ele está no dia */
  function unidadeDoDia(dia) { return (dia.linhas && dia.linhas.length) ? dia.linhas[0].unidade : dia.unidade; }

  /* põe no elemento o que o painel do dia lê: a unidade (nome e cidade) e o dia */
  function marcarDia(alvo, unidadeId, diaIso, unidades) {
    var u = (unidades && unidades[unidadeId]) || {};
    alvo.dataset.unidadeId = unidadeId;
    alvo.dataset.iso = diaIso;
    alvo.dataset.unidadeNome = u.nome_painel || u.nome || '';
    alvo.dataset.unidadeCidade = u.cidade || '';
  }

  /* o painel do dia, só de leitura, com o militar destacado */
  function abrirPainel(alvo) {
    if (!RW.escalasPainel || !alvo || !alvo.dataset.unidadeId) return;
    RW.escalasPainel.abrir(alvo, null, { leitura: true, destacar: cpfLogado() });
  }

  /* ---------- calendário ---------- */

  function estadoCalendario(idTpl, texto) {
    el.calendario.textContent = '';
    var no = RW.tpl(idTpl);
    if (!no) return;
    if (texto) no.textContent = texto;
    el.calendario.appendChild(no);
  }

  function icone(nome) {
    var svg = RW.tpl('tpl-escala-mes-origem');
    if (svg) svg.querySelector('use').setAttribute('href', 'icones/' + nome + '.svg#' + nome);
    return svg;
  }

  /* um dia no quadradinho: no computador as linhas, no celular os ícones; o afastado, listrado */
  function desenharDia(botao, diaIso) {
    var unidades = estado.dados.unidades;
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var linhas = dia.linhas || [];
    var texto = botao.querySelector('.mini-calendario-texto');
    if (diaIso === hojeIso()) botao.classList.add('mini-calendario-dia--hoje');
    if (celular() && diaIso === estado.selecionado) botao.classList.add('mini-calendario-dia--selecionado');
    if (unidadeDoDia(dia)) marcarDia(botao, unidadeDoDia(dia), diaIso, unidades);

    var afast = linhas.filter(function (l) { return l.origem === 'afastamento'; })[0];
    if (afast) {
      botao.classList.add('mini-calendario-dia--afastado');
      texto.textContent = celular()
        ? String(afast.afastamento || '').slice(0, 3).toUpperCase()
        : RW.mensagens.geral.afastadoAte(afast.afastamento || '', ddmm(afast.ate));
      return;
    }
    if (celular()) {
      linhas.forEach(function (l) {
        var ic = icone(ICONE_ORIGEM[l.origem] || ICONE_ORIGEM.sistema);
        if (!ic) return;
        if (RISCADA[l.origem]) ic.classList.add('inicio-icone--riscado');
        texto.appendChild(ic);
      });
      return;
    }
    var grupos = porUnidade(linhas);
    grupos.forEach(function (g) {
      var cont = RW.tpl('tpl-inicio-dia-linhas');
      if (!cont) return;
      preencherLinhas(cont, g.linhas);
      /* dia em duas unidades: cada grupo abre o painel da sua */
      if (grupos.length > 1) marcarDia(cont, g.unidade, diaIso, unidades);
      botao.appendChild(cont);
    });
  }

  function desenharMes() {
    RW.miniCalendario.renderizar(el.calendario, { dataRef: estado.mes, aoDia: desenharDia });
    mostrarDia(estado.selecionado);
  }

  /* o dia que a caixa mostra ao abrir o mês: o próximo serviço de hoje em diante; sem ele, hoje; fora do
     mês de hoje, o primeiro dia com algo marcado */
  function diaPadrao() {
    var dias = estado.dados.dias;
    var hoje = hojeIso();
    var chaves = Object.keys(dias).sort();
    function temServico(k) { return (dias[k].linhas || []).some(function (l) { return !RISCADA[l.origem] && l.origem !== 'afastamento'; }); }
    var proximo = chaves.filter(function (k) { return k >= hoje && temServico(k); })[0];
    if (proximo) return proximo;
    if (dias[hoje]) return hoje;
    return chaves.filter(function (k) { return (dias[k].linhas || []).length; })[0] || chaves[0] || null;
  }

  function nomeMes(d) { return MESES[d.getMonth()] + ' ' + d.getFullYear(); }

  /* o nome do mês e o Hoje (só fora do mês do dia de serviço de hoje) */
  function atualizarBarra() {
    var hoje = RW.data.diaDeServico();
    el.mesNome.textContent = nomeMes(estado.mes);
    el.mesHoje.classList.toggle('oculto', estado.mes.getFullYear() === hoje.getFullYear() && estado.mes.getMonth() === hoje.getMonth());
  }

  /* lê e desenha o mês; só a última leitura pedida desenha */
  function carregarMes() {
    var pedido = ++estado.pedido;
    estado.dados = null;
    atualizarBarra();
    limparDia();
    estadoCalendario('tpl-escala-carregando');
    var fim = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 0);
    RW.rpc('inicio_calendario', { p_inicio: iso(estado.mes), p_fim: iso(fim) }).then(function (r) {
      if (pedido !== estado.pedido || !el.calendario.isConnected) return;
      if (!r || !r.dias) { estadoCalendario('tpl-escala-estado', RW.mensagens.inicio.falhaCarregar); return; }
      estado.dados = { dias: r.dias, unidades: r.unidades || {} };
      estado.selecionado = diaPadrao();
      desenharMes();
    }, function () {
      if (pedido !== estado.pedido || !el.calendario.isConnected) return;
      estadoCalendario('tpl-escala-estado', RW.mensagens.inicio.falhaCarregar);
    });
  }

  function irParaMes(d) {
    estado.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    carregarMes();
  }

  /* computador: o clique abre o painel do dia (o grupo da unidade, no dia com duas); celular: escolhe o dia */
  function aoClicarCalendario(e) {
    var botao = e.target.closest('.mini-calendario-dia');
    if (!botao || !estado.dados) return;
    if (celular()) { selecionar(botao.dataset.iso); return; }
    abrirPainel(e.target.closest('[data-unidade-id]'));
  }

  /* ---------- dia tocado (celular) ---------- */

  function limparDia() {
    el.diaTitulo.textContent = '';
    el.diaLinhas.textContent = '';
    el.diaVazio.classList.add('oculto');
    el.diaEscala.classList.add('oculto');
  }

  function selecionar(diaIso) {
    estado.selecionado = diaIso;
    Array.prototype.forEach.call(el.calendario.querySelectorAll('.mini-calendario-dia--selecionado'), function (b) {
      b.classList.remove('mini-calendario-dia--selecionado');
    });
    var botao = el.calendario.querySelector('.mini-calendario-dia[data-iso="' + diaIso + '"]');
    if (botao) botao.classList.add('mini-calendario-dia--selecionado');
    mostrarDia(diaIso);
  }

  /* a caixa do dia: as linhas por unidade (o bloco do Calendário da Escala) e o botão do painel do dia */
  function mostrarDia(diaIso) {
    limparDia();
    if (!celular() || !diaIso || !estado.dados) return;
    var d = dataDeIso(diaIso);
    var unidades = estado.dados.unidades;
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var linhas = dia.linhas || [];
    el.diaTitulo.textContent = DIAS_CURTOS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    porUnidade(linhas).forEach(function (g) {
      var bloco = RW.tpl('tpl-escala-calendario-unidade');
      if (!bloco) return;
      bloco.querySelector('.escala-calendario-unidade-nome').textContent = (unidades[g.unidade] || {}).nome || '';
      preencherLinhas(bloco.querySelector('.escala-mes-celula'), g.linhas);
      marcarDia(bloco, g.unidade, diaIso, unidades);
      el.diaLinhas.appendChild(bloco);
    });
    el.diaVazio.classList.toggle('oculto', linhas.length > 0);
    var unidade = unidadeDoDia(dia);
    if (unidade) {
      marcarDia(el.diaEscala, unidade, diaIso, unidades);
      el.diaEscala.classList.remove('oculto');
    }
  }

  /* ---------- Legenda: os grupos da Legenda da Escala que aparecem no calendário ---------- */

  function montarLegenda() {
    var lugar = document.getElementById('inicio-legenda');
    var legenda = (lugar && RW.legenda) ? RW.legenda.montar(lugar) : null;
    var alvo = legenda && legenda.querySelector('[data-legenda-conteudo]');
    var molde = document.getElementById('tpl-escala-legenda');
    if (!alvo || !molde) return;
    ['origem', 'riscado'].forEach(function (nome) {
      var grupo = molde.content.querySelector('[data-legenda-grupo="' + nome + '"]');
      if (grupo) alvo.appendChild(grupo.cloneNode(true));
    });
  }

  /* ---------- avisos ---------- */

  function vazio(container, texto) {
    container.textContent = '';
    var v = RW.tpl('tpl-inicio-vazio');
    if (v) { v.textContent = texto; container.appendChild(v); }
  }

  /* "Cap. Rocha · 20/10" */
  function metaAviso(a) {
    var autor = ((a.criado_por_grau || '') + ' ' + (a.criado_por_nome || '')).trim();
    var d = a.criado_em ? new Date(a.criado_em) : null;
    var data = (d && !isNaN(d)) ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : '';
    return [autor, data].filter(Boolean).join(' · ');
  }

  /* a caixa só aparece com comunicado ou para o admin; mostra os mais recentes e o Ver todos (N) */
  function montarAvisos(avisos) {
    var admin = !!(RW.inicioAviso && RW.inicioAviso.ehAdmin());
    el.avisosCaixa.classList.toggle('oculto', !avisos.length && !admin);
    el.avisosTotal.textContent = String(avisos.length);
    el.avisosTodos.classList.toggle('oculto', !avisos.length);
    if (!avisos.length) { vazio(el.avisos, RW.mensagens.avisos.semComunicados); return; }
    el.avisos.textContent = '';
    avisos.slice(0, AVISOS_NO_INICIO).forEach(function (a) {
      var cartao = RW.tpl('tpl-inicio-aviso');
      if (!cartao) return;
      cartao.querySelector('.inicio-aviso-titulo').textContent = a.titulo || '';
      cartao.querySelector('.inicio-aviso-msg').textContent = a.mensagem || '';
      cartao.querySelector('.inicio-aviso-meta').textContent = metaAviso(a);
      var remover = cartao.querySelector('.inicio-aviso-remover');
      if (remover && RW.inicioAviso && RW.inicioAviso.podeDesativar(a)) {
        remover.classList.remove('oculto');
        remover.addEventListener('click', function () { RW.inicioAviso.desativar(a.aviso_id, carregarAvisos); });
      }
      el.avisos.appendChild(cartao);
    });
  }

  function carregarAvisos() {
    RW.rpc('fn_avisos_listar', {})
      .then(function (a) { if (el.avisos.isConnected) montarAvisos(Array.isArray(a) ? a : []); })
      .catch(function () {
        if (!el.avisos.isConnected) return;
        el.avisosCaixa.classList.remove('oculto');
        vazio(el.avisos, RW.mensagens.inicio.falhaCarregar);
      });
  }

  /* ---------- atalhos (computador) ---------- */

  /* Escala de hoje: o painel do dia de serviço de hoje (do mês na tela ou, fora dele, lido à parte) */
  function abrirHoje(botao) {
    var hoje = hojeIso();
    var dia = estado.dados && estado.dados.dias[hoje];
    if (dia) {
      if (unidadeDoDia(dia)) { marcarDia(botao, unidadeDoDia(dia), hoje, estado.dados.unidades); abrirPainel(botao); }
      return;
    }
    RW.rpc('inicio_calendario', { p_inicio: hoje, p_fim: hoje }).then(function (r) {
      var d = r && r.dias && r.dias[hoje];
      if (!d || !unidadeDoDia(d) || !botao.isConnected) return;
      marcarDia(botao, unidadeDoDia(d), hoje, r.unidades || {});
      abrirPainel(botao);
    }).catch(function () {});
  }

  function ligarAtalhos() {
    Array.prototype.forEach.call(document.querySelectorAll('.inicio-atalho'), function (b) {
      b.addEventListener('click', function () {
        var qual = b.getAttribute('data-atalho');
        if (qual === 'hoje') { abrirHoje(b); return; }
        var pagina = { troca: 'trocas', folga: 'folgas', extra: 'extrajornada' }[qual];
        if (pagina && RW.irParaPagina) RW.irParaPagina(pagina, null, 'solicitar');
      });
    });
  }

  function iniciar() {
    var u = RW.sessao.perfil();
    if (!u || !u.ok) return Promise.resolve();

    function porId(id) { return document.getElementById(id); }
    el = {
      calendario: porId('inicio-calendario'), mesNome: porId('inicio-mes-nome'), mesHoje: porId('inicio-mes-hoje'),
      diaTitulo: porId('inicio-dia-titulo'), diaLinhas: porId('inicio-dia-linhas'), diaVazio: porId('inicio-dia-vazio'),
      diaEscala: porId('inicio-dia-escala'), avisosCaixa: porId('inicio-avisos-caixa'), avisos: porId('inicio-avisos'),
      avisosTodos: porId('inicio-avisos-todos'), avisosTotal: porId('inicio-avisos-total')
    };
    if (!el.calendario || !RW.rpc || !RW.obterToken || !RW.obterToken()) return Promise.resolve();

    estado.mes = new Date(RW.data.diaDeServico().getFullYear(), RW.data.diaDeServico().getMonth(), 1);
    estado.selecionado = null;

    /* a barra do mês: setas, Hoje e o nome, que abre a escolha do mês */
    porId('inicio-mes-anterior').addEventListener('click', function () { irParaMes(new Date(estado.mes.getFullYear(), estado.mes.getMonth() - 1, 1)); });
    porId('inicio-mes-proximo').addEventListener('click', function () { irParaMes(new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 1)); });
    el.mesHoje.addEventListener('click', function () { irParaMes(RW.data.diaDeServico()); });
    if (RW.calendario) RW.calendario.ligar(el.mesNome, {
      ancora: el.mesNome.closest('.geral-periodo'),
      obterModo: function () { return 'mes'; },
      obterData: function () { return estado.mes; },
      aoEscolher: irParaMes
    });
    montarLegenda();

    el.calendario.addEventListener('click', aoClicarCalendario);
    el.diaLinhas.addEventListener('click', function (e) { abrirPainel(e.target.closest('.escala-calendario-unidade')); });
    el.diaEscala.addEventListener('click', function () { abrirPainel(el.diaEscala); });
    carregarMes();

    /* os avisos: Ver todos leva aos Comunicados; o grupo Administração (Novo comunicado) só para o admin,
       e no celular é um menu (fecha antes de abrir o painel) */
    el.avisosTodos.addEventListener('click', function () { if (RW.irParaPagina) RW.irParaPagina('avisos', 'comunicados'); });
    var grupoAdmin = document.querySelector('#inicio-avisos-caixa .acoes-admin');
    var btnNovoAviso = porId('btn-novo-aviso');
    if (grupoAdmin && btnNovoAviso && RW.inicioAviso && RW.inicioAviso.ehAdmin()) {
      grupoAdmin.classList.remove('oculto');
      btnNovoAviso.addEventListener('click', function () {
        if (RW.fecharDropdowns) RW.fecharDropdowns();
        RW.inicioAviso.abrirNovo(carregarAvisos);
      });
    }
    carregarAvisos();

    ligarAtalhos();
    return Promise.resolve();
  }

  RW.paginas.inicio = { iniciar: iniciar };
})();
