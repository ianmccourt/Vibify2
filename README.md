# Vibify - Your Personal Music Taste Analyzer

Vibify is a web application that analyzes your Spotify listening habits, provides insights about your music taste, and recommends new music based on your preferences and desired level of music obscurity.

## Features

- Spotify account integration
- Playlist analysis
- Music taste metrics and visualization
- Personalized music recommendations
- Adjustable obscurity settings for recommendations

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Spotify Web API

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with your Spotify API credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Setting up Spotify API

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Add `http://localhost:3000/api/auth/callback/spotify` to the Redirect URIs
4. Copy the Client ID and Client Secret to your `.env.local` file

## Contributing

Feel free to submit issues and pull requests.

## License

MIT