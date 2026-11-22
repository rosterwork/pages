/* ============================================================
   ESCALAS — as linhas por pessoa do painel do dia, com as peças da
   lista do escalas-painel-editar.js (.sub.lista: a linha, o bloco e
   o lápis):
   - a aba Estagiários: os estagiários de serviço no dia (a leitura do
     dia, estagios), um grupo por estágio (o nome e quantos), na ordem
     da lista de militares do dia (a unidade e a antiguidade), cada um
     com o ícone de origem, o horário de serviço e, embaixo do nome, as
     funções dele no dia e, em vermelho, o horário sem função. O lápis
     (só para quem edita o dia) traz só o dia da pessoa e o Ver as
     funções (escalas-painel-linha-menu.js, visao 'militares');
     ninguém, o vazio dela;
   - na aba Funções, depois do De folga, duas caixas como as dela:
     Em outra unidade (quem foi remanejado daqui para outra unidade
     neste dia, com o Devolver no lápis) e Saiu da guarnição (quem saiu
     da guarnição e não faz mais o serviço deste dia, a lista saidas do
     ler_distribuicao_dia, riscado, com o último serviço (a saída à
     mão; nas outras, a data da saída) e o Mudar a saída e o Cancelar a
     saída no lápis).
   API: RosterWork.escalasPainelMilitares.estagiarios(corpo, dados),
   caixaOutraUnidade(dados) e caixaSaidas(dados) (a caixa, ou null)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function Q() { return RosterWork.escalasPainelQuem; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* um grupo: a caixa com o título e o bloco das linhas. Na aba Estagiários, sem a coluna do nome da função; na Funções
     (comoFuncoes), o bloco das caixas dela, com a coluna vazia, como o De folga */
  function caixaGrupo(titulo, comoFuncoes) {
    var caixa = RosterWork.painel.criarCaixa(titulo), grupo = ed().lista.novoGrupo([], null);
    if (!caixa || !grupo) return null;
    if (!comoFuncoes) grupo.el.classList.add('escala-edicao-grupo--militares');
    caixa.appendChild(grupo.el);
    return { caixa: caixa, linhas: grupo.linhas };
  }

  /* embaixo do nome: as funções dele no dia e o horário sem função (em vermelho); o Chefe de Socorro ou o Oficial de
     Área que saiu da cadeira dele (semFuncao.papel) tem o papel no lugar do "Sem função" */
  function funcoesEmbaixo(linha, cpf, semFuncao) {
    var api = ed(), el = RosterWork.tpl('tpl-escala-militares-funcoes');
    if (!el) return;
    var lugares = [];
    api.funcoesDoMilitar(cpf).forEach(function (f) {
      var t = api.funcaoNoPosto(f.funcao, f.posto);
      if (lugares.indexOf(t) < 0) lugares.push(t);
    });
    if (semFuncao && semFuncao.papel && lugares.indexOf(semFuncao.papel) < 0) lugares.push(semFuncao.papel);
    el.querySelector('.escala-militares-funcoes-texto').textContent = msg().militaresFuncoes(lugares);
    if (semFuncao && !semFuncao.papel) {
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

  /* a linha de quem está de serviço no dia, com as funções embaixo e o lápis */
  function linhaServico(pm, semFuncao) {
    var api = ed(), P = api.lista, H = api.horas, mil = api.militarDoDia(pm.cpf);
    if (!mil) return null;
    var janelas = (mil.janelas || []).slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
    var fs = api.funcoesDoMilitar(pm.cpf), deFuncao = (fs[0] && fs[0].m) || semFuncao[pm.cpf] || {};
    /* a linha de sempre (os ícones de regra, CNH e outra unidade vêm do militar da função), com o horário de serviço
       dele e sem o Fixado, que é de cada função */
    var m = Object.assign({}, deFuncao, { cpf: pm.cpf, grad: mil.grad, nome: mil.nome, fixado: false,
      periodos: janelas.map(function (j) { return { hi: j.hi, hf: j.hf }; }) });
    /* quem veio de outro dia leva o ícone da mudança com a dica de onde veio, como na aba Funções */
    var linha = P.linhaMilitar(m, { icone: deFuncao.origem === 'mudanca' ? null : Q().iconeDe(janelas) });
    if (!linha) return null;
    funcoesEmbaixo(linha, pm.cpf, semFuncao[pm.cpf]);
    if (P.editavel()) P.menuNaLinha(linha, { tipo: 'militar', visao: 'militares', militar: m, periodos: m.periodos });
    return linha;
  }

  /* a aba Estagiários: um grupo por estágio (o nome e quantos), na ordem da lista do dia; ninguém, o vazio */
  function montarEstagiarios(corpo, dados) {
    var estagios = dados.estagios || {}, de = dados.estagio_de || {}, semFuncao = {}, grupos = [], porId = {};
    (dados.sem_funcao || []).forEach(function (m) { semFuncao[m.cpf] = m; });
    var nomes = {};
    (dados.estagios_unidade || []).forEach(function (e) { nomes[e.id] = e.nome; });
    pessoasDoDia(dados).servico.forEach(function (pm) {
      if (!estagios[pm.cpf]) return;
      var id = de[pm.cpf] || '';
      if (!porId[id]) { porId[id] = { nome: nomes[id] || msg().estagiariosSemNome, pessoas: [] }; grupos.push(porId[id]); }
      porId[id].pessoas.push(pm);
    });
    grupos.forEach(function (gr) {
      var g = caixaGrupo(msg().estagiariosGrupo(gr.nome, gr.pessoas.length));
      if (!g) return;
      gr.pessoas.forEach(function (pm) { var l = linhaServico(pm, semFuncao); if (l) g.linhas.appendChild(l); });
      corpo.appendChild(g.caixa);
    });
    if (!grupos.length) {
      var vazio = RosterWork.tpl('tpl-escala-distribuicao-estado');
      if (vazio) { vazio.textContent = msg().estagiariosVazio; corpo.appendChild(vazio); }
    }
  }

  /* na aba Funções: quem foi remanejado daqui para outra unidade neste dia, com "Remanejado para o 1ºPEL" embaixo do nome e
     o Devolver no lápis (só para quem edita o dia); ninguém, sem a caixa */
  function caixaOutraUnidade(dados) {
    var fora = pessoasDoDia(dados).fora;
    if (!fora.length) return null;
    var P = ed().lista, g = caixaGrupo(msg().blocoOutraUnidade, true);
    if (!g) return null;
    fora.forEach(function (pm) {
      var rm = pm.remanejado, m = { cpf: pm.cpf, grad: pm.grad, nome: pm.nome, periodos: [] };
      var linha = P.linhaMilitar(m, { icone: 'icone-remanejado' });
      if (!linha) return;
      var el = RosterWork.tpl('tpl-escala-militares-funcoes');
      if (el) { el.querySelector('.escala-militares-funcoes-texto').textContent = L().remanejadoPara(rm.para_nome || ''); linha.appendChild(el); }
      P.menuNaLinha(linha, { tipo: 'fora', militar: m, origem: rm.de_nome || '' });
      g.linhas.appendChild(linha);
    });
    return g.caixa;
  }

  /* na aba Funções: quem saiu da guarnição e não faz mais o serviço deste dia, riscado, com o último serviço (ou a data da
     saída) embaixo do nome e, no lápis, o Mudar a saída (só na saída à mão) e o Cancelar a saída; ninguém, sem a caixa */
  function caixaSaidas(dados) {
    var saidas = dados.saidas || [];
    if (!saidas.length) return null;
    var P = ed().lista, g = caixaGrupo(msg().blocoSaiuGuarnicao, true);
    if (!g) return null;
    saidas.forEach(function (x) {
      var m = { cpf: x.cpf, grad: x.grad, nome: x.nome, periodos: [{ hi: x.hi, hf: x.hf }] };
      var linha = P.linhaMilitar(m, { folga: true, icone: 'icone-origem-saida' });
      if (!linha) return;
      var el = RosterWork.tpl('tpl-escala-militares-funcoes');
      /* a saída à mão diz o último serviço (a data da pergunta do Mudar a saída); as outras, o dia da saída */
      if (el) {
        el.querySelector('.escala-militares-funcoes-texto').textContent = x.ultimo ? msg().ultimoNaGuarnicao(diaMes(x.ultimo)) : msg().saiuDaGuarnicao(diaMes(x.saida));
        linha.appendChild(el);
      }
      P.menuNaLinha(linha, { tipo: 'saida', militar: m, saida: x.saida, ultimo: x.ultimo || null, dias: x.dias || [] });
      g.linhas.appendChild(linha);
    });
    return g.caixa;
  }

  window.RosterWork.escalasPainelMilitares = { estagiarios: montarEstagiarios, caixaOutraUnidade: caixaOutraUnidade,
    caixaSaidas: caixaSaidas };
})();
