# Laser Clinic Backend

Backend service for the Laser Clinic management system, built with Node.js, Express, and Oracle Database.

## Features

- RESTful API for managing patients and procedures
- CORS enabled for secure frontend communication
- Environment-based configuration
- Oracle Database integration

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Oracle Instant Client (required for oracledb)
- Oracle Wallet for database connection

## Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd laser-clinic-backend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   - Copy `.env.example` to `.env`
   - Update the database credentials and other settings in `.env`

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_CONNECT_STRING=your_connect_string
TNS_ADMIN=/path/to/your/wallet

# Frontend Configuration
FRONTEND_URL=http://localhost:5173
```

## Running the Application

### Development

```bash
npm start
```

The server will start on `http://localhost:8080` by default.

## API Endpoints

### Patients
- `GET /api/pacientes` - Get all patients
- `GET /api/pacientes/:id` - Get a specific patient
- `POST /api/pacientes` - Create a new patient
- `PUT /api/pacientes/:id` - Update a patient
- `DELETE /api/pacientes/:id` - Delete a patient

### Procedures
- `GET /api/proceduras` - Get all procedures
- `GET /api/proceduras/:id` - Get a specific procedure
- `POST /api/proceduras` - Create a new procedure
- `PUT /api/proceduras/:id` - Update a procedure
- `DELETE /api/proceduras/:id` - Delete a procedure

## Environment Variables

- `PORT` - Port to run the server on (default: 8080)
- `FRONTEND_URL` - URL of the frontend application (for CORS)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_CONNECT_STRING` - Database connection string
- `TNS_ADMIN` - Path to Oracle Wallet directory

## Security

- Never commit sensitive information to version control
- Keep your `.env` file secure and never share it
- Use HTTPS in production

## License

ISC
