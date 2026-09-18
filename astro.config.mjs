import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://heritage.illyrianbrains.org',
  output: 'static',
});
