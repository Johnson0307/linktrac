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
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(express.json());

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/veiculos', veiculoRoutes);
app.use('/api/rastreamento', rastreamentoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/cliente', clienteRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ </LINKTRAC> PRIME - Backend rodando na porta ${PORT}`);
});
