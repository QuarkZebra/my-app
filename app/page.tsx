'use client'

import { createClient } from './lib/supabase'

export default function Home() {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-blue-400 mb-4">310S Prep</h1>
        <p className="text-gray-400 mb-8">You are logged in.</p>
        <button
          onClick={handleSignOut}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Sign out
        </button>
         <p className="text-gray-400 mb-8"> </p>
        <button
          className="text-10xl bg-red-600 hover:bg-red-400 text-white font-bold py-6 px-12 rounded-lg transition-colors"
        >
          Big One
        </button>
      </div>
    </main>
  )
}