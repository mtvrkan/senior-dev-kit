# Project Preset — Rails

## Architecture

- Respect MVC boundaries and existing service/form/query objects if present.
- Keep controllers thin — business logic in service objects, form objects, or query objects.
- Do not create migrations unless DB change is explicitly requested.
- Keep auth/payment/initializers untouched unless requested.
- Modern Rails: Rails 7.2+ / 8.0, Hotwire (Turbo + Stimulus), Zeitwerk autoload.

## Security

- Use strong parameters in every controller action that accepts input.
- Check authorization (Pundit / CanCanCan / custom before_action) for every resource.
- Avoid exposing sensitive errors — rescue and log, show generic user message.
- Be careful with mass assignment and callbacks.

## Data

- Use transactions for multi-step writes: `ActiveRecord::Base.transaction { ... }`
- Avoid N+1: use `includes`, `preload`, `eager_load` when joining data for display.
- Prefer additive migrations. Never destructive in one step without backfill plan.
- Keep background job behavior (Sidekiq / Solid Queue) consistent.

## Verification

- `bundle exec rspec` / `bundle exec rails test`
- `bundle exec rubocop -a` (auto-safe fixes only)
- `bundle exec brakeman` (if installed — security scan)

## Anti-patterns

- Large callbacks with business logic (use service objects).
- Controller-heavy implementations (fat controller = thin model = wrong).
- Creating destructive migrations directly.
- Using `render json:` in controllers that should return HTML (use Turbo Streams).

---

## Design From Scratch — Rails Admin Page Standard

Use when building a new admin controller + view from scratch.

### Step 0 — Detect frontend approach (read Gemfile + app/javascript)

| Detected | Approach |
| --- | --- |
| `hotwire-rails` / `turbo-rails` + `stimulus-rails` | **Hotwire** (modern default for Rails 7+) |
| `inertia-rails` + React/Vue in package.json | **Inertia.js** — follow React/Vue preset |
| `react-rails` / `react_on_rails` | React component approach |
| none of the above | Plain ERB + Stimulus + Tailwind |

### Hotwire (Turbo + Stimulus) — Modern Rails approach

**Controller:**

```ruby
# app/controllers/admin/items_controller.rb
class Admin::ItemsController < Admin::BaseController
  before_action :set_item, only: [:show, :edit, :update, :destroy]

  def index
    @items = Item.order(created_at: :desc).page(params[:page])
    # Turbo Frame: respond to both full-page and frame requests automatically
  end

  def create
    @item = Item.new(item_params)
    if @item.save
      redirect_to admin_items_path, notice: "Successfully created."
    else
      render :new, status: :unprocessable_entity  # 422 triggers Turbo to replace form
    end
  end

  private
  def set_item = @item = Item.find(params[:id])
  def item_params = params.require(:item).permit(:title, :status)
end
```

**View pattern (ERB + Turbo):**

```erb
<%# app/views/admin/items/index.html.erb %>
<%= turbo_frame_tag "items_list" do %>
  <% if @items.empty? %>
    <%# Empty state %>
    <div class="empty-state">
      <p class="text-muted">No records yet.</p>
      <%= link_to "Create first record", new_admin_item_path, class: "btn btn-primary" %>
    </div>
  <% else %>
    <table class="table">
      <% @items.each do |item| %>
        <tr>
          <td><%= item.title %></td>
          <td>
            <%= turbo_frame_tag "item_actions_#{item.id}" do %>
              <%= link_to "Edit", edit_admin_item_path(item), class: "btn btn-sm" %>
              <%= button_to "Delete", admin_item_path(item), method: :delete,
                  data: { turbo_confirm: "Are you sure?" }, class: "btn btn-sm btn-danger" %>
            <% end %>
          </td>
        </tr>
      <% end %>
    </table>
    <%= paginate @items %>
  <% end %>
<% end %>
```

**Form with Stimulus (loading state):**

```erb
<%= form_with model: @item, data: { controller: "form-submit" } do |f| %>
  <%= f.text_field :title, class: "form-control" %>
  <%= f.submit "Save", class: "btn btn-primary",
      data: { form_submit_target: "submit", disable_with: "Saving..." } %>
<% end %>
```

Flash messages via Turbo Streams — never JavaScript `alert()`:

```ruby
# In controller after save:
flash.now[:notice] = "Successfully saved."
# Render turbo_stream or redirect — flash renders in layout partial
```

### Required states (all views)

**Loading:** Turbo handles automatically for frame requests. For AJAX: Stimulus controller + CSS class during fetch.
**Empty:** `<% if @records.empty? %>` — icon + message + create CTA.
**Error:** form re-render with `status: :unprocessable_entity` + `f.object.errors` displayed.
**Populated:** table / list / grid.

### Layout

Always extend from existing admin layout:

```erb
<%# Correct %>
<% content_for :title, "Items" %>
<%= render "admin/shared/page_header", title: "Items", new_path: new_admin_item_path %>

<%# Never build your own admin chrome %>
```

### Modern Rails gems (free, prefer these)

| Need | Gem |
| --- | --- |
| Pagination | `kaminari` or `pagy` (pagy is faster) |
| Authorization | `pundit` or `action_policy` |
| Admin framework | `trestle` / `avo` (free tier) / custom Hotwire |
| Background jobs | `sidekiq` (free) / `solid_queue` (Rails 8 built-in) |
| File upload | `active_storage` (built-in) + `shrine` (if more control needed) |
| Serialization | `jbuilder` (built-in) / `blueprinter` / `alba` |
| Testing | `rspec-rails` + `factory_bot` + `shoulda-matchers` |
| Linting | `rubocop-rails-omakase` (Rails team style) |

**Ask before using:** Avo Pro, RailsAdmin commercial, paid upload services — free alternatives exist.
