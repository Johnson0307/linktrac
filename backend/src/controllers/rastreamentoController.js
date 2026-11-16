const Localizacao = require('../models/Localizacao');
const Veiculo = require('../models/Veiculo');
const { filtroConsulta, identificadorValido } = require('../services/acessoVeiculo');
const { definirStatus, formatarCoordenadas } = require('../services/rastreamentoService');
const { resumirAtividade } = require('../services/historicoAtividade');
const { Registro } = require('../operacao/modelos');
const { consultarHistorico } = require('../services/historicoArquivo');
const dadosDeConsulta = (p, clienteId, veiculo) => {
  const obj = p.toObject ? p.toObject() : { ...p };
  if (obj.telemetria) {
    obj.telemetria = { ...obj.telemetria };
    delete obj.telemetria.identificadorMotorista;
  }
  if (String(clienteId) !== String(veiculo.clienteId)) delete obj.motoristaId;
  return obj;
};

exports.consultarHistorico = async (req, res) => {
  try {
    const { veiculoId, inicio, fim } = req.query || {};
    if (veiculoId && !identificadorValido(veiculoId))
      return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
    const dataValida = (valor) => typeof valor === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor) &&
      Number.isFinite(Date.parse(valor));
    if ((inicio !== undefined && !dataValida(inicio)) || (fim !== undefined && !dataValida(fim)))
      return res.status(400).json({ sucesso: false, mensagem: 'Informe datas válidas com fuso horário.' });
    if (inicio && fim && Date.parse(inicio) > Date.parse(fim))
      return res.status(400).json({ sucesso: false, mensagem: 'O início deve ser anterior ao fim.' });
    const veiculos = await Veiculo.find(filtroConsulta(req)).limit(2);
    if (veiculos.length > 1)
      return res.status(409).json({ sucesso: false, mensagem: 'Selecione o veículo na lista para consultar esta placa.' });
    if (!veiculos.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado.' });
    const filtro = { veiculoId: veiculos[0]._id };
    if (inicio || fim) filtro.dataHora = {
      ...(inicio ? { $gte: new Date(inicio) } : {}),
      ...(fim ? { $lte: new Date(fim) } : {}),
    };
    const limite = 500;
    const veiculo = veiculos[0];
    const agora = new Date().toISOString();
    const [registros, cercas] = await Promise.all([
      consultarHistorico(Localizacao, filtro, { limite: limite + 1 }),
      String(veiculo.clienteId) === String(req.user.clienteId) ? Registro.find({
        clienteId: req.user.clienteId, tipo: 'cercas', 'dados.veiculoId': String(veiculo._id), 'dados.ativo': true,
        $and: [
          { $or: [{ 'dados.vigenciaInicio': { $in: [null, ''] } }, { 'dados.vigenciaInicio': { $lte: agora } }] },
          { $or: [{ 'dados.vigenciaFim': { $in: [null, ''] } }, { 'dados.vigenciaFim': { $gte: agora } }] },
        ],
      }).select('dados.nome dados.latitude dados.longitude dados.raioMetros -_id').sort({ createdAt: -1 }).limit(500).lean() : [],
    ]);
    const posicoes = registros.slice(0, limite).reverse().map((p) => dadosDeConsulta(p, req.user.clienteId, veiculo));
    return res.json({ sucesso: true, dados: posicoes, quantidade: posicoes.length, limite,
      limitado: registros.length > limite, atividade: resumirAtividade(posicoes), cercas: cercas.map(c => c.dados) });
  } catch (e) {
    if (e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL') return res.status(e.status).json({ sucesso: false, mensagem: e.message });
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível consultar o histórico.' });
  }
};

exports.atualizarPosicao = async (req, res) => {
  try {
    const validacao = require('../operacao/telemetria').validarTelemetria(req.body?.telemetria);
    if (validacao.erros.length) return res.status(400).json({ sucesso: false, mensagem: validacao.erros.join(' ') });
    const dataRecebida = req.body?.dataHora;
    if (dataRecebida !== undefined && (!require('../operacao/validacao').horario(dataRecebida) || Date.parse(dataRecebida) > Date.now() + 300000 || Date.parse(dataRecebida) < Date.UTC(2000, 0, 1)))
      return res.status(400).json({ sucesso: false, mensagem: 'Horário da medição inválido. Use ISO com fuso horário.' });
    const mensagemId = req.body?.mensagemId;
    if (mensagemId !== undefined && (typeof mensagemId !== 'string' || !/^[\w.:-]{1,100}$/.test(mensagemId)))
      return res.status(400).json({ sucesso: false, mensagem: 'Identificador de mensagem inválido.' });
    if (req.body?.ignicao !== undefined && req.body.ignicao !== null && typeof req.body.ignicao !== 'boolean')
      return res.status(400).json({ sucesso: false, mensagem: 'Ignição deve ser verdadeiro, falso ou ausente.' });
    const { placa, veiculoId, latitude, longitude, velocidade, endereco } = req.body || {};
    if (typeof placa !== 'string' || !placa.trim()) {
      return res.status(400).json({ sucesso: false, mensagem: 'A placa é obrigatória.' });
    }
    const numeroValido = (valor) =>
      (typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '')) &&
      Number.isFinite(Number(valor));
    if (!numeroValido(latitude) || !numeroValido(longitude)) {
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'Latitude e longitude válidas são obrigatórias.' });
    }
    const velocidadeAusente = velocidade === undefined || velocidade === null;
    if (!velocidadeAusente && !numeroValido(velocidade)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Velocidade deve ser numérica.' });
    }
    if (endereco != null && typeof endereco !== 'string') {
      return res.status(400).json({ sucesso: false, mensagem: 'Endereço deve ser um texto.' });
    }
    if (veiculoId && !identificadorValido(veiculoId))
      return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
    const veiculos = await Veiculo.find({
      placa: placa.toUpperCase().trim(),
      ...(veiculoId ? { _id: veiculoId } : {}),
    }).limit(2);
    if (veiculos.length > 1)
      return res
        .status(409)
        .json({
          sucesso: false,
          mensagem: 'Mais de um cadastro para esta placa. Informe veiculoId do veículo de origem.',
        });
    if (veiculos.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não cadastrado' });
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    const velNum = velocidadeAusente ? null : Number(velocidade);

    const enderecoStr = endereco == null ? undefined : String(endereco);
    if (enderecoStr && enderecoStr.length > 300) {
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'Endereço excede o tamanho máximo.' });
    }

    const payload = {
      ...(dataRecebida ? { dataHora: new Date(dataRecebida) } : {}),
      ...(mensagemId ? { mensagemId } : {}),
      ...(req.dispositivo ? { dispositivoId: req.dispositivo._id } : {}),
      ...(validacao.dados ? { telemetria: validacao.dados } : {}),
      ignicao: req.body?.ignicao ?? null,
      fonte: veiculos[0].marca === 'TESTE' && veiculos[0].modelo === 'SIMULACAO' ? 'simulado' : 'dispositivo',
      latitude: latNum,
      longitude: lonNum,
      velocidade: Number.isFinite(velNum) ? velNum : 0,
      endereco: enderecoStr,
      status: definirStatus(Number.isFinite(velNum) ? velNum : null),
    };

    if (
      !Number.isFinite(payload.latitude) ||
      !Number.isFinite(payload.longitude) ||
      payload.latitude < -90 ||
      payload.latitude > 90 ||
      payload.longitude < -180 ||
      payload.longitude > 180
    ) {
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'Latitude e longitude válidas são obrigatórias.' });
    }

    // Velocidade ausente mantém status Sem sinal; valores fora da faixa são rejeitados.
    if (payload.velocidade < 0 || payload.velocidade > 300) {
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'Velocidade fora do intervalo permitido.' });
    }

    if (mensagemId) {
      const existente = await Localizacao.findOne({ veiculoId: veiculos[0]._id, mensagemId });
      if (existente) return res.json({ sucesso: true, dados: existente, repetida: true });
      await Localizacao.init();
    }
    if (req.dispositivo) payload.motoristaId = await require('../operacao/automacoes').identificar(veiculos[0], payload.dataHora || new Date(), validacao.dados);
    let novaPosicao;
    try { novaPosicao = await Localizacao.create({ ...payload, veiculoId: veiculos[0]._id }); }
    catch (err) {
      if (err.code === 11000 && mensagemId) return res.json({ sucesso: true, dados: await Localizacao.findOne({ veiculoId: veiculos[0]._id, mensagemId }), repetida: true });
      throw err;
    }
    if (req.dispositivo) {
      try { await require('../operacao/automacoes').processarPosicao(veiculos[0], novaPosicao.toObject ? novaPosicao.toObject() : novaPosicao); }
      catch { res.setHeader?.('X-Linktrac-Automacoes', 'indisponivel'); }
    }
    const dados = novaPosicao.toObject ? novaPosicao.toObject() : { ...novaPosicao };
    delete dados.dispositivoId;
    res.status(201).json({ sucesso: true, dados });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.consultarUltimaPosicao = async (req, res) => {
  try {
    if (req.query?.veiculoId && !identificadorValido(req.query.veiculoId))
      return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
    const veiculos = await Veiculo.find(filtroConsulta(req)).limit(2);
    if (veiculos.length > 1)
      return res
        .status(409)
        .json({
          sucesso: false,
          mensagem: 'Selecione o veículo na lista para consultar esta placa.',
        });
    const [veiculo] = veiculos;
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado' });
    }

    const ultimaPosicao = await Localizacao.findOne({ veiculoId: veiculo._id })
      .sort({ dataHora: -1 })
      .lean();

    if (!ultimaPosicao) {
      return res
        .status(404)
        .json({ sucesso: false, mensagem: 'Nenhuma posição registrada para este veículo' });
    }

    const localizacao = {
      ...dadosDeConsulta(ultimaPosicao, req.user.clienteId, veiculo),
      coordenadas: formatarCoordenadas(ultimaPosicao.latitude, ultimaPosicao.longitude),
    };

    res.json({
      sucesso: true,
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        cliente: veiculo.nomeCliente,
      },
      localizacao,
    });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};
