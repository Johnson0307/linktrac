import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/api';
import logoPadrao from '../assets/images/linktrac-logo.jpeg';

const padrao = { nome: 'Linktrac Prime', logo: null, padrao: true, podeEditar: false };
const MarcaContext = createContext({ marca: padrao, logo: logoPadrao, erro: '' });

export function MarcaProvider({ children }) {
  const { user } = useAuth();
  const chave = user ? 'empresa:' + user.clienteId + ':' + user.role : 'publica';
  const [resultado, setResultado] = useState(null);
  const vigente = resultado?.chave === chave ? resultado : null;
  const marca = vigente?.dados || padrao;

  useEffect(() => {
    const controle = new AbortController();
    const endpoint = user ? '/cliente/marca/atual' : '/cliente/marca/publica';
    api.get(endpoint, { signal: controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setResultado({ chave, dados: data.dados });
    }).catch(e => {
      if (!controle.signal.aborted) setResultado({ chave, erro: e.response?.data?.mensagem || 'Não foi possível carregar o portal.' });
    });
    return () => controle.abort();
  }, [chave]);

  useEffect(() => { document.title = marca.nome; }, [marca.nome]);

  const atualizar = dados => setResultado({ chave, dados });
  return <MarcaContext.Provider value={{
    marca, atualizar,
    logo: marca.logo || (marca.padrao ? logoPadrao : null),
    carregando: !vigente, erro: vigente?.erro || '',
  }}>{children}</MarcaContext.Provider>;
}

export const useMarca = () => useContext(MarcaContext);
