/* ============================================================
   OP. VERÃO — a aba Guarda-vidas
   A mesma grade do Militares (escalas-militares.js: as pessoas × os
   dias do mês), um bloco por companhia com Operação Verão no mês (o
   nome dela), com a leitura da Op. Verão (op_verao_mes) e dos
   guarda-vidas civis (guarda_vidas_civis_listar), em dois blocos por
   companhia, cada um com o seu total do dia: Militares (quem trabalha
   no mês, pelo posto ou graduação; do mesmo, na ordem em que aparecem
   nos dias, a do banco) e Guarda-vidas civis (os do cadastro, pelo
   nome);
   cada dia de trabalho traz a boia e o horário. A mudança ainda não
   salva (op-verao-rascunho.js) vale.
   Para o administrador da companhia, o nome do guarda-vidas civil abre
   o cadastro dele no painel direito (op-verao-civil.js) e a barra traz
   o Cadastrar guarda-vidas civil (o css/op-verao.css o mostra só nesta
   aba). O dia não abre nada.
   Não cria HTML (clona os moldes) nem escreve estilo.
   RosterWork.opVeraoMilitares.{ ler, chips, linha, blocos, vazia }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var cias = {};         // a última leitura: companhia -> { nome, pode, civis: { id: o civil } }
  var porUnidade = {};   // a unidade do bloco -> a companhia
  var graus = null;      // a antiguidade de cada posto e graduação (lida uma vez): a ordem dos militares

  function msg() { return RW.mensagens.opVerao; }
  function C() { return RW.opVeraoCelula; }
  function soHora(t) { return t ? String(t).split(':')[0] : ''; }

  /* a antiguidade dos postos e graduações, uma vez (sem ela, a ordem dos dias) */
  function lerGraus() {
    if (graus) return Promise.resolve(graus);
    return RW.rpc('buscar_graus_hierarquicos').then(function (lista) {
      if (!lista) return {};
      graus = {};
      lista.forEach(function (g) { graus[g.grau_abreviacao] = g.grau_antiguidade; });
      return graus;
    }, function () { return {}; });
  }

  /* o mês lido: o dia de cada companhia fica no bloco da primeira unidade dela na tela */
  function ler(ids, inicio, fim) {
    return Promise.all([RW.rpc('op_verao_mes', { p_unidade_ids: ids, p_inicio: inicio, p_fim: fim }), lerGraus()]).then(function (lidas) {
      var r = lidas[0], ordemGrau = lidas[1] || {};
      if (!r) throw new Error('falha');
      var porCia = {}, ordem = [];
      ids.forEach(function (uid) {
        var dias = r[uid] || {};
        Object.keys(dias).forEach(function (iso) {
          var cia = String(dias[iso].companhia_id);
          if (!porCia[cia]) { porCia[cia] = { uid: String(uid), dias: {} }; ordem.push(cia); }
          if (porCia[cia].uid === String(uid)) porCia[cia].dias[iso] = dias[iso];
        });
      });
      return Promise.all(ordem.map(function (cia) {
        return RW.rpc('guarda_vidas_civis_listar', { p_unidade: Number(cia) }).then(null, function () { return null; });
      })).then(function (civis) { return montar(porCia, ordem, civis, ordemGrau); });
    });
  }

  /* a forma da grade do Militares: { unidade: { militares: [{ cpf, civil, grad, nome, dias: { dia: { estado, periodos } } }] } } */
  function montar(porCia, ordem, civis, ordemGrau) {
    var saida = {};
    cias = {};
    porUnidade = {};
    ordem.forEach(function (cia, i) {
      var c = porCia[cia], lida = civis[i] && civis[i].ok ? civis[i] : { civis: [], pode_editar: false };
      var info = { nome: (lida.companhia && lida.companhia.nome) || '', pode: !!lida.pode_editar, civis: {} };
      cias[cia] = info;
      porUnidade[c.uid] = cia;
      var pessoas = {}, chaves = [];
      function pessoa(chave, base) {
        if (!pessoas[chave]) { pessoas[chave] = Object.assign({ dias: {} }, base); chaves.push(chave); }
        return pessoas[chave];
      }
      Object.keys(c.dias).sort().forEach(function (iso) {
        var linhas = C().temRascunho(cia, iso) ? C().linhasDoDia(cia, iso) : (c.dias[iso].linhas || []);
        linhas.forEach(function (l) {
          var p = l.civil_id ? pessoa('civil:' + l.civil_id, { cpf: '', civil: l.civil_id, grad: 'GVC', nome: l.nome, nomeCompleto: l.nome_completo || '' })
            : pessoa(l.cpf, { cpf: l.cpf, grad: l.grad, nome: l.nome });
          var d = p.dias[iso] = p.dias[iso] || { estado: 'op-verao', periodos: [] };
          d.periodos.push({ inicio: l.inicio, fim: l.fim, oficial: !!l.oficial });
        });
      });
      (lida.civis || []).forEach(function (cv) {
        info.civis[cv.id] = cv;
        if (cv.ativo) pessoa('civil:' + cv.id, { cpf: '', civil: cv.id, grad: 'GVC', nome: cv.nome, nomeCompleto: cv.nome_completo });
      });
      var lista = chaves.map(function (k) { return pessoas[k]; });
      var posicao = function (p) { var g = ordemGrau[p.grad]; return g == null ? 99 : g; };
      var militares = lista.filter(function (p) { return !p.civil; }).map(function (p, i) { return { p: p, i: i }; })
        .sort(function (a, b) { return posicao(a.p) - posicao(b.p) || a.i - b.i; }).map(function (x) { return x.p; });
      var deles = lista.filter(function (p) { return p.civil; }).sort(function (a, b) {
        return String(a.nomeCompleto || a.nome).localeCompare(String(b.nomeCompleto || b.nome), 'pt-BR');
      });
      saida[c.uid] = { militares: militares, civis: deles };
    });
    barra();
    return saida;
  }

  /* o horário de cada período do dia: a boia e as horas (o Oficial de Praia, com a dica) */
  function chips(celula, periodos) {
    (periodos || []).slice().sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0; })
      .forEach(function (per) {
        var chip = RW.tpl('tpl-escala-mil-servico');
        if (!chip) return;
        var origem = chip.querySelector('.escala-mil-servico-origem');
        origem.classList.remove('oculto');
        origem.querySelector('use').setAttribute('href', 'icones/todos.svg#icone-boia');
        chip.setAttribute('data-situacao', 'op-verao');   // para o efetivo do dia (escalas-militares-dias.js)
        chip.querySelector('.linha-escalado-hora-ini').textContent = soHora(per.inicio);
        chip.querySelector('.linha-escalado-hora-fim').textContent = soHora(per.fim);
        if (per.oficial) chip.setAttribute('data-dica', msg().oficialDica);
        celula.appendChild(chip);
      });
  }

  /* abre o cadastro (civil: o cadastrado; sem ele, Cadastrar) da companhia; mudou: a grade lê de novo */
  function cadastro(cia, civil) {
    var info = cias[cia];
    if (!info || !info.pode || !RW.opVeraoCivil) return;
    RW.opVeraoCivil.abrir({ unidade: Number(cia), nome: info.nome, civil: civil || null, aoMudar: function () {
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
    } });
  }

  /* a linha de uma pessoa: o guarda-vidas civil tem o texto dele embaixo do nome e, para quem administra, abre o cadastro */
  function linha(el, m, coluna) {
    if (!m.civil) return;
    var cia = porUnidade[String(coluna.id)], info = cias[cia];
    el.querySelector('.escala-mil-pessoa-cpf').textContent = msg().civilSub;
    var nome = el.querySelector('.escala-mil-pessoa');
    if (!nome || !info || !info.pode) return;
    nome.classList.add('op-verao-civil--edita');
    nome.setAttribute('role', 'button');
    nome.setAttribute('tabindex', '0');
    function abrir() { cadastro(cia, info.civis[m.civil] || null); }
    nome.addEventListener('click', abrir);
    nome.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  }

  /* o Cadastrar guarda-vidas civil da barra: à vista para quem administra uma companhia da tela */
  function barra() {
    var b = document.querySelector('.conteudo .op-verao-barra-cadastrar');
    if (!b) return;
    var cia = Object.keys(cias).filter(function (k) { return cias[k].pode; })[0];
    b.classList.toggle('oculto', !cia);
    b.setAttribute('data-companhia', cia || '');
    if (b.dataset.ligado) return;
    b.dataset.ligado = '1';
    b.addEventListener('click', function () { cadastro(b.getAttribute('data-companhia'), null); });
  }

  /* os blocos da companhia da unidade (nenhum: ela não tem Operação Verão no mês): Militares e Guarda-vidas civis, cada um
     com o nome da companhia ao lado e a frase própria quando vazio */
  function blocos(c, d) {
    if (!d) return [];
    var info = RW.paginas.escalas && RW.paginas.escalas.companhiaDe ? RW.paginas.escalas.companhiaDe(c.id) : null;
    var col = info ? Object.assign({}, c, { nome: info.nome, nomeCompleto: info.nome, cidade: info.cidade }) : c;
    return [
      { coluna: col, pessoas: d.militares || [], aba: { titulo: msg().blocoMilitares, vazio: msg().semMilitarMes } },
      { coluna: col, pessoas: d.civis || [], aba: { titulo: msg().blocoCivis, vazio: msg().semCivil } }
    ];
  }

  /* a aba sem bloco (nenhuma companhia com Operação Verão no mês): a frase da página (op-verao.js) */
  function vazia() { return RW.paginasFiltradas['op-verao'].vazia(); }

  RW.opVeraoMilitares = { ler: ler, chips: chips, linha: linha, blocos: blocos, vazia: vazia };
})();
