/* ============================================================
   INÍCIO — dashboard por perfil
   Uma chamada (inicio_painel) traz os indicadores do usuário:
   próximo serviço, horas da semana, saldo de folgas, próxima
   extra e próximas férias; para o admin, as pendências de
   administração (trocas/folgas/solicitações a decidir). Abaixo, os
   avisos do contexto (com Novo aviso do admin). Só clona moldes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];


  function dataDeIso(iso) { var p = String(iso).split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function ddmm(iso) { var d = dataDeIso(iso); return d ? d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2) : String(iso || ''); }

  /* "Hoje"/"Amanhã" ou "seg, 6 jul" */
  function quando(iso) {
    var d = dataDeIso(iso); if (!d) return '';
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dias = Math.round((d - hoje) / 86400000);
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Amanhã';
    return DIAS[d.getDay()].slice(0, 3) + ', ' + d.getDate() + ' ' + MESES[d.getMonth()];
  }

  /* minutos -> "24h" / "1h30" / "0h" (aceita negativo) */

  /* clona um KPI e preenche rótulo/valor/detalhe */
  function kpi(cont, rotulo, valor, detalhe) {
    var el = RosterWork.tpl('tpl-inicio-kpi');
    if (!el) return;
    el.querySelector('.inicio-kpi-rotulo').textContent = rotulo;
    el.querySelector('.inicio-kpi-valor').textContent = valor;
    var d = el.querySelector('.inicio-kpi-detalhe');
    if (detalhe) d.textContent = detalhe; else d.classList.add('oculto');
    cont.appendChild(el);
  }

  function cardProximoServico(cont, s) {
    if (!s) { kpi(cont, 'Próximo serviço', 'Sem serviço agendado', ''); return; }
    var det = ['das ' + (s.horario_inicio || '') + ' às ' + (s.horario_fim || ''), [s.funcao, s.posto].filter(Boolean).join(' · ')].filter(Boolean).join(', ');
    kpi(cont, 'Próximo serviço', quando(s.data), det);
  }

  function cardHoras(cont, hs) {
    var feito = (hs && hs.trabalhadas_min) || 0, falta = (hs && hs.a_trabalhar_min) || 0, total = feito + falta;
    var el = RosterWork.tpl('tpl-inicio-horas');
    if (!el) { kpi(cont, 'Horas na semana', RosterWork.tempo.horasComSinal(total)); return; }
    var barra = el.querySelector('.inicio-horas-feito');
    var pct = total > 0 ? Math.round((feito / total) * 100) : 0;
    if (barra) barra.style.setProperty('--pct', pct + '%');
    el.querySelector('.inicio-horas-legenda').textContent = total > 0
      ? (RosterWork.tempo.horasComSinal(feito) + ' feitas · ' + RosterWork.tempo.horasComSinal(falta) + ' a fazer')
      : 'Nenhuma hora esta semana';
    cont.appendChild(el);
  }

  function cardSaldo(cont, min) { kpi(cont, 'Saldo de folgas', RosterWork.tempo.horasComSinal(min || 0), (min || 0) < 0 ? 'negativo' : ''); }

  function cardExtra(cont, ex) {
    if (!ex) { kpi(cont, 'Próxima extra', 'Nenhuma', ''); return; }
    kpi(cont, 'Próxima extra', quando(ex.data), ex.blocos + (ex.blocos > 1 ? ' blocos' : ' bloco') + ' de 6h');
  }

  function cardFerias(cont, f) {
    if (!f) { kpi(cont, 'Próximas férias', 'Nenhuma', ''); return; }
    kpi(cont, 'Próximas férias', ddmm(f.inicio) + ' a ' + ddmm(f.fim), '');
  }

  function irPara(pagina, aba) { if (RW.irParaPagina) RW.irParaPagina(pagina, aba); }

  /* card de pendências de administração: linhas com contagem que abrem a tela */
  function cardPendencias(cont, p) {
    if (!p) return;
    var el = RosterWork.tpl('tpl-inicio-pend');
    if (!el) return;
    var linhas = el.querySelector('.inicio-pend-linhas');
    var defs = [
      { n: p.trocas, txt: 'Trocas a aprovar', ir: function () { irPara('trocas', 'pendentes'); } },
      { n: p.folgas, txt: 'Folgas a aprovar', ir: function () { irPara('folgas', 'aprovacoes'); } },
      { n: p.solicitacoes, txt: 'Correções de dados', ir: function () { irPara('usuarios', 'aprovacoes'); } },
      { n: p.fora_escala, txt: 'Militares fora da escala', ir: function () { irPara('avisos', 'administracao'); } }
    ];
    var algum = false;
    defs.forEach(function (d) {
      if (!d.n) return;
      algum = true;
      var l = RosterWork.tpl('tpl-inicio-pend-linha');
      if (!l) return;
      l.querySelector('.inicio-pend-texto').textContent = d.txt;
      l.querySelector('.inicio-pend-conta').textContent = d.n;
      l.addEventListener('click', d.ir);
      linhas.appendChild(l);
    });
    if (!algum) {
      var vazio = RosterWork.tpl('tpl-inicio-vazio');
      if (vazio) { vazio.textContent = RW.mensagens.inicio.nadaPendente; linhas.appendChild(vazio); }
    }
    cont.appendChild(el);
  }

  function montarCards(cont, painel) {
    cont.textContent = '';
    cardProximoServico(cont, painel.proximo_servico);
    cardHoras(cont, painel.horas_semana);
    cardSaldo(cont, painel.saldo_folgas_min);
    cardExtra(cont, painel.proxima_extra);
    cardFerias(cont, painel.proximas_ferias);
    if (painel.is_admin) cardPendencias(cont, painel.pendencias);
  }

  /* ---------- avisos ---------- */
  function vazio(container, texto) { container.textContent = ''; var el = RosterWork.tpl('tpl-inicio-vazio'); if (el) { el.textContent = texto; container.appendChild(el); } }

  function montarAvisos(container, avisos) {
    if (!avisos.length) { vazio(container, RW.mensagens.avisos.semComunicados); return; }
    container.textContent = '';
    var admin = !!(RW.inicioAviso && RW.inicioAviso.ehAdmin && RW.inicioAviso.ehAdmin());
    avisos.forEach(function (a) {
      var el = RosterWork.tpl('tpl-inicio-aviso');
      if (!el) return;
      el.querySelector('.inicio-aviso-titulo').textContent = a.titulo || 'Comunicado';
      el.querySelector('.inicio-aviso-msg').textContent = a.mensagem || '';
      var remover = el.querySelector('.inicio-aviso-remover');
      if (remover && admin && a.aviso_id) {
        remover.classList.remove('oculto');
        remover.addEventListener('click', function () { RW.inicioAviso.desativar(a.aviso_id, carregarAvisos); });
      }
      container.appendChild(el);
    });
  }

  function carregarAvisos() {
    var u = RosterWork.sessao.perfil();
    var cont = document.getElementById('inicio-avisos');
    if (!u || !cont || !RW.apiFetch) return;
    RW.apiFetch('/rest/v1/rpc/fn_avisos_listar', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (a) { montarAvisos(cont, Array.isArray(a) ? a : []); })
      .catch(function () { vazio(cont, RW.mensagens.inicio.falhaCarregar); });
  }

  function iniciar() {
    var u = RosterWork.sessao.perfil();
    if (!u || !u.ok) return Promise.resolve();

    var saud = document.getElementById('inicio-saudacao');
    if (saud) saud.textContent = 'Olá, ' + ((u.grau_abreviacao || '') + ' ' + (u.nome_de_guerra || '')).trim() + '.';

    var cards = document.getElementById('inicio-cards');
    if (cards) vazio(cards, RW.mensagens.inicio.carregando);

    if (!RW.apiFetch || !RW.obterToken || !RW.obterToken()) return Promise.resolve();

    RW.apiFetch('/rest/v1/rpc/inicio_painel', { metodo: 'POST', corpo: { p_cpf: u.cpf } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (p) { if (cards && p && p.ok) montarCards(cards, p); else if (cards) vazio(cards, RW.mensagens.inicio.falhaCarregar); })
      .catch(function () { if (cards) vazio(cards, RW.mensagens.inicio.falhaCarregar); });

    carregarAvisos();

    var btnNovoAviso = document.getElementById('btn-novo-aviso');
    if (btnNovoAviso && RW.inicioAviso && RW.inicioAviso.ehAdmin()) {
      btnNovoAviso.classList.remove('oculto');
      btnNovoAviso.addEventListener('click', function () { RW.inicioAviso.abrirNovo(carregarAvisos); });
    }

    return Promise.resolve();
  }

  RW.paginas.inicio = { iniciar: iniciar };
})();
