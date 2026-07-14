# Project Preset — Angular

## Architecture

- Detect pattern: `NgModule`-based (pre-v17) vs standalone components (v17+) — match what exists.
- Services: all data fetching, business logic, state. Inject via `inject()` (v14+) or constructor DI.
- Components: presentation only. No `HttpClient` calls directly in components when services exist.
- Standalone components: `@Component({ standalone: true, imports: [...] })` — no module needed.
- Smart/dumb split: smart (container) components inject services and manage state; dumb (presentational) receive `@Input()` and emit `@Output()`.

## Services & Dependency Injection

```typescript
// data.service.ts
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient)
  private apiUrl = inject(API_URL_TOKEN)  // use tokens for config

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`).pipe(
      catchError(err => { throw new Error(err.error?.message ?? 'Fetch failed') })
    )
  }
}
```

Provide at feature level when service is not global: `providers: [FeatureService]` in route config.

## Routing (Angular 17+)

Use lazy-loaded routes with standalone components:

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  {
    path: 'admin',
    canActivate: [AuthGuard],
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
]
```

Guards: `CanActivateFn` (functional guards preferred in v15+) — never check auth in components.

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService)
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'])
}
```

## RxJS Patterns

```typescript
// Prefer declarative streams over imperative subscribe
users$ = this.usersService.getUsers().pipe(
  startWith(null),
  catchError(() => of([]))
)

// Template: use async pipe (auto-subscribes + unsubscribes)
// <div *ngIf="users$ | async as users">...</div>

// If you must subscribe imperatively: always unsubscribe
private destroy$ = new Subject<void>()

ngOnInit() {
  this.service.data$.pipe(takeUntil(this.destroy$)).subscribe(...)
}

ngOnDestroy() { this.destroy$.next(); this.destroy$.complete() }

// Angular v16+ preferred: takeUntilDestroyed()
data$ = this.service.data$.pipe(takeUntilDestroyed())
```

Never subscribe without cleanup unless `async` pipe is used.

## Signals (Angular v17+)

Prefer signals for local component state:

```typescript
export class PageComponent {
  private service = inject(PageService)
  
  items = signal<Item[]>([])
  isLoading = signal(true)
  error = signal<string | null>(null)
  
  // Derived state
  isEmpty = computed(() => !this.isLoading() && this.items().length === 0)

  ngOnInit() {
    this.service.getItems().subscribe({
      next: data => { this.items.set(data); this.isLoading.set(false) },
      error: err => { this.error.set(err.message); this.isLoading.set(false) },
    })
  }
}
```

## HTTP Interceptors

Never modify global interceptors for a local feature. Add new interceptors in the feature's provider scope only.

```typescript
// auth.interceptor.ts (functional style, v15+)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken()
  if (!token) return next(req)
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
}
```

## UI / Forms

- Detect form approach: ReactiveFormsModule (`FormBuilder`) vs template-driven (`ngModel`) — match project.
- Submit button: `[disabled]="form.invalid || isSubmitting"` + loading spinner.
- Feedback: `MatSnackBar.open()` / `MessageService` (PrimeNG) — never `alert()`.
- Cleanup: `takeUntilDestroyed()` (v16+) / `async` pipe / `ngOnDestroy` — always unsubscribe.

## Security

- Auth guards on all protected routes — never duplicate auth logic in components.
- Keep interceptors, guards, and global providers untouched unless explicitly requested.
- Do not expose secrets, stack traces, or internal error messages to templates.
- Environment config: `environment.ts` / `environment.prod.ts` — never `window.ENV`.

## Verification

- `ng lint` — ESLint with Angular rules
- `ng test --watch=false --no-progress` — targeted: `ng test --include=**/users.component.spec.ts`
- `ng build --configuration=production` — catches template compilation errors
- `ng serve` for visual verification

## Anti-patterns

- `HttpClient` calls directly in components when a service exists.
- Subscribing in `ngOnInit` without cleanup (`takeUntilDestroyed` / `async` pipe / `ngOnDestroy`).
- Changing global providers, interceptors, or guards for a local feature.
- Using `any` type in templates or service return types.
- `*ngIf` on a container that re-mounts expensive children — use `[hidden]` or `@if` with signals.
- Skipping loading/empty/error states for async data.
- `document.getElementById()` or direct DOM manipulation — use `ElementRef` + `Renderer2`.

---

## Design From Scratch — Angular Admin Page Standard

Use when building a new admin page/component from scratch.

### Step 0 — Detect installed UI library (read package.json)

| Installed | Component system |
| --- | --- |
| `@angular/material` | Angular Material |
| `primeng` | PrimeNG |
| `@taiga-ui/core` | Taiga UI |
| `ng-zorro-antd` | NG-ZORRO (Ant Design Angular) |
| none | plain Tailwind / Bootstrap |

### Pre-code checklist (all 5 required)

1. Find similar existing component/page — read it, match its structure exactly
2. Find shell/layout component (`AdminLayoutComponent`, `DashboardComponent`) — use `<router-outlet>` inside it
3. Identify data pattern: `HttpClient` service / NgRx / `async` pipe / signals
4. List components from installed library only
5. Plan all 4 states: loading | empty | error | populated

### Angular signals state pattern (v17+)

```typescript
// Component
export class PageComponent {
  private svc = inject(PageService)
  data = signal<Item[]>([])
  isLoading = signal(true)
  error = signal<string | null>(null)

  ngOnInit() {
    this.svc.getItems().subscribe({
      next: items => { this.data.set(items); this.isLoading.set(false) },
      error: err => { this.error.set(err.message); this.isLoading.set(false) }
    })
  }
}
```

```html
<div *ngIf="isLoading()"><!-- loading skeleton --></div>
<div *ngIf="error()"><!-- error state --></div>
<div *ngIf="!isLoading() && !data().length"><!-- empty state --></div>
<div *ngIf="data().length"><!-- populated --></div>
```

Or with `AsyncPipe` + `BehaviorSubject` if project uses that pattern — match existing.

Loading/empty/error state detail is in `rules/100-web.md`'s THREE MANDATORY STATES section. Angular-specific: `<mat-skeleton>` / `<p-skeleton>` for loading; `*ngIf="!items.length"` for empty; `*ngIf="error()"` for error — never swallow silently.

**Form pattern:**

- `ReactiveFormsModule`: `FormBuilder` + `Validators` — if project uses it
- `FormsModule`: `ngModel` — if project uses it
- Match whichever is already in the project
- Submit button: `[disabled]="form.invalid || isSubmitting"` + loading spinner inside
- Feedback: `MatSnackBar.open()` / `MessageService` (PrimeNG) — never `alert()`

**Cleanup:** always unsubscribe — `takeUntilDestroyed()` (v16+) / `async` pipe / `ngOnDestroy` + `Subject` — match project pattern.

### Angular Material palette (if installed)

`<mat-table>` / `<mat-paginator>` | `<mat-form-field>` | `<mat-dialog>` | `MatDialogRef` | `<mat-chip>` | `<mat-skeleton>` | `MatSnackBar` | `<mat-menu>` | `<mat-select>` | `<mat-tab-group>`

Colors: `mat-color($primary)` / CSS vars `--mat-primary` / `color="primary"` prop — never hardcoded.
Typography: `mat-headline-5`, `mat-body-1` etc. — never raw `font-size`.

### PrimeNG palette (if installed)

`<p-table>` | `<p-form>` | `<p-dialog>` | `<p-tag>` | `<p-skeleton>` | `<p-message>` | `<p-tieredMenu>` | `<p-dropdown>` | `<p-tabView>` | `MessageService.add()`

Colors: PrimeFlex tokens (`text-primary`, `surface-ground`, `text-color-secondary`) — never hardcoded.
