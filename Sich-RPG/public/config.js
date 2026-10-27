// GitHub Pages використовує спільний сервер Supabase; локальний Node.js працює без змін.
window.SICH_API_BASE = ['localhost','127.0.0.1'].includes(location.hostname)
  ? ''
  : 'https://zkhhmcsgdnufryyrcqwo.supabase.co/functions/v1/sich-api';
