// Quick test: Login as admin, list tickets, test SEO PUT
const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (global.TOKEN) opts.headers['Authorization'] = `Bearer ${global.TOKEN}`;
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // 1. Verify email first
    const verify = await request('POST', '/api/auth/verify-email', { email: 'admin@agency.com' });
    console.log('Verify:', JSON.stringify(verify));

    // Login with password
    const login = await request('POST', '/api/auth/login', { email: 'admin@agency.com', password: 'admin123' });
    console.log('Login:', login.token ? 'OK' : 'FAILED', login.error || '');
    if (!login.token) {
      // Try without password
      const login2 = await request('POST', '/api/auth/login', { email: 'admin@agency.com', password: 'Ahmed@20302030' });
      console.log('Login2:', login2.token ? 'OK' : 'FAILED', login2.error || '');
      if (!login2.token) return;
      global.TOKEN = login2.token;
    } else {
      global.TOKEN = login.token;
    }

    // 2. Get tickets
    const tickets = await request('GET', '/api/staff/tickets');
    console.log('Tickets count:', Array.isArray(tickets) ? tickets.length : 'ERROR');
    if (!Array.isArray(tickets) || tickets.length === 0) {
      console.log('No tickets found');
      return;
    }
    const ticketId = tickets[0].id;
    console.log('Using ticket:', ticketId, 'stage:', tickets[0].stage);

    // 3. GET SEO checklist
    const seo = await request('GET', `/api/tickets/${ticketId}/seo-checklist`);
    console.log('SEO GET:', JSON.stringify(seo, null, 2));

    // 4. PUT SEO checklist with test data
    const testData = {
      nicheSelected: true,
      domainChosen: true,
      domainName: 'test-domain.com',
      gmailCreated: true,
      gmailEmail: 'test@gmail.com',
      gmailPassword: 'testpass123',
      sallaAccountCreated: true,
      sallaEmail: 'test@salla.com',
      sallaPassword: 'sallapass123',
      packageUpgraded: true,
      packageType: 'برو',
    };
    console.log('\nSending PUT with:', Object.keys(testData));
    const putResult = await request('PUT', `/api/tickets/${ticketId}/seo-checklist`, testData);
    console.log('SEO PUT result:', JSON.stringify(putResult, null, 2));

    // 5. GET again to verify persistence
    const seo2 = await request('GET', `/api/tickets/${ticketId}/seo-checklist`);
    console.log('\nSEO GET after save:');
    console.log('  sallaEmail:', seo2?.sallaEmail);
    console.log('  sallaPassword:', seo2?.sallaPassword);
    console.log('  packageType:', seo2?.packageType);
    console.log('  gmailEmail:', seo2?.gmailEmail);
    console.log('  domainName:', seo2?.domainName);
    console.log('  nicheSelected:', seo2?.nicheSelected);

  } catch (err) {
    console.error('Test error:', err);
  }
})();
