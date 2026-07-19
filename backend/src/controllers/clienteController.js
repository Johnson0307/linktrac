const Cliente = require('../models/Cliente');

exports.minhaEmpresa = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.user.clienteId).lean();
    if (!cliente) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    }

    return res.json({ sucesso: true, dados: cliente });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};
