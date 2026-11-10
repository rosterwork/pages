/* ============================================================
   ESCALAS — Mudar o dia do serviço › o Como fica e a conferência do
   banco (as perguntas ficam em escalas-painel-mudar-dia.js). Com a
   resposta completa, meio segundo depois da última, o banco roda a
   mudança num ensaio (escala_previa): a prévia do dia de antes, com a
   recusa, e a do dia novo. O Como fica diz o que acontece nos dois
   dias; a recusa fica em vermelho (quem chama desliga o Salvar), e o
   dia de antes abaixo do mínimo e quem assume o Chefe de Socorro ou o
   Oficial de Área avisam e deixam salvar.
   API: RosterWork.escalasPainelMudarDiaConferir.criar(cfg) devolve
     { resultado(chave) (o que o banco conferiu desta resposta, ou null),
       limpar(), comoFica(item, c), agendar(item, chave) };
   cfg = { el ({ como, comoLista, conferindo, erro, papel, minimo }),
     dados (a leitura do dia de antes), uid, data ("12/11", o dia de
     antes), item() (quem muda: o item da lista Quem), total() (o
     serviço inteiro), dadosNovo(dia) (a leitura do dia novo),
     respostaDoDia(dia) (o calendário), onde() (o Onde fica),
     textoResto(periodo) (o que fica no dia de antes), vivo() (a
     sub-tela na tela), aoConferir() (redesenha) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ESPERA_CONFERIR = 600;   // ms depois da última resposta, o banco confere a mudança

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function M() { return RosterWork.mensagens.escala.mudarDia; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaMes(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function somarDias(s, n) { var d = dataDeIso(s); d.setDate(d.getDate() + n); return iso(d); }

  function criar(cfg) {
    var api = ed(), H = api.horas, el = cfg.el, dados = cfg.dados, data = cfg.data;
    var conferido = null;    // o que o banco conferiu da resposta de agora: { chave, erro, dA, dB }
    var pedido = 0, espera = null;

    /* ---------- o Como fica ---------- */

    function comoFica(item, c) {
      var nome = nomeDe(cfg.item()), para = diaMes(item.para), periodo = item.periodos[0];
      var horas = H.textoPeriodos([periodo]), resto = cfg.textoResto(periodo), linhas = [];
      linhas.push(resto ? M().comoSaiParte(data, nome, horas, resto) : M().comoSai(data, nome));
      linhas.push(entra(nome, para, horas, c));
      /* a folga em volta do dia novo: só no serviço inteiro (o calendário conta a janela toda) */
      var d = cfg.respostaDoDia(item.para);
      if (cfg.total() && d && (d.antes || d.depois)) {
        var dur = H.faixa(periodo)[1] - H.faixa(periodo)[0];
        var proximo = d.depois ? diaMes(somarDias(item.para, Math.floor((H.emMin(periodo.hi) + dur + d.depois * 60) / 1440))) : '';
        linhas.push(M().comoFolga(d.antes, d.depois, proximo));
      }
      linhas.push(M().comoBanco);
      el.comoLista.textContent = '';
      linhas.forEach(function (t) {
        var li = RosterWork.tpl('tpl-escala-mudar-dia-item');
        if (li) { li.textContent = t; el.comoLista.appendChild(li); }
      });
      mostra(el.como, true);
      mostra(el.conferindo, !c);
      if (!c) return;
      if (c.erro) { el.erro.querySelector('.nota-texto').textContent = c.erro; mostra(el.erro, true); return; }
      avisoPapeis(item, c);
      avisoMinimo(c);
    }

    /* o dia novo no Como fica: onde ele entra (no "O sistema distribui", depois que o banco confere, onde o sistema o pôs) */
    function entra(nome, para, horas, c) {
      var e = cfg.onde().estado();
      if (e.onde === 'vaga' && e.vaga) return M().comoEntraVaga(para, nome, horas, api.funcaoNoPosto(e.vaga.funcao, e.vaga.posto));
      if (e.onde === 'funcao' && e.posto && e.funcao) return M().comoEntraFuncao(para, nome, horas, api.funcaoNoPosto(e.funcao, e.posto));
      if (e.onde === 'lugar' && e.sai) return M().comoEntraLugar(para, nome, horas, nomeDe(e.sai.s.m));
      var lugares = [];
      if (c && c.dB) {
        api.funcoesDoMilitar(cfg.item().cpf, c.dB).forEach(function (f) {
          var t = api.funcaoNoPosto(f.funcao, f.posto);
          if (lugares.indexOf(t) < 0) lugares.push(t);
        });
      }
      return lugares.length ? M().comoEntraSistemaLugar(para, nome, horas, lugares) : M().comoEntraSistema(para, nome, horas);
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
      comoFica: comoFica,
      agendar: agendar
    };
  }

  window.RosterWork.escalasPainelMudarDiaConferir = { criar: criar };
})();
