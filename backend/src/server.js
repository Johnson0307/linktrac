require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./database/connection');
const veiculoRoutes = require('./routes/veiculoRoutes');
const rastreamentoRoutes = require('./routes/rastreamentoRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const clienteRoutes = require('./routes/clienteRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Conectar com o banco de dados
connectDB();

// Middlewares
const corsOptions = {
  // Aceita múltiplas origens em desenvolvimento e também requisições do browser via preflight
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://localhost:8080',
      undefined, // permite requests sem origem (ex: mobile, curl)
    ];

    // origin pode ser undefined em algumas situações (ex: same-origin/curl)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
const lerJson = express.json();
app.use((req, res, next) => {
  if (req.method === 'PATCH' && /^\/api\/tms\/paradas\/[^/]+\/status\/?$/i.test(req.path)) return next();
  return lerJson(req, res, next);
});
app.use(require('./middlewares/auditoriaMiddleware').auditar);
app.use('/api/parceiros/v1', require('./routes/parceiroRoutes'));
app.use('/api', require('./middlewares/acessosMiddleware').controlarAcessos);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/rastreamento', rastreamentoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/espelhamentos', require('./routes/espelhamentoRoutes'));
app.use('/api/historicos', require('./routes/historicosRoutes'));
app.use('/api/painel', require('./routes/painelRoutes'));
app.use('/api/jornada', require('./routes/jornadaRoutes'));
app.use('/api/motoristas', require('./routes/motoristaRoutes'));
app.use('/api/assistente-manutencao', require('./operacao/agenteRotas').router);
app.use('/api/tms', require('./operacao/tms'));
app.use('/api/operacao', require('./operacao/rotas').router);
app.use('/api/integracao', require('./operacao/integracao'));
app.use('/api/relatorios', require('./operacao/relatorios').router);
app.get('/api/documentacao', (req, res) => res.json(require('./operacao/documentacao').openapi));
app.get('/api/recursos', require('./middlewares/authMiddleware').authenticate, (req, res) => res.json({ sucesso: true, dados: require('./operacao/documentacao').disponibilidade }));
require('./operacao/automacoes').iniciarWorker();
require('./operacao/agenteMonitor').iniciarMonitor();
require('./operacao/receptorTraccar').iniciarReceptorTraccar();
require('./services/cadastroFinanceiro').iniciarCobranca();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ </LINKTRAC> PRIME - Backend rodando na porta ${PORT}`);
});
