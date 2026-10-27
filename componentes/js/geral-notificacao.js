/* ============================================================
   COMPONENTE geral-notificacao — uma notificação (o que aconteceu
   com uma pessoa), igual no sino e na página Avisos › Notificações
     · montar(n, opcoes) → o item pronto, do molde #tpl-notificacao:
         o ponto da não lida, o ícone do assunto, a etiqueta ADM (o
         campo adm do banco), o título e o texto; o clique abre.
         opcoes = { modo: 'gaveta' (o sino) | 'cartao' (a página),
                    meta (a linha de apoio, no sino: autor · data),
                    hora (na página), aoMudar() (quem mostrou relê) }
     · vazio(texto) → o item da gaveta sem nada (desabilitado)
     · abrir(n, aoMudar) → marca como lida (se ainda não estiver) e
         vai para a tela do assunto (pagina, aba e referencia_id do
         aviso; o de um pedido aponta para a Pendências, já no
         pedido). Depois de marcar, quem mostrou relê e o sino também
   Clona moldes; não cria HTML.
   RosterWork.notificacao.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o assunto vira ícone: os quatro moram no molde e só um fica visível */
  var COM_ICONE = { troca: true, folga: true, dados: true };

  function mostrarIcone(el, tipo) {
    var qual = COM_ICONE[tipo] ? tipo : 'outro';
    [].forEach.call(el.querySelectorAll('.notificacao-icone .icone'), function (icone) {
      icone.classList.toggle('oculto', icone.getAttribute('data-tipo') !== qual);
    });
  }

  /* a linha de apoio e a hora só aparecem quando há o que mostrar */
  function opcional(el, texto) {
    el.textContent = texto || '';
    el.classList.toggle('oculto', !texto);
  }

  function abrir(n, aoMudar) {
    function irPara() {
      if (n.pagina && RW.irParaPagina) RW.irParaPagina(n.pagina, n.aba, n.referencia_id);
    }
    if (RW.fecharDropdowns) RW.fecharDropdowns();
    if (n.lida) { irPara(); return; }
    RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: [n.id] } })
      .then(function () {
        if (aoMudar) aoMudar();
        if (RW.avisosSino) RW.avisosSino.recarregar();   /* o número do sino zera junto */
        irPara();
      })
      .catch(irPara);
  }

  function montar(n, opcoes) {
    opcoes = opcoes || {};
    var el = RosterWork.tpl('tpl-notificacao');
    if (!el) return null;
    el.classList.add(opcoes.modo === 'cartao' ? 'notificacao--cartao' : 'notificacao--gaveta');
    el.classList.toggle('notificacao--nao-lida', !n.lida);
    mostrarIcone(el, n.tipo);
    el.querySelector('.etiqueta-adm-linha .etiqueta-adm').classList.toggle('oculto', !n.adm);
    el.querySelector('.notificacao-titulo').textContent = n.titulo || '';
    el.querySelector('.notificacao-texto').textContent = n.texto || '';
    opcional(el.querySelector('.notificacao-meta'), opcoes.meta);
    opcional(el.querySelector('.notificacao-hora'), opcoes.hora);
    el.addEventListener('click', function () { abrir(n, opcoes.aoMudar); });
    return el;
  }

  function vazio(texto) {
    var el = RosterWork.tpl('tpl-notificacao');
    if (!el) return null;
    el.classList.add('notificacao--gaveta', 'notificacao--vazio');
    el.disabled = true;
    el.querySelector('.notificacao-titulo').textContent = texto;
    return el;
  }

  RW.notificacao = { montar: montar, vazio: vazio, abrir: abrir };
})();
