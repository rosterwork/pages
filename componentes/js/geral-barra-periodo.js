/* ============================================================
   BARRA DE PERÍODO — componente compartilhado
   Régua de um turno 08h→08h (24h = 1440 min; minuto 0 = 08:00).
   Dois puxadores livres, snap de hora cheia, presos à faixa
   disponível (o serviço daquele dia). Só posições (dados
   calculados) vão para custom properties; o CSS pinta.
   CSS: componentes/css/geral-barra-periodo.css · molde: #tpl-barra-periodo
   Uso: RosterWork.barraPeriodo.criar(container, { limite:{inicioMin,fimMin}, aoMudar(valor) })
   valor() → { inicioMin, fimMin, minutos, total, hi, hf }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  var TOTAL = 1440;   /* 24h em minutos */

  /* minutos desde 08:00 → 'HH:00' na régua 08→08 */
  function minParaHora(min) {
    var t = ((8 * 60 + (min % TOTAL)) % TOTAL + TOTAL) % TOTAL;
    var h = Math.floor(t / 60);
    var m = t % 60;
    return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
  }

  function pct(min) { return (min / TOTAL * 100) + '%'; }

  function criar(container, opcoes) {
    opcoes = opcoes || {};
    var tpl = document.getElementById('tpl-barra-periodo');
    if (!tpl || !container) return null;

    var el = tpl.content.cloneNode(true).firstElementChild;
    container.appendChild(el);

    var trilho = el.querySelector('.barra-periodo-trilho');
    var elLimite = el.querySelector('.barra-periodo-limite');
    var elFill = el.querySelector('.barra-periodo-fill');
    var elRotulo = el.querySelector('.barra-periodo-rotulo');
    var elHoras = el.querySelector('.barra-periodo-horas');
    var hIni = el.querySelector('[data-tipo="inicio"]');
    var hFim = el.querySelector('[data-tipo="fim"]');

    var limIni = opcoes.limite ? opcoes.limite.inicioMin : 0;
    var limFim = opcoes.limite ? opcoes.limite.fimMin : TOTAL;
    var ini = limIni;
    var fim = limFim;
    var arrastando = null;
    var ativo = !opcoes.desativado;   /* desativado = visível mas travada (ex.: antes de escolher a data) */
    var blocoOrigem = 0, blocoIni = 0, blocoDur = 0;

    function valor() {
      return {
        inicioMin: ini, fimMin: fim, minutos: fim - ini,
        total: (ini === limIni && fim === limFim && limIni === 0 && limFim === TOTAL),
        hi: minParaHora(ini), hf: minParaHora(fim)
      };
    }

    function pintar() {
      elLimite.style.setProperty('--lim-ini', pct(limIni));
      elLimite.style.setProperty('--lim-larg', pct(limFim - limIni));
      elFill.style.setProperty('--ini', pct(ini));
      elFill.style.setProperty('--larg', pct(fim - ini));
      hIni.style.setProperty('--pos', pct(ini));
      hFim.style.setProperty('--pos', pct(fim));
      if (!ativo) { if (elRotulo) elRotulo.textContent = ''; if (elHoras) elHoras.textContent = ''; return; }
      var m = RW.mensagens.trocas;
      if (ini === limIni && fim === limFim) {
        if (elRotulo) elRotulo.textContent = m.barraCobreTudo;
        if (elHoras) elHoras.textContent = '';
      } else {
        var horas = Math.round((fim - ini) / 60 * 10) / 10;
        if (elRotulo) elRotulo.textContent = m.barraTrecho;
        if (elHoras) elHoras.textContent = ' · ' + minParaHora(ini) + ' às ' + minParaHora(fim) + ' (' + horas + 'h)';
      }
    }

    function avisar() { if (opcoes.aoMudar) opcoes.aoMudar(valor()); }
    /* só a interação real do usuário (arrastar/teclado) dispara isto → a tela vira "parte do dia" sozinha */
    function avisarMexeu() { if (opcoes.aoMexer) opcoes.aoMexer(valor()); }

    function posParaMin(clientX) {
      var r = trilho.getBoundingClientRect();
      if (!r.width) return ini;
      var min = (clientX - r.left) / r.width * TOTAL;
      var s = Math.round(min / 60) * 60;
      if (s < limIni) s = limIni;
      if (s > limFim) s = limFim;
      return s;
    }

    function mover(clientX) {
      if (arrastando === 'bloco') {
        var r = trilho.getBoundingClientRect();
        if (!r.width) return;
        var delta = Math.round((clientX - blocoOrigem) / r.width * TOTAL / 60) * 60;
        var ns = blocoIni + delta;
        if (ns < limIni) ns = limIni;
        if (ns + blocoDur > limFim) ns = limFim - blocoDur;
        if (ns < limIni) ns = limIni;
        ini = ns;
        fim = ns + blocoDur;
      } else {
        var v = posParaMin(clientX);
        if (arrastando === 'inicio') ini = Math.min(v, fim);
        else fim = Math.max(v, ini);
      }
      pintar();
      avisar();
      avisarMexeu();
    }

    function moverEvento(ev) {
      if (!arrastando) return;
      ev.preventDefault();
      var cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      mover(cx);
    }

    function soltar() {
      arrastando = null;
      document.removeEventListener('mousemove', moverEvento);
      document.removeEventListener('mouseup', soltar);
      document.removeEventListener('touchmove', moverEvento);
      document.removeEventListener('touchend', soltar);
    }

    function pegar(tipo, ev) {
      if (!ativo) return;
      arrastando = tipo;
      ev.preventDefault();
      document.addEventListener('mousemove', moverEvento);
      document.addEventListener('mouseup', soltar);
      document.addEventListener('touchmove', moverEvento, { passive: false });
      document.addEventListener('touchend', soltar);
    }

    /* teclado: setas movem o puxador focado de hora em hora */
    function tecla(tipo, ev) {
      if (!ativo) return;
      var delta = 0;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') delta = -60;
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') delta = 60;
      else return;
      ev.preventDefault();
      if (tipo === 'inicio') ini = Math.max(limIni, Math.min(ini + delta, fim));
      else fim = Math.min(limFim, Math.max(fim + delta, ini));
      pintar();
      avisar();
      avisarMexeu();
    }

    /* arrastar o meio do trilho desliza o bloco inteiro (mantém a duração) */
    function pegarBloco(ev) {
      if (!ativo) return;
      if (ev.target.closest('.barra-periodo-handle')) return;
      arrastando = 'bloco';
      blocoOrigem = ev.touches ? ev.touches[0].clientX : ev.clientX;
      blocoIni = ini;
      blocoDur = fim - ini;
      ev.preventDefault();
      document.addEventListener('mousemove', moverEvento);
      document.addEventListener('mouseup', soltar);
      document.addEventListener('touchmove', moverEvento, { passive: false });
      document.addEventListener('touchend', soltar);
    }
    trilho.addEventListener('mousedown', pegarBloco);
    trilho.addEventListener('touchstart', pegarBloco, { passive: false });

    hIni.addEventListener('mousedown', function (e) { pegar('inicio', e); });
    hFim.addEventListener('mousedown', function (e) { pegar('fim', e); });
    hIni.addEventListener('touchstart', function (e) { pegar('inicio', e); }, { passive: false });
    hFim.addEventListener('touchstart', function (e) { pegar('fim', e); }, { passive: false });
    hIni.addEventListener('keydown', function (e) { tecla('inicio', e); });
    hFim.addEventListener('keydown', function (e) { tecla('fim', e); });

    function definirLimite(inicioMin, fimMin) {
      limIni = inicioMin;
      limFim = fimMin;
      ini = inicioMin;
      fim = fimMin;
      pintar();
      avisar();
    }

    function resetar() { ini = limIni; fim = limFim; pintar(); avisar(); }

    /* liga/desliga o ajuste: desativada, a barra fica visível mas travada e sem rótulo */
    function ativar() { ativo = true; el.classList.remove('barra-periodo--desativada'); hIni.disabled = false; hFim.disabled = false; pintar(); }
    function desativar() { ativo = false; el.classList.add('barra-periodo--desativada'); hIni.disabled = true; hFim.disabled = true; pintar(); }

    if (!ativo) { el.classList.add('barra-periodo--desativada'); hIni.disabled = true; hFim.disabled = true; }
    pintar();
    return { valor: valor, definirLimite: definirLimite, resetar: resetar, ativar: ativar, desativar: desativar, elemento: el };
  }

  RW.barraPeriodo = { criar: criar };
})();
