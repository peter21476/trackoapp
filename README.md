# Tracko - Bug Tracker

A BugHerd-style issue tracking app with Kanban boards, built with React + Express + PostgreSQL.

## Features

- User authentication (register/login with JWT)
- Create and manage projects
- Kanban board with 4 columns: **Issue**, **To Work**, **Resolving**, **Resolved**
- Drag and drop issues between columns
- Assign issues to project members
- Priority levels (Low, Medium, High, Critical)
- Invite team members by email

## Tech Stack

- **Frontend**: React 18, Vite, @hello-pangea/dnd, React Router
- **Backend**: Express, Node.js
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt
- **Deployment**: Heroku

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### Setup

1. **Create the database:**

```bash
createdb tracko
```

2. **Run migrations:**

```bash
node server/db/migrate.js
```

3. **Install dependencies:**

```bash
npm install
cd client && npm install && cd ..
```

4. **Configure environment:**

Edit `.env` in the root directory with your database URL and a JWT secret.

5. **Start development servers:**

```bash
npm run dev
```

This starts both the Express API (port 5000) and Vite dev server (port 3000).

## Deploy to Heroku

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0
git push heroku main
heroku run node server/db/migrate.js
```

Set the JWT secret:

```bash
heroku config:set JWT_SECRET=your-secret-key NODE_ENV=production
```
