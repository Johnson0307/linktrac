import { useEffect, useRef, useState } from 'react';
import { dadosIconeMapa, lugaresMapa, veiculosMapa } from '../ajuda/iconesMapaFront';
import './SeletorIconeMapa.css';

async function prepararImagem(arquivo) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
    throw new Error('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.');
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const canvas = document.createElement('canvas');
    const proporcao = 96 / Math.max(imagem.naturalWidth, imagem.naturalHeight);
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * proporcao));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * proporcao));
    canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const dados = canvas.toDataURL('image/webp', 0.8);
    if (dados.length > Math.ceil(16 * 1024 / 3) * 4 + 22) {
      throw new Error('Escolha um ícone com menos detalhes para caber no mapa.');
    }
    return { tipo: 'personalizado', imagem: dados };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PreviaIconeMapa({ icone, padrao }) {
  const dados = dadosIconeMapa(icone, padrao);
  return dados.imagem ? <img className="icone-mapa" src={dados.imagem} alt={dados.nome} />
    : <span className="icone-mapa" role="img" aria-label={dados.nome}>{dados.simbolo}</span>;
}

export default function SeletorIconeMapa({ valor, alterar, grupo = 'veiculo', bloquear }) {
  const lugar = grupo === 'lugar';
  const catalogo = lugar ? lugaresMapa : veiculosMapa;
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const leitura = useRef(0);
  useEffect(() => () => { leitura.current++; }, []);
  const consulta = lugar ? 'ícone de lugar PNG transparente' : 'ícone de veículo ou máquina PNG transparente';

  async function carregar(e) {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    const atual = ++leitura.current;
    setLendo(true);
    bloquear?.(true);
    setErro('');
    try {
      const icone = await prepararImagem(arquivo);
      if (atual === leitura.current) alterar(icone);
    } catch (e) {
      if (atual === leitura.current) setErro(e.message || 'Não foi possível abrir a imagem.');
    } finally {
      if (atual === leitura.current) { setLendo(false); bloquear?.(false); }
    }
  }

  return <div className="seletor-icone-mapa">
    <div className="seletor-icone-previa"><PreviaIconeMapa icone={valor} padrao={lugar ? 'referencia' : 'caminhao'} /></div>
    <div>
      <label>Ícone {lugar ? 'do local' : 'do veículo'} no mapa
        <select value={valor?.tipo || ''} disabled={lendo} onChange={e => {
          setErro('');
          alterar(e.target.value ? { tipo: e.target.value } : null);
        }}>
          {!lugar && <option value="">Ícone padrão</option>}
          {Object.entries(catalogo).map(([tipo, [simbolo, nome]]) =>
            <option value={tipo} key={tipo}>{simbolo} {nome}</option>)}
          {valor?.tipo === 'personalizado' && <option value="personalizado" disabled>Imagem personalizada</option>}
        </select>
      </label>
      <div className="seletor-icone-acoes">
        <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(consulta)}`} target="_blank" rel="noopener noreferrer">Buscar ícone na internet</a>
        <label className="seletor-icone-upload">
          Adicionar imagem
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={lendo} onChange={carregar} />
        </label>
      </div>
      {lendo && <p role="status">Preparando a imagem…</p>}
      {erro && <p role="alert">{erro}</p>}
    </div>
  </div>;
}
