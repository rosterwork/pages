/* ============================================================
   ESCALAS — painel lateral de detalhes (abre ao clicar na célula)
   Para quem administra o dia, com o painel fechado, o clique fica
   na própria célula (escalas-celula-editar.js); o Abrir o painel
   do dia dela abre o painel, com o que ela já mexeu.
   Liga o clique numa célula da grade Mês/Agenda à "gaveta"
   (componente geral-painel): título = unidade (o pelotão mostra a
   companhia acima), complemento = " - cidade", subtítulo = data
   por extenso (com a guarnição de serviço, quando a leitura do dia ou a
   aba Guarnições a traz), abas Funções/Estagiários/Guarnições/Extrajornada
   (só para quem edita o dia ou tem a extra; as Estagiários e as
   Guarnições só para o administrador; por dentro, as seções
   distribuicao/estagiarios/continuos/extra).
   A aba Funções (escalas-painel-editar.js) é a mesma lista para
   todos: o admin já edita nela; quem não é admin só lê. A Estagiários
   (escalas-painel-militares.js) é o mesmo dia, só os estagiários, por
   pessoa.
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
    /* o estagiário (Ajustes › Estágios): o pontual do dia de estágio */
    estagio: 'icone-estagio',
    sistema: 'icone-origem-sistema',
    extra: 'icone-extrajornada',
    mudanca: 'icone-origem-mudanca'
  };

  /* aviso do motor (escalas_onde.aviso) -> chave no catálogo RosterWork.mensagens.escala.erros */
  var AVISO_MOTOR = {
    parcial_com_erro: 'distribuicaoTravada',
    grau_por_falta:   'grauRebaixado',
    rodizio_quebrado: 'rodizioRepetido',
    resolva_escala:   'resolvaEscala',
    chefe_condutor:   'chefeCondutor',
    afastado:         'afastadoTroca',
    regra_graduacao:  'regraGraduacao'
  };


  function definirIcone(svg, nomeIcone) {
    var uso = svg.querySelector('use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#' + nomeIcone);
  }

  /* o ícone de origem da linha (nomeIcone, quando quem chama já escolheu). Quem veio de outro dia (mudança de dia) leva o
     ícone da mudança com a dica de onde veio */
  function iconeDaLinha(m, nomeIcone) {
    if (!nomeIcone && m && m.origem === 'mudanca' && m.mudanca_de) {
      var el = RosterWork.tpl('tpl-escala-mudanca-icone');
      if (el) { el.setAttribute('data-dica', RosterWork.mensagens.escala.mudouDeDiaDe(m.mudanca_de)); return el; }
    }
    var svg = RosterWork.tpl('tpl-escala-mes-origem');
    if (svg) definirIcone(svg, nomeIcone || ICONE_ORIGEM[m && (m.estagio ? 'estagio' : m.origem)] || ICONE_ORIGEM.sistema);
    return svg;
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
    grau_diferente:   'grauDiferente',
    chefe_dirige_regra: 'chefeDirigeRegra'
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

  /* texto da dica do ícone de regra: uma regra por linha ("Exclusivo: Rádio Operador", "Proibido: ABTR-14462 · Condutor");
     o alvo da regra vem escrito do banco */
  function textoRegras(regras) {
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.regra) || {};
    return (regras || []).map(function (r) {
      var molde = r.tipo === 'exclusivo' ? cat.exclusivo : cat.proibido;
      return preencher(molde || '{funcao}', { funcao: r.alvo || r.funcao });
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

  /* militar de outra unidade (ex.: extra que tira aqui) na tira de ícones; a dica diz a unidade dele. O remanejado (só
     neste dia) leva o ícone do remanejamento no lugar */
  function marcarOutraUnidade(linha, m) {
    if (!m || !m.de_unidade) return;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    if (!icones) return;
    var el = RosterWork.tpl(m.remanejado ? 'tpl-escala-remanejado-icone' : 'tpl-escala-outra-unidade-icone');
    if (!el) return;
    var t = RosterWork.mensagens.escala;
    el.setAttribute('data-dica', m.remanejado ? t.remanejadoDe(m.de_unidade) : t.deOutraUnidade(m.de_unidade));
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

  /* nível da função: cadeira vazia = erro (menos a que o administrador abriu sem ninguém); sobreposição = erro; senão o
     pior dos militares dela */
  function nivelDaFuncao(funcao) {
    if (funcao && funcao.vazio && funcao.vazio_motivo !== 'aberta') return 'erro';
    var nivel = (funcao && funcao.sobreposicao) ? 'erro' : '';
    ((funcao && funcao.militares) || []).forEach(function (m) { nivel = piorNivel(nivel, nivelDoMilitar(m)); });
    return nivel;
  }

  /* nível do posto: o pior das suas funções; viatura sem condutor é erro (não opera sem motorista);
     efetivo abaixo do mínimo ou acima do máximo também é erro; abaixo do ideal é alerta. O posto fora da escala
     (sem gente para o mínimo) fica na cor escolhida na Distribuição: aviso 2 erro, 1 alerta, 0 sem cor */
  var NIVEL_FORA = ['', 'alerta', 'erro'];
  function nivelDoPosto(posto) {
    var fora = posto && posto.fora;
    var nivel = (posto && (posto.sem_condutor || posto.acima_maximo || (posto.abaixo_minimo && !fora))) ? 'erro'
      : (fora ? (NIVEL_FORA[fora.aviso] || '') : (posto && posto.abaixo_ideal ? 'alerta' : ''));
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

  /* o posto tem alguém em alguma função? (no Ver, o posto sem ninguém não aparece; o que a Central exibe vai nos blocos
     de cima, blocosDoDia) */
  function temAlguem(posto) {
    return ((posto && posto.funcoes) || []).some(function (f) { return (f.militares || []).length > 0; });
  }

  /* o que a Central de Operações do pelotão exibe, só para ver (o banco manda em posto.exibir, que também vai para a
     Central do SYSBM): o Oficial de Área, o Chefe de Socorro e o Cabo de Dia (antes) e a Extrajornada (depois), no
     formato das funções e marcadas com exibe. O Cabo de Dia sem ninguém (semNinguem, os horários) só vai para quem
     administra */
  function exibidas(posto, admin) {
    var r = { antes: [], depois: [] };
    ((posto && posto.exibir) || []).forEach(function (x) {
      var semNinguem = admin ? (x.vazio || []) : [];
      if (!(x.militares || []).length && !semNinguem.length) return;
      (x.depois ? r.depois : r.antes).push({ nome: x.nome, militares: x.militares || [], semNinguem: semNinguem, exibe: true });
    });
    return r;
  }

  /* os estagiários do dia (o ícone do livro), só para ver, um por militar, com os horários de todos os postos juntos, na
     ordem de entrada e da antiguidade; cada um continua no posto dele */
  function estagiariosDoDia(postos) {
    var H = RosterWork.horario, por = {}, lista = [];
    (postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          if (!m.estagio) return;
          if (!por[m.cpf]) {
            por[m.cpf] = { cpf: m.cpf, grad: m.grad, nome: m.nome, rg: m.rg, antiguidade: m.antiguidade, origem: m.origem,
              estagio: true, faixas: [] };
            lista.push(por[m.cpf]);
          }
          (m.periodos || []).forEach(function (per) { por[m.cpf].faixas.push(H.faixa(per)); });
        });
      });
    });
    lista.forEach(function (m) { m.periodos = H.uniao(m.faixas).map(H.periodo); delete m.faixas; });
    function inicio(m) { return m.periodos.length ? H.emMin(m.periodos[0].hi) : 0; }
    return lista.sort(function (a, b) {
      return inicio(a) - inicio(b) || (Number(a.antiguidade) || 0) - (Number(b.antiguidade) || 0);
    });
  }

  /* o dia em blocos, na ordem do painel e da impressão: as Funções especiais (o que a Central exibe antes das funções
     dela), as instalações (Central, Rancho, Almoxarifado e as outras, na ordem do banco), a Extrajornada (o que ela exibe
     depois), os Estagiários e as viaturas; o Sobreaviso entra depois dos Estagiários, por quem monta */
  function blocosDoDia(postos, admin) {
    var r = { especiais: [], instalacoes: [], extra: [], estagiarios: estagiariosDoDia(postos), viaturas: [] };
    (postos || []).forEach(function (po) {
      var ex = exibidas(po, admin);
      r.especiais = r.especiais.concat(ex.antes);
      r.extra = r.extra.concat(ex.depois);
      (po.tipo === 'viatura' ? r.viaturas : r.instalacoes).push(po);
    });
    return r;
  }

  /* texto com {marcadores} preenchidos a partir de um objeto de dados */
  function preencher(tpl, dados) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) { return dados && dados[k] != null ? dados[k] : ''; });
  }

  /* avisos amarelos por tipo, cada um com o militar + a vaga (para a lista expansível).
     m.aviso pode ter mais de um motivo (vírgula) — cada motivo entra no seu tipo. Só entra o militar
     que tem o aviso na lista do banco (presentes['codigo|cpf']): o amarelo que é consequência fica de fora.
     Sem os postos, o detalhe sai da própria lista do banco: o militar e a função */
  function detalharAvisosMotor(postos, presentes, problemas) {
    var det = { grauRebaixado: [], rodizioRepetido: [], afastadoTroca: [], regraGraduacao: [] };
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

  /* uma linha do detalhe: "Cb. Campos está de Rádio Operador, repetiu a função do último serviço" */
  function textoDetalhe(tipo, it) {
    var d = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.avisoDetalhe) || {};
    var m = it.m, f = it.f;
    var pessoa = ((m.grad || '') + ' ' + (m.nome || '')).trim();
    var grau = grauComSentido(f, d);
    var motivo = '';
    if (tipo === 'grauRebaixado') {
      motivo = grau ? preencher(d.motivoGrau, { grau: grau }) : 'faltou militar do grau ideal';
    } else if (tipo === 'rodizioRepetido') {
      motivo = d.motivoRodizio || '';
    } else if (tipo === 'afastadoTroca') {
      motivo = d.motivoAfastado || '';
    } else if (tipo === 'regraGraduacao') {
      motivo = d.motivoRegraGraduacao || '';
    }
    return preencher(d.linha, { pessoa: pessoa, funcao: nomeSemNumero(f.nome), motivo: motivo });
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
     a mesma lista serve à caixa do topo. Com admin, também a Central sem Cabo de Dia (dos postos).
     opcoes (a dica do gráfico e o relatório da Extrajornada): nomes = quem o erro toca nos textos que não dizem (o
     detalhe amarelo vira uma linha com os nomes); semFaixas = sem os horários (a dica já é de uma hora) */
  function linhasDoAviso(problemas, postos, faltamModelos, modelosComErro, admin, opcoes) {
    var lista = problemas || [];
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    var linhas = [];
    var comQuem = !!(opcoes && opcoes.nomes), semFaixas = !!(opcoes && opcoes.semFaixas);
    /* o texto com quem o erro toca (sem nomes pedidos, ou sem ninguém, o texto do painel) */
    function comNomes(texto, itens) {
      if (!comQuem) return texto;
      var quem = [];
      (itens || []).forEach(function (p) { var n = militar(p); if (n && quem.indexOf(n) < 0) quem.push(n); });
      return quem.length ? RosterWork.mensagens.escala.erroComNomes(texto, quem) : texto;
    }

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
    /* efetivo por posto: junta as faixas do mesmo posto ("das 08h às 14h e das 20h às 08h"). Com o nível (1 vermelho,
       2 amarelo), só as ocorrências dele e na cor dele: o posto fora da escala e a unidade seguem o aviso escolhido na
       Distribuição (a unidade, sem posto, vira uma linha só) */
    function linhasEfetivoProblemas(codigo, def, nivel) {
      if (!def || !tem(codigo)) return;
      if (nivel === 2) def = { texto: def.texto, faixa: def.faixa, icone: def.icone, nivel: 'alerta' };
      var postosVistos = [], porPosto = {};
      por[codigo].forEach(function (p) {
        if (nivel && p.nivel !== nivel) return;
        if (!porPosto[p.posto_id]) { porPosto[p.posto_id] = []; postosVistos.push(p.posto_id); }
        porPosto[p.posto_id].push(p);
      });
      postosVistos.forEach(function (id) {
        var itens = porPosto[id];
        var acima = codigo === 'acima_maximo';
        var pessoas = itens.reduce(function (v, p) { return acima ? Math.max(v, p.quantidade) : Math.min(v, p.quantidade); }, acima ? -Infinity : Infinity);
        var diaTodo = itens.length === 1 && itens[0].hi === '08:00' && itens[0].hf === '08:00';
        var faixas = (acima || diaTodo || semFaixas) ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: p.hi, hf: p.hf }); }).join(' e ');
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
        var faixas = (diaTodo || semFaixas) ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: p.hi, hf: p.hf }); }).join(' e ');
        linha(def, preencher(def.texto, { militar: militar(itens[0]), unidades: (itens[0].unidades || []).join(' e '), faixas: faixas }));
      });
    }

    /* militar duas vezes no mesmo horário: uma linha por militar e par de origens ("pela guarnição e pela extra"),
       juntando as faixas. Com o nível, só as ocorrências dele e na cor dele (de troca com troca é amarelo: o
       administrador registrou uma troca em cima de outra) */
    function linhasDuasVezes(def, nivel) {
      if (!def || !tem('duas_vezes')) return;
      if (nivel === 2) def = { texto: def.texto, faixa: def.faixa, icone: def.icone, nivel: 'alerta' };
      var nomes = RosterWork.mensagens.escala.entradasDuasVezes || {}, curta = RosterWork.horario.curta;
      var ordem = [], porMilitar = {};
      por.duas_vezes.forEach(function (p) {
        if (nivel && p.nivel !== nivel) return;
        var k = p.cpf + '|' + (p.funcao || '');
        if (!porMilitar[k]) { porMilitar[k] = []; ordem.push(k); }
        porMilitar[k].push(p);
      });
      ordem.forEach(function (k) {
        var itens = porMilitar[k];
        var diaTodo = itens.length === 1 && itens[0].hi === '08:00' && itens[0].hf === '08:00';
        var faixas = (diaTodo || semFaixas) ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: curta(p.hi), hf: curta(p.hf) }); }).join(' e ');
        var entradas = String(itens[0].funcao || '').split('+').map(function (t) { return nomes[t] || t; }).join(' e ');
        linha(def, preencher(def.texto, { militar: militar(itens[0]), entradas: entradas, faixas: faixas }));
      });
    }

    /* o mesmo serviço trocado duas vezes (amarelo): uma linha por militar, com quem entrou e as faixas */
    function linhasTrocaDupla(def) {
      if (!def || !tem('troca_dupla')) return;
      var curta = RosterWork.horario.curta, ordem = [], porMilitar = {};
      por.troca_dupla.forEach(function (p) {
        var k = p.cpf + '|' + (p.funcao || '');
        if (!porMilitar[k]) { porMilitar[k] = []; ordem.push(k); }
        porMilitar[k].push(p);
      });
      ordem.forEach(function (k) {
        var itens = porMilitar[k];
        var diaTodo = itens.length === 1 && itens[0].hi === '08:00' && itens[0].hf === '08:00';
        var faixas = (diaTodo || semFaixas) ? '' : ', ' + itens.map(function (p) { return preencher(def.faixa, { hi: curta(p.hi), hf: curta(p.hf) }); }).join(' e ');
        linha(def, preencher(def.texto, { militar: militar(itens[0]), quem: itens[0].funcao || '', faixas: faixas }));
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
    var semFuncao = {}, quemSemFuncao = [];
    ['sem_funcao', 'resolva_escala'].forEach(function (c) {
      (por[c] || []).forEach(function (p) { semFuncao[p.cpf] = true; quemSemFuncao.push(p); });
    });
    var qSemFuncao = Object.keys(semFuncao).length;
    if (qSemFuncao && cat.semFuncao) linha(cat.semFuncao, comNomes(qSemFuncao === 1 ? cat.semFuncao.texto : preencher(cat.semFuncao.textoPlural, { n: qSemFuncao }), quemSemFuncao));
    /* os postos: o travado diz o motivo e o posto; a frase geral fica para quem o banco não liga a um posto travado */
    porOcorrencia('sem_condutor_habilitado', cat.semCondutorHabilitado, function (p) { return p.posto_id; },
      function (p) { return { posto: p.posto || '', cnh: p.cnh || '' }; });
    porOcorrencia('posto_sem_solucao', cat.postoSemSolucao, function (p) { return p.posto_id; },
      function (p) { return { posto: p.posto || '' }; });
    /* a função vazia pela regra por graduação ("Se só houver [graduação], deixa vazio"), uma linha por função */
    porOcorrencia('regra_vazia', cat.regraGraduacaoVazia, function (p) { return p.posto_id + '|' + p.funcao; },
      function (p) { return { funcao: (p.posto ? p.posto + ' · ' : '') + nomeSemNumero(p.funcao) }; });
    if (tem('resolva_escala')) linha(cat.resolvaEscala);
    if (tem('sem_condutor')) linha(cat.semCondutor);
    /* a companhia sem Oficial de Área: uma linha, com os horários quando não é o dia todo */
    if (tem('sem_oficial') && cat.semOficial) {
      var so = por.sem_oficial, soTodo = semFaixas || (so.length === 1 && so[0].hi === '08:00' && so[0].hf === '08:00');
      linha(cat.semOficial, preencher(cat.semOficial.texto, { faixas: soTodo ? '' : ', ' + so.map(function (p) { return preencher(cat.semOficial.faixa, { hi: p.hi, hf: p.hf }); }).join(' e ') }));
    }
    linhasEfetivoProblemas('unidade_abaixo_minimo', cat.unidadeAbaixoMinimo, 1);
    linhasEfetivoProblemas('posto_fora', cat.postoFora, 1);
    linhasEfetivoProblemas('abaixo_minimo', cat.abaixoMinimo);
    linhasEfetivoProblemas('acima_maximo', cat.acimaMaximo);
    /* o militar em situação errada */
    if (tem('fora_disponibilidade') && cat.foraDisponibilidade) linha(cat.foraDisponibilidade, comNomes(cat.foraDisponibilidade.texto, por.fora_disponibilidade));
    if (tem('sem_servico') && cat.semServico) linha(cat.semServico, comNomes(cat.semServico.texto, por.sem_servico));
    if (tem('sobreposicao') && cat.sobreposicao) linha(cat.sobreposicao, comNomes(cat.sobreposicao.texto, por.sobreposicao));
    porOcorrencia('cnh_incompativel', cat.cnhIncompativel, function (p) { return p.cpf + '|' + p.posto_id; },
      function (p) { return { militar: militar(p), posto: p.posto || '' }; });
    linhasDuasUnidades(cat.duasUnidades);   // o mesmo militar em duas unidades ao mesmo tempo não pode
    linhasDuasVezes(cat.duasVezes, 1);      // nem duas vezes no mesmo horário
    /* de serviço num dia em que tem autorização de viagem (não impede nada), um por militar, com os destinos */
    porOcorrencia('viagem', cat.viagem, function (p) { return p.cpf; },
      function (p) { return { militar: militar(p), destinos: RosterWork.mensagens.escala.listaDestinos(p.destinos) }; });

    /* amarelo: funciona, com erro aceitável */
    if (tem('chefe_condutor')) linha(cat.chefeCondutor);
    linhasEfetivoProblemas('unidade_abaixo_minimo', cat.unidadeAbaixoMinimo, 2);
    linhasEfetivoProblemas('posto_fora', cat.postoFora, 2);
    linhasEfetivoProblemas('abaixo_ideal', cat.abaixoIdeal);
    /* o estagiário sem função (sem lugar no estágio, ou com a viatura fora da escala), um por militar */
    porOcorrencia('estagio_sem_funcao', cat.estagioSemFuncao, function (p) { return p.cpf; },
      function (p) { return { militar: militar(p) }; });
    /* a Central sem Cabo de Dia (só para quem administra): uma linha, com os horários quando não é o dia todo */
    if (admin && cat.semCaboDia) (postos || []).forEach(function (po) {
      exibidas(po, true).antes.forEach(function (x) {
        var sem = x.semNinguem;
        if (!sem.length) return;
        var diaTodo = sem.length === 1 && sem[0].hi === '08:00' && sem[0].hf === '08:00';
        var faixas = diaTodo ? '' : ', ' + sem.map(function (v) { return preencher(cat.semCaboDia.faixa, { hi: v.hi, hf: v.hf }); }).join(' e ');
        linha(cat.semCaboDia, preencher(cat.semCaboDia.texto, { faixas: faixas }));
      });
    });
    /* o militar posto pelo administrador contra a regra dele (o "não pode"), com o posto */
    porOcorrencia('regra_proibida', cat.regraProibida, function (p) { return p.cpf + '|' + p.posto_id + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: (p.posto ? p.posto + ' · ' : '') + nomeSemNumero(p.funcao) }; });
    porOcorrencia('exclusivo_fora', cat.exclusivoFora, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: nomeSemNumero(p.funcao) }; });
    porOcorrencia('grau_diferente', cat.grauDiferente, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: nomeSemNumero(p.funcao) }; });
    /* o Chefe de Socorro posto de Condutor pelo administrador contra a regra da Distribuição (uma linha por viatura) */
    porOcorrencia('chefe_dirige_regra', cat.chefeDirigeRegra, function (p) { return p.cpf + '|' + p.posto_id; },
      function () { return {}; });
    /* troca em cima de troca (o administrador registrou uma troca em conflito): o militar duas vezes por troca e o
       serviço trocado duas vezes, até cancelar ou mudar uma das trocas */
    linhasDuasVezes(cat.duasVezes, 2);
    linhasTrocaDupla(cat.trocaDupla);
    var det = detalharAvisosMotor(postos, presentes, lista);   // quem + vaga + motivo, para o detalhe expansível
    [['grau_por_falta', 'grauRebaixado'], ['rodizio_quebrado', 'rodizioRepetido'],
     ['afastado', 'afastadoTroca'], ['regra_graduacao', 'regraGraduacao']].forEach(function (par) {
      var def = cat[par[1]], itens = det[par[1]];
      if (!tem(par[0]) || !def || !itens.length) return;
      /* com os nomes, uma linha só, sem o detalhe expansível */
      if (comQuem) linha(def, comNomes(def.texto, itens.map(function (it) { return it.m; })));
      else linhas.push({ def: def, texto: def.texto + ' (' + itens.length + ')', tipo: par[1], itens: itens });
    });
    return linhas;
  }

  /* a caixa de avisos do topo: cada linha de linhasDoAviso, a simples e a do detalhe amarelo expansível */
  function montarAvisoProblemas(problemas, postos, faltamModelos, modelosComErro, admin) {
    var linhas = linhasDoAviso(problemas, postos, faltamModelos, modelosComErro, admin);
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

  /* o dia sai do painel (outro dia vai abrir, ou o painel fechou): as abas param de desenhar, e o rascunho de todos os dias
     fica (escalas-rascunho-dias.js; o rodapé largo continua com a conta, o Desfazer e o Salvar) */
  function desmarcar() {
    notaConsulta(false);
    if (celulaSelecionada) {
      celulaSelecionada.classList.remove('escala-mes-celula--selecionada');
      celulaSelecionada = null;
    }
    pCtx = null;
    if (RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (RosterWork.escalasPainelGuarnicoes) RosterWork.escalasPainelGuarnicoes.reset();
    if (RosterWork.escalasPainelVolta) RosterWork.escalasPainelVolta.reset();
    if (RosterWork.escalasPainelExtra) RosterWork.escalasPainelExtra.reset();
  }
  /* o formulário da troca preenchido (o Solicitar troca ou o Registrar troca de serviço, escalas-painel-troca.js): ele não
     fica guardado com o dia */
  function trocaSuja() { return !!(RosterWork.escalasPainelTroca && RosterWork.escalasPainelTroca.temDados()); }
  /* o painel do dia fechou: o rascunho de todos os dias fica, e o da Extrajornada (do mês) também */
  function aoFecharDia() { desmarcar(); }

  /* ---------- guarda de descarte: só o formulário da troca preenchido, que não fica guardado ---------- */
  /* mesmo aviso do Cancelar do rodapé (Descartar / Continuar editando); o formulário da troca, o aviso dele.
     quantas: quantas alterações saem (sem ela, todas) */
  function confirmarDescarte(aoConfirmar, quantas) {
    if (!RosterWork.confirmar) { aoConfirmar(); return; }
    var n = quantas != null ? quantas : (RosterWork.escalasPainelSalvar ? RosterWork.escalasPainelSalvar.contar() : 0);
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: n ? RosterWork.mensagens.escala.painelDescartar(n) : RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RosterWork.mensagens.botoes.descartar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }
  /* interceptador do Esc/X e da troca de período (via geral-painel.aoTentarFechar): o rascunho de todos os dias fica, e o
     painel fecha sem pergunta; só o formulário da troca preenchido segura o fechamento até confirmar (no Descartar, o
     painel fecha e a troca de período segue, geral-painel) */
  function tentarFecharPainel() {
    if (!trocaSuja()) return false;
    confirmarDescarte(function () { RosterWork.painel.fechar(); }, 0);
    return true;
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
    var origem = iconeDaLinha(m);
    if (origem) icones.appendChild(origem);
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

  /* o nome da função como a Escala mostra, sem o número do lugar ("Efetivo 3" vira "Efetivo", "Rádio Operador 2" vira
     "Rádio Operador"): o número é só a etiqueta do lugar por dentro, e cada linha continua ligada ao lugar dela */
  var COM_NUMERO = /^(Efetivo|Rádio Operador|Rancheiro|Almoxarife) \d+$/;
  function nomeSemNumero(nome) { var m = COM_NUMERO.exec(nome || ''); return m ? m[1] : (nome || ''); }
  /* a função só de estagiários no Efetivo da viatura (o ícone do livro) não é lugar da guarnição: na tela, "Estagiário" */
  function soEstagiarios(f) {
    var ms = (f && f.militares) || [];
    return /^Efetivo \d+$/.test((f && f.nome) || '') && ms.length > 0 && ms.every(function (m) { return m.estagio; });
  }
  function rotuloDe(f) { return soEstagiarios(f) ? RosterWork.mensagens.escala.rotuloEstagiario : nomeSemNumero(f.nome); }
  function antiguidadeDe(m) { return Number(m && m.antiguidade) || 0; }

  /* o Chefe (ou o Oficial de Área) que é também o Condutor só em parte do dia: três entradas no lugar das duas, na
     ordem do posto: o papel nas horas em que ele é só o Chefe, os dois rótulos nas horas em que ele dirige e o Condutor
     com os outros. O lápis da linha do papel continua valendo para o dia todo dele como Chefe (periodosDoPapel) */
  function separarChefeQueDirige(lista, especial) {
    var H = RosterWork.horario, ic = -1;
    lista.forEach(function (f, i) { if (ic < 0 && /^Condutor/i.test(f.nome)) ic = i; });
    if (ic < 0) return;
    var cond = lista[ic];
    var chefe = (especial.militares || []).filter(function (m) {
      return (cond.militares || []).some(function (c) { return c.cpf === m.cpf; });
    })[0];
    if (!chefe) return;
    var dirige = cond.militares.filter(function (c) { return c.cpf === chefe.cpf; });
    var horasDirige = [];
    dirige.forEach(function (c) { (c.periodos || []).forEach(function (p) { horasDirige.push(H.faixa(p)); }); });
    var soChefe = H.menos(H.uniao((chefe.periodos || []).map(H.faixa)), horasDirige).map(H.periodo);
    var papel = Object.assign({}, especial, { militares: especial.militares.map(function (m) {
      return m === chefe ? Object.assign({}, m, { periodos: soChefe, periodosDoPapel: m.periodos }) : m;
    }).filter(function (m) { return (m.periodos || []).length; }) });
    var juntos = Object.assign({}, cond, { nomes: [especial.nome, cond.nome], militares: dirige, ghosts: [], vao: [], vazio: false });
    var outros = Object.assign({}, cond, { militares: cond.militares.filter(function (c) { return c.cpf !== chefe.cpf; }) });
    var novas = papel.militares.length ? [papel, juntos] : [juntos];
    if (outros.militares.length || (outros.vao || []).length || (outros.ghosts || []).length) novas.push(outros);
    lista.splice(ic, 1);
    lista.splice.apply(lista, [lista.indexOf(especial), 1].concat(novas));
  }

  /* as funções do posto como a lista mostra (o painel, o PDF do dia e o modo Dia). Na viatura,
     o papel especial (Chefe/Of. Área) e o Condutor numa entrada de dois rótulos quando as duas funções têm as mesmas
     pessoas nos mesmos horários (quem é o Chefe dirige em todos eles); com o Chefe dirigindo só parte do dia, três
     entradas (separarChefeQueDirige). Depois, os lugares da mesma função num grupo só, com o nome sem número
     ("Efetivo", "Rádio Operador", "Estagiário"): partes = as funções guardadas do grupo (cada linha continua ligada ao lugar dela, e o lápis age nele);
     militares = as pessoas de todas, na ordem de antiguidade, cada uma com a funcaoDoLugar (a guardada). Copia (não muta
     o leitor) */
  function mesclarFuncoesViatura(posto) {
    var lista = ((posto && posto.funcoes) || []).map(function (f) {
      var c = {}; for (var k in f) c[k] = f[k]; return c;   // cópia rasa
    });
    if (!posto) return lista;
    lista.sort(function (a, b) { return (Number(a.ordem) || 0) - (Number(b.ordem) || 0); });
    if (posto.tipo === 'viatura') {
      var PAPEL = ['Chefe de Socorro', 'Oficial de Área'];
      var especial = null;
      lista.forEach(function (f) {
        if (PAPEL.indexOf(f.nome) >= 0 && f.militares && f.militares.length) especial = f;
      });
      /* as pessoas da função com os horários de cada uma, numa ordem só */
      var pessoasEHorarios = function (f) {
        return (f.militares || []).map(function (m) {
          return m.cpf + '|' + (m.periodos || []).map(function (p) { return (p.hi || '') + '-' + (p.hf || ''); }).join(',');
        }).sort().join(';');
      };
      if (especial) {
        var chave = pessoasEHorarios(especial), idx = -1;
        lista.forEach(function (f, i) {
          if (/^Condutor/i.test(f.nome) && f.militares && f.militares.length && pessoasEHorarios(f) === chave) idx = i;
        });
        if (idx >= 0) { especial.nomes = [especial.nome, lista[idx].nome]; lista.splice(idx, 1); }
        else separarChefeQueDirige(lista, especial);
      }
    }
    var saida = [], grupos = {};
    lista.forEach(function (f) {
      if (f.nomes && f.nomes.length) { saida.push(f); return; }
      var rotulo = rotuloDe(f);
      if (!grupos[rotulo]) { grupos[rotulo] = { rotulo: rotulo, partes: [] }; saida.push(grupos[rotulo]); }
      grupos[rotulo].partes.push(f);
    });
    return saida.map(function (x) {
      if (!x.partes) return x;
      var partes = x.partes;
      if (partes.length === 1 && partes[0].nome === x.rotulo) return partes[0];
      var militares = [], ghosts = [];
      partes.forEach(function (p) {
        (p.militares || []).forEach(function (m) { militares.push(Object.assign({}, m, { funcaoDoLugar: p.nome })); });
        (p.ghosts || []).forEach(function (m) { ghosts.push(Object.assign({}, m, { funcaoDoLugar: p.nome })); });
      });
      militares.sort(function (a, b) { return antiguidadeDe(a) - antiguidadeDe(b); });
      return Object.assign({}, partes[0], {
        nomes: [x.rotulo], partes: partes, militares: militares, ghosts: ghosts, vao: [],
        estagiario: x.rotulo === RosterWork.mensagens.escala.rotuloEstagiario,
        sobreposicao: partes.some(function (p) { return !!p.sobreposicao; }),
        vazio: !militares.length && partes.every(function (p) { return !!p.vazio; }),
        acumulo: partes.some(function (p) { return !!p.acumulo; })
      });
    });
  }

  /* o nome de uma função do posto como a tela mostra ("Efetivo", "Rádio Operador", "Estagiário") */
  function rotuloDaFuncao(posto, nome) {
    var f = posto ? ((posto.funcoes || []).filter(function (x) { return x.nome === nome; })[0]) : null;
    return f ? rotuloDe(f) : nomeSemNumero(nome);
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
      /* cadeira sem ninguém: linha vermelha explicando, no lugar do militar; a que o administrador abriu, em cinza */
      var vazio = RosterWork.tpl('tpl-escala-vaga-vazia');
      if (vazio) {
        var vtxt = vazio.querySelector('.escala-vaga-vazia-texto');
        var msg = RosterWork.mensagens.escala || {};
        if (vtxt) vtxt.textContent = msg.vagaVazia ? msg.vagaVazia(funcao.vazio_motivo) : 'Vazio';
        if (funcao.vazio_motivo === 'aberta') vazio.classList.add('escala-vaga-vazia--aberta');
        /* as horas em que o lugar faz falta (vazio_periodos, do banco; no grupo sem número, as de todos os lugares) */
        var H = RosterWork.horario, faixas = [], horasVazio = vazio.querySelector('.escala-distribuicao-horas');
        (funcao.partes || [funcao]).forEach(function (pt) { (pt.vazio_periodos || []).forEach(function (p) { faixas.push(H.faixa(p)); }); });
        H.uniao(faixas).map(H.periodo).forEach(function (p) { var hora = montarHora(p); if (hora) horasVazio.appendChild(hora); });
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

  /* "Alterações manuais (N)", o último bloco do corpo do Dia: quem mexeu no dia, quando e o quê (ajustes do Dia,
     pontuais, folgas, observações e entradas/saídas do ciclo que começam no dia). Sem alterações, o bloco não
     aparece. aindaVale() diz se o bloco ainda é dele quando a leitura chega (o Dia pode ter mudado) */
  function montarAlteracoes(lugar, unidadeId, iso, aindaVale, aoMostrar) {
    lugar.textContent = '';
    lugar.classList.add('oculto');
    if (!RosterWork.escalasDados || !RosterWork.escalasDados.lerAlteracoesDia) return;
    RosterWork.escalasDados.lerAlteracoesDia(unidadeId, iso).then(function (lista) {
      /* outro dia/unidade/seção foi aberto enquanto carregava, ou o Dia ganhou alteração: não mexe no bloco */
      if (!pCtx || pCtx.unidadeId !== unidadeId || pCtx.iso !== iso || pCtx.secao !== 'distribuicao') return;
      if (aindaVale && !aindaVale()) return;
      var bloco = RosterWork.alteracoes ? RosterWork.alteracoes.montar('tpl-escala-alteracoes', lista) : null;
      if (!bloco) return;
      lugar.textContent = '';
      lugar.appendChild(bloco);
      lugar.classList.remove('oculto');
      if (aoMostrar) aoMostrar();
    });
  }

  var ESPERA_DIA_MS = 30000;   // o dia na fila para de esperar e abre só para consulta

  /* a nota do dia aberto só para consulta: entre o subcabeçalho e o corpo, que se redesenha sozinho */
  function notaConsulta(mostrar) {
    var corpo = RosterWork.painel && RosterWork.painel.corpo();
    if (!corpo || !corpo.parentNode) return;
    var atual = corpo.parentNode.querySelector('.painel-nota-consulta');
    if (atual) atual.remove();
    if (!mostrar) return;
    var nota = RosterWork.tpl('tpl-nota-atualizando');
    nota.classList.add('painel-nota-consulta');
    nota.querySelector('.nota-texto').textContent = RosterWork.mensagens.escala.diaConsulta;
    corpo.parentNode.insertBefore(nota, corpo);
  }

  /* troca o conteúdo do corpo e o rodapé conforme a aba de seção: Funções e Estagiários são a lista do dia que o admin
     edita (e os outros só leem), por posto e, só os estagiários, por pessoa; as Guarnições (só admin) são sempre edição e a Extrajornada é a do
     mês lançado */
  function mostrarSecao(secao) {
    if (!pCtx) return;
    pCtx.secao = secao;
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    var rodape = RosterWork.painel.rodape();
    /* o subcabeçalho é de cada seção (o Dia do admin põe nele o Adicionar militar) */
    var sub = RosterWork.painel.subcabecalho();
    if (sub) { sub.textContent = ''; sub.classList.add('oculto'); }
    /* ao entrar numa seção, as outras param de desenhar (os rascunhos delas ficam até o Salvar do rodapé) */
    if (secao !== 'distribuicao' && secao !== 'estagiarios' && RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (secao !== 'continuos' && RosterWork.escalasPainelGuarnicoes) RosterWork.escalasPainelGuarnicoes.reset();
    if (secao !== 'volta' && RosterWork.escalasPainelVolta) RosterWork.escalasPainelVolta.reset();
    if (secao !== 'extra' && RosterWork.escalasPainelExtra) RosterWork.escalasPainelExtra.reset();
    /* o dia que a fila do recálculo ainda vai refazer: a mensagem com o círculo até ele ficar pronto (ninguém mexe num dia
       que vai mudar); passando do limite, o Dia abre só para consulta, com a nota, e volta ao normal quando ficar pronto */
    var atualizando = RosterWork.escalaAtualizando, esperado = pCtx;
    notaConsulta(false);
    var naFila = !!(atualizando && atualizando.pendente(pCtx.unidadeId, pCtx.iso));
    if (naFila && !esperado.aguardando) {
      esperado.aguardando = true;
      esperado.limite = setTimeout(function () {
        esperado.consulta = true;
        if (pCtx === esperado) mostrarSecao(pCtx.secao);
      }, ESPERA_DIA_MS);
      atualizando.esperar(pCtx.unidadeId, pCtx.iso).then(function () {
        clearTimeout(esperado.limite);
        esperado.aguardando = false;
        esperado.consulta = false;
        if (pCtx === esperado) mostrarSecao(pCtx.secao);
      });
    }
    if (naFila && !(esperado.consulta && (secao === 'distribuicao' || secao === 'estagiarios'))) {
      corpo.textContent = '';
      corpo.appendChild(RosterWork.painel.criarAtualizando(RosterWork.mensagens.escala.diaAtualizando));
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
      return;
    }
    if (naFila) notaConsulta(true);
    if ((secao === 'distribuicao' || secao === 'estagiarios') && RosterWork.escalasPainelEditar) {
      /* o dia é de quem tem a unidade na área do papel; as abas Funções e Estagiários são o mesmo dia, por posto e, só os
         estagiários, por pessoa. O dia de mais de 7 dias atrás não muda mais: abre só para ver, e quem administra a
         unidade vê a nota (antigo).
         O menu pedido na abertura (o Oficial de Área, vindo do pelotão) abre quando a lista chegar, uma vez só */
      var menuDe = pCtx.abrirMenuDe || null, fazerDe = pCtx.fazerAcao || null, adicionarDe = pCtx.adicionar || null;
      pCtx.abrirMenuDe = null;
      pCtx.fazerAcao = null;
      pCtx.adicionar = null;
      var administra = !naFila && RosterWork.sessao.podeAdministrar('pelotao', pCtx.unidadeId);
      var antigo = !!RosterWork.escalasPainelCiclo && pCtx.iso < RosterWork.escalasPainelCiclo.limite();
      RosterWork.escalasPainelEditar.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso, {
        admin: administra && !antigo,
        antigo: administra && antigo,
        consulta: naFila,
        visao: secao === 'estagiarios' ? secao : 'funcoes',
        abrirMenuDe: menuDe,
        fazerAcao: fazerDe,
        adicionar: adicionarDe
      });
    } else if (secao === 'continuos' && RosterWork.escalasPainelGuarnicoes) {
      RosterWork.escalasPainelGuarnicoes.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso);
    } else if (secao === 'volta' && RosterWork.escalasPainelVolta) {
      RosterWork.escalasPainelVolta.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso);
    } else if (secao === 'extra' && RosterWork.escalasPainelExtra) {
      RosterWork.escalasPainelExtra.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso);
    } else {
      corpo.textContent = '';
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    }
    /* o Desfazer e o Refazer do rodapé largo são os da aba que abriu */
    if (RosterWork.escalasPainelSalvar) RosterWork.escalasPainelSalvar.atualizar();
  }

  /* abrir outra célula: o rascunho do dia de agora fica guardado (escalas-rascunho-dias.js) e volta com ele, sem
     pergunta; só o formulário da troca preenchido pergunta antes. secao = a aba que abre primeiro (o padrão é o Dia; quem
     está na Extrajornada continua nela) */
  function abrirParaCelula(celula, secao) {
    if (trocaSuja()) { confirmarDescarte(function () { abrirParaCelulaAgora(celula, secao); }, 0); return; }
    abrirParaCelulaAgora(celula, secao);
  }

  function abrirParaCelulaAgora(celula, secao) {
    abrirDiaAgora({ unidadeId: celula.dataset.unidadeId, iso: celula.dataset.iso, unidadeNome: celula.dataset.unidadeNome,
      unidadeCidade: celula.dataset.unidadeCidade }, secao, celula, null);
  }

  /* o dia de uma unidade sem a célula (a companhia do Oficial de Área, que pode não estar na tela; o lápis dele no
     pelotão), como abrir outra célula (só o formulário da troca preenchido pergunta). opcoes.abrirMenuDe: o cpf de quem fica
     com o menu aberto quando a lista chegar; opcoes.fazerAcao: em vez do menu, o item dele já feito (a célula da grade;
     { acao, trocaId } no Cancelar a troca da linha riscada, o Remover deste dia já na parte da troca);
     opcoes.adicionar: o cpf de quem já vem escolhido no Adicionar estagiário (o dia vazio da grade dos estagiários) */
  function abrirDia(dia, secao, opcoes) {
    if (trocaSuja()) { confirmarDescarte(function () { abrirDiaAgora(dia, secao, null, opcoes); }, 0); return; }
    abrirDiaAgora(dia, secao, null, opcoes);
  }

  /* dia = { unidadeId, iso, unidadeNome, unidadeCidade }; a célula (quando há) fica marcada na grade */
  function abrirDiaAgora(dia, secao, celula, opcoes) {
    var naExtra = !!pCtx && pCtx.secao === 'extra';
    /* a célula da grade deixa o dia: o que ela mexia continua (neste dia, no painel; em outro dia, guardado na gaveta), e o
       Ciclo deste dia, se estava guardado, volta */
    if (RosterWork.escalasCelulaEditar) RosterWork.escalasCelulaEditar.passarAoPainel();
    desmarcar();
    if (RosterWork.escalasPainelCiclo) RosterWork.escalasPainelCiclo.abrirDia(dia.unidadeId, dia.iso);
    var marcada = celula || encontrarCelula(dia.unidadeId, dia.iso);
    if (marcada) {
      marcada.classList.add('escala-mes-celula--selecionada');
      celulaSelecionada = marcada;
    }

    var unidadeId = dia.unidadeId;
    var iso = dia.iso;
    var cidade = dia.unidadeCidade;
    /* o Dia e o Ciclo para quem tem a unidade na área do papel; a Extrajornada, que é da companhia, para quem administra
       alguma unidade (escalas-painel-extra.js confere se esta é da companhia dele) */
    var admin = RosterWork.sessao.podeAdministrar('pelotao', unidadeId);
    var comExtra = RosterWork.sessao.temPapel('pelotao');
    var inicial = secao || (naExtra ? 'extra' : 'distribuicao');
    /* a aba Estagiários: para quem administra a unidade, quando ela tem estágio */
    var comEstagio = admin && RosterWork.sessao.estagioUnidades().map(String).indexOf(String(unidadeId)) >= 0;
    if (((inicial === 'continuos' || inicial === 'volta') && !admin) || (inicial === 'extra' && !comExtra)
        || (inicial === 'estagiarios' && !comEstagio)) inicial = 'distribuicao';
    pCtx = { unidadeId: unidadeId, iso: iso, secao: inicial, unidadeNome: dia.unidadeNome, semCelula: !marcada,
      abrirMenuDe: (opcoes && opcoes.abrirMenuDe) || null, fazerAcao: (opcoes && opcoes.fazerAcao) || null,
      adicionar: (opcoes && opcoes.adicionar) || null };
    /* o dia já refeito abre na hora: o painel lê o dado real, e a célula fica igual a ele */
    if (RosterWork.escalaAtualizando && RosterWork.escalaAtualizando.soCopia(unidadeId, iso)) RosterWork.escalaAtualizando.corrigir(unidadeId, iso);
    RosterWork.painel.abrir({
      titulo: dia.unidadeNome || '',
      tituloExtra: cidade ? '- ' + cidade : '',
      subtitulo: dataPorExtenso(iso),
      aoFechar: aoFecharDia,
      aoTentarFechar: tentarFecharPainel,      // Esc/X confirmam antes de descartar rascunho
      ficaNasAbas: true                        // o rascunho aparece em todas as telas da Escala: trocar de aba não fecha
    });
    RosterWork.painel.acompanharTela(diaNaTela);

    /* linha das abas de seção: quem só lê o dia (sem ser admin) fica sem a linha, só com a lista por funções; a volta de
       férias (escalas-painel-volta.js) é uma vista só, sem ela. O geral-abas cuida da troca visual e nos avisa a aba
       escolhida */
    var linha = RosterWork.painel.linhaAbas();
    var tpl = document.getElementById('tpl-escala-painel-secoes');
    if (linha && tpl && (admin || comExtra) && inicial !== 'volta') {
      linha.appendChild(tpl.content.cloneNode(true));
      if (!admin) linha.querySelectorAll('[data-so-admin]').forEach(function (a) { a.remove(); });
      if (!comExtra) linha.querySelectorAll('[data-secao="extra"]').forEach(function (a) { a.remove(); });
      if (!comEstagio) linha.querySelectorAll('[data-so-estagio]').forEach(function (a) { a.remove(); });
      linha.classList.remove('oculto');
      var trilho = linha.querySelector('.abas');
      if (trilho) {
        Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (a) {
          a.classList.toggle('aba--ativa', a.getAttribute('data-secao') === inicial);
        });
      }
      if (trilho && RosterWork.abas) {
        /* trocar de aba não pergunta: as mudanças de cada aba ficam até o Salvar do rodapé */
        RosterWork.abas.ligar(trilho, function (aba) { mostrarSecao(aba.getAttribute('data-secao')); });
      }
    }

    mostrarSecao(inicial);
    /* o rascunho da Extrajornada veio do outro dia: o rodapé continua à vista */
    if (RosterWork.escalasPainelSalvar) RosterWork.escalasPainelSalvar.atualizar();
    /* o painel abriu e a grade ficou mais estreita: o bloco do pelotão aberto vai à vista inteira */
    requestAnimationFrame(function () { requestAnimationFrame(function () { mostrarDiaAberto(true); }); });
  }

  /* o bloco do pelotão do dia aberto inteiro à vista na grade (geral-periodo.js), pelo lado mais perto: no Calendário,
     o bloco com o nome, abaixo do número do dia (que gruda no alto); nas outras grades, a caixa do pelotão no dia */
  var AREAS_DA_GRADE = '.escala-mes, .escala-semana, .escala-colunas, .geral-calendario-mes';
  var CABECALHOS_DA_GRADE = '.escala-grade-cabecalho, .geral-calendario-mes-cabecalho, .escala-semana-cabecalho, .escala-colunas-cabecalho';
  var CANTOS_DA_GRADE = '.escala-mes-canto, .escala-semana-canto, .escala-colunas-canto';
  function mostrarDiaAberto(suave) {
    var cel = celulaSelecionada;
    var area = cel && document.contains(cel) ? cel.closest(AREAS_DA_GRADE) : null;
    if (!area || !RosterWork.periodo || !RosterWork.periodo.mostrarInteiro) return;
    var bloco = cel.closest('.escala-calendario-unidade') || cel;
    var dia = bloco.closest('.geral-calendario-mes-dia');
    RosterWork.periodo.mostrarInteiro(area, bloco, {
      fixo: [area.querySelector(CABECALHOS_DA_GRADE), dia && dia.querySelector('.geral-calendario-mes-dia-topo')],
      fixoLado: area.querySelector(CANTOS_DA_GRADE),
      suave: suave
    });
  }

  /* o dia aberto ainda está na tela? Filtro e busca escondem só as linhas dentro do dia, nunca o dia; no Colunas ›
     Unidades, a unidade dele tem de seguir ligada nas abas (a grade é redesenhada depois, sem esperar) */
  function diaNaTela() {
    var abas = document.querySelector('#escala-sub-unidades:not(.oculto) #escala-unidades-abas');
    /* o dia aberto sem a célula (a companhia do Oficial de Área) não depende das abas */
    return !pCtx || pCtx.semCelula || !abas || !!abas.querySelector('.aba--ativa[data-unidade="' + pCtx.unidadeId + '"]');
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

  /* a grade foi redesenhada (a prévia de uma mudança, o Cancelar, o Salvar, uma ação do ciclo) e destruiu a célula
     marcada. Enquanto o painel estiver aberto, re-aplica a marcação na célula nova assim que ela aparecer e a grade, que
     abriu em hoje, fica no dia aberto, já no mesmo quadro (a re-renderização é assíncrona: espera alguns quadros, sem
     travar) */
  function remarcarSelecionada() {
    if (!pCtx) return;
    var tentativas = 0;
    (function tenta() {
      if (!pCtx) return;   // o painel fechou nesse meio-tempo
      var cel = encontrarCelula(pCtx.unidadeId, pCtx.iso);
      /* a célula marcada ainda na tela é a grade velha (o aviso chegou antes de ela ser refeita): espera a nova */
      if (cel && cel !== celulaSelecionada) {
        if (celulaSelecionada) celulaSelecionada.classList.remove('escala-mes-celula--selecionada');
        cel.classList.add('escala-mes-celula--selecionada');
        celulaSelecionada = cel;
        mostrarDiaAberto(false);
        return;
      }
      if (++tentativas < 600) requestAnimationFrame(tenta);   // ~10 s no máximo (a prévia com o Ciclo leva uns 5 s)
    })();
  }

  /* um clique delegado no conteúdo do shell: pega a célula clicada e abre a gaveta.
     Delegado no conteúdo (não na grade) para sobreviver às remontagens da grade; liga uma vez só
     (marca no elemento, que fica entre as navegações) */
  var remarcarLigado = false;
  function ligar(conteudo) {
    if (!conteudo || conteudo.dataset.painelDiaLigado) return;
    conteudo.dataset.painelDiaLigado = '1';
    conteudo.addEventListener('click', function (evento) {
      if (RosterWork.opVeraoCaixa && RosterWork.opVeraoCaixa.clique(evento)) return;   // a página Op. Verão: as caixas dela
      if (RosterWork.escalasCelulaOficial && RosterWork.escalasCelulaOficial.clique(evento)) return;   // o Oficial do título
      /* célula da grade OU bloco marcado (ex.: a unidade do modo Dia em árvore); no Calendário (Mês e
         Colunas → Dias), o bloquinho inteiro da unidade (nome incluso) vale como a célula que está dentro dele */
      var alvo = evento.target.closest ? evento.target.closest('.escala-mes-celula, [data-abre-dia], .escala-calendario-unidade') : null;
      var celula = alvo && alvo.classList.contains('escala-calendario-unidade') ? alvo.querySelector('.escala-mes-celula') : alvo;
      if (!celula || !celula.dataset.unidadeId || !celula.dataset.iso) return;
      /* quem administra o dia: o rápido se faz na própria célula, também o do sobreaviso; com o painel aberto, ele vai
         junto para o dia (escalas-celula-editar.js) */
      if (RosterWork.escalasCelulaEditar && RosterWork.escalasCelulaEditar.clique(evento, celula)) return;
      /* o sobreaviso, para quem não mexe nele na célula: o painel do dia no bloco, com o lápis do nome clicado
         (escalas-painel-sobreaviso.js) */
      if (RosterWork.escalasPainelSobreaviso) RosterWork.escalasPainelSobreaviso.clique(evento);
      abrirParaCelula(celula);
    });
    if (!remarcarLigado) {
      remarcarLigado = true;
      window.addEventListener('rosterwork_escala_recarregar', remarcarSelecionada);
    }
  }

  /* ícone por classe de observação (troca/folga/outra unidade/remanejado/mudança de dia automáticas; admin manual) */
  var ICONE_OBS = { troca: 'icone-origem-troca', folga: 'icone-folgas', outra_unidade: 'icone-reforco', remanejado: 'icone-remanejado',
    mudanca: 'icone-origem-mudanca', admin: 'icone-anotacao' };
  /* a ordem fixa dos grupos das Observações */
  var ORDEM_OBS = ['admin', 'troca', 'folga', 'outra_unidade', 'remanejado', 'mudanca'];

  /* separa as observações nos grupos, na ordem fixa; dentro do grupo fica a ordem que veio (o banco já ordena
     por antiguidade; as notas novas do Editar entram no fim de Administração). Usado no painel e no PDF.
     Devolve [{ classe, titulo, itens }] só com os grupos que têm itens */
  function agruparObservacoes(obs) {
    var titulos = RosterWork.mensagens.escala.observacoesGrupos;
    return ORDEM_OBS.map(function (classe) {
      return { classe: classe, titulo: titulos[classe], itens: (obs || []).filter(function (o) { return o.classe === classe; }) };
    }).filter(function (g) { return g.itens.length; });
  }

  /* o texto das Observações para colar (o Copiar do título da caixa): os grupos na ordem da tela, cada um com a lista
     numerada, e uma linha em branco entre eles */
  function textoDasObservacoes(obs) {
    var m = RosterWork.mensagens.escala;
    return agruparObservacoes(obs).map(function (g) {
      return [g.titulo].concat(g.itens.map(function (o, i) { return (i + 1) + '. ' + m.observacaoTexto(o); })).join('\n');
    }).join('\n\n');
  }

  /* a linha do título da caixa com o Copiar: leva o texto para a área de transferência (o Ctrl+C) e mostra o visto por
     2 s no lugar do ícone; se o navegador não deixar copiar, o aviso */
  function ligarCopiar(caixa, obs) {
    var m = RosterWork.mensagens.escala;
    var linha = RosterWork.tpl('tpl-escala-observacoes-titulo');
    var rotulo = caixa.querySelector('.rotulo-secao');
    if (!linha || !rotulo) return;
    caixa.insertBefore(linha, rotulo);
    linha.insertBefore(rotulo, linha.firstChild);
    var botao = linha.querySelector('.escala-observacoes-copiar');
    var dica = botao.getAttribute('data-dica');
    var espera = null;
    function mostrarCopiado(sim) {
      botao.querySelector('.escala-observacoes-copiar-icone').classList.toggle('oculto', sim);
      botao.querySelector('.escala-observacoes-copiado-icone').classList.toggle('oculto', !sim);
      botao.setAttribute('data-dica', sim ? m.observacoesCopiado : dica);
    }
    function falhou() { if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: m.observacoesFalhaCopiar }); }
    botao.addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { falhou(); return; }
      navigator.clipboard.writeText(textoDasObservacoes(obs)).then(function () {
        mostrarCopiado(true);
        clearTimeout(espera);
        espera = setTimeout(function () { mostrarCopiado(false); }, 2000);
      }).catch(falhou);
    });
  }

  /* seção "Observações" do dia em grupos: Administração (notas manuais do admin), Trocas, Folgas, De outra unidade,
     Remanejados e Mudanças de dia (automáticas), cada um com a sua lista numerada e, com itens, o Copiar no título. Para o admin no Dia:
     botão para adicionar (com limite) e ✕ para excluir SÓ as do admin; as duas coisas gravam na hora.
     Sem editar: só leitura. opcoes = { editar, aoAdicionar(texto), aoRemover(observacao) } */
  function montarObservacoes(obs, opcoes) {
    opcoes = opcoes || {};
    var editar = !!opcoes.editar;
    obs = obs || [];
    if (!obs.length && !editar) return null;   /* Ver/Dia sem observações: some. Editar: sempre aparece */
    var m = RosterWork.mensagens.escala;
    var caixa = RosterWork.painel.criarCaixa(m.observacoesTitulo);
    if (!caixa) return null;
    if (obs.length) ligarCopiar(caixa, obs);

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
    /* o dia de uma unidade sem a célula (a companhia do Oficial de Área): abrirDia(dia, secao, { abrirMenuDe }) */
    abrirDia: abrirDia,
    /* o dia aberto ({ unidadeId, iso, secao, unidadeNome }) e a aba aberta lida de novo (o Salvar do rodapé) */
    contexto: function () { return pCtx ? { unidadeId: pCtx.unidadeId, iso: pCtx.iso, secao: pCtx.secao, unidadeNome: pCtx.unidadeNome } : null; },
    /* a grade foi redesenhada (a prévia do rascunho): o dia aberto volta a ficar selecionado */
    remarcar: remarcarSelecionada,
    /* o dia aberto mudou na grade sem ela ser redesenhada: ele continua inteiro à vista (o rodapé pode ter aparecido) */
    mostrarDia: function () { mostrarDiaAberto(true); },
    /* outro painel vai abrir no lugar do dia (o do militar): o rascunho de todos os dias fica, e segue na hora com
       seguir(false); só o formulário da troca preenchido pergunta antes (Descartar segue, Continuar editando fica).
       seguir(true) seria com o rascunho descartado (as telas leem o gravado de novo) */
    antesDeSair: function (seguir) {
      if (!trocaSuja()) { seguir(false); return; }
      confirmarDescarte(function () { seguir(false); }, 0);
    },
    /* o aviso de descartar (Descartar / Continuar editando), o mesmo de trocar de dia: a célula da grade também usa.
       quantas: quantas alterações saem (sem ela, todas) */
    confirmarDescarte: confirmarDescarte,
    recarregarSecao: function () { if (pCtx) mostrarSecao(pCtx.secao); },
    /* a aba do painel existe (secao = 'distribuicao' | 'estagiarios' | 'continuos' | 'extra') e a abre como o clique nela (o Mudar a
       extrajornada do menu da linha; o Ver o dia da aba Guarnições, com opcoes.abrirMenuDe: o cpf de quem fica com o menu
       aberto quando a lista chegar) */
    temAba: function (secao) { var l = RosterWork.painel.linhaAbas(); return !!(l && l.querySelector('.aba[data-secao="' + secao + '"]')); },
    abrirAba: function (secao, opcoes) {
      var l = RosterWork.painel.linhaAbas(), aba = l && l.querySelector('.aba[data-secao="' + secao + '"]');
      if (!aba) return;
      if (pCtx && opcoes && opcoes.abrirMenuDe) pCtx.abrirMenuDe = opcoes.abrirMenuDe;
      aba.click();
    },
    /* a guarnição de serviço no dia aberto, quando a leitura do dia ou a aba Guarnições a traz: vai ao subtítulo
       ("Terça-feira, 24 de novembro de 2026 · Guarnição C") */
    mostrarGuarnicao: function (unidadeId, iso, letra) {
      if (!pCtx || String(pCtx.unidadeId) !== String(unidadeId) || pCtx.iso !== iso) return;
      RosterWork.painel.definirTitulos(null, letra ? RosterWork.mensagens.escala.subtituloGuarnicao(dataPorExtenso(iso), letra) : dataPorExtenso(iso));
    },
    /* peças de montagem reaproveitadas pelo Dia (escalas-painel-editar/-formulario/-militar) */
    pecas: {
      definirIcone: definirIcone,
      iconeDaLinha: iconeDaLinha,
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
      rotuloDaFuncao: rotuloDaFuncao,
      nomeSemNumero: nomeSemNumero,
      exibidas: exibidas,
      blocosDoDia: blocosDoDia,
      marcarConflito: marcarConflito,
      alteracoes: montarAlteracoes,
      temAlguem: temAlguem,
      nivelFuncao: nivelDaFuncao,
      nivelPosto: nivelDoPosto,
      montarAvisoProblemas: montarAvisoProblemas,
      linhasDoAviso: linhasDoAviso,
      anexarProblemas: anexarProblemas,
      marcarProblemas: marcarProblemas,
      noLugar: montarNoLugar,
      observacoes: montarObservacoes,
      agruparObservacoes: agruparObservacoes
    }
  };
})();
