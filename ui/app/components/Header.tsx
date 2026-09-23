import React from 'react';
import { NavLink } from 'react-router-dom';
import { SegmentSelector } from '@dynatrace/strato-components/filters';
import { useTranslation } from '../i18n/LanguageProvider';
import { LanguageSelector } from './LanguageSelector';

export const Header = () => {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <nav className="app-header-nav" aria-label="Main navigation">
        <NavLink className="app-header-brand" to="/" aria-label="Home">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.832 4.832" className="app-brand-icon" aria-hidden="true">
            <path d="M 0.65705326,0.02467407 A 0.64200155,0.64200155 0 0 0 0.01944938,0.66667561 V 4.817699 H 4.1748706 A 0.64288101,0.64288101 0 0 0 4.8168717,4.1756978 V 0.02467407 Z M 3.6955675,3.4853261 1.1407535,3.9470395 V 1.370239 l 2.554814,-0.46171356 z" fill="#ffffff" />
          </svg>
          <span className="app-brand-title">SRE in a nutshell</span>
          <span className="app-brand-beta">BETA</span>
        </NavLink>
        {/* today and week links hidden — routes still active */}
        <NavLink className={({ isActive }) => `app-header-link ${isActive ? 'active' : ''}`} to="/analysis">
          {t('nav.analysis')}
        </NavLink>
      </nav>
      <div className="app-header-actions">
        <div className="app-header-controls">
          <SegmentSelector />
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
};
