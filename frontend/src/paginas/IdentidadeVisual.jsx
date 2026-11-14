import { useEffect, useState } from 'react';
import { useMarca } from '../contexts/MarcaContext';
import api from '../api/api';
import './CentralOperacao.css';

async function prepararImagem(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('Selecione uma imagem PNG, JPG ou WebP de até 8 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 20000000) {
      throw new Error('Use uma imagem de dimensões menores.');
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (const lado of [480, 360, 240]) {
      const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight, 1);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const qualidade of [0.9, 0.76, 0.6]) {
        const logo = canvas.toDataURL('image/webp', qualidade);
        if (logo.length <= 65558) return logo;
      }
    }
    throw new Error('O logo ficou muito grande. Tente um arquivo mais simples.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function IdentidadeVisual() {
  const { marca, atualizar, carregando, erro: falhaMarca } = useMarca();
  const [nome, setNome] = useState('');
  const [logo, setLogo] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setNome(marca.nome);
    setLogo(marca.logo);
  }, [marca.nome, marca.logo]);

  async function trocarLogo(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      setLogo(await prepararImagem(arquivo));
    } catch (err) {
      setErro(err.message || 'Não foi possível abrir a imagem.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setOcupado(true);
    try {
      const { data } = await api.put('/cliente/marca/atual', { nome, logo });
      atualizar(data.dados);
      setMensagem('Identidade visual salva.');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível salvar a identidade visual.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) return <p>Carregando identidade visual...</p>;
  if (falhaMarca) return <p role="alert">{falhaMarca}</p>;
  if (!marca.podeEditar) return <p>Esta configuração é reservada à administração do portal.</p>;

  return <div className="central-page">
    <p>{marca.central ? 'Este nome e logo aparecem no login principal e nos painéis sem marca própria.'
      : 'Este nome e logo aparecem no painel da sua empresa após o login.'}</p>
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    <form className="central-card" onSubmit={salvar}>
      <fieldset className="central-form" disabled={ocupado}>
        <label>Nome exibido no portal
          <input required maxLength={80} value={nome} onChange={e => setNome(e.target.value)} />
        </label>
        <label>Logo da empresa
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={trocarLogo} />
          <small>PNG, JPG ou WebP.</small>
        </label>
        <div className="central-full">
          {logo && <div><img src={logo} alt="Prévia do logo" style={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain' }} /></div>}
          <p>{nome || 'Nome do portal'}</p>
          {logo && <button type="button" onClick={() => setLogo(null)}>Remover logo</button>}{' '}
          <button type="submit">{ocupado ? 'Processando...' : 'Salvar identidade visual'}</button>
        </div>
      </fieldset>
    </form>
    {marca.central && <EmpresasComMarca />}
  </div>;
}

function EmpresasComMarca() {
  const [empresas, setEmpresas] = useState([]);
  const [id, setId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const empresa = empresas.find(e => e._id === id);
  useEffect(() => {
    let ativo = true;
    api.get('/cliente/marca/empresas').then(({ data }) => { if (ativo) setEmpresas(data.dados); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar as empresas.'); });
    return () => { ativo = false; };
  }, []);

  async function alterar(habilitada) {
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      const { data } = await api.put('/cliente/marca/empresas/' + id, { habilitada });
      setEmpresas(atuais => atuais.map(e => e._id === id ? data.dados : e));
      setMensagem(habilitada ? 'O administrador desta empresa já pode personalizar sua marca.' : 'A empresa voltou a exibir a marca principal.');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível atualizar a personalização.');
    } finally {
      setOcupado(false);
    }
  }

  return <section className="central-card">
    <h3>Empresas com marca própria</h3>
    <p>Libere a personalização para a empresa que administra seus assinantes. O acesso aos dados continua seguindo as permissões da conta.</p>
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    <label>Empresa
      <select value={id} disabled={ocupado} onChange={e => { setId(e.target.value); setMensagem(''); }}>
        <option value="">Selecione</option>
        {empresas.map(e => <option key={e._id} value={e._id}>{e.nome}{e.habilitada ? ' — marca própria' : ''}</option>)}
      </select>
    </label>
    {empresa && <button type="button" disabled={ocupado} onClick={() => alterar(!empresa.habilitada)}>
      {empresa.habilitada ? 'Usar a marca principal' : 'Liberar marca própria'}
    </button>}
  </section>;
}
