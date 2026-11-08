/* ============================================================
   EXTRAJORNADA — painel do dia: os outros dias do militar e a hora de começar
   Embaixo da linha do militar, os outros dias dele com os 4 horários,
   para mudar de dia sem sair do painel. Abrem no clique nas cotas e
   sozinhos quando ele passa da cota, com a nota do que desmarcar. O dia
   que tirar gente de onde falta avisa; o de mais de 7 dias atrás fica
   cinza e travado. E, para o administrativo no dia em que o expediente
   termina antes da primeira bolinha livre (a quarta), a hora em que a
   extra começa (a mesma peça na linha, nos outros dias e na lista dos
   voluntários). Lê e muda o rascunho por RosterWork.extrajornadaGrade.
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

  /* a hora em que a extra do administrativo começa, no dia em que o expediente termina antes da primeira bolinha livre
     (a quarta): com as bolinhas seguidas desde a primeira livre, o fim do expediente ou a bolinha e, embaixo, o aviso
     quando começar mais cedo deixa falta que a bolinha cobriria. Muda o rascunho como as bolinhas; a mesma peça na linha
     do painel do dia, nos outros dias dele e na lista dos voluntários (entra em lugar, antes de antes) */
  function ligarInicio(lugar, antes, m, k, uid) {
    var v = G().vagaDe(m.cpf, k), bs = v ? G().blocos(v) : [], desde = G().desde(m, k);
    if (!desde || !v || +v.unidade !== +uid || !G().inicioCabe(m, k, bs)) return;
    var caixa = RW.tpl('tpl-extrajornada-inicio'), travada = G().soLeitura() || G().antigo(k);
    [['cedo', desde], ['bolinha', null]].forEach(function (op) {
      var bt = caixa.querySelector('[data-inicio="' + op[0] + '"]'), ativo = (v.inicio || null) === op[1];
      bt.textContent = u().horas(bs, op[1]);
      bt.classList.toggle('aba--ativa', ativo);
      bt.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      bt.disabled = travada;
      bt.addEventListener('click', function (ev) {
        ev.stopPropagation();   // no calendário e na lista, o clique não abre nem fecha mais nada
        if (!ativo) G().mudar(m, k, bs, uid, op[1]);
      });
    });
    var falta = v.inicio ? G().faltaDoInicio(uid, k, m.cpf) : null;
    if (falta) {
      var aviso = caixa.querySelector('.extrajornada-inicio-aviso');
      aviso.querySelector('.extrajornada-inicio-aviso-texto').textContent =
        (falta.cor === 'erro' ? msg().inicioFalta : msg().inicioIdeal)(u().hora(v.inicio), falta.das, falta.ate);
      aviso.classList.toggle('extrajornada-inicio-aviso--alerta', falta.cor === 'alerta');
      aviso.classList.remove('oculto');
    }
    lugar.insertBefore(caixa, antes || null);
  }

  /* as cotas da linha viram o botão que abre os outros dias. aoTrocar redesenha o painel */
  function preencher(lin, m, k, usou, aoTrocar) {
    var passou = usou - (m.concedidas || 0);
    var outros = G().vagas().filter(function (v) { return v.cpf === m.cpf && v.data !== k; })
      .sort(function (x, y) { return x.data < y.data ? -1 : 1; });
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
    if (!aberto) return;
    if (passou > 0) {
      var nota = RW.tpl('tpl-escala-nota');
      nota.classList.add('nota--erro');
      nota.querySelector('.nota-texto').textContent = outros.length ? msg().passouCota(passou) : msg().passouCotaSoDeste(passou);
      area.appendChild(nota);
    }
    outros.forEach(function (v) {
      var linha = RW.tpl('tpl-extrajornada-painel-outro');
      var sem = G().SEM_CURTA[G().dataDe(v.data).getDay()];
      linha.querySelector('.extrajornada-painel-outro-dia').textContent = msg().outroDia(v.data.slice(8, 10), sem, (u().unidade(v.unidade) || {}).nome || '');
      avisoDoDia(linha, v);
      RW.extrajornadaDia.ligarMarcas(linha.querySelector('.extrajornada-painel-marcas'), m, v.data, G().blocos(v), +v.unidade);
      ligarInicio(linha.querySelector('.extrajornada-painel-outro-texto'), null, m, v.data, +v.unidade);
      area.appendChild(linha);
    });
  }

  RW.extrajornadaDiaOutros = {
    preencher: preencher,
    /* a hora em que a extra do administrativo começa (a quarta): a linha do painel do dia e a lista dos voluntários também usam */
    ligarInicio: ligarInicio,
    /* outro dia abriu, ou o rascunho voltou ao salvo: as linhas voltam a fechar */
    esquecer: function () { abertos = {}; }
  };
})();
