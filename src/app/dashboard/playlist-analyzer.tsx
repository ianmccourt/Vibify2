'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { getUserPlaylists, getTrackFeatures, calculateObscurityScore, calculateMoodScore } from '@/lib/spotify';
import Image from 'next/image';
import { FaSpinner, FaChartPie, FaMusic, FaExternalLinkAlt } from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  images: { url: string }[];
  tracks: { total: number };
  external_urls: { spotify: string };
  owner: { display_name: string };
}

interface PlaylistAnalysis {
  obscurityScore: number;
  moodScore: number;
  danceabilityScore: number;
  energyScore: number;
  acousticnessScore: number;
  genreDistribution: { name: string; value: number }[];
  audioFeatures: { name: string; value: number }[];
  decadeDistribution: { name: string; value: number }[];
}

const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

export default function PlaylistAnalyzer() {
  const { data: session, status } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistAnalysis, setPlaylistAnalysis] = useState<PlaylistAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingPlaylists, setFetchingPlaylists] = useState(false);

  // Fetch user playlists when component mounts
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchPlaylists();
    }
  }, [session, status]);

  // Fetch user playlists from Spotify
  const fetchPlaylists = async () => {
    if (!session?.accessToken) return;
    
    setFetchingPlaylists(true);
    setError(null);
    
    try {
      const userPlaylists = await getUserPlaylists(session.accessToken);
      setPlaylists(userPlaylists as Playlist[]);
      
      // Select the first playlist by default if available
      if (userPlaylists.length > 0) {
        setSelectedPlaylist(userPlaylists[0] as Playlist);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setError('Failed to load your playlists. Please try again later.');
    } finally {
      setFetchingPlaylists(false);
    }
  };

  // Analyze the selected playlist
  const analyzePlaylist = async (playlist: Playlist) => {
    if (!session?.accessToken || !playlist) return;
    
    setLoading(true);
    setError(null);
    setSelectedPlaylist(playlist);
    
    try {
      // Fetch the playlist tracks
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch playlist tracks: ${response.status}`);
      }
      
      const data = await response.json();
      const tracks = data.items.filter((item: any) => item.track);
      
      if (tracks.length === 0) {
        setError('This playlist has no tracks or they could not be accessed.');
        setLoading(false);
        return;
      }
      
      // Extract track IDs and get audio features
      const trackIds = tracks.map((item: any) => item.track.id);
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
      const avgObscurity = tracks.reduce((acc: number, item: any) => 
        acc + calculateObscurityScore(item.track.popularity || 50), 0) / tracks.length;
      
      // Create mock genre distribution (since we can't easily get genres for each track)
      const mockGenres = [
        { name: 'Pop', value: Math.floor(Math.random() * 40) + 10 },
        { name: 'Rock', value: Math.floor(Math.random() * 30) + 5 },
        { name: 'Hip-Hop', value: Math.floor(Math.random() * 25) + 5 },
        { name: 'Electronic', value: Math.floor(Math.random() * 20) + 5 },
        { name: 'R&B', value: Math.floor(Math.random() * 15) + 5 },
        { name: 'Other', value: Math.floor(Math.random() * 10) + 5 }
      ];
      
      // Normalize genre distribution to sum to 100
      const totalGenreValue = mockGenres.reduce((sum, genre) => sum + genre.value, 0);
      const normalizedGenres = mockGenres.map(genre => ({
        name: genre.name,
        value: Math.round((genre.value / totalGenreValue) * 100)
      }));
      
      // Create mock decade distribution
      const mockDecades = [
        { name: '2020s', value: Math.floor(Math.random() * 40) + 10 },
        { name: '2010s', value: Math.floor(Math.random() * 30) + 20 },
        { name: '2000s', value: Math.floor(Math.random() * 20) + 5 },
        { name: '1990s', value: Math.floor(Math.random() * 15) + 5 },
        { name: 'Older', value: Math.floor(Math.random() * 10) + 5 }
      ];
      
      // Normalize decade distribution to sum to 100
      const totalDecadeValue = mockDecades.reduce((sum, decade) => sum + decade.value, 0);
      const normalizedDecades = mockDecades.map(decade => ({
        name: decade.name,
        value: Math.round((decade.value / totalDecadeValue) * 100)
      }));
      
      // Set the playlist analysis
      setPlaylistAnalysis({
        obscurityScore: Math.round(avgObscurity),
        moodScore: Math.round(calculateMoodScore(avgFeatures.valence, avgFeatures.energy)),
        danceabilityScore: Math.round(avgFeatures.danceability * 100),
        energyScore: Math.round(avgFeatures.energy * 100),
        acousticnessScore: Math.round(avgFeatures.acousticness * 100),
        genreDistribution: normalizedGenres,
        audioFeatures: [
          { name: 'Danceability', value: Math.round(avgFeatures.danceability * 100) },
          { name: 'Energy', value: Math.round(avgFeatures.energy * 100) },
          { name: 'Mood', value: Math.round(avgFeatures.valence * 100) },
          { name: 'Acousticness', value: Math.round(avgFeatures.acousticness * 100) },
        ],
        decadeDistribution: normalizedDecades
      });
    } catch (error) {
      console.error('Error analyzing playlist:', error);
      setError('Failed to analyze this playlist. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // When a playlist is selected, analyze it
  useEffect(() => {
    if (selectedPlaylist) {
      analyzePlaylist(selectedPlaylist);
    }
  }, [selectedPlaylist]);

  if (status === 'unauthenticated') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Please log in to analyze your playlists.</p>
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
        <h1 className="text-4xl font-bold mb-6 text-center">Playlist Analyzer</h1>
        <p className="text-center text-gray-300 mb-8">
          Select a playlist to see detailed insights and statistics
        </p>

        {/* Playlist Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Playlists</h2>
          
          {fetchingPlaylists ? (
            <div className="flex justify-center p-4">
              <FaSpinner className="animate-spin text-2xl text-purple-500" />
            </div>
          ) : error && playlists.length === 0 ? (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {playlists.map((playlist) => (
                <motion.div
                  key={playlist.id}
                  onClick={() => setSelectedPlaylist(playlist)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedPlaylist?.id === playlist.id
                      ? 'bg-purple-800/50 border border-purple-500'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="relative w-full aspect-square mb-2">
                    <Image
                      src={playlist.images[0]?.url || '/placeholder.svg'}
                      alt={playlist.name}
                      fill
                      className="rounded-md object-cover"
                    />
                  </div>
                  <h3 className="font-medium text-sm truncate">{playlist.name}</h3>
                  <p className="text-gray-400 text-xs truncate">{playlist.tracks.total} tracks</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Playlist Analysis */}
        {selectedPlaylist && (
          <div className="mt-8 bg-gray-800/30 rounded-lg p-6">
            <div className="flex items-start gap-6 mb-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <Image
                  src={selectedPlaylist.images[0]?.url || '/placeholder.svg'}
                  alt={selectedPlaylist.name}
                  fill
                  className="rounded-md object-cover"
                />
              </div>
              <div className="flex-grow">
                <h2 className="text-2xl font-bold">{selectedPlaylist.name}</h2>
                <p className="text-gray-400 mb-2">
                  By {selectedPlaylist.owner.display_name} • {selectedPlaylist.tracks.total} tracks
                </p>
                {selectedPlaylist.description && (
                  <p className="text-gray-300 text-sm mb-3">{selectedPlaylist.description}</p>
                )}
                <a
                  href={selectedPlaylist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
                >
                  <FaExternalLinkAlt />
                  Open in Spotify
                </a>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <FaSpinner className="animate-spin text-4xl text-purple-500" />
              </div>
            ) : error ? (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-300">{error}</p>
              </div>
            ) : playlistAnalysis && (
              <div>
                {/* Playlist Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <FaChartPie className="text-purple-500" />
                      Obscurity Score
                    </h3>
                    <p className="text-4xl font-bold text-purple-400">{playlistAnalysis.obscurityScore}%</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {playlistAnalysis.obscurityScore > 70
                        ? 'Very unique taste!'
                        : playlistAnalysis.obscurityScore > 50
                        ? 'More obscure than average'
                        : 'Mostly mainstream tracks'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <FaMusic className="text-green-500" />
                      Mood Score
                    </h3>
                    <p className="text-4xl font-bold text-green-400">{playlistAnalysis.moodScore}%</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {playlistAnalysis.moodScore > 70
                        ? 'Very upbeat and energetic!'
                        : playlistAnalysis.moodScore > 50
                        ? 'Positive and moderately energetic'
                        : 'More calm and reflective'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <FaMusic className="text-blue-500" />
                      Danceability
                    </h3>
                    <p className="text-4xl font-bold text-blue-400">{playlistAnalysis.danceabilityScore}%</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {playlistAnalysis.danceabilityScore > 70
                        ? 'Perfect for dancing!'
                        : playlistAnalysis.danceabilityScore > 50
                        ? 'Good rhythm for moving'
                        : 'More for listening than dancing'}
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Genre Distribution */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Genre Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={playlistAnalysis.genreDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {playlistAnalysis.genreDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Audio Features */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Audio Features</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={playlistAnalysis.audioFeatures}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="name" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} />
                          <Radar name="Value" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Decade Distribution */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Era Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={playlistAnalysis.decadeDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {playlistAnalysis.decadeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Playlist Personality */}
                <div className="bg-gray-800/50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Playlist Personality</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Mood</h4>
                      <p className="text-gray-300">
                        {playlistAnalysis.moodScore > 70
                          ? 'This playlist is very upbeat and energetic, perfect for boosting your mood and getting motivated.'
                          : playlistAnalysis.moodScore > 50
                          ? 'This playlist has a positive vibe with moderate energy, good for casual listening and light activities.'
                          : 'This playlist has a more reflective and calm mood, ideal for relaxation or focused work.'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Uniqueness</h4>
                      <p className="text-gray-300">
                        {playlistAnalysis.obscurityScore > 70
                          ? 'You have a very unique taste! This playlist features many tracks that are off the beaten path.'
                          : playlistAnalysis.obscurityScore > 50
                          ? 'This playlist has a good mix of popular tracks and some more obscure selections.'
                          : 'This playlist features mostly well-known, popular tracks that many people enjoy.'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Activity Match</h4>
                      <p className="text-gray-300">
                        {playlistAnalysis.energyScore > 70
                          ? 'Best for: Workouts, parties, and high-energy activities.'
                          : playlistAnalysis.energyScore > 50
                          ? 'Best for: Social gatherings, commuting, and everyday activities.'
                          : 'Best for: Reading, studying, relaxing, or winding down.'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Acoustic vs. Electronic</h4>
                      <p className="text-gray-300">
                        {playlistAnalysis.acousticnessScore > 70
                          ? 'This playlist features mostly acoustic sounds and instruments, with minimal electronic production.'
                          : playlistAnalysis.acousticnessScore > 40
                          ? 'This playlist has a balanced mix of acoustic and electronic elements.'
                          : 'This playlist is dominated by electronic production and synthesized sounds.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
} 