export async function fetchGA4Data(accessToken: string, propertyId: string, targetDate: string) {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            dateRanges: [
                { startDate: targetDate, endDate: targetDate }
            ],
            dimensions: [
                { name: 'date' }
            ],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'activeUsers' },
                { name: 'sessions' }
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
}