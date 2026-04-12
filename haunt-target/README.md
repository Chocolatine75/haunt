# haunt-target

A demo SaaS app for testing the [Haunt](https://github.com/Chocolatine75/haunt) Claude Code plugin.

## Quick start

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

App runs at http://localhost:3000

## Test credentials

| Email | Password | Role |
|---|---|---|
| test@example.com | password123 | user |
| admin@example.com | admin123 | admin |

## Running Haunt against this app

```bash
# Basic test
/haunt:haunt-test http://localhost:3000

# With auth
/haunt:haunt-test http://localhost:3000 --email test@example.com --password password123

# Debug auth issues
/haunt:haunt-test http://localhost:3000 --email test@example.com --password password123 --debug-auth

# Full sweep
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user
```

## Known intentional bugs

These bugs exist by design so Haunt has real issues to find:

- `/signup` — accepts empty email with no error message
- `/dashboard` — loads for unauthenticated users (middleware doesn't protect it)
- `/admin` — role check is client-side only (bypassable)
- `/login` — double-submit possible (button not disabled during async)
- `/settings` — save shows no success or error feedback
- `lib/auth.ts` — password logged in plaintext via console.log
