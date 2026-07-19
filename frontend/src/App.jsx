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
import Login from './paginas/Login.jsx';
import Register from './paginas/Register.jsx';
import Usuarios from './paginas/Usuarios.jsx';
import ProtectedRoute from './componentes/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <NavBar />
        <main style={{ minHeight: 'calc(100vh - 70px)', backgroundColor: '#F8FAFC', padding: '0' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/tms" element={<Tms />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/rastreamento" element={<Rastreamento />} />
              <Route path="/veiculos" element={<Veiculos />} />
              <Route path="/motoristas" element={<Motoristas />} />
              <Route path="/manutencao" element={<Manutencao />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
            <Route
              path="*"
              element={<h2 style={{ padding: '2rem', color: '#1E293B' }}>Página não encontrada</h2>}
            />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
