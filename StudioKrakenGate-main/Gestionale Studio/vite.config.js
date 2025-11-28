import { defineConfig } from 'vite'

export default defineConfig({
  // Configurazione per supportare più pagine HTML
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        login: './login.html',
        calendario: './calendario.html',
        documenti: './documenti.html',
        finanze: './finanze.html',
        admin: './admin.html',
        pulizie: './pulizie.html',
        'attivita-personale': './attivita-personale.html'
      }
    },
    outDir: 'dist'
  },
  // Configurazione per il dev server
  server: {
    port: 3000,
    open: '/login.html'
  }
})
