const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('📦 Banco conectado com sucesso!');
  } catch (erro) {
    console.error('❌ Não foi possível conectar:');
    console.error(erro.message);
    process.exit(1);
  }
};

module.exports = connectDB;
