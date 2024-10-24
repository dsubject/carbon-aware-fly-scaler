# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.5.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install Fly.io CLI
RUN curl -L https://fly.io/install.sh | sh
ENV PATH="/root/.fly/bin:$PATH"

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY . .

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Add Flyctl to PATH
ENV PATH="/root/.fly/bin:$PATH"

# Expose the necessary port
EXPOSE 3000

# Run the correct ES module script
CMD [ "node", "scale.mjs" ]