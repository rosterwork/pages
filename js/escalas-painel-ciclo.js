/* ============================================================
   ESCALAS — as guarnições pelo painel do dia (o ciclo automático; as
   abas Funções, Militares e Guarnições)
   - o rascunho das guarnições: as mudanças do dia aberto que ainda
     não foram salvas (as de outro dia ficam guardadas na gaveta,
     escalas-rascunho-dias.js, e voltam com o dia, abrirDia); marcar e
     desmarcar não gravam: o Salvar do
     rodapé do painel (escalas-painel-salvar.js) grava junto com o dia
     (escala_ciclo_salvar_lote, pelo escala_painel_salvar). Cada
     mudança pode levar a sua data e a letra da guarnição (a aba
     Guarnições); sem elas, vale a partir do dia aberto, na guarnição
     dele (o Adicionar militar sem a letra, e o Remover do dia);
   - o Desfazer e o Refazer da aba Guarnições: cada passo dela guarda
     a mudança de antes e a de depois do militar (marcarPasso,
     desmarcarPasso), ou de vários de uma vez (passoVarios, a volta de
     férias; porVarias põe a sugestão sem ser passo);
   - analisar: a lista do que acontece com as trocas e folgas a
     partir de uma data (escala_ciclo_retirar_analisar; as extras
     ficam), que o Adicionar militar, o Remover do dia e o Remover da
     guarnição mostram (o efeito, molde tpl-escala-ciclo-efeito);
   - o Remover da guarnição e o Cancelar a saída do menu da linha, na
     aba Militares: a pergunta Último serviço embaixo da linha e a
     saída que sai do rascunho (ou o cancelamento da gravada);
   - o Mudar a saída de quem tem a saída marcada à mão (a linha riscada
     e quem faz no dia o último serviço antes dela, a lista
     ultimo_servico do ler_distribuicao_dia): a pergunta Último
     serviço com os dias de serviço dele, e a saída nova no rascunho
     (mudar_saida).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* o rascunho do dia aberto (chave = unidade|dia), uma mudança por militar: [{ cpf, acao, data?, letra?, ultimo_servico?,
     saida?, ultimo?, tipo, itens, de? }]; acao = adicionar (pôr numa guarnição ou mudar de guarnição), tirar,
     cancelar_saida ou mudar_saida (a saída marcada, saida, passa para a data; ultimo = o último serviço novo, a resposta da
     pergunta); tipo = entrar, mudar, sair, cancelar_saida ou mudar_saida; itens = o que acontece com as trocas e folgas (a
     lista da pergunta); de = a guarnição de antes (quem muda pela aba Guarnições) */
  var rascunho = { chave: '', lista: [] };
  var pilha = [];      // os passos da aba Guarnições, { cpf, antes, depois } ou, de vários, { lista: [...] } (o Desfazer volta o último)
  var refeitos = [];   // os passos desfeitos (o Refazer)

  /* ---------- o rascunho ---------- */

  /* o rodapé do painel conta as mudanças das abas */
  function avisar() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'ciclo' } })); }
  /* a gaveta dos dias (escalas-rascunho-dias.js; só na Escala) */
  function G() { return window.RosterWork.escalasRascunhoDias || null; }
  /* o rascunho passa a ser o do dia k: o de agora, com mudança ou passo, vai para a gaveta, e o de k volta dela (ou
     começa vazio) */
  function trocarDia(k) {
    if (rascunho.chave === k) return;
    if (G() && rascunho.chave && (rascunho.lista.length || pilha.length || refeitos.length)) {
      var p = rascunho.chave.split('|');
      G().guardar('ciclo', { chave: rascunho.chave, unidadeId: p[0], iso: p[1], estado: { rascunho: rascunho, pilha: pilha, refeitos: refeitos } });
    }
    var item = G() && G().tirar('ciclo', k);
    if (item) { rascunho = item.estado.rascunho; pilha = item.estado.pilha; refeitos = item.estado.refeitos; }
    else { rascunho = { chave: k, lista: [] }; pilha = []; refeitos = []; }
  }
  /* o painel ou a célula abriu o dia: o rascunho dele, se estava guardado, volta (as marcas e o Desfazer da aba) */
  function abrirDia(unidadeId, iso) {
    var k = unidadeId + '|' + iso, item = rascunho.chave !== k && G() ? G().tirar('ciclo', k) : null;
    if (!item) return;
    G().guardar('ciclo', item);   // o trocarDia guarda o de agora antes de trazer este
    trocarDia(k);
  }
  function doDia(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso ? rascunho.lista : []; }
  function marcado(unidadeId, iso, cpf) { return doDia(unidadeId, iso).filter(function (x) { return x.cpf === cpf; })[0] || null; }
  function marcar(unidadeId, iso, mudanca) {
    var k = unidadeId + '|' + iso;
    trocarDia(k);
    rascunho.lista = rascunho.lista.filter(function (x) { return x.cpf !== mudanca.cpf; }).concat([mudanca]);
    avisar();
  }
  function desmarcar(cpf) {
    rascunho.lista = rascunho.lista.filter(function (x) { return x.cpf !== cpf; });
    avisar();
  }
  function contar() { return rascunho.lista.length; }
  /* o que vai ao banco no Salvar (lista: a de um dia guardado na gaveta; sem ela, a de agora) */
  function envio(lista) {
    return (lista || rascunho.lista).map(function (x) {
      var m = { cpf: x.cpf, acao: x.acao };
      if (x.data) m.data = x.data;
      if (x.letra) m.letra = x.letra;
      if (x.ultimo_servico) m.ultimo_servico = x.ultimo_servico;
      if (x.saida) m.saida = x.saida;
      return m;
    });
  }
  /* o primeiro dia que a mudança mexe (iso = o dia dela): a data dela ou, na saída que muda de dia, a que vem antes, a de
     agora ou a nova */
  function desde(x, iso) {
    var d = x.data || iso;
    return x.saida && x.saida < d ? x.saida : d;
  }
  function limpar() {
    pilha = []; refeitos = [];
    if (!rascunho.chave && !rascunho.lista.length) return;
    rascunho = { chave: '', lista: [] };
    avisar();
  }
  /* a foto do rascunho: a sub-tela ao vivo (escalas-painel-editar.js) volta a ela a cada resposta, sem avisar */
  function copia() { return { chave: rascunho.chave, lista: rascunho.lista.slice() }; }
  function voltarA(c) { rascunho = { chave: c.chave, lista: c.lista.slice() }; }

  /* ---------- os passos da aba Guarnições (com o Desfazer) ---------- */

  /* cada passo guarda a mudança de antes e a de depois de um militar só: o Desfazer volta só ele (o que veio de outra
     tela, como o Adicionar militar, fica) */
  function trocarDe(cpf, mudanca) {
    rascunho.lista = rascunho.lista.filter(function (x) { return x.cpf !== cpf; }).concat(mudanca ? [mudanca] : []);
  }
  function passo(unidadeId, iso, cpf, depois) {
    var k = unidadeId + '|' + iso;
    trocarDia(k);
    pilha.push({ cpf: cpf, antes: marcado(unidadeId, iso, cpf), depois: depois });
    refeitos = [];
    trocarDe(cpf, depois);
    avisar();
  }
  function marcarPasso(unidadeId, iso, mudanca) { passo(unidadeId, iso, mudanca.cpf, mudanca); }
  function desmarcarPasso(unidadeId, iso, cpf) { passo(unidadeId, iso, cpf, null); }
  /* vários militares de uma vez (a volta de férias, escalas-painel-volta.js): lista = [{ cpf, mudanca }] (mudanca nula: sai
     do rascunho). passoVarios é um passo só do Desfazer; porVarias não é passo (a sugestão que abre a tela) */
  function porVarias(unidadeId, iso, lista) {
    var k = unidadeId + '|' + iso;
    trocarDia(k);
    lista.forEach(function (x) { trocarDe(x.cpf, x.mudanca); });
    avisar();
  }
  function passoVarios(unidadeId, iso, lista) {
    var k = unidadeId + '|' + iso;
    trocarDia(k);
    pilha.push({ lista: lista.map(function (x) { return { cpf: x.cpf, antes: marcado(unidadeId, iso, x.cpf), depois: x.mudanca }; }) });
    refeitos = [];
    lista.forEach(function (x) { trocarDe(x.cpf, x.mudanca); });
    avisar();
  }
  function aplicarPasso(p, lado) {
    (p.lista || [p]).forEach(function (x) { trocarDe(x.cpf, x[lado]); });
  }
  function podeDesfazer(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso && pilha.length > 0; }
  function podeRefazer(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso && refeitos.length > 0; }
  function desfazer() {
    var p = pilha.pop();
    if (!p) return;
    refeitos.push(p);
    aplicarPasso(p, 'antes');
    avisar();
  }
  function refazer() {
    var p = refeitos.pop();
    if (!p) return;
    pilha.push(p);
    aplicarPasso(p, 'depois');
    avisar();
  }

  /* ---------- o que acontece ---------- */

  /* o que acontece com as trocas, folgas e extras dele a partir de desde (escala = o texto do item da escala): uma
     Promise de { itens, nota } ou { erro } */
  function analisar(unidadeId, cpf, desde, escala) {
    return RosterWork.escalasDados.cicloRetirarAnalisar(unidadeId, cpf, desde).then(function (a) {
      if (!a || !a.success) return { erro: (a && a.error) || RosterWork.mensagens.saida.falhaLista };
      return RosterWork.avisoSaida(a.pendencias, { tipo: 'tirar', escala: escala });
    });
  }
  /* quem sai da escala a partir do dia, e quem muda de guarnição a partir de desde (entra = o primeiro dia na nova; sem
     ele, o próprio desde) */
  function analisarSair(unidadeId, iso, m) { return analisar(unidadeId, m.cpf, iso, RosterWork.mensagens.saida.escalaTirar); }
  function analisarMudar(unidadeId, desde, m, letra, entra) {
    return analisar(unidadeId, m.cpf, desde, RosterWork.mensagens.escala.linha.guarnicaoEscalaMudar(letra, (entra || desde).split('-').reverse().slice(0, 2).join('/')));
  }

  /* o efeito na sub-tela (o Adicionar militar e o Remover do dia): a nota com a lista do que acontece, no lugar do marcador.
     Devolve { mostrar(aviso), esconder() } */
  function efeito(marcador) {
    var el = RosterWork.tpl('tpl-escala-ciclo-efeito');
    if (!el || !marcador) return { mostrar: function () {}, esconder: function () {} };
    marcador.replaceWith(el);
    var lista = el.querySelector('.escala-ciclo-efeito-lista'), nota = el.querySelector('.escala-ciclo-efeito-nota');
    return {
      mostrar: function (aviso) {
        lista.textContent = '';
        (aviso.itens || []).forEach(function (it) {
          var li = RosterWork.tpl('tpl-escala-ciclo-efeito-item');
          if (!li) return;
          li.querySelector('.nota-titulo').textContent = it.titulo || '';
          li.querySelector('.escala-ciclo-efeito-texto').textContent = it.texto || '';
          lista.appendChild(li);
        });
        nota.textContent = aviso.nota || '';
        nota.classList.toggle('oculto', !aviso.nota);
        el.classList.remove('oculto');
      },
      esconder: function () { el.classList.add('oculto'); }
    };
  }

  /* ---------- as marcas das sub-telas (no dia aberto) ---------- */

  /* quem está fora entra no dia, na guarnição dele (com a letra, pelo caminho das guarnições) */
  function entrar(unidadeId, iso, m, letra) {
    var mudanca = { cpf: m.cpf, acao: 'adicionar', tipo: 'entrar', itens: [] };
    if (letra) { mudanca.letra = letra; mudanca.data = iso; }
    marcar(unidadeId, iso, mudanca);
  }
  /* quem já está numa guarnição passa para a do dia (itens = o que acontece; data = a da mudança, sem ela o dia: com o
     descanso de sempre, o dia seguinte, e ele entra na nova um intervalo do ritmo depois) */
  function marcarMudar(unidadeId, iso, m, itens, letra, data) {
    var mudanca = { cpf: m.cpf, acao: 'adicionar', tipo: 'mudar', itens: itens || [] };
    if (letra) { mudanca.letra = letra; mudanca.data = data || iso; }
    marcar(unidadeId, iso, mudanca);
  }
  /* quem sai da escala no dia (a sub-tela já mostrou a lista; itens = o que acontece) */
  function marcarSair(unidadeId, iso, m, itens) { marcar(unidadeId, iso, { cpf: m.cpf, acao: 'tirar', tipo: 'sair', itens: itens }); }

  /* ---------- a aba Militares: o Remover da guarnição, o Mudar a saída e o Cancelar a saída (o menu da linha) ---------- */

  var pergunta = null;   // a pergunta Último serviço aberta embaixo de uma linha: { el, pedido, passos }
  var conta = 0;         // nome único para os rádios de cada pergunta

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function diaSeguinte(iso) { var d = iso.split('-'); return RosterWork.data.paraIsoDeData(new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]) + 1)); }
  /* o dia mais antigo que se mexe (hoje − 7), como toda mudança */
  function limite() { var h = new Date(); return RosterWork.data.paraIsoDeData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 7)); }

  /* ele está no dia pela guarnição (o Remover da guarnição vale)? Até 7 dias atrás, como toda mudança */
  function podeSair(cpf) {
    var api = ed(), mil = api.militarDoDia(cpf), R = RosterWork.escalasPainelRemoverListas;
    if (!mil || !R || mil.remanejado) return false;
    if (api.iso() < limite()) return false;
    return R.partesDe(mil).some(function (p) { return p.origem === 'ciclo'; });
  }

  /* a saída à mão de quem faz neste dia o último serviço antes dela (a lista ultimo_servico do dia): { saida, ultimo,
     dias }; nula sem ela e no dia de mais de 7 dias atrás. Com ela, o Mudar a saída e o Cancelar a saída ficam no lugar do
     Remover da guarnição */
  function saidaMarcada(cpf) {
    var api = ed(), dd = api.dados() || {};
    if (api.iso() < limite()) return null;
    return (dd.ultimo_servico || []).filter(function (x) { return x.cpf === cpf; })[0] || null;
  }

  /* a pergunta sai: 'largar', sem mudar o rascunho (o Cancelar já voltou); 'guardar', a resposta fica; sem modo, também
     a lista se refaz, já com a saída */
  function fecharPergunta(modo) {
    var p = pergunta;
    pergunta = null;
    if (!p) return;
    p.pedido++;
    if (p.el.parentNode) p.el.remove();
    if (!modo) ed().redesenhar();
  }

  /* o Remover da guarnição de quem está no dia (m; linha = a linha dele na aba Militares): a pergunta Último serviço
     embaixo da linha, sem nada marcado: neste dia (ele faz o serviço e sai da guarnição depois dele) ou ele não trabalha
     mais a partir deste dia. A resposta põe a saída no rascunho das guarnições e mostra embaixo o que acontece com as
     trocas, folgas e extras dele; o Cancelar volta ao que era. Ela fica aberta até a próxima ação. Na caixa flutuante da
     célula da grade (escalas-celula-editar.js): opcoes = { dentro (a caixa 2, no lugar da linha), aoCancelar() } */
  function perguntarSaida(m, linha, opcoes) {
    opcoes = opcoes || {};
    if (RosterWork.escalasPainelRemover) RosterWork.escalasPainelRemover.fecharPergunta('guardar');
    fecharPergunta('guardar');
    var el = RosterWork.tpl('tpl-escala-remover-guarnicao');
    if (!el || !(linha || opcoes.dentro)) return;
    var api = ed(), uid = api.unidadeId(), iso = api.iso(), cpf = m.cpf, antes = marcado(uid, iso, cpf);
    var amanha = diaSeguinte(iso);
    var p = { el: el, pedido: 0, passos: 0 };
    [].forEach.call(el.querySelectorAll('.escala-remover-guarnicao-data'), function (s) { s.textContent = diaMes(iso); });
    var ver = efeito(el.querySelector('.escala-remover-guarnicao-efeito'));
    var nome = 'escala-remover-guarnicao-' + (++conta);
    [].forEach.call(el.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.addEventListener('change', function () {
        if (!r.checked) return;
        var data = r.value === 'neste' ? amanha : iso, meu = ++p.pedido;
        ver.esconder();
        marcarPasso(uid, iso, { cpf: cpf, acao: 'tirar', tipo: 'sair', data: data, itens: [] });
        p.passos++;
        analisar(uid, cpf, data, RosterWork.mensagens.saida.escalaTirar).then(function (aviso) {
          if (pergunta !== p || meu !== p.pedido) return;
          if (aviso.erro) { RosterWork.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
          ver.mostrar(aviso);
          var atual = marcado(uid, iso, cpf);
          if (atual && atual.acao === 'tirar' && atual.data === data) atual.itens = aviso.itens || [];
        });
      });
    });
    el.querySelector('.escala-remover-guarnicao-cancelar').addEventListener('click', function () {
      if (p.passos) {
        pilha.splice(pilha.length - p.passos, p.passos);
        trocarDe(cpf, antes);
        avisar();
      }
      fecharPergunta('largar');
      if (opcoes.aoCancelar) opcoes.aoCancelar();
    });
    if (opcoes.dentro) opcoes.dentro.appendChild(el);
    else linha.insertAdjacentElement('afterend', el);
    pergunta = p;
  }

  /* o Mudar a saída de quem tem a saída marcada à mão (m; s = { saida, ultimo, dias }, a da linha riscada ou a de quem faz
     no dia o último serviço antes dela; linha = a linha dele na aba Militares): a pergunta Último serviço embaixo da linha,
     com os dias de serviço dele que dá para escolher e o de agora marcado. Outro dia põe no rascunho a saída no dia
     seguinte a ele e, quando ela vem para antes, mostra embaixo o que acontece com as trocas e folgas dele; o dia da saída
     gravada tira a mudança. A saída que só está no rascunho (o Remover da guarnição) muda nele. O Cancelar volta ao que
     era. Na caixa flutuante da célula: opcoes = { dentro, aoCancelar }, como no Remover da guarnição */
  function perguntarMudarSaida(m, s, linha, opcoes) {
    opcoes = opcoes || {};
    if (RosterWork.escalasPainelRemover) RosterWork.escalasPainelRemover.fecharPergunta('guardar');
    fecharPergunta('guardar');
    var el = RosterWork.tpl('tpl-escala-mudar-saida');
    if (!el || !s || !(linha || opcoes.dentro)) return;
    var api = ed(), uid = api.unidadeId(), iso = api.iso(), cpf = m.cpf, antes = marcado(uid, iso, cpf);
    var soNoRascunho = !!antes && antes.acao === 'tirar';
    var gravada = antes && antes.acao === 'mudar_saida' ? antes.saida : s.saida;
    var p = { el: el, pedido: 0, passos: 0 }, ver = null;
    var marcador = el.querySelector('.escala-mudar-saida-efeito'), nome = 'escala-mudar-saida-' + (++conta);
    (s.dias || []).forEach(function (dia) {
      var op = RosterWork.tpl('tpl-escala-mudar-saida-opcao');
      if (!op) return;
      var r = op.querySelector('input');
      r.name = nome;
      r.value = dia;
      r.checked = dia === s.ultimo;
      op.querySelector('.escala-mudar-saida-data').textContent = diaMes(dia);
      r.addEventListener('change', function () {
        if (!r.checked) return;
        var nova = diaSeguinte(dia), meu = ++p.pedido;
        ver.esconder();
        if (soNoRascunho) marcarPasso(uid, iso, { cpf: cpf, acao: 'tirar', tipo: 'sair', data: nova, itens: [] });
        else if (nova === gravada) desmarcarPasso(uid, iso, cpf);
        else marcarPasso(uid, iso, { cpf: cpf, acao: 'mudar_saida', tipo: 'mudar_saida', saida: gravada, data: nova, ultimo: dia, itens: [] });
        p.passos++;
        /* para antes: o que acontece com as trocas e folgas dele dali em diante (para depois, nada sai) */
        if (nova >= s.saida) return;
        analisar(uid, cpf, nova, RosterWork.mensagens.saida.escalaTirar).then(function (aviso) {
          if (pergunta !== p || meu !== p.pedido) return;
          if (aviso.erro) { RosterWork.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
          ver.mostrar(aviso);
          var atual = marcado(uid, iso, cpf);
          if (atual && atual.data === nova) atual.itens = aviso.itens || [];
        });
      });
      el.insertBefore(op, marcador);
    });
    ver = efeito(marcador);
    el.querySelector('.escala-mudar-saida-cancelar').addEventListener('click', function () {
      if (p.passos) {
        pilha.splice(pilha.length - p.passos, p.passos);
        trocarDe(cpf, antes);
        avisar();
      }
      fecharPergunta('largar');
      if (opcoes.aoCancelar) opcoes.aoCancelar();
    });
    if (opcoes.dentro) opcoes.dentro.appendChild(el);
    else linha.insertAdjacentElement('afterend', el);
    pergunta = p;
  }

  /* o Cancelar a saída (data = a da saída; a linha riscada ou o dia do último serviço antes dela): a saída marcada sai, no
     rascunho; a que só estava no rascunho (o Remover da guarnição) só sai dele; a que o Mudar a saída mexeu no rascunho
     sai da data gravada. A lista se refaz sem ela */
  function cancelarSaida(m, data) {
    fecharPergunta('guardar');
    var api = ed(), uid = api.unidadeId(), iso = api.iso(), antes = marcado(uid, iso, m.cpf);
    if (antes && antes.acao === 'tirar') desmarcarPasso(uid, iso, m.cpf);
    else marcarPasso(uid, iso, { cpf: m.cpf, acao: 'cancelar_saida', tipo: 'cancelar_saida',
      data: antes && antes.acao === 'mudar_saida' ? antes.saida : data, itens: [] });
    api.redesenhar();
  }

  window.RosterWork.escalasPainelCiclo = {
    doDia: doDia, marcado: marcado, desmarcar: desmarcar, contar: contar, envio: envio, limpar: limpar,
    copia: copia, voltarA: voltarA, desde: desde,
    marcarPasso: marcarPasso, desmarcarPasso: desmarcarPasso, podeDesfazer: podeDesfazer, podeRefazer: podeRefazer,
    desfazer: desfazer, refazer: refazer, porVarias: porVarias, passoVarios: passoVarios,
    analisar: analisar, analisarSair: analisarSair, analisarMudar: analisarMudar, efeito: efeito,
    entrar: entrar, marcarMudar: marcarMudar, marcarSair: marcarSair,
    /* a aba Militares (o menu da linha): o Remover da guarnição, o Mudar a saída e o Cancelar a saída */
    podeSair: podeSair, perguntarSaida: perguntarSaida, cancelarSaida: cancelarSaida, fecharPergunta: fecharPergunta,
    saidaMarcada: saidaMarcada, perguntarMudarSaida: perguntarMudarSaida,
    abrirDia: abrirDia,
    /* para a gaveta dos dias (escalas-rascunho-dias.js): o Ciclo fica fora da ordem do Desfazer do rodapé (a aba
       Guarnições tem o dela) */
    gaveta: {
      vivo: function () {
        if (!rascunho.chave || !(rascunho.lista.length || pilha.length || refeitos.length)) return null;
        var p = rascunho.chave.split('|');
        return { chave: rascunho.chave, unidadeId: p[0], iso: p[1], vivo: true };
      },
      contar: function (item) { return item.vivo ? rascunho.lista.length : item.estado.rascunho.lista.length; },
      /* a lista de mudanças do item (a de agora ou a guardada) */
      lista: function (item) { return item.vivo ? rascunho.lista : item.estado.rascunho.lista; },
      pode: function () { return false; },
      andar: function () { return false; },
      limparRefazer: function () {},
      soltar: function () {}
    }
  };
})();
