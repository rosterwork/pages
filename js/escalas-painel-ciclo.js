/* ============================================================
   ESCALAS — as guarnições pelo painel do dia (o ciclo automático; as
   abas Funções, Militares e Guarnições)
   - o rascunho das guarnições: as mudanças do dia aberto que ainda
     não foram salvas; marcar e desmarcar não gravam: o Salvar do
     rodapé do painel (escalas-painel-salvar.js) grava junto com o dia
     (escala_ciclo_salvar_lote, pelo escala_painel_salvar). Cada
     mudança pode levar a sua data e a letra da guarnição (a aba
     Guarnições); sem elas, vale a partir do dia aberto, na guarnição
     dele (o Adicionar militar sem a letra, e o Remover do dia);
   - o Desfazer e o Refazer da aba Guarnições: cada passo dela guarda
     a mudança de antes e a de depois do militar (marcarPasso,
     desmarcarPasso);
   - analisar: a lista do que acontece com as trocas e folgas a
     partir de uma data (escala_ciclo_retirar_analisar; as extras
     ficam), que o Adicionar militar, o Remover do dia e o Remover da
     guarnição mostram (o efeito, molde tpl-escala-ciclo-efeito);
   - o Remover da guarnição e o Cancelar a saída do menu da linha, na
     aba Militares: a pergunta Último serviço embaixo da linha e a
     saída que sai do rascunho (ou o cancelamento da gravada).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* o rascunho do dia aberto (chave = unidade|dia), uma mudança por militar: [{ cpf, acao, data?, letra?, ultimo_servico?,
     tipo, itens, de? }]; acao = adicionar (pôr numa guarnição ou mudar de guarnição), tirar ou cancelar_saida; tipo =
     entrar, mudar, sair ou cancelar_saida; itens = o que acontece com as trocas e folgas (a lista da pergunta); de = a
     guarnição de antes (quem muda pela aba Guarnições) */
  var rascunho = { chave: '', lista: [] };
  var pilha = [];      // os passos da aba Guarnições, { cpf, antes, depois } (o Desfazer volta o último)
  var refeitos = [];   // os passos desfeitos (o Refazer)

  /* ---------- o rascunho ---------- */

  /* o rodapé do painel conta as mudanças das abas */
  function avisar() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'ciclo' } })); }
  function doDia(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso ? rascunho.lista : []; }
  function marcado(unidadeId, iso, cpf) { return doDia(unidadeId, iso).filter(function (x) { return x.cpf === cpf; })[0] || null; }
  function marcar(unidadeId, iso, mudanca) {
    var k = unidadeId + '|' + iso;
    if (rascunho.chave !== k) { rascunho = { chave: k, lista: [] }; pilha = []; refeitos = []; }
    rascunho.lista = rascunho.lista.filter(function (x) { return x.cpf !== mudanca.cpf; }).concat([mudanca]);
    avisar();
  }
  function desmarcar(cpf) {
    rascunho.lista = rascunho.lista.filter(function (x) { return x.cpf !== cpf; });
    avisar();
  }
  function contar() { return rascunho.lista.length; }
  /* o que vai ao banco no Salvar */
  function envio() {
    return rascunho.lista.map(function (x) {
      var m = { cpf: x.cpf, acao: x.acao };
      if (x.data) m.data = x.data;
      if (x.letra) m.letra = x.letra;
      if (x.ultimo_servico) m.ultimo_servico = x.ultimo_servico;
      return m;
    });
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
    if (rascunho.chave !== k) { rascunho = { chave: k, lista: [] }; pilha = []; refeitos = []; }
    pilha.push({ cpf: cpf, antes: marcado(unidadeId, iso, cpf), depois: depois });
    refeitos = [];
    trocarDe(cpf, depois);
    avisar();
  }
  function marcarPasso(unidadeId, iso, mudanca) { passo(unidadeId, iso, mudanca.cpf, mudanca); }
  function desmarcarPasso(unidadeId, iso, cpf) { passo(unidadeId, iso, cpf, null); }
  function podeDesfazer(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso && pilha.length > 0; }
  function podeRefazer(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso && refeitos.length > 0; }
  function desfazer() {
    var p = pilha.pop();
    if (!p) return;
    refeitos.push(p);
    trocarDe(p.cpf, p.antes);
    avisar();
  }
  function refazer() {
    var p = refeitos.pop();
    if (!p) return;
    pilha.push(p);
    trocarDe(p.cpf, p.depois);
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
  /* quem sai da escala a partir do dia, e quem muda de guarnição no dia */
  function analisarSair(unidadeId, iso, m) { return analisar(unidadeId, m.cpf, iso, RosterWork.mensagens.saida.escalaTirar); }
  function analisarMudar(unidadeId, iso, m, letra) {
    return analisar(unidadeId, m.cpf, iso, RosterWork.mensagens.escala.linha.guarnicaoEscalaMudar(letra, iso.split('-').reverse().slice(0, 2).join('/')));
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
  /* quem já está numa guarnição passa para a do dia (itens = o que acontece) */
  function marcarMudar(unidadeId, iso, m, itens, letra) {
    var mudanca = { cpf: m.cpf, acao: 'adicionar', tipo: 'mudar', itens: itens || [] };
    if (letra) { mudanca.letra = letra; mudanca.data = iso; }
    marcar(unidadeId, iso, mudanca);
  }
  /* quem sai da escala no dia (a sub-tela já mostrou a lista; itens = o que acontece) */
  function marcarSair(unidadeId, iso, m, itens) { marcar(unidadeId, iso, { cpf: m.cpf, acao: 'tirar', tipo: 'sair', itens: itens }); }

  /* ---------- a aba Militares: o Remover da guarnição e o Cancelar a saída (o menu da linha) ---------- */

  var pergunta = null;   // a pergunta Último serviço aberta embaixo de uma linha: { el, pedido, passos }
  var conta = 0;         // nome único para os rádios de cada pergunta

  function ed() { return RosterWork.escalasPainelEditar.sub; }

  /* ele está no dia pela guarnição (o Remover da guarnição vale)? Até 7 dias atrás, como toda mudança */
  function podeSair(cpf) {
    var api = ed(), mil = api.militarDoDia(cpf), R = RosterWork.escalasPainelRemoverListas, h = new Date();
    if (!mil || !R || mil.remanejado) return false;
    if (api.iso() < RosterWork.data.paraIsoDeData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 7))) return false;
    return R.partesDe(mil).some(function (p) { return p.origem === 'ciclo'; });
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
     trocas, folgas e extras dele; o Cancelar volta ao que era. Ela fica aberta até a próxima ação */
  function perguntarSaida(m, linha) {
    if (RosterWork.escalasPainelRemover) RosterWork.escalasPainelRemover.fecharPergunta('guardar');
    fecharPergunta('guardar');
    var el = RosterWork.tpl('tpl-escala-remover-guarnicao');
    if (!el || !linha) return;
    var api = ed(), uid = api.unidadeId(), iso = api.iso(), cpf = m.cpf, antes = marcado(uid, iso, cpf);
    var d = iso.split('-'), amanha = RosterWork.data.paraIsoDeData(new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]) + 1));
    var p = { el: el, pedido: 0, passos: 0 };
    [].forEach.call(el.querySelectorAll('.escala-remover-guarnicao-data'), function (s) { s.textContent = d[2] + '/' + d[1]; });
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
    });
    linha.insertAdjacentElement('afterend', el);
    pergunta = p;
  }

  /* o Cancelar a saída da linha riscada (aba Militares; data = a da saída): a saída marcada sai, no rascunho; a que só
     estava no rascunho (o Remover da guarnição) só sai dele. A lista se refaz sem ela */
  function cancelarSaida(m, data) {
    fecharPergunta('guardar');
    var api = ed(), uid = api.unidadeId(), iso = api.iso(), antes = marcado(uid, iso, m.cpf);
    if (antes && antes.acao === 'tirar') desmarcarPasso(uid, iso, m.cpf);
    else marcarPasso(uid, iso, { cpf: m.cpf, acao: 'cancelar_saida', tipo: 'cancelar_saida', data: data, itens: [] });
    api.redesenhar();
  }

  window.RosterWork.escalasPainelCiclo = {
    doDia: doDia, marcado: marcado, desmarcar: desmarcar, contar: contar, envio: envio, limpar: limpar,
    copia: copia, voltarA: voltarA,
    marcarPasso: marcarPasso, desmarcarPasso: desmarcarPasso, podeDesfazer: podeDesfazer, podeRefazer: podeRefazer,
    desfazer: desfazer, refazer: refazer,
    analisar: analisar, analisarSair: analisarSair, analisarMudar: analisarMudar, efeito: efeito,
    entrar: entrar, marcarMudar: marcarMudar, marcarSair: marcarSair,
    /* a aba Militares (o menu da linha): o Remover da guarnição e o Cancelar a saída */
    podeSair: podeSair, perguntarSaida: perguntarSaida, cancelarSaida: cancelarSaida, fecharPergunta: fecharPergunta
  };
})();
