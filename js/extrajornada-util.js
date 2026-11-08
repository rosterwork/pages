/* ============================================================
   EXTRAJORNADA — as peças comuns
   Os nomes, as unidades, os horários e a leitura do banco, lidos do mês
   que a tela em uso entregou (usar): a página da Extrajornada e a aba
   Extrajornada do painel do dia da Escala.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaUtil.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'], FIM = ['14h', '20h', '02h', '08h'];

  var d = null;   // a resposta do extrajornada_mes da tela em uso

  function msg() { return RW.mensagens.extrajornada.org; }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }

  var util = {
    horas: function (blocos) {
      var b = blocos.slice().map(Number).sort(), partes = [], ini = b[0], ant = b[0];
      for (var i = 1; i <= b.length; i++) {
        if (b[i] === ant + 1) { ant = b[i]; continue; }
        partes.push(INI[ini - 1] + ' às ' + FIM[ant - 1]);
        ini = b[i]; ant = b[i];
      }
      return partes.join(' e ');
    },
    militar: function (cpf) { return (d && d.militares.filter(function (m) { return m.cpf === cpf; })[0]) || null; },
    unidade: function (id) { return (d && d.unidades.filter(function (u) { return u.id === +id; })[0]) || null; },
    nome: function (cpf) { var m = util.militar(cpf); return m ? m.grad + ' ' + m.nome : cpf; },
    /* o que o militar marcou no pedido para o dia: 'quer', 'nao' (Não quero) ou 'sem' (sem preferência) */
    pref: function (m, k) { return (m.quer || []).indexOf(k) >= 0 ? 'quer' : (m.nao_posso || []).indexOf(k) >= 0 ? 'nao' : 'sem'; },
    /* a extra no bloco do dia, só para ler (marcar é no painel do dia e na lista): o posto e o nome e as 4 bolinhas
       pequenas dos horários, sem clique, na cor do que ele marcou no pedido; na dica, o nome inteiro e o horário
       escrito; embaixo, o pelotão quando é de outro. curto: a célula pequena do Calendário, com o posto curto
       (RosterWork.escalasCelula.postoCurto); a dica leva o posto inteiro */
    vaga: function (a, uid, curto) {
      var m = util.militar(a.cpf) || {}, blocos = a.blocos.map(Number);
      var v = RW.tpl('tpl-extrajornada-vaga');
      v.querySelector('.extrajornada-vaga-grad').textContent = curto && RW.escalasCelula ? RW.escalasCelula.postoCurto(m.grad) : (m.grad || '');
      v.querySelector('.extrajornada-vaga-nome').textContent = m.nome || a.cpf;
      var horas = blocos.length === 4 ? msg().horasN(24) : blocos.length ? util.horas(blocos) : '';
      /* sem nenhum horário: em cinza até o Salvar (marcar uma bolinha traz de volta) */
      v.classList.toggle('extrajornada-vaga--sai', !blocos.length);
      v.setAttribute('data-dica', ((m.grad || '') + ' ' + (m.nome || a.cpf)).trim() + (horas ? ', ' + horas : ' · ' + msg().saiAoSalvar));
      v.setAttribute('data-busca', RW.busca ? RW.busca.chave(m) : '');
      var outro = !!m.unidade_id && m.unidade_id !== uid;
      if (outro) {
        var pel = v.querySelector('.extrajornada-vaga-pelotao');
        pel.textContent = (util.unidade(m.unidade_id) || {}).nome || '';
        pel.classList.remove('oculto');
      }
      /* a cor das marcadas é a do que ele marcou no pedido para o dia: verde quer, vermelho não quer, neutra sem preferência */
      var bol = v.querySelector('.extrajornada-vaga-bol'), pref = util.pref(m, a.data);
      bol.classList.toggle('extrajornada-vaga-bol--quer', pref === 'quer');
      bol.classList.toggle('extrajornada-vaga-bol--nao', pref === 'nao');
      Array.prototype.forEach.call(bol.children, function (b, i) {
        b.classList.toggle('extrajornada-vaga-bol--on', blocos.indexOf(i + 1) >= 0);
      });
      v.querySelector('.extrajornada-vaga-baixo').classList.toggle('oculto', !outro);
      v.insertBefore(util.origem(a), bol);
      return v;
    },
    /* quem inseriu a extra: o ícone do sistema (o Preencher refaz) ou o do administrador (pôs ou mudou; o sistema nunca
       muda), com a dica de quem inseriu */
    origem: function (a) {
      var i = RW.tpl('tpl-extrajornada-origem'), sistema = a.origem === 'sugestao';
      var texto = sistema ? msg().origemSistema : msg().origemAdmin;
      i.querySelector('use').setAttribute('href', 'icones/todos.svg#' + (sistema ? 'icone-extra-sistema' : 'icone-extra-administrador'));
      i.setAttribute('data-dica', texto);
      i.setAttribute('aria-label', texto);
      return i;
    },
    /* as unidades da página: todas as da companhia (o seletor de unidades do topo não filtra a Extrajornada) */
    escolhidas: function () { return d ? d.unidades.map(function (un) { return un.id; }) : []; },
    /* uma leitura do banco (RPC): devolve o JSON ou, se o banco recusar, null, com a mensagem técnica (o código, o texto
       e o lugar do erro) anotada no console para achar a causa */
    chamar: function (nome, corpo) {
      return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} }).then(function (resp) {
        if (resp.ok) return resp.json();
        return resp.text().then(function (texto) {
          console.error('[Extrajornada] ' + nome + ' falhou (' + resp.status + '): ' + texto);
          return null;
        });
      });
    },
    /* as unidades do calendário: todas; a companhia só quando tem extra (a falta é só dos pelotões) */
    doCalendario: function (alocs) {
      var sel = util.escolhidas();
      return d.unidades.filter(function (un) {
        return sel.indexOf(un.id) >= 0 && (un.pelotao !== false || alocs.some(function (a) { return +a.unidade === un.id; }));
      });
    },
    br: br,
    /* o mês que as peças leem */
    usar: function (dados) { d = dados; }
  };
  RW.extrajornadaUtil = util;
})();
