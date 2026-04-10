import React from 'react';

const Header = ({ status }) => {
  return (
    <header className="app-header">
      <div className="logo-section">
        <div className="logo">REASONABLE<span>R</span></div>
        <div className="status-badge">{status || 'System Ready'}</div>
      </div>
    </header>
  );
};

export default Header;