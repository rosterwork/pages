/* ============================================================
   AVISOS — o que espera DECISÃO (pendências).
   Diferente da notificação: pendência é estado, não evento —
   é consultada na hora (pendencias_listar) e some sozinha quando
   alguém resolve, por isso não tem "lido".
   O mesmo dado alimenta dois lugares: "Precisa de você" (as suas,
   `minha: true`) e a aba "Administração" (as do administrador,
   `minha: false`). Clicar leva à tela — e à aba — onde se resolve.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};


  function renderizar(lista, itens, textoVazio) {
    lista.textContent = '';
    if (!itens.length) {
      var vazio = RosterWork.tpl('tpl-avisos-vazio');
      if (vazio) { vazio.textContent = textoVazio; lista.appendChild(vazio); }
      return;
    }
    itens.forEach(function (p) {
      if (p.tipo === 'fora_escala') { renderForaEscala(lista, p); return; }
      if (p.tipo === 'manutencao') { renderManutencao(lista, p); return; }
      var el = RosterWork.tpl('tpl-avisos-pendencia');
      if (!el) return;
      el.querySelector('.avisos-pendencia-contagem').textContent = p.contagem;
      el.querySelector('.avisos-pendencia-texto').textContent = p.texto || '';
      el.addEventListener('click', function () {
        if (p.pagina && RW.irParaPagina) RW.irParaPagina(p.pagina, p.aba);
      });
      lista.appendChild(el);
    });
  }

  /* "operacional fora da escala": não navega — lista os nomes (grad + nome + unidade),
     para o admin ver quem está e ir corrigir pelo Contínuos como quiser */
  function renderForaEscala(lista, p) {
    var el = RosterWork.tpl('tpl-avisos-pendencia-fora');
    if (!el) return;
    el.querySelector('.avisos-pendencia-contagem').textContent = p.contagem;
    el.querySelector('.avisos-pendencia-texto').textContent = p.texto || '';
    var ul = el.querySelector('.avisos-fora-lista');
    (p.militares || []).forEach(function (m) {
      var li = RosterWork.tpl('tpl-avisos-fora-item');
      if (!li) return;
      li.querySelector('.avisos-fora-grad').textContent = m.grad || '';
      li.querySelector('.avisos-fora-nome').textContent = m.nome || '';
      li.querySelector('.avisos-fora-unidade').textContent = m.unidade || '';
      if (ul) ul.appendChild(li);
    });
    lista.appendChild(el);
  }

  /* "viatura em manutenção": não navega — lista as viaturas (nome + desde + unidade),
     para o admin ver quais estão paradas e resolver na Escala/Distribuição */
  function renderManutencao(lista, p) {
    var el = RosterWork.tpl('tpl-avisos-pendencia-manutencao');
    if (!el) return;
    el.querySelector('.avisos-pendencia-contagem').textContent = p.contagem;
    el.querySelector('.avisos-pendencia-texto').textContent = p.texto || '';
    var ul = el.querySelector('.avisos-manut-lista');
    (p.viaturas || []).forEach(function (v) {
      var li = RosterWork.tpl('tpl-avisos-manut-item');
      if (!li) return;
      li.querySelector('.avisos-manut-viatura').textContent = v.viatura || '';
      li.querySelector('.avisos-manut-data').textContent = v.desde || '';
      li.querySelector('.avisos-manut-unidade').textContent = v.unidade || '';
      if (ul) ul.appendChild(li);
    });
    lista.appendChild(el);
  }

  /* uma leitura só alimenta os dois destinos; devolve quantas são de
     administração (é a contagem que vai no selo da aba "Administração") */
  function carregar(minhas, deAdministracao) {
    var T = RW.mensagens.avisos;
    return RW.apiFetch('/rest/v1/rpc/pendencias_listar', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (itens) {
        itens = Array.isArray(itens) ? itens : [];
        var deles = itens.filter(function (p) { return !p.minha; });
        if (minhas) renderizar(minhas, itens.filter(function (p) { return p.minha; }), T.semPendencias);
        if (deAdministracao) renderizar(deAdministracao, deles, T.semPendenciasAdministracao);
        return deles.length;
      })
      .catch(function () {
        [minhas, deAdministracao].forEach(function (lista) {
          if (!lista) return;
          lista.textContent = '';
          var vazio = RosterWork.tpl('tpl-avisos-vazio');
          if (vazio) { vazio.textContent = T.falhaCarregar; lista.appendChild(vazio); }
        });
        return 0;
      });
  }

  RW.avisosPendencias = { carregar: carregar };
})();
