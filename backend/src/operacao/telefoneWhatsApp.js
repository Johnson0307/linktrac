function telefoneWhatsApp(telefone) {
  if (typeof telefone !== 'string' || !/^\+?[\d(). -]{10,24}$/.test(telefone.trim())) return null;
  const digitos = telefone.replace(/\D/g, '');
  const numero = digitos.length === 11 ? '55' + digitos : digitos;
  return /^55[1-9]\d9\d{8}$/.test(numero) ? numero : null;
}

module.exports = { telefoneWhatsApp };
