# Slideo

A modern, AI-powered presentation generator that transforms documents into professional slides with real-time collaboration features.

## 🚀 Overview

Slideo is a full-stack application that combines the power of AI with modern web technologies to create stunning presentations. Users can upload documents (PDF, DOCX, TXT, MD), and the system will automatically generate professional slides with customizable themes and layouts.

## ✨ Features

### Core Features
- **AI-Powered Slide Generation**: Transform documents into professional presentations
- **Real-time Collaboration**: WebSocket-based live editing and chat
- **Multi-format Support**: Upload PDF, DOCX, TXT, and Markdown files
- **Theme Customization**: Professional themes with color scheme options
- **Export Options**: Download presentations in multiple formats
- **Responsive Design**: Works seamlessly across all devices

### Technical Features
- **Modern Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Real-time Backend**: Python FastAPI with WebSocket support
- **Authentication**: Supabase-powered user management
- **File Processing**: Advanced document parsing and content extraction
- **AI Integration**: LLM-powered content analysis and slide generation

## 🏗️ Architecture

```
slideflip/
├── app/                    # Next.js frontend application
├── backend/               # Python FastAPI backend
├── components/            # React components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── services/             # API services
└── types/                # TypeScript type definitions
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Supabase Auth
- **Real-time**: WebSocket connections
- **Deployment**: Vercel

### Backend
- **Framework**: FastAPI (Python)
- **WebSocket**: WebSocket support for real-time communication
- **File Processing**: Multiple format support (PDF, DOCX, TXT, MD)
- **AI Integration**: LLM-powered content analysis
- **Database**: File-based storage with structured data
- **Deployment**: Docker-ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd slideflip
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### 3. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python main.py
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📖 Documentation

### Frontend Documentation
- [Frontend README](./FRONTEND_README.md) - Complete frontend guide
- [Component Architecture](./FRONTEND_README.md#component-architecture)
- [Authentication Setup](./FRONTEND_README.md#authentication)
- [Real-time Features](./FRONTEND_README.md#real-time-features)

### Backend Documentation
- [Backend README](./backend/README.md) - Complete backend guide
- [API Documentation](./backend/README.md#api-endpoints)
- [WebSocket Communication](./backend/README.md#websocket-communication)
- [File Processing](./backend/README.md#file-processing)

### Additional Documentation
- [Frontend Integration](./backend/docs/FRONTEND_INTEGRATION.md)
- [LLM Integration](./backend/docs/LLM_INTEGRATION_README.md)
- [Content Storage](./backend/docs/CONTENT_STORAGE_README.md)
- [Slide Generation](./backend/docs/SLIDE_GENERATION_README.md)
- [HTML Features](./backend/docs/HTML_FEATURES_README.md)
- [Implementation Summary](./backend/docs/IMPLEMENTATION_SUMMARY.md)

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

#### Backend (.env)
```env
HOST=0.0.0.0
PORT=8000
DEBUG=True
SECRET_KEY=your_secret_key
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
```

## 🧪 Testing

### Frontend Tests
```bash
npm run test
npm run test:integration
npm run test:e2e
```

### Backend Tests
```bash
cd backend
python -m pytest tests/
```

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Docker)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🔄 Development Workflow

### Recent Updates
- Landing page CTAs updated: all "Get Started" buttons now navigate to `'/auth/login'` so users are prompted to sign in before creating content.

### Adding New Features

1. **Frontend Changes**:
   - Create feature branch
   - Add components in `components/`
   - Update types in `types/`
   - Test with `npm run test`

2. **Backend Changes**:
   - Add API endpoints in `main.py`
   - Create services in `src/services/`
   - Add models in `src/models/`
   - Test with pytest

3. **Integration**:
   - Update WebSocket messages
   - Test real-time features
   - Verify API communication

### Code Style
- **Frontend**: ESLint + Prettier
- **Backend**: Black + isort
- **TypeScript**: Strict mode enabled
- **Python**: Type hints required

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass
- Test both frontend and backend integration

## 🐛 Troubleshooting

### Common Issues

#### Frontend Issues
- **Authentication Problems**: Check Supabase configuration
- **WebSocket Issues**: Verify backend is running
- **Build Errors**: Clear node_modules and reinstall

#### Backend Issues
- **Import Errors**: Check Python environment
- **File Upload Issues**: Verify upload directory permissions
- **WebSocket Connection**: Check firewall settings

#### Integration Issues
- **CORS Errors**: Verify backend CORS configuration
- **WebSocket Connection**: Check WebSocket URL
- **API Communication**: Verify environment variables

## 📊 Performance

### Frontend Optimization
- Code splitting and lazy loading
- Image optimization with Next.js
- Bundle analysis and optimization
- Caching strategies

### Backend Optimization
- Async file processing
- Connection pooling
- Memory-efficient file handling
- Configurable concurrent processing

## 🔒 Security

### Frontend Security
- Supabase authentication
- Environment variable protection
- Input validation
- XSS prevention

### Backend Security
- File type validation
- File size limits
- Filename sanitization
- Error message sanitization

## 📈 Monitoring

### Frontend Monitoring
- Vercel Analytics
- Error tracking
- Performance monitoring
- User analytics

### Backend Monitoring
- Health check endpoints
- Connection statistics
- Processing metrics
- Error logging

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Supabase](https://supabase.com/) for authentication and real-time features
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [FastAPI](https://fastapi.tiangolo.com/) for the high-performance Python API

## 📞 Support

- **Documentation**: Check the README files in each directory
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact the development team

---

**Made with ❤️ by the Slideo Team**
