/* ============================================================
   ESCALAS — o cartão embaixo da linha do Dia (o menu do lápis; só admin)
   Um cartão que engloba a linha: no topo, a própria linha com o X
   que fecha (um aberto por vez); embaixo, a edição direta (REGRAS §4 ›
   Ações e perguntas), pelo item do menu da linha
   (escalas-painel-linha-menu.js):
   - quem (Pôr outro no lugar dele, Pôr um militar aqui): o militar
     desta função (só quem já está de serviço aqui no dia) e o horário
     nesta função. Na vaga sem ninguém (Pôr um militar aqui), o Quem
     cobre (escalas-painel-linha-cobrir.js): a Unidade e o Militar, e
     as perguntas de quem não está de serviço neste dia; quem já está
     segue como sempre;
   - horario (Mudar o horário nesta função): só o horário dele nesta
     função;
   - funcao (Mudar para outra função, Pôr numa função): Para qual
     função, na caixa Onde fica (escalas-painel-onde.js, só com as vagas
     sem ninguém no horário dele e o Escolher a função). A função
     escolhida faz o que o Pôr outro no lugar dele faria nela, com ele
     escolhido: o banco diz se ele pode nela (escala_dia_disponiveis),
     e quem não pode fica em vermelho, com o Salvar desligado.
   E o efeito em quem está em volta. A escolha entra no rascunho ao
   vivo (escalas-painel-editar.js › aoVivo) e as telas mostram como
   fica; o X fecha, a mudança vira um passo do desfazer e a lista
   mostra o dia como vai ficar. Quem entra e já tem outra função no
   horário sai de lá (o lugar fica vazio; a nota O que mudou traz o
   atalho de pôr quem saiu nesse lugar). O que cada mudança faz no
   rascunho fica em escalas-painel-linha-aplicar.js.
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
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

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

  /* a vaga no formato da leitura de quem pode entrar (escala_dia_disponiveis) */
  function vagaDe(cfgAlvo, periodos, cpfQueSai) {
    return { viatura_id: cfgAlvo.posto.tipo === 'viatura' ? cfgAlvo.posto.id : null,
      instalacao_id: cfgAlvo.posto.tipo === 'instalacao' ? cfgAlvo.posto.id : null,
      funcao: cfgAlvo.funcao, periodos: periodos.map(copiar), cpf: cpfQueSai || null };
  }

  /* cfg = { linha, grupo, modo: 'quem' | 'horario' | 'funcao', tipo: 'funcao' | 'vaga' | 'sem', posto, funcao, rotulo,
     militar, periodos } */
  function abrir(cfg) {
    /* outro cartão aberto com mudança: ela fica e a lista é refeita (a linha clicada sai com ela; clica-se de novo) */
    fechar();
    var linhaLista = cfg.linha;
    if (!linhaLista || !linhaLista.isConnected || !cfg.grupo) return;
    var api = ed(), H = api.horas, modo = cfg.modo || 'quem';
    var el = RosterWork.tpl('tpl-escala-linha');
    if (!el) return;
    var eu = cfg.militar;   // o militar da linha (na vaga, ninguém)
    var unidadeNome = ((api.dados().picker || []).filter(function (u) { return u.editando; })[0] || {}).unidade_nome || '';
    /* alvo = a função que recebe: no quem e no horário, a desta linha; no Para qual função, a escolhida, com quem está
       nela. { cfg, m (quem está nela), original (os horários) } */
    var alvo = modo === 'funcao' ? null : { cfg: cfg, m: eu, original: (cfg.periodos || []).map(copiar) };
    /* item = quem fica (o da linha ou outro do dia); c = o que o banco mandou de quem entra; naoPode = o motivo de quem não
       pode na função escolhida; conferindo = o banco ainda não respondeu */
    var est = { item: eu && modo !== 'funcao' ? { cpf: eu.cpf, grad: eu.grad, nome: eu.nome } : null, c: null,
      periodos: (cfg.periodos || []).map(copiar), naoPode: '', conferindo: false };
    var pedido = 0, onde = null, cobrir = null;   // cobrir = o Quem cobre da vaga sem ninguém
    var q = function (s) { return el.querySelector(s); };

    /* o topo: a própria linha da lista (a função, o militar e o horário) com o X */
    q('.escala-linha-funcao').textContent = RosterWork.escalasPainel.pecas.abreviarFuncao(cfg.rotulo || cfg.funcao || '');
    var pessoa = linhaLista.querySelector('.escala-edicao-pessoa'), horas = linhaLista.querySelector('.escala-distribuicao-horas');
    if (pessoa) q('.escala-linha-pessoa').appendChild(pessoa.cloneNode(true));
    if (horas) q('.escala-linha-horas').appendChild(horas.cloneNode(true));
    q('.escala-linha-fechar').addEventListener('click', function () { if (aberto && aberto.el === el) fechar(); });
    mostra(q('.escala-linha-militar'), modo === 'quem');
    mostra(q('.escala-linha-horario'), modo !== 'funcao');
    mostra(q('.escala-linha-para'), modo === 'funcao');

    /* ---------- quem: o militar desta função (o banco diz quem pode nela e o motivo de quem não pode) ---------- */

    function montarQuem() {
      /* a vaga sem ninguém: o Quem cobre (quem já está de serviço neste dia volta para cá, pelo escolher) */
      if (cfg.tipo === 'vaga' && !eu) {
        cobrir = RosterWork.escalasPainelLinhaCobrir.criar({ q: q, cfg: cfg, original: alvo.original, unidadeNome: unidadeNome,
          aoDoDia: escolher, aoMudar: atualizar, sair: sairParaExtra });
        return;
      }
      var inp = q('.escala-linha-combo input'), menu = q('.escala-linha-combo .dropdown-menu');
      inp.id = 'escala-linha-combo-' + (++conta);
      var combo = RosterWork.comboMilitar.criar(inp, menu, {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemPode, filtroVazio: msg().ninguemEncontrado }
      });
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vagaDe(cfg, alvo.original, eu ? eu.cpf : null)).then(function (resp) {
        if (!el.isConnected) return;
        if (!resp) { combo.definir(msg().falhaCarregar, true); return; }
        combo.preencher(RosterWork.escalasPainelQuem.itensDaVaga(resp, eu, unidadeNome, { soDoDia: true }));
      });
    }

    /* quem entra (já de serviço neste dia): o horário fica nas horas de serviço dele dentro do horário desta linha */
    function escolher(item) {
      est.item = item;
      est.c = item.c || null;
      if (est.c) {
        var mil = api.militarDoDia(est.c.cpf), xs = [];
        ((mil && mil.janelas) || []).forEach(function (j) {
          alvo.original.forEach(function (p) { var x = H.cruza(H.faixa(p), H.faixa(j)); if (x) xs.push(x); });
        });
        est.periodos = xs.length ? H.uniao(xs).map(H.periodo) : alvo.original.map(copiar);
      } else est.periodos = alvo.original.map(copiar);
      montarHora();
      atualizar();
    }

    /* na vaga sem ninguém, quem ainda não está de serviço neste dia (ou ninguém escolhido): responde o Quem cobre */
    function peloCobrir() { return !!cobrir && cobrir.jeito() !== 'dia'; }

    /* de folga, entra pela Extrajornada (pediu o dia): o que este cartão já tinha posto sai, ele fecha e a aba Extrajornada
       do painel abre */
    function sairParaExtra() {
      if (aberto && aberto.el === el) api.aoVivo(null, false);
      fechar();
      RosterWork.escalasPainel.abrirAba('extra');
    }

    /* ---------- Para qual função: a vaga ou a função escolhida; o banco diz se ele pode nela ---------- */

    function montarPara() {
      var conferindo = q('.escala-linha-conferindo'), pontos = RosterWork.tpl('carregando-pontos');
      if (pontos) conferindo.appendChild(pontos);
      var caixa = RosterWork.tpl('tpl-escala-onde-fica');
      if (!caixa) return;
      q('.escala-linha-onde').appendChild(caixa);
      onde = RosterWork.escalasPainelOnde.criar(caixa, {
        dados: function () { return api.dados(); },
        periodos: function () { return est.periodos; },
        cpf: function () { return eu.cpf; },
        vagas: true,
        so: ['funcao'],
        aoMudar: escolherFuncao
      });
      mostra(caixa, true);
      onde.atualizar();
      escolherFuncao();
    }

    /* a função escolhida (a vaga ou o posto e a função): vira o alvo, com quem está nela, e o banco confere se ele pode */
    function escolherFuncao() {
      if (onde) onde.atualizar();
      var e = onde ? onde.estado() : {};
      var posto = e.onde === 'vaga' && e.vaga ? e.vaga.posto : e.onde === 'funcao' ? e.posto : null;
      var funcao = e.onde === 'vaga' && e.vaga ? e.vaga.funcao : e.onde === 'funcao' ? e.funcao : null;
      var meu = ++pedido;
      alvo = null; est.item = null; est.c = null; est.naoPode = ''; est.conferindo = false;
      /* a própria função dele não muda nada */
      if (!posto || !funcao || (cfg.posto && posto.tipo === cfg.posto.tipo && posto.id === cfg.posto.id && funcao === cfg.funcao)) {
        atualizar();
        return;
      }
      var ocupantes = A().ocupantes(posto, funcao, est.periodos, eu.cpf).map(function (o) { return o.m; });
      var quem = ocupantes.filter(function (m, i) { return ocupantes.map(function (x) { return x.cpf; }).indexOf(m.cpf) === i; });
      var cfgAlvo = { tipo: quem.length ? 'funcao' : 'vaga', posto: posto, funcao: funcao, militar: quem.length === 1 ? quem[0] : null,
        periodos: est.periodos.map(copiar) };
      est.conferindo = true;
      atualizar();
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vagaDe(cfgAlvo, est.periodos, cfgAlvo.militar && cfgAlvo.militar.cpf)).then(function (resp) {
        if (meu !== pedido || !el.isConnected) return;
        est.conferindo = false;
        var item = resp ? RosterWork.escalasPainelQuem.itensDaVaga(resp, null, unidadeNome, { soDoDia: true })
          .filter(function (i) { return i.cpf === eu.cpf; })[0] : null;
        if (!resp) RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar });
        else if (!item || item.inativo || !item.c) est.naoPode = L().naoPodeFuncao(nomeDe(eu), (item && item.info) || '');
        else {
          alvo = { cfg: cfgAlvo, m: cfgAlvo.militar, original: est.periodos.map(copiar) };
          est.item = { cpf: eu.cpf, grad: eu.grad, nome: eu.nome };
          est.c = item.c;
        }
        atualizar();
      });
    }

    /* ---------- o horário nesta função ---------- */

    function montarHora() {
      var lugar = q('.escala-linha-periodos');
      lugar.textContent = '';
      var cpf = est.c ? est.c.cpf : eu ? eu.cpf : null;
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

    function mudouQuem() { return !!alvo && !!est.item && (!alvo.m || est.item.cpf !== alvo.m.cpf); }
    function mudouHora() { return !!alvo && JSON.stringify(est.periodos) !== JSON.stringify(alvo.original); }
    /* os horários escolhidos se cruzam entre si */
    function sobrepostos() {
      var js = est.periodos.map(H.faixa), soma = function (l) { return l.reduce(function (s, f) { return s + f[1] - f[0]; }, 0); };
      return soma(H.uniao(js)) !== soma(js);
    }

    /* uma nota do cartão; alerta = o efeito que pede atenção (o dia abaixo do mínimo) */
    function nota(caixa, texto, alerta) {
      caixa.classList.toggle('oculto', !texto);
      caixa.classList.toggle('nota--alerta', !!texto && !!alerta);
      if (texto) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns && modo !== 'funcao') RosterWork.fecharDropdowns();
      if (cobrir) cobrir.desenhar();
      /* na vaga sem ninguém, o horário é só de quem já está de serviço neste dia (os outros cobrem a vaga inteira) */
      mostra(q('.escala-linha-horario'), modo !== 'funcao' && (!cobrir || cobrir.horario()));
      mostra(q('.escala-linha-conferindo'), est.conferindo);
      nota(q('.escala-linha-nao-pode'), est.naoPode);
      desenharEfeito();
      aplicarAoVivo();
    }

    /* o efeito, em frases: o que acontece com quem sai, com a função e com o lugar que quem entra deixa. O Chefe de
       Socorro (ou o Oficial de Área) que entra leva a função especial junto, e o sistema refaz o dia em volta dele. No
       Para qual função, quem sai da função escolhida vem na nota da caixa Onde fica */
    function desenharEfeito() {
      var partes = [], c = est.c, m = alvo && alvo.m, fa = alvo && alvo.cfg;
      /* o Quem cobre: a nota da resposta dele e quem vira o Chefe de Socorro, só com a resposta completa */
      if (peloCobrir()) {
        var ef = cobrir.efeito(), cc = cobrir.candidato(), completa = !!cobrir.jeito() && cobrir.pronto();
        nota(q('.escala-linha-efeito'), ef ? ef.texto : '', ef && ef.alerta);
        nota(q('.escala-linha-assume'), completa && cc && cc.assume ? (cc.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(cc), '') : '');
        return;
      }
      var funcoes = (c && c.funcoes) || [];
      var papel = funcoes.filter(function (f) { return PAPEL.test(f.funcao); })[0];
      var deixa = funcoes.filter(function (f) { return !PAPEL.test(f.funcao); });
      if (mudouQuem() && m && modo !== 'funcao') {
        var outras = A().outrasFuncoes(m.cpf, fa, est.periodos).map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); });
        partes.push(papel ? L().efeitoSai(nomeDe(m), fa.funcao)
          : outras.length ? L().efeitoContinua(nomeDe(m), fa.funcao, outras) : L().efeitoSemFuncao(nomeDe(m), fa.funcao));
      }
      if (deixa.length) partes.push(L().entraSaiDe(nomeDe(c), RosterWork.escalasPainelQuem.lugares(deixa)));
      if (papel) partes.push(L().papelJunto(nomeDe(c), papel.funcao));
      else if (mudouQuem() && !deixa.length) partes.push(L().ninguemMais);
      if (!mudouQuem() && m && mudouHora()) {
        var sai = H.menos(alvo.original.map(H.faixa), H.uniao(est.periodos.map(H.faixa)));
        if (sai.length) partes.push(L().ficaVazioDas(fa.funcao, H.textoPeriodos(sai.map(H.periodo))));
        var ocup = A().ocupantes(fa.posto, fa.funcao, est.periodos, m.cpf).map(function (o) {
          var pr = H.periodo(o.x);
          return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
        });
        if (ocup.length) partes.push(msg().avisoEfeito(ocup));
      }
      nota(q('.escala-linha-efeito'), partes.join(' '));
      nota(q('.escala-linha-assume'), c && c.assume ? (c.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(c), '') : '');
    }

    /* ---------- ao vivo ---------- */

    /* a escolha de agora vai ao rascunho (outro militar troca de lugar com quem está; o horário muda só o dele); horários
       que se cruzam, o banco conferindo e quem não pode na função escolhida não entram, e o Salvar espera */
    function aplicarAoVivo() {
      if (!aberto || aberto.el !== el) return;
      var periodos = est.periodos.map(copiar);
      aberto.sugestao = null;
      if (est.conferindo || est.naoPode) { api.aoVivo(null, true); return; }
      /* o Quem cobre: ninguém escolhido não muda nada; a pergunta pela metade deixa o Salvar desligado */
      if (peloCobrir()) {
        if (!cobrir.jeito()) api.aoVivo(null, false);
        else if (!cobrir.pronto()) api.aoVivo(null, true);
        else api.aoVivo(function () { cobrir.aplicar(); });
        return;
      }
      if (!alvo || !est.item) { api.aoVivo(null, false); return; }
      if (sobrepostos()) { api.aoVivo(null, true); return; }
      if (mudouQuem() && est.c) {
        var c = est.c, fa = alvo.cfg, sai = alvo.m ? nomeDe(alvo.m) : '';
        aberto.sugestao = A().sugestao(fa, c, { um: function (f) { return L().atalho(sai, f); }, varios: L().atalhoLugar(sai, nomeDe(c)) });
        api.aoVivo(function () { A().trocar(fa, c, periodos); });
        return;
      }
      if (mudouHora()) { api.aoVivo(function () { A().mudarHorario(alvo.cfg, periodos); }); return; }
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
    if (modo === 'quem') montarQuem();
    if (modo === 'funcao') montarPara();
    else { montarHora(); atualizar(); }
  }

  window.RosterWork.escalasPainelLinha = { abrir: abrir, fechar: fechar, aberta: function () { return !!aberto; } };
})();
