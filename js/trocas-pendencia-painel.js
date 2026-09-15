/* ============================================================
   TROCAS — painel lateral da PENDÊNCIA (extrato entre dois militares)
   Abre o geral-painel com o saldo no cabeçalho e, no corpo, o extrato
   dos lançamentos (serviço/devolução) que formaram esse saldo — os
   últimos 4, com "Ver mais" que pagina do banco sob demanda. O rodapé
   traz o Cobrar (só para o credor).
   Expõe: RosterWork.trocasPendenciaPainel.abrir(pendencia, ctx).
   ctx = { cpf, ehAdmin, aoMudar(), aoFechar() }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  var PAGINA = 4;

  var pendenciaAtual = null;
  var extrato = null;   // { aCpf, bCpf, carregados, total, lista, botaoMais }

  function fmt() { return RW.trocasFormato; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }
  function nome(grau, n) { return fmt().nomeMilitar(grau, n); }
  function horasDe(min) { return RW.mensagens.trocas.pendHoras(Math.round((min || 0) / 60)); }

  function carregandoEm(alvo) {
    var pts = document.getElementById('carregando-pontos');
    if (pts) alvo.appendChild(pts.content.cloneNode(true));
  }

  function mostrarEstado(texto) {
    if (!extrato) return;
    extrato.lista.textContent = '';
    var e = RW.painel.criarEstado ? RW.painel.criarEstado(texto) : null;
    if (e) extrato.lista.appendChild(e);
    extrato.botaoMais.classList.add('oculto');
  }

  /* uma linha do extrato: data + horas em cima; quem folgou -> quem trabalhou embaixo */
  function montarLinha(l) {
    var tpl = document.getElementById('tpl-troca-extrato-linha');
    if (!tpl) return null;
    var el = tpl.content.cloneNode(true).firstElementChild;
    el.querySelector('.troca-extrato-data').textContent = fmt().dataLonga(l.data);
    el.querySelector('.troca-extrato-horas').textContent = horasDe(l.minutos);
    el.querySelector('.troca-extrato-folgou').textContent = nome(l.folgou_grau, l.folgou_nome);
    el.querySelector('.troca-extrato-trabalhou').textContent = nome(l.trabalhou_grau, l.trabalhou_nome);
    return el;
  }

  function anexarLinhas(linhas) {
    linhas.forEach(function (l) { var el = montarLinha(l); if (el) extrato.lista.appendChild(el); });
  }

  function atualizarBotaoMais() {
    extrato.botaoMais.classList.toggle('oculto', extrato.carregados >= extrato.total);
  }

  /* carrega uma página do extrato (a primeira mostra os pontinhos no corpo; as demais, no botão) */
  function carregarPagina(primeira) {
    var pend = pendenciaAtual, est = extrato;
    if (!est) return;
    if (primeira) { est.lista.textContent = ''; carregandoEm(est.lista); est.botaoMais.classList.add('oculto'); }
    else if (RW.iniciarCarregando) RW.iniciarCarregando(est.botaoMais);

    RW.trocasDados.historicoPar(est.aCpf, est.bCpf, PAGINA, est.carregados).then(function (linhas) {
      if (pendenciaAtual !== pend || extrato !== est) return;   // painel trocou no meio
      if (!primeira && RW.pararCarregando) RW.pararCarregando(est.botaoMais);
      if (!Array.isArray(linhas)) { mostrarEstado(txt('extratoFalha')); return; }
      if (primeira) {
        est.lista.textContent = '';
        if (linhas.length === 0) { mostrarEstado(txt('extratoVazio')); return; }
      }
      est.total = linhas.length ? Number(linhas[0].total) : est.total;
      est.carregados += linhas.length;
      anexarLinhas(linhas);
      atualizarBotaoMais();
    }).catch(function () {
      if (pendenciaAtual !== pend || extrato !== est) return;
      if (!primeira && RW.pararCarregando) RW.pararCarregando(est.botaoMais);
      mostrarEstado(txt('extratoFalha'));
    });
  }

  /* rodapé: Cobrar (só para o credor) abre o Solicitar em modo cobrança */
  function montarAcoes(p, ctx) {
    var rodape = RW.painel.rodape();
    if (!rodape) return;
    rodape.textContent = '';
    if (!ctx || ctx.cpf !== p.credor_cpf) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-troca-pendente-acoes');
    if (!tpl) { rodape.classList.add('oculto'); return; }
    var frag = tpl.content.cloneNode(true);
    var btn = frag.querySelector('.troca-pendente-cobrar');
    if (btn) btn.addEventListener('click', function () {
      if (RW.trocasSolicitar) RW.trocasSolicitar.abrir({ cobrar: {
        cpf: p.devedor_cpf, nome: p.devedor_nome, grau: p.devedor_grau, minutos: p.minutos || 0
      } });
    });
    rodape.appendChild(frag);
    rodape.classList.remove('oculto');
  }

  function abrir(p, ctx) {
    if (!RW.painel || !p) return;
    RW.painel.abrir({
      titulo: txt('pendenciaTitulo'),
      subtitulo: RW.mensagens.trocas.pendenciaSubtitulo(nome(p.devedor_grau, p.devedor_nome), horasDe(p.minutos), nome(p.credor_grau, p.credor_nome)),
      aoFechar: function () { pendenciaAtual = null; extrato = null; if (ctx && ctx.aoFechar) ctx.aoFechar(); }
    });
    /* setar depois do abrir: reabrir outra pendência por cima dispara o aoFechar anterior */
    pendenciaAtual = p;

    var corpo = RW.painel.corpo();
    var tpl = document.getElementById('tpl-troca-extrato');
    if (!tpl) return;
    var el = tpl.content.cloneNode(true).firstElementChild;
    corpo.appendChild(el);
    var botaoMais = el.querySelector('.troca-extrato-mais');
    botaoMais.textContent = txt('extratoMais');
    botaoMais.addEventListener('click', function () { carregarPagina(false); });

    extrato = { aCpf: p.devedor_cpf, bCpf: p.credor_cpf, carregados: 0, total: 0, lista: el.querySelector('.troca-extrato-lista'), botaoMais: botaoMais };

    montarAcoes(p, ctx);
    carregarPagina(true);
  }

  RW.trocasPendenciaPainel = { abrir: abrir };
})();
