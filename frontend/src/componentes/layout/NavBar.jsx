import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './NavBar.css';

export default function NavBar() {
  const localizacao = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">
          <h2>Linktrac Prime</h2>
        </Link>
      </div>

      {user ? (
        <>
          <ul className="navbar-menu">
            {itensMenu.map((item) => (
              <li
                key={item.caminho}
                className={localizacao.pathname === item.caminho ? 'ativo' : ''}
              >
                <Link to={item.caminho}>{item.rotulo}</Link>
              </li>
            ))}
          </ul>
          <div className="navbar-actions">
            <span>Olá, {user.nome}</span>
            <button type="button" onClick={handleLogout} className="navbar-logout">
              Sair
            </button>
          </div>
        </>
      ) : (
        <div className="navbar-login">
          <Link to="/login">Entrar</Link>
          <span style={{ margin: '0 0.75rem', color: '#94A3B8' }}>|</span>
          <Link to="/register">Cadastrar</Link>
        </div>
      )}
    </nav>
  );
}
