/* ============================================================
   ESCALAS — painel lateral de detalhes (abre ao clicar na célula)
   Liga o clique numa célula da grade Mês/Agenda à "gaveta"
   (componente geral-painel): título = unidade (o pelotão mostra a
   companhia acima), complemento = " - cidade", subtítulo = data
   por extenso, abas Dia/Ciclo/Extrajornada (Ciclo só para o
   administrador; por dentro, as seções distribuicao/continuos/extra).
   O Dia (escalas-painel-editar.js) é a mesma lista para todos: o
   admin já edita nela; quem não é admin só lê. A Extrajornada
   (escalas-painel-extra.js) também é do administrador editar.
   O mesmo painel abre na página Extrajornada (Calendário e Distribuição).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var celulaSelecionada = null;
  var pCtx = null;   // contexto do painel aberto: { unidadeId, iso, secao }

  /* origem -> arquivo do ícone (o cadeado entra à parte, quando o militar é fixado) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base',
    saida: 'icone-origem-saida',
    troca: 'icone-origem-troca',
    pontual: 'icone-origem-pontual',
    sistema: 'icone-origem-sistema',
    extra: 'icone-extrajornada'
  };

  /* aviso do motor (escalas_onde.aviso) -> chave no catálogo RosterWork.mensagens.escala.erros */
  var AVISO_MOTOR = {
    parcial_com_erro: 'distribuicaoTravada',
    grau_por_falta:   'grauRebaixado',
    grau_exclusivo:   'grauExclusivo',
    rodizio_quebrado: 'rodizioRepetido',
    resolva_escala:   'resolvaEscala',
    exclusivo_condutor: 'exclusivoCondutor',
    chefe_condutor:   'chefeCondutor',
    afastado:         'afastadoTroca'
  };


  function definirIcone(svg, nomeIcone) {
    var uso = svg.querySelector('use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#' + nomeIcone);
  }

  /* "08:00" -> "08h" (hora cheia) */
  function formatarHora(hhmm) {
    if (!hhmm) return '';
    return hhmm.split(':')[0] + 'h';
  }

  /* abrevia as funções longas, separando a base do número
     ("Rádio Operador 2" → "Rádio Op. 2"); as demais ficam como estão */
  function abreviarFuncao(nome) {
    var m = /^(.*?)\s+(\d+)$/.exec(nome || '');
    var base = m ? m[1] : (nome || '');
    var num = m ? (' ' + m[2]) : '';
    var n = base.toLowerCase();
    if (n === 'oficial de área' || n === 'oficial de area') return 'Of. Área' + num;
    if (n === 'chefe de socorro') return 'Chef. Soc.' + num;
    if (n === 'radio operador' || n === 'rádio operador') return 'Rádio Op.' + num;
    return base + num;
  }

  /* a hora cabe na janela de disponibilidade [hi, hf]? (relógio circular; hi==hf = 24h) */
  function dentroDaJanela(hora, hi, hf) {
    if (!hi || !hf || !hora) return true;
    function emMin(t) { var p = t.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10); }
    var ini = emMin(hi);
    var jan = (emMin(hf) - ini + 1440) % 1440;
    if (jan === 0) jan = 1440;
    return ((emMin(hora) - ini + 1440) % 1440) <= jan;
  }

  /* início válido: dentro da janela e não na ponta final (não dá para começar quando ela acaba) */
  function inicioValido(hora, hi, hf) { return dentroDaJanela(hora, hi, hf) && hora !== hf; }
  /* fim válido: dentro da janela e não na ponta inicial */
  function fimValido(hora, hi, hf) { return dentroDaJanela(hora, hi, hf) && hora !== hi; }

  /* texto do motivo do conflito (tooltip) */
  function motivoIncompativel(m) {
    if (!m.disp_hi || !m.disp_hf) return 'Militar não está de serviço neste dia';
    return 'Fora da disponibilidade ' + formatarHora(m.disp_hi) + ' às ' + formatarHora(m.disp_hf);
  }

  /* pinta de vermelho só os pedaços incompatíveis: ícones; nome/grad se sem serviço; a hora errada */
  function marcarConflito(linha, m, elIni, elFim) {
    if (!m || !m.incompativel) return;
    var semDisp = !m.disp_hi || !m.disp_hf;
    var per = (m.periodos && m.periodos[0]) || {};
    var icones = linha.querySelector('.escala-distribuicao-icones');
    if (icones) icones.classList.add('escala-incompativel');
    linha.setAttribute('data-dica', motivoIncompativel(m));
    if (semDisp) {
      var grad = linha.querySelector('.escala-distribuicao-grad'); if (grad) grad.classList.add('escala-incompativel');
      var nome = linha.querySelector('.escala-distribuicao-nome'); if (nome) nome.classList.add('escala-incompativel');
    }
    if (elIni && (semDisp || !inicioValido(per.hi, m.disp_hi, m.disp_hf))) elIni.classList.add('escala-incompativel');
    if (elFim && (semDisp || !fimValido(per.hf, m.disp_hi, m.disp_hf))) elFim.classList.add('escala-incompativel');
  }

  /* aviso do motor no militar: dica (hover) com o(s) motivo(s) + marca amarela discreta nos ícones.
     m.aviso pode trazer mais de um motivo separado por vírgula (ex.: grau_por_falta,rodizio_quebrado).
     A dica não sobrescreve a de conflito (mais grave); a marca amarela só entra em aviso de nível alerta. */
  function marcarAviso(linha, m) {
    if (!m || !m.aviso) return;
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    var defs = String(m.aviso).split(',').map(function (a) { return cat[AVISO_MOTOR[a]]; }).filter(Boolean);
    if (!defs.length) return;
    if (!linha.getAttribute('data-dica')) {
      linha.setAttribute('data-dica', defs.map(function (d) { return d.texto; }).join('; '));
    }
    if (defs.some(function (d) { return d.nivel === 'alerta'; })) {
      var icones = linha.querySelector('.escala-distribuicao-icones');
      if (icones) {
        var marca = RosterWork.tpl('tpl-escala-mes-origem');
        if (marca) { definirIcone(marca, 'icone-alerta'); marca.classList.add('escala-distribuicao-marca-aviso'); icones.appendChild(marca); }
      }
    }
  }

  /* problemas da colocação (vindos do banco em dados.problemas) -> chave no catálogo de erros;
     vermelho trava a escala, amarelo deixa funcionar */
  var PROBLEMA_COLOCACAO = {
    cnh_incompativel: 'cnhIncompativel',
    regra_proibida:   'regraProibida',
    exclusivo_fora:   'exclusivoFora',
    grau_diferente:   'grauDiferente'
  };

  function defsProblemas(m) {
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    return ((m && m.problemas) || []).map(function (c) { return cat[PROBLEMA_COLOCACAO[c]]; }).filter(Boolean);
  }

  /* anexa a cada militar das funções os códigos dos problemas da colocação dele (m.problemas), para a
     linha e a caixa do posto pintarem certo; quem decide é o banco, aqui só se casa militar+posto+função */
  function anexarProblemas(dados) {
    var porChave = {};
    ((dados && dados.problemas) || []).forEach(function (p) {
      if (!PROBLEMA_COLOCACAO[p.codigo]) return;
      var k = p.cpf + '|' + p.posto_id + '|' + p.funcao;
      porChave[k] = porChave[k] || [];
      if (porChave[k].indexOf(p.codigo) < 0) porChave[k].push(p.codigo);
    });
    ((dados && dados.postos) || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) { m.problemas = porChave[m.cpf + '|' + po.id + '|' + f.nome] || []; });
      });
    });
    return dados;
  }

  /* problemas da colocação na linha do militar: dica com o motivo; vermelho pinta os ícones como o conflito
     de disponibilidade, amarelo ganha a marca discreta do aviso do motor */
  function marcarProblemas(linha, m) {
    var defs = defsProblemas(m);
    if (!defs.length) return;
    var atual = linha.getAttribute('data-dica');
    var motivos = defs.map(function (d) { return d.texto.replace(/:.*$/, ''); }).join('; ');   // "Condutor sem a CNH exigida"
    linha.setAttribute('data-dica', atual ? atual + '; ' + motivos : motivos);
    var icones = linha.querySelector('.escala-distribuicao-icones');
    if (!icones) return;
    if (defs.some(function (d) { return d.nivel === 'erro'; })) { icones.classList.add('escala-incompativel'); return; }
    if (icones.querySelector('.escala-distribuicao-marca-aviso')) return;
    var marca = RosterWork.tpl('tpl-escala-mes-origem');
    if (marca) { definirIcone(marca, 'icone-alerta'); marca.classList.add('escala-distribuicao-marca-aviso'); icones.appendChild(marca); }
  }

  /* texto da dica do ícone de regra: uma regra por linha ("Exclusivo: Rádio Operador") */
  function textoRegras(regras) {
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.regra) || {};
    return (regras || []).map(function (r) {
      var molde = r.tipo === 'exclusivo' ? cat.exclusivo : cat.proibido;
      return preencher(molde || '{funcao}', { funcao: r.funcao });
    }).join('\n');
  }

  /* ícone de regra (exclusivo/proibido) na tira de ícones do militar; a dica fica no próprio ícone */
  function marcarRegras(linha, m) {
    if (!m || !m.regras || !m.regras.length) return;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    if (!icones) return;
    var el = RosterWork.tpl('tpl-escala-regra-icone');
    if (!el) return;
    el.setAttribute('data-dica', textoRegras(m.regras));
    icones.appendChild(el);
  }

  /* militar de outra unidade (ex.: extra que tira aqui) na tira de ícones; a dica diz a unidade dele */
  function marcarOutraUnidade(linha, m) {
    if (!m || !m.de_unidade) return;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    if (!icones) return;
    var el = RosterWork.tpl('tpl-escala-outra-unidade-icone');
    if (!el) return;
    el.setAttribute('data-dica', RosterWork.mensagens.escala.deOutraUnidade(m.de_unidade));
    icones.appendChild(el);
  }

  /* pior de dois níveis, na ordem 'erro' > 'alerta' > '' */
  function piorNivel(a, b) {
    if (a === 'erro' || b === 'erro') return 'erro';
    if (a === 'alerta' || b === 'alerta') return 'alerta';
    return '';
  }

  /* nível de um militar na função: 'erro' (fora da disponibilidade, CNH, regra proibida) > 'alerta'
     (aviso amarelo do motor, exclusivo fora da função, grau diferente) > '' */
  function nivelDoMilitar(m) {
    if (!m) return '';
    var probs = defsProblemas(m);
    if (m.incompativel || probs.some(function (d) { return d.nivel === 'erro'; })) return 'erro';
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    var temAlerta = String(m.aviso || '').split(',').some(function (a) {
      var d = cat[AVISO_MOTOR[a]]; return d && d.nivel === 'alerta';
    }) || probs.some(function (d) { return d.nivel === 'alerta'; });
    return temAlerta ? 'alerta' : '';
  }

  /* nível da função: cadeira vazia = erro; sobreposição = erro; senão o pior dos militares dela */
  function nivelDaFuncao(funcao) {
    if (funcao && funcao.vazio) return 'erro';
    var nivel = (funcao && funcao.sobreposicao) ? 'erro' : '';
    ((funcao && funcao.militares) || []).forEach(function (m) { nivel = piorNivel(nivel, nivelDoMilitar(m)); });
    return nivel;
  }

  /* nível do posto: o pior das suas funções; viatura sem condutor é erro (não opera sem motorista);
     efetivo abaixo do mínimo ou acima do máximo também é erro; abaixo do ideal é alerta */
  function nivelDoPosto(posto) {
    var nivel = (posto && (posto.sem_condutor || posto.abaixo_minimo || posto.acima_maximo)) ? 'erro'
      : (posto && posto.abaixo_ideal ? 'alerta' : '');
    ((posto && posto.funcoes) || []).forEach(function (f) { nivel = piorNivel(nivel, nivelDaFuncao(f)); });
    return nivel;
  }

  /* "1ºPEL: 5 praças"; compostos juntam unidades com " + " (ex.: "2ªCIBM: 1 oficial + 1ºPEL: 7 praças") */
  function textoComposicao(unidades) {
    return (unidades || []).map(function (u) {
      var partes = [];
      if (u.oficiais) partes.push(u.oficiais + (u.oficiais > 1 ? ' oficiais' : ' oficial'));
      if (u.pracas) partes.push(u.pracas + (u.pracas > 1 ? ' praças' : ' praça'));
      return (u.nome || '') + ': ' + partes.join(' e ');
    }).join(' + ');
  }

  /* uma linha [ícone + texto] na lista do aviso; nivel 'alerta' pinta de amarelo (erro fica vermelho) */
  function avisoItem(lista, icone, texto, nivel) {
    if (!lista) return;
    var item = RosterWork.tpl('tpl-escala-distribuicao-aviso-item');
    if (!item) return;
    if (nivel === 'alerta') item.classList.add('escala-distribuicao-aviso-item--alerta');
    var svg = item.querySelector('.icone');
    if (svg) definirIcone(svg, icone || 'icone-alerta');
    var sp = item.querySelector('span');
    if (sp) sp.textContent = texto;
    lista.appendChild(item);
  }

  /* o posto tem alguém em alguma função? (no Ver, o posto sem ninguém não aparece) */
  function temAlguem(posto) {
    return ((posto && posto.funcoes) || []).some(function (f) { return (f.militares || []).length > 0; });
  }

  /* texto com {marcadores} preenchidos a partir de um objeto de dados */
  function preencher(tpl, dados) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) { return dados && dados[k] != null ? dados[k] : ''; });
  }

  /* avisos amarelos por tipo, cada um com o militar + a vaga (para a lista expansível).
     m.aviso pode ter mais de um motivo (vírgula) — cada motivo entra no seu tipo. Só entra o militar
     que tem o aviso na lista do banco (presentes['codigo|cpf']): o amarelo que é consequência fica de fora.
     Sem os postos (a aba Extrajornada), o detalhe sai da própria lista do banco: o militar e a função */
  function detalharAvisosMotor(postos, presentes, problemas) {
    var det = { grauRebaixado: [], grauExclusivo: [], rodizioRepetido: [], exclusivoCondutor: [], afastadoTroca: [] };
    if (!postos) {
      var vistos = {};
      (problemas || []).forEach(function (p) {
        var k = AVISO_MOTOR[p.codigo], chave = p.codigo + '|' + p.cpf + '|' + p.funcao;
        if (!det[k] || vistos[chave]) return;
        vistos[chave] = true;
        det[k].push({ m: { cpf: p.cpf, grad: p.grad, nome: p.nome }, f: { nome: p.funcao } });
      });
      return det;
    }
    postos.forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          if (!m.aviso) return;
          String(m.aviso).split(',').forEach(function (a) {
            var k = AVISO_MOTOR[a];
            if (det[k] && presentes[a + '|' + m.cpf]) det[k].push({ m: m, f: f });
          });
        });
      });
    });
    return det;
  }

  /* nome do grau ideal (minúsculo) já com o sufixo de sentido, quando ele é útil — a RPC só
     manda ideal_sentido quando existe grau além do ideal naquele sentido (senão vem null) */
  function grauComSentido(f, d) {
    var grau = (f.ideal_grau || '').toLowerCase();
    if (!grau) return '';
    if (f.ideal_sentido === '+') return preencher(d.grauMaisAntigo, { grau: grau });
    if (f.ideal_sentido === '-') return preencher(d.grauMaisModerno, { grau: grau });
    return grau;
  }

  /* uma linha do detalhe: "Cb. Campos está de Rádio Operador, é o exclusivo dessa função (ideal soldado)" */
  function textoDetalhe(tipo, it) {
    var d = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.avisoDetalhe) || {};
    var m = it.m, f = it.f;
    var pessoa = ((m.grad || '') + ' ' + (m.nome || '')).trim();
    var grau = grauComSentido(f, d);
    var motivo = '';
    if (tipo === 'grauRebaixado') {
      motivo = grau ? preencher(d.motivoGrau, { grau: grau }) : 'faltou militar do grau ideal';
    } else if (tipo === 'grauExclusivo') {
      motivo = grau ? preencher(d.motivoExclusivoGrau, { grau: grau }) : 'é o exclusivo dessa função';
    } else if (tipo === 'rodizioRepetido') {
      motivo = d.motivoRodizio || '';
    } else if (tipo === 'exclusivoCondutor') {
      motivo = d.motivoExclusivo || '';
    } else if (tipo === 'afastadoTroca') {
      motivo = d.motivoAfastado || '';
    }
    return preencher(d.linha, { pessoa: pessoa, funcao: f.nome || '', motivo: motivo });
  }

  /* seção amarela expansível: cabeçalho "Título (N)" + chevron que abre a lista de militares */
  function montarAvisoGrupo(lista, tipo, itens, def) {
    if (!lista || !itens || !itens.length || !def) return;
    var grupo = RosterWork.tpl('tpl-escala-distribuicao-aviso-grupo');
    if (!grupo) return;
    var icone = grupo.querySelector('.escala-distribuicao-aviso-icone');
    if (icone) definirIcone(icone, def.icone || 'icone-alerta');
    var titulo = grupo.querySelector('.escala-distribuicao-aviso-titulo');
    if (titulo) titulo.textContent = def.texto + ' (' + itens.length + ')';
    var detalhes = grupo.querySelector('.escala-distribuicao-aviso-detalhes');
    itens.forEach(function (it) {
      var linha = RosterWork.tpl('tpl-escala-distribuicao-aviso-detalhe');
      if (linha && detalhes) { linha.querySelector('span').textContent = textoDetalhe(tipo, it); detalhes.appendChild(linha); }
    });
    var cab = grupo.querySelector('.escala-distribuicao-aviso-cabecalho');
    if (cab && detalhes) {
      cab.addEventListener('click', function () {
        var aberto = cab.getAttribute('aria-expanded') === 'true';
        cab.setAttribute('aria-expanded', aberto ? 'false' : 'true');
        detalhes.classList.toggle('oculto', aberto);
      });
    }
    lista.appendChild(grupo);
  }

  /* a lista de avisos do topo vem pronta do banco (dados.problemas, a mesma fonte do gráfico da grade),
     só com os erros principais: a consequência de um erro (o efetivo da unidade sem modelo, a tripulação
     do posto travado, o amarelo de uma colocação vermelha) fica de fora. Uma linha por tipo de problema,
     vermelho primeiro e amarelo depois; no vermelho: o modelo, quem ficou sem função, os postos e o
     militar em situação errada. faltamModelos e modelosComErro trazem a composição de cada trecho.
     O detalhe amarelo expansível (quem + vaga + motivo) segue montado pelos dados dos postos (sem os
     postos, pela própria lista). Devolve as linhas [{ def, texto }] e, no detalhe, [{ def, texto, tipo, itens }];
     a mesma lista serve à caixa do topo e à aba Extrajornada */
  function linhasDoAviso(problemas, postos, faltamModelos, modelosComErro) {
    var lista = problemas || [];
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    var linhas = [];

    var por = {}, presentes = {};
    lista.forEach(function (p) {
      (por[p.codigo] = por[p.codigo] || []).push(p);
      presentes[p.codigo + '|' + p.cpf] = true;
    });
    function tem(codigo) { return !!(por[codigo] && por[codigo].length); }
    function linha(def, texto) { if (def) linhas.push({ def: def, texto: texto || def.texto }); }
    function militar(p) { return ((p.grad || '') + ' ' + (p.nome || '')).trim(); }
    /* uma linha por ocorrência distinta (ex.: o mesmo militar na mesma função em duas faixas vira uma linha) */
    function porOcorrencia(codigo, def, chave, dadosTexto) {
      if (!def || !tem(codigo)) return;
      var vistos = {};
      por[codigo].forEach(function (p) {
        var k = chave(p);
        if (vistos[k]) return;
        vistos[k] = true;
        linha(def, preencher(def.texto, dadosTexto(p)));
      });
    }
    /* efetivo por posto: junta as faixas do mesmo posto ("das 08h às 14h e das 20h às 08h") */
    function linhasEfetivoProblemas(codigo, def) {
      if (!def || !tem(codigo)) return;
      var postosVistos = [], porPosto = {};
      por[codigo].forEach(function (p) {
        if (!porPosto[p.posto_id]) { porPosto[p.posto_id] = []; postosVistos.push(p.posto_id); }
        porPosto[p.posto_id].push(p);
      });
      postosVistos.forEach(function (id) {
        var itens = porPosto[id];
        var acima = codigo === 'acima_maximo';
        var pessoas = itens.reduce(function (v, p) { return acima ? Math.max(v, p.quantidade) : Math.min(v, p.quantidade); }, acima ? -Infinity : Infinity);
        var diaTodo = itens.length === 1 && itens[0].hi === '08:00' && itens[0].hf === '08:00';
        var faixas = (acima || diaTodo) ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: p.hi, hf: p.hf }); }).join(' e ');
        linha(def, preencher(def.texto, { posto: itens[0].posto || '', pessoas: pessoas, minimo: itens[0].limite, ideal: itens[0].limite, maximo: itens[0].limite, faixas: faixas }));
      });
    }
    /* militar em duas unidades ao mesmo tempo (vermelho): uma linha por militar e par de unidades, juntando as faixas */
    function linhasDuasUnidades(def) {
      if (!def || !tem('duas_unidades')) return;
      var ordem = [], porMilitar = {};
      por.duas_unidades.forEach(function (p) {
        var k = p.cpf + '|' + (p.unidades || []).join('|');
        if (!porMilitar[k]) { porMilitar[k] = []; ordem.push(k); }
        porMilitar[k].push(p);
      });
      ordem.forEach(function (k) {
        var itens = porMilitar[k];
        var diaTodo = itens.length === 1 && itens[0].hi === '08:00' && itens[0].hf === '08:00';
        var faixas = diaTodo ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: p.hi, hf: p.hf }); }).join(' e ');
        linha(def, preencher(def.texto, { militar: militar(itens[0]), unidades: (itens[0].unidades || []).join(' e '), faixas: faixas }));
      });
    }

    /* modelo com erro ou faltando: uma linha por trecho, com a composição do trecho */
    function linhasModelo(codigo, def, trechos) {
      if (!def || !tem(codigo)) return;
      var lista = trechos || [];
      if (!lista.length) linha(def);
      lista.forEach(function (f) {
        linha(def, def.texto + ': ' + textoComposicao(f.unidades) + ', ' + formatarHora(f.hi) + ' às ' + formatarHora(f.hf));
      });
    }

    /* vermelho: a escala não funciona. Primeiro a causa no modelo */
    linhasModelo('parcial_com_erro', cat.modeloComErro, modelosComErro);
    linhasModelo('sem_modelo', cat.faltaModelo || { texto: 'Falta modelo de distribuição', icone: 'icone-alerta', nivel: 'erro' }, faltamModelos);
    /* depois quem ficou sem função (quem ficou sem função por falta de modelo já está na linha do modelo) */
    var semFuncao = {};
    ['sem_funcao', 'resolva_escala'].forEach(function (c) {
      (por[c] || []).forEach(function (p) { semFuncao[p.cpf] = true; });
    });
    var qSemFuncao = Object.keys(semFuncao).length;
    if (qSemFuncao && cat.semFuncao) linha(cat.semFuncao, qSemFuncao === 1 ? cat.semFuncao.texto : preencher(cat.semFuncao.textoPlural, { n: qSemFuncao }));
    /* os postos: o travado diz o motivo e o posto; a frase geral fica para quem o banco não liga a um posto travado */
    porOcorrencia('sem_condutor_habilitado', cat.semCondutorHabilitado, function (p) { return p.posto_id; },
      function (p) { return { posto: p.posto || '', cnh: p.cnh || '' }; });
    porOcorrencia('posto_sem_solucao', cat.postoSemSolucao, function (p) { return p.posto_id; },
      function (p) { return { posto: p.posto || '' }; });
    if (tem('resolva_escala')) linha(cat.resolvaEscala);
    if (tem('sem_condutor')) linha(cat.semCondutor);
    linhasEfetivoProblemas('abaixo_minimo', cat.abaixoMinimo);
    linhasEfetivoProblemas('acima_maximo', cat.acimaMaximo);
    /* o militar em situação errada */
    if (tem('fora_disponibilidade')) linha(cat.foraDisponibilidade);
    if (tem('sem_servico')) linha(cat.semServico);
    if (tem('sobreposicao')) linha(cat.sobreposicao);
    porOcorrencia('cnh_incompativel', cat.cnhIncompativel, function (p) { return p.cpf + '|' + p.posto_id; },
      function (p) { return { militar: militar(p), posto: p.posto || '' }; });
    porOcorrencia('regra_proibida', cat.regraProibida, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    linhasDuasUnidades(cat.duasUnidades);   // o mesmo militar em duas unidades ao mesmo tempo não pode

    /* amarelo: funciona, com erro aceitável */
    if (tem('chefe_condutor')) linha(cat.chefeCondutor);
    linhasEfetivoProblemas('abaixo_ideal', cat.abaixoIdeal);
    porOcorrencia('exclusivo_fora', cat.exclusivoFora, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    porOcorrencia('grau_diferente', cat.grauDiferente, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    var det = detalharAvisosMotor(postos, presentes, lista);   // quem + vaga + motivo, para o detalhe expansível
    [['grau_por_falta', 'grauRebaixado'], ['grau_exclusivo', 'grauExclusivo'], ['rodizio_quebrado', 'rodizioRepetido'],
     ['exclusivo_condutor', 'exclusivoCondutor'], ['afastado', 'afastadoTroca']].forEach(function (par) {
      var def = cat[par[1]], itens = det[par[1]];
      if (tem(par[0]) && def && itens.length) linhas.push({ def: def, texto: def.texto + ' (' + itens.length + ')', tipo: par[1], itens: itens });
    });
    return linhas;
  }

  /* a caixa de avisos do topo: cada linha de linhasDoAviso, a simples e a do detalhe amarelo expansível */
  function montarAvisoProblemas(problemas, postos, faltamModelos, modelosComErro) {
    var linhas = linhasDoAviso(problemas, postos, faltamModelos, modelosComErro);
    if (!linhas.length) return null;
    var aviso = RosterWork.tpl('tpl-escala-distribuicao-aviso');
    if (!aviso) return null;
    var alvo = aviso.querySelector('.escala-distribuicao-aviso-lista');
    linhas.forEach(function (l) {
      if (l.itens) montarAvisoGrupo(alvo, l.tipo, l.itens, l.def);
      else avisoItem(alvo, l.def.icone, l.texto, l.def.nivel);
    });
    if (!alvo.children.length) return null;
    return aviso;
  }

  /* subtítulo: data por extenso — "Segunda-feira, 2 de abril de 2026" */
  function dataPorExtenso(iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function desmarcar() {
    if (celulaSelecionada) {
      celulaSelecionada.classList.remove('escala-mes-celula--selecionada');
      celulaSelecionada = null;
    }
    pCtx = null;
    if (RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (RosterWork.escalasPainelContinuos) RosterWork.escalasPainelContinuos.reset();
    if (RosterWork.escalasPainelExtra) RosterWork.escalasPainelExtra.reset();
  }

  /* ---------- guarda de descarte: avisa antes de perder rascunho não salvo ---------- */
  /* seções com rascunho não salvo (o Dia e o Ciclo gravam cada mudança na hora, e o rascunho da Extrajornada é do mês
     e não se perde ao trocar de dia ou de aba) */
  function secaoSuja() {
    return !!(RosterWork.escalasPainelExtra && RosterWork.escalasPainelExtra.estaSujo && RosterWork.escalasPainelExtra.estaSujo());
  }
  function limparSecoesSujas() {
    if (RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (RosterWork.escalasPainelContinuos) RosterWork.escalasPainelContinuos.reset();
    if (RosterWork.escalasPainelExtra) RosterWork.escalasPainelExtra.reset();
  }
  /* mesmo aviso do botão Cancelar (Descartar / Continuar editando) */
  function confirmarDescarte(aoConfirmar) {
    if (!RosterWork.confirmar) { aoConfirmar(); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.escala.descartarAlteracoes,
      textoConfirmar: RosterWork.mensagens.botoes.descartar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }
  /* interceptador do Esc/X (via geral-painel.aoTentarFechar): segura o fechamento se houver rascunho */
  function tentarFecharPainel() {
    /* na Escala, o rascunho da extra só aparece no painel: fechar pede para descartar */
    if (RosterWork.escalasPainelExtra && RosterWork.escalasPainelExtra.fecharSujo && RosterWork.escalasPainelExtra.fecharSujo()) {
      RosterWork.escalasExtraRascunho.cancelar(function () { RosterWork.painel.fechar(); });
      return true;
    }
    if (!secaoSuja()) return false;               // nada sujo: deixa o painel fechar normalmente
    confirmarDescarte(function () { RosterWork.painel.fechar(); });
    return true;                                  // segura o fechamento até confirmar
  }
  /* guarda a troca de aba de seção: segura o clique antes de o geral-abas trocar,
     confirma o descarte e só então repassa o clique. Sem "piscar" (intercepta na captura). */
  function ligarGuardaAbas(trilho) {
    if (!trilho) return;
    trilho.addEventListener('click', function (e) {
      if (!pCtx) return;                          // outra tela é a dona do painel: não interfere
      var aba = e.target.closest('.aba');
      if (!aba || aba.classList.contains('aba--ativa') || !secaoSuja()) return;
      e.preventDefault();
      e.stopPropagation();                        // segura o ouvinte delegado do geral-abas
      confirmarDescarte(function () { limparSecoesSujas(); aba.click(); });
    }, true);                                     // captura: roda antes do geral-abas
  }

  /* um horário: início + seta + fim (a seta some quando não há fim) */
  function montarHora(p) {
    var hora = RosterWork.tpl('tpl-escala-distribuicao-hora');
    if (!hora) return null;
    var ini = hora.querySelector('.escala-distribuicao-hora-ini');
    var fim = hora.querySelector('.escala-distribuicao-hora-fim');
    var seta = hora.querySelector('.escala-distribuicao-hora-seta');
    ini.textContent = formatarHora(p.hi);
    if (p.hf) {
      fim.textContent = formatarHora(p.hf);
    } else {
      fim.classList.add('oculto');
      if (seta) seta.classList.add('oculto');
    }
    return hora;
  }

  /* uma linha de militar: ícone de origem (+ cadeado) + grad + nome + coluna de horários */
  function montarLinhaEscalado(m, opts) {
    var linha = RosterWork.tpl('tpl-escala-distribuicao-escalado');
    if (!linha) return null;
    if (opts && opts.ghost) linha.classList.add('escala-distribuicao-escalado--automatico');

    var icones = linha.querySelector('.escala-distribuicao-icones');
    var origem = RosterWork.tpl('tpl-escala-mes-origem');
    if (origem) { definirIcone(origem, ICONE_ORIGEM[m.origem] || ICONE_ORIGEM.sistema); icones.appendChild(origem); }
    if (m.fixado) {
      var cadeado = RosterWork.tpl('tpl-escala-mes-origem');
      if (cadeado) { definirIcone(cadeado, 'icone-cadeado'); icones.appendChild(cadeado); }
    }
    marcarRegras(linha, m);
    marcarOutraUnidade(linha, m);

    linha.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (window.RosterWork.busca) linha.setAttribute('data-busca', window.RosterWork.busca.chave(m));   // busca do sub-cabeçalho (modo Dia)

    var horas = linha.querySelector('.escala-distribuicao-horas');
    (m.periodos || []).forEach(function (p) {
      var hora = montarHora(p);
      if (hora) horas.appendChild(hora);
    });
    if (!(opts && opts.ghost)) {
      marcarConflito(linha, m, horas.querySelector('.escala-distribuicao-hora-ini'), horas.querySelector('.escala-distribuicao-hora-fim'));
      marcarAviso(linha, m);
      marcarProblemas(linha, m);
    }
    return linha;
  }

  /* MESCLA (viatura): junta o papel especial (Chefe/Of. Área) com o Condutor do MESMO militar
     numa entrada de dois rótulos (um nome só). A numeração dos "Efetivo N" vem PRONTA do banco
     (calcular_faixas_onde_dia renumera por cadeira, contando o par acumulado como 1, POR FAIXA);
     aqui não se renumera, senão a folga/troca parcial quebraria. Copia (não muta o leitor). */
  function mesclarFuncoesViatura(posto) {
    var lista = ((posto && posto.funcoes) || []).map(function (f) {
      var c = {}; for (var k in f) c[k] = f[k]; return c;   // cópia rasa
    });
    if (!posto || posto.tipo !== 'viatura') return lista;
    lista.sort(function (a, b) { return (Number(a.ordem) || 0) - (Number(b.ordem) || 0); });
    var PAPEL = ['Chefe de Socorro', 'Oficial de Área'];
    var especial = null;
    lista.forEach(function (f) {
      if (PAPEL.indexOf(f.nome) >= 0 && f.militares && f.militares.length) especial = f;
    });
    if (especial && especial.militares[0]) {
      var cpf = especial.militares[0].cpf, idx = -1;
      lista.forEach(function (f, i) {
        if (/^Condutor/i.test(f.nome) && f.militares && f.militares[0] && f.militares[0].cpf === cpf) idx = i;
      });
      if (idx >= 0) { especial.nomes = [especial.nome, lista[idx].nome]; lista.splice(idx, 1); }
    }
    return lista;
  }

  /* um grupo: rótulo da função + as linhas dos militares daquela função */
  function montarGrupoFuncao(funcao, editar) {
    var grupo = RosterWork.tpl('tpl-escala-distribuicao-grupo');
    if (!grupo) return null;
    var fnEl = grupo.querySelector('.escala-distribuicao-funcao');
    var nf = nivelDaFuncao(funcao);
    if (nf) fnEl.classList.add('escala-distribuicao-funcao--' + nf);
    /* mescla: papel especial + Condutor do mesmo militar = dois rótulos empilhados, um nome
       só (funcao.nomes); senão, um rótulo (funcao.nome) */
    var rotulos = (funcao.nomes && funcao.nomes.length) ? funcao.nomes : [funcao.nome];
    rotulos.forEach(function (nm) {
      var rot = RosterWork.tpl('tpl-escala-distribuicao-funcao-rotulo');
      if (rot) { rot.textContent = abreviarFuncao(nm); fnEl.appendChild(rot); }
    });
    var lista = grupo.querySelector('.escala-distribuicao-militares');
    if (funcao.vazio) {
      /* cadeira sem ninguém: linha vermelha explicando, no lugar do militar */
      var vazio = RosterWork.tpl('tpl-escala-vaga-vazia');
      if (vazio) {
        var vtxt = vazio.querySelector('.escala-vaga-vazia-texto');
        var msg = RosterWork.mensagens.escala || {};
        if (vtxt) vtxt.textContent = msg.vagaVazia ? msg.vagaVazia(funcao.vazio_motivo) : 'Vazio';
        lista.appendChild(vazio);
      }
    }
    (funcao.militares || []).forEach(function (m) {
      var linha = montarLinhaEscalado(m);
      if (linha) lista.appendChild(linha);
    });
    /* no Editar, mostra abaixo a distribuição automática trocada/removida (riscada) */
    if (editar) {
      (funcao.ghosts || []).forEach(function (g) {
        var linha = montarLinhaEscalado(g, { ghost: true });
        if (linha) lista.appendChild(linha);
      });
    }
    return grupo;
  }

  /* troca de viatura com data: "No lugar da ABT-14935 até 25/10", embaixo do prefixo (null sem troca) */
  function montarNoLugar(posto) {
    if (!posto || !posto.no_lugar_de || !posto.substituida_ate) return null;
    var el = RosterWork.tpl('tpl-escala-posto-no-lugar');
    if (!el) return null;
    var p = String(posto.substituida_ate).slice(0, 10).split('-');
    el.textContent = RosterWork.mensagens.escala.noLugarDe
      .replace('{prefixo}', posto.no_lugar_de).replace('{data}', p.length === 3 ? p[2] + '/' + p[1] : '');
    return el;
  }

  /* rodapé "Alterações manuais (N)": quem mexeu no dia, quando e o quê (ajustes do Dia, pontuais,
     folgas, observações e entradas/saídas do ciclo que começam no dia). Sem alterações, o rodapé não
     aparece. aindaVale() diz se o rodapé ainda é dele quando a leitura chega (o Dia pode ter mudado) */
  function montarAlteracoes(rodape, unidadeId, iso, aindaVale) {
    rodape.textContent = '';
    rodape.classList.add('oculto');
    if (!RosterWork.escalasDados || !RosterWork.escalasDados.lerAlteracoesDia) return;
    RosterWork.escalasDados.lerAlteracoesDia(unidadeId, iso).then(function (lista) {
      /* outro dia/unidade/seção foi aberto enquanto carregava, ou o Dia ganhou alteração: não mexe no rodapé */
      if (!pCtx || pCtx.unidadeId !== unidadeId || pCtx.iso !== iso || pCtx.secao !== 'distribuicao') return;
      if (aindaVale && !aindaVale()) return;
      var bloco = RosterWork.alteracoes ? RosterWork.alteracoes.montar('tpl-escala-alteracoes', lista) : null;
      if (!bloco) return;
      rodape.textContent = '';
      rodape.appendChild(bloco);
      rodape.classList.remove('oculto');
    });
  }

  /* troca o conteúdo do corpo e o rodapé conforme a aba de seção: o Dia é a lista que o admin edita
     (e os outros só leem), o Ciclo (só admin) é sempre edição, a Extrajornada o admin edita (os horários
     de cada militar, no rascunho do mês) e os outros só leem */
  function mostrarSecao(secao) {
    if (!pCtx) return;
    pCtx.secao = secao;
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    var rodape = RosterWork.painel.rodape();
    /* o subcabeçalho é de cada seção (o Dia do admin põe nele o Adicionar militar) */
    var sub = RosterWork.painel.subcabecalho();
    if (sub) { sub.textContent = ''; sub.classList.add('oculto'); }
    /* ao entrar numa seção, zera as outras (rascunhos/estado não vazam entre abas) */
    if (secao !== 'distribuicao' && RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (secao !== 'continuos' && RosterWork.escalasPainelContinuos) RosterWork.escalasPainelContinuos.reset();
    if (secao !== 'extra' && RosterWork.escalasPainelExtra) RosterWork.escalasPainelExtra.reset();
    if (secao === 'distribuicao' && RosterWork.escalasPainelEditar) {
      /* o dia é de quem tem a unidade na área do papel */
      RosterWork.escalasPainelEditar.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso, {
        admin: RosterWork.sessao.podeAdministrar('pelotao', pCtx.unidadeId)
      });
    } else if (secao === 'continuos' && RosterWork.escalasPainelContinuos) {
      RosterWork.escalasPainelContinuos.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso);
    } else if (secao === 'extra' && RosterWork.escalasPainelExtra) {
      RosterWork.escalasPainelExtra.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso);
    } else {
      corpo.textContent = '';
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    }
  }

  /* abrir outra célula com rascunho aberto: confirma o descarte antes de trocar.
     secao = a aba que abre primeiro (a Extrajornada abre na aba Extrajornada; o padrão é o Dia) */
  function abrirParaCelula(celula, secao) {
    if (secaoSuja()) { confirmarDescarte(function () { abrirParaCelulaAgora(celula, secao); }); return; }
    abrirParaCelulaAgora(celula, secao);
  }

  function abrirParaCelulaAgora(celula, secao) {
    desmarcar();
    celula.classList.add('escala-mes-celula--selecionada');
    celulaSelecionada = celula;

    var unidadeId = celula.dataset.unidadeId;
    var iso = celula.dataset.iso;
    var cidade = celula.dataset.unidadeCidade;
    var inicial = secao || 'distribuicao';
    pCtx = { unidadeId: unidadeId, iso: iso, secao: inicial };
    RosterWork.painel.abrir({
      titulo: celula.dataset.unidadeNome || '',
      tituloExtra: cidade ? '- ' + cidade : '',
      subtitulo: dataPorExtenso(iso),
      largo: true,                             // 560px: a edição da linha abre ali mesmo, com espaço para a lista Quem
      aoFechar: desmarcar,
      aoTentarFechar: tentarFecharPainel       // Esc/X confirmam antes de descartar rascunho
    });

    /* linha das abas de seção: todos veem Dia e Extrajornada; o Ciclo ([data-so-admin]) só quem tem a unidade
       na área do papel. O geral-abas cuida da troca visual e nos avisa a aba escolhida */
    var linha = RosterWork.painel.linhaAbas();
    var tpl = document.getElementById('tpl-escala-painel-secoes');
    if (linha && tpl) {
      linha.appendChild(tpl.content.cloneNode(true));
      if (!RosterWork.sessao.podeAdministrar('pelotao', unidadeId)) {
        linha.querySelectorAll('[data-so-admin]').forEach(function (aba) { aba.remove(); });
        if (inicial === 'continuos') inicial = 'distribuicao';   // sem o Ciclo, abre no Dia
      }
      linha.classList.remove('oculto');
      var trilho = linha.querySelector('.abas');
      if (trilho) {
        Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (a) {
          a.classList.toggle('aba--ativa', a.getAttribute('data-secao') === inicial);
        });
      }
      if (trilho && RosterWork.abas) {
        ligarGuardaAbas(trilho);   // confirma o descarte antes de trocar de seção com rascunho
        RosterWork.abas.ligar(trilho, function (aba) { mostrarSecao(aba.getAttribute('data-secao')); });
      }
    }

    mostrarSecao(inicial);
  }

  /* localiza, na grade atual (qualquer modo), a célula de uma unidade+dia */
  function encontrarCelula(unidadeId, iso) {
    var corpo = document.querySelector('.pagina-corpo');
    if (!corpo) return null;
    return corpo.querySelector(
      '.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"],' +
      '[data-abre-dia][data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]'
    );
  }

  /* uma ação do ciclo (Contínuos) re-renderiza a grade inteira e destrói a célula marcada.
     Enquanto o painel estiver aberto, re-aplica a marcação na célula nova assim que ela
     aparecer (a re-renderização é assíncrona — espera alguns quadros, sem travar). */
  function remarcarSelecionada() {
    if (!pCtx) return;
    var tentativas = 0;
    (function tenta() {
      if (!pCtx) return;   // o painel fechou nesse meio-tempo
      var cel = encontrarCelula(pCtx.unidadeId, pCtx.iso);
      if (cel) {
        if (cel !== celulaSelecionada) {
          if (celulaSelecionada) celulaSelecionada.classList.remove('escala-mes-celula--selecionada');
          cel.classList.add('escala-mes-celula--selecionada');
          celulaSelecionada = cel;
        }
        return;
      }
      if (++tentativas < 60) requestAnimationFrame(tenta);   // ~1s no máximo
    })();
  }

  /* um clique delegado no conteúdo do shell: pega a célula clicada e abre a gaveta (Escala e Extrajornada).
     Delegado no conteúdo (não na grade) para sobreviver às remontagens da grade; liga uma vez só
     (marca no elemento, que fica entre as navegações) */
  var remarcarLigado = false;
  function ligar(conteudo) {
    if (!conteudo || conteudo.dataset.painelDiaLigado) return;
    conteudo.dataset.painelDiaLigado = '1';
    conteudo.addEventListener('click', function (evento) {
      /* célula da grade OU bloco marcado (ex.: a unidade do modo Dia em árvore); no Calendário (Mês e
         Colunas → Dias, e o calendário da Extrajornada), o bloquinho inteiro da unidade (nome incluso)
         vale como a célula que está dentro dele */
      var alvo = evento.target.closest ? evento.target.closest('.escala-mes-celula, [data-abre-dia], .escala-calendario-unidade, .extra-calendario-unidade') : null;
      var celula = alvo && (alvo.classList.contains('escala-calendario-unidade') || alvo.classList.contains('extra-calendario-unidade'))
        ? alvo.querySelector('.escala-mes-celula') : alvo;
      if (!celula || !celula.dataset.unidadeId || !celula.dataset.iso) return;
      /* a grade pode pedir a aba que abre primeiro (a Extrajornada abre na aba Extrajornada) */
      var dono = celula.closest('[data-painel-secao]');
      abrirParaCelula(celula, dono ? dono.getAttribute('data-painel-secao') : null);
    });
    if (!remarcarLigado) {
      remarcarLigado = true;
      window.addEventListener('rosterwork_escala_recarregar', remarcarSelecionada);
    }
  }

  /* busca reutilizável no topo de uma seção do painel (Ciclo): filtra os
     .escala-secao-item das `caixas` pelo grau + nome (sem acento, lendo as spans); caixa
     que fica sem resultado mostra a mensagem de vazio. Reusa a pílula .busca (geral-busca.css). */
  function montarBusca(destino, caixas) {
    if (!destino) return;
    var pilula = RosterWork.tpl('tpl-escala-secao-busca');
    if (!pilula) return;
    var entrada = pilula.querySelector('.busca-entrada');
    var limpar = pilula.querySelector('.busca-limpar');
    function filtrar() {
      var termo = RosterWork.busca.normalizar(entrada ? entrada.value : '');
      pilula.classList.toggle('busca--com-texto', !!(entrada && entrada.value));
      caixas.forEach(function (caixa) {
        var itens = caixa.querySelectorAll('.escala-secao-item');
        var visiveis = 0;
        [].forEach.call(itens, function (it) {
          var g = it.querySelector('.escala-secao-grad'), n = it.querySelector('.escala-secao-nome');
          var casa = !termo || RosterWork.busca.normalizar((g ? g.textContent : '') + ' ' + (n ? n.textContent : '')).indexOf(termo) !== -1;
          it.classList.toggle('oculto', !casa);
          if (casa) visiveis++;
        });
        var vazio = caixa.querySelector('.escala-secao-sem-busca');
        if (termo && itens.length && visiveis === 0) {
          if (!vazio) {
            vazio = RosterWork.tpl('tpl-escala-secao-vazio');
            if (vazio) { vazio.classList.add('escala-secao-sem-busca'); vazio.textContent = (RosterWork.mensagens.escala || {}).buscaVazia || ''; caixa.appendChild(vazio); }
          }
        } else if (vazio) { caixa.removeChild(vazio); }
      });
    }
    if (entrada) entrada.addEventListener('input', filtrar);
    if (limpar) limpar.addEventListener('click', function () { if (entrada) { entrada.value = ''; entrada.focus(); } filtrar(); });
    destino.appendChild(pilula);
  }

  /* ícone por classe de observação (troca/folga/outra unidade automáticas; admin manual) */
  var ICONE_OBS = { troca: 'icone-origem-troca', folga: 'icone-folgas', outra_unidade: 'icone-reforco', admin: 'icone-anotacao' };
  /* a ordem fixa dos grupos das Observações */
  var ORDEM_OBS = ['admin', 'troca', 'folga', 'outra_unidade'];

  /* separa as observações nos grupos, na ordem fixa; dentro do grupo fica a ordem que veio (o banco já ordena
     por antiguidade; as notas novas do Editar entram no fim de Administração). Usado no painel e no PDF.
     Devolve [{ classe, titulo, itens }] só com os grupos que têm itens */
  function agruparObservacoes(obs) {
    var titulos = RosterWork.mensagens.escala.observacoesGrupos;
    return ORDEM_OBS.map(function (classe) {
      return { classe: classe, titulo: titulos[classe], itens: (obs || []).filter(function (o) { return o.classe === classe; }) };
    }).filter(function (g) { return g.itens.length; });
  }

  /* seção "Observações" do dia em grupos: Administração (notas manuais do admin), Trocas, Folgas e De outra unidade
     (automáticas), cada um com a sua lista numerada. Para o admin no Dia: botão para adicionar (com limite)
     e ✕ para excluir SÓ as do admin; as duas coisas gravam na hora.
     Sem editar: só leitura. opcoes = { editar, aoAdicionar(texto), aoRemover(observacao) } */
  function montarObservacoes(obs, opcoes) {
    opcoes = opcoes || {};
    var editar = !!opcoes.editar;
    obs = obs || [];
    if (!obs.length && !editar) return null;   /* Ver/Dia sem observações: some. Editar: sempre aparece */
    var m = RosterWork.mensagens.escala;
    var caixa = RosterWork.painel.criarCaixa(m.observacoesTitulo);
    if (!caixa) return null;

    function linhaObs(o) {
      var linha = RosterWork.tpl('tpl-escala-observacao');
      if (!linha) return null;
      linha.querySelector('.escala-observacao-texto').textContent = m.observacaoTexto(o);
      var rem = linha.querySelector('.escala-observacao-remover');
      /* ✕ só nas do admin, no Editar; trocas e folgas nunca podem ser apagadas */
      if (editar && o.classe === 'admin' && opcoes.aoRemover) {
        rem.addEventListener('click', function () { opcoes.aoRemover(o); });
      } else {
        rem.classList.add('oculto');
      }
      return linha;
    }

    agruparObservacoes(obs).forEach(function (g) {
      var grupo = RosterWork.tpl('tpl-escala-observacao-grupo');
      if (!grupo) return;
      definirIcone(grupo.querySelector('.escala-observacao-icone'), ICONE_OBS[g.classe]);
      grupo.querySelector('.escala-observacao-grupo-nome').textContent = g.titulo;
      var lista = grupo.querySelector('.escala-observacao-lista');
      g.itens.forEach(function (o) { var l = linhaObs(o); if (l) lista.appendChild(l); });
      caixa.appendChild(grupo);
    });

    if (editar) {
      var add = RosterWork.tpl('tpl-escala-observacao-adicionar');
      if (add) {
        var botao = add.querySelector('.escala-observacao-add-botao');
        var campo = add.querySelector('.escala-observacao-campo');
        var input = add.querySelector('.escala-observacao-input');
        var contador = add.querySelector('.escala-observacao-contador');
        var salvar = add.querySelector('.escala-observacao-salvar');
        var cancelar = add.querySelector('.escala-observacao-cancelar');
        var limite = m.observacaoLimite;
        var atualizar = function () { contador.textContent = input.value.length + ' / ' + limite; };
        var abrir = function () { botao.classList.add('oculto'); campo.classList.remove('oculto'); input.value = ''; atualizar(); input.focus(); };
        var fechar = function () { campo.classList.add('oculto'); botao.classList.remove('oculto'); };
        var gravar = function () {
          var texto = input.value.trim();
          fechar();
          if (texto && opcoes.aoAdicionar) opcoes.aoAdicionar(texto);
        };
        botao.addEventListener('click', abrir);
        cancelar.addEventListener('click', fechar);
        salvar.addEventListener('click', gravar);
        input.addEventListener('input', atualizar);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gravar(); } });
        caixa.appendChild(add);
      }
    }
    return caixa;
  }

  window.RosterWork.escalasPainel = {
    ligar: ligar,
    abrir: abrirParaCelula,
    /* peças de montagem reaproveitadas pelo Dia (escalas-painel-editar/-formulario/-militar)
       e pela gaveta da Extrajornada */
    pecas: {
      definirIcone: definirIcone,
      iconeOrigem: ICONE_ORIGEM,
      formatarHora: formatarHora,
      hora: montarHora,
      marcarAviso: marcarAviso,
      marcarRegras: marcarRegras,
      marcarOutraUnidade: marcarOutraUnidade,
      dataPorExtenso: dataPorExtenso,
      abreviarFuncao: abreviarFuncao,
      linha: montarLinhaEscalado,
      grupo: montarGrupoFuncao,
      mesclarFuncoes: mesclarFuncoesViatura,
      marcarConflito: marcarConflito,
      alteracoes: montarAlteracoes,
      temAlguem: temAlguem,
      nivelFuncao: nivelDaFuncao,
      nivelPosto: nivelDoPosto,
      montarAvisoProblemas: montarAvisoProblemas,
      linhasDoAviso: linhasDoAviso,
      anexarProblemas: anexarProblemas,
      marcarProblemas: marcarProblemas,
      montarBusca: montarBusca,
      noLugar: montarNoLugar,
      observacoes: montarObservacoes,
      agruparObservacoes: agruparObservacoes
    }
  };
})();
