const { exec } = require('child_process');
const fetch = require('node-fetch');

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

// Scale the Fly.io app based on the best region
function scaleFlyApp(region) {
  exec(`fly scale count --region ${region} 3`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error scaling: ${error.message}`);
      return;
    }
    console.log(`Scaled to region ${region}:\n${stdout}`);
  });
}

// Automate the scaling
async function automateScaling() {
  const bestRegion = await getBestRegion();
  console.log(`Best region: ${bestRegion.region} with carbon intensity ${bestRegion.carbonIntensity}`);
  scaleFlyApp(bestRegion.region); // Scale to region with the lowest carbon intensity
}

// Execute the scaling script
automateScaling();
