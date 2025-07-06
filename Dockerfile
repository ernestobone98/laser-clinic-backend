# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port (default 8080, can be overridden by env)
EXPOSE 8080

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
