import { Sun, Moon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useTheme } from './theme-provider';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      className="text-gray-400 hover:text-[#00FF85] hover:bg-transparent transition-colors">
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
