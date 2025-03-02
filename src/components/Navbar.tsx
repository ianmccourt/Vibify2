'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { FaSignOutAlt, FaKey, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import { validateToken } from '@/lib/spotify';

export default function Navbar() {
  const { data: session } = useSession();
  const [showTokenDebug, setShowTokenDebug] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  const checkToken = async () => {
    if (!session?.accessToken) return;
    
    setValidating(true);
    try {
      const result = await validateToken(session.accessToken);
      setTokenValidation(result);
    } catch (error) {
      setTokenValidation({ valid: false, error: 'Error validating token', details: error });
    } finally {
      setValidating(false);
    }
  };

  return (
    <>
      <nav className="bg-gray-900/80 backdrop-blur-sm py-4 px-6 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
          Vibify
        </Link>
        
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                Dashboard
              </Link>
              <button
                onClick={() => {
                  setShowTokenDebug(!showTokenDebug);
                  if (!showTokenDebug && !tokenValidation) {
                    checkToken();
                  }
                }}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md transition-colors"
                title="Debug token information"
              >
                <FaKey />
                Token
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-2 bg-red-600/80 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                <FaSignOutAlt />
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Home
            </Link>
          )}
        </div>
      </nav>
      
      {showTokenDebug && session && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto p-6">
          <div className="max-w-4xl mx-auto bg-gray-900 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Token Debug Information</h2>
              <button 
                onClick={() => setShowTokenDebug(false)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            
            <div className="mb-4 flex gap-4">
              <button
                onClick={checkToken}
                disabled={validating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                {validating ? <FaSpinner className="animate-spin" /> : <FaKey />}
                Validate Token
              </button>
              
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                <FaSignOutAlt />
                Logout & Get New Token
              </button>
            </div>
            
            <div className="text-xs font-mono bg-gray-800 p-4 rounded overflow-auto max-h-[70vh]">
              <p className="mb-2"><strong>Access Token (first 20 chars):</strong> {session.accessToken ? session.accessToken.substring(0, 20) + '...' : 'No token'}</p>
              <p className="mb-2"><strong>Token Expiry:</strong> {session.expires}</p>
              <p className="mb-2"><strong>User:</strong> {session.user?.name} ({session.user?.email})</p>
              <p className="mb-4"><strong>Session Error:</strong> {session.error || 'None'}</p>
              
              {tokenValidation && (
                <div className="mb-4 p-3 rounded bg-gray-900">
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    Token Validation: 
                    {tokenValidation.valid ? (
                      <span className="text-green-500 flex items-center gap-1">
                        <FaCheck /> Valid
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1">
                        <FaTimes /> Invalid
                      </span>
                    )}
                  </h3>
                  
                  {tokenValidation.valid ? (
                    <>
                      <p className="mb-2"><strong>User ID:</strong> {tokenValidation.user?.id}</p>
                      <p className="mb-2"><strong>User Email:</strong> {tokenValidation.user?.email}</p>
                      
                      <h4 className="font-bold mt-3 mb-2">Scope Checks:</h4>
                      <ul className="list-disc pl-5">
                        {tokenValidation.scopes?.map((scope: any, index: number) => (
                          <li key={index} className={scope.ok ? 'text-green-400' : 'text-red-400'}>
                            {scope.scope}: {scope.status} {scope.ok ? '✓' : '✗'}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="text-red-400 mb-2"><strong>Error:</strong> {tokenValidation.error}</p>
                      <p className="mb-2"><strong>Status:</strong> {tokenValidation.status} {tokenValidation.statusText}</p>
                      {tokenValidation.details && (
                        <pre className="bg-gray-950 p-2 rounded mt-2 text-xs">
                          {JSON.stringify(tokenValidation.details, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
              
              <h3 className="font-bold mb-2">Full Session Data:</h3>
              <pre>{JSON.stringify(session, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 