/* ============================================================
   RESUMO — desenha o histórico de alterações (formato padrão)
   RosterWork.resumo.desenhar(dados, opcoes) -> nó com o resumo
     (aceita o "log" inteiro do banco ou só o "resumo"); opcoes:
     { titulo (cabeçalho do modal), mostrarAssunto, mostrarQuando }.
     O "assunto" vem de resumo.titulo (o que foi alterado).
   RosterWork.resumo.abrirModal(log, { pagina, desfazer? }) -> abre o
     modal de confirmação (#veu-resumo) com o título de sucesso; se
     "desfazer" (função que reverte e devolve Promise) vier, mostra o
     texto "Desfazer" (última chance de reverter a ação recém-aplicada).
   Peça reutilizável: o modal ao salvar (Postos) agora e a página
   de Histórico depois. O "quando" vem do banco (criado_em).
   Moldes #tpl-resumo / -alvo / -mudanca e #veu-resumo no shell.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, alvoConteudo, btnOk, btnDesfazer;
  var desfazerAtual = null;   /* ação de reversão do modal aberto (ou null) */
  var desfazendo = false;


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

  /* liga o véu uma única vez (o OK fecha o modal) */
  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-resumo');
    if (!veu) return false;
    alvoConteudo = veu.querySelector('#resumo-conteudo');
    btnOk = veu.querySelector('.resumo-ok');
    btnDesfazer = veu.querySelector('.resumo-desfazer');
    if (btnOk) btnOk.addEventListener('click', function () {
      if (RosterWork.fecharModais) RosterWork.fecharModais();
    });
    if (btnDesfazer) btnDesfazer.addEventListener('click', executarDesfazer);
    return true;
  }

  /* abre o modal de confirmação com o log retornado pelo banco */
  function abrirModal(log, opcoes) {
    if (!preparar() || !alvoConteudo) return;
    opcoes = opcoes || {};
    /* uma ação acabou de ser gravada: o que estava esperando decisão pode ter
       acabado, então o sino relê na hora (o resumo abre em toda escrita) */
    if (RosterWork.avisosSino) RosterWork.avisosSino.recarregar();
    if (RosterWork.escalaBadge) RosterWork.escalaBadge.recarregar();
    alvoConteudo.textContent = '';
    /* o título segue a ação do log: exclusão não é "alterações salvas" */
    var G = (RosterWork.mensagens && RosterWork.mensagens.geral) || {};
    var modelo = (log && log.acao === 'exclusao') ? G.exclusaoConcluida : G.alteracoesSalvas;
    var titulo = (modelo || '').replace('{pagina}', opcoes.pagina || '');
    var no = desenhar(log, { titulo: titulo, mostrarQuando: true });
    if (no) alvoConteudo.appendChild(no);
    /* "Desfazer": só aparece quando o chamador passa a ação de reverter */
    desfazendo = false;
    desfazerAtual = (typeof opcoes.desfazer === 'function') ? opcoes.desfazer : null;
    if (btnDesfazer) {
      btnDesfazer.textContent = txtBotao('desfazer');
      btnDesfazer.classList.toggle('oculto', !desfazerAtual);
    }
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-resumo');
  }

  window.RosterWork.resumo = { desenhar: desenhar, abrirModal: abrirModal, formatarQuando: formatarQuando };
})();
