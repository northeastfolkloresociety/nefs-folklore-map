// This runs on Netlify's servers, never in the visitor's browser.
// That's what keeps the Airtable token hidden from anyone viewing the page source.

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const TOKEN = process.env.AIRTABLE_TOKEN;

const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

exports.handler = async function (event) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Loading all sites onto the map
    if (event.httpMethod === 'GET') {
      const res = await fetch(AIRTABLE_URL, { headers });
      const data = await res.json();

      if (!res.ok) {
        return { statusCode: res.status, body: JSON.stringify(data) };
      }

      const sites = (data.records || []).map((r) => ({
        id: r.id,
        name: r.fields.name || '',
        category: r.fields.category || '',
        desc: r.fields.description || '',
        lat: r.fields.lat,
        lng: r.fields.lng,
        submitter: r.fields.submitter || '',
        approved: !!r.fields.approved
      }));

      return { statusCode: 200, body: JSON.stringify(sites) };
    }

    // Saving a new suggested site
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const payload = {
        records: [
          {
            fields: {
              name: body.name,
              category: body.category,
              description: body.desc,
              lat: body.lat,
              lng: body.lng,
              submitter: body.submitter || '',
              approved: false
            }
          }
        ]
      };

      const res = await fetch(AIRTABLE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      return { statusCode: res.ok ? 200 : res.status, body: JSON.stringify(data) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
