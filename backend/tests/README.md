# SlideFlip Backend Tests

This directory contains comprehensive tests for the SlideFlip backend application. All tests are designed to ensure the reliability, functionality, and performance of the backend services.

## 🧪 Test Overview

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **WebSocket Tests**: Real-time communication testing
- **File Processing Tests**: File upload and processing testing
- **LLM Tests**: AI integration testing
- **HTML Processing Tests**: HTML parsing and feature extraction testing

## 📁 Test Files

### Core Backend Tests

#### `test_backend.py`
- **Purpose**: Core backend functionality testing
- **Coverage**: Main application startup, health checks, basic API endpoints
- **Key Tests**:
  - Server startup and configuration
  - Health check endpoints
  - Basic routing functionality
  - Error handling

#### `test_content_storage.py`
- **Purpose**: Content storage system testing
- **Coverage**: File storage, metadata management, data persistence
- **Key Tests**:
  - File upload and storage
  - Metadata management
  - Content retrieval
  - Storage cleanup

### File Processing Tests

#### `test_html_parsing.py`
- **Purpose**: HTML parsing functionality testing
- **Coverage**: HTML content extraction, parsing accuracy
- **Key Tests**:
  - HTML tag extraction
  - Content structure parsing
  - Image extraction from HTML
  - Link extraction

#### `test_image_extraction.py`
- **Purpose**: Image extraction from documents testing
- **Coverage**: Image detection, extraction, and processing
- **Key Tests**:
  - Image detection in documents
  - Image extraction accuracy
  - Image format handling
  - Image quality assessment

#### `test_existing_html_files.py`
- **Purpose**: Testing with existing HTML files
- **Coverage**: Real-world HTML file processing
- **Key Tests**:
  - Complex HTML structure parsing
  - Nested element handling
  - Style and script extraction
  - Content preservation

### AI Integration Tests

#### `test_llm_integration.py`
- **Purpose**: LLM service integration testing
- **Coverage**: AI model communication, response handling
- **Key Tests**:
  - LLM service initialization
  - API communication
  - Response parsing
  - Error handling

#### `test_llm_slide_generation.py`
- **Purpose**: AI-powered slide generation testing
- **Coverage**: Content analysis, slide creation, theme application
- **Key Tests**:
  - Content analysis accuracy
  - Slide structure generation
  - Theme application
  - Content quality assessment

### Slide Generation Tests

#### `test_slide_generation.py`
- **Purpose**: Basic slide generation functionality
- **Coverage**: Slide creation, formatting, output generation
- **Key Tests**:
  - Slide structure creation
  - Content formatting
  - Theme application
  - Output validation

#### `test_new_slide_generation.py`
- **Purpose**: Advanced slide generation features
- **Coverage**: Complex slide layouts, advanced formatting
- **Key Tests**:
  - Complex slide layouts
  - Advanced formatting options
  - Custom theme application
  - Multi-slide generation

#### `test_consolidated_slide_generation.py`
- **Purpose**: End-to-end slide generation testing
- **Coverage**: Complete slide generation pipeline
- **Key Tests**:
  - Complete generation pipeline
  - Multi-format input handling
  - Output quality assessment
  - Performance testing

### HTML Processing Tests

#### `test_html_parsing_and_llm.py`
- **Purpose**: Combined HTML parsing and LLM processing
- **Coverage**: HTML content analysis with AI
- **Key Tests**:
  - HTML content analysis
  - AI-powered content extraction
  - Combined processing pipeline
  - Result accuracy

#### `test_comprehensive_html.py`
- **Purpose**: Comprehensive HTML processing testing
- **Coverage**: All HTML processing features
- **Key Tests**:
  - Complete HTML feature extraction
  - Complex HTML structure handling
  - Performance with large files
  - Edge case handling

### Environment and Setup Tests

#### `test_env_setup.py`
- **Purpose**: Environment configuration testing
- **Coverage**: Configuration loading, environment validation
- **Key Tests**:
  - Environment variable loading
  - Configuration validation
  - Default value handling
  - Error handling for missing config

## 🚀 Running Tests

### Quick Start
```bash
# Run all tests
python tests/run_tests.py

# Run with coverage
python tests/run_tests.py --coverage

# Run specific test
python tests/run_tests.py --test test_backend
```

### Using pytest directly
```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_backend.py

# Run with verbose output
python -m pytest tests/ -v

# Run with coverage
python -m pytest --cov=src tests/
```

### Test Runner Script
The `run_tests.py` script provides an easy way to run tests:

```bash
# Run all tests
./tests/run_tests.py

# Run specific test
./tests/run_tests.py --test test_slide_generation

# Run with coverage
./tests/run_tests.py --coverage
```

## 📊 Test Results

### Test Output Files
- `test_results_html_parsing_llm.json`: HTML parsing and LLM test results
- `test_results_llm_generation.json`: LLM generation test results

### Coverage Reports
When running with coverage, reports are generated in:
- `htmlcov/`: HTML coverage report
- Terminal output: Text coverage summary

## 🔧 Test Configuration

### Environment Setup
Tests require the following environment setup:
```bash
# Activate virtual environment
source venv/bin/activate

# Install test dependencies
pip install pytest pytest-cov

# Set up test environment variables
export TESTING=True
export DEBUG=True
```

### Test Data
Test files and data are stored in:
- `test_data/`: Sample files for testing
- `test_results/`: Test output and results
- `temp/`: Temporary files during testing

## 🐛 Troubleshooting

### Common Issues

#### Import Errors
```bash
# Ensure you're in the backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Test Failures
- Check environment variables
- Verify file permissions
- Ensure test data files exist
- Check network connectivity for external services

#### Coverage Issues
```bash
# Install coverage tools
pip install pytest-cov

# Run with coverage
python -m pytest --cov=src --cov-report=html tests/
```

## 📈 Performance Testing

### Load Testing
```bash
# Run performance tests
python -m pytest tests/test_performance.py -v

# Run with specific parameters
python -m pytest tests/test_performance.py::test_large_file_processing -v
```

### Memory Testing
```bash
# Run memory usage tests
python -m pytest tests/test_memory.py -v
```

## 🔄 Continuous Integration

### GitHub Actions
Tests are automatically run on:
- Pull requests
- Push to main branch
- Scheduled runs

### Local CI
```bash
# Run full test suite
./tests/run_tests.py --coverage

# Check test coverage
python -m pytest --cov=src --cov-fail-under=80 tests/
```

## 📝 Adding New Tests

### Test File Structure
```python
import pytest
from src.services.some_service import SomeService

class TestSomeService:
    def setup_method(self):
        """Set up test fixtures."""
        self.service = SomeService()
    
    def test_some_functionality(self):
        """Test specific functionality."""
        result = self.service.some_method()
        assert result is not None
        assert result.status == "success"
    
    def test_error_handling(self):
        """Test error conditions."""
        with pytest.raises(ValueError):
            self.service.some_method_with_error()
```

### Test Guidelines
1. **Naming**: Use descriptive test names
2. **Isolation**: Each test should be independent
3. **Coverage**: Test both success and failure cases
4. **Documentation**: Add docstrings to test methods
5. **Performance**: Keep tests fast and efficient

## 📚 Additional Resources

- [pytest Documentation](https://docs.pytest.org/)
- [Python Testing Best Practices](https://realpython.com/python-testing/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)

---

**Happy Testing! 🧪** 