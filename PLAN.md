# PLAN.md — Prompt-first storefront builder

Status: **draft, waiting for approval. No code has been written.**

This plan covers architecture, data model, the AI pipelines, and the seven build phases from the brief. Section 10 lists the decisions I need from you before Phase 1. Each one is hard to undo later.

---

## 0. Where this lives

This repository (`doormobiledemo`) holds an unrelated Vite + React mobile demo for Doorvisor, a real-estate assistant. The new product is a Next.js app with a different toolchain, so it should not be mixed in with that demo. See **Q1**. My recommendation is a new, dedicated repository. This PLAN.md is committed here only so you can review it.

---

## 1. Architecture at a glance

```
                     ┌──────────────────────── Vercel (Next.js App Router) ─────────────────────────┐
 shopper ──► *.ourapp.com ──► middleware (host → store slug) ──► /(storefront)/[store]/…            │
 merchant ─► app.ourapp.com ─────────────────────────────────► /(merchant)/…  (dashboard, onboarding) │
                     │   Route handlers / server actions:                                             │
                     │     /api/search       intent parse ∥ query embed → search_products() RPC      │
                     │     /api/checkout/*   PaymentIntent create/update (tax + shipping)            │
                     │     /api/stripe/webhook   orders, inventory, Connect account status           │
                     │     /api/ai/*         store generation, product enrichment, prompt edits      │
                     └───────┬─────────────────────┬───────────────────┬───────────────┬─────────────┘
                             │                     │                   │               │
                  Supabase (Postgres + pgvector,   Claude API         Stripe Connect   Resend
                  Auth, Storage, RLS)              (Opus 5 default)   Express +        (order email,
                                                   + embeddings API   Payment Element   magic links)
```

- **One Next.js app** with two route groups: `(merchant)` on `app.ourapp.com` and `(storefront)` on `{slug}.ourapp.com`. Middleware reads the `Host` header and rewrites storefront requests to `/s/[slug]/…`. Custom domains later add a `store_domains` lookup in the same middleware, with no structural change.
- **Local dev:** `app.localhost:3000` and `{slug}.localhost:3000`. Chrome and Firefox resolve `*.localhost` with no hosts-file edits. A `?store=slug` fallback covers other browsers.
- **Server-first:** storefront pages are React Server Components. Store and product pages use ISR, revalidated on product change. Search is a client island that calls one route handler.
- **Secrets stay on the server.** The browser gets only the Supabase anon key and the Stripe publishable key. The service-role key is used only in webhooks and background jobs, never in a request that runs on a merchant's behalf.

### Proposed repo layout

```
app/
  (merchant)/            onboarding/, dashboard/, products/, orders/, settings/
  (storefront)/s/[slug]/ page.tsx (prompt home), p/[handle]/, checkout/, order/[token]/
  api/                   search/, checkout/, stripe/webhook/, ai/, jobs/
lib/
  ai/                    claude client, prompts/, schemas (zod), enrichment, store-gen, intent, edit-tools
  search/                ranking, explanation builder
  stripe/  supabase/  email/  money.ts  tenancy.ts
components/              ui/ (shadcn), storefront/, merchant/, theme/
supabase/
  migrations/            SQL, RLS policies, search RPC
  seed/                  demo store + 30 dresses
  tests/                 pgTAP RLS tests
e2e/                     Playwright (+ axe accessibility checks)
```

---

## 2. Data model

Rules that apply to every table:
- Every table holding store data has `store_id uuid not null references stores(id) on delete cascade` and an index that starts with `store_id`.
- Money is stored as integer minor units (`price_cents`) plus a `currency` code. Floats are never used.
- `created_at` and `updated_at` columns are present everywhere. Soft deletes (`archived_at`) apply to products only.
- Every AI-generated field is stored as a normal, editable column. A sibling `ai_meta jsonb` records what generated it (model, prompt version, timestamp, whether the merchant edited it), so a later "regenerate" never overwrites a merchant's manual edit without asking.

### Tables

| Table | Purpose / key columns |
|---|---|
| `stores` | `id, slug (unique), name, tagline, description_prompt, status ('draft'\|'live'\|'paused'), currency, country, theme jsonb, layout jsonb, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, published_at` |
| `store_members` | `store_id, user_id (auth.users), role ('owner'\|'staff')`. The table that drives tenancy. Staff roles come later, but the join table exists from day one so we never have to migrate away from `stores.owner_id`. |
| `store_domains` | `store_id, hostname, verified_at`. For custom domains later. |
| `categories` | `store_id, parent_id, name, slug, position`. The tree generated during onboarding. |
| `products` | `store_id, category_id, handle, title, description, product_type ('dress', 'top', 'mug'…), attributes jsonb, tags text[], price_cents, compare_at_cents, status ('draft'\|'active'\|'archived'), ai_meta jsonb, search_text (generated), embedding vector(N), embedding_model` |
| `product_variants` | `store_id, product_id, size, color, sku, price_cents (nullable override), inventory_qty, position` |
| `product_images` | `store_id, product_id, storage_path, alt_text (AI-generated, editable), width, height, position` |
| `promotions` | `store_id, name, rule jsonb (the filter over products), discount_type ('percent'\|'fixed'), value, starts_at, ends_at, created_via ('prompt'\|'manual'), source_prompt`. Sales are rules that are evaluated at read time. Prices are never rewritten, so a sale "ends" by itself and undo is clean. |
| `shipping_rates` | `store_id, name, price_cents, free_over_cents, countries text[]`. Flat-rate at launch. |
| `orders` | `store_id, number (per-store sequence), public_token, email, shipping_address jsonb, subtotal/discount/shipping/tax/total_cents, currency, status ('paid'\|'fulfilled'\|'refunded'\|'canceled'\|'needs_attention'), stripe_payment_intent_id (unique), customer_id nullable` |
| `order_items` | `store_id, order_id, product_id, variant_id, title_snapshot, size_snapshot, image_snapshot, unit_price_cents, qty` |
| `customers` | `store_id, email, name, default_address jsonb, auth_user_id nullable`. Created only through the post-purchase "save my info" opt-in. |
| `ai_jobs` | `store_id, kind ('enrich_product'\|'embed'\|'csv_import'\|'generate_store'), status, input jsonb, output jsonb, error, attempts`. Tracks background AI work and drives the progress UI through Supabase Realtime. |
| `edit_commands` | `store_id, user_id, prompt, plan jsonb, affected_count, status ('previewed'\|'applied'\|'undone'), applied_at, undo jsonb`. Audit log and undo for prompt-based editing. |
| `search_events` | `store_id, session_id, prompt, parsed_intent jsonb, result_count, top_score, latency_ms`. Feeds merchant insights ("shoppers asked for X, you don't sell it") and ranking tuning. No PII. |
| `stripe_events` | `id (Stripe event id, PK), type, processed_at`. Makes webhooks idempotent. |

### Attributes stay generic without losing structure

`products.attributes` is `jsonb`. Its shape is defined per `product_type` by a **zod attribute schema registry** in `lib/catalog/attribute-schemas.ts`. The clothing schema is `color[], fabric, length, neckline, sleeve, occasion[], season[], fit, size_range`. Mugs or candles would get their own schemas later, and no migration is needed.

A GIN index on `attributes` handles structured filtering. The same registry drives:
- the JSON schema Claude must fill during enrichment
- the merchant's attribute edit form
- which intent fields the search parser extracts for that store

### Multi-tenancy and RLS

- RLS is enabled on **every** table, and no table has a permissive `using (true)`.
- `is_store_member(store_id uuid) returns boolean`: a `security definer` SQL function that checks `store_members` against `auth.uid()`. It is marked `stable` and wrapped as `(select is_store_member(store_id))` so Postgres evaluates it once per query, not once per row.
- **Merchant policies:** select, insert, update, and delete on store tables require `is_store_member(store_id)`.
- **Public (anon) policies:** read-only, and only for `stores` where `status = 'live'`, `products` and `product_variants` and `product_images` where the product is `active` and its store is live, and `categories`, `shipping_rates`, and active `promotions` for live stores. There is no anon access to orders, customers, jobs, or events.
- **Order writes** happen only in the Stripe webhook, using the service role. Shoppers view their confirmation through `/order/[public_token]`, which is an unguessable 32-byte token resolved server-side. They never query the table.
- **pgTAP tests** in `supabase/tests` create merchants A and B and assert that A can't read, insert into, or update B's rows in every table. The same tests check that anon can't see draft products or any orders. These tests run in CI and block merges.

---

## 3. AI pipelines

All Claude calls go through `lib/ai/claude.ts`, which uses the official `@anthropic-ai/sdk`.

Shared conventions:
- **Structured outputs** (`output_config.format` with a JSON schema generated from zod) are used for every call that returns data, so we never parse free text.
- **Adaptive thinking** is used for generation and enrichment. Effort is set per route: `low` where latency matters, `medium` or `high` for store generation.
- Each system prompt is versioned (`prompts/intent.v1.ts`) and **prompt-cached**. The static prefix holds the schema, examples, and the store's category tree.
- Typed error handling: retry on 429 and 5xx, surface 400s. `stop_reason` is always checked, including for `refusal`.
- Model IDs come from env vars (`CLAUDE_MODEL_DEFAULT`, `CLAUDE_MODEL_FAST`), so switching models is a config change. The default is `claude-opus-5`. See **Q5** for the latency-critical search route.

### 3.1 Store generation (onboarding step 2)

- **Input:** the one-sentence description.
- **Output schema:** `name_suggestions[3], tagline, palette {background, surface, text, muted, primary, accent}, font_pairing_id, homepage_sections[], categories[{name, children[]}], hero_copy, sample_prompt_chips[4]`.
- **Constrained choices:** fonts come from a curated list of about 12 Google Font pairings. Sections come from a fixed library of storefront components (`hero-prompt`, `featured-grid`, `category-tiles`, `story`, `lookbook`). Claude chooses and configures sections but never generates markup, so every generated store is fast, accessible, and renders correctly.
- **Accessibility guard:** after generation, `ensureContrast()` checks each text/background pair against WCAG AA (4.5:1 for body text, 3:1 for large text and UI) and nudges lightness until the pair passes. The merchant never sees an inaccessible palette.
- **UX:** a live preview renders the real storefront components with the theme as CSS variables, in a phone-sized frame on desktop and full-screen on mobile. Actions are **Accept**, **Regenerate**, **Regenerate just colors / fonts / name**, and direct edits to every field.

### 3.2 Product enrichment (onboarding step 3 + products page)

- **Inputs:** 1–5 photos (resized to about 1024px before sending), plus any merchant text, plus a CSV row if present.
- **Output:** `title, description, product_type, attributes (the schema for that type), tags[], alt_text per image, suggested_category_id, confidence per attribute`.
- **Low-confidence handling:** attributes below the confidence threshold are highlighted in the review UI so the merchant knows what to check.
- **Three entry paths:**
  - **Photos:** drag and drop multiple images. Images are grouped into products (one product per image by default, and the merchant can merge groups).
  - **CSV:** columns are mapped automatically. Claude maps unknown headers to our fields once per file. Rows become `ai_jobs`.
  - **Quick text:** "linen wrap dress, sage, S-XL, $68".
- **Background processing:** each product is one `ai_jobs` row. A job runner processes jobs with a concurrency cap (Vercel `waitUntil` for small batches, and a cron-driven drain route for large CSVs). The UI shows cards filling in live through Supabase Realtime.
- **Review screen:** one card per product, with every field editable inline. The merchant **must** confirm the price and the inventory per size. Everything else is optional.
- **Embeddings:** after a product is saved or edited, an `embed` job builds `search_text` (title, description, and attribute values flattened into prose, plus tags) and stores the vector. The Claude API does not offer an embeddings endpoint, so this needs a separate provider. See **Q2**.

### 3.3 Prompt search (storefront)

The request goes to `POST /api/search` with `{ prompt, previousIntent? }`. Two calls start **in parallel**:

1. **Intent parse (Claude, structured output):** returns `{ category, product_type, colors[], exclude_colors[], occasion[], season[], length, fit, sleeve, neckline, size, price_min, price_max, style_words[], sort_hint, is_refinement }`. The static prompt prefix holds the store's categories and attribute vocabulary, so it caches. When `previousIntent` is sent, Claude merges the refinement: "make it longer" changes `length`, and "only blue" replaces `colors`.
2. **Query embedding:** of the raw prompt, plus the style words from the previous turn when the new prompt is a refinement.

Then one Postgres RPC runs: `search_products(store_id, query_vec, intent jsonb, limit 24)`.

- **Hard filters** (price range, size in stock) apply first. If they return fewer than 4 results, the query reruns with those filters relaxed, and the response flags `relaxed: true`.
- **Score:**
  ```
  score = 0.55 · cosine_similarity(query, product)
        + 0.35 · structured_match   (weighted share of the intent attributes the product matches; colors and category weigh most)
        + 0.10 · availability/boost (in stock, on sale, merchant-pinned)
  ```
  The weights are constants in one file and will be tuned against a small labeled query set in Phase 7.
- **Index:** HNSW on `embedding`, cosine distance. A catalog of a few thousand products per store is well within budget.

**Explanation line:** it is built **deterministically from the parsed intent**, not by a second LLM call. Example: *"Showing flowy midi dresses in light colors under $80."* This saves about a second, and the line can never claim something the filters didn't do.

**Honest fallback:** if `top_score` is below the threshold or the filters were relaxed, the page says so. Example: *"We don't have an exact match for a sequined red gown. Here are the closest options."* It also offers one-tap chips that drop the unmatched constraint.

**Latency budget (target p95 under 2s):**

| Step | Budget |
|---|---|
| Edge to function, auth-free | ~50ms |
| Intent parse, run in parallel with the embedding | ~0.8–1.3s |
| Query embedding | ~150–300ms |
| `search_products` RPC | <100ms |
| Render | <100ms |

- An in-memory and KV cache of `(store, normalized prompt) → intent` covers the example chips and repeated queries.
- The UI shows skeleton cards instantly and keeps the prompt visible.
- Semantic-only results can **stream in first** from the embedding and are re-ranked when the intent arrives. This is behind a flag and gets turned on only if the p95 misses the target.

### 3.4 Prompt-based editing (merchant dashboard)

Example prompt: "mark all red dresses 20% off this weekend."

**Claude never writes SQL.** It is given a small set of strict tools, each validated by zod on the server:

| Tool | What it does |
|---|---|
| `select_products(filter)` | Selects by category, attributes, tags, price, stock, or text query |
| `create_promotion(filter, percent\|fixed, starts_at, ends_at)` | Creates a sale |
| `update_products(filter, patch)` | Changes price, status, tags, category, or attributes |
| `set_inventory(filter, size?, qty \| delta)` | Sets or adjusts stock |
| `update_store(patch)` | Changes tagline, theme, chips, or sections |

**Flow:**
1. The prompt becomes a **plan**, with relative dates resolved in the store's timezone.
2. The UI shows a **preview**: "This will put 7 products on sale at 20% off from Sat Sep 26 00:00 to Sun Sep 27 23:59," with thumbnails of the affected products.
3. The merchant clicks **Apply**.
4. The change is written to `edit_commands` with an undo payload, so **Undo** is one click.
5. The server re-checks store ownership on every write, even though RLS would also block a cross-store write.

---

## 4. Checkout and payments

**Stripe Connect Express.** Onboarding step 4 creates an Express account and sends the merchant through Stripe's hosted onboarding. The `account.updated` webhook keeps `charges_enabled` in sync. **Publish** is blocked until charges are enabled. The merchant can still preview the store before that.

**Charge model:** I recommend **destination charges with `on_behalf_of` and an `application_fee_amount`**. That is Stripe's standard pattern for Express. See **Q3**, because it decides who is the merchant of record, whose name shoppers see on their card statement, and who carries dispute and refund liability.

**Single checkout page** at `/checkout` on the store's subdomain:
1. The **Express Checkout Element** sits at the top and shows Apple Pay, Google Pay, and Link.
2. **Email.** A Link lookup here pre-fills returning Link users.
3. The **Address Element** in shipping mode. Stripe provides the address autocomplete, so we don't need a separate Google Places key.
4. The **Payment Element** for card entry.
5. An **order summary** with subtotal, discount, shipping, tax, and total. It recalculates whenever the address changes, and the total is always visible before the Pay button.

**Totals are server-authoritative.** The cart is held client-side in localStorage as `variant_id` and `qty` pairs. On every change, `POST /api/checkout/intent` reprices from the database, applies active promotions, shipping, and tax, and creates or updates the PaymentIntent. The client never sends prices.

**Tax:** Stripe Tax if you want it, otherwise a per-store flat rate. See **Q3b**.

**Apple Pay on subdomains:** each `{slug}.ourapp.com` must be registered as a payment method domain. We do this automatically through the Stripe API at publish time.

**Webhook** (`payment_intent.succeeded`):
1. Insert the `stripe_events` row for idempotency.
2. Create the order and order items.
3. Decrement inventory atomically with `update … where inventory_qty >= qty`. If inventory has run out, the order is marked `needs_attention` for the merchant instead of failing silently.
4. Send the Resend confirmation email and redirect to `/order/[token]`.

**"Save my info" (after purchase only):** the confirmation page offers "Save my details for next time." Accepting it creates a `customers` row and sends a magic link.

There is one constraint to be honest about. Stripe can only save a **card** for reuse if that was requested *before* the payment was confirmed. The post-purchase opt-in can therefore save the **email, name, and address** but not the card. Returning shoppers still get one-tap card payment through **Link**, which Stripe offers inside the payment form. Please confirm this is acceptable (**Q7**).

**Emails (Resend + React Email):**
- Order confirmation to the shopper
- New-order notification to the merchant
- Magic links are sent by Supabase Auth, using Resend SMTP so branding stays consistent.

---

## 5. Design system and quality bars

**Mobile first.** Every screen is designed at 375px first.
- Storefront: the prompt box sits in the top third, with chips below it. The results grid is 2 columns on phones and 3–4 on larger screens.
- Sticky "Add to bag" on product pages.

**Theming.** Each store's theme becomes CSS variables. The shadcn/ui components read those tokens, so a merchant's palette re-skins everything without per-store CSS.

**Accessibility (WCAG 2.1 AA):**
- Semantic landmarks, labelled prompt input, and a visible focus ring.
- Results count announced through `aria-live` ("12 results: showing flowy midi dresses…").
- Size selector is a radio group. Swatches have text labels.
- Tap targets are at least 44px, and `prefers-reduced-motion` is respected.
- Alt text on every product image (AI-drafted, merchant-editable).
- Contrast enforced by `ensureContrast()`.
- axe checks run in Playwright on every key page.

**Performance:**
- `next/image` with responsive sizes, and AVIF/WebP.
- ISR for store and product pages.
- Only the search, bag, and checkout islands hydrate.
- Budget: LCP under 2.5s on mid-range Android over 4G, and search p95 under 2s (measured through `search_events.latency_ms`).

**Look and feel:** calm and generous. A neutral base, one accent color from the store palette, large type for the prompt, and no filter chrome.

---

## 6. Build phases

Each phase ends with a demo checklist and a stop for your review.

### Phase 1: Foundation, schema, auth, and multi-tenancy

- Next.js (App Router, TS strict), Tailwind, shadcn/ui, ESLint and Prettier, Vitest, Playwright.
- Supabase project config and local Supabase through the CLI.
- Migrations for all tables in §2, RLS policies, `is_store_member`, the pgvector extension, and indexes.
- Supabase Auth with Google OAuth and email magic link (no passwords). Session handling with `@supabase/ssr`.
- Host-based middleware routing (app vs. `{slug}` subdomain) and the `localhost` dev story.
- Typed DB client generated from the schema.
- `.env.example`, `.env.local` (git-ignored), README "run locally", and a GitHub Actions CI job running lint, typecheck, unit tests, and pgTAP RLS tests.

**Demo:** sign in with Google or a magic link, and land on an empty "Create your store" screen. The RLS test suite passes with two tenants.

### Phase 2: Merchant onboarding and AI store generation

- Onboarding wizard shell with progress, resumable across sessions (state lives on the `stores` draft).
- Step 2: one-sentence prompt, then the structured store spec, the contrast guard, and the live preview. Regenerate all or regenerate a single part, and inline editing of every field.
- Slug picker with an availability check.
- The storefront theme engine, meaning the component library that the preview and the real store share.

**Demo:** go from a sentence to a styled store preview in about 20 seconds, then change anything.

### Phase 3: Products and AI enrichment, with embeddings

- Storage buckets with RLS: `product-images/{store_id}/…`.
- Upload paths for photos, CSV, and quick text. `ai_jobs` with a runner, retries, and a realtime progress UI.
- Enrichment calls, the review and confirm screen (price and inventory required), and variants by size.
- The attribute schema registry (clothing first) and the embedding pipeline with re-embedding on edit.
- The products list and edit page, which becomes part of the dashboard.

**Demo:** drop in 5 dress photos and get 5 fully described products. Confirm prices and they are searchable.

### Phase 4: Storefront with prompt search

- Storefront home (prompt hero and chips), results page, and product page (photos, price, sizes, add to bag), plus the bag drawer.
- `/api/search`: parallel intent and embedding, the `search_products` RPC, the explanation builder, refinement with carried context, the honest fallback, and the cache.
- `search_events` logging and latency instrumentation.

**Demo:** the example prompts return sensible results in under 2s. "Make it longer" and "only blue" refine correctly.

### Phase 5: Checkout and Stripe Connect

- Express onboarding in step 4, account status webhooks, the publish gate, and payment-method-domain registration.
- The one-page checkout from §4, server-side pricing, tax, and shipping, the webhook, orders, and inventory.
- Resend order emails, the confirmation page, and the post-purchase "save my info".

**Demo:** using Stripe test mode, buy a dress with Apple Pay on a phone and with a test card on desktop. The order appears and the email arrives.

### Phase 6: Merchant dashboard and prompt editing

- Overview: revenue today, 7 days, and 30 days, order count, AOV, top products, low stock, and "shoppers searched for…" insights from `search_events`.
- Orders list and detail (mark fulfilled, refund through Stripe). Products and inventory.
- Prompt command bar with plan, preview, apply, and undo. Promotions show up in the storefront (strike-through price).
- Settings: shipping rates, tax, store details, and theme re-edit.

**Demo:** type "mark all red dresses 20% off this weekend," preview it, apply it, see it on the storefront, and undo it.

### Phase 7: Demo store and end-to-end test

- `supabase/seed`: a "Wildflower & Co."-style demo store with 30 dresses covering varied colors, lengths, occasions, and prices from $38 to $160, with realistic inventory per size, precomputed embeddings, and a demo merchant login. See **Q6** for images.
- A labeled query set of about 25 prompts with expected top results, used to tune the ranking weights. The Playwright end-to-end test runs onboarding, search, checkout, and dashboard in Stripe test mode.

**Demo:** `npm run seed` and you have a working store to click through end to end.

---

## 7. Environment variables (`.env.example`)

```
NEXT_PUBLIC_ROOT_DOMAIN=ourapp.com            # localhost:3000 in dev
NEXT_PUBLIC_APP_URL=https://app.ourapp.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                    # server only
ANTHROPIC_API_KEY=
CLAUDE_MODEL_DEFAULT=claude-opus-5
CLAUDE_MODEL_FAST=                            # see Q5
EMBEDDINGS_PROVIDER=                          # see Q2
EMBEDDINGS_API_KEY=
EMBEDDINGS_MODEL=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_WEBHOOK_SECRET=
PLATFORM_FEE_BPS=                             # see Q3
RESEND_API_KEY=
EMAIL_FROM="Orders <orders@ourapp.com>"
CRON_SECRET=                                  # protects the job-drain route
```

---

## 8. Testing strategy

| Layer | Tool | What it covers |
|---|---|---|
| RLS / tenancy | pgTAP | Two-tenant isolation on every table, and anon visibility |
| Unit | Vitest | Money math, promotion evaluation, ranking score, explanation builder, contrast guard, zod schemas |
| AI contracts | Vitest + recorded fixtures | Schema validity of Claude outputs, with no live calls in CI |
| Search quality | Script over the labeled query set | Reports precision@6. Run manually when prompts or weights change |
| E2E + a11y | Playwright + axe | Onboarding, search, checkout (Stripe test mode), dashboard, on a mobile viewport |

---

## 9. Out of scope for v1 (noted so the schema doesn't block them)

- Custom domains. There is a `store_domains` table, and the Vercel Domains API gets wired up later.
- Staff accounts. `store_members.role` exists already.
- Your own SaaS billing for merchants. Stripe Billing on the platform account works independently of Connect. Tell me if you want a free trial or plan gating in v1.
- Discount codes, multi-currency, international tax, returns portal, reviews, analytics beyond the basic stats.

---

## 10. Decisions I need from you (hard to undo)

**Q1. Repository.** This repo holds the unrelated Doorvisor Vite demo. The options are:
- (a) a **new repo** for the storefront product, which I recommend
- (b) replace this repo's contents
- (c) put the new app in a subfolder here

**Q2. Embeddings provider.** Claude has no embeddings endpoint. The vector dimension becomes part of the schema, so switching later means re-embedding everything. The options are:
- (a) **Voyage AI** (`voyage-3.5-lite`, 1024 dims), which Anthropic recommends. Fast and cheap. I recommend it.
- (b) OpenAI `text-embedding-3-small` (1536 dims)
- (c) Supabase's built-in `gte-small` (384 dims). This adds no vendor, but quality is lower and it runs in an Edge Function.

**Q3. Payments model.**
- (a) Destination charges with an application fee, which I recommend for Express. The alternative is direct charges, where the merchant is fully the merchant of record.
- (b) What platform fee do you want, as a percentage per order? Or zero, if you'll charge a subscription instead?
- **Q3b.** Do you want **Stripe Tax**? It costs about 0.5% per transaction and gives accurate US sales tax. The alternative is a simple per-store flat tax rate that the merchant sets.

**Q4. Domain and name.** What root domain (`ourapp.com` is a placeholder) and product name should I use? Wildcard subdomains on Vercel need that domain's nameservers pointed at Vercel.

**Q5. Model for search intent parsing.** I'll use `claude-opus-5` for store generation, enrichment, and prompt editing. For intent parsing, the <2s target is tight, so the options are:
- (a) Opus 5 at low effort with prompt caching. Highest quality. I'll measure p95 in Phase 4.
- (b) Claude Haiku 4.5 for that route only. Fastest and cheapest.

The model is configurable either way. Tell me which one to start with.

**Q6. Demo product images.** Where should the 30 dress images come from?
- (a) You provide the photos.
- (b) I use openly licensed stock photos (for example Unsplash), with attribution recorded in the seed.
- (c) Neutral illustrated placeholders.

For something you'll demo to buyers, (a) or (b) look far better.

**Q7. "Save my info" scope.** The post-purchase opt-in can save email, name, and address. Card reuse goes through Stripe Link, because a card can't be saved after payment unless we ask before paying. Is that acceptable?

**Q8. Launch market.** Should v1 be **US-only and USD**? That affects tax, the address format, and shipping. The data model supports more countries and currencies later either way.
