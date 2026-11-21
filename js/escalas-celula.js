/* ============================================================
   ESCALAS — célula compartilhada (Mês, Semana, Colunas, Calendário
   e Extrajornada)
   O miolo de uma célula unidade×dia: o gráfico de cobertura
   (24 barras por hora pintadas num <canvas>, lendo as cores do tema)
   + a lista de militares de serviço. Não busca no banco nem escreve
   estilo CSS — exceção: pinta o canvas lendo o tema (REGRAS §3/§4 e
   Guia visual › Grade da escala).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var observerGrafico = null;   // redesenha os gráficos quando a largura muda
  var observerTema = null;      // repinta os gráficos (canvas) quando o tema muda de cor
  var temaGrafico = null;       // cache das cores do tema lidas para o canvas
  var estagiariosGuardados = {};   // "unidade|dia" -> os estagiários que não são efetivo, por hora (a dica da faixa)

  /* desenho do gráfico de cobertura: uma barra por hora (medidas em px CSS) */
  var BARRA_VAO = 1;              // vão entre as barras
  var BARRA_RAIO = 1.5;           // raio dos cantos de cima da barra
  var BARRA_LINHA = 2;            // espessura da linha forte no topo da barra
  var BARRA_MINIMA = 2;           // altura mínima de uma hora com alguém de serviço (e a da hora sem ninguém com erro vermelho)
  var OPACIDADE_OK = 0.3;         // corpo da barra no "tudo certo" (verde claro)
  var OPACIDADE_PROBLEMA = 0.4;   // corpo da barra com ressalva (amarelo) ou militar sem função (vermelho)
  var OPACIDADE_HOVER = 0.75;     // corpo da barra da hora com o mouse em cima

  /* origem -> nome do arquivo de ícone (o cadeado é à parte, quando fixado) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base',
    saida: 'icone-origem-saida',
    troca: 'icone-origem-troca',
    troca_saida: 'icone-origem-troca',
    remanejado_saida: 'icone-remanejado',
    pontual: 'icone-origem-pontual',
    /* o estagiário (Ajustes › Estágios): o pontual do dia de estágio, com o ícone do estágio */
    estagio: 'icone-estagio',
    sistema: 'icone-origem-sistema',
    folga: 'icone-folgas',
    extra: 'icone-extrajornada',
    afastamento: 'icone-afastamentos',
    /* a mudança de dia: o dia novo é um pontual e o de antes, riscado, o Mudou de dia, ao lado da origem do serviço que
       saiu (a dica diz de onde veio ou para onde foi) */
    mudanca: 'icone-origem-pontual',
    mudanca_saida: 'icone-origem-mudanca',
    /* quem saiu da guarnição: riscado no primeiro serviço que não faz mais */
    saida_guarnicao: 'icone-origem-saida',
    /* o sobreaviso da companhia, embaixo do dia (escalas-celula-sobreaviso.js) */
    sobreaviso: 'icone-sobreaviso',
    /* o operacional sem guarnição, no Fora da escala (escalas-celula-fora.js) */
    fora: 'icone-remover-usuario',
    /* o guarda-vidas da página Op. Verão (op-verao-celula.js) */
    'op-verao': 'icone-boia',
    /* quem inseriu a extra, no PDF da grade da Extrajornada (a escala nunca traz estas origens) */
    extra_sistema: 'icone-extra-sistema',
    extra_admin: 'icone-extra-administrador'
  };

  /* origem -> situação do filtro da barra (escalas-filtros.js): o ciclo é a Prontidão */
  var SITUACAO_ORIGEM = {
    base: 'prontidao',
    saida: 'prontidao',
    sistema: 'prontidao',
    troca: 'trocas',
    troca_saida: 'trocas',
    extra: 'extra',
    pontual: 'pontual',
    folga: 'folga',
    afastamento: 'afastamento',
    /* a mudança de dia: o dia novo fica como o pontual e o de antes, como a folga */
    mudanca: 'pontual',
    mudanca_saida: 'folga',
    saida_guarnicao: 'prontidao',
    sobreaviso: 'sobreaviso',
    /* o operacional da unidade sem guarnição (o grupo Fora da escala, escalas-celula-fora.js) */
    fora: 'fora',
    /* o guarda-vidas da página Op. Verão (op-verao-celula.js) */
    'op-verao': 'op-verao'
  };

  /* o posto curto das células pequenas (os calendários e o PDF deles); o que não está aqui sai inteiro */
  var POSTO_CURTO = { 'Sd.1ªCl.': 'Sd.' };

  function soHora(t) { return t ? t.split(':')[0] + 'h' : ''; }

  function postoCurto(grad) { return POSTO_CURTO[grad] || grad || ''; }

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
     fica com o corpo forte. Trabalha em pixels físicos (devicePixelRatio) para sair nítido em qualquer tela.
     medida = o tamanho do canvas já lido (desenharGraficos mede todos antes de pintar) */
  function pintarGrafico(grafico, horaCursor, medida) {
    var canvas = grafico.querySelector('.escala-mes-grafico-canvas');
    if (!canvas || !canvas.getContext) return;
    var cob = (grafico.dataset.cob || '').split(',');
    var max = parseFloat(grafico.dataset.max) || 1;
    if (cob.length < 24 || max <= 0) return;
    var rect = medida || canvas.getBoundingClientRect();
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
      var marca = erro.charAt(h);
      /* hora sem ninguém de serviço: sem barra; com erro vermelho (a companhia sem Oficial de Área), a barra baixinha */
      if (n <= 0 && marca !== '1') continue;
      var altura = n > 0 ? Math.max(Math.round(BARRA_MINIMA * dpr), Math.round(Math.min(n, max) / max * util))
        : Math.round(BARRA_MINIMA * dpr);
      /* bordas da barra no pixel físico inteiro: o vão sai sempre nítido e do mesmo tamanho */
      var x = Math.round(h * passo), largura = Math.round((h + 1) * passo - vao) - x, y = Hf - altura;
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

  /* mini-gráfico de cobertura no topo da célula (barras por hora pintadas em <canvas>; Guia visual › Grade da escala).
     Só guarda os dados; o desenho (que precisa do tamanho real) fica em pintarGrafico */
  function montarGrafico(cobertura, maxUnidade, erro, estagiarios) {
    var marcas = '';
    for (var h = 0; h < 24; h++) {
      var e = erro && erro[h];   // 1 = sem função (vermelho), 2 = ressalva (amarelo), 0 = ok (verde)
      marcas += (e === 2 || e === '2') ? '2' : (e ? '1' : '0');
    }
    /* a unidade sem ninguém de serviço no período (a companhia sem Oficial de Área): o gráfico só aparece com erro
       vermelho, na régua de 1 */
    if (!(maxUnidade > 0)) {
      if (marcas.indexOf('1') < 0) return null;
      maxUnidade = 1;
    }
    var g = RosterWork.tpl('tpl-escala-mes-grafico');
    if (!g) return null;
    g.dataset.cob = cobertura.join(',');
    g.dataset.max = maxUnidade;
    /* os estagiários que não são efetivo, por hora (fora da barra; a dica mostra embaixo dos militares) */
    if (estagiarios && estagiarios.some(function (n) { return Number(n) > 0; })) g.dataset.estag = estagiarios.join(',');
    g.dataset.erro = marcas;
    return g;
  }

  /* desenha (ou redesenha) todos os gráficos; relê as cores do tema uma vez por passada. Mede todos antes de pintar:
     mudar o tamanho de um canvas e medir o próximo obrigaria o navegador a recalcular a página a cada gráfico */
  function desenharGraficos(escalaEl) {
    var graficos = escalaEl.querySelectorAll('.escala-mes-grafico');
    if (!graficos.length) return;
    temaGrafico = lerTema();
    var medidas = [], i;
    for (i = 0; i < graficos.length; i++) {
      var canvas = graficos[i].querySelector('.escala-mes-grafico-canvas');
      medidas.push(canvas ? canvas.getBoundingClientRect() : null);
    }
    for (i = 0; i < graficos.length; i++) pintarGrafico(graficos[i], null, medidas[i]);
  }

  /* hora exibida no gráfico (a janela começa às 08h) */
  function rotuloHora(h) { return ((8 + h) % 24) + 'h'; }

  /* hover do gráfico: repinta o canvas sob o mouse com a barra da hora apontada em destaque e move a
     dica "Nh · X militares", com "Y estagiários" embaixo na hora que tem (segue o ponteiro; posição via custom
     property — exceção REGRAS §4) */
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
      var estagiarios = Number((g.dataset.estag || '').split(',')[hora]) || 0;

      if (ativo && ativo !== g) pintarGrafico(ativo, null);
      pintarGrafico(g, hora);
      ativo = g;

      if (dica) {
        var t = RosterWork.mensagens.escala.coberturaDica;
        var linhaEstagiarios = dica.querySelector('.escala-mes-dica-estagiarios');
        dica.querySelector('.escala-mes-dica-militares').textContent = t.militares(rotuloHora(hora), n);
        linhaEstagiarios.textContent = estagiarios > 0 ? t.estagiarios(estagiarios) : '';
        linhaEstagiarios.classList.toggle('oculto', !(estagiarios > 0));
        dica.style.setProperty('--dica-x', e.clientX + 'px');
        dica.style.setProperty('--dica-y', e.clientY + 'px');
        dica.classList.remove('oculto');
      }
    });

    escalaEl.addEventListener('mouseleave', esconder);
  }

  function definirIcone(svg, nomeIcone) {
    var uso = svg.querySelector('use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#' + nomeIcone);
  }

  /* quem mudou de dia: no dia novo o ícone do pontual e, na linha riscada do dia de antes, o do Mudou de dia, com a dica
     de onde o serviço veio ou para onde foi (o span recebe a dica; com a dica da linha, escalas-celula-dica.js, ela vai
     nela); null nas outras origens */
  function iconeDaMudanca(p, D) {
    var t = RosterWork.mensagens.escala;
    var dica = p.origem === 'mudanca' && p.mudanca_de ? t.mudouDeDiaDe(p.mudanca_de)
      : p.origem === 'mudanca_saida' && p.mudanca_para ? t.mudouDeDiaPara(p.mudanca_para) : '';
    if (!dica) return null;
    var el = RosterWork.tpl('tpl-escala-mudanca-icone');
    if (!el) return null;
    definirIcone(el.querySelector('svg'), ICONE_ORIGEM[p.origem]);
    if (!D) el.setAttribute('data-dica', dica);
    return el;
  }

  /* quem saiu da guarnição: o ícone da saída, com a dica da data (o span recebe a dica; com a dica da linha, ela vai nela);
     null nas outras origens */
  function iconeDaSaida(p, D) {
    if (p.origem !== 'saida_guarnicao') return null;
    var el = RosterWork.tpl('tpl-escala-mudanca-icone');
    if (!el) return null;
    definirIcone(el.querySelector('svg'), 'icone-origem-saida');
    var d = String(p.saida || '').split('-');
    if (!D) el.setAttribute('data-dica', RosterWork.mensagens.escala.saiuDaGuarnicao(d.length === 3 ? d[2] + '/' + d[1] : ''));
    return el;
  }

  /* uma linha de militar: ícone de origem (+ cadeado se fixado) + grad + nome + horário (curto: o posto curto). D = a dica
     da linha (escalas-celula-dica.js, só com a Escala na tela): ela guarda o militar, e as dicas daqui vão nela */
  function montarPessoa(p, curto, D) {
    var linha = RosterWork.tpl('tpl-escala-mes-pessoa');
    if (!linha) return null;
    if (D) D.marcar(linha, p);
    if (p.origem === 'folga') linha.classList.add('linha-escalado--folga');   /* folga: nome riscado */
    if (p.origem === 'troca_saida') linha.classList.add('linha-escalado--trocado');   /* trocado: nome riscado */
    if (p.origem === 'remanejado_saida') linha.classList.add('linha-escalado--remanejado');   /* saiu para outra unidade: riscado */
    if (p.origem === 'mudanca_saida') linha.classList.add('linha-escalado--mudou-dia');   /* passou para outro dia: riscado */
    if (p.origem === 'saida_guarnicao') linha.classList.add('linha-escalado--saiu');   /* saiu da guarnição: riscado */
    /* a folga ou a mudança de dia da linha riscada (uma linha por uma): o menu dela age só nela */
    if (p.lancamento_id) linha.setAttribute('data-lancamento', p.lancamento_id);
    /* de serviço e de extra no mesmo horário (o banco marca): o nome em vermelho, com a dica */
    if (p.extra_servico && p.extra_servico.length) {
      linha.classList.add('linha-escalado--extra-servico');
      if (!D) linha.setAttribute('data-dica', RosterWork.mensagens.escala.extraServicoDica);
    }

    var icones = linha.querySelector('.linha-escalado-icones');
    /* linha riscada (folga/troca/remanejamento): o ícone da origem NÃO some. Mostra a origem do militar no dia
       (contínuos, base ou pontual) e, ao lado, o marcador de folga/troca/remanejamento. */
    if (p.origem_base && ICONE_ORIGEM[p.origem_base]) {
      var origemCiclo = RosterWork.tpl('tpl-escala-mes-origem');
      if (origemCiclo) { definirIcone(origemCiclo, ICONE_ORIGEM[p.origem_base]); icones.appendChild(origemCiclo); }
    }
    var origem = iconeDaMudanca(p, D) || iconeDaSaida(p, D);
    if (!origem) { origem = RosterWork.tpl('tpl-escala-mes-origem'); if (origem) definirIcone(origem, iconeDaOrigem(origemDoIcone(p))); }
    if (origem) icones.appendChild(origem);
    if (p.fixado) {
      var cadeado = RosterWork.tpl('tpl-escala-mes-origem');
      if (cadeado) { definirIcone(cadeado, 'icone-cadeado'); icones.appendChild(cadeado); }
    }
    /* remanejado (só neste dia): o marcador ao lado da origem */
    if (p.remanejado) {
      var reman = RosterWork.tpl('tpl-escala-mes-origem');
      if (reman) { definirIcone(reman, 'icone-remanejado'); icones.appendChild(reman); }
    }

    linha.querySelector('.linha-escalado-grad').textContent = curto ? postoCurto(p.grad) : (p.grad || '');
    linha.querySelector('.linha-escalado-nome').textContent = p.nome || '';
    if (p.cpf) linha.setAttribute('data-cpf', p.cpf);   // quem é, para a edição na célula (escalas-celula-editar.js)
    if (window.RosterWork.busca) linha.setAttribute('data-busca', window.RosterWork.busca.chave(p));   // busca do sub-cabeçalho (nome/CPF/RG)
    linha.setAttribute('data-situacao', situacao(p));   // o que o filtro Situação da barra lê
    var horaWrap = linha.querySelector('.linha-escalado-hora');
    /* afastado: vem escondido (só aparece com o filtro Afastamentos) e, no lugar do horário, o nome do afastamento até a
       data ("Férias até DD/MM") */
    if (p.origem === 'afastamento') {
      linha.classList.add('linha-escalado--afastamento', 'oculto');
      horaWrap.textContent = RosterWork.mensagens.geral.afastadoAte(p.afastamento || '', RosterWork.data.isoParaBR(p.ate).slice(0, 5));
      return linha;
    }
    /* um par início→fim por período (disponibilidade quebrada = vários, empilhados em coluna) */
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
    return linha;
  }

  /* preenche o miolo de uma célula (unidade × dia): gráfico de cobertura + militares. Os erros
     aparecem só na cor do gráfico (o texto fica no painel do dia, ao clicar). Reaproveitada na
     renderização e no refresh de uma célula (atualizarCelula). maxUnidade = a régua do gráfico
     (o pico da unidade da célula no período exibido; ver calcularMaxPorUnidade).
     fora (só a Escala manda): os operacionais da unidade sem guarnição no dia, no fim (escalas-celula-fora.js).
     opcoes.postoCurto: a célula pequena dos calendários, com o posto curto (postoCurto).
     opcoes.estagiarios: os estagiários de cada hora da faixa (a Extrajornada manda os do antes ou do depois); sem ele,
     os da última leitura do dia (guardarEstagiarios) */
  function preencherCelula(celula, cobDia, erroDia, pessoas, maxUnidade, fora, opcoes) {
    var curto = !!(opcoes && opcoes.postoCurto);
    /* a página Op. Verão: só os guarda-vidas do dia, por posto (op-verao-celula.js) */
    if (RosterWork.opVeraoCelula && RosterWork.opVeraoCelula.ativa()) { RosterWork.opVeraoCelula.preencher(celula, curto); return; }
    celula.textContent = '';
    /* o dia com mudança do painel do dia ainda não salva: a borda tracejada (escalas-painel-salvar.js) */
    var S = RosterWork.escalasPainelSalvar;
    celula.classList.toggle('escala-celula--nao-salvo', !!(S && S.marcado(celula.dataset.unidadeId, celula.dataset.iso)));
    if (cobDia) {
      var estagiarios = opcoes && opcoes.estagiarios !== undefined ? opcoes.estagiarios
        : estagiariosDoDia(celula.dataset.unidadeId, celula.dataset.iso);
      var grafico = montarGrafico(cobDia, maxUnidade, erroDia, estagiarios);
      if (grafico) celula.appendChild(grafico);
    }
    var D = RosterWork.escalasCelulaDica && RosterWork.escalasCelulaDica.ligada() ? RosterWork.escalasCelulaDica : null;
    /* quem está no dia, nos grupos da Escala (escalas-celula-grupos.js); embaixo, o sobreaviso da companhia, no lugar em
       que ele aparece (escalas-celula-sobreaviso.js), e o Fora da escala (escalas-celula-fora.js) */
    RosterWork.escalasCelulaGrupos.preencher(celula, pessoas, curto, D);
    if (RosterWork.escalasCelulaSobreaviso) RosterWork.escalasCelulaSobreaviso.preencher(celula, curto, D);
    if (RosterWork.escalasCelulaFora) RosterWork.escalasCelulaFora.preencher(celula, fora, curto, D);
    if (D) D.celula(celula);   // a dica de cada linha: por que ela está na escala
    /* na Escala, o que está aberto na célula (o cartão do militar, as ações do pelotão) volta depois de refeita */
    if (RosterWork.escalasCelulaEditar) RosterWork.escalasCelulaEditar.decorar(celula);
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

  /* os estagiários que não são efetivo de cada unidade e dia, por hora (a chave estagiarios do dia na leitura do mês,
     só no dia que tem): guardados a cada leitura (escalas-dados.js, reorganizar), lidos ao preencher a célula */
  function guardarEstagiarios(grade) {
    Object.keys(grade || {}).forEach(function (uid) {
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var e = dias[iso] && dias[iso].estagiarios;
        if (e) estagiariosGuardados[uid + '|' + iso] = e;
        else delete estagiariosGuardados[uid + '|' + iso];
      });
    });
  }
  function estagiariosDoDia(uid, iso) { return estagiariosGuardados[uid + '|' + iso] || null; }

  function limparObservadores() {
    if (observerGrafico) { observerGrafico.disconnect(); observerGrafico = null; }
    if (observerTema) { observerTema.disconnect(); observerTema = null; }
  }

  /* liga hover, pinta os gráficos e observa largura/tema para repintar (uma grade por vez) */
  function ativarGraficos(wrap) {
    limparObservadores();
    ligarHover(wrap);
    desenharGraficos(wrap);
    /* repinta quando o tamanho da grade muda (o observador também avisa ao começar, com a grade recém-pintada) */
    if (window.ResizeObserver) {
      var tamanho = wrap.clientWidth + 'x' + wrap.clientHeight;
      observerGrafico = new ResizeObserver(function () {
        var agora = wrap.clientWidth + 'x' + wrap.clientHeight;
        if (agora === tamanho) return;
        tamanho = agora;
        desenharGraficos(wrap);
      });
      observerGrafico.observe(wrap);
    }
    /* o canvas pinta com cores lidas do tema; repinta quando o tema (data-tema do <html>) mudar */
    if (window.MutationObserver) {
      observerTema = new MutationObserver(function () { desenharGraficos(wrap); });
      observerTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    }
  }

  /* o ícone de cada origem e todos eles (o PDF das grades carrega os arquivos uma vez) */
  function iconeDaOrigem(origem) { return ICONE_ORIGEM[origem] || ICONE_ORIGEM.sistema; }
  function iconesDasOrigens() {
    var nomes = [];
    Object.keys(ICONE_ORIGEM).forEach(function (k) { if (nomes.indexOf(ICONE_ORIGEM[k]) < 0) nomes.push(ICONE_ORIGEM[k]); });
    return nomes;
  }

  /* a situação da pessoa para os filtros da barra (o ciclo é a Prontidão); o estagiário (o pontual do dia de estágio) é
     o Estágio */
  function situacao(p) { return p.estagio ? 'estagio' : (SITUACAO_ORIGEM[p.origem] || 'prontidao'); }
  /* a origem do ícone da linha: o estagiário tem o dele */
  function origemDoIcone(p) { return p.estagio ? 'estagio' : p.origem; }

  var oficialLido = {};   // o Oficial de cada dia como a última leitura trouxe (o título na hora parte dele e volta a ele)

  /* o Oficial de Área do dia (oficial[iso], da leitura do mês) no lugar dele: o meio do título do dia do calendário ou o
     alto da faixa do dia da Agenda e do Colunas › Unidades. O dia sem a chave (sem escala) fica sem nada; null é o dia com
     escala e ninguém na função: "Sem Oficial de Área", em vermelho. Uma linha por Oficial (linhasDoOficial). naHora: o
     título como vai ficar, até a leitura chegar (escalas-dia-na-grade.js › porOficial). Devolve se o lugar ficou à vista */
  function preencherOficial(lugar, oficial, iso, naHora) {
    /* a página Op. Verão: os Oficiais de Praia no lugar dele (op-verao-celula.js) */
    if (RosterWork.opVeraoCelula && RosterWork.opVeraoCelula.ativa()) return RosterWork.opVeraoCelula.preencherTitulo(lugar, iso);
    if (!lugar) return false;
    lugar.textContent = '';
    var tem = !!oficial && Object.prototype.hasOwnProperty.call(oficial, iso);
    if (tem && !naHora) oficialLido[iso] = oficial[iso];
    if (tem) {
      linhasDoOficial(oficial[iso]).forEach(function (l) {
        var no = RosterWork.tpl('tpl-escala-oficial');
        if (!no) return;
        var grad = no.querySelector('.escala-oficial-grad');
        grad.textContent = l.pessoa ? (l.pessoa.grad || '') : '';
        grad.classList.toggle('oculto', !grad.textContent);
        no.querySelector('.escala-oficial-nome').textContent = l.pessoa ? (l.pessoa.nome || '') : RosterWork.mensagens.escala.semOficial;
        var hora = no.querySelector('.escala-oficial-hora');
        hora.textContent = l.hora;
        hora.classList.toggle('oculto', !l.hora);
        no.classList.toggle('escala-oficial--sem', !l.pessoa);
        lugar.appendChild(no);
        if (RosterWork.escalasCelulaOficial) RosterWork.escalasCelulaOficial.decorar(no, iso, l);   // a caixa do título
      });
    }
    var vista = !!lugar.firstChild;
    lugar.classList.toggle('oculto', !vista);
    return vista;
  }

  /* as linhas do título de um dia: [{ pessoa (null = ninguém), hora (vazia = o dia todo), de, ate (minutos desde as 08h) }].
     Ninguém: "Sem Oficial de Área"; a leitura sem os horários (sem todos) ou um só o dia todo: o nome, como sempre; senão
     cada Oficial com o horário e cada pedaço do dia sem ninguém, em ordem */
  function linhasDoOficial(oa) {
    var H = RosterWork.horario, texto = RosterWork.mensagens.escala.oficialHoras;
    if (!oa) return [{ pessoa: null, hora: '', de: 0, ate: 1440 }];
    if (!oa.todos || !oa.todos.length) return [{ pessoa: oa, hora: '', de: 0, ate: 1440 }];
    var linhas = oa.todos.map(function (p) {
      var de = H.emMin(p.inicio), ate = H.emMin(p.fim) || 1440;
      return { pessoa: p, de: de, ate: ate > de ? ate : 1440 };
    });
    var cursor = 0;
    linhas.slice().sort(function (a, b) { return a.de - b.de; }).forEach(function (l) {
      if (l.de > cursor) linhas.push({ pessoa: null, de: cursor, ate: l.de });
      cursor = Math.max(cursor, l.ate);
    });
    if (cursor < 1440) linhas.push({ pessoa: null, de: cursor, ate: 1440 });
    linhas.sort(function (a, b) { return a.de - b.de; });
    var diaTodo = linhas.length === 1 && linhas[0].de === 0 && linhas[0].ate === 1440;
    linhas.forEach(function (l) { l.hora = diaTodo ? '' : texto(H.curta(H.hhmm(l.de)), H.curta(H.hhmm(l.ate))); });
    return linhas;
  }

  window.RosterWork.escalasCelula = {
    preencherCelula: preencherCelula,
    /* a linha de um militar (o sobreaviso, escalas-celula-sobreaviso.js, desenha as dele com ela) */
    montarPessoa: montarPessoa,
    /* o Oficial de Área no título do dia das grades: as linhas dele (também no PDF) e o da última leitura de cada dia
       (undefined: o dia não foi lido) */
    preencherOficial: preencherOficial,
    linhasDoOficial: linhasDoOficial,
    oficialLido: function (iso) { return oficialLido[iso]; },
    montarGrafico: montarGrafico,
    /* os estagiários de cada hora, da leitura do mês (a dica da faixa) */
    guardarEstagiarios: guardarEstagiarios,
    estagiariosDoDia: estagiariosDoDia,
    calcularMaxPorUnidade: calcularMaxPorUnidade,
    ativarGraficos: ativarGraficos,
    desenharGraficos: desenharGraficos,
    /* a dica "Nh · X militares" (e os estagiários) nos gráficos de um elemento fora da grade (a cobertura dos painéis do dia) */
    ligarDica: ligarHover,
    limparObservadores: limparObservadores,
    /* peças para o PDF das grades: a mesma origem, situação e hora da tela */
    iconeDaOrigem: iconeDaOrigem, origemDoIcone: origemDoIcone,
    iconesDasOrigens: iconesDasOrigens,
    situacao: situacao,
    soHora: soHora,
    /* o posto curto das células pequenas (tela e PDF dos calendários) */
    postoCurto: postoCurto
  };
})();
