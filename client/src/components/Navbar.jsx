import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isProject = location.pathname.startsWith('/project/');

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon">T</div>
          <span>Tracko</span>
        </Link>
        {isProject && (
          <Link to="/" className="navbar-back">&larr; Projects</Link>
        )}
      </div>
      <div className="navbar-right">
        <div className="user-badge" style={{ background: user?.avatar_color || '#6366f1' }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <span className="user-name">{user?.name}</span>
        <button onClick={logout} className="btn btn-ghost">Logout</button>
      </div>
    </nav>
  );
}
