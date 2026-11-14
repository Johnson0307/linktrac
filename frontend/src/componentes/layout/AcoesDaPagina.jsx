import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

const FaixaContext = createContext(null);

export function FaixaProvider({ children }) {
  const [destino, setDestino] = useState(null);
  return <FaixaContext.Provider value={{ destino, setDestino }}>{children}</FaixaContext.Provider>;
}

export function EspacoAcoes() {
  const faixa = useContext(FaixaContext);
  return <div className="topbar-acoes" ref={faixa?.setDestino} />;
}

export default function AcoesDaPagina({ children }) {
  const faixa = useContext(FaixaContext);
  if (!faixa) return <>{children}</>;
  if (!faixa.destino) return null;
  return createPortal(<div className="topbar-controles" role="group" aria-label="Ações da página">
    {children}
  </div>, faixa.destino);
}
