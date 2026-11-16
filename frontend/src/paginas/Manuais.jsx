import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ConteudoManual } from '../componentes/ManualUso';
import { manuais } from '../ajuda/manuais';
import { permite } from '../ajuda/acessos';

export default function Manuais() {
  const { user } = useAuth();
  const [secao, setSecao] = useState('painel');
  const gestao = ['admin', 'gestor'].includes(user?.role);
  const topicos = Object.entries(manuais).filter(([id]) => {
    if (id === 'revendedoras') return user?.podeGerenciarEspelhamentos || user?.podeGerenciarCarteira;
    if (id === 'clientes' && user?.podeGerenciarCarteira) return true;
    if (id === 'briefings' || id === 'espelhamentos') return user?.podeGerenciarEspelhamentos;
    if (id === 'whatsapp' || id === 'arquivoHistorico') return user?.podeGerenciarEspelhamentos;
    if (id === 'cobranca') return user?.role === 'admin' && (user.podeGerenciarEspelhamentos || user.podeGerenciarCarteira);
    if (id === 'agro') return gestao && permite(user, 'operacao');
    if (id === 'monitoramento') return (gestao || user?.role === 'operador') && permite(user, 'operacao');
    if (id === 'clientes' || id === 'integracoesCliente') {
      return user?.role === 'admin' && user.podeGerenciarEspelhamentos && permite(user, 'empresa', true);
    }
    if (id === 'equipamentos' || id === 'chips') return gestao && permite(user, 'equipamentos');
    if (id === 'videotelemetria') return gestao && permite(user, 'video');
    if (id === 'multas') return gestao && permite(user, 'operacao');
    if (id === 'fiscalizacao') return permite(user, 'rastreamento');
    if (id === 'rotasMapa') {
      return permite(user, 'rastreamento') || ((gestao || user?.role === 'motorista') && permite(user, 'entregas'));
    }
    if (['resumoSemanal', 'operacao', 'usuarios', 'relatorios', 'historicos.acoes', 'manutencaoInteligente'].includes(id)) return gestao;
    if (id === 'tms') return gestao || user?.role === 'motorista';
    return true;
  });
  const selecionado = topicos.some(([id]) => id === secao) ? secao : 'painel';

  return <section className="manuais-pagina">
    <AcoesDaPagina>
    <Link to="/visao-plataforma">Visão geral da plataforma</Link>
    <select aria-label="Área do manual" value={selecionado} onChange={e => setSecao(e.target.value)}>
      {topicos.map(([id, manual]) => <option value={id} key={id}>{manual.titulo}</option>)}
    </select>
    </AcoesDaPagina>
    <ConteudoManual secao={selecionado} usuario={user} />
  </section>;
}
