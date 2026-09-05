/* ============================================================
   Data — utilidades de data compartilhadas (RosterWork.data)
   Fonte única para máscara, parse e conversão de datas no site
   (evita cópias iguais em Usuários, Atestados, etc.). Trabalha
   sempre com o formato de tela dd/mm/aaaa e o formato de banco
   AAAA-MM-DD. `soDigitos` fica aqui por ser a base das máscaras.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* só os dígitos de um valor (base das máscaras) */
  function soDigitos(v) {
    return String(v == null ? '' : v).replace(/\D/g, '');
  }

  /* valor digitado -> dd/mm/aaaa (aplica soDigitos; corta em 8) */
  function mascararData(valor) {
    var d = soDigitos(valor).substring(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
    return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
  }

  /* dd/mm/aaaa -> Date (ou null se inválida) */
  function paraData(valor) {
    var n = soDigitos(valor);
    if (n.length !== 8) return null;
    var d = parseInt(n.substring(0, 2), 10),
        m = parseInt(n.substring(2, 4), 10),
        y = parseInt(n.substring(4, 8), 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, m - 1, d);
    if (dt.getDate() !== d || dt.getMonth() !== m - 1 || dt.getFullYear() !== y) return null;
    return dt;
  }

  /* Date -> AAAA-MM-DD */
  function paraIsoDeData(dt) {
    var m = String(dt.getMonth() + 1); if (m.length < 2) m = '0' + m;
    var dia = String(dt.getDate()); if (dia.length < 2) dia = '0' + dia;
    return dt.getFullYear() + '-' + m + '-' + dia;
  }

  /* dd/mm/aaaa -> AAAA-MM-DD (ou null) */
  function paraISO(valor) {
    var dt = paraData(valor);
    return dt ? paraIsoDeData(dt) : null;
  }

  /* Date -> dd/mm/aaaa */
  function paraBR(dt) {
    var d = String(dt.getDate()); if (d.length < 2) d = '0' + d;
    var m = String(dt.getMonth() + 1); if (m.length < 2) m = '0' + m;
    return d + '/' + m + '/' + dt.getFullYear();
  }

  /* AAAA-MM-DD -> dd/mm/aaaa (string; '' se vazio) */
  function isoParaBR(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  window.RosterWork.data = {
    soDigitos: soDigitos,
    mascararData: mascararData,
    paraData: paraData,
    paraIsoDeData: paraIsoDeData,
    paraISO: paraISO,
    paraBR: paraBR,
    isoParaBR: isoParaBR
  };
})();
