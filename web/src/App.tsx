import { NavLink, Route, Routes } from 'react-router-dom';
import { Books } from './pages/Books';
import { Dashboard } from './pages/Dashboard';
import { Manage } from './pages/Manage';
import { Today } from './pages/Today';

export function App() {
  return (
    <>
      <nav className="nav">
        <span className="brand">Life Tracker</span>
        <NavLink to="/" end>Today</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/books">Books</NavLink>
        <NavLink to="/manage">Manage</NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/books" element={<Books />} />
          <Route path="/manage" element={<Manage />} />
        </Routes>
      </main>
    </>
  );
}
