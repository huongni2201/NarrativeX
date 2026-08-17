# NarrativeX Frontend Web

## Purpose
The Frontend Web application provides the web client user interface for NarrativeX. It delivers the user experience for story creation, scene visualization, audio/video generation controls, and project management.

## Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **Linting & Formatting**: ESLint
- **Runtime**: Node.js 20+

## Local Prerequisites
- Node.js 20+ (v26+ compatible)
- npm 10+

## Development Commands

### Install Dependencies
```bash
npm install
```

### Run Locally (Dev Server)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

### Lint Code
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

### Build Production Bundle
```bash
npm run build
```

### Run Production Server
```bash
npm start
```

### Build & Run with Docker
```bash
# Build Docker image
docker build -t narrativex-frontend-web .

# Run container
docker run -p 3000:3000 narrativex-frontend-web
```

## Application Boundaries
- **Must Own**: User interface, presentation logic, client state management, client-side validation, rendering responses from `backend-service`.
- **Must NOT Own**: Direct AI provider communication (Gemini, Vertex AI, Veo, Kling), direct database access, background job execution, secret storage.
