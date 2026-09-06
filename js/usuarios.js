(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* filtros do sub-cabeçalho (instâncias de geral-filtro-arvore, criadas no iniciar) */
  var filtroSituacao = null;
  var filtroGraus = null;

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
  var elSubtitulo = null;

  /* nada marcado = todas as situações. "Correção pendente" não é situação do
     militar (ele continua Ativo/Férias/...), então soma às demais em vez de excluir */
  function pessoaPassaSituacao(pessoa) {
    var sel = filtroSituacao ? filtroSituacao.selecionados() : null;
    if (!sel || sel.size === 0) return true;
    if (sel.has('Correção pendente') && pessoa.correcao_pendente) return true;
    return sel.has(pessoa.situacao);
  }

  /* nada marcado = todos os graus */
  function pessoaPassaHierarquia(pessoa) {
    var sel = filtroGraus ? filtroGraus.selecionados() : null;
    if (!sel || sel.size === 0) return true;
    return sel.has(pessoa.grau_nome);
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

  /* RG (8-9 dígitos) -> XX.XXX.XXX-X / XX.XXX.XXX */
  function formatarRg(rg) {
    var d = String(rg || '').replace(/\D/g, '');
    if (d.length === 9) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
    if (d.length === 8) return d.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
    return rg || '';
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
    if (tipo === 'rg') return pessoa.rg ? formatarRg(pessoa.rg) : '-';
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

  /* preenche o selo de situação: Ativo (verde), Férias até DD/MM (âmbar) ou Inativo (neutro) */
  function preencherSituacao(selo, pessoa) {
    if (!selo) return;
    if (pessoa.situacao === 'Inativo') {
      selo.textContent = pessoa.situacao_ate ? 'Inativo desde ' + formatarDataCurta(pessoa.situacao_ate) : 'Inativo';
      selo.classList.add('selo--escuro');
    } else if (pessoa.situacao === 'Férias' || pessoa.situacao === 'Licença' || pessoa.situacao === 'Dispensa') {
      /* afastamentos temporários: mostram até quando (âmbar), como as férias */
      selo.textContent = pessoa.situacao + ' até ' + formatarDataCurta(pessoa.situacao_ate);
      selo.classList.add('selo--alerta');
    } else {
      selo.textContent = 'Ativo';
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

  /* o filtro de situação inclui "Inativos"? */
  function mostrarInativos() {
    var sel = filtroSituacao ? filtroSituacao.selecionados() : null;
    return !!(sel && sel.has('Inativo'));
  }

  /* abre a ficha do militar no painel e realça o card clicado (ver = todos) */
  function abrirFicha(card, pessoa) {
    if (cardSelecionado) cardSelecionado.classList.remove('usuario-item--selecionada');
    cardSelecionado = card;
    card.classList.add('usuario-item--selecionada');
    if (window.RosterWork.usuariosPainel) window.RosterWork.usuariosPainel.abrir(pessoa, limparSelecao);
  }

  /* o painel chama isto ao fechar (X, Esc ou troca de página): tira o realce */
  function limparSelecao() {
    if (cardSelecionado) {
      cardSelecionado.classList.remove('usuario-item--selecionada');
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
    /* quem pediu correção e ainda espera decisão (só o admin decide, só ele vê) */
    var correcao = item.querySelector('.usuario-item-correcao');
    if (correcao) correcao.classList.toggle('oculto', !(pessoa.correcao_pendente && RosterWork.sessao.ehAdmin()));
    if (casa && modoBusca === 'marcar') item.classList.add('usuario-item--marcado');
    item.classList.add('usuario-item--clicavel');
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

  /* monta os cards de pessoa dentro de uma unidade marcada (ativos + inativos quando filtrado) */
  function renderConteudo(container, unidade, pessoas) {
    var tpl = document.getElementById('tpl-usuario-item');
    if (!tpl) return;
    var adicionou = 0;
    var total = pessoas.length;
    ordenarPessoas(pessoas).forEach(function (pessoa) {
      if (!pessoaPassaSituacao(pessoa)) return;
      if (montarCard(container, tpl, pessoa)) adicionou++;
    });
    /* inativos da unidade: só quando o filtro de situação inclui "Inativos" */
    if (mostrarInativos()) {
      var inativos = inativosPorUnidade[unidade.unidade_id] || [];
      total += inativos.length;
      ordenarPessoas(inativos).forEach(function (pessoa) {
        if (montarCard(container, tpl, pessoa)) adicionou++;
      });
    }
    /* a unidade tem militares, mas nenhum passou pelos filtros atuais */
    if (total > 0 && adicionou === 0) {
      var tplVazio = document.getElementById('tpl-usuario-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
    }
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
    if (elSubtitulo) elSubtitulo.textContent = contagemVisivel === 1 ? '1 militar' : contagemVisivel + ' militares';
    contagemVisivel = 0;
  }

  /* o componente da árvore chama isto a cada render (ao fim da passada), com as pessoas visíveis */
  function aoRenderizarGraus(pessoasVisiveis) {
    var arvore = arvoreDeGraus(pessoasVisiveis || []);
    var tem = arvore.length > 0;
    var vazio = document.getElementById('graus-vazio');
    if (vazio) vazio.classList.toggle('oculto', tem);
    var conteudo = document.getElementById('graus-conteudo');
    if (conteudo) conteudo.classList.toggle('oculto', !tem);
    if (tem && filtroGraus) filtroGraus.definir(arvore);
    atualizarSubtitulo();
  }

  /* ---------- abas da página: Efetivo | Correções (só admin) ----------
     Os controles do cabeçalho (Ordem, Exibir) e os filtros só valem para a
     árvore do Efetivo, então somem na aba Correções. */
  function mostrarAba(conteudo, nome) {
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    for (var i = 0; i < paineis.length; i++) {
      paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== nome);
    }
    var soEfetivo = ['#usuarios-filtros', '#dropdown-ordem', '#dropdown-exibir'];
    soEfetivo.forEach(function (seletor) {
      var el = conteudo.querySelector(seletor);
      if (el) el.classList.toggle('oculto', nome !== 'efetivo');
    });
    if (nome === 'aprovacoes') atualizarAprovacoes();
  }

  /* recarrega as duas filas (cadastros + correções) e soma no selo da aba */
  function atualizarAprovacoes() {
    var C = window.RosterWork.usuariosCorrecoes;
    var K = window.RosterWork.usuariosCadastros;
    return Promise.all([
      K ? K.carregar() : 0,
      C ? C.carregar() : 0
    ]).then(function (contagens) {
      var quantos = (contagens[0] || 0) + (contagens[1] || 0);
      var selo = document.getElementById('usuarios-aprovacoes-contagem');
      if (!selo) return;
      selo.textContent = quantos ? String(quantos) : '';
      selo.classList.toggle('oculto', !quantos);
    });
  }

  function ligarAbas(conteudo) {
    var trilho = conteudo.querySelector('#usuarios-abas');
    var abaAprovacoes = conteudo.querySelector('#usuarios-aba-aprovacoes');
    if (abaAprovacoes) abaAprovacoes.classList.toggle('oculto', !RosterWork.sessao.ehAdmin());
    if (window.RosterWork.abas && trilho) {
      window.RosterWork.abas.ligar(trilho, function (aba) {
        mostrarAba(conteudo, aba.getAttribute('data-aba'));
      });
    }
    if (!RosterWork.sessao.ehAdmin()) return;

    /* depois de decidir: refaz as filas, a contagem e os cards (o dado mudou) */
    var aoDecidir = function () {
      atualizarAprovacoes();
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.recarregar();
    };
    if (window.RosterWork.usuariosCorrecoes) window.RosterWork.usuariosCorrecoes.iniciar(conteudo, aoDecidir);
    if (window.RosterWork.usuariosCadastros) window.RosterWork.usuariosCadastros.iniciar(conteudo, aoDecidir);
    atualizarAprovacoes();
  }

  /* a navegação chama iniciar() toda vez que a página de usuários é exibida */
  function iniciar(conteudo) {
    var container = conteudo.querySelector('#arvore-usuarios');
    if (!container || !window.RosterWork.arvoreUnidades || !window.RosterWork.filtroArvore) return;

    elSubtitulo = conteudo.querySelector('.pagina-subtitulo');
    contagemVisivel = 0;
    termoBusca = '';
    modoBusca = 'marcar';

    /* funil indicador (um só): escuro quando graus OU situação tem filtro de fato */
    var funil = conteudo.querySelector('#filtro-funil');
    var reagir = function () {
      var ativo = (filtroGraus && filtroGraus.temFiltro()) || (filtroSituacao && filtroSituacao.temFiltro());
      if (funil) funil.classList.toggle('filtro-funil--ativo', !!ativo);
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
    };

    /* filtro de situação: árvore estática (Ativos/Férias) */
    filtroSituacao = window.RosterWork.filtroArvore.criar({
      arvoreEl: conteudo.querySelector('#situacao-arvore'),
      mestreEl: conteudo.querySelector('#situacao-todos'),
      gatilhoEl: conteudo.querySelector('#situacao-texto'),
      triggerEl: conteudo.querySelector('#situacao-seletor'),
      limparEl: conteudo.querySelector('#situacao-limpar'),
      rotuloVazio: 'Todas as situações',
      plural: 'situações',
      colapsarTudo: true,   /* marcar todas as situações = "Todos" (as individuais desmarcam) */
      onChange: reagir
    });
    /* Ativos/Férias/Licença/Dispensa para todos; Inativos só para administradores
       (é um filtro à parte, vem de fonte separada e não se mistura com o efetivo ativo) */
    var opcoesSituacao = [
      { rotulo: 'Ativos', valor: 'Ativo' },
      { rotulo: 'Férias', valor: 'Férias' },
      { rotulo: 'Licença', valor: 'Licença' },
      { rotulo: 'Dispensa', valor: 'Dispensa' }
    ];
    if (RosterWork.sessao.ehAdmin()) {
      opcoesSituacao.push({ rotulo: 'Correção pendente', valor: 'Correção pendente', separado: true });
      opcoesSituacao.push({ rotulo: 'Inativos', valor: 'Inativo', separado: true });
    }
    filtroSituacao.definir(opcoesSituacao);

    /* carrega os inativos em segundo plano; quando chegam, re-renderiza (só aparecem se filtrados) */
    carregarInativos().then(function () {
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
    });

    /* filtro de graus: árvore dinâmica (montada no aoRenderizar, com as patentes presentes) */
    filtroGraus = window.RosterWork.filtroArvore.criar({
      arvoreEl: conteudo.querySelector('#graus-arvore'),
      mestreEl: conteudo.querySelector('#graus-todos'),
      gatilhoEl: conteudo.querySelector('#graus-texto'),
      triggerEl: conteudo.querySelector('#graus-seletor'),
      limparEl: conteudo.querySelector('#graus-limpar'),
      rotuloVazio: 'Todos os graus',
      plural: 'graus',
      onChange: reagir
    });

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

    /* modal "Novo usuário" — abre pelo botão do cabeçalho da página */
    if (window.RosterWork.novoUsuario) window.RosterWork.novoUsuario.ligar(conteudo);
    /* o botão só aparece para admin (a página Usuários é acessível a todos) */
    var btnNovoUsuario = conteudo.querySelector('#btn-novo-usuario');
    if (btnNovoUsuario) btnNovoUsuario.classList.toggle('oculto', !RosterWork.sessao.ehAdmin());

    ligarAbas(conteudo);

    /* a árvore (componente compartilhado) cuida das unidades e injeta os botões de
       recolher/expandir os títulos; passamos como cada unidade marcada mostra as
       pessoas e recebemos quem está visível (filtro de graus) */
    return window.RosterWork.arvoreUnidades.montar(container, {
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizarGraus
    });
  }

  /* usado após uma readmissão: recarrega os inativos e re-renderiza a árvore */
  function recarregarInativos() {
    return carregarInativos().then(function () {
      if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
    });
  }

  window.RosterWork.paginas.usuarios = { iniciar: iniciar, recarregarInativos: recarregarInativos };
})();
