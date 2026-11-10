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
  /* a hora de 'HH:MM' contada das 08h (0 a 23) e o 'HHh' de uma hora contada das 08h */
  function hora8(t) { return (+String(t).slice(0, 2) + 16) % 24; }
  function hh(h) { return String((h + 8) % 24).padStart(2, '0') + 'h'; }

  var util = {
    /* o horário escrito; a extra que começa no fim do expediente (inicio) dura 6 h por cota */
    horas: function (blocos, inicio) {
      var b = blocos.slice().map(Number).sort(), partes = [], ini = b[0], ant = b[0];
      if (inicio && b.length) return hh(hora8(inicio)) + ' às ' + hh(hora8(inicio) + 6 * b.length);
      for (var i = 1; i <= b.length; i++) {
        if (b[i] === ant + 1) { ant = b[i]; continue; }
        partes.push(INI[ini - 1] + ' às ' + FIM[ant - 1]);
        ini = b[i]; ant = b[i];
      }
      return partes.join(' e ');
    },
    /* as horas (0 a 23, contadas das 08h) em que a extra está no dia */
    horasDe: function (a) {
      var b = (a.blocos || []).map(Number), l = [];
      if (a.inicio && b.length) {
        for (var h = hora8(a.inicio); h < Math.min(24, hora8(a.inicio) + 6 * b.length); h++) l.push(h);
        return l;
      }
      b.forEach(function (x) { for (var hb = (x - 1) * 6; hb < x * 6; hb++) l.push(hb); });
      return l;
    },
    /* os horários de 6 h que a extra cobre inteiros: a que começa no fim do expediente não cobre o último */
    cheios: function (a) {
      var b = (a.blocos || []).map(Number).sort();
      return a.inicio ? b.slice(0, -1) : b;
    },
    /* o 'HHh' da hora em que a extra começa no fim do expediente */
    hora: function (inicio) { return inicio ? hh(hora8(inicio)) : ''; },
    militar: function (cpf) { return (d && d.militares.filter(function (m) { return m.cpf === cpf; })[0]) || null; },
    unidade: function (id) { return (d && d.unidades.filter(function (u) { return u.id === +id; })[0]) || null; },
    nome: function (cpf) { var m = util.militar(cpf); return m ? m.grad + ' ' + m.nome : cpf; },
    /* o que o militar marcou no pedido para o dia: 'quer', 'nao' (Não quero) ou 'sem' (sem preferência) */
    pref: function (m, k) { return (m.quer || []).indexOf(k) >= 0 ? 'quer' : (m.nao_posso || []).indexOf(k) >= 0 ? 'nao' : 'sem'; },
    /* a extra no bloco do dia, só para ler (marcar é no painel do dia e na lista): o posto e o nome e a barrinha dos 4
       horários de 6 horas, com a parte de cada um que a extra ocupa, na cor do que ele marcou no pedido; na dica, o
       horário escrito; embaixo, o pelotão quando é de outro. curto: a célula pequena do Calendário, com o posto curto
       (RosterWork.escalasCelula.postoCurto) */
    vaga: function (a, uid, curto) {
      var m = util.militar(a.cpf) || {}, blocos = a.blocos.map(Number);
      var v = RW.tpl('tpl-extrajornada-vaga');
      v.querySelector('.extrajornada-vaga-grad').textContent = curto && RW.escalasCelula ? RW.escalasCelula.postoCurto(m.grad) : (m.grad || '');
      v.querySelector('.extrajornada-vaga-nome').textContent = m.nome || a.cpf;
      /* a dica: o horário escrito, como na barra ("12h às 00h"; o dia todo, "08h às 08h") */
      var horas = blocos.length ? util.horas(blocos, a.inicio) : '';
      /* sem nenhum horário: em cinza até o Salvar (pôr um horário traz de volta) */
      v.classList.toggle('extrajornada-vaga--sai', !blocos.length);
      v.setAttribute('data-dica', horas || msg().saiAoSalvar);
      v.setAttribute('data-busca', RW.busca ? RW.busca.chave(m) : '');
      var outro = !!m.unidade_id && m.unidade_id !== uid;
      if (outro) {
        var pel = v.querySelector('.extrajornada-vaga-pelotao');
        pel.textContent = (util.unidade(m.unidade_id) || {}).nome || '';
        pel.classList.remove('oculto');
      }
      /* a cor da parte ocupada é a do que ele marcou no pedido para o dia: verde quer, vermelho não quer, neutra sem
         preferência; em cada horário de 6 horas, a parte que a extra ocupa (a que começa no fim do expediente ocupa só um
         pedaço do primeiro e do último) */
      var bol = v.querySelector('.extrajornada-vaga-bol'), pref = util.pref(m, a.data), hs = util.horasDe(a);
      bol.classList.toggle('extrajornada-vaga-bol--quer', pref === 'quer');
      bol.classList.toggle('extrajornada-vaga-bol--nao', pref === 'nao');
      Array.prototype.forEach.call(bol.children, function (b, i) {
        var aqui = hs.filter(function (h) { return h >= i * 6 && h < i * 6 + 6; });
        b.classList.toggle('extrajornada-vaga-bol--on', aqui.length > 0);
        if (!aqui.length) return;
        b.style.setProperty('--vaga-de', ((Math.min.apply(null, aqui) - i * 6) / 6 * 100) + '%');
        b.style.setProperty('--vaga-ate', ((Math.max.apply(null, aqui) + 1 - i * 6) / 6 * 100) + '%');
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
