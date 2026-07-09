import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

export default function NavBar() {
  const localizacao = useLocation();

  // Lista completa de rotas e nomes exibidos no menu
  const itensMenu = [
    { caminho: '/', rotulo: 'Painel Principal' },
    { caminho: '/rastreamento', rotulo: 'Rastreamento' },
    { caminho: '/veiculos', rotulo: 'Veículos' },
    { caminho: '/motoristas', rotulo: 'Motoristas' },
    { caminho: '/manutencao', rotulo: 'Manutenção' },
    { caminho: '/relatorios', rotulo: 'Relatórios' },
    { caminho: '/tms', rotulo: 'Gestão de Cargas' },
    { caminho: '/configuracoes', rotulo: 'Configurações' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">
          <h2>Linktrac Prime</h2>
        </Link>
      </div>

      <ul className="navbar-menu">
        {itensMenu.map((item) => (
          <li key={item.caminho} className={localizacao.pathname === item.caminho ? 'ativo' : ''}>
            <Link to={item.caminho}>{item.rotulo}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
