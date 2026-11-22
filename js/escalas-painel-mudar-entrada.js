/* ============================================================
   ESCALAS — o Mudar e o Cancelar a entrada na guarnição (o menu do
   militar no primeiro serviço: o lápis da aba Funções do painel e a
   caixa da célula da grade; só admin)
   Valem para quem estava fora da escala antes da entrada (a chave
   primeiro_servico da leitura do dia: { cpf, entrada, desde, ate }).
   - Mudar a entrada na guarnição: a pergunta Quando entra embaixo da
     linha (na célula, na caixa 2), o campo de data padrão já com a
     entrada de agora, de digitar ou escolher no calendário, com
     acesos os dias de desde até ate (qualquer guarnição). A data diz
     a guarnição: quando ela muda, a nota cinza "Entra na guarnição C."
     A data nova vai para o rascunho das guarnições
     (escalas-painel-ciclo.js: mudar_entrada, com a entrada de agora)
     e, embaixo, o que acontece com as trocas e folgas dele quando
     alguma sai (as extras ficam). O Cancelar volta ao que era.
   - Cancelar a entrada na guarnição: na hora, no rascunho (o tirar na
     data da entrada, que desfaz a entrada inteira), com o Desfazer.
   Nada grava até o Salvar do rodapé largo. A pergunta aberta é a do
   rascunho das guarnições (abrirPergunta): o fechar, o voltar e o X
   da caixa da célula são os dele.
   RosterWork.escalasPainelMudarEntrada: primeiro(cpf), perguntar(m, linha, opcoes), cancelar(m)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function C() { return RW.escalasPainelCiclo; }
  function ed() { return RW.escalasPainelEditar.sub; }
  function L() { return RW.mensagens.escala.linha; }
  function D() { return RW.data; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function utc(iso) { var p = iso.split('-'); return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function dias(de, ate) { return Math.round((utc(ate) - utc(de)) / 86400000); }

  /* a entrada de quem faz neste dia o primeiro serviço depois de estar fora da escala ({ entrada, desde, ate }); nula sem
     ela e no dia de mais de 7 dias atrás */
  function primeiro(cpf) {
    var api = ed(), dd = api.dados() || {};
    if (!C() || api.iso() < C().limite()) return null;
    return (dd.primeiro_servico || []).filter(function (x) { return x.cpf === cpf; })[0] || null;
  }

  /* o Mudar a entrada de quem faz neste dia o primeiro serviço (m; linha = a linha dele na aba Funções). Na caixa
     flutuante da célula: opcoes = { dentro (a caixa 2, no lugar da linha), aoCancelar() } */
  function perguntar(m, linha, opcoes) {
    opcoes = opcoes || {};
    if (RW.escalasPainelRemover) RW.escalasPainelRemover.fecharPergunta('guardar');
    C().fecharPergunta('guardar');
    var el = RW.tpl('tpl-escala-mudar-entrada');
    var api = ed(), dd = api.dados() || {}, uid = api.unidadeId(), iso = api.iso(), cpf = m.cpf, pri = primeiro(cpf);
    if (!el || !pri || !(linha || opcoes.dentro)) return;
    var letra = dd.guarnicao || '', n = dd.intervalo || 1;
    var p = { el: el, pedido: 0, passos: 0, cpf: cpf, antes: C().marcado(uid, iso, cpf) };
    var est = { entra: pri.entrada };
    var q = function (s) { return el.querySelector(s); };
    var campo = q('.escala-mudar-entrada-data'), nota = q('.escala-mudar-entrada-guarnicao');
    var ver = C().efeito(q('.escala-mudar-entrada-efeito'));

    /* a guarnição de um dia, contada da do dia aberto (sem a letra do dia, nenhuma) */
    function letraDe(dia) { return letra ? String.fromCharCode(65 + (((letra.charCodeAt(0) - 65 + dias(iso, dia)) % n) + n) % n) : ''; }
    /* o dia pode ser a entrada: de desde até ate */
    function vale(dia) { return dia >= pri.desde && (!pri.ate || dia <= pri.ate); }

    /* o campo de data (a máscara e o calendário, com os dias que podem acesos), já com a entrada de agora */
    campo.value = D().isoParaBR(pri.entrada);
    RW.campos.ligarMascara(campo, RW.campos.mascararData);
    campo.addEventListener('input', lerCampo);
    RW.calendario.ligar(campo, {
      ancora: q('.pergunta-linha'),
      obterData: function () { return est.entra ? D().paraData(D().isoParaBR(est.entra)) : null; },
      permiteDia: function (d) { return vale(D().paraIsoDeData(d)); },
      aoEscolher: function (d) { campo.value = D().paraBR(d); lerCampo(); }
    });
    function lerCampo() {
      var completo = campo.value.length === 10, dia = completo ? D().paraISO(campo.value) : null;
      est.entra = dia && vale(dia) ? dia : null;
      if (completo && !est.entra) RW.campos.marcarErro(campo, L().mudarEntradaDiaErrado);
      else RW.campos.limparErro(campo);
      aplicar();
    }

    /* a data nova vai para o rascunho e, quando alguma troca ou folga sai, a lista do que acontece aparece; a entrada de
       agora (ou a data pela metade) volta o rascunho ao que era. As trocas e folgas que saem: na mesma guarnição, só as
       dos dias até a véspera da entrada nova (para antes, nenhuma); em outra guarnição, as do período inteiro */
    function aplicar() {
      var meu = ++p.pedido, entra = est.entra, nova = entra ? letraDe(entra) : '';
      ver.esconder();
      var outra = !!entra && !!letra && nova !== letra;
      nota.classList.toggle('oculto', !outra);
      nota.querySelector('.nota-texto').textContent = outra ? L().entraNaGuarnicao(nova) : '';
      if (!entra || entra === pri.entrada) { if (p.passos) C().voltarDa(p); return; }
      C().marcarPasso(uid, iso, { cpf: cpf, acao: 'mudar_entrada', tipo: 'mudar_entrada', entrada: pri.entrada, data: entra, itens: [] });
      p.passos++;
      if (!outra && entra < pri.entrada) return;
      C().analisar(uid, cpf, pri.entrada, L().entradaEscalaMudar(nova, diaMes(entra)), outra ? null : entra).then(function (aviso) {
        if (!C().perguntaAberta(p) || meu !== p.pedido) return;
        if (aviso.erro) { RW.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
        if ((aviso.itens || []).length > 1) ver.mostrar(aviso);
        var atual = C().marcado(uid, iso, cpf);
        if (atual && atual.acao === 'mudar_entrada' && atual.data === entra) atual.itens = aviso.itens || [];
      });
    }

    q('.escala-mudar-entrada-cancelar').addEventListener('click', function () {
      C().voltarDa(p);
      C().fecharPergunta('largar');
      if (opcoes.aoCancelar) opcoes.aoCancelar();
    });
    if (opcoes.dentro) opcoes.dentro.appendChild(el);
    else linha.insertAdjacentElement('afterend', el);
    C().abrirPergunta(p);
  }

  /* o Cancelar a entrada: o tirar na data da entrada (o banco desfaz a entrada inteira e a saída dela), na hora, no
     rascunho, com o Desfazer; a lista se refaz sem ele */
  function cancelar(m) {
    var api = ed(), pri = primeiro(m.cpf);
    if (!pri) return;
    C().fecharPergunta('guardar');
    C().marcarPasso(api.unidadeId(), api.iso(), { cpf: m.cpf, acao: 'tirar', tipo: 'cancelar_entrada', data: pri.entrada, itens: [] });
    api.redesenhar();
  }

  window.RosterWork.escalasPainelMudarEntrada = { primeiro: primeiro, perguntar: perguntar, cancelar: cancelar };
})();
