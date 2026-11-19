function pemToBinary(pem: string): ArrayBuffer {
    const cleanPem = pem
        .replace(/["']/g, '')
        .replace(/\\n/g, '')
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/[\s\r\n]+/g, '');
    const binaryString = atob(cleanPem);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function base64UrlEncode(input: string | ArrayBuffer): string {
    let bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new TextEncoder().encode(input);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600;

    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: expiry,
        iat: now,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedJwt = `${encodedHeader}.${encodedClaimSet}`;

    const keyBuffer = pemToBinary(privateKeyPem);
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsignedJwt)
    );

    const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    const data: any = await response.json();
    if (!data.access_token) {
        throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}