/* ============================================================
   EXTRAJORNADA — painel do dia: os outros dias do militar e o aviso do começo
   Embaixo da linha do militar, os outros dias dele com a barra de
   horário, para mudar de dia sem sair do painel. Abrem no clique nas
   cotas e sozinhos quando ele passa da cota, com a nota do que tirar
   (a mesma peça no cartão aberto na célula do calendário). O
   dia que tirar gente de onde falta avisa; o de mais de 7 dias atrás
   fica cinza e travado. E, para o administrativo que começa no fim do
   expediente (a quarta), o aviso da falta que esse começo deixa (a
   mesma peça na linha, nos outros dias e na lista dos voluntários).
   Lê e muda o rascunho por RosterWork.extrajornadaGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaDiaOutros.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var abertos = {};   // as linhas abertas no dia aberto { cpf: true }

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }

  /* o aviso do dia: travado, ou a falta que a extra tirada deixa nele */
  function avisoDoDia(linha, v) {
    var aviso = linha.querySelector('.extrajornada-painel-outro-aviso');
    if (G().antigo(v.data)) {
      linha.classList.add('extrajornada-painel-outro--antigo');
      aviso.textContent = msg().outroAntigo;
      aviso.classList.remove('oculto');
      return;
    }
    var antes = G().base(v.cpf, v.data);
    if (!antes || G().blocos(v).length >= G().blocos(antes).length) return;
    var cor = G().corDe(G().faltaDoDia(+antes.unidade, v.data, G().efetivas()));
    if (cor !== 'erro' && cor !== 'alerta') return;
    aviso.textContent = cor === 'erro' ? msg().outroFalta : msg().outroIdeal;
    aviso.classList.add('extrajornada-painel-outro-aviso--' + cor);
    aviso.classList.remove('oculto');
  }

  /* a extra do administrativo que começa no fim do expediente (a quarta; o começo se muda na barra de horário): embaixo,
     o aviso quando começar mais cedo deixa falta que, começando no horário de 6 horas, ela cobriria. A mesma peça na
     linha do painel do dia, nos outros dias dele e na lista dos voluntários (entra em lugar, antes de antes) */
  function ligarInicio(lugar, antes, m, k, uid) {
    var v = G().vagaDe(m.cpf, k);
    if (!v || !v.inicio || +v.unidade !== +uid) return;
    var falta = G().faltaDoInicio(uid, k, m.cpf);
    if (!falta) return;
    var caixa = RW.tpl('tpl-extrajornada-inicio');
    var aviso = caixa.querySelector('.extrajornada-inicio-aviso');
    aviso.querySelector('.extrajornada-inicio-aviso-texto').textContent =
      (falta.cor === 'erro' ? msg().inicioFalta : msg().inicioIdeal)(u().hora(v.inicio), falta.das, falta.ate);
    aviso.classList.toggle('extrajornada-inicio-aviso--alerta', falta.cor === 'alerta');
    lugar.insertBefore(caixa, antes || null);
  }

  /* as extras do militar nos outros dias do mês, em ordem */
  function outrosDias(cpf, k) {
    return G().vagas().filter(function (v) { return v.cpf === cpf && v.data !== k; })
      .sort(function (x, y) { return x.data < y.data ? -1 : 1; });
  }

  /* a nota de quem passou da cota e os outros dias dele (a data, o pelotão, o aviso e a barra para tirar horário), na
     área dada: embaixo da linha do painel do dia e no cartão aberto na célula (extrajornada-celula.js; naCelula: a nota
     curta e a barra compacta) */
  function listar(area, m, k, passou, naCelula) {
    var outros = outrosDias(m.cpf, k), opcoes = naCelula ? { lugar: 'calendario' } : undefined;
    if (passou > 0) {
      var nota = RW.tpl('tpl-escala-nota');
      nota.classList.add('nota--erro');
      nota.querySelector('.nota-texto').textContent = naCelula ? msg().passouCotaCurto(passou)
        : outros.length ? msg().passouCota(passou) : msg().passouCotaSoDeste(passou);
      area.appendChild(nota);
    }
    outros.forEach(function (v) {
      var linha = RW.tpl('tpl-extrajornada-painel-outro');
      var sem = G().SEM_CURTA[G().dataDe(v.data).getDay()];
      linha.querySelector('.extrajornada-painel-outro-dia').textContent = msg().outroDia(v.data.slice(8, 10), sem, (u().unidade(v.unidade) || {}).nome || '');
      avisoDoDia(linha, v);
      RW.extrajornadaDia.ligarMarcas(linha.querySelector('.extrajornada-painel-marcas'), m, v.data, G().blocos(v), +v.unidade, opcoes);
      ligarInicio(linha.querySelector('.extrajornada-painel-outro-texto'), null, m, v.data, +v.unidade);
      area.appendChild(linha);
    });
  }

  /* as cotas da linha viram o botão que abre os outros dias. aoTrocar redesenha o painel */
  function preencher(lin, m, k, usou, aoTrocar) {
    var passou = usou - (m.concedidas || 0), outros = outrosDias(m.cpf, k);
    var botao = lin.querySelector('.extrajornada-painel-cotas');
    botao.disabled = !outros.length;
    botao.classList.toggle('extrajornada-painel-cotas--sem-dias', !outros.length);
    /* passar da cota abre e deixa aberta (o administrador acerta ali e fecha quando quiser) */
    if (passou > 0) abertos[m.cpf] = true;
    var aberto = !!abertos[m.cpf] && (outros.length > 0 || passou > 0);
    botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    botao.addEventListener('click', function () {
      abertos[m.cpf] = !abertos[m.cpf];
      aoTrocar();
    });
    var area = lin.querySelector('.extrajornada-painel-outros');
    area.classList.toggle('oculto', !aberto);
    if (aberto) listar(area, m, k, passou);
  }

  RW.extrajornadaDiaOutros = {
    preencher: preencher,
    listar: listar,
    /* a hora em que a extra do administrativo começa (a quarta): a linha do painel do dia e a lista dos voluntários também usam */
    ligarInicio: ligarInicio,
    /* outro dia abriu, ou o rascunho voltou ao salvo: as linhas voltam a fechar */
    esquecer: function () { abertos = {}; }
  };
})();
