/* ============================================================
   ESCALAS — a dica do militar na grade (Mês, Semana, Colunas e
   Calendário): por que aquela linha está na escala, uma frase por
   linha da dica (a guarnição, a troca com quem, a Parte e o RW, a
   folga e o motivo dela, o pontual, a extrajornada, o remanejado, a
   mudança de dia, a saída da guarnição, o serviço e a extra no mesmo
   horário e o afastamento).
   A grade (ler_escala_mes) traz a origem de cada linha; o resto vem
   da leitura escala_motivos (a letra da guarnição, as trocas, o
   motivo da folga e a unidade do remanejado), feita depois que as
   células aparecem, uma só para as células desenhadas juntas (a
   grade inteira ou a célula refeita depois do Salvar), sem atrasar
   a grade. Até ela chegar (ou se falhar), a dica mostra o que a
   grade já sabe. Só com a Escala na tela (a Extrajornada usa a
   mesma célula e fica como está).
   Não cria HTML nem escreve estilo: só o data-dica (geral-dica).
   RosterWork.escalasCelulaDica.{ ligada, marcar, celula }.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var pessoas = new WeakMap();   // a linha da grade -> o militar dela (da leitura da grade)
  var motivos = {};              // 'AAAA-MM-DD' -> { guarnicao: { unidade: 'A' }, militares: { cpf: {...} } }
  var esperando = null;          // as células desenhadas que esperam a leitura: { unidades: {}, dias: {} }

  function msg() { return RW.mensagens.escala; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* a Escala está na tela (a Extrajornada desenha a mesma célula, sem esta dica) */
  function ligada() { return !!document.querySelector('.conteudo #escala-modos'); }

  /* o texto da dica: o porquê da linha (pela origem dela) e, embaixo, o remanejado e o serviço e a extra juntos */
  function texto(p, dia, unidadeId) {
    var t = msg(), d = t.dica, m = (dia && dia.militares && dia.militares[p.cpf]) || {};
    var letra = (dia && dia.guarnicao && dia.guarnicao[unidadeId]) || '';
    var frases = [];
    switch (p.origem) {
      case 'sistema': frases.push(d.guarnicao(letra)); break;
      case 'base': frases.push(d.entrada(letra)); break;
      case 'saida': frases.push(d.ultimo(letra)); break;
      case 'troca':
      case 'troca_saida':
        if ((m.trocas || []).length) m.trocas.forEach(function (x) { frases.push(d.troca(x.com, x.parte, x.rw)); });
        else frases.push(d.troca());
        break;
      case 'folga': frases.push(d.folga(m.folga)); break;
      case 'pontual': frases.push(d.pontual); break;
      case 'extra': frases.push(d.extra); break;
      case 'remanejado_saida': frases.push(d.foi(m.para)); break;
      case 'mudanca': if (p.mudanca_de) frases.push(t.mudouDeDiaDe(p.mudanca_de)); break;
      case 'mudanca_saida': if (p.mudanca_para) frases.push(t.mudouDeDiaPara(p.mudanca_para)); break;
      case 'saida_guarnicao': frases.push(t.saiuDaGuarnicao(diaMes(p.saida))); break;
      case 'afastamento': frases.push(RW.mensagens.geral.afastadoAte(p.afastamento || '', RW.data.isoParaBR(p.ate).slice(0, 5))); break;
    }
    if (p.remanejado) frases.push(d.veio(m.de));
    if (p.extra_servico && p.extra_servico.length) frases.push(t.extraServicoDica);
    return frases.join('\n');
  }

  /* a dica de uma linha, com o que se sabe agora */
  function escrever(linha) {
    var p = pessoas.get(linha), cel = linha.closest('.escala-mes-celula');
    if (!p || !cel) return;
    var t = texto(p, motivos[cel.dataset.iso], cel.dataset.unidadeId);
    if (t) linha.setAttribute('data-dica', t);
    else linha.removeAttribute('data-dica');
  }

  /* a linha nova (escalas-celula.js › montarPessoa) guarda o militar dela */
  function marcar(linha, p) { pessoas.set(linha, p); }

  /* a leitura dos motivos das células desenhadas juntas: o período do primeiro ao último dia delas, nas unidades delas.
     O dia que chega se junta ao que já se sabia (as unidades de outra leitura ficam) e as dicas desses dias são refeitas */
  function ler() {
    var e = esperando;
    esperando = null;
    var dias = Object.keys(e.dias).sort(), ids = Object.keys(e.unidades);
    if (!dias.length || !ids.length || !RW.escalasDados.motivos) return;
    RW.escalasDados.motivos(ids, dias[0], dias[dias.length - 1]).then(function (r) {
      if (!r) return;   // a leitura falhou: a dica fica com o que a grade sabe
      dias.forEach(function (iso) {
        var antes = motivos[iso] || {}, novo = r[iso] || {};
        motivos[iso] = {
          guarnicao: Object.assign({}, antes.guarnicao, novo.guarnicao),
          militares: Object.assign({}, antes.militares, novo.militares)
        };
      });
      [].forEach.call(document.querySelectorAll('.escala-mes-celula .linha-escalado'), function (linha) {
        var cel = linha.closest('.escala-mes-celula');
        if (cel && e.dias[cel.dataset.iso] && e.unidades[cel.dataset.unidadeId]) escrever(linha);
      });
    });
  }

  /* a célula desenhada (escalas-celula.js › preencherCelula): as dicas já com o que se sabe e, depois que as células da vez
     aparecem, a leitura dos motivos delas */
  function celula(cel) {
    [].forEach.call(cel.querySelectorAll('.linha-escalado'), escrever);
    var iso = cel.dataset.iso, uid = cel.dataset.unidadeId;
    if (!iso || !uid) return;
    if (!esperando) { esperando = { unidades: {}, dias: {} }; setTimeout(ler, 0); }
    esperando.unidades[uid] = true;
    esperando.dias[iso] = true;
  }

  RW.escalasCelulaDica = { ligada: ligada, marcar: marcar, celula: celula };
})();
