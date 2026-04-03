# Security Policy

## OAuth Credentials

This package ships with bundled OAuth 2.0 client credentials (client ID and client secret). These are **application identifiers**, not user secrets. This is standard practice for Google Desktop OAuth applications — the credentials identify the app, while each user authenticates separately with their own Google account.

- Users can override with their own credentials via environment variables (`GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`) or a config file (`~/.gsc-mcp/credentials.json`).
- The OAuth scope is **read-only**: `webmasters.readonly`.

## Token Storage

- OAuth tokens are stored locally on the user's machine at `~/.gsc-mcp/tokens/`.
- Tokens are never transmitted to any third party.
- All API calls go directly from the user's machine to Google's API.

## Data Privacy

- No data is collected, stored, or transmitted by this MCP server.
- All Search Console data is queried directly from Google's API.
- See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by opening an issue at https://github.com/lionkiii/google-searchconsole-mcp/issues or emailing the maintainer directly.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 72 hours.
