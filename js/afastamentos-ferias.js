/* ============================================================
   FÉRIAS — painel Férias do militar (só quem administra a unidade dele)
   Abre de dois jeitos: pela linha do militar na lista (abrirMilitar,
   já com os períodos dele) e pelo "Novas férias" (abrirNovo: Unidade
   e Militar primeiro; escolhido o militar, aparecem os períodos dele
   e uma linha nova). Cada período é uma linha início → fim (máscara
   e calendário), com os dias, o ✕ e, na 1ª linha, o Adicionar período.
   O que é de mais de uma semana atrás fica como está: o período que
   terminou antes disso fica travado, o que começou antes mantém o
   início e não sai. Salvar manda a lista inteira
   (afastamentosDados.salvarFerias → ferias_salvar), que compara com o
   gravado, avisa o que o militar já tem nos dias novos e abre o resumo.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var guardaLigado = false;
  var estado = null;   // o painel aberto: { raiz, militar, linhas, removidos, carregando }
  var reqMil = 0;      // token do seletor de militar: ignora resposta antiga ao trocar de unidade rápido
  var reqPer = 0;      // token dos períodos: ignora resposta antiga ao trocar de militar rápido

  function D() { return RosterWork.data; }
  function msg() { return RosterWork.mensagens.afastamentos; }

  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* meia-noite de hoje − 7 dias: o dia mais antigo que ainda muda (o mesmo limite do banco) */
  function limite() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  }

  /* um período gravado vira linha: o que é de antes do limite trava */
  function linhaGravada(f, lim) {
    var ini = D().isoParaBR(f.data_inicio), fim = D().isoParaBR(f.data_fim);
    return { id: f.ferias_id, ini: ini, fim: fim, origIni: ini, origFim: fim,
      iniTravado: D().paraData(ini) < lim, fimTravado: D().paraData(fim) < lim };
  }
  function linhaNova() { return { id: null, ini: '', fim: '', origIni: '', origFim: '', iniTravado: false, fimTravado: false }; }

  function linhaVazia(l) { return !l.id && !l.ini && !l.fim; }

  /* houve mudança: período apagado, data mudada ou linha nova começada */
  function mudou() {
    if (!estado) return false;
    return estado.removidos.length > 0 || estado.linhas.some(function (l) {
      return l.id ? (l.ini !== l.origIni || l.fim !== l.origFim) : !linhaVazia(l);
    });
  }

  /* confere as linhas: os dias de cada uma, o que está errado (o 1º problema vai para a nota) e o Salvar */
  function avaliar() {
    var e = estado;
    if (!e) return;
    var lim = limite();
    var vespera = new Date(lim);
    vespera.setDate(vespera.getDate() - 1);
    var problema = '', incompleta = false, validas = [];
    e.linhas.forEach(function (l) {
      l.erro = false;
      l.di = D().paraData(l.ini);
      l.df = D().paraData(l.fim);
      if (linhaVazia(l)) return;
      if (!l.di || !l.df) { incompleta = true; return; }
      if (l.df < l.di) { l.erro = true; problema = problema || msg().feriasFimAntes; return; }
      /* nenhum dia de antes do limite entra nem sai das férias */
      var iniMudou = l.ini !== l.origIni, fimMudou = l.fim !== l.origFim;
      if ((iniMudou && l.di < lim) || (fimMudou && l.df < vespera)) {
        l.erro = true;
        problema = problema || msg().feriasLimite(D().paraBR(lim));
        return;
      }
      validas.push(l);
    });
    /* períodos que se cruzam: marca o de baixo */
    validas.forEach(function (l, i) {
      for (var j = 0; j < i; j++) {
        var o = validas[j];
        if (l.di <= o.df && o.di <= l.df) {
          l.erro = true;
          problema = problema || msg().feriasCruza(o.ini + ' a ' + o.fim);
          break;
        }
      }
    });
    e.linhas.forEach(function (l) {
      if (!l.el) return;
      l.el.classList.toggle('campo--erro', !!l.erro);
      var dias = l.el.querySelector('.ferias-periodo-dias');
      var n = l.di && l.df && l.df >= l.di ? Math.round((l.df - l.di) / 86400000) + 1 : 0;
      dias.textContent = n === 1 ? '1 dia' : n + ' dias';
      dias.classList.toggle('oculto', !n);
    });
    var nota = e.raiz.querySelector('#fer-periodos-nota');
    if (nota) {
      nota.querySelector('.nota-texto').textContent = problema;
      nota.classList.toggle('oculto', !problema);
    }
    var btn = e.raiz.querySelector('#fer-salvar');
    if (btn) btn.disabled = e.carregando || !e.militar || !mudou() || !!problema || incompleta;
  }

  function removerLinha(l) {
    var e = estado;
    if (l.id) e.removidos.push(l.id);
    e.linhas.splice(e.linhas.indexOf(l), 1);
    if (!e.linhas.length) e.linhas.push(linhaNova());   // a lista nunca fica sem linha (é nela que mora o Adicionar)
    desenhar();
  }

  function adicionarLinha() {
    var nova = linhaNova();
    estado.linhas.push(nova);
    desenhar();
    if (nova.el) nova.el.querySelector('.ferias-periodo-inicio').focus();
  }

  /* um campo de data da linha: travado, ou com máscara e calendário */
  function ligarCampo(input, l, chave, travado) {
    input.value = l[chave];
    input.disabled = travado;
    if (travado) return;
    RosterWork.campos.ligarData(input);
    input.addEventListener('input', function () { l[chave] = input.value; avaliar(); });
  }

  /* (re)desenha as linhas dos períodos */
  function desenhar() {
    var e = estado;
    var lista = e.raiz.querySelector('#fer-periodos');
    if (!lista) return;
    lista.textContent = '';
    e.linhas.forEach(function (l, i) {
      var el = RosterWork.tpl('tpl-ferias-periodo');
      if (!el) return;
      ligarCampo(el.querySelector('.ferias-periodo-inicio'), l, 'ini', l.iniTravado);
      ligarCampo(el.querySelector('.ferias-periodo-fim'), l, 'fim', l.fimTravado);
      var remover = el.querySelector('.horario-remover');
      if (l.iniTravado) remover.classList.add('horario-acao--vazia');
      else remover.addEventListener('click', function () { removerLinha(l); });
      var adicionar = el.querySelector('.horario-adicionar');
      if (i === 0) adicionar.addEventListener('click', adicionarLinha);
      else adicionar.classList.add('horario-acao--vazia');
      l.el = el;
      lista.appendChild(el);
    });
    avaliar();
  }

  /* mostra os períodos do militar (os gravados, do mais antigo ao mais novo; sem nenhum, uma linha nova) */
  function mostrarPeriodos(periodos, comLinhaNova) {
    var e = estado;
    var lim = limite();
    e.removidos = [];
    e.linhas = (periodos || []).map(function (f) { return linhaGravada(f, lim); });
    if (comLinhaNova || !e.linhas.length) e.linhas.push(linhaNova());
    e.raiz.querySelector('#fer-secao-periodos').classList.remove('oculto');
    desenhar();
  }

  /* as linhas da lista que são deste militar ficam marcadas enquanto o painel dele está aberto */
  function marcarLinhas(usuarioId) {
    var linhas = document.querySelectorAll('#arvore-ferias .atestado-item--aberto');
    for (var i = 0; i < linhas.length; i++) linhas[i].classList.remove('atestado-item--aberto');
    if (!usuarioId) return;
    var dele = document.querySelectorAll('#arvore-ferias .atestado-item');
    for (var j = 0; j < dele.length; j++) {
      if (dele[j].getAttribute('data-militar') === usuarioId) dele[j].classList.add('atestado-item--aberto');
    }
  }

  /* popula o militar com o efetivo da unidade escolhida; escolhido, carrega as férias dele */
  function popularMilitares(raiz, unidadeId) {
    var gatilho = raiz.querySelector('#fer-militar');
    var menu = raiz.querySelector('#fer-militar-menu');
    if (!gatilho || !menu || !RosterWork.afastamentosDados) return;
    estado.militar = null;
    raiz.querySelector('#fer-secao-periodos').classList.add('oculto');
    gatilho.disabled = true;
    definirTexto(gatilho, 'Carregando…', true);
    menu.textContent = '';
    avaliar();
    var req = ++reqMil;
    RosterWork.afastamentosDados.buscarEfetivo().then(function (efetivo) {
      if (req !== reqMil || !estado) return;   // outra unidade foi escolhida enquanto carregava
      menu.textContent = '';
      if (efetivo == null) {        // falha na leitura (não confundir com unidade vazia)
        gatilho.disabled = true;
        definirTexto(gatilho, 'Erro ao carregar', true);
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        return;
      }
      var daUnidade = efetivo.filter(function (m) { return m.lotacao_atual === unidadeId; });
      daUnidade.forEach(function (m) {
        var item = RosterWork.tpl('tpl-ferias-militar-opcao');
        if (!item) return;
        item.textContent = ((m.grau_abreviacao || '') + ' ' + (m.nome_de_guerra || '')).trim();
        item.setAttribute('data-valor', m.usuario_id);
        item.addEventListener('click', function () {
          definirTexto(gatilho, item.textContent);
          carregarPeriodos(m.usuario_id);
        });
        menu.appendChild(item);
      });
      gatilho.disabled = daUnidade.length === 0;
      definirTexto(gatilho, daUnidade.length ? 'Selecione' : 'Sem militares na unidade', true);
    });
  }

  /* "Novas férias": o militar escolhido mostra as férias que já tem, mais uma linha nova */
  function carregarPeriodos(usuarioId) {
    var e = estado;
    e.militar = { usuario_id: usuarioId };
    e.carregando = true;
    var secao = e.raiz.querySelector('#fer-secao-periodos');
    var lista = e.raiz.querySelector('#fer-periodos');
    secao.classList.remove('oculto');
    lista.textContent = '';
    var giro = RosterWork.tpl('tpl-painel-carregando');
    if (giro) lista.appendChild(giro);
    e.raiz.querySelector('#fer-periodos-nota').classList.add('oculto');
    avaliar();
    var req = ++reqPer;
    RosterWork.afastamentosDados.feriasDoMilitar(usuarioId).then(function (periodos) {
      if (req !== reqPer || estado !== e) return;   // outro militar foi escolhido enquanto carregava
      e.carregando = false;
      if (periodos == null) {
        lista.textContent = '';
        e.militar = null;
        avaliar();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        return;
      }
      mostrarPeriodos(periodos, true);
    });
  }

  function tentarFechar() {
    if (mudou() && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { if (RosterWork.painel) RosterWork.painel.fechar(); }
      });
      return;
    }
    if (RosterWork.painel) RosterWork.painel.fechar();
  }

  /* o que o militar já tem nos dias novos: um item por troca, extra e folga */
  function itensConfirmar(r) {
    var S = RosterWork.mensagens.saida;
    var situacoes = RosterWork.mensagens.folgas.situacao;
    var itens = [];
    (r.trocas || []).forEach(function (t) { itens.push({ titulo: S.tituloTroca, texto: msg().feriasTroca(t.data, t.com_quem) }); });
    (r.extras || []).forEach(function (x) { itens.push({ titulo: S.tituloExtra, texto: msg().feriasExtra(x.data, x.unidade) }); });
    (r.folgas || []).forEach(function (f) {
      itens.push({ titulo: S.tituloFolga, texto: msg().feriasFolga(f.data, (situacoes[f.situacao] || '').toLowerCase()) });
    });
    return itens;
  }

  function salvar(confirmar) {
    var e = estado;
    if (!e || !e.militar) return;
    var btnSalvar = e.raiz.querySelector('#fer-salvar');
    if (btnSalvar) btnSalvar.disabled = true;   // evita duplo-envio (o véu já cobre; defesa a mais)
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    var periodos = e.linhas.filter(function (l) { return !linhaVazia(l); }).map(function (l) {
      return { ferias_id: l.id, inicio: D().paraISO(l.ini), fim: D().paraISO(l.fim) };
    });
    RosterWork.afastamentosDados.salvarFerias({
      p_usuario_id: e.militar.usuario_id, p_periodos: periodos, p_confirmar: !!confirmar
    }).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      avaliar();   // reabilita o Salvar (no sucesso o painel fecha e o botão some)
      if (r && r._falha === 'servidor') {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.precisa_confirmar) {   // ele já tem serviço ou folga nos dias novos: o admin decide
        if (RosterWork.confirmar) RosterWork.confirmar({
          tipo: 'aviso', mensagem: msg().feriasConfirmar, itens: itensConfirmar(r), nota: msg().feriasNotaConfirmar,
          textoConfirmar: RosterWork.mensagens.botoes.continuar, textoCancelar: RosterWork.mensagens.botoes.cancelar,
          aoConfirmar: function () { salvar(true); }
        });
      } else if (r && r.success) {
        e.removidos = [];
        e.linhas = [];
        if (RosterWork.painel) RosterWork.painel.fechar();
        if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Afastamentos' });
      } else if (RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.geral.falhaServidor });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      avaliar();
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* abre o painel (título, moldes, Cancelar/Salvar e o guarda de saída); devolve a raiz */
  function abrirPainel(config) {
    if (!RosterWork.painel) return null;
    estado = { raiz: null, militar: null, linhas: [], removidos: [], carregando: false };
    var e = estado;
    RosterWork.painel.abrir({
      titulo: config.titulo,
      subtitulo: config.subtitulo,
      aoFechar: function () {
        if (estado === e) estado = null;
        RosterWork.afastamentoSujo = null;
        marcarLinhas(null);
      },
      aoTentarFechar: function () { if (!mudou()) return false; tentarFechar(); return true; }   // X/Esc confirmam o descarte
    });
    /* depois do abrir: o aoFechar do painel anterior (se havia) limpa a marca dele */
    RosterWork.afastamentoSujo = mudou;
    var corpo = RosterWork.painel.corpo();
    var rodape = RosterWork.painel.rodape();
    var tplForm = document.getElementById('tpl-ferias-painel');
    var tplAcoes = document.getElementById('tpl-ferias-acoes');
    if (corpo && tplForm) corpo.appendChild(tplForm.content.cloneNode(true));
    if (rodape && tplAcoes) {
      rodape.appendChild(tplAcoes.content.cloneNode(true));
      rodape.classList.remove('oculto');
    }
    var raiz = document.getElementById('painel');
    if (!raiz) return null;
    e.raiz = raiz;

    if (!guardaLigado && RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(mudou);
      guardaLigado = true;
    }
    var btnCancelar = raiz.querySelector('#fer-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', tentarFechar);
    var btnSalvar = raiz.querySelector('#fer-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', function () { salvar(false); });
    return raiz;
  }

  /* pela linha da lista: militar = { usuario_id, grau, nome, unidade }, periodos = os dele (listar_ferias) */
  function abrirMilitar(militar, periodos) {
    var raiz = abrirPainel({
      titulo: 'Férias',
      subtitulo: [((militar.grau || '') + ' ' + (militar.nome || '')).trim(), militar.unidade].filter(Boolean).join(' · ')
    });
    if (!raiz) return;
    raiz.querySelector('#fer-secao-militar').classList.add('oculto');
    estado.militar = { usuario_id: militar.usuario_id };
    var ordenados = (periodos || []).slice().sort(function (a, b) { return String(a.data_inicio).localeCompare(String(b.data_inicio)); });
    mostrarPeriodos(ordenados, false);
    marcarLinhas(militar.usuario_id);
  }

  /* "Novas férias": Unidade (seletor em árvore, modo único) → Militar → os períodos dele */
  function abrirNovo() {
    var raiz = abrirPainel({ titulo: 'Novas férias' });
    if (!raiz) return;
    if (RosterWork.seletorUnidades) {
      var seletor = RosterWork.seletorUnidades.criar({
        modo: 'unico',
        dropdownEl: raiz.querySelector('#fer-unidade-dropdown'),
        arvoreEl: raiz.querySelector('#fer-unidade-arvore'),
        textoEl: raiz.querySelector('#fer-unidade-texto'),
        aoSelecionar: function (unidade) {
          var texto = raiz.querySelector('#fer-unidade-texto');
          if (texto) texto.classList.remove('campo-selecao-texto--vazio');
          popularMilitares(raiz, unidade.unidade_id);
        }
      });
      if (seletor) seletor.montarArvore();
    }
    avaliar();
  }

  window.RosterWork.ferias = { abrirNovo: abrirNovo, abrirMilitar: abrirMilitar };
})();
