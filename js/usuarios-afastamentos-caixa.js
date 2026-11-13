/* ============================================================
   USUÁRIOS — abas Férias · Licenças · Dispensas · Missões: a caixa no lugar da linha
   (RosterWork.usuariosAfastamentosCaixa)
   Clicar no militar troca a linha por uma caixa: a própria linha no
   alto, com o X; em Licenças e Dispensas, o Tipo (Férias e Missões têm
   um tipo só, sem a escolha); embaixo, os períodos
   daquele tipo no ano (usuarios-painel-afastamentos-editar.js). Uma
   caixa aberta por vez, um militar e um tipo por Salvar, porque cada
   gravação pode pedir confirmação e refaz a escala. O rodapé largo
   aparece com alteração: Salvar grava e abre o resumo; Cancelar fecha
   a caixa. Com algo não salvo, trocar de militar, de tipo, de ano ou
   de aba pergunta antes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var CATEGORIA = { ferias: 'ferias', licencas: 'licenca', dispensas: 'dispensa', missoes: 'missao' };

  var raiz = null;   // o conteúdo da página Usuários
  var est = null;    // a caixa aberta: { linha, caixa, pessoa, cat, ano, todos, tipo, sub }
  var token = 0;     // latest-wins: a resposta de uma caixa que já fechou é ignorada

  function el(seletor) { return raiz ? raiz.querySelector(seletor) : null; }
  function M() { return RW.mensagens.afastamentos; }
  function editor() { return RW.usuariosPainelAfastamentosEditar; }
  function sujo() { return !!(est && est.sub && est.sub.sujo()); }

  /* o rodapé largo: aparece só com alteração, e o Salvar fica desligado com data pela metade ou conflito */
  function pintarRodape() {
    var rodape = el('#afastamentos-rodape');
    if (!rodape) return;
    var n = est && est.sub ? est.sub.mudancas() : 0;
    rodape.classList.toggle('oculto', !n);
    el('#afastamentos-mudancas').textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    el('#afastamentos-salvar').disabled = !(est && est.sub && est.sub.podeAplicar());
  }

  /* a linha volta ao lugar dela; o que não foi salvo se perde */
  function fechar(devolverFoco) {
    token++;
    if (est) {
      var atual = est;
      est = null;
      if (editor()) editor().reset();
      if (atual.caixa.isConnected) {
        atual.caixa.replaceWith(atual.linha);
        if (devolverFoco) atual.linha.focus({ preventScroll: true });
      }
    }
    pintarRodape();
  }

  function perguntar(aoDescartar, aoFicar) {
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: aoDescartar, aoCancelar: aoFicar
    });
  }

  /* fecha a caixa antes de seguir; com algo não salvo, só no Descartar */
  function antesDeSair(seguir, devolverFoco) {
    function sair() {
      fechar(devolverFoco);
      if (seguir) seguir();
    }
    if (sujo()) perguntar(sair);
    else sair();
  }

  /* gravou: a lista da aba e a do Efetivo são relidas, e o resumo abre */
  function concluir(r) {
    fechar();
    if (RW.usuariosAfastamentos) RW.usuariosAfastamentos.recarregar();
    if (RW.arvoreUnidades && RW.arvoreUnidades.recarregar) RW.arvoreUnidades.recarregar();
    if (r && r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
  }

  /* os períodos do tipo escolhido, na tela de períodos */
  function montarPeriodos(e, tipo) {
    var lugar = e.caixa.querySelector('[data-periodos-lugar]');
    lugar.textContent = '';
    e.tipo = tipo;
    var periodos = e.todos.filter(function (x) { return e.cat === 'ferias' || x.tipo === tipo; });
    e.sub = editor().montarSubtela(lugar, { pessoa: e.pessoa, categoria: e.cat, tipo: tipo, ano: e.ano, periodos: periodos },
      { aoMudar: pintarRodape, concluir: concluir });
    pintarRodape();
  }

  /* trocar de tipo com algo não salvo pergunta; no Continuar editando, a escolha volta (voltar) */
  function trocarTipo(e, novo, voltar) {
    if (est !== e || novo === e.tipo) return;
    if (sujo()) perguntar(function () { montarPeriodos(e, novo); }, voltar);
    else montarPeriodos(e, novo);
  }

  /* o Tipo: Férias e Missões (um tipo só) não têm; Licenças, com nomes longos, no campo de seleção; Dispensas, no seletor */
  function montarTipo(e) {
    if (RW.usuariosAfastamentos.umTipo(e.cat)) return;
    var lugar = e.caixa.querySelector('[data-afastamento-tipo]');
    var curtos = M().tiposCurtos;
    var tipos = RW.usuariosAfastamentos.tiposDe(e.cat);
    if (e.cat === 'licenca') {
      var campo = RW.tpl('tpl-afastamentos-tipo-campo');
      var botao = campo.querySelector('[data-tipo-campo]');
      var mostrar = function (t) {
        RW.campos.definirSelecao(botao, t);
        botao.querySelector('.campo-selecao-texto').textContent = curtos[t];
      };
      RW.campos.popularOpcoes(campo.querySelector('.dropdown-menu'), tipos.map(function (t) { return { rotulo: curtos[t], valor: t }; }));
      RW.campos.ligarSelecao(botao, function (valor) {
        trocarTipo(e, valor, function () { mostrar(e.tipo); });
      });
      mostrar(e.tipo);
      lugar.appendChild(campo);
      return;
    }
    var seletor = RW.tpl('tpl-afastamentos-tipo-seletor');
    var marcar = function (t) {
      Array.prototype.forEach.call(seletor.querySelectorAll('.aba'), function (aba) {
        var ativa = aba.getAttribute('data-tipo-valor') === t;
        aba.classList.toggle('aba--ativa', ativa);
        aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      });
    };
    tipos.forEach(function (t) {
      var aba = RW.tpl('tpl-afastamentos-tipo');
      aba.textContent = curtos[t];
      aba.setAttribute('data-tipo-valor', t);
      seletor.appendChild(aba);
    });
    marcar(e.tipo);
    lugar.appendChild(seletor);
    RW.abas.ligar(seletor, function (aba) {
      trocarTipo(e, aba.getAttribute('data-tipo-valor'), function () { marcar(e.tipo); });
    });
  }

  /* abre no primeiro tipo com período no ano; sem nenhum, no primeiro da lista */
  function tipoInicial(e) {
    if (e.cat === 'ferias') return 'ferias';
    var tipos = RW.usuariosAfastamentos.tiposDe(e.cat);
    var noAno = e.todos.filter(function (x) {
      return tipos.indexOf(x.tipo) >= 0 && String(x.data_inicio) <= e.ano + '-12-31' && String(x.data_fim) >= e.ano + '-01-01';
    });
    return noAno.length ? noAno[0].tipo : tipos[0];
  }

  function abrirNaLinha(linha, pessoa, aba, ano) {
    var cat = CATEGORIA[aba];
    var caixa = RW.tpl('tpl-afastamentos-caixa');
    if (!cat || !caixa || !editor()) return;
    var e = est = { linha: linha, caixa: caixa, pessoa: pessoa, cat: cat, ano: ano, todos: [], tipo: null, sub: null };
    var meu = ++token;
    caixa.querySelector('.usuarios-caixa-fechar').addEventListener('click', function () { antesDeSair(null, true); });
    if (RW.usuariosAfastamentos.umTipo(cat)) caixa.querySelector('[data-afastamento-tipo]').remove();
    var pontos = RW.tpl('carregando-pontos');
    if (pontos) caixa.querySelector('[data-periodos-lugar]').appendChild(pontos);
    linha.replaceWith(caixa);
    caixa.querySelector('.usuarios-caixa-topo').prepend(linha);
    linha.focus({ preventScroll: true });

    RW.usuariosAfastamentosDados.listar(cat, null, pessoa.usuario_id).then(function (lista) {
      if (meu !== token || est !== e) return;
      if (lista == null) {
        fechar(true);
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().falhaCarregar });
        return;
      }
      e.todos = lista;
      e.tipo = tipoInicial(e);
      montarTipo(e);
      montarPeriodos(e, e.tipo);
    });
  }

  /* o clique na linha: abre a caixa dela; na própria caixa, fecha */
  function abrir(linha, pessoa, aba, ano) {
    if (est && est.linha === linha) { antesDeSair(null, true); return; }
    antesDeSair(function () { abrirNaLinha(linha, pessoa, aba, ano); });
  }

  /* a navegação abriu a página: o rodapé e a pergunta ao trocar de aba com algo não salvo */
  function iniciar(conteudo) {
    raiz = conteudo;
    est = null;
    token++;
    var salvar = el('#afastamentos-salvar');
    if (salvar && !salvar.dataset.ligado) {
      salvar.dataset.ligado = '1';
      salvar.addEventListener('click', function () {
        if (est && est.sub && est.sub.podeAplicar()) est.sub.aplicar();
      });
    }
    var cancelar = el('#afastamentos-cancelar');
    if (cancelar && !cancelar.dataset.ligado) {
      cancelar.dataset.ligado = '1';
      cancelar.addEventListener('click', function () { fechar(true); });
    }
    var trilho = el('#usuarios-abas');
    if (trilho && !trilho.dataset.caixaGuarda) {
      trilho.dataset.caixaGuarda = '1';
      trilho.addEventListener('click', function (evento) {
        var aba = evento.target.closest('.aba');
        if (!aba || aba.classList.contains('aba--ativa') || !sujo()) return;
        evento.preventDefault();
        evento.stopPropagation();   // segura o ouvinte do geral-abas
        antesDeSair(function () { aba.click(); });
      }, true);                     // captura: roda antes do geral-abas
    }
    pintarRodape();
  }

  /* o navegador avisa ao fechar/recarregar/sair com período não salvo */
  if (RW.guardaSaida && RW.guardaSaida.registrar) RW.guardaSaida.registrar(sujo);

  RW.usuariosAfastamentosCaixa = {
    iniciar: iniciar, abrir: abrir, fechar: fechar, antesDeSair: antesDeSair,
    /* a lista refeita (busca, filtros) mantém a caixa aberta, com o que foi digitado */
    aberta: function (cpf) { return !!est && String(est.pessoa.usuario_id) === String(cpf); },
    elemento: function () { return est ? est.caixa : null; },
    /* a unidade da caixa saiu da lista (a escolha de unidades): a caixa fecha */
    conferir: function () { if (est && !est.caixa.isConnected) fechar(); }
  };
})();
