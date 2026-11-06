/* ============================================================
   USUÁRIOS — aba Administradores (RosterWork.usuariosAdministradores)
   A lista completa do efetivo (a mesma árvore do Efetivo) com o papel
   de cada militar e onde ele vale; quem não tem papel fica em branco.
   Clicar no militar que se pode mudar troca a linha por uma caixa: a
   própria linha no alto, com o X, e embaixo o Papel (só as opções que
   o banco devolve para ele) e a nota do que o papel faz. A escolha
   fica no rascunho, a lista já mostra o resultado e só o Salvar do
   rodapé largo grava (administradores_salvar, tudo ou nada), abrindo
   o resumo. O usuarios.js empresta a árvore, a busca, a ordem, os
   graus e a contagem do título (ctx); aqui fica só o que é desta aba.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ctx = null;            // o que o usuarios.js empresta: { atualizar, busca, ordenar, arvoreDeGraus, contar }
  var raiz = null;           // o conteúdo da página Usuários
  var ativa = false;         // esta é a aba à vista
  var filtros = null;
  var dados = {};            // cpf -> { papel, rotulo, vale_para, pode_definir, opcoes }
  var lidoTexto = null;      // a última resposta do banco, para não redesenhar à toa
  var rascunho = {};         // cpf -> papel escolhido e ainda não salvo
  var aberta = null;         // a caixa aberta: { linha, caixa }
  var token = 0;             // latest-wins: a resposta de uma leitura antiga é ignorada

  function el(seletor) { return raiz ? raiz.querySelector(seletor) : null; }

  /* ---------- o papel de cada militar ---------- */
  function papelGravado(cpf) { return (dados[cpf] && dados[cpf].papel) || 'nenhum'; }

  function papelAtual(cpf) {
    return Object.prototype.hasOwnProperty.call(rascunho, cpf) ? rascunho[cpf] : papelGravado(cpf);
  }

  /* o rótulo e onde vale, do papel gravado ou, no rascunho, da opção escolhida */
  function textoDoPapel(cpf) {
    var papel = papelAtual(cpf);
    if (papel === 'nenhum') return { rotulo: '', vale: '' };
    var d = dados[cpf] || {};
    if (papel === d.papel) return { rotulo: d.rotulo || '', vale: d.vale_para || '' };
    var op = (d.opcoes || []).filter(function (o) { return o.papel === papel; })[0];
    return { rotulo: op ? op.rotulo : '', vale: op ? (op.vale_para || '') : '' };
  }

  function pintarLinha(linha, cpf) {
    var texto = textoDoPapel(cpf);
    linha.querySelector('[data-papel-texto]').textContent = texto.rotulo;
    linha.querySelector('[data-vale]').textContent = texto.vale;
  }

  /* ---------- o rodapé largo: aparece só com alteração e só nesta aba ---------- */
  function mudancas() { return Object.keys(rascunho).length; }

  function atualizarRodape() {
    var n = mudancas();
    var texto = el('#administradores-mudancas');
    if (texto) texto.textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    var rodape = el('#administradores-rodape');
    if (rodape) rodape.classList.toggle('oculto', !n || !ativa);
  }

  /* ---------- a caixa no lugar da linha ---------- */
  function fechar(devolverFoco) {
    if (!aberta) return;
    var atual = aberta;
    aberta = null;
    /* a lista pode ter sido redesenhada com a caixa aberta (busca, filtros): aí não há o que devolver */
    if (!atual.caixa.isConnected) return;
    atual.caixa.replaceWith(atual.linha);
    if (devolverFoco) atual.linha.focus({ preventScroll: true });
  }

  /* a nota do papel escolhido (Nenhum não tem nota) */
  function pintarNota(nota, papel) {
    var temNota = false;
    Array.prototype.forEach.call(nota.querySelectorAll('[data-nota-papel]'), function (texto) {
      var mostra = texto.getAttribute('data-nota-papel') === papel;
      texto.classList.toggle('oculto', !mostra);
      if (mostra) temNota = true;
    });
    nota.classList.toggle('oculto', !temNota);
  }

  function escolher(linha, nota, cpf, papel) {
    if (papel === papelGravado(cpf)) delete rascunho[cpf];
    else rascunho[cpf] = papel;
    pintarLinha(linha, cpf);
    pintarNota(nota, papel);
    atualizarRodape();
  }

  function abrir(linha, cpf) {
    var mesma = aberta && aberta.linha === linha;
    fechar(mesma);
    if (mesma) return;
    var caixa = RW.tpl('tpl-administradores-caixa');
    var nota = RW.tpl('tpl-administradores-nota');
    if (!caixa || !nota) return;
    caixa.querySelector('.usuarios-caixa-corpo').appendChild(nota);

    /* só as opções que quem está logado pode dar a este militar; a atual já marcada */
    var opcoes = (dados[cpf].opcoes || []).map(function (o) { return o.papel; });
    var papel = papelAtual(cpf);
    var seletor = caixa.querySelector('.abas--seletor');
    Array.prototype.forEach.call(seletor.querySelectorAll('[data-papel]'), function (aba) {
      var valor = aba.getAttribute('data-papel');
      if (opcoes.indexOf(valor) < 0) aba.remove();
      else aba.classList.toggle('aba--ativa', valor === papel);
    });
    RW.abas.ligar(seletor, function (aba) { escolher(linha, nota, cpf, aba.getAttribute('data-papel')); });
    pintarNota(nota, papel);
    caixa.querySelector('.usuarios-caixa-fechar').addEventListener('click', function () { fechar(true); });

    linha.replaceWith(caixa);
    caixa.querySelector('.usuarios-caixa-topo').prepend(linha);
    linha.focus({ preventScroll: true });
    aberta = { linha: linha, caixa: caixa };
  }

  /* ---------- a lista ---------- */
  function passa(pessoa) {
    if (!filtros) return true;
    if (!filtros.passa('graus', pessoa.grau_nome)) return false;
    return filtros.passa('papel', papelAtual(pessoa.usuario_id) === 'nenhum' ? 'sem' : 'com');
  }

  function montarLinha(pessoa, busca) {
    var cpf = pessoa.usuario_id;
    var linha = RW.tpl('tpl-administradores-linha');
    if (!linha) return null;
    linha.querySelector('[data-grad]').textContent = pessoa.grau_abreviacao || '';
    linha.querySelector('[data-guerra]').textContent = pessoa.nome_de_guerra || '';
    pintarLinha(linha, cpf);
    if (busca === 'marcar') linha.classList.add('linha-militar--marcada');
    if (busca === 'marcar' || busca === 'casa') linha.classList.add('busca-achado');   // o que o Enter da busca percorre (geral-busca.js)
    /* só quem se pode mudar abre a caixa: fora da área, acima do nível e a própria linha ficam só para ler */
    if (dados[cpf] && dados[cpf].pode_definir) {
      linha.classList.add('linha-militar--clicavel');
      linha.setAttribute('role', 'button');
      linha.setAttribute('tabindex', '0');
      linha.addEventListener('click', function () { abrir(linha, cpf); });   // Enter e Espaço: geral-teclado.js
    }
    return linha;
  }

  function renderConteudo(container, unidade, pessoas) {
    var bloquinho = RW.tpl('tpl-arvore-bloquinho');
    if (!bloquinho) return;
    var adicionou = 0;
    ctx.ordenar(pessoas).forEach(function (pessoa) {
      if (!passa(pessoa)) return;
      var busca = ctx.busca(pessoa);
      if (busca === 'esconder') return;
      var linha = montarLinha(pessoa, busca);
      if (!linha) return;
      bloquinho.appendChild(linha);
      ctx.contar();
      adicionou++;
    });
    /* a unidade tem militares, mas nenhum passou pelos filtros atuais */
    if (pessoas.length && !adicionou) {
      var vazio = RW.tpl('tpl-usuario-vazio');
      if (vazio) bloquinho.appendChild(vazio);
    }
    if (pessoas.length) container.appendChild(bloquinho);
  }

  function aoRenderizar(pessoas) {
    if (filtros && ctx) filtros.definir('graus', ctx.arvoreDeGraus(pessoas || []));
  }

  /* ---------- ler e gravar ---------- */

  /* lê os papéis; os nomes já estão na tela, e a lista só redesenha se a resposta mudou */
  function carregar() {
    var meu = ++token;
    return RW.apiFetch('/rest/v1/rpc/administradores_listar', { metodo: 'POST', corpo: {} })
      .then(function (resp) { return resp.ok ? resp.text() : null; })
      .then(function (texto) {
        if (meu !== token) return;
        if (texto == null) {
          if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaCarregar });
          return;
        }
        if (texto === lidoTexto) return;
        lidoTexto = texto;
        dados = {};
        (JSON.parse(texto) || []).forEach(function (d) { dados[d.cpf] = d; });
        if (ativa) ctx.atualizar();
      })
      .catch(function () {
        if (meu !== token) return;
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function salvar() {
    var botao = el('#administradores-salvar');
    var lista = Object.keys(rascunho).map(function (cpf) { return { cpf: cpf, papel: rascunho[cpf] }; });
    if (!lista.length) return;
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function parar() { if (RW.pararCarregando) RW.pararCarregando(botao); }
    RW.apiFetch('/rest/v1/rpc/administradores_salvar', { metodo: 'POST', corpo: { p_mudancas: lista } })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        parar();
        if (r && r.success) {
          rascunho = {};
          fechar(false);
          atualizarRodape();
          if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
          carregar();
          return;
        }
        var mensagem = (r && !r._falha && r.error) || RW.mensagens.geral.falhaServidor;
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: mensagem });
      })
      .catch(function () {
        parar();
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function cancelar() {
    rascunho = {};
    fechar(false);
    atualizarRodape();
    ctx.atualizar();
  }

  /* ---------- a página ---------- */

  /* a página trocou de aba: nesta, os Filtros e o rodapé aparecem e os papéis são lidos de novo; o rascunho fica
     guardado até voltar (quem redesenha a lista é o usuarios.js) */
  function mostrar(nome) {
    ativa = nome === 'administradores';
    fechar(false);
    if (filtros) filtros.mostrar(ativa);
    atualizarRodape();
    if (ativa) carregar();
    else token++;
  }

  /* a navegação abriu a página (só para o administrador): os Filtros desta aba e o rodapé */
  function iniciar(conteudo, emprestado) {
    raiz = conteudo;
    ctx = emprestado;
    ativa = false;
    dados = {};
    lidoTexto = null;
    rascunho = {};
    aberta = null;
    token++;
    var caixa = el('#administradores-filtros');
    filtros = (caixa && RW.filtros) ? RW.filtros.criar(caixa, {
      aoMudar: function () { if (ativa) { fechar(false); ctx.atualizar(); } }
    }) : null;
    if (filtros) {
      filtros.definir('papel', [{ rotulo: 'Administradores', valor: 'com' }, { rotulo: 'Sem administração', valor: 'sem' }]);
      filtros.mostrar(false);
    }
    var botaoSalvar = el('#administradores-salvar');
    if (botaoSalvar && !botaoSalvar.dataset.ligado) {
      botaoSalvar.dataset.ligado = '1';
      botaoSalvar.addEventListener('click', salvar);
    }
    var botaoCancelar = el('#administradores-cancelar');
    if (botaoCancelar && !botaoCancelar.dataset.ligado) {
      botaoCancelar.dataset.ligado = '1';
      botaoCancelar.addEventListener('click', cancelar);
    }
  }

  /* o navegador avisa ao fechar/recarregar/sair com papel escolhido e não salvo */
  if (RW.guardaSaida && RW.guardaSaida.registrar) {
    RW.guardaSaida.registrar(function () {
      var rodape = el('#administradores-rodape');
      return !!rodape && document.body.contains(rodape) && mudancas() > 0;
    });
  }

  RW.usuariosAdministradores = {
    iniciar: iniciar, mostrar: mostrar, ativa: function () { return ativa; },
    renderConteudo: renderConteudo, aoRenderizar: aoRenderizar
  };
})();
