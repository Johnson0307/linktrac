import { useState } from 'react';

export default function Configuracoes() {
  const [config, setConfig] = useState({
    alertaBateria: true,
    alertaVelocidade: true,
    alertaFrenagem: true,
    envioWhatsApp: true,
    limiteVelocidade: 80,
    intervaloAtualizacao: 30,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value),
    }));
  };

  const salvar = () => {
    alert('Configurações salvas com sucesso!');
    console.log('Configurações:', config);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Configurações do Sistema</h2>
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Defina limites, alertas e regras de funcionamento.
      </p>

      <div
        style={{
          background: '#FFFFFF',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ color: '#334155', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
          Alertas e Notificações
        </h3>

        <div style={linhaConfig}>
          <label>Alertar quando bateria estiver fraca</label>
          <input
            type="checkbox"
            name="alertaBateria"
            checked={config.alertaBateria}
            onChange={handleChange}
          />
        </div>

        <div style={linhaConfig}>
          <label>Alertar excesso de velocidade</label>
          <input
            type="checkbox"
            name="alertaVelocidade"
            checked={config.alertaVelocidade}
            onChange={handleChange}
          />
        </div>

        <div style={linhaConfig}>
          <label>Alertar frenagens bruscas</label>
          <input
            type="checkbox"
            name="alertaFrenagem"
            checked={config.alertaFrenagem}
            onChange={handleChange}
          />
        </div>

        <div style={linhaConfig}>
          <label>Enviar alertas por WhatsApp</label>
          <input
            type="checkbox"
            name="envioWhatsApp"
            checked={config.envioWhatsApp}
            onChange={handleChange}
          />
        </div>

        <div style={linhaConfig}>
          <label>Limite de velocidade (km/h):</label>
          <input
            type="number"
            name="limiteVelocidade"
            value={config.limiteVelocidade}
            onChange={handleChange}
            style={inputConfig}
          />
        </div>

        <div style={linhaConfig}>
          <label>Atualização de dados a cada (segundos):</label>
          <input
            type="number"
            name="intervaloAtualizacao"
            value={config.intervaloAtualizacao}
            onChange={handleChange}
            style={inputConfig}
          />
        </div>

        <button
          onClick={salvar}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#0099FF',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}

const linhaConfig = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.8rem 0',
  borderBottom: '1px solid #F1F5F9',
};
const inputConfig = {
  width: '80px',
  padding: '0.4rem',
  border: '1px solid #CBD5E1',
  borderRadius: '4px',
};
