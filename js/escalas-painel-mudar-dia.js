/* ============================================================
   ESCALAS — Mudar o dia do serviço (o lápis da aba Militares; só admin).
   O serviço pelo ciclo de um militar neste dia passa para outro dia,
   na mesma unidade e no mesmo horário: o serviço inteiro ou uma
   parte. Não é folga: o banco de horas não muda, e o militar é
   avisado no sino. Sub-tela em caixas de pergunta, uma depois da
   outra (Guia visual › Ações e perguntas): Quem (só o serviço pelo
   ciclo; quem está por troca, extra, pontual, remanejado ou já veio
   de outro dia aparece apagado, com o caminho certo), Qual parte muda
   (só com o serviço dividido no dia), Para qual dia (o mês em
   miniatura, geral-mini-calendario, com a situação dele em cada dia
   e as vagas sem ninguém, da escala_mudar_dia_dias), Horário (o
   serviço inteiro ou uma parte, geral-horario › periodoServico), Onde
   fica no dia novo (escalas-painel-onde.js, com as vagas sem ninguém
   no horário, a primeira recomendada) e o Como fica. Com tudo
   respondido, a mudança entra no rascunho do Dia ao vivo
   (escalas-painel-editar.js › aoVivo) e o banco confere numa prévia
   (escala_previa): a recusa fica em vermelho e desliga o Salvar do
   rodapé largo; o dia de antes abaixo do mínimo e quem assume o Chefe
   de Socorro ou o Oficial de Área avisam e deixam salvar (o Como fica
   e a conferência ficam em escalas-painel-mudar-dia-conferir.js).
   Depois de salvo, desfaz-se pela folga no dia de antes ou pelo
   Remover do dia no dia novo.
   API: RosterWork.escalasPainelMudarDia.abrir(opcoes) (opcoes = { cpf }:
   chega com ele escolhido, o menu da linha) e podeMudar(cpf) (ele
   está na lista Quem, pelo ciclo).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* as origens do serviço pelo ciclo (o que muda de dia por aqui) */
  var CICLO = ['base', 'saida', 'sistema'];
  var conta = 0;               // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function M() { return RosterWork.mensagens.escala.mudarDia; }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaMes(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function somarDias(s, n) { var d = dataDeIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function inicioDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  /* por que quem está no dia não muda por aqui (o caminho certo) */
  function motivo(mil, daUnidade) {
    var t = M(), js = mil.janelas || [];
    function tem(origem) { return js.filter(function (j) { return j.origem === origem; })[0]; }
    if (mil.remanejado) return t.naoRemanejado;
    if (tem('mudanca')) return t.naoMudou(tem('mudanca').mudanca_de || '');
    if (tem('troca')) return t.naoTroca;
    if (tem('pontual')) return t.naoPontual;
    if (tem('extra')) return t.naoExtra;
    return daUnidade ? '' : t.naoOutraUnidade;
  }

  /* as horas do ciclo dele nesta unidade, as que mudam de dia por aqui (vazio: não muda por aqui) */
  function cicloDe(mil, daUnidade) {
    return daUnidade && !mil.remanejado ? mil.janelas.filter(function (j) { return CICLO.indexOf(j.origem) >= 0; }) : [];
  }

  /* a lista Quem: quem está de serviço pelo ciclo nesta unidade (o ícone de origem e o horário do ciclo) e, no fim e
     apagados, quem está no dia de outro jeito, com o caminho certo */
  function itensQuem(dados) {
    var api = ed(), Q = RosterWork.escalasPainelQuem, pode = [], nao = [], visto = {};
    (dados.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        if (visto[pm.cpf] || !(pm.disp || []).length) return;
        var mil = api.militarDoDia(pm.cpf);
        if (!mil) return;
        visto[pm.cpf] = true;
        var ciclo = cicloDe(mil, !!u.editando);
        if (ciclo.length) {
          var item = Q.itemServico({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, disp: ciclo });
          item.mil = mil;
          pode.push(item);
          return;
        }
        var porque = motivo(mil, !!u.editando);
        if (!porque) return;
        var apagado = Q.itemServico({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, disp: mil.janelas });
        apagado.inativo = true;
        apagado.info = porque;
        nao.push(apagado);
      });
    });
    var lista = [];
    if (pode.length) lista = lista.concat([{ titulo: M().grupoCiclo }], pode);
    if (nao.length) lista = lista.concat([{ titulo: M().grupoNao }], nao);
    return lista;
  }

  /* ele muda o dia por aqui: está na lista Quem, pelo ciclo (o menu da linha só mostra o item a quem pode) */
  function podeMudar(cpf) {
    var dados = ed().dados();
    if (!dados) return false;
    return itensQuem(dados).some(function (i) { return i.cpf === cpf && !i.inativo && !i.titulo; });
  }

  /* opcoes = { cpf }: chega com ele escolhido (o menu da linha) */
  function abrir(opcoes) {
    var api = ed(), H = api.horas;
    var dados = api.dados();
    if (!dados) return;
    var uid = api.unidadeId(), deIso = api.iso(), data = diaMes(deIso);
    var hoje = iso(RosterWork.data.diaDeServico());
    /* item: quem (o item da lista, com .mil e .janelas = as do ciclo); janela: a do ciclo que muda; mes: o do calendário;
       para: o dia novo; horario: o valor do Serviço inteiro / Parte do serviço; limite e fim: o primeiro e o último dia
       que o banco aceita */
    var est = { item: null, janela: null, mes: inicioDoMes(dataDeIso(deIso)), para: null, horario: null, limite: null, fim: null };
    var meses = {};          // as leituras do calendário: 'cpf|AAAA-MM' -> resposta
    var dadosNovo = {};      // a leitura de cada dia novo: AAAA-MM-DD -> dados
    var el = {}, combo = null, horario = null, onde = null, ondeCaixa = null, conf = null;
    var pedidoMes = 0, pedidoDia = 0, carregandoMes = false, carregandoDia = false;

    /* ---------- montagem ---------- */

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-mudar-dia');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      el = {
        combo: q('.escala-mudar-dia-combo'), ajuda: q('.escala-mudar-dia-ajuda'), servico: q('.escala-mudar-dia-servico'),
        janelas: q('.escala-mudar-dia-janelas'), janelasLista: q('.escala-mudar-dia-janelas-lista'),
        dia: q('.escala-mudar-dia-dia'), mes: q('.escala-mudar-dia-mes'), carregando: q('.escala-mudar-dia-carregando'),
        anterior: q('.escala-mudar-dia-anterior'), proximo: q('.escala-mudar-dia-proximo'),
        calendario: q('.escala-mudar-dia-calendario'),
        horario: q('.escala-mudar-dia-horario'), periodo: q('.escala-mudar-dia-periodo'), parte: q('.escala-mudar-dia-parte'),
        onde: q('.escala-mudar-dia-onde'), como: q('.escala-mudar-dia-como'), comoLista: q('.escala-mudar-dia-como-lista'),
        conferindo: q('.escala-mudar-dia-conferindo'), papel: q('.escala-mudar-dia-papel'),
        minimo: q('.escala-mudar-dia-minimo'), erro: q('.escala-mudar-dia-erro')
      };
      /* os pontos de quem espera: ao lado do mês (o calendário e o dia novo) e no Como fica (o banco confere) */
      [el.carregando, el.conferindo].forEach(function (lugar) { var p = RosterWork.tpl('carregando-pontos'); if (p) lugar.appendChild(p); });
      var inp = el.combo.querySelector('input');
      inp.id = 'escala-mudar-dia-campo-' + (++conta);
      combo = RosterWork.comboMilitar.criar(inp, el.combo.querySelector('.dropdown-menu'), {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        aoPerder: function () { est.item = null; },
        textos: { selecione: msg().linha.digiteOuEscolha, semNinguem: M().ninguem, filtroVazio: msg().ninguemEncontrado }
      });
      el.anterior.addEventListener('click', function () { trocarMes(-1); });
      el.proximo.addEventListener('click', function () { trocarMes(1); });
      horario = RosterWork.horario.periodoServico(el.periodo, {
        aoMudar: function (v) { est.horario = v; atualizar(); }
      });
      /* o Onde fica do dia novo, com as vagas sem ninguém no horário */
      ondeCaixa = RosterWork.tpl('tpl-escala-onde-fica');
      el.onde.appendChild(ondeCaixa);
      onde = RosterWork.escalasPainelOnde.criar(ondeCaixa, {
        dados: function () { return est.para ? dadosNovo[est.para] : null; },
        periodos: function () { var p = periodoQueMuda(); return p ? [p] : []; },
        cpf: function () { return est.item ? est.item.cpf : ''; },
        vagas: true,
        aoMudar: atualizar
      });
      /* o Como fica e o banco confere (escalas-painel-mudar-dia-conferir.js) */
      conf = RosterWork.escalasPainelMudarDiaConferir.criar({
        el: el, dados: dados, uid: uid, data: data,
        item: function () { return est.item; },
        total: function () { return !!(est.horario && est.horario.total); },
        dadosNovo: function (dia) { return dadosNovo[dia]; },
        respostaDoDia: respostaDoDia,
        onde: function () { return onde; },
        textoResto: textoResto,
        vivo: function () { return el.combo.isConnected; },
        aoConferir: atualizar
      });
      corpo.appendChild(tela);
      var itens = itensQuem(dados);
      combo.preencher(itens);
      var pedidoCpf = opcoes && opcoes.cpf;
      var ja = pedidoCpf ? itens.filter(function (i) { return i.cpf === pedidoCpf && !i.inativo && !i.titulo; })[0] : null;
      if (ja) { escolher(ja); combo.mostrarAtual(); }
      else atualizar();
    }

    /* ---------- as respostas ---------- */

    function escolher(item) {
      est.item = item;
      est.janela = item.janelas.length === 1 ? item.janelas[0] : null;
      est.para = null;
      est.mes = inicioDoMes(dataDeIso(deIso));
      meses = {};
      conf.limpar();
      montarJanelas();
      definirJanela();
      onde.reiniciar();
      lerMes();
      atualizar();
    }

    /* Qual parte muda: só com o serviço pelo ciclo dividido no dia (uma parte de cada vez) */
    function montarJanelas() {
      el.janelasLista.textContent = '';
      if (est.item.janelas.length < 2) return;
      var nome = 'escala-mudar-dia-janela-' + (++conta);
      est.item.janelas.forEach(function (j) {
        var op = RosterWork.tpl('tpl-escala-remover-parte');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.addEventListener('change', function () {
          if (!r.checked) return;
          est.janela = j;
          definirJanela();
          onde.reiniciar();
          atualizar();
        });
        op.querySelector('.escala-remover-parte-texto').textContent = msg().linha.parte('ciclo', msg().dasAs(H.curta(j.hi), H.curta(j.hf)));
        el.janelasLista.appendChild(op);
      });
    }

    /* o Horário começa com a janela inteira */
    function definirJanela() {
      horario.definirServico(est.janela ? { hi: est.janela.hi, hf: est.janela.hf } : null);
      est.horario = horario.valor();
    }

    /* as horas que mudam (null enquanto o horário não vale) */
    function periodoQueMuda() {
      var v = est.horario;
      return v && v.valido ? { hi: v.hi, hf: v.hf } : null;
    }

    /* ---------- o calendário ---------- */

    function chaveMes(d) { return est.item.cpf + '|' + iso(d).slice(0, 7); }
    function respostaDoDia(diaIso) {
      var r = est.item && meses[chaveMes(dataDeIso(diaIso))];
      return r && r.dias ? r.dias[diaIso] || null : null;
    }

    function trocarMes(passo) {
      est.mes = new Date(est.mes.getFullYear(), est.mes.getMonth() + passo, 1);
      lerMes();
    }

    /* a situação dele em cada dia do mês (lida uma vez por mês e por militar) */
    function lerMes() {
      if (!est.item) return;
      var chave = chaveMes(est.mes);
      if (meses[chave]) { carregandoMes = false; desenharCalendario(); return; }
      var meu = ++pedidoMes, mes = est.mes;
      carregandoMes = true;
      desenharCalendario();
      var fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
      RosterWork.escalasDados.mudarDiaDias(uid, est.item.cpf, deIso, iso(mes), iso(fim)).then(function (r) {
        if (meu !== pedidoMes || !el.combo.isConnected) return;
        carregandoMes = false;
        if (!r || r.erro) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.erro) || msg().falhaCarregar });
          desenharCalendario();
          return;
        }
        meses[chave] = r;
        if (r.limite) est.limite = String(r.limite).slice(0, 10);
        if (r.fim) est.fim = String(r.fim).slice(0, 10);
        desenharCalendario();
        atualizar();
      });
    }

    function desenharCalendario() {
      if (!est.item || !el.calendario.isConnected) return;
      var r = meses[chaveMes(est.mes)];
      el.mes.textContent = M().mes(MESES[est.mes.getMonth()], est.mes.getFullYear());
      mostra(el.carregando, carregandoMes || carregandoDia);
      var limite = est.limite || somarDias(iso(new Date()), -7);
      el.anterior.disabled = est.mes.getTime() <= inicioDoMes(dataDeIso(limite)).getTime();
      el.proximo.disabled = !!est.fim && est.mes.getTime() >= inicioDoMes(dataDeIso(est.fim)).getTime();
      RosterWork.miniCalendario.renderizar(el.calendario, {
        dataRef: est.mes,
        aoDia: function (botao, diaIso) { pintarDia(botao, diaIso, r && r.dias ? r.dias[diaIso] : null); }
      });
    }

    /* um dia: a situação dele (a cor e o texto), as vagas sem ninguém (o número vermelho) e o clique, só onde ele pode */
    function pintarDia(botao, diaIso, d) {
      var texto = botao.querySelector('.mini-calendario-texto'), numero = botao.querySelector('.mini-calendario-conta');
      if (diaIso === hoje) botao.classList.add('mini-calendario-dia--hoje');
      if (diaIso === est.para) botao.classList.add('mini-calendario-dia--selecionado');
      var pode = !!d && (d.estado === 'pode' || d.estado === 'seguidas');   // as horas seguidas não pesam: o dia aparece como Pode
      botao.disabled = !pode;
      if (!d || d.estado === 'fora') { botao.classList.add('mini-calendario-dia--inativo'); return; }
      if (d.faltas > 0) { numero.textContent = String(d.faltas); numero.classList.add('mini-calendario-conta--erro'); }
      if (d.estado === 'origem') { botao.classList.add('mini-calendario-dia--origem'); texto.textContent = M().dia.origem; }
      else if (d.estado === 'afastado') { botao.classList.add('mini-calendario-dia--afastado'); texto.textContent = M().dia[d.tipo] || ''; }
      else if (pode) texto.textContent = M().dia.pode;
      else { botao.classList.add('mini-calendario-dia--ocupado'); texto.textContent = M().dia[d.estado] || ''; }
      if (pode) botao.addEventListener('click', function () { escolherDia(diaIso); });
    }

    /* o dia novo escolhido: a leitura dele (o Onde fica) e o Onde fica volta ao começo */
    function escolherDia(diaIso) {
      est.para = diaIso;
      conf.limpar();
      onde.reiniciar();
      lerDiaNovo();
      desenharCalendario();
      atualizar();
    }

    function lerDiaNovo() {
      var dia = est.para;
      if (!dia || dadosNovo[dia]) { carregandoDia = false; return; }
      var meu = ++pedidoDia;
      carregandoDia = true;
      RosterWork.escalasDados.lerDistribuicaoDia(uid, dia).then(function (d) {
        if (meu !== pedidoDia || !el.combo.isConnected) return;
        carregandoDia = false;
        if (!d) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); desenharCalendario(); return; }
        dadosNovo[dia] = d;
        desenharCalendario();
        atualizar();
      });
    }

    /* ---------- desenho ---------- */

    /* "das 08h às 08h" (o serviço pelo ciclo dele, cada janela) */
    function textoJanelas(js) { return js.map(function (j) { return msg().dasAs(H.curta(j.hi), H.curta(j.hf)); }).join(' e '); }
    /* o serviço dele aqui que fica no dia de antes (fora as horas que mudam): o texto, vazio quando sai todo */
    function textoResto(periodo) {
      var resto = H.menos(H.uniao(est.item.mil.janelas.map(H.faixa)), [H.faixa(periodo)]);
      return resto.length ? H.textoPeriodos(resto.map(H.periodo)) : '';
    }

    /* redesenha com as respostas de agora (também quando chega uma leitura ou a conferência do banco: as listas abertas
       ficam abertas) */
    function atualizar() {
      if (!el.combo || !el.combo.isConnected) return;
      ['janelas','dia', 'horario', 'parte', 'como', 'papel', 'minimo', 'erro'].forEach(function (k) { mostra(el[k], false); });
      mostra(ondeCaixa, false);
      mostra(el.ajuda, !est.item);
      mostra(el.servico, !!est.item);
      /* falta resposta (true) até o Onde fica */
      var falta = (function () {
        if (!est.item) return true;
        el.servico.textContent = M().servico(data, textoJanelas(est.item.janelas));
        if (est.item.janelas.length > 1) { mostra(el.janelas, true); if (!est.janela) return true; }
        mostra(el.dia, true);
        if (!est.para) return true;
        mostra(el.horario, true);
        var periodo = periodoQueMuda();
        if (!periodo) return true;
        if (!est.horario.total) {
          el.parte.textContent = M().parte(diaMes(est.para), H.textoPeriodos([periodo]), data, textoResto(periodo));
          mostra(el.parte, true);
        }
        if (!dadosNovo[est.para]) return true;
        mostra(ondeCaixa, true);
        onde.dia(diaMes(est.para));
        onde.atualizar();
        return onde.falta();
      })();
      if (falta) { api.aoVivo(null, !!est.item); return; }
      var item = { cpf: est.item.cpf, para: est.para, periodos: [periodoQueMuda()], onde: onde.paraBanco() };
      var chave = JSON.stringify(item);
      var c = conf.resultado(chave);
      api.aoVivo(function () { api.mudarDia(item); }, !!c && !!c.erro);
      conf.comoFica(item, c);
      if (!c) conf.agendar(item, chave);
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelMudarDia = { abrir: abrir, podeMudar: podeMudar };
})();
