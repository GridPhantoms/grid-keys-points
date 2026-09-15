import type { MetadataRoute } from 'next';

const SITE_URL = 'https://gridphantoms.app';

const routes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/engine', changeFrequency: 'daily', priority: 0.9 },
  { path: '/bytes', changeFrequency: 'daily', priority: 0.9 },
  { path: '/citizen', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/citizen/lab', changeFrequency: 'daily', priority: 0.8 },
  { path: '/citizen/bytes2bytes', changeFrequency: 'daily', priority: 0.8 },
  { path: '/citizen/holders', changeFrequency: 'daily', priority: 0.8 },
  { path: '/citizen/market', changeFrequency: 'daily', priority: 0.8 },
  { path: '/leaderboard', changeFrequency: 'daily', priority: 0.8 },
  { path: '/trait-charts', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/raffle', changeFrequency: 'daily', priority: 0.7 },
  { path: '/mint-progress', changeFrequency: 'daily', priority: 0.7 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
