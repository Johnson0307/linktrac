import Tms from './paginas/Tms.jsx';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './componentes/layout/NavBar.jsx';
import Dashboard from './paginas/Dashboard.jsx';
import Rastreamento from './paginas/Rastreamento.jsx';
import Veiculos from './paginas/Veiculos.jsx';
import Motoristas from './paginas/Motoristas.jsx';
import Manutencao from './paginas/Manutencao.jsx';
import Relatorios from './paginas/Relatorios.jsx';
import Configuracoes from './paginas/Configuracoes.jsx';

function App() {
  return (
    <Router>
      <NavBar />
      <main style={{ minHeight: 'calc(100vh - 70px)', backgroundColor: '#F8FAFC', padding: '0' }}>
        <Routes>
          <Route path="/tms" element={<Tms />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rastreamento" element={<Rastreamento />} />
          <Route path="/veiculos" element={<Veiculos />} />
          <Route path="/motoristas" element={<Motoristas />} />
          <Route path="/manutencao" element={<Manutencao />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route
            path="/tms"
            element={<h2 style={{ padding: '2rem', color: '#1E293B' }}>Gestão de Cargas</h2>}
          />
          <Route
            path="*"
            element={<h2 style={{ padding: '2rem', color: '#1E293B' }}>Página não encontrada</h2>}
          />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
