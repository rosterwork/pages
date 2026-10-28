/* ============================================================
   ESCALAS — Adicionar militar (o campo do subcabeçalho do Dia; só
   admin). Sub-tela do painel do dia: o alcance em bolinhas, uma em
   cada linha, e o campo de militar (geral-combo-militar):
   - Adicionar somente no dia: quem tem horas livres no dia, de folga,
     por unidade. Escolhido, o horário (já com as horas livres dele),
     o Onde (o sistema distribui, sem tirar ninguém do lugar, ou a
     função escolhida) e o banco de horas, em bolinhas. Entra como
     pontual; o botão grava (escalas-painel-editar.js) e o sistema
     refaz o dia em volta do que está fixado, mexendo o mínimo.
   - Inserir no ciclo a partir do dia: quem está fora do ciclo e quem
     já está no ciclo (para mudar de ciclo); afastado e quem já tem a
     entrada marcada ficam em "Não podem". Quem já está no ciclo: o
     administrador escolhe o último serviço no ciclo atual entre as
     três últimas datas, e a frase diz quando ele sai do ciclo atual,
     o que sai da escala dele e quando começa o novo. Quem já serve
     pelo ciclo no dia pode ser escolhido, mas nada muda (o Continuar
     fica desligado, com o motivo). O Continuar mostra o que acontece
     com as trocas, folgas e extras e confirma; grava pelo ciclo. A
     confirmação, a gravação (com o Desfazer da entrada de quem estava
     fora), as datas e as frases são do escalas-painel-ciclo.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e o campo de cada abertura

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
    var api = ed(), H = api.horas, Q = RosterWork.escalasPainelQuem, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), data = diaMes(iso);
    var est = { alcance: 'dia', item: null, mil: null, periodos: [], onde: 'sistema', posto: null, funcao: null, banco: 'sim', ultimo: null };
    var el = {}, pedido = 0, onde = null, combo = null;

    /* ---------- as listas ---------- */

    /* só no dia: quem tem horas livres, por unidade (a do painel primeiro), fora quem já entrou como pontual */
    function itensDia(resp) {
      var ja = {}, lista = [], unidade = null;
      (api.rascunho().pontuais || []).forEach(function (x) { ja[x.cpf] = true; });
      (resp || []).forEach(function (m) {
        if (ja[m.cpf]) return;
        if (m.unidade_id !== unidade) { unidade = m.unidade_id; lista.push({ titulo: m.unidade || '' }); }
        var ocupado = (m.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
        lista.push({ cpf: m.cpf, grad: m.grad, nome: m.nome, info: ocupado.length ? msg().ocupadoNoDia(ocupado) : L().infoLivre, m: m });
      });
      return lista;
    }

    /* no ciclo: fora do ciclo, já no ciclo (todos clicáveis) e, apagados, o afastado e quem já tem a entrada marcada */
    function itensCiclo(militares) {
      var fora = [], noCiclo = [], naoPodem = [];
      (militares || []).forEach(function (m) {
        var item = { cpf: m.cpf, grad: m.grad, nome: m.nome, m: m };
        if (m.afastamento) { item.inativo = true; item.info = L().infoAfastado(m.afastamento.motivo, diaMes(m.afastamento.ate)); naoPodem.push(item); return; }
        if (m.estado === 'fora') {
          if (m.entra_em) { item.inativo = true; item.info = L().infoEntraEm(diaMes(m.entra_em)); naoPodem.push(item); return; }
          item.info = L().infoFora;
          fora.push(item);
          return;
        }
        item.info = m.serve_hoje ? L().infoServeHoje : m.ultimo_servico ? L().infoUltimo(diaMes(m.ultimo_servico)) : '';
        noCiclo.push(item);
      });
      var lista = [];
      function grupo(titulo, itens) { if (itens.length) lista = lista.concat([{ titulo: titulo }], itens); }
      grupo(L().grupoFora, fora);
      grupo(L().grupoNoCiclo, noCiclo);
      grupo(L().grupoNaoPodem, naoPodem);
      return lista;
    }

    function carregar() {
      var meu = ++pedido;
      est.item = null; est.mil = null;
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      var leitura = est.alcance === 'dia'
        ? RosterWork.escalasDados.disponiveis(api.unidadeId(), iso, api.unidadeId()).then(function (r) { return r ? itensDia(r) : null; })
        : RosterWork.escalasDados.continuosListar(api.unidadeId(), iso).then(function (d) { return d && d.ok ? itensCiclo(d.militares) : null; });
      leitura.then(function (lista) {
        if (meu !== pedido || !el.combo.isConnected) return;
        if (!lista) { combo.definir(msg().falhaCarregar, true); return; }
        combo.preencher(lista);
      });
    }

    function escolher(item) {
      var m = item.m;
      est.item = item; est.mil = m;
      if (est.alcance === 'dia') est.periodos = (m.livres || []).length ? m.livres.map(function (l) { return { hi: l.hi, hf: l.hf }; }) : [{ hi: '08:00', hf: '08:00' }];
      /* no ciclo: vem marcada a mais recente das três últimas datas */
      var datas = m.ultimos_servicos || [];
      est.ultimo = datas.length ? datas[datas.length - 1] : null;
      montarDatas();
      atualizar();
    }

    /* ---------- leitura do estado ---------- */

    function janelas() { return est.periodos.map(H.faixa); }
    function ocupadoDele() { return ((est.mil && est.mil.ocupado) || []).map(H.faixa); }
    function emConflito(per) { var f = H.faixa(per); return ocupadoDele().some(function (o) { return !!H.cruza(f, o); }); }
    function minutos() { return H.uniao(janelas()).reduce(function (s, w) { return s + w[1] - w[0]; }, 0); }
    function ocupantes(posto, nf) { return RosterWork.escalasPainelLinhaAplicar.ocupantes(posto, nf, est.periodos, est.mil && est.mil.cpf); }
    function situacao(posto, nf) {
      var nomes = ocupantes(posto, nf).map(function (o) { return nomeDe(o.m); });
      nomes = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
      return nomes.length ? msg().itemSai(nomes) : msg().itemVazia;
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

    /* as três últimas datas do ciclo atual, em bolinhas, com o dia da semana */
    function montarDatas() {
      el.marcarData = C.datas(el.datas, (est.mil && est.mil.ultimos_servicos) || [], function (v) { est.ultimo = v; atualizar(); });
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-adicionar');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      [].forEach.call(tela.querySelectorAll('.escala-adicionar-data'), function (s) { s.textContent = D.diaMesExtenso(iso); });
      ligarRadios(q('.escala-adicionar-alcance'), function (v) { est.alcance = v; carregar(); atualizar(); })('dia');
      el = {
        combo: q('.escala-adicionar-combo'), ajudaDia: q('.escala-adicionar-ajuda-dia'), ajudaCiclo: q('.escala-adicionar-ajuda-ciclo'),
        dia: q('.escala-adicionar-dia'), ciclo: q('.escala-adicionar-ciclo'), assume: q('.escala-adicionar-assume'),
        periodos: q('.escala-adicionar-periodos'), ondeLugar: q('.escala-adicionar-onde'), efeito: q('.escala-adicionar-efeito'),
        contabilizar: q('.escala-adicionar-contabilizar'), ultimo: q('.escala-adicionar-ultimo'), ultimoRotulo: q('.escala-adicionar-ultimo-rotulo'),
        datas: q('.escala-adicionar-datas'), mudar: q('.escala-adicionar-mudar'), info: q('.escala-adicionar-ciclo-info')
      };
      var inp = el.combo.querySelector('input');
      inp.id = 'escala-adicionar-combo-' + (++conta);
      combo = RosterWork.comboMilitar.criar(inp, el.combo.querySelector('.dropdown-menu'), {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
      });
      el.regua = RosterWork.horario.criarRegua('afastada');
      if (el.regua) q('.escala-adicionar-regua').appendChild(el.regua);
      el.marcarOnde = ligarRadios(q('.escala-adicionar-onde-bloco'), function (v) { est.onde = v; atualizar(); });
      el.marcarBanco = ligarRadios(q('.escala-adicionar-banco'), function (v) { est.banco = v; });
      corpo.appendChild(tela);
      carregar();
      atualizar();
    }

    function nota(caixa, texto) {
      caixa.classList.toggle('oculto', !texto);
      if (texto) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var m = est.mil, dia = est.alcance === 'dia';
      el.ajudaDia.classList.toggle('oculto', !dia);
      el.ajudaCiclo.classList.toggle('oculto', dia);
      el.dia.classList.toggle('oculto', !(dia && m));
      el.ciclo.classList.toggle('oculto', !(!dia && m));
      api.rotuloAplicar(dia ? (m ? L().adicionarNoDia(nomeDe(m), data) : L().botaoAdicionar) : L().botaoContinuar);
      if (!m) { api.travarAplicar(true); return; }
      if (!dia) { desenharCiclo(m); return; }
      nota(el.assume, m.assume ? (m.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(m), '') : '');
      /* o horário: o que cruza o que ele já tem no dia fica vermelho e desliga o Adicionar; o dia todo apaga o + */
      el.periodos.textContent = '';
      var diaTodo = minutos() >= 1440;
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, erro: emConflito(per),
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null,
          aoAdicionar: i === 0 && !diaTodo ? adicionarPeriodo : null,
          adicionarDesligado: i === 0 && diaTodo ? L().diaTodoDica : null
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
      nota(el.efeito, partes.length ? msg().avisoEfeito(partes) : '');
      el.contabilizar.textContent = L().bancoSim(H.horasTexto(minutos()));
      el.marcarBanco(est.banco);
      api.travarAplicar(est.periodos.some(emConflito));
    }

    /* no ciclo: quem está fora entra; quem já está escolhe o último serviço no ciclo atual; quem já serve no dia não muda */
    function desenharCiclo(m) {
      var datas = m.ultimos_servicos || [];
      var mudar = m.estado !== 'fora' && !m.serve_hoje;
      el.ultimo.classList.toggle('oculto', !(mudar && datas.length));
      if (mudar && datas.length) {
        el.ultimoRotulo.textContent = L().ultimoRotulo(nomeDe(m));
        el.marcarData(est.ultimo);
      }
      var frases = mudar ? C.frasesMudar(m, est.ultimo, iso) : null;
      nota(el.mudar, m.serve_hoje ? L().cicloServeHoje(nomeDe(m), data) : frases ? frases.alerta : '');
      nota(el.info, m.serve_hoje ? '' : frases ? frases.info : L().cicloEntrar(D.diaMesExtenso(iso)));
      api.travarAplicar(!!m.serve_hoje);
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      var m = est.mil;
      if (!m) return;
      if (est.alcance === 'ciclo') { aplicarCiclo(m); return; }
      if (est.periodos.some(emConflito)) return;   // o botão já fica desligado
      var js = janelas(), soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      var erro = soma(H.uniao(js)) !== soma(js) ? L().erroPeriodos
        : (est.onde === 'funcao' && (!est.posto || !est.funcao)) ? L().erroOnde : '';
      if (erro) { RosterWork.avisar({ tipo: 'erro', mensagem: erro }); return; }
      api.aplicarColocacao({ cpf: m.cpf, posto: est.posto, funcao: est.funcao,
        periodos: est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf }; }),
        sistema: est.onde === 'sistema', pontual: { contabilizar: est.banco === 'sim' } });
      api.concluir();
    }

    /* quem está fora entra com a confirmação (e o Desfazer no resumo); quem já está no ciclo muda de ciclo, vendo antes o
       que acontece com as trocas, folgas e extras dele depois do último serviço escolhido */
    function aplicarCiclo(m) {
      if (m.serve_hoje) return;   // o botão já fica desligado
      if (m.estado === 'fora') C.entrar(api.unidadeId(), iso, m, api.recarregar);
      else C.mudar(api.unidadeId(), iso, m, est.ultimo, api.recarregar);
    }

    api.abrir(L().botaoAdicionar, montar, aplicar);
  }

  window.RosterWork.escalasPainelAdicionar = { abrir: abrir };
})();
