import { Router } from 'express';
import { getFeeds } from '../lib/companion-feeds';
import { getWeather } from '../lib/companion-weather';
import { parsePoints } from '../lib/weather-normalize';
import { fireDistrictAt } from '../lib/fire-district';
import { GetCompanionFireDistrictQueryParams } from '@workspace/api-zod';

const router = Router();
router.get('/companion/fire-district', async (req, res) => {
  const latitude = req.query.latitude, longitude = req.query.longitude;
  if (typeof latitude !== 'string' || !latitude.trim() || typeof longitude !== 'string' || !longitude.trim()) {
    res.status(400).json({ error: 'Provide a valid latitude and longitude.' }); return;
  }
  const parsed = GetCompanionFireDistrictQueryParams.safeParse({ latitude, longitude });
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a valid latitude and longitude.' }); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(await fireDistrictAt(parsed.data.latitude, parsed.data.longitude));
});
router.get('/companion/weather', async (req, res) => {
  let points;
  try { points = parsePoints(req.query.points); }
  catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid sample points.' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getWeather(points));
});
router.get('/companion/feeds', async (_req, res) => {
  const data = await getFeeds();
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
});
export default router;
