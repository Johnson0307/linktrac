const password = process.env.LINKTRAC_MONGO_PASSWORD;
if (!password) throw new Error('LINKTRAC_MONGO_PASSWORD precisa ser definido.');

db.getSiblingDB('linktrac_operacao').createUser({
  user: 'linktrac_api',
  pwd: password,
  roles: [{ role: 'readWrite', db: 'linktrac_operacao' }],
});
