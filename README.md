# TangTu — Tanggal Tua

*Selamat datang di tanggal tua.* A private money tracker: log where your money goes in categories you define,
and see the month at a glance. English | Bahasa Indonesia.

Since 0.5.0 your data lives in **your own Supabase project**. There is no shared server: whoever builds the app
creates a free Supabase project, and only the people they add can sign in.

- Product spec: [`docs/SPEC.md`](docs/SPEC.md) — read it before changing behaviour.
- Rules for contributors and AI agents: [`AGENTS.md`](AGENTS.md)
- Release history: [`CHANGELOG.md`](CHANGELOG.md)

## Running your own TangTu

You need a computer with Node.js, a free [Supabase](https://supabase.com) account and a free
[Expo](https://expo.dev) account. About 20 minutes.

1. **Create a Supabase project** (the free plan is enough; pick the region closest to you, and keep the
   database password somewhere safe: step 2 asks for it). Free projects are paused after a week without use;
   if the app says it can't reach your data after a long break, resume the project in the Supabase dashboard.
2. **Get the code and create the tables.** In this folder:
   ```bash
   npm install
   npx supabase init          # once: the CLI's local settings (answer "N" to the editor questions)
   npx supabase login         # opens the browser
   npx supabase link          # pick your project, then type its database password
   npx supabase db push       # creates the tables from supabase/migrations
   ```
   The CLI's own files (`supabase/config.toml`, `supabase/.temp/`) stay on your computer; git ignores them.
   Never change the tables in the dashboard's SQL or table editor: later updates would fail.
3. **Close the door.** In the dashboard: Authentication → Sign In / Providers → turn **off** "Allow new users to
   sign up". Then Authentication → Users → **Add user → Create new user** for each person who may sign in
   (email + password, with **Auto Confirm User** ticked, or the sign-in is refused until the email is
   confirmed). There is no sign-up and no password reset in the app: you add people and reset passwords here.
4. **Connect the app.** Copy `.env.example` to `.env` and fill in your project's URL and **publishable** key
   (Project Settings → API keys, `sb_publishable_…`). Never use the secret key (`sb_secret_…`): it can read
   everyone's data and must not be in the app.
5. **Build the Android app** (an APK you install on your phone). Put the same two values in your Expo project's
   environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), then:
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
   Install the APK and sign in with a user from step 3.

**Coming from the offline version (0.4.x)?** Install 0.5.0 over it and sign in: the app finds the data on the
phone and offers to move it to your account (the copy on the phone is left as it was). Exporting a backup in
0.4.x and restoring it in 0.5.0 works too.

**No CLI? Use your own fork and Supabase's GitHub integration instead of step 2:** fork this repo, then in the
dashboard Project Settings → Integrations → GitHub → Authorize, pick your fork, working directory `.`, turn on
"Deploy to production" (production branch `master`), leave "Automatic branching" off. Every push to `master`
applies new migrations; push once after enabling it to create the tables.

**Updating later:** when a release says it has a new migration, run `npx supabase db push` (or push the update
to your fork with the GitHub integration on) before installing it.

## Developing

```bash
npx expo start                      # dev client; add --go for Expo Go
npm run typecheck && npm test && npx expo lint
npm run test:live                   # optional: the data layer against your project, on two TEST accounts (see the file's header)
```

The dev tools' mock data and "Nuke" replace the **signed-in account's** data: use them only signed in to a test
account (or a separate project), never your own.
