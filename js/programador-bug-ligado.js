/* ============================================================
   PROGRAMADOR — LIGAÇÃO MENSAGEM ↔ BUG
   Os dois lados da ligação entre um recado do Fale conosco e um bug:
   · na mensagem, a seção "Bug ligado" (montarSecao): sem bug, criar
     um bug a partir dela ou ligá-la a um bug ainda a corrigir (Aberto
     ou Em correção); com bug, o bug (abre na aba Bugs) e o desligar.
     Liga e desliga por recado_ligar_bug; a seção é refeita do molde
     a cada vez (programador.js chama de novo depois de reler).
   · no bug, a lista "Mensagens ligadas (N)" (montarMensagens).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function dataCurta(iso) {
    return ((RosterWork.resumo && RosterWork.resumo.formatarQuando) ? RosterWork.resumo.formatarQuando(iso) : '').slice(0, 10);
  }

  /* vaga: onde a seção mora no detalhe da mensagem · opcoes: { irParaAba(nome), aoMudar() } */
  function montarSecao(vaga, rec, opcoes) {
    var bugs = RosterWork.programadorBugs;
    vaga.textContent = '';
    if (!bugs) return;
    var no = RosterWork.tpl('tpl-programador-bug-ligado');
    if (!no) return;
    var temBug = !!rec.bug_id;
    no.querySelector('#programador-det-sem-bug').classList.toggle('oculto', temBug);
    no.querySelector('#programador-det-com-bug').classList.toggle('oculto', !temBug);

    if (temBug) {
      var btnBug = no.querySelector('#programador-det-bug');
      btnBug.querySelector('.programador-bug-ligado-titulo').textContent = rec.bug_titulo || '';
      bugs.pintarSituacao(btnBug.querySelector('.programador-bug-ligado-situacao'), rec.bug_situacao);
      btnBug.addEventListener('click', function () { opcoes.irParaAba('bugs'); bugs.mostrarBug(rec.bug_id); });
      no.querySelector('#programador-det-desligar').addEventListener('click', function () { ligar(rec, null, this, opcoes); });
    } else {
      no.querySelector('#programador-det-criar-bug').addEventListener('click', function () {
        opcoes.irParaAba('bugs');
        bugs.abrirDeRecado(rec);
      });
      /* a lista é montada ao abrir, com os bugs da aba Bugs; se a leitura deles ainda
         não terminou (página recém-aberta), mostra "Carregando…" e preenche ao chegar */
      var gatilho = no.querySelector('#programador-det-ligar');
      gatilho.addEventListener('click', function () {
        mostrarAviso(no.querySelector('#programador-det-ligar-opcoes'), RosterWork.mensagens.programadorBugs.carregando);
        bugs.quandoCarregado().then(function () { preencherOpcoes(no, rec, gatilho, opcoes); });
      });
    }
    vaga.appendChild(no);
  }

  /* uma linha só de aviso na lista (carregando / nenhum bug) */
  function mostrarAviso(lista, texto) {
    lista.textContent = '';
    var item = RosterWork.tpl('tpl-bug-ligar-vazio');
    if (!item) return;
    item.textContent = texto;
    lista.appendChild(item);
  }

  /* os bugs ainda a corrigir, do mais grave ao mais leve */
  function preencherOpcoes(no, rec, gatilho, opcoes) {
    var lista = no.querySelector('#programador-det-ligar-opcoes');
    var abertos = RosterWork.programadorBugs.abertos();
    lista.textContent = '';
    if (!abertos.length) {
      mostrarAviso(lista, RosterWork.mensagens.programadorBugs.nenhumAberto);
      return;
    }
    abertos.forEach(function (bug) {
      var opcao = RosterWork.tpl('tpl-bug-ligar-opcao');
      if (!opcao) return;
      opcao.querySelector('.programador-ligar-opcao-titulo').textContent = bug.titulo;
      RosterWork.programadorBugs.pintarGravidade(opcao.querySelector('.selo'), bug.gravidade);
      opcao.addEventListener('click', function () { ligar(rec, bug.id, gatilho, opcoes); });
      lista.appendChild(opcao);
    });
  }

  /* bugId nulo desliga. Depois relê as duas abas (também na recusa, para a tela alcançar o banco);
     a seção é refeita do molde, então o botão volta inteiro, com ícone */
  function ligar(rec, bugId, botao, opcoes) {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc('recado_ligar_bug', { p_recado_id: rec.id, p_bug_id: bugId }).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (!(r && r.success) && RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.programador.falhaSalvar });
      }
      opcoes.aoMudar();
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      opcoes.aoMudar();
    });
  }

  /* no detalhe do bug: as mensagens ligadas, com a contagem; o clique abre a mensagem */
  function montarMensagens(no, bug, aoAbrirMensagem) {
    var bloco = no.querySelector('.bug-det-mensagens-bloco');
    var lista = no.querySelector('.bug-det-mensagens');
    var mensagens = Array.isArray(bug.mensagens) ? bug.mensagens : [];
    if (!mensagens.length) { bloco.classList.add('oculto'); return; }
    no.querySelector('.bug-det-mensagens-qtd').textContent = '(' + mensagens.length + ')';
    mensagens.forEach(function (m) {
      var linha = RosterWork.tpl('tpl-bug-mensagem');
      if (!linha) return;
      linha.querySelector('.programador-bug-mensagem-autor').textContent = m.autor || '';
      linha.querySelector('.programador-bug-mensagem-assunto').textContent = m.assunto || '';
      linha.querySelector('.programador-bug-mensagem-data').textContent = dataCurta(m.criado_em);
      linha.addEventListener('click', function () { if (aoAbrirMensagem) aoAbrirMensagem(m.id); });
      lista.appendChild(linha);
    });
  }

  window.RosterWork.programadorBugLigado = {
    montarSecao: montarSecao,
    montarMensagens: montarMensagens
  };
})();
