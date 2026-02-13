# Markgraph 🚀

Markgraph is a powerful, AI-driven marketing automation platform designed to streamline campaign management across Google Ads, Meta Ads, and Google Sheets. Powered by a sophisticated multi-agent system, it provides deep insights and automated optimizations for your marketing workflows.

## Features
- **Multi-Agent System**: Specialized agents for Google Ads, Meta Ads, and Data Processing.
- **Sync Engine**: Automatic synchronization of marketing data into a local SQLite database.
- **AI Insights**: Performance analysis and recommendations using LLMs (OpenRouter/Cerebras).
- **Modern Dashboard**: Built with Next.js 15, Recharts, and Framer Motion.

## Prerequisites
- **Node.js**: v18.0.0 or higher
- **Git**: For version control
- **Prisma**: installed globally or used via `npx`

## Setup and Installation

### 1. Clone the repository
```bash
git clone https://github.com/shubhambiswas2196/Markgraph.git
cd Markgraph
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory and add your API keys:

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
GOOGLE_ADS_CUSTOMER_ID=your_id

# AI Providers (OpenRouter/Cerebras)
OPENROUTER_API_KEY=your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

CEREBRAS_API_KEY=your_key
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1

# Primary AI Configuration
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

### 4. Database Initialization
This project uses Prisma with SQLite. Run the following commands to set up your database:

```bash
npx prisma generate
npx prisma db push
```

## Running the Application

### Development Server
```bash
npm run dev
```
The app will be available at [http://localhost:3000](http://localhost:3000).

### Build for Production
```bash
npm run build
npm start
```

## Usage
1. **Connect Sources**: Navigate to the "Sources" page to authenticate with Google or Meta.
2. **Sync Data**: The system will automatically begin pulling campaign metrics.
3. **Chat with Agents**: Use the dashboard chat interface to ask questions about your marketing performance.
4. **View Insights**: Specialized visualizations will appear based on the agent's analysis.

## Maintenance
- **Linting**: Keep code clean by running `npm run lint`.
- **Database Schema**: If you modify `prisma/schema.prisma`, remember to run `npx prisma db push` and `npx prisma generate`.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: SQLite
- **AI Backend**: [DeepAgents](https://github.com/deepagents/deepagents) / LangGraph
- **Styling**: Tailwind CSS & Vanilla CSS
