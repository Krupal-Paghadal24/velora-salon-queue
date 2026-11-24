# Velora Salon Queue

**Live demo:** https://velora-salon-queue.vercel.app/

**Hosted on:** Vercel (Frontend) + Render (Backend) + Supabase (PostgreSQL Database)

## About

Velora Salon Queue is a web-based salon queue management system designed to simplify customer queue handling and improve the salon experience.

Customers can join the queue online, select services and preferred barbers, and track their queue status. Staff members can manage customer queues, while the owner can manage salon operations.

The application provides a responsive interface with English and Gujarati language support.

## Live Application

- **Frontend:** https://velora-salon-queue.vercel.app/
- **Backend:** https://velora-salon-queue.onrender.com
- **Backend Health Check:** https://velora-salon-queue.onrender.com/api/health
- **GitHub Repository:** https://github.com/Krupal-Paghadal24/velora-salon-queue

## Features

- Online customer queue registration.
- Service selection with a maximum of three services.
- Barber selection and availability information.
- Customer queue status tracking.
- Staff authentication and role-based access.
- Reception dashboard for queue management.
- Barber view for managing assigned customers.
- Live queue updates using Socket.IO.
- Owner settings for salon management.
- English and Gujarati language support.
- Persistent PostgreSQL database.
- Responsive design for mobile, tablet, desktop and TV displays.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Socket.IO Client

### Backend
- Node.js
- Express.js
- TypeScript
- Socket.IO
- PostgreSQL

### Database and Deployment
- Supabase PostgreSQL
- Vercel (Frontend Hosting)
- Render (Backend Hosting)
- GitHub (Version Control)

## Project Structure

```text
velora-salon-queue/
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── backend/
│   ├── src/
│   ├── migrations/
│   └── package.json
│
├── shared/
│
├── docs/
│
├── prompts.md
├── package.json
├── package-lock.json
└── README.md
```

## Local Setup

### Prerequisites

- Node.js
- npm
- PostgreSQL database

### 1. Clone the Repository

```bash
git clone https://github.com/Krupal-Paghadal24/velora-salon-queue.git
cd velora-salon-queue
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create the required `.env` files using the provided `.env.example` files in the frontend and backend directories.

Configure the required database connection, frontend API URL, WebSocket URL, authentication and other environment variables.

Do not commit actual secrets or environment files containing credentials.

### 4. Run Database Migrations

Use the migration command configured in the project:

```bash
npm run db:migrate --workspace=@velora/backend
```

### 5. Start the Application

Start the backend and frontend using the development scripts defined in their respective package files.

The frontend and backend must both be running for the complete application to work locally.

## Testing

The project uses Vitest for automated testing.

Run the available test scripts from the project root:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

Run type checking using the configured workspace scripts.

## Deployment Architecture

The application uses a hosted architecture:

- **Frontend:** React application deployed on Vercel.
- **Backend:** Express and Socket.IO server deployed on Render.
- **Database:** PostgreSQL hosted on Supabase.
- **Communication:** REST APIs and Socket.IO for real-time updates.
- **Database Security:** Database credentials and connection configuration remain on the backend.

## Project Documentation

The `docs/` directory contains the project planning and technical documentation.

The `prompts.md` file records the AI prompts used during development, troubleshooting and deployment.

## Known Limitations

- The backend uses Render's free hosting tier, so the first request after inactivity may take some time while the service starts.
- Application availability depends on the free-tier hosting providers.
- Internet connectivity is required to access the hosted application.

## Author

**Krupal Paghadal**

GitHub: https://github.com/Krupal-Paghadal24
