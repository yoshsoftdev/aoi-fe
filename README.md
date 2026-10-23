# AOI Frontend

Frontend untuk Sistem Pengambilan Data Multi-Sumber menggunakan React + TypeScript + Vite.

## Fitur

- ✅ Real-time dashboard dengan WebSocket
- ✅ Parameter management
- ✅ Modbus RTU/TCP configuration
- ✅ SNMP configuration
- ✅ Modern UI dengan Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
VITE_API_URL=http
VITE_WS_URL=ws
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS
- Recharts
- React Hook Form
- Zod

## Structure

```
src/
├── components/     # Reusable components
├── pages/          # Page components
├── hooks/          # Custom hooks
├── services/       # API services
├── types/          # TypeScript types
└── App.tsx         # Root component
```

