export default function handler(req, res) {
  const now = new Date();
  const time = now.toISOString(); // bijv: "2025-07-16T14:20:30.000Z"

  res.status(200).json({ time });
}
