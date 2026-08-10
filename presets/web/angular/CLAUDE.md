# Project Preset — Angular (v17+, standalone + signals)

## Architecture

- **Standalone components only.** `NgModule` is legacy; new code declares its own `imports`.
- Feature folders with lazy routes: `app/features/<feature>/`, shared primitives in
  `app/shared/`, cross-cutting services in `app/core/`.
- `inject()` over constructor parameter injection — it works in field initializers and functional
  guards/interceptors, where constructor injection does not.

```ts
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [UserCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,   // required, not optional
  template: `
    @if (vm().loading) { <app-skeleton /> }
    @else if (vm().error) { <app-error (retry)="reload()" /> }
    @else if (vm().data; as u) { <app-user-card [user]="u" /> }
    @else { <app-empty /> }
  `,
})
export class UserComponent {
  private readonly service = inject(UserService)
  readonly id = input.required<string>()          // signal input, v17.1+
  protected readonly vm = toSignal(this.service.user$(this.id), { initialValue: LOADING })
}
```

On Angular 19+ the `resource()` / `httpResource()` API gives you `isLoading()` / `error()` /
`value()` directly and replaces the `toSignal` wrapper above — use it if the project is on 19,
and check `ng version` before assuming either shape.

`OnPush` on every component. Default change detection re-checks the whole tree on every event and
is the root cause of most "Angular is slow" reports.

## Signals over RxJS for state

- `signal()` for writable state, `computed()` for derived, `input()`/`output()` for the component
  API, `effect()` for side effects only — never to compute a value.
- Keep RxJS for what it is genuinely good at: HTTP, event streams, debouncing, cancellation.
  `toSignal()` at the boundary where a stream becomes view state.
- Do not mix: a `BehaviorSubject` shadowing a signal for the same state is a bug waiting to
  desynchronize.

## Templates

- New control flow (`@if` / `@for` / `@switch`), not the structural directives.
- `@for` **requires** `track` — `track item.id`, never `track $index` for a list that reorders.
- No function calls in a template binding: it re-evaluates on every change-detection cycle. Use a
  `computed()` or a pure pipe.
- `async` pipe over manual `subscribe()` — it unsubscribes for you.

## Subscriptions leak by default

`takeUntilDestroyed()` on every manual subscription, or use the `async` pipe. A subscription
created in `ngOnInit` with no teardown survives the component and keeps its closure alive.

## HTTP and errors

```ts
// Functional interceptor — auth header, correlation id, error mapping in one place
export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { Authorization: `Bearer ${inject(TokenStore).value()}` } }))
```

Map `HttpErrorResponse` to a domain error at the service edge; a component should never branch on
a status code. Provide `HttpClient` with `withFetch()` and `withInterceptors([...])`.

## Security

- Angular escapes interpolation by default. `bypassSecurityTrustHtml` disables that — every use
  needs a comment justifying it, and never with user content.
- Route guards are UX, not security: the API enforces authorization. A `CanActivate` that hides a
  route does not protect the data behind it.
- Tokens in memory or an httpOnly cookie; `localStorage` is readable by any injected script.

## Verification

```bash
npx ng test --include='**/user.service.spec.ts'   # targeted
npx ng lint
npx ng build                                      # production build catches template type errors
npx ng build --stats-json                         # then inspect the bundle budget
```

Set `budgets` in `angular.json` so a bundle regression fails the build rather than shipping.

## Anti-patterns

- Missing `OnPush`.
- A function call inside a template binding.
- `@for` without `track`, or `track $index` on a reorderable list.
- Manual `subscribe()` without `takeUntilDestroyed()`.
- `effect()` used to derive state that `computed()` should own.
- A `BehaviorSubject` and a signal holding the same state.
- `NgModule` in new code; `any` used to silence a strict-mode error.
- Treating a route guard as an authorization boundary.
