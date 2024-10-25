import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const tokenId = process.env.CARBON_API_TOKEN_ID;
const tokenSecret = process.env.CARBON_API_TOKEN_SECRET;

const carbonAwareApiUrl = 'https://api.carbonaware.cloud/v1';
const provider = 'fly';  

// Fetch ranked regions based on carbon intensity using Basic Authentication
async function getRankedRegions() {
  try {
    const response = await fetch(`${carbonAwareApiUrl}/by-provider/${provider}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    console.log("api data", data)
    console.log("schedule limits", data.regions[0].scheduleLimits)
    console.log("schedule limits", data.regions[1].scheduleLimits)
    console.log("schedule limits", data.regions[2].scheduleLimits)

    if (!data.regions || data.regions.length === 0) {
      throw new Error('No regions returned by the API');
    }
    
    return data.regions.map(region => ({
      id: region.id,
      carbonIntensity: region.intensity,
    }))
    .sort((a, b) => a.carbonIntensity - b.carbonIntensity);
    
  } catch (error) {
    console.error("Error fetching ranked regions:", error.message);
    return [];
  }
}

// List all machines for the app, filtering based on region
async function listMachinesByRegion(bestRegion) {
  try {
    const { stdout } = await execPromise(`flyctl machines list --json`);
    const machines = JSON.parse(stdout);
    
    
    console.log("All machines:", machines);
    
    // Filter machines by region, returning only those outside bestRegion
    return machines.map(machine => machine.region);

  } catch (error) {
    console.error("Error listing machines by region:", error.message);
    return [];
  }
}

// Automate the scaling
async function automateScaling() {
  const rankedRegions = await getRankedRegions();
  const allActiveRegions = await listMachinesByRegion();

  console.log("ranked", rankedRegions)
  console.log("active", allActiveRegions)
  
  if (rankedRegions.length > 0) {
    await scaleFlyApp(rankedRegions, allActiveRegions);
  }
}

// Scale the Fly.io app based on the best region
async function scaleFlyApp(rankedRegions, allActiveRegions) {
  const bestRegion = rankedRegions[0].id;

  console.log("best region", bestRegion)

  for (const region of allActiveRegions) {
    const instanceCount = region === bestRegion ? 1 : 0; // Scale 1 in the best region, 0 in others
    try {
      const { stdout } = await execPromise(`flyctl scale count --region ${region} ${instanceCount} --process-group worker --yes`);
      console.log(`Scaled region ${region} to ${instanceCount} instances:\n${stdout}`);
    } catch (error) {
      console.error(`Error scaling region ${region}: ${error.message}`);
    }
  }
}

automateScaling();