(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* o botão Filtros do sub-cabeçalho (geral-filtros: Graus e Situação), criado no iniciar */
  var filtros = null;

  /* busca do sub-cabeçalho */
  var termoBusca = '';
  var modoBusca = 'marcar';   /* 'marcar' (realça) | 'filtrar' (esconde quem não bate) */
  var debounceBusca = null;

  /* card cuja ficha está aberta no painel (realce do selecionado) */
  var cardSelecionado = null;

  /* inativos por unidade (fonte separada buscar_inativos; só aparecem quando o
     filtro de situação inclui "Inativos") — não misturam com o efetivo ativo */
  var inativosPorUnidade = {};

  /* contagem de cards exibidos na passada atual (para o subtítulo da página) */
  var contagemVisivel = 0;
  var elContagem = null;

  /* a situação do militar passa no filtro ("Todos" = as normais; Inativos e Correção pendente são
     acréscimos). "Correção pendente" não é situação do militar (ele continua Ativo/Férias/...),
     então soma às demais em vez de excluir */
  function pessoaPassaSituacao(pessoa) {
    if (!filtros) return true;
    if (pessoa.correcao_pendente && filtros.passa('situacao', 'Correção pendente')) return true;
    return filtros.passa('situacao', pessoa.situacao);
  }

  /* nada marcado = todos os graus */
  function pessoaPassaHierarquia(pessoa) {
    return !filtros || filtros.passa('graus', pessoa.grau_nome);
  }

  /* tira acentos e caixa para comparar nomes sem diferença de acentuação */

  /* a pessoa casa com a busca? nome de guerra, nome completo, CPF ou RG */
  function pessoaCasaBusca(pessoa) {
    if (!termoBusca) return false;
    var alvo = RosterWork.busca.normalizar(termoBusca);
    if (RosterWork.busca.normalizar(pessoa.nome_de_guerra).indexOf(alvo) !== -1) return true;
    if (RosterWork.busca.normalizar(pessoa.nome_completo).indexOf(alvo) !== -1) return true;
    var digitos = termoBusca.replace(/\D/g, '');
    if (digitos) {
      if (String(pessoa.usuario_id || '').indexOf(digitos) !== -1) return true;
      if (String(pessoa.rg || '').replace(/\D/g, '').indexOf(digitos) !== -1) return true;
    }
    return false;
  }

  /* Oficiais = QOBM/QOEBM; Praças = QPBM */
  function grupoDoQuadro(quadro) {
    return quadro === 'QPBM' ? 'Praças' : 'Oficiais';
  }

  /* formata o CPF (11 dígitos) como XXX.XXX.XXX-XX */
  function formatarCpf(cpf) {
    if (!cpf || cpf.length !== 11) return cpf || '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /* data ISO (AAAA-MM-DD) -> DD/MM */
  function formatarDataCurta(iso) {
    if (!iso) return '';
    var partes = String(iso).slice(0, 10).split('-');
    return partes.length === 3 ? partes[2] + '/' + partes[1] : iso;
  }

  /* celular (10-11 dígitos) -> (XX) XXXXX-XXXX */
  function formatarCelular(cel) {
    var d = String(cel || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return cel || '';
  }

  /* estado do menu "Exibir" (padrões quando o módulo ainda não carregou) */
  function exibir() {
    return (RosterWork.usuariosExibir && RosterWork.usuariosExibir.estado)
      ? RosterWork.usuariosExibir.estado()
      : { identificador: 'cpf', hierarquia: true, nome: 'guerra' };
  }

  /* o identificador escolhido no Exibir (CPF/RG/telefone/email); vazio vira "-" */
  function textoIdentificador(pessoa, tipo) {
    if (tipo === 'rg') return pessoa.rg ? RosterWork.campos.mascararRg(String(pessoa.rg).replace(/\D/g, '')) : '-';
    if (tipo === 'telefone') return pessoa.celular ? formatarCelular(pessoa.celular) : '-';
    if (tipo === 'email') return pessoa.email || '-';
    return formatarCpf(pessoa.usuario_id);
  }

  /* nome completo com o nome de guerra realçado (modo "Completo + guerra") */
  function montarNomeCompleto(el, pessoa) {
    el.textContent = '';
    var completo = pessoa.nome_completo || pessoa.nome_de_guerra || '';
    var guerra = (pessoa.nome_de_guerra || '').toLowerCase();
    var tplG = document.getElementById('tpl-usuario-nome-guerra');
    var partes = completo.split(' ');
    partes.forEach(function (parte, i) {
      if (i > 0) el.appendChild(document.createTextNode(' '));
      if (guerra && parte.toLowerCase() === guerra && tplG) {
        var span = tplG.content.cloneNode(true).firstElementChild;
        span.textContent = parte;
        el.appendChild(span);
      } else {
        el.appendChild(document.createTextNode(parte));
      }
    });
  }

  /* "AAAA-MM-DDTHH:MM:SS" (Brasília) -> "DD/MM HH:MM" */
  function formatarDataHoraCurta(iso) {
    var partes = String(iso || '').slice(0, 16).split('T');
    var d = partes[0].split('-');
    return d.length === 3 ? d[2] + '/' + d[1] + (partes[1] ? ' ' + partes[1] : '') : '';
  }

  /* um selo só por militar, na ordem: Inativo (neutro escuro), afastamento até DD/MM
     (âmbar), e, só para o administrador (o banco manda a conta só para ele), o link de
     cadastro até DD/MM HH:MM (âmbar) ou Sem conta (neutro); senão Ativo (verde) */
  function preencherSituacao(selo, pessoa) {
    if (!selo) return;
    var T = RosterWork.mensagens.usuarios;
    if (pessoa.situacao === 'Inativo') {
      selo.textContent = pessoa.situacao_ate ? T.seloInativoDesde(formatarDataCurta(pessoa.situacao_ate)) : T.seloInativo;
      selo.classList.add('selo--escuro');
    } else if (pessoa.situacao === 'Férias' || pessoa.situacao === 'Licença' || pessoa.situacao === 'Dispensa') {
      selo.textContent = RosterWork.mensagens.geral.afastadoAte(pessoa.situacao, formatarDataCurta(pessoa.situacao_ate));
      selo.classList.add('selo--alerta');
    } else if (pessoa.link_cadastro_ate) {
      selo.textContent = T.seloLinkCadastro(formatarDataHoraCurta(pessoa.link_cadastro_ate));
      selo.classList.add('selo--alerta');
    } else if (pessoa.tem_conta === false) {
      selo.textContent = T.seloSemConta;
    } else {
      selo.textContent = T.seloAtivo;
      selo.classList.add('selo--sucesso');
    }
  }

  /* busca os inativos (RPC própria) e agrupa por lotação; re-renderiza ao concluir */
  function carregarInativos() {
    if (!RosterWork.apiFetch) return Promise.resolve();
    return RosterWork.apiFetch('/rest/v1/rpc/buscar_inativos', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lista) {
        inativosPorUnidade = {};
        (lista || []).forEach(function (p) {
          var u = p.lotacao_atual;
          (inativosPorUnidade[u] = inativosPorUnidade[u] || []).push(p);
        });
      })
      .catch(function () { inativosPorUnidade = {}; });
  }

  /* o filtro de situação inclui "Inativos"? (opção só do administrador de companhia) */
  function mostrarInativos() {
    return !!(filtros && RosterWork.sessao.temPapel('companhia') && filtros.passa('situacao', 'Inativo'));
  }

  /* abre a ficha do militar no painel e realça a linha clicada (ver = todos) */
  function abrirFicha(card, pessoa) {
    if (cardSelecionado) cardSelecionado.classList.remove('linha-militar--selecionada');
    cardSelecionado = card;
    card.classList.add('linha-militar--selecionada');
    if (window.RosterWork.usuariosPainel) window.RosterWork.usuariosPainel.abrir(pessoa, limparSelecao);
  }

  /* o painel chama isto ao fechar (X, Esc ou troca de página): tira o realce */
  function limparSelecao() {
    if (cardSelecionado) {
      cardSelecionado.classList.remove('linha-militar--selecionada');
      cardSelecionado = null;
    }
  }

  /* monta um card de pessoa (aplica hierarquia e busca); devolve true se entrou */
  function montarCard(container, tpl, pessoa) {
    if (!pessoaPassaHierarquia(pessoa)) return false;
    var casa = termoBusca ? pessoaCasaBusca(pessoa) : false;
    if (termoBusca && modoBusca === 'filtrar' && !casa) return false;
    var item = tpl.content.cloneNode(true).firstElementChild;
    var ex = exibir();
    /* hierarquia (grau) on/off */
    var elGrad = item.querySelector('.usuario-item-grad');
    elGrad.textContent = ex.hierarquia ? (pessoa.grau_abreviacao || '') : '';
    elGrad.classList.toggle('oculto', !ex.hierarquia);
    /* nome: só de guerra ou completo (com a guerra realçada) */
    var elNome = item.querySelector('.usuario-item-nome');
    if (ex.nome === 'completo') montarNomeCompleto(elNome, pessoa);
    else elNome.textContent = pessoa.nome_de_guerra || '';
    /* identificador escolhido (CPF/RG/telefone/email) */
    item.querySelector('.usuario-item-cpf').textContent = textoIdentificador(pessoa, ex.identificador);
    preencherSituacao(item.querySelector('.usuario-item-selo'), pessoa);
    /* quem pediu correção e ainda espera decisão (decide o admin de companhia da área; só ele vê) */
    var correcao = item.querySelector('.usuario-item-correcao');
    if (correcao) correcao.classList.toggle('oculto', !(pessoa.correcao_pendente && RosterWork.sessao.podeAdministrar('companhia', pessoa.lotacao_atual)));
    if (casa && modoBusca === 'marcar') item.classList.add('linha-militar--marcada');
    item.classList.add('linha-militar--clicavel');
    item.addEventListener('click', function () { abrirFicha(item, pessoa); });
    container.appendChild(item);
    contagemVisivel++;
    return true;
  }

  /* chave alfabética conforme o Exibir (nome de guerra ou completo) */
  function chaveAlfabetica(pessoa) {
    var ex = RosterWork.usuariosExibir ? RosterWork.usuariosExibir.estado() : { nome: 'guerra' };
    var base = ex.nome === 'completo'
      ? (pessoa.nome_completo || pessoa.nome_de_guerra || '')
      : (pessoa.nome_de_guerra || pessoa.nome_completo || '');
    return RosterWork.busca.normalizar(base);
  }

  /* ordena a lista conforme o botão de Ordem: antiguidade (a lista já vem
     ordenada do banco, do mais antigo para o mais moderno), o inverso dela,
     ou alfabética pelo nome exibido nos dois sentidos */
  function ordenarPessoas(pessoas) {
    var ex = RosterWork.usuariosExibir ? RosterWork.usuariosExibir.estado() : { ordem: 'antiguidade' };
    if (ex.ordem === 'antiguidade') return pessoas;
    var copia = pessoas.slice();
    if (ex.ordem === 'antiguidade-inversa') return copia.reverse();
    copia.sort(function (a, b) { return chaveAlfabetica(a).localeCompare(chaveAlfabetica(b), 'pt'); });
    if (ex.ordem === 'za') copia.reverse();
    return copia;
  }

  /* monta as linhas de pessoa num bloquinho branco do bloco da unidade (ativos + inativos quando filtrado);
     unidade sem ninguém fica só com o título */
  function renderConteudo(container, unidade, pessoas) {
    var tpl = document.getElementById('tpl-usuario-item');
    var bloquinho = RosterWork.tpl('tpl-arvore-bloquinho');
    if (!tpl || !bloquinho) return;
    var adicionou = 0;
    var total = pessoas.length;
    ordenarPessoas(pessoas).forEach(function (pessoa) {
      if (!pessoaPassaSituacao(pessoa)) return;
      if (montarCard(bloquinho, tpl, pessoa)) adicionou++;
    });
    /* inativos da unidade: só quando o filtro de situação inclui "Inativos" */
    if (mostrarInativos()) {
      var inativos = inativosPorUnidade[unidade.unidade_id] || [];
      total += inativos.length;
      ordenarPessoas(inativos).forEach(function (pessoa) {
        if (montarCard(bloquinho, tpl, pessoa)) adicionou++;
      });
    }
    /* a unidade tem militares, mas nenhum passou pelos filtros atuais */
    if (total > 0 && adicionou === 0) {
      var tplVazio = document.getElementById('tpl-usuario-vazio');
      if (tplVazio) bloquinho.appendChild(tplVazio.content.cloneNode(true));
    }
    if (total > 0) container.appendChild(bloquinho);
  }

  /* liga a busca: botão de modo (marcar↔filtrar), o input (com debounce) e o limpar */
  function ligarBusca(conteudo) {
    var caixa = conteudo.querySelector('#busca-usuarios');
    var entrada = conteudo.querySelector('#busca-entrada');
    var botaoModo = conteudo.querySelector('#busca-modo');
    var iconeMarcar = conteudo.querySelector('.busca-modo-marcar');
    var iconeFiltrar = conteudo.querySelector('.busca-modo-filtrar');
    var limpar = conteudo.querySelector('#busca-limpar');
    if (!entrada) return;

    if (botaoModo) {
      botaoModo.addEventListener('click', function () {
        modoBusca = (modoBusca === 'marcar') ? 'filtrar' : 'marcar';
        if (iconeMarcar) iconeMarcar.classList.toggle('oculto', modoBusca !== 'marcar');
        if (iconeFiltrar) iconeFiltrar.classList.toggle('oculto', modoBusca !== 'filtrar');
        botaoModo.setAttribute('data-dica', modoBusca === 'marcar' ? 'Marcar' : 'Filtrar');
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
      });
    }

    entrada.addEventListener('input', function () {
      var valor = entrada.value.trim();
      if (caixa) caixa.classList.toggle('busca--com-texto', valor !== '');
      clearTimeout(debounceBusca);
      debounceBusca = setTimeout(function () {
        termoBusca = valor;
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
      }, 250);
    });

    if (limpar) {
      limpar.addEventListener('click', function () {
        entrada.value = '';
        termoBusca = '';
        if (caixa) caixa.classList.remove('busca--com-texto');
        entrada.focus();
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
      });
    }
  }

  /* monta a árvore de graus (Oficiais/Praças > patentes) das pessoas visíveis,
     na ordem de antiguidade (a lista já vem ordenada); só patentes presentes */
  function arvoreDeGraus(pessoas) {
    var mapa = { 'Oficiais': [], 'Praças': [] };
    var vistos = {};
    pessoas.forEach(function (p) {
      var valor = p.grau_nome;
      if (!valor || vistos[valor]) return;
      vistos[valor] = true;
      /* na tela mostramos a abreviação; o filtro casa pelo nome por extenso */
      mapa[grupoDoQuadro(p.quadro)].push({ rotulo: p.grau_abreviacao || valor, valor: valor });
    });
    var arvore = [];
    ['Oficiais', 'Praças'].forEach(function (g) {
      if (mapa[g].length) arvore.push({ rotulo: g, filhos: mapa[g] });
    });
    return arvore;
  }

  /* escreve a contagem no subtítulo da página e zera o acumulador para a próxima passada */
  function atualizarSubtitulo() {
    if (elContagem) elContagem.textContent = contagemVisivel === 1 ? '1 militar' : contagemVisivel + ' militares';
    contagemVisivel = 0;
  }

  /* o componente da árvore chama isto a cada render (ao fim da passada), com as pessoas visíveis */
  function aoRenderizarGraus(pessoasVisiveis) {
    if (filtros) filtros.definir('graus', arvoreDeGraus(pessoasVisiveis || []));
    atualizarSubtitulo();
  }

  /* ---------- abas da página: Efetivo | Pendências (só admin) ----------
     Os controles da barra (filtros, Ordem, Exibir) só valem para a árvore do
     Efetivo, então somem na aba Pendências. A Pendências é a fila das
     correções de dados (geral-fila), a mesma da página Pendências. */
  var fila = null;

  function escreverSeloPendencias(n) {
    var s = document.getElementById('usuarios-pendencias-contagem');
    if (!s) return;
    s.textContent = n ? String(n) : '';
    s.classList.toggle('oculto', !n);
  }

  function carregarPendencias() {
    if (!fila || !window.RosterWork.fila) return Promise.resolve();
    return window.RosterWork.fila.ler().then(function (r) {
      if (!r) return;
      var pedidos = window.RosterWork.fila.doTipo(r.aprovar, ['dados']);
      fila.definir(pedidos);
      escreverSeloPendencias(pedidos.length);
    });
  }

  function mostrarAba(conteudo, nome) {
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    for (var i = 0; i < paineis.length; i++) {
      paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== nome);
    }
    ['#busca-usuarios', '#usuarios-divisor', '#dropdown-ordem', '#dropdown-exibir'].forEach(function (seletor) {
      var el = conteudo.querySelector(seletor);
      if (el) el.classList.toggle('oculto', nome !== 'efetivo');
    });
    if (filtros) filtros.mostrar(nome === 'efetivo');   /* o botão Filtros e a linha "Filtros:" */
    /* a Antiguidade tem a própria busca (o Salvar dela fica no rodapé da aba) */
    var buscaAntiguidade = conteudo.querySelector('#antiguidade-busca');
    if (buscaAntiguidade) buscaAntiguidade.classList.toggle('oculto', nome !== 'antiguidade');
    if (nome === 'pendencias') carregarPendencias();
    if (nome === 'antiguidade' && window.RosterWork.usuariosAntiguidade) window.RosterWork.usuariosAntiguidade.mostrar();
  }

  function ligarAbas(conteudo) {
    var admin = RosterWork.sessao.temPapel('companhia');   // Antiguidade e Pendências são do admin de companhia
    var trilho = conteudo.querySelector('#usuarios-abas');
    var abaPendencias = conteudo.querySelector('#usuarios-aba-pendencias');
    if (abaPendencias) abaPendencias.classList.toggle('oculto', !admin);
    var abaAntiguidade = conteudo.querySelector('#usuarios-aba-antiguidade');
    if (abaAntiguidade) abaAntiguidade.classList.toggle('oculto', !admin);
    if (admin && window.RosterWork.usuariosAntiguidade) window.RosterWork.usuariosAntiguidade.iniciar(conteudo);
    if (window.RosterWork.abas && trilho) {
      window.RosterWork.abas.ligar(trilho, function (aba) {
        mostrarAba(conteudo, aba.getAttribute('data-aba'));
      });
    }
    fila = (admin && window.RosterWork.fila) ? window.RosterWork.fila.criar(conteudo.querySelector('#usuarios-pendencias'), {
      vazio: RosterWork.mensagens.pendencias.vazioUsuarios,
      /* depois de decidir: a fila e os cards do efetivo (o dado mudou) */
      recarregar: function () {
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.recarregar();
        return carregarPendencias();
      }
    }) : null;
    if (fila) window.RosterWork.fila.contar().then(function (c) { escreverSeloPendencias(c.aprovar.dados || 0); });
  }

  /* a navegação chama iniciar() toda vez que a página de usuários é exibida */
  function iniciar(conteudo) {
    var container = conteudo.querySelector('#arvore-usuarios');
    if (!container || !window.RosterWork.arvoreUnidades || !window.RosterWork.filtros) return;

    elContagem = conteudo.querySelector('.pagina-titulo-contagem');
    contagemVisivel = 0;
    termoBusca = '';
    modoBusca = 'marcar';

    /* o botão Filtros (Graus e Situação): cada mudança re-renderiza a árvore */
    filtros = window.RosterWork.filtros.criar(conteudo.querySelector('#usuarios-filtros'), {
      aoMudar: function () { if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar(); }
    });
    /* Situação: Ativos/Férias/Licença/Dispensa para todos; Correção pendente e Inativos só para
       administradores, à parte (acréscimos; os inativos vêm de fonte separada) */
    var opcoesSituacao = [
      { rotulo: 'Ativos', valor: 'Ativo' },
      { rotulo: 'Férias', valor: 'Férias' },
      { rotulo: 'Licença', valor: 'Licença' },
      { rotulo: 'Dispensa', valor: 'Dispensa' }
    ];
    if (RosterWork.sessao.temPapel('companhia')) {
      opcoesSituacao.push({ rotulo: 'Correção pendente', valor: 'Correção pendente', separado: true });
      opcoesSituacao.push({ rotulo: 'Inativos', valor: 'Inativo', separado: true });
    }
    if (filtros) filtros.definir('situacao', opcoesSituacao);

    /* carrega os inativos em segundo plano; quando chegam, re-renderiza (só aparecem se filtrados) */
    carregarInativos().then(function () {
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
    });

    /* Graus: montado no aoRenderizarGraus, com as patentes de quem aparece */

    ligarBusca(conteudo);

    /* botões do cabeçalho: "Exibir" (identificador / nome / hierarquia) e "Ordem" —
       os dois re-renderizam os cards ao mudar */
    if (window.RosterWork.usuariosExibir) {
      var repintar = function () {
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
      };
      window.RosterWork.usuariosExibir.ligar(conteudo, repintar);
      window.RosterWork.usuariosExibir.ligarOrdem(conteudo, repintar);
    }

    /* "Novo usuário" — abre pelo botão do grupo Administração da barra */
    if (window.RosterWork.novoUsuario) window.RosterWork.novoUsuario.ligar(conteudo);
    /* o grupo só aparece para o admin de companhia, em todas as abas (a página Usuários é acessível a todos) */
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !RosterWork.sessao.temPapel('companhia'));

    ligarAbas(conteudo);

    /* veio de um aviso que aponta um militar (ex.: pedido de nova senha): a ficha dele abre
       quando a página termina de montar (se ainda for esta a página na tela) */
    var cpfPedido = window.RosterWork.referenciaPedida ? window.RosterWork.referenciaPedida('usuarios') : null;

    /* a árvore (componente compartilhado) cuida das unidades e injeta os botões de
       recolher/expandir os títulos; passamos como cada unidade marcada mostra as
       pessoas e recebemos quem está visível (filtro de graus) */
    var pronto = window.RosterWork.arvoreUnidades.montar(container, {
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizarGraus
    });
    if (cpfPedido && /^\d{11}$/.test(cpfPedido) && window.RosterWork.usuariosPainel) {
      Promise.resolve(pronto).then(function () {
        if (document.body.contains(container)) window.RosterWork.usuariosPainel.abrir({ usuario_id: cpfPedido }, limparSelecao);
      });
    }
    return pronto;
  }

  /* usado após uma readmissão: recarrega os inativos e re-renderiza a árvore */
  function recarregarInativos() {
    return carregarInativos().then(function () {
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
    });
  }

  window.RosterWork.paginas.usuarios = { iniciar: iniciar, recarregarInativos: recarregarInativos };
})();
