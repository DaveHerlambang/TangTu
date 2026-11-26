-- TangTu 0.5.0: the online schema (docs/SPEC.md §3, §11).
-- Append-only: once this file has shipped it is never edited; a change is a new migration.
-- Never change the schema in the dashboard: it bypasses this history (§0.4).
--
-- Every table belongs to an account (`user_id`, filled by `auth.uid()`), and row level security lets an
-- account see and change only its own rows. Ids are random UUIDs (`gen_random_uuid()`): they say nothing about
-- how many rows anyone has, can't be guessed, and a later offline or web version can make them itself. A
-- default (not a generated column) lets Undo put a row back with its own id. A restore still gives rows new
-- ids (`replace_all_data`), so one account's backup can go into another while the first still has its rows.
-- Ties in an order fall back on `created_at`, then `id` (random, but fixed: the order never flickers).

-- ---------------------------------------------------------------------------------------------------------
-- Categories (§3, §7). No seed rows: the templates live in the app. `name` NULL = an untouched template
-- category, named from the app's dictionary so it follows the language. Icon and tint are checked by the app,
-- so a later version can add some without a migration.
create table public.categories (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name         text        check (name is null or length(btrim(name)) > 0),
  template_key text,
  kind         text        not null check (kind in ('EXPENSE', 'INCOME')),
  icon         text        not null check (length(icon) > 0),
  tint         text        not null check (length(tint) > 0),
  position     integer     not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (name is not null or template_key is not null),
  -- The target of the transactions' foreign key: a transaction's category is the same account's, same kind.
  unique (id, user_id, kind)
);
create index categories_user_kind on public.categories (user_id, kind, archived_at, position);
-- Active typed names are unique per account and kind (the app also checks names across both languages).
create unique index categories_active_name on public.categories (user_id, kind, lower(btrim(name)))
  where archived_at is null and name is not null;

-- ---------------------------------------------------------------------------------------------------------
-- Transactions (§3). `amount` is a positive whole number in the smallest unit of `currency` (rupiah since
-- 0.2.0; older rows may carry another currency, §14.1). The sign comes from `kind`. A used category can't be
-- deleted (restrict), only archived.
create table public.transactions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('EXPENSE', 'INCOME')),
  amount      bigint      not null check (amount > 0),
  currency    text        not null default 'IDR' check (length(currency) = 3),
  category_id uuid        not null,
  note        text        not null default '',
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint transactions_category_fkey
    foreign key (category_id, user_id, kind) references public.categories (id, user_id, kind) on delete restrict
);
create index transactions_user_occurred on public.transactions (user_id, occurred_at desc, created_at desc);
create index transactions_user_category on public.transactions (user_id, category_id, occurred_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- The bell's history (§8.7): what happened (a kind and JSON params), never sentences. Not backed up; cleared
-- on restore. The dedupe key is unique per account, so two devices never write the same message twice.
create table public.activity (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null,
  params     jsonb       not null default '{}'::jsonb,
  ref_type   text,
  ref_id     text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index activity_user_created on public.activity (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- Row level security: the only thing between the data and anyone holding the publishable key (§3).
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.activity enable row level security;

revoke all on table public.categories, public.transactions, public.activity from anon, authenticated;
grant select, insert, update, delete on table public.categories, public.transactions, public.activity to authenticated;

create policy "own categories: read" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "own categories: add" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own categories: change" on public.categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own categories: delete" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own transactions: read" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own transactions: add" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own transactions: change" on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions: delete" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own activity: read" on public.activity for select to authenticated using ((select auth.uid()) = user_id);
create policy "own activity: add" on public.activity for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own activity: delete" on public.activity for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------------------
-- Active categories of a kind, most used in [since, until) first, then the user's order (§4: the grid).
create function public.categories_by_use(p_kind text, p_since timestamptz, p_until timestamptz)
returns setof public.categories
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
    from public.categories c
    left join public.transactions t
      on t.category_id = c.id and t.occurred_at >= p_since and t.occurred_at <= p_until
   where c.kind = p_kind and c.archived_at is null
   group by c.id
   order by count(t.id) desc, c.position, c.created_at, c.id;
$$;

-- Search (§4 Home): note contains `p_text` (case-insensitive, taken literally), or the category is one of
-- `p_name_ids` (categories whose shown name matches, worked out by the app); narrowed to `p_category_ids`
-- when given and to [p_start, p_end) when given. Newest first.
create function public.search_transactions(
  p_text text,
  p_name_ids uuid[],
  p_category_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer
)
returns setof public.transactions
language sql
stable
security invoker
set search_path = ''
as $$
  select t.*
    from public.transactions t
   where (p_start is null or t.occurred_at >= p_start)
     and (p_end is null or t.occurred_at < p_end)
     and (coalesce(btrim(p_text), '') = ''
          or strpos(lower(t.note), lower(btrim(p_text))) > 0
          or t.category_id = any (coalesce(p_name_ids, '{}')))
     and (coalesce(cardinality(p_category_ids), 0) = 0 or t.category_id = any (p_category_ids))
   order by t.occurred_at desc, t.created_at desc, t.id desc
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

-- Every category that has transactions, archived ones too (they're in history): the search filter chips.
-- Expense first, then income; active before archived; the user's order.
create function public.used_categories()
returns setof public.categories
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
    from public.categories c
   where exists (select 1 from public.transactions t where t.category_id = c.id)
   order by case c.kind when 'EXPENSE' then 0 else 1 end, c.archived_at is not null, c.position, c.created_at, c.id;
$$;

-- Restore (§11): replaces all of the signed-in account's categories and transactions with the backup's rows,
-- and clears its bell, in one transaction — every row is accepted or nothing changes. Rows get new ids; a
-- transaction follows its category through the map, whatever the backup's ids were (whole numbers from the
-- offline version, UUIDs since 0.5.0). Another account's rows are never touched.
create function public.replace_all_data(p_categories jsonb, p_transactions jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  c      jsonb;
  t      jsonb;
  new_id uuid;
  ids    jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from public.transactions where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.activity where user_id = uid;

  for c in select value from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    insert into public.categories (user_id, name, template_key, kind, icon, tint, position, archived_at, created_at)
    values (
      uid,
      c ->> 'name',
      c ->> 'template_key',
      c ->> 'kind',
      c ->> 'icon',
      c ->> 'tint',
      coalesce((c ->> 'position')::integer, 0),
      (c ->> 'archived_at')::timestamptz,
      coalesce((c ->> 'created_at')::timestamptz, now())
    )
    returning id into new_id;
    if c ->> 'id' is not null then
      ids := ids || jsonb_build_object(c ->> 'id', new_id);
    end if;
  end loop;

  for t in select value from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) loop
    insert into public.transactions (user_id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at)
    values (
      uid,
      t ->> 'kind',
      (t ->> 'amount')::bigint,
      coalesce(t ->> 'currency', 'IDR'),
      (ids ->> (t ->> 'category_id'))::uuid,
      coalesce(t ->> 'note', ''),
      (t ->> 'occurred_at')::timestamptz,
      coalesce((t ->> 'created_at')::timestamptz, now()),
      coalesce((t ->> 'updated_at')::timestamptz, (t ->> 'created_at')::timestamptz, now())
    );
  end loop;
end;
$$;

revoke all on function public.categories_by_use(text, timestamptz, timestamptz) from public, anon;
revoke all on function public.search_transactions(text, uuid[], uuid[], timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.replace_all_data(jsonb, jsonb) from public, anon;
revoke all on function public.used_categories() from public, anon;
grant execute on function public.used_categories() to authenticated;
grant execute on function public.categories_by_use(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.search_transactions(text, uuid[], uuid[], timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.replace_all_data(jsonb, jsonb) to authenticated;
