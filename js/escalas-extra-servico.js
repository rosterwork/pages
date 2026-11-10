/* ============================================================
   ESCALAS — quem está de serviço e de extra no mesmo horário
   A nota vermelha embaixo da barra (logo abaixo da nota das cotas),
   com o X. Os casos são as linhas que o banco marca com extra_servico
   (ler_escala_mes): cada leitura da grade passa por aqui
   (escalas-dados.js › reorganizar), e o que a leitura nova de um dia
   diz vale no lugar do que se sabia dele. A nota mostra os casos das
   unidades e do período na tela, nas abas Mês e Colunas, só para quem
   administra a unidade (pelotão, companhia ou geral) e fora do treino.
   O X esconde a nota até recarregar ou entrar de novo na página; ela
   volta se a lista mudar.
   API: RosterWork.escalaExtraServico.anotar(grade) · ligar(lugar,
   opcoes) · atualizar()
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var casos = {};      // 'unidade|dia' -> as linhas marcadas da última leitura desse dia
  var atual = null;    // onde a nota fica: { lugar, opcoes: { visivel(), unidades(), periodo(), nomeUnidade(id) } }
  var escondida = '';  // a lista que o X escondeu
  var agendado = false;

  function M() { return RW.mensagens.escala; }
  function noTreino() { return !!(RW.treino && RW.treino.ligado()); }
  function diaMes(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; }
  function faixas(horas) { return horas.map(function (h) { return [RW.horario.curta(h.hi), RW.horario.curta(h.hf)]; }); }

  /* a leitura da grade ({ unidade: { dia: { militares } } }): o que ela diz de cada dia fica no lugar do de antes */
  function anotar(grade) {
    Object.keys(grade || {}).forEach(function (uid) {
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var marcadas = ((dias[iso] || {}).militares || []).filter(function (p) { return p.extra_servico && p.extra_servico.length; });
        if (marcadas.length) casos[uid + '|' + iso] = marcadas;
        else delete casos[uid + '|' + iso];
      });
    });
    if (agendado) return;
    agendado = true;
    setTimeout(function () { agendado = false; atualizar(); }, 0);
  }

  /* os casos na tela, um por militar e dia: { cpf, nome, iso, horas } */
  function naTela() {
    var o = atual.opcoes, unidades = o.unidades().map(function (u) { return String(u.id); }), per = o.periodo(), vistos = {}, lista = [];
    Object.keys(casos).forEach(function (k) {
      var uid = k.split('|')[0], iso = k.split('|')[1];
      if (unidades.indexOf(uid) < 0 || iso < per.inicio || iso > per.fim) return;
      if (!RW.sessao || !RW.sessao.podeAdministrar('pelotao', +uid)) return;
      casos[k].forEach(function (p) {
        var chave = p.cpf + '|' + iso;
        if (vistos[chave]) return;
        vistos[chave] = true;
        lista.push({ cpf: p.cpf, nome: ((p.grad || '') + ' ' + (p.nome || '')).trim(), iso: iso, horas: p.extra_servico });
      });
    });
    return lista.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.nome.localeCompare(b.nome); });
  }

  /* desenha de novo no lugar ligado: uma leitura nova, ou o período, o modo ou as unidades mudaram na tela */
  function atualizar() {
    if (!atual || !document.contains(atual.lugar)) return;
    var lugar = atual.lugar, lista = noTreino() || !atual.opcoes.visivel() ? [] : naTela();
    var assinatura = lista.map(function (c) { return c.cpf + '|' + c.iso; }).join(',');
    lugar.textContent = '';
    if (lista.length && assinatura !== escondida) {
      var nota = RW.tpl('tpl-escala-extra-servico');
      if (nota) {
        var cpfs = lista.map(function (c) { return c.cpf; }).filter(function (c, i, l) { return l.indexOf(c) === i; });
        var primeiro = lista[0], texto;
        if (cpfs.length > 1) texto = M().extraServico.nomes;
        else if (lista.length > 1) texto = M().extraServico.dias(lista.map(function (c) { return diaMes(c.iso); }));
        else texto = M().extraServico.quando(diaMes(primeiro.iso), faixas(primeiro.horas), atual.opcoes.nomeUnidade(primeiro.horas[0].unidade));
        nota.querySelector('.nota-titulo').textContent = cpfs.length > 1 ? M().extraServico.varios(primeiro.nome, cpfs.length - 1) : M().extraServico.um(primeiro.nome);
        nota.querySelector('.escala-extra-servico-texto').textContent = texto;
        nota.querySelector('.escala-extra-servico-fechar').addEventListener('click', function () {
          escondida = assinatura;
          atualizar();
        });
        lugar.appendChild(nota);
      }
    }
    lugar.classList.toggle('oculto', !lugar.childElementCount);
  }

  /* a página diz o lugar e como ler a tela (opcoes = { visivel(), unidades(), periodo() { inicio, fim }, nomeUnidade(id) }).
     O lugar novo é uma visita nova à página: o X recomeça */
  function ligar(lugar, opcoes) {
    if (!atual || atual.lugar !== lugar) escondida = '';
    atual = { lugar: lugar, opcoes: opcoes };
    atualizar();
  }

  RW.escalaExtraServico = { anotar: anotar, ligar: ligar, atualizar: atualizar };
})();
