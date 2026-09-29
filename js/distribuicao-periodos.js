/* ============================================================
   DISTRIBUIÇÃO — períodos dos modelos (seletor ‹ período ›)
   Cada mudança de posto com data abre um período (banco:
   dist_listar_periodos). O seletor fica no subcabeçalho da aba
   Modelos, igual ao da Escala: as setas passam de período e o nome
   abre a lista, com a situação de cada um (mesmos ícones do status
   dos modelos) e o motivo; os que já passaram ficam em "Anteriores".
   A lista, o Ver, o Editar e o Salvar seguem o período escolhido.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var periodos = [];       /* retorno de dist_listar_periodos, do mais antigo ao mais novo */
  var escolhido = null;    /* período na tela */
  var contexto = null;     /* grupo (CIA/CIBM) dos períodos carregados */
  var aoTrocar = null;     /* recarrega os modelos no período escolhido */
  var seq = 0;             /* token: ignora a resposta antiga ao trocar de grupo rápido */

  function hojeIso() {
    var d = new Date();
    var mes = String(d.getMonth() + 1); if (mes.length < 2) mes = '0' + mes;
    var dia = String(d.getDate()); if (dia.length < 2) dia = '0' + dia;
    return d.getFullYear() + '-' + mes + '-' + dia;
  }
  function br(iso) { return RosterWork.data.isoParaBR(iso); }

  /* um dia dentro do período: é o que as leituras e o salvar recebem (sem período: hoje, no banco) */
  function diaDo(p) {
    if (!p) return null;
    if (p.inicio) return p.inicio;
    var hoje = hojeIso();
    return (p.fim && p.fim < hoje) ? p.fim : hoje;
  }

  /* "03/10/2026 a 05/10/2026", "até 02/10/2026", "a partir de 06/10/2026" ou "Todos os dias" */
  function rotulo(p) {
    var M = RosterWork.mensagens.distribuicao;
    if (!p || (!p.inicio && !p.fim)) return M.periodoTodos;
    if (!p.inicio) return M.periodoAte.replace('{data}', br(p.fim));
    if (!p.fim) return M.periodoDesde.replace('{data}', br(p.inicio));
    return M.periodoIntervalo.replace('{inicio}', br(p.inicio)).replace('{fim}', br(p.fim));
  }

  /* o período dentro de uma frase: "de 07/10/2026 a 13/10/2026" ou "a partir de 07/10/2026" */
  function textoNaFrase(p) {
    var M = RosterWork.mensagens.distribuicao;
    if (!p.inicio) return M.periodoAte.replace('{data}', br(p.fim));
    if (!p.fim) return M.periodoDesde.replace('{data}', br(p.inicio));
    return M.periodoIntervaloFrase.replace('{inicio}', br(p.inicio)).replace('{fim}', br(p.fim));
  }

  function mesmo(a, b) { return !!a && !!b && (a.inicio || '') === (b.inicio || ''); }
  function posicao() {
    for (var i = 0; i < periodos.length; i++) { if (mesmo(periodos[i], escolhido)) return i; }
    return -1;
  }

  /* situação do período com os ícones do status dos modelos (check verde / alerta amarelo ou vermelho) */
  function pintarSituacao(el, nivel) {
    if (!nivel || nivel === 'ok') return;
    var st = el.querySelector('.distribuicao-modelo-status');
    el.querySelector('.distribuicao-modelo-ok').classList.add('oculto');
    el.querySelector('.distribuicao-modelo-erro').classList.remove('oculto');
    if (st) st.classList.add(nivel === 'erro' ? 'distribuicao-modelo-status--erro' : 'distribuicao-modelo-status--alerta');
  }

  function montarItem(p) {
    var el = RosterWork.tpl('tpl-distribuicao-periodo-item');
    pintarSituacao(el, p.nivel);
    el.querySelector('.distribuicao-periodo-datas').textContent = rotulo(p);
    var motivo = el.querySelector('.distribuicao-periodo-motivo');
    if (p.motivo) motivo.textContent = p.motivo; else motivo.classList.add('oculto');
    if (mesmo(p, escolhido)) el.classList.add('dropdown-item--ativo');
    el.addEventListener('click', function () { escolher(p); });
    return el;
  }

  /* a lista do seletor: "Anteriores" (fechado, a menos que o período na tela seja um deles) + os vigentes */
  function montarLista() {
    var lista = document.getElementById('distribuicao-periodo-lista');
    if (!lista) return;
    lista.textContent = '';
    var passados = periodos.filter(function (p) { return p.passado; });
    var vigentes = periodos.filter(function (p) { return !p.passado; });
    if (passados.length) {
      /* componente compartilhado geral-anteriores */
      var itens = passados.map(montarItem);
      var grupo = RosterWork.anteriores.montar(itens, passados.some(function (p) { return mesmo(p, escolhido); }));
      if (grupo) lista.appendChild(grupo);
      itens.forEach(function (el) { lista.appendChild(el); });
    }
    vigentes.forEach(function (p) { lista.appendChild(montarItem(p)); });
  }

  function montarSeletor() {
    var nome = document.getElementById('distribuicao-periodo-nome');
    var anterior = document.getElementById('distribuicao-periodo-anterior');
    var proximo = document.getElementById('distribuicao-periodo-proximo');
    if (!nome) return;
    nome.textContent = rotulo(escolhido);
    var i = posicao();
    /* os botões vêm com o fragmento da página a cada visita: liga uma vez por elemento */
    if (anterior) {
      anterior.disabled = i <= 0;
      if (!anterior.dataset.ligado) {
        anterior.dataset.ligado = '1';
        anterior.addEventListener('click', function () { var j = posicao(); if (j > 0) escolher(periodos[j - 1]); });
      }
    }
    if (proximo) {
      proximo.disabled = i < 0 || i >= periodos.length - 1;
      if (!proximo.dataset.ligado) {
        proximo.dataset.ligado = '1';
        proximo.addEventListener('click', function () { var j = posicao(); if (j >= 0 && j < periodos.length - 1) escolher(periodos[j + 1]); });
      }
    }
    montarLista();
  }

  /* troca de período: com edição não salva, confirma o descarte antes */
  function escolher(p) {
    if (mesmo(p, escolhido)) return;
    var seguir = function () {
      escolhido = p;
      montarSeletor();
      if (aoTrocar) aoTrocar();
    };
    var ed = RosterWork.distribuicaoEditar;
    if (ed && ed.confirmarSaida) ed.confirmarSaida(seguir); else seguir();
  }

  /* carrega os períodos do grupo; mantém o escolhido (se ainda existe) ou vai para o atual */
  function carregar(contextoId, trocar) {
    aoTrocar = trocar;
    if (contextoId !== contexto) { contexto = contextoId; escolhido = null; }
    var req = ++seq;
    return RosterWork.distribuicaoDados.listarPeriodos(contextoId).then(function (lista) {
      if (req !== seq) return;
      periodos = Array.isArray(lista) ? lista : [];
      var mantido = periodos.filter(function (p) { return mesmo(p, escolhido); })[0];
      escolhido = mantido || periodos.filter(function (p) { return p.atual; })[0] || periodos[periodos.length - 1] || null;
      montarSeletor();
    });
  }

  function mostrar(sim) {
    var el = document.getElementById('distribuicao-periodo');
    if (el) el.classList.toggle('oculto', !sim);
  }

  window.RosterWork.distribuicaoPeriodos = {
    carregar: carregar,
    mostrar: mostrar,
    data: function () { return diaDo(escolhido); },
    periodo: function () { return escolhido; },
    textoNaFrase: textoNaFrase,
    /* período que já terminou: só leitura */
    somenteLeitura: function () { return !!(escolhido && escolhido.passado); },
    /* período que ainda vai começar: o salvar refaz a escala a partir do início dele */
    futuro: function () { return !!(escolhido && escolhido.inicio && escolhido.inicio > hojeIso()); }
  };
})();
