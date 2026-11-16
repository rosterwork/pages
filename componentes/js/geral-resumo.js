/* ============================================================
   RESUMO — desenha o histórico de alterações (formato padrão)
   RosterWork.resumo.desenhar(dados, opcoes) -> nó com o resumo
     (aceita o "log" inteiro do banco ou só o "resumo"); opcoes:
     { titulo (cabeçalho do modal), mostrarAssunto, mostrarQuando }.
     O "assunto" vem de resumo.titulo (o que foi alterado); as linhas
     "Escala do 1ºPEL refeita a partir de..." vêm de resumo.escalas_refeitas
     ([{ unidade, desde }], o que o recálculo refez ao salvar).
   RosterWork.resumo.abrirModal(log, { pagina, desfazer? }) -> abre o
     modal de confirmação (#veu-resumo) com o título de sucesso; se
     "desfazer" (função que reverte e devolve Promise) vier, mostra o
     texto "Desfazer" (última chance de reverter a ação recém-aplicada).
     Com mais de MAX_ABERTAS mudanças, elas ficam fechadas atrás do
     "Ver detalhes (N)". No modo treino, não abre.
   Peça reutilizável: o modal ao salvar (Postos) e a página
   de Histórico. O "quando" vem do banco (criado_em).
   Moldes #tpl-resumo / -alvo / -mudanca e #veu-resumo no shell.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, alvoConteudo, btnOk, btnDesfazer, btnDetalhes;
  var desfazerAtual = null;   /* ação de reversão do modal aberto (ou null) */
  var desfazendo = false;
  var corpoAtual = null;      /* lista das mudanças do modal aberto (abre e fecha no "Ver detalhes") */
  var totalAtual = 0;         /* quantas mudanças o modal aberto tem */
  var MAX_ABERTAS = 4;        /* até aqui as mudanças aparecem direto, sem o botão */


  function txtBotao(chave) { var b = RosterWork.mensagens && RosterWork.mensagens.botoes; return (b && b[chave]) || ''; }
  function msgGeral(chave) { var g = RosterWork.mensagens && RosterWork.mensagens.geral; return (g && g[chave]) || ''; }
  function avisarErro(msg) { if (RosterWork.avisar && msg) RosterWork.avisar({ tipo: 'erro', mensagem: msg }); }

  /* clique em "Desfazer": roda a reversão passada pelo chamador; fecha ao concluir */
  function executarDesfazer() {
    if (!desfazerAtual || desfazendo) return;
    desfazendo = true;
    if (btnDesfazer) btnDesfazer.textContent = txtBotao('desfazendo');
    Promise.resolve(desfazerAtual()).then(function (r) {
      desfazendo = false;
      if (!r || r.ok === false) {
        if (btnDesfazer) btnDesfazer.textContent = txtBotao('desfazer');
        avisarErro((r && r.erro) || msgGeral('falhaServidor'));
        return;
      }
      if (RosterWork.fecharModais) RosterWork.fecharModais();
    }).catch(function () {
      desfazendo = false;
      if (btnDesfazer) btnDesfazer.textContent = txtBotao('desfazer');
      avisarErro(msgGeral('semConexao'));
    });
  }

  /* criado_em (ISO do banco) -> "DD/MM/AAAA às HH:MM" no fuso do usuário */
  function formatarQuando(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p2(n) { return ('0' + n).slice(-2); }
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() +
           ' às ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  /* uma linha de mudança, conforme o tipo (alteracao/troca/adicao/remocao) */
  function montarMudanca(mudanca) {
    var linha = RosterWork.tpl('tpl-resumo-mudanca');
    if (!linha) return null;
    var tipo = mudanca.tipo || 'alteracao';
    linha.classList.add('resumo-mudanca--' + tipo);

    var rotulo = linha.querySelector('.resumo-mudanca-rotulo');
    if (mudanca.rotulo) rotulo.textContent = mudanca.rotulo;
    else rotulo.classList.add('oculto');

    var conDe = linha.querySelector('.resumo-conector--de');
    var conPara = linha.querySelector('.resumo-conector--para');
    var de = linha.querySelector('.resumo-de');
    var para = linha.querySelector('.resumo-para');
    if (tipo === 'adicao') {
      conDe.classList.add('oculto');
      de.classList.add('oculto');
      conPara.classList.add('oculto');
      para.textContent = mudanca.para != null ? String(mudanca.para) : '';
    } else if (tipo === 'remocao') {
      conDe.classList.add('oculto');
      conPara.classList.add('oculto');
      para.classList.add('oculto');
      de.textContent = mudanca.de != null ? String(mudanca.de) : '';
    } else {
      de.textContent = mudanca.de != null ? String(mudanca.de) : '';
      para.textContent = mudanca.para != null ? String(mudanca.para) : '';
    }
    return linha;
  }

  /* desenha o resumo padrão e devolve o nó (reutilizável) */
  function desenhar(dados, opcoes) {
    opcoes = opcoes || {};
    var log = dados || {};
    var resumo = log.resumo || log;   // aceita o log inteiro ou só o resumo
    var raiz = RosterWork.tpl('tpl-resumo');
    if (!raiz) return null;

    var titulo = raiz.querySelector('.resumo-titulo');
    if (opcoes.titulo) titulo.textContent = opcoes.titulo;
    else titulo.classList.add('oculto');

    var quando = raiz.querySelector('.resumo-quando');
    var texto = opcoes.mostrarQuando === false ? '' : formatarQuando(log.criado_em);
    if (texto) quando.textContent = texto;
    else quando.classList.add('oculto');

    /* sem título e sem data: esconde o cabeçalho inteiro (ex.: na lista de histórico) */
    if (!opcoes.titulo && !texto) raiz.querySelector('.resumo-cabecalho').classList.add('oculto');

    /* assunto = o que foi alterado (resumo.titulo); no histórico o cartão já tem o título → mostrarAssunto:false */
    var assunto = raiz.querySelector('.resumo-assunto');
    var textoAssunto = opcoes.mostrarAssunto === false ? '' : (resumo.titulo || '');
    if (assunto) {
      if (textoAssunto) assunto.textContent = textoAssunto;
      else assunto.classList.add('oculto');
    }

    /* uma linha por unidade cuja escala o salvar refez */
    var refeitas = raiz.querySelector('.resumo-refeitas');
    var escrever = RosterWork.mensagens && RosterWork.mensagens.geral && RosterWork.mensagens.geral.escalaRefeita;
    var paraBR = RosterWork.data && RosterWork.data.isoParaBR;
    if (refeitas && escrever && paraBR) {
      (resumo.escalas_refeitas || []).forEach(function (r) {
        var linha = RosterWork.tpl('tpl-resumo-refeita');
        if (!linha || !r || !r.unidade || !r.desde) return;
        linha.textContent = escrever(r.unidade, paraBR(r.desde));
        refeitas.appendChild(linha);
      });
      if (refeitas.children.length) refeitas.classList.remove('oculto');
    }

    var corpo = raiz.querySelector('.resumo-corpo');
    (resumo.alvos || []).forEach(function (alvo) {
      var bloco = RosterWork.tpl('tpl-resumo-alvo');
      if (!bloco) return;
      bloco.querySelector('.rotulo-secao').textContent = alvo.onde || '';
      var lista = bloco.querySelector('.resumo-mudancas');
      (alvo.mudancas || []).forEach(function (mudanca) {
        var linha = montarMudanca(mudanca);
        if (linha) lista.appendChild(linha);
      });
      corpo.appendChild(bloco);
    });
    return raiz;
  }

  /* quantas mudanças o resumo tem (somando as de todos os alvos) */
  function contarMudancas(log) {
    var resumo = (log && (log.resumo || log)) || {};
    return (resumo.alvos || []).reduce(function (soma, alvo) {
      return soma + ((alvo && alvo.mudancas) || []).length;
    }, 0);
  }

  /* abre ou fecha a lista das mudanças do modal aberto; o texto do botão acompanha */
  function mostrarDetalhes(abertos) {
    if (!corpoAtual || !btnDetalhes) return;
    var b = (RosterWork.mensagens && RosterWork.mensagens.botoes) || {};
    corpoAtual.classList.toggle('oculto', !abertos);
    btnDetalhes.setAttribute('aria-expanded', abertos ? 'true' : 'false');
    btnDetalhes.textContent = abertos ? (b.esconderDetalhes || '') : (b.verDetalhes ? b.verDetalhes(totalAtual) : '');
  }

  /* liga o véu uma única vez (o OK fecha o modal) */
  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-resumo');
    if (!veu) return false;
    alvoConteudo = veu.querySelector('#resumo-conteudo');
    btnOk = veu.querySelector('.resumo-ok');
    btnDesfazer = veu.querySelector('.resumo-desfazer');
    btnDetalhes = veu.querySelector('.resumo-detalhes');
    if (btnOk) btnOk.addEventListener('click', function () {
      if (RosterWork.fecharModais) RosterWork.fecharModais();
    });
    if (btnDesfazer) btnDesfazer.addEventListener('click', executarDesfazer);
    if (btnDetalhes) btnDetalhes.addEventListener('click', function () {
      mostrarDetalhes(btnDetalhes.getAttribute('aria-expanded') !== 'true');
    });
    return true;
  }

  /* abre o modal de confirmação com o log retornado pelo banco */
  function abrirModal(log, opcoes) {
    /* no treino, nada foi gravado: com o passo a passo, o balão diz como terminou; no treino livre, o título diz e não há
       o que desfazer */
    var noLivre = !!RosterWork.treino && RosterWork.treino.livre();
    if (RosterWork.treino && RosterWork.treino.ligado() && !noLivre) return;
    if (!preparar() || !alvoConteudo) return;
    opcoes = opcoes || {};
    /* uma ação acabou de ser gravada: o que estava esperando decisão pode ter
       acabado, então o sino relê na hora (o resumo abre em toda escrita) */
    if (RosterWork.avisosSino) RosterWork.avisosSino.recarregar();
    alvoConteudo.textContent = '';
    /* o título segue a ação do log: exclusão não é "alterações salvas" */
    var G = (RosterWork.mensagens && RosterWork.mensagens.geral) || {};
    var modelo = (log && log.acao === 'exclusao') ? G.exclusaoConcluida : G.alteracoesSalvas;
    var titulo = noLivre ? RosterWork.mensagens.treino.resumoTitulo : (modelo || '').replace('{pagina}', opcoes.pagina || '');
    var no = desenhar(log, { titulo: titulo, mostrarQuando: true });
    if (no) alvoConteudo.appendChild(no);
    /* muitas mudanças: a lista começa fechada atrás do "Ver detalhes (N)"; poucas aparecem direto */
    corpoAtual = no ? no.querySelector('.resumo-corpo') : null;
    totalAtual = contarMudancas(log);
    var comBotao = !!corpoAtual && totalAtual > MAX_ABERTAS;
    if (btnDetalhes) btnDetalhes.classList.toggle('oculto', !comBotao);
    if (comBotao) mostrarDetalhes(false);
    /* "Desfazer": só aparece quando o chamador passa a ação de reverter */
    desfazendo = false;
    desfazerAtual = (!noLivre && typeof opcoes.desfazer === 'function') ? opcoes.desfazer : null;
    if (btnDesfazer) {
      btnDesfazer.textContent = txtBotao('desfazer');
      btnDesfazer.classList.toggle('oculto', !desfazerAtual);
    }
    /* o foco entra onde entrava antes do "Ver detalhes" existir: no Desfazer, se houver, senão no OK */
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-resumo', desfazerAtual ? btnDesfazer : btnOk);
  }

  window.RosterWork.resumo = { desenhar: desenhar, abrirModal: abrirModal, formatarQuando: formatarQuando };
})();
