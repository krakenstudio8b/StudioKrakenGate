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
        'attivita-personale': './attivita-personale.html',
        obiettivi: './obiettivi.html',
        'load-tasks': './load-tasks.html'
      }
    },
    outDir: 'dist',
    // Minificazione e offuscazione avanzata
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // Rimuove console.log
        drop_debugger: true,     // Rimuove debugger
        passes: 3                // Più passaggi = più compressione
      },
      mangle: {
        toplevel: true,          // Offusca anche variabili globali
        properties: {
          regex: /^_/            // Offusca proprietà che iniziano con _
        }
      },
      format: {
        comments: false          // Rimuove tutti i commenti
      }
    },
    // Disabilita source maps in produzione (rende impossibile debuggare)
    sourcemap: false
  },
  // Configurazione per il dev server
  server: {
    port: 3000,
    open: '/login.html'
  }
})
