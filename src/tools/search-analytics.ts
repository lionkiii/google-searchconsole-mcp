import { google, searchconsole_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface SearchAnalyticsParams {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: string;
      operator?: string;
      expression: string;
    }>;
  }>;
  // Search type: web, image, video, news, discover, googleNews
  searchType?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  // Data type for aggregation
  dataState?: "all" | "final";
}

// Search Appearance types
export type SearchAppearanceType =
  | "AMP_BLUE_LINK"
  | "AMP_TOP_STORIES"
  | "BREADCRUMB"
  | "DISCOUNT"
  | "EVENT"
  | "FAQ"
  | "HOWTO"
  | "IMAGE_PACK"
  | "JOB_LISTING"
  | "JOB_DETAILS"
  | "LEARNING_VIDEO"
  | "MERCHANT_LISTINGS"
  | "ORGANIZATION"
  | "PRODUCT_SNIPPETS"
  | "RECIPE_FEATURE"
  | "RECIPE_RICH_SNIPPET"
  | "REVIEW_SNIPPET"
  | "SHOPPING_ADS"
  | "SITELINKS"
  | "VIDEO"
  | "WEB_LIGHT"
  | "WEB_STORY";

export interface SearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsResult {
  rows: SearchAnalyticsRow[];
  responseAggregationType?: string;
}

export async function querySearchAnalytics(
  auth: OAuth2Client,
  params: SearchAnalyticsParams
): Promise<SearchAnalyticsResult> {
  const searchConsole = google.searchconsole({ version: "v1", auth });

  const requestBody: searchconsole_v1.Schema$SearchAnalyticsQueryRequest = {
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: params.dimensions || ["query"],
    rowLimit: params.rowLimit || 1000,
    startRow: params.startRow || 0,
  };

  if (params.dimensionFilterGroups) {
    requestBody.dimensionFilterGroups = params.dimensionFilterGroups;
  }

  // Add search type filter (web, image, video, news, discover, googleNews)
  if (params.searchType) {
    requestBody.type = params.searchType;
  }

  // Add data state filter
  if (params.dataState) {
    requestBody.dataState = params.dataState;
  }

  const response = await searchConsole.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody,
  });

  const rows: SearchAnalyticsRow[] = (response.data.rows || []).map((row) => ({
    keys: row.keys ?? undefined,
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

  return {
    rows,
    responseAggregationType: response.data.responseAggregationType || undefined,
  };
}

export async function listSites(auth: OAuth2Client): Promise<string[]> {
  const searchConsole = google.searchconsole({ version: "v1", auth });

  const response = await searchConsole.sites.list();

  return (response.data.siteEntry || [])
    .map((site) => site.siteUrl)
    .filter((url): url is string => url !== undefined);
}

// URL Inspection
export interface UrlInspectionResult {
  inspectionResult: {
    indexStatusResult?: {
      coverageState?: string;
      robotsTxtState?: string;
      indexingState?: string;
      lastCrawlTime?: string;
      pageFetchState?: string;
      googleCanonical?: string;
      userCanonical?: string;
    };
    mobileUsabilityResult?: {
      verdict?: string;
      issues?: Array<{ issueType?: string; message?: string }>;
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: Array<{ richResultType?: string }>;
    };
  };
}

export async function inspectUrl(
  auth: OAuth2Client,
  siteUrl: string,
  inspectionUrl: string
): Promise<UrlInspectionResult> {
  const searchConsole = google.searchconsole({ version: "v1", auth });

  const response = await searchConsole.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl,
      siteUrl,
    },
  });

  const indexStatus = response.data.inspectionResult?.indexStatusResult;
  const mobileUsability = response.data.inspectionResult?.mobileUsabilityResult;
  const richResults = response.data.inspectionResult?.richResultsResult;

  return {
    inspectionResult: {
      indexStatusResult: indexStatus ? {
        coverageState: indexStatus.coverageState ?? undefined,
        robotsTxtState: indexStatus.robotsTxtState ?? undefined,
        indexingState: indexStatus.indexingState ?? undefined,
        lastCrawlTime: indexStatus.lastCrawlTime ?? undefined,
        pageFetchState: indexStatus.pageFetchState ?? undefined,
        googleCanonical: indexStatus.googleCanonical ?? undefined,
        userCanonical: indexStatus.userCanonical ?? undefined,
      } : undefined,
      mobileUsabilityResult: mobileUsability ? {
        verdict: mobileUsability.verdict ?? undefined,
        issues: mobileUsability.issues?.map(i => ({
          issueType: i.issueType ?? undefined,
          message: i.message ?? undefined,
        })),
      } : undefined,
      richResultsResult: richResults ? {
        verdict: richResults.verdict ?? undefined,
        detectedItems: richResults.detectedItems?.map(i => ({
          richResultType: i.richResultType ?? undefined,
        })),
      } : undefined,
    },
  };
}

// Sitemaps
export interface SitemapInfo {
  path: string;
  lastSubmitted?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastDownloaded?: string;
  warnings?: number;
  errors?: number;
}

export async function listSitemaps(
  auth: OAuth2Client,
  siteUrl: string
): Promise<SitemapInfo[]> {
  const searchConsole = google.searchconsole({ version: "v1", auth });

  const response = await searchConsole.sitemaps.list({
    siteUrl,
  });

  return (response.data.sitemap || []).map((sitemap) => ({
    path: sitemap.path || "",
    lastSubmitted: sitemap.lastSubmitted || undefined,
    isPending: sitemap.isPending || false,
    isSitemapsIndex: sitemap.isSitemapsIndex || false,
    lastDownloaded: sitemap.lastDownloaded || undefined,
    warnings: sitemap.warnings ? Number(sitemap.warnings) : undefined,
    errors: sitemap.errors ? Number(sitemap.errors) : undefined,
  }));
}

// Keyword Opportunities - finds high impression, low CTR keywords
export interface KeywordOpportunity {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  potentialClicks: number;
}

export async function findKeywordOpportunities(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  minImpressions: number = 100,
  maxCtr: number = 0.03,
  maxPosition: number = 20
): Promise<KeywordOpportunity[]> {
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 5000,
  });

  // Filter for opportunities: high impressions, low CTR, decent position
  const opportunities = result.rows
    .filter(
      (row) =>
        row.impressions >= minImpressions &&
        row.ctr <= maxCtr &&
        row.position <= maxPosition
    )
    .map((row) => ({
      query: row.keys?.[0] || "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      // Estimate potential clicks if CTR improved to average (5%)
      potentialClicks: Math.round(row.impressions * 0.05) - row.clicks,
    }))
    .sort((a, b) => b.potentialClicks - a.potentialClicks);

  return opportunities;
}

// Top Pages Report
export interface PagePerformance {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getTopPages(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  sortBy: "clicks" | "impressions" | "ctr" | "position" = "clicks",
  limit: number = 50
): Promise<PagePerformance[]> {
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit,
  });

  const pages = result.rows.map((row) => ({
    page: row.keys?.[0] || "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  // Sort based on sortBy parameter
  switch (sortBy) {
    case "impressions":
      return pages.sort((a, b) => b.impressions - a.impressions);
    case "ctr":
      return pages.sort((a, b) => b.ctr - a.ctr);
    case "position":
      return pages.sort((a, b) => a.position - b.position);
    default:
      return pages.sort((a, b) => b.clicks - a.clicks);
  }
}

// Compare periods
export interface PeriodComparison {
  query: string;
  currentClicks: number;
  previousClicks: number;
  clicksChange: number;
  clicksChangePercent: number;
  currentImpressions: number;
  previousImpressions: number;
  impressionsChange: number;
  currentPosition: number;
  previousPosition: number;
  positionChange: number;
}

export async function comparePerformance(
  auth: OAuth2Client,
  siteUrl: string,
  currentStartDate: string,
  currentEndDate: string,
  previousStartDate: string,
  previousEndDate: string,
  dimension: "query" | "page" = "query",
  limit: number = 50
): Promise<PeriodComparison[]> {
  const [currentData, previousData] = await Promise.all([
    querySearchAnalytics(auth, {
      siteUrl,
      startDate: currentStartDate,
      endDate: currentEndDate,
      dimensions: [dimension],
      rowLimit: 1000,
    }),
    querySearchAnalytics(auth, {
      siteUrl,
      startDate: previousStartDate,
      endDate: previousEndDate,
      dimensions: [dimension],
      rowLimit: 1000,
    }),
  ]);

  // Create maps for easy lookup
  const previousMap = new Map(
    previousData.rows.map((row) => [row.keys?.[0] || "", row])
  );

  const comparisons: PeriodComparison[] = currentData.rows
    .map((current) => {
      const key = current.keys?.[0] || "";
      const previous = previousMap.get(key);

      return {
        query: key,
        currentClicks: current.clicks,
        previousClicks: previous?.clicks || 0,
        clicksChange: current.clicks - (previous?.clicks || 0),
        clicksChangePercent: previous?.clicks
          ? ((current.clicks - previous.clicks) / previous.clicks) * 100
          : 100,
        currentImpressions: current.impressions,
        previousImpressions: previous?.impressions || 0,
        impressionsChange: current.impressions - (previous?.impressions || 0),
        currentPosition: current.position,
        previousPosition: previous?.position || 0,
        positionChange: (previous?.position || current.position) - current.position,
      };
    })
    .sort((a, b) => Math.abs(b.clicksChange) - Math.abs(a.clicksChange))
    .slice(0, limit);

  return comparisons;
}

// Brand vs Non-Brand Analysis
export interface BrandAnalysisResult {
  brandedQueries: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    queryCount: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  };
  nonBrandedQueries: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    queryCount: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  };
  brandPercentage: {
    clicks: number;
    impressions: number;
  };
}

export async function analyzeBrandQueries(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  brandTerms: string[]
): Promise<BrandAnalysisResult> {
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 10000,
  });

  const brandTermsLower = brandTerms.map((t) => t.toLowerCase());

  const branded: SearchAnalyticsRow[] = [];
  const nonBranded: SearchAnalyticsRow[] = [];

  for (const row of result.rows) {
    const query = (row.keys?.[0] || "").toLowerCase();
    const isBranded = brandTermsLower.some((term) => query.includes(term));
    if (isBranded) {
      branded.push(row);
    } else {
      nonBranded.push(row);
    }
  }

  const sumStats = (rows: SearchAnalyticsRow[]) => {
    const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
    const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length
        : 0;
    return { totalClicks, totalImpressions, avgCtr, avgPosition };
  };

  const brandedStats = sumStats(branded);
  const nonBrandedStats = sumStats(nonBranded);
  const totalClicks = brandedStats.totalClicks + nonBrandedStats.totalClicks;
  const totalImpressions = brandedStats.totalImpressions + nonBrandedStats.totalImpressions;

  return {
    brandedQueries: {
      ...brandedStats,
      queryCount: branded.length,
      topQueries: branded
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((r) => ({
          query: r.keys?.[0] || "",
          clicks: r.clicks,
          impressions: r.impressions,
        })),
    },
    nonBrandedQueries: {
      ...nonBrandedStats,
      queryCount: nonBranded.length,
      topQueries: nonBranded
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((r) => ({
          query: r.keys?.[0] || "",
          clicks: r.clicks,
          impressions: r.impressions,
        })),
    },
    brandPercentage: {
      clicks: totalClicks > 0 ? (brandedStats.totalClicks / totalClicks) * 100 : 0,
      impressions: totalImpressions > 0 ? (brandedStats.totalImpressions / totalImpressions) * 100 : 0,
    },
  };
}

// Keyword Trend Over Time
export interface KeywordTrendPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getKeywordTrend(
  auth: OAuth2Client,
  siteUrl: string,
  keyword: string,
  startDate: string,
  endDate: string
): Promise<KeywordTrendPoint[]> {
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["date", "query"],
    rowLimit: 25000,
    dimensionFilterGroups: [
      {
        filters: [
          {
            dimension: "query",
            operator: "equals",
            expression: keyword,
          },
        ],
      },
    ],
  });

  // Extract date-based data points
  const trendData: KeywordTrendPoint[] = result.rows.map((row) => ({
    date: row.keys?.[0] || "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  // Sort by date
  return trendData.sort((a, b) => a.date.localeCompare(b.date));
}

// Export Analytics Data
export interface ExportData {
  format: "csv" | "json";
  data: string;
  rowCount: number;
}

export async function exportAnalytics(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  format: "csv" | "json",
  rowLimit: number = 1000,
  searchType?: "web" | "image" | "video" | "news"
): Promise<ExportData> {
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions,
    rowLimit,
    searchType,
  });

  if (format === "json") {
    const jsonData = result.rows.map((row) => {
      const obj: Record<string, string | number> = {};
      dimensions.forEach((dim, i) => {
        obj[dim] = row.keys?.[i] || "";
      });
      obj.clicks = row.clicks;
      obj.impressions = row.impressions;
      obj.ctr = row.ctr;
      obj.position = row.position;
      return obj;
    });

    return {
      format: "json",
      data: JSON.stringify(jsonData, null, 2),
      rowCount: result.rows.length,
    };
  }

  // CSV format
  const headers = [...dimensions, "clicks", "impressions", "ctr", "position"];
  const csvRows = [headers.join(",")];

  for (const row of result.rows) {
    const values = [
      ...dimensions.map((_, i) => `"${(row.keys?.[i] || "").replace(/"/g, '""')}"`),
      row.clicks.toString(),
      row.impressions.toString(),
      row.ctr.toFixed(4),
      row.position.toFixed(2),
    ];
    csvRows.push(values.join(","));
  }

  return {
    format: "csv",
    data: csvRows.join("\n"),
    rowCount: result.rows.length,
  };
}

// Query by Search Appearance (rich results, AMP, etc.)
export async function queryBySearchAppearance(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  searchAppearance: SearchAppearanceType,
  rowLimit: number = 100
): Promise<SearchAnalyticsResult> {
  // Search appearance is filtered using the searchAppearance dimension
  const result = await querySearchAnalytics(auth, {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["query", "searchAppearance"],
    rowLimit: rowLimit * 10, // Get more to filter
  });

  // Filter by search appearance type
  const filteredRows = result.rows.filter((row) => {
    const appearance = row.keys?.[1];
    return appearance === searchAppearance;
  });

  return {
    rows: filteredRows.slice(0, rowLimit).map((row) => ({
      keys: [row.keys?.[0] || ""], // Just return query
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })),
    responseAggregationType: result.responseAggregationType,
  };
}
