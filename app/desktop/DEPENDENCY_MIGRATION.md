# Desktop dependency migration baseline

Stable dependency targets for the Tailwind/shadcn/React desktop migration:

- React / React DOM: 19.2.8
- React Router DOM: 7.18.2
- Tailwind CSS / @tailwindcss/vite: 4.3.3
- Electron: 43.4.1
- electron-vite: 5.0.0
- @vitejs/plugin-react: 5.2.0 (Vite 7 compatible line)
- TypeScript: 7.0.2
- Lucide React: 1.34.0
- TanStack React Query: 5.102.3
- Zustand: 5.0.15
- Sonner: 2.0.8

`npm run check:lock` intentionally fails when `package.json` and the root lockfile dependency declarations drift. Regenerate the lockfile with `npm install --package-lock-only` whenever dependency ranges change, then run `npm run check`.
