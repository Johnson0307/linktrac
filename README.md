# LINKTRAC PRIME

## Rastreamento Veicular

Sistema completo para cadastro, monitoramento e consulta de localização de veículos em tempo real.

### 🛠️ Tecnologias

- **Backend:** Node.js, Express, MongoDB, Mongoose
- **Frontend:** React, Vite, Axios, React Router DOM
- **Banco de Dados:** MongoDB Atlas
- **Estilo:** Identidade visual LINKTRAC PRIME

### 🚀 Como executar

#### Backend

```bash
cd backend
npm install
npm run dev
```

Para verificar a qualidade do código e os testes:

```bash
npm run lint
npm run test
```

#### Frontend

```bash
cd frontend
npm install
# Copie .env.example para .env e ajuste as variáveis de ambiente
npm run dev
```

Para verificar a qualidade do código e os testes:

```bash
npm run lint
npm run test
```

A API fica acessível em `http://localhost:5000/api` e o frontend em `http://localhost:5173`.

### 🔐 Variáveis de ambiente importantes

- `JWT_SECRET` — chave secreta para assinar tokens de autenticação.
- `REGISTER_SECRET` — código opcional para proteger a criação inicial de clientes/usuários.
- `DEVICE_API_TOKEN` — token opcional para autenticar dispositivos que enviam telemetria em `POST /api/rastreamento`.

### 📌 Endpoints principais

- `POST /api/veiculos` — cadastrar veículo
- `GET /api/veiculos` — listar veículos
- `GET /api/veiculos/:placa` — buscar veículo por placa
- `POST /api/rastreamento` — atualizar posição do veículo
- `GET /api/rastreamento/:placa` — consultar última posição do veículo

### 🎨 Paleta de Cores

- Azul Principal: `#0066CC`
- Azul Escuro: `#003366`
- Azul Claro: `#0099FF`
- Cinza Claro: `#E5E9F2`
- Branco: `#FFFFFF`
