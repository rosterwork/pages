/* ============================================================
   ESCALAS — De serviço no dia e Tirar do dia (a edição da linha)
   De serviço no dia: o horário de serviço do militar e o Mudar,
   que abre os campos. Do ciclo, o horário só diminui (o pedaço que
   sai vira folga, com a pergunta do banco de horas); o pontual muda
   os horários dele. A extra muda na aba Extrajornada.
   Tirar do dia: só neste dia (o do ciclo fica de folga, com a
   pergunta do banco de horas; o pontual sai, e as horas que ele somou
   saem ou ficam) ou do ciclo, a partir do dia (a lista do que
   acontece com as trocas, folgas e extras, e a confirmação, como o
   Tirar da aba Ciclo). As mudanças de um dia vão ao rascunho do Dia
   (escalas-painel-editar.js); a do ciclo grava pelo ciclo e relê o dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada bloco na tela

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }

  /* os rádios do bloco ganham o mesmo nome (único na tela) e avisam a escolha */
  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-servico-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* o serviço do militar que muda aqui: o pontual (os horários dele) ou o do ciclo e da troca (a extra fica de fora) */
  function servicoDaqui(mil) {
    var H = ed().horas;
    var pont = (ed().rascunho().pontuais || []).filter(function (x) { return x.cpf === mil.cpf; })[0];
    if (pont) return { tipo: 'pontual', periodos: (pont.periodos || []).map(copiar) };
    var daqui = mil.janelas.filter(function (j) { return j.origem !== 'extra'; });
    return { tipo: 'ciclo', periodos: H.uniao(daqui.map(H.faixa)).map(H.periodo) };
  }

  /* ---------- De serviço no dia ---------- */

  /* lugar = onde o bloco entra; aoMudar() = a edição da linha redesenha o que depende dele.
     Devolve { mudou(), erro(), aplicar() } ou null (sem serviço no dia) */
  function servico(lugar, cpf, aoMudar) {
    var api = ed(), H = api.horas;
    lugar.textContent = '';
    var mil = api.militarDoDia(cpf);
    if (!mil) return null;
    var el = RosterWork.tpl('tpl-escala-servico');
    if (!el) return null;
    var daqui = servicoDaqui(mil);
    var original = daqui.periodos;
    var est = { aberto: false, periodos: original.map(copiar), descontar: true };
    var ui = {
      frase: el.querySelector('.escala-servico-frase'), mudar: el.querySelector('.escala-servico-mudar'),
      campos: el.querySelector('.escala-servico-campos'), periodos: el.querySelector('.escala-servico-periodos'),
      regua: el.querySelector('.escala-servico-regua'), folga: el.querySelector('.escala-servico-folga'),
      refaz: el.querySelector('.escala-servico-refaz')
    };
    var janelas = mil.janelas.slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
    el.querySelector('.escala-servico-texto').textContent =
      L().servicoTexto(janelas.map(function (j) { return { hi: H.curta(j.hi), hf: H.curta(j.hf), origem: j.origem }; }));
    /* só extra aqui: muda na aba Extrajornada */
    if (!original.length) { ui.mudar.remove(); ui.mudar = null; }
    else ui.mudar.addEventListener('click', function () { est.aberto = true; desenhar(); if (aoMudar) aoMudar(); });
    var reguaEl = RosterWork.horario.criarRegua('afastada');
    if (reguaEl) ui.regua.appendChild(reguaEl);
    var marcarDesconto = ligarRadios(ui.folga, function (v) { est.descontar = v === 'sim'; });

    /* o horário do ciclo fica dentro do serviço de antes (só diminui) */
    function dentro(per, i) {
      var f = H.faixa(per), w = H.faixa(original[i]);
      return f[1] > f[0] && f[0] >= w[0] && f[1] <= w[1];
    }
    function removidos() {
      if (daqui.tipo !== 'ciclo') return [];
      var validos = est.periodos.filter(dentro).map(H.faixa);
      return H.menos(original.map(H.faixa), validos);
    }
    function minutos(lista) { return lista.reduce(function (s, f) { return s + f[1] - f[0]; }, 0); }
    function mudou() {
      return est.aberto && JSON.stringify(est.periodos) !== JSON.stringify(original);
    }

    /* "Adicionar horário" do pontual: o próximo horário livre depois do último (uma hora) */
    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(est.periodos.map(H.faixa)));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      desenhar(); if (aoMudar) aoMudar();
    }

    function desenhar() {
      ui.frase.classList.toggle('oculto', est.aberto);
      ui.campos.classList.toggle('oculto', !est.aberto);
      ui.regua.classList.toggle('oculto', !est.aberto);
      ui.periodos.textContent = '';
      if (est.aberto) {
        var pontual = daqui.tipo === 'pontual';
        est.periodos.forEach(function (per, i) {
          var linha = RosterWork.horario.linha({
            hi: per.hi, hf: per.hf, erro: !pontual && !dentro(per, i),
            opcoes: pontual ? null : H.opcoesHoras([original[i]]),
            aoInicio: function (h) { per.hi = h; desenhar(); if (aoMudar) aoMudar(); },
            aoFim: function (h) { per.hf = h; desenhar(); if (aoMudar) aoMudar(); },
            aoRemover: pontual && est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); desenhar(); if (aoMudar) aoMudar(); } : null,
            aoAdicionar: pontual && i === 0 ? adicionarPeriodo : null
          });
          if (linha) ui.periodos.appendChild(linha);
        });
        var fora = removidos();
        H.regua(reguaEl, est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf, classe: 'novo' }; })
          .concat(fora.map(function (f) { var p = H.periodo(f); return { hi: p.hi, hf: p.hf, classe: 'vazio' }; })));
      }
      /* o pedaço do ciclo que sai do serviço vira folga: a pergunta do banco de horas */
      var sai = est.aberto ? removidos() : [];
      ui.folga.classList.toggle('oculto', !sai.length);
      if (sai.length) {
        var horas = H.horasTexto(minutos(sai));
        ui.folga.querySelector('.escala-servico-folga-texto').textContent =
          L().folgaParte(H.textoPeriodos(sai.map(H.periodo)), nomeDe(mil), horas);
        ui.folga.querySelector('.escala-servico-folga-sim').textContent = L().descontar(horas);
        marcarDesconto(est.descontar ? 'sim' : 'nao');
      }
      ui.refaz.classList.toggle('oculto', !mudou());
    }

    function erro() {
      if (!mudou()) return '';
      if (daqui.tipo === 'pontual') {
        var fs = est.periodos.map(H.faixa);
        var soma = function (l) { return l.reduce(function (s, f) { return s + f[1] - f[0]; }, 0); };
        return soma(H.uniao(fs)) !== soma(fs) ? L().erroPeriodos : '';
      }
      if (!est.periodos.every(dentro)) return L().erroServico;
      if (cpf === RosterWork.sessao.cpf() && removidos().length) return msg().folgaSiMesmo;
      return '';
    }

    /* no rascunho: o pedaço do ciclo que sai vira folga; o pontual troca os horários (e os ajustes manuais
       que ficaram fora deles saem) */
    function aplicar() {
      if (!mudou()) return;
      if (daqui.tipo === 'ciclo') {
        var sai = removidos();
        if (sai.length) api.darFolga(cpf, est.descontar, sai.map(H.periodo));
        return;
      }
      var r = api.rascunho();
      var salvo = ((api.dados() || {}).pontuais || []).filter(function (x) { return x.cpf === cpf; })[0];
      r.pontuais = r.pontuais.filter(function (x) { return x.cpf !== cpf; })
        .concat([{ cpf: cpf, periodos: est.periodos.map(copiar), contabilizar: !!(salvo && salvo.contabilizado) }]);
      var fora = H.menos(original.map(H.faixa), est.periodos.map(H.faixa));
      if (fora.length) api.cortarAjustes(cpf, fora);
    }

    /* os horários de serviço novos (o horário na função acompanha), ou null sem mudança */
    function novos() {
      if (!mudou()) return null;
      return daqui.tipo === 'ciclo' ? est.periodos.filter(dentro).map(copiar) : est.periodos.map(copiar);
    }

    lugar.appendChild(el);
    desenhar();
    return { mudou: mudou, novos: novos, erro: erro, aplicar: aplicar, aberto: function () { return est.aberto; } };
  }

  /* ---------- Tirar do dia ---------- */

  /* dá para tirar do dia? (só extra aqui: a extra sai pela aba Extrajornada) */
  function podeTirar(cpf) {
    var mil = ed().militarDoDia(cpf);
    if (!mil) return false;
    return mil.pontual || (mil.janelas.length > 0 && !mil.janelas.every(function (j) { return j.origem === 'extra'; }));
  }

  /* a confirmação e a gravação pelo ciclo (o mesmo do Tirar e do Adicionar da aba Ciclo); depois, relê o dia */
  function salvarCiclo(mudancas) {
    var api = ed();
    var uid = api.unidadeId(), iso = api.iso();
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();
    RosterWork.escalasDados.cicloSalvarLote(uid, iso, mudancas).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      var geral = RosterWork.mensagens.geral;
      if (r && r._falha === 'conexao') { RosterWork.avisar({ tipo: 'erro', mensagem: geral.semConexao }); return; }
      if (r && r._falha === 'servidor') { RosterWork.avisar({ tipo: 'erro', mensagem: geral.falhaServidor }); return; }
      if (!r || !r.success) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaSalvar }); return; }
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
      api.recarregar();
    });
  }

  /* a lista do que acontece com as trocas, folgas e extras a partir do dia (escala_ciclo_retirar_analisar) e a
     confirmação; textos = { mensagem, escala, botao }; desde = o dia de onde a lista conta (sem ele, o do painel) */
  function confirmarCiclo(cpf, textos, aoConfirmar, desde) {
    var api = ed();
    var S = RosterWork.mensagens.saida;
    RosterWork.escalasDados.cicloRetirarAnalisar(api.unidadeId(), cpf, desde || api.iso()).then(function (a) {
      if (!a || !a.success) { RosterWork.avisar({ tipo: 'erro', mensagem: (a && a.error) || S.falhaLista }); return; }
      var aviso = RosterWork.avisoSaida(a.pendencias, { tipo: 'tirar', escala: textos.escala });
      RosterWork.confirmar({ tipo: 'aviso', mensagem: textos.mensagem, itens: aviso.itens, nota: aviso.nota,
        textoConfirmar: textos.botao, aoConfirmar: aoConfirmar });
    });
  }

  /* lugar = onde o bloco entra; aoMudar() = a edição da linha acerta o botão de confirmar. Devolve { erro(), aplicar(),
     alcance() } ou null */
  function tirar(lugar, cpf, aoMudar) {
    var api = ed(), H = api.horas;
    lugar.textContent = '';
    var mil = api.militarDoDia(cpf);
    var el = RosterWork.tpl('tpl-escala-tirar');
    if (!mil || !el) return null;
    var data = diaMes(api.iso());
    var est = { alcance: 'dia', banco: 'sim' };
    el.querySelector('.escala-tirar-titulo').textContent = L().tirarDia(nomeDe(mil));
    [].forEach.call(el.querySelectorAll('.escala-tirar-data'), function (s) { s.textContent = RosterWork.data.diaMesExtenso(api.iso()); });
    /* do ciclo, só quem serve pelo ciclo (o pontual, a troca e a extra não): sem ele, as bolinhas nem aparecem */
    var doCiclo = !mil.pontual && mil.janelas.some(function (j) { return !j.origem || j.origem === 'base' || j.origem === 'sistema'; });
    var alcance = el.querySelector('.escala-tirar-alcance');
    if (!doCiclo) alcance.remove();
    else ligarRadios(alcance, function (v) { est.alcance = v; desenhar(); if (aoMudar) aoMudar(); })('dia');
    var banco = el.querySelector('.escala-tirar-banco'), ciclo = el.querySelector('.escala-tirar-ciclo');
    var marcar = ligarRadios(banco, function (v) { est.banco = v; });

    var salvo = ((api.dados() || {}).pontuais || []).filter(function (x) { return x.cpf === cpf; })[0];
    var contabilizado = !!(mil.pontual && api.pontualSalvo(cpf) && salvo && salvo.contabilizado);
    /* quem também serve em outra unidade no dia: a folga vale só nos horários daqui (fora a extra) */
    var daqui = mil.outraUnidade
      ? H.uniao(mil.janelas.filter(function (x) { return x.origem !== 'extra'; }).map(H.faixa)).map(H.periodo)
      : null;
    var janelas = daqui || mil.janelas;
    var min = janelas.reduce(function (s, x) { var f = H.faixa(x); return s + f[1] - f[0]; }, 0);

    function desenhar() {
      var mostraBanco = est.alcance === 'dia' && (!mil.pontual || contabilizado);
      banco.classList.toggle('oculto', !mostraBanco);
      ciclo.classList.toggle('oculto', est.alcance !== 'ciclo');
      if (mostraBanco) {
        if (mil.pontual) {
          var hp = H.horasTexto(salvo.minutos);
          banco.querySelector('.escala-tirar-banco-texto').textContent = L().tirarPontualTexto(nomeDe(mil), hp);
          banco.querySelector('.escala-tirar-banco-sim').textContent = L().tirarPontualSim(hp);
          banco.querySelector('.escala-tirar-banco-nao').textContent = L().tirarPontualNao;
        } else {
          var h = H.horasTexto(min);
          banco.querySelector('.escala-tirar-banco-texto').textContent = L().tirarFolga(nomeDe(mil), data, h);
          banco.querySelector('.escala-tirar-banco-sim').textContent = L().descontar(h);
          banco.querySelector('.escala-tirar-banco-nao').textContent = L().naoDescontar;
        }
        marcar(est.banco);
      }
    }

    function erro() {
      if (est.alcance === 'dia' && !mil.pontual && cpf === RosterWork.sessao.cpf()) return msg().folgaSiMesmo;
      return '';
    }

    function aplicar() {
      if (est.alcance === 'ciclo') {
        confirmarCiclo(cpf, {
          mensagem: msg().confirmarTirar.replace('{pessoa}', nomeDe(mil)).replace('{data}', api.iso().split('-').reverse().join('/')),
          escala: RosterWork.mensagens.saida.escalaTirar, botao: msg().btnTirar
        }, function () { salvarCiclo([{ cpf: cpf, acao: 'tirar' }]); });
        return;
      }
      api.mudar(function () {
        if (mil.pontual) api.tirarPontual(cpf, contabilizado && est.banco === 'sim');
        else api.darFolga(cpf, est.banco === 'sim', daqui);
      });
    }

    lugar.appendChild(el);
    desenhar();
    return { erro: erro, aplicar: aplicar, alcance: function () { return est.alcance; } };
  }

  window.RosterWork.escalasPainelServico = {
    servico: servico, tirar: tirar, podeTirar: podeTirar, salvarCiclo: salvarCiclo, confirmarCiclo: confirmarCiclo
  };
})();
