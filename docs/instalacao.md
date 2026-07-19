# Como instalar e executar o LINKTRAC PRIME

## Pré-requisitos

- Node.js instalado
- Conta no MongoDB Atlas

## Passo a Passo

1. Clone o repositório.
2. Configure os arquivos de ambiente:
   - Copie `backend/.env.example` para `backend/.env` e ajuste `MONGO_URI`, `FRONTEND_URL`, `JWT_SECRET` e, se desejar, `REGISTER_SECRET` e `DEVICE_API_TOKEN`.
   - Copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_URL`, `VITE_GOOGLE_MAPS_KEY` e `VITE_OPENROUTE_KEY`, se necessário.
3. No terminal execute:

### Backend

```bash
cd backend
npm install
npm run dev
```

Para verificar a qualidade do código e executar testes:

```bash
npm run lint
npm run test
```

### Frontend

```bash
cd frontend
npm install
# Copie .env.example para .env e ajuste as variáveis, se necessário
npm run dev
```

Para verificar a qualidade do código e executar testes:

```bash
npm run lint
npm run test
```

Por padrão, o backend roda em `http://localhost:5000` e a interface em `http://localhost:5173`.

### Opcional: Docker

Se preferir rodar via Docker, use o `docker-compose.yml` do projeto:

```bash
docker compose up --build
```
