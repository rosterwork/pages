/* ============================================================
   ESCALAS — a aba Militares do painel do dia: o mesmo dia da aba
   Funções, por pessoa (só quem está no dia), com as peças da lista
   do escalas-painel-editar.js (.sub.lista: a linha, o bloco, o lápis
   e o De folga). Quatro grupos:
   - De serviço (N): quem serve nesta unidade no dia, na ordem da
     lista de militares do dia (a unidade e a antiguidade), cada um
     com o ícone de origem, o horário de serviço e, embaixo do nome,
     as funções dele no dia e, em vermelho, o horário sem função;
   - Em outra unidade (N): quem foi remanejado daqui para outra
     unidade neste dia;
   - De folga (N): o mesmo De folga da aba Funções;
   - Saiu da guarnição (N): quem saiu da guarnição e não faz mais o
     serviço deste dia (a lista saidas do ler_distribuicao_dia), riscado,
     com a data da saída e o Cancelar a saída no lápis.
   O lápis de cada um (só para quem edita o dia) traz só o dia da
   pessoa e o Ver as funções (escalas-painel-linha-menu.js, visao
   'militares'); o de quem foi para outra unidade, o Devolver. Os
   avisos do dia, as Observações, o Lançar no SYSBM e as Alterações
   manuais ficam na aba Funções. Ninguém no dia: o vazio.
   API: RosterWork.escalasPainelMilitares.montar(corpo, dados)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function Q() { return RosterWork.escalasPainelQuem; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* um grupo da aba: a caixa com o título e o bloco das linhas, sem a coluna do nome da função */
  function caixaGrupo(titulo) {
    var caixa = RosterWork.painel.criarCaixa(titulo), grupo = ed().lista.novoGrupo([], null);
    if (!caixa || !grupo) return null;
    grupo.el.classList.add('escala-edicao-grupo--militares');
    caixa.appendChild(grupo.el);
    return { caixa: caixa, linhas: grupo.linhas };
  }

  /* embaixo do nome: as funções dele no dia e o horário sem função (em vermelho) */
  function funcoesEmbaixo(linha, cpf, semFuncao) {
    var api = ed(), el = RosterWork.tpl('tpl-escala-militares-funcoes');
    if (!el) return;
    var lugares = [];
    api.funcoesDoMilitar(cpf).forEach(function (f) {
      var t = api.funcaoNoPosto(f.funcao, f.posto);
      if (lugares.indexOf(t) < 0) lugares.push(t);
    });
    el.querySelector('.escala-militares-funcoes-texto').textContent = msg().militaresFuncoes(lugares);
    if (semFuncao) {
      var horas = lugares.length ? api.horas.textoPeriodos(semFuncao.periodos || []) : '';
      el.querySelector('.escala-militares-sem-funcao').textContent = msg().militaresSemFuncao(horas, lugares.length > 0);
    }
    linha.appendChild(el);
  }

  /* quem está no dia, na ordem da lista de militares do dia: { servico: [pm], fora: [pm] } */
  function pessoasDoDia(dados) {
    var uid = String(ed().unidadeId()), noDia = {}, visto = {}, servico = [], fora = [];
    (dados.postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) { (f.militares || []).forEach(function (m) { noDia[m.cpf] = true; }); });
    });
    (dados.sem_funcao || []).forEach(function (m) { noDia[m.cpf] = true; });
    (dados.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        if (visto[pm.cpf]) return;
        var rm = pm.remanejado;
        /* remanejado daqui para outra unidade (sem ficar nas duas): não serve aqui no dia */
        if (rm && !rm.fica && String(rm.de) === uid) { visto[pm.cpf] = true; fora.push(pm); return; }
        if (!noDia[pm.cpf]) return;
        visto[pm.cpf] = true;
        servico.push(pm);
      });
    });
    return { servico: servico, fora: fora };
  }

  function montar(corpo, dados) {
    var api = ed(), P = api.lista, H = api.horas, editavel = P.editavel(), alguem = false;
    var pessoas = pessoasDoDia(dados);
    var semFuncao = {};
    (dados.sem_funcao || []).forEach(function (m) { semFuncao[m.cpf] = m; });

    if (pessoas.servico.length) {
      var g = caixaGrupo(msg().militaresServico(pessoas.servico.length));
      if (g) {
        pessoas.servico.forEach(function (pm) {
          var mil = api.militarDoDia(pm.cpf);
          if (!mil) return;
          var janelas = (mil.janelas || []).slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
          var fs = api.funcoesDoMilitar(pm.cpf), deFuncao = (fs[0] && fs[0].m) || semFuncao[pm.cpf] || {};
          /* a linha de sempre (os ícones de regra, CNH e outra unidade vêm do militar da função), com o horário de serviço
             dele e sem o Fixado, que é de cada função */
          var m = Object.assign({}, deFuncao, { cpf: pm.cpf, grad: mil.grad, nome: mil.nome, fixado: false,
            periodos: janelas.map(function (j) { return { hi: j.hi, hf: j.hf }; }) });
          /* quem veio de outro dia leva o ícone da mudança com a dica de onde veio, como na aba Funções */
          var linha = P.linhaMilitar(m, { icone: deFuncao.origem === 'mudanca' ? null : Q().iconeDe(janelas) });
          if (!linha) return;
          funcoesEmbaixo(linha, pm.cpf, semFuncao[pm.cpf]);
          if (editavel) P.menuNaLinha(linha, { tipo: 'militar', visao: 'militares', militar: m, periodos: m.periodos });
          g.linhas.appendChild(linha);
        });
        corpo.appendChild(g.caixa);
        alguem = true;
      }
    }

    if (pessoas.fora.length) {
      var gf = caixaGrupo(msg().militaresFora(pessoas.fora.length));
      if (gf) {
        pessoas.fora.forEach(function (pm) {
          var rm = pm.remanejado, m = { cpf: pm.cpf, grad: pm.grad, nome: pm.nome, periodos: [] };
          var linha = P.linhaMilitar(m, { icone: 'icone-remanejado' });
          if (!linha) return;
          var el = RosterWork.tpl('tpl-escala-militares-funcoes');
          if (el) { el.querySelector('.escala-militares-funcoes-texto').textContent = L().remanejadoPara(rm.para_nome || ''); linha.appendChild(el); }
          if (editavel) P.menuNaLinha(linha, { tipo: 'fora', visao: 'militares', militar: m, origem: rm.de_nome || '' });
          gf.linhas.appendChild(linha);
        });
        corpo.appendChild(gf.caixa);
        alguem = true;
      }
    }

    /* o De folga da aba Funções, aqui também na largura toda */
    var folgas = dados.folgas || [];
    var caixaFolgas = P.caixaFolgas(folgas, msg().militaresFolga(folgas.length));
    if (caixaFolgas) {
      var grupoFolgas = caixaFolgas.querySelector('.escala-edicao-grupo');
      if (grupoFolgas) grupoFolgas.classList.add('escala-edicao-grupo--militares');
      corpo.appendChild(caixaFolgas);
      alguem = true;
    }

    /* quem saiu da guarnição e não faz mais o serviço deste dia: riscado, com a data da saída embaixo do nome e, no
       lápis, o Cancelar a saída */
    var saidas = dados.saidas || [];
    if (saidas.length) {
      var gs = caixaGrupo(msg().militaresSaida(saidas.length));
      if (gs) {
        saidas.forEach(function (x) {
          var m = { cpf: x.cpf, grad: x.grad, nome: x.nome, periodos: [{ hi: x.hi, hf: x.hf }] };
          var linha = P.linhaMilitar(m, { folga: true, icone: 'icone-origem-saida' });
          if (!linha) return;
          var el = RosterWork.tpl('tpl-escala-militares-funcoes');
          if (el) { el.querySelector('.escala-militares-funcoes-texto').textContent = msg().saiuDaGuarnicao(diaMes(x.saida)); linha.appendChild(el); }
          if (editavel) P.menuNaLinha(linha, { tipo: 'saida', visao: 'militares', militar: m, saida: x.saida });
          gs.linhas.appendChild(linha);
        });
        corpo.appendChild(gs.caixa);
        alguem = true;
      }
    }

    /* ninguém no dia: o vazio, nunca a tela em branco */
    if (!alguem) {
      var vazio = RosterWork.tpl('tpl-escala-distribuicao-estado');
      if (vazio) { vazio.textContent = msg().militaresVazio; corpo.appendChild(vazio); }
    }
  }

  window.RosterWork.escalasPainelMilitares = { montar: montar };
})();
