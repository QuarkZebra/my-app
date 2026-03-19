'use client'

import { useState, useEffect } from 'react'
import { createClient } from './lib/supabase'

export default function Home() {
  const [showBig, setShowBig] = useState(false)
  const [showMedium, setShowMedium] = useState(false)

  useEffect(() => {
    async function checkMetadata() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const bigClicked = user?.user_metadata?.big_clicked === true
      if (bigClicked) {
        setShowBig(false)
        setShowMedium(true)
      } else {
        setShowBig(true)
        setShowMedium(false)
      }
    }
    checkMetadata()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function handleBigClick() {
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { big_clicked: true }
    })
    setShowBig(false)
    setShowMedium(true)
  }

  function handleMediumClick() {
    setShowMedium(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-blue-400 mb-4">310S Prep</h1>
        <p className="text-gray-400 mb-8">You are logged in.</p>

        {showBig && (
          <button
            onClick={handleBigClick}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-6 px-12 text-2xl rounded-lg transition-colors mb-6 block mx-auto"
          >
            Big One
          </button>
        )}

        {showMedium && (
          <button
            onClick={handleMediumClick}
            className="bg-red-300 hover:bg-red-200 text-red-900 font-bold py-3 px-8 text-base rounded-lg transition-colors mb-6 block mx-auto"
          >
            Medium one
          </button>
        )}

        <button
          onClick={handleSignOut}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}