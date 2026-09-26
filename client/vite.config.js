import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // All backend API calls → Node Server (port 8000)
      '/api': 'http://localhost:8000',

      // WebRTC + Socket.io signaling
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true
      },

      // AI Analyst Flask server
      '/predict': 'http://localhost:5001'
    }
  }
})

