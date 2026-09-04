// Handles visitor photo uploads, storing them in a separate "Photos" table
// in the same Airtable base so photo moderation is independent of site
// moderation. Runs on Netlify's servers, same as sites.js, so the Airtable
// token never reaches the visitor's browser.

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const PHOTOS_TABLE = process.env.AIRTABLE_PHOTOS_TABLE || 'Photos';
const TOKEN = process.env.AIRTABLE_TOKEN;

const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(PHOTOS_TABLE)}`;

exports.handler = async function (event) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Loading approved photos for the map
    if (event.httpMethod === 'GET') {
      const url = `${AIRTABLE_URL}?filterByFormula=${encodeURIComponent('{approved}=TRUE()')}`;
      const res = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok) {
        return { statusCode: res.status, body: JSON.stringify(data) };
      }

      const photos = (data.records || [])
        .filter((r) => r.fields.image && r.fields.image.length)
        .map((r) => ({
          siteId: r.fields.site || '',
          url: (r.fields.image[0].thumbnails && r.fields.image[0].thumbnails.large
            ? r.fields.image[0].thumbnails.large.url
            : r.fields.image[0].url)
        }));

      return { statusCode: 200, body: JSON.stringify(photos) };
    }

    // Saving a new visitor photo, pending review
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      if (!body.siteId || !body.imageBase64) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing siteId or image' }) };
      }

      // Step 1: create the record (unapproved) so we have somewhere to attach the image
      const createRes = await fetch(AIRTABLE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: [
            {
              fields: {
                site: body.siteId,
                submitter: body.submitter || '',
                approved: false
              }
            }
          ]
        })
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        return { statusCode: createRes.status, body: JSON.stringify(createData) };
      }

      const recordId = createData.records[0].id;

      // Step 2: upload the actual image bytes to that record's attachment field
      const uploadRes = await fetch(
        `https://content.airtable.com/v0/${BASE_ID}/${recordId}/image/uploadAttachment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contentType: body.contentType || 'image/jpeg',
            file: body.imageBase64,
            filename: body.filename || 'photo.jpg'
          })
        }
      );
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        return { statusCode: uploadRes.status, body: JSON.stringify(uploadData) };
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
