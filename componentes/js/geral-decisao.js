/* ============================================================
   PAINEL DE DECISÃO — componente compartilhado (Trocas e Folgas)
   Monta o corpo do painel que aprova ou recusa um pedido:
     · montar(corpo)  → o esqueleto; devolve as partes
     · caixa(cfg)     → uma caixa do pedido: título, dia com o
                        horário, a frase, a régua e um texto extra
     · saldo(partes, texto, alerta) → a nota do saldo (folga): entra
                        na Análise, depois das notas da escala e
                        antes das verdes
     · analisando(partes) / analise(partes, r) → a seção Análise:
                        os pontinhos e, depois, o selo do resultado
                        no título e as notas do geral-impacto (a
                        seção só aparece no painel que analisa)
     · escala(partes, carregar) → o "Como fica a escala": fechado;
                        lê e desenha o dia inteiro só ao abrir
     · recusar(partes, aoConfirmar) → a caixa do motivo e o rodapé
                        Voltar / Confirmar recusa; Voltar devolve o
                        rodapé de antes. aoConfirmar(motivo, botao).
     · cancelar(partes, aoConfirmar, { titulo }) → o mesmo para o
                        cancelamento da troca aprovada, com o motivo
                        obrigatório (sem ele, o erro no campo) e o
                        Confirmar cancelamento do administrador.
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
      analiseSecao: raiz.querySelector('.decisao-analise-secao'),
      analiseSelo: raiz.querySelector('.decisao-analise-selo'),
      analise: raiz.querySelector('.decisao-analise'),
      saldo: null,   // { texto, alerta }: a nota do saldo, desenhada junto com a análise
      escala: raiz.querySelector('.decisao-escala'),
      recusa: raiz.querySelector('.decisao-recusa'),
      motivo: raiz.querySelector('.decisao-motivo'),
      cancelamento: raiz.querySelector('.decisao-cancelamento'),
      motivoCancelamento: raiz.querySelector('.decisao-motivo-cancelamento')
    };
    /* motivo escrito e não enviado: o navegador avisa antes de sair */
    function escrito(caixa, campo) { return !!caixa && document.contains(campo) && !caixa.classList.contains('oculto') && campo.value.trim() !== ''; }
    if (cancelarGuarda) cancelarGuarda();
    cancelarGuarda = RW.guardaSaida ? RW.guardaSaida.registrar(function () {
      return escrito(partes.recusa, partes.motivo) || escrito(partes.cancelamento, partes.motivoCancelamento);
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

  /* guarda a nota do saldo; ela aparece com a análise (analise()) */
  function saldo(partes, texto, alerta) {
    if (!partes) return;
    partes.saldo = texto ? { texto: texto, alerta: !!alerta } : null;
  }

  /* a nota do saldo dentro da Análise: depois das notas da escala, antes das verdes */
  function desenharSaldo(partes) {
    if (!partes.saldo) return;
    var n = RosterWork.tpl('tpl-decisao-saldo');
    if (!n) return;
    n.classList.toggle('nota--alerta', partes.saldo.alerta);
    n.querySelector('.nota-texto').textContent = partes.saldo.texto;
    partes.analise.insertBefore(n, partes.analise.querySelector('.nota--sucesso'));
  }

  function analisando(partes) {
    if (!partes) return;
    partes.analiseSecao.classList.remove('oculto');
    partes.analiseSelo.classList.add('oculto');
    partes.analise.textContent = '';
    var pts = document.getElementById('carregando-pontos');
    if (pts) partes.analise.appendChild(pts.content.cloneNode(true));
  }

  /* r = resultado da análise; sem r (falhou), o texto de falha. O selo do título
     é o mesmo do cartão da Pendências (ex.: "2 pontos de atenção") */
  function analise(partes, r, textoFalha) {
    if (!partes) return;
    partes.analiseSecao.classList.remove('oculto');
    partes.analise.textContent = '';
    var selo = r && r.ok !== false && RW.impacto ? RW.impacto.selo(r) : null;
    partes.analiseSelo.classList.remove('selo--erro', 'selo--alerta', 'selo--sucesso');
    if (selo) partes.analiseSelo.classList.add(selo.classe);
    partes.analiseSelo.classList.toggle('oculto', !selo);
    partes.analiseSelo.textContent = selo ? selo.texto : '';
    if (r && r.ok !== false && RW.impacto) {
      RW.impacto.desenhar(partes.analise, r);
    } else {
      var e = RW.painel && RW.painel.criarEstado ? RW.painel.criarEstado(textoFalha || '') : null;
      if (e) partes.analise.appendChild(e);
    }
    desenharSaldo(partes);
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

  /* a caixa do motivo no corpo e o rodapé Voltar / Confirmar no lugar das ações; Voltar devolve o rodapé de antes.
     obrigatorio: sem motivo, o Confirmar marca o erro no campo e não segue */
  function pedirMotivo(caixa, campo, idAcoes, acaoConfirmar, erroObrigatorio, aoConfirmar) {
    var rodape = RW.painel && RW.painel.rodape();
    if (!caixa || !campo || !rodape) return;
    var tpl = document.getElementById(idAcoes);
    if (!tpl) return;
    /* guarda os botões de antes (com os cliques ligados) para o Voltar */
    var antes = [].slice.call(rodape.childNodes);
    antes.forEach(function (n) { rodape.removeChild(n); });
    var frag = tpl.content.cloneNode(true);
    var voltar = frag.querySelector('[data-acao="voltar"]');
    var confirmar = frag.querySelector('[data-acao="' + acaoConfirmar + '"]');
    rodape.appendChild(frag);
    campo.value = '';
    if (RW.campos) RW.campos.limparErro(campo);
    caixa.classList.remove('oculto');
    caixa.scrollIntoView({ block: 'nearest' });
    campo.focus();
    voltar.addEventListener('click', function () {
      campo.value = '';
      if (RW.campos) RW.campos.limparErro(campo);
      caixa.classList.add('oculto');
      rodape.textContent = '';
      antes.forEach(function (n) { rodape.appendChild(n); });
    });
    campo.addEventListener('input', function () { if (RW.campos) RW.campos.limparErro(campo); });
    confirmar.addEventListener('click', function () {
      var motivo = campo.value.trim();
      if (erroObrigatorio && !motivo) {
        if (RW.campos) RW.campos.marcarErro(campo, erroObrigatorio);
        campo.focus();
        return;
      }
      if (aoConfirmar) aoConfirmar(motivo, confirmar);
    });
  }

  function recusar(partes, aoConfirmar) {
    if (!partes) return;
    pedirMotivo(partes.recusa, partes.motivo, 'tpl-decisao-recusa-acoes', 'confirmar-recusa', null, aoConfirmar);
  }

  /* o cancelamento com o motivo obrigatório (a troca aprovada); titulo = "Cancelar a troca" ou "Cancelar as trocas" */
  function cancelar(partes, aoConfirmar, opcoes) {
    if (!partes || !partes.cancelamento) return;
    opcoes = opcoes || {};
    if (opcoes.titulo) partes.cancelamento.querySelector('.decisao-cancelamento-titulo').textContent = opcoes.titulo;
    pedirMotivo(partes.cancelamento, partes.motivoCancelamento, 'tpl-decisao-cancelamento-acoes', 'confirmar-cancelamento',
      opcoes.erro || RW.mensagens.trocas.cancelarMotivo.erro, aoConfirmar);
  }

  RW.decisao = { montar: montar, caixa: caixa, saldo: saldo, analisando: analisando, analise: analise, escala: escala, recusar: recusar, cancelar: cancelar };
})();
