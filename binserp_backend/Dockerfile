# Use Node.js 20 as the base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies and clear cache to reduce image size
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the application
COPY . .

# Create volume for uploaded files
VOLUME [ "/usr/src/app/public/temp" ]

# Expose the port your app runs on
EXPOSE 8000

# Command to run the application
CMD ["npm", "start"]