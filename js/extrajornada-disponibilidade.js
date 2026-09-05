/* ============================================================
   EXTRAJORNADA — aba Disponibilidade (auto-serviço do militar)
   Painel esquerdo (declaração) + calendário (geral-calendario-mes,
   tamanho original) na área principal + rodapé (legenda + ações).
   Regras: se NÃO voluntário, não preenche nada (cotas/calendário
   somem). Se voluntário, cada coluna de datas exige de 5 a 10
   (o clique cicla branco→verde→vermelho→branco respeitando os
   limites). Carrega/salva pelas RPCs. Não cria HTML (clona moldes)
   nem escreve estilo (classList; exceção: custom property --fill).
   RosterWork.extrajornadaDisponibilidade.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MAX = 10;

  var conteudo = null;
  var el = {};
  var ativa = false;   // aba Disponibilidade está ativa? (governa o grupo "Interessados" no subcabeçalho compartilhado)
  var comp = null;   // Date do 1º dia da competência (mês)
  var entradaFeita = false;   // 1ª carga já corrigiu o mês de entrada (do banco)?
  var estado = { voluntario: false, cotas: 0, fecha24h: false, quer: [], nao_quer: [], procura: {}, bloqueados: {},
    procuraUnidades: [], procuraEscopo: null, procuraPropria: null,   // seletor de escopo da procura (Total/CIA/PELs)
    estadoJanela: 'editavel', janelaInicio: null, janelaFim: null, proximaAbre: null,
    foiVoluntario: false, resumo: null, minDatas: 5, mesEntrada: null };
  var limpo = null;  // snapshot para detectar edição não salva
  var guardaLigada = false;
  var reqSeq = 0;    // token de requisição: ignora resposta antiga ao trocar de mês rápido

  /* ---------- utilidades ---------- */

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function competenciaISO() { return iso(comp); }
  function nomeMes() { return MESES[comp.getMonth()]; }
  function formatoCota(v) { return v + (v === 1 ? ' cota' : ' cotas'); }
  function dataCurta(s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }
  function ddmm(s) { if (!s) return ''; var p = String(s).split('-'); return p[2] + '/' + p[1]; }
  function dataMes(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, 1); }
  function editavel() { return estado.estadoJanela === 'editavel'; }
  function snapshot() { return JSON.stringify({ v: estado.voluntario, c: estado.cotas, f: estado.fecha24h, q: estado.quer.slice().sort(), n: estado.nao_quer.slice().sort() }); }
  function sujo() { return limpo !== null && snapshot() !== limpo; }
  function estadoDia(s) { return estado.quer.indexOf(s) >= 0 ? 'quer' : (estado.nao_quer.indexOf(s) >= 0 ? 'nao_quer' : null); }
  function tirar(arr, s) { var i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); }

  /* próximo estado do ciclo branco→verde→vermelho→branco, respeitando o teto (10) de cada coluna */
  function proximoEstado(atual) {
    if (atual === null) {
      if (estado.quer.length < MAX) return 'quer';
      if (estado.nao_quer.length < MAX) return 'nao_quer';
      return null;
    }
    if (atual === 'quer') return estado.nao_quer.length < MAX ? 'nao_quer' : null;
    return null;   // 'nao_quer' → neutro
  }

  /* ---------- render ---------- */

  function marcarSeg(trilho, ligado) {
    var opts = trilho.querySelectorAll('.aba');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('aba--ativa', opts[i].getAttribute('data-valor') === (ligado ? 'sim' : 'nao'));
    }
  }

  function montarCotas() {
    if (!RW.dropdownNumeros) return;
    var opcoes = estado.fecha24h ? [4, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
    /* voluntário pede pelo menos 1 cota (ou 4 se fecha 24h); o 0 saiu da lista */
    if (estado.voluntario && estado.cotas < opcoes[0]) estado.cotas = opcoes[0];
    RW.dropdownNumeros.preencher(el.cotasMenu, {
      opcoes: opcoes,
      valor: estado.cotas,
      formato: function (v) { return String(v); },
      aoEscolher: function (v) { estado.cotas = v; el.cotasTexto.textContent = formatoCota(v); atualizarBotoes(); }
    });
    el.cotasTexto.textContent = formatoCota(estado.cotas);
  }

  /* preenche uma coluna com as datas (ordenadas), clonando o molde de item */
  function preencherLista(caixa, arr) {
    if (!caixa) return;
    caixa.textContent = '';
    arr.slice().sort().forEach(function (s) {
      var item = RosterWork.tpl('tpl-extra-data-item');
      if (!item) return;
      item.textContent = dataCurta(s);
      caixa.appendChild(item);
    });
  }

  /* atualiza uma coluna: contador X/10, barrinha (--fill), cor de estado e aviso "< 5" */
  function atualizarColuna(colEl, contaEl, barraEl, avisoEl, faltaEl, arr) {
    var n = arr.length;
    if (contaEl) contaEl.textContent = n + '/' + MAX;
    if (barraEl) barraEl.style.setProperty('--fill', (n / MAX * 100) + '%');
    if (colEl) {
      colEl.classList.toggle('extra-lista--incompleta', n < estado.minDatas);
      colEl.classList.toggle('extra-lista--cheia', n >= MAX);
    }
    if (avisoEl) avisoEl.classList.toggle('oculto', n >= estado.minDatas);
    if (faltaEl) faltaEl.textContent = String(Math.max(0, estado.minDatas - n));
  }

  function atualizarContadores() {
    preencherLista(el.listaQuero, estado.quer);
    preencherLista(el.listaNao, estado.nao_quer);
    atualizarColuna(el.colQuero, el.contaQuero, el.barraQuero, el.avisoQuero, el.faltaQuero, estado.quer);
    atualizarColuna(el.colNao, el.contaNao, el.barraNao, el.avisoNao, el.faltaNao, estado.nao_quer);
  }

  /* não voluntário: recolhe cotas/fecha24h/listas/legenda e o calendário vira um estado */
  function aplicarVoluntario() {
    var itens = conteudo.querySelectorAll('.extra-so-voluntario');
    for (var i = 0; i < itens.length; i++) itens[i].classList.toggle('oculto', !estado.voluntario);
    atualizarVisibilidadeProcura();   // o grupo "Interessados" acompanha o voluntário
    if (estado.voluntario) renderCalendario();
    else mostrarEstadoCal();
  }

  function mostrarEstadoCal() {
    if (!el.cal) return;
    el.cal.textContent = '';
    var no = RosterWork.tpl('tpl-extra-estado');
    if (!no) return;
    no.textContent = editavel() ? RW.mensagens.extrajornada.marqueSim : RW.mensagens.extrajornada.semDeclaracao;
    el.cal.appendChild(no);
  }

  /* ---------- seletor de escopo dos interessados (Total / a CIA / cada PEL) ---------- */
  function escopoValido(esc) {
    if (esc === 'total') return true;
    for (var i = 0; i < estado.procuraUnidades.length; i++) if (String(estado.procuraUnidades[i].id) === esc) return true;
    return false;
  }
  /* nº de interessados no dia s, no escopo atual (Total = soma de todas as unidades) */
  function contarProcura(s) {
    var m = estado.procura[s];
    if (!m) return 0;
    if (estado.procuraEscopo === 'total') { var t = 0; for (var k in m) t += m[k]; return t; }
    return m[estado.procuraEscopo] || 0;
  }
  function trocarEscopo(esc) {
    if (!esc || esc === estado.procuraEscopo) return;   // o geral-abas já marca a aba ativa
    estado.procuraEscopo = esc;
    if (estado.voluntario) renderCalendario();          // muda o número em TODAS as células
  }
  /* monta as abas do escopo: Total + a CIA + cada PEL (o geral-abas marca a ativa no clique) */
  function montarSeletorProcura() {
    if (!el.procuraAbas) return;
    el.procuraAbas.textContent = '';
    var opcoes = [{ id: 'total', label: RW.mensagens.extrajornada.procuraTotal }];
    for (var i = 0; i < estado.procuraUnidades.length; i++) {
      opcoes.push({ id: String(estado.procuraUnidades[i].id), label: estado.procuraUnidades[i].label });
    }
    opcoes.forEach(function (o) {
      var b = RosterWork.tpl('tpl-extra-procura-aba');
      if (!b) return;
      b.textContent = o.label;
      b.setAttribute('data-escopo', o.id);
      if (o.id === estado.procuraEscopo) b.classList.add('aba--ativa');
      el.procuraAbas.appendChild(b);
    });
  }
  /* o grupo "Interessados" vive no subcabeçalho (compartilhado): só aparece na aba Disponibilidade, para voluntário */
  function atualizarVisibilidadeProcura() {
    if (el.procuraGrupo) el.procuraGrupo.classList.toggle('oculto', !(ativa && estado.voluntario));
  }

  function renderCalendario() {
    if (!el.cal || !RW.geralCalendarioMes) return;
    RW.geralCalendarioMes.renderizar(el.cal, {
      dataRef: comp,
      aoDia: function (celula, data, noMes) {
        if (!noMes) return;
        var s = iso(data);
        celula.classList.add('extra-cal-dia');
        var texto = RosterWork.tpl('tpl-extra-cal-texto');   // texto no centro (motivo do bloqueio ou quero/não quero)

        /* dia em que o militar já está ocupado: indisponível (apagado, sem clique); o motivo fica escrito na célula */
        var bloq = estado.bloqueados[s];
        if (bloq) {
          celula.classList.add('extra-cal-dia--indisponivel');
          var motivos = RW.mensagens.extrajornada.bloqueadoMotivo || {};
          if (texto) { texto.textContent = motivos[bloq] || 'Indisponível'; celula.appendChild(texto); }
          return;
        }

        var e = estadoDia(s);
        if (e === 'quer') celula.classList.add('extra-cal-dia--quero');
        else if (e === 'nao_quer') celula.classList.add('extra-cal-dia--nao');
        if (texto) {
          texto.textContent = e === 'quer' ? RW.mensagens.extrajornada.quero
                            : (e === 'nao_quer' ? RW.mensagens.extrajornada.naoQuero : '');
          celula.appendChild(texto);
        }

        var proc = RosterWork.tpl('tpl-extra-cal-procura');   // número de voluntários do escopo escolhido, no cantinho
        if (proc) { proc.textContent = String(contarProcura(s)); celula.appendChild(proc); }

        if (editavel()) celula.addEventListener('click', function () { clicarDia(celula, s); });
      }
    });
  }

  function clicarDia(celula, s) {
    var atual = estadoDia(s);
    var proximo = proximoEstado(atual);

    /* feedback dos limites (colunas cheias) */
    if (atual === null && proximo === null) { RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.ambosCheios }); return; }
    if (atual === null && proximo === 'nao_quer') RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.queroCheio });
    if (atual === 'quer' && proximo === null) RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.naoCheio });

    if (atual === 'quer') tirar(estado.quer, s);
    else if (atual === 'nao_quer') tirar(estado.nao_quer, s);
    if (proximo === 'quer') estado.quer.push(s);
    else if (proximo === 'nao_quer') estado.nao_quer.push(s);

    celula.classList.remove('extra-cal-dia--quero', 'extra-cal-dia--nao');
    if (proximo === 'quer') celula.classList.add('extra-cal-dia--quero');
    else if (proximo === 'nao_quer') celula.classList.add('extra-cal-dia--nao');
    var txt = celula.querySelector('.extra-cal-texto');
    if (txt) txt.textContent = proximo === 'quer' ? RW.mensagens.extrajornada.quero
                             : (proximo === 'nao_quer' ? RW.mensagens.extrajornada.naoQuero : '');

    atualizarContadores();
    atualizarBotoes();
  }

  function renderTudo() {
    if (el.mesInline) el.mesInline.textContent = nomeMes();
    setAviso();
    marcarSeg(el.voluntario, estado.voluntario);
    marcarSeg(el.fecha24h, estado.fecha24h);
    montarCotas();
    montarSeletorProcura();
    aplicarVoluntario();
    atualizarContadores();
    aplicarLeitura();
    atualizarBotoes();
    renderResumo();
  }

  /* aviso da janela de edição (topo da declaração), conforme o estado do mês */
  function setAviso() {
    if (!el.aviso) return;
    var m = RW.mensagens.extrajornada, txt;
    if (estado.estadoJanela === 'editavel') txt = m.janelaAberta(ddmm(estado.janelaInicio), ddmm(estado.janelaFim));
    else if (estado.estadoJanela === 'encerrado') txt = m.janelaEncerrada(ddmm(estado.janelaFim), ddmm(estado.proximaAbre));
    else txt = estado.foiVoluntario ? m.mesEncerrado : m.naoFoiVoluntario;
    el.aviso.textContent = txt;
  }

  /* Salvar/Cancelar só ativos quando há alteração pendente (desabilitados quando limpo) */
  function atualizarBotoes() {
    var d = sujo();
    if (el.salvar) el.salvar.disabled = !d;
    if (el.cancelar) el.cancelar.disabled = !d;
  }

  /* fora da janela (mês de leitura): trava a edição (mostra os valores, não deixa mudar) */
  function aplicarLeitura() {
    var ed = editavel();
    if (el.voluntario) el.voluntario.classList.toggle('extra-trava', !ed);
    if (el.fecha24h) el.fecha24h.classList.toggle('extra-trava', !ed);
    if (el.cotasGatilho) el.cotasGatilho.disabled = !ed;
    if (el.acoes) el.acoes.classList.toggle('oculto', !ed);
  }

  /* resumo do que o militar RECEBEU (só em mês passado e se foi voluntário) */
  function renderResumo() {
    if (!el.resumo) return;
    var r = estado.resumo;
    var mostra = estado.estadoJanela === 'passado' && estado.foiVoluntario && r && r.dias && r.dias.length;
    el.resumo.classList.toggle('oculto', !mostra);
    if (!mostra) return;
    if (el.resumoTitulo) el.resumoTitulo.textContent = RW.mensagens.extrajornada.resumoRecebeu(r.total_cotas || 0);
    if (!el.resumoDias) return;
    el.resumoDias.textContent = '';
    r.dias.forEach(function (d) {
      var item = RosterWork.tpl('tpl-extra-disp-resumo-dia');
      if (!item) return;
      item.querySelector('.extra-resumo-data').textContent = dataCurta(d.data);
      var blocos = d.blocos || [];
      var bolas = item.querySelectorAll('.extra-resumo-bola');
      for (var i = 0; i < bolas.length; i++) {
        var bloco = parseInt(bolas[i].getAttribute('data-bloco'), 10);
        bolas[i].classList.toggle('extra-resumo-bola--cheia', blocos.indexOf(bloco) >= 0);
      }
      el.resumoDias.appendChild(item);
    });
  }

  /* ---------- dados ---------- */

  function carregar() {
    if (!RW.extrajornadaDados || !conteudo) return;
    var req = ++reqSeq;
    RW.mostrarVeu(conteudo);
    RW.extrajornadaDados.carregarDisponibilidade(competenciaISO()).then(function (r) {
      RW.esconderVeu(conteudo);
      if (!el.cal || !el.cal.isConnected || req !== reqSeq) return;
      if (!r) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }   // falha: preserva o estado, não finge "não voluntário"
      r = r || {};
      /* mês de entrada é decidido pelo banco (fuso Brasília): mês atual até dia 25, próximo do 26 em diante.
         na 1ª carga, se o palpite do navegador não bateu, recarrega no mês certo. */
      if (!entradaFeita) {
        entradaFeita = true;
        if (r.mes_entrada && iso(comp) !== r.mes_entrada) {
          comp = dataMes(r.mes_entrada);
          if (RW.extrajornadaMes) { RW.extrajornadaMes.definir(comp); if (RW.extrajornadaMes.atualizarSeletor) RW.extrajornadaMes.atualizarSeletor(); }
          carregar(); return;
        }
      }
      estado.voluntario = !!r.voluntario;
      estado.cotas = r.cotas_pedidas || 0;
      estado.fecha24h = !!r.fecha_24h;
      estado.procura = r.procura || {};
      estado.procuraUnidades = r.procura_unidades || [];
      estado.procuraPropria = (r.procura_unidade_propria == null) ? null : String(r.procura_unidade_propria);
      if (!escopoValido(estado.procuraEscopo)) estado.procuraEscopo = estado.procuraPropria || 'total';   // padrão = unidade do militar
      estado.bloqueados = r.bloqueados || {};
      estado.estadoJanela = r.estado_janela || 'passado';
      estado.janelaInicio = r.janela_inicio || null;
      estado.janelaFim = r.janela_fim || null;
      estado.proximaAbre = r.proxima_abre || null;
      estado.foiVoluntario = !!r.foi_voluntario;
      estado.resumo = r.resumo || null;
      estado.minDatas = (r.min_datas == null ? 5 : r.min_datas);
      estado.mesEntrada = r.mes_entrada || null;
      estado.quer = [];
      estado.nao_quer = [];
      /* um dia que virou bloqueado (serviço/folga/férias/atestado) não conta mais como marcado */
      (r.datas || []).forEach(function (x) {
        if (estado.bloqueados[x.data]) return;
        (x.tipo === 'quer' ? estado.quer : estado.nao_quer).push(x.data);
      });
      renderTudo();
      limpo = snapshot();   // depois do render: montarCotas pode subir a cota (evita "sujo" espúrio no load)
    }, function () {
      RW.esconderVeu(conteudo);
      if (req !== reqSeq) return;
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao });
    });
  }

  function salvar() {
    if (!RW.extrajornadaDados || !editavel()) return;   // fora da janela não salva (o banco também recusa)
    if (estado.voluntario && (estado.quer.length < estado.minDatas || estado.nao_quer.length < estado.minDatas)) {
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.extrajornada.minDatas(estado.minDatas) });
      return;
    }
    RW.iniciarCarregando(el.salvar);
    var datas = [];
    if (estado.voluntario) {
      estado.quer.forEach(function (d) { datas.push({ data: d, tipo: 'quer' }); });
      estado.nao_quer.forEach(function (d) { datas.push({ data: d, tipo: 'nao_quer' }); });
    }
    RW.extrajornadaDados.salvarDisponibilidade({
      competencia: competenciaISO(),
      voluntario: estado.voluntario,
      cotas: estado.cotas,
      fecha24h: estado.fecha24h,
      datas: datas
    }).then(function (r) {
      RW.pararCarregando(el.salvar);
      if (r && r.success) {
        limpo = snapshot();
        atualizarBotoes();
        RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.extrajornada.disponibilidadeSalva });
      } else {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.extrajornada.falhaSalvar });
      }
    }, function () {
      RW.pararCarregando(el.salvar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao });
    });
  }

  /* ---------- mês compartilhado (o seletor é do orquestrador) ---------- */
  function estaSujo() { return sujo(); }
  /* redesenha o mês compartilhado (o orquestrador chama ao trocar o mês) */
  function renderMes() { comp = RW.extrajornadaMes.obter(); carregar(); }

  /* ---------- montagem ---------- */

  function montar(cont) {
    conteudo = cont;
    comp = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);   // mês compartilhado com a Escala (o banco confirma em mes_entrada)
    entradaFeita = false;
    limpo = null;

    el.mesInline = cont.querySelector('#extra-mes-inline');
    el.voluntario = cont.querySelector('#extra-voluntario');
    el.fecha24h = cont.querySelector('#extra-fecha24h');
    el.cotasTexto = cont.querySelector('#extra-cotas-texto');
    el.cotasMenu = cont.querySelector('#extra-cotas-menu');
    el.cal = cont.querySelector('#extra-disp-cal');
    el.procuraGrupo = cont.querySelector('#extra-interessados');   // grupo no subcabeçalho (rótulo + abas)
    el.procuraAbas = cont.querySelector('#extra-procura-abas');    // trilho de abas (Total/CIA/PELs)
    if (el.procuraAbas && RW.abas) RW.abas.ligar(el.procuraAbas, function (aba) { trocarEscopo(aba.getAttribute('data-escopo')); });
    el.colQuero = cont.querySelector('#extra-col-quero');
    el.colNao = cont.querySelector('#extra-col-nao');
    el.contaQuero = cont.querySelector('#extra-conta-quero');
    el.contaNao = cont.querySelector('#extra-conta-nao');
    el.barraQuero = cont.querySelector('#extra-barra-quero');
    el.barraNao = cont.querySelector('#extra-barra-nao');
    el.listaQuero = cont.querySelector('#extra-lista-quero');
    el.listaNao = cont.querySelector('#extra-lista-nao');
    el.avisoQuero = cont.querySelector('#extra-aviso-quero');
    el.avisoNao = cont.querySelector('#extra-aviso-nao');
    el.faltaQuero = cont.querySelector('#extra-falta-quero');
    el.faltaNao = cont.querySelector('#extra-falta-nao');
    el.salvar = cont.querySelector('#extra-disp-salvar');
    el.aviso = cont.querySelector('#extra-disp-aviso');
    el.cotasGatilho = cont.querySelector('#extra-cotas-gatilho');
    el.acoes = el.salvar ? el.salvar.parentNode : null;
    el.resumo = cont.querySelector('#extra-disp-resumo');
    el.resumoTitulo = cont.querySelector('#extra-disp-resumo-titulo');
    el.resumoDias = cont.querySelector('#extra-disp-resumo-dias');

    if (RW.abas) {
      RW.abas.ligar(el.voluntario, function (aba) {
        if (!editavel()) { marcarSeg(el.voluntario, estado.voluntario); return; }   // mês de leitura: ignora (e desfaz a marca)
        estado.voluntario = aba.getAttribute('data-valor') === 'sim';
        aplicarVoluntario();
        montarCotas();       // ao virar voluntário, garante cota >= 1 (o 0 saiu)
        atualizarBotoes();
      });
      RW.abas.ligar(el.fecha24h, function (aba) {
        if (!editavel()) { marcarSeg(el.fecha24h, estado.fecha24h); return; }
        estado.fecha24h = aba.getAttribute('data-valor') === 'sim';
        if (estado.fecha24h && estado.cotas % 4 !== 0) estado.cotas = estado.cotas - (estado.cotas % 4);
        montarCotas();
        atualizarBotoes();
      });
    }

    if (el.salvar) el.salvar.addEventListener('click', salvar);
    el.cancelar = cont.querySelector('#extra-disp-cancelar');
    if (el.cancelar) el.cancelar.addEventListener('click', function () { carregar(); });

    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return sujo(); });
      guardaLigada = true;
    }
  }

  /* carrega na 1ª vez que a aba é aberta (preserva edições ao alternar de aba);
     se a outra aba mudou o mês enquanto esta estava fora, redesenha no mês compartilhado */
  function ativar() {
    ativa = true;
    atualizarVisibilidadeProcura();   // mostra o grupo "Interessados" (se voluntário) ao entrar na aba
    var alvo = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : comp;
    if (limpo === null) { comp = alvo; carregar(); }
    else if (iso(alvo) !== iso(comp)) {
      if (sujo() && RW.confirmar) {
        RW.confirmar({
          tipo: 'aviso',
          mensagem: RW.mensagens.edicao.sairSemSalvar,
          textoConfirmar: RW.mensagens.botoes.descartar,
          textoCancelar: RW.mensagens.botoes.continuarEditando,
          aoConfirmar: renderMes,
          aoCancelar: function () {   // manteve a edição: o mês volta pro desta aba (e o seletor reflete)
            RW.extrajornadaMes.definir(comp);
            if (RW.extrajornadaMes.atualizarSeletor) RW.extrajornadaMes.atualizarSeletor();
          }
        });
      } else {
        renderMes();
      }
    }
  }
  function desativar() {
    ativa = false;
    atualizarVisibilidadeProcura();   // esconde o grupo "Interessados" ao sair para a aba Escala
  }

  RW.extrajornadaDisponibilidade = { montar: montar, ativar: ativar, desativar: desativar,
    estaSujo: estaSujo, renderMes: renderMes };
})();
