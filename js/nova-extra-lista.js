/* ============================================================
   NOVA EXTRA — passo 3: a lista dos voluntários (o painel esquerdo)
   Os voluntários com termo e cota, na ordem da fila (a mesma das
   Cotas), em dois grupos: os que ainda têm cota para colocar
   (Faltam) e os que já colocaram todas (Completos), cada um com o
   pelotão e as cotas colocadas de recebidas. Clicar no nome abre
   embaixo as datas dele, com os 4 horários (a mesma peça do painel do
   dia), e o Nova data, que abre o calendário pequeno do mês para pôr
   um dia novo, ainda sem horário (os dias em que ele não pode ficam
   apagados). Enquanto está aberto, ele não muda de grupo. A alça abre
   e fecha o painel, e a faixa de cada grupo abre e fecha a lista dele.
   Lê e muda o rascunho por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraLista.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var pagina = null;
  var aberto = null;       // o militar aberto: { cpf, grupo ('faltam' ou 'completos') }
  var calAberto = false;   // o calendário do Nova data à vista

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }

  /* a alça abre e fecha o painel esquerdo; a faixa de cada grupo abre e fecha a lista dele (o CSS lê o aria-expanded) */
  function ligar(el) {
    var alca = el.querySelector('#p3-alca'), lateral = el.querySelector('#p3-lateral');
    alca.addEventListener('click', function () {
      var abrir = alca.getAttribute('aria-expanded') !== 'true';
      alca.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      lateral.classList.toggle('geral-layout-lateral--fechado', !abrir);
    });
    Array.prototype.forEach.call(el.querySelectorAll('.nova-extra-esq-faixa'), function (faixa) {
      faixa.addEventListener('click', function () {
        faixa.setAttribute('aria-expanded', faixa.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });
    });
    aberto = null;
    calAberto = false;
  }

  function desenhar(el) {
    pagina = el;
    var d = G().dados(), alocs = G().efetivas();
    var vols = G().voluntarios().slice().sort(function (x, y) { return (x.ordem || 0) - (y.ordem || 0); });
    if (aberto && !vols.some(function (m) { return m.cpf === aberto.cpf; })) aberto = null;
    /* quem está aberto fica no grupo em que estava até fechar */
    var grupos = { faltam: [], completos: [] };
    vols.forEach(function (m) {
      var g = aberto && aberto.cpf === m.cpf ? aberto.grupo : (G().usadas(m.cpf, alocs) >= (m.concedidas || 0) ? 'completos' : 'faltam');
      grupos[g].push(m);
    });
    ['faltam', 'completos'].forEach(function (g) {
      var alvo = el.querySelector('#p3-' + g);
      alvo.textContent = '';
      grupos[g].forEach(function (m) {
        alvo.appendChild(item(m, g, alocs));
        if (aberto && aberto.cpf === m.cpf) alvo.appendChild(datas(m, d));
      });
      el.querySelector('#p3-' + g + '-conta').textContent = grupos[g].length;
      el.querySelector('#p3-' + g + '-vazio').classList.toggle('oculto', grupos[g].length > 0);
    });
  }

  /* um voluntário: posto e nome, o pelotão e as cotas colocadas de recebidas; clicar abre ou fecha as datas */
  function item(m, g, alocs) {
    var b = RW.tpl('tpl-ne-esq-item');
    var ehAberto = !!aberto && aberto.cpf === m.cpf;
    b.querySelector('.nova-extra-esq-grad').textContent = m.grad || '';
    b.querySelector('.nova-extra-esq-nome').textContent = m.nome || m.cpf;
    b.querySelector('.nova-extra-esq-pel').textContent = (u().unidade(m.unidade_id) || {}).nome || '';
    b.querySelector('.nova-extra-esq-cotas').textContent = msg().deCotas(G().usadas(m.cpf, alocs), m.concedidas || 0);
    b.classList.toggle('lista-item--ativo', ehAberto);
    b.setAttribute('aria-expanded', ehAberto ? 'true' : 'false');
    b.addEventListener('click', function () {
      aberto = ehAberto ? null : { cpf: m.cpf, grupo: g };
      calAberto = false;
      desenhar(pagina);
    });
    return b;
  }

  /* as datas dele (inclusive as sem horário, que saem ao salvar), o Nova data e o calendário pequeno */
  function datas(m, d) {
    var caixa = RW.tpl('tpl-ne-esq-aberto');
    var lista = caixa.querySelector('.nova-extra-esq-datas');
    var minhas = G().vagas().filter(function (a) { return a.cpf === m.cpf; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    minhas.forEach(function (a) {
      var lin = RW.tpl('tpl-ne-esq-data');
      lin.querySelector('.nova-extra-esq-dia').textContent = msg().diaData(G().SEM_CURTA[G().dataDe(a.data).getDay()], u().br(a.data));
      lin.querySelector('.nova-extra-esq-data-pel').textContent = +a.unidade !== m.unidade_id ? ((u().unidade(a.unidade) || {}).nome || '') : '';
      RW.novaExtraDia.ligarMarcas(lin.querySelector('.nova-extra-marcas'), m, a.data, G().blocos(a), +a.unidade);
      lista.appendChild(lin);
    });
    caixa.querySelector('.nova-extra-esq-sem').classList.toggle('oculto', minhas.length > 0);
    /* com o pedido aberto, nada entra (só dá para tirar) */
    var nova = caixa.querySelector('.nova-extra-esq-nova');
    nova.disabled = G().travado();
    var mostrar = calAberto && !nova.disabled;
    nova.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
    nova.addEventListener('click', function () { calAberto = !calAberto; desenhar(pagina); });
    var cal = caixa.querySelector('.nova-extra-esq-cal');
    cal.classList.toggle('oculto', !mostrar);
    if (mostrar) calendario(cal, m, d);
    return caixa;
  }

  /* o mês: apagado e sem clique o dia em que ele não pode (a escala dele ou já está no dia); verde o que ele quer e
     vermelho o Não posso. Escolher o dia põe a data, sem horário, no pelotão dele */
  function calendario(cal, m, d) {
    RW.miniCalendario.renderizar(cal, { dataRef: G().dataDe(d.competencia), aoDia: function (botao, k) {
      if (G().vagaDe(m.cpf, k) || G().impedimento(m, k)) {
        botao.classList.add('mini-calendario-dia--ocupado');
        botao.disabled = true;
        return;
      }
      var pref = u().pref(m, k);
      if (pref === 'quer') botao.classList.add('mini-calendario-dia--quer');
      if (pref === 'nao') botao.classList.add('mini-calendario-dia--nao');
      botao.addEventListener('click', function () {
        calAberto = false;
        G().mudar(m, k, [], m.unidade_id);
      });
    } });
  }

  RW.novaExtraLista = { ligar: ligar, desenhar: desenhar };
})();
