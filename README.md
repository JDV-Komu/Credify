# Credify

Credify is a simple fake-news analyzer web app. Users can input a URL, text, or image link and receive a single verdict: `Fake News`, `Not Fake News`, or `Unsure`.

## Features

- Single input field for URL, image, or text
- Guest mode: analyze without saving history
- Account mode: login/register and store analysis history
- Backend-ready AI integration point for real fake-news classification
- Simple, clean web UI with one analysis flow

## Project Structure

- `server.js` — Express backend with session support and SQLite storage
- `public/` — Static front-end files
- `public/index.html` — Main UI
- `public/styles.css` — Basic styling
- `public/app.js` — Front-end logic and API calls
- `credify.db` — SQLite database file (auto-created)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open `http://localhost:4000` in your browser.

## Backend Guide

### Data flow

- Front-end sends `POST /api/analyze` with a single `input` string, or uploads a file through `POST /api/analyze-file`.
- Backend runs `analyzeFakeNews(input)` and returns a verdict.
- Logged-in users also have results persisted in `analyses`.
- `GET /api/history` returns saved analysis records for the authenticated user.

### Session behavior

- Guest users can analyze without logging in.
- Account users can register or log in, then their results are stored in the database.

### AI integration

The current implementation uses a lightweight placeholder analyzer in `server.js`.

Replace `analyzeFakeNews()` with your real AI provider logic. Example:

```js
async function analyzeFakeNews(content) {
  // Call your AI model or API here.
  const response = await someAiClient.analyze({ input: content });
  return {
    label: response.label,
    confidence: response.confidence,
    reasoning: response.summary
  };
}
```

#### Example AI provider points

- OpenAI or Anthropic classification endpoint
- Custom transformer microservice
- Third-party fake-news detection model

### Recommended backend improvement

- Add real AI classification service
- Use a durable session store in production
- Add input validation for URLs and image links if desired
- Harden auth with email verification for account mode

## Notes

- No separate buttons are used for data types. The UI only has one input field and one analyze action.
- Guest mode works instantly and does not persist history.
- Account mode saves results and shows user history.

Enjoy building Credify! Replace the placeholder analyzer with a real AI model to make detection reliable.
