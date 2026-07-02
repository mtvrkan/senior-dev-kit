# Project Preset — Laravel

## Architecture

- Respect route/controller/service/action/model boundaries.
- Use Form Requests or validators when project pattern exists.
- Do not create migrations unless DB change is requested.
- Keep middleware/auth/payment config untouched unless requested.

## Security

- Validate input. Check policies/gates/ownership.
- Avoid mass assignment risks; check fillable/guarded.
- Do not expose sensitive config or exceptions.

## Data

- Use transactions for multi-step writes.
- Avoid N+1 queries; use eager loading when justified.
- Prefer additive migrations.

## Verification

- php artisan test | composer test | pint | phpstan (if configured)

## Anti-patterns

- Business logic directly in controllers.
- Creating migrations during unrelated tasks.
- Trusting request user IDs without ownership checks.

---

## Design From Scratch — Laravel Admin Page Standard

Use when building a new admin page. First detect the frontend approach.

### Step 0 — Detect admin frontend approach (read composer.json + package.json)

| Detected | Approach |
| --- | --- |
| `filament/filament` | Filament — use Filament Resources/Pages API |
| `inertiajs/inertia-laravel` + `react` | Inertia.js + React — follow `resources/js/Pages/` pattern |
| `inertiajs/inertia-laravel` + `vue` | Inertia.js + Vue — follow `resources/js/Pages/` pattern |
| `livewire/livewire` | Livewire — use Livewire components |
| none of above | Blade templates + Alpine.js + Tailwind |

### Filament (most common Laravel admin)

```php
// Resource — most from-scratch work is a new Resource
php artisan make:filament-resource Post --generate

// Custom page
php artisan make:filament-page Settings
```

Always:

- Use Filament's built-in `TextColumn`, `TextInputFilter`, `SelectFilter`, `Actions\EditAction`, `Actions\DeleteAction`
- Never build a custom table when `Tables\Table` covers it
- Use `Forms\Schema` for all forms — never raw Blade form
- States are handled by Filament automatically (loading via livewire, empty via `$table->emptyState()`)
- Notifications: `Notification::make()->title('...')->success()->send()` — never raw `session()->flash()`

### Inertia.js + React/Vue

Follow the matching React or Vue design standard (see react-vite or vue-nuxt preset).
Laravel side: thin controller, return `Inertia::render('Page/Name', [...data])`.
No business logic in the controller — use a Service or Action class.

### Livewire

```php
// Component class
class ItemList extends Component {
  public $items = [];
  public $loading = true;

  public function mount() {
    $this->items = Item::all()->toArray();
    $this->loading = false;
  }

  public function render() {
    return view('livewire.item-list');
  }
}
```

Blade template always handles all 4 states:

```blade
@if($loading) <!-- skeleton -->
@elseif($items->isEmpty()) <!-- empty state -->
@elseif($error) <!-- error state -->
@else <!-- table/list -->
@endif
```

Feedback: `$this->dispatch('notify', ['message' => '...', 'type' => 'success'])` or `session()->flash()` — never `alert()`.

### Blade + Alpine.js + Tailwind

```blade
{{-- Loading state --}}
<div x-data="{ loading: true, items: [], error: null }" x-init="fetch('/api/items')
  .then(r => r.json()).then(d => { items = d; loading = false })
  .catch(e => { error = e.message; loading = false })">

  <template x-if="loading"><!-- skeleton --></template>
  <template x-if="error"><!-- error + retry --></template>
  <template x-if="!loading && items.length === 0"><!-- empty --></template>
  <template x-if="items.length > 0"><!-- table --></template>
</div>
```

Use `x-on:notify.window` with a toast component — never `alert()`.

### Universal rules (all approaches)

1. Find similar existing page — read it, match its structure
2. Use existing layout (app.blade.php `@extends`, Filament layout, Inertia `Layout` component)
3. No hardcoded colors — Tailwind semantic classes or library tokens
4. Spacing: 4px/8px multiples — never arbitrary
5. 4 states required: loading | empty | error | populated
6. Form submit: disabled + loading indicator while pending
