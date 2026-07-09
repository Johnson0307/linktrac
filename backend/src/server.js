require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./database/connection');
const veiculoRoutes = require('./routes/veiculoRoutes');
const rastreamentoRoutes = require('./routes/rastreamentoRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Conectar com o banco de dados
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/rastreamento', rastreamentoRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ </LINKTRAC> PRIME - Backend rodando na porta ${PORT}`);
});
