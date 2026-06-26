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

    // Check if the token quota is exhausted based on status codes, returned message, or total available points being <= 0
    const message = (data?.message || data?.error?.message || '').toLowerCase();
    const isExhaustedMessage = message.includes('exhausted') || 
                               message.includes('quota') || 
                               message.includes('balance') || 
                               message.includes('insufficient') || 
                               message.includes('额度') || 
                               message.includes('用尽') ||
                               message.includes('point');

    const isExhaustedStatus = [401, 402, 403, 429].includes(apiResponse.status);
    const hasNoAvailablePoints = data?.success === true && data?.data && typeof data?.data?.total_available === 'number' && data?.data?.total_available <= 0;

    if (isExhaustedStatus || isExhaustedMessage || hasNoAvailablePoints) {
      return res.status(403).json({
        error: {
          message: "该令牌额度已用尽 (request id: 20260622164054695403138c96lrRzi)",
          type: "new_api_error"
        }
      });
    }

    return res.status(apiResponse.status).json(data);
  } catch (error) {
    console.error('Error proxying balance request:', error);
    
    const errorStr = (error.message || '').toLowerCase();
    if (errorStr.includes('exhausted') || errorStr.includes('quota') || errorStr.includes('balance') || errorStr.includes('额度') || errorStr.includes('用尽')) {
      return res.status(403).json({
        error: {
          message: "该令牌额度已用尽 (request id: 20260622164054695403138c96lrRzi)",
          type: "new_api_error"
        }
      });
    }

    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
}
