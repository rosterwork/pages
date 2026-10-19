/* ============================================================
   CAMPOS — o comportamento padrão de formulário, compartilhado
   Máscaras (CPF, RG, celular, data), capitalização de nome com
   conectores, campo de data com calendário, campo de seleção
   (dropdown), os postos que ganham data de promoção e a marcação
   de erro embaixo do campo.
   Expõe RosterWork.campos e RosterWork.validacoes.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* ---------- máscaras ---------- */

  function soDigitos(texto) {
    return String(texto || '').replace(/\D/g, '');
  }

  function mascararCpf(d) {
    d = d.substring(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  /* RG nos dois formatos antigos: 0.000.000-0 (8 dígitos) e 00.000.000-0 (9);
     na carteira nova do Paraná o RG é o próprio CPF (11), no formato do CPF.
     O desenho acompanha a quantidade de números digitados (igual ao login) */
  function mascararRg(d) {
    d = d.substring(0, 11);
    if (d.length >= 10) return mascararCpf(d);
    if (d.length === 9) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '-' + d.slice(8);
    if (d.length <= 1) return d;
    if (d.length <= 4) return d.slice(0, 1) + '.' + d.slice(1);
    if (d.length <= 7) return d.slice(0, 1) + '.' + d.slice(1, 4) + '.' + d.slice(4);
    return d.slice(0, 1) + '.' + d.slice(1, 4) + '.' + d.slice(4, 7) + '-' + d.slice(7);
  }

  function mascararCelular(d) {
    d = d.substring(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function mascararData(d) { return RosterWork.data.mascararData(d); }

  /* reformata o campo preservando a posição do cursor (conta os dígitos antes dele) */
  function aplicarMascara(input, mascarar) {
    var pos = input.selectionStart;
    var digitosAntes = soDigitos(input.value.substring(0, pos)).length;
    var formatado = mascarar(soDigitos(input.value));
    input.value = formatado;
    var novaPos = 0;
    var cont = 0;
    for (var i = 0; i < formatado.length; i++) {
      if (/\d/.test(formatado[i])) {
        cont++;
        if (cont === digitosAntes) { novaPos = i + 1; break; }
      }
    }
    if (cont < digitosAntes) novaPos = formatado.length;
    input.setSelectionRange(novaPos, novaPos);
  }

  function ligarMascara(input, mascarar) {
    if (!input) return;
    input.addEventListener('input', function () { aplicarMascara(input, mascarar); });
  }

  /* ---------- nome completo (só letras, capitalização com conectores) ---------- */

  var conectores = ['de', 'da', 'do', 'das', 'dos', 'e'];

  function filtrarLetras(texto) {
    return texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
  }

  function capitalizarNome(texto) {
    var partes = texto.split(' ');
    var primeira = true;
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].length === 0) continue;
      var minuscula = partes[i].toLowerCase();
      if (!primeira && conectores.indexOf(minuscula) !== -1) {
        partes[i] = minuscula;
      } else {
        partes[i] = minuscula.charAt(0).toUpperCase() + minuscula.substring(1);
      }
      primeira = false;
    }
    return partes.join(' ');
  }

  function ligarNome(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var pos = input.selectionStart;
      var letrasAntes = filtrarLetras(input.value.substring(0, pos)).length;
      input.value = capitalizarNome(filtrarLetras(input.value));
      input.setSelectionRange(letrasAntes, letrasAntes);
    });
  }

  /* o nome de guerra aceita ponto (as formas abreviadas: "J. Lima") */
  function ligarNomeDeGuerra(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var pos = input.selectionStart;
      input.value = capitalizarNome(input.value.replace(/[^a-zA-ZÀ-ÿ.\s]/g, ''));
      input.setSelectionRange(pos, pos);
    });
  }

  /* ---------- datas (máscara + calendário) ---------- */

  function ligarCalendario(input) {
    if (!input || !RosterWork.calendario) return;
    RosterWork.calendario.ligar(input, {
      obterData: function () { return RosterWork.data.paraData(input.value); },
      aoEscolher: function (data) {
        input.value = RosterWork.data.paraBR(data);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  /* campo de data completo: máscara + calendário, do jeito padrão */
  function ligarData(input) {
    ligarMascara(input, mascararData);
    ligarCalendario(input);
  }

  /* ---------- campo de seleção (dropdown com opções) ---------- */

  /* o valor escolhido fica em data-valor do gatilho; mostra o texto do item.
     A delegação no menu funciona mesmo se os itens forem inseridos depois. */
  function ligarSelecao(gatilho, aoEscolher) {
    if (!gatilho) return;
    var dropdown = gatilho.closest('.dropdown');
    if (!dropdown) return;
    var texto = gatilho.querySelector('.campo-selecao-texto');
    var menu = dropdown.querySelector('.dropdown-menu');
    if (!menu) return;
    menu.addEventListener('click', function (evento) {
      var item = evento.target.closest('.dropdown-item');
      if (!item) return;
      gatilho.setAttribute('data-valor', item.getAttribute('data-valor') || item.textContent);
      texto.textContent = item.textContent;
      texto.classList.toggle('campo-selecao-texto--vazio', !gatilho.getAttribute('data-valor'));
      if (typeof aoEscolher === 'function') aoEscolher(gatilho.getAttribute('data-valor'), item);
    });
  }

  /* escreve o valor num campo de seleção sem depender de clique */
  function definirSelecao(gatilho, valor, textoVazio) {
    if (!gatilho) return;
    valor = valor || '';
    gatilho.setAttribute('data-valor', valor);
    var texto = gatilho.querySelector('.campo-selecao-texto');
    if (!texto) return;
    texto.textContent = valor || (textoVazio || 'Selecione');
    texto.classList.toggle('campo-selecao-texto--vazio', !valor);
  }

  /* insere as opções de um campo de seleção dinâmico (clona #tpl-nu-opcao) */
  function popularOpcoes(menu, itens) {
    if (!menu) return;
    menu.textContent = '';
    var tpl = document.getElementById('tpl-nu-opcao');
    if (!tpl) return;
    itens.forEach(function (item) {
      var botao = tpl.content.cloneNode(true).firstElementChild;
      botao.textContent = item.rotulo;
      botao.setAttribute('data-valor', item.valor);
      menu.appendChild(botao);
    });
  }

  function nomeColocacao(quadro) {
    if (quadro === 'QOBM') return 'Colocação CFO';
    if (quadro === 'QOEBM') return 'Colocação CHOE';
    if (quadro === 'QPBM') return 'Colocação CFP';
    return 'Colocação';
  }

  /* ---------- datas de promoção por posto (Novo usuário, ficha e Criar conta) ----------
     Quais postos ganham campo de data. O primeiro posto da carreira não ganha: a data dele é a de
     inclusão. A praça incluída a partir de 01/11/2024 começa como Sd 3ª Classe; antes, como Sd 2ª
     Classe (o Sd 3ª Classe não existia). O oficial tem os postos do quadro dele até o atual (o
     primeiro, Cadete ou Cadete Especialista, é a entrada no quadro) e, à parte, os de praça, só para
     registro. Posto que já tem data sempre aparece. Sem a inclusão não há como saber o primeiro
     posto: nenhum campo. Recebe os graus de buscar_graus_hierarquicos, o grau atual, a inclusão
     (Date ou null) e os ids dos postos com data; devolve { carreira, praca }, do posto mais baixo ao
     mais alto. */
  var INICIO_SD_3A_CLASSE = new Date(2024, 10, 1);

  /* o Sd 3ª Classe só existe para quem foi incluído a partir de 01/11/2024 */
  function grauValeNaInclusao(grauNome, inclusao) {
    return !(grauNome === 'Soldado 3ª Classe' && inclusao && inclusao < INICIO_SD_3A_CLASSE);
  }

  function postosComData(graus, grauId, inclusao, comData) {
    var atual = null, tem = {}, nivelPrimeiro = Infinity;
    (comData || []).forEach(function (id) { tem[String(id)] = true; });
    (graus || []).forEach(function (g) { if (String(g.grau_id) === String(grauId)) atual = g; });
    if (!atual || !inclusao) return { carreira: [], praca: [] };
    var primeiro = (inclusao >= INICIO_SD_3A_CLASSE) ? 'Soldado 3ª Classe' : 'Soldado 2ª Classe';
    graus.forEach(function (g) { if (g.grau_nome === primeiro) nivelPrimeiro = g.grau_antiguidade; });

    function doQuadro(quadro, entra) {
      return graus.filter(function (g) { return g.quadro === quadro && entra(g); })
        .sort(function (a, b) { return b.grau_antiguidade - a.grau_antiguidade; });
    }
    function depoisDoPrimeiro(g) { return g.grau_antiguidade < nivelPrimeiro || !!tem[String(g.grau_id)]; }
    function ateOAtual(g) { return g.grau_antiguidade >= atual.grau_antiguidade; }

    if (atual.quadro === 'QPBM') {
      return { carreira: doQuadro('QPBM', function (g) { return depoisDoPrimeiro(g) && ateOAtual(g); }), praca: [] };
    }
    return { carreira: doQuadro(atual.quadro, ateOAtual), praca: doQuadro('QPBM', depoisDoPrimeiro) };
  }

  /* confere as datas de promoção juntas, na ordem da carreira (do posto mais baixo ao mais alto):
     data válida, nenhuma antes da inclusão e sempre crescendo; vazia não é erro (todas são
     opcionais). O conflito com a inclusão fica no campo da inclusão quando ele está no mesmo
     formulário (inclusaoEl); senão, na própria data. Devolve se está tudo certo */
  function conferirPromocoes(inputs, inclusao, inclusaoEl) {
    var T = RosterWork.mensagens.cadastro, ok = true, anterior = null;
    (inputs || []).forEach(function (input) {
      var valor = (input.value || '').trim();
      if (!valor) return;
      var data = parseData(valor);
      if (!data) { marcarErro(input, T.dataInvalida); ok = false; return; }
      if (inclusao && data < inclusao) {
        if (inclusaoEl) marcarErro(inclusaoEl, T.inclusaoDepoisPromocao); else marcarErro(input, T.promocaoAntesInclusao);
        ok = false;
      } else if (anterior && data <= anterior) {
        marcarErro(input, T.promocaoOrdem);
        ok = false;
      }
      anterior = data;
    });
    return ok;
  }

  /* ---------- erro embaixo do campo (o padrão do site) ---------- */

  /* marca o .campo que contém o elemento com a borda vermelha + a mensagem.
     Acessibilidade: o controle nativo ganha aria-invalid e o texto de erro vira
     role="alert" (o leitor de tela anuncia a mensagem quando ela aparece). */
  function marcarErro(el, mensagem) {
    var campo = el ? el.closest('.campo') : null;
    if (!campo) return;
    campo.classList.add('campo--erro');
    var controle = campo.querySelector('input, select, textarea');
    if (controle) controle.setAttribute('aria-invalid', 'true');
    var alvo = campo.querySelector('.campo-erro-texto');
    if (alvo) { alvo.setAttribute('role', 'alert'); alvo.textContent = mensagem; }
  }

  /* tira o erro de UM campo (o irmão de marcarErro). Mantém o role="alert" no
     texto (região viva vazia = silenciosa) para reanunciar em erros seguintes. */
  function limparErro(el) {
    var campo = el ? el.closest('.campo') : null;
    if (!campo) return;
    campo.classList.remove('campo--erro');
    var controle = campo.querySelector('input, select, textarea');
    if (controle) controle.removeAttribute('aria-invalid');
    var alvo = campo.querySelector('.campo-erro-texto');
    if (alvo) alvo.textContent = '';
  }

  function limparErros(raiz) {
    if (!raiz) return;
    var campos = raiz.querySelectorAll('.campo--erro');
    for (var i = 0; i < campos.length; i++) {
      campos[i].classList.remove('campo--erro');
      var controle = campos[i].querySelector('input, select, textarea');
      if (controle) controle.removeAttribute('aria-invalid');
      var alvo = campos[i].querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    }
  }

  /* ---------- validar ao sair do campo ----------
     `validar(valor)` devolve a mensagem de erro, ou nada quando está certo.
     A regra segue o que a literatura de formulário recomenda:
       · ao SAIR do campo (blur) → cobra, se houver algo digitado;
       · enquanto DIGITA → só revalida se o campo JÁ estava vermelho,
         para o erro sumir assim que a pessoa conserta;
       · campo VAZIO não vira erro aqui — quem cobra o obrigatório é o envio,
         senão o formulário reclama de um campo que a pessoa nem começou. */
  function ligarValidacao(el, validar) {
    if (!el || typeof validar !== 'function') return;

    function conferir(soSeJaErrado) {
      var campo = el.closest('.campo');
      if (soSeJaErrado && !(campo && campo.classList.contains('campo--erro'))) return;
      var valor = (el.value || '').trim();
      if (!valor) { limparErro(el); return; }
      var erro = validar(valor);
      if (erro) marcarErro(el, erro); else limparErro(el);
    }

    el.addEventListener('blur', function () { conferir(false); });
    el.addEventListener('input', function () { conferir(true); });
  }

  /* ---------- validações puras ---------- */

  /* CPF com dígitos verificadores */
  function validarCpf(valor) {
    var n = soDigitos(valor);
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    var soma = 0, i, resto;
    for (i = 0; i < 9; i++) soma += parseInt(n[i], 10) * (10 - i);
    resto = (soma * 10) % 11; if (resto === 10) resto = 0;
    if (resto !== parseInt(n[9], 10)) return false;
    soma = 0;
    for (i = 0; i < 10; i++) soma += parseInt(n[i], 10) * (11 - i);
    resto = (soma * 10) % 11; if (resto === 10) resto = 0;
    return resto === parseInt(n[10], 10);
  }

  /* RG não tem dígito verificador padrão; valem os dois formatos antigos,
     0.000.000-0 (8 dígitos) e 00.000.000-0 (9), e o da carteira nova, que é
     o próprio CPF da pessoa (11 dígitos iguais ao `cpf`) */
  function validarRg(valor, cpf) {
    var d = soDigitos(valor);
    return d.length === 8 || d.length === 9 || (d.length === 11 && d === soDigitos(cpf || ''));
  }

  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor).trim());
  }

  function parseData(valor) { return RosterWork.data.paraData(valor); }
  function paraISO(valor) { return RosterWork.data.paraISO(valor); }

  function idadeEm(nasc) {
    var hoje = new Date();
    var idade = hoje.getFullYear() - nasc.getFullYear();
    var meses = hoje.getMonth() - nasc.getMonth();
    if (meses < 0 || (meses === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  }

  RosterWork.campos = {
    soDigitos: soDigitos, nomeColocacao: nomeColocacao,
    postosComData: postosComData, conferirPromocoes: conferirPromocoes, grauValeNaInclusao: grauValeNaInclusao,
    mascararCpf: mascararCpf, mascararRg: mascararRg,
    mascararCelular: mascararCelular, mascararData: mascararData,
    capitalizarNome: capitalizarNome, filtrarLetras: filtrarLetras,
    ligarMascara: ligarMascara, ligarNome: ligarNome, ligarNomeDeGuerra: ligarNomeDeGuerra,
    ligarSelecao: ligarSelecao, definirSelecao: definirSelecao,
    popularOpcoes: popularOpcoes, ligarCalendario: ligarCalendario, ligarData: ligarData,
    marcarErro: marcarErro, limparErro: limparErro, limparErros: limparErros, ligarValidacao: ligarValidacao
  };

  RosterWork.validacoes = {
    soDigitos: soDigitos, validarCpf: validarCpf, validarRg: validarRg, validarEmail: validarEmail,
    parseData: parseData, paraISO: paraISO, idadeEm: idadeEm
  };
})();
