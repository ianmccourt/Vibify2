import NextAuth from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import { scopes } from '@/lib/spotify';

async function refreshAccessToken(token: any) {
  try {
    console.log('Refreshing access token...');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token refresh failed:', data);
      throw data;
    }

    console.log('Token refreshed successfully');
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + (data.expires_in * 1000),
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: 'https://accounts.spotify.com/authorize',
        params: {
          scope: scopes.join(' '),
          show_dialog: true,
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    maxAge: 60 * 60, // 1 hour
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        console.log('Initial sign in, setting token');
        const expiresIn = account.expires_in ? Number(account.expires_in) : 3600;
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (expiresIn * 1000),
          user,
        };
      }

      // Return previous token if the access token has not expired
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        console.log('Token still valid');
        return token;
      }

      // Access token has expired, try to refresh it
      console.log('Token expired, attempting refresh');
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token.error) {
        console.error('Session error:', token.error);
        session.error = token.error;
      }
      session.accessToken = token.accessToken;
      session.user = token.user;
      return session;
    },
  },
  debug: true,
  pages: {
    signIn: '/',
    error: '/', // Error code passed in query string as ?error=
  },
});

export { handler as GET, handler as POST }; 