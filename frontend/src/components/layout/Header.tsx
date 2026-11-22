import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { Badge } from '../ui/Badge';
import { Menu, X, Globe, UserCheck } from 'lucide-react';

export const Header: React.FC = () => {
  const { t, language, toggleLanguage } = useLanguage();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-velora-ivory/95 backdrop-blur-md border-b border-velora-ivory-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Brand Logo & Wordmark */}
          <Link to="/" className="flex items-center space-x-3 group focus:outline-none">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-velora-green flex items-center justify-center text-velora-ivory font-serif font-bold text-lg md:text-xl shadow-sm transition-transform group-hover:scale-105">
              V
            </div>
            <div>
              <span className="font-serif font-bold text-xl md:text-2xl text-velora-green tracking-tight">
                {t('brand.name')}
              </span>
              <p className="hidden sm:block text-[10px] uppercase tracking-widest text-velora-copper font-medium">
                {t('salon.open')}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-velora-green text-velora-ivory'
                  : 'text-velora-green/80 hover:bg-velora-ivory-200'
              }`}
            >
              {t('nav.home')}
            </Link>
            <Link
              to="/join"
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive('/join')
                  ? 'bg-velora-green text-velora-ivory'
                  : 'text-velora-green/80 hover:bg-velora-ivory-200'
              }`}
            >
              {t('nav.join')}
            </Link>

            {/* Staff Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setStaffMenuOpen(!staffMenuOpen)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-colors ${
                  staffMenuOpen
                    ? 'bg-velora-ivory-200 text-velora-green'
                    : 'text-velora-green/60 hover:text-velora-green hover:bg-velora-ivory-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t('nav.staff')}</span>
              </button>

              {staffMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setStaffMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-velora-ivory-300 shadow-lg py-2 z-20 animate-in fade-in-50 zoom-in-95">
                    <div className="px-3 py-1.5 border-b border-velora-ivory-200 text-[10px] uppercase font-bold tracking-wider text-velora-green/50">
                      Staff Portals
                    </div>
                    <Link
                      to="/reception"
                      onClick={() => setStaffMenuOpen(false)}
                      className="block px-3.5 py-2 text-xs font-medium text-velora-green hover:bg-velora-ivory-100"
                    >
                      {t('nav.reception')}
                    </Link>
                    <Link
                      to="/barber"
                      onClick={() => setStaffMenuOpen(false)}
                      className="block px-3.5 py-2 text-xs font-medium text-velora-green hover:bg-velora-ivory-100"
                    >
                      {t('nav.barber')}
                    </Link>
                    <Link
                      to="/display"
                      onClick={() => setStaffMenuOpen(false)}
                      className="block px-3.5 py-2 text-xs font-medium text-velora-green hover:bg-velora-ivory-100"
                    >
                      {t('nav.display')}
                    </Link>
                    <Link
                      to="/admin"
                      onClick={() => setStaffMenuOpen(false)}
                      className="block px-3.5 py-2 text-xs font-medium text-velora-green hover:bg-velora-ivory-100"
                    >
                      {t('nav.admin')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Right Header Badges & Language Switcher */}
          <div className="flex items-center space-x-2 md:space-x-3">
            <Badge status="open" size="sm" pulse className="hidden sm:inline-flex" />

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-velora-ivory-300 bg-white hover:bg-velora-ivory-100 text-velora-green text-xs font-semibold flex items-center space-x-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-velora-copper/30"
              aria-label={`Switch language to ${language === 'en' ? 'Gujarati' : 'English'}`}
            >
              <Globe className="w-4 h-4 text-velora-copper" />
              <span>{t('nav.langToggle')}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden min-h-[44px] min-w-[44px] p-2 rounded-xl border border-velora-ivory-300 bg-white text-velora-green flex items-center justify-center hover:bg-velora-ivory-100 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-velora-ivory-200 py-3 space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${
                isActive('/') ? 'bg-velora-green text-velora-ivory' : 'text-velora-green hover:bg-velora-ivory-200'
              }`}
            >
              {t('nav.home')}
            </Link>
            <Link
              to="/join"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${
                isActive('/join') ? 'bg-velora-green text-velora-ivory' : 'text-velora-green hover:bg-velora-ivory-200'
              }`}
            >
              {t('nav.join')}
            </Link>
            <div className="pt-2 border-t border-velora-ivory-200">
              <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-velora-copper">
                Staff & Displays
              </p>
              <Link
                to="/reception"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-velora-green/80 hover:bg-velora-ivory-200 rounded-xl"
              >
                {t('nav.reception')}
              </Link>
              <Link
                to="/barber"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-velora-green/80 hover:bg-velora-ivory-200 rounded-xl"
              >
                {t('nav.barber')}
              </Link>
              <Link
                to="/display"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-velora-green/80 hover:bg-velora-ivory-200 rounded-xl"
              >
                {t('nav.display')}
              </Link>
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-sm text-velora-green/80 hover:bg-velora-ivory-200 rounded-xl"
              >
                {t('nav.admin')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
