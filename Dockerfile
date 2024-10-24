# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.5.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ENV PATH="/root/.fly/bin:$PATH"

# Install Bash and dependencies
RUN apt-get update && apt-get install -y bash curl

# Install Fly.io CLI
RUN curl -L https://fly.io/install.sh | sh

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy package files and install dependencies
COPY package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY . .

# Final stage for app image
FROM base

# Copy built application from build stage
COPY --from=build /app /app

# Expose the necessary port
EXPOSE 3000

# Run the scaling script using bash
CMD [ "bash", "-c", "node scale.mjs" ]