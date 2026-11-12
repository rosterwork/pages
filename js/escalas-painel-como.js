/* ============================================================
   COMO A ESCALA FOI FEITA — o botão do painel do dia (à esquerda do
   Imprimir, só na Escala, para todos) e o clique no nome da função.
   O botão abre o texto numa sub-tela, no lugar da lista do dia, com o
   Voltar ao dia (como o Imprimir); o nome da função abre a caixa
   flutuante (RosterWork.caixaFlutuante; no celular, a folha) com quem
   está nela em cada horário e o motivo. Lê escala_como_foi_feita (uma
   vez por dia aberto; lê de novo depois de um Salvar) e monta as frases
   por RosterWork.mensagens.escala.como. Com alteração não salva, o
   botão e os nomes ficam desligados (o texto é o da escala gravada).
   API: RosterWork.escalasPainelComo
        .botaoDoDia(aoClicar) -> botão (null fora da Escala)
        .abrirNoDia(corpo, rodape, { unidadeId, iso, aoSair })
        .rotulo(el, { unidadeId, iso, posto, funcoes })  (el = o .escala-edicao-funcao)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var cache = {};   // 'unidade|dia' -> promessa da leitura

  function msg() { return RW.mensagens.escala.como; }

  function pendente() { return !!(RW.escalasPainelSalvar && RW.escalasPainelSalvar.contar()); }

  function ler(unidadeId, iso) {
    var chave = unidadeId + '|' + iso;
    if (!cache[chave]) {
      cache[chave] = RW.apiFetch('/rest/v1/rpc/escala_como_foi_feita', { metodo: 'POST', corpo: { p_unidade_id: Number(unidadeId), p_data: iso } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (dados) { if (!dados) delete cache[chave]; return dados; });
    }
    return cache[chave];
  }

  /* o dia foi salvo: a próxima leitura vem do banco */
  window.addEventListener('rosterwork_escala_salva', function () { cache = {}; atualizarLigados(); });
  window.addEventListener('rosterwork_escala_rascunho', function () { atualizarLigados(); });

  /* o botão e os nomes desligam com alteração não salva (a dica diz o motivo) */
  function ligar(b) {
    if (!b.dataset.dicaPadrao) b.dataset.dicaPadrao = b.getAttribute('data-dica') || '';
    var p = pendente();
    b.disabled = p;
    b.setAttribute('data-dica', p ? msg().salveAntes : b.dataset.dicaPadrao);
  }
  function atualizarLigados() {
    [].forEach.call(document.querySelectorAll('#painel .escala-dia-como, #painel .escala-como-rotulo'), ligar);
  }

  /* uma lista de frases: as do banco entram antes das fixas do molde (a regra dos Efetivos, o "Tudo foi cumprido") */
  var FIXAS = '[data-como-fixo], [data-como-vazio], [data-como-efetivos]';
  function encher(lista, frases) {
    [].forEach.call(lista.querySelectorAll('.escala-observacao'), function (li) { if (!li.matches(FIXAS)) li.remove(); });
    var antes = lista.querySelector(FIXAS);
    frases.forEach(function (f) {
      var li = RW.tpl('tpl-escala-como-item');
      if (!li) return;
      li.querySelector('.escala-observacao-texto').textContent = f;
      lista.insertBefore(li, antes);
    });
  }

  /* as frases dos motivos de uma pessoa, juntas */
  function frasesDe(p) {
    return (p.motivos || []).map(function (m) { return msg().motivo(m); }).filter(function (f) { return !!f; }).join(' ');
  }

  function grupoDaFuncao(base) {
    if (base === 'Chefe de Socorro' || base === 'Oficial de Área') return 'chefe';
    if (base === 'Condutor') return 'condutores';
    if (base === 'Efetivo') return 'efetivos';
    return 'outras';
  }

  /* ---------- o botão e a sub-tela ---------- */

  function botaoDoDia(aoClicar) {
    if (!document.getElementById('tpl-escala-como')) return null;
    var b = RW.tpl('tpl-escala-dia-como');
    if (!b) return null;
    ligar(b);
    b.addEventListener('click', aoClicar);
    return b;
  }

  function abrirNoDia(corpo, rodape, opcoes) {
    if (!corpo) return;
    corpo.textContent = '';
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    var voltar = RW.tpl('tpl-escala-sub-voltar');
    if (voltar) {
      voltar.addEventListener('click', function () { opcoes.aoSair(); });
      corpo.appendChild(voltar);
    }
    var tela = RW.tpl('tpl-escala-como');
    if (!tela) return;
    var titulo = tela.querySelector('[data-como-titulo]');
    titulo.textContent = msg().titulo(RW.data.isoParaBR(opcoes.iso));
    var pontos = RW.tpl('carregando-pontos');
    if (pontos) titulo.appendChild(pontos);
    [].forEach.call(tela.querySelectorAll('[data-como-caixa]'), function (c) { c.classList.add('oculto'); });
    corpo.appendChild(tela);
    /* o texto começa do alto (a lista do dia podia estar rolada) */
    for (var el = corpo; el; el = el.parentElement) { if (el.scrollTop) el.scrollTop = 0; }
    ler(opcoes.unidadeId, opcoes.iso).then(function (dados) {
      if (!tela.isConnected) return;
      if (pontos && pontos.parentNode) pontos.remove();
      if (!dados) { RW.avisar({ tipo: 'erro', mensagem: msg().erro }); return; }
      preencherTela(tela, dados);
    });
  }

  function preencherTela(tela, dados) {
    var M = msg();
    var por = { servico: [], chefe: [], condutores: [], outras: [], efetivos: [], problemas: [] };
    (dados.servico || []).forEach(function (s) { por.servico.push(M.servico(s.hi, s.hf, s.quantidade)); });
    if (dados.minimo) por.servico.push(M.minimo(dados.minimo));
    (dados.fora || []).forEach(function (f) { por.servico.push(M.fora(f.posto, f.faixas)); });
    (dados.funcoes || []).forEach(function (f) {
      var inicio = f.funcao + ' (' + f.posto + ')';
      (f.pessoas || []).forEach(function (p) { por[grupoDaFuncao(f.base)].push(M.pessoa(inicio, p, frasesDe(p))); });
    });
    /* o que não deu para cumprir: os mesmos avisos do alto do painel */
    var P = RW.escalasPainel && RW.escalasPainel.pecas;
    if (P && P.linhasDoAviso) {
      P.linhasDoAviso(dados.problemas || [], [], [], [], false).forEach(function (l) { if (l.texto) por.problemas.push(l.texto + '.'); });
    }
    [].forEach.call(tela.querySelectorAll('[data-como-caixa]'), function (c) {
      var nome = c.getAttribute('data-como-caixa');
      var frases = por[nome] || [];
      var lista = c.querySelector('[data-como-lista]');
      if (lista) encher(lista, frases);
      var vazio = c.querySelector('[data-como-vazio]');
      if (vazio) vazio.classList.toggle('oculto', frases.length > 0);
      c.classList.toggle('oculto', !frases.length && !c.hasAttribute('data-como-sempre'));
    });
  }

  /* ---------- o nome da função ---------- */

  var caixaAberta = null;   // a caixa da função aberta daqui

  /* o Esc fecha só a caixa da função: o painel do dia, atrás dela, fica aberto (o Esc dele não chega a ouvir) */
  window.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || !caixaAberta || !caixaAberta.aberta()) return;
    if (document.querySelector('.dropdown--aberto, .modal-veu--aberto')) return;
    ev.stopPropagation();
    caixaAberta.fechar();
  }, true);

  function rotulo(el, info) {
    if (!el || !info || !document.getElementById('tpl-escala-como-rotulo') || !RW.caixaFlutuante) return;
    var b = RW.tpl('tpl-escala-como-rotulo');
    if (!b) return;
    while (el.firstChild) b.appendChild(el.firstChild);
    el.appendChild(b);
    ligar(b);
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      abrirCaixa(b, info);
    });
  }

  function abrirCaixa(b, info) {
    var conteudo = RW.tpl('tpl-escala-como-funcao');
    if (!conteudo) return;
    var funcoes = info.funcoes || [];
    var titulo = funcoes.join(' e ') + ' (' + info.posto + ')';
    var tituloEl = conteudo.querySelector('.escala-como-funcao-titulo');
    tituloEl.textContent = titulo;
    if (RW.celular && RW.celular()) tituloEl.classList.add('oculto');   // no celular, o título vai na folha
    /* a caixa abre quando as frases chegam; se demoram, com os pontos */
    var caixa = RW.caixaFlutuante.abrir({ peca: b, copiar: true, titulo: titulo });
    if (!caixa) return;
    caixaAberta = caixa;
    var demora = setTimeout(function () { caixa.espera(true); }, 300);
    ler(info.unidadeId, info.iso).then(function (dados) {
      clearTimeout(demora);
      if (!caixa.aberta()) return;
      caixa.espera(false);
      if (!dados) { caixa.fechar(); RW.avisar({ tipo: 'erro', mensagem: msg().erro }); return; }
      var M = msg(), frases = [], efetivo = false;
      funcoes.forEach(function (nome) {
        (dados.funcoes || []).forEach(function (f) {
          if (f.posto !== info.posto || f.funcao !== nome) return;
          if (f.base === 'Efetivo') efetivo = true;
          (f.pessoas || []).forEach(function (p) { frases.push(M.pessoa(funcoes.length > 1 ? f.funcao : '', p, frasesDe(p))); });
        });
      });
      encher(conteudo.querySelector('[data-como-lista]'), frases);
      conteudo.querySelector('[data-como-efetivos]').classList.toggle('oculto', !efetivo);
      caixa.conteudo(conteudo);
    });
  }

  RW.escalasPainelComo = { botaoDoDia: botaoDoDia, abrirNoDia: abrirNoDia, rotulo: rotulo };
})();
