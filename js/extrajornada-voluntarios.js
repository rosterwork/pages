/* ============================================================
   EXTRAJORNADA — aba Voluntários (dados, edição e salvar)
   A repartição das cotas do mês. O administrador informa o total
   (do grupo inteiro ou de cada unidade), marca o termo do eProtocolo
   de cada voluntário (na tabela ou no painel do militar: é a mesma
   marcação) e ajusta o Concedido. O banco reparte por taxa de
   atendimento só entre quem tem o termo recebido: extra_cotas_carregar
   simula sem gravar e extra_cotas_salvar grava tudo de uma vez, com
   histórico e resumo. O militar comum vê só leitura. O desenho da
   lista e do painel fica em extrajornada-voluntarios-lista.js.
   Não cria HTML nem escreve estilo.
   RosterWork.extrajornadaVoluntarios.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var conteudo = null;
  var naAba = false;
  var el = {};
  var comp = null;                 // 1º dia do mês exibido
  var limpo = null;                // retrato do que está salvo (detecta edição não salva)
  var cargaSeq = 0;                // ignora resposta velha (troca rápida de mês ou de aba)
  var timerSim = null;
  var guardaLigada = false;

  /* o estado da tela: vols = voluntários (cada um com o salvo e o atual), base = o que está salvo */
  var estado = vazio();
  function vazio() {
    return { modo: 'grupo', totalGrupo: 0, totais: {}, unidades: [], vols: [], naoVol: [], semResp: [],
      base: { modo: 'grupo', totalGrupo: 0, totais: {} }, mostrarNovo: false, lista: 'voluntarios', selecionado: null };
  }

  function admin() { return RosterWork.sessao.temPapel('companhia'); }   // a Extrajornada é da companhia
  function ativo() { return naAba && el.lista && el.lista.isConnected; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function lista() { return RW.extrajornadaVoluntariosLista; }

  function soma(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x) || 0; }); return s; }
  function totalDoMes() {
    if (estado.modo === 'grupo') return estado.totalGrupo;
    var s = 0; Object.keys(estado.totais).forEach(function (k) { s += estado.totais[k] || 0; });
    return s;
  }
  function volsDaUnidade(uid) { return estado.vols.filter(function (v) { return v.unidadeId === uid; }); }
  function acharVol(cpf) { for (var i = 0; i < estado.vols.length; i++) if (estado.vols[i].cpf === cpf) return estado.vols[i]; return null; }

  /* distribuiu mais do que o total (do grupo ou de alguma unidade)? */
  function estourado() {
    if (estado.modo === 'grupo') return soma(estado.vols, function (v) { return v.concedido; }) > estado.totalGrupo;
    return estado.unidades.some(function (u) {
      return soma(volsDaUnidade(u.unidade_id), function (v) { return v.concedido; }) > (estado.totais[String(u.unidade_id)] || 0);
    });
  }

  /* ---------- edição não salva ---------- */
  function retrato() {
    return JSON.stringify({ m: estado.modo, t: estado.totalGrupo, u: estado.totais,
      v: estado.vols.map(function (v) { return v.cpf + ':' + v.concedido + ':' + v.termo; }) });
  }
  function sujo() { return limpo !== null && retrato() !== limpo; }
  /* quantas mudanças em relação ao salvo (o texto do rodapé) */
  function contarMudancas() {
    var n = 0;
    if (estado.modo !== estado.base.modo) n++;
    if (estado.modo === 'grupo' && estado.totalGrupo !== estado.base.totalGrupo) n++;
    if (estado.modo === 'por_unidade') {
      Object.keys(estado.totais).forEach(function (k) { if ((estado.totais[k] || 0) !== (estado.base.totais[k] || 0)) n++; });
    }
    estado.vols.forEach(function (v) {
      if (v.concedido !== v.baseConcedido) n++;
      if (v.termo !== v.termoSalvo) n++;
    });
    return n;
  }
  function atualizarRodape() {
    if (!el.rodape) return;
    el.rodape.classList.toggle('oculto', !admin());
    var n = sujo() ? contarMudancas() : 0;
    if (el.salvar) el.salvar.disabled = !n;
    if (el.mudancas) el.mudancas.textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    /* o rodapé do painel do militar repete o da tabela */
    var pSalvar = estado.selecionado && RW.painel && RW.painel.estaAberto() ? RW.painel.rodape().querySelector('.extra-vol-p-salvar') : null;
    if (pSalvar) pSalvar.disabled = !n;
  }

  /* o selo do prazo da solicitação do mês exibido */
  function atualizarSelo() {
    if (!el.selo || !RW.extrajornadaDados) return;
    var mesAlvo = iso(comp);
    RW.extrajornadaDados.carregarDisponibilidade(mesAlvo).then(function (r) {
      if (!ativo() || iso(comp) !== mesAlvo) return;
      if (!r || !r.ok) { el.selo.classList.add('oculto'); return; }
      var cal = RW.mensagens.extrajornada.calendario;
      var mes = MESES[comp.getMonth()];
      var p = String(r.prazo_fim || '').split('-');
      var ate = p.length === 3 ? p[2] + '/' + p[1] : '';
      var aberto = r.estado_janela === 'editavel';
      el.selo.textContent = aberto ? cal.prazoAberto(mes, ate) : cal.prazoEncerrado(mes, ate);
      el.selo.classList.toggle('selo--escuro', !aberto);
      el.selo.classList.remove('oculto');
    });
  }

  /* ---------- dados ---------- */

  /* termos mudados na tela (vão na simulação e no salvar) */
  function termosAlterados() {
    var t = {};
    estado.vols.forEach(function (v) { if (v.termo !== v.termoSalvo) t[v.cpf] = v.termo; });
    return t;
  }
  function montarConfig() {
    var c = estado.modo === 'grupo'
      ? { modo: 'grupo', total: estado.totalGrupo }
      : { modo: 'por_unidade', totais: estado.totais };
    c.termos = termosAlterados();
    return c;
  }

  /* lê a resposta do banco. como: 'carga' (o salvo), 'manter' (re-simulação: quem seguia a sugestão
     acompanha a nova, quem foi ajustado à mão fica) ou 'sugestao' (todos voltam à sugestão) */
  function aplicarResposta(r, como) {
    var antigos = {};
    estado.vols.forEach(function (v) { antigos[v.cpf] = v; });
    estado.modo = r.modo || 'grupo';
    estado.unidades = r.unidades || [];
    estado.totalGrupo = 0;
    estado.totais = {};
    var brutos = [];
    (r.grupos || []).forEach(function (g) {
      if (g.unidade_id == null) estado.totalGrupo = g.total || 0;
      else estado.totais[String(g.unidade_id)] = g.total || 0;
      (g.voluntarios || []).forEach(function (x) { brutos.push(x); });
    });
    estado.vols = brutos.map(function (x, i) {
      var sug = x.sugerido || 0;
      var ant = antigos[x.cpf];
      var conc;
      if (como === 'carga') conc = x.concedido_salvo != null ? x.concedido_salvo : sug;
      else if (como === 'manter' && ant && ant.concedido !== ant.sugerido) conc = ant.concedido;
      else conc = sug;
      if (!x.termo) conc = 0;
      return {
        cpf: x.cpf, nome: x.nome, grad: x.grad, pediu: x.pediu || 0, fecha24: !!x.fecha_24h, taxa: x.taxa,
        sugerido: sug, concedido: conc, preenchido: x.preenchido || 0, unidadeId: x.unidade_id,
        termo: !!x.termo, termoEm: x.termo_em, termoPor: x.termo_por, enviadaEm: x.enviada_em,
        datasQuer: x.datas_quer || [], datasNao: x.datas_nao || [],
        meses12: x.meses_12 || 0, pediu12: x.pediu_12 || 0, recebeu12: x.recebeu_12 || 0,
        novo: x.concedido_salvo == null, ordem: i,
        /* o salvo: na carga é o que veio; na re-simulação, o da carga anterior */
        termoSalvo: (como === 'carga' || !ant) ? !!x.termo : ant.termoSalvo,
        baseConcedido: (como === 'carga' || !ant) ? conc : ant.baseConcedido
      };
    });
    estado.naoVol = r.nao_voluntarios || [];
    estado.semResp = r.sem_resposta || [];
    /* o selo "Novo" só quando há mistura (na 1ª repartição do mês todos são novos) */
    estado.mostrarNovo = estado.vols.some(function (v) { return v.novo; }) && estado.vols.some(function (v) { return !v.novo; });
    if (como === 'carga') estado.base = { modo: estado.modo, totalGrupo: estado.totalGrupo, totais: JSON.parse(JSON.stringify(estado.totais)) };
  }

  function desenhar() {
    if (lista()) lista().desenhar(estado, el, acoes);
    atualizarRodape();
  }

  function carregar() {
    if (!RW.extrajornadaDados || !ativo()) return;
    if (lista() && !estado.vols.length) lista().carregando(el);
    var req = ++cargaSeq;
    RW.extrajornadaDados.carregarCotas(iso(comp), null).then(function (r) {
      if (!ativo() || req !== cargaSeq) return;
      r = r || {};
      if (!r.ok) {
        var lst = estado.lista;
        estado = vazio(); estado.lista = lst;
        limpo = retrato();
        if (lista()) lista().mostrarEstado(el, r.error || RW.mensagens.extrajornada.falhaCotas);
        atualizarRodape();
        return;
      }
      aplicarResposta(r, 'carga');
      limpo = retrato();
      desenhar();
    }, function () {
      if (!ativo() || req !== cargaSeq) return;
      if (lista()) lista().mostrarEstado(el, RW.mensagens.extrajornada.falhaCotas);
    });
  }

  /* re-simula a repartição com o que está na tela (sem gravar) */
  function resimular(como) {
    if (!RW.extrajornadaDados) return;
    var req = ++cargaSeq;
    RW.extrajornadaDados.carregarCotas(iso(comp), montarConfig()).then(function (r) {
      if (!r || !r.ok || !ativo() || req !== cargaSeq) return;
      aplicarResposta(r, como || 'manter');
      desenhar();
    });
  }
  function resimularDepois() {
    if (timerSim) clearTimeout(timerSim);
    timerSim = setTimeout(function () { resimular('manter'); }, 400);
  }

  /* ---------- ações da tela (a lista chama) ---------- */
  var acoes = {
    /* total do grupo ou de uma unidade (uid null = grupo) */
    total: function (uid, valor) {
      var n = parseInt(String(valor).replace(/\D/g, ''), 10) || 0;
      if (uid == null) estado.totalGrupo = n; else estado.totais[String(uid)] = n;
      if (lista()) lista().atualizarNumeros(estado, el);
      atualizarRodape();
      resimularDepois();
    },
    concedido: function (cpf, n) {
      var v = acharVol(cpf);
      if (!v) return;
      v.concedido = n;
      if (lista()) lista().atualizarLinha(estado, el, v);
      atualizarRodape();
    },
    /* a marcação do termo (tabela ou painel): desmarcar zera o Concedido; o banco re-sugere */
    termo: function (cpf) {
      var v = acharVol(cpf);
      if (!v) return;
      if (v.termo && v.preenchido > 0) {
        RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.voluntarios.termoComExtra(v.grad + ' ' + v.nome) });
        return;
      }
      v.termo = !v.termo;
      v.concedido = 0;
      desenhar();
      resimular('manter');
    },
    escopo: function (modo) {
      if (modo === estado.modo || !RW.extrajornadaDados) return;
      function aplicar() {
        var config = modo === 'grupo'
          ? { modo: 'grupo', total: totalDoMes(), termos: termosAlterados() }
          : { modo: 'por_unidade', totais: {}, termos: termosAlterados() };
        var req = ++cargaSeq;
        RW.extrajornadaDados.carregarCotas(iso(comp), config).then(function (r) {
          if (!r || !r.ok || !ativo() || req !== cargaSeq) return;
          aplicarResposta(r, 'sugestao');
          desenhar();
        });
      }
      RW.confirmar({
        tipo: 'aviso', mensagem: RW.mensagens.extrajornada.escopoTrocar,
        textoConfirmar: RW.mensagens.botoes.continuar, textoCancelar: RW.mensagens.botoes.cancelar,
        aoConfirmar: aplicar,
        aoCancelar: function () { if (lista()) lista().atualizarNumeros(estado, el); }   // devolve a bolinha ao modo atual
      });
    },
    lista: function (nome) { estado.lista = nome; desenhar(); },
    /* o rodapé do painel do militar: as mesmas ações do rodapé da tabela */
    cancelar: function () { carregar(); },
    salvar: function () { salvar(); },
    atualizarRodape: function () { atualizarRodape(); },
    abrir: function (cpf) { estado.selecionado = cpf; if (lista()) lista().abrirPainel(estado, comp, acoes); },
    fechou: function () { estado.selecionado = null; if (lista()) lista().marcarSelecionado(estado, el); }
  };

  function usarSugestao() {
    estado.vols.forEach(function (v) { v.concedido = v.termo ? v.sugerido : 0; });
    desenhar();
  }

  function salvar() {
    if (!RW.extrajornadaDados || !el.salvar) return;
    if (estourado()) { RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.cotaEstourada }); return; }
    RW.iniciarCarregando(el.salvar);
    var aloc = estado.vols.map(function (v) { return { cpf: v.cpf, cotas: v.concedido }; });
    RW.extrajornadaDados.salvarCotas({ competencia: iso(comp), config: montarConfig(), alocacoes: aloc }).then(function (r) {
      RW.pararCarregando(el.salvar);
      if (r && r.success) {
        limpo = retrato();   // o que está na tela é o salvo; a recarga confirma
        carregar();
        if (RW.extrajornadaEscala && RW.extrajornadaEscala.recarregar) RW.extrajornadaEscala.recarregar();   // cotas e termos mudam os candidatos da grade
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });
        else RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.extrajornada.semCotasMudanca });
      } else if (r && r.cota_estourada) {
        RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.cotaEstourada });
      } else if (r && r.cota_menor) {
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.extrajornada.cotaMenor });
      } else {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.extrajornada.falhaSalvar });
      }
    }, function () {
      RW.pararCarregando(el.salvar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao });
    });
  }

  /* ---------- página ---------- */

  function montar(cont) {
    conteudo = cont;
    estado = vazio();
    limpo = null;
    el.aba = cont.querySelector('[data-aba-painel="voluntarios"]');
    el.lista = cont.querySelector('#extra-vol-lista');
    el.filtro = cont.querySelector('#extra-vol-filtro');
    el.busca = cont.querySelector('#extra-vol-busca');
    el.selo = cont.querySelector('#extra-vol-prazo');
    el.total = cont.querySelector('#extra-vol-total');
    el.totalCampo = cont.querySelector('#extra-vol-total-campo');
    el.totalLeitura = cont.querySelector('#extra-vol-total-leitura');
    el.totalValor = cont.querySelector('#extra-vol-total-valor');
    el.escopo = cont.querySelector('#extra-vol-escopo');
    el.escopoValor = cont.querySelector('#extra-vol-escopo-valor');
    el.repartidas = cont.querySelector('#extra-vol-repartidas');
    el.restam = cont.querySelector('#extra-vol-restam');
    el.naEscala = cont.querySelector('#extra-vol-na-escala');
    el.sugestao = cont.querySelector('#extra-vol-sugestao');
    el.rodape = cont.querySelector('#extra-vol-rodape');
    el.mudancas = cont.querySelector('#extra-vol-mudancas');
    el.salvar = cont.querySelector('#extra-vol-salvar');
    el.cancelar = cont.querySelector('#extra-vol-cancelar');

    if (el.aba) el.aba.classList.add(admin() ? 'extra-vol--admin' : 'extra-vol--comum');
    if (admin()) {
      if (el.total) el.total.addEventListener('input', function () {
        var v = el.total.value.replace(/\D/g, '');
        if (v !== el.total.value) el.total.value = v;
        acoes.total(null, v);
      });
      if (el.escopo) el.escopo.addEventListener('change', function (ev) {
        var m = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-modo');
        if (m) acoes.escopo(m);
      });
      if (el.sugestao) el.sugestao.addEventListener('click', usarSugestao);
      if (el.salvar) el.salvar.addEventListener('click', salvar);
      if (el.cancelar) el.cancelar.addEventListener('click', carregar);
      if (el.filtro && RW.abas) RW.abas.ligar(el.filtro, function (aba) { acoes.lista(aba.getAttribute('data-lista')); });
    }
    if (lista()) lista().montar(cont, el);

    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return ativo() && sujo(); });
      guardaLigada = true;
    }
  }

  function ativar() {
    naAba = true;
    if (el.filtro) el.filtro.classList.toggle('oculto', !admin());
    if (el.busca) el.busca.classList.remove('oculto');
    var m = RW.extrajornadaMes.obter();
    comp = new Date(m.getFullYear(), m.getMonth(), 1);
    carregar();
    atualizarSelo();
  }
  function desativar() {
    naAba = false;
    if (el.filtro) el.filtro.classList.add('oculto');
    if (el.busca) el.busca.classList.add('oculto');
    if (el.selo) el.selo.classList.add('oculto');
    if (lista()) lista().sair(estado, el);
  }
  /* o orquestrador trocou o mês */
  function renderMes() {
    var m = RW.extrajornadaMes.obter();
    comp = new Date(m.getFullYear(), m.getMonth(), 1);
    estado.vols = [];
    carregar();
    atualizarSelo();
  }
  /* descartar ao sair da aba: na volta, ativar() recarrega do banco */
  function descartar() { limpo = retrato(); atualizarRodape(); }

  RW.extrajornadaVoluntarios = { montar: montar, ativar: ativar, desativar: desativar, renderMes: renderMes,
    estaSujo: function () { return ativo() && sujo(); }, descartar: descartar };
})();
