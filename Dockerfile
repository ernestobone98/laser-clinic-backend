# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies based on build arg
ARG NODE_ENV=production
RUN if [ "$NODE_ENV" = "development" ]; then npm install; else npm install --production; fi

# Copy the rest of the application code
COPY . .

# Expose the port (default 8080, can be overridden by env)
EXPOSE 8080

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=$NODE_ENV

# Start the server with nodemon in dev mode
CMD if [ "$NODE_ENV" = "development" ]; then npx nodemon server.js; else node server.js; fi
