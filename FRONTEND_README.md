# SlideFlip Frontend

A modern Next.js application for generating professional presentations with real-time collaboration and AI-powered slide generation.

## Features

- **Modern UI/UX**: Built with Next.js 14, Tailwind CSS, and shadcn/ui components
- **Real-time Communication**: WebSocket integration for live updates and collaboration
- **Authentication**: Supabase-powered authentication with password-based auth
- **File Upload**: Drag-and-drop file upload with progress tracking
- **Slide Builder**: Interactive slide creation with theme customization
- **Real-time Chat**: Live chat functionality for collaboration
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Theme Support**: Dark/light mode with system preference detection

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Authentication**: Supabase Auth
- **Real-time**: WebSocket connections
- **State Management**: React hooks and context
- **TypeScript**: Full type safety
- **Deployment**: Vercel-ready

## Project Structure

```
app/
├── api/                    # API routes
│   ├── generate-description/
│   └── research/
├── auth/                   # Authentication pages
│   ├── login/
│   ├── sign-up/
│   ├── forgot-password/
│   └── ...
├── builder/               # Main slide builder
├── demo/                  # Demo page
├── protected/             # Protected routes
└── globals.css           # Global styles

components/
├── auth/                  # Authentication components
├── builder/               # Slide builder components
│   ├── download-step.tsx
│   ├── preview-step.tsx
│   ├── research-step.tsx
│   ├── theme-step.tsx
│   └── upload-step.tsx
├── ui/                    # Reusable UI components
└── websocket-provider.tsx # WebSocket context

hooks/
├── use-chat-scroll.tsx    # Chat scroll management
├── use-realtime-chat.tsx  # Real-time chat hook
└── use-websocket.ts       # WebSocket hook

lib/
├── supabase/              # Supabase configuration
└── utils.ts               # Utility functions

services/
├── backend-service.ts      # Backend API service
└── websocket-service.ts   # WebSocket service
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Supabase account and project

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd slideflip
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Authentication

The frontend uses Supabase for authentication with the following features:

- **Sign Up**: User registration with email verification
- **Sign In**: Email/password authentication
- **Password Reset**: Forgot password functionality
- **Protected Routes**: Automatic redirect for unauthenticated users
- **Session Management**: Persistent sessions with cookies

### Authentication Flow

1. User visits the application
2. If not authenticated, redirected to login page
3. User can sign up or sign in
4. Upon successful authentication, redirected to builder
5. Session persists across browser sessions

## Slide Builder

The main application feature is the slide builder with the following steps:

### 1. Upload Step
- Drag-and-drop file upload
- Support for PDF, DOCX, TXT, MD files
- File validation and progress tracking
- Real-time upload status

### 2. Research Step
- AI-powered content analysis
- Topic extraction and suggestions
- Content structure recommendations
- Research summary generation

### 3. Theme Step
- Professional theme selection
- Color scheme customization
- Layout options
- Preview of theme changes

### 4. Preview Step
- Real-time slide preview
- Content editing capabilities
- Layout adjustments
- Export options

### 5. Download Step
- Multiple export formats
- Quality settings
- Batch download options
- Share functionality

## Real-time Features

### WebSocket Integration
- Live connection status
- Real-time slide updates
- Collaborative editing
- Progress tracking

### Chat System
- Real-time messaging
- User presence indicators
- Message history
- Typing indicators

## Component Architecture

### Core Components

#### Authentication Components
- `AuthButton`: Universal auth button with login/logout
- `LoginForm`: Sign-in form with validation
- `SignUpForm`: Registration form
- `ForgotPasswordForm`: Password reset form

#### Builder Components
- `UploadStep`: File upload with drag-and-drop
- `ResearchStep`: AI-powered content analysis
- `ThemeStep`: Theme and styling selection
- `PreviewStep`: Slide preview and editing
- `DownloadStep`: Export and download options

#### UI Components
- `Button`: Reusable button component
- `Card`: Content container component
- `Dialog`: Modal dialog component
- `Input`: Form input component
- `Navigation`: Navigation menu component

### Custom Hooks

#### `useWebSocket`
Manages WebSocket connections and real-time communication:
```typescript
const { sendMessage, isConnected, lastMessage } = useWebSocket(clientId);
```

#### `useRealtimeChat`
Handles real-time chat functionality:
```typescript
const { messages, sendMessage, isTyping } = useRealtimeChat();
```

#### `useChatScroll`
Manages chat scroll behavior:
```typescript
const { scrollToBottom, isAtBottom } = useChatScroll();
```

## Styling and Theming

### Tailwind CSS
- Utility-first CSS framework
- Responsive design utilities
- Dark mode support
- Custom component styling

### shadcn/ui
- Pre-built component library
- Consistent design system
- Accessibility features
- Customizable themes

### Theme System
- Light/dark mode toggle
- System preference detection
- Custom color schemes
- Consistent branding

## API Integration

### Backend Service
The frontend communicates with the backend through the `BackendService`:

```typescript
const backendService = new BackendService();

// Generate slide description
const description = await backendService.generateDescription(content);

// Research content
const research = await backendService.researchContent(topic);
```

### WebSocket Service
Real-time communication through `WebSocketService`:

```typescript
const wsService = new WebSocketService();

// Connect to backend
await wsService.connect(clientId);

// Send messages
wsService.sendMessage({
  type: 'file_upload',
  data: { filename, content }
});
```

## State Management

### React Context
- Authentication state
- WebSocket connection state
- Theme preferences
- User settings

### Local State
- Form data
- UI state
- Component-specific state
- Temporary data

## Error Handling

### Global Error Boundary
- Catches unhandled errors
- Graceful error display
- Error reporting
- Recovery mechanisms

### Form Validation
- Client-side validation
- Real-time feedback
- Error messages
- Success indicators

### Network Error Handling
- Connection retry logic
- Offline detection
- Error recovery
- User notifications

## Performance Optimization

### Code Splitting
- Route-based splitting
- Component lazy loading
- Dynamic imports
- Bundle optimization

### Image Optimization
- Next.js Image component
- Automatic optimization
- Responsive images
- Lazy loading

### Caching
- Static generation
- Incremental static regeneration
- API response caching
- Browser caching

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `NEXT_PUBLIC_BACKEND_URL`: Backend service URL

### Build Process
```bash
npm run build
npm run start
```

## Development Guidelines

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Consistent naming conventions

### Component Guidelines
- Functional components with hooks
- Props interface definitions
- Error boundary usage
- Accessibility features

### State Management
- Use React hooks for local state
- Context for global state
- Avoid prop drilling
- Optimize re-renders

## Troubleshooting

### Common Issues

#### Authentication Problems
- Check Supabase configuration
- Verify environment variables
- Clear browser cache
- Check network connectivity

#### WebSocket Connection Issues
- Verify backend is running
- Check WebSocket URL
- Review network settings
- Check firewall configuration

#### Build Errors
- Clear node_modules and reinstall
- Check TypeScript errors
- Verify dependency versions
- Review import statements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review troubleshooting guide
- Contact the development team 