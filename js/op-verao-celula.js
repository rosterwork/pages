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
   com a borda tracejada do dia. O Imprimir da página leva o mesmo
   dia para a folha (paraImpressao: os postos e os Oficiais de Praia,
   montados pelo mesmo código da tela).
   Na Escala (o arquivo carrega com ela), a mesma leitura desenha o
   grupo da Operação Verão embaixo do Sobreaviso (grupo), só na
   unidade marcada no Ajustes › Op. Verão › Onde aparece (o "exibe"
   do banco): só os nomes, com a boia; a folha da grade leva o mesmo
   (naFolha). Não cria HTML (clona os moldes do escalas.html) nem
   escreve estilo.
   RosterWork.opVeraoCelula.{ ativa, guardar, preencher, grupo, naFolha,
   preencherTitulo, paraImpressao, doDia, companhia, linhasDoDia, gravadas, rascunho, temRascunho,
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

  /* o título de um posto (sem: o Sem posto, em amarelo) e as linhas dele */
  function bloco(celula, titulo, linhas, curto, sem) {
    var t = RW.escalasCelulaGrupos.tituloPosto(titulo, sem);
    if (!t) return;
    celula.appendChild(t);
    linhas.forEach(function (l) { var el = linha(l, curto); if (el) celula.appendChild(el); });
  }

  /* os postos do dia s com quem está neles (as linhas de agora, com o rascunho): os postos dos Ajustes na ordem deles,
     depois um posto que saiu dos Ajustes e ainda tem gente no dia, e o Sem posto (o título com quantos); dentro do posto,
     na ordem do horário. [{ nome, sem, linhas }]; ninguém no dia: []. A célula da tela e a da folha (paraImpressao) */
  function postosDoDia(s, linhas) {
    var todas = linhas.filter(function (l) { return !l.oficial; });
    var postos = (s.postos || []).map(function (p) { return { id: p.id, nome: p.nome }; });
    todas.forEach(function (l) {
      if (l.posto_id && !postos.some(function (p) { return p.id === l.posto_id; })) postos.push({ id: l.posto_id, nome: l.posto_nome || '' });
    });
    function porHorario(lista) { return lista.sort(function (a, b) { return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0; }); }
    var saida = [];
    postos.forEach(function (p) {
      var deles = todas.filter(function (l) { return l.posto_id === p.id; });
      if (deles.length) saida.push({ nome: p.nome, sem: false, linhas: porHorario(deles) });
    });
    var sem = todas.filter(function (l) { return !l.posto_id; });
    if (sem.length) saida.push({ nome: RW.mensagens.escala.semPosto(sem.length), sem: true, linhas: porHorario(sem) });
    return saida;
  }

  /* o miolo da célula (curto: o posto curto das células pequenas): os postos do dia ou, sem ninguém, a frase */
  function preencher(celula, curto) {
    celula.textContent = '';
    curtoDa.set(celula, !!curto);
    var iso = celula.dataset.iso, s = doDia(celula.dataset.unidadeId, iso);
    celula.classList.toggle('op-verao-celula--edita', !!s && pode(s.companhia_id));
    celula.classList.toggle('escala-celula--nao-salvo', !!s && temRascunho(s.companhia_id, iso));
    if (!s) return;
    var postos = postosDoDia(s, linhasDoDia(s.companhia_id, iso));
    if (!postos.length) {
      var vazio = RW.tpl('tpl-op-verao-vazio');
      if (vazio) celula.appendChild(vazio);
      return;
    }
    postos.forEach(function (p) { bloco(celula, p.nome, p.linhas, curto, p.sem); });
  }

  /* ---------- o título do dia ---------- */

  /* os Oficiais de Praia do dia da companhia (as linhas de agora, com o rascunho); a tela e a folha */
  function oficiaisDoDia(cia, iso) { return linhasDoDia(cia, iso).filter(function (l) { return l.oficial; }); }

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
      var ofs = oficiaisDoDia(s.companhia_id, iso);
      (ofs.length ? ofs : [null]).forEach(function (l) {
        var no = oficial(s.companhia_id, iso, l);
        if (no) lugar.appendChild(no);
      });
    });
    var tem = !!lugar.firstChild;
    lugar.classList.toggle('oculto', !tem);
    return tem;
  }

  /* ---------- a Escala: o grupo da Operação Verão ---------- */

  /* quem aparece no dia da Escala, na ordem da célula: os Oficiais de Praia e os guarda-vidas na ordem dos postos (o Sem
     posto por último), cada um com o lugar dele (o posto ou o Oficial de Praia). Só na unidade marcada no Ajustes › Op.
     Verão › Onde aparece (o "exibe" do banco); fora dela ou do período, []. [{ l (a linha do banco), lugar }] */
  function naEscala(uid, iso) {
    var s = doDia(uid, iso);
    if (!s || !s.exibe) return [];
    var linhas = s.linhas || [];
    var saida = linhas.filter(function (l) { return l.oficial; }).map(function (l) { return { l: l, lugar: msg().oficialDica }; });
    postosDoDia(s, linhas).forEach(function (p) {
      p.linhas.forEach(function (l) { saida.push({ l: l, lugar: p.nome }); });
    });
    return saida;
  }

  /* o grupo da Operação Verão na célula da Escala (escalas-celula.js, depois do Sobreaviso e antes do Fora da escala): só os
     nomes, com a boia e o horário, na caixa do grupo (a linha tracejada, escalas-celula-grupos.js); a dica diz o lugar de
     cada um e, no conflito, o porquê. A situação "op-verao" fica escondida até o Incluir operação verão
     (escalas-filtros.js). Fora da Escala e nas páginas filtradas (Sobreaviso, Estágios e a própria Op. Verão), nada */
  function grupo(celula, curto) {
    if (ativa() || !RW.escalasCelulaGrupos.naEscala(celula) || (RW.paginaFiltrada && RW.paginaFiltrada())) return;
    var lista = naEscala(celula.dataset.unidadeId, celula.dataset.iso);
    if (!lista.length) return;
    var caixa = RW.escalasCelulaGrupos.caixa('op-verao');
    if (!caixa) return;
    lista.forEach(function (x) {
      var el = linha(x.l, curto);
      if (!el) return;
      el.setAttribute('data-dica', x.l.conflito ? x.lugar + '\n' + dicaConflito(x.l.conflito) : x.lugar);
      caixa.appendChild(el);
    });
    celula.appendChild(caixa);
  }

  /* ---------- a folha (o Imprimir das grades, escalas-impressao-grade.js) ---------- */

  function textoDoMolde(id) { var el = RW.tpl(id); return el ? el.textContent.trim() : ''; }

  /* as linhas do dia s na folha: as de agora (o rascunho que a tela mostra) ou as da leitura da folha */
  function linhasNaFolha(s, iso) { return temRascunho(s.companhia_id, iso) ? rascunhos[s.companhia_id + '|' + iso] : (s.linhas || []); }

  /* os postos na célula da folha (escalas-impressao-grade-celula.js): o título de cada um e quem está nele, no grupo dele
     (a linha tracejada entre dois postos, como na tela); o nome em vermelho de quem tem conflito */
  function pessoasNaFolha(postos) {
    var saida = [];
    postos.forEach(function (p, i) {
      var grupo = 'posto-' + i;
      saida.push({ grupo: grupo, titulo: p.nome, sem: p.sem });
      p.linhas.forEach(function (l) { saida.push(pessoaNaFolha(l, grupo)); });
    });
    return saida;
  }

  /* um guarda-vidas na linha da folha, no grupo dele; o nome em vermelho de quem tem conflito */
  function pessoaNaFolha(l, grupo) {
    return { grupo: grupo, cpf: l.cpf || null, grad: l.grad, nome: l.nome, origem: 'op-verao',
      periodos: [{ inicio: l.inicio, fim: l.fim }], vermelho: !!l.conflito };
  }

  /* o grupo da Operação Verão na folha da grade da Escala (escalas-impressao-grade-celula.js): os mesmos nomes da tela
     (naEscala), no grupo "op-verao"; os Filtros da tela dizem se ele vai */
  function naFolha(uid, iso) {
    return naEscala(uid, iso).map(function (x) { return pessoaNaFolha(x.l, 'op-verao'); });
  }

  /* um Oficial de Praia no título do dia da folha, em linha pronta: o posto e o nome (em vermelho no conflito) e o horário,
     que nunca se parte (os espaços dele não quebram a linha) */
  function oficialNaFolha(l) {
    return { pessoa: { grad: l.grad, nome: l.nome }, hora: msg().horas(curta(l.inicio), curta(l.fim)).replace(/ /g, ' '),
      vermelho: !!l.conflito };
  }

  /* a leitura da folha, no formato da leitura da escala (RosterWork.escalasDados.carregar): lê o mês das unidades marcadas
     (a mesma RPC da tela, sem mexer no que a tela guardou) e devolve, por unidade e dia do período, o que a célula da tela
     mostra (os postos ou a frase do dia sem ninguém, com o rascunho) e, no título do dia, os Oficiais de Praia de cada
     companhia (ou o "Sem Oficial de Praia"), na largura toda depois do número, como na tela. Já vem filtrada: a página
     não tem os Filtros */
  function paraImpressao(ids, inicio, fim) {
    return RW.rpc('ler_escala_mes', { p_unidade_ids: ids.map(Number), p_inicio: inicio, p_fim: fim }).then(function (grade) {
      if (!grade) throw new Error('falha');
      var r = { militares: {}, fora: {}, cobertura: {}, erro: {}, oficial: {}, oficialLargo: true, jaFiltrada: true };
      var semNinguem = textoDoMolde('tpl-op-verao-vazio'), semOficial = textoDoMolde('tpl-op-verao-sem-oficial');
      var feitas = {};   // 'dia|companhia' já no título
      ids.forEach(function (uid) {
        var dias = grade[uid] || {};
        r.militares[uid] = {};
        Object.keys(dias).forEach(function (iso) {
          var s = dias[iso] && dias[iso].op_verao;
          if (!s) return;
          var postos = postosDoDia(s, linhasNaFolha(s, iso));
          r.militares[uid][iso] = postos.length ? pessoasNaFolha(postos) : [{ frase: semNinguem }];
          if (feitas[iso + '|' + s.companhia_id]) return;
          feitas[iso + '|' + s.companhia_id] = true;
          var ofs = linhasNaFolha(s, iso).filter(function (l) { return l.oficial; });
          r.oficial[iso] = (r.oficial[iso] || []).concat(ofs.length ? ofs.map(oficialNaFolha) : [{ pessoa: null, hora: '', sem: semOficial }]);
        });
      });
      return r;
    });
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

  RW.opVeraoCelula = { ativa: ativa, guardar: guardar, preencher: preencher, preencherTitulo: preencherTitulo, paraImpressao: paraImpressao, doDia: doDia,
    grupo: grupo, naFolha: naFolha,
    companhia: companhia, linhasDoDia: linhasDoDia, gravadas: gravadas, rascunho: rascunho, temRascunho: temRascunho, colunas: colunas, pode: pode,
    limite: limite, limpar: limpar, diasComRascunho: diasComRascunho, gravou: gravou, esperarLeitura: esperarLeitura };
})();
