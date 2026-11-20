const { withAppBuildGradle } = require('expo/config-plugins');
// O limite de 260 caracteres do Ninja no Windows exige nomes de objeto com hash.
module.exports = config => withAppBuildGradle(config, config => {
  const marker = '// Linktrac: caminhos curtos de objetos CMake';
  if (!config.modResults.contents.includes(marker)) {
    config.modResults.contents += `\n${marker}\nandroid {\n  defaultConfig {\n    externalNativeBuild {\n      cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }\n    }\n  }\n}\n`;
  }
  return config;
});
