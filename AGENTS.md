# AGENTS.md: AI TypeSwift Codebase Guide

## Project Overview
**TypeSwift** is an AI-powered typing speed test application built with Flask. It analyzes user typing accuracy, speed, and performance using OpenRouter API-driven AI models. The app features user authentication, persistent result tracking, leaderboards, and admin dashboards with dynamic AI model selection.

---

## Architecture & Data Flows

### Core Stack
- **Backend**: Flask + SQLAlchemy ORM
- **Database**: Neon PostgreSQL (cloud) with SQLite fallback (offline)
- **Auth**: Flask-Login with bcrypt password hashing (scrypt hashes exceed 256 chars)
- **AI Integration**: OpenRouter API (supports multi-model inference)
- **Frontend**: Jinja2 templates + vanilla JS + CSS with theme persistence

### Database Schema
```
users (id, username, password VARCHAR(500), api_key VARCHAR(500))
typing_results (id, user_id FK, speed_wpm, accuracy, score, tier_status, date_recorded)
```

### Critical Data Flow Pattern
1. **Generate Path**: User → `/api/generate` → `backend_generate()` → OpenRouter API → LLM → sentence prompt
2. **Submit Path**: User → `/api/submit` (POST JSON) → `backend_send()` → OpenRouter API → LLM analysis → JSON parsing → DB insert
3. **Display Path**: Route handlers query DB → render Jinja2 templates with context variables

---

## Key Architecture Decisions & Why

### Network Resilience Layer (app.py: lines 23-70)
**Why**: College networks often block port 5432. The app auto-detects Postgres connectivity on startup and falls back to SQLite.
**Pattern**: Try Neon connection with 3-second timeout → if fails, use `sqlite:///local_development.db`
**Implication**: Never assume database type in new features; check `app.config['SQLALCHEMY_DATABASE_URI']`

### AI Backend Abstraction (backend.py)
**Why**: Decouples API communication from Flask routes; allows model switching at runtime.
**Key Functions**:
- `send_data(data, api_key)`: Generic OpenRouter caller with Bearer token auth
- `backend_generate(api_key, difficulty)`: Prompt engineering with dynamic max_sentence global
- `backend_send(orig, user_str, time, speed, api_key)`: Comparative analysis prompt returning JSON
- `change_model(model_string)`: Updates global `MODEL` variable for all requests

**Pattern**: API key passed per-function call (user's stored key takes precedence over global `API_KEY = ""`)

### Database Cascade Handling
**Why**: Keeps data consistent when users delete accounts.
**Pattern**: `User.results` has `cascade='all, delete-orphan'`; `TypingResult.user_id` has `ondelete='CASCADE'`
**Implication**: Deleting a user automatically purges all their typing results

### Admin Panel Password Auth (app.py: line 184)
**Pattern**: Hardcoded `admin_password = "Admin112233"` compared in-route; no separate admin table
**Risk**: Single password shared; consider migration to role-based access for production

---

## Project-Specific Conventions

### Naming & Message Patterns
- **Flash messages use metaphorical language**: "Account node profile", "Database node instantiation", "Sequence mapping"
- **Error handling is verbose**: Exceptions wrapped with context ("Remote registration sequence error: {e}")
- **This is intentional for user clarity in a college project context**

### Route Permission Model
- Public routes: `/login`, `/register`, `/` (root redirects to login)
- Protected routes: `/play`, `/api/generate`, `/api/submit`, `/dashboard`, `/leaderboard`, `/logout`, `/delete_account`
- All protected routes use `@login_required` decorator from Flask-Login

### Form POST Patterns
- Actions determined by `action` form parameter (e.g., `action=save`, `action=clear`, `action=admin_create_user`)
- Tab state preserved via `tab` query parameter in redirects
- All POST handlers redirect back to same page/tab on success

### Leaderboard Query Pattern (app.py: lines 478-531)
**Why**: Displays top 10 users by personal best WPM (not all attempts)
**Implementation**: Subquery finds `MAX(speed_wpm)` per user → joins back to get full result row → orders by WPM descending
**Edge case**: If user has multiple results with same max WPM, only one row returned

### API Response JSON Format (backend.py: lines 113-122)
**Expected shape**:
```json
{
  "text_analysis": "string description of performance",
  "user_rating": "Pro|Average|Beginner|etc",
  "score": "X/100",
  "accuracy": "X%",
  "mistakes": [{"correct word": "incorrect word"}, ...]
}
```
**Parsing quirk**: Response may include ```json code blocks; app strips them (line 124)
**Fallback**: If JSON fails, regex extracts Rating/Score/Accuracy from plain text (app.py: lines 141-151)

---

## Critical Workflows

### Starting the App
```bash
# Ensure .env exists or environment variables are set:
# FLASK_SECRET_KEY, SQLALCHEMY_DATABASE_URI, etc.
python app.py
```
Server runs on `http://127.0.0.1:5000` with debug mode enabled.

### Adding a New Protected Route
1. Import `@login_required` from `flask_login`
2. Use `current_user` to access logged-in user (User model with id, username, api_key)
3. Query results via `TypingResult.query.filter_by(user_id=current_user.id)`
4. Flash messages display in `base.html` message loop

### Modifying AI Prompts
**Key files**:
- `backend_generate()` (backend.py: lines 75-102): Sentence generation with difficulty scaling
- `backend_send()` (backend.py: lines 104-136): Comparative analysis of original vs. user-typed

**Important**: Prompts request JSON output; LLM hallucinations are **not** filtered—test thoroughly with free models

### Adding a New Admin Action
1. Add `elif action == 'admin_new_action':` in `/dashboard` POST handler
2. Extract form fields via `request.form.get()`
3. Validate and execute DB operations
4. Return redirect with `tab` preserved: `redirect(url_for('dashboard', tab='admin', admin_password='Admin112233'))`

### User Model Extension
If adding fields to User:
1. Modify `models.py` User class
2. Flask-SQLAlchemy auto-creates columns on startup (line 56: `db.create_all()`)
3. For Postgres, may need manual schema migration if column type changes

---

## Integration Points & Dependencies

### OpenRouter API Integration
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Headers**: `Authorization: Bearer {api_key}`, `Content-Type: application/json`, `X-Title: Typing Speed Test Backend`
- **Key validation**: GET to `https://openrouter.ai/api/v1/key` returns 200 if valid
- **Model format**: e.g., `"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"` or `"openai/gpt-4o-mini"`

### Dynamic Model Discovery (app.py: lines 360-394)
- Fetches available models from OpenRouter on dashboard load
- Filters out vision/embedding/moderation models
- Falls back to hardcoded list if API unreachable
- Free vs. paid models separated and sorted by name

### Theme Persistence
**How it works**: JavaScript in `base.html` (lines 11-20) loads `localStorage.app-ui-theme` before DOM renders (prevents flash)
**Values**: `"light"`, `"dark"`, `"sepia"` (CSS uses `data-theme` attribute)
**Frontend stores this**: Must implement in JavaScript (see `play.js` if expanded)

---

## Common Pitfalls & Solutions

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| JSON parsing fails on AI response | LLM adds explanation text before/after JSON | Regex fallback in app.py lines 141-151; improve prompt |
| API key validation keeps failing | User copy-pastes with extra spaces | `request.form.get().strip()` already applied |
| Leaderboard shows duplicate users | User has multiple results with same max WPM | Current query only returns one row per user (correct) |
| Theme doesn't persist on refresh | localStorage not implemented in page | Check if `play.js` or destination template is saving theme |
| Port 5432 blocked on college network | Network firewall | App auto-falls back to SQLite; check console for "NETWORK FIREWALL BLOCK DETECTED" |
| Admin panel won't accept password | Hardcoded password is case-sensitive | Exact string: `"Admin112233"` |

---

## Files to Review for Context

**Core Logic**:
- `app.py` (535 lines): Routes, DB operations, admin panel logic
- `backend.py` (155 lines): OpenRouter API calls, prompt engineering
- `models.py` (30 lines): SQLAlchemy User & TypingResult schemas

**Frontend**:
- `templates/Base.html`: Navigation, theme loader, flash message loop
- `templates/Dashboard.html`: Profile, API key management, admin panel, model selection
- `templates/Play.html`: Typing test UI (calls `/api/generate` & `/api/submit`)
- `static/css/style.css`: CSS variables for themes (`--primary`, `--surface`, `--text-main`, etc.)
- `static/js/play.js`: Currently empty; implement typing test timer/submission logic here

**Configuration**:
- `.env`: Database URI, Flask secret key (not in repo)
- `requirements.txt`: Dependencies (note: lines 6-11 contain shell commands, not package specs—clean this)

---

## Testing & Debugging Tips

- **Print statements**: Already in `backend.py` and `app.py` for API responses and errors
- **Test admin panel**: Use password `Admin112233` and tab parameter `?tab=admin`
- **Test offline mode**: Disconnect from network or comment out Neon URI to force SQLite
- **Test AI fallback**: Modify backend response parsing to trigger regex fallback
- **Leaderboard edge case**: Create multiple users with same max WPM to verify subquery logic

---

## Before Committing Changes

1. ✅ All `@login_required` routes check `current_user` for access control
2. ✅ Database operations wrapped in try/except with rollback
3. ✅ API calls to OpenRouter include timeout (60s for completions, 5s for key check)
4. ✅ New form fields use `.strip()` and validate length/format
5. ✅ Redirects after POST preserve tab state where applicable
6. ✅ Error messages flashed to user (don't just print)

