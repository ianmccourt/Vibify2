import SpotifyWebApi from 'spotify-web-api-node';

// Request queue to limit concurrent requests
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;
  
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedFn = async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        } finally {
          this.running--;
          this.processNext();
        }
      };
      
      this.queue.push(queuedFn);
      
      if (this.running < this.maxConcurrent) {
        this.processNext();
      }
    });
  }
  
  private processNext() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const nextFn = this.queue.shift();
      if (nextFn) {
        nextFn().catch(console.error);
      }
    }
  }
}

// Create a global request queue
const requestQueue = new RequestQueue(3); // Allow 3 concurrent requests

export const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export const scopes = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-top-read',
  'user-library-read',
  'user-read-recently-played',
  'user-read-currently-playing',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private'
];

export interface TrackAnalysis {
  name: string;
  artist: string;
  popularity: number;
  genres: string[];
  features: {
    danceability: number;
    energy: number;
    valence: number;
    tempo: number;
    acousticness: number;
    instrumentalness: number;
  };
}

// Helper function to chunk array into smaller arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to handle API calls with retries
async function retryableSpotifyCall<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, {
        statusCode: error?.statusCode,
        message: error?.message,
        body: error?.body,
      });
      
      // Don't retry auth errors
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        console.error('Authorization error:', {
          statusCode: error.statusCode,
          message: error.message,
          body: error.body
        });
        throw error;
      }
      
      // Handle rate limiting (429) specifically
      if (error?.statusCode === 429) {
        // Get retry-after header if available or use exponential backoff
        const retryAfter = error?.headers?.['retry-after'] ? 
          parseInt(error.headers['retry-after']) * 1000 : 
          initialDelayMs * Math.pow(2, attempt - 1);
        
        console.warn(`Rate limited! Waiting ${retryAfter}ms before retry...`);
        
        if (attempt < maxRetries) {
          await delay(retryAfter);
          continue;
        }
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const waitTime = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
      }
    }
  }
  
  // If we've exhausted all retries, throw a more informative error
  if (lastError) {
    if (lastError.statusCode === 429) {
      throw new Error(`Rate limit exceeded. Too many requests to Spotify API. Please try again later.`);
    } else {
      throw lastError;
    }
  }
  
  throw new Error('Unknown error occurred during Spotify API call');
}

export async function getUserPlaylists(accessToken: string) {
  console.log('Setting access token for playlists...');
  
  return requestQueue.add(() => 
    retryableSpotifyCall(async () => {
      console.log('Fetching user playlists...');
      
      // Use direct fetch instead of Spotify API library
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error fetching user playlists:', {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.items;
    })
  );
}

export async function getTopTracks(accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term') {
  console.log('Setting access token for top tracks...');
  
  return requestQueue.add(() => 
    retryableSpotifyCall(async () => {
      console.log('Fetching top tracks...');
      
      // Use direct fetch instead of Spotify API library
      const response = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error fetching top tracks:', {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Found ${data.items.length} top tracks`);
      return data.items;
    })
  );
}

export async function getTrackFeatures(accessToken: string, trackIds: string[]) {
  if (!trackIds.length) return [];
  
  console.log('Setting access token for track features...');
  
  // Check if we should use fallback features directly
  // This is useful for development environments where the API might restrict access
  const useFallbackFeatures = process.env.NEXT_PUBLIC_USE_FALLBACK_FEATURES === 'true';
  if (useFallbackFeatures) {
    console.log('Using fallback audio features as configured in environment');
    return trackIds.map(() => ({
      danceability: 0.5,
      energy: 0.5,
      valence: 0.5,
      tempo: 120,
      acousticness: 0.5,
      instrumentalness: 0.5
    }));
  }
  
  // Process in chunks to avoid API limits
  const chunks = chunkArray(trackIds, 100);
  let allFeatures: any[] = [];
  let hasError = false;
  
  for (const chunk of chunks) {
    try {
      // First check if we can access the endpoint at all
      const testResponse = await fetch('https://api.spotify.com/v1/audio-features?ids=' + chunk[0], {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // If we get a 403 on the test request, don't even try the full request
      if (testResponse.status === 403) {
        console.warn('Audio features endpoint returned 403 Forbidden - using fallback values');
        return trackIds.map(() => ({
          danceability: 0.5,
          energy: 0.5,
          valence: 0.5,
          tempo: 120,
          acousticness: 0.5,
          instrumentalness: 0.5
        }));
      }
      
      const features = await requestQueue.add(async () => 
        retryableSpotifyCall(async () => {
          console.log(`Fetching audio features for ${chunk.length} tracks...`);
          
          // Use direct fetch instead of Spotify API library
          const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            console.error('Error fetching audio features:', {
              status: response.status,
              statusText: response.statusText,
              body: errorText
            });
            
            // If we get a 403 error, throw a specific error
            if (response.status === 403) {
              throw new Error(`Spotify API error: 403 Forbidden - Access denied to audio features`);
            }
            
            throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          return data.audio_features;
        })
      );
      
      allFeatures = [...allFeatures, ...features];
      
      // Add a small delay between chunk requests
      if (chunks.length > 1) await delay(300);
    } catch (error: any) {
      console.error('Error fetching audio features:', error);
      hasError = true;
      
      // If we get a 403 error, break the loop and return fallback features
      if (
        error.statusCode === 403 || 
        (error.message && error.message.includes('403')) ||
        (error.response && error.response.status === 403)
      ) {
        console.warn('Using fallback audio features due to API restrictions');
        return trackIds.map(() => ({
          danceability: 0.5,
          energy: 0.5,
          valence: 0.5,
          tempo: 120,
          acousticness: 0.5,
          instrumentalness: 0.5
        }));
      }
    }
  }
  
  // If we had errors but still got some features, log a warning
  if (hasError && allFeatures.length > 0) {
    console.warn(`Retrieved ${allFeatures.length}/${trackIds.length} track features with some errors`);
  }
  
  // Return what we have or fallback if nothing
  if (allFeatures.length === 0) {
    console.warn('No track features retrieved, using fallback values');
    return trackIds.map(() => ({
      danceability: 0.5,
      energy: 0.5,
      valence: 0.5,
      tempo: 120,
      acousticness: 0.5,
      instrumentalness: 0.5
    }));
  }
  
  return allFeatures;
}

export async function getRecommendations(
  accessToken: string,
  seedTracks: string[],
  targetPopularity: number,
  limit: number = 20,
  seedGenres: string[] = []
) {
  if (!accessToken) {
    throw new Error('No access token provided');
  }

  console.log('Setting access token for recommendations...');
  
  // Check if we have seed tracks or genres
  if (seedTracks.length === 0 && seedGenres.length === 0) {
    console.log('No seed tracks or genres provided');
    return createFallbackRecommendations(limit);
  }

  // Try with genre seeds first if available
  if (seedGenres.length > 0) {
    try {
      console.log(`Trying recommendations with ${seedGenres.length} genre seeds:`, seedGenres);
      
      // Build query parameters
      const params = new URLSearchParams();
      seedGenres.slice(0, 5).forEach(genre => params.append('seed_genres', genre));
      params.append('target_popularity', targetPopularity.toString());
      params.append('limit', limit.toString());
      
      console.log('Genre recommendations options:', Object.fromEntries(params.entries()));
      
      // Use direct fetch instead of the Spotify API library
      const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Found ${data.tracks.length} recommendations using genre seeds`);
      return data.tracks;
    } catch (error) {
      console.error('Error getting recommendations with genre seeds:', error);
      // Fall back to track seeds if genre seeds fail
    }
  }

  // If we have track seeds, try those
  if (seedTracks.length > 0) {
    // Validate seed tracks to ensure they are valid Spotify IDs
    const validTrackIdRegex = /^[0-9A-Za-z]{22}$/;
    const validSeedTracks = seedTracks.filter(id => validTrackIdRegex.test(id));
    
    if (validSeedTracks.length === 0) {
      console.log('No valid seed track IDs provided');
      
      // Try to get available genres and use those instead
      try {
        const genres = await getAvailableGenres(accessToken);
        if (genres.length > 0) {
          const defaultGenres = genres.slice(0, 3);
          console.log(`Using default genres instead: ${defaultGenres.join(', ')}`);
          
          // Recursive call with genres
          return getRecommendations(accessToken, [], targetPopularity, limit, defaultGenres);
        }
      } catch (error) {
        console.error('Error getting available genres:', error);
      }
      
      return createFallbackRecommendations(limit);
    }
    
    // Try different combinations of seed tracks
    for (let i = Math.min(validSeedTracks.length, 5); i > 0; i--) {
      const seeds = validSeedTracks.slice(0, i);
      try {
        console.log(`Trying recommendations with ${seeds.length} track seeds:`, seeds);
        
        // Build query parameters
        const params = new URLSearchParams();
        seeds.forEach(track => params.append('seed_tracks', track));
        params.append('target_popularity', targetPopularity.toString());
        params.append('limit', limit.toString());
        
        console.log('Track recommendations options:', Object.fromEntries(params.entries()));
        
        // Use direct fetch instead of the Spotify API library
        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Found ${data.tracks.length} recommendations using ${seeds.length} track seeds`);
        return data.tracks;
      } catch (error) {
        console.error(`Error getting recommendations with ${seeds.length} track seeds:`, error);
        // Try the next combination
      }
    }
  }
  
  // If all attempts fail, return fallback recommendations
  console.log('All recommendation attempts failed, returning fallback recommendations');
  return createFallbackRecommendations(limit);
}

// Helper function to create fallback recommendations
function createFallbackRecommendations(limit: number) {
  console.log('Creating fallback recommendations');
  return Array(limit).fill(null).map((_, index) => ({
    id: `fallback-${index}`,
    name: `Fallback Track ${index + 1}`,
    artists: [{ name: 'Various Artists' }],
    album: {
      images: [{ url: '/placeholder.svg' }]
    },
    external_urls: {
      spotify: 'https://open.spotify.com'
    }
  }));
}

export async function validateToken(accessToken: string) {
  if (!accessToken) {
    return { valid: false, error: 'No token provided' };
  }

  try {
    // Try to get the current user's profile
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        status: response.status,
        statusText: response.statusText,
        error: data.error?.message || 'Unknown error',
        details: data
      };
    }

    // Check scopes by trying to access a few endpoints
    const scopeChecks = [
      { scope: 'user-top-read', endpoint: 'https://api.spotify.com/v1/me/top/tracks?limit=1' },
      { scope: 'playlist-read-private', endpoint: 'https://api.spotify.com/v1/me/playlists?limit=1' },
      { scope: 'user-read-recently-played', endpoint: 'https://api.spotify.com/v1/me/player/recently-played?limit=1' }
    ];

    const scopeResults = await Promise.all(
      scopeChecks.map(async (check) => {
        try {
          const scopeResponse = await fetch(check.endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          return {
            scope: check.scope,
            status: scopeResponse.status,
            ok: scopeResponse.ok
          };
        } catch (error) {
          return {
            scope: check.scope,
            status: 'error',
            ok: false,
            error
          };
        }
      })
    );

    return {
      valid: true,
      user: data,
      scopes: scopeResults
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    };
  }
}

export function calculateObscurityScore(popularity: number): number {
  return Math.max(0, Math.min(100, 100 - popularity));
}

export function calculateDiversityScore(genres: string[]): number {
  const uniqueGenres = new Set(genres);
  return Math.min((uniqueGenres.size / 20) * 100, 100);
}

export function calculateMoodScore(valence: number, energy: number): number {
  return Math.max(0, Math.min(100, ((valence + energy) / 2) * 100));
}

// Function to get available genre seeds
export async function getAvailableGenres(accessToken: string) {
  if (!accessToken) {
    throw new Error('No access token provided');
  }

  console.log('Setting access token for available genres...');
  
  try {
    return await requestQueue.add(async () => {
      return retryableSpotifyCall(async () => {
        console.log('Fetching available genre seeds...');
        
        // Use direct fetch instead of spotifyApi which doesn't have this method
        const response = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error('Error fetching available genres:', {
            status: response.status,
            statusText: response.statusText
          });
          return ['pop', 'rock', 'indie']; // Default fallback genres
        }
        
        const data = await response.json();
        console.log(`Found ${data.genres?.length || 0} available genres`);
        return data.genres || ['pop', 'rock', 'indie'];
      });
    });
  } catch (error) {
    console.error('Error fetching available genres:', error);
    // Return default genres if we can't fetch them
    return ['pop', 'rock', 'indie'];
  }
} 