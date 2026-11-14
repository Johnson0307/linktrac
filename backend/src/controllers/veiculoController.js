const Veiculo = require('../models/Veiculo');
const { normalizarIconeMapa } = require('../services/iconesMapa');
const { filtroAcesso, filtroConsulta, identificadorValido } = require('../services/acessoVeiculo');
const { telefoneWhatsApp } = require('../operacao/telefoneWhatsApp');

const validarVeiculo = (payload) => {
  const { placa, marca, modelo, ano, nomeCliente } = payload;
  const erros = [];

  if (typeof placa !== 'string' || !placa.trim()) erros.push('A placa é obrigatória.');
  if (typeof marca !== 'string' || !marca.trim()) erros.push('A marca é obrigatória.');
  if (typeof modelo !== 'string' || !modelo.trim()) erros.push('O modelo é obrigatório.');
  if (
    !['string', 'number'].includes(typeof ano) ||
    !Number.isInteger(Number(ano)) ||
    Number(ano) < 1886 ||
    Number(ano) > new Date().getFullYear() + 1
  )
    erros.push('Informe um ano válido para o veículo.');
  if (typeof nomeCliente !== 'string' || !nomeCliente.trim())
    erros.push('O nome do cliente é obrigatório.');
  if (Object.hasOwn(payload, 'iconeMapa') && payload.iconeMapa === undefined)
    erros.push('Selecione um ícone de veículo válido.');
  if (Object.hasOwn(payload, 'alertaAlimentacaoWhatsApp') && typeof payload.alertaAlimentacaoWhatsApp !== 'boolean')
    erros.push('Informe se os avisos por WhatsApp estão autorizados.');
  if (payload.alertaAlimentacaoWhatsApp === true && !telefoneWhatsApp(payload.telefone))
    erros.push('Informe um celular brasileiro com DDD para receber o alerta por WhatsApp.');

  return erros;
};

const dadosVeiculo = (body, clienteId) => ({
  marca: body?.marca,
  modelo: body?.modelo,
  ano: body?.ano,
  cor: body?.cor,
  nomeCliente: body?.nomeCliente,
  telefone: body?.telefone,
  ativo: body?.ativo,
  placa: typeof body?.placa === 'string' ? body.placa.toUpperCase().trim() : undefined,
  clienteId,
  ...(Object.hasOwn(body || {}, 'iconeMapa') ? { iconeMapa: normalizarIconeMapa(body.iconeMapa, 'veiculo') } : {}),
  ...(Object.hasOwn(body || {}, 'alertaAlimentacaoWhatsApp') ? { alertaAlimentacaoWhatsApp: body.alertaAlimentacaoWhatsApp } : {}),
});

exports.cadastrarVeiculo = async (req, res) => {
  try {
    const payload = dadosVeiculo(req.body, req.user.clienteId);

    const erros = validarVeiculo(payload);
    if (erros.length > 0) {
      return res.status(400).json({ sucesso: false, mensagem: erros.join(' '), erros });
    }

    const veiculo = await Veiculo.create(payload);
    res.status(201).json({ sucesso: true, dados: veiculo });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ sucesso: false, mensagem: 'Placa já cadastrada.' });
    }
    res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.listarVeiculos = async (req, res) => {
  try {
    const veiculos = await Veiculo.find(filtroAcesso(req.user.clienteId)).sort({
      dataCadastro: -1,
    });
    res.json({ sucesso: true, quantidade: veiculos.length, dados: veiculos });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.buscarPorPlaca = async (req, res) => {
  try {
    if (req.query?.veiculoId && !identificadorValido(req.query.veiculoId)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
    }
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
    res.json({ sucesso: true, dados: veiculo });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.atualizarVeiculo = async (req, res) => {
  if (!identificadorValido(req.params.id)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
  }
  const payload = dadosVeiculo(req.body, req.user.clienteId);
  const erros = validarVeiculo(payload);
  if (erros.length) {
    return res.status(400).json({ sucesso: false, mensagem: erros.join(' '), erros });
  }
  try {
    const filtro = { _id: req.params.id, clienteId: req.user.clienteId };
    if (payload.telefone !== undefined && payload.alertaAlimentacaoWhatsApp === undefined) {
      const dados = await Veiculo.findOneAndUpdate({
        ...filtro, telefone: { $ne: payload.telefone }, alertaAlimentacaoWhatsApp: true,
      }, { $set: { ...payload, alertaAlimentacaoWhatsApp: false } }, { new: true, runValidators: true });
      if (dados) return res.json({ sucesso: true, dados });
      filtro.$or = [{ alertaAlimentacaoWhatsApp: { $ne: true } }, { telefone: payload.telefone }];
    }
    const dados = await Veiculo.findOneAndUpdate(
      filtro,
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!dados) return res.status(404).json({ sucesso: false, mensagem: 'Veículo da empresa não encontrado.' });
    return res.json({ sucesso: true, dados });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ sucesso: false, mensagem: 'Placa já cadastrada.' });
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o veículo.' });
  }
};
