import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import MandateForm from './pages/MandateForm';
import AuditViewer from './pages/AuditViewer';
import AgentDemo from './pages/AgentDemo';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      {/* Dynamic Canvas Grid Background */}
      <div id="grid-container" />

      {/* Navigation Bar */}
      <nav className="navbar" id="navbar">
        <div className="logo">
          <div className="logo-shield">⚡</div>
          <span>Agentic</span>
        </div>
        <div className="nav-links">
          <NavLink to="/agent" className={({ isActive }) => (isActive ? 'nav-ws-badge' : '')}>
            🤖 Demo
          </NavLink>
          <NavLink to="/mandates" className={({ isActive }) => (isActive ? 'nav-ws-badge' : '')}>
            🔏 Mandates
          </NavLink>
          <NavLink to="/audit" className={({ isActive }) => (isActive ? 'nav-ws-badge' : '')}>
            📋 Audit Log
          </NavLink>
          <a href="http://localhost:3000/health" target="_blank" rel="noopener noreferrer">
            💚 Health
          </a>
        </div>
        <div className="badge badge-pill badge-saffron" style={{ padding: '0.2rem 1rem', fontSize: '0.75rem' }}>
          <strong>TEST MODE</strong> (No Real Money)
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/agent" replace />} />
          <Route path="/agent" element={<AgentDemo />} />
          <Route path="/mandates" element={<MandateForm />} />
          <Route path="/audit" element={<AuditViewer />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
