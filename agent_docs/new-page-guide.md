# New Page Guide

Reference for `/new-page` skill — framework detection, convention discovery, and form/table patterns.

---

## Framework detection (read, stop at first match)

| File present | Framework |
| --- | --- |
| `next.config.*` / `app/` dir | Next.js |
| `vite.config.*` + react in package.json | React + Vite |
| `nuxt.config.*` | Nuxt / Vue |
| `angular.json` | Angular |
| `svelte.config.*` | SvelteKit |
| `artisan` + `composer.json` | Laravel |
| `manage.py` + `settings.py` | Django |
| `Gemfile` + `config/routes.rb` | Rails |

---

## Convention discovery — find similar pages

| Framework | Where to look |
| --- | --- |
| Next.js | glob `app/**/page.tsx` |
| React/Vite | glob `src/pages/**/*.tsx` or `src/views/**/*.tsx` |
| Vue/Nuxt | glob `pages/**/*.vue` or `views/**/*.vue` |
| Angular | grep `@Component` + `templateUrl` |
| SvelteKit | glob `src/routes/**/*.svelte` |
| Laravel | glob `resources/views/**/*.blade.php` |
| Django | glob `templates/**/*.html` |

Read the closest existing page fully. Extract: layout/shell component, data fetch pattern, component imports, state/loading pattern, color classes (semantic?), spacing scale.

---

## Form pattern (all frameworks)

- Submit button: disabled + loading indicator while request is pending
- Success: project's existing mechanism (toast/snackbar/notification/flash) — never `alert()`
- Validation errors: inline under each field OR top-level message — match existing forms
- Never bypass CSRF protection (Django, Laravel, Rails)

---

## Table/list pattern (all frameworks)

- Use project's existing data table component if one exists
- Row actions: dropdown menu or action buttons in last column — match existing tables
- Pagination: include if similar tables have it
- Search/filter: include if similar tables have it

---

## Error handling patterns

- Match error display pattern used in similar pages: toast? inline alert? alert component?
- User-facing messages only — never stack traces in UI
- Retry buttons on all recoverable errors

---

## Quality gate

- [ ] Convention discovery done — read 1-2 similar pages
- [ ] Existing shell/layout used — never rebuilt
- [ ] Loading skeleton before data (matches populated shape)
- [ ] Empty state: icon + message + CTA
- [ ] Error state: message + retry
- [ ] All colors: semantic tokens (verified against similar page)
- [ ] Spacing matches existing scale
- [ ] No `alert()` — project's toast/notification only
- [ ] Submit buttons show loading while pending
- [ ] Lint passes
- [ ] `DESIGN-SPEC.md` honoured where one exists — direction axes, brief constraints, and the
      page supporting the recorded signature moment rather than competing with it
- [ ] `/design-check` run on the built page (adherence, tells, monotony, signature) — the items
      above are self-marking; the command measures the code independently
