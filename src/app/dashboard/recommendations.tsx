'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { getTopTracks, getRecommendations, getAvailableGenres } from '@/lib/spotify';
import Image from 'next/image';
import { FaBug, FaSync } from 'react-icons/fa';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
  external_urls: {
    spotify: string;
  };
}

export default function Recommendations() {
  const { data: session, status } = useSession();
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [obscurityLevel, setObscurityLevel] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['pop', 'rock', 'indie']);

  // Function to fetch available genres
  const fetchAvailableGenres = async () => {
    if (!session?.accessToken) return;
    
    try {
      const genres = await getAvailableGenres(session.accessToken);
      setAvailableGenres(genres);
      
      // Set some default selected genres if they're available
      const defaultGenres = ['pop', 'rock', 'indie'].filter(g => genres.includes(g));
      if (defaultGenres.length > 0) {
        setSelectedGenres(defaultGenres.slice(0, 3));
      } else if (genres.length > 0) {
        setSelectedGenres(genres.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  // Function to try recommendations with specific genres
  const tryWithGenres = async (genres: string[]) => {
    if (!session?.accessToken || !genres.length) return;
    
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    
    try {
      console.log('Trying recommendations with genres:', genres);
      
      // Use our improved getRecommendations function with empty track seeds
      const recommendedTracks = await getRecommendations(
        session.accessToken,
        [], // Empty track seeds to force using genre seeds
        100 - obscurityLevel,
        20,
        genres
      );
      
      // Save debug info
      setDebugInfo({
        method: `Manual Genre Seeds (${genres.join(',')})`,
        genres: genres,
        obscurityLevel: obscurityLevel,
        usingFallback: recommendedTracks[0]?.id?.startsWith('fallback-')
      });
      
      if (recommendedTracks[0]?.id?.startsWith('fallback-')) {
        setUsingFallback(true);
        setError(`Couldn't get recommendations with these genres: ${genres.join(', ')}`);
      } else {
        console.log(`Found ${recommendedTracks.length} recommendations with genres: ${genres.join(',')}`);
      }
      
      setRecommendations(recommendedTracks);
    } catch (error) {
      console.error('Error trying with genres:', error);
      setError('Failed to get recommendations with these genres.');
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  // Load available genres when session is ready
  useEffect(() => {
    if (status === 'authenticated') {
      fetchAvailableGenres();
    }
  }, [status]);

  async function fetchRecommendations() {
    if (!session?.accessToken) return;
    
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    setDebugInfo(null);
    
    try {
      console.log('Fetching recommendations with token:', session.accessToken.substring(0, 10) + '...');
      
      // Get available genres first
      console.log('Fetching available genres...');
      const availableGenres = await getAvailableGenres(session.accessToken);
      console.log('Available genres:', availableGenres.slice(0, 10), `... and ${availableGenres.length - 10} more`);
      
      // Select a few popular genres that work well for recommendations
      const genresToTry = [
        // Try different genre combinations
        ['pop', 'rock', 'indie'].filter(g => availableGenres.includes(g)),
        ['hip-hop', 'electronic', 'dance'].filter(g => availableGenres.includes(g)),
        ['alternative', 'indie', 'pop'].filter(g => availableGenres.includes(g)),
        // If all else fails, just use the first 3 available genres
        availableGenres.slice(0, 3)
      ].filter(combo => combo.length > 0);
      
      // First try with genre seeds which often work better in Development Mode
      console.log('Trying with genre seeds first...');
      
      let genreSuccess = false;
      let genreResponseData;
      let genreDebugInfo;
      
      // Try each genre combination
      for (const genreCombo of genresToTry) {
        if (genreSuccess) break;
        
        const genreUrl = new URL('https://api.spotify.com/v1/recommendations');
        genreUrl.searchParams.append('seed_genres', genreCombo.join(','));
        genreUrl.searchParams.append('target_popularity', Math.max(0, Math.min(100, 100 - obscurityLevel)).toString());
        genreUrl.searchParams.append('limit', '20');
        
        console.log('Debug - Genre Recommendations URL:', genreUrl.toString());
        console.log('Using genres:', genreCombo);
        
        const genreResponse = await fetch(genreUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        const genreResponseText = await genreResponse.text();
        
        try {
          const parsedData = genreResponseText && genreResponseText.trim() ? JSON.parse(genreResponseText) : {};
          
          genreDebugInfo = {
            method: `Genre Seeds (${genreCombo.join(',')})`,
            url: genreUrl.toString(),
            status: genreResponse.status,
            statusText: genreResponse.statusText,
            headers: Object.fromEntries(genreResponse.headers.entries()),
            responseData: parsedData,
            rawResponse: genreResponseText
          };
          
          // If genre seeds worked, use those recommendations
          if (genreResponse.ok && parsedData.tracks && parsedData.tracks.length > 0) {
            console.log(`Successfully got ${parsedData.tracks.length} recommendations using genre seeds: ${genreCombo.join(',')}`);
            genreResponseData = parsedData;
            genreSuccess = true;
            break;
          }
        } catch (parseError) {
          console.error('Error parsing genre response:', parseError);
        }
        
        // Add a small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (genreSuccess && genreResponseData) {
        setRecommendations(genreResponseData.tracks);
        setDebugInfo(genreDebugInfo);
        setLoading(false);
        return;
      }
      
      // If genre seeds didn't work, try with track seeds as before
      console.log("Genre seeds didn't work, trying with track seeds...");
      
      const topTracks = await getTopTracks(session.accessToken);
      
      if (!topTracks.length) {
        setError("No top tracks found to base recommendations on. Try listening to more music!");
        setLoading(false);
        return;
      }

      const seedTracks = topTracks.slice(0, 5).map((track: Track) => track.id);
      
      // Validate seed tracks first
      console.log('Validating seed tracks...');
      const validSeedTracks = [];
      const invalidSeedTracks = [];
      
      for (const trackId of seedTracks) {
        try {
          const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (trackResponse.ok) {
            validSeedTracks.push(trackId);
          } else {
            invalidSeedTracks.push(trackId);
          }
        } catch (error) {
          console.error(`Error validating track ${trackId}:`, error);
          invalidSeedTracks.push(trackId);
        }
      }
      
      console.log(`Valid seed tracks: ${validSeedTracks.length}, Invalid: ${invalidSeedTracks.length}`);
      
      // Try different combinations of seed tracks
      const trackCombosToTry = [
        [validSeedTracks[0]], // Just the first track
        validSeedTracks.slice(0, 2), // First two tracks
        validSeedTracks.slice(0, 3), // First three tracks
        validSeedTracks // All valid tracks (up to 5)
      ].filter(combo => combo && combo.length > 0);
      
      let trackSuccess = false;
      let trackResponseData;
      let trackDebugInfo;
      
      for (const trackCombo of trackCombosToTry) {
        if (trackSuccess) break;
        
        const url = new URL('https://api.spotify.com/v1/recommendations');
        url.searchParams.append('seed_tracks', trackCombo.join(','));
        url.searchParams.append('target_popularity', Math.max(0, Math.min(100, 100 - obscurityLevel)).toString());
        url.searchParams.append('limit', '20');
        
        console.log(`Debug - Trying with ${trackCombo.length} seed tracks:`, trackCombo);
        console.log('Recommendations URL:', url.toString());
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Check if response is empty
        const responseText = await response.text();
        
        try {
          // Only try to parse as JSON if there's content
          const parsedData = responseText && responseText.trim() ? JSON.parse(responseText) : {};
          
          trackDebugInfo = {
            method: `Track Seeds (${trackCombo.length} tracks)`,
            url: url.toString(),
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            responseData: parsedData,
            rawResponse: responseText,
            validSeedTracks,
            invalidSeedTracks
          };
          
          if (response.ok && parsedData.tracks && parsedData.tracks.length > 0) {
            console.log(`Found ${parsedData.tracks.length} recommendations with ${trackCombo.length} seed tracks`);
            trackResponseData = parsedData;
            trackSuccess = true;
            break;
          }
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
        }
        
        // Add a small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (trackSuccess && trackResponseData) {
        setRecommendations(trackResponseData.tracks);
        setDebugInfo(trackDebugInfo);
        setLoading(false);
        return;
      }
      
      // If we got here, all direct API attempts failed
      // Try using our improved getRecommendations function as a last resort
      console.log('All direct API attempts failed. Trying with improved getRecommendations function...');
      const recommendedTracks = await getRecommendations(
        session.accessToken,
        seedTracks,
        100 - obscurityLevel,
        20,
        selectedGenres
      );
      
      if (recommendedTracks[0]?.id?.startsWith('fallback-')) {
        setUsingFallback(true);
        setError("Spotify couldn't find recommendations for these tracks. This often happens in Development Mode.");
      }
      
      setRecommendations(recommendedTracks);
      
      // If we don't have debug info yet, create it
      if (!trackDebugInfo && !genreDebugInfo) {
        setDebugInfo({
          method: 'Fallback',
          error: 'All API attempts failed',
          usingFallback: true
        });
      } else {
        setDebugInfo(trackDebugInfo || genreDebugInfo);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to get recommendations. Please try again later.');
      
      // Use fallback recommendations
      const fallbackTracks = Array(20).fill(null).map((_, index) => ({
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
      
      setUsingFallback(true);
      setRecommendations(fallbackTracks);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRecommendations();
    }
  }, [session, obscurityLevel, status]);

  if (status === 'unauthenticated') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Please log in to see recommendations.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Personalized Recommendations</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md transition-colors"
              title="Show debug information"
            >
              <FaBug />
              {showDebug ? 'Hide Debug' : 'Debug'}
            </button>
            <button
              onClick={fetchRecommendations}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors"
              disabled={loading}
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
        
        {showDebug && debugInfo && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg overflow-auto max-h-96">
            <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
            <div className="text-xs font-mono">
              <p><strong>Method:</strong> {debugInfo.method}</p>
              <p><strong>URL:</strong> {debugInfo.url}</p>
              <p><strong>Status:</strong> {debugInfo.status} {debugInfo.statusText}</p>
              <p><strong>Headers:</strong></p>
              <pre className="bg-gray-900 p-2 rounded mt-1 mb-2">
                {JSON.stringify(debugInfo.headers, null, 2)}
              </pre>
              
              {debugInfo.validSeedTracks && (
                <>
                  <p><strong>Valid Seed Tracks:</strong> {debugInfo.validSeedTracks.length}</p>
                  <pre className="bg-gray-900 p-2 rounded mt-1 mb-2">
                    {JSON.stringify(debugInfo.validSeedTracks, null, 2)}
                  </pre>
                  
                  <p><strong>Invalid Seed Tracks:</strong> {debugInfo.invalidSeedTracks.length}</p>
                  <pre className="bg-gray-900 p-2 rounded mt-1 mb-2">
                    {JSON.stringify(debugInfo.invalidSeedTracks, null, 2)}
                  </pre>
                </>
              )}
              
              <p><strong>Raw Response:</strong></p>
              <pre className="bg-gray-900 p-2 rounded mt-1 mb-2 whitespace-pre-wrap">
                {debugInfo.rawResponse || '(empty response)'}
              </pre>
              <p><strong>Parsed Response:</strong></p>
              <pre className="bg-gray-900 p-2 rounded mt-1">
                {JSON.stringify(debugInfo.responseData, null, 2)}
              </pre>
            </div>
          </div>
        )}
        
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">
            Obscurity Level: {obscurityLevel}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={obscurityLevel}
            onChange={(e) => setObscurityLevel(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Popular</span>
            <span>Obscure</span>
          </div>
        </div>
        
        {availableGenres.length > 0 && (
          <div className="mb-8 p-4 bg-gray-800/50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Try Different Genres</h3>
            <p className="text-sm text-gray-400 mb-3">
              Select up to 5 genres to use as seeds for recommendations:
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {availableGenres.slice(0, 20).map(genre => (
                <button
                  key={genre}
                  onClick={() => {
                    if (selectedGenres.includes(genre)) {
                      setSelectedGenres(selectedGenres.filter(g => g !== genre));
                    } else if (selectedGenres.length < 5) {
                      setSelectedGenres([...selectedGenres, genre]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedGenres.includes(genre)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {genre}
                </button>
              ))}
              
              {availableGenres.length > 20 && (
                <span className="text-sm text-gray-400 self-center">
                  ...and {availableGenres.length - 20} more
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Selected: {selectedGenres.join(', ')}</span>
              <button
                onClick={() => tryWithGenres(selectedGenres)}
                disabled={loading || selectedGenres.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Try These Genres
              </button>
            </div>
          </div>
        )}

        {usingFallback && (
          <div className="mb-6 p-4 bg-yellow-800/50 rounded-lg text-yellow-200">
            <p className="font-medium">
              Note: Using placeholder recommendations due to Spotify API restrictions. 
              This is likely because your app is in Development Mode in the Spotify Developer Dashboard.
            </p>
            <p className="text-sm mt-2">
              To fix this, go to your Spotify Developer Dashboard, add your email as an authorized user, 
              or consider switching to Extended Quota Mode.
            </p>
            <p className="text-sm mt-2">
              If you've already added your email as an authorized user, try the following:
            </p>
            <ul className="list-disc pl-5 text-sm mt-1">
              <li>Verify the email exactly matches your Spotify account email</li>
              <li>Check if your app is still in Development Mode</li>
              <li>Try using a different seed track (adjust the obscurity slider)</li>
              <li>Try different genre combinations using the genre selector above</li>
              <li>Logout and login again to get a fresh token</li>
            </ul>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : error ? (
          <div className="text-center p-8 bg-gray-800/50 rounded-lg">
            <p className="text-gray-300">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((track) => (
              <motion.a
                key={track.id}
                href={track.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative w-full aspect-square mb-4">
                  <Image
                    src={track.album.images[0]?.url || '/placeholder.svg'}
                    alt={track.name}
                    fill
                    className="rounded-md object-cover"
                  />
                </div>
                <h3 className="font-semibold truncate">{track.name}</h3>
                <p className="text-gray-400 text-sm truncate">
                  {track.artists.map(artist => artist.name).join(', ')}
                </p>
              </motion.a>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
} 