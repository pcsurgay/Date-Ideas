# IdeaBoard

Repository: Date-Ideas (Date Ideas App mit Dana)

An open source app for collecting places and trip ideas with friends. Make a
group, invite friends with a link, paste links from Google Maps, Apple Maps,
TripAdvisor and more, and the group sees them as tiles. Tap a tile to open the
link in the app it came from.

Built as a PWA (installable web app) with Next.js and Supabase. Everything
below runs on free tiers.

## What works

- Sign in with an email and a one-time code
- Create groups, invite friends with a link (the Invite button uses the iOS
  share sheet)
- Paste a link (or a whole shared text containing one) to add a tile
- Tiles show the place name and preview image when the site provides them
- New tiles from friends appear live
- Authors (and the group owner) can remove tiles
- Installable on the iPhone home screen

There is no separate friends list yet: people you share a group with are your
friends. Joining happens through the invite link.

## Stack

| Part | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind |
| Backend | Supabase (Postgres, Auth, Realtime, row-level security) |
| Hosting | Vercel |

## Setup

### 1. Supabase project

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor**, paste the contents of
   `supabase/migrations/0001_init.sql`, and run it.
3. Go to **Authentication -> Email Templates**. Open both **Confirm signup**
   and **Magic Link** and make sure each shows the code, for example by adding
   this line to the body:

   ```
   <p>Your sign-in code: <strong>{{ .Token }}</strong></p>
   ```

   The app signs in with this code instead of a link, because on iPhone a link
   in an email opens Safari rather than the installed home-screen app.
4. Copy the project URL and the publishable (anon) key from
   **Project Settings -> API**.

Supabase's built-in email sender is only meant for testing and has a very low
sending limit. That is fine for you and a friend; set up your own SMTP provider
before inviting more people.

### 2. Run it locally

```bash
cp .env.example .env.local   # then fill in the two values
npm install
npm run dev
```

Open <http://localhost:3000>.

Useful scripts: `npm run lint`, `npm test`, `npm run build`, and
`npm run icons` (regenerates the app icons from `scripts/make-icons.mjs`).

### 3. Deploy to Vercel (also how you test on an iPhone)

1. Push this repo to GitHub.
2. In Vercel, **Add New -> Project**, import the repo, and add the two
   environment variables from `.env.local`.
3. Deploy. Every push to `main` redeploys, and every pull request gets its own
   preview URL.

### 4. Test on an iPhone, free

Open your Vercel URL in Safari, tap **Share -> Add to Home Screen**, and launch
it from the home screen. No Apple Developer account is needed for a PWA.

Things worth checking on the phone first:

- Signing in with the emailed code inside the home-screen app
- Tapping a Google Maps / Apple Maps / TripAdvisor tile: does it open the
  installed app or a browser sheet?
- The Invite button and opening an invite link as a second user

## How it works

- `supabase/migrations/0001_init.sql`: tables, row-level security (members can
  only see their own groups' data) and the join-by-invite-code function.
- `src/proxy.ts`: refreshes the session and redirects signed-out visitors to
  `/login`.
- `src/app/api/link-preview/route.ts`: follows short links, reads the page's
  Open Graph title and image. It only fetches hosts on an explicit allowlist
  (`src/lib/links.ts`) and re-checks every redirect, so it can't be used to
  reach internal addresses. Unknown sites are saved as plain link tiles.
- `src/lib/links.ts`: link detection and place-name parsing, covered by
  `tests/links.test.ts`.

To support another site (Booking, Airbnb and GetYourGuide are already
recognised), add its host to `ALLOWED_BASE_HOSTS` and a rule in `detectSource`.

## Known limits

- **No share-sheet integration on iOS.** A PWA can't appear in the iPhone share
  menu, so users copy a link and paste it in. A native app (for example Expo)
  could add "Share to IdeaBoard" later and would reuse the same Supabase
  backend.
- **Google Maps metadata is thin.** The place name is parsed from the URL when
  possible; photos often aren't available without the paid Google Places API.
- **No rate limiting** on the link-preview route yet.
- **Display names** come from the email prefix and can't be edited in the UI yet.

## Ideas for next steps

- Edit your display name; leave a group; remove a member
- A short note or tag on each tile, and filters by source
- Map view of all the places in a group
- Voting on ideas

## License

MIT, see `LICENSE`.
