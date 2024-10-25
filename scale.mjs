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
    
    if (!data.regions || data.regions.length === 0) {
      throw new Error('No regions returned by the API');
    }

    console.log("API Data:", data.regions);
    
    return data.regions.map(region => ({
      id: region.id,
      carbonIntensity: region.intensity,
    }));
    
  } catch (error) {
    console.error("Error fetching ranked regions:", error.message);
    return [];
  }
}

// Automate the scaling
async function automateScaling() {
  const rankedRegions = await getRankedRegions();
  if (rankedRegions.length > 0) {
    await scaleFlyApp(rankedRegions);
  }
}

// Scale the Fly.io app based on the best region
async function scaleFlyApp(rankedRegions) {
  const bestRegion = rankedRegions[0].id; // Pull region with lowest carbon intensity

  for (const region of rankedRegions) {
    const instanceCount = region.id === bestRegion ? 3 : 0; // Scale 3 in the best region, 0 in others
    try {
      const { stdout } = await execPromise(`fly scale count --region ${region.id} ${instanceCount} --process-group worker --yes`);
      console.log(`Scaled region ${region.id} to ${instanceCount} instances:\n${stdout}`);
    } catch (error) {
      console.error(`Error scaling region ${region.id}: ${error.message}`);
    }
  }
}

automateScaling();