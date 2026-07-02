# Project Preset — Django

## Architecture

- Respect existing app boundaries.
- Keep views/viewsets thin when serializers/services/managers exist.
- Use Django forms/serializers for validation according to project pattern.
- Do not create migrations unless explicitly routed as DB change.

## Security

- Check permissions and object ownership.
- Avoid exposing sensitive model fields.
- Keep settings/secrets untouched unless requested.
- Protect against mass assignment in serializers/forms.

## Data / performance

- Watch for N+1 queries; use `select_related` / `prefetch_related` when justified.
- Use transactions for multi-step writes.
- Prefer additive migrations.

## Verification

- pytest | manage.py test | ruff | mypy (if configured)

## Anti-patterns

- Creating migrations as a side effect of unrelated work.
- Skipping permission checks in viewsets.
- Broad settings changes for a local feature.

---

## Design From Scratch — Django Admin Page Standard

Use when building a new admin view. First detect the frontend approach.

### Step 0 — Detect admin frontend approach

| Detected | Approach |
| --- | --- |
| `django.contrib.admin` in INSTALLED_APPS + `unfold`/`jazzmin`/`grappelli` | Enhanced Django Admin |
| `djangorestframework` + React/Vue (separate SPA) | DRF API — follow React/Vue preset |
| `htmx` in templates | HTMX + Django templates |
| `channels` | Django Channels + async views |
| none of above | Plain Django templates + Tailwind/Bootstrap |

### Django Admin (built-in, possibly with Unfold/Jazzmin)

```python
# admin.py
@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['title']
    readonly_fields = ['created_at']
    # Unfold: use fieldsets for layout
```

Unfold/Jazzmin/Grappelli: use their `ModelAdmin` patterns — never hand-roll table HTML inside admin.
For custom admin pages: use `admin.AdminSite` + custom view within the admin site context.

### DRF API + SPA Frontend

- View: `ModelViewSet` or `APIView` / `GenericAPIView` — keep thin
- Serializer: all validation in serializer, not view
- Permissions: `permission_classes` on every viewset/view
- Frontend: follow the matching React or Vue preset design standard

### HTMX + Django Templates

```html
<!-- page template -->
{% extends "admin/base.html" %}
{% block content %}
<div hx-get="/admin/items/" hx-trigger="load" hx-target="#items-container" hx-indicator="#spinner">
  <div id="spinner" class="htmx-indicator"><!-- loading spinner --></div>
  <div id="items-container">
    {% if not items %}
      <!-- empty state -->
    {% else %}
      <!-- table -->
    {% endif %}
  </div>
</div>
{% endblock %}
```

Use `django-htmx` patterns if installed. Feedback: Django messages framework via `messages.success(request, '...')` rendered in template — never JavaScript `alert()`.

### Plain Django Templates + Tailwind/Bootstrap

```python
# views.py (Class-Based View)
class ItemListView(LoginRequiredMixin, ListView):
    model = Item
    template_name = 'admin/items/list.html'
    context_object_name = 'items'
    paginate_by = 20

    def get_queryset(self):
        return Item.objects.filter(user=self.request.user).order_by('-created_at')
```

```html
<!-- template -->
{% extends "admin/base.html" %}
{% block content %}
  {% if items %}
    <!-- table with items -->
  {% else %}
    <!-- empty state: icon + message + create CTA -->
  {% endif %}
{% endblock %}
```

Loading state: for synchronous Django views, there's no loading state — content is server-rendered.
For async operations (AJAX): show spinner via JavaScript / HTMX indicator.

### Universal rules (all approaches)

1. Find similar existing view/template — read it, match its pattern
2. Use project's base template (`base.html`, `admin/base.html`) — never build layout from scratch
3. Use Django's `{% csrf_token %}` in all POST forms
4. Pagination: Django's built-in `Paginator` / `ListView.paginate_by`
5. No hardcoded colors in templates — use existing CSS classes
6. Error handling: catch `Exception` in views, log it, show user-friendly message
7. For API endpoints: always return consistent `{"status": "ok", "data": ...}` / `{"error": "..."}` — match existing API shape
8. Never `print()` in production views — use `logger = logging.getLogger(__name__)`
