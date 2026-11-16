/* ============================================================
   ESCALAS — o grupo Fora da escala na célula da grade da Escala
   O banco (ler_escala_mes, a chave "fora" de cada dia) manda os
   operacionais da unidade que estão sem guarnição no dia, por
   antiguidade, com o ícone de quem está fora: em amarelo, com "Voltou
   em DD/MM" no lugar do horário, quem voltou de um afastamento há até
   5 dias (as férias tiram da guarnição; o administrador decide para
   onde ele vai); em vermelho quem devia estar na escala (do 6º dia
   depois da volta, ou sem volta: a mesma regra do Para corrigir do
   Início); "Entra em DD/MM" de quem já tem a entrada marcada; riscado,
   com "Férias até DD/MM", quem está afastado, também quem continua na
   guarnição (só com o filtro Afastamentos). O
   grupo vem por último, embaixo do Sobreaviso, na caixa dos grupos
   (escalas-celula-grupos.js).
   Para quem administra o dia, o nome em vermelho ou em amarelo abre a caixa dele
   (escalas-celula-editar.js): Adicionar neste dia (só nele, nas horas
   livres, como o Adicionar do pelotão), Adicionar à guarnição do dia,
   já com ele (escalas-celula-editar-acoes.js › naGuarnicao, o mesmo do
   pelotão: vai para o rascunho e o Salvar do rodapé grava), e Abrir
   o painel do dia.
   Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaFora.{ preencher, menu }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function api() { return RW.escalasPainelEditar.sub; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* o grupo no fim da célula (curto: o posto curto das células pequenas; D: a dica das linhas, escalas-celula-dica.js) */
  function preencher(celula, fora, curto, D) {
    if (!(fora || []).length || !RW.escalasCelulaGrupos.naEscala(celula)) return;
    var grupo = RW.escalasCelulaGrupos.caixa('fora');
    if (!grupo) return;
    fora.forEach(function (p) {
      var linha = RW.escalasCelula.montarPessoa(p, curto, D);
      if (!linha) return;
      if (p.origem === 'fora') {
        linha.classList.add('linha-escalado--fora');
        if (p.vermelho) linha.classList.add('linha-escalado--fora-vermelho');
        if (p.aviso) linha.classList.add('linha-escalado--fora-aviso');
        var hora = linha.querySelector('.linha-escalado-hora');
        if (p.aviso && p.voltou_em) hora.textContent = RW.mensagens.escala.voltouEm(diaMes(p.voltou_em));
        else if (p.entra_em) hora.textContent = RW.mensagens.escala.entraEm(diaMes(p.entra_em));
      }
      grupo.appendChild(linha);
    });
    celula.appendChild(grupo);
  }

  /* a caixa 1 do nome em vermelho, com a letra da guarnição do dia (c: a caixa aberta, escalas-celula-editar.js) */
  function menu(c) {
    var el = RW.tpl('tpl-escala-celula-fora');
    if (!el) return null;
    var letra = (api().dados() || {}).guarnicao || null;
    el.querySelector('.escala-celula-letra').textContent = letra || '';
    el.querySelector('.escala-celula-sem-letra').classList.toggle('oculto', !!letra);
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b, c); });
    });
    return el;
  }

  /* Adicionar neste dia: ele já vem escolhido. Com as horas livres dele no dia (a leitura do Adicionar do pelotão), entra
     como no Adicionar do pelotão e a caixa dele abre no horário; sem horas livres, o aviso. Os pontos só depois de 0,5 s */
  function nesteDia(botao, c) {
    var a = c.a;
    a.acao = 'neste-dia';
    a.botao = botao;
    var pontos = setTimeout(function () { if (c.a === a && a.acao === 'neste-dia') a.caixa.espera(true); }, 500);
    RW.escalasDados.disponiveis(a.unidadeId, a.iso, a.unidadeId, null, false).then(function (r) {
      clearTimeout(pontos);
      if (c.a !== a || a.acao !== 'neste-dia') return;
      a.caixa.espera(false);
      a.acao = null;
      if (!r) { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.escala.falhaCarregar }); return; }
      var dele = RW.escalasPainelAdicionarListas.dia(r, a.unidadeId).filter(function (x) { return x.cpf === a.cpf; })[0];
      if (!dele) { RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.escala.foraSemHoras }); return; }
      RW.escalasCelulaAcoes.escolher(dele, c);
    });
  }

  /* um item: o mesmo de novo não faz nada; outro termina o de antes */
  function fazer(acao, botao, c) {
    var a = c.a, A = RW.escalasCelulaAcoes;
    if (!a || !a.caixa || !api().livre()) return;
    if (a.botao === botao && a.acao) return;
    A.encerrar(c);
    if (acao === 'painel') { c.fecharTudo('guardar'); c.abrirPainel(null); }
    else if (acao === 'neste-dia') nesteDia(botao, c);
    else if (acao === 'guarnicao') A.naGuarnicao(botao, c, a.cpf);
  }

  RW.escalasCelulaFora = { preencher: preencher, menu: menu };
})();
