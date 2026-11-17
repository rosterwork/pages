/* ============================================================
   OP. VERÃO — a célula e o título do dia da grade
   Na página Op. Verão, a célula da Escala (escalas-celula.js) mostra
   só a Op. Verão do dia: cada leitura do mês (escalas-dados.js) traz
   a chave "op_verao" nos dias do período ({ companhia_id, turnos,
   postos, linhas }) e ela fica guardada aqui. Na célula, os
   guarda-vidas por posto (o título de cada posto, na ordem dos
   Ajustes, e por último o Sem posto, em amarelo, com quantos), cada
   um na linha da grade, com o ícone da boia; o dia do período sem
   ninguém mostra a frase; fora do período, a célula fica vazia. No
   título do dia, no lugar do Oficial de Área, os Oficiais de Praia
   (um embaixo do outro, com o horário) ou o "Sem Oficial de Praia".
   Quem está afastado ou de serviço na escala no mesmo horário fica
   com o nome em vermelho e o porquê na dica.
   A mudança ainda não salva (op-verao-rascunho.js) aparece na hora,
   com a borda tracejada do dia. Não cria HTML (clona os moldes do
   escalas.html) nem escreve estilo.
   RosterWork.opVeraoCelula.{ ativa, guardar, preencher,
   preencherTitulo, doDia, companhia, linhasDoDia, gravadas, rascunho, temRascunho,
   colunas, pode, limite, limpar, diasComRascunho, gravou, esperarLeitura }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var guardado = {};            // 'unidade|dia' -> o dia da Op. Verão, como o banco manda
  var rascunhos = {};           // 'companhia|dia' -> as linhas do dia ainda não salvas
  var pendentes = {};           // 'companhia|dia' já gravados: o rascunho fica na tela até a leitura nova chegar
  var esperas = [];             // quem espera a próxima leitura do mês (o Salvar)
  var curtoDa = new WeakMap();  // a célula -> o posto curto das células pequenas (para refazer com o rascunho)
  var naTela = [];              // as unidades da grade (op-verao.js), para o título do dia
  var mostra = {};              // unidade -> a companhia da Operação Verão que ela mostra na última leitura

  function msg() { return RW.mensagens.opVerao; }
  function curta(t) { return RW.horario.curta(t); }

  /* a página aberta é a Op. Verão */
  function ativa() { return !!(RW.paginaAtual && RW.paginaAtual() === 'op-verao'); }

  /* o administrador da companhia mexe */
  function pode(cia) { return !!RW.sessao && RW.sessao.podeAdministrar('companhia', cia); }

  /* o dia mais antigo que se mexe (hoje − 7, como no banco) */
  function limite() {
    var h = new Date();
    return RW.data.paraIsoDeData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 7));
  }

  /* a leitura do mês, { unidade: { dia: { ..., op_verao } } }: o dia sem a chave está fora do período. Cada linha ganha a
     chave (o id do lançamento), que o rascunho usa para achá-la */
  function guardar(grade) {
    Object.keys(grade || {}).forEach(function (uid) {
      var dias = grade[uid] || {};
      delete mostra[uid];
      Object.keys(dias).forEach(function (iso) {
        var s = dias[iso] && dias[iso].op_verao;
        if (!s) { delete guardado[uid + '|' + iso]; return; }
        mostra[uid] = s.companhia_id;
        (s.linhas || []).forEach(function (l) { l.chave = l.id; });
        guardado[uid + '|' + iso] = s;
        var k = s.companhia_id + '|' + iso;
        if (pendentes[k]) { delete pendentes[k]; delete rascunhos[k]; }
      });
    });
    var e = esperas;
    esperas = [];
    e.forEach(function (fn) { fn(); });
  }

  function doDia(uid, iso) { return guardado[uid + '|' + iso] || null; }

  /* a companhia da Operação Verão que a unidade mostra no mês lido por último; null: nenhuma */
  function companhia(uid) { return mostra[uid] == null ? null : mostra[uid]; }

  /* o dia guardado da companhia (de qualquer unidade dela) */
  function daCompanhia(cia, iso) {
    var chave = Object.keys(guardado).filter(function (k) {
      return k.split('|')[1] === iso && String(guardado[k].companhia_id) === String(cia);
    })[0];
    return chave ? guardado[chave] : null;
  }

  /* as linhas gravadas e as de agora (com o rascunho) do dia da companhia */
  function gravadas(cia, iso) { var s = daCompanhia(cia, iso); return (s && s.linhas) || []; }
  function linhasDoDia(cia, iso) { return rascunhos[cia + '|' + iso] || gravadas(cia, iso); }
  function temRascunho(cia, iso) { var k = cia + '|' + iso; return !!rascunhos[k] && !pendentes[k]; }

  /* os dias com mudança não salva: [{ cia, iso }] */
  function diasComRascunho() {
    return Object.keys(rascunhos).filter(function (k) { return !pendentes[k]; }).map(function (k) {
      var p = k.split('|');
      return { cia: p[0], iso: p[1] };
    });
  }

  /* o dia foi gravado: a mudança fica na tela até a leitura nova trazer o gravado (e sai do rodapé já) */
  function gravou(cia, iso) { if (rascunhos[cia + '|' + iso]) pendentes[cia + '|' + iso] = true; }

  /* a próxima leitura do mês chegou (o Salvar espera a grade nova) */
  function esperarLeitura() { return new Promise(function (r) { esperas.push(r); }); }

  /* as unidades da grade, uma por companhia (op-verao.js › colunas) */
  function colunas(lista) { naTela = lista || []; }

  /* ---------- a célula ---------- */

  /* o porquê do nome em vermelho */
  function dicaConflito(c) {
    if (!c) return '';
    if (c.tipo === 'afastado') return msg().conflito.afastado(c.nome || '', RW.data.isoParaBR(c.ate).slice(0, 5));
    return msg().conflito.servico(c.unidade || '', curta(c.inicio), curta(c.fim));
  }

  /* a linha de um guarda-vidas: a mesma da grade, com a origem "op-verao" (o ícone da boia e a situação do filtro) */
  function linha(l, curto) {
    var el = RW.escalasCelula.montarPessoa({ cpf: l.cpf || null, grad: l.grad, nome: l.nome, nome_completo: l.nome_completo,
      origem: 'op-verao', periodos: [{ inicio: l.inicio, fim: l.fim }] }, curto, null);
    if (!el) return null;
    el.setAttribute('data-op-verao', l.chave);
    if (l.conflito) {
      el.classList.add('linha-escalado--op-verao-conflito');
      el.setAttribute('data-dica', dicaConflito(l.conflito));
    }
    return el;
  }

  /* o título de um posto (sem: o Sem posto, em amarelo) e as linhas dele, na ordem do horário */
  function bloco(celula, titulo, linhas, curto, sem) {
    var t = RW.tpl('tpl-op-verao-posto');
    if (!t) return;
    t.textContent = titulo;
    if (sem) t.classList.add('op-verao-posto--sem');
    celula.appendChild(t);
    linhas.slice().sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0; })
      .forEach(function (l) { var el = linha(l, curto); if (el) celula.appendChild(el); });
  }

  /* o miolo da célula (curto: o posto curto das células pequenas): os postos dos Ajustes na ordem deles, depois um posto
     que saiu dos Ajustes e ainda tem gente no dia, e o Sem posto */
  function preencher(celula, curto) {
    celula.textContent = '';
    curtoDa.set(celula, !!curto);
    var iso = celula.dataset.iso, s = doDia(celula.dataset.unidadeId, iso);
    celula.classList.toggle('op-verao-celula--edita', !!s && pode(s.companhia_id));
    celula.classList.toggle('escala-celula--nao-salvo', !!s && temRascunho(s.companhia_id, iso));
    if (!s) return;
    var todas = linhasDoDia(s.companhia_id, iso).filter(function (l) { return !l.oficial; });
    if (!todas.length) {
      var vazio = RW.tpl('tpl-op-verao-vazio');
      if (vazio) celula.appendChild(vazio);
      return;
    }
    var postos = (s.postos || []).map(function (p) { return { id: p.id, nome: p.nome }; });
    todas.forEach(function (l) {
      if (l.posto_id && !postos.some(function (p) { return p.id === l.posto_id; })) postos.push({ id: l.posto_id, nome: l.posto_nome || '' });
    });
    postos.forEach(function (p) {
      var deles = todas.filter(function (l) { return l.posto_id === p.id; });
      if (deles.length) bloco(celula, p.nome, deles, curto, false);
    });
    var sem = todas.filter(function (l) { return !l.posto_id; });
    if (sem.length) bloco(celula, msg().semPosto(sem.length), sem, curto, true);
  }

  /* ---------- o título do dia ---------- */

  /* um Oficial de Praia (l; null: o "Sem Oficial de Praia") no título: de que companhia, dia e linha ele é, e a mão para
     quem mexe */
  function oficial(cia, iso, l) {
    var no = RW.tpl(l ? 'tpl-op-verao-oficial' : 'tpl-op-verao-sem-oficial');
    if (!no) return null;
    if (l) {
      no.querySelector('.escala-oficial-grad').textContent = l.grad || '';
      no.querySelector('.escala-oficial-nome').textContent = l.nome || '';
      no.querySelector('.op-verao-oficial-hora').textContent = msg().horas(curta(l.inicio), curta(l.fim));
      no.setAttribute('data-op-verao', l.chave);
      if (l.conflito) {
        no.classList.add('op-verao-oficial--conflito');
        no.setAttribute('data-dica', dicaConflito(l.conflito));
      }
    }
    no.setAttribute('data-companhia', cia);
    no.setAttribute('data-iso', iso);
    no.classList.toggle('escala-oficial--edita', pode(cia));
    no.classList.toggle('escala-oficial--nao-salvo', temRascunho(cia, iso));
    return no;
  }

  /* no lugar do Oficial de Área (escalas-celula.js › preencherOficial): os Oficiais de Praia de cada companhia da grade no
     dia do período, ou o "Sem Oficial de Praia". Devolve se o lugar ficou à vista */
  function preencherTitulo(lugar, iso) {
    if (!lugar) return false;
    lugar.textContent = '';
    lugar.setAttribute('data-op-verao-iso', iso);
    var feitas = {};
    naTela.forEach(function (c) {
      var s = doDia(c.id, iso);
      if (!s || feitas[s.companhia_id]) return;
      feitas[s.companhia_id] = true;
      var ofs = linhasDoDia(s.companhia_id, iso).filter(function (l) { return l.oficial; });
      (ofs.length ? ofs : [null]).forEach(function (l) {
        var no = oficial(s.companhia_id, iso, l);
        if (no) lugar.appendChild(no);
      });
    });
    var tem = !!lugar.firstChild;
    lugar.classList.toggle('oculto', !tem);
    return tem;
  }

  /* ---------- o rascunho ---------- */

  /* o rascunho do dia da companhia mudou (linhas: as de agora; null: volta o gravado): refaz as células e o título do dia */
  function rascunho(cia, iso, linhas) {
    delete pendentes[cia + '|' + iso];
    if (linhas) rascunhos[cia + '|' + iso] = linhas;
    else delete rascunhos[cia + '|' + iso];
    Array.prototype.forEach.call(document.querySelectorAll('.conteudo .escala-mes-celula[data-iso="' + iso + '"]'), function (cel) {
      var s = doDia(cel.dataset.unidadeId, iso);
      if (s && String(s.companhia_id) === String(cia)) preencher(cel, curtoDa.get(cel));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.conteudo [data-op-verao-iso="' + iso + '"]'), function (lugar) {
      preencherTitulo(lugar, iso);
    });
  }

  /* a página abre limpa (o que não foi salvo ficou para trás) */
  function limpar() { rascunhos = {}; pendentes = {}; }

  RW.opVeraoCelula = { ativa: ativa, guardar: guardar, preencher: preencher, preencherTitulo: preencherTitulo, doDia: doDia,
    companhia: companhia, linhasDoDia: linhasDoDia, gravadas: gravadas, rascunho: rascunho, temRascunho: temRascunho, colunas: colunas, pode: pode,
    limite: limite, limpar: limpar, diasComRascunho: diasComRascunho, gravou: gravou, esperarLeitura: esperarLeitura };
})();
