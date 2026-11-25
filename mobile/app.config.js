const fs = require('node:fs');
module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const google = process.env.LINKTRAC_GOOGLE_SERVICES_FILE;
  if (projectId && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(projectId)) throw new Error('Project ID do aplicativo inválido.');
  if (google && !fs.existsSync(google)) throw new Error('Arquivo Android de notificações não encontrado.');
  return { ...config, ...(projectId ? { extra: { ...config.extra, eas: { projectId } } } : {}),
    android: { ...config.android, ...(google ? { googleServicesFile: google } : {}) } };
};
