/* ============================================================
   PAINEL DE DECISÃO — componente compartilhado (Trocas e Folgas)
   Monta o corpo do painel que aprova ou recusa um pedido:
     · montar(corpo)  → o esqueleto; devolve as partes
     · montarRecusa(corpo) → só a caixa do motivo, num painel que
                        não é de decisão (a revisão de cadastro)
     · caixa(cfg)     → uma caixa do pedido: título, dia com o
                        horário, a frase, a régua e um texto extra
     · saldo(partes, texto, alerta) → a nota do saldo (folga)
     · analisando(partes) / analise(partes, r) → os pontinhos e,
                        depois, as notas do geral-impacto
     · escala(partes, carregar) → o "Como fica a escala": fechado;
                        lê e desenha o dia inteiro só ao abrir
     · recusar(partes, aoConfirmar) → a caixa do motivo e o rodapé
                        Voltar / Confirmar recusa; Voltar devolve o
                        rodapé de antes. aoConfirmar(motivo, botao).
   O motivo escrito e não enviado fica no guarda de saída.
   Clona os moldes #tpl-decisao* do shell. RosterWork.decisao.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var cancelarGuarda = null;   // o guarda de saída do painel aberto (um por vez)

  function montar(corpo) {
    if (!corpo) return null;
    corpo.textContent = '';
    var raiz = RosterWork.tpl('tpl-decisao');
    if (!raiz) return null;
    corpo.appendChild(raiz);
    var partes = {
      raiz: raiz,
      pedido: raiz.querySelector('.decisao-pedido'),
      saldo: raiz.querySelector('.decisao-saldo'),
      analise: raiz.querySelector('.decisao-analise'),
      escala: raiz.querySelector('.decisao-escala'),
      recusa: raiz.querySelector('.decisao-recusa'),
      motivo: raiz.querySelector('.decisao-motivo')
    };
    /* motivo escrito e não enviado: o navegador avisa antes de sair */
    if (cancelarGuarda) cancelarGuarda();
    cancelarGuarda = RW.guardaSaida ? RW.guardaSaida.registrar(function () {
      return document.contains(partes.motivo) && !partes.recusa.classList.contains('oculto') && partes.motivo.value.trim() !== '';
    }) : null;
    return partes;
  }

  /* só a caixa do motivo, no fim de um painel que não é de decisão (a revisão de cadastro);
     devolve as partes que o recusar() usa */
  function montarRecusa(corpo) {
    if (!corpo) return null;
    var raiz = RosterWork.tpl('tpl-decisao');
    var recusa = raiz ? raiz.querySelector('.decisao-recusa') : null;
    if (!recusa) return null;
    corpo.appendChild(recusa);
    var partes = { recusa: recusa, motivo: recusa.querySelector('.decisao-motivo') };
    if (cancelarGuarda) cancelarGuarda();
    cancelarGuarda = RW.guardaSaida ? RW.guardaSaida.registrar(function () {
      return document.contains(partes.motivo) && !partes.recusa.classList.contains('oculto') && partes.motivo.value.trim() !== '';
    }) : null;
    return partes;
  }

  /* cfg = { titulo, data, hi, hf, frase, regua: { servico: {hi, hf}, trecho: {hi, hf} }, extra } */
  function caixa(cfg) {
    var el = RosterWork.tpl('tpl-decisao-caixa');
    if (!el) return null;
    el.querySelector('.rotulo-secao').textContent = cfg.titulo || '';
    var dia = el.querySelector('.decisao-caixa-dia');
    el.querySelector('.decisao-caixa-data').textContent = cfg.data || '';
    dia.classList.toggle('oculto', !cfg.data);
    if (cfg.data && cfg.hi && RW.horario) { var h = RW.horario.leitura(cfg.hi, cfg.hf); if (h) dia.appendChild(h); }
    var frase = el.querySelector('.decisao-caixa-frase');
    frase.textContent = cfg.frase || '';
    frase.classList.toggle('oculto', !cfg.frase);
    var extra = el.querySelector('.decisao-caixa-extra');
    extra.textContent = cfg.extra || '';
    extra.classList.toggle('oculto', !cfg.extra);
    /* a régua: o serviço do dia e, por cima, o trecho do pedido */
    if (cfg.regua && RW.horario) {
      var r = RW.horario.criarRegua();
      if (r) {
        el.insertBefore(r, extra);
        RW.horario.regua(r, [
          { hi: cfg.regua.servico.hi, hf: cfg.regua.servico.hf },
          { hi: cfg.regua.trecho.hi, hf: cfg.regua.trecho.hf, classe: 'novo' }
        ]);
      }
    }
    return el;
  }

  function saldo(partes, texto, alerta) {
    if (!partes) return;
    partes.saldo.textContent = '';
    partes.saldo.classList.toggle('oculto', !texto);
    if (!texto) return;
    var n = RosterWork.tpl('tpl-decisao-saldo');
    if (!n) return;
    n.classList.toggle('nota--alerta', !!alerta);
    n.querySelector('.nota-texto').textContent = texto;
    partes.saldo.appendChild(n);
  }

  function analisando(partes) {
    if (!partes) return;
    partes.analise.textContent = '';
    var pts = document.getElementById('carregando-pontos');
    if (pts) partes.analise.appendChild(pts.content.cloneNode(true));
  }

  /* r = resultado da análise; sem r (falhou), o texto de falha */
  function analise(partes, r, textoFalha) {
    if (!partes) return;
    partes.analise.textContent = '';
    if (r && r.ok !== false && RW.impacto) { RW.impacto.desenhar(partes.analise, r); return; }
    var e = RW.painel && RW.painel.criarEstado ? RW.painel.criarEstado(textoFalha || '') : null;
    if (e) partes.analise.appendChild(e);
  }

  /* "Como fica a escala": a seção que abre e fecha, fechada no começo. O dia só é lido na
     primeira vez que ela abre (carregar() → Promise de [{titulo, data, unidade_id, unidade, dia}]),
     com o círculo girando logo abaixo do título; cada dia usa o desenho do painel do dia
     (escalas-painel-editar.js) no modo comparação: quem saiu riscado e quem entrou com o "Novo" */
  function escala(partes, carregar) {
    if (!partes || !partes.escala || !RW.painel) return;
    var m = RW.mensagens.decisao;
    var secao = RW.painel.criarSecaoColapsavel(m.comoFicaEscala, { aberta: false });
    if (!secao) return;
    partes.escala.textContent = '';
    partes.escala.appendChild(secao);
    var corpo = secao.querySelector('.painel-secao-corpo');
    var cabecalho = secao.querySelector('.painel-secao-cabecalho');
    var lido = false;
    function estado(texto) {
      corpo.textContent = '';
      var e = RW.painel.criarEstado(texto);
      if (e) corpo.appendChild(e);
    }
    cabecalho.addEventListener('click', function () {
      /* este clique chega antes do que abre a seção (delegado no painel): "false" aqui = está abrindo */
      if (lido || cabecalho.getAttribute('aria-expanded') !== 'false') return;
      lido = true;
      corpo.textContent = '';
      var gira = RW.painel.criarCarregando();
      if (gira) corpo.appendChild(gira);
      Promise.resolve(carregar()).then(function (dias) {
        if (!document.contains(corpo)) return;
        if (!Array.isArray(dias) || (dias[0] && dias[0].erro) || !RW.escalasPainelEditar) { lido = false; estado(m.falhaEscala); return; }
        if (!dias.length) { estado(m.semEscala); return; }
        corpo.textContent = '';
        dias.forEach(function (d) {
          var el = RosterWork.tpl('tpl-decisao-dia');
          if (!el) return;
          el.querySelector('.decisao-dia-titulo').textContent = m.diaTitulo(d.titulo, RW.data.comDiaSemana(d.data), d.unidade);
          corpo.appendChild(el);
          RW.escalasPainelEditar.montar(el.querySelector('.decisao-dia-lista'), null, d.unidade_id, d.data,
            { comparar: true, dados: d.dia, semAvisos: true });
        });
      }).catch(function () {
        if (!document.contains(corpo)) return;
        lido = false;
        estado(m.falhaEscala);
      });
    });
  }

  function recusar(partes, aoConfirmar) {
    var rodape = RW.painel && RW.painel.rodape();
    if (!partes || !rodape) return;
    var tpl = document.getElementById('tpl-decisao-recusa-acoes');
    if (!tpl) return;
    /* guarda os botões de antes (com os cliques ligados) para o Voltar */
    var antes = [].slice.call(rodape.childNodes);
    antes.forEach(function (n) { rodape.removeChild(n); });
    var frag = tpl.content.cloneNode(true);
    var voltar = frag.querySelector('[data-acao="voltar"]');
    var confirmar = frag.querySelector('[data-acao="confirmar-recusa"]');
    rodape.appendChild(frag);
    partes.motivo.value = '';
    partes.recusa.classList.remove('oculto');
    partes.recusa.scrollIntoView({ block: 'nearest' });
    partes.motivo.focus();
    voltar.addEventListener('click', function () {
      partes.motivo.value = '';
      partes.recusa.classList.add('oculto');
      rodape.textContent = '';
      antes.forEach(function (n) { rodape.appendChild(n); });
    });
    confirmar.addEventListener('click', function () {
      if (aoConfirmar) aoConfirmar(partes.motivo.value.trim(), confirmar);
    });
  }

  RW.decisao = { montar: montar, montarRecusa: montarRecusa, caixa: caixa, saldo: saldo, analisando: analisando, analise: analise, escala: escala, recusar: recusar };
})();
