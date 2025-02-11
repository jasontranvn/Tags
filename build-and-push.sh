#!/bin/bash

# Step 1: Build the PCF control
echo "Running npm build..."
npm run build || { echo "npm build failed"; exit 1; }

# Step 2: Build the solution in Release mode
echo "Building .NET solution in Release mode..."
cd tags/solution || { echo "Solution folder not found"; exit 1; }
dotnet build --configuration Release || { echo ".NET build failed"; exit 1; }
cd ../.. || { echo "Failed to return to root directory"; exit 1; }

# Step 3: Push the PCF to Dataverse
echo "Pushing PCF control to Dataverse..."
pac pcf push --publisher-prefix jt || { echo "PCF push failed"; exit 1; }

echo "Build and push completed successfully!"
