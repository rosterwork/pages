/* ============================================================
   NOVA EXTRA — painel do dia: os outros dias do militar
   Embaixo da linha do militar, os outros dias dele com os 4 horários,
   para mudar de dia sem sair do painel. Abrem no clique nas cotas e
   sozinhos quando ele passa da cota, com a nota do que desmarcar. O dia
   que tirar gente de onde falta avisa; o de mais de 7 dias atrás fica
   cinza e travado. Lê e muda o rascunho por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraDiaOutros.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var abertos = {};   // as linhas abertas no dia aberto { cpf: true }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }

  /* o aviso do dia: travado, ou a falta que a extra tirada deixa nele */
  function avisoDoDia(linha, v) {
    var aviso = linha.querySelector('.escala-extra-outro-aviso');
    if (G().antigo(v.data)) {
      linha.classList.add('escala-extra-outro--antigo');
      aviso.textContent = msg().outroAntigo;
      aviso.classList.remove('oculto');
      return;
    }
    var antes = G().base(v.cpf, v.data);
    if (!antes || G().blocos(v).length >= G().blocos(antes).length) return;
    var cor = G().corDe(G().faltaDoDia(+antes.unidade, v.data, G().efetivas()));
    if (cor !== 'erro' && cor !== 'alerta') return;
    aviso.textContent = cor === 'erro' ? msg().outroFalta : msg().outroIdeal;
    aviso.classList.add('escala-extra-outro-aviso--' + cor);
    aviso.classList.remove('oculto');
  }

  /* as cotas da linha viram o botão que abre os outros dias. aoTrocar redesenha o painel */
  function preencher(lin, m, k, usou, aoTrocar) {
    var passou = usou - (m.concedidas || 0);
    var outros = G().vagas().filter(function (v) { return v.cpf === m.cpf && v.data !== k; })
      .sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var botao = lin.querySelector('.escala-extra-cotas');
    botao.disabled = !outros.length;
    botao.classList.toggle('escala-extra-cotas--sem-dias', !outros.length);
    /* passar da cota abre e deixa aberta (o administrador acerta ali e fecha quando quiser) */
    if (passou > 0) abertos[m.cpf] = true;
    var aberto = !!abertos[m.cpf] && (outros.length > 0 || passou > 0);
    botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    botao.addEventListener('click', function () {
      abertos[m.cpf] = !abertos[m.cpf];
      aoTrocar();
    });
    var area = lin.querySelector('.escala-extra-outros');
    area.classList.toggle('oculto', !aberto);
    if (!aberto) return;
    if (passou > 0) {
      var nota = RW.tpl('tpl-escala-nota');
      nota.classList.add('nota--erro');
      nota.querySelector('.nota-texto').textContent = outros.length ? msg().passouCota(passou) : msg().passouCotaSoDeste(passou);
      area.appendChild(nota);
    }
    outros.forEach(function (v) {
      var linha = RW.tpl('tpl-escala-extra-outro');
      var sem = G().SEM_CURTA[G().dataDe(v.data).getDay()];
      linha.querySelector('.escala-extra-outro-dia').textContent = msg().outroDia(v.data.slice(8, 10), sem, (u().unidade(v.unidade) || {}).nome || '');
      avisoDoDia(linha, v);
      RW.novaExtraDia.ligarMarcas(linha.querySelector('.escala-extra-marcas'), m, v.data, G().blocos(v), +v.unidade);
      area.appendChild(linha);
    });
  }

  RW.novaExtraDiaOutros = {
    preencher: preencher,
    /* outro dia abriu, ou o rascunho voltou ao salvo: as linhas voltam a fechar */
    esquecer: function () { abertos = {}; }
  };
})();
