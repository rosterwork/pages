/* ============================================================
   ESCALAS — a aba Militares da página Sobreaviso
   A mesma grade do Militares (escalas-militares.js: militares × os
   dias do mês, um bloco por unidade), com a leitura do sobreaviso
   (sobreaviso_militares): as linhas são a fila (quem entra pelas
   respostas dos Ajustes, na ordem da antiguidade, com ou sem
   sobreaviso no mês) e cada dia de sobreaviso traz o telefone e
   o horário. A unidade sem ninguém na fila não aparece. O clique no
   telefone abre a caixa do sobreaviso (escalas-celula-sobreaviso-
   caixa.js); o dia vazio não faz nada. A mudança ainda não salva
   aparece na grade na hora (rascunho). A dica do nome traz a conta
   dele até hoje (feitos e o justo).
   Não cria HTML (clona os moldes) nem escreve estilo.
   RosterWork.escalasMilitaresSobreaviso.{ ler, chips, linha, clique, rascunho }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var unidades = {};   // a última leitura: unidade -> { companhia_id, por_pelotao }

  function msg() { return RW.mensagens.escala.sobreaviso; }
  function soHora(t) { return t ? String(t).split(':')[0] : ''; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function grade() { return document.querySelector('.conteudo .escala-pagina--sobreaviso .escala-mil-grade'); }

  /* a leitura do mês; guarda de quem é o sobreaviso de cada unidade (a companhia ou o pelotão) */
  function ler(ids, inicio, fim) {
    return RW.escalasDados.sobreavisoMilitares(ids, inicio, fim).then(function (r) {
      unidades = {};
      Object.keys(r).forEach(function (uid) { unidades[uid] = { companhia_id: r[uid].companhia_id, por_pelotao: !!r[uid].por_pelotao }; });
      return r;
    });
  }

  /* o telefone e o horário de cada período do dia de sobreaviso (o molde do horário da grade) */
  function chips(celula, periodos) {
    (periodos || []).forEach(function (per) {
      var chip = RW.tpl('tpl-escala-mil-servico');
      if (!chip) return;
      chip.querySelector('.escala-mil-servico-sobreaviso').classList.remove('oculto');
      chip.setAttribute('data-situacao', 'sobreaviso');   // para o filtro (escalas-militares-dias.js)
      chip.querySelector('.linha-escalado-hora-ini').textContent = soHora(per.inicio);
      chip.querySelector('.linha-escalado-hora-fim').textContent = soHora(per.fim);
      chip.setAttribute('data-dica', msg().dica);
      celula.appendChild(chip);
    });
  }

  /* a linha do militar: a conta até hoje (feitos e o justo, desde o primeiro sobreaviso da companhia) na dica do nome */
  function linha(el, militar) {
    var nome = el.querySelector('.escala-mil-pessoa-nome');
    if (!nome || militar.feitos == null || !militar.conta_desde) return;
    nome.setAttribute('data-dica', msg().contaMilitar(militar.feitos, militar.justo, diaMes(militar.conta_desde)));
  }

  /* o clique numa célula: no dia de sobreaviso, a caixa dele (estado: o da leitura; a mudança ainda não salva vale pelo
     telefone na célula) */
  function clique(celula, militar, coluna, iso, estado) {
    if (!celula.querySelector('.escala-mil-servico-sobreaviso:not(.oculto)') || !RW.escalasCelulaSobreavisoCaixa) return;
    var u = unidades[coluna.id] || {};
    var d = { unidadeId: (estado && estado.unidade_id) || coluna.id, iso: iso, unidadeNome: coluna.nomeCompleto || coluna.nome,
      unidadeCidade: coluna.cidade || '' };
    var quem = u.por_pelotao ? ['pelotao', d.unidadeId] : ['companhia', u.companhia_id];
    RW.escalasCelulaSobreavisoCaixa.abrirFora({ d: d, peca: celula, cpf: militar.cpf,
      titulo: RW.mensagens.escala.linha.noDia(((militar.grad || '') + ' ' + (militar.nome || '')).trim(), diaMes(iso)),
      pode: !!RW.sessao && RW.sessao.podeAdministrar(quem[0], quem[1]) });
  }

  /* o rascunho do sobreaviso mudou (escalas-celula-sobreaviso.js › rascunho; chave: a companhia ou o pelotão, com o dia;
     militares: a lista de agora, null: volta o gravado): o telefone muda nas linhas daquele sobreaviso */
  function rascunho(chave, iso, militares) {
    var g = grade();
    if (!g) return;
    if (!militares) { window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar')); return; }
    var dono = String(chave).split('|')[0];
    Array.prototype.forEach.call(g.querySelectorAll('.escala-mil-unidade[data-unidade-id]'), function (bloco) {
      var u = unidades[bloco.getAttribute('data-unidade-id')];
      if (!u || String(u.por_pelotao ? bloco.getAttribute('data-unidade-id') : u.companhia_id) !== dono) return;
      Array.prototype.forEach.call(bloco.querySelectorAll('.escala-mil-pessoa-linha[data-cpf]'), function (linha) {
        var cel = linha.querySelector('.escala-mil-celula[data-iso="' + iso + '"]');
        if (!cel) return;
        var m = militares.filter(function (x) { return x.cpf === linha.getAttribute('data-cpf'); })[0];
        Array.prototype.forEach.call(cel.querySelectorAll('.escala-mil-servico'), function (c) { c.remove(); });
        if (m) chips(cel, [{ inicio: m.horaInicio, fim: m.horaFim }]);
      });
    });
  }

  RW.escalasMilitaresSobreaviso = { ler: ler, chips: chips, linha: linha, clique: clique, rascunho: rascunho };
})();
