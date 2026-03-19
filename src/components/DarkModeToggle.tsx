import { useEffect, useState } from 'react';

const DarkModeToggle = ({ collapsed = false }: { collapsed?: boolean }) => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span>{dark ? '☀️' : '🌙'}</span>
      {!collapsed && <span>{dark ? 'Light' : 'Dark'}</span>}
    </button>
  );
};

export default DarkModeToggle;
