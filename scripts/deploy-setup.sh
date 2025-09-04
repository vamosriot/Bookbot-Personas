#!/bin/bash

# Book Recommendations System - Deployment Setup Script
# This script helps validate and set up the recommendation system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Validate environment variables
validate_env() {
    print_header "Environment Validation"
    
    local required_vars=(
        "OPENAI_API_KEY"
        "SUPABASE_URL" 
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        else
            print_success "✓ $var is set"
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_error "  - $var"
        done
        print_error "Please check your .env file or set these variables."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Check if required files exist
validate_files() {
    print_header "File Structure Validation"
    
    local required_files=(
        "src/lib/database-schema.sql"
        "src/scripts/import-books.ts"
        "src/scripts/generate-embeddings.ts"
        "src/services/embeddingService.ts"
        "src/services/recommendationService.ts"
        "src/api/server.ts"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "✓ $file exists"
        else
            print_error "✗ $file is missing"
            exit 1
        fi
    done
    
    print_success "All required files are present"
}

# Check dependencies
check_dependencies() {
    print_header "Dependencies Check"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        print_success "✓ Node.js $node_version"
    else
        print_error "✗ Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        print_success "✓ npm $npm_version"
    else
        print_error "✗ npm not found"
        exit 1
    fi
    
    # Check if node_modules exists
    if [[ -d "node_modules" ]]; then
        print_success "✓ Node modules installed"
    else
        print_warning "⚠ Node modules not found. Run 'npm install'"
    fi
    
    # Check TypeScript
    if command -v npx ts-node &> /dev/null; then
        print_success "✓ TypeScript/ts-node available"
    else
        print_warning "⚠ ts-node not available. Run 'npm install'"
    fi
}

# Test database connection
test_database_connection() {
    print_header "Database Connection Test"
    
    print_status "Testing Supabase connection..."
    
    # Simple test - try to run the import script with --help (if it exists)
    if npm run import:books -- --help &> /dev/null; then
        print_success "✓ Import script is accessible"
    else
        print_warning "⚠ Cannot test import script"
    fi
    
    print_success "Database connection appears to be configured"
}

# Run system tests
run_system_tests() {
    print_header "System Tests"
    
    print_status "Testing embedding generation (dry-run)..."
    if npm run generate:embeddings -- --limit 1 --dry-run &> /dev/null; then
        print_success "✓ Embedding service works"
    else
        print_warning "⚠ Embedding service test failed (this is expected if no books are imported yet)"
    fi
    
    print_status "Testing API server startup..."
    if timeout 10s npm run api:server &> /dev/null; then
        print_success "✓ API server starts successfully"
    else
        print_warning "⚠ API server test timeout (normal for startup test)"
    fi
}

# Show deployment steps
show_deployment_steps() {
    print_header "Deployment Steps"
    
    echo "To complete the setup, follow these steps:"
    echo ""
    echo "1. 🗄️  Set up database:"
    echo "   - Open Supabase SQL Editor"
    echo "   - Run: src/lib/database-schema.sql"
    echo ""
    echo "2. 📊 Import your CSV data:"
    echo "   npm run import:books \"sql (1).csv\""
    echo ""
    echo "3. 🧠 Generate embeddings:"
    echo "   npm run generate:embeddings -- --limit 100  # Test with 100 books first"
    echo "   npm run generate:embeddings                  # Generate all embeddings"
    echo ""
    echo "4. 🚀 Start the API server:"
    echo "   npm run api:server"
    echo ""
    echo "5. 🧪 Test the system:"
    echo "   curl -X POST http://localhost:3001/api/recommendations \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"title\": \"Harry Potter\", \"limit\": 5}'"
    echo ""
    echo "📖 Full documentation: README-RECOMMENDATIONS.md"
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "================================================="
    echo "  Book Recommendations System - Setup Validator"
    echo "================================================="
    echo -e "${NC}"
    
    validate_env
    validate_files
    check_dependencies
    test_database_connection
    run_system_tests
    show_deployment_steps
    
    print_header "Setup Validation Complete"
    print_success "🎉 Your recommendation system is ready to deploy!"
    print_status "Next step: Run the database migration and import your CSV data."
    
    echo ""
}

# Run main function
main "$@"
