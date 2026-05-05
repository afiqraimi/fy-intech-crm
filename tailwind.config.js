/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crm: {
          dark: '#0f172a',       // slate-900
          darker: '#020617',     // slate-950
          card: '#1e293b',       // slate-800
          border: '#334155',     // slate-700
          accent: '#3b82f6',     // blue-500
          accentHover: '#2563eb', // blue-600
          text: '#f8fafc',       // slate-50
          textMuted: '#94a3b8'   // slate-400
        }
      }
    },
  },
  plugins: [],
}
