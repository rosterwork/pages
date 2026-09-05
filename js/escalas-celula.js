/* ============================================================
   ESCALAS — célula compartilhada (Mês e Semana)
   O miolo de uma célula unidade×dia: o gráfico de cobertura
   (silhueta pintada num <canvas>, lendo as cores do tema) + a
   lista de militares de serviço. Usada pelo escalas-mes.js e pelo
   escalas-semana.js. Não busca no banco nem escreve estilo CSS —
   exceção: pinta o canvas lendo o tema (REGRAS §3/§4 e MANUAL §11).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var observerGrafico = null;   // redesenha os gráficos quando a largura muda
  var observerTema = null;      // repinta os gráficos (canvas) quando o tema muda de cor
  var temaGrafico = null;       // cache das cores do tema lidas para o canvas
  var RAIO_CANTO = 2;           // raio (px CSS) do arredondamento das quinas da silhueta

  /* origem -> nome do arquivo de ícone (o cadeado é à parte, quando fixado) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base',
    troca: 'icone-origem-troca',
    troca_saida: 'icone-origem-troca',
    pontual: 'icone-origem-pontual',
    sistema: 'icone-origem-sistema',
    folga: 'icone-folgas',
    extra: 'icone-extrajornada'
  };


  function soHora(t) { return t ? t.split(':')[0] + 'h' : ''; }

  /* minutos desde as 08:00 (início do dia de serviço); a janela da grade vai de 0 a 1440 */
  function minDesde8(hhmm) {
    var p = hhmm.split(':');
    var t = parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10);
    return t >= 480 ? t - 480 : t + 960;
  }

  /* gradient no fundo da linha: cinza nas horas FORA do turno e branco no turno,
     na janela 08h→08h. O JS calcula só as POSIÇÕES (%); a cor vem do tema. Exceção (REGRAS §4) */
  function fundoTurno(periodos, inverter) {
    if (!periodos || !periodos.length) return '';
    var trechos = [];
    periodos.forEach(function (p) {
      if (!p.inicio) return;
      var ini = minDesde8(p.inicio);
      var fim = p.fim ? minDesde8(p.fim) : ini;
      if (fim <= ini) fim += 1440;
      if (fim > 1440) fim = 1440;
      trechos.push([ini / 1440 * 100, fim / 1440 * 100]);
    });
    if (!trechos.length) return '';
    trechos.sort(function (a, b) { return a[0] - b[0]; });
    /* invertido: cinza no fundo, "buracos" transparentes (brancos) nos trechos do turno */
    /* posGrad() mapeia o tempo [0–100%] para o inset de 4px do canvas (.escala-mes-grafico
       tem padding: 2px 4px 0). Sem âncoras fixas nos gutters: cada lado só ganha um stop
       'fora' quando há período fora naquela borda (t0>0 / t1<100). O CSS estende o 1º/último
       stop real até a borda — fica cinza se fora de serviço às 08h, transparente se de serviço */
    var fora = 'var(--celula-fundo-fora, var(--fundo-suave))';
    /* riscado (folga/troca): inverte — o cinza vai DENTRO do trecho (a folga/troca é o tempo
       fora de serviço), para alinhar com a linha trabalhada e o cinza cobrir só onde o militar
       não trabalha, cobrindo as duas linhas juntas em vez de meio a meio */
    var borda = inverter ? 'transparent' : fora;   /* fora dos trechos */
    var dentro = inverter ? fora : 'transparent';   /* dentro dos trechos */
    var posGrad = function (pct) {
      return 'calc(4px + (100% - 8px) * ' + (pct / 100).toFixed(6) + ')';
    };
    var paradas = [];
    trechos.forEach(function (t) {
      if (t[0] > 0) paradas.push(borda + ' ' + posGrad(t[0]));
      paradas.push(dentro + ' ' + posGrad(t[0]));
      paradas.push(dentro + ' ' + posGrad(t[1]));
      if (t[1] < 100) paradas.push(borda + ' ' + posGrad(t[1]));
    });
    return 'linear-gradient(to right, ' + paradas.join(', ') + ')';
  }

  /* o canvas não herda as cores do CSS: lê direto das variáveis do :root a cor da silhueta
     (--texto-debil), a espessura do traço (--grafico-traco) e os fundos do preenchimento de status
     por hora (--erro-fundo-forte/--sucesso-fundo-forte) — a cor continua vindo do tema, só por
     outro caminho (ver REGRAS §3) */
  function lerTema() {
    var cs = getComputedStyle(document.documentElement);
    return {
      traco: (cs.getPropertyValue('--texto-debil') || '').trim(),
      esp: parseFloat(cs.getPropertyValue('--grafico-traco')),
      erroFundo: (cs.getPropertyValue('--erro-fundo-forte') || '').trim(),
      sucessoFundo: (cs.getPropertyValue('--sucesso-fundo-forte') || '').trim(),
      alertaFundo: (cs.getPropertyValue('--alerta-fundo-forte') || '').trim()
    };
  }

  /* alinha uma coordenada ao grid de pixels FÍSICOS: espessura par cai em pixel inteiro,
     ímpar no meio do pixel — é isso que faz TODO o traço sair com a mesma espessura */
  function alinhar(v, esp) {
    return (esp % 2) ? Math.floor(v) + 0.5 : Math.round(v);
  }

  /* pontos do contorno da silhueta (base + laterais + topo em degraus) em pixels FÍSICOS;
     TUDO recuado meio-traço para dentro das bordas (xEsq..xDir, yBase..topo), senão a metade
     externa do traço é cortada e as laterais/base saem mais finas. cob = nº por hora */
  function pontosSilhueta(cob, max, xEsq, xDir, yBase, util, esp) {
    var w = xDir - xEsq;
    var pts = [[xEsq, yBase]];
    for (var h = 0; h < 24; h++) {
      var x0 = alinhar(xEsq + h / 24 * w, esp);
      var x1 = alinhar(xEsq + (h + 1) / 24 * w, esp);
      var y = alinhar(yBase - ((Number(cob[h]) || 0) / max) * util, esp);
      pts.push([x0, y], [x1, y]);
    }
    pts.push([xDir, yBase]);
    return pts;
  }

  /* tira vértices duplicados e colineares: sobram só as quinas reais do contorno fechado
     (sem isso, os degraus iguais viram pontos repetidos que estragam o arredondamento) */
  function simplificar(pts) {
    var u = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = u[u.length - 1];
      if (!q || p[0] !== q[0] || p[1] !== q[1]) u.push(p);
    }
    var saida = [], m = u.length;
    for (var j = 0; j < m; j++) {
      var a = u[(j - 1 + m) % m], b = u[j], c = u[(j + 1) % m];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) !== 0) saida.push(b);
    }
    return saida;
  }

  /* traça o contorno fechado arredondando cada quina por RECUO limitado a meia-aresta de
     cada lado + curva quadrática: as curvas sempre se ligam por um trecho reto, então
     encaixam em degraus de qualquer tamanho; as retas seguem nítidas e uniformes */
  function tracarContorno(ctx, pts, raio) {
    var n = pts.length;
    ctx.beginPath();
    if (n < 3) {
      if (n) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < n; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
      }
      return;
    }
    for (var i = 0; i < n; i++) {
      var prev = pts[(i - 1 + n) % n], v = pts[i], next = pts[(i + 1) % n];
      var dp = Math.hypot(prev[0] - v[0], prev[1] - v[1]) || 1;
      var dn = Math.hypot(next[0] - v[0], next[1] - v[1]) || 1;
      var d = Math.min(raio, dp / 2, dn / 2);
      var pe = [v[0] + (prev[0] - v[0]) / dp * d, v[1] + (prev[1] - v[1]) / dp * d];
      var ps = [v[0] + (next[0] - v[0]) / dn * d, v[1] + (next[1] - v[1]) / dn * d];
      if (i === 0) ctx.moveTo(pe[0], pe[1]);
      else ctx.lineTo(pe[0], pe[1]);
      ctx.quadraticCurveTo(v[0], v[1], ps[0], ps[1]);
    }
    ctx.closePath();
  }

  /* gradiente horizontal verde/amarelo/vermelho por hora, com mescla de 'mescla' px só nas junções
     onde a cor muda de uma hora para a outra (dentro da hora a cor é chapada). 'erro' = string
     de 24 dígitos: 1 = vermelho (sem função), 2 = amarelo (ressalva), outro = verde. Cores do tema (REGRAS §3) */
  function gradienteHoras(ctx, erro, xEsq, xDir, corOk, corErro, corAlerta, mescla) {
    var W = xDir - xEsq;
    var g = ctx.createLinearGradient(xEsq, 0, xDir, 0);
    var meia = W > 0 ? (mescla / 2) / W : 0;   // metade da mescla, em fração do eixo
    var cor = function (h) { var c = erro.charAt(h); return c === '1' ? corErro : c === '2' ? corAlerta : corOk; };
    g.addColorStop(0, cor(0));
    for (var h = 1; h < 24; h++) {
      if (cor(h) === cor(h - 1)) continue;     // mesma cor nas duas horas: sem junção
      var o = h / 24;
      g.addColorStop(Math.max(0, o - meia), cor(h - 1));
      g.addColorStop(Math.min(1, o + meia), cor(h));
    }
    g.addColorStop(1, cor(23));
    return g;
  }

  /* pinta um gráfico no seu <canvas>: silhueta uniforme + (no hover) a linha-cursor.
     Trabalha em pixels físicos (devicePixelRatio) para o traço sair nítido em qualquer tela */
  function pintarGrafico(grafico, horaCursor) {
    var canvas = grafico.querySelector('.escala-mes-grafico-canvas');
    if (!canvas || !canvas.getContext) return;
    var cob = (grafico.dataset.cob || '').split(',');
    var max = parseFloat(grafico.dataset.max) || 1;
    if (cob.length < 24 || max <= 0) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var dpr = window.devicePixelRatio || 1;
    var Wf = Math.round(rect.width * dpr), Hf = Math.round(rect.height * dpr);
    if (canvas.width !== Wf) canvas.width = Wf;
    if (canvas.height !== Hf) canvas.height = Hf;

    var tema = temaGrafico || (temaGrafico = lerTema());
    var esp = Math.max(1, Math.round(tema.esp * dpr)) || 1;   // px físicos (mín. 1; cai a 1 se o tema faltar)
    var xEsq = alinhar(esp / 2, esp), xDir = alinhar(Wf - esp / 2, esp);
    var yBase = alinhar(Hf - esp / 2, esp), util = yBase - alinhar(esp / 2, esp);

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, Wf, Hf);

    var pts = simplificar(pontosSilhueta(cob, max, xEsq, xDir, yBase, util, esp));

    /* preenchimento por hora atrás da silhueta (verde = distribuído, vermelho = sem função),
       recortado no contorno para não passar do topo nem das laterais; a mescla de 1,5px sai
       só nas junções verde↔vermelho (ver gradienteHoras) */
    var erro = grafico.dataset.erro || '';
    if (erro) {
      ctx.save();
      tracarContorno(ctx, pts, RAIO_CANTO * dpr);
      ctx.clip();
      ctx.fillStyle = gradienteHoras(ctx, erro, xEsq, xDir, tema.sucessoFundo, tema.erroFundo, tema.alertaFundo, 1.5 * dpr);
      ctx.fillRect(0, 0, Wf, Hf);
      ctx.restore();
    }

    ctx.lineWidth = esp;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = tema.traco;
    tracarContorno(ctx, pts, RAIO_CANTO * dpr);
    ctx.stroke();

    if (horaCursor != null) {
      var n = Number(cob[horaCursor]) || 0;
      var cx = alinhar(xEsq + (horaCursor + 0.5) / 24 * (xDir - xEsq), esp);
      ctx.beginPath();                       // linha-cursor: mesma cor da silhueta
      ctx.moveTo(cx, yBase);
      ctx.lineTo(cx, alinhar(yBase - (n / max) * util, esp));
      ctx.stroke();
    }
  }

  /* mini-gráfico de cobertura no topo da célula (silhueta pintada em <canvas>; MANUAL §11).
     Só guarda os dados; o desenho (que precisa do tamanho real) fica em pintarGrafico */
  function montarGrafico(cobertura, maxGlobal, erro) {
    if (maxGlobal <= 0) return null;
    var g = RosterWork.tpl('tpl-escala-mes-grafico');
    if (!g) return null;
    g.dataset.cob = cobertura.join(',');
    g.dataset.max = maxGlobal;
    var marcas = '';
    for (var h = 0; h < 24; h++) {
      var e = erro && erro[h];   // 1 = sem função (vermelho), 2 = ressalva (amarelo), 0 = ok (verde)
      marcas += (e === 2 || e === '2') ? '2' : (e ? '1' : '0');
    }
    g.dataset.erro = marcas;
    return g;
  }

  /* desenha (ou redesenha) todos os gráficos; relê as cores do tema uma vez por passada */
  function desenharGraficos(escalaEl) {
    var graficos = escalaEl.querySelectorAll('.escala-mes-grafico');
    if (!graficos.length) return;
    temaGrafico = lerTema();
    for (var i = 0; i < graficos.length; i++) pintarGrafico(graficos[i], null);
  }

  /* hora exibida no gráfico (a janela começa às 08h) */
  function rotuloHora(h) { return ((8 + h) % 24) + 'h'; }

  /* hover do gráfico: repinta o canvas sob o mouse com a linha-cursor por hora e move a
     dica "Nh · X militares" (segue o ponteiro; posição via custom property — exceção REGRAS §4) */
  function ligarHover(escalaEl) {
    var dica = document.getElementById('escala-mes-dica');
    var ativo = null;

    function esconder() {
      if (ativo) { pintarGrafico(ativo, null); ativo = null; }
      if (dica) dica.classList.add('oculto');
    }

    escalaEl.addEventListener('mousemove', function (e) {
      var g = e.target.closest ? e.target.closest('.escala-mes-grafico') : null;
      var cob = g ? (g.dataset.cob || '').split(',') : [];
      var canvas = g && g.querySelector('.escala-mes-grafico-canvas');
      if (!canvas || cob.length < 24) { esconder(); return; }

      var rect = canvas.getBoundingClientRect();
      var hora = Math.floor((e.clientX - rect.left) / rect.width * 24);
      hora = Math.max(0, Math.min(23, hora));
      var n = Number(cob[hora]) || 0;

      if (ativo && ativo !== g) pintarGrafico(ativo, null);
      pintarGrafico(g, hora);
      ativo = g;

      if (dica) {
        dica.textContent = rotuloHora(hora) + ' · ' + n + (n === 1 ? ' militar' : ' militares');
        dica.style.setProperty('--dica-x', e.clientX + 'px');
        dica.style.setProperty('--dica-y', e.clientY + 'px');
        dica.classList.remove('oculto');
      }
    });

    escalaEl.addEventListener('mouseleave', esconder);
  }

  function definirIcone(svg, nomeIcone) {
    var uso = svg.querySelector('use');
    if (uso) uso.setAttribute('href', 'icones/' + nomeIcone + '.svg#' + nomeIcone);
  }

  /* uma linha de militar: ícone de origem (+ cadeado se fixado) + grad + nome + horário */
  function montarPessoa(p) {
    var linha = RosterWork.tpl('tpl-escala-mes-pessoa');
    if (!linha) return null;
    if (p.origem === 'folga') linha.classList.add('linha-escalado--folga');   /* folga: nome riscado */
    if (p.origem === 'troca_saida') linha.classList.add('linha-escalado--trocado');   /* trocado: nome riscado */

    var icones = linha.querySelector('.linha-escalado-icones');
    /* linha riscada (folga/troca): o ícone da origem NÃO some. Mostra a origem do militar no dia
       (contínuos, base ou pontual) e, ao lado, o marcador de folga/troca. */
    if (p.origem_base && ICONE_ORIGEM[p.origem_base]) {
      var origemCiclo = RosterWork.tpl('tpl-escala-mes-origem');
      if (origemCiclo) { definirIcone(origemCiclo, ICONE_ORIGEM[p.origem_base]); icones.appendChild(origemCiclo); }
    }
    var origem = RosterWork.tpl('tpl-escala-mes-origem');
    if (origem) { definirIcone(origem, ICONE_ORIGEM[p.origem] || ICONE_ORIGEM.sistema); icones.appendChild(origem); }
    if (p.fixado) {
      var cadeado = RosterWork.tpl('tpl-escala-mes-origem');
      if (cadeado) { definirIcone(cadeado, 'icone-cadeado'); icones.appendChild(cadeado); }
    }

    linha.querySelector('.linha-escalado-grad').textContent = p.grad || '';
    linha.querySelector('.linha-escalado-nome').textContent = p.nome || '';
    if (window.RosterWork.busca) linha.setAttribute('data-busca', window.RosterWork.busca.chave(p));   // busca do sub-cabeçalho (nome/CPF/RG)
    /* um par início→fim por período (disponibilidade quebrada = vários, empilhados em coluna) */
    var horaWrap = linha.querySelector('.linha-escalado-hora');
    (p.periodos || []).forEach(function (per) {
      if (!per.inicio) return;
      var par = RosterWork.tpl('tpl-escala-mes-hora-par');
      if (!par) return;
      par.querySelector('.linha-escalado-hora-ini').textContent = soHora(per.inicio);
      var fimEl = par.querySelector('.linha-escalado-hora-fim');
      var setaEl = par.querySelector('.linha-escalado-hora-seta');
      if (per.fim) { fimEl.textContent = soHora(per.fim); }
      else { if (fimEl) fimEl.classList.add('oculto'); if (setaEl) setaEl.classList.add('oculto'); }
      horaWrap.appendChild(par);
    });

    /* fundo preenchido no trecho do horário (exceção: custom property data-driven).
       Nas linhas riscadas (folga/troca), inverte: o cinza vai no trecho de folga/troca */
    var fundo = fundoTurno(p.periodos, p.origem === 'folga' || p.origem === 'troca_saida');
    if (fundo) linha.style.setProperty('--turno-fundo', fundo);
    return linha;
  }

  /* preenche o miolo de uma célula (unidade × dia): gráfico de cobertura + linha de erro +
     militares. Reaproveitada na renderização e no refresh de uma célula (atualizarCelula). */
  function preencherCelula(celula, cobDia, erroDia, conflitoDia, pessoas, maxGlobal) {
    celula.textContent = '';
    if (cobDia) {
      var grafico = montarGrafico(cobDia, maxGlobal, erroDia);
      if (grafico) celula.appendChild(grafico);
    }
    if (conflitoDia) {
      var erroLinha = RosterWork.tpl('tpl-escala-mes-erro');
      if (erroLinha) {
        var nomeErro = erroLinha.querySelector('.linha-escalado-nome');
        if (nomeErro) nomeErro.textContent = window.RosterWork.mensagens.escala.funcoesForaDisponibilidade;
        celula.appendChild(erroLinha);
      }
    }
    (pessoas || []).forEach(function (p) {
      var linhaP = montarPessoa(p);
      if (linhaP) celula.appendChild(linhaP);
    });
  }

  /* pico de cobertura entre as unidades ids (escala comum a todos os gráficos da grade) */
  function calcularMaxGlobal(cobertura, ids) {
    var maxGlobal = 0;
    (ids || []).forEach(function (id) {
      var porDiaCob = (cobertura && cobertura[id]) || {};
      Object.keys(porDiaCob).forEach(function (iso) {
        porDiaCob[iso].forEach(function (n) { if (n > maxGlobal) maxGlobal = n; });
      });
    });
    return maxGlobal;
  }

  function limparObservadores() {
    if (observerGrafico) { observerGrafico.disconnect(); observerGrafico = null; }
    if (observerTema) { observerTema.disconnect(); observerTema = null; }
  }

  /* liga hover, pinta os gráficos e observa largura/tema para repintar (uma grade por vez) */
  function ativarGraficos(wrap) {
    limparObservadores();
    ligarHover(wrap);
    desenharGraficos(wrap);
    if (window.ResizeObserver) {
      observerGrafico = new ResizeObserver(function () { desenharGraficos(wrap); });
      observerGrafico.observe(wrap);
    }
    /* o canvas pinta com cores lidas do tema; repinta quando o tema (data-tema do <html>) mudar */
    if (window.MutationObserver) {
      observerTema = new MutationObserver(function () { desenharGraficos(wrap); });
      observerTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    }
  }

  window.RosterWork.escalasCelula = {
    preencherCelula: preencherCelula,
    calcularMaxGlobal: calcularMaxGlobal,
    ativarGraficos: ativarGraficos,
    desenharGraficos: desenharGraficos,
    limparObservadores: limparObservadores
  };
})();
