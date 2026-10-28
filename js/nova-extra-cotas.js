/* ============================================================
   NOVA EXTRA — passo 2: Cotas
   Igual à aba Voluntários da Extrajornada antiga: a banda com as
   cotas recebidas, como repartir e os números do mês; embaixo, o
   cabeçalho das colunas e um bloco por pelotão com os voluntários com
   termo, na ordem da fila. O Recebe é o campo de seleção do site
   (de 0 até o que ele pediu; quem só aceita 24 h, de 4 em 4). Quem
   ainda não tem cota salva já vem com a sugestão. Cota abaixo do que
   ele já tem na distribuição avisa embaixo da linha: as extras dele
   saem ao salvar. Tudo fica no rascunho até o Salvar
   (nova_extra_cotas_salvar), que abre o resumo.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraCotas.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var d = null, el = null, aoSalvar = null, aoMudar = null;
  var p2 = null;           // o rascunho: { recebidas, modo, unidades, conc, sujo }
  var ligado = null;

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  function comTermo() { return vols().filter(function (m) { return m.termo; }).sort(function (a, b) { return a.ordem - b.ordem; }); }
  function conc(m) { return m.cpf in p2.conc ? p2.conc[m.cpf] : (m.concedidas || 0); }
  /* o que ele já tem na distribuição salva: as cotas e os dias (DD/MM) */
  function naGrade(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  function diasDe(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).map(function (a) { return a.data; }).sort().map(u().br); }
  /* abaixo do que está na grade, as extras dele saem ao salvar */
  function perde(m) { return conc(m) < naGrade(m); }
  /* a lista do Recebe: de 0 até o que ele pediu (quem só aceita 24 h, de 4 em 4) */
  function opcoes(m) { var l = []; for (var n = 0; n <= (m.cotas || 0); n += m.so24 ? 4 : 1) l.push(n); return l; }

  function iniciarRascunho() {
    p2 = { recebidas: d.mes.cotas_recebidas, modo: d.mes.repartir_por || 'grupo', unidades: Object.assign({}, d.mes.cotas_unidades || {}), conc: {}, sujo: false };
    /* quem ainda não tem cota salva já vem com a sugestão */
    comTermo().forEach(function (m) {
      if (m.concedidas == null && (m.sugerido || 0) > 0) { p2.conc[m.cpf] = m.sugerido; p2.sujo = true; }
    });
  }

  function desenhar() {
    if (!p2) iniciarRascunho();
    var porUnidade = p2.modo === 'por_unidade';
    q('#p2-recebidas').value = p2.recebidas == null ? '' : p2.recebidas;
    q('#p2-recebidas').disabled = porUnidade;
    todos('#p2-modo [data-modo]', function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-modo') === p2.modo); });
    var total = porUnidade ? Object.keys(p2.unidades).reduce(function (s, k) { return s + (+p2.unidades[k] || 0); }, 0) : (+p2.recebidas || 0);
    var lista = comTermo();
    var rep = lista.reduce(function (s, m) { return s + conc(m); }, 0);
    q('#p2-repartidas').textContent = rep;
    q('#p2-sobram').textContent = total - rep;
    q('#p2-sobram').classList.toggle('extra-vol-numero-valor--erro', total - rep < 0);
    q('#p2-na-escala').textContent = lista.reduce(function (s, m) { return s + naGrade(m); }, 0);

    var alvo = q('#p2-lista');
    alvo.textContent = '';
    if (lista.length) alvo.appendChild(RW.tpl('tpl-ne-p2-cab'));
    var ajuste = d.iniciado && !!d.lancamento;
    d.unidades.forEach(function (un) {
      var daqui = lista.filter(function (m) { return m.unidade_id === un.id; });
      if (!daqui.length) return;
      var bloco = RW.tpl('tpl-ne-p2-bloco');
      bloco.querySelector('.extra-vol-bloco-nome').textContent = un.nome;
      bloco.querySelector('.extra-vol-bloco-detalhe').textContent = un.cidade || '';
      /* cada unidade com as suas: o total dela no título e o que sobra */
      var cotas = bloco.querySelector('.extra-vol-bloco-cotas'), restam = bloco.querySelector('.extra-vol-bloco-restam');
      cotas.classList.toggle('oculto', !porUnidade);
      restam.classList.toggle('oculto', !porUnidade);
      if (porUnidade) {
        var inp = cotas.querySelector('input');
        inp.value = p2.unidades[un.id] == null ? '' : p2.unidades[un.id];
        inp.addEventListener('change', function () { p2.unidades[un.id] = inp.value === '' ? 0 : (parseInt(inp.value, 10) || 0); p2.sujo = true; desenhar(); });
        var sobra = (+p2.unidades[un.id] || 0) - daqui.reduce(function (s, m) { return s + conc(m); }, 0);
        restam.textContent = msg().sobramN(sobra);
        restam.classList.toggle('extra-vol-bloco-restam--erro', sobra < 0);
      }
      var bloquinho = bloco.querySelector('.extra-vol-bloquinho');
      daqui.forEach(function (m) {
        bloquinho.appendChild(linha(m, lista.indexOf(m) + 1));
        if (perde(m)) {
          var av = RW.tpl('tpl-ne-p2-aviso');
          av.textContent = msg().retiraCota(conc(m), diasDe(m), ajuste);
          bloquinho.appendChild(av);
        }
      });
      alvo.appendChild(bloco);
    });
    q('#p2-vazio').classList.toggle('oculto', lista.length > 0);
    var perdem = lista.filter(perde).length;
    q('#p2-mudancas').textContent = perdem ? msg().naoSalvoRetira(perdem) : (p2.sujo ? msg().naoSalvo : '');
    q('#p2-salvar').disabled = !p2.sujo;
  }

  /* um voluntário: a fila, o militar, o pedido, os 12 meses, a sugestão, o Recebe e o que já está na escala */
  function linha(m, fila) {
    var l = RW.tpl('tpl-ne-p2-linha');
    l.querySelector('.nova-extra-fila').textContent = msg().fila(fila);
    l.querySelector('.extra-vol-grad').textContent = m.grad;
    l.querySelector('.extra-vol-nome').textContent = m.nome;
    l.querySelector('.extra-vaga-24h').classList.toggle('oculto', !m.so24);
    l.querySelector('.extra-vol-pediu').textContent = m.cotas;
    l.querySelector('.ne-hist').textContent = m.pediu12 ? msg().pediuRecebeu(m.pediu12, m.recebeu12) : msg().primeiraVez;
    l.querySelector('.extra-vol-sugerido').textContent = m.sugerido || 0;
    l.querySelector('.extra-vol-conc-texto').textContent = conc(m);
    l.querySelector('.extra-vol-conc').classList.toggle('extra-vol-conc--alterado', conc(m) !== (m.sugerido || 0));
    RW.dropdownNumeros.preencher(l.querySelector('.extra-vol-conc-menu'), {
      opcoes: opcoes(m), valor: conc(m),
      aoEscolher: function (n) { p2.conc[m.cpf] = n; p2.sujo = true; desenhar(); }
    });
    l.querySelector('.extra-vol-na-escala').textContent = msg().deCotas(naGrade(m), conc(m));
    return l;
  }

  function salvar(depois) {
    var concedidas = {};
    comTermo().forEach(function (m) { concedidas[m.cpf] = conc(m); });
    RW.rpc('nova_extra_cotas_salvar', {
      p_competencia: d.competencia, p_cotas_recebidas: p2.modo === 'por_unidade' ? null : (p2.recebidas === '' || p2.recebidas == null ? null : +p2.recebidas),
      p_repartir_por: p2.modo, p_cotas_unidades: p2.modo === 'por_unidade' ? p2.unidades : null, p_concedidas: concedidas
    }).then(function (r) {
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.novaExtraOrg.resumo(r);
      if (depois) depois(); else aoSalvar();
    });
  }

  function ligar() {
    q('#p2-recebidas').addEventListener('change', function () {
      var v = q('#p2-recebidas').value.trim();
      p2.recebidas = v === '' ? null : (parseInt(v, 10) || 0); p2.sujo = true; desenhar();
    });
    todos('#p2-modo [data-modo]', function (b) {
      b.addEventListener('click', function () { if (p2.modo === b.getAttribute('data-modo')) return; p2.modo = b.getAttribute('data-modo'); p2.sujo = true; desenhar(); });
    });
    q('#p2-cancelar').addEventListener('click', function () { p2 = null; desenhar(); });
    q('#p2-salvar').addEventListener('click', function () { salvar(); });
    /* Usar a sugestão: grava as recebidas, relê a sugestão do banco e a põe em todos */
    q('#p2-sugestao').addEventListener('click', function () {
      salvar(function () {
        RW.rpc('nova_extra_mes', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.ok) return;
          d = r; iniciarRascunho();
          comTermo().forEach(function (m) { p2.conc[m.cpf] = m.sugerido || 0; });
          p2.sujo = true; desenhar(); if (aoMudar) aoMudar(r);
        });
      });
    });
  }

  function mostrar(dados, conteudo, recarregar, mudou) {
    d = dados; el = conteudo; aoSalvar = recarregar; aoMudar = mudou;
    if (ligado !== el) {
      ligado = el; p2 = null; ligar();
      /* com cotas não salvas, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return !!(el && el.isConnected && p2 && p2.sujo); });
    }
    desenhar();
  }

  RW.novaExtraCotas = { mostrar: mostrar, reiniciar: function () { p2 = null; } };
})();
