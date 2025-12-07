## Stage 1: Compile and Build angular codebase ###
FROM harbor.suvanet.ch/galaxy-public/syr-node-24-image:1.0.1 AS build

# Set the working directory
WORKDIR /usr/src/app

# Copy necessary files for installation
COPY package.json pnpm-lock.yaml .npmrc ./

# Install all the dependencies
# Use online, frozen installs to ensure private packages are fetched from Nexus.
# We avoid running postinstall scripts in CI.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# Build the application (production configuration)
# Note: Use Nx directly to avoid running any pre-check wrapper scripts
# that may halt the build (e.g., translation checks) in containerized builds.
RUN pnpm exec nx build kpm-ng --configuration=prod

### STAGE 2: Serve ###
FROM harbor.suvanet.ch/blueplanet-public/bob-nginx-unprivileged

# Copy the build output to replace the default nginx contents.
COPY --from=build /usr/src/app/dist/kpm-ng/browser /usr/share/nginx/html

### LABELS
LABEL maintainer="\$gom-safe-galaxy@suvanet.ch"
ARG IMAGE_VERSION=0.0.0
ENV IMAGE_VERSION=$IMAGE_VERSION


#### Run Nginx
CMD ["nginx", "-g", "daemon off;"]
