import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard/Dashboard';
import Host from './components/Host/Host';
import Container from './components/Container/Container';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/host" element={<Host />} />
        <Route path="/container" element={<Container />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
