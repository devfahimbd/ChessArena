FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy prisma schema
COPY prisma ./prisma/

# Install dependencies and generate prisma client
RUN npm install

# Copy source code
COPY index.js ./

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "index.js"]
