/* ============================================================
   ESCALAS — Mudar o dia do serviço › a conferência do banco (as
   perguntas ficam em escalas-painel-mudar-dia.js). Com a resposta
   completa, meio segundo depois da última, o banco roda a mudança
   num ensaio (escala_previa): a prévia do dia de antes, com a
   recusa, e a do dia novo. Enquanto confere, a linha Conferindo a
   mudança; a recusa fica em vermelho (quem chama desliga o Salvar),
   e o dia de antes abaixo do mínimo e quem assume o Chefe de Socorro
   ou o Oficial de Área avisam e deixam salvar.
   API: RosterWork.escalasPainelMudarDiaConferir.criar(cfg) devolve
     { resultado(chave) (o que o banco conferiu desta resposta, ou null),
       limpar(), mostrar(item, c) (o que o banco conferiu; c nulo, a
       espera), agendar(item, chave) };
   cfg = { el ({ conferindo, erro, papel, minimo }), dados (a leitura
     do dia de antes), uid, data ("12/11", o dia de antes), item()
     (quem muda: o item da lista Quem), dadosNovo(dia) (a leitura do
     dia novo), vivo() (a sub-tela na tela), aoConferir() (redesenha) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ESPERA_CONFERIR = 600;   // ms depois da última resposta, o banco confere a mudança

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function M() { return RosterWork.mensagens.escala.mudarDia; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }
  function diaMes(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  function criar(cfg) {
    var api = ed(), el = cfg.el, dados = cfg.dados, data = cfg.data;
    var conferido = null;    // o que o banco conferiu da resposta de agora: { chave, erro, dA, dB }
    var pedido = 0, espera = null;

    /* ---------- o que o banco conferiu ---------- */

    /* c nulo: a conta ainda vem (fica o Conferindo a mudança); com a recusa, a nota vermelha; sem ela, os avisos */
    function mostrar(item, c) {
      mostra(el.conferindo, !c);
      if (!c) return;
      if (c.erro) { el.erro.querySelector('.nota-texto').textContent = c.erro; mostra(el.erro, true); return; }
      avisoPapeis(item, c);
      avisoMinimo(c);
    }

    /* quem assume o Chefe de Socorro ou o Oficial de Área nos dois dias (só quando muda por causa dele) */
    function avisoPapeis(item, c) {
      var cpf = cfg.item().cpf, nome = nomeDe(cfg.item()), partes = [];
      var antesA = api.papeis(dados), depoisA = api.papeis(c.dA);
      Object.keys(depoisA).forEach(function (k) {
        var tinha = antesA[k] ? antesA[k].por : {}, tem = depoisA[k].por;
        var entraNovo = Object.keys(tem).filter(function (x) { return !tinha[x]; })[0];
        if (tinha[cpf] && entraNovo) partes.push(M().assumeAntes(data, depoisA[k].funcao, tem[entraNovo].nome));
      });
      if (c.dB) {
        var antesB = api.papeis(cfg.dadosNovo(item.para)), depoisB = api.papeis(c.dB);
        Object.keys(depoisB).forEach(function (k) {
          var tinha = antesB[k] ? antesB[k].por : {}, tem = depoisB[k].por;
          if (!tem[cpf] || tinha[cpf]) return;
          var saem = Object.keys(tinha).filter(function (x) { return !tem[x]; }).map(function (x) { return tinha[x].nome; });
          partes.push(M().assumeNovo(diaMes(item.para), nome, depoisB[k].funcao, saem.join(' e ')));
        });
      }
      if (!partes.length) return;
      el.papel.querySelector('.nota-texto').textContent = partes.join(' ');
      mostra(el.papel, true);
    }

    /* o dia de antes que fica abaixo do mínimo sem ele (vermelho: dá para salvar, e o dia fica com o erro) */
    function avisoMinimo(c) {
      function minimos(d) {
        var r = {};
        ((d && d.problemas) || []).forEach(function (p) {
          var vale = (p.codigo === 'unidade_abaixo_minimo' || p.codigo === 'posto_fora') ? p.nivel === 1 : p.codigo === 'abaixo_minimo';
          if (vale) r[p.codigo + '|' + (p.posto_id || '') + '|' + p.hi + '|' + p.hf] = p;
        });
        return r;
      }
      var antes = minimos(dados), depois = minimos(c.dA);
      var novo = Object.keys(depois).filter(function (k) { return !antes[k] || depois[k].quantidade < antes[k].quantidade; })
        .map(function (k) { return depois[k]; })[0];
      if (!novo) return;
      var quem;
      if (novo.codigo === 'unidade_abaixo_minimo') {
        var u = (dados.picker || []).filter(function (x) { return x.editando; })[0];
        quem = M().quemUnidade(u ? u.unidade_nome : '');
      } else {
        var posto = api.acharPosto(novo.posto_id, novo.posto_id, c.dA);
        quem = M().quemPosto(novo.posto || (posto && posto.nome) || '', !!posto && (posto.tipo === 'viatura' || api.postoFeminino(posto)));
      }
      el.minimo.querySelector('.nota-texto').textContent =
        M().abaixoMinimo(quem, novo.quantidade, data, novo.limite, String(Number(data.split('/')[0])));
      mostra(el.minimo, true);
    }

    /* ---------- o banco confere ---------- */

    /* a resposta completa: meio segundo depois da última, o banco roda a mudança num ensaio (a prévia do dia de antes, com
       a recusa, e a do dia novo) */
    function agendar(item, chave) {
      if (espera) clearTimeout(espera);
      espera = setTimeout(function () { espera = null; conferir(item, chave); }, ESPERA_CONFERIR);
    }
    function conferir(item, chave) {
      var meu = ++pedido, D = RosterWork.escalasDados;
      var pA = D.lerPrevia('ler_distribuicao_dia', {});
      if (!pA) return;
      function vale() { return meu === pedido && cfg.vivo(); }
      pA.then(function (dA) {
        if (!vale()) return;
        if (!dA) { conferido = { chave: chave, dA: null, dB: null }; cfg.aoConferir(); return; }
        if (dA.erro_simulacao) { conferido = { chave: chave, erro: dA.erro_simulacao }; cfg.aoConferir(); return; }
        var pB = D.lerPrevia('escala_dia_arvore', { p_unidade_ids: [Number(cfg.uid)], p_data: item.para });
        (pB || Promise.resolve(null)).then(function (linhas) {
          if (!vale()) return;
          var u = (Array.isArray(linhas) ? linhas : []).filter(function (l) { return l && String(l.unidade_id) === String(cfg.uid); })[0];
          conferido = { chave: chave, dA: dA, dB: u ? u.distribuicao : null };
          cfg.aoConferir();
        });
      });
    }

    return {
      resultado: function (chave) { return conferido && conferido.chave === chave ? conferido : null; },
      limpar: function () { conferido = null; },
      mostrar: mostrar,
      agendar: agendar
    };
  }

  window.RosterWork.escalasPainelMudarDiaConferir = { criar: criar };
})();
