import { Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { useTheme } from './theme';

/** One button for both pages: shows the theme you would switch to. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <IconButton
      label={`Switch to ${next} mode`}
      icon={next === 'dark' ? <Moon /> : <Sun />}
      variant="ghost"
      onClick={toggle}
      aria-pressed={theme === 'dark'}
    />
  );
}
