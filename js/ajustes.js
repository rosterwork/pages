/* ============================================================
   AJUSTES — configurações das unidades (NAVEGACAO §4/§5)
   Só administrador, só no computador. Abas no cabeçalho:
   Distribuição (abre nela; o ritmo da escala é o bloco 1 dela),
   Horário de expediente (um só para a companhia e os pelotões) e
   Feriados (o calendário de cada unidade). Sair da Distribuição ou
   do Horário com edição não salva pergunta antes. Quem não
   administra fica sem as abas e vê na Distribuição "Página só do
   administrador.". Cada aba mora no seu arquivo:
   nova-distribuicao*.js, ajustes-horario.js e ajustes-feriados.js.
   As preferências pessoais (tema) moram no Meu perfil (cabeçalho).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* ---------- abas (Distribuição · Horário de expediente · Feriados) ---------- */
  var abaAtual = null;   // a aba à mostra

  /* o arquivo de cada aba: a Distribuição inicia com a página; Horário e Feriados, ao abrir a aba (ativar) */
  function modulo(nome) {
    return { distribuicao: RosterWork.novaDistribuicao, horario: RosterWork.ajustesHorario, feriados: RosterWork.ajustesFeriados }[nome] || null;
  }

  function mostrarAba(conteudo, nome) {
    abaAtual = nome;
    Array.prototype.forEach.call(conteudo.querySelectorAll('.pagina-corpo > [data-aba-painel]'), function (p) {
      p.classList.toggle('oculto', p.getAttribute('data-aba-painel') !== nome);
    });
    var m = modulo(nome);
    if (m && m.ativar) m.ativar();
  }

  /* saindo de uma aba com edição não salva, ela pergunta: descartando, a aba troca; continuando, volta para ela */
  function trocarAba(conteudo, aba) {
    var nome = aba.getAttribute('data-aba');
    if (nome === abaAtual) return;
    var atual = modulo(abaAtual);
    if (atual && atual.sairDaAba) {
      var anterior = conteudo.querySelector('#ajustes-abas [data-aba="' + abaAtual + '"]');
      atual.sairDaAba(
        function () { mostrarAba(conteudo, nome); },
        function () { if (anterior) anterior.click(); }
      );
      return;
    }
    mostrarAba(conteudo, nome);
  }

  /* ---------- entrada da página ---------- */
  function iniciar(conteudo) {
    var S = RosterWork.sessao;
    var abas = conteudo.querySelector('#ajustes-abas');
    abaAtual = null;
    if (!abas) return Promise.resolve();
    /* administrador (ou programador); quem não é fica sem as abas */
    var admin = !!((S.temPapel && S.temPapel('pelotao')) || (S.ehProgramador && S.ehProgramador()));
    abas.classList.toggle('oculto', !admin);
    if (admin) {
      if (RosterWork.ajustesHorario) RosterWork.ajustesHorario.montar(conteudo);
      if (RosterWork.ajustesFeriados) RosterWork.ajustesFeriados.montar(conteudo);
      if (RosterWork.abas) RosterWork.abas.ligar(abas, function (aba) { trocarAba(conteudo, aba); });
    }
    abaAtual = 'distribuicao';
    return RosterWork.novaDistribuicao ? RosterWork.novaDistribuicao.iniciar() : Promise.resolve();
  }

  window.RosterWork.paginas.ajustes = { iniciar: iniciar };
})();
