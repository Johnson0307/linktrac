# Implantação da Linktrac Prime no VPS

Este diretório reúne os modelos de implantação. O proxy HTTPS do VPS recebe as conexões externas. A interface, a API e o MongoDB ficam sem portas publicadas. Somente a API entra na rede privada do banco.

## Preparar uma instalação nova

1. Com Docker e Docker Compose instalados, prepare `/etc/linktrac-prime` com acesso restrito. Crie `mongo.env` com modo `0600` e preencha `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` e `LINKTRAC_MONGO_PASSWORD`. Use senhas distintas e aleatórias. Guarde a chave aleatória do replica set em `/etc/linktrac-prime/mongo-replica.key`, com leitura exclusiva pelo usuário `mongodb` da imagem `mongo:8.0`.
2. A partir deste diretório, execute `docker compose -f mongo.compose.yaml up -d`. Quando o MongoDB terminar a inicialização, configure o membro primário com o comando abaixo. O usuário da API é criado na primeira inicialização do volume.
3. Crie `/etc/linktrac-prime/api.env` com modo `0600`. Preencha `JWT_SECRET`, `LINKTRAC_CLIENT_ID`, `FRONTEND_URL` (URL HTTPS oficial) e a conexão privada do banco. O formato é `mongodb://linktrac_api:SENHA@mongo:27017/linktrac_operacao?authSource=linktrac_operacao&replicaSet=linktrac-rs`. Use a senha do usuário da aplicação, com caracteres especiais codificados conforme a sintaxe de URI.
4. Execute `docker compose config --quiet` e `docker compose up -d --build`. No proxy HTTPS existente, conecte o proxy à rede `linktrac-prime_default` e configure o domínio para encaminhar a `linktrac-prime-web-1:8080`.

```bash
docker compose -f mongo.compose.yaml exec -T mongo mongosh --nodb --quiet --norc --eval '
  const user = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
  const password = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
  const uri = "mongodb://" + user + ":" + password + "@127.0.0.1:27017/admin?directConnection=true";
  const admin = new Mongo(uri).getDB("admin");
  const result = admin.runCommand({
    replSetInitiate: { _id: "linktrac-rs", members: [{ _id: 0, host: "mongo:27017" }] }
  });
  quit(result.ok === 1 ? 0 : 1);
'
```

Antes de liberar o tráfego, valide a API em `/api/documentacao` e confira login e histórico. Em uma migração, restaure a exportação no destino e valide os dados antes de trocar a conexão. Mantenha backups protegidos fora do VPS e teste a restauração periodicamente. O replica set de um membro dá suporte a transações e concentra a operação em um servidor.

O VPS existente tem configuração e dados próprios. Use os modelos em uma instalação nova ou compare a configuração atual antes de aplicá-los sobre uma instalação em funcionamento. Guarde arquivos de ambiente, chaves e exportações em armazenamento restrito.
