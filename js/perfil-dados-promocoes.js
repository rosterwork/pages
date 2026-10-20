/* ============================================================
   MEU PERFIL — "Meus dados", seção das datas de promoção.
   Um campo por posto depois do primeiro (a regra do Criar conta,
   RosterWork.campos.postosComData), pelo posto e pela data de
   inclusão gravados. Todas podem ser preenchidas ou corrigidas e
   vão para a aprovação como promocao_<grau_id>; a vazia pode
   ficar em branco. Na praça, o primeiro posto aparece no alto da
   seção com o campo ligado ao da data de inclusão (mudar um muda
   o outro), porque a data dele é a de inclusão.
   Cada campo vai para o formulário do perfil-dados.js pelo
   "adicionar", que cuida do resto (destaque, contagem, envio).
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var reqDatas = 0;       /* token: ignora resposta antiga ao reentrar na página */
  var espelho = null;     /* o campo do primeiro posto (praça), ligado ao da inclusão */
  var inclusaoEl = null;  /* o campo da data de inclusão do formulário */

  function C() { return RosterWork.campos; }
  function V() { return RosterWork.validacoes; }

  function ehPromocao(campo) { return String(campo).indexOf('promocao_') === 0; }

  /* do posto mais baixo ao mais alto (as de praça do oficial primeiro); o primeiro posto fica de fora */
  function camposDeData() {
    var praca = Array.prototype.slice.call(document.querySelectorAll('#perfil-promocoes-praca .campo-entrada'));
    var carreira = Array.prototype.slice.call(document.querySelectorAll('#perfil-promocoes .campo-entrada'));
    return praca.concat(carreira).filter(function (el) { return el !== espelho; });
  }

  /* as datas juntas: em ordem e nenhuma antes da inclusão (o conflito fica marcado no campo da inclusão) */
  function conferir() {
    return !inclusaoEl || C().conferirPromocoes(camposDeData(), V().parseData(inclusaoEl.value), inclusaoEl);
  }

  function novoCampo(rotulo) {
    var campo = RosterWork.tpl('tpl-nu-promocao');
    if (campo) campo.querySelector('.campo-rotulo').textContent = rotulo;
    return campo;
  }

  function montarDatas(idSecao, idLista, postos, gravadas, adicionar) {
    var secao = document.getElementById(idSecao);
    var lista = document.getElementById(idLista);
    if (!secao || !lista) return null;
    lista.textContent = '';
    postos.forEach(function (g) {
      var campo = novoCampo(g.grau_abreviacao);
      if (!campo) return;
      lista.appendChild(campo);
      adicionar({ el: campo.querySelector('.campo-entrada'), campo: 'promocao_' + g.grau_id, formato: 'data' },
        RosterWork.data.isoParaBR(gravadas[String(g.grau_id)]));
    });
    secao.classList.toggle('oculto', !postos.length);
    return lista;
  }

  /* o primeiro posto da praça: Sd 3ª Classe para quem entrou a partir de 01/11/2024, antes Sd 2ª Classe */
  function montarPrimeiro(lista, graus, inclusao) {
    var nome = C().grauValeNaInclusao('Soldado 3ª Classe', inclusao) ? 'Soldado 3ª Classe' : 'Soldado 2ª Classe';
    var grau = graus.filter(function (g) { return g.grau_nome === nome; })[0];
    var campo = grau && inclusaoEl ? novoCampo(grau.grau_abreviacao) : null;
    if (!campo) return;
    espelho = campo.querySelector('.campo-entrada');
    espelho.value = inclusaoEl.value;
    C().ligarData(espelho);
    espelho.addEventListener('input', function () {
      if (inclusaoEl.value === espelho.value) return;
      inclusaoEl.value = espelho.value;
      inclusaoEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    lista.insertBefore(campo, lista.firstChild);
  }

  /* o primeiro posto acompanha a inclusão quando ela muda por fora (digitação, Desfazer) */
  function sincronizar() {
    if (espelho && inclusaoEl && espelho.value !== inclusaoEl.value) espelho.value = inclusaoEl.value;
  }

  /* monta a seção e devolve a promessa; adicionar(controle, original) entrega cada campo ao formulário */
  function montar(institucionais, promocoes, inclusao, adicionar) {
    var req = ++reqDatas;
    espelho = null;
    inclusaoEl = inclusao;
    var gravadas = {};
    (promocoes || []).forEach(function (p) { gravadas[String(p.grau_id)] = p.data; });
    var dataInclusao = V().parseData(RosterWork.data.isoParaBR(institucionais.data_de_inclusao));
    if (!institucionais.grau_id || !dataInclusao) return Promise.resolve();
    if (inclusaoEl) inclusaoEl.addEventListener('input', sincronizar);
    return RosterWork.rpc('buscar_graus_hierarquicos').then(function (graus) {
      if (req !== reqDatas || !Array.isArray(graus)) return;   // resposta obsoleta (reentrou na página)
      var postos = C().postosComData(graus, institucionais.grau_id, dataInclusao, Object.keys(gravadas));
      var lista = montarDatas('perfil-promocoes-secao', 'perfil-promocoes', postos.carreira, gravadas, adicionar);
      montarDatas('perfil-promocoes-praca-secao', 'perfil-promocoes-praca', postos.praca, gravadas, adicionar);
      if (institucionais.quadro === 'QPBM' && lista && postos.carreira.length) montarPrimeiro(lista, graus, dataInclusao);
    }).catch(function () {});
  }

  RosterWork.perfilDadosPromocoes = { montar: montar, ehPromocao: ehPromocao, conferir: conferir, sincronizar: sincronizar };
})();
