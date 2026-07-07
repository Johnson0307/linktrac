import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Consultar from './pages/Consultar';
import './styles/global.css';

function App() {
  return (
    <Router>
      <header>
        <h1>LINK PRIME</h1>
        <p>Rastreamento Veicular</p>
        <nav style={{ marginTop: '1rem' }}>
          <Link
            to="/"
            style={{ color: 'white', margin: '0 1rem', textDecoration: 'none', fontWeight: '500' }}
          >
            Início
          </Link>
        </nav>
      </header>

      <div className="container">
        <Routes>
          <Route path="/" element={<Consultar />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
