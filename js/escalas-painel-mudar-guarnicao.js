/* ============================================================
   ESCALAS — o Mudar de guarnição (o menu do militar no dia: o lápis
   da aba Funções do painel e a caixa da célula da grade; só admin)
   A pergunta embaixo da linha (na célula, na caixa 2), em duas
   caixas, uma depois da outra:
   - Último serviço na guarnição de agora: os três dias do Remover da
     guarnição (o serviço anterior, este dia e o próximo; a chave
     servicos_vizinhos da leitura do dia);
   - Quando entra (abre com a resposta da primeira; trocar a primeira
     limpa a data): o campo de data padrão, de digitar ou escolher no
     calendário, com acesos só os dias de outra guarnição depois do
     último serviço, a partir do dia seguinte ao dia de serviço em
     curso (o dia vira às 08h). A data diz a guarnição nova (a letra e
     o intervalo da leitura do dia). Embaixo, a folga até a entrada:
     cinza, ou amarela quando é menor que a de sempre (só avisa).
   Com as duas respostas, a mudança vai para o rascunho das guarnições
   (escalas-painel-ciclo.js: adicionar com a letra nova, a data do dia
   seguinte ao último serviço, o ultimo e o entra) e, embaixo, aparece
   o que acontece com as trocas e folgas dele (as extras ficam). O
   Cancelar volta ao que era. Nada grava até o Salvar do rodapé largo.
   A pergunta aberta é a do rascunho das guarnições (abrirPergunta): o
   fechar, o voltar e o X da caixa da célula são os dele.
   RosterWork.escalasPainelMudarGuarnicao: pode(), perguntar(m, linha, opcoes)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada pergunta

  function C() { return RW.escalasPainelCiclo; }
  function ed() { return RW.escalasPainelEditar.sub; }
  function L() { return RW.mensagens.escala.linha; }
  function D() { return RW.data; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function utc(iso) { var p = iso.split('-'); return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function dias(de, ate) { return Math.round((utc(ate) - utc(de)) / 86400000); }
  function somar(iso, n) { var p = iso.split('-'); return D().paraIsoDeData(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n)); }

  /* a unidade tem guarnições para mudar (a letra do dia e mais de uma no ritmo, da leitura do dia)? O resto é o mesmo do
     Remover da guarnição (escalas-painel-linha-menu.js) */
  function pode() {
    var dd = ed().dados() || {};
    return !!dd.guarnicao && (dd.intervalo || 0) > 1;
  }

  /* o Mudar de guarnição de quem está no dia pela guarnição (m; linha = a linha dele na aba Funções). Na caixa flutuante
     da célula: opcoes = { dentro (a caixa 2, no lugar da linha), aoCancelar() } */
  function perguntar(m, linha, opcoes) {
    opcoes = opcoes || {};
    if (RW.escalasPainelRemover) RW.escalasPainelRemover.fecharPergunta('guardar');
    C().fecharPergunta('guardar');
    var el = RW.tpl('tpl-escala-mudar-guarnicao');
    if (!el || !(linha || opcoes.dentro) || !pode()) return;
    var api = ed(), dd = api.dados() || {}, uid = api.unidadeId(), iso = api.iso(), cpf = m.cpf;
    var letra = dd.guarnicao, n = dd.intervalo, horasServico = dd.horas_servico || 24;
    var vizinhos = (dd.servicos_vizinhos || {})[cpf] || {};
    var p = { el: el, pedido: 0, passos: 0, cpf: cpf, antes: C().marcado(uid, iso, cpf) };
    var est = { ultimo: null, entra: null };
    var q = function (s) { return el.querySelector(s); };
    var caixaEntra = q('.escala-mudar-guarnicao-entra'), acoes = q('.pergunta-linha-acoes'), campo = q('.escala-mudar-guarnicao-data');
    var folga = q('.escala-mudar-guarnicao-folga'), folgaMenor = q('.escala-mudar-guarnicao-folga-menor');
    var ver = C().efeito(q('.escala-mudar-guarnicao-efeito'));
    /* o primeiro dia que ainda não começou: o seguinte ao dia de serviço em curso */
    var primeiro = somar(D().paraIsoDeData(D().diaDeServico()), 1);

    /* a guarnição de um dia, contada da do dia aberto */
    function letraDe(dia) { return String.fromCharCode(65 + (((letra.charCodeAt(0) - 65 + dias(iso, dia)) % n) + n) % n); }
    /* o dia pode ser a entrada: depois do último serviço, de outra guarnição e ainda não começado */
    function vale(dia) { return !!est.ultimo && dia > est.ultimo && dia >= primeiro && letraDe(dia) !== letra; }

    /* a primeira caixa: os três dias do último serviço */
    q('.escala-mudar-guarnicao-letra').textContent = letra;
    var nome = 'escala-mudar-guarnicao-' + (++conta), lista = q('.escala-mudar-guarnicao-dias');
    [vizinhos.antes, iso, vizinhos.depois].filter(Boolean).forEach(function (dia) {
      var op = RW.tpl('tpl-escala-mudar-saida-opcao');
      if (!op) return;
      var r = op.querySelector('input');
      r.name = nome;
      r.value = dia;
      op.querySelector('.escala-mudar-saida-data').textContent = diaMes(dia);
      r.addEventListener('change', function () {
        if (!r.checked) return;
        est.ultimo = dia;
        /* a segunda caixa abre, com o Cancelar; a data de antes sai (ela dependia do último serviço) */
        caixaEntra.classList.remove('oculto');
        caixaEntra.appendChild(acoes);
        campo.value = '';
        est.entra = null;
        RW.campos.limparErro(campo);
        aplicar();
      });
      lista.appendChild(op);
    });

    /* a segunda caixa: o campo de data (a máscara e o calendário, com os dias que podem acesos) */
    RW.campos.ligarMascara(campo, RW.campos.mascararData);
    campo.addEventListener('input', lerCampo);
    RW.calendario.ligar(campo, {
      ancora: caixaEntra,
      obterData: function () { return est.entra ? D().paraData(D().isoParaBR(est.entra)) : null; },
      permiteDia: function (d) { return vale(D().paraIsoDeData(d)); },
      aoEscolher: function (d) { campo.value = D().paraBR(d); lerCampo(); }
    });
    function lerCampo() {
      var completo = campo.value.length === 10, dia = completo ? D().paraISO(campo.value) : null;
      est.entra = dia && vale(dia) ? dia : null;
      if (completo && !est.entra) RW.campos.marcarErro(campo, L().mudarGuarnicaoDiaErrado);
      else RW.campos.limparErro(campo);
      aplicar();
    }

    /* a folga entre o fim do último serviço e a entrada: cinza; menor que a de sempre, amarela */
    function desenharFolga() {
      var mostrar = !!est.entra, horas = mostrar ? dias(est.ultimo, est.entra) * 24 - horasServico : 0, sempre = n * 24 - horasServico;
      var H = api.horas, texto = mostrar ? L().mudarGuarnicaoFolga(horas > 0 ? H.horasTexto(horas * 60) : '', letraDe(est.entra), H.horasTexto(sempre * 60)) : '';
      [[folga, mostrar && horas >= sempre], [folgaMenor, mostrar && horas < sempre]].forEach(function (x) {
        x[0].classList.toggle('oculto', !x[1]);
        x[0].querySelector('.nota-texto').textContent = x[1] ? texto : '';
      });
    }

    /* com as duas respostas, a mudança vai para o rascunho e a lista do que acontece aparece; pela metade, o rascunho
       volta ao que era */
    function aplicar() {
      var meu = ++p.pedido;
      ver.esconder();
      desenharFolga();
      if (!est.entra) { if (p.passos) C().voltarDa(p); return; }
      var data = est.ultimo < iso ? iso : somar(est.ultimo, 1), nova = letraDe(est.entra), ultimo = est.ultimo, entra = est.entra;
      C().marcarPasso(uid, iso, { cpf: cpf, acao: 'adicionar', tipo: 'mudar', letra: nova, data: data, ultimo: ultimo, entra: entra, itens: [] });
      p.passos++;
      C().analisarMudar(uid, data, m, nova, entra).then(function (aviso) {
        if (!C().perguntaAberta(p) || meu !== p.pedido) return;
        if (aviso.erro) { RW.avisar({ tipo: 'erro', mensagem: aviso.erro }); return; }
        ver.mostrar(aviso);
        var atual = C().marcado(uid, iso, cpf);
        if (atual && atual.entra === entra && atual.ultimo === ultimo) atual.itens = aviso.itens || [];
      });
    }

    q('.escala-mudar-guarnicao-cancelar').addEventListener('click', function () {
      C().voltarDa(p);
      C().fecharPergunta('largar');
      if (opcoes.aoCancelar) opcoes.aoCancelar();
    });
    if (opcoes.dentro) opcoes.dentro.appendChild(el);
    else linha.insertAdjacentElement('afterend', el);
    C().abrirPergunta(p);
  }

  window.RosterWork.escalasPainelMudarGuarnicao = { pode: pode, perguntar: perguntar };
})();
