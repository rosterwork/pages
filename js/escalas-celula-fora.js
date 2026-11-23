/* ============================================================
   ESCALAS — o grupo Fora da escala na célula da grade da Escala
   O banco (ler_escala_mes, a chave "fora" de cada dia) manda os
   operacionais da unidade que estão sem guarnição no dia, por
   antiguidade, com o ícone de quem está fora: em amarelo quem voltou
   de um afastamento há até 5 dias (as férias tiram da guarnição; o
   administrador decide para onde ele vai) ou saiu pelo Remover da
   guarnição há até 5 dias, e em vermelho quem devia estar na escala
   (do 6º dia depois da volta ou da saída, ou sem nenhuma delas: a
   mesma regra do Para corrigir do Início), os dois com "Fora da escala" no
   lugar do horário; "Entra em DD/MM" de quem já tem a entrada marcada
   (também no vermelho); riscado, com "Férias até DD/MM", quem está
   afastado, também quem continua na guarnição (só com o filtro
   Afastamentos). O grupo vem por último, embaixo do Sobreaviso, na
   caixa dos grupos (escalas-celula-grupos.js). Quem tem autorização
   de viagem no dia (a chave "viagens", que a leitura junta a esta
   lista) fica no grupo dela, logo antes: sem riscar, com "Viagem até
   DD/MM" (só com o filtro Incluir autorizações de viagem).
   Para quem administra o dia, o nome em vermelho ou em amarelo, ou com
   a entrada marcada (a linha leva a data dela, data-entra), abre a
   caixa dele (escalas-celula-editar.js): Adicionar neste dia e
   Adicionar à guarnição do dia, os do pelotão já com ele
   (escalas-celula-editar-acoes.js › nesteDia e naGuarnicao: vão para o
   rascunho e o Salvar do rodapé grava), o Cancelar a saída da
   guarnição de quem saiu à mão nos últimos 7 dias (a linha leva a data
   da saída, data-saida; o mesmo do menu da linha,
   escalas-painel-linha-menu.js › cancelarSaida, na hora, com o
   Desfazer), com a entrada marcada o Mudar e o Cancelar a entrada no
   lugar do Adicionar à guarnição (os do primeiro serviço,
   escalas-painel-mudar-entrada.js) e Abrir o painel do dia.
   Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaFora.{ preencher, menu }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function api() { return RW.escalasPainelEditar.sub; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* o grupo no fim da célula (curto: o posto curto das células pequenas; D: a dica das linhas, escalas-celula-dica.js);
     quem tem autorização de viagem no dia vem na mesma lista e vai para o grupo dela, logo antes */
  function preencher(celula, fora, curto, D) {
    if (!(fora || []).length || !RW.escalasCelulaGrupos.naEscala(celula)) return;
    var viagens = fora.filter(function (p) { return p.origem === 'viagem'; });
    var resto = fora.filter(function (p) { return p.origem !== 'viagem'; });
    if (viagens.length) grupoDe(celula, 'viagem', viagens, curto, D);
    if (resto.length) grupoDe(celula, 'fora', resto, curto, D);
  }

  /* um grupo (a caixa com a linha tracejada) com as linhas dele, no fim da célula */
  function grupoDe(celula, nome, lista, curto, D) {
    var grupo = RW.escalasCelulaGrupos.caixa(nome);
    if (!grupo) return;
    lista.forEach(function (p) {
      var linha = RW.escalasCelula.montarPessoa(p, curto, D);
      if (!linha) return;
      if (p.origem === 'fora') {
        linha.classList.add('linha-escalado--fora');
        if (p.vermelho) linha.classList.add('linha-escalado--fora-vermelho');
        if (p.aviso) linha.classList.add('linha-escalado--fora-aviso');
        /* no lugar do horário: no amarelo, "Fora da escala"; a entrada marcada; sem ela, no vermelho, "Fora da escala" */
        var hora = linha.querySelector('.linha-escalado-hora');
        if (p.aviso) hora.textContent = RW.mensagens.escala.foraDaEscala;
        else if (p.entra_em) hora.textContent = RW.mensagens.escala.entraEm(diaMes(p.entra_em));
        else if (p.vermelho) hora.textContent = RW.mensagens.escala.foraDaEscala;
        /* quem saiu à mão: a data da saída (o Cancelar a saída da caixa dele) */
        if (p.fora_motivo === 'saida' && p.fora_desde) linha.setAttribute('data-saida', p.fora_desde);
        /* quem tem a entrada marcada: a linha abre a caixa (o Mudar e o Cancelar a entrada) */
        if (p.entra_em) linha.setAttribute('data-entra', p.entra_em);
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
    /* o Cancelar a saída: só a saída à mão dos últimos 7 dias (antes, o banco não deixa; o caminho é o Adicionar) */
    el.querySelector('[data-acao="cancelar-saida"]').classList.toggle('oculto', !(c.a.saida && c.a.saida >= RW.escalasPainelCiclo.limite()));
    /* com a entrada marcada (a leitura do dia), o Mudar e o Cancelar a entrada no lugar do Adicionar à guarnição, que o
       banco recusa para quem já tem a entrada */
    var E = RW.escalasPainelMudarEntrada, entrada = !!E && !!E.marcada(c.a.cpf);
    el.querySelector('[data-acao="guarnicao"]').classList.toggle('oculto', entrada);
    el.querySelector('[data-acao="mudar-entrada"]').classList.toggle('oculto', !entrada);
    el.querySelector('[data-acao="cancelar-entrada"]').classList.toggle('oculto', !entrada);
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b, c); });
    });
    return el;
  }

  /* um item: o mesmo de novo não faz nada; outro termina o de antes. O Adicionar neste dia e o Adicionar à guarnição são
     os do pelotão, já com ele escolhido (escalas-celula-editar-acoes.js) */
  function fazer(acao, botao, c) {
    var a = c.a, A = RW.escalasCelulaAcoes;
    if (!a || !a.caixa || !api().livre()) return;
    if (a.botao === botao && a.acao) return;
    A.encerrar(c);
    if (acao === 'painel') { c.fecharTudo('guardar'); c.abrirPainel(null); }
    else if (acao === 'neste-dia') A.nesteDia(botao, c, null, a.cpf);
    else if (acao === 'guarnicao') A.naGuarnicao(botao, c, a.cpf);
    else if (acao === 'mudar-entrada') A.mudarEntrada(botao, c, a.cpf);
    else if (acao === 'cancelar-entrada') {
      RW.escalasPainelMudarEntrada.cancelar({ cpf: a.cpf });
      c.fecharTudo();
    } else if (acao === 'cancelar-saida') {
      RW.escalasPainelLinhaMenu.cancelarSaida({ tipo: 'saida', militar: { cpf: a.cpf }, saida: a.saida });
      c.fecharTudo();
    }
  }

  RW.escalasCelulaFora = { preencher: preencher, menu: menu };
})();
