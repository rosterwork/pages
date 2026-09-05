/* ============================================================
   IMPACTO NA ESCALA — componente compartilhado (Trocas e Folgas)
   Desenha, num alvo, a análise de impacto vinda do banco:
   a faixa de veredito (verde/amarelo/vermelho), a lista de avisos
   e as linhas "antes → depois". Não cria HTML solto: clona os
   moldes tpl-geral-impacto-* do shell.
   Uso: RosterWork.impacto.desenhar(alvoEl, resultado)
   resultado = { veredito:'ok'|'alerta'|'problema', problemas, alertas,
                 avisos:[{gravidade,titulo,descricao}],
                 antes_depois:[{posto,funcao,de,para}] }
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};


  /* frase da faixa de veredito (compartilhada em RosterWork.mensagens.impacto) */
  function vereditoFrase(r) {
    var m = (RosterWork.mensagens && RosterWork.mensagens.impacto) || {};
    if (r.veredito === 'problema') return m.problemaFrase ? m.problemaFrase(r.problemas || 0) : '';
    if (r.veredito === 'alerta') return m.alertaFrase ? m.alertaFrase(r.alertas || 0) : '';
    return m.okFrase || '';
  }

  function desenhar(alvo, r) {
    if (!alvo || !r) return;
    alvo.textContent = '';
    var m = (RosterWork.mensagens && RosterWork.mensagens.impacto) || {};

    var v = RosterWork.tpl('tpl-geral-impacto-veredito');
    if (v) {
      v.classList.add('impacto-veredito--' + r.veredito);
      if (r.veredito === 'ok') { var uso = v.querySelector('use'); if (uso) uso.setAttribute('href', 'icones/icone-sucesso.svg#icone-sucesso'); }
      var vt = v.querySelector('.impacto-veredito-texto'); if (vt) vt.textContent = vereditoFrase(r);
      alvo.appendChild(v);
    }

    (r.avisos || []).forEach(function (a) {
      var el = RosterWork.tpl('tpl-geral-impacto-aviso');
      if (!el) return;
      el.classList.add(a.gravidade === 'problema' ? 'impacto-aviso--problema' : 'impacto-aviso--alerta');
      var t = el.querySelector('.impacto-aviso-titulo'); if (t) t.textContent = a.titulo || '';
      var d = el.querySelector('.impacto-aviso-desc'); if (d) d.textContent = a.descricao || '';
      alvo.appendChild(el);
    });

    (r.antes_depois || []).forEach(function (x) {
      var el = RosterWork.tpl('tpl-geral-impacto-antesdepois');
      if (!el) return;
      var rot = el.querySelector('.impacto-ad-rotulo'); if (rot) rot.textContent = ((x.posto || '') + ' · ' + (x.funcao || '')).trim();
      var de = el.querySelector('.impacto-ad-de'); if (de) de.textContent = x.de || '';
      var para = el.querySelector('.impacto-ad-para');
      if (para) {
        if (x.para) { para.textContent = x.para; }
        else { para.textContent = m.vago || 'vago'; para.classList.add('impacto-ad-para--vago'); }
      }
      alvo.appendChild(el);
    });
  }

  window.RosterWork.impacto = { desenhar: desenhar, vereditoFrase: vereditoFrase };
})();
