'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FaCompactDisc, FaGuitar, FaChartLine, FaMusic, FaChartBar, FaListUl, FaHistory, FaKey } from 'react-icons/fa';
import { getTopTracks, getTrackFeatures, calculateObscurityScore, calculateMoodScore } from '@/lib/spotify';
import Recommendations from './recommendations';
import GenreExplorer from './genre-explorer';
import PlaylistAnalyzer from './playlist-analyzer';
import TimeMachine from './time-machine';
import TokenTest from './token-test';

interface MusicStats {
  obscurityScore: number;
  moodScore: number;
  topGenres: { name: string; count: number }[];
  audioFeatures: {
    name: string;
    value: number;
  }[];
}

// Define the available tabs
type TabType = 'analysis' | 'genre-explorer' | 'playlist-analyzer' | 'time-machine' | 'token-test';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<MusicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallbackFeatures, setUsingFallbackFeatures] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');

  useEffect(() => {
    async function fetchMusicData() {
      if (session?.accessToken) {
        if (session.error === 'RefreshAccessTokenError') {
          setError('Your session has expired. Please sign in again.');
          setLoading(false);
          return;
        }

        try {
          setError(null);
          setUsingFallbackFeatures(false);
          console.log('Fetching top tracks...');
          const topTracks = await getTopTracks(session.accessToken);
          
          if (!topTracks.length) {
            setError("No top tracks found. Try listening to more music on Spotify!");
            setLoading(false);
            return;
          }

          console.log('Getting track IDs...');
          const trackIds = topTracks.map((track: any) => track.id);
          console.log(`Found ${trackIds.length} track IDs`);

          console.log('Fetching audio features...');
          const features = await getTrackFeatures(session.accessToken, trackIds);

          if (!features.length) {
            setError("Couldn't analyze your tracks. Please try again later.");
            setLoading(false);
            return;
          }

          // Check if we're using fallback features
          if (features[0]?.danceability === 0.5 && 
              features[0]?.energy === 0.5 && 
              features[0]?.valence === 0.5) {
            setUsingFallbackFeatures(true);
          }

          console.log('Calculating averages...');
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

          console.log('Calculating obscurity score...');
          const avgObscurity = topTracks.reduce((acc: number, track: any) => 
            acc + calculateObscurityScore(track.popularity || 50), 0) / topTracks.length;

          console.log('Setting stats...');
          setStats({
            obscurityScore: Math.round(avgObscurity),
            moodScore: Math.round(calculateMoodScore(avgFeatures.valence, avgFeatures.energy)),
            topGenres: [], // To be implemented with artist data
            audioFeatures: [
              { name: 'Danceability', value: Math.round(avgFeatures.danceability * 100) },
              { name: 'Energy', value: Math.round(avgFeatures.energy * 100) },
              { name: 'Mood', value: Math.round(avgFeatures.valence * 100) },
              { name: 'Acousticness', value: Math.round(avgFeatures.acousticness * 100) },
            ],
          });
        } catch (error: any) {
          console.error('Error fetching music data:', error);
          let errorMessage = 'Failed to analyze your music. ';
          
          if (error.statusCode === 401) {
            errorMessage = 'Your session has expired. Please sign in again.';
            signIn('spotify'); // Automatically redirect to sign in
          } else if (error.statusCode === 429) {
            errorMessage += 'Too many requests. Please try again in a few minutes.';
          } else if (error.message) {
            errorMessage += error.message;
          } else {
            errorMessage += 'Please try again later.';
          }
          
          setError(errorMessage);
        }
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchMusicData();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError('Please log in to view your music analysis.');
    }
  }, [session, status]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center p-8 bg-gray-800/50 rounded-lg max-w-md">
          <h2 className="text-2xl font-bold mb-4">Oops!</h2>
          <p className="text-gray-300">{error}</p>
          {error.includes('expired') && (
            <button
              onClick={() => signIn('spotify')}
              className="mt-4 bg-[#1DB954] text-white px-6 py-2 rounded-full font-bold hover:bg-[#1ed760] transition-colors"
            >
              Sign in again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold mb-6 text-center"
        >
          Your Music Dashboard
        </motion.h1>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex justify-center border-b border-gray-700 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-6 py-3 flex items-center gap-2 ${
                activeTab === 'analysis'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <FaChartBar />
              Music Analysis
            </button>
            <button
              onClick={() => setActiveTab('genre-explorer')}
              className={`px-6 py-3 flex items-center gap-2 ${
                activeTab === 'genre-explorer'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <FaMusic />
              Genre Explorer
            </button>
            <button
              onClick={() => setActiveTab('playlist-analyzer')}
              className={`px-6 py-3 flex items-center gap-2 ${
                activeTab === 'playlist-analyzer'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <FaListUl />
              Playlist Analyzer
            </button>
            <button
              onClick={() => setActiveTab('time-machine')}
              className={`px-6 py-3 flex items-center gap-2 ${
                activeTab === 'time-machine'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <FaHistory />
              Time Machine
            </button>
            <button
              onClick={() => setActiveTab('token-test')}
              className={`px-6 py-3 flex items-center gap-2 ${
                activeTab === 'token-test'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <FaKey />
              Token Test
            </button>
          </div>
        </div>

        {usingFallbackFeatures && activeTab === 'analysis' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-8 p-4 bg-yellow-800/50 rounded-lg text-yellow-200"
          >
            <p className="font-medium">
              Note: Using estimated audio features due to Spotify API restrictions.
              This is likely because your app is in Development Mode in the Spotify Developer Dashboard.
            </p>
            <p className="text-sm mt-2">
              To fix this, go to your Spotify Developer Dashboard, add your email as an authorized user,
              or consider switching to Extended Quota Mode.
            </p>
          </motion.div>
        )}

        {/* Tab Content */}
        {activeTab === 'analysis' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-4 mb-4">
                  <FaCompactDisc className="text-3xl text-purple-500" />
                  <h2 className="text-2xl font-semibold">Obscurity Score</h2>
                </div>
                <p className="text-5xl font-bold text-purple-400">{stats?.obscurityScore}%</p>
                <p className="text-gray-400 mt-2">How unique your music taste is</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-4 mb-4">
                  <FaGuitar className="text-3xl text-green-500" />
                  <h2 className="text-2xl font-semibold">Mood Score</h2>
                </div>
                <p className="text-5xl font-bold text-green-400">{stats?.moodScore}%</p>
                <p className="text-gray-400 mt-2">Overall mood of your music</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm col-span-1 md:col-span-2 lg:col-span-1"
              >
                <div className="flex items-center gap-4 mb-4">
                  <FaChartLine className="text-3xl text-blue-500" />
                  <h2 className="text-2xl font-semibold">Audio Features</h2>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.audioFeatures}>
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            <Recommendations />
          </>
        ) : activeTab === 'genre-explorer' ? (
          <GenreExplorer />
        ) : activeTab === 'playlist-analyzer' ? (
          <PlaylistAnalyzer />
        ) : activeTab === 'token-test' ? (
          <TokenTest />
        ) : (
          <TimeMachine />
        )}
      </div>
    </div>
  );
} 