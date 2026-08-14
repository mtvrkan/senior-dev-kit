# Project Preset — Ruby on Rails 7/8

<!-- reviewed: 2026-08 — the 7/8 version claim in this heading only. Rails 8 is current and 7 is
still maintained, so both remain supported floors. The idioms and commands below were not
re-verified in this pass; re-check them before widening this marker's scope. -->

## Architecture

- Conventional Rails layout. Fat model / skinny controller, with business logic that spans
  models extracted into `app/services/` (plain POROs with a single `call`).
- Controllers: authenticate → authorize → call a service or model method → render. No queries
  built in the controller, no logic in views.
- Concerns are for genuinely shared behaviour, not a dumping ground for a long model.

```ruby
class PostsController < ApplicationController
  before_action :authenticate_user!

  def show
    @post = current_user.posts.find(params[:id])   # scoped — this is the authorization
    authorize @post                                 # Pundit, if policies are in use
  end

  def create
    @post = CreatePost.new(current_user, post_params).call
    if @post.persisted?
      redirect_to @post, notice: "Post created"
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def post_params
    params.require(:post).permit(:title, :body)     # strong params = the allowlist
  end
end
```

`Post.find(params[:id])` instead of `current_user.posts.find(...)` is an IDOR. Scope through the
association, always.

## Strong parameters and mass assignment

`params.permit` is the allowlist. `permit!` disables it entirely and must never appear.
Never permit `:role`, `:admin`, `:user_id` or anything else the user shouldn't set.

## ActiveRecord — N+1 and query safety

```ruby
# WRONG — N+1
Post.all.each { |p| puts p.author.name }

# RIGHT
Post.includes(:author).each { |p| puts p.author.name }
# preload / eager_load when you need to control the strategy explicitly
```

- The `bullet` gem in development turns N+1 into a visible failure instead of a slow page.
- `where("name = ?", name)` — never `where("name = '#{name}'")`. `order(params[:sort])` is
  injectable too; allowlist the column.
- `find_each` for large sets; `.all.each` loads the whole table into memory.
- `pluck` when you need columns, not objects.

## Migrations are Tier 3

`rails db:migrate` on production data is a Tier 3 change: reversible `change` (or explicit
`up`/`down`), `null: false` only after a backfill, and `disable_ddl_transaction!` +
`algorithm: :concurrently` for indexes on a large table so the migration doesn't lock writes.
Add the FK index — Rails creates the foreign key, not the index.

## Background jobs

Anything over ~200ms (mail, PDF, third-party call) goes to ActiveJob (Sidekiq/GoodJob). Jobs take
ids, never AR objects, and are idempotent — retries happen.

## Security

- `credentials.yml.enc` + `master.key` for secrets; `master.key` is never committed.
- CSRF protection stays on for session-based apps; skipping it needs a comment saying why.
- `html_safe` / `raw` on user content is XSS. ERB escapes by default — leave it that way.
- `strong_migrations` and `brakeman` in CI catch most of the above mechanically.

## Verification

```bash
bundle exec rspec spec/models/post_spec.rb:42   # targeted
bundle exec rubocop
bundle exec brakeman -q                          # security scan
bin/rails zeitwerk:check                         # autoload/naming integrity
bundle exec rspec                                # full suite before a merge
```

## Anti-patterns

- `Model.find(params[:id])` without scoping to `current_user`.
- `params.permit!`, or permitting a privilege field.
- String interpolation in `where`/`order`.
- `.all.each` over a large table instead of `find_each`.
- Business logic in a controller, a view, or a callback chain nobody can follow
  (`after_save` triggering another save is how a Rails app becomes unreadable).
- `html_safe` on anything user-supplied.
- A migration that adds a foreign key with no index, or `null: false` with no backfill.
