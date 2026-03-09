# Privacy Policy — Google Search Console MCP Server

**Last updated:** March 2026

## Overview

The Google Search Console MCP Server (`google-searchconsole-mcp`) is a local MCP server that connects Claude Desktop (or any MCP client) to your Google Search Console account. It runs entirely on your machine.

## Data Collection

This MCP server **does not collect, store, or transmit any user data** to third parties. Specifically:

- **No analytics or telemetry** is collected
- **No usage data** is sent to the developer or any third party
- **No personal information** is gathered or stored beyond what is required for authentication

## Authentication & Credentials

- OAuth 2.0 tokens are generated during the authentication flow and **stored locally** on your machine in `~/.gsc-mcp/accounts/`
- Credentials never leave your local filesystem
- You can revoke access at any time through your [Google Account permissions](https://myaccount.google.com/permissions)

## Data Processing

- All queries to Google Search Console are made **directly from your machine** to Google's API
- Search analytics data, URL inspection results, and other GSC data are returned to your MCP client (e.g., Claude Desktop) and are **never stored, cached, or forwarded** by this server
- No data is sent to any server operated by the developer

## Third-Party Services

This server communicates only with:

- **Google Search Console API** (`searchconsole.googleapis.com`) — to fetch your search analytics and site data
- **Google OAuth 2.0** (`accounts.google.com`) — for authentication

No other third-party services are contacted.

## Data Retention

- This server does not maintain any database or persistent storage of your GSC data
- OAuth tokens persist locally until you delete them or revoke access
- Query results exist only in memory during your session

## Open Source

This server is fully open source under the MIT license. You can audit the complete source code at [github.com/lionkiii/google-searchconsole-mcp](https://github.com/lionkiii/google-searchconsole-mcp).

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/lionkiii/google-searchconsole-mcp/issues).
