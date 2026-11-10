/* ============================================================
   ESCALAS — Adicionar militar (o botão do subcabeçalho do Dia; só
   admin). Sub-tela do painel do dia em caixas de pergunta, uma
   depois da outra e só as que valem (Guia visual › Ações e perguntas):
   Como entra (somente no dia ou na guarnição do dia) e Quem entra
   (o campo de militar, geral-combo-militar, com a lista do como; no
   dia, a Unidade ao lado, começando na do painel, com as unidades
   que têm alguém de horas livres, e a lista só dela).
   - No dia (pontual): o horário, já com as horas livres dele; onde
     fica (a caixa comum, escalas-painel-onde.js): o sistema
     distribui (refaz o dia do zero com ele; quem está fixado fica),
     a função escolhida ou no lugar de outro militar; e o banco de
     horas. Vai para o rascunho do Dia (escalas-painel-editar.js); na
     função escolhida e no lugar de outro, a prévia refaz o dia em
     volta do que está fixado, mexendo o mínimo.
   - Na guarnição do dia (a letra vem da leitura do dia): quem está
     fora da escala entra nela a partir do dia; quem é de outra
     guarnição muda para ela a partir do dia, com o que acontece com as
     trocas, folgas e extras dele (a mesma lista da aba Guarnições, na
     própria sub-tela); quem já é da guarnição do dia não muda. Vai
     para o rascunho das guarnições (escalas-painel-ciclo.js).
   Sem botão próprio: a resposta completa entra no rascunho ao vivo
   (escalas-painel-editar.js › aoVivo) e as telas mostram como fica;
   horário em conflito deixa o Salvar desligado. Nada grava até o
   Salvar do rodapé largo (escalas-painel-salvar.js).
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
    var api = ed(), H = api.horas, C = RosterWork.escalasPainelCiclo, D = RosterWork.data;
    if (!api.dados()) return;
    var iso = api.iso(), uid = api.unidadeId(), data = diaMes(iso);
    var letra = api.dados().guarnicao || null;   // a guarnição do dia (sem ela, a companhia não tem o dia da A)
    var est = { como: 'dia', item: null, mil: null, periodos: [], banco: 'sim', unidade: null };
    var el = {}, pedido = 0, combo = null, onde = null, livres = null, efeito = null;
    var analise = { chave: '', aviso: null, pedido: 0 };   // o que acontece com quem muda de guarnição (lido uma vez)

    /* a Unidade (só no dia): as unidades com alguém de horas livres; começa na do painel */
    function montarUnidades() {
      var menu = el.unidade.querySelector('.dropdown-menu');
      menu.textContent = '';
      var lista = livres ? listas().unidadesDia(livres) : [];
      if (!lista.some(function (u) { return String(u.id) === String(est.unidade); })) {
        est.unidade = (lista.filter(function (u) { return String(u.id) === String(uid); })[0] || lista[0] || {}).id || null;
      }
      lista.forEach(function (u) {
        var it = RosterWork.tpl('tpl-escala-unidade-item');
        if (!it) return;
        it.textContent = u.nome;
        it.addEventListener('click', function () { est.unidade = u.id; est.item = null; est.mil = null; preencherDia(); atualizar(); });
        menu.appendChild(it);
      });
      var atual = lista.filter(function (u) { return String(u.id) === String(est.unidade); })[0];
      var t = el.unidade.querySelector('.campo-selecao-texto');
      t.textContent = atual ? atual.nome : el.unidadeVazio;
      t.classList.toggle('campo-selecao-texto--vazio', !atual);
      el.unidade.querySelector('.campo-selecao').disabled = !lista.length;
    }
    function preencherDia() {
      montarUnidades();
      combo.preencher(listas().dia(livres, est.unidade));
    }

    function carregar() {
      var meu = ++pedido;
      est.item = null; est.mil = null; livres = null;
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      if (est.como === 'dia') montarUnidades();
      var leitura = est.como === 'dia'
        ? RosterWork.escalasDados.disponiveis(uid, iso, uid)
        : RosterWork.escalasDados.continuosListar(uid, iso).then(function (d) { return d && d.ok ? listas().guarnicao(d.militares, letra) : null; });
      leitura.then(function (r) {
        if (meu !== pedido || !el.combo.isConnected) return;
        if (!r) { combo.definir(msg().falhaCarregar, true); return; }
        if (est.como === 'dia') { livres = r; preencherDia(); return; }
        combo.preencher(r);
      });
    }

    function escolher(item) {
      var m = item.m;
      est.item = item; est.mil = m;
      est.banco = 'sim';
      if (onde) onde.reiniciar();
      if (est.como === 'dia') est.periodos = (m.livres || []).length ? m.livres.map(function (l) { return { hi: l.hi, hf: l.hf }; }) : [{ hi: '08:00', hf: '08:00' }];
      atualizar();
    }

    /* ---------- leitura do estado ---------- */

    function janelas() { return est.periodos.map(H.faixa); }
    function ocupadoDele() { return ((est.mil && est.mil.ocupado) || []).map(H.faixa); }
    function emConflito(per) { var f = H.faixa(per); return ocupadoDele().some(function (o) { return !!H.cruza(f, o); }); }
    function minutos() { return H.uniao(janelas()).reduce(function (s, w) { return s + w[1] - w[0]; }, 0); }

    /* ---------- montagem ---------- */

    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(janelas().concat(ocupadoDele())));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      atualizar();
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
      /* a guarnição do dia (sem a letra, o "do dia" do molde) */
      q('.escala-adicionar-letra').textContent = letra || '';
      q('.escala-adicionar-sem-letra').classList.toggle('oculto', !!letra);
      el = {
        quem: q('.escala-adicionar-quem'), combo: q('.escala-adicionar-combo'), assume: q('.escala-adicionar-assume'),
        ajudas: tela.querySelectorAll('.escala-adicionar-ajuda'),
        unidadeCampo: q('.escala-adicionar-unidade-campo'), unidade: q('.escala-adicionar-unidade'),
        militarRotulo: q('.escala-adicionar-militar-rotulo'),
        horario: q('.escala-adicionar-horario'), periodos: q('.escala-adicionar-periodos'),
        banco: q('.escala-adicionar-banco'), contabilizar: q('.escala-adicionar-contabilizar'),
        mudar: q('.escala-adicionar-mudar'), info: q('.escala-adicionar-ciclo-info')
      };
      el.unidadeVazio = el.unidade.querySelector('.campo-selecao-texto').textContent;
      /* o Onde fica: a caixa comum, no lugar marcado do molde */
      el.ondeBloco = RosterWork.tpl('tpl-escala-onde-fica');
      q('.escala-adicionar-onde-bloco').replaceWith(el.ondeBloco);
      onde = RosterWork.escalasPainelOnde.criar(el.ondeBloco, {
        dados: function () { return api.dados(); },
        periodos: function () { return est.periodos; },
        cpf: function () { return est.mil && est.mil.cpf; },
        aoMudar: atualizar
      });
      ligarRadios(q('.escala-adicionar-como'), function (v) {
        est.como = v;
        onde.reiniciar();
        carregar();
        atualizar();
      })('dia');
      combo = criarCombo(el.combo, {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDisponivel, filtroVazio: msg().ninguemEncontrado }
      });
      /* a barra de horário: com um horário só, arrastar ou clicar muda os campos (com mais de um, ela só mostra) */
      el.barra = RosterWork.regua.criar({ variante: 'afastada', aoMudar: function (f) {
        if (est.periodos.length !== 1) return;
        est.periodos[0].hi = f.hi;
        est.periodos[0].hf = f.hf;
        atualizar();
      } });
      if (el.barra) q('.escala-adicionar-regua').appendChild(el.barra.el);
      el.marcarBanco = ligarRadios(el.banco, function (v) { est.banco = v; atualizar(); });
      efeito = C.efeito(q('.escala-adicionar-efeito'));
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
      /* a Unidade e o rótulo do Militar só no dia (na guarnição, o campo fica como sempre) */
      mostra(el.unidadeCampo, como === 'dia');
      mostra(el.militarRotulo, como === 'dia');
      ['horario', 'ondeBloco', 'banco', 'mudar', 'info'].forEach(function (k) { mostra(el[k], false); });
      efeito.esconder();
      nota(el.assume, m && m.assume ? (m.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(m), '') : '');
      if (!m) { api.aoVivo(null, false); return; }
      if (como === 'ciclo') { desenharGuarnicao(m); return; }
      desenharDia(m);
    }

    /* os horários escolhidos se cruzam entre si */
    function sobrepostos() {
      var js = janelas(), soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      return soma(H.uniao(js)) !== soma(js);
    }

    function desenharDia(m) {
      /* o horário: o que cruza o que ele já tem no dia (ou outro horário dele aqui) fica vermelho e desliga o Salvar; o
         dia todo apaga o + */
      mostra(el.horario, true);
      el.periodos.textContent = '';
      var diaTodo = minutos() >= 1440, sobrepoe = sobrepostos();
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, erro: emConflito(per) || sobrepoe,
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null,
          aoAdicionar: i === 0 && !diaTodo ? adicionarPeriodo : null,
          adicionarDesligado: i === 0 && diaTodo ? L().diaTodoDica : null
        });
        if (linha) el.periodos.appendChild(linha);
      });
      /* a barra: o que ele já tem no dia em cinza e o horário novo escuro */
      var um = est.periodos.length === 1;
      if (el.barra) el.barra.desenhar({
        fundo: (m.ocupado || []).map(function (o) { return { hi: o.hi, hf: o.hf }; })
          .concat(um ? [] : est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf, classe: 'marcada' }; })),
        faixa: um ? { hi: est.periodos[0].hi, hf: est.periodos[0].hf } : null,
        editavel: um
      });
      var conflito = est.periodos.some(emConflito) || sobrepoe;

      /* onde fica: o sistema, a função escolhida ou no lugar de outro militar (a caixa comum) */
      mostra(el.ondeBloco, true);
      onde.atualizar();
      var respondido = onde.respondido();
      /* o banco de horas, quando onde fica está respondido */
      mostra(el.banco, respondido);
      el.contabilizar.textContent = L().bancoSim(H.horasTexto(minutos()));
      el.marcarBanco(est.banco);

      /* tudo respondido e sem conflito: ele entra no rascunho (no horário, onde fica e com o banco de horas) */
      var pronto = respondido && !conflito;
      api.aoVivo(pronto ? function () { onde.aplicar({ contabilizar: est.banco === 'sim' }); } : null, !pronto);
    }

    /* na guarnição do dia: quem está fora da escala entra; quem é de outra guarnição muda para ela e vê o que acontece com
       as trocas, folgas e extras dele a partir do dia; quem já é dela não muda. Vai para o rascunho das guarnições */
    function desenharGuarnicao(m) {
      var mudar = m.estado !== 'fora' && !m.serve_hoje;
      nota(el.mudar, m.serve_hoje ? L().guarnicaoServeHoje(nomeDe(m), letra, data) : mudar ? L().guarnicaoMudar(nomeDe(m), letra, D.diaMesExtenso(iso)) : '');
      nota(el.info, m.estado === 'fora' && !m.serve_hoje ? L().guarnicaoEntrar(letra, D.diaMesExtenso(iso)) : '');
      if (m.serve_hoje) { api.aoVivo(null, true); return; }
      if (m.estado === 'fora') { api.aoVivo(function () { C.entrar(uid, iso, m, letra); }); return; }
      mudarGuarnicao(m);
    }

    /* quem muda de guarnição: a lista do que acontece (lida uma vez) e, com ela, a marca no rascunho das guarnições;
       enquanto lê, o Salvar espera */
    function mudarGuarnicao(m) {
      if (analise.chave === m.cpf) {
        if (analise.aviso) { efeito.mostrar(analise.aviso); api.aoVivo(function () { C.marcarMudar(uid, iso, m, analise.aviso.itens, letra); }); }
        else api.aoVivo(null, true);
        return;
      }
      analise.chave = m.cpf;
      analise.aviso = null;
      var meu = ++analise.pedido;
      api.aoVivo(null, true);
      C.analisarMudar(uid, iso, m, letra).then(function (aviso) {
        if (meu !== analise.pedido || !el.combo.isConnected) return;
        if (aviso.erro) { analise.chave = ''; RosterWork.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
        analise.aviso = aviso;
        if (est.mil === m && est.como === 'ciclo') atualizar();
      });
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelAdicionar = { abrir: abrir };
})();
