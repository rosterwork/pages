/* ============================================================
   ESCALAS — a edição de uma linha do Dia (o lápis; só admin)
   Um cartão que engloba a linha: no topo, a própria linha com o X
   que fecha (uma aberta por vez); embaixo, a edição direta (REGRAS
   §4 › Ações e perguntas): o militar desta função (só quem já está
   de serviço aqui no dia, e o "Ninguém", que deixa a função vazia)
   e o horário nesta função e o efeito em quem está em volta. A
   escolha entra no rascunho ao vivo (escalas-painel-editar.js ›
   aoVivo) e as telas mostram como fica; o X fecha, a mudança vira um
   passo do desfazer e a lista mostra o dia como vai ficar. Quem
   entra e já tem outra função no horário sai de lá (o lugar fica
   vazio; a nota O que mudou traz o atalho de pôr quem saiu nesse
   lugar). Tipos: função e vaga (sem
   ninguém); o Chefe de Socorro e o Oficial de Área não têm lápis,
   e quem está sem função tem o Remover do dia. Trazer alguém de
   fora do dia é o Adicionar; tirar alguém do dia é o Remover.
   O que cada mudança faz no rascunho fica em
   escalas-painel-linha-aplicar.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var aberto = null;   // { el, esconder: [], sugestao }: o cartão aberto, o que ele esconde da lista e o atalho da nota O que mudou
  var conta = 0;       // nome único para o campo de cada cartão

  /* Chefe de Socorro e Oficial de Área: a função especial vai junto com quem a tem */
  var PAPEL = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function A() { return RosterWork.escalasPainelLinhaAplicar; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }

  /* fecha o cartão. modo: sem modo, a mudança fica (um passo do desfazer) e a lista mostra o dia como vai ficar;
     'guardar', fica sem redesenhar (quem chama redesenha); 'largar', some sem guardar (depois de salvar ou descartar) */
  function fechar(modo) {
    if (!aberto) return;
    var a = aberto, api = ed();
    aberto = null;
    if (a.el.parentNode) a.el.remove();
    a.esconder.forEach(function (e) { e.classList.remove('oculto'); });
    if (modo === 'largar') { api.largarVivo(); return; }
    if (a.sugestao && api.vivoMudou()) api.sugerir(a.sugestao);
    if (api.terminarVivo() && modo !== 'guardar') api.redesenhar();
  }

  /* cfg = { lapis, grupo, tipo: 'funcao' | 'vaga', posto, funcao, rotulo, militar, periodos } */
  function abrir(cfg) {
    /* outro cartão aberto com mudança: ela fica e a lista é refeita (o lápis clicado sai com ela; clica-se de novo) */
    fechar();
    if (!cfg.lapis || !cfg.lapis.isConnected) return;
    var api = ed(), H = api.horas;
    var el = RosterWork.tpl('tpl-escala-linha');
    var linhaLista = cfg.lapis && cfg.lapis.closest('.escala-edicao-linha');
    if (!el || !linhaLista || !cfg.grupo) return;
    var m = cfg.militar, nome = m ? nomeDe(m) : '';
    var original = (cfg.periodos || []).map(copiar);
    var NINGUEM = { cpf: null, grad: '', nome: L().ninguem, info: L().ninguemInfo, ninguem: true };
    /* item = quem fica (o da linha, outro do dia ou o Ninguém); c = o que o banco mandou de quem entra */
    var est = { item: m ? { cpf: m.cpf, grad: m.grad, nome: m.nome } : null, c: null, periodos: original.map(copiar) };
    var q = function (s) { return el.querySelector(s); };

    /* o topo: a própria linha da lista (a função, o militar e o horário) com o X */
    q('.escala-linha-funcao').textContent = RosterWork.escalasPainel.pecas.abreviarFuncao(cfg.rotulo || cfg.funcao);
    var pessoa = linhaLista.querySelector('.escala-edicao-pessoa'), horas = linhaLista.querySelector('.escala-distribuicao-horas');
    if (pessoa) q('.escala-linha-pessoa').appendChild(pessoa.cloneNode(true));
    if (horas) q('.escala-linha-horas').appendChild(horas.cloneNode(true));
    q('.escala-linha-fechar').addEventListener('click', function () { if (aberto && aberto.el === el) fechar(); });

    /* o militar: quem está de serviço aqui no dia (o banco diz quem pode nesta função e o motivo de quem não pode) */
    var inp = q('.escala-linha-combo input'), menu = q('.escala-linha-combo .dropdown-menu');
    inp.id = 'escala-linha-combo-' + (++conta);
    var combo = RosterWork.comboMilitar.criar(inp, menu, {
      atual: function () { return est.item; },
      aoEscolher: escolher,
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemPode, filtroVazio: msg().ninguemEncontrado }
    });
    combo.habilitar(false);
    combo.definir(L().carregando, true);
    var vaga = { viatura_id: cfg.posto.tipo === 'viatura' ? cfg.posto.id : null, instalacao_id: cfg.posto.tipo === 'instalacao' ? cfg.posto.id : null,
      funcao: cfg.funcao, periodos: original.map(copiar), cpf: m ? m.cpf : null };
    var unidadeNome = ((api.dados().picker || []).filter(function (u) { return u.editando; })[0] || {}).unidade_nome || '';
    RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vaga).then(function (resp) {
      if (!el.isConnected) return;
      if (!resp) { combo.definir(msg().falhaCarregar, true); return; }
      var itens = RosterWork.escalasPainelQuem.itensDaVaga(resp, m, unidadeNome, { soDoDia: true });
      combo.preencher(m ? [NINGUEM].concat(itens) : itens);
    });

    /* quem entra: o horário fica nas horas de serviço dele dentro do horário desta linha */
    function escolher(item) {
      est.item = item;
      est.c = item.c || null;
      if (est.c) {
        var mil = api.militarDoDia(est.c.cpf), xs = [];
        ((mil && mil.janelas) || []).forEach(function (j) {
          original.forEach(function (p) { var x = H.cruza(H.faixa(p), H.faixa(j)); if (x) xs.push(x); });
        });
        est.periodos = xs.length ? H.uniao(xs).map(H.periodo) : original.map(copiar);
      } else est.periodos = original.map(copiar);
      montarHora();
      atualizar();
    }

    /* ---------- o horário nesta função ---------- */

    function montarHora() {
      var lugar = q('.escala-linha-periodos');
      lugar.textContent = '';
      var cpf = est.c ? est.c.cpf : m ? m.cpf : null;
      var mil = cpf ? api.militarDoDia(cpf) : null, opc = H.opcoesHoras(mil && mil.janelas.length ? mil.janelas : null);
      var diaTodo = H.uniao(est.periodos.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0) >= 1440;
      var sobrepoe = sobrepostos();
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, opcoes: opc, erro: sobrepoe,
          aoInicio: function (h) { per.hi = h; montarHora(); atualizar(); },
          aoFim: function (h) { per.hf = h; montarHora(); atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); montarHora(); atualizar(); } : null,
          aoAdicionar: i === 0 && !diaTodo ? adicionarPeriodo : null,
          adicionarDesligado: i === 0 && diaTodo ? L().diaTodoDica : null
        });
        if (linha) lugar.appendChild(linha);
      });
    }
    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(est.periodos.map(H.faixa)));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      montarHora();
      atualizar();
    }

    /* ---------- desenho ---------- */

    function mudouQuem() { return !!est.item && (!m || est.item.cpf !== m.cpf); }
    function mudouHora() { return JSON.stringify(est.periodos) !== JSON.stringify(original); }
    /* os horários escolhidos se cruzam entre si */
    function sobrepostos() {
      var js = est.periodos.map(H.faixa), soma = function (l) { return l.reduce(function (s, f) { return s + f[1] - f[0]; }, 0); };
      return soma(H.uniao(js)) !== soma(js);
    }

    function nota(caixa, texto) {
      caixa.classList.toggle('oculto', !texto);
      if (texto) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      desenharEfeito();
      aplicarAoVivo();
    }

    /* o efeito, em frases: o que acontece com quem sai, com a função e com o lugar que quem entra deixa. O Chefe de
       Socorro (ou o Oficial de Área) que entra leva a função especial junto, e o sistema refaz o dia em volta dele */
    function desenharEfeito() {
      var partes = [], c = est.c, it = est.item;
      var funcoes = (c && c.funcoes) || [];
      var papel = funcoes.filter(function (f) { return PAPEL.test(f.funcao); })[0];
      var deixa = funcoes.filter(function (f) { return !PAPEL.test(f.funcao); });
      if (mudouQuem() && m) {
        var outras = A().outrasFuncoes(m.cpf, cfg, est.periodos).map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); });
        partes.push(papel ? L().efeitoSai(nome, cfg.funcao)
          : outras.length ? L().efeitoContinua(nome, cfg.funcao, outras) : L().efeitoSemFuncao(nome, cfg.funcao));
      }
      if (it && it.ninguem) partes.push(L().ficaVazio(cfg.funcao));
      if (deixa.length) partes.push(L().entraSaiDe(nomeDe(c), RosterWork.escalasPainelQuem.lugares(deixa)));
      if (papel) partes.push(L().papelJunto(nomeDe(c), papel.funcao));
      else if (mudouQuem() && !deixa.length) partes.push(L().ninguemMais);
      if (!mudouQuem() && m && mudouHora()) {
        var sai = H.menos(original.map(H.faixa), H.uniao(est.periodos.map(H.faixa)));
        if (sai.length) partes.push(L().ficaVazioDas(cfg.funcao, H.textoPeriodos(sai.map(H.periodo))));
        var ocup = A().ocupantes(cfg.posto, cfg.funcao, est.periodos, m.cpf).map(function (o) {
          var pr = H.periodo(o.x);
          return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
        });
        if (ocup.length) partes.push(msg().avisoEfeito(ocup));
      }
      nota(q('.escala-linha-efeito'), partes.join(' '));
      nota(q('.escala-linha-assume'), c && c.assume ? (c.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(c), '') : '');
    }

    /* ---------- ao vivo ---------- */

    /* a escolha de agora vai ao rascunho (a mesma regra de antes: o Ninguém deixa a função vazia, outro militar troca de
       lugar com quem está, o horário muda só o dele); horários que se cruzam não entram, e o Salvar espera */
    function aplicarAoVivo() {
      if (!aberto || aberto.el !== el) return;
      var it = est.item, periodos = est.periodos.map(copiar);
      aberto.sugestao = null;
      if (!it) { api.aoVivo(null, false); return; }
      if (sobrepostos()) { api.aoVivo(null, true); return; }
      if (it.ninguem) { api.aoVivo(function () { A().tirarDaFuncao(cfg, periodos); }); return; }
      if (mudouQuem() && est.c) {
        var c = est.c;
        aberto.sugestao = A().sugestao(cfg, c, { um: function (f) { return L().atalho(nome, f); }, varios: L().atalhoLugar(nome, nomeDe(c)) });
        api.aoVivo(function () { A().trocar(cfg, c, periodos); });
        return;
      }
      if (mudouHora()) { api.aoVivo(function () { A().mudarHorario(cfg, periodos); }); return; }
      api.aoVivo(null, false);
    }

    /* o cartão entra no lugar da linha: a linha (e a função, se ficou sem outra linha) some da lista */
    var esconder = [linhaLista];
    var outrasLinhas = [].filter.call(cfg.grupo.querySelectorAll('.escala-edicao-linha'), function (l) { return l !== linhaLista && !l.classList.contains('oculto'); });
    if (!outrasLinhas.length) esconder.push(cfg.grupo);
    esconder.forEach(function (e) { e.classList.add('oculto'); });
    cfg.grupo.insertAdjacentElement('afterend', el);
    aberto = { el: el, esconder: esconder, sugestao: null };
    api.comecarVivo();
    montarHora();
    atualizar();
  }

  window.RosterWork.escalasPainelLinha = { abrir: abrir, fechar: fechar, aberta: function () { return !!aberto; } };
})();
