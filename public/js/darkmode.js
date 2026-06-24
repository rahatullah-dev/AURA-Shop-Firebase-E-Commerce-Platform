/* darkmode.js - toggles dark mode on/off and stores preference */
(function(){
  const storageKey = 'theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(storageKey);
  const theme = saved || (prefersDark ? 'dark' : 'light');
  if(theme === 'dark') document.documentElement.classList.add('dark');
  // expose toggle
  window.toggleTheme = function(){
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
  };
})();
