/* ============================================================
   ESCALAS — Adicionar militar (o campo do subcabeçalho do Dia; só
   admin). Sub-tela do painel do dia, com a escolha do alcance:
   - Só neste dia: quem tem horas livres no dia, de folga, por unidade
     (grupos que abrem e fecham). Escolhido, tudo numa caixa só: o
     horário (já com as horas livres dele), o Onde (o sistema distribui,
     sem tirar ninguém do lugar, ou a função escolhida) e o banco de
     horas. Entra como pontual; o Adicionar grava
     (escalas-painel-editar.js) e o sistema refaz o dia em volta do que
     está fixado, mexendo o mínimo.
   - No ciclo, a partir do dia: quem está fora da escala da unidade e
     quem já está no ciclo, em outros dias (para mudar de ciclo; a
     mensagem diz desde quando, o último serviço nele e quando começa o
     novo). Afastado, quem já serve pelo ciclo no dia e quem tem a
     entrada marcada vão para "Não podem". O Continuar mostra o que
     acontece com as trocas, folgas e extras e confirma; grava pelo
     ciclo e relê o dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-adicionar-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  function abrir() {
    var api = ed(), H = api.horas, Q = RosterWork.escalasPainelQuem, S = RosterWork.escalasPainelServico;
    if (!api.dados()) return;
    var iso = api.iso(), data = diaMes(iso);
    var est = { alcance: 'dia', mil: null, periodos: [], onde: 'sistema', posto: null, funcao: null, banco: 'sim' };
    var el = {}, pedido = 0, onde = null;

    /* ---------- as listas ---------- */

    /* só neste dia: quem tem horas livres, por unidade (a do painel primeiro, aberta), fora quem já entrou como pontual */
    function gruposDia(resp) {
      var ja = {}, grupos = [], atual = null;
      (api.rascunho().pontuais || []).forEach(function (x) { ja[x.cpf] = true; });
      (resp || []).forEach(function (m) {
        if (ja[m.cpf]) return;
        if (!atual || atual.unidadeId !== m.unidade_id) {
          atual = { unidadeId: m.unidade_id, rotulo: L().grupoFolga(m.unidade || ''), aberto: !grupos.length, itens: [] };
          grupos.push(atual);
        }
        var ocupado = (m.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
        atual.itens.push({ cpf: m.cpf, grad: m.grad, nome: m.nome, info: ocupado.length ? msg().ocupadoNoDia(ocupado) : L().infoLivre, m: m });
      });
      return grupos;
    }

    /* no ciclo: fora da escala e no ciclo em outros dias (abertos); quem não pode, com o motivo (fechado) */
    function gruposCiclo(militares) {
      var fora = [], noCiclo = [], naoPodem = [];
      (militares || []).forEach(function (m) {
        var item = { cpf: m.cpf, grad: m.grad, nome: m.nome, m: m };
        if (m.afastamento) { item.pode = false; item.info = L().infoAfastado(m.afastamento.motivo, diaMes(m.afastamento.ate)); naoPodem.push(item); return; }
        if (m.estado === 'fora') {
          if (m.entra_em) { item.pode = false; item.info = L().infoEntraEm(diaMes(m.entra_em)); naoPodem.push(item); return; }
          fora.push(item);
          return;
        }
        if (m.serve_hoje) { item.pode = false; item.info = L().infoServeHoje(data); naoPodem.push(item); return; }
        item.info = m.ultimo_servico ? L().infoUltimo(diaMes(m.ultimo_servico)) : '';
        noCiclo.push(item);
      });
      return [{ rotulo: L().grupoFora, aberto: true, itens: fora }, { rotulo: L().grupoNoCiclo, aberto: true, itens: noCiclo },
        { rotulo: L().grupoNaoPodem, erro: true, itens: naoPodem }];
    }

    function carregar() {
      var lugar = el.quem, meu = ++pedido;
      Q.carregando(lugar);
      var leitura = est.alcance === 'dia'
        ? RosterWork.escalasDados.disponiveis(api.unidadeId(), iso, api.unidadeId()).then(function (r) { return r ? gruposDia(r) : null; })
        : RosterWork.escalasDados.continuosListar(api.unidadeId(), iso).then(function (d) { return d && d.ok ? gruposCiclo(d.militares) : null; });
      leitura.then(function (grupos) {
        if (meu !== pedido || !lugar.isConnected) return;
        if (!grupos) { Q.falha(lugar); return; }
        Q.montar(lugar, { grupos: grupos, foco: true, aoEscolher: escolher });
      });
    }

    function escolher(item) {
      var m = item.m;
      est.mil = m;
      /* só neste dia: o horário vem com as horas livres dele */
      if (est.alcance === 'dia') est.periodos = (m.livres || []).length ? m.livres.map(function (l) { return { hi: l.hi, hf: l.hf }; }) : [{ hi: '08:00', hf: '08:00' }];
      atualizar();
    }

    /* ---------- leitura do estado ---------- */

    function janelas() { return est.periodos.map(H.faixa); }
    function ocupadoDele() { return ((est.mil && est.mil.ocupado) || []).map(H.faixa); }
    function emConflito(per) { var f = H.faixa(per); return ocupadoDele().some(function (o) { return !!H.cruza(f, o); }); }
    function minutos() { return janelas().reduce(function (s, w) { return s + w[1] - w[0]; }, 0); }

    /* quem está na função nesses horários (sai dela): "Sd. Godoy fica sem função das 14h às 20h" */
    function ocupantes(posto, nomeFuncao) {
      var r = [], f = api.acharFuncao(posto, nomeFuncao);
      ((f && f.militares) || []).forEach(function (o) {
        (o.periodos || []).forEach(function (per) {
          janelas().forEach(function (w) { var x = H.cruza(w, H.faixa(per)); if (x) r.push({ m: o, x: x }); });
        });
      });
      return r;
    }
    function situacao(posto, nomeFuncao) {
      var nomes = ocupantes(posto, nomeFuncao).map(function (o) { return nomeDe(o.m); });
      nomes = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
      return nomes.length ? msg().itemSai(nomes) : msg().itemVazia;
    }
    /* quem tem hoje o papel que ele vai assumir (só quando é um) */
    function quemTemPapel(papel) {
      var alvo = papel === 'chefe_socorro' ? /^chefe de socorro$/i : /^oficial de área$/i;
      var nomes = {}, ps = api.papeis(api.dados());
      Object.keys(ps).forEach(function (k) {
        if (alvo.test(ps[k].funcao)) Object.keys(ps[k].por).forEach(function (cpf) { nomes[ps[k].por[cpf].nome] = true; });
      });
      var lista = Object.keys(nomes);
      return lista.length === 1 ? lista[0] : '';
    }

    /* ---------- montagem e desenho ---------- */

    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(janelas().concat(ocupadoDele())));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      atualizar();
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-adicionar');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      [].forEach.call(tela.querySelectorAll('.escala-adicionar-data'), function (s) { s.textContent = data; });
      var trilho = q('.escala-adicionar-alcance');
      if (RosterWork.abas) RosterWork.abas.ligar(trilho, function (aba) {
        est.alcance = aba.getAttribute('data-alcance');
        est.mil = null;
        carregar();
        atualizar();
      });
      el = {
        quem: q('.escala-adicionar-quem'), cartao: q('.escala-adicionar-cartao'), nome: q('.escala-adicionar-nome'),
        situacao: q('.escala-adicionar-situacao'), dia: q('.escala-adicionar-dia'), ciclo: q('.escala-adicionar-ciclo'),
        assume: q('.escala-adicionar-assume'), periodos: q('.escala-adicionar-periodos'), ondeLugar: q('.escala-adicionar-onde'),
        efeito: q('.escala-adicionar-efeito'), contabilizar: q('.escala-adicionar-contabilizar'), mudar: q('.escala-adicionar-mudar'),
        cicloTexto: q('.escala-adicionar-ciclo-texto')
      };
      el.regua = RosterWork.horario.criarRegua('afastada');
      if (el.regua) q('.escala-adicionar-regua').appendChild(el.regua);
      var blocos = el.dia.querySelectorAll('.escala-linha-bloco');
      el.marcarOnde = ligarRadios(blocos[1], function (v) { est.onde = v; atualizar(); });
      el.marcarBanco = ligarRadios(blocos[2], function (v) { est.banco = v; });
      corpo.appendChild(tela);
      carregar();
      atualizar();
    }

    function nota(caixa, mostrar, texto) {
      caixa.classList.toggle('oculto', !mostrar);
      if (mostrar) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var m = est.mil, dia = est.alcance === 'dia';
      api.rotuloAplicar(dia ? L().botaoAdicionar : L().botaoContinuar);
      el.cartao.classList.toggle('oculto', !m);
      if (!m) { api.travarAplicar(true); return; }
      el.nome.textContent = nomeDe(m);
      el.situacao.textContent = dia ? L().adicionarSoEm(m.unidade || '', data) : L().adicionarNoCiclo(data);
      el.dia.classList.toggle('oculto', !dia);
      el.ciclo.classList.toggle('oculto', dia);
      if (!dia) {
        var mudar = m.estado !== 'fora';
        nota(el.mudar, mudar, mudar ? L().cicloMudar(diaMes(m.desde), m.ultimo_servico ? diaMes(m.ultimo_servico) : '', data) : '');
        el.cicloTexto.textContent = mudar ? L().cicloMudarAviso(data) : L().cicloEntrar(data);
        api.travarAplicar(false);
        return;
      }
      nota(el.assume, !!m.assume, m.assume ? (m.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(m), quemTemPapel(m.assume)) : '');
      /* o horário: o que cruza o que ele já tem no dia fica vermelho e desliga o Adicionar */
      el.periodos.textContent = '';
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, erro: emConflito(per),
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null,
          aoAdicionar: i === 0 ? adicionarPeriodo : null
        });
        if (linha) el.periodos.appendChild(linha);
      });
      H.regua(el.regua, ((m.ocupado || []).map(function (o) { return { hi: o.hi, hf: o.hf }; }))
        .concat(est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf, classe: 'novo' }; })));
      /* Onde: o sistema distribui, ou a função escolhida (quem está nela sai daquele horário) */
      el.marcarOnde(est.onde);
      el.ondeLugar.classList.toggle('oculto', est.onde !== 'funcao');
      if (est.onde === 'funcao' && !onde) {
        onde = Q.onde(el.ondeLugar, { postos: api.dados().postos || [], situacao: situacao,
          aoMudar: function (posto, funcao) { est.posto = posto; est.funcao = funcao; atualizar(); } });
      }
      var partes = est.onde === 'funcao' && est.posto && est.funcao ? ocupantes(est.posto, est.funcao).map(function (o) {
        var pr = H.periodo(o.x);
        return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
      }) : [];
      nota(el.efeito, partes.length > 0, partes.length ? msg().avisoEfeito(partes) : '');
      el.contabilizar.textContent = L().bancoSim(H.horasTexto(minutos()));
      el.marcarBanco(est.banco);
      api.travarAplicar(est.periodos.some(emConflito));
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      var m = est.mil;
      if (!m) return;
      if (est.alcance === 'ciclo') { aplicarCiclo(m); return; }
      if (est.periodos.some(emConflito)) return;   // o botão já fica desligado
      var js = janelas();
      var soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      var erro = soma(H.uniao(js)) !== soma(js) ? L().erroPeriodos
        : (est.onde === 'funcao' && (!est.posto || !est.funcao)) ? L().erroOnde : '';
      if (erro) { RosterWork.avisar({ tipo: 'erro', mensagem: erro }); return; }
      api.aplicarColocacao({ cpf: m.cpf, posto: est.posto, funcao: est.funcao,
        periodos: est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf }; }),
        sistema: est.onde === 'sistema', pontual: { contabilizar: est.banco === 'sim' } });
      api.concluir();
    }

    /* no ciclo: quem está fora entra com a confirmação; quem já está no ciclo muda de ciclo, vendo antes o que
       acontece com as trocas, folgas e extras dele a partir do dia */
    function aplicarCiclo(m) {
      var mudancas = [{ cpf: m.cpf, acao: 'adicionar' }];
      if (m.estado === 'fora') {
        RosterWork.confirmar({ tipo: 'aviso', mensagem: L().cicloConfirmarEntrar(nomeDe(m), data), textoConfirmar: L().botaoNoCiclo,
          aoConfirmar: function () { S.salvarCiclo(mudancas); } });
        return;
      }
      S.confirmarCiclo(m.cpf, { mensagem: L().cicloConfirmarMudar(nomeDe(m), data), escala: L().cicloEscalaMudar(data), botao: L().botaoMudarCiclo },
        function () { S.salvarCiclo(mudancas); });
    }

    api.abrir(L().botaoAdicionar, montar, aplicar);
  }

  window.RosterWork.escalasPainelAdicionar = { abrir: abrir };
})();
