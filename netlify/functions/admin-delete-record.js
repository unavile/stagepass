// netlify/functions/admin-delete-record.js
// Deletes a record using service role key to bypass RLS
// Used by AdminPortal for event deletion and other admin delete operations

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { table, id } = JSON.parse(event.body)

    if (!table || !id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing table or id' }) }
    }

    // Whitelist allowed tables for safety
    const allowedTables = ['events', 'posts', 'rsvps', 'ticket_purchases']
    if (!allowedTables.includes(table)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Table '${table}' is not allowed` }) }
    }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const res = await fetch(`${sbUrl}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Prefer': 'return=minimal',
      },
    })

    if (!res.ok && res.status !== 204) {
      const err = await res.text()
      console.error('Delete failed:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Delete failed: ${err}` }) }
    }

    console.log(`Deleted ${table} id=${id}`)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('admin-delete-record error:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
