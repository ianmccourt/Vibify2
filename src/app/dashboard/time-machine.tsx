'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { getTopTracks, getTrackFeatures, calculateObscurityScore, calculateMoodScore } from '@/lib/spotify';
import Image from 'next/image';
import { FaSpinner, FaHistory, FaCalendarAlt, FaChartLine } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TimeRange = 'short_term' | 'medium_term' | 'long_term';

interface TimeRangeOption {
  value: TimeRange;
  label: string;
  description: string;
}

interface Artist {
  id: string;
  name: string;
  images: { url: string }[];
  external_urls: { spotify: string };
}

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
  popularity: number;
}

interface TimeRangeData {
  obscurityScore: number;
  moodScore: number;
  energyScore: number;
  danceabilityScore: number;
  topTracks: Track[];
  topArtists: Artist[];
  audioFeatures: {
    danceability: number;
    energy: number;
    valence: number;
    acousticness: number;
  };
}

const timeRangeOptions: TimeRangeOption[] = [
  { 
    value: 'short_term', 
    label: 'Last 4 Weeks', 
    description: 'Your recent favorites from the past month'
  },
  { 
    value: 'medium_term', 
    label: 'Last 6 Months', 
    description: 'Your mid-term favorites from the past half year'
  },
  { 
    value: 'long_term', 
    label: 'All Time', 
    description: 'Your all-time favorites since you started using Spotify'
  }
];

export default function TimeMachine() {
  const { data: session, status } = useSession();
  const [timeRangeData, setTimeRangeData] = useState<Record<TimeRange, TimeRangeData | null>>({
    short_term: null,
    medium_term: null,
    long_term: null
  });
  const [loading, setLoading] = useState<Record<TimeRange, boolean>>({
    short_term: false,
    medium_term: false,
    long_term: false
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('medium_term');
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  // Fetch data for all time ranges when component mounts
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchAllTimeRanges();
    }
  }, [session, status]);

  // Update comparison data when time range data changes
  useEffect(() => {
    if (timeRangeData.short_term && timeRangeData.medium_term && timeRangeData.long_term) {
      generateComparisonData();
    }
  }, [timeRangeData]);

  // Fetch data for all time ranges
  const fetchAllTimeRanges = async () => {
    for (const range of timeRangeOptions) {
      await fetchTimeRangeData(range.value);
    }
  };

  // Generate comparison data for charts
  const generateComparisonData = () => {
    const data = [
      {
        name: 'Obscurity',
        'Last 4 Weeks': timeRangeData.short_term?.obscurityScore || 0,
        'Last 6 Months': timeRangeData.medium_term?.obscurityScore || 0,
        'All Time': timeRangeData.long_term?.obscurityScore || 0,
      },
      {
        name: 'Mood',
        'Last 4 Weeks': timeRangeData.short_term?.moodScore || 0,
        'Last 6 Months': timeRangeData.medium_term?.moodScore || 0,
        'All Time': timeRangeData.long_term?.moodScore || 0,
      },
      {
        name: 'Energy',
        'Last 4 Weeks': timeRangeData.short_term?.energyScore || 0,
        'Last 6 Months': timeRangeData.medium_term?.energyScore || 0,
        'All Time': timeRangeData.long_term?.energyScore || 0,
      },
      {
        name: 'Danceability',
        'Last 4 Weeks': timeRangeData.short_term?.danceabilityScore || 0,
        'Last 6 Months': timeRangeData.medium_term?.danceabilityScore || 0,
        'All Time': timeRangeData.long_term?.danceabilityScore || 0,
      },
    ];
    
    setComparisonData(data);
  };

  // Fetch data for a specific time range
  const fetchTimeRangeData = async (timeRange: TimeRange) => {
    if (!session?.accessToken) return;
    
    setLoading(prev => ({ ...prev, [timeRange]: true }));
    setError(null);
    
    try {
      // Fetch top tracks for the time range
      const topTracks = await getTopTracks(session.accessToken, timeRange);
      
      if (!topTracks.length) {
        throw new Error(`No top tracks found for ${timeRange}`);
      }
      
      // Extract track IDs and get audio features
      const trackIds = topTracks.slice(0, 20).map((track: Track) => track.id);
      const features = await getTrackFeatures(session.accessToken, trackIds);
      
      // Calculate average features
      const avgFeatures = features.reduce((acc: any, curr: any) => {
        if (!curr) return acc;
        return {
          danceability: acc.danceability + (curr.danceability || 0),
          energy: acc.energy + (curr.energy || 0),
          valence: acc.valence + (curr.valence || 0),
          acousticness: acc.acousticness + (curr.acousticness || 0),
        };
      }, { danceability: 0, energy: 0, valence: 0, acousticness: 0 });
      
      const validFeatures = features.filter(f => f !== null).length;
      if (validFeatures > 0) {
        Object.keys(avgFeatures).forEach(key => {
          avgFeatures[key] = avgFeatures[key] / validFeatures;
        });
      }
      
      // Calculate obscurity score
      const avgObscurity = topTracks.reduce((acc: number, track: Track) => 
        acc + calculateObscurityScore(track.popularity || 50), 0) / topTracks.length;
      
      // Fetch top artists (mock data for now since we don't have this endpoint)
      const mockTopArtists: Artist[] = Array(5).fill(null).map((_, index) => ({
        id: `artist-${index}`,
        name: `Artist ${index + 1}`,
        images: [{ url: '/placeholder.svg' }],
        external_urls: { spotify: 'https://open.spotify.com' }
      }));
      
      // Set the time range data
      setTimeRangeData(prev => ({
        ...prev,
        [timeRange]: {
          obscurityScore: Math.round(avgObscurity),
          moodScore: Math.round(calculateMoodScore(avgFeatures.valence, avgFeatures.energy)),
          energyScore: Math.round(avgFeatures.energy * 100),
          danceabilityScore: Math.round(avgFeatures.danceability * 100),
          topTracks: topTracks.slice(0, 10),
          topArtists: mockTopArtists,
          audioFeatures: avgFeatures
        }
      }));
    } catch (error) {
      console.error(`Error fetching ${timeRange} data:`, error);
      setError(`Failed to load your ${timeRange.replace('_', ' ')} data. Please try again later.`);
    } finally {
      setLoading(prev => ({ ...prev, [timeRange]: false }));
    }
  };

  // Check if all time ranges are loading
  const isAllLoading = Object.values(loading).some(isLoading => isLoading);

  if (status === 'unauthenticated') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Please log in to view your music time machine.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-6 text-center">Music Time Machine</h1>
        <p className="text-center text-gray-300 mb-8">
          See how your music taste has evolved over time
        </p>

        {/* Time Range Selection */}
        <div className="mb-8">
          <div className="flex justify-center gap-4 flex-wrap">
            {timeRangeOptions.map((option) => (
              <motion.button
                key={option.value}
                onClick={() => setActiveTimeRange(option.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-4 rounded-lg flex flex-col items-center transition-colors ${
                  activeTimeRange === option.value
                    ? 'bg-purple-800/50 border border-purple-500'
                    : 'bg-gray-800/50 hover:bg-gray-700/50'
                }`}
              >
                <FaCalendarAlt className="text-2xl mb-2" />
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-gray-400 mt-1">{option.description}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isAllLoading && (
          <div className="flex justify-center p-12">
            <FaSpinner className="animate-spin text-4xl text-purple-500" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-8">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Time Range Comparison */}
        {!isAllLoading && comparisonData.length > 0 && (
          <div className="mb-12 bg-gray-800/30 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <FaHistory className="text-purple-500" />
              Your Music Evolution
            </h2>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={comparisonData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Last 4 Weeks" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line type="monotone" dataKey="Last 6 Months" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="All Time" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">What This Means</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Obscurity Trend</h4>
                  <p className="text-gray-300">
                    {timeRangeData.short_term?.obscurityScore && timeRangeData.long_term?.obscurityScore && 
                      (timeRangeData.short_term.obscurityScore > timeRangeData.long_term.obscurityScore + 10
                        ? "You've been discovering more obscure music recently! Your recent listening includes more unique tracks compared to your all-time favorites."
                        : timeRangeData.short_term.obscurityScore < timeRangeData.long_term.obscurityScore - 10
                        ? "You've been gravitating toward more popular music recently compared to your historical listening patterns."
                        : "Your taste in music obscurity has remained relatively consistent over time.")
                    }
                  </p>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Mood Trend</h4>
                  <p className="text-gray-300">
                    {timeRangeData.short_term?.moodScore && timeRangeData.long_term?.moodScore && 
                      (timeRangeData.short_term.moodScore > timeRangeData.long_term.moodScore + 10
                        ? "Your recent music choices have been more upbeat and positive compared to your historical preferences."
                        : timeRangeData.short_term.moodScore < timeRangeData.long_term.moodScore - 10
                        ? "You've been listening to more reflective and calm music recently compared to your usual taste."
                        : "The emotional tone of your music has stayed fairly consistent over time.")
                    }
                  </p>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Energy Trend</h4>
                  <p className="text-gray-300">
                    {timeRangeData.short_term?.energyScore && timeRangeData.long_term?.energyScore && 
                      (timeRangeData.short_term.energyScore > timeRangeData.long_term.energyScore + 10
                        ? "Your recent music selections have more energy and intensity than your historical favorites."
                        : timeRangeData.short_term.energyScore < timeRangeData.long_term.energyScore - 10
                        ? "You've been gravitating toward more relaxed, less energetic music recently."
                        : "The energy level in your music has remained relatively stable over time.")
                    }
                  </p>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Danceability Trend</h4>
                  <p className="text-gray-300">
                    {timeRangeData.short_term?.danceabilityScore && timeRangeData.long_term?.danceabilityScore && 
                      (timeRangeData.short_term.danceabilityScore > timeRangeData.long_term.danceabilityScore + 10
                        ? "Your recent music choices have been more rhythmic and danceable than your historical preferences."
                        : timeRangeData.short_term.danceabilityScore < timeRangeData.long_term.danceabilityScore - 10
                        ? "You've been listening to less danceable music recently compared to your usual taste."
                        : "The danceability of your music has stayed fairly consistent over time.")
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Time Range Content */}
        {!isAllLoading && timeRangeData[activeTimeRange] && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-6">
              Your Top Tracks ({timeRangeOptions.find(o => o.value === activeTimeRange)?.label})
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
              {timeRangeData[activeTimeRange]?.topTracks.map((track, index) => (
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
                    <div className="absolute top-0 left-0 w-8 h-8 bg-purple-600 rounded-tl-md rounded-br-md flex items-center justify-center font-bold z-10">
                      {index + 1}
                    </div>
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
            
            {/* Stats for the selected time range */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Obscurity Score</h3>
                <p className="text-4xl font-bold text-purple-400">{timeRangeData[activeTimeRange]?.obscurityScore}%</p>
                <p className="text-gray-400 text-sm mt-1">
                  {timeRangeData[activeTimeRange]?.obscurityScore && timeRangeData[activeTimeRange]!.obscurityScore > 70
                    ? 'Very unique taste!'
                    : timeRangeData[activeTimeRange]?.obscurityScore && timeRangeData[activeTimeRange]!.obscurityScore > 50
                    ? 'More obscure than average'
                    : 'Mostly mainstream tracks'}
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Mood Score</h3>
                <p className="text-4xl font-bold text-green-400">{timeRangeData[activeTimeRange]?.moodScore}%</p>
                <p className="text-gray-400 text-sm mt-1">
                  {timeRangeData[activeTimeRange]?.moodScore && timeRangeData[activeTimeRange]!.moodScore > 70
                    ? 'Very upbeat and energetic!'
                    : timeRangeData[activeTimeRange]?.moodScore && timeRangeData[activeTimeRange]!.moodScore > 50
                    ? 'Positive and moderately energetic'
                    : 'More calm and reflective'}
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Energy</h3>
                <p className="text-4xl font-bold text-blue-400">{timeRangeData[activeTimeRange]?.energyScore}%</p>
                <p className="text-gray-400 text-sm mt-1">
                  {timeRangeData[activeTimeRange]?.energyScore && timeRangeData[activeTimeRange]!.energyScore > 70
                    ? 'High energy music!'
                    : timeRangeData[activeTimeRange]?.energyScore && timeRangeData[activeTimeRange]!.energyScore > 50
                    ? 'Moderately energetic'
                    : 'Calm and relaxed music'}
                </p>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Danceability</h3>
                <p className="text-4xl font-bold text-yellow-400">{timeRangeData[activeTimeRange]?.danceabilityScore}%</p>
                <p className="text-gray-400 text-sm mt-1">
                  {timeRangeData[activeTimeRange]?.danceabilityScore && timeRangeData[activeTimeRange]!.danceabilityScore > 70
                    ? 'Perfect for dancing!'
                    : timeRangeData[activeTimeRange]?.danceabilityScore && timeRangeData[activeTimeRange]!.danceabilityScore > 50
                    ? 'Good rhythm for moving'
                    : 'More for listening than dancing'}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
} 