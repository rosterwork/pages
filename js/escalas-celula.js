/* ============================================================
   ESCALAS — célula compartilhada (Mês, Semana, Colunas, Calendário
   e Extrajornada)
   O miolo de uma célula unidade×dia: o gráfico de cobertura
   (24 barras por hora pintadas num <canvas>, lendo as cores do tema)
   + a lista de militares de serviço. Não busca no banco nem escreve
   estilo CSS — exceção: pinta o canvas lendo o tema (REGRAS §3/§4 e
   MANUAL §11).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var observerGrafico = null;   // redesenha os gráficos quando a largura muda
  var observerTema = null;      // repinta os gráficos (canvas) quando o tema muda de cor
  var temaGrafico = null;       // cache das cores do tema lidas para o canvas

  /* desenho do gráfico de cobertura: uma barra por hora (medidas em px CSS) */
  var BARRA_VAO = 1;              // vão entre as barras
  var BARRA_RAIO = 1.5;           // raio dos cantos de cima da barra
  var BARRA_LINHA = 2;            // espessura da linha forte no topo da barra
  var BARRA_MINIMA = 2;           // altura mínima de uma hora com alguém de serviço
  var OPACIDADE_OK = 0.3;         // corpo da barra no "tudo certo" (verde claro)
  var OPACIDADE_PROBLEMA = 0.4;   // corpo da barra com ressalva (amarelo) ou militar sem função (vermelho)
  var OPACIDADE_HOVER = 0.75;     // corpo da barra da hora com o mouse em cima

  /* origem -> nome do arquivo de ícone (o cadeado é à parte, quando fixado) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base',
    saida: 'icone-origem-saida',
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

  /* o canvas não herda as cores do CSS: lê direto das variáveis do :root as cores cheias de
     estado (--sucesso/--alerta/--erro) — a cor continua vindo do tema, só por outro caminho
     (ver REGRAS §3); o corpo claro da barra é a mesma cor com transparência */
  function lerTema() {
    var cs = getComputedStyle(document.documentElement);
    return {
      sucesso: (cs.getPropertyValue('--sucesso') || '').trim(),
      alerta: (cs.getPropertyValue('--alerta') || '').trim(),
      erro: (cs.getPropertyValue('--erro') || '').trim()
    };
  }

  /* retângulo com só os cantos de cima arredondados (navegador sem roundRect: cantos retos) */
  function retanguloTopoRedondo(ctx, x, y, largura, altura, raio) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, largura, altura, [raio, raio, 0, 0]);
    else ctx.rect(x, y, largura, altura);
    ctx.fill();
  }

  /* pinta um gráfico no seu <canvas>: 24 barras (uma por hora, altura = militares de serviço) com o
     corpo claro na cor do estado e uma linha forte no topo; a hora com o mouse em cima (horaCursor)
     fica com o corpo forte. Trabalha em pixels físicos (devicePixelRatio) para sair nítido em qualquer tela */
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
    var erro = grafico.dataset.erro || '';   // por hora: 1 = sem função (vermelho), 2 = ressalva (amarelo), outro = ok (verde)
    var vao = Math.round(BARRA_VAO * dpr), raio = BARRA_RAIO * dpr, linha = Math.round(BARRA_LINHA * dpr);
    var passo = (Wf + vao) / 24;   // uma hora = barra + vão
    var util = Hf - Math.round(dpr);   // 1px de folga no topo, para a linha não encostar na borda do canvas

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, Wf, Hf);
    for (var h = 0; h < 24; h++) {
      var n = Number(cob[h]) || 0;
      if (n <= 0) continue;   // hora sem ninguém de serviço: sem barra
      var altura = Math.max(Math.round(BARRA_MINIMA * dpr), Math.round(Math.min(n, max) / max * util));
      /* bordas da barra no pixel físico inteiro: o vão sai sempre nítido e do mesmo tamanho */
      var x = Math.round(h * passo), largura = Math.round((h + 1) * passo - vao) - x, y = Hf - altura;
      var marca = erro.charAt(h);
      var problema = marca === '1' || marca === '2';
      ctx.fillStyle = marca === '1' ? tema.erro : marca === '2' ? tema.alerta : tema.sucesso;
      /* corpo claro (forte na hora com o mouse em cima) + linha forte no topo, na mesma cor */
      ctx.globalAlpha = h === horaCursor ? OPACIDADE_HOVER : (problema ? OPACIDADE_PROBLEMA : OPACIDADE_OK);
      retanguloTopoRedondo(ctx, x, y, largura, altura, raio);
      ctx.globalAlpha = 1;
      retanguloTopoRedondo(ctx, x, y, largura, Math.min(linha, altura), raio);
    }
    ctx.globalAlpha = 1;
  }

  /* mini-gráfico de cobertura no topo da célula (barras por hora pintadas em <canvas>; MANUAL §11).
     Só guarda os dados; o desenho (que precisa do tamanho real) fica em pintarGrafico */
  function montarGrafico(cobertura, maxUnidade, erro) {
    if (!(maxUnidade > 0)) return null;
    var g = RosterWork.tpl('tpl-escala-mes-grafico');
    if (!g) return null;
    g.dataset.cob = cobertura.join(',');
    g.dataset.max = maxUnidade;
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

  /* hover do gráfico: repinta o canvas sob o mouse com a barra da hora apontada em destaque e move a
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

  /* preenche o miolo de uma célula (unidade × dia): gráfico de cobertura + militares. Os erros
     aparecem só na cor do gráfico (o texto fica no painel do dia, ao clicar). Reaproveitada na
     renderização e no refresh de uma célula (atualizarCelula). maxUnidade = a régua do gráfico
     (o pico da unidade da célula no período exibido; ver calcularMaxPorUnidade) */
  function preencherCelula(celula, cobDia, erroDia, pessoas, maxUnidade) {
    celula.textContent = '';
    if (cobDia) {
      var grafico = montarGrafico(cobDia, maxUnidade, erroDia);
      if (grafico) celula.appendChild(grafico);
    }
    (pessoas || []).forEach(function (p) {
      var linhaP = montarPessoa(p);
      if (linhaP) celula.appendChild(linhaP);
    });
  }

  /* pico de cobertura de cada unidade no período carregado: { unidadeId: pico }. É a régua dos gráficos
     da unidade (a barra cheia = o maior nº de militares numa mesma hora): os dias da mesma unidade são
     comparáveis entre si; cada unidade tem a sua (o nº real fica na dica) */
  function calcularMaxPorUnidade(cobertura, ids) {
    var porUnidade = {};
    (ids || []).forEach(function (id) {
      var pico = 0;
      var porDiaCob = (cobertura && cobertura[id]) || {};
      Object.keys(porDiaCob).forEach(function (iso) {
        porDiaCob[iso].forEach(function (n) { if (n > pico) pico = n; });
      });
      porUnidade[id] = pico;
    });
    return porUnidade;
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
    calcularMaxPorUnidade: calcularMaxPorUnidade,
    ativarGraficos: ativarGraficos,
    desenharGraficos: desenharGraficos,
    limparObservadores: limparObservadores
  };
})();
