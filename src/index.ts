import { getAccessToken } from './auth';
import { fetchGA4Data } from './ga4';

export interface Env {
    GA4_CLIENT_EMAIL: string;
    GA4_PRIVATE_KEY: string;
    SITES_CONFIG: string;
    DB: D1Database;
}

interface SiteConfig {
    name: string;
    propertyId: string;
}

interface AnalyticsRecord {
    propertyId: string;
    name: string;
    date: string;
    pageViews: number;
    activeUsers: number;
    sessions: number;
}

export default {
    // Cron Triggers による自動実行
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(handleAggregate(env));
    },

    // HTTPリクエストのハンドラー
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return handleCorsPreflightResponse();
        }

        // 1. 手動バッチ実行エンドポイント (POST /run)
        if (url.pathname === '/run' && request.method === 'POST') {
            try {
                const results = await handleAggregate(env);
                return createCorsResponse({ success: true, results });
            } catch (error: any) {
                return createCorsResponse({ success: false, error: error.message }, 500);
            }
        }

        // 2. Reactフロントエンド向け データ取得エンドポイント (GET /api/stats)
        if (url.pathname === '/api/stats' && request.method === 'GET') {
            try {
                const propertyId = url.searchParams.get('property_id');
                const startDate = url.searchParams.get('start_date');
                const endDate = url.searchParams.get('end_date');
                const limit = url.searchParams.get('limit') || '30';

                let query = `SELECT * FROM daily_analytics WHERE 1=1`;
                const params: any[] = [];

                if (propertyId) {
                    query += ` AND property_id = ?`;
                    params.push(propertyId);
                }
                if (startDate) {
                    query += ` AND target_date >= ?`;
                    params.push(startDate);
                }
                if (endDate) {
                    query += ` AND target_date <= ?`;
                    params.push(endDate);
                }

                query += ` ORDER BY target_date DESC LIMIT ?`;
                params.push(parseInt(limit, 10));

                const { results } = await env.DB.prepare(query).bind(...params).all();

                return createCorsResponse({ success: true, data: results });
            } catch (error: any) {
                return createCorsResponse({ success: false, error: error.message }, 500);
            }
        }

        return createCorsResponse({ message: 'GA4 Crawler Worker is running.' }, 200);
    },
};

// --- メイン集計ロジック ---
async function handleAggregate(env: Env) {
    const sites: SiteConfig[] = JSON.parse(env.SITES_CONFIG);
    const accessToken = await getAccessToken(env.GA4_CLIENT_EMAIL, env.GA4_PRIVATE_KEY);
    const targetDate = getYesterdayDateString();

    const records: AnalyticsRecord[] = [];

    for (const site of sites) {
        try {
            const gaData = await fetchGA4Data(accessToken, site.propertyId, targetDate);
            const metrics = extractMetrics(gaData);

            records.push({
                propertyId: site.propertyId,
                name: site.name,
                date: targetDate,
                ...metrics,
            });

            await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error: any) {
            console.error(`Failed to fetch for ${site.name}:`, error.message);
        }
    }

    if (records.length > 0) {
        await saveAnalyticsToD1(env.DB, records);
    }

    return records;
}

// --- データベース保存 (UPSERT) ---
async function saveAnalyticsToD1(db: D1Database, records: AnalyticsRecord[]) {
    const query = `
    INSERT INTO daily_analytics (property_id, site_name, target_date, page_views, active_users, sessions, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(property_id, target_date) 
    DO UPDATE SET 
      page_views = excluded.page_views,
      active_users = excluded.active_users,
      sessions = excluded.sessions,
      updated_at = CURRENT_TIMESTAMP;
  `;

    const statements = records.map((record) => {
        return db.prepare(query).bind(
            record.propertyId,
            record.name,
            record.date,
            record.pageViews,
            record.activeUsers,
            record.sessions
        );
    });

    await db.batch(statements);
}

// --- ヘルパー関数 ---
function getYesterdayDateString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function extractMetrics(responseJson: any) {
    if (!responseJson.rows || responseJson.rows.length === 0) {
        return { pageViews: 0, activeUsers: 0, sessions: 0 };
    }
    const row = responseJson.rows[0];
    return {
        pageViews: parseInt(row.metricValues[0].value, 10) || 0,
        activeUsers: parseInt(row.metricValues[1].value, 10) || 0,
        sessions: parseInt(row.metricValues[2].value, 10) || 0,
    };
}

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function handleCorsPreflightResponse(): Response {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
}

function createCorsResponse(data: any, status = 200): Response {
    return Response.json(data, {
        status,
        headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
    });
}