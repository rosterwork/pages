/* ============================================================
   TEMPO — formata DURAÇÃO em minutos como texto ("1h30")
   Fonte única do formatador de horas (banco de horas, KPIs).
   NÃO cobre "hora do dia" (08:00 -> "08h"): esses formatadores
   são específicos de cada tela e têm saídas diferentes entre si;
   ficam onde estão.
   API: RosterWork.tempo.horas(min) / .horasComSinal(min) / .doisDig(n)
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function doisDig(n) { return n < 10 ? '0' + n : '' + n; }

  /* minutos -> "8h" / "1h30" / "0h" (magnitude, sem sinal) */
  function horas(min) {
    var a = Math.abs(min || 0);
    var h = Math.floor(a / 60), m = a % 60;
    return m === 0 ? h + 'h' : h + 'h' + doisDig(m);
  }

  /* com sinal, para saldo negativo: "-1h30" (0 e positivos sem prefixo) */
  function horasComSinal(min) { return (min < 0 ? '-' : '') + horas(min); }

  window.RosterWork.tempo = { horas: horas, horasComSinal: horasComSinal, doisDig: doisDig };
})();
