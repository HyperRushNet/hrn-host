export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const now = new Date();
  const time = now.toISOString(); // bijv: "2025-07-16T14:20:30.000Z"

  res.status(200).json({ time });
}
