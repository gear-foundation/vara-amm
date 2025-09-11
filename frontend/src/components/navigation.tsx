import { useAccount } from '@gear-js/react-hooks';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Wallet } from '@/components/wallet';
import { ROUTES } from '@/consts';

import { ThemeSwitcher } from './theme-switcher';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAccountReady } = useAccount();

  const navLinkClass = 'theme-text font-medium uppercase tracking-wide transition-colors';
  const navLinkActiveClass = 'accent-text font-medium uppercase tracking-wide transition-colors';
  const navLinkClassName = ({ isActive }: { isActive: boolean }) => (isActive ? navLinkActiveClass : navLinkClass);

  return (
    <>
      <nav className="nav-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to={ROUTES.HOME} className="flex items-center space-x-2">
              <div className="text-2xl font-bold uppercase tracking-wider theme-text">
                VARA<span className="accent-text">ΞDEX</span>
              </div>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8 ml-12">
              <NavLink to={ROUTES.TRADE} className={navLinkClassName}>
                TRADE
              </NavLink>
              {/* <NavLink href={ROUTES.EXPLORE} className={navLinkClassName}>
                EXPLORE
              </NavLink> */}
              <NavLink to={ROUTES.POOL} className={navLinkClassName}>
                POOL
              </NavLink>
            </div>

            {/* Search Bar */}
            {/* <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search tokens, pools..." className="input-field pl-10 w-full" />
              </div>
            </div> */}

            {/* Theme Switcher & Wallet Connection */}
            <div className="hidden md:flex items-center space-x-4">
              <ThemeSwitcher />
              {isAccountReady && <Wallet />}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <ThemeSwitcher />
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="theme-text">
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex flex-col space-y-4">
                <NavLink to={ROUTES.TRADE} className={navLinkClassName}>
                  TRADE
                </NavLink>
                {/* <NavLink href={ROUTES.EXPLORE} className={navLinkClassName}>
                  EXPLORE
                </NavLink> */}
                <NavLink to={ROUTES.POOL} className={navLinkClassName}>
                  POOL
                </NavLink>
                {/* // ! TODO: add search input */}
                {/* <Input
                    placeholder="Search tokens, pools..."
                    className="input-field w-full mb-4"
                  /> */}

                <Wallet isFullWidth />
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
