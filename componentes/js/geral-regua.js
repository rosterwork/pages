/* ============================================================
   BARRA DE HORÁRIO — componente compartilhado (Escala, Folgas e
   Trocas; a Extrajornada usa a mesma barra com as regras dela).
   O dia de serviço das 08h às 08h em 24 quadrados de 1 hora, com
   riscos a cada 6 horas. desenhar() pinta o fundo (o que já existe
   no dia) e a faixa escolhida; editável, a faixa ganha as duas
   bolinhas de arrastar (mouse e dedo), o clique numa hora leva a
   ponta mais perto até ali e, com o mouse em cima, a hora que o
   clique vai pôr acende e a que vai tirar fica riscada. O mouse em
   cima de uma hora mostra a hora na dica; as setas do teclado andam
   com a bolinha. Onde a faixa pode ir vem das regras de quem usa
   (as padrão: horas cheias dentro da janela, pelo menos 1 hora).
   Tudo em horas desde as 08h (0 a 24).
   Molde #tpl-regua-barra (index.html). RosterWork.regua.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var H = function () { return RosterWork.horario; };

  /* "08h" da hora contada desde as 08h (24 = as 08h do dia seguinte) */
  function textoHora(h) { return H().curta(H().hhmm(Math.round(h * 60))); }

  /* um pedaço em horas: { hi, hf } (o fim às 08h, ou antes do início, é o dia seguinte) ou já { ini, fim } */
  function emHoras(p) {
    if (p.ini != null) return { ini: p.ini, fim: p.fim, classe: p.classe };
    var f = H().faixa(p);
    return { ini: f[0] / 60, fim: Math.min(f[1], 1440) / 60, classe: p.classe };
  }

  /* as regras padrão: horas cheias dentro da janela [de, ate] (janela() a cada uso), pelo menos 1 hora */
  function regrasPadrao(janela) {
    function limites() { var j = janela(); return j || [0, 24]; }
    function dentro(h) { var j = limites(); return Math.max(j[0], Math.min(j[1], h)); }
    function valida(f) { return f && f.fim > f.ini ? f : null; }
    var regras = {
      /* sem faixa, a hora clicada; fora da faixa, a ponta mais perto vem até ela; dentro, a ponta mais perto recua e a
         hora sai */
      clique: function (h, f) {
        if (!f) return valida({ ini: dentro(h), fim: dentro(h + 1) });
        if (h >= f.fim) return valida({ ini: f.ini, fim: dentro(h + 1) });
        if (h < f.ini) return valida({ ini: dentro(h), fim: f.fim });
        if (f.fim - f.ini <= 1) return null;
        return f.fim - (h + 1) <= h - f.ini ? valida({ ini: f.ini, fim: h }) : valida({ ini: h + 1, fim: f.fim });
      },
      arrastar: function (qual, pos, f) {
        pos = dentro(pos);
        return qual === 'ini' ? valida({ ini: Math.min(pos, f.fim - 1), fim: f.fim }) : valida({ ini: f.ini, fim: Math.max(pos, f.ini + 1) });
      },
      passo: function (qual, dir, f) { return regras.arrastar(qual, (qual === 'ini' ? f.ini : f.fim) + dir, f); }
    };
    return regras;
  }

  /* cfg = { aoMudar({ ini, fim, hi, hf }), regras { clique, arrastar, passo }, horas (false tira as horas de baixo),
     variante ('afastada' ou 'compacta'), dicaFaixa(faixa) (a dica das horas da faixa e, com o mouse fora dela, a da
     faixa que o clique deixa; sem ela, a hora),
     aoArrastar(faixa) (a faixa enquanto a bolinha anda, antes de soltar) }. Devolve { el, desenhar({ fundo, faixa, editavel, janela }) }: fundo = [{ hi, hf, classe }]
     (classe 'vazio' = hachurado, 'marcada' = escuro sem bolinhas), faixa = { hi, hf } (ou { ini, fim } em horas) */
  function criar(cfg) {
    cfg = cfg || {};
    var caixa = RosterWork.tpl('tpl-regua-barra');
    if (!caixa) return null;
    if (cfg.variante) caixa.classList.add('regua-barra-caixa--' + cfg.variante);
    caixa.querySelector('.regua-barra-horas').classList.toggle('oculto', cfg.horas === false);
    var barra = caixa.querySelector('.regua-barra');
    var horas = [].slice.call(caixa.querySelectorAll('.regua-barra-hora'));
    var alcas = { ini: caixa.querySelector('[data-alca="ini"]'), fim: caixa.querySelector('[data-alca="fim"]') };
    var est = { fundo: [], faixa: null, editavel: false, janela: null };
    var regras = cfg.regras || regrasPadrao(function () { return est.janela; });
    var arrasto = null;   // { qual, faixa }: a bolinha que está sendo arrastada e a faixa até aqui

    function pintar(faixa, previa) {
      horas.forEach(function (el, i) {
        var fundo = '';
        est.fundo.forEach(function (p) { if (i >= p.ini && i < p.fim) fundo = p.classe || 'fundo'; });
        var naFaixa = !!faixa && i >= faixa.ini && i < faixa.fim;
        var naPrevia = !!previa && i >= previa.ini && i < previa.fim;
        el.classList.toggle('regua-barra-hora--fundo', fundo === 'fundo' && !naFaixa);
        el.classList.toggle('regua-barra-hora--vazio', fundo === 'vazio' && !naFaixa);
        /* a hora que vai sair continua na faixa (riscada por cima), para quem procura a faixa achar a mesma hora */
        el.classList.toggle('regua-barra-hora--faixa', naFaixa || fundo === 'marcada');
        el.classList.toggle('regua-barra-hora--entra', naPrevia && !naFaixa);
        el.classList.toggle('regua-barra-hora--sai', !!previa && naFaixa && !naPrevia);
        /* a dica, com dicaFaixa (ex.: o horário da extra): na faixa, a faixa; fora dela, com o mouse em cima, a faixa que
           o clique deixa (a prévia, já somada ao que está aceso); onde o clique não põe nada, sem dica */
        if (cfg.dicaFaixa) {
          var dica = naFaixa ? cfg.dicaFaixa(faixa) : previa && previa.fim > previa.ini ? cfg.dicaFaixa(previa) : '';
          if (dica) el.setAttribute('data-dica', dica);
          else el.removeAttribute('data-dica');
        }
      });
      var mostra = est.editavel && !!faixa;
      ['ini', 'fim'].forEach(function (q) {
        var a = alcas[q];
        a.classList.toggle('oculto', !mostra);
        if (!mostra) return;
        var texto = textoHora(faixa[q]);
        a.style.setProperty('--regua-pos', String(faixa[q]));
        a.setAttribute('aria-valuenow', String(faixa[q]));
        a.setAttribute('aria-valuetext', texto);
        a.setAttribute('data-dica', texto);
      });
    }

    /* a faixa nova vai para quem usa com o que as regras dele puseram nela (na extra, os horários e o começo) */
    function mudar(f) {
      est.faixa = f.fim > f.ini ? { ini: f.ini, fim: f.fim } : null;
      pintar(est.faixa, null);
      cfg.aoMudar(Object.assign({}, f, { hi: H().hhmm(Math.round(f.ini * 60)), hf: H().hhmm(Math.round(f.fim * 60)) }));
    }
    function igual(a, b) {
      var va = !a || a.fim <= a.ini, vb = !b || b.fim <= b.ini;
      return va || vb ? va && vb : a.ini === b.ini && a.fim === b.fim;
    }

    /* a divisa mais perto do ponteiro (0 a 24): 24 horas com 1px entre elas */
    function divisa(ev) {
      var r = barra.getBoundingClientRect();
      return Math.max(0, Math.min(24, Math.round((ev.clientX - r.left + 0.5) * 24 / (r.width + 1))));
    }
    function horaDe(alvo) { var c = alvo.closest('.regua-barra-hora'); return c ? +c.getAttribute('data-hora') : null; }
    /* a hora (0 a 23) debaixo do ponteiro */
    function horaDoPonteiro(ev) {
      var r = barra.getBoundingClientRect();
      return Math.max(0, Math.min(23, Math.floor((ev.clientX - r.left + 0.5) * 24 / (r.width + 1))));
    }

    /* o clique numa hora */
    barra.addEventListener('click', function (ev) {
      if (!est.editavel || ev.target.closest('.regua-barra-alca')) return;
      var h = horaDe(ev.target);
      if (h == null) return;
      var r = regras.clique(h, est.faixa);
      if (r && !igual(r, est.faixa)) mudar(r);
    });
    /* com o mouse em cima, o que o clique vai fazer */
    barra.addEventListener('pointermove', function (ev) {
      if (!est.editavel || arrasto || ev.pointerType !== 'mouse') return;
      var h = ev.target.closest('.regua-barra-alca') ? null : horaDe(ev.target);
      pintar(est.faixa, h == null ? null : regras.clique(h, est.faixa));
    });
    barra.addEventListener('pointerleave', function () { if (!arrasto) pintar(est.faixa, null); });

    /* arrastar e o teclado, em cada bolinha */
    ['ini', 'fim'].forEach(function (q) {
      var a = alcas[q];
      a.addEventListener('pointerdown', function (ev) {
        if (!est.editavel || !est.faixa) return;
        ev.preventDefault();
        a.setPointerCapture(ev.pointerId);
        arrasto = { qual: q, faixa: est.faixa, x: ev.clientX };
      });
      a.addEventListener('pointermove', function (ev) {
        if (!arrasto || arrasto.qual !== q) return;
        if (Math.abs(ev.clientX - arrasto.x) > 8) arrasto.andou = true;
        var r = regras.arrastar(q, divisa(ev), est.faixa);
        if (r) {
          arrasto.faixa = r;
          pintar(r, null);
          if (cfg.aoArrastar) cfg.aoArrastar(r);
        }
      });
      /* soltou: a faixa nova; quase sem sair do lugar (até 8px), a bolinha cobre a hora da ponta, e o clique vale para
         essa hora; arrastou e voltou, nada muda */
      function soltar(ev) {
        if (!arrasto || arrasto.qual !== q) return;
        var r = arrasto.faixa;
        var parado = !arrasto.andou && !!ev && ev.type === 'pointerup' && Math.abs(ev.clientX - arrasto.x) <= 8;
        arrasto = null;
        if (!igual(r, est.faixa)) { mudar(r); return; }
        var c = parado ? regras.clique(horaDoPonteiro(ev), est.faixa) : null;
        if (c && !igual(c, est.faixa)) mudar(c);
        else pintar(est.faixa, null);
      }
      a.addEventListener('pointerup', soltar);
      a.addEventListener('pointercancel', soltar);
      a.addEventListener('keydown', function (ev) {
        var dir = (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') ? -1 : (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') ? 1 : 0;
        if (!dir || !est.editavel || !est.faixa) return;
        ev.preventDefault();
        var r = regras.passo(q, dir, est.faixa);
        if (r && !igual(r, est.faixa)) mudar(r);
      });
    });

    function desenhar(e) {
      e = e || {};
      est.fundo = (e.fundo || []).map(emHoras);
      est.faixa = e.faixa ? emHoras(e.faixa) : null;
      if (est.faixa && est.faixa.fim <= est.faixa.ini) est.faixa = null;
      est.janela = e.janela || null;
      est.editavel = !!e.editavel && !!cfg.aoMudar;
      barra.classList.toggle('regua-barra--editavel', est.editavel);
      if (!arrasto) pintar(est.faixa, null);
    }

    return { el: caixa, desenhar: desenhar };
  }

  window.RosterWork.regua = { criar: criar, regrasPadrao: regrasPadrao, textoHora: textoHora };
})();
