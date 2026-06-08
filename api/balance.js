export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let token = '';

    // 1. Try Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Try body (if POST)
    if (!token && req.body && req.body.apiKey) {
      token = req.body.apiKey;
    }

    // 3. Try query param
    if (!token && req.query && req.query.apiKey) {
      token = req.query.apiKey;
    }

    if (!token) {
      return res.status(400).json({ success: false, message: 'API key is required' });
    }

    console.log('Proxying request to vectorengine for token...');

    // Make the actual GET request to Vectorengine API
    const apiResponse = await fetch('https://api.vectorengine.cn/api/usage/token/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await apiResponse.json();
    return res.status(apiResponse.status).json(data);
  } catch (error) {
    console.error('Error proxying balance request:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
