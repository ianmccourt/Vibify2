'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { validateToken } from '@/lib/spotify';

export default function TokenTest() {
  const { data: session, status } = useSession();
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkToken() {
      if (!session?.accessToken) {
        setError('No access token available');
        return;
      }

      setLoading(true);
      try {
        console.log('Testing token:', session.accessToken.substring(0, 10) + '...');
        const result = await validateToken(session.accessToken);
        setTokenInfo(result);
      } catch (err) {
        console.error('Error validating token:', err);
        setError('Error validating token');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      checkToken();
    }
  }, [session, status]);

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center">Checking token...</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="p-8 text-center">Please log in to check your token.</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Token Error</h2>
        <div className="bg-red-900/30 p-4 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Token Information</h2>
      
      {tokenInfo && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Token Status</h3>
            <p className="mb-2">
              Valid: <span className={tokenInfo.valid ? "text-green-400" : "text-red-400"}>
                {tokenInfo.valid ? "Yes" : "No"}
              </span>
            </p>
            {!tokenInfo.valid && tokenInfo.error && (
              <p className="text-red-400">Error: {tokenInfo.error}</p>
            )}
            {tokenInfo.status && (
              <p>Status: {tokenInfo.status} {tokenInfo.statusText}</p>
            )}
          </div>

          {tokenInfo.valid && tokenInfo.user && (
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">User Information</h3>
              <p>ID: {tokenInfo.user.id}</p>
              <p>Display Name: {tokenInfo.user.display_name}</p>
              <p>Email: {tokenInfo.user.email}</p>
              <p>Product: {tokenInfo.user.product}</p>
            </div>
          )}

          {tokenInfo.scopes && (
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Scope Checks</h3>
              <ul className="space-y-2">
                {tokenInfo.scopes.map((scope: any, index: number) => (
                  <li key={index} className={scope.ok ? "text-green-400" : "text-red-400"}>
                    {scope.scope}: {scope.status} {scope.ok ? "✓" : "✗"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Session Information</h3>
            <div className="overflow-x-auto">
              <pre className="text-xs">{JSON.stringify(session, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 