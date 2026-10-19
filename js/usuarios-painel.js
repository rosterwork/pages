/* ============================================================
   USUÁRIOS — painel lateral com a ficha do militar
   No padrão do painel da Escala: sem Ver/Editar. Título = graduação
   + nome de guerra, com a lotação ao lado; subtítulo = nome
   completo; abas Dados · Carreira. Quem não é admin só lê. O admin
   já abre editando: o lápis de cada bloco abre a correção e, na
   Carreira, a barra do painel traz Promover e Transferir (para o
   inativo, Readmitir ao efetivo); o Dar baixa fica no fim. Cada
   ação abre uma sub-tela no lugar da ficha, com Voltar no topo e
   Cancelar + o botão de aplicar no rodapé; sem sub-tela, o rodapé
   do admin mostra as Alterações na ficha. A ficha vem de
   buscar_ficha_militar; a leitura em usuarios-painel-leitura.js;
   cada sub-tela no seu arquivo (editar, datas, promover,
   transferir, baixa).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var fichaAtual = null;      // ficha carregada (redesenha ao trocar de aba)
  var grausLista = [];        // os graus (o posto de cada data de promoção), carregados com a ficha
  var alteracoes = [];        // o que foi mudado na ficha (rodapé do admin)
  var pessoaAtual = null;     // pessoa do card (CPF, situação)
  var aoFecharPagina = null;  // callback da página (limpa o realce do card)
  var secaoAtual = 'dados';   // aba ativa
  var sub = null;             // a sub-tela aberta: { textoAplicar, perigo, mudancas, podeAplicar, sujo, aplicar }

  function ehAdmin() { return RosterWork.sessao.ehAdmin(); }
  function ehInativo() { return !!(pessoaAtual && pessoaAtual.situacao === 'Inativo'); }

  /* a sub-tela aberta tem algo digitado e não salvo? */
  function rascunho() { return !!(sub && sub.sujo && sub.sujo()); }

  /* ---------- sub-telas ---------- */

  /* troca a ficha por uma sub-tela: o Voltar no topo e Cancelar + o botão de aplicar no rodapé.
     criar(corpo, ctl) desenha o conteúdo e devolve a sub-tela; ctl.aoMudar() atualiza o rodapé,
     ctl.concluir(r, opcoes) fecha a sub-tela depois de gravar */
  function abrirSubtela(moldeVoltar, criar) {
    var corpo = RosterWork.painel.corpo(), rodape = RosterWork.painel.rodape(), barra = RosterWork.painel.subcabecalho();
    if (!corpo || !rodape || !fichaAtual) return;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    resetarModulos();
    if (barra) { barra.textContent = ''; barra.classList.add('oculto'); }
    corpo.textContent = '';
    corpo.scrollTop = 0;
    var voltar = RosterWork.tpl(moldeVoltar);
    if (voltar) { voltar.addEventListener('click', fecharSubtela); corpo.appendChild(voltar); }

    rodape.textContent = '';
    var tpl = document.getElementById('tpl-ficha-sub-acoes');
    if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
    var info = rodape.querySelector('.ficha-rodape-info');
    var aplicar = rodape.querySelector('[data-sub-aplicar]');
    var cancelar = rodape.querySelector('[data-sub-cancelar]');

    var atual = null;
    function atualizarRodape() {
      if (!atual || sub !== atual) return;
      var n = atual.mudancas ? atual.mudancas() : 0;
      if (info) info.textContent = n ? RosterWork.mensagens.escala.alteracoesNaoSalvas(n) : '';
      if (aplicar) aplicar.disabled = !atual.podeAplicar();
    }
    atual = criar(corpo, { aoMudar: atualizarRodape, concluir: concluirSubtela });
    if (!atual) { fecharSubtela(); return; }
    sub = atual;
    if (aplicar) {
      aplicar.textContent = atual.textoAplicar;
      if (atual.perigo) { aplicar.classList.remove('botao--primario'); aplicar.classList.add('botao--perigo'); }
      aplicar.addEventListener('click', function () { if (sub === atual && atual.podeAplicar()) atual.aplicar(aplicar); });
    }
    if (cancelar) cancelar.addEventListener('click', fecharSubtela);
    rodape.classList.remove('oculto');
    atualizarRodape();
  }

  /* Voltar e Cancelar: volta à ficha e o que foi digitado se perde (como na Escala) */
  function fecharSubtela() {
    sub = null;
    mostrarSecao();
  }

  /* gravou: volta à ficha relida e abre o resumo; opcoes.fechar (baixa, readmissão) fecha o painel */
  function concluirSubtela(r, opcoes) {
    sub = null;
    if (opcoes && opcoes.fechar) {
      RosterWork.painel.fechar();
      if (RosterWork.paginas && RosterWork.paginas.usuarios && RosterWork.paginas.usuarios.recarregarInativos) RosterWork.paginas.usuarios.recarregarInativos();
    } else if (pessoaAtual) {
      carregarFicha(pessoaAtual.usuario_id);
    }
    /* o card na lista mostra grau, nome, lotação e o selo: a árvore relê */
    if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
    if (r && r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
  }

  function abrirCorrecao(secao) {
    abrirSubtela(secao === 'pessoais' ? 'tpl-ficha-voltar-dados' : 'tpl-ficha-voltar-carreira', function (corpo, ctl) {
      return RosterWork.usuariosPainelEditar.montarSubtela(corpo, fichaAtual, pessoaAtual, secao, ctl);
    });
  }

  function abrirDatas() {
    abrirSubtela('tpl-ficha-voltar-carreira', function (corpo, ctl) {
      return RosterWork.usuariosPainelDatas.montarSubtela(corpo, fichaAtual, pessoaAtual, grausLista, ctl);
    });
  }

  function abrirAcao(acao) {
    var modulos = {
      promover: function (corpo, ctl) { return RosterWork.usuariosPainelPromover.montarSubtela(corpo, fichaAtual, pessoaAtual, ctl); },
      transferir: function (corpo, ctl) { return RosterWork.usuariosPainelTransferir.montarSubtela(corpo, fichaAtual, pessoaAtual, ctl); },
      baixa: function (corpo, ctl) { return RosterWork.usuariosPainelBaixa.montarBaixa(corpo, fichaAtual, pessoaAtual, ctl); },
      readmitir: function (corpo, ctl) { return RosterWork.usuariosPainelBaixa.montarReadmitir(corpo, fichaAtual, pessoaAtual, ctl); }
    };
    if (modulos[acao]) abrirSubtela('tpl-ficha-voltar-carreira', modulos[acao]);
  }

  /* ---------- a ficha (leitura) ---------- */

  function resetarModulos() {
    ['usuariosPainelEditar', 'usuariosPainelDatas', 'usuariosPainelPromover', 'usuariosPainelTransferir', 'usuariosPainelBaixa', 'usuariosPainelAcesso']
      .forEach(function (nome) { if (RosterWork[nome] && RosterWork[nome].reset) RosterWork[nome].reset(); });
  }

  /* barra do painel: as ações da Carreira (só admin) */
  function montarBarra() {
    var barra = RosterWork.painel.subcabecalho();
    if (!barra) return;
    barra.textContent = '';
    barra.classList.add('oculto');
    if (secaoAtual !== 'carreira' || !ehAdmin()) return;
    var tpl = document.getElementById(ehInativo() ? 'tpl-ficha-acoes-inativo' : 'tpl-ficha-acoes-carreira');
    if (!tpl) return;
    barra.appendChild(tpl.content.cloneNode(true));
    Array.prototype.forEach.call(barra.querySelectorAll('[data-ficha-acao]'), function (b) {
      b.addEventListener('click', function () { abrirAcao(b.getAttribute('data-ficha-acao')); });
    });
    /* com uma transferência marcada, outra só depois de cancelar a marcada */
    var transferir = barra.querySelector('[data-ficha-acao="transferir"]');
    if (transferir && RosterWork.usuariosPainelTransferir) transferir.disabled = RosterWork.usuariosPainelTransferir.temMarcada(fichaAtual);
    barra.classList.remove('oculto');
  }

  /* rodapé do admin, sem sub-tela: as Alterações na ficha (sem nenhuma, não aparece) */
  function montarRodape() {
    var rodape = RosterWork.painel.rodape();
    if (!rodape) return;
    rodape.textContent = '';
    rodape.classList.add('oculto');
    if (!ehAdmin() || !RosterWork.alteracoes) return;
    var bloco = RosterWork.alteracoes.montar('tpl-ficha-alteracoes', alteracoes);
    if (!bloco) return;
    rodape.appendChild(bloco);
    rodape.classList.remove('oculto');
  }

  /* desenha a ficha da aba ativa; o admin ganha os lápis, a barra e o Dar baixa */
  function mostrarSecao() {
    var corpo = RosterWork.painel.corpo();
    if (!corpo || !fichaAtual) return;
    sub = null;
    resetarModulos();
    corpo.textContent = '';
    montarBarra();
    montarRodape();
    var L = RosterWork.usuariosPainelLeitura;
    var admin = ehAdmin(), ativo = !ehInativo();
    if (secaoAtual === 'carreira') {
      if (admin && ativo && RosterWork.usuariosPainelTransferir) {
        RosterWork.usuariosPainelTransferir.montarMarcada(corpo, fichaAtual, { concluir: concluirSubtela });
      }
      L.montarCarreira(corpo, fichaAtual, pessoaAtual, grausLista, (admin && ativo) ? {
        corrigirInstitucionais: function () { abrirCorrecao('institucionais'); },
        corrigirDatas: abrirDatas
      } : null);
      if (admin && ativo) {
        var baixa = RosterWork.tpl('tpl-ficha-baixa-botao');
        if (baixa) {
          baixa.querySelector('button').addEventListener('click', function () { abrirAcao('baixa'); });
          corpo.appendChild(baixa);
        }
      }
    } else {
      L.montarDados(corpo, fichaAtual, admin ? { corrigir: function () { abrirCorrecao('pessoais'); } } : null);
      /* Acesso ao sistema (só admin, militar ativo): link de cadastro ou de nova senha */
      if (RosterWork.usuariosPainelAcesso) RosterWork.usuariosPainelAcesso.montar(corpo, fichaAtual, pessoaAtual);
    }
  }

  /* ---------- descarte do rascunho ---------- */

  function confirmarDescarte(aoConfirmar) {
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RosterWork.mensagens.botoes.descartar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }

  /* Esc/X do painel: com algo digitado numa sub-tela, pergunta antes de descartar */
  function tentarFecharFicha() {
    if (!rascunho() || !RosterWork.confirmar) return false;
    confirmarDescarte(function () { sub = null; RosterWork.painel.fechar(); });
    return true;
  }

  /* abas Dados / Carreira (a troca com rascunho pede para descartar antes, como na Escala) */
  function montarAbas() {
    var linha = RosterWork.painel.linhaAbas();
    var tpl = document.getElementById('tpl-usuarios-painel-secoes');
    if (!linha || !tpl) return;
    linha.appendChild(tpl.content.cloneNode(true));
    linha.classList.remove('oculto');
    var trilho = linha.querySelector('.abas');
    if (!trilho) return;
    trilho.addEventListener('click', function (e) {
      var aba = e.target.closest('.aba');
      if (!aba || aba.classList.contains('aba--ativa') || !rascunho() || !RosterWork.confirmar) return;
      e.preventDefault();
      e.stopPropagation();                        // segura o ouvinte do geral-abas
      confirmarDescarte(function () { sub = null; aba.click(); });
    }, true);                                     // captura: roda antes do geral-abas
    if (RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) {
        secaoAtual = aba.getAttribute('data-secao') || 'dados';
        mostrarSecao();
      });
    }
  }

  /* título (graduação + nome de guerra), a lotação ao lado ("- 2ºPEL") e o nome completo */
  function atualizarTitulo() {
    if (!fichaAtual || !RosterWork.painel.definirTitulos) return;
    var ins = fichaAtual.institucionais || {};
    var p = fichaAtual.pessoais || {};
    var grad = ins.grau_abreviacao || (pessoaAtual && pessoaAtual.grau_abreviacao) || '';
    var guerra = ins.nome_de_guerra || (pessoaAtual && pessoaAtual.nome_de_guerra) || '';
    var unidade = String(ins.lotacao_nome || '').split(' / ').pop();
    RosterWork.painel.definirTitulos((grad + ' ' + guerra).trim(), p.nome_completo || '', unidade ? '- ' + unidade : '');
  }

  /* ---------- carregar ---------- */

  function mostrarErro(corpo) {
    corpo.textContent = '';
    var estado = RosterWork.painel.criarEstado(RosterWork.mensagens.usuarios.falhaFicha);
    if (estado) corpo.appendChild(estado);
  }

  /* as alterações na ficha (só admin; sem elas, o rodapé não aparece) */
  function lerAlteracoes(usuarioId) {
    if (!ehAdmin()) return Promise.resolve([]);
    return RosterWork.apiFetch('/rest/v1/rpc/ficha_alteracoes', { metodo: 'POST', corpo: { p_cpf: usuarioId } })
      .then(function (resp) { return resp.ok ? resp.json() : []; })
      .catch(function () { return []; });
  }

  /* a ficha, os graus e as alterações juntos; a resposta de outra ficha (aberta depois) é ignorada */
  function carregarFicha(usuarioId) {
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    corpo.textContent = '';
    var carregando = RosterWork.painel.criarCarregando();
    if (carregando) corpo.appendChild(carregando);
    var fichaP = RosterWork.apiFetch('/rest/v1/rpc/buscar_ficha_militar', {
      metodo: 'POST',
      corpo: { p_usuario_id: usuarioId }
    }).then(function (resp) { return resp.ok ? resp.json() : null; });
    var grausP = RosterWork.novoUsuarioDados ? RosterWork.novoUsuarioDados.buscarGraus() : Promise.resolve([]);
    Promise.all([fichaP, grausP, lerAlteracoes(usuarioId)])
      .then(function (r) {
        if (!RosterWork.painel.estaAberto() || !pessoaAtual || pessoaAtual.usuario_id !== usuarioId) return;
        var ficha = r[0];
        if (!ficha) { var a = RosterWork.painel.corpo(); if (a) mostrarErro(a); return; }
        fichaAtual = ficha;
        grausLista = r[1] || [];
        alteracoes = Array.isArray(r[2]) ? r[2] : [];
        atualizarTitulo();
        mostrarSecao();
      })
      .catch(function () {
        if (!RosterWork.painel.estaAberto()) return;
        var a = RosterWork.painel.corpo(); if (a) mostrarErro(a);
      });
  }

  /* a gaveta foi fechada: zera o estado e avisa a página (limpa o realce) */
  function aoFecharGaveta() {
    resetarModulos();
    sub = null;
    fichaAtual = null;
    pessoaAtual = null;
    alteracoes = [];
    var cb = aoFecharPagina;
    aoFecharPagina = null;
    if (cb) cb();
  }

  /* abre a gaveta para a pessoa clicada. aoFechar = callback da página */
  function abrir(pessoa, aoFechar) {
    if (!RosterWork.painel || !pessoa) return;
    fichaAtual = null;
    sub = null;
    pessoaAtual = pessoa;
    aoFecharPagina = aoFechar || null;
    secaoAtual = 'dados';
    var grad = pessoa.grau_abreviacao || '';
    var guerra = pessoa.nome_de_guerra || '';
    RosterWork.painel.abrir({
      titulo: (grad + ' ' + guerra).trim(),
      subtitulo: pessoa.nome_completo || '',
      aoFechar: aoFecharGaveta,
      aoTentarFechar: tentarFecharFicha
    });
    montarAbas();
    carregarFicha(pessoa.usuario_id);
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com algo digitado numa sub-tela */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return !!(pessoaAtual && rascunho()); });
  }

  window.RosterWork.usuariosPainel = { abrir: abrir };
})();
