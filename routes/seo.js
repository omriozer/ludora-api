import express from 'express';
import EntityService from '../services/EntityService.js';
import { ludlog } from '../lib/ludlog.js';

const router = express.Router();

/**
 * Generate XML sitemap for search engines
 * Returns all published products with proper metadata
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    ludlog.api('Generating XML sitemap');

    // Get all published products from the database
    const products = await EntityService.find('product', {
      is_published: true
    }, {
      include: ['creator'] // Include creator for better SEO
    });

    // Base URLs for different portals
    const baseUrl = 'https://ludora.app';
    const studentBaseUrl = 'https://my.ludora.app';

    // Generate sitemap XML
    const sitemap = generateSitemapXML([
      // Homepage and main pages
      {
        url: baseUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '1.0'
      },
      {
        url: `${baseUrl}/catalog`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.9'
      },
      {
        url: `${baseUrl}/games`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.8'
      },
      {
        url: `${baseUrl}/files`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.8'
      },
      {
        url: `${baseUrl}/lesson-plans`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.8'
      },
      {
        url: `${baseUrl}/workshops`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.7'
      },
      {
        url: `${baseUrl}/courses`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.7'
      },
      // Legal pages
      {
        url: `${baseUrl}/privacy`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.3'
      },
      {
        url: `${baseUrl}/terms`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.3'
      },
      {
        url: `${baseUrl}/accessibility`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.3'
      },
      {
        url: `${baseUrl}/contact`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: '0.4'
      },
      // Student portal home
      {
        url: studentBaseUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: '0.7'
      },
      // Product pages
      ...products.map(product => {
        const productUrl = getProductUrl(product, baseUrl);
        return {
          url: productUrl,
          lastmod: product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          changefreq: getChangeFrequency(product.product_type),
          priority: getPriority(product.product_type)
        };
      })
    ]);

    ludlog.api(`Generated sitemap with ${products.length + 12} URLs`);

    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600', // 1 hour cache
      'X-Robots-Tag': 'noindex' // Don't index the sitemap itself
    });

    res.send(sitemap);

  } catch (error) {
    ludlog.api('Error generating sitemap:', error);
    res.status(500).json({
      error: 'Failed to generate sitemap',
      message: error.message
    });
  }
});

/**
 * Generate robots.txt dynamically
 * Serves robots.txt with environment-specific rules
 */
router.get('/robots.txt', async (req, res) => {
  try {
    const environment = process.env.NODE_ENV || 'development';
    const baseUrl = req.get('host')?.includes('my.ludora') ? 'https://my.ludora.app' : 'https://ludora.app';

    let robotsTxt = '';

    if (environment === 'production') {
      // Production robots.txt - allow crawling
      robotsTxt = `# Robots.txt for Ludora Educational Platform (Production)
# Generated dynamically - ${new Date().toISOString()}

User-agent: *
Allow: /

# Block access to admin and private areas
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/
Disallow: /_app/
Disallow: /_next/
Disallow: /auth/
Disallow: /logout/
Disallow: /login/
Disallow: /error/
Disallow: /404/
Disallow: /500/

# Block access to private student portals
Disallow: /my/
Disallow: /portal/*/private/
Disallow: /lobby/*/admin/

# Allow access to public pages
Allow: /
Allow: /privacy
Allow: /terms
Allow: /contact
Allow: /accessibility
Allow: /games
Allow: /curriculum
Allow: /files
Allow: /lesson-plans
Allow: /public/

# Special rules for different user agents
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Block aggressive crawlers
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

# Sitemap location
Sitemap: ${baseUrl}/api/seo/sitemap.xml

# Crawl delay
Crawl-delay: 1`;

    } else {
      // Development/staging - block all crawling
      robotsTxt = `# Robots.txt for Ludora Educational Platform (${environment})
# Generated dynamically - ${new Date().toISOString()}

User-agent: *
Disallow: /

# Development environment - no crawling allowed
# Sitemap: ${baseUrl}/api/seo/sitemap.xml`;
    }

    res.set({
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400' // 24 hour cache
    });

    res.send(robotsTxt);

  } catch (error) {
    ludlog.api('Error generating robots.txt:', error);
    res.status(500).send('# Error generating robots.txt');
  }
});

/**
 * Generate sitemap in JSON format for debugging
 */
router.get('/sitemap.json', async (req, res) => {
  try {
    ludlog.api('Generating JSON sitemap for debugging');

    const products = await EntityService.find('product', {
      is_published: true
    });

    const baseUrl = 'https://ludora.app';

    const sitemapData = {
      generated_at: new Date().toISOString(),
      total_urls: products.length + 12,
      base_url: baseUrl,
      urls: [
        // Static pages
        { url: baseUrl, type: 'homepage', priority: 1.0 },
        { url: `${baseUrl}/catalog`, type: 'catalog', priority: 0.9 },
        { url: `${baseUrl}/games`, type: 'category', priority: 0.8 },
        { url: `${baseUrl}/files`, type: 'category', priority: 0.8 },
        { url: `${baseUrl}/lesson-plans`, type: 'category', priority: 0.8 },
        { url: `${baseUrl}/workshops`, type: 'category', priority: 0.7 },
        { url: `${baseUrl}/courses`, type: 'category', priority: 0.7 },

        // Legal pages
        { url: `${baseUrl}/privacy`, type: 'legal', priority: 0.3 },
        { url: `${baseUrl}/terms`, type: 'legal', priority: 0.3 },
        { url: `${baseUrl}/accessibility`, type: 'legal', priority: 0.3 },
        { url: `${baseUrl}/contact`, type: 'contact', priority: 0.4 },

        // Student portal
        { url: 'https://my.ludora.app', type: 'student_portal', priority: 0.7 },

        // Product pages
        ...products.map(product => ({
          url: getProductUrl(product, baseUrl),
          type: 'product',
          product_type: product.product_type,
          product_id: product.id,
          title: product.title,
          lastmod: product.updated_at,
          priority: getPriority(product.product_type)
        }))
      ]
    };

    res.json(sitemapData);

  } catch (error) {
    ludlog.api('Error generating JSON sitemap:', error);
    res.status(500).json({
      error: 'Failed to generate JSON sitemap',
      message: error.message
    });
  }
});

/**
 * Helper function to generate sitemap XML
 */
function generateSitemapXML(urls) {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const xmlFooter = '</urlset>';

  const urlEntries = urls.map(urlData => {
    return `  <url>
    <loc>${escapeXml(urlData.url)}</loc>
    <lastmod>${urlData.lastmod}</lastmod>
    <changefreq>${urlData.changefreq}</changefreq>
    <priority>${urlData.priority}</priority>
  </url>`;
  }).join('\n');

  return `${xmlHeader}\n${urlEntries}\n${xmlFooter}`;
}

/**
 * Helper function to get product URL based on type
 */
function getProductUrl(product, baseUrl) {
  const productType = product.product_type;
  const productId = product.id;

  // Different URL patterns for different product types
  switch (productType) {
    case 'game':
      return `${baseUrl}/games/${productId}`;
    case 'file':
      return `${baseUrl}/files/${productId}`;
    case 'lesson_plan':
      return `${baseUrl}/lesson-plans/${productId}`;
    case 'workshop':
      return `${baseUrl}/workshops/${productId}`;
    case 'course':
      return `${baseUrl}/courses/${productId}`;
    case 'tool':
      return `${baseUrl}/tools/${productId}`;
    case 'bundle':
      return `${baseUrl}/bundles/${productId}`;
    default:
      return `${baseUrl}/products/${productId}`;
  }
}

/**
 * Helper function to get change frequency based on product type
 */
function getChangeFrequency(productType) {
  switch (productType) {
    case 'game':
      return 'weekly'; // Games might be updated frequently
    case 'file':
      return 'monthly'; // Files are more static
    case 'lesson_plan':
      return 'weekly'; // Lesson plans might be updated
    case 'workshop':
      return 'monthly'; // Workshops have scheduled dates
    case 'course':
      return 'monthly'; // Courses are structured content
    case 'tool':
      return 'monthly'; // Tools are relatively stable
    case 'bundle':
      return 'weekly'; // Bundles might change composition
    default:
      return 'monthly';
  }
}

/**
 * Helper function to get priority based on product type
 */
function getPriority(productType) {
  switch (productType) {
    case 'game':
      return '0.8'; // High priority for interactive content
    case 'file':
      return '0.6'; // Medium priority for resources
    case 'lesson_plan':
      return '0.7'; // High priority for educational content
    case 'workshop':
      return '0.7'; // High priority for training
    case 'course':
      return '0.8'; // High priority for structured learning
    case 'tool':
      return '0.6'; // Medium priority for tools
    case 'bundle':
      return '0.7'; // Good priority for multi-item packages
    default:
      return '0.5';
  }
}

/**
 * Helper function to escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default router;