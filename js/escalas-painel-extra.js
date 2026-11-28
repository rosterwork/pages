/* ============================================================
   ESCALAS — painel do dia › aba EXTRAJORNADA
   O mesmo painel dos Ajustes (extrajornada-dia.js), para o mês já
   lançado: quem está no dia, quem quer, quem não quer e quem não pode.
   Mês não lançado: só a mensagem. Unidade de fora da companhia de quem
   entrou: a frase. O rascunho é do mês (extrajornada-grade.js): trocar de
   dia e fechar o painel não perdem nada, e os dias mudados levam a borda tracejada. O
   Salvar é o rodapé largo da página, junto com o Dia e o Ciclo
   (escalas-painel-salvar.js, p_extra do escala_painel_salvar). A
   célula da grade, com o painel fechado, usa o mesmo mês e o mesmo
   rascunho (escalas-celula-extra.js: carregar, pronto, lido, sabido,
   usarNaCelula). O mês vem só da cópia guardada, como a grade e a
   página Extrajornada (a leitura nunca refaz a conta): o dia que mudou
   há pouco vem da versão de antes, com a nota amarela na aba, e o mês é
   lido de novo quando a cópia dele fica pronta (esquecer).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.escalasPainelExtra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var mes = null;      // a resposta do extrajornada_mes do mês aberto
  var refeitos = {};   // os dias do mês lido que ficaram prontos depois da leitura ({ 'AAAA-MM-DD': true }): ele é lido de novo
  var ctx = null;      // a aba aberta: { corpo, uid, iso, pronto (o mês já foi desenhado nela) }
  var pedido = 0;      // latest-wins
  var lendo = null;    // a leitura da célula em curso: { comp, promessa }
  var onde = null;     // o dia da célula que mexe na extra, com a aba fechada: { unidadeId, iso, unidadeNome }
  /* por mês, o que decide se a extra do pelotão se mexe nele, sem ler de novo (fica depois do Salvar e do Cancelar):
     { 'AAAA-MM-01': { lancada, admin, unidades } } */
  var sabidos = {};

  function msg() { return RW.mensagens.extrajornada.org; }
  function G() { return RW.extrajornadaGrade; }
  function lancada() { return !!mes && !!mes.lancamento && !mes.lancamento.reaberto; }
  function sujo() { return lancada() && G().alteracoes().length > 0; }
  function velho() { return Object.keys(refeitos).length > 0; }

  function frase(corpo, texto) {
    corpo.textContent = '';
    var e = RW.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = texto; corpo.appendChild(e); }
  }

  /* o mês lido na aba: o painel do dia, ou a mensagem */
  function mostrar() {
    if (!ctx) return;
    ctx.pronto = true;
    nota();
    var corpo = ctx.corpo;
    if (mes.admin === false || !mes.unidades.some(function (un) { return un.id === ctx.uid; })) { frase(corpo, msg().outraCompanhia); return; }
    if (!lancada()) {
      corpo.textContent = '';
      var caixa = RW.tpl('tpl-extrajornada-painel-nao-lancada');
      caixa.querySelector('.extrajornada-painel-nao-lancada-mes').textContent = G().nomeDoMes(mes.competencia);
      corpo.appendChild(caixa);
      return;
    }
    RW.extrajornadaDia.mostrarEm(ctx.uid, ctx.iso);
  }

  /* os números do dia da aba vêm da cópia de antes? O dia ainda vai mudar em alguma unidade da companhia (na fila,
     esperando a cópia ou salvo há pouco: escalas-atualizando.js), ou ficou pronto e o mês ainda não foi lido de novo */
  function atrasado() {
    if (refeitos[ctx.iso]) return true;
    var at = RW.escalaAtualizando;
    return !!at && (mes.unidades || []).some(function (un) {
      return at.pendente(un.id, ctx.iso) || at.soCopia(un.id, ctx.iso) || at.certo(un.id, ctx.iso);
    });
  }

  /* a nota amarela da aba enquanto o dia vem da cópia de antes, entre o subcabeçalho e o corpo: o molde e o lugar da nota
     do dia só para consulta (escalas-painel.js › notaConsulta, que também a tira ao trocar de aba ou de dia) */
  function nota() {
    var corpo = ctx && ctx.corpo;
    if (!corpo || !corpo.parentNode || !mes) return;
    var atual = corpo.parentNode.querySelector('.painel-nota-consulta');
    var mostra = lancada() && mes.admin !== false && mes.unidades.some(function (un) { return un.id === ctx.uid; }) && atrasado();
    if (atual && !mostra) atual.remove();
    if (atual || !mostra) return;
    var n = RW.tpl('tpl-nota-atualizando');
    if (!n) return;
    n.classList.add('painel-nota-consulta');
    n.querySelector('.nota-texto').textContent = RW.mensagens.escala.extraAtualizando;
    corpo.parentNode.insertBefore(n, corpo);
  }

  /* o rascunho mudou: o painel e a caixa da célula na hora, e o rodapé e as telas pelo aviso dos rascunhos
     (escalas-painel-salvar.js) */
  function aoMudar() {
    G().calcularPicos(G().efetivas());
    RW.extrajornadaDia.redesenhar();
    if (RW.extrajornadaCelula) RW.extrajornadaCelula.redesenhar();
    window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho'));
  }

  /* o que a leitura do mês pede: só a cópia guardada, como a grade e a página Extrajornada (o dia que mudou há pouco vem
     da versão de antes). O modo treino não pede a cópia (escalas-dados.js › carregar) */
  function corpoDoMes(comp) {
    var corpo = { p_competencia: comp };
    if (!(RW.treino && RW.treino.ligado())) corpo.p_aceita_copia = true;
    return corpo;
  }

  /* o mês lido: o rascunho dele começa vazio, e o que decide a extra do pelotão nele fica guardado */
  function usarMes(r) {
    mes = r;
    refeitos = {};
    sabidos[r.competencia] = { lancada: lancada(), admin: r.admin !== false,
      unidades: (r.unidades || []).map(function (un) { return un.id; }) };
    RW.extrajornadaUtil.usar(r);
    G().iniciar(r, 'ajustes', aoMudar);
    G().limpar();
    G().escalaDoMes();
    G().calcularPicos(G().efetivas());
  }

  /* a célula da grade (o painel fechado): o mês do dia, lido uma vez (o já lido fica, com ou sem mudança; sem mudança, é
     lido de novo quando um dia dele ficou pronto depois da leitura). A Promise diz se ele está aqui (false: a leitura
     falhou, ou há mudança não salva em outro mês) */
  function carregar(iso) {
    var comp = iso.slice(0, 8) + '01';
    if (mes && mes.competencia === comp && (sujo() || !velho())) return Promise.resolve(true);
    if (sujo()) return Promise.resolve(false);
    if (lendo && lendo.comp === comp) return lendo.promessa;
    var p = RW.extrajornadaUtil.chamar('extrajornada_mes', corpoDoMes(comp)).then(function (r) {
      if (lendo && lendo.promessa === p) lendo = null;
      if (!r || !r.ok || sujo()) return false;
      usarMes(r);
      return true;
    }, function () { if (lendo && lendo.promessa === p) lendo = null; return false; });
    lendo = { comp: comp, promessa: p };
    return p;
  }

  /* a conferência dos dias que ainda vão mudar (escalas-atualizando.js › receberDias), com os que ficaram prontos
     ('unidade|AAAA-MM-DD'): o dia do mês lido que ficou pronto faz o mês ser lido de novo (da cópia, já certa), na próxima
     leitura da célula ou, com a aba aberta e já desenhada, agora; com mudança não salva, o mês fica (o Salvar e o
     Cancelar leem de novo). A nota da aba segue o dia */
  function esquecer(prontos) {
    if (!mes) return;
    (prontos || []).forEach(function (k) {
      var dia = k.split('|')[1] || '';
      if (dia.slice(0, 8) + '01' === mes.competencia) refeitos[dia] = true;
    });
    if (!ctx || !ctx.pronto) return;
    if (velho() && !sujo()) reler(); else nota();
  }

  /* a aba aberta lê o mês de novo sem tirar o que está na tela (o que já está nela fica até o novo chegar); com o cursor
     num campo da aba, espera ele sair. Uma releitura por vez; sem a leitura, fica como está e a próxima conferência tenta
     de novo. Outra aba, outro dia ou o painel fechado (montar e reset) cancelam */
  function reler() {
    var c = ctx, meu = pedido;
    if (c.relendo) return;
    c.relendo = true;
    function vale() { return meu === pedido && ctx === c && !sujo(); }
    (function tentar() {
      if (!vale()) { c.relendo = false; return; }
      var foco = document.activeElement;
      if (foco && c.corpo.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) { setTimeout(tentar, 2000); return; }
      RW.extrajornadaUtil.chamar('extrajornada_mes', corpoDoMes(c.iso.slice(0, 8) + '01')).then(function (r) {
        c.relendo = false;
        if (!vale() || !r || !r.ok) return;
        usarMes(r);
        var a = RW.extrajornadaDia.aberto();
        if (lancada() && a && a.uid === c.uid && a.data === c.iso) RW.extrajornadaDia.redesenhar(); else mostrar();
        nota();
      }, function () { c.relendo = false; });
    })();
  }

  function montar(corpo, rodape, unidadeId, iso) {
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    var comp = iso.slice(0, 8) + '01';
    ctx = { corpo: corpo, uid: +unidadeId, iso: iso, pronto: false };
    /* com mudança não salva, o mês já lido fica (o rascunho é do mês) */
    if (sujo()) {
      if (mes.competencia === comp) mostrar();
      else frase(corpo, msg().salvarOutroMes(G().nomeDoMes(mes.competencia)));
      return;
    }
    corpo.textContent = '';
    var c = RW.painel.criarCarregando();
    if (c) corpo.appendChild(c);
    var meu = ++pedido;
    RW.painel.segurar(RW.extrajornadaUtil.chamar('extrajornada_mes', corpoDoMes(comp))).then(function (r) {
      if (meu !== pedido || !ctx) return;
      if (r && r.error) { frase(corpo, r.error); return; }
      if (!r || !r.ok) { falhou(); return; }
      usarMes(r);
      mostrar();
    }, function () { if (meu === pedido && ctx) falhou(); });
    /* a leitura que não veio: o aviso com o Tentar de novo (geral-falha.js), que lê o mês de novo */
    function falhou() {
      corpo.textContent = '';
      var aviso = RW.falha.bloco(msg().falhaMes, function () { montar(corpo, rodape, unidadeId, iso); });
      if (aviso) corpo.appendChild(aviso);
    }
  }

  /* a aba saiu da tela (o rascunho fica até o Salvar). Com mudança, o dia dela fica para o rodapé largo, como o da célula
     (o painel fechado: a conta, o Desfazer e o Salvar continuam) */
  function reset() {
    if (ctx && sujo()) onde = { unidadeId: ctx.uid, iso: ctx.iso, unidadeNome: '' };
    ctx = null;
    pedido++;
    if (RW.extrajornadaDia) RW.extrajornadaDia.soltar();
  }

  /* o rascunho vazio; o mês é lido de novo na próxima vez que a aba abrir */
  function descartar() {
    if (mes) G().limpar();
    mes = null;
    refeitos = {};
    onde = null;
    if (RW.extrajornadaDia) RW.extrajornadaDia.reorganizar();
  }

  function mudancas() { return G().alteracoes().map(function (k) { return G().rascunho()[k]; }); }

  /* fechar ou recarregar o navegador, ou ir para outra página, com o rascunho: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(sujo);

  RW.escalasPainelExtra = {
    montar: montar,
    reset: reset,
    descartar: descartar,
    sujo: sujo,
    contar: function () { return sujo() ? G().alteracoes().length : 0; },
    /* o primeiro que passou da cota no rascunho: { nome, n } (o Salvar espera), ou null */
    passou: function () {
      var m = sujo() ? G().passaram()[0] : null;
      return m ? { nome: (m.grad + ' ' + m.nome).trim(), n: G().usadas(m.cpf) - m.concedidas } : null;
    },
    /* a célula da grade: o mês do dia, se a extra do pelotão se mexe nele (lançado e da companhia de quem entrou), e o
       dia dela para o rodapé; com a aba fechada e mudança na extra, o dia do rodapé é esse (escalas-painel-salvar.js) */
    carregar: carregar,
    esquecer: esquecer,
    pronto: function (uid, iso) {
      return !!mes && mes.competencia === iso.slice(0, 8) + '01' && lancada() && mes.admin !== false
        && mes.unidades.some(function (un) { return un.id === +uid; });
    },
    /* o mês do dia já está lido? */
    lido: function (iso) { return !!mes && mes.competencia === iso.slice(0, 8) + '01'; },
    /* a extra do pelotão se mexe no dia, pelo que ficou guardado do mês, sem ler: true, false ou null (nunca lido). Com
       mudança não salva em outro mês, não (o carregar recusa) */
    sabido: function (uid, iso) {
      var comp = iso.slice(0, 8) + '01', s = sabidos[comp];
      if (sujo() && mes.competencia !== comp) return false;
      if (!s) return null;
      return s.lancada && s.admin && s.unidades.indexOf(+uid) >= 0;
    },
    usarNaCelula: function (d) { onde = { unidadeId: d.unidadeId, iso: d.iso, unidadeNome: d.unidadeNome || '' }; },
    naCelula: function () { return !ctx && onde && sujo() ? { unidadeId: onde.unidadeId, iso: onde.iso, secao: 'extra', unidadeNome: onde.unidadeNome } : null; },
    /* o Desfazer e o Refazer do rodapé largo (escalas-painel-salvar.js): um passo do rascunho do mês, e o painel refeito
       como numa mudança (na aba, ou na célula que mexeu na extra) */
    podeDesfazer: function () { return (!!ctx || !!onde) && lancada() && G().podeDesfazer(); },
    podeRefazer: function () { return (!!ctx || !!onde) && lancada() && G().podeRefazer(); },
    desfazer: function () { if (G().desfazer()) { RW.extrajornadaDia.reorganizar(); aoMudar(); } },
    refazer: function () { if (G().refazer()) { RW.extrajornadaDia.reorganizar(); aoMudar(); } },
    /* o que o Salvar leva (null sem mudança; o banco aceita o ajuste sem motivo) */
    envio: function () {
      return sujo() ? { competencia: mes.competencia, mudancas: mudancas(), motivo: null } : null;
    },
    /* o que as telas mostram: a prévia não leva quem passou da cota, que o banco recusaria. No mês de treino, o mês é de
       exemplo e o banco não o conhece: as telas ficam como estão, só com a borda tracejada */
    paraPrevia: function () {
      if (!mes || (RW.treinoExtra && RW.treinoExtra.mes() && RW.treinoExtra.ehDoTreino(mes.competencia))) return null;
      return sujo() && !G().passaram().length ? { competencia: mes.competencia, mudancas: mudancas(), motivo: null } : null;
    },
    /* o rascunho inteiro, para saber se ele mudou */
    marca: function () { return sujo() ? JSON.stringify(mudancas()) : ''; },
    /* a borda tracejada; sem a unidade (null), em qualquer unidade (a Minha escala) */
    marcado: function (unidadeId, iso) {
      if (!sujo()) return false;
      var marcados = G().naoSalvos();
      if (unidadeId != null) return !!marcados[+unidadeId + '|' + iso];
      return Object.keys(marcados).some(function (k) { return k.split('|')[1] === iso; });
    }
  };
})();
