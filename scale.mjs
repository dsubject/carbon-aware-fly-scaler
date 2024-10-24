import { exec } from 'child_process';
import { promisify } from 'util';  // Promisify exec for async/await
import fetch from 'node-fetch';

// Promisify exec
const execPromise = promisify(exec);

// Set up Carbon Aware API URL and Fly.io regions
const carbonAwareApiUrl = 'https://carbon-aware-api.azurewebsites.net';
const regions = ['yul', 'iad', 'sfo']; // Example Fly.io regions

// Fetch carbon intensity for each region
async function getCarbonIntensity(region) {
  const response = await fetch(`${carbonAwareApiUrl}/emissions/bylocation?location=${region}`);
  const data = await response.json();
  return { region, carbonIntensity: data.carbonIntensity };
}

// Find the region with the lowest carbon intensity
async function getBestRegion() {
  const carbonData = await Promise.all(regions.map(getCarbonIntensity));
  return carbonData.reduce((lowest, current) =>
    current.carbonIntensity < lowest.carbonIntensity ? current : lowest
  );
}

// Scale the Fly.io app based on the best region, and scale down in others
function scaleFlyApp(bestRegion) {
  regions.forEach((region) => {
    const instanceCount = region === bestRegion ? 3 : 0; // Scale to 3 for the best region, 0 for others
    exec(`fly scale count --region ${region} ${instanceCount} --process-group worker --yes`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error scaling in region ${region}: ${error.message}`);
        return;
      }
      console.log(`Scaled region ${region} to ${instanceCount} instances:\n${stdout}`);
    });
  });



}

// Automate the scaling
async function automateScaling() {
  const bestRegion = await getBestRegion();
  console.log(`Best region: ${bestRegion.region} with carbon intensity ${bestRegion.carbonIntensity}`);
  await scaleFlyApp(bestRegion.region); // Scale to region with the lowest carbon intensity
}

// Execute the scaling script
automateScaling();
