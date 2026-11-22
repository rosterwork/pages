/* ============================================================
   ESCALAS — o sobreaviso da companhia na célula da grade
   Cada leitura do mês (escalas-dados.js) guarda aqui o sobreaviso de
   cada unidade e dia, como o banco manda ({ companhia_id, exibe,
   falta, militares }); a célula (escalas-celula.js) pede o campo no
   fim: embaixo de quem está de serviço, no grupo Sobreaviso (a caixa e
   a linha tracejada dos grupos, escalas-celula-grupos.js, antes do
   Fora da escala), cada um com o ícone do telefone (a linha do militar é a
   mesma da grade). Aparece onde o banco marcou "exibe": as unidades
   marcadas nos Ajustes › Sobreaviso › Onde aparece, todas com a mesma
   lista (também no celular, na Agenda). Com o sobreaviso de cada
   pelotão (as regras da companhia), o banco marca todos os pelotões e
   cada um mostra o seu; a companhia, nada. Quem falta para a regra
   da companhia vira a linha amarela.
   Só na Escala (a Extrajornada usa a mesma célula e fica como está).
   Não cria HTML nem escreve estilo.
   A mudança ainda não salva (o painel ou a caixa da célula) aparece na
   grade na hora (rascunho).
   Quem o administrador pôs ou mudou (origem "administrador") leva o
   cadeado, como a função fixada.
   RosterWork.escalasCelulaSobreaviso.{ guardar, preencher, pessoas, mostra, companhia, rascunho,
   doDia, dica }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var guardado = {};   // 'unidade|dia' -> o sobreaviso do dia

  function msg() { return RW.mensagens.escala.sobreaviso; }

  /* a Escala está na tela (a grade da Extrajornada desenha a mesma célula) */
  function naEscala(celula) { return !!document.querySelector('.conteudo #escala-modos') && !celula.closest('#p3-cal'); }

  /* a leitura do mês, { unidade: { dia: { ..., sobreaviso } } }: o dia sem a chave não tem sobreaviso */
  function guardar(grade) {
    Object.keys(grade || {}).forEach(function (uid) {
      var dias = grade[uid] || {};
      Object.keys(dias).forEach(function (iso) {
        var s = dias[iso] && dias[iso].sobreaviso;
        if (s) guardado[uid + '|' + iso] = s;
        else delete guardado[uid + '|' + iso];
      });
    });
  }

  /* posto ou mudado pelo administrador: o sistema não o muda (o cadeado) */
  function fixado(m) { return m.origem === 'administrador'; }

  /* a dica da linha: o sobreaviso (no dia em que ele não está livre, o porquê) e, no fixado, quem o pôs */
  function dica(p) {
    var frase = p.conflito ? msg().conflito[p.conflito] : msg().dica;
    return p.fixado ? frase + '\n' + RW.mensagens.escala.como.motivo({ codigo: 'fixado' }) : frase;
  }

  /* a linha de quem está de sobreaviso: a mesma da grade, com a origem "sobreaviso" (o ícone do telefone, a situação do
     filtro e a dica) e o cadeado no fixado; no dia em que ele não está livre, o nome em amarelo, com o porquê na dica */
  function linha(m, curto, D) {
    var p = { cpf: m.cpf, grad: m.grad, nome: m.nome, nome_completo: m.nome_completo, rg: m.rg, origem: 'sobreaviso',
      fixado: fixado(m), conflito: m.conflito || null, periodos: [{ inicio: m.horaInicio, fim: m.horaFim }] };
    var el = RW.escalasCelula.montarPessoa(p, curto, D);
    if (!el) return null;
    el.classList.add('linha-escalado--sobreaviso');
    if (m.conflito) el.classList.add('linha-escalado--sobreaviso-conflito');
    if (!D) el.setAttribute('data-dica', dica(p));
    return el;
  }

  /* o rascunho do dia (escalas-painel-sobreaviso.js), pela chave do sobreaviso (a companhia ou, no de cada pelotão, o
     pelotão, com o dia): a grade mostra como vai ficar */
  var rascunhos = {};
  var desenhoDa = new WeakMap();   // a célula -> { curto, D }, para refazer o campo com o rascunho
  function chaveDe(s, iso) { return (s.unidade_id || s.companhia_id) + '|' + iso; }
  /* quantos faltam com outra lista (o que falta conta de 7 dias atrás em diante, como no banco: o dia mais antigo que se
     mexe, escalas-celula-editar.js) */
  function faltaCom(s, iso, militares) {
    if (iso < RW.escalasCelulaEditar.limite()) return 0;
    return Math.max(0, (s.falta || 0) + (s.militares || []).length - militares.length);
  }

  /* o campo no fim da célula (curto: o posto curto das células pequenas; D: a dica das linhas, escalas-celula-dica.js) */
  function preencher(celula, curto, D) {
    if (!naEscala(celula)) return;
    var iso = celula.dataset.iso;
    var s = guardado[celula.dataset.unidadeId + '|' + iso];
    if (!s || !s.exibe) return;
    desenhoDa.set(celula, { curto: curto, D: D });
    var r = rascunhos[chaveDe(s, iso)];
    var militares = r || s.militares || [];
    var quantos = r ? faltaCom(s, iso, r) : s.falta;
    if (!militares.length && !quantos) return;
    var campo = RW.escalasCelulaGrupos.caixa('sobreaviso');
    if (!campo) return;
    campo.classList.add('escala-sobreaviso');
    militares.forEach(function (m) { var el = linha(m, curto, D); if (el) campo.appendChild(el); });
    if (quantos) {
      var falta = RW.tpl('tpl-escala-sobreaviso-falta');
      if (falta) { falta.querySelector('.linha-escalado-nome').textContent = msg().falta(quantos); campo.appendChild(falta); }
    }
    /* sempre antes do Fora da escala, também quando o rascunho refaz o campo */
    celula.insertBefore(campo, celula.querySelector(':scope > .escala-grupo[data-grupo="fora"]'));
  }

  /* o rascunho mudou (militares: a lista de agora; null: sem mudança, volta o gravado). gravou: a lista foi gravada e vira
     o gravado até a leitura nova. Refaz o campo nas células do dia com essa chave; a caixa aberta acha o nome de novo */
  function rascunho(chave, iso, militares, gravou) {
    Object.keys(guardado).forEach(function (k) {
      var s = guardado[k];
      if (gravou && k.split('|')[1] === iso && chaveDe(s, iso) === chave) {
        s.falta = faltaCom(s, iso, militares);
        s.militares = militares;
      }
    });
    if (militares && !gravou) rascunhos[chave] = militares;
    else delete rascunhos[chave];
    Array.prototype.forEach.call(document.querySelectorAll('.conteudo .escala-mes-celula[data-iso="' + iso + '"]'), function (cel) {
      var s = guardado[cel.dataset.unidadeId + '|' + iso], d = desenhoDa.get(cel);
      if (!s || !d || chaveDe(s, iso) !== chave) return;
      var velho = cel.querySelector(':scope > .escala-sobreaviso');
      if (velho) velho.remove();
      preencher(cel, d.curto, d.D);
    });
    /* a aba Militares da página Sobreaviso (escalas-militares-sobreaviso.js) mostra o mesmo */
    if (RW.escalasMilitaresSobreaviso) RW.escalasMilitaresSobreaviso.rascunho(chave, iso, militares);
    if (RW.escalasCelulaEditar && RW.escalasCelulaEditar.acharDeNovo) RW.escalasCelulaEditar.acharDeNovo();
  }

  /* o sobreaviso guardado de uma célula (a caixa da célula: de quem é e se ele mexe) */
  function doDia(uid, iso) { return guardado[uid + '|' + iso] || null; }

  /* para o PDF das grades: quem está de sobreaviso no lugar em que ele aparece, como as pessoas da célula (origem
     "sobreaviso"); nos outros lugares, ninguém */
  function pessoas(uid, iso) {
    var s = guardado[uid + '|' + iso];
    if (!s || !s.exibe) return [];
    return (s.militares || []).map(function (m) {
      return { cpf: m.cpf, grad: m.grad, nome: m.nome, origem: 'sobreaviso', fixado: fixado(m),
        periodos: [{ inicio: m.horaInicio, fim: m.horaFim }] };
    });
  }

  /* o sobreaviso que a unidade mostra (o "exibe" de algum dia já lido) */
  function mostrado(uid) {
    var comeco = uid + '|';
    var chave = Object.keys(guardado).filter(function (k) { return k.indexOf(comeco) === 0 && guardado[k].exibe; })[0];
    return chave ? guardado[chave] : null;
  }

  /* a unidade mostra o sobreaviso? A página Sobreaviso deixa na tela só essas */
  function mostra(uid) { return !!mostrado(uid); }

  /* a companhia do sobreaviso que a unidade mostra; null no de cada pelotão (cada um, o seu) ou sem sobreaviso. A página
     Sobreaviso deixa uma unidade só por companhia (a lista é a mesma em todas as marcadas) */
  function companhia(uid) {
    var s = mostrado(uid);
    return s && !s.unidade_id ? s.companhia_id : null;
  }

  RW.escalasCelulaSobreaviso = { guardar: guardar, preencher: preencher, pessoas: pessoas, mostra: mostra, companhia: companhia,
    rascunho: rascunho, doDia: doDia, dica: dica };
})();
