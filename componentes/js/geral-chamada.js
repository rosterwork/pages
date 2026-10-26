/* ============================================================
   COMPONENTE geral-chamada — a faixa "Esperando a sua resposta"
   Acima do título de todas as páginas, o que espera quem está
   logado, lido do pendencias_listar leve que o sino já lê (o
   index-avisos.js chama definir(grupos)): cada grupo que entra traz
   a `faixa` do banco (quantos, a data mais próxima, os dias até
   ela e se é urgente; no do militar, o primeiro pedido visto por
   ele). Duas linhas no máximo:
     · a do militar: o assunto mais urgente entre a troca para
       responder (Ver detalhes · Recusar · Aceitar), o prazo da
       extra (Responder) e o aceite que falta (Ver detalhes ·
       Aceitar; sempre amarelo, a troca já vale), com o Ver todos
       quando há mais de um pedido
     · a do administrador (ADM): os pedidos urgentes para aprovar
       e o Ver pedidos (Pendências › Administração)
   A faixa fica vermelha quando há urgente. O X oculta até trocar
   de página ou recarregar e ela volta na hora se chegar pedido
   novo ou algum ficar urgente (nada fica guardado no navegador).
   O roteador chama porNaPagina a cada página: trocar de página só
   redesenha, sem ler o banco. Os botões usam as ações do painel da
   troca (a mesma confirmação e o mesmo resumo); os painéis carregam
   no primeiro clique (RosterWork.carregarPecas). Enquanto o painel
   mostra o pedido aberto pela faixa, a faixa não o repete.
   API: RosterWork.chamada.definir(grupos) · porNaPagina()
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* os assuntos do militar, na ordem de importância entre os de mesma urgência, e o ícone de cada um */
  var ORDEM = { troca: 0, extra_prazo: 1, troca_aceite: 2 };
  var ICONE = { troca: 'icone-trocas', troca_aceite: 'icone-trocas', extra_prazo: 'icone-extrajornada' };

  var grupos = [];       // a última leitura leve (a do sino)
  var oculta = false;    // o X: some até trocar de página ou recarregar
  var antes = null;      // o que a faixa mostrava quando foi ocultada
  var noPainel = null;   // o registro que a faixa abriu no painel (não se repete enquanto ele estiver lá)

  function M() { return RW.mensagens; }
  function nome(grau, n) { return ((grau || '') + ' ' + (n || '')).trim(); }
  function ir(pagina, aba, referencia) { if (RW.irParaPagina) RW.irParaPagina(pagina, aba || null, referencia); }

  /* "2026-10-29" → "29/10 (qui)" */
  function dia(iso) { return RW.data.comDiaCurto(iso).replace(/\/\d{4}/, ''); }

  /* o horário só quando é parte do serviço */
  function trecho(hi, hf) {
    var a = String(hi || '').slice(0, 5), b = String(hf || '').slice(0, 5);
    return a && b && a !== b ? M().pendencias.trechoHoras(RW.horario.curta(a), RW.horario.curta(b)) : '';
  }

  /* o selo do prazo: Hoje, Amanhã ou Faltam N dias */
  function textoDias(n) {
    var c = M().chamada;
    return n <= 0 ? c.hoje : (n === 1 ? c.amanha : c.faltam(n));
  }

  /* ---------- o que entra ---------- */

  function daFaixa(g) { return g.minha && g.faixa && ORDEM.hasOwnProperty(g.tipo); }
  /* a troca para responder conta a urgência do banco; o prazo da extra só chega perto de fechar; o aceite que
     falta nunca é urgente (a troca já vale) */
  function urgente(g) { return g.tipo === 'extra_prazo' || (g.tipo === 'troca' && !!g.faixa.urgente); }

  /* a linha do militar: o assunto mais urgente (fora o que está aberto no painel pela faixa) */
  function linhaDoMilitar() {
    var candidatos = grupos.filter(function (g) {
      return daFaixa(g) && !(noPainel && g.faixa.primeiro && g.faixa.primeiro.registro_id === noPainel);
    });
    if (!candidatos.length) return null;
    candidatos.sort(function (a, b) {
      return (urgente(b) - urgente(a)) || (ORDEM[a.tipo] - ORDEM[b.tipo]) || ((Number(a.faixa.dias) || 0) - (Number(b.faixa.dias) || 0));
    });
    var total = grupos.filter(daFaixa).reduce(function (s, g) { return s + (Number(g.faixa.quantos) || 0); }, 0);
    return { grupo: candidatos[0], urgente: urgente(candidatos[0]), total: total };
  }

  /* a linha do administrador: os pedidos urgentes para aprovar (o banco só manda a faixa com urgente) */
  function linhaDoAdministrador() {
    var deAdmin = grupos.filter(function (g) { return !g.minha && g.faixa && Number(g.faixa.quantos) > 0; });
    if (!deAdmin.length) return null;
    var quantos = 0, maisPerto = null;
    deAdmin.forEach(function (g) {
      quantos += Number(g.faixa.quantos) || 0;
      if (!maisPerto || Number(g.faixa.dias) < Number(maisPerto.dias)) maisPerto = g.faixa;
    });
    return { quantos: quantos, data: maisPerto.data, dias: Number(maisPerto.dias) || 0 };
  }

  /* o que a faixa mostra, resumido: depois do X, um pedido novo, mais pedidos ou um urgente novo a trazem de volta */
  function retrato(mil, adm) {
    return {
      chaves: mil ? [mil.grupo.tipo + ':' + ((mil.grupo.faixa.primeiro || {}).registro_id || '')] : [],
      total: (mil ? mil.total : 0) + (adm ? adm.quantos : 0),
      urgente: !!((mil && mil.urgente) || adm)
    };
  }
  function trazDeVolta(agora) {
    if (!antes) return false;
    return agora.total > antes.total || (agora.urgente && !antes.urgente)
      || agora.chaves.some(function (c) { return antes.chaves.indexOf(c) < 0; });
  }

  /* ---------- as ações ---------- */

  /* o contexto das ações do painel da troca: depois de decidir, o sino relê (e a faixa com ele) */
  function contexto(f) {
    var admin = RW.sessao.temPapel('pelotao');
    return {
      cpf: RW.sessao.cpf(), ehAdmin: admin, admin: admin, decidir: false,
      aoMudar: function () { if (RW.avisosSino) RW.avisosSino.recarregar(); },
      aoFechar: function () { if (noPainel !== f.registro_id) return; noPainel = null; desenhar(); }
    };
  }

  /* o pedido mudou enquanto a faixa estava na tela: avisa e relê */
  function naoAchou() {
    if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: M().chamada.naoAchou });
    if (RW.avisosSino) RW.avisosSino.recarregar();
  }

  /* a troca do pedido (a lista de trocas, com os aceites) e a ação; os painéis da troca carregam no primeiro clique */
  function comTroca(g, botao, acao) {
    var f = g.faixa.primeiro || {};
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    var pecas = RW.carregarPecas ? RW.carregarPecas('pendencias') : Promise.resolve();
    pecas.then(function () { return RW.trocasDados.listar([]); }).then(function (todas) {
      if (RW.pararCarregando) RW.pararCarregando(botao);
      var t = (Array.isArray(todas) ? todas : []).filter(function (x) { return x.troca_id === f.troca_id; })[0];
      if (!t || !RW.trocasPainel) { naoAchou(); return; }
      var ctx = contexto(f);
      if (acao === 'detalhes' || acao === 'recusar') {
        noPainel = f.registro_id;
        desenhar();
        RW.trocasPainel.abrir(t, ctx);
        /* o Recusar abre o painel já no passo da recusa (o motivo opcional) */
        if (acao === 'recusar') RW.trocasPainel.acao('recusar', t, ctx);
        return;
      }
      RW.trocasPainel.acao(acao, t, ctx, botao);
    }).catch(function () {
      if (RW.pararCarregando) RW.pararCarregando(botao);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().geral.semConexao });
    });
  }

  /* ---------- o desenho ---------- */

  function mostrarBotao(linha, qual, aoClicar) {
    var b = linha.querySelector('[data-chamada="' + qual + '"]');
    b.classList.remove('oculto');
    b.addEventListener('click', function () { aoClicar(b); });
  }

  /* "você tira o serviço em 29/10 (qui) e a devolução é em 08/11 (dom)", com o horário quando é parte do serviço */
  function textoDaTroca(f) {
    var c = M().chamada;
    if (f.voce_tira) {
      var parte = trecho(f.voce_tira_inicio, f.voce_tira_fim);
      /* com o horário, a vírgula separa a devolução */
      return c.voceTira(dia(f.voce_tira), parte)
        + (f.ele_tira ? (parte ? ',' : '') + c.devolucao(dia(f.ele_tira), trecho(f.ele_tira_inicio, f.ele_tira_fim)) : '');
    }
    return f.ele_tira ? c.servicoEm(dia(f.ele_tira), trecho(f.ele_tira_inicio, f.ele_tira_fim)) : '';
  }

  function montarLinhaMilitar(mil) {
    var g = mil.grupo, f = g.faixa.primeiro || {}, c = M().chamada, p = M().pendencias;
    var linha = RW.tpl('tpl-chamada-linha');
    if (!linha) return null;
    linha.querySelector('.chamada-marca use').setAttribute('href', 'icones/todos.svg#' + ICONE[g.tipo]);
    var quem = nome(f.quem_grau, f.quem_nome);
    var texto, meta, selo = null;
    if (g.tipo === 'extra_prazo') {
      texto = g.texto || '';
      meta = g.mensagem || '';
      mostrarBotao(linha, 'responder', function () { ir(g.pagina, g.aba, g.referencia); });
    } else {
      meta = f.varias ? c.varias(Number(f.servicos) || 1, dia(g.faixa.data)) : textoDaTroca(f);
      if (g.tipo === 'troca_aceite') {
        texto = f.varias ? c.aceitarVarias(quem) : p.trocaAceitar(quem);
        selo = { texto: p.faltaAceitar, classe: 'selo--alerta' };
      } else {
        texto = f.alteracao ? p.trocaMinhaAlteracao(quem) : (f.varias ? M().trocas.varias.filaMinha(quem) : p.trocaMinha(quem));
        selo = { texto: textoDias(Number(g.faixa.dias) || 0), classe: mil.urgente ? 'selo--erro' : 'selo--alerta' };
      }
      mostrarBotao(linha, 'detalhes', function (b) { comTroca(g, b, 'detalhes'); });
      if (g.tipo === 'troca') mostrarBotao(linha, 'recusar', function (b) { comTroca(g, b, 'recusar'); });
      mostrarBotao(linha, 'aceitar', function (b) { comTroca(g, b, g.tipo === 'troca_aceite' ? 'aceitar-depois' : 'aceitar'); });
    }
    linha.querySelector('.chamada-quem').textContent = texto;
    linha.querySelector('.chamada-meta').textContent = meta ? ' · ' + meta : '';
    if (selo) {
      var s = linha.querySelector('.chamada-selo');
      s.textContent = selo.texto;
      s.classList.add(selo.classe);
      s.classList.remove('oculto');
    }
    if (mil.total > 1) {
      var todos = linha.querySelector('.chamada-todos');
      todos.querySelector('.chamada-todos-total').textContent = String(mil.total);
      todos.classList.remove('oculto');
      todos.addEventListener('click', function () { ir('pendencias', 'paramim'); });
    }
    return linha;
  }

  function montarLinhaAdministrador(adm) {
    var c = M().chamada;
    var linha = RW.tpl('tpl-chamada-linha-adm');
    if (!linha) return null;
    linha.querySelector('.chamada-quem').textContent = c.admPedidos(adm.quantos);
    linha.querySelector('.chamada-meta').textContent = ' · ' + c.admMeta(dia(adm.data));
    linha.querySelector('.chamada-selo').textContent = textoDias(adm.dias);
    linha.querySelector('[data-chamada="pedidos"]').addEventListener('click', function () { ir('pendencias', 'administracao'); });
    return linha;
  }

  /* põe a faixa como o primeiro elemento da página (o topo do celular a leva junto com o título) */
  function desenhar() {
    var velha = document.querySelector('.conteudo > .pagina > .chamada');
    if (velha) velha.parentNode.removeChild(velha);
    var mil = linhaDoMilitar(), adm = linhaDoAdministrador();
    var agora = retrato(mil, adm);
    if (oculta && trazDeVolta(agora)) { oculta = false; antes = null; }
    var pagina = document.querySelector('.conteudo > .pagina');
    if (oculta || !pagina || (!mil && !adm)) return;
    var faixa = RW.tpl('tpl-chamada');
    if (!faixa) return;
    var fechar = faixa.querySelector('.chamada-fechar');
    [mil ? montarLinhaMilitar(mil) : null, adm ? montarLinhaAdministrador(adm) : null].forEach(function (l) {
      if (l) faixa.insertBefore(l, fechar);
    });
    faixa.classList.toggle('chamada--urgente', agora.urgente);
    fechar.addEventListener('click', function () { oculta = true; antes = agora; desenhar(); });
    pagina.insertBefore(faixa, pagina.firstChild);
  }

  /* a leitura nova do sino */
  function definir(novos) {
    grupos = Array.isArray(novos) ? novos : [];
    desenhar();
  }

  /* a página nova: a faixa volta (o X valia até trocar de página) */
  function porNaPagina() {
    oculta = false;
    antes = null;
    noPainel = null;
    desenhar();
  }

  RW.chamada = { definir: definir, porNaPagina: porNaPagina };
})();
