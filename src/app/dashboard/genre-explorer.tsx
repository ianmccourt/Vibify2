'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { getAvailableGenres, getRecommendations } from '@/lib/spotify';
import Image from 'next/image';
import { FaMusic, FaSpinner, FaRandom } from 'react-icons/fa';

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

// Define genre categories for better organization with proper typing
const genreCategories: Record<string, string[]> = {
  'Pop/Rock': ['pop', 'rock', 'indie', 'alternative', 'indie-pop', 'pop-film'],
  'Electronic': ['electronic', 'edm', 'dance', 'house', 'techno', 'trance', 'dubstep'],
  'Hip-Hop/R&B': ['hip-hop', 'r-n-b', 'rap', 'trap'],
  'Jazz/Blues': ['jazz', 'blues', 'soul', 'funk'],
  'Folk/Country': ['folk', 'country', 'americana', 'bluegrass'],
  'World': ['latin', 'afrobeat', 'reggae', 'reggaeton', 'k-pop', 'j-pop'],
  'Classical/Instrumental': ['classical', 'instrumental', 'ambient', 'piano'],
  'Metal/Punk': ['metal', 'punk', 'hard-rock', 'hardcore', 'grindcore'],
  'Other': [] // Will hold any genres not in other categories
};

export default function GenreExplorer() {
  const { data: session, status } = useSession();
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorizedGenres, setCategorizedGenres] = useState<Record<string, string[]>>(genreCategories);
  const [obscurityLevel, setObscurityLevel] = useState(50);

  // Fetch available genres when component mounts
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchGenres();
    }
  }, [session, status]);

  // Categorize genres when availableGenres changes
  useEffect(() => {
    if (availableGenres.length > 0) {
      categorizeGenres();
    }
  }, [availableGenres]);

  // Fetch available genres from Spotify
  const fetchGenres = async () => {
    if (!session?.accessToken) return;
    
    setLoading(true);
    try {
      const genres = await getAvailableGenres(session.accessToken);
      setAvailableGenres(genres);
      
      // Set some default selected genres
      if (genres.includes('indie')) {
        setSelectedGenres(['indie']);
      } else if (genres.length > 0) {
        setSelectedGenres([genres[0]]);
      }
    } catch (error) {
      console.error('Error fetching genres:', error);
      setError('Failed to load genres. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Categorize available genres into our predefined categories
  const categorizeGenres = () => {
    const newCategorized: Record<string, string[]> = {...genreCategories};
    newCategorized['Other'] = [];
    
    // Place each available genre into its category
    availableGenres.forEach(genre => {
      let placed = false;
      
      // Check each category to see if it should contain this genre
      Object.entries(genreCategories).forEach(([category, genres]) => {
        if (category !== 'Other' && (
          genres.includes(genre) || 
          genres.some(g => genre.includes(g)) || 
          genres.some(g => g.includes(genre))
        )) {
          if (!newCategorized[category].includes(genre)) {
            newCategorized[category].push(genre);
          }
          placed = true;
        }
      });
      
      // If genre doesn't fit in any category, put it in "Other"
      if (!placed) {
        newCategorized['Other'].push(genre);
      }
    });
    
    // Remove empty categories and sort genres alphabetically within each category
    const filteredCategorized: Record<string, string[]> = {};
    Object.entries(newCategorized).forEach(([category, genres]) => {
      if (genres.length > 0) {
        filteredCategorized[category] = genres.sort();
      }
    });
    
    setCategorizedGenres(filteredCategorized);
    
    // Set the first non-empty category as active
    const firstCategory = Object.keys(filteredCategorized)[0];
    if (firstCategory && !activeCategory) {
      setActiveCategory(firstCategory);
    }
  };

  // Toggle genre selection
  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      // Spotify allows max 5 seed genres
      if (selectedGenres.length < 5) {
        setSelectedGenres([...selectedGenres, genre]);
      }
    }
  };

  // Select random genres
  const selectRandomGenres = () => {
    const randomCount = Math.floor(Math.random() * 4) + 1; // 1-5 genres
    const shuffled = [...availableGenres].sort(() => 0.5 - Math.random());
    setSelectedGenres(shuffled.slice(0, randomCount));
  };

  // Fetch recommendations based on selected genres
  const fetchRecommendations = async () => {
    if (!session?.accessToken || selectedGenres.length === 0) {
      setError('Please select at least one genre');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const tracks = await getRecommendations(
        session.accessToken,
        [], // No seed tracks, using genres instead
        100 - obscurityLevel, // Target popularity
        20, // Limit
        selectedGenres // Selected genres
      );
      
      if (tracks[0]?.id?.startsWith('fallback-')) {
        setError('Could not get recommendations for these genres. Try different ones.');
      }
      
      setRecommendations(tracks);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to get recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // When selected genres change, fetch new recommendations
  useEffect(() => {
    if (selectedGenres.length > 0 && session?.accessToken) {
      fetchRecommendations();
    }
  }, [selectedGenres, obscurityLevel]);

  if (status === 'unauthenticated') {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Please log in to explore genres.</p>
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
        <h1 className="text-4xl font-bold mb-6 text-center">Genre Explorer</h1>
        <p className="text-center text-gray-300 mb-8">
          Discover music by exploring different genres and combinations
        </p>

        {/* Genre Selection Section */}
        <div className="mb-8 bg-gray-800/50 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Select Genres</h2>
            <div className="flex gap-2">
              <button
                onClick={selectRandomGenres}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                <FaRandom />
                Random
              </button>
              <button
                onClick={fetchRecommendations}
                disabled={loading || selectedGenres.length === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaMusic />}
                Get Recommendations
              </button>
            </div>
          </div>

          {/* Selected genres */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">Selected genres ({selectedGenres.length}/5):</p>
            <div className="flex flex-wrap gap-2">
              {selectedGenres.length > 0 ? (
                selectedGenres.map(genre => (
                  <span
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm cursor-pointer hover:bg-purple-700 transition-colors"
                  >
                    {genre} ×
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No genres selected</span>
              )}
            </div>
          </div>

          {/* Obscurity slider */}
          <div className="mb-6">
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

          {/* Genre categories */}
          <div className="mb-4 border-b border-gray-700">
            <div className="flex overflow-x-auto pb-2 gap-2">
              {Object.keys(categorizedGenres).map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${
                    activeCategory === category
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Genre list */}
          <div className="max-h-60 overflow-y-auto p-2">
            {loading && availableGenres.length === 0 ? (
              <div className="flex justify-center p-4">
                <FaSpinner className="animate-spin text-2xl text-purple-500" />
              </div>
            ) : error && availableGenres.length === 0 ? (
              <p className="text-red-400 text-center">{error}</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {activeCategory && categorizedGenres[activeCategory]?.map(genre => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-2 rounded-md text-sm text-left transition-colors ${
                      selectedGenres.includes(genre)
                        ? 'bg-purple-600/80 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-6">
            {loading ? 'Finding Recommendations...' : 'Recommended Tracks'}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-12">
              <FaSpinner className="animate-spin text-4xl text-purple-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
        </div>
      </motion.div>
    </div>
  );
} 