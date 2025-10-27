// Server-side proxy to Thesys API
// Keep your THESYS_API_KEY secret (do NOT expose it to client).
// Expects environment variables:
// - THESYS_API_KEY
// - THESYS_API_URL (e.g. https://api.thesys.ai/v1/generate)
// Adjust payload/response mapping to match Thesys docs if needed.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const THESYS_API_KEY = process.env.THESYS_API_KEY;
  const THESYS_API_URL = process.env.THESYS_API_URL;

  if (!THESYS_API_KEY || !THESYS_API_URL) {
    return res.status(500).json({ error: 'Thesys API key or URL not configured on server' });
  }

  try {
    // Forward the client body directly. If Thesys needs a different shape, we'll adapt here.
    const upstreamResp = await fetch(THESYS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${THESYS_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const contentType = upstreamResp.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await upstreamResp.json();
      return res.status(upstreamResp.status).json(data);
    } else {
      // fallback to text (and propagate content-type)
      const text = await upstreamResp.text();
      res.setHeader('content-type', contentType);
      return res.status(upstreamResp.status).send(text);
    }
  } catch (err) {
    console.error('Error proxying to Thesys:', err);
    return res.status(500).json({ error: 'Error contacting Thesys API' });
  }
}