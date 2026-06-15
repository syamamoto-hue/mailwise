const URL   = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
const KEY   = 'mailwise-db';

async function kvGet() {
  const res = await fetch(`${URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const { result } = await res.json();
  return result ? JSON.parse(result) : {};
}

async function kvSet(value) {
  await fetch(`${URL}/set/${KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(value))
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await kvGet();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    await kvSet(req.body);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
