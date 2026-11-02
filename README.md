# BookNook Server

Express and MongoDB API for BookNook, a small online library. Client repository: [booknook-frontend](https://github.com/dev-ahsan7/booknook-frontend).

## API routes

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/books` | Public | All books, newest first. Supports `?limit=6` and `?email=` |
| GET | `/books/:id` | Token | One book |
| POST | `/books` | Token | Add a book |
| PATCH | `/books/:id` | Token, owner | Update a book |
| DELETE | `/books/:id` | Token, owner | Delete a book that nobody has borrowed |
| POST | `/borrows` | Token | Borrow a book for 7 days |
| GET | `/borrows` | Token | Borrows of the logged in user |
| DELETE | `/borrows/:id` | Token, owner | Return a book |

Tokens are JWTs from Better Auth on the client side. The server checks them with `jose` against the client's JWKS endpoint.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the values first.

| Variable | Value |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `CLIENT_URL` | URL of the client, used for CORS and JWKS |
| `PORT` | Port for local development |
