import React from "react";

const navItems = [
  { key: "home", label: "Courses" },
  { key: "free", label: "Free Access" },
  { key: "admin", label: "Admin" },
];

const Header = ({ activeView = "home", onNavigate, learningMode = false }) => {
  const navActiveView =
    activeView === "track-agentic-ai" || activeView === "track-aws-ai" ? "home" : activeView;

  const handleNavigate = (view) => {
    if (typeof onNavigate === "function") {
      onNavigate(view);
    }
  };

  return (
    <header className={`site-header ${learningMode ? "site-header-hidden" : ""}`}>
      <div className="site-header__inner">
        <button className="site-brand" type="button" onClick={() => handleNavigate("home")}>
          <span className="site-brand__mark">IP</span>
          <span>
            <strong>Interview Prep Hub</strong>
            <small>Curated AI interview tracks</small>
          </span>
        </button>

        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`site-nav__link ${navActiveView === item.key ? "is-active" : ""}`}
              onClick={() => handleNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="site-header__actions">
          <span className="site-badge">Everything free right now</span>
          <button
            type="button"
            className={`site-header__cta ${navActiveView === "tutor" ? "is-active" : ""}`}
            onClick={() => handleNavigate("tutor")}
          >
            AI Tutor
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
