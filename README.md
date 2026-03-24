# Google Search Console MCP Server

[![npm version](https://img.shields.io/npm/v/google-searchconsole-mcp)](https://www.npmjs.com/package/google-searchconsole-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects **Google Search Console** to AI assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and any MCP-compatible client. Analyze your SEO data, inspect URLs, find keyword opportunities, and track search performance — all through natural language.

> **No Google Cloud setup required.** Install, authenticate with your Google account, and start querying your Search Console data in under 2 minutes.

[![google-search-console-mcp MCP server](https://glama.ai/mcp/servers/lionkiii/google-searchconsole-mcp/badges/card.svg)](https://glama.ai/mcp/servers/lionkiii/google-searchconsole-mcp)

## What Can You Do?

Ask Claude questions like:
- *"What are my top performing pages this month?"*
- *"Find keywords where I have high impressions but low CTR"*
- *"Compare my search performance this month vs last month"*
- *"Is this URL indexed? Any issues?"*
- *"Show me my brand vs non-brand traffic split"*

## Quick Start

### 1. Install

```bash
npm install -g google-searchconsole-mcp
```

### 2. Authenticate (one time)

```bash
gsc-mcp-auth
```

Opens your browser — log in with your Google account and grant Search Console read access. Your tokens are saved locally to `~/.gsc-mcp/tokens/`. **Your data stays on your machine.**

**Multiple accounts:**

```bash
gsc-mcp-auth --alias work
gsc-mcp-auth --alias personal
gsc-mcp-auth --list
```

### 3. Add to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "google-search-console": {
      "command": "npx",
      "args": ["-y", "google-searchconsole-mcp"]
    }
  }
}
```

Restart Claude Desktop. Done — your Search Console data is now available in Claude.

### Use with Other MCP Clients

Works with any MCP-compatible client including **Cursor**, **Windsurf**, **VS Code + Cline**, and more. Just point the MCP client to:

```bash
npx google-searchconsole-mcp
```

## Available Tools (13 SEO Tools)

| Tool | Description |
|------|-------------|
| `list_accounts` | List all authenticated Google accounts and their Search Console sites |
| `list_sites` | List all Search Console properties you have access to |
| `query_search_analytics` | Query clicks, impressions, CTR, and position by any dimension (query, page, country, device, date) |
| `inspect_url` | Check URL indexing status, mobile usability, and rich results eligibility |
| `list_sitemaps` | List all submitted sitemaps and their status |
| `find_keyword_opportunities` | Discover high-impression, low-CTR keywords — quick SEO wins |
| `get_top_pages` | Get top pages sorted by clicks, impressions, CTR, or position |
| `compare_performance` | Compare search performance between two time periods (week-over-week, month-over-month) |
| `analyze_brand_queries` | Analyze brand vs non-brand organic traffic split |
| `get_keyword_trend` | Get daily trend data for a specific keyword |
| `export_analytics` | Export search analytics data as CSV or JSON |
| `query_by_search_appearance` | Filter results by search appearance: AMP, FAQ, HowTo, Rich Results, Video, etc. |
| `query_by_search_type` | Filter by search type: web, image, video, news, or discover |

## Examples

### Example 1: Find your top performing pages

**User prompt:** "Show me my top 10 pages by clicks for the last 30 days"

**Expected behavior:**
- Calls `get_top_pages` with your site URL, date range of last 30 days, `sortBy: "clicks"`, and `limit: 10`
- Returns a ranked list of your top 10 pages with clicks, impressions, CTR, and average position for each
- Helps identify your strongest content and highest-traffic landing pages

### Example 2: Discover keyword optimization opportunities

**User prompt:** "Find keywords where I have high impressions but low CTR on example.com"

**Expected behavior:**
- Calls `find_keyword_opportunities` with your site URL and a 28-day date range
- Filters for queries with 100+ impressions and less than 3% CTR within the top 20 positions
- Returns a list of keywords where better titles, meta descriptions, or content could significantly increase clicks

### Example 3: Check if a URL is indexed by Google

**User prompt:** "Check if https://example.com/blog/my-new-post is indexed"

**Expected behavior:**
- Calls `inspect_url` with the site property and the full URL to inspect
- Returns indexing status (indexed, crawled but not indexed, not found, etc.), last crawl date, mobile usability status, and any rich results detected
- Identifies issues preventing indexing such as robots.txt blocks, noindex tags, or crawl errors

### Example 4: Compare this month vs last month

**User prompt:** "Compare my search performance this month vs last month for example.com"

**Expected behavior:**
- Calls `compare_performance` with current and previous month date ranges
- Returns queries that gained or lost the most clicks, with delta values for clicks, impressions, CTR, and position
- Highlights trending keywords and declining pages to prioritize optimization efforts

## Use Cases

- **SEO Performance Monitoring** — Track clicks, impressions, CTR, and average position over time
- **Keyword Research & Opportunities** — Find keywords you rank for with high impressions but low CTR
- **Content Optimization** — Identify which pages need improvement based on search data
- **Technical SEO Audits** — Check URL indexing status, sitemap health, and mobile usability
- **Competitive Analysis** — Compare performance periods to spot trends and drops
- **Reporting** — Export data for SEO reports and dashboards
- **Brand Monitoring** — Track brand vs non-brand search traffic

## How Authentication Works

This package ships with built-in OAuth credentials — you don't need to create a Google Cloud project. When you run `gsc-mcp-auth`:

1. Your browser opens Google's login page
2. You log in with **your** Google account
3. You grant read-only access to **your** Search Console data
4. Tokens are saved locally on your machine (`~/.gsc-mcp/tokens/`)

**Your data never leaves your machine.** The OAuth credentials just identify the app — each user authenticates separately and can only access their own Search Console data.

### Advanced: Use Your Own OAuth Credentials

If you prefer to use your own Google Cloud project:

**Option A: Environment variables**
```bash
export GSC_CLIENT_ID="your-client-id"
export GSC_CLIENT_SECRET="your-client-secret"
```

**Option B: Credentials file**
Save your OAuth credentials JSON to `~/.gsc-mcp/credentials.json`

<details>
<summary>How to create your own Google Cloud OAuth credentials</summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select existing)
3. Enable the **Google Search Console API**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Choose **Desktop app** as application type
6. Download the credentials JSON file

</details>

## Requirements

- **Node.js** >= 18
- A Google account with access to Google Search Console

## Related

- [Model Context Protocol](https://modelcontextprotocol.io) — The open standard for AI-tool integration
- [Claude Desktop](https://claude.ai/download) — Anthropic's desktop AI assistant
- [MCP Server Registry](https://github.com/punkpeye/awesome-mcp-servers) — Curated list of MCP servers

## Privacy Policy

See [PRIVACY.md](./PRIVACY.md) for our complete privacy policy.

**TL;DR:** This extension runs locally on your machine. OAuth tokens are stored locally in `~/.gsc-mcp/`, and all Search Console data is queried directly from Google's API without passing through any intermediary. No data is collected, stored, or transmitted to any third party by this MCP server.

## License

MIT