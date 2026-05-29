import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'JAONAICHAN_'],
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router'],
          'vendor-charts':   ['apexcharts', 'react-apexcharts'],
          'vendor-calendar': [
            '@fullcalendar/core',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
            '@fullcalendar/react',
          ],
          'vendor-maps':     ['@react-jvectormap/core', '@react-jvectormap/world'],
          'vendor-pdf':      ['jspdf', 'html2canvas-pro'],
          'vendor-motion':   ['motion'],
          'vendor-dnd':      ['react-dnd', 'react-dnd-html5-backend', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
