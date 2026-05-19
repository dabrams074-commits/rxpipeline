import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig(() => {
  const proxies = {};
  try {
    const redirects = fs.readFileSync('./public/_redirects', 'utf-8').split('\n');
    for (const line of redirects) {
      if (!line || line.startsWith('#')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0].startsWith('/api/')) {
        let route = parts[0];
        let fullTarget = parts[1];
        if (route.endsWith('/*')) route = route.replace('/*', '');
        
        try {
          const targetUrl = new URL(fullTarget.replace(':splat', 'DUMMY'));
          proxies[route] = {
            target: targetUrl.origin,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => {
              if (fullTarget.includes(':splat')) {
                let splat = path.replace(route, '');
                if (splat.startsWith('/')) splat = splat.substring(1);
                return targetUrl.pathname.replace('DUMMY', splat) + targetUrl.search;
              }
              return targetUrl.pathname + targetUrl.search;
            }
          };
        } catch(e) {}
      }
    }
  } catch(e) {}

  return {
    server: {
      proxy: proxies
    }
  };
});
