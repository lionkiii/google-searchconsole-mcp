#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getAuthenticatedClient, listAccounts } from "./auth.js";
import {
  querySearchAnalytics,
  listSites,
  SearchAnalyticsParams,
  inspectUrl,
  listSitemaps,
  findKeywordOpportunities,
  getTopPages,
  comparePerformance,
  analyzeBrandQueries,
  getKeywordTrend,
  exportAnalytics,
  queryBySearchAppearance,
  SearchAppearanceType,
} from "./tools/search-analytics.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const accountProperty = {
  type: "string" as const,
  description:
    'Account alias to use (e.g., "default", "personal"). If omitted and only one account exists, it is used automatically.',
};

const server = new Server(
  {
    name: "gsc-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_accounts",
        description:
          "List all authenticated Google accounts and their associated GSC sites.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "list_sites",
        description:
          "List all sites you have access to in Google Search Console. When multiple accounts exist and no account is specified, shows all accounts' sites grouped by account.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
          },
          required: [],
        },
      },
      {
        name: "query_search_analytics",
        description:
          "Query Google Search Console search analytics data. Returns search queries, clicks, impressions, CTR, and average position.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description:
                'The site URL to query (e.g., "https://example.com" or "sc-domain:example.com")',
            },
            startDate: {
              type: "string",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              description: "End date in YYYY-MM-DD format",
            },
            dimensions: {
              type: "array",
              items: { type: "string" },
              description:
                'Dimensions to group by: "query", "page", "country", "device", "date". Default: ["query"]',
            },
            rowLimit: {
              type: "number",
              description: "Maximum number of rows to return (1-25000). Default: 1000",
            },
            filters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  operator: { type: "string" },
                  expression: { type: "string" },
                },
                required: ["dimension", "expression"],
              },
              description:
                'Optional filters. Example: [{"dimension": "query", "expression": "keyword"}]',
            },
          },
          required: ["siteUrl", "startDate", "endDate"],
        },
      },
      {
        name: "inspect_url",
        description:
          "Inspect a URL to check its indexing status, mobile usability, and rich results. Shows if Google can crawl and index the page.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: 'The site property URL (e.g., "https://example.com" or "sc-domain:example.com")',
            },
            inspectionUrl: {
              type: "string",
              description: "The full URL to inspect (e.g., https://example.com/page)",
            },
          },
          required: ["siteUrl", "inspectionUrl"],
        },
      },
      {
        name: "list_sitemaps",
        description: "List all sitemaps submitted for a site in Google Search Console.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: 'The site URL (e.g., "https://example.com" or "sc-domain:example.com")',
            },
          },
          required: ["siteUrl"],
        },
      },
      {
        name: "find_keyword_opportunities",
        description:
          "Find keyword optimization opportunities - queries with high impressions but low CTR that could be improved.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: 'The site URL to analyze',
            },
            startDate: {
              type: "string",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              description: "End date in YYYY-MM-DD format",
            },
            minImpressions: {
              type: "number",
              description: "Minimum impressions to consider (default: 100)",
            },
            maxCtr: {
              type: "number",
              description: "Maximum CTR to consider as opportunity (default: 0.03 = 3%)",
            },
            maxPosition: {
              type: "number",
              description: "Maximum position to consider (default: 20)",
            },
          },
          required: ["siteUrl", "startDate", "endDate"],
        },
      },
      {
        name: "get_top_pages",
        description: "Get top performing pages sorted by clicks, impressions, CTR, or position.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: 'The site URL',
            },
            startDate: {
              type: "string",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              description: "End date in YYYY-MM-DD format",
            },
            sortBy: {
              type: "string",
              enum: ["clicks", "impressions", "ctr", "position"],
              description: 'Sort by: "clicks", "impressions", "ctr", or "position" (default: clicks)',
            },
            limit: {
              type: "number",
              description: "Number of pages to return (default: 50)",
            },
          },
          required: ["siteUrl", "startDate", "endDate"],
        },
      },
      {
        name: "compare_performance",
        description:
          "Compare search performance between two time periods. Shows which queries/pages gained or lost traffic.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: 'The site URL',
            },
            currentStartDate: {
              type: "string",
              description: "Current period start date (YYYY-MM-DD)",
            },
            currentEndDate: {
              type: "string",
              description: "Current period end date (YYYY-MM-DD)",
            },
            previousStartDate: {
              type: "string",
              description: "Previous period start date (YYYY-MM-DD)",
            },
            previousEndDate: {
              type: "string",
              description: "Previous period end date (YYYY-MM-DD)",
            },
            dimension: {
              type: "string",
              enum: ["query", "page"],
              description: 'Compare by "query" or "page" (default: query)',
            },
            limit: {
              type: "number",
              description: "Number of results to return (default: 50)",
            },
          },
          required: ["siteUrl", "currentStartDate", "currentEndDate", "previousStartDate", "previousEndDate"],
        },
      },
      {
        name: "analyze_brand_queries",
        description:
          "Analyze branded vs non-branded search queries. Shows what percentage of traffic comes from brand searches.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: "The site URL",
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
            brandTerms: {
              type: "array",
              items: { type: "string" },
              description: 'Your brand terms to identify branded queries (e.g., ["mycompany", "my company", "mybrand"])',
            },
          },
          required: ["siteUrl", "startDate", "endDate", "brandTerms"],
        },
      },
      {
        name: "get_keyword_trend",
        description:
          "Get the performance trend of a specific keyword over time. Shows daily clicks, impressions, and position changes.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: "The site URL",
            },
            keyword: {
              type: "string",
              description: "The exact keyword to track",
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
          },
          required: ["siteUrl", "keyword", "startDate", "endDate"],
        },
      },
      {
        name: "export_analytics",
        description:
          "Export search analytics data as CSV or JSON format for external analysis or reporting.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: "The site URL",
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
            dimensions: {
              type: "array",
              items: { type: "string" },
              description: 'Dimensions to include: "query", "page", "country", "device", "date"',
            },
            format: {
              type: "string",
              enum: ["csv", "json"],
              description: "Export format: csv or json",
            },
            rowLimit: {
              type: "number",
              description: "Maximum rows to export (default: 1000)",
            },
            searchType: {
              type: "string",
              enum: ["web", "image", "video", "news"],
              description: "Filter by search type (default: web)",
            },
          },
          required: ["siteUrl", "startDate", "endDate", "dimensions", "format"],
        },
      },
      {
        name: "query_by_search_appearance",
        description:
          "Query analytics filtered by search appearance type (AMP, Rich Results, Video, FAQ, etc.).",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: "The site URL",
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
            searchAppearance: {
              type: "string",
              enum: [
                "AMP_BLUE_LINK",
                "AMP_TOP_STORIES",
                "BREADCRUMB",
                "EVENT",
                "FAQ",
                "HOWTO",
                "IMAGE_PACK",
                "JOB_LISTING",
                "MERCHANT_LISTINGS",
                "PRODUCT_SNIPPETS",
                "RECIPE_FEATURE",
                "RECIPE_RICH_SNIPPET",
                "REVIEW_SNIPPET",
                "SITELINKS",
                "VIDEO",
                "WEB_STORY",
              ],
              description: "The search appearance type to filter by",
            },
            rowLimit: {
              type: "number",
              description: "Maximum rows to return (default: 100)",
            },
          },
          required: ["siteUrl", "startDate", "endDate", "searchAppearance"],
        },
      },
      {
        name: "query_by_search_type",
        description:
          "Query analytics filtered by search type: web, image, video, news, or discover.",
        annotations: readOnlyAnnotations,
        inputSchema: {
          type: "object",
          properties: {
            account: accountProperty,
            siteUrl: {
              type: "string",
              description: "The site URL",
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)",
            },
            searchType: {
              type: "string",
              enum: ["web", "image", "video", "news", "discover"],
              description: "The search type to filter by",
            },
            dimensions: {
              type: "array",
              items: { type: "string" },
              description: 'Dimensions to group by (default: ["query"])',
            },
            rowLimit: {
              type: "number",
              description: "Maximum rows to return (default: 100)",
            },
          },
          required: ["siteUrl", "startDate", "endDate", "searchType"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_accounts": {
        const accounts = listAccounts();

        if (accounts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No accounts found. Run `npm run auth` to authenticate.",
              },
            ],
          };
        }

        const lines: string[] = [`Authenticated accounts (${accounts.length}):`];

        for (const account of accounts) {
          try {
            const client = await getAuthenticatedClient(account.alias);
            const sites = await listSites(client);
            lines.push(
              `\n${account.alias}${account.email ? ` (${account.email})` : ""}:`
            );
            if (sites.length > 0) {
              sites.forEach((s) => lines.push(`  - ${s}`));
            } else {
              lines.push("  (no sites)");
            }
          } catch (error) {
            lines.push(
              `\n${account.alias}${account.email ? ` (${account.email})` : ""}: [auth error]`
            );
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      case "list_sites": {
        const accountAlias = (args as Record<string, unknown>)?.account as string | undefined;
        const accounts = listAccounts();

        // If multiple accounts and no specific account requested, show all
        if (!accountAlias && accounts.length > 1) {
          const lines: string[] = ["Sites across all accounts:"];

          for (const account of accounts) {
            try {
              const client = await getAuthenticatedClient(account.alias);
              const sites = await listSites(client);
              lines.push(
                `\n[${account.alias}]${account.email ? ` (${account.email})` : ""}:`
              );
              if (sites.length > 0) {
                sites.forEach((s) => lines.push(`  - ${s}`));
              } else {
                lines.push("  (no sites)");
              }
            } catch (error) {
              lines.push(
                `\n[${account.alias}]: [auth error: ${error instanceof Error ? error.message : "unknown"}]`
              );
            }
          }

          return {
            content: [{ type: "text", text: lines.join("\n") }],
          };
        }

        const authClient = await getAuthenticatedClient(accountAlias);
        const sites = await listSites(authClient);
        return {
          content: [
            {
              type: "text",
              text:
                sites.length > 0
                  ? `Available sites:\n${sites.map((s) => `- ${s}`).join("\n")}`
                  : "No sites found. Make sure you have access to sites in Google Search Console.",
            },
          ],
        };
      }

      case "query_search_analytics": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const params = args as unknown as SearchAnalyticsParams & {
          filters?: Array<{
            dimension: string;
            operator?: string;
            expression: string;
          }>;
        };

        // Build dimension filter groups if filters provided
        const queryParams: SearchAnalyticsParams = {
          siteUrl: params.siteUrl,
          startDate: params.startDate,
          endDate: params.endDate,
          dimensions: params.dimensions,
          rowLimit: params.rowLimit,
        };

        if (params.filters && params.filters.length > 0) {
          queryParams.dimensionFilterGroups = [
            {
              filters: params.filters.map((f) => ({
                dimension: f.dimension,
                operator: f.operator || "contains",
                expression: f.expression,
              })),
            },
          ];
        }

        const result = await querySearchAnalytics(authClient, queryParams);

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No data found for the specified query.",
              },
            ],
          };
        }

        // Format results as a readable table
        const dimensions = params.dimensions || ["query"];
        const header = [...dimensions, "Clicks", "Impressions", "CTR", "Position"].join(
          " | "
        );
        const separator = "-".repeat(header.length);

        const rows = result.rows.map((row) => {
          const keys = row.keys || [];
          const ctr = (row.ctr * 100).toFixed(2) + "%";
          const position = row.position.toFixed(1);
          return [...keys, row.clicks, row.impressions, ctr, position].join(" | ");
        });

        const output = [
          `Search Analytics Results (${result.rows.length} rows)`,
          "",
          header,
          separator,
          ...rows,
        ].join("\n");

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      }

      case "inspect_url": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, inspectionUrl } = args as { siteUrl: string; inspectionUrl: string };
        const result = await inspectUrl(authClient, siteUrl, inspectionUrl);

        const indexStatus = result.inspectionResult.indexStatusResult;
        const mobileUsability = result.inspectionResult.mobileUsabilityResult;
        const richResults = result.inspectionResult.richResultsResult;

        const output = [
          `URL Inspection: ${inspectionUrl}`,
          "",
          "=== Index Status ===",
          `Coverage State: ${indexStatus?.coverageState || "Unknown"}`,
          `Indexing State: ${indexStatus?.indexingState || "Unknown"}`,
          `Page Fetch State: ${indexStatus?.pageFetchState || "Unknown"}`,
          `Robots.txt State: ${indexStatus?.robotsTxtState || "Unknown"}`,
          `Last Crawl: ${indexStatus?.lastCrawlTime || "Unknown"}`,
          `Google Canonical: ${indexStatus?.googleCanonical || "N/A"}`,
          `User Canonical: ${indexStatus?.userCanonical || "N/A"}`,
          "",
          "=== Mobile Usability ===",
          `Verdict: ${mobileUsability?.verdict || "Unknown"}`,
          mobileUsability?.issues?.length
            ? `Issues: ${mobileUsability.issues.map(i => i.issueType).join(", ")}`
            : "No issues found",
          "",
          "=== Rich Results ===",
          `Verdict: ${richResults?.verdict || "Unknown"}`,
          richResults?.detectedItems?.length
            ? `Detected: ${richResults.detectedItems.map(i => i.richResultType).join(", ")}`
            : "No rich results detected",
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "list_sitemaps": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl } = args as { siteUrl: string };
        const sitemaps = await listSitemaps(authClient, siteUrl);

        if (sitemaps.length === 0) {
          return {
            content: [{ type: "text", text: "No sitemaps found for this site." }],
          };
        }

        const output = [
          `Sitemaps for ${siteUrl}`,
          "",
          ...sitemaps.map((s) => [
            `- ${s.path}`,
            `  Last Submitted: ${s.lastSubmitted || "N/A"}`,
            `  Last Downloaded: ${s.lastDownloaded || "N/A"}`,
            `  Status: ${s.isPending ? "Pending" : "Processed"}`,
            `  Errors: ${s.errors ?? 0} | Warnings: ${s.warnings ?? 0}`,
          ].join("\n")),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "find_keyword_opportunities": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, minImpressions, maxCtr, maxPosition } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          minImpressions?: number;
          maxCtr?: number;
          maxPosition?: number;
        };

        const opportunities = await findKeywordOpportunities(
          authClient,
          siteUrl,
          startDate,
          endDate,
          minImpressions,
          maxCtr,
          maxPosition
        );

        if (opportunities.length === 0) {
          return {
            content: [{ type: "text", text: "No keyword opportunities found with the current criteria." }],
          };
        }

        const output = [
          `Keyword Opportunities (${opportunities.length} found)`,
          "These keywords have high impressions but low CTR - optimization potential!",
          "",
          "Query | Impressions | Clicks | CTR | Position | Potential Clicks",
          "-".repeat(70),
          ...opportunities.slice(0, 50).map((o) =>
            `${o.query} | ${o.impressions} | ${o.clicks} | ${(o.ctr * 100).toFixed(2)}% | ${o.position.toFixed(1)} | +${o.potentialClicks}`
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "get_top_pages": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, sortBy, limit } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          sortBy?: "clicks" | "impressions" | "ctr" | "position";
          limit?: number;
        };

        const pages = await getTopPages(authClient, siteUrl, startDate, endDate, sortBy, limit);

        if (pages.length === 0) {
          return {
            content: [{ type: "text", text: "No page data found." }],
          };
        }

        const output = [
          `Top Pages by ${sortBy || "clicks"} (${pages.length} pages)`,
          "",
          "Page | Clicks | Impressions | CTR | Position",
          "-".repeat(80),
          ...pages.map((p) =>
            `${p.page} | ${p.clicks} | ${p.impressions} | ${(p.ctr * 100).toFixed(2)}% | ${p.position.toFixed(1)}`
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "compare_performance": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, currentStartDate, currentEndDate, previousStartDate, previousEndDate, dimension, limit } = args as {
          siteUrl: string;
          currentStartDate: string;
          currentEndDate: string;
          previousStartDate: string;
          previousEndDate: string;
          dimension?: "query" | "page";
          limit?: number;
        };

        const comparisons = await comparePerformance(
          authClient,
          siteUrl,
          currentStartDate,
          currentEndDate,
          previousStartDate,
          previousEndDate,
          dimension,
          limit
        );

        if (comparisons.length === 0) {
          return {
            content: [{ type: "text", text: "No comparison data available." }],
          };
        }

        const output = [
          `Performance Comparison`,
          `Current: ${currentStartDate} to ${currentEndDate}`,
          `Previous: ${previousStartDate} to ${previousEndDate}`,
          "",
          `${dimension || "Query"} | Current Clicks | Prev Clicks | Change | Position Change`,
          "-".repeat(80),
          ...comparisons.map((c) => {
            const changeSign = c.clicksChange >= 0 ? "+" : "";
            const posSign = c.positionChange >= 0 ? "+" : "";
            return `${c.query} | ${c.currentClicks} | ${c.previousClicks} | ${changeSign}${c.clicksChange} (${c.clicksChangePercent.toFixed(1)}%) | ${posSign}${c.positionChange.toFixed(1)}`;
          }),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "analyze_brand_queries": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, brandTerms } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          brandTerms: string[];
        };

        const result = await analyzeBrandQueries(authClient, siteUrl, startDate, endDate, brandTerms);

        const output = [
          `Brand vs Non-Brand Analysis`,
          `Period: ${startDate} to ${endDate}`,
          `Brand terms: ${brandTerms.join(", ")}`,
          "",
          "=== BRANDED QUERIES ===",
          `Total Clicks: ${result.brandedQueries.totalClicks}`,
          `Total Impressions: ${result.brandedQueries.totalImpressions}`,
          `Avg CTR: ${(result.brandedQueries.avgCtr * 100).toFixed(2)}%`,
          `Avg Position: ${result.brandedQueries.avgPosition.toFixed(1)}`,
          `Query Count: ${result.brandedQueries.queryCount}`,
          "",
          "Top Branded Queries:",
          ...result.brandedQueries.topQueries.map((q) => `  - ${q.query}: ${q.clicks} clicks`),
          "",
          "=== NON-BRANDED QUERIES ===",
          `Total Clicks: ${result.nonBrandedQueries.totalClicks}`,
          `Total Impressions: ${result.nonBrandedQueries.totalImpressions}`,
          `Avg CTR: ${(result.nonBrandedQueries.avgCtr * 100).toFixed(2)}%`,
          `Avg Position: ${result.nonBrandedQueries.avgPosition.toFixed(1)}`,
          `Query Count: ${result.nonBrandedQueries.queryCount}`,
          "",
          "Top Non-Branded Queries:",
          ...result.nonBrandedQueries.topQueries.map((q) => `  - ${q.query}: ${q.clicks} clicks`),
          "",
          "=== BRAND PERCENTAGE ===",
          `Clicks from Brand: ${result.brandPercentage.clicks.toFixed(1)}%`,
          `Impressions from Brand: ${result.brandPercentage.impressions.toFixed(1)}%`,
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "get_keyword_trend": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, keyword, startDate, endDate } = args as {
          siteUrl: string;
          keyword: string;
          startDate: string;
          endDate: string;
        };

        const trend = await getKeywordTrend(authClient, siteUrl, keyword, startDate, endDate);

        if (trend.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for keyword "${keyword}"` }],
          };
        }

        const output = [
          `Keyword Trend: "${keyword}"`,
          `Period: ${startDate} to ${endDate}`,
          "",
          "Date | Clicks | Impressions | CTR | Position",
          "-".repeat(60),
          ...trend.map((t) =>
            `${t.date} | ${t.clicks} | ${t.impressions} | ${(t.ctr * 100).toFixed(2)}% | ${t.position.toFixed(1)}`
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "export_analytics": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, dimensions, format, rowLimit, searchType } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          dimensions: string[];
          format: "csv" | "json";
          rowLimit?: number;
          searchType?: "web" | "image" | "video" | "news";
        };

        const exportData = await exportAnalytics(
          authClient,
          siteUrl,
          startDate,
          endDate,
          dimensions,
          format,
          rowLimit,
          searchType
        );

        const output = [
          `Export Complete (${format.toUpperCase()})`,
          `Rows: ${exportData.rowCount}`,
          "",
          "--- DATA START ---",
          exportData.data,
          "--- DATA END ---",
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "query_by_search_appearance": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, searchAppearance, rowLimit } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          searchAppearance: SearchAppearanceType;
          rowLimit?: number;
        };

        const result = await queryBySearchAppearance(
          authClient,
          siteUrl,
          startDate,
          endDate,
          searchAppearance,
          rowLimit
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for search appearance: ${searchAppearance}` }],
          };
        }

        const output = [
          `Search Appearance: ${searchAppearance}`,
          `Period: ${startDate} to ${endDate}`,
          `Results: ${result.rows.length}`,
          "",
          "Query | Clicks | Impressions | CTR | Position",
          "-".repeat(70),
          ...result.rows.map((r) =>
            `${r.keys?.[0] || ""} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(2)}% | ${r.position.toFixed(1)}`
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "query_by_search_type": {
        const authClient = await getAuthenticatedClient(
          (args as Record<string, unknown>)?.account as string | undefined
        );
        const { siteUrl, startDate, endDate, searchType, dimensions, rowLimit } = args as {
          siteUrl: string;
          startDate: string;
          endDate: string;
          searchType: "web" | "image" | "video" | "news" | "discover";
          dimensions?: string[];
          rowLimit?: number;
        };

        const result = await querySearchAnalytics(authClient, {
          siteUrl,
          startDate,
          endDate,
          dimensions: dimensions || ["query"],
          rowLimit: rowLimit || 100,
          searchType,
        });

        if (result.rows.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for search type: ${searchType}` }],
          };
        }

        const dims = dimensions || ["query"];
        const output = [
          `Search Type: ${searchType.toUpperCase()}`,
          `Period: ${startDate} to ${endDate}`,
          `Results: ${result.rows.length}`,
          "",
          `${dims.join(" | ")} | Clicks | Impressions | CTR | Position`,
          "-".repeat(70),
          ...result.rows.map((r) => {
            const keys = r.keys || [];
            return `${keys.join(" | ")} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(2)}% | ${r.position.toFixed(1)}`;
          }),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GSC MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
