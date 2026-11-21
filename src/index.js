// Cloudflare Worker for Hedgile
// Serves the static site

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      // Serve index.html for root path
      if (url.pathname === '/') {
        return await handleRequest(request, '/index.html');
      }
      
      // Serve static files
      return await handleRequest(request, url.pathname);
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
};

async function handleRequest(request, path) {
  // In development with wrangler dev, use the local filesystem
  // In production, use the Workers Sites bucket
  
  // For now, we'll serve from the public directory
  const filePath = `/public${path}`;
  
  try {
    // This is a simplified version - in actual Cloudflare Workers with Sites,
    // the files are available through the bucket API
    const file = await fetch(`file:${filePath}`);
    if (!file.ok) {
      throw new Error('File not found');
    }
    return file;
  } catch (err) {
    // Fallback: serve index.html for SPA routing
    if (path !== '/index.html') {
      return handleRequest(request, '/index.html');
    }
    return new Response('Not found', { status: 404 });
  }
}
