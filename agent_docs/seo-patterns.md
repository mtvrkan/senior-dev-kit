# SEO & AEO/GEO Patterns — Lazy Reference

## AEO/GEO — AI ENGINE OPTIMIZATION (2025 priority)

AI assistants (ChatGPT, Gemini, Claude, Perplexity) now answer questions directly, bypassing traditional search. Optimize for being cited as a source.

### AEO principles

1. **Direct answer first**: H1 + first paragraph directly answers the primary query. No fluff intro.
2. **Structured facts**: use lists, tables, numbered steps — AI can extract and cite these
3. **Definition pattern**: define key terms explicitly ("X is Y that does Z")
4. **Confidence signals**: cite sources, dates, specifics — AI cites confident, well-sourced content
5. **Question-answer format**: use FAQ sections with explicit questions as headings

```tsx
// AEO-optimized page structure:
<h1>How to Reset Your Password</h1>   {/* answers query directly */}
<p>To reset your password, click "Forgot Password" on the login page, 
   enter your email, and follow the link sent to your inbox.</p>  {/* direct answer */}
<h2>Step-by-step instructions</h2>    {/* structured detail */}
<ol>
  <li>Navigate to example.com/login</li>
  <li>Click "Forgot Password"</li>
  ...
</ol>
<h2>Frequently Asked Questions</h2>
<h3>How long is the reset link valid?</h3>
<p>Reset links expire after 30 minutes for security.</p>
```

## METADATA — Next.js App Router

```typescript
// app/page.tsx — root page
export const metadata: Metadata = {
  title: {
    template: '%s | Brand Name',  // applied to all child pages
    default: 'Brand Name — Tagline Under 60 Characters'
  },
  description: 'Under 160 chars, includes primary keyword, value proposition.',
  openGraph: {
    type: 'website',
    url: 'https://example.com',
    siteName: 'Brand Name',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@handle',
  },
  alternates: {
    canonical: 'https://example.com',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

// app/blog/[slug]/page.tsx — dynamic page
// Next.js 16+: params/searchParams are Promises — must be awaited before use
type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return {
    title: post.title,  // template appends ' | Brand Name'
    description: post.excerpt,
    openGraph: {
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [{ url: post.ogImage, width: 1200, height: 630 }],
    },
    alternates: { canonical: `https://example.com/blog/${post.slug}` },
  }
}
```

**Checklist:**

- [ ] `title` under 60 characters (truncated in SERPs)
- [ ] `description` under 160 characters
- [ ] OG image 1200×630px (PNG or JPG)
- [ ] `canonical` on every page (prevents duplicate content)
- [ ] `robots.txt` exists and is correct
- [ ] `sitemap.xml` generated and submitted

## STRUCTURED DATA (JSON-LD)

Add structured data to help search engines and AI extract facts:

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.ogImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: `https://example.com/authors/${post.author.slug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Brand Name',
      logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
    },
  }
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* page content */}
    </>
  )
}
```

Common schema types:

- `Article` / `BlogPosting` — blog posts
- `Product` — e-commerce products
- `FAQPage` — FAQ sections
- `HowTo` — step-by-step guides
- `BreadcrumbList` — navigation breadcrumbs
- `Organization` / `LocalBusiness` — company info
- `SoftwareApplication` — app stores, SaaS
- `Review` / `AggregateRating` — product reviews

```tsx
// FAQPage schema (great for AEO)
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
}
```

## CORE WEB VITALS (2025 ranking signals)

| Metric | Good | Needs Work | Poor | What affects it |
| --- | --- | --- | --- | --- |
| LCP | <2.5s | 2.5-4s | >4s | Hero image load, server response, render-blocking |
| CLS | <0.1 | 0.1-0.25 | >0.25 | Images without dimensions, FOIT, dynamic content |
| INP | <200ms | 200-500ms | >500ms | Long JS tasks, heavy event handlers |

### LCP optimization

```tsx
// 1. Preload hero image (above the fold)
<link rel="preload" href="/hero.webp" as="image" fetchPriority="high" />

// 2. Next.js Image component — auto-preload, WebP, correct sizing
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority                // ← preloads this image
  sizes="(max-width: 768px) 100vw, 1200px"
/>

// 3. Avoid render-blocking resources
// Move non-critical CSS to lazy load
// Defer non-critical JS: <script defer>
```

### CLS prevention

```css
/* WRONG: image without dimensions — causes layout shift when loads */
<img src="/photo.jpg" alt="...">

/* RIGHT: reserve space before image loads */
<img src="/photo.jpg" alt="..." width="800" height="400">
/* or */
aspect-ratio: 16 / 9;  /* CSS aspect-ratio reserves space */
```

```tsx
// Font CLS prevention (next/font auto-handles this):
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })  // inlines font CSS, zero layout shift
// Never: <link> to Google Fonts (FOUT causes CLS)

// Dynamic content: reserve height
<div style={{ minHeight: '200px' }}>
  {isLoaded ? <Content /> : <Skeleton />}
</div>
```

### INP optimization

```typescript
// Break up long tasks into smaller chunks
function heavyProcessing(items: Item[]) {
  // WRONG: blocks main thread
  return items.map(expensiveOperation)
  
  // RIGHT: yield to browser between chunks
  const chunks = chunk(items, 50)
  for (const chunk of chunks) {
    await scheduler.yield()  // yield to browser (Chrome 115+)
    processChunk(chunk)
  }
}

// Or use Web Workers for CPU-intensive work
const worker = new Worker(new URL('./worker.ts', import.meta.url))
worker.postMessage({ items })
worker.onmessage = (e) => setResults(e.data.results)
```

## SITEMAP GENERATION

```typescript
// app/sitemap.ts (Next.js App Router)
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()
  const products = await getProducts()
  
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: 'https://example.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://example.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://example.com/blog', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ]
  
  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...posts.map(post => ({
      url: `https://example.com/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map(product => ({
      url: `https://example.com/products/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ]
  
  return [...staticRoutes, ...dynamicRoutes]
}
```

## ROBOTS.TXT

```typescript
// app/robots.ts (Next.js)
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/private/'] },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

## INTERNATIONAL SEO (hreflang)

```tsx
// For multilingual sites — tell search engines about language variants
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return {
    alternates: {
      canonical: `https://example.com/en/${slug}`,
      languages: {
        'en-US': `https://example.com/en/${slug}`,
        'de-DE': `https://example.com/de/${slug}`,
        'fr-FR': `https://example.com/fr/${slug}`,
        'x-default': `https://example.com/en/${slug}`,
      },
    },
  }
}
```

## TECHNICAL SEO CHECKLIST

Performance:

- [ ] LCP < 2.5s (measure with Lighthouse, Web Vitals extension)
- [ ] CLS < 0.1 (all images have width/height, fonts use next/font)
- [ ] INP < 200ms (no long tasks on main thread)
- [ ] First page load: <200KB JS gzip

Crawlability:

- [ ] `robots.txt` allows crawling of public pages
- [ ] `sitemap.xml` covers all public pages, submitted to GSC
- [ ] Internal links use `<a href>` (not JS-only navigation)
- [ ] No orphan pages (every page reachable from main navigation or sitemap)
- [ ] `canonical` tag on every page (self-referencing if no duplicate)

Content:

- [ ] Unique `<title>` and `<meta description>` per page
- [ ] Single `<h1>` per page (hierarchy: h1 → h2 → h3)
- [ ] `alt` text on all images (descriptive, not keyword-stuffed)
- [ ] JSON-LD schema markup for content type
- [ ] 404 page exists and returns 404 status code

Security/Technical:

- [ ] HTTPS (HTTP → HTTPS redirect)
- [ ] Mobile-friendly (responsive design, no horizontal scroll)
- [ ] No broken internal links (use `next-sitemap` or link checker)
- [ ] `X-Robots-Tag: noindex` NOT set on public pages

## CONTENT STRUCTURE FOR AI CITATION

```markdown
# [Direct answer to the primary question as headline]

[First paragraph: answer the question in 1-2 sentences]

## Why it matters / What it does

[Expand on the topic with specific, citable facts]

## [Specific aspect 1]

[Structured content: bullet points, numbered lists, tables]

## [Specific aspect 2]

## FAQ

### [Exact phrasing of common question]

[Direct, concise answer]

### [Another common question]

[Direct, concise answer]
```

AI models prefer: specific numbers, dates, named entities, step-by-step instructions, definition-first explanations, authoritative citations.
