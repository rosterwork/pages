/* ============================================================
   EXTRAJORNADA — aba Calendário (todos)
   O mês no padrão do calendário da Escala (geral-calendario-mes,
   variante --unidades): em cada dia, um bloco por unidade marcada no
   seletor do cabeçalho com quem tira extra e o horário; a unidade sem
   ninguém no dia guarda o lugar (invisível), para as unidades ficarem
   alinhadas na linha. Mostra o que foi LANÇADO na escala; depois que o
   mês começa, compara com o que está agora: quem saiu fica riscado
   ("foi para 24/11", "horário mudou") e quem entrou diz de onde veio
   ("ajuste, veio de 20/11"). Antes do primeiro lançamento, mostra a
   distribuição salva com o aviso amarelo de que ainda não está na
   escala de serviço. Clicar no bloco abre o painel do dia (o mesmo da
   Escala, escalas-painel.js). Na barra: Solicitar extra (o mês em
   aberto, extrajornada-solicitar.js), o selo do prazo e a busca.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaCalendario.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08', '14', '20', '02'];   // início de cada bloco (1 a 4)
  var FIM = ['', '14', '20', '02', '08'];   // fim de cada bloco

  var el = {};
  var naAba = false;
  var comp = null;
  var cargaSeq = 0;
  var buscaTermo = '';
  var buscaModo = 'marcar';
  var buscaCtrl = null;
  var ultimo = null;          // a última resposta (redesenha sem buscar de novo quando muda a seleção de unidades)
  var ouvinteLigado = false;

  function msg() { return RW.mensagens.extrajornada.calendario; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function ativo() { return naAba && el.grade && el.grade.isConnected; }

  function estado(texto) {
    el.grade.textContent = '';
    var p = RW.tpl('tpl-extra-estado');
    if (p) { p.textContent = texto; el.grade.appendChild(p); }
  }
  function carregando() {
    if (el.aviso) el.aviso.classList.add('oculto');   // o aviso volta com a resposta, se o mês não foi lançado
    el.grade.textContent = '';
    var c = RW.tpl('tpl-escala-carregando');
    if (c) el.grade.appendChild(c);
  }

  /* ---------- o lançado × o atual: quem saiu e quem entrou ---------- */
  function chave(r) { return r.cpf + '|' + r.data + '|' + r.uid + '|' + r.b_ini + '|' + r.b_fim; }
  /* marca cada trecho: normal, saiu (riscado) ou entrou; liga quem saiu com quem entrou (o mesmo militar) */
  function comparar(base, atual) {
    var naBase = {}, noAtual = {};
    base.forEach(function (r) { naBase[chave(r)] = true; });
    atual.forEach(function (r) { noAtual[chave(r)] = true; });
    var saiu = base.filter(function (r) { return !noAtual[chave(r)]; });
    var entrou = atual.filter(function (r) { return !naBase[chave(r)]; });
    saiu.forEach(function (r) { r.estado = 'saiu'; });
    entrou.forEach(function (r) { r.estado = 'entrou'; });
    /* o par do mesmo militar: primeiro no mesmo dia (mudou o horário), depois em outro dia (mudou o dia) */
    saiu.forEach(function (s) {
      var par = entrou.filter(function (e) { return e.cpf === s.cpf && !e.par && e.data === s.data; })[0]
        || entrou.filter(function (e) { return e.cpf === s.cpf && !e.par; })[0];
      if (par) { par.par = s; s.par = par; }
    });
    /* o que aparece em cada dia: o lançado (normal ou riscado) e, depois, quem entrou */
    var dias = {};
    function poe(r) { ((dias[r.data] = dias[r.data] || {})[r.uid] = dias[r.data][r.uid] || []).push(r); }
    base.forEach(poe);
    entrou.forEach(poe);
    return dias;
  }

  function nota(r) {
    if (r.estado === 'saiu') {
      if (!r.par) return msg().retirada;
      return r.par.data === r.data ? msg().horarioMudou : msg().foiPara(ddmm(r.par.data));
    }
    if (r.estado === 'entrou') {
      if (!r.par) return msg().nova;
      return r.par.data === r.data ? msg().era(INI[r.par.b_ini] + 'h', FIM[r.par.b_fim] + 'h') : msg().veioDe(ddmm(r.par.data));
    }
    return '';
  }

  function linha(r) {
    var l = RW.tpl('tpl-escala-mes-pessoa');
    if (!l) return null;
    l.querySelector('.linha-escalado-grad').textContent = r.grad || '';
    l.querySelector('.linha-escalado-nome').textContent = r.nome || '';
    var par = RW.tpl('tpl-escala-mes-hora-par');
    if (par) {
      par.querySelector('.linha-escalado-hora-ini').textContent = INI[r.b_ini];
      par.querySelector('.linha-escalado-hora-fim').textContent = FIM[r.b_fim];
      l.querySelector('.linha-escalado-hora').appendChild(par);
    }
    if (r.estado === 'saiu') l.classList.add('linha-escalado--trocado');
    if (RW.busca) l.setAttribute('data-busca', RW.busca.chave(r));
    return l;
  }

  function desenhar(r) {
    ultimo = r;
    if (el.aviso) {
      el.aviso.classList.toggle('oculto', !!r.lancado);
      el.avisoTitulo.textContent = r.lancado ? '' : msg().emDistribuicao(MESES[comp.getMonth()]);
    }
    var sel = RW.extrajornadaUnidades.selecionadas();
    var unidades = (r.unidades || []).filter(function (u) { return sel.indexOf(String(u.unidade_id)) >= 0; });
    if (!unidades.length) { estado(RW.mensagens.escala.selecioneUnidade); return; }
    var dias = comparar(r.base || [], r.atual || []);
    var contexto = unidades[0] || null;   // a companhia vem primeiro; o pelotão mostra a companhia no título do painel
    RW.geralCalendarioMes.renderizar(el.grade, {
      dataRef: comp, unidadesPorDia: Math.max(1, unidades.length),
      aoDia: function (celulaDia, data, doMes) {
        if (!doMes) return;
        var isoDia = iso(data);
        var doDia = dias[isoDia] || {};
        unidades.forEach(function (u) {
          var itens = doDia[u.unidade_id];
          if (!itens || !itens.length) {
            var vazio = RW.tpl('tpl-extra-calendario-vazio');
            if (vazio) celulaDia.appendChild(vazio);
            return;
          }
          var bloco = RW.tpl('tpl-extra-calendario-unidade');
          if (!bloco) return;
          bloco.querySelector('.extra-calendario-unidade-nome').textContent = u.nome;
          var cel = bloco.querySelector('.escala-mes-celula');
          cel.dataset.iso = isoDia;
          cel.dataset.unidadeId = u.unidade_id;
          cel.dataset.unidadeNome = (contexto && contexto.unidade_id !== u.unidade_id) ? contexto.nome + ' / ' + u.nome : u.nome;
          cel.dataset.unidadeCidade = u.cidade || '';
          itens.forEach(function (it) {
            var l = linha(it);
            if (l) cel.appendChild(l);
            var texto = nota(it);
            if (!texto) return;
            var n = RW.tpl('tpl-extra-cal-nota');
            if (!n) return;
            n.textContent = texto;
            if (it.estado === 'entrou') n.classList.add('extra-cal-nota--entrou');
            cel.appendChild(n);
          });
          celulaDia.appendChild(bloco);
        });
      }
    });
    aplicarBusca();
  }

  function carregar() {
    if (!ativo() || !RW.extrajornadaDados) return;
    var req = ++cargaSeq;
    carregando();
    RW.extrajornadaDados.carregarCalendario(iso(comp)).then(function (r) {
      if (!ativo() || req !== cargaSeq) return;
      if (!r || !r.ok) { estado((r && r.error) || msg().falha); return; }
      desenhar(r);
    }, function () {
      if (ativo() && req === cargaSeq) estado(msg().falha);
    });
  }

  /* ---------- busca: marca ou filtra as linhas do militar ---------- */
  function aplicarBusca() {
    if (!el.grade || !RW.busca) return;
    Array.prototype.forEach.call(el.grade.querySelectorAll('.escala-mes-celula--busca'), function (c) { c.classList.remove('escala-mes-celula--busca'); });
    Array.prototype.forEach.call(el.grade.querySelectorAll('.linha-escalado'), function (l) {
      var casa = RW.busca.casaTexto(buscaTermo, l.getAttribute('data-busca'));
      l.classList.toggle('linha-escalado--busca', !!buscaTermo && casa && buscaModo === 'marcar');
      l.classList.toggle('oculto', !!buscaTermo && !casa && buscaModo === 'filtrar');
      /* a nota acompanha a linha dela */
      var n = l.nextElementSibling;
      if (n && n.classList.contains('extra-cal-nota')) n.classList.toggle('oculto', !!buscaTermo && !casa && buscaModo === 'filtrar');
      if (buscaTermo && casa) { var c = l.closest('.escala-mes-celula'); if (c) c.classList.add('escala-mes-celula--busca'); }
    });
  }

  /* ---------- a barra: Solicitar extra e o selo do prazo (o mês em aberto) ---------- */
  function atualizarBarra(info) {
    if (!naAba) return;
    var s = RW.mensagens.extrajornada.solicitar;
    if (!info || !info.ok) {
      el.solicitar.classList.add('oculto');
      el.selo.classList.add('oculto');
      return;
    }
    var mes = MESES[Number(String(info.competencia).split('-')[1]) - 1];
    var editavel = info.estado_janela === 'editavel';
    el.solicitarTexto.textContent = editavel ? s.botao : s.botaoLeitura;
    el.solicitar.classList.remove('oculto');
    el.selo.classList.remove('selo--alerta', 'selo--erro');
    if (!editavel) el.selo.textContent = msg().prazoEncerrado(mes, ddmm(info.prazo_fim));
    else if (info.aviso) {
      el.selo.textContent = msg().prazoFaltam(mes, info.faltam_dias, ddmm(info.prazo_fim));
      el.selo.classList.add(info.faltam_dias === 0 ? 'selo--erro' : 'selo--alerta');
    } else el.selo.textContent = msg().prazoAberto(mes, ddmm(info.prazo_fim));
    el.selo.classList.remove('oculto');
  }

  function montar(cont) {
    el.grade = cont.querySelector('#extra-cal-grade');
    el.selo = cont.querySelector('#extra-cal-prazo');
    el.solicitar = cont.querySelector('#extra-solicitar');
    el.solicitarTexto = cont.querySelector('#extra-solicitar-texto');
    el.busca = cont.querySelector('#extra-cal-busca');
    el.aviso = cont.querySelector('#extra-cal-aviso');
    el.avisoTitulo = cont.querySelector('#extra-cal-aviso-titulo');
    ultimo = null;
    buscaTermo = '';
    buscaModo = 'marcar';
    if (el.busca && RW.busca) buscaCtrl = RW.busca.criar({ caixa: el.busca, aoBuscar: function (t, m) { buscaTermo = t || ''; buscaModo = m || 'marcar'; aplicarBusca(); } });
    if (el.solicitar) el.solicitar.addEventListener('click', function () { if (RW.extrajornadaSolicitar) RW.extrajornadaSolicitar.abrir(); });
    /* a seleção de unidades do cabeçalho mudou: redesenha com a última resposta */
    if (!ouvinteLigado) {
      ouvinteLigado = true;
      window.addEventListener('rosterwork_units_changed', function () { if (ativo() && ultimo && ultimo.ok) desenhar(ultimo); });
    }
  }

  function ativar() {
    naAba = true;
    comp = RW.extrajornadaMes.obter();
    if (el.busca) el.busca.classList.remove('oculto');
    carregar();
    if (RW.extrajornadaSolicitar) RW.extrajornadaSolicitar.carregar().then(atualizarBarra);
  }
  function desativar() {
    naAba = false;
    if (el.busca) el.busca.classList.add('oculto');
    if (el.solicitar) el.solicitar.classList.add('oculto');
    if (el.selo) el.selo.classList.add('oculto');
    if (buscaCtrl) buscaCtrl.limpar();
  }
  /* o orquestrador trocou o mês */
  function renderMes() { comp = RW.extrajornadaMes.obter(); carregar(); }

  RW.extrajornadaCalendario = { montar: montar, ativar: ativar, desativar: desativar, renderMes: renderMes,
    recarregar: carregar, atualizarBarra: atualizarBarra };
})();
