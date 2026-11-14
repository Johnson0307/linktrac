const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { pontoValido, passagensValidas, rotaEntrePontos } = require('../operacao/roteirizacao');
const { camadaViaria } = require('../operacao/fiscalizacao');
router.get('/', authenticate, require('../controllers/painelController').consultarPainel);
router.get('/fiscalizacao', authenticate, async (req, res) => {
  const campos = ['oeste', 'sul', 'leste', 'norte', 'zoom'];
  const valores = campos.map(campo => typeof req.query[campo] === 'string' && req.query[campo].trim() ? Number(req.query[campo]) : NaN);
  const [oeste, sul, leste, norte, zoom] = valores;
  if (!valores.every(Number.isFinite) || oeste < -180 || leste > 180 || sul < -90 || norte > 90 ||
      oeste >= leste || sul >= norte || leste - oeste > 4 || norte - sul > 4 || !Number.isInteger(zoom) || zoom < 12 || zoom > 22) {
    return res.status(400).json({ sucesso: false, mensagem: 'Amplie o mapa para consultar a fiscalização viária.' });
  }
  try {
    const dados = await camadaViaria({ oeste, sul, leste, norte }, zoom);
    res.set('Cache-Control', 'private, max-age=120');
    return res.json({ sucesso: true, dados });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'A base viária está indisponível.' });
  }
});
router.post('/rota', authenticate, async (req, res) => {
  const { origem, destino, passagens = [] } = req.body || {};
  if (!pontoValido(origem) || !pontoValido(destino) || !passagensValidas(passagens)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Informe uma partida, um destino e até três pontos de passagem válidos.' });
  }
  try {
    const dados = await rotaEntrePontos(origem, destino, passagens);
    return res.json({ sucesso: true, dados });
  } catch (erro) {
    if (erro.codigoRota === 'NoSegment') {
      const ponto = erro.indice === 0 ? 'origem' : erro.indice === passagens.length + 1 ? 'destino'
        : erro.indice == null ? undefined : 'passagem';
      const nome = { origem: 'A partida A', destino: 'O destino B', passagem: 'Um ponto de passagem' }[ponto] || 'Um dos pontos';
      return res.status(422).json({ sucesso: false, ponto,
        mensagem: `${nome} está longe de uma via mapeada. Clique mais perto de uma rua ou arraste o marcador para corrigir.` });
    }
    if (erro.codigoRota === 'NoRoute') {
      return res.status(422).json({ sucesso: false, mensagem: 'Não há uma rota por ruas ligando esses pontos. Mova um marcador ou remova a última passagem.' });
    }
    return res.status(502).json({ sucesso: false, mensagem: 'O roteador viário está indisponível. Tente novamente em instantes.' });
  }
});
module.exports = router;
