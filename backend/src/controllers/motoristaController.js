const Motorista = require('../models/Motorista');
const { validarMotorista, status } = require('../services/validarMotorista');
const { identificadorValido } = require('../services/acessoVeiculo');
const gestor = (user) => ['admin', 'gestor'].includes(user.role);
const erroBanco = (err, res) => err.code === 11000
  ? res.status(409).json({ sucesso: false, mensagem: 'CPF ou CNH já cadastrado nesta empresa. Edite o cadastro existente.' })
  : res.status(503).json({ sucesso: false, mensagem: 'Não foi possível concluir a operação de motoristas. Tente novamente.' });
exports.listar = async (req, res) => {
  const { busca = '', situacao = '', pagina = '1' } = req.query || {};
  if (typeof busca !== 'string' || busca.length > 80 || typeof situacao !== 'string' || (situacao && !status.includes(situacao)) ||
    typeof pagina !== 'string' || !/^\d+$/.test(pagina) || Number(pagina) < 1 || Number(pagina) > 10000)
    return res.status(400).json({ sucesso: false, mensagem: 'Filtros de motorista inválidos.' });
  const filtro = { clienteId: req.user.clienteId, ...(situacao ? { status: situacao } : {}) };
  if (busca.trim()) filtro.nome = { $regex: busca.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  try {
    const limite = 20;
    const campos = gestor(req.user) ? '-__v' : '_id nome status categoriaCnh validadeCnh';
    const [dados, total] = await Promise.all([
      Motorista.find(filtro).select(campos).sort({ nome: 1, _id: 1 }).skip((Number(pagina) - 1) * limite).limit(limite).lean(),
      Motorista.countDocuments(filtro),
    ]);
    return res.json({ sucesso: true, dados, total, pagina: Number(pagina), paginas: Math.max(1, Math.ceil(total / limite)), limite });
  } catch (err) { return erroBanco(err, res); }
};
const salvar = (editar) => async (req, res) => {
  if (editar && !identificadorValido(req.params.id)) return res.status(400).json({ sucesso: false, mensagem: 'Motorista inválido.' });
  const { erros, dados } = validarMotorista(req.body);
  if (erros.length) return res.status(400).json({ sucesso: false, mensagem: erros.join(' '), erros });
  try {
    // Aguarda os índices únicos antes de gravar o primeiro cadastro.
    await Motorista.init();
    const motorista = editar
      ? await Motorista.findOneAndUpdate({ _id: req.params.id, clienteId: req.user.clienteId }, { $set: dados }, { new: true, runValidators: true })
      : await Motorista.create({ ...dados, clienteId: req.user.clienteId });
    if (!motorista) return res.status(404).json({ sucesso: false, mensagem: 'Motorista não encontrado.' });
    return res.status(editar ? 200 : 201).json({ sucesso: true, dados: motorista });
  } catch (err) { return erroBanco(err, res); }
};
exports.criar = salvar(false);
exports.atualizar = salvar(true);
