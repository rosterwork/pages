/* ============================================================
   NOVA EXTRA — passo 3: a lista dos voluntários (o painel esquerdo)
   Os voluntários com termo e cota, na ordem da fila (a mesma das
   Cotas), em dois grupos: os que ainda têm cota para colocar
   (Faltam) e os que já colocaram todas (Completos), cada um com o
   pelotão e as cotas colocadas de recebidas. Clicar no nome abre
   embaixo as datas dele, com os 4 horários (a mesma peça do painel
   do dia; em cinza a que sai ao salvar), e põe o militar em foco no
   calendário (nova-extra-por-dia.js): os outros nomes somem e, em
   todos os pelotões e dias, aparecem as bolinhas grandes dele (ou o
   motivo de não poder). A nota no alto diz quem está em foco e as cotas,
   com o X para sair (ou clicar de novo no nome, clicar fora do nome,
   das datas dele e das bolinhas, ou o Esc). Enquanto
   está em foco, ele não muda de grupo. Uma escolha por vez: pôr um
   militar em foco fecha o painel do dia, e abrir um dia tira o foco
   (nova-extra-dia.js). A alça abre e fecha o painel; com o painel do
   dia aberto e o calendário com menos de 4 dias à vista, a lista
   recolhe sozinha e volta ao fechar o painel (só se foi o sistema que
   recolheu). A faixa de cada grupo abre e fecha a lista dela.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraLista.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var pagina = null;
  var foco = null;         // o militar em foco no calendário: { cpf, grupo ('faltam' ou 'completos') }
  var escLigado = false;
  var recolhidaPeloPainel = false;   // a lista recolhida pelo sistema ao abrir o painel do dia (volta ao fechar)
  var MIN_CALENDARIO = 800;          // 4 dias à vista (cada dia tem no mínimo 200px)

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }

  /* a alça abre e fecha o painel esquerdo; a faixa de cada grupo abre e fecha a lista dele (o CSS lê o aria-expanded);
     o X da nota e o Esc tiram o foco (o Esc só quando nada mais está aberto por cima: painel ou aviso) */
  function ligar(el) {
    pagina = el;
    var alca = el.querySelector('#p3-alca'), lateral = el.querySelector('#p3-lateral');
    alca.addEventListener('click', function () {
      recolhidaPeloPainel = false;   // quem mexe na alça decide: o sistema não devolve
      abrirLista(alca.getAttribute('aria-expanded') !== 'true');
    });
    Array.prototype.forEach.call(el.querySelectorAll('.nova-extra-esq-faixa'), function (faixa) {
      faixa.addEventListener('click', function () {
        faixa.setAttribute('aria-expanded', faixa.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });
    });
    el.querySelector('#p3-foco-sair').addEventListener('click', sairDoFoco);
    if (!escLigado) {
      escLigado = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape' || !foco || !pagina || !pagina.isConnected) return;
        if (RW.painel.estaAberto() || document.querySelector('.modal-veu--aberto')) return;
        sairDoFoco();
      }, true);   // na captura: vê o painel ainda aberto antes de o Esc do painel fechá-lo
      /* clicar fora do nome, das datas dele e das bolinhas tira o foco (o aviso da cota, que vem da bolinha, não) */
      document.addEventListener('click', function (ev) {
        if (!foco || !pagina || !pagina.isConnected) return;
        if (ev.target.closest('.nova-extra-esq-item, .nova-extra-esq-aberto, .nova-extra-foco-linha, #p3-foco, .modal-veu')) return;
        sairDoFoco();
      });
    }
    foco = null;
  }

  function sairDoFoco() {
    if (!foco) return;
    foco = null;
    RW.novaExtraMontar.redesenhar();
  }

  function abrirLista(sim) {
    pagina.querySelector('#p3-alca').setAttribute('aria-expanded', sim ? 'true' : 'false');
    pagina.querySelector('#p3-lateral').classList.toggle('geral-layout-lateral--fechado', !sim);
  }

  /* com o painel do dia aberto: se o calendário ficou com menos de 4 dias à vista, a lista recolhe */
  function recolherSeApertado() {
    if (!pagina || !pagina.isConnected || pagina.querySelector('#p3-alca').getAttribute('aria-expanded') !== 'true') return;
    if (pagina.querySelector('#p3-cal').clientWidth >= MIN_CALENDARIO) return;
    abrirLista(false);
    recolhidaPeloPainel = true;
  }

  /* o painel do dia fechou: a lista volta, se foi o sistema que recolheu */
  function devolverLista() {
    if (!recolhidaPeloPainel || !pagina || !pagina.isConnected) return;
    recolhidaPeloPainel = false;
    abrirLista(true);
  }

  function desenhar(el) {
    pagina = el;
    var alocs = G().efetivas();
    var vols = G().voluntarios().slice().sort(function (x, y) { return (x.ordem || 0) - (y.ordem || 0); });
    if (foco && !vols.some(function (m) { return m.cpf === foco.cpf; })) foco = null;
    /* quem está em foco fica no grupo em que estava até sair do foco */
    var grupos = { faltam: [], completos: [] };
    vols.forEach(function (m) {
      var g = foco && foco.cpf === m.cpf ? foco.grupo : (G().usadas(m.cpf, alocs) >= (m.concedidas || 0) ? 'completos' : 'faltam');
      grupos[g].push(m);
    });
    ['faltam', 'completos'].forEach(function (g) {
      var alvo = el.querySelector('#p3-' + g);
      alvo.textContent = '';
      grupos[g].forEach(function (m) {
        alvo.appendChild(item(m, g, alocs));
        if (foco && foco.cpf === m.cpf) alvo.appendChild(datas(m));
      });
      el.querySelector('#p3-' + g + '-conta').textContent = grupos[g].length;
      el.querySelector('#p3-' + g + '-vazio').classList.toggle('oculto', grupos[g].length > 0);
    });
    /* a nota do foco, no alto do calendário: quem e as cotas dele */
    var m = foco ? u().militar(foco.cpf) : null, nota = el.querySelector('#p3-foco');
    nota.classList.toggle('oculto', !m);
    if (m) nota.querySelector('.nota-texto').textContent = msg().focoTexto((m.grad + ' ' + m.nome).trim(), G().usadas(m.cpf, alocs), m.concedidas || 0);
    /* a pesquisa da barra deixa na lista só quem casa */
    if (RW.novaExtraFiltros) RW.novaExtraFiltros.aplicar();
  }

  /* um voluntário: posto e nome, o pelotão e as cotas colocadas de recebidas; clicar põe ou tira do foco */
  function item(m, g, alocs) {
    var b = RW.tpl('tpl-ne-esq-item');
    var emFoco = !!foco && foco.cpf === m.cpf;
    b.querySelector('.nova-extra-esq-grad').textContent = m.grad || '';
    b.querySelector('.nova-extra-esq-nome').textContent = m.nome || m.cpf;
    b.setAttribute('data-busca', RW.busca ? RW.busca.chave(m) : '');
    b.querySelector('.nova-extra-esq-pel').textContent = (u().unidade(m.unidade_id) || {}).nome || '';
    b.querySelector('.nova-extra-esq-cotas').textContent = msg().deCotas(G().usadas(m.cpf, alocs), m.concedidas || 0);
    b.classList.toggle('lista-item--ativo', emFoco);
    b.setAttribute('aria-pressed', emFoco ? 'true' : 'false');
    b.addEventListener('click', function () {
      foco = emFoco ? null : { cpf: m.cpf, grupo: g };
      /* uma escolha por vez: o militar em foco fecha o painel do dia */
      if (foco && RW.novaExtraDia.aberto()) RW.novaExtraDia.fechar();
      RW.novaExtraMontar.redesenhar();
    });
    return b;
  }

  /* as datas dele (inclusive as sem horário, em cinza até o Salvar), cada uma com os 4 horários */
  function datas(m) {
    var caixa = RW.tpl('tpl-ne-esq-aberto');
    var lista = caixa.querySelector('.nova-extra-esq-datas');
    var minhas = G().vagas().filter(function (a) { return a.cpf === m.cpf; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    minhas.forEach(function (a) {
      var lin = RW.tpl('tpl-ne-esq-data');
      lin.querySelector('.nova-extra-esq-dia').textContent = msg().diaData(G().SEM_CURTA[G().dataDe(a.data).getDay()], u().br(a.data));
      lin.querySelector('.nova-extra-esq-data-pel').textContent = +a.unidade !== m.unidade_id ? ((u().unidade(a.unidade) || {}).nome || '') : '';
      lin.classList.toggle('nova-extra-esq-data--sai', !a.blocos.length);
      RW.novaExtraDia.ligarMarcas(lin.querySelector('.nova-extra-marcas'), m, a.data, G().blocos(a), +a.unidade);
      lista.appendChild(lin);
    });
    caixa.querySelector('.nova-extra-esq-sem').classList.toggle('oculto', minhas.length > 0);
    return caixa;
  }

  RW.novaExtraLista = {
    ligar: ligar,
    desenhar: desenhar,
    /* o cpf do militar em foco (ou null) */
    foco: function () { return foco ? foco.cpf : null; },
    sairDoFoco: sairDoFoco,
    recolherSeApertado: recolherSeApertado,
    devolverLista: devolverLista
  };
})();
