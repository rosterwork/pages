/* ============================================================
   AJUSTES — aba Horário de expediente
   Um horário só para a companhia e todos os pelotões, de domingo a
   sábado (expediente_horario): cada dia "Trabalha", com o horário do
   site (geral-horario: "08h → 18h", horas inteiras), ou "Folga". Sem
   horário próprio, a tela parte do da unidade de cima (a
   corporação). Edita na própria tela; o rodapé grava a semana
   inteira (expediente_horario_salvar → Histórico → resumo). Quem não
   administra a companhia só lê (o cadeado). As 7 linhas estão no
   ajustes.html; aqui só os valores. horas() também serve aos
   Feriados (a parte do dia). RosterWork.ajustesHorario.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do expediente_horario
  var semana = null;     // a semana em edição: 7 dias (domingo primeiro), { das, ate } ou null (folga)
  var inicial = '';      // a semana lida, para saber se mudou
  var lembradas = {};    // o horário do dia que virou folga, para voltar se ele trabalhar de novo
  var pedido = 0;        // latest-wins
  var guardaLigada = false;

  function msg() { return RW.mensagens.ajustes.expediente; }
  function sujo() { return !!semana && JSON.stringify(semana) !== inicial; }
  function montada() { return !!(el.semana && el.semana.isConnected); }
  function linhas() { return Array.prototype.slice.call(el.semana.querySelectorAll('.ajustes-horario-linha')); }
  function minutos(t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }

  /* as horas inteiras das listas do horário do site, dentro da janela de/ate ("HH:MM"; sem ela, o dia todo): o
     início antes do fim da janela, o fim depois do começo dela */
  function horas(de, ate) {
    var ini = de ? Math.ceil(minutos(de) / 60) : 0;
    var fim = ate ? Math.floor(minutos(ate) / 60) : 23;
    var lista = { inicios: [], fins: [] };
    for (var h = ini; h <= fim; h++) {
      var t = ('0' + h).slice(-2);
      if (h < fim) lista.inicios.push(t);
      if (h > ini) lista.fins.push(t);
    }
    return lista;
  }

  /* ---------- ler ---------- */
  function carregar() {
    var meu = ++pedido;
    el.carregando.classList.remove('oculto');
    el.conteudo.classList.add('oculto');
    el.rodape.classList.add('oculto');
    return RW.rpc('expediente_horario', {}).then(function (r) {
      if (meu !== pedido || !montada()) return;
      el.carregando.classList.add('oculto');
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      semana = r.semana.map(function (d) { return d ? { das: d.das, ate: d.ate } : null; });
      inicial = JSON.stringify(semana);
      lembradas = {};
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.carregando.classList.add('oculto');
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- desenhar ---------- */
  function desenhar() {
    var pode = !!dados.pode_editar;
    el.companhia.textContent = dados.companhia.nome;
    el.trava.classList.toggle('oculto', pode);
    el.conteudo.classList.remove('oculto');
    linhas().forEach(function (linha) { desenharLinha(linha, pode); });
    desenharRodape();
  }

  /* a linha do dia: Trabalha | Folga e, trabalhando, o horário do site (início → fim) */
  function desenharLinha(linha, pode) {
    var dia = semana[Number(linha.getAttribute('data-dia'))];
    linha.querySelectorAll('.ajustes-horario-tipo .aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', (aba.getAttribute('data-valor') === 'trabalha') === !!dia);
      aba.disabled = !pode;
    });
    var lugar = linha.querySelector('.ajustes-horario-horas');
    lugar.textContent = '';
    if (dia) {
      lugar.appendChild(RW.horario.linha({
        hi: dia.das, hf: dia.ate, opcoes: horas(), semAcoes: true, desligado: !pode,
        aoInicio: function (h) { dia.das = h; mostrarErro(linha, ''); desenharRodape(); },
        aoFim: function (h) { dia.ate = h; mostrarErro(linha, ''); desenharRodape(); }
      }));
    }
    mostrarErro(linha, '');
  }

  /* o rodapé largo aparece só com alteração (e só para quem muda o horário) */
  function desenharRodape() {
    el.rodape.classList.toggle('oculto', !(dados && dados.pode_editar && sujo()));
  }

  function mostrarErro(linha, frase) {
    var p = linha.querySelector('.ajustes-horario-erro');
    p.textContent = frase;
    p.classList.toggle('oculto', !frase);
  }

  /* cada dia que trabalha precisa dos dois horários, com o fim depois do início; o erro fica embaixo da linha */
  function conferir() {
    var ok = true;
    linhas().forEach(function (linha) {
      var k = Number(linha.getAttribute('data-dia'));
      var dia = semana[k];
      var erro = !dia ? '' : !dia.das || !dia.ate ? msg().horarioPreencha(msg().dias[k])
        : dia.das >= dia.ate ? msg().horarioFimAntes(msg().dias[k]) : '';
      mostrarErro(linha, erro);
      if (erro) ok = false;
    });
    return ok;
  }

  /* ---------- editar ---------- */
  function ligar() {
    linhas().forEach(function (linha) {
      var k = Number(linha.getAttribute('data-dia'));
      RW.abas.ligar(linha.querySelector('.ajustes-horario-tipo'), function (aba) {
        var trabalha = aba.getAttribute('data-valor') === 'trabalha';
        if (trabalha === !!semana[k]) return;
        if (trabalha) {
          semana[k] = lembradas[k] || { das: '08:00', ate: '18:00' };   // sem um de antes, o horário de sempre
        } else {
          lembradas[k] = semana[k];
          semana[k] = null;
        }
        desenharLinha(linha, true);
        desenharRodape();
      });
    });
    el.cancelar.addEventListener('click', function () { confirmarDescarte(function () {}); });
    el.salvar.addEventListener('click', salvar);
  }

  /* volta ao que está gravado */
  function descartar() {
    semana = JSON.parse(inicial);
    lembradas = {};
    desenhar();
  }

  /* com edição não salva, pergunta antes de seguir; descartando, volta ao gravado */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { descartar(); seguir(); }, aoCancelar: ficar
    });
  }

  function salvar() {
    if (!sujo() || !conferir()) return;
    RW.iniciarCarregando(el.salvar);
    RW.rpc('expediente_horario_salvar', { p_unidade: dados.companhia.id, p_semana: semana }).then(function (r) {
      RW.pararCarregando(el.salvar);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Ajustes' });
      carregar();
    }, function () {
      RW.pararCarregando(el.salvar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- entrada (a cada visita à página) e a aba ---------- */
  function montar(cont) {
    ['semana', 'conteudo', 'carregando', 'companhia', 'trava', 'rodape', 'cancelar', 'salvar'].forEach(function (nome) {
      el[nome] = cont.querySelector('#horario-' + nome);
    });
    dados = null;
    semana = null;
    inicial = '';
    ligar();
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return montada() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a 1ª vez que a aba abre na visita, lê */
  function ativar() { return dados ? Promise.resolve() : carregar(); }

  RW.ajustesHorario = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte, horas: horas };
})();
