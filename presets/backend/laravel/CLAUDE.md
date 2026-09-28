# Project Preset — Laravel

<!-- reviewed: 2026-09 — the Laravel 11+ claims only: the slim base Controller without
`AuthorizesRequests` (hence `Gate::authorize()`), and exception handling moved from
`app/Exceptions/Handler.php` to `withExceptions()` in `bootstrap/app.php`. Both hold on 12. -->

## Architecture

- Controllers stay thin: validate via a Form Request → call an action/service → return a Resource.
- Business logic lives in single-purpose Action classes (`app/Actions/`) or services — never in
  controllers, never in models.
- Eloquent models hold relationships, casts and scopes. No HTTP, no business rules.
- Route files declare routes only: `routes/web.php`, `routes/api.php`.

```php
// app/Http/Controllers/UserController.php
class UserController extends Controller
{
    public function store(StoreUserRequest $request, CreateUser $createUser): UserResource
    {
        return new UserResource($createUser->handle($request->validated()));
    }

    public function show(User $user): UserResource   // route-model binding
    {
        Gate::authorize('view', $user);              // policy — never skip
        return new UserResource($user);
    }
}
```

## Validation — Form Requests, never inline

```php
class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255', Rule::unique('users')],
            'name'  => ['required', 'string', 'min:1', 'max:100'],
        ];
    }
}
```

`$request->validated()` returns only the validated keys — that is the mass-assignment allowlist.
Never pass `$request->all()` into `create()` or `update()`.

Never accept `role`, `is_admin` or any privilege field in a create/register request — a
client-settable role lets anyone sign up as admin. The action assigns the default role; role
changes go through a separate endpoint authorized by an admin-only policy or gate.

## Authorization — policies, on every resource read

```php
// app/Policies/PostPolicy.php
public function view(User $user, Post $post): bool
{
    return $post->user_id === $user->id;
}

// Controller: Gate::authorize('view', $post);
// Blade:      @can('view', $post) ... @endcan
```

A `findOrFail($id)` with no policy check is an IDOR. Route-model binding does not authorize.

Since Laravel 11 the base `Controller` no longer uses the `AuthorizesRequests` trait, so
`$this->authorize()` is undefined unless the project re-adds that trait. `Gate::authorize()` works
on every version; follow whichever the existing controllers already use.

## Eloquent — N+1 and raw SQL

```php
// WRONG — N+1: one query per post
foreach (Post::all() as $post) { echo $post->user->name; }

// RIGHT — eager load
foreach (Post::with('user')->get() as $post) { echo $post->user->name; }

// Detect in dev: Model::preventLazyLoading() in AppServiceProvider::boot()

// WRONG — SQL injection
DB::select("SELECT * FROM users WHERE email = '$email'");

// RIGHT — bindings
DB::select('SELECT * FROM users WHERE email = ?', [$email]);
```

`$fillable` on every model. `$guarded = []` plus `create($request->all())` is mass assignment.

## Queues — anything over ~200ms

```php
dispatch(new SendWelcomeEmail($user));          // not inline in the request

class SendWelcomeEmail implements ShouldQueue
{
    public int $tries = 3;
    public int $backoff = 30;
}
```

Never queue a full Eloquent model's state you then mutate — jobs serialize by ID and re-fetch.

## Migrations — protected area

Schema changes are Tier 3: plan first, expand-then-contract, never `dropColumn` in the same
deploy as the code that stops using it. `down()` must actually reverse `up()`.

## Errors and logging

```php
// bootstrap/app.php — never leak stack traces
->withExceptions(function (Exceptions $exceptions) {
    $exceptions->render(fn (DomainException $e) => response()->json(
        ['message' => $e->getMessage()], 422
    ));
})

Log::info('user.created', ['user_id' => $user->id]);   // context array, no PII
```

Laravel 11+ has no `app/Exceptions/Handler.php`; exception rendering and reporting are configured in
`bootstrap/app.php` as above. A project upgraded from 10 may still carry the old Handler — edit
whichever one it actually has.

`APP_DEBUG=false` in production, always. `.env` is never committed and never read by tooling.

## Verification

```bash
php artisan test --filter UserTest     # targeted
./vendor/bin/phpunit --filter UserTest # same, without artisan
./vendor/bin/phpstan analyse           # static analysis
./vendor/bin/pint --test               # style check (Laravel Pint)
php artisan route:list                 # confirm a new route registered
```

## Anti-patterns

- `$request->all()` into `create()`/`update()` — mass assignment.
- `findOrFail()` without a matching policy check — IDOR.
- Business logic in controllers or in model methods that hit HTTP.
- `Post::all()` in a view loop — N+1; eager load with `with()`.
- String interpolation in `DB::select`/`DB::raw` — use bindings.
- Long-running work inline in a request instead of a queued job.
- `dd()`/`dump()` left in committed code.
