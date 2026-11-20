(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* o botão Filtros do sub-cabeçalho (geral-filtros: Graus e Situação), criado no iniciar */
  var filtros = null;

  /* busca do sub-cabeçalho */
  var termoBusca = '';
  var modoBusca = 'marcar';   /* 'marcar' (realça) | 'filtrar' (esconde quem não bate) */

  /* card cuja ficha está aberta no painel (realce do selecionado) e o militar dele: a lista refeita pela busca ou
     pelos filtros marca de novo o card desse militar */
  var cardSelecionado = null;
  var cpfAberto = null;

  /* inativos por unidade (fonte separada buscar_inativos; só aparecem quando o
     filtro de situação inclui "Inativos") — não misturam com o efetivo ativo */
  var inativosPorUnidade = {};

  /* contagem de cards exibidos na passada atual (para o subtítulo da página) */
  var contagemVisivel = 0;
  var elContagem = null;

  /* a situação do militar passa no filtro ("Todos" = Ativos e Afastados; Incluir inativos é acréscimo, ver
     mostrarInativos). Todo afastamento é "Afastado" */
  function pessoaPassaSituacao(pessoa) {
    if (!filtros) return true;
    var afastado = ['Férias', 'Licença', 'Dispensa', 'Missão'].indexOf(pessoa.situacao) >= 0;
    return filtros.passa('situacao', afastado ? 'Afastado' : pessoa.situacao);
  }

  /* nada marcado = todos os graus */
  function pessoaPassaHierarquia(pessoa) {
    return !filtros || filtros.passa('graus', pessoa.grau_nome);
  }

  /* o cadastro: com correção de dados pendente ou em dia (o filtro é só do administrador; nada marcado = todos) */
  function pessoaPassaCadastro(pessoa) {
    return !filtros || filtros.passa('cadastro', pessoa.correcao_pendente ? 'pendente' : 'em_dia');
  }

  /* a pessoa casa com a busca? nome de guerra, nome completo, CPF ou RG (a regra é a mesma dos Afastamentos,
     usuarios-exibir.js) */
  function pessoaCasaBusca(pessoa) {
    return RosterWork.usuariosExibir.casaBusca(pessoa, termoBusca);
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

  /* um selo só por militar, na ordem: Inativo (neutro escuro), o afastamento até DD/MM, com o nome dele
     (âmbar), e, só para o administrador (o banco manda a conta só para ele), o link de
     cadastro até DD/MM HH:MM (âmbar) ou Sem conta (neutro); senão Ativo (verde) */
  function preencherSituacao(selo, pessoa) {
    if (!selo) return;
    var T = RosterWork.mensagens.usuarios;
    if (pessoa.situacao === 'Inativo') {
      selo.textContent = pessoa.situacao_ate ? T.seloInativoDesde(formatarDataCurta(pessoa.situacao_ate)) : T.seloInativo;
      selo.classList.add('selo--escuro');
    } else if (['Férias', 'Licença', 'Dispensa', 'Missão'].indexOf(pessoa.situacao) >= 0) {
      /* o nome do afastamento ("Op. Verão até 21/11") */
      selo.textContent = RosterWork.mensagens.geral.afastadoAte(pessoa.situacao_nome || pessoa.situacao, formatarDataCurta(pessoa.situacao_ate));
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

  /* o Incluir inativos está marcado? (opção só do administrador) */
  function mostrarInativos() {
    return !!(filtros && RosterWork.sessao.temPapel('pelotao') && filtros.passa('situacao', 'Inativo'));
  }

  /* abre a ficha do militar no painel e realça a linha clicada (ver = todos); opcoes = { secao } (a ficha que volta do
     painel de decisão reabre na aba em que estava) */
  function abrirFicha(card, pessoa, opcoes) {
    if (cardSelecionado) cardSelecionado.classList.remove('linha-militar--selecionada');
    cardSelecionado = card;
    cpfAberto = String(pessoa.usuario_id);
    if (card) card.classList.add('linha-militar--selecionada');
    if (window.RosterWork.usuariosPainel) window.RosterWork.usuariosPainel.abrir(pessoa, limparSelecao, opcoes);
    /* a busca e os filtros podem tirar o militar da lista: a ficha dele fecha (geral-painel) */
    if (window.RosterWork.painel) window.RosterWork.painel.acompanharTela(cardNaTela);
  }

  /* a ficha volta a abrir sem o clique na linha (depois do painel de decisão da correção): a lista relida marca a linha */
  function reabrirFicha(pessoa, opcoes) {
    cpfAberto = String(pessoa.usuario_id);
    if (window.RosterWork.usuariosPainel) window.RosterWork.usuariosPainel.abrir(pessoa, limparSelecao, opcoes);
    if (window.RosterWork.painel) window.RosterWork.painel.acompanharTela(cardNaTela);
    if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.recarregar();
  }

  /* o card da ficha aberta ainda está na lista? */
  function cardNaTela() {
    return !!cardSelecionado && cardSelecionado.isConnected && cardSelecionado.getClientRects().length > 0;
  }

  /* a lista refeita (busca, filtros): o card do militar da ficha aberta volta a ficar marcado */
  function marcarSeAberto(card, pessoa) {
    if (cpfAberto === null || String(pessoa.usuario_id) !== cpfAberto) return;
    card.classList.add('linha-militar--selecionada');
    cardSelecionado = card;
  }

  /* a aba Administradores desenha a lista dela (usuarios-administradores.js) */
  function administradores() {
    var m = window.RosterWork.usuariosAdministradores;
    return m && m.ativa() ? m : null;
  }

  /* o painel chama isto ao fechar (X, Esc ou troca de página): tira o realce */
  function limparSelecao() {
    if (cardSelecionado) {
      cardSelecionado.classList.remove('linha-militar--selecionada');
      cardSelecionado = null;
    }
    cpfAberto = null;
  }

  /* monta um card de pessoa (aplica hierarquia, cadastro e busca); devolve true se entrou */
  function montarCard(container, tpl, pessoa) {
    if (!pessoaPassaHierarquia(pessoa) || !pessoaPassaCadastro(pessoa)) return false;
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
    /* quem pediu correção e ainda espera decisão (decide quem administra o militar; só ele vê) */
    var correcao = item.querySelector('.usuario-item-correcao');
    if (correcao) correcao.classList.toggle('oculto', !(pessoa.correcao_pendente && RosterWork.sessao.podeAdministrar('pelotao', pessoa.lotacao_atual)));
    if (casa && modoBusca === 'marcar') item.classList.add('linha-militar--marcada');
    if (casa) item.classList.add('busca-achado');   // o que o Enter da busca percorre (geral-busca.js)
    item.classList.add('linha-militar--clicavel');
    item.addEventListener('click', function () { abrirFicha(item, pessoa); });
    marcarSeAberto(item, pessoa);
    container.appendChild(item);
    contagemVisivel++;
    return true;
  }

  /* ordena a lista conforme o botão de Ordem (a regra é a mesma dos Afastamentos, usuarios-exibir.js) */
  function ordenarPessoas(pessoas) {
    return RosterWork.usuariosExibir.ordenar(pessoas);
  }

  /* monta as linhas de pessoa num bloquinho branco do bloco da unidade (ativos + inativos quando filtrado);
     unidade sem ninguém fica só com o título */
  function renderConteudo(container, unidade, pessoas) {
    if (administradores()) { administradores().renderConteudo(container, unidade, pessoas); return; }
    var tpl = document.getElementById('tpl-usuario-item');
    var bloquinho = RosterWork.tpl('tpl-arvore-bloquinho');
    if (!tpl || !bloquinho) return;
    var adicionou = 0;
    var total = pessoas.length;
    ordenarPessoas(pessoas).forEach(function (pessoa) {
      if (!pessoaPassaSituacao(pessoa)) return;
      if (montarCard(bloquinho, tpl, pessoa)) adicionou++;
    });
    /* inativos da unidade: só com o Incluir inativos marcado */
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

  /* liga a busca pelo componente geral (modo marcar↔filtrar, espera da digitação, limpar e Enter) */
  function ligarBusca(conteudo) {
    var caixa = conteudo.querySelector('#busca-usuarios');
    if (!caixa || !window.RosterWork.busca) return;
    window.RosterWork.busca.criar({
      caixa: caixa,
      aoBuscar: function (termo, modo) {
        termoBusca = termo;
        modoBusca = modo;
        if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar();
      }
    });
  }

  /* a árvore de graus do filtro (a regra é a mesma dos Afastamentos, usuarios-exibir.js) */
  function arvoreDeGraus(pessoas) {
    return RosterWork.usuariosExibir.arvoreDeGraus(pessoas);
  }

  /* escreve a contagem no subtítulo da página e zera o acumulador para a próxima passada */
  function atualizarSubtitulo() {
    if (elContagem) elContagem.textContent = contagemVisivel === 1 ? '1 militar' : contagemVisivel + ' militares';
    contagemVisivel = 0;
  }

  /* o componente da árvore chama isto a cada render (ao fim da passada), com as pessoas visíveis */
  function aoRenderizarGraus(pessoasVisiveis) {
    if (administradores()) administradores().aoRenderizar(pessoasVisiveis);
    else if (filtros) filtros.definir('graus', arvoreDeGraus(pessoasVisiveis || []));
    atualizarSubtitulo();
  }

  /* a contagem de cada unidade: os militares */
  function textoContagem(itens) {
    return itens.length === 1 ? '1 militar' : itens.length + ' militares';
  }

  /* o que a aba Administradores usa daqui: a árvore, a busca, a ordem, os graus e a contagem */
  var emprestado = {
    atualizar: function () { if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar(); },
    /* 'marcar' (casa, no marcar) · 'casa' (casa, no filtrar) · 'esconder' (não casa, no filtrar) · '' (sem busca ou não casa, no marcar) */
    busca: function (pessoa) {
      if (!termoBusca) return '';
      if (pessoaCasaBusca(pessoa)) return modoBusca === 'marcar' ? 'marcar' : 'casa';
      return modoBusca === 'filtrar' ? 'esconder' : '';
    },
    ordenar: function (pessoas) { return ordenarPessoas(pessoas); },
    arvoreDeGraus: function (pessoas) { return arvoreDeGraus(pessoas); },
    contar: function () { contagemVisivel++; }
  };

  /* ---------- abas da página: Efetivo | Antiguidade · Administradores (só admin) ----------
     A busca e a Ordem valem para as listas (Efetivo e Administradores, que usam a mesma árvore);
     os Filtros e o Exibir do Efetivo, só para ele. O Efetivo abre a ficha no painel; a Antiguidade e
     a Administradores editam na própria lista. */
  function mostrarAba(conteudo, nome) {
    /* a Administradores usa a árvore do Efetivo, com a busca e a Ordem; o Exibir é só do Efetivo */
    var lista = ['efetivo', 'administradores'].indexOf(nome) >= 0;
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    for (var i = 0; i < paineis.length; i++) {
      paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== (lista ? 'efetivo' : nome));
    }
    ['#busca-usuarios', '#usuarios-divisor', '#dropdown-ordem'].forEach(function (seletor) {
      var el = conteudo.querySelector(seletor);
      if (el) el.classList.toggle('oculto', !lista);
    });
    var exibirEl = conteudo.querySelector('#dropdown-exibir');
    if (exibirEl) exibirEl.classList.toggle('oculto', nome !== 'efetivo');
    if (filtros) filtros.mostrar(nome === 'efetivo');   /* o botão Filtros e a linha "Filtros:" */
    /* o Novo usuário fica só no Efetivo: o cadastro abre no painel */
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', nome !== 'efetivo' || !RosterWork.sessao.temPapel('pelotao'));
    /* a aba Administradores: os Filtros e o rodapé dela */
    if (window.RosterWork.usuariosAdministradores) window.RosterWork.usuariosAdministradores.mostrar(nome);
    if (nome === 'efetivo' || nome === 'administradores') emprestado.atualizar();
    /* a Antiguidade tem a própria busca (o Salvar dela fica no rodapé da aba) */
    var buscaAntiguidade = conteudo.querySelector('#antiguidade-busca');
    if (buscaAntiguidade) buscaAntiguidade.classList.toggle('oculto', nome !== 'antiguidade');
    if (nome === 'antiguidade' && window.RosterWork.usuariosAntiguidade) window.RosterWork.usuariosAntiguidade.mostrar();
  }

  function ligarAbas(conteudo) {
    var admin = RosterWork.sessao.temPapel('pelotao');   // Antiguidade e Administradores: qualquer administrador
    var trilho = conteudo.querySelector('#usuarios-abas');
    var abaAntiguidade = conteudo.querySelector('#usuarios-aba-antiguidade');
    if (abaAntiguidade) abaAntiguidade.classList.toggle('oculto', !admin);
    if (admin && window.RosterWork.usuariosAntiguidade) window.RosterWork.usuariosAntiguidade.iniciar(conteudo);
    var abaAdministradores = conteudo.querySelector('#usuarios-aba-administradores');
    if (abaAdministradores) abaAdministradores.classList.toggle('oculto', !admin);
    if (admin && window.RosterWork.usuariosAdministradores) window.RosterWork.usuariosAdministradores.iniciar(conteudo, emprestado);
    if (window.RosterWork.abas && trilho) {
      window.RosterWork.abas.ligar(trilho, function (aba) {
        mostrarAba(conteudo, aba.getAttribute('data-aba'));
      });
    }
  }

  /* a navegação chama iniciar() toda vez que a página de usuários é exibida */
  function iniciar(conteudo) {
    var container = conteudo.querySelector('#arvore-usuarios');
    if (!container || !window.RosterWork.arvoreUnidades || !window.RosterWork.filtros) return;

    elContagem = conteudo.querySelector('.pagina-titulo-contagem');
    contagemVisivel = 0;
    termoBusca = '';
    modoBusca = 'marcar';

    /* o botão Filtros (Graus, Situação e Cadastro): cada mudança re-renderiza a árvore; a escolha fica na sessão */
    filtros = window.RosterWork.filtros.criar(conteudo.querySelector('#usuarios-filtros'), {
      aoMudar: function () { if (window.RosterWork.arvoreUnidades) window.RosterWork.arvoreUnidades.atualizar(); },
      guardar: 'usuarios'
    });
    /* Situação: Ativos e Afastados para todos; Incluir inativos só para administradores, à parte (acréscimo; os
       inativos vêm de fonte separada). Cadastro só para administradores (sem opção, a coluna não aparece) */
    var admin = RosterWork.sessao.temPapel('pelotao');
    var opcoesSituacao = [
      { rotulo: 'Ativos', valor: 'Ativo' },
      { rotulo: 'Afastados', valor: 'Afastado' }
    ];
    if (admin) opcoesSituacao.push({ rotulo: 'Incluir inativos', valor: 'Inativo', separado: true });
    if (filtros) {
      filtros.definir('situacao', opcoesSituacao);
      filtros.definir('cadastro', admin ? [{ rotulo: 'Em dia', valor: 'em_dia' }, { rotulo: 'Correção pendente', valor: 'pendente' }] : []);
    }

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
    /* o grupo só aparece para o admin, no Efetivo, a aba em que a página abre (a página Usuários é acessível a todos) */
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !RosterWork.sessao.temPapel('pelotao'));

    ligarAbas(conteudo);

    /* veio de um aviso que aponta um militar (ex.: pedido de nova senha): a ficha dele abre
       quando a página termina de montar (se ainda for esta a página na tela) */
    var cpfPedido = window.RosterWork.referenciaPedida ? window.RosterWork.referenciaPedida('usuarios') : null;

    /* a árvore (componente compartilhado) cuida das unidades e injeta os botões de
       recolher/expandir os títulos; passamos como cada unidade marcada mostra as
       pessoas e recebemos quem está visível (filtro de graus) */
    var pronto = window.RosterWork.arvoreUnidades.montar(container, {
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizarGraus,
      textoContagem: textoContagem,
      etapas: 'usuariosAbrir'
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

  window.RosterWork.paginas.usuarios = { iniciar: iniciar, recarregarInativos: recarregarInativos, reabrirFicha: reabrirFicha };
})();
