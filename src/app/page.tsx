'use client';

import React from 'react';
import { signIn, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { FaSpotify } from 'react-icons/fa';
import Link from 'next/link';

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-6xl font-bold mb-8 bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
          Welcome to Vibify
        </h1>
        <p className="text-xl mb-12 text-gray-300 max-w-2xl">
          Discover insights about your music taste, get personalized recommendations,
          and explore new music based on your preferences.
        </p>

        {!session ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => signIn('spotify', { callbackUrl: '/dashboard' })}
            className="bg-[#1DB954] text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 hover:bg-[#1ed760] transition-colors"
          >
            <FaSpotify className="text-2xl" />
            Connect with Spotify
          </motion.button>
        ) : (
          <Link
            href="/dashboard"
            className="bg-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
      >
        {features.map((feature, index) => (
          <div
            key={index}
            className="p-6 rounded-lg bg-gray-800/50 backdrop-blur-sm"
          >
            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
            <p className="text-gray-400">{feature.description}</p>
          </div>
        ))}
      </motion.div>
    </main>
  );
}

const features = [
  {
    title: "Analyze Your Taste",
    description: "Get detailed insights about your music preferences, favorite genres, and listening patterns.",
  },
  {
    title: "Discover New Music",
    description: "Find new artists and tracks based on your taste, with control over how obscure the recommendations are.",
  },
  {
    title: "Track Your Evolution",
    description: "See how your music taste changes over time and explore your listening journey.",
  },
]; 