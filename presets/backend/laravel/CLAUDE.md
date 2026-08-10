# Project Preset — Laravel

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
        $this->authorize('view', $user);             // policy — never skip
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
            'role'  => ['required', Rule::in(['user', 'admin'])],
        ];
    }
}
```

`$request->validated()` returns only the validated keys — that is the mass-assignment allowlist.
Never pass `$request->all()` into `create()` or `update()`.

## Authorization — policies, on every resource read

```php
// app/Policies/PostPolicy.php
public function view(User $user, Post $post): bool
{
    return $post->user_id === $user->id;
}

// Controller: $this->authorize('view', $post);
// Blade:      @can('view', $post) ... @endcan
```

A `findOrFail($id)` with no policy check is an IDOR. Route-model binding does not authorize.

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
// app/Exceptions/Handler.php — never leak stack traces
public function register(): void
{
    $this->renderable(fn (DomainException $e) => response()->json(
        ['message' => $e->getMessage()], 422
    ));
}

Log::info('user.created', ['user_id' => $user->id]);   // context array, no PII
```

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
