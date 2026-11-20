import AssistenteManutencao from './paginas/AssistenteManutencao';

import Historicos from './paginas/Historicos.jsx';
import { lazy, Suspense } from 'react';
import CentralOperacao from './paginas/CentralOperacao';
import { CadastroCameras } from './paginas/Equipamentos';
import ManualUso from './componentes/ManualUso';
import Manuais from './paginas/Manuais';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './componentes/layout/NavBar.jsx';
import { FaixaProvider } from './componentes/layout/AcoesDaPagina';
import Dashboard from './paginas/Dashboard.jsx';
import Rastreamento from './paginas/Rastreamento.jsx';
import Veiculos from './paginas/Veiculos.jsx';
import Motoristas from './paginas/Motoristas.jsx';
import Relatorios from './paginas/Relatorios.jsx';
import Configuracoes from './paginas/Configuracoes.jsx';
import CentralMonitoramento from './paginas/CentralMonitoramento.jsx';
import Talhoes from './paginas/Talhoes.jsx';
import IdentidadeVisual from './paginas/IdentidadeVisual';
import Login from './paginas/Login.jsx';
import Register from './paginas/Register.jsx';
import Clientes from './paginas/Clientes.jsx';
import Usuarios from './paginas/Usuarios.jsx';
import Espelhamentos from './paginas/Espelhamentos.jsx';
import ProtectedRoute from './componentes/ProtectedRoute.jsx';
import { MarcaProvider } from './contexts/MarcaContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Jornada = lazy(() => import('./paginas/Jornada'));
const TagsBle = lazy(() => import('./paginas/TagsBle'));
const ResumoSemanal = lazy(() => import('./paginas/ResumoSemanal'));
const Briefings = lazy(() => import('./paginas/Briefings'));
const Tms = lazy(() => import('./paginas/Tms'));
const MinhasRotas = lazy(() => import('./paginas/MinhasRotas'));
const VisaoPlataforma = lazy(() => import('./paginas/VisaoPlataforma'));

function Conteudo({ children }) {
  const { user } = useAuth();
  return <main id="conteudo-principal" tabIndex={-1} className={user ? 'app-content' : 'public-content'}>
    {!user && <ManualUso />}
    {children}
  </main>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <MarcaProvider>
        <FaixaProvider>
        <NavBar />
        <Conteudo>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/tms" element={<Suspense fallback={<p>Carregando roteirização...</p>}><Tms /></Suspense>} />
              <Route path="/minhas-rotas" element={<Suspense fallback={<p>Carregando rotas...</p>}><MinhasRotas /></Suspense>} />
              <Route path="/tms/cargas" element={<CentralOperacao inicial="cargas" />} />
              <Route path="/manutencao-inteligente" element={<AssistenteManutencao />} />
              <Route path="/operacao" element={<CentralOperacao />} />
              <Route path="/monitoramento" element={<CentralMonitoramento />} />
              <Route path="/agro" element={<Talhoes />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mapa" element={<Dashboard somenteMapa />} />
              <Route path="/manuais" element={<Manuais />} />
              <Route path="/visao-plataforma" element={<Suspense fallback={<p role="status">Carregando funções…</p>}><VisaoPlataforma /></Suspense>} />
              <Route path="/rastreamento" element={<Rastreamento />} />
              <Route path="/veiculos" element={<Veiculos />} />
              <Route path="/rastreadores" element={<CentralOperacao inicial="dispositivos" />} />
              <Route path="/jornada" element={<Suspense fallback={<p role="status">Carregando jornada...</p>}><Jornada /></Suspense>} />
              <Route path="/tags-ble" element={<Suspense fallback={<p role="status">Carregando tags...</p>}><TagsBle /></Suspense>} />
              <Route path="/cameras" element={<CadastroCameras />} />
              <Route path="/motoristas" element={<Motoristas />} />
              <Route path="/manutencao" element={<Historicos inicial="manutencoes" />} />
              <Route path="/historicos" element={<Historicos />} />
              <Route path="/resumo-semanal" element={<Suspense fallback={<p>Carregando resumo...</p>}><ResumoSemanal /></Suspense>} />
              <Route path="/briefings" element={<Suspense fallback={<p>Carregando briefings...</p>}><Briefings /></Suspense>} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/marca" element={<IdentidadeVisual />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/espelhamentos" element={<Espelhamentos />} />
            </Route>
            <Route
              path="*"
              element={<h2 style={{ padding: '2rem', color: '#1E293B' }}>Página não encontrada</h2>}
            />
          </Routes>
        </Conteudo>
        </FaixaProvider>
        </MarcaProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
