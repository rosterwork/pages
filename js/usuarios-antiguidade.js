/* ============================================================
   USUÁRIOS — aba Antiguidade (só administrador)
   Lê a companhia do admin (antiguidade_listar) e mostra cada posto
   com os militares na ordem; o número é a posição dentro do posto.
   Usa as peças da árvore de unidades: a trilha (as unidades de cima),
   o bloco da companhia e um bloquinho por posto.
   Clicar no militar marca a linha e mostra as setas (as teclas ↑ e ↓
   também movem); quem mudou de lugar ganha a canaleta. O título de
   cada posto recolhe e expande a lista (fica assim enquanto a página
   está aberta). Nada vai para o banco até o Salvar do rodapé: ele pede
   a data (a antiguidade decide o Chefe na escala), grava por
   antiguidade_salvar e abre o resumo. Cancelar lê de novo a ordem gravada.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var raiz = null;          /* o conteúdo da página Usuários */
  var lista = null;         /* #antiguidade-lista */
  var postos = [];          /* [{ original: [cpf], atual: [cpf], corpo }] na ordem da tela */
  var pessoas = {};         /* cpf -> { dados, linha, posto } */
  var recolhidos = {};      /* nível do posto -> true: postos recolhidos (voltam abertos ao reabrir a página) */
  var selecionado = null;   /* cpf da linha escolhida */
  var termoBusca = '';
  var carregado = false;
  var token = 0;            /* latest-wins: ignora resposta antiga ao reabrir a aba */

  function el(seletor) { return raiz ? raiz.querySelector(seletor) : null; }

  /* ---------- o que mudou ---------- */
  function mudancas() {
    var n = 0;
    postos.forEach(function (p) {
      p.atual.forEach(function (cpf, i) { if (p.original[i] !== cpf) n++; });
    });
    return n;
  }

  /* rodapé: o texto das mudanças e o Salvar (como em Extrajornada › Voluntários) */
  function atualizarRodape() {
    var n = mudancas();
    var texto = el('#antiguidade-mudancas');
    if (texto) texto.textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    var salvar = el('#antiguidade-salvar');
    if (salvar) salvar.disabled = !n;
  }

  /* números, canaleta e setas das pontas de um posto, depois de mexer */
  function atualizarPosto(p) {
    p.atual.forEach(function (cpf, i) {
      var linha = pessoas[cpf].linha;
      linha.querySelector('[data-numero]').textContent = (i + 1) + 'º';
      linha.classList.toggle('antiguidade-linha--alterada', p.original.indexOf(cpf) !== i);
      linha.querySelector('[data-mover="cima"]').disabled = i === 0;
      linha.querySelector('[data-mover="baixo"]').disabled = i === p.atual.length - 1;
    });
  }

  /* ---------- montagem ---------- */
  function montarLinha(m) {
    var linha = RW.tpl('tpl-antiguidade-linha');
    linha.setAttribute('data-cpf', m.cpf);
    linha.querySelector('[data-grad]').textContent = m.grad || '';
    linha.querySelector('[data-guerra]').textContent = m.nome || '';
    linha.querySelector('[data-pelotao]').textContent = m.unidade || '';
    return linha;
  }

  /* sem dados: a área nunca fica em branco; na falha de leitura o texto é o do erro, não o de lista vazia */
  function desenharVazio(falhou) {
    var vazio = RW.tpl('tpl-antiguidade-vazio');
    if (falhou) vazio.textContent = RW.mensagens.geral.falhaCarregar;
    lista.appendChild(vazio);
  }

  function desenhar(dados) {
    lista.textContent = '';
    postos = [];
    pessoas = {};
    selecionado = null;
    var grupos = (dados && dados.postos) || [];
    if (!dados || !dados.unidade || !grupos.length) {
      desenharVazio(!dados);
      atualizarRodape();
      return;
    }
    var trilha = RW.tpl('tpl-arvore-trilha');
    if (trilha && RW.arvoreUnidades) RW.arvoreUnidades.trilha(trilha, dados.unidade.id);
    if (trilha) lista.appendChild(trilha);
    var bloco = RW.tpl('tpl-arvore-bloco');
    bloco.querySelector('.arvore-bloco-nome').textContent = dados.unidade.nome_completo || dados.unidade.nome || '';
    bloco.querySelector('[data-sigla]').textContent = dados.unidade.nome || '';
    bloco.querySelector('[data-cidade]').textContent = dados.unidade.cidade || '';
    var total = grupos.reduce(function (n, g) { return n + (g.militares || []).length; }, 0);
    bloco.querySelector('.arvore-contagem').textContent = total === 1 ? '1 militar' : total + ' militares';
    var area = bloco.querySelector('.arvore-conteudo');
    grupos.forEach(function (g) {
      var caixa = RW.tpl('tpl-antiguidade-posto');
      caixa.setAttribute('data-nivel', g.nivel);
      caixa.querySelector('[data-posto-titulo]').textContent = g.titulo || '';
      if (recolhidos[g.nivel]) recolher(caixa, true);
      var p = { original: [], atual: [], corpo: caixa.querySelector('[data-posto-lista]') };
      (g.militares || []).forEach(function (m) {
        var linha = montarLinha(m);
        pessoas[m.cpf] = { dados: m, linha: linha, posto: p };
        p.original.push(m.cpf);
        p.atual.push(m.cpf);
        p.corpo.appendChild(linha);
      });
      postos.push(p);
      atualizarPosto(p);
      area.appendChild(caixa);
    });
    lista.appendChild(bloco);
    aplicarBusca(false);
    atualizarRodape();
  }

  function carregar(manter) {
    var meu = ++token;
    lista.textContent = '';
    var pontos = RW.tpl('carregando-pontos');
    if (pontos) lista.appendChild(pontos);
    return RW.apiFetch('/rest/v1/rpc/antiguidade_listar', { metodo: 'POST', corpo: {} })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (dados) {
        if (meu !== token) return;
        if (!dados && RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaCarregar });
        carregado = !!dados;
        desenhar(dados);
        if (manter && pessoas[manter]) escolher(manter);
      })
      .catch(function () {
        if (meu !== token) return;
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
        desenhar(null);
      });
  }

  /* ---------- recolher e expandir um posto (como o título da unidade no modo Militares) ---------- */
  function recolher(caixa, recolhido) {
    caixa.classList.toggle('bloquinho--recolhido', recolhido);
    caixa.querySelector('.antiguidade-posto-titulo').setAttribute('aria-expanded', recolhido ? 'false' : 'true');
    recolhidos[caixa.getAttribute('data-nivel')] = recolhido;
  }

  /* ---------- escolher e mover ---------- */
  function escolher(cpf) {
    if (selecionado && pessoas[selecionado]) pessoas[selecionado].linha.classList.remove('linha-militar--selecionada');
    selecionado = cpf;
    if (cpf && pessoas[cpf]) pessoas[cpf].linha.classList.add('linha-militar--selecionada');
  }

  /* troca com o vizinho; no DOM quem sai do lugar é o vizinho, então a linha escolhida não perde o foco */
  function mover(cpf, passo) {
    var pessoa = pessoas[cpf];
    if (!pessoa) return;
    var p = pessoa.posto;
    var i = p.atual.indexOf(cpf);
    var j = i + passo;
    if (j < 0 || j >= p.atual.length) return;
    var vizinho = p.atual[j];
    p.atual[j] = cpf;
    p.atual[i] = vizinho;
    var linha = pessoa.linha;
    var linhaVizinho = pessoas[vizinho].linha;
    if (passo < 0) p.corpo.insertBefore(linhaVizinho, linha.nextSibling);
    else p.corpo.insertBefore(linhaVizinho, linha);
    var foco = document.activeElement;
    atualizarPosto(p);
    /* chegou na ponta: a seta que tinha o foco desliga, o foco passa para a linha (as teclas seguem valendo) */
    if (foco && foco.disabled) linha.focus();
    atualizarRodape();
  }

  /* ---------- salvar ---------- */
  function salvar() {
    var grupos = postos.filter(function (p) {
      return p.atual.some(function (cpf, i) { return p.original[i] !== cpf; });
    }).map(function (p) { return { cpfs: p.atual.slice() }; });
    if (!grupos.length || !RW.pedirData) return;
    RW.pedirData({
      textoConfirmar: RW.mensagens.botoes.salvar,
      sugerida: true,
      aoConfirmar: function (iso) { enviar(grupos, iso); }
    });
  }

  function enviar(grupos, iso) {
    if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();
    RW.apiFetch('/rest/v1/rpc/antiguidade_salvar', { metodo: 'POST', corpo: { p_grupos: grupos, p_recalcular_desde: iso } })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (r && r.success) {
          carregar(selecionado);
          if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
          return;
        }
        var mensagem = (r && !r._falha && r.error) || RW.mensagens.geral.falhaServidor;
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: mensagem });
      })
      .catch(function () {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* ---------- busca: realça quem casa e rola até o primeiro (os postos recolhidos se abrem enquanto há busca) ---------- */
  function aplicarBusca(rolar) {
    var primeira = null;
    lista.classList.toggle('antiguidade-lista--buscando', !!termoBusca);
    postos.forEach(function (p) {
      p.atual.forEach(function (cpf) {
        var m = pessoas[cpf].dados;
        var casa = !!termoBusca && RW.busca.casaMilitar(termoBusca, { nome: m.nome, nome_completo: m.nome_completo, cpf: cpf });
        pessoas[cpf].linha.classList.toggle('linha-militar--marcada', casa);
        if (casa && !primeira) primeira = pessoas[cpf].linha;
      });
    });
    if (rolar && primeira) primeira.scrollIntoView({ block: 'center' });
  }

  /* ---------- ligações (uma vez por elemento: a página é remontada a cada visita) ---------- */
  function ligar() {
    if (!lista.dataset.ligado) {
      lista.dataset.ligado = '1';
      lista.addEventListener('click', function (e) {
        var titulo = e.target.closest('.antiguidade-posto-titulo');
        if (titulo) {
          var caixa = titulo.closest('.antiguidade-posto');
          recolher(caixa, !caixa.classList.contains('bloquinho--recolhido'));
          return;
        }
        var linha = e.target.closest('.antiguidade-linha');
        if (!linha) return;
        var cpf = linha.getAttribute('data-cpf');
        var seta = e.target.closest('[data-mover]');
        if (seta) { mover(cpf, seta.getAttribute('data-mover') === 'cima' ? -1 : 1); return; }
        escolher(cpf);
      });
      lista.addEventListener('keydown', function (e) {
        var linha = e.target.closest('.antiguidade-linha');
        if (!linha) return;
        var cpf = linha.getAttribute('data-cpf');
        if ((e.key === 'Enter' || e.key === ' ') && e.target === linha) {
          e.preventDefault();
          escolher(cpf);
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && cpf === selecionado) {
          e.preventDefault();
          mover(cpf, e.key === 'ArrowUp' ? -1 : 1);
        }
      });
    }
    var botaoSalvar = el('#antiguidade-salvar');
    if (botaoSalvar && !botaoSalvar.dataset.ligado) {
      botaoSalvar.dataset.ligado = '1';
      botaoSalvar.addEventListener('click', salvar);
    }
    /* Cancelar: lê de novo a ordem gravada (como em Extrajornada › Voluntários) */
    var botaoCancelar = el('#antiguidade-cancelar');
    if (botaoCancelar && !botaoCancelar.dataset.ligado) {
      botaoCancelar.dataset.ligado = '1';
      botaoCancelar.addEventListener('click', function () { carregar(); });
    }
    var caixa = el('#antiguidade-busca');
    if (caixa && !caixa.dataset.ligado && RW.busca) {
      caixa.dataset.ligado = '1';
      RW.busca.criar({ caixa: caixa, aoBuscar: function (termo) { termoBusca = termo; aplicarBusca(true); } });
    }
  }

  /* a página Usuários chama a cada visita (só para o admin) */
  function iniciar(conteudo) {
    raiz = conteudo;
    lista = el('#antiguidade-lista');
    postos = [];
    pessoas = {};
    recolhidos = {};
    selecionado = null;
    termoBusca = '';
    carregado = false;
    if (lista) ligar();
  }

  /* ao abrir a aba: lê de novo, a não ser que haja alteração ainda não salva */
  function mostrar() {
    if (!lista) return;
    if (!carregado || !mudancas()) carregar();
  }

  /* o navegador avisa ao fechar/recarregar com a ordem alterada e não salva */
  if (RW.guardaSaida && RW.guardaSaida.registrar) {
    RW.guardaSaida.registrar(function () { return !!lista && document.body.contains(lista) && mudancas() > 0; });
  }

  RW.usuariosAntiguidade = { iniciar: iniciar, mostrar: mostrar };
})();
