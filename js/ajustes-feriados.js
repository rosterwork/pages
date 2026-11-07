/* ============================================================
   AJUSTES — aba Feriados: o calendário de uma unidade por vez
   A unidade do seletor da barra (a companhia e os pelotões, como na
   Distribuição) e o mês (expediente_mes): a folga em cinza com o nome,
   a parte do dia com o horário da folga e quem marcou; os feriados
   nacionais já vêm marcados. O administrador clica no dia e responde
   no painel direito, em caixas numeradas (Vale para · O que é · Nome
   · Quanto do dia), um dia por vez: a mudança fica no rascunho do
   dia (borda tracejada no calendário) e grava pelo rodapé largo da
   página (o painel não tem rodapé; expediente_salvar). O feriado de
   todos marca todas as unidades; o municipal, só o pelotão da
   cidade. O Remover grava na hora. Trocar de dia, de unidade, de mês
   ou de aba, ou fechar o painel com mudança, pergunta antes. O dia
   marcado por um nível acima só aparece para leitura (o de cima
   vale). O horário de cada dia da semana fica na aba Horário.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.ajustesFeriados.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var mes = null;          // primeiro dia do mês da tela (Date)
  var unidadeId = null;    // a unidade do seletor (null: a do administrador, escolhida pelo banco)
  var dados = null;        // a resposta do expediente_mes
  var pedido = 0;          // latest-wins
  var edicao = null;       // o rascunho do dia aberto no painel: { valores, inicial, f (o formulário), d, k (o dia), u }
  var guardaLigada = false;

  function msg() { return RW.mensagens.ajustes.expediente; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDe(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hora(h) { return h ? (h.slice(3) === '00' ? h.slice(0, 2) + 'h' : h.slice(0, 2) + 'h' + h.slice(3)) : ''; }

  /* ---------- o mês ---------- */
  function carregar() {
    var meu = ++pedido;
    var nome = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    el.nome.textContent = nome;
    el.calendario.textContent = '';
    RW.rpc('expediente_mes', { p_unidade: unidadeId, p_mes: iso(mes) }).then(function (r) {
      if (meu !== pedido || !el.calendario.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      unidadeId = r.unidade.id;
      desenharBarra();
      desenhar();
    }, function () { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* o seletor da barra: as unidades que o administrador muda, com a da tela marcada */
  function desenharBarra() {
    el.unidades.textContent = '';
    dados.unidades.filter(function (u) { return u.pode_editar; }).forEach(function (u) {
      var aba = RW.tpl('tpl-feriados-unidade');
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', u.id);
      aba.classList.toggle('aba--ativa', u.id === unidadeId);
      el.unidades.appendChild(aba);
    });
  }

  /* trocar de unidade com o dia aberto e não salvo pergunta antes; continuando, a unidade de antes fica marcada */
  function trocarUnidade(id) {
    if (id === unidadeId) return;
    confirmarDescarte(function () { fecharDia(); unidadeId = id; carregar(); }, desenharBarra);
  }

  /* trocar de mês: o mesmo, e o painel do dia fecha */
  function trocarMes(passo) {
    confirmarDescarte(function () { fecharDia(); mes = new Date(mes.getFullYear(), mes.getMonth() + passo, 1); carregar(); });
  }

  function desenhar() {
    var u = dados.unidade;
    el.unidade.textContent = u.nome;
    el.cidade.textContent = u.cidade;
    el.calendario.textContent = '';
    var cal = RW.tpl('tpl-exp-cal');
    for (var i = 0; i < mes.getDay(); i++) cal.appendChild(RW.tpl('tpl-exp-dia-vazio'));
    var dias = dados.dias || {};
    Object.keys(dias).sort().forEach(function (k) { cal.appendChild(celula(u, k, dias[k])); });
    el.calendario.appendChild(cal);
    el.calendario.appendChild(listaDosDias(cal));
    atualizar();
  }

  /* os dias com nome, embaixo do calendário (no celular, onde o nome não cabe no dia): a linha abre o dia, como ele */
  function listaDosDias(cal) {
    var lista = RW.tpl('tpl-exp-lista');
    Array.prototype.forEach.call(cal.querySelectorAll('.ajustes-exp-dia[data-dia]'), function (dia) {
      var nome = dia.querySelector('.ajustes-exp-dia-texto').textContent;
      if (!nome) return;
      var item = RW.tpl('tpl-exp-lista-item');
      item.querySelector('.ajustes-exp-lista-dia').textContent = dia.querySelector('.ajustes-exp-dia-num').textContent;
      item.querySelector('.ajustes-exp-lista-nome').textContent = nome;
      item.disabled = dia.disabled;
      item.addEventListener('click', function () { dia.click(); });
      lista.appendChild(item);
    });
    return lista;
  }

  /* o dia: a folga em cinza com o nome (ou "Recesso"; a folga do horário, sem texto); na parte do dia, o nome e o
     horário da folga (o horário da semana fica na aba Horário) */
  function celula(u, k, d) {
    var c = RW.tpl('tpl-exp-dia');
    var data = dataDe(k);
    c.querySelector('.ajustes-exp-dia-num').textContent = data.getDate();
    var texto = '';
    if (!d.trabalha) {
      c.classList.add('ajustes-exp-dia--folga');
      texto = d.nome || (d.motivo === 'sem_expediente' ? '' : msg().motivos[d.motivo]);
    } else if (d.folga_das) {
      texto = msg().parteDia(d.nome || msg().motivos[d.motivo], msg().horas(hora(d.folga_das), hora(d.folga_ate)));
    }
    c.querySelector('.ajustes-exp-dia-texto').textContent = texto;
    c.querySelector('.ajustes-exp-dia-origem').textContent = d.fonte === 'nacional' ? msg().nacional : (d.origem || '');
    c.setAttribute('aria-label', msg().diaLongo(data) + ': ' + d.texto);
    c.setAttribute('data-dia', k);
    if (u.pode_editar) {
      c.classList.add('ajustes-exp-dia--clicavel');
      /* outro dia com o aberto não salvo pergunta antes */
      c.addEventListener('click', function () {
        if (edicao && edicao.k === k) return;
        confirmarDescarte(function () { abrirDia(u, k, d); });
      });
    } else {
      c.disabled = true;
    }
    return c;
  }

  /* ---------- o rascunho do dia aberto (um dia por vez) e o rodapé largo da página ---------- */
  function sujo() { return !!(edicao && JSON.stringify(edicao.valores) !== edicao.inicial); }

  /* o rodapé largo aparece só com alteração, e o Salvar liga com alguma unidade no "Vale para" e o que é escolhido (o
     resto confere no clique); o dia mudado leva a borda tracejada no calendário, como na Escala */
  function atualizar() {
    var mudou = sujo();
    el.rodape.classList.toggle('oculto', !mudou);
    if (mudou) el.salvar.disabled = !edicao.valores.unidades.length || !edicao.valores.tipo;
    Array.prototype.forEach.call(el.calendario.querySelectorAll('.ajustes-exp-dia--nao-salvo'), function (c) {
      c.classList.remove('ajustes-exp-dia--nao-salvo');
    });
    var dia = mudou ? el.calendario.querySelector('[data-dia="' + edicao.k + '"]') : null;
    if (dia) dia.classList.add('ajustes-exp-dia--nao-salvo');
  }

  /* o rascunho sai e o painel do dia fecha */
  function fecharDia() {
    edicao = null;
    if (RW.painel.estaAberto()) RW.painel.fechar();
    atualizar();
  }

  /* com alteração não salva, pergunta antes de seguir (Descartar / Continuar editando); descartando, o rascunho sai */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { fecharDia(); seguir(); },
      aoCancelar: ficar
    });
  }

  /* o painel do dia, sem rodapé próprio: o Salvar e o Cancelar são os do rodapé largo da página */
  function abrirPainel(titulo, subtitulo) {
    RW.painel.abrir({
      titulo: titulo,
      subtitulo: subtitulo,
      aoFechar: function () { edicao = null; atualizar(); },
      aoTentarFechar: function () { if (!sujo()) return false; confirmarDescarte(function () {}); return true; }
    });
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }
  }

  function travado(texto) {
    var t = RW.tpl('tpl-exp-travado');
    t.textContent = texto;
    RW.painel.corpo().appendChild(t);
  }

  /* o Salvar do rodapé: confere e grava o dia aberto */
  function salvarDia() {
    if (!edicao) return;
    if (conferir(edicao.f, edicao.valores, edicao.d)) enviarDia(edicao.k, 'marcar', el.salvar);
  }

  /* o Cancelar do rodapé: pergunta e volta o painel ao que está gravado */
  function cancelarDia() {
    if (!edicao) return;
    var aberto = edicao;
    confirmarDescarte(function () { abrirDia(aberto.u, aberto.k, aberto.d); });
  }

  function marcador(botao, marcado, aoMudar) {
    function pintar(v) {
      botao.setAttribute('aria-checked', v ? 'true' : 'false');
      botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', v);
    }
    pintar(marcado);
    botao.addEventListener('click', function () {
      var v = botao.getAttribute('aria-checked') !== 'true';
      pintar(v);
      aoMudar(v);
    });
  }

  function mostrarErro(f, campo, frase) {
    var p = f.querySelector('[data-erro="' + campo + '"]');
    p.textContent = frase;
    p.classList.toggle('oculto', !frase);
  }

  /* confere antes de salvar: o nome no feriado e no outro; a parte do dia com o fim depois do início, começando no início
     ou terminando no fim do expediente. O erro fica embaixo da caixa dele */
  function conferir(f, v, d) {
    var nome = (v.tipo === 'feriado' || v.tipo === 'outro') && !v.nome.trim()
      ? (v.tipo === 'feriado' ? msg().nomeFeriado : msg().nomeOutro) : '';
    var parte = !v.parte ? '' : v.das >= v.ate ? msg().parteFimAntes
      : v.das !== d.exp_das && v.ate !== d.exp_ate ? msg().parteEncostada : '';
    mostrarErro(f, 'nome', nome);
    mostrarErro(f, 'parte', parte);
    return !nome && !parte;
  }

  /* a parte do dia começa no meio do expediente e vai até o fim (ex.: 08h às 18h, das 13h às 18h) */
  function meioDoDia(d) {
    if (!d.exp_das) return '';
    var m = (Number(d.exp_das.slice(0, 2)) + Number(d.exp_ate.slice(0, 2))) / 2;
    return ('0' + Math.floor(m)).slice(-2) + ':00';
  }

  /* o dia, nas caixas numeradas: Vale para, O que é (feriado, recesso ou outro), o nome (feriado e outro) e, no dia com
     expediente, o dia todo ou a parte dele (o horário do site, dentro do expediente); no dia já marcado, o Remover */
  function abrirDia(u, k, d) {
    var data = dataDe(k);
    abrirPainel(msg().diaLongo(data), u.nome);
    var corpo = RW.painel.corpo();
    if (d.travado) { travado(msg().travadoDia(d.origem || '')); return; }
    var f = RW.tpl('tpl-exp-dia-form');
    var marcado = d.fonte === 'marcado';
    f.querySelector('.ajustes-exp-agora').textContent = msg().agora(d.texto);
    var v = {
      unidades: [u.id],
      tipo: marcado ? d.motivo : '',
      nome: marcado ? (d.nome || '') : '',
      parte: marcado && !!d.folga_das,
      das: marcado && d.folga_das ? d.folga_das : meioDoDia(d),
      ate: marcado && d.folga_ate ? d.folga_ate : (d.exp_ate || '')
    };
    edicao = { valores: v, inicial: JSON.stringify(v), f: f, d: d, k: k, u: u };

    /* 2. O que é; 3. Nome (só no feriado e no outro) */
    var caixaNome = f.querySelector('[data-pergunta="nome"]');
    function mostrarNome() { caixaNome.classList.toggle('oculto', !(v.tipo === 'feriado' || v.tipo === 'outro')); }
    Array.prototype.forEach.call(f.querySelectorAll('input[name="exp-tipo"]'), function (r) {
      r.checked = r.value === v.tipo;
      r.addEventListener('change', function () { v.tipo = r.value; mostrarErro(f, 'nome', ''); mostrarNome(); atualizar(); });
    });
    var campoNome = f.querySelector('[name="exp-nome"]');
    campoNome.value = v.nome;
    campoNome.addEventListener('input', function () { v.nome = campoNome.value; mostrarErro(f, 'nome', ''); atualizar(); });
    mostrarNome();

    /* 4. Quanto do dia (só no dia com expediente) */
    f.querySelector('[data-pergunta="parte"]').classList.toggle('oculto', !d.exp_das);
    var lugarHoras = f.querySelector('.ajustes-exp-horas');
    function desenharParte() {
      lugarHoras.classList.toggle('oculto', !v.parte);
      lugarHoras.textContent = '';
      if (!v.parte) return;
      lugarHoras.appendChild(RW.horario.linha({
        hi: v.das, hf: v.ate, opcoes: RW.ajustesHorario.horas(d.exp_das, d.exp_ate), semAcoes: true,
        aoInicio: function (h) { v.das = h; mostrarErro(f, 'parte', ''); atualizar(); },
        aoFim: function (h) { v.ate = h; mostrarErro(f, 'parte', ''); atualizar(); }
      }));
    }
    Array.prototype.forEach.call(f.querySelectorAll('input[name="exp-parte"]'), function (r) {
      r.checked = (r.value === 'parte') === v.parte;
      r.addEventListener('change', function () { v.parte = r.value === 'parte'; mostrarErro(f, 'parte', ''); desenharParte(); atualizar(); });
    });
    desenharParte();

    /* 1. Vale para (a unidade da tela já marcada) */
    var vale = f.querySelector('.ajustes-exp-vale');
    dados.unidades.filter(function (x) { return x.pode_editar; }).forEach(function (x) {
      var item = RW.tpl('tpl-exp-vale-item');
      item.querySelector('.ajustes-exp-vale-nome').textContent = x.cidade ? x.nome + ' (' + x.cidade + ')' : x.nome;
      marcador(item, x.id === u.id, function (ligado) {
        v.unidades = v.unidades.filter(function (id) { return id !== x.id; });
        if (ligado) v.unidades.push(x.id);
        v.unidades.sort(function (a, b) { return a - b; });
        atualizar();
      });
      vale.appendChild(item);
    });

    /* o dia já marcado: o Remover tira a marca das unidades do "Vale para" */
    var remover = f.querySelector('.ajustes-exp-remover');
    if (marcado) {
      remover.classList.remove('oculto');
      remover.addEventListener('click', function () { if (v.unidades.length) enviarDia(k, 'remover', remover); });
    }
    corpo.appendChild(f);
    atualizar();
  }

  function enviarDia(k, acao, botao) {
    var v = edicao.valores;
    var marcar = acao === 'marcar';
    var parte = marcar && v.parte;
    RW.iniciarCarregando(botao);
    RW.rpc('expediente_salvar', {
      p_unidades: v.unidades, p_data: k, p_acao: acao,
      p_tipo: marcar ? v.tipo : null, p_nome: marcar && v.tipo !== 'recesso' ? v.nome : null,
      p_das: parte ? v.das : null, p_ate: parte ? v.ate : null
    }).then(concluir(botao), falhou(botao));
  }

  function concluir(botao) {
    return function (r) {
      RW.pararCarregando(botao);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      fecharDia();
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Ajustes' });
      carregar();
    };
  }

  function falhou(botao) {
    return function (e) {
      RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao });
    };
  }

  /* ---------- entrada (a cada visita à página; a unidade escolhida fica para a próxima) ---------- */
  function montar(cont) {
    el.unidades = cont.querySelector('#feriados-unidades');
    el.nome = cont.querySelector('#feriados-mes-nome');
    el.unidade = cont.querySelector('#feriados-unidade');
    el.cidade = cont.querySelector('#feriados-cidade');
    el.calendario = cont.querySelector('#feriados-calendario');
    el.rodape = cont.querySelector('#feriados-rodape');
    el.salvar = cont.querySelector('#feriados-salvar');
    el.cancelar = cont.querySelector('#feriados-cancelar');
    edicao = null;
    var hoje = new Date();
    mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    cont.querySelector('#feriados-mes-anterior').addEventListener('click', function () { trocarMes(-1); });
    cont.querySelector('#feriados-mes-proximo').addEventListener('click', function () { trocarMes(1); });
    RW.abas.ligar(el.unidades, function (aba) { trocarUnidade(Number(aba.getAttribute('data-unidade'))); });
    el.salvar.addEventListener('click', salvarDia);
    el.cancelar.addEventListener('click', cancelarDia);
  }

  function ativar() { carregar(); }

  /* sair da aba com o dia aberto e não salvo pergunta antes */
  RW.ajustesFeriados = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
