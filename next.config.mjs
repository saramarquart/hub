/**
 * No `output: 'export'` any more.
 *
 * The hub used to be a static export served by GitHub Pages. It now signs
 * people in with Google and reads tile visibility out of Postgres, and neither
 * is possible in a bundle of pre-rendered HTML — a static export has no request
 * to read a cookie from. Re-adding `output: 'export'` would not fail the build;
 * it would drop middleware.ts and the /auth routes from the output and publish
 * the signed-in grid to anonymous visitors.
 */
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };

export default nextConfig;
