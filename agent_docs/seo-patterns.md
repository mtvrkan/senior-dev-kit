# SEO & AEO/GEO Patterns — Lazy Reference

## AEO/GEO — AI ENGINE OPTIMIZATION (2025 priority)

AI assistants (ChatGPT, Gemini, Claude, Perplexity) now answer questions directly, bypassing traditional search. Optimize for being cited as a source.

### AEO principles

1. **Direct answer first**: H1 + first paragraph directly answers the primary query. No fluff intro.
2. **Structured facts**: use lists, tables, numbered steps — AI can extract and cite these
3. **Definition pattern**: define key terms explicitly ("X is Y that does Z")
4. **Confidence signals**: cite sources, dates, specifics — AI cites confident, well-sourced content
5. **Question-answer format**: use FAQ sections with explicit questions as headings

AEO-optimized page structure — the `<h1>` answers the query directly, the first `<p>` is the direct
answer, and the first `<h2>` opens the structured detail:

```tsx
<h1>How to Reset Your Password</h1>
<p>To reset your password, click "Forgot Password" on the login page, 
   enter your email, and follow the link sent to your inbox.</p>
<h2>Step-by-step instructions</h2>
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

`app/page.tsx` — root page; `template` is applied to all child pages:

```typescript
export const metadata: Metadata = {
  title: {
    template: '%s | Brand Name',
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
```

`app/blog/[slug]/page.tsx` — dynamic page. Next.js 16+: `params`/`searchParams` are Promises and
must be awaited before use. The template appends `' | Brand Name'` to `post.title`:

```typescript
type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return {
    title: post.title,
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

`app/blog/[slug]/page.tsx`:

```tsx
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <h1>{post.title}</h1>
    </>
  )
}
```

`JSON.stringify` does not escape `<`, so a `</script>` inside a CMS title or description would close the tag and run whatever follows. Replacing every `<` with the JSON escape `\u003c` keeps the JSON valid and makes that impossible.

Common schema types:

- `Article` / `BlogPosting` — blog posts
- `Product` — e-commerce products
- `FAQPage` — FAQ sections
- `HowTo` — step-by-step guides
- `BreadcrumbList` — navigation breadcrumbs
- `Organization` / `LocalBusiness` — company info
- `SoftwareApplication` — app stores, SaaS
- `Review` / `AggregateRating` — product reviews

FAQPage schema (great for AEO):

```tsx
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

Preload the hero image (above the fold):

```tsx
<link rel="preload" href="/hero.webp" as="image" fetchPriority="high" />
```

Next.js Image component — auto-preload, WebP, correct sizing:

```tsx
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  preload
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

Avoid render-blocking resources: move non-critical CSS to lazy load, and defer non-critical JS with
`<script defer>`.

Next.js 16 deprecated the `next/image` `priority` prop in favour of `preload`; on Next 15 and earlier the same prop is still spelled `priority`.

### CLS prevention

WRONG — image without dimensions, causes layout shift when it loads:

```html
<img src="/photo.jpg" alt="...">
```

RIGHT — reserve space before the image loads:

```html
<img src="/photo.jpg" alt="..." width="800" height="400">
```

Or reserve the space with CSS `aspect-ratio`:

```css
aspect-ratio: 16 / 9;
```

Font CLS prevention — `next/font` auto-handles this; it inlines the font CSS, zero layout shift.
Never `<link>` to Google Fonts (FOUT causes CLS).

```tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })
```

Dynamic content — reserve height:

```tsx
<div style={{ minHeight: '200px' }}>
  {isLoaded ? <Content /> : <Skeleton />}
</div>
```

### INP optimization

WRONG — one long task, blocks the main thread for its whole duration:

```typescript
function heavyProcessing(items: Item[]) {
  return items.map(expensiveOperation)
}
```

RIGHT — yield to the browser between chunks so input stays responsive. `scheduler.yield()` is
Chrome 129+; feature-detect it or fall back to `setTimeout(0)`:

```typescript
async function heavyProcessing(items: Item[]) {
  const results: Result[] = []
  for (const batch of chunk(items, 50)) {
    await scheduler.yield()
    results.push(...batch.map(expensiveOperation))
  }
  return results
}
```

Or use Web Workers for CPU-intensive work:

```typescript
const worker = new Worker(new URL('./worker.ts', import.meta.url))
worker.postMessage({ items })
worker.onmessage = (e) => setResults(e.data.results)
```

## SITEMAP GENERATION

`app/sitemap.ts` (Next.js App Router):

```typescript
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

`app/robots.ts` (Next.js):

```typescript
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

For multilingual sites — tell search engines about language variants:

```tsx
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
