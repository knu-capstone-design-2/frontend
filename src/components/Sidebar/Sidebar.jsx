import styles from './Sidebar.module.css';
import { NavLink } from 'react-router-dom';

function Sidebar({ onSettingsClick = () => {} }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>INTERDATA</div>
      <nav>
        <NavLink
          to="/host"
          className={({ isActive }) => isActive ? styles.active : undefined}
        >
          Host Machine
        </NavLink>
        <NavLink
          to="/container"
          className={({ isActive }) => isActive ? styles.active : undefined}
        >
          Container
        </NavLink>
      </nav>
      <div className={styles.footer}>
        <button title="Notifications">🔔</button>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => isActive ? styles.active : undefined}
          title="Home"
        >
          🏠
        </NavLink>
        <button title="Settings" onClick={onSettingsClick}>⚙️</button>
      </div>
    </aside>
  );
}

export default Sidebar;
