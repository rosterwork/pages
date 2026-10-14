/* ============================================================
   IMPACTO NA ESCALA — componente compartilhado (Trocas e Folgas)
   Desenha, num alvo, o resultado da análise de impacto vinda do
   banco: uma nota por ponto (amarela = atenção, vermelha = problema;
   sem nenhum, a nota verde "Sem impacto na escala"). O dia inteiro
   ("Como fica a escala") é do geral-decisao, que abre sob pedido.
   selo() dá o selo do resultado para os cartões da Pendências.
   Não cria HTML solto: clona os moldes tpl-geral-impacto-* do shell.
   Uso: RosterWork.impacto.desenhar(alvoEl, resultado)
   resultado = { veredito:'ok'|'alerta'|'problema', problemas, alertas,
                 avisos:[{gravidade,titulo,descricao}],
                 antes_depois:[{posto,funcao,de,para}] }
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function msg() { return (RosterWork.mensagens && RosterWork.mensagens.impacto) || {}; }

  /* uma nota: tipo 'sucesso' | 'alerta' | 'erro' */
  function nota(tipo, titulo, descricao) {
    var el = RosterWork.tpl('tpl-geral-impacto-nota');
    if (!el) return null;
    el.classList.add('nota--' + tipo);
    if (tipo === 'sucesso') { var uso = el.querySelector('use'); if (uso) uso.setAttribute('href', 'icones/icone-sucesso.svg#icone-sucesso'); }
    el.querySelector('.nota-titulo').textContent = titulo || '';
    el.querySelector('.impacto-nota-desc').textContent = descricao || '';
    return el;
  }

  function desenhar(alvo, r) {
    if (!alvo || !r) return;
    alvo.textContent = '';
    var avisos = r.avisos || [];
    if (!avisos.length) {
      var ok = nota('sucesso', msg().okFrase, '');
      if (ok) alvo.appendChild(ok);
      return;
    }
    avisos.forEach(function (a) {
      var el = nota(a.gravidade === 'problema' ? 'erro' : 'alerta', a.titulo ? a.titulo + '.' : '', a.descricao);
      if (el) alvo.appendChild(el);
    });
  }

  /* o selo do resultado (cartões da Pendências): { classe, texto } */
  function selo(r) {
    var m = msg();
    if (!r || !r.veredito) return null;
    if (r.veredito === 'problema') return { classe: 'selo--erro', texto: m.seloProblema(r.problemas || r.veredito_problemas || 1) };
    if (r.veredito === 'alerta') return { classe: 'selo--alerta', texto: m.seloAlerta(r.alertas || r.veredito_alertas || 1) };
    return { classe: 'selo--sucesso', texto: m.seloOk };
  }

  window.RosterWork.impacto = { desenhar: desenhar, selo: selo };
})();
