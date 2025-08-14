# Slideo Frontend

A modern Next.js 15 frontend for the AI-powered presentation generator with real-time WebSocket communication and Supabase authentication.

## Architecture Overview

This frontend is built with **Next.js 15 App Router**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components. It communicates with a Python FastAPI backend via WebSocket for real-time slide generation workflows.

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS + shadcn/ui (New York variant)
- **Authentication**: Supabase Auth with Google OAuth
- **Real-time Communication**: Native WebSocket API
- **State Management**: React hooks + WebSocket provider
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Build**: Turbopack (dev) / Webpack (production)

## Project Structure

```
app/                    # Next.js App Router pages
├── api/               # API routes (server-side)
├── auth/              # Authentication pages
├── build/             # Multi-step slide builder
├── presentations/     # User presentations
├── templates/         # Template gallery
├── waitlist/          # Waitlist page
└── ...

components/            # React components
├── ui/               # shadcn/ui base components
├── builder/          # Slide builder step components
├── auth/             # Authentication forms
└── ...

lib/                   # Utility libraries
├── supabase/         # Supabase client configuration
├── utils.ts          # Utility functions
└── ...

services/              # External service integrations
├── websocket-service.ts  # WebSocket communication
└── backend-service.ts    # HTTP API calls

hooks/                 # Custom React hooks
├── use-websocket.ts      # WebSocket hook
└── ...

types/                 # TypeScript type definitions
```

## Key Features & Implementation

### 1. Multi-Step Slide Builder (`/app/build`)

A 6-step workflow for creating presentations:

1. **Upload**: File upload with drag-and-drop support
2. **Theme**: Template and color palette selection
3. **Research**: Optional web research integration  
4. **Content**: AI-generated content planning with WYSIWYG editing
5. **Preview**: Real-time slide preview with Fabric.js canvas
6. **Download**: Export to PowerPoint or HTML

Each step is implemented as a separate component in `/components/builder/`.

### 2. Real-time WebSocket Communication

**WebSocket Service** (`/services/websocket-service.ts`):
```typescript
class WebSocketService {
  // Singleton pattern for global WebSocket management
  connect(clientId: string, callbacks: WebSocketCallbacks)
  sendMessage(message: any)
  disconnect()
  // Auto-reconnection with exponential backoff
  // Message queuing during disconnection
  // Heartbeat system for connection health
}
```

**React Hook** (`/hooks/use-websocket.ts`):
```typescript
const { sendFileUpload, isConnected, progress } = useWebSocket({
  clientId: 'user123',
  onMessage: (message) => {
    // Handle progress_update, slide_generation_complete, etc.
  }
})
```

### 3. Authentication System (Supabase)

**Configuration**:
- **Client**: Browser-based Supabase client (`/lib/supabase/client.ts`)
- **Server**: Server-side client for API routes (`/lib/supabase/server.ts`)
- **Middleware**: Session validation and route protection (`/lib/supabase/middleware.ts`)

**Authentication Flow**:
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth (configured in Supabase)
3. Google redirects to Supabase callback
4. Supabase redirects to `/auth/callback/route.ts`
5. Session established and user redirected to app

**Protected Routes**: Automatically handled by `/middleware.ts`

### 4. Component System (shadcn/ui)

**Base Configuration**:
```json
{
  "style": "new-york",
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true
  }
}
```

**Custom Components**:
- **Glass Effect**: `variant="glass"` for modern UI
- **Engineering Theme**: Custom button variants
- **Responsive Navigation**: Mobile-first navigation system
- **Theme Toggle**: Light/dark mode support

### 5. Build System & Development

**Development Commands**:
```bash
npm run dev          # Turbopack development server (recommended)
npm run dev:webpack  # Webpack development (for debugging)
npm run build        # Production build
npm run lint         # ESLint with Next.js rules
```

**Build Configuration** (`next.config.ts`):
- **Turbopack**: Fast development builds
- **Webpack Fallbacks**: Node.js module polyfills for browser builds
- **Error Handling**: Ignores build errors for rapid prototyping
- **Image Optimization**: WebP/AVIF support with caching

## API Integration

### HTTP API Routes (`/app/api/`)

Server-side API routes for various operations:
- `/api/generate-slide` - AI slide generation
- `/api/color-palette/generate` - Color palette generation
- `/api/examples/list` - Template listings
- `/api/parse-documents` - Document text extraction
- `/api/auth/*` - Authentication handling

### WebSocket Messages

**Outbound Messages** (Frontend → Backend):
```typescript
// File upload
{ type: 'file_upload', data: FileUploadMessage }

// Theme selection  
{ type: 'theme_selection', data: ThemeMessage }

// Content planning
{ type: 'content_planning', data: ContentPlanningMessage }

// Slide generation
{ type: 'slide_generation', data: SlideGenerationMessage }
```

**Inbound Messages** (Backend → Frontend):
```typescript
// Progress updates
{ type: 'progress_update', data: ProgressUpdateMessage }

// Slide generation complete
{ type: 'slide_generation_complete', data: { slideHtml, slideName } }

// Content plan response
{ type: 'content_plan_response', data: ContentPlanResponseMessage }
```

## Environment Configuration

### Required Environment Variables (`.env.local`)

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend URLs (Required for development)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8000

# AI Services (Required for AI features)
OPENAI_API_KEY=your_openai_api_key

# Optional Services
TAVILY_API_KEY=your_tavily_api_key  # For web research
```

### Supabase Setup

1. **Create Supabase Project**: Get project URL and anon key
2. **Configure Google OAuth**:
   - Add Google OAuth provider in Supabase Auth settings
   - Set redirect URLs: `https://your-project.supabase.co/auth/v1/callback`
   - Configure authorized JavaScript origins in Google Console
3. **Database Tables**: Run migrations from `/supabase/migrations/`

## Development Workflow

### Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### Development Tools

**ESLint Configuration**:
- Next.js recommended rules
- TypeScript strict checking
- Modern JavaScript features

**Tailwind CSS**:
- JIT compilation for fast builds
- Custom color system with CSS variables
- Responsive design utilities
- Dark mode support

### Testing

```bash
npm run test           # Unit tests (to be implemented)
npm run test:e2e       # End-to-end tests (to be implemented)
```

## File Upload & Processing

### Supported File Types
- **PDF**: Server-side text extraction via backend
- **DOCX**: Server-side extraction using python-docx
- **TXT/MD**: Direct text processing
- **Images**: Base64 encoding for preview

### Upload Flow
1. **Frontend**: File selected via drag-and-drop or file picker
2. **Validation**: File type and size validation (50MB limit)
3. **Encoding**: Base64 encoding for WebSocket transmission
4. **Backend Processing**: Text extraction and knowledge graph generation
5. **Progress Updates**: Real-time progress via WebSocket

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Vercel Deployment

1. **Connect Repository**: Link GitHub repository to Vercel
2. **Environment Variables**: Configure all required environment variables
3. **Build Settings**: 
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Node.js Version: 18.x or higher

### Environment-Specific Configuration

**Development**: Uses Turbopack for fast builds
**Production**: Uses Webpack with optimizations and polyfills

## Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Dynamic imports for route-level splitting
- **Image Optimization**: Next.js Image component with responsive sizing
- **Bundle Analysis**: Webpack bundle analyzer for size optimization
- **Caching**: Aggressive caching for static assets

### Real-time Communication
- **Connection Pooling**: Singleton WebSocket service
- **Message Queuing**: Queue messages during disconnection
- **Heartbeat System**: Automatic connection health monitoring
- **Reconnection**: Exponential backoff retry strategy

## Troubleshooting

### Common Issues

**Authentication Problems**:
- Check Supabase URL and keys
- Verify Google OAuth configuration
- Check redirect URLs in both Google Console and Supabase

**WebSocket Connection Issues**:
- Ensure backend is running on port 8000
- Check firewall settings for WebSocket connections
- Verify `NEXT_PUBLIC_BACKEND_WS_URL` environment variable

**Build Errors**:
- Clear `.next` directory and `node_modules`
- Reinstall dependencies with `npm install`
- Check TypeScript errors with `npx tsc --noEmit`

### Development Tips

**Hot Reload Issues**: Restart development server if hot reload stops working
**Memory Issues**: Use `--max_old_space_size=4096` for large builds
**Port Conflicts**: Change port with `npm run dev -- -p 3001`