# Scraper Gossip

A semantic news indexing application that retrieves and organizes public gossip news for easy discovery and analysis.

## 🏗️ Tech Stack

### Backend: NestJS
- **Why**: Perfect for discovering the framework while having fun with its decorator-based architecture and built-in TypeScript support
- **Features**: RESTful API, dependency injection, modular structure

### Frontend: Next.js
- **Why**: Definitely overkill for this project, but provides an excellent foundation for rapid development and easy scaffolding
- **Features**: Server-side rendering, automatic code splitting, built-in optimization

### Database: SQLite
- **Database**: SQLite
- **Why**: Lightweight, serverless, and requires no additional processes - perfect for development and small-scale deployment
- **Benefits**: Zero configuration, file-based storage, full SQL support

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scraper-gossip
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```
   The backend will run on `http://localhost:4243`

3. **Frontend Setup**
   ```bash
   cd frontend/scraper-gossip
   npm install
   npm run dev
   ```
   The frontend will run on `http://localhost:4242`

## 📁 Project Structure

```
scraper-gossip/
├── backend/          # NestJS API server
│   ├── src/          # Source code
│   ├── test/         # Test files
│   └── package.json  # Backend dependencies
├── frontend/         # Next.js client application
│   └── scraper-gossip/
│       ├── src/      # React components and pages
│       └── package.json # Frontend dependencies
└── README.md         # This file
```

## 🎯 Features

- **News Scraping**: Automated retrieval of gossip news from public sources
- **Semantic Indexing**: Intelligent categorization and tagging of news content
- **Search & Discovery**: Easy exploration of indexed news articles

## 🌱 Seeding Data

The application includes a seed command to populate the database with initial RSS sources:

```bash
cd backend
npm run seed [file]
```

- **Default behavior**: Uses `default_seed_gossip_websites.txt` if no file is specified
- **Custom file**: You can provide your own file with RSS URLs (one per line)

Example:
```bash
# Use default seed file
npm run scraper-gossip seed

# Use custom seed file
npm run scraper-gossip my_rss_sources.txt
```
