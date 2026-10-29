/* ============================================================
   NOVA EXTRA — o painel do pedido
   Sim ou Não; de 1 a 10 cotas (só 24 h = 4 ou 8); os dias pelo
   "pincel" Quero / Não quero (toque de novo desmarca); os dias
   ocupados travados com o motivo; para o administrativo, o horário
   em que a extra pode começar em cada dia (o expediente da unidade
   dele) e as folgas do expediente. Enviar = nova_extra_pedido_salvar
   (o banco confere tudo de novo). Fora do prazo, só leitura.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraPedido.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INICIO = ['08h', '14h', '20h', '02h'];

  var ed = null;        // o pedido aberto: { v, inicial, r, ... }
  var guardaLigada = false;

  function msg() { return RW.mensagens.novaExtra; }
  function dados(v) { return JSON.stringify({ vol: v.vol, cotas: v.cotas, so24: v.so24, dias: v.dias }); }
  function sujo() { return !!(ed && !ed.leitura && dados(ed.v) !== ed.inicial); }
  function contar(tipo) { return Object.keys(ed.v.dias).filter(function (k) { return ed.v.dias[k] === tipo; }).length; }

  function valido() {
    var v = ed.v;
    if (v.vol === false) return true;
    if (v.vol !== true || v.cotas < 1 || v.cotas > 10 || (v.so24 && v.cotas !== 4 && v.cotas !== 8)) return false;
    var q = contar('quer');
    return q >= ed.r.min_datas && contar('nao_posso') <= 10;
  }

  function atualizar() {
    var v = ed.v, f = ed.f;
    Array.prototype.forEach.call(f.querySelectorAll('[data-vol]'), function (b) {
      b.classList.toggle('aba--ativa', (b.getAttribute('data-vol') === 'sim') === v.vol && v.vol !== null);
    });
    Array.prototype.forEach.call(f.querySelectorAll('[data-so-voluntario]'), function (s) { s.classList.toggle('oculto', v.vol !== true); });
    Array.prototype.forEach.call(f.querySelectorAll('.nova-extra-cota'), function (b) {
      var n = +b.textContent;
      b.classList.toggle('nova-extra-cota--on', n === v.cotas);
      b.disabled = ed.leitura || (v.so24 && n !== 4 && n !== 8);
    });
    var b24 = f.querySelector('#nova-extra-24h');
    b24.setAttribute('aria-checked', v.so24 ? 'true' : 'false');
    b24.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', v.so24);
    Array.prototype.forEach.call(f.querySelectorAll('[data-pincel]'), function (b) {
      b.classList.toggle('nova-extra-pincel-op--on', b.getAttribute('data-pincel') === v.pincel);
    });
    Array.prototype.forEach.call(f.querySelectorAll('[data-ver]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-ver') === ed.ver); });
    Array.prototype.forEach.call(f.querySelectorAll('[data-onde]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-onde') === ed.onde); });
    f.querySelector('#nova-extra-onde-linha').classList.toggle('oculto', ed.ver === 'meus');
    Array.prototype.forEach.call(f.querySelectorAll('.nova-extra-dia[data-dia]'), function (b) {
      var dia = b.getAttribute('data-dia'), t = v.dias[dia], txt = b.querySelector('.nova-extra-dia-texto'), n;
      b.classList.toggle('nova-extra-dia--quer', t === 'quer');
      b.classList.toggle('nova-extra-dia--nao', t === 'nao_posso');
      txt.classList.toggle('nova-extra-dia-texto--falta', ed.ver === 'falta');
      if (ed.ver === 'falta') { n = contagem(ed.r.falta, dia); txt.textContent = n ? msg().falta(n) : ''; }
      else if (ed.ver === 'procura') txt.textContent = msg().querem(contagem(ed.r.procura, dia));
      else if (t) txt.textContent = t === 'quer' ? msg().quero : msg().naoQuero;
      else txt.textContent = b.getAttribute('data-texto') || '';
    });
    f.querySelector('#nova-extra-conta-quer').textContent = msg().contaQuer(contar('quer'));
    f.querySelector('#nova-extra-conta-nao').textContent = msg().contaNao(contar('nao_posso'));
    if (ed.btn) ed.btn.disabled = !valido() || (!sujo() && !!ed.r.pedido);
  }

  /* a falta ou a procura do dia na unidade escolhida no "Onde" (Todos = a soma das unidades) */
  function contagem(mapa, dia) {
    if (!mapa) return 0;
    if (ed.onde !== 'todos') return (mapa[ed.onde] && mapa[ed.onde][dia]) || 0;
    return Object.keys(mapa).reduce(function (s, u) { return s + ((mapa[u] && mapa[u][dia]) || 0); }, 0);
  }

  /* o texto de cada dia livre do administrativo: desde que horas, ou o nome da folga do expediente */
  function textoAdm(e) {
    if (!e) return '';
    if (e.livres.length && e.livres.length < 4) return msg().desde(INICIO[e.livres[0] - 1]);
    if (!e.trabalha && e.motivo !== 'fim_de_semana') return e.nome || msg().folga;
    return '';
  }

  function abrir(r, comp, cpf, aoSalvar) {
    var ped = r.pedido;
    var v = { vol: ped ? ped.voluntario : null, cotas: ped ? ped.cotas : 0, so24: ped ? ped.so_24h : false, dias: {}, pincel: 'quer' };
    if (ped) {
      ped.quer.forEach(function (d) { v.dias[d] = 'quer'; });
      ped.nao_posso.forEach(function (d) { v.dias[d] = 'nao_posso'; });
    }
    var mes = comp.toLocaleDateString('pt-BR', { month: 'long' });
    ed = { v: v, inicial: dados(v), r: r, leitura: r.prazo.estado !== 'aberto', btn: null };
    RW.painel.abrir({
      titulo: msg().tituloPainel(mes),
      subtitulo: r.em_nome ? r.militar.grad + ' ' + r.militar.nome : msg().prazoPainel(r.prazo.fecha.slice(8, 10) + '/' + r.prazo.fecha.slice(5, 7)),
      aoFechar: function () { ed = null; },
      aoTentarFechar: function () { if (!sujo()) return false; tentarFechar(); return true; }
    });
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }

    var f = RW.tpl('tpl-nova-extra-pedido');
    ed.f = f;
    f.querySelector('#nova-extra-q-vol').textContent = msg().perguntaVol(mes);
    Array.prototype.forEach.call(f.querySelectorAll('[data-vol]'), function (b) {
      b.disabled = ed.leitura;
      b.addEventListener('click', function () { v.vol = b.getAttribute('data-vol') === 'sim'; atualizar(); });
    });
    var cotas = f.querySelector('#nova-extra-cotas');
    for (var n = 1; n <= 10; n++) {
      var c = RW.tpl('tpl-nova-extra-cota');
      c.textContent = n;
      c.addEventListener('click', function (ev) { v.cotas = +ev.currentTarget.textContent; atualizar(); });
      cotas.appendChild(c);
    }
    var b24 = f.querySelector('#nova-extra-24h');
    b24.disabled = ed.leitura;
    b24.addEventListener('click', function () {
      v.so24 = !v.so24;
      if (v.so24 && v.cotas !== 4 && v.cotas !== 8) v.cotas = v.cotas > 8 ? 8 : 4;   // desce para a opção de 24 h logo abaixo (abaixo de 4, fica 4)
      atualizar();
    });
    Array.prototype.forEach.call(f.querySelectorAll('[data-pincel]'), function (b) {
      b.disabled = ed.leitura;
      b.addEventListener('click', function () { v.pincel = b.getAttribute('data-pincel'); atualizar(); });
    });

    /* Ver (Meus dias · Falta gente · Quantos querem) e Onde (Todos e as unidades; abre na do militar) */
    ed.ver = 'meus';
    ed.onde = (r.unidades || []).some(function (u) { return u.id === r.militar.unidade_id; }) ? String(r.militar.unidade_id) : 'todos';
    var onde = f.querySelector('#nova-extra-onde');
    (r.unidades || []).forEach(function (u) {
      var o = RW.tpl('tpl-nova-extra-onde');
      o.textContent = u.nome;
      o.setAttribute('data-onde', String(u.id));
      onde.appendChild(o);
    });
    Array.prototype.forEach.call(f.querySelectorAll('[data-ver]'), function (b) {
      b.addEventListener('click', function () { ed.ver = b.getAttribute('data-ver'); atualizar(); });
    });
    Array.prototype.forEach.call(onde.querySelectorAll('[data-onde]'), function (b) {
      b.addEventListener('click', function () { ed.onde = b.getAttribute('data-onde'); atualizar(); });
    });

    var adm = r.militar.setor === 'Administrativo' && r.expediente;
    f.querySelector('#nova-extra-nota-adm').classList.toggle('oculto', !adm);
    var cal = f.querySelector('#nova-extra-cal');
    var dia1 = new Date(comp.getFullYear(), comp.getMonth(), 1);
    var ultimo = new Date(comp.getFullYear(), comp.getMonth() + 1, 0).getDate();
    for (var i = 0; i < dia1.getDay(); i++) cal.appendChild(RW.tpl('tpl-nova-extra-dia-vazio'));
    for (var d = 1; d <= ultimo; d++) {
      var k = r.competencia.slice(0, 8) + String(d).padStart(2, '0');
      var b = RW.tpl('tpl-nova-extra-dia');
      b.setAttribute('data-dia', k);
      b.querySelector('.nova-extra-dia-num').textContent = d;
      var oc = r.bloqueados[k];
      if (oc) {
        b.disabled = true;
        b.classList.add('nova-extra-dia--ocupado');
        b.removeAttribute('data-dia');
        b.querySelector('.nova-extra-dia-texto').textContent = msg().motivos[oc] || '';
      } else {
        var e = adm ? r.expediente[k] : null;
        if (e && !e.livres.length) {
          b.disabled = true;
          b.classList.add('nova-extra-dia--ocupado');
          b.removeAttribute('data-dia');
          b.querySelector('.nova-extra-dia-texto').textContent = msg().expediente;
        } else {
          b.setAttribute('data-texto', textoAdm(e));
          b.disabled = ed.leitura;
          b.addEventListener('click', function (ev) {
            var dia = ev.currentTarget.getAttribute('data-dia');
            if (v.dias[dia] === v.pincel) delete v.dias[dia]; else v.dias[dia] = v.pincel;
            atualizar();
          });
        }
      }
      cal.appendChild(b);
    }
    var ajudaDias = f.querySelector('#nova-extra-ajuda-dias');
    ajudaDias.textContent = msg().ajudaDias(r.min_datas);
    ajudaDias.classList.toggle('oculto', !r.min_datas);
    f.querySelector('#nova-extra-termo').textContent = ped && ped.termo ? msg().termoRecebido(ped.termo_em) : msg().termoPendente;
    RW.painel.corpo().appendChild(f);

    var rodape = RW.painel.rodape();
    rodape.appendChild(document.getElementById('tpl-nova-extra-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    rodape.querySelector('#nova-extra-cancelar').addEventListener('click', tentarFechar);
    ed.btn = rodape.querySelector('#nova-extra-enviar');
    if (ed.leitura) ed.btn.classList.add('oculto');
    ed.btn.addEventListener('click', function () { enviar(comp, cpf, aoSalvar); });
    atualizar();
  }

  function tentarFechar() {
    if (!sujo()) { RW.painel.fechar(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.sairSemSalvar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { ed = null; RW.painel.fechar(); }
    });
  }

  function enviar(comp, cpf, aoSalvar) {
    var v = ed.v, btn = ed.btn;
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_pedido_salvar', {
      p_competencia: ed.r.competencia, p_voluntario: v.vol, p_cotas: v.vol ? v.cotas : 0, p_so_24h: !!(v.vol && v.so24),
      p_datas: v.vol ? Object.keys(v.dias).sort().map(function (k) { return { data: k, tipo: v.dias[k] }; }) : [],
      p_cpf: cpf
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      ed = null;
      RW.painel.fechar();
      aoSalvar();
    }, function (e) {
      RW.pararCarregando(btn);
      RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao });
    });
  }

  RW.novaExtraPedido = { abrir: abrir };
})();
