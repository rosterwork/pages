/* ============================================================
   ESCALAS — painel lateral de detalhes (abre ao clicar na célula)
   Liga o clique numa célula da grade Mês/Agenda à "gaveta"
   (componente geral-painel): título = unidade (o pelotão mostra a
   companhia acima), complemento = " - cidade", subtítulo = data
   por extenso, abas Distribuição/Contínuos/Pontuais.
   Distribuição lista os postos do dia (posto / função / militares,
   modo Ver); Contínuos e Pontuais são etapa futura.
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
    if (uso) uso.setAttribute('href', 'icones/' + nomeIcone + '.svg#' + nomeIcone);
  }

  /* "08:00" -> "08h" (hora cheia, como no painel do site antigo) */
  function formatarHora(hhmm) {
    if (!hhmm) return '';
    return hhmm.split(':')[0] + 'h';
  }

  /* abrevia as funções longas (espelha o site antigo), separando a base do número
     ("Radio Operador 2" → "Radio Op. 2"); as demais ficam como estão */
  function abreviarFuncao(nome) {
    var m = /^(.*?)\s+(\d+)$/.exec(nome || '');
    var base = m ? m[1] : (nome || '');
    var num = m ? (' ' + m[2]) : '';
    var n = base.toLowerCase();
    if (n === 'oficial de área' || n === 'oficial de area') return 'Of. Área' + num;
    if (n === 'chefe de socorro') return 'Chef. Soc.' + num;
    if (n === 'radio operador' || n === 'rádio operador') return 'Radio Op.' + num;
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

  /* início válido: dentro da janela e não na ponta final (não dá pra começar quando ela acaba) */
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
     efetivo abaixo do mínimo ou acima do máximo também é erro */
  function nivelDoPosto(posto) {
    var nivel = (posto && (posto.sem_condutor || posto.abaixo_minimo || posto.acima_maximo)) ? 'erro' : '';
    ((posto && posto.funcoes) || []).forEach(function (f) { nivel = piorNivel(nivel, nivelDaFuncao(f)); });
    return nivel;
  }

  /* há conflito nos postos do dia? fora da disponibilidade (incompativel) ou sobreposição
     na função. soManual=true conta só o que envolve ajuste manual (é o que trava o Salvar) */
  function temConflito(postos, soManual) {
    return (postos || []).some(function (po) {
      if (po.acima_maximo) return true;   // acima do efetivo máximo sempre trava (nunca passa do máximo)
      return (po.funcoes || []).some(function (f) {
        var mils = f.militares || [];
        var inc = mils.some(function (mil) { return mil.incompativel && (!soManual || mil.fixado); });
        var sob = !!f.sobreposicao;   // sobreposição na função sempre trava (não dá pra ter 2 militares no mesmo horário)
        return inc || sob;
      });
    });
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
     m.aviso pode ter mais de um motivo (vírgula) — cada motivo entra no seu tipo. */
  function detalharAvisosMotor(postos) {
    var det = { grauRebaixado: [], grauExclusivo: [], rodizioRepetido: [], exclusivoCondutor: [], afastadoTroca: [] };
    (postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          if (!m.aviso) return;
          String(m.aviso).split(',').forEach(function (a) {
            var k = AVISO_MOTOR[a];
            if (det[k]) det[k].push({ m: m, f: f });
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
     no Ver e no Editar (no Editar, calculada sobre o rascunho ainda não salvo): uma linha por tipo de
     problema, vermelho primeiro e amarelo depois. O detalhe amarelo expansível (quem + vaga + motivo)
     segue montado pelos dados dos postos. mostrarAcao revela o "CORRIJA PARA SALVAR" */
  function montarAvisoProblemas(problemas, postos, faltamModelos, mostrarAcao) {
    var lista = problemas || [];
    if (!lista.length) return null;
    var cat = (RosterWork.mensagens && RosterWork.mensagens.escala && RosterWork.mensagens.escala.erros) || {};
    var aviso = RosterWork.tpl('tpl-escala-distribuicao-aviso');
    if (!aviso) return null;
    var alvo = aviso.querySelector('.escala-distribuicao-aviso-lista');

    var por = {};
    lista.forEach(function (p) { (por[p.codigo] = por[p.codigo] || []).push(p); });
    function tem(codigo) { return !!(por[codigo] && por[codigo].length); }
    function linha(def, texto) { if (def) avisoItem(alvo, def.icone, texto || def.texto, def.nivel); }
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
        linha(def, preencher(def.texto, { posto: itens[0].posto || '', pessoas: pessoas, minimo: itens[0].limite, maximo: itens[0].limite, faixas: faixas }));
      });
    }

    /* 🔴 vermelho: a escala não funciona */
    if (tem('parcial_com_erro')) linha(cat.distribuicaoTravada);
    if (tem('resolva_escala')) linha(cat.resolvaEscala);
    if (tem('sem_condutor')) linha(cat.semCondutor);
    if (tem('fora_disponibilidade')) linha(cat.foraDisponibilidade);
    if (tem('sem_servico')) linha(cat.semServico);
    if (tem('sobreposicao')) linha(cat.sobreposicao);
    porOcorrencia('cnh_incompativel', cat.cnhIncompativel, function (p) { return p.cpf + '|' + p.posto_id; },
      function (p) { return { militar: militar(p), posto: p.posto || '' }; });
    porOcorrencia('regra_proibida', cat.regraProibida, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    linhasEfetivoProblemas('abaixo_minimo', cat.abaixoMinimo);
    linhasEfetivoProblemas('acima_maximo', cat.acimaMaximo);
    var semFuncao = {};
    ['sem_funcao', 'sem_modelo', 'parcial_com_erro', 'resolva_escala'].forEach(function (c) {
      (por[c] || []).forEach(function (p) { semFuncao[p.cpf] = true; });
    });
    var qSemFuncao = Object.keys(semFuncao).length;
    if (qSemFuncao && cat.semFuncao) linha(cat.semFuncao, qSemFuncao === 1 ? cat.semFuncao.texto : preencher(cat.semFuncao.textoPlural, { n: qSemFuncao }));
    if (tem('sem_modelo')) {
      var defFM = cat.faltaModelo || { texto: 'Falta modelo de distribuição', icone: 'icone-alerta', nivel: 'erro' };
      var faltam = faltamModelos || [];
      if (!faltam.length) linha(defFM);
      faltam.forEach(function (f) {   // uma linha por trecho sem modelo, com a composição do trecho
        linha(defFM, defFM.texto + ': ' + textoComposicao(f.unidades) + ', ' + formatarHora(f.hi) + ' às ' + formatarHora(f.hf));
      });
    }

    /* 🟡 amarelo: funciona, com erro aceitável */
    if (tem('chefe_condutor')) linha(cat.chefeCondutor);
    porOcorrencia('manutencao', cat.manutencao, function (p) { return p.posto_id; },
      function (p) { return { posto: p.posto || '' }; });
    porOcorrencia('exclusivo_fora', cat.exclusivoFora, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    porOcorrencia('grau_diferente', cat.grauDiferente, function (p) { return p.cpf + '|' + p.funcao; },
      function (p) { return { militar: militar(p), funcao: p.funcao || '' }; });
    var det = detalharAvisosMotor(postos);   // quem + vaga + motivo, para o detalhe expansível
    [['grau_por_falta', 'grauRebaixado'], ['grau_exclusivo', 'grauExclusivo'], ['rodizio_quebrado', 'rodizioRepetido'],
     ['exclusivo_condutor', 'exclusivoCondutor'], ['afastado', 'afastadoTroca']].forEach(function (par) {
      if (tem(par[0])) montarAvisoGrupo(alvo, par[1], det[par[1]], cat[par[1]]);
    });

    if (!alvo.children.length) return null;
    if (mostrarAcao) {
      var acao = aviso.querySelector('.escala-distribuicao-aviso-acao');
      if (acao) acao.classList.remove('oculto');
    }
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
    if (RosterWork.escalasPainelPontuais) RosterWork.escalasPainelPontuais.reset();
  }

  /* ---------- guarda de descarte: avisa antes de perder rascunho não salvo ---------- */
  /* seções com rascunho não salvo (Editar, Pontuais e Contínuos, todas com Salvar em lote) */
  function secaoSuja() {
    return !!((RosterWork.escalasPainelEditar && RosterWork.escalasPainelEditar.estaSujo && RosterWork.escalasPainelEditar.estaSujo())
      || (RosterWork.escalasPainelPontuais && RosterWork.escalasPainelPontuais.estaSujo && RosterWork.escalasPainelPontuais.estaSujo())
      || (RosterWork.escalasPainelContinuos && RosterWork.escalasPainelContinuos.estaSujo && RosterWork.escalasPainelContinuos.estaSujo()));
  }
  function limparSecoesSujas() {
    if (RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (RosterWork.escalasPainelPontuais) RosterWork.escalasPainelPontuais.reset();
    if (RosterWork.escalasPainelContinuos) RosterWork.escalasPainelContinuos.reset();
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
    if (!secaoSuja()) return false;               // nada sujo: deixa o painel fechar normalmente
    confirmarDescarte(function () { RosterWork.painel.fechar(); });
    return true;                                  // segura o fechamento até confirmar
  }
  /* guarda a troca de aba (seção ou Ver/Editar): segura o clique antes de o geral-abas trocar,
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
  /* as abas Ver/Editar vivem no #painel-abas do shell (persistente): liga uma vez só */
  var guardaModoLigado = false;
  function ligarGuardaModo() {
    if (guardaModoLigado) return;
    var abas = document.getElementById('painel-abas');
    if (!abas) return;
    guardaModoLigado = true;
    ligarGuardaAbas(abas);
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
     aqui não se renumera mais, senão a folga/troca parcial quebraria. Copia (não muta o leitor). */
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

  function mostrarEstado(corpo, texto) {
    var estado = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (estado) { estado.textContent = texto; corpo.appendChild(estado); }
  }

  /* carregando: o giratório centralizado no painel (sem texto) */
  function mostrarCarregando(corpo) {
    var no = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (no) corpo.appendChild(no);
  }

  /* bloco "Em manutenção" (amarelo) da viatura: aviso + a nota. Só leitura no Ver;
     editável no Editar (salva na hora via atualizar_manutencao_observacao). */
  function montarManutencao(posto, editavel) {
    var el = RosterWork.tpl('tpl-escala-manutencao');
    if (!el) return null;
    var tit = el.querySelector('.escala-manutencao-titulo');
    if (tit) tit.textContent = (RosterWork.mensagens.escala || {}).emManutencao || 'Em manutenção';
    var input = el.querySelector('.escala-manutencao-nota');
    var verTxt = el.querySelector('.escala-manutencao-nota-ver');
    var obs = posto.manutencao_obs || '';
    if (editavel) {
      if (verTxt) verTxt.classList.add('oculto');
      if (input) {
        input.value = obs;
        input.addEventListener('change', function () {
          if (!posto.manutencao_id || !RosterWork.escalasDados) return;
          RosterWork.escalasDados.atualizarManutencaoObs(posto.manutencao_id, input.value)
            .then(function (r) {
              if (!RosterWork.avisar) return;
              if (r && r._falha === 'conexao') RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
              else if (r && (r._falha === 'servidor' || r.success === false)) RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.geral.falhaServidor });
            });
        });
      }
    } else {
      if (input) input.classList.add('oculto');
      if (verTxt) { verTxt.textContent = obs; verTxt.classList.toggle('oculto', !obs); }
    }
    return el;
  }

  /* seção Distribuição: a caixa "Sem função definida" (acima) e uma caixa por posto */
  function montarDistribuicao(corpo, unidadeId, iso) {
    var editar = RosterWork.painel.modo() === 'editar';
    corpo.textContent = '';
    mostrarCarregando(corpo);
    RosterWork.escalasDados.lerDistribuicaoDia(unidadeId, iso).then(function (dados) {
      if (!pCtx || pCtx.unidadeId !== unidadeId || pCtx.iso !== iso) return;   // outro dia/unidade foi aberto enquanto carregava
      corpo.textContent = '';
      if (!dados) { mostrarEstado(corpo, RosterWork.mensagens.escala.falhaCarregar); return; }   // falha de leitura: mostra erro, não "dia vazio"
      anexarProblemas(dados);   // CNH, regra, exclusivo e grau de cada militar (para pintar a linha e o posto)
      var postos = (dados && dados.postos) || [];
      var semFuncao = (dados && dados.sem_funcao) || [];
      if (!postos.length && !semFuncao.length) { mostrarEstado(corpo, 'Sem distribuição neste dia.'); return; }

      var aviso = montarAvisoProblemas(dados.problemas, postos, dados.faltam_modelos, false);   // Ver: a lista vem pronta do banco (mesma fonte do gráfico)
      if (aviso) corpo.appendChild(aviso);

      /* sem função definida: caixa de erro acima dos postos, só com a lista de militares */
      if (semFuncao.length) {
        var caixaErro = RosterWork.painel.criarCaixa('Sem função definida', true);
        if (caixaErro) {
          semFuncao.forEach(function (m) {
            var linha = montarLinhaEscalado(m);
            if (linha) caixaErro.appendChild(linha);
          });
          corpo.appendChild(caixaErro);
        }
      }

      postos.forEach(function (posto) {
        /* no modo Ver, mostra só os postos com alguém (e sempre os em manutenção); no Editar, todos os ativos */
        if (!editar && !temAlguem(posto) && !posto.em_manutencao) return;
        var caixa = RosterWork.painel.criarCaixa(posto.nome);
        if (!caixa) return;
        if (posto.em_manutencao) {
          /* viatura em manutenção: caixa amarela + aviso/nota; o efetivo FICA nela, só sinalizado */
          caixa.classList.add('grupo-caixa--posto-alerta', 'grupo-caixa--manutencao');
          var m = montarManutencao(posto, false);
          if (m) caixa.appendChild(m);
        } else {
          var np = nivelDoPosto(posto);
          if (np) caixa.classList.add('grupo-caixa--posto-' + np);
        }
        mesclarFuncoesViatura(posto).forEach(function (funcao) {
          var grupo = montarGrupoFuncao(funcao, editar);
          if (grupo) caixa.appendChild(grupo);
        });
        corpo.appendChild(caixa);
      });

      /* Observações do dia (trocas, folgas, notas do admin): depois dos cards de posto */
      var caixaObs = montarObservacoes((dados && dados.observacoes) || [], { editar: editar, unidadeId: unidadeId, iso: iso });
      if (caixaObs) corpo.appendChild(caixaObs);
    });
  }

  /* rodapé retrátil: abre/fecha pelo chevron; sempre começa fechado (ao reabrir o painel, volta retraído) */
  function aplicarRetratil(toggle, conteudo, aberto) {
    toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    conteudo.classList.toggle('oculto', !aberto);
  }

  /* rodapé "Alterações manuais (N)": quem mexeu no dia, quando e o quê (ajustes da Distribuição,
     pontuais e entradas/saídas do ciclo que começam no dia). Sem alterações, o rodapé não aparece */
  function montarAlteracoes(rodape, unidadeId, iso) {
    rodape.textContent = '';
    rodape.classList.add('oculto');
    if (!RosterWork.escalasDados || !RosterWork.escalasDados.lerAlteracoesDia) return;
    RosterWork.escalasDados.lerAlteracoesDia(unidadeId, iso).then(function (lista) {
      /* outro dia/unidade/seção foi aberto enquanto carregava: não mexe no rodapé */
      if (!pCtx || pCtx.unidadeId !== unidadeId || pCtx.iso !== iso || pCtx.secao !== 'distribuicao' || RosterWork.painel.modo() === 'editar') return;
      if (!lista || !lista.length) return;
      var bloco = RosterWork.tpl('tpl-escala-alteracoes');
      if (!bloco) return;
      bloco.querySelector('.escala-alteracoes-qtd').textContent = '(' + lista.length + ')';
      var conteudo = bloco.querySelector('.escala-alteracoes-lista');
      lista.forEach(function (alt) {
        var item = RosterWork.tpl('tpl-escala-alteracao');
        if (!item) return;
        item.querySelector('.escala-alteracao-autor').textContent = alt.autor || '';
        var quando = item.querySelector('.escala-alteracao-quando');
        if (RosterWork.resumo && RosterWork.resumo.formatarQuando) quando.textContent = RosterWork.resumo.formatarQuando(alt.criado_em);
        if (RosterWork.resumo && RosterWork.resumo.desenhar) {
          var no = RosterWork.resumo.desenhar(alt.resumo, { mostrarQuando: false });
          if (no) item.querySelector('.escala-alteracao-resumo').appendChild(no);
        }
        conteudo.appendChild(item);
      });
      var toggle = bloco.querySelector('.escala-alteracoes-toggle');
      aplicarRetratil(toggle, conteudo, false);
      toggle.addEventListener('click', function () {
        aplicarRetratil(toggle, conteudo, toggle.getAttribute('aria-expanded') !== 'true');
      });
      rodape.textContent = '';
      rodape.appendChild(bloco);
      rodape.classList.remove('oculto');
    });
  }

  /* avisado pelo geral-painel ao trocar Ver/Editar: redesenha a seção atual no novo modo */
  function aoMudarModo() {
    if (pCtx) mostrarSecao(pCtx.secao);
  }

  /* volta para o modo Ver clicando na aba (o geral-painel cuida da troca) */
  function voltarParaVer() {
    if (RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    var abas = document.getElementById('painel-abas');
    var ver = abas ? abas.querySelector('[data-painel-modo="ver"]') : null;
    if (ver) ver.click();
  }

  /* troca o conteúdo do corpo e o rodapé conforme a aba de seção e o modo Ver/Editar */
  function mostrarSecao(secao) {
    if (!pCtx) return;
    pCtx.secao = secao;
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    var rodape = RosterWork.painel.rodape();
    var editar = RosterWork.painel.modo() === 'editar';
    /* ao entrar numa seção, zera as outras (rascunhos/estado não vazam entre abas) */
    if (secao !== 'distribuicao' && RosterWork.escalasPainelEditar) RosterWork.escalasPainelEditar.reset();
    if (secao !== 'continuos' && RosterWork.escalasPainelContinuos) RosterWork.escalasPainelContinuos.reset();
    if (secao !== 'pontuais' && RosterWork.escalasPainelPontuais) RosterWork.escalasPainelPontuais.reset();

    if (secao === 'distribuicao') {
      if (editar && RosterWork.escalasPainelEditar) {
        RosterWork.escalasPainelEditar.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso, voltarParaVer);
      } else {
        montarDistribuicao(corpo, pCtx.unidadeId, pCtx.iso);
        if (rodape) montarAlteracoes(rodape, pCtx.unidadeId, pCtx.iso);
      }
    } else if (secao === 'continuos' && RosterWork.escalasPainelContinuos) {
      RosterWork.escalasPainelContinuos.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso, editar);
    } else if (secao === 'pontuais' && RosterWork.escalasPainelPontuais) {
      RosterWork.escalasPainelPontuais.montar(corpo, rodape, pCtx.unidadeId, pCtx.iso, editar);
    } else {
      corpo.textContent = '';
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    }
  }

  /* abrir outra célula com rascunho aberto: confirma o descarte antes de trocar */
  function abrirParaCelula(celula) {
    if (secaoSuja()) { confirmarDescarte(function () { abrirParaCelulaAgora(celula); }); return; }
    abrirParaCelulaAgora(celula);
  }

  function abrirParaCelulaAgora(celula) {
    desmarcar();
    celula.classList.add('escala-mes-celula--selecionada');
    celulaSelecionada = celula;

    var unidadeId = celula.dataset.unidadeId;
    var iso = celula.dataset.iso;
    var cidade = celula.dataset.unidadeCidade;
    pCtx = { unidadeId: unidadeId, iso: iso, secao: 'distribuicao' };
    RosterWork.painel.abrir({
      titulo: celula.dataset.unidadeNome || '',
      tituloExtra: cidade ? '- ' + cidade : '',
      subtitulo: dataPorExtenso(iso),
      editavel: RosterWork.sessao.ehAdmin(),   // só admin vê a aba Editar (o backend também trava em salvar_ajustes_dia)
      aoMudarModo: aoMudarModo,
      aoFechar: desmarcar,
      aoTentarFechar: tentarFecharPainel       // Esc/X confirmam antes de descartar rascunho
    });
    ligarGuardaModo();                         // guarda das abas Ver/Editar (uma vez só)

    /* barra de seções (abas); o geral-abas cuida da troca visual e nos avisa a aba escolhida */
    var sub = RosterWork.painel.subcabecalho();
    var tpl = document.getElementById('tpl-escala-painel-secoes');
    if (sub && tpl) {
      sub.appendChild(tpl.content.cloneNode(true));
      sub.classList.remove('oculto');
      var trilho = sub.querySelector('.abas');
      if (trilho && RosterWork.abas) {
        ligarGuardaAbas(trilho);   // confirma o descarte antes de trocar de seção com rascunho
        RosterWork.abas.ligar(trilho, function (aba) {
          mostrarSecao(aba.getAttribute('data-secao'));
        });
      }
    }

    mostrarSecao('distribuicao');
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

  /* um clique delegado no fragmento da página: pega a célula clicada e abre a gaveta.
     Delegado no fragmento (não na grade) para sobreviver às remontagens da grade */
  var remarcarLigado = false;
  function ligar(conteudo) {
    if (!conteudo) return;
    conteudo.addEventListener('click', function (evento) {
      /* célula da grade OU bloco marcado (ex.: a unidade do modo Dia em árvore) */
      var celula = evento.target.closest ? evento.target.closest('.escala-mes-celula, [data-abre-dia]') : null;
      if (celula) abrirParaCelula(celula);
    });
    if (!remarcarLigado) {
      remarcarLigado = true;
      window.addEventListener('rosterwork_escala_recarregar', remarcarSelecionada);
    }
  }

  /* busca reutilizável no topo de uma seção do painel (Contínuos/Pontuais): filtra os
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

  /* ícone por classe de observação (troca/folga automáticas; admin manual) */
  var ICONE_OBS = { troca: 'icone-origem-troca', folga: 'icone-folgas', admin: 'icone-anotacao' };

  /* seção "Observações" do dia: trocas + folgas (automáticas) + notas do admin (manuais),
     nesta ordem (vem pronta do ler_distribuicao_dia). No Editar do admin: botão para adicionar
     (com limite) e ✕ para excluir SÓ as do admin. No Ver/página de Dia: só leitura.
     opcoes = { editar, unidadeId, iso }. */
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
      definirIcone(linha.querySelector('.escala-observacao-icone'), ICONE_OBS[o.classe] || 'icone-anotacao');
      linha.querySelector('.escala-observacao-texto').textContent = m.observacaoTexto(o);
      var rem = linha.querySelector('.escala-observacao-remover');
      /* ✕ só nas do admin, no Editar; trocas e folgas nunca podem ser apagadas */
      if (editar && o.classe === 'admin' && o.id) {
        rem.addEventListener('click', function () {
          RosterWork.escalasDados.observacaoRemover(o.id).then(function (r) {
            if (r && r.success) { if (linha.parentNode) linha.parentNode.removeChild(linha); }
            else if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: m.observacaoFalhaExcluir });
          });
        });
      } else {
        rem.classList.add('oculto');
      }
      return linha;
    }

    obs.forEach(function (o) { var l = linhaObs(o); if (l) caixa.appendChild(l); });

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
          if (!texto) { fechar(); return; }
          salvar.disabled = true;
          RosterWork.escalasDados.observacaoAdicionar(opcoes.unidadeId, opcoes.iso, texto).then(function (r) {
            salvar.disabled = false;
            if (r && r.success && r.observacao) {
              var nova = linhaObs(r.observacao);
              if (nova) caixa.insertBefore(nova, add);   /* a nova entra no fim da lista, antes do form */
              fechar();
            } else if (RosterWork.avisar) {
              RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || m.observacaoFalhaSalvar });
            }
          });
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
    /* peças de montagem reaproveitadas pelo modo Editar (escalas-painel-editar.js) */
    pecas: {
      definirIcone: definirIcone,
      iconeOrigem: ICONE_ORIGEM,
      formatarHora: formatarHora,
      abreviarFuncao: abreviarFuncao,
      linha: montarLinhaEscalado,
      grupo: montarGrupoFuncao,
      mesclarFuncoes: mesclarFuncoesViatura,
      marcarConflito: marcarConflito,
      temConflito: temConflito,
      temAlguem: temAlguem,
      nivelFuncao: nivelDaFuncao,
      nivelPosto: nivelDoPosto,
      montarAvisoProblemas: montarAvisoProblemas,
      anexarProblemas: anexarProblemas,
      marcarProblemas: marcarProblemas,
      montarBusca: montarBusca,
      montarManutencao: montarManutencao,
      observacoes: montarObservacoes
    }
  };
})();
