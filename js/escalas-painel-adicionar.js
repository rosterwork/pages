/* ============================================================
   ESCALAS — Adicionar militar (o botão do subcabeçalho do Dia; só
   admin). Sub-tela do painel do dia em caixas de pergunta, uma
   depois da outra e só as que valem (Guia visual › Ações e perguntas):
   Como entra (somente no dia ou no ciclo) e Quem entra
   (o campo de militar, geral-combo-militar, com a lista do como).
   - No dia (pontual): o horário, já com as horas livres dele; onde
     fica: o sistema distribui (refaz o dia do zero com ele; quem está
     fixado fica), a função escolhida (quem está nela sai daquele
     horário) ou no lugar de outro militar (quem sai, de serviço no
     horário, e de quais funções, todas marcadas; quem fica sem
     nenhuma vai para Sem função); e o banco de horas. Vai para o
     rascunho do Dia (escalas-painel-editar.js); na função escolhida e
     no lugar de outro, a prévia refaz o dia em volta do que está
     fixado, mexendo o mínimo.
   - No ciclo: quem está fora entra; quem já está no ciclo escolhe o
     último serviço no ciclo atual entre as três últimas datas (mudar
     de ciclo); quem já serve pelo ciclo no dia não muda. Vai para o
     rascunho do ciclo (escalas-painel-ciclo.js).
   Nada grava até o Salvar do rodapé do painel (escalas-painel-salvar.js).
   Trocar uma resposta limpa as que dependiam dela. As listas de quem
   entra e de quem sai ficam em escalas-painel-adicionar-listas.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e os campos de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function listas() { return RosterWork.escalasPainelAdicionarListas; }
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
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    var est = { como: 'dia', item: null, mil: null, periodos: [], onde: 'sistema', posto: null, funcao: null,
      sai: null, funcoes: [], banco: 'sim', ultimo: null };
    var el = {}, pedido = 0, onde = null, combo = null, comboSai = null, chaveSai = '';

    function carregar() {
      var meu = ++pedido;
      est.item = null; est.mil = null;
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      var leitura = est.como === 'dia'
        ? RosterWork.escalasDados.disponiveis(uid, iso, uid).then(function (r) { return r ? listas().dia(r) : null; })
        : RosterWork.escalasDados.continuosListar(uid, iso).then(function (d) { return d && d.ok ? listas().ciclo(d.militares) : null; });
      leitura.then(function (lista) {
        if (meu !== pedido || !el.combo.isConnected) return;
        if (!lista) { combo.definir(msg().falhaCarregar, true); return; }
        combo.preencher(lista);
      });
    }

    function escolher(item) {
      var m = item.m;
      est.item = item; est.mil = m;
      est.onde = 'sistema'; est.posto = null; est.funcao = null; est.sai = null; est.funcoes = []; est.banco = 'sim'; chaveSai = '';
      if (onde) { el.ondeLugar.textContent = ''; onde = null; }
      if (est.como === 'dia') est.periodos = (m.livres || []).length ? m.livres.map(function (l) { return { hi: l.hi, hf: l.hf }; }) : [{ hi: '08:00', hf: '08:00' }];
      /* no ciclo: vem marcada a mais recente das três últimas datas */
      var datas = m.ultimos_servicos || [];
      est.ultimo = datas.length ? datas[datas.length - 1] : null;
      if (est.como === 'ciclo') montarDatas();
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

    /* ---------- montagem ---------- */

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

    /* De quais funções: as funções de quem sai no horário, todas marcadas */
    function montarFuncoes() {
      var s = est.sai && est.sai.s;
      el.funcoesLista.textContent = '';
      el.funcoesRotulo.classList.toggle('oculto', !s);
      if (!s) return;
      est.funcoes = s.funcoes.map(function () { return true; });
      el.marcarFuncoes = Q.marcar(el.funcoesLista, s.funcoes.map(function (f) {
        return { texto: L().funcaoNoHorario(api.funcaoNoPosto(f.funcao, f.posto), H.textoPeriodos(f.x.map(H.periodo))), marcado: true };
      }), function (marcados) {
        est.funcoes = s.funcoes.map(function (f, i) { return marcados.indexOf(i) >= 0; });
        atualizar();
      });
    }

    /* Quem sai: a lista acompanha o horário (quem não está mais de serviço nele sai da escolha) */
    function atualizarSai() {
      var chave = JSON.stringify(est.periodos);
      if (chave === chaveSai) return;
      chaveSai = chave;
      var itens = listas().sai(est.periodos, est.mil && est.mil.cpf);
      if (est.sai) { est.sai = itens.filter(function (i) { return i.cpf === est.sai.cpf; })[0] || null; montarFuncoes(); }
      comboSai.preencher(itens);
    }

    function criarCombo(caixa, opcoes) {
      var inp = caixa.querySelector('input');
      inp.id = 'escala-adicionar-campo-' + (++conta);
      return RosterWork.comboMilitar.criar(inp, caixa.querySelector('.dropdown-menu'), opcoes);
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-adicionar');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      [].forEach.call(tela.querySelectorAll('.escala-adicionar-data'), function (s) { s.textContent = D.diaMesExtenso(iso); });
      el = {
        quem: q('.escala-adicionar-quem'), combo: q('.escala-adicionar-combo'), assume: q('.escala-adicionar-assume'),
        ajudas: tela.querySelectorAll('.escala-adicionar-ajuda'),
        horario: q('.escala-adicionar-horario'), periodos: q('.escala-adicionar-periodos'),
        ondeBloco: q('.escala-adicionar-onde-bloco'), ondeLugar: q('.escala-adicionar-onde'), lugar: q('.escala-adicionar-lugar'),
        sai: q('.escala-adicionar-sai'), funcoesRotulo: q('.escala-adicionar-funcoes-rotulo'), funcoesLista: q('.escala-adicionar-funcoes'),
        efeito: q('.escala-adicionar-efeito'), banco: q('.escala-adicionar-banco'), contabilizar: q('.escala-adicionar-contabilizar'),
        ultimo: q('.escala-adicionar-ultimo'), ultimoRotulo: q('.escala-adicionar-ultimo-rotulo'),
        datas: q('.escala-adicionar-datas'), mudar: q('.escala-adicionar-mudar'), info: q('.escala-adicionar-ciclo-info')
      };
      ligarRadios(q('.escala-adicionar-como'), function (v) {
        est.como = v;
        if (onde) { el.ondeLugar.textContent = ''; onde = null; }
        carregar();
        atualizar();
      })('dia');
      combo = criarCombo(el.combo, {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
      });
      comboSai = criarCombo(el.sai, {
        atual: function () { return est.sai; },
        aoEscolher: function (item) { est.sai = item; montarFuncoes(); atualizar(); },
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDeServico, filtroVazio: msg().ninguemEncontrado }
      });
      el.regua = RosterWork.horario.criarRegua('afastada');
      if (el.regua) q('.escala-adicionar-regua').appendChild(el.regua);
      el.marcarOnde = ligarRadios(q('.escala-adicionar-onde-opcoes'), function (v) {
        est.onde = v; est.posto = null; est.funcao = null; est.sai = null; est.funcoes = []; chaveSai = '';
        if (onde) { el.ondeLugar.textContent = ''; onde = null; }
        montarFuncoes();
        atualizar();
      });
      el.marcarBanco = ligarRadios(el.banco, function (v) { est.banco = v; });
      corpo.appendChild(tela);
      carregar();
      atualizar();
    }

    /* ---------- desenho ---------- */

    function nota(caixa, texto) {
      caixa.classList.toggle('oculto', !texto);
      if (texto) caixa.querySelector('.nota-texto').textContent = texto;
    }
    function mostra(caixa, sim) { caixa.classList.toggle('oculto', !sim); }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var m = est.mil, como = est.como;
      mostra(el.quem, true);
      [].forEach.call(el.ajudas, function (a) { mostra(a, a.getAttribute('data-como') === como); });
      ['horario', 'ondeBloco', 'banco', 'ultimo', 'mudar', 'info'].forEach(function (k) { mostra(el[k], false); });
      nota(el.assume, m && m.assume ? (m.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(m), '') : '');
      if (!m) { pronto(L().escolhaQuem, false); return; }
      if (como === 'ciclo') { desenharCiclo(m); return; }
      desenharDia(m);
    }

    /* o botão do rodapé: o texto diz o que falta ou o que vai acontecer; ligado só com tudo respondido */
    function pronto(texto, ligado) {
      api.rotuloAplicar(texto);
      api.travarAplicar(!ligado);
    }

    function desenharDia(m) {
      var nome = nomeDe(m);
      /* o horário: o que cruza o que ele já tem no dia fica vermelho e desliga o botão; o dia todo apaga o + */
      mostra(el.horario, true);
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
      var conflito = est.periodos.some(emConflito);

      /* onde fica: o sistema, a função escolhida ou no lugar de outro militar */
      mostra(el.ondeBloco, true);
      el.marcarOnde(est.onde);
      mostra(el.ondeLugar, est.onde === 'funcao');
      if (est.onde === 'funcao' && !onde) {
        onde = Q.onde(el.ondeLugar, { postos: api.dados().postos || [], situacao: situacao,
          aoMudar: function (posto, funcao) { est.posto = posto; est.funcao = funcao; atualizar(); } });
      }
      mostra(el.lugar, est.onde === 'lugar');
      if (est.onde === 'lugar') atualizarSai();
      nota(el.efeito, efeitoDia(m));

      var respondido = est.onde === 'sistema' || (est.onde === 'funcao' && est.posto && est.funcao)
        || (est.onde === 'lugar' && est.sai && est.funcoes.some(Boolean));
      /* o banco de horas, quando onde fica está respondido */
      mostra(el.banco, !!respondido);
      el.contabilizar.textContent = L().bancoSim(H.horasTexto(minutos()));
      el.marcarBanco(est.banco);

      if (est.onde === 'funcao') pronto(est.funcao ? L().porNaFuncao(nome, est.funcao) : L().escolhaFuncao, !!respondido && !conflito);
      else if (est.onde === 'lugar') {
        pronto(!est.sai ? L().escolhaQuemSai : !est.funcoes.some(Boolean) ? L().marqueFuncao : L().porNoLugar(nome, nomeDe(est.sai)),
          !!respondido && !conflito);
      } else pronto(L().adicionarNoDia(nome, data), !conflito);
    }

    /* o que acontece com quem está em volta: quem sai da função escolhida, ou o que sobra para quem sai */
    function efeitoDia() {
      if (est.onde === 'funcao' && est.posto && est.funcao) {
        var partes = ocupantes(est.posto, est.funcao).map(function (o) {
          var pr = H.periodo(o.x);
          return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
        });
        return partes.length ? msg().avisoEfeito(partes) : '';
      }
      if (est.onde === 'lugar' && est.sai) {
        var s = est.sai.s, nome = nomeDe(s.m);
        var saem = s.funcoes.filter(function (f, i) { return est.funcoes[i]; });
        if (!saem.length) return '';
        var ficam = s.funcoes.filter(function (f, i) { return !est.funcoes[i]; });
        var nomesSaem = saem.map(function (f) { return api.funcaoNoPosto(f.funcao, f.posto); });
        return ficam.length
          ? L().lugarSaiContinua(nome, nomesSaem, ficam.map(function (f) { return api.funcaoNoPosto(f.funcao, f.posto); }))
          : L().lugarSaiSem(nome, nomesSaem, H.textoPeriodos(est.periodos));
      }
      return '';
    }

    /* no ciclo: quem está fora entra; quem já está escolhe o último serviço no ciclo atual; quem já serve no dia não muda */
    function desenharCiclo(m) {
      var datas = m.ultimos_servicos || [];
      var mudar = m.estado !== 'fora' && !m.serve_hoje;
      mostra(el.ultimo, mudar && datas.length > 0);
      if (mudar && datas.length) {
        el.ultimoRotulo.textContent = L().ultimoRotulo(nomeDe(m));
        el.marcarData(est.ultimo);
      }
      var frases = mudar ? C.frasesMudar(m, est.ultimo, iso) : null;
      nota(el.mudar, m.serve_hoje ? L().cicloServeHoje(nomeDe(m), data) : frases ? frases.alerta : '');
      nota(el.info, m.serve_hoje ? '' : frases ? frases.info : L().cicloEntrar(D.diaMesExtenso(iso)));
      pronto(L().botaoContinuar, !m.serve_hoje);
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      var m = est.mil;
      if (!m) return;
      if (est.como === 'ciclo') { aplicarCiclo(m); return; }
      if (est.periodos.some(emConflito)) return;   // o botão já fica desligado
      var js = janelas(), soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      if (soma(H.uniao(js)) !== soma(js)) { RosterWork.avisar({ tipo: 'erro', mensagem: L().erroPeriodos }); return; }
      var periodos = est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf }; });
      var pontual = { contabilizar: est.banco === 'sim' };
      if (est.onde === 'funcao') {
        if (!est.posto || !est.funcao) return;
        api.aplicarColocacao({ cpf: m.cpf, posto: est.posto, funcao: est.funcao, periodos: periodos, sistema: false, pontual: pontual });
      } else if (est.onde === 'lugar') {
        if (!est.sai) return;
        /* entra como pontual e senta em cada função marcada de quem sai, nos trechos dela no horário */
        api.aplicarColocacao({ cpf: m.cpf, periodos: periodos, sistema: true, pontual: pontual });
        est.sai.s.funcoes.forEach(function (f, i) {
          if (!est.funcoes[i]) return;
          api.aplicarColocacao({ cpf: m.cpf, posto: f.posto, funcao: f.funcao, periodos: f.x.map(H.periodo), sistema: false, pontual: null });
        });
      } else {
        api.aplicarColocacao({ cpf: m.cpf, periodos: periodos, sistema: true, refazer: true, pontual: pontual });
      }
      api.concluir();
    }

    /* quem está fora entra no ciclo; quem já está no ciclo muda de ciclo, vendo antes o que acontece com as trocas, folgas
       e extras dele depois do último serviço escolhido. Vai para o rascunho do ciclo e volta ao dia */
    function aplicarCiclo(m) {
      if (m.serve_hoje) return;   // o botão já fica desligado
      if (m.estado === 'fora') C.entrar(uid, iso, m, api.voltar);
      else C.mudar(uid, iso, m, est.ultimo, api.voltar);
    }

    api.abrir(L().escolhaQuem, montar, aplicar);
  }

  window.RosterWork.escalasPainelAdicionar = { abrir: abrir };
})();
