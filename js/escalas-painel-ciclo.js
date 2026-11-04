/* ============================================================
   ESCALAS — o ciclo pelo painel do dia (as abas Dia e Ciclo)
   - o rascunho do ciclo: as mudanças do dia aberto que ainda não
     foram salvas; marcar e desmarcar não gravam: o Salvar do rodapé
     do painel (escalas-painel-salvar.js) grava junto com o Dia
     (escala_ciclo_salvar_lote, pelo escala_painel_salvar);
   - confirmar: a lista do que acontece com as trocas e folgas a
     partir do dia (escala_ciclo_retirar_analisar; as extras ficam) e
     a confirmação, antes de marcar quem sai ou muda de ciclo (a aba
     Ciclo); o Adicionar e o Remover militar mostram a mesma lista na
     própria sub-tela (analisarSair, analisarMudar e o efeito,
     molde tpl-escala-ciclo-efeito) e marcam ao vivo;
   - datas: as três últimas datas de serviço no ciclo atual, em
     bolinhas, com o dia da semana (o último serviço no ciclo antigo
     de quem muda de ciclo);
   - entrar (quem está fora do ciclo), sair, cancelar a saída e
     mudar de ciclo, e as frases de quem muda de ciclo: o Adicionar e
     o Remover militar da aba Dia e a aba Ciclo usam os mesmos.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada lista de datas
  /* o rascunho do dia aberto (chave = unidade|dia): [{ cpf, acao, ultimo_servico?, tipo, itens }]; tipo = entrar, sair,
     mudar ou cancelar_saida; itens = o que acontece com as trocas e folgas (a lista da confirmação) */
  var rascunho = { chave: '', lista: [] };

  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  /* "2026-10-23" -> "2026-10-24" */
  function diaSeguinte(iso) {
    var p = iso.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 1);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------- o rascunho ---------- */

  /* o rodapé do painel conta as mudanças das três abas */
  function avisar() { window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'ciclo' } })); }
  function doDia(unidadeId, iso) { return rascunho.chave === unidadeId + '|' + iso ? rascunho.lista : []; }
  function marcado(unidadeId, iso, cpf) { return doDia(unidadeId, iso).filter(function (x) { return x.cpf === cpf; })[0] || null; }
  function marcar(unidadeId, iso, mudanca) {
    var k = unidadeId + '|' + iso;
    if (rascunho.chave !== k) rascunho = { chave: k, lista: [] };
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
      if (x.ultimo_servico) m.ultimo_servico = x.ultimo_servico;
      return m;
    });
  }
  function limpar() {
    if (!rascunho.chave && !rascunho.lista.length) return;
    rascunho = { chave: '', lista: [] };
    avisar();
  }
  /* a foto do rascunho: a sub-tela ao vivo (escalas-painel-editar.js) volta a ela a cada resposta, sem avisar */
  function copia() { return { chave: rascunho.chave, lista: rascunho.lista.slice() }; }
  function voltarA(c) { rascunho = { chave: c.chave, lista: c.lista.slice() }; }
  /* "Sai do ciclo em 29/10" (o selo da linha marcada) */
  function textoMarcado(mudanca, iso) { return L().cicloMarcado[mudanca.tipo].replace('{data}', diaMes(iso)); }

  /* ---------- as ações: marcam no rascunho ---------- */

  /* o que acontece com as trocas, folgas e extras dele a partir de desde (escala = o texto do item da escala): uma
     Promise de { itens, nota } ou { erro } */
  function analisar(unidadeId, cpf, desde, escala) {
    return RosterWork.escalasDados.cicloRetirarAnalisar(unidadeId, cpf, desde).then(function (a) {
      if (!a || !a.success) return { erro: (a && a.error) || RosterWork.mensagens.saida.falhaLista };
      return RosterWork.avisoSaida(a.pendencias, { tipo: 'tirar', escala: escala });
    });
  }
  /* quem sai do ciclo a partir do dia, e quem muda de ciclo (o último serviço no ciclo atual, ou nenhum) */
  function analisarSair(unidadeId, iso, m) { return analisar(unidadeId, m.cpf, iso, RosterWork.mensagens.saida.escalaTirar); }
  function analisarMudar(unidadeId, iso, m, ultimo) {
    var data = diaMes(iso);
    return analisar(unidadeId, m.cpf, ultimo ? diaSeguinte(ultimo) : iso,
      ultimo ? L().cicloEscalaUltimo(diaMes(ultimo), data) : L().cicloEscalaMudar(data));
  }

  /* textos = { mensagem, escala, botao }; desde = o dia de onde a lista conta (sem ele, o iso); aoConfirmar(itens) */
  function confirmar(unidadeId, iso, cpf, textos, aoConfirmar, desde) {
    analisar(unidadeId, cpf, desde || iso, textos.escala).then(function (aviso) {
      if (aviso.erro) { RosterWork.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
      RosterWork.confirmar({ tipo: 'aviso', mensagem: textos.mensagem, itens: aviso.itens, nota: aviso.nota,
        textoConfirmar: textos.botao, aoConfirmar: function () { aoConfirmar(aviso.itens); } });
    });
  }

  /* o efeito na sub-tela (o Adicionar e o Remover militar): a nota com a lista do que acontece, no lugar do marcador.
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

  /* monta em lugar as datas (do molde tpl-escala-adicionar-data) e devolve marcar(data) */
  function datas(lugar, lista, aoEscolher) {
    lugar.textContent = '';
    var nome = 'escala-ciclo-datas-' + (++conta);
    (lista || []).forEach(function (d) {
      var op = RosterWork.tpl('tpl-escala-adicionar-data');
      if (!op) return;
      var r = op.querySelector('input');
      r.value = d;
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(d); });
      op.querySelector('.escala-adicionar-data-texto').textContent = RosterWork.data.comDiaSemanaExtenso(d);
      lugar.appendChild(op);
    });
    return function marcar(valor) {
      [].forEach.call(lugar.querySelectorAll('input[type="radio"]'), function (r) { r.checked = r.value === valor; });
    };
  }

  /* quem está fora do ciclo entra a partir do dia (desmarca-se na aba Ciclo) */
  function entrar(unidadeId, iso, m, aoTerminar) {
    marcar(unidadeId, iso, { cpf: m.cpf, acao: 'adicionar', tipo: 'entrar', itens: [] });
    if (aoTerminar) aoTerminar();
  }

  /* quem está no ciclo sai a partir do dia: a lista do que é cancelado e a confirmação */
  function sair(unidadeId, iso, m, aoTerminar) {
    confirmar(unidadeId, iso, m.cpf, {
      mensagem: msg().confirmarRemover.replace('{pessoa}', nomeDe(m)).replace('{data}', iso.split('-').reverse().join('/')),
      escala: RosterWork.mensagens.saida.escalaTirar, botao: msg().btnRemover
    }, function (itens) {
      marcarSair(unidadeId, iso, m, itens);
      if (aoTerminar) aoTerminar();
    });
  }
  /* as marcas sem a confirmação (a sub-tela já mostrou a lista; itens = o que acontece) */
  function marcarSair(unidadeId, iso, m, itens) { marcar(unidadeId, iso, { cpf: m.cpf, acao: 'tirar', tipo: 'sair', itens: itens }); }
  function marcarMudar(unidadeId, iso, m, ultimo, itens) {
    var mudanca = { cpf: m.cpf, acao: 'adicionar', tipo: 'mudar', itens: itens };
    if (ultimo) mudanca.ultimo_servico = ultimo;
    marcar(unidadeId, iso, mudanca);
  }

  /* a saída marcada mais à frente deixa de existir */
  function cancelarSaida(unidadeId, iso, m, aoTerminar) {
    marcar(unidadeId, iso, { cpf: m.cpf, acao: 'cancelar_saida', tipo: 'cancelar_saida', itens: [] });
    if (aoTerminar) aoTerminar();
  }

  /* quem já está no ciclo muda de ciclo: a lista do que é cancelado depois do último serviço escolhido e a confirmação */
  function mudar(unidadeId, iso, m, ultimo, aoTerminar) {
    var data = diaMes(iso);
    confirmar(unidadeId, iso, m.cpf, {
      mensagem: L().cicloConfirmarMudar(nomeDe(m), data),
      escala: ultimo ? L().cicloEscalaUltimo(diaMes(ultimo), data) : L().cicloEscalaMudar(data),
      botao: L().botaoMudarCiclo
    }, function (itens) {
      marcarMudar(unidadeId, iso, m, ultimo, itens);
      if (aoTerminar) aoTerminar();
    }, ultimo ? diaSeguinte(ultimo) : iso);
  }

  /* as frases de quem muda de ciclo: o que sai da escala dele (o alerta) e o aviso de antes de confirmar */
  function frasesMudar(m, ultimo, iso) {
    var D = RosterWork.data, lista = m.ultimos_servicos || [];
    var alerta = ultimo
      ? L().cicloRemovido(nomeDe(m), D.diaMesExtenso(ultimo), lista.filter(function (d) { return d > ultimo; }).map(D.diaMesExtenso), D.diaMesExtenso(iso))
      : L().cicloMudar(diaMes(m.desde), m.ultimo_servico ? diaMes(m.ultimo_servico) : '', diaMes(iso));
    return { alerta: alerta, info: L().cicloMudarAviso(ultimo ? diaMes(ultimo) : '') };
  }

  window.RosterWork.escalasPainelCiclo = {
    doDia: doDia, marcado: marcado, desmarcar: desmarcar, contar: contar, envio: envio, limpar: limpar, textoMarcado: textoMarcado,
    copia: copia, voltarA: voltarA,
    confirmar: confirmar, datas: datas, entrar: entrar, sair: sair, cancelarSaida: cancelarSaida, mudar: mudar, frasesMudar: frasesMudar,
    analisarSair: analisarSair, analisarMudar: analisarMudar, efeito: efeito, marcarSair: marcarSair, marcarMudar: marcarMudar
  };
})();
