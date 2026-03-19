import Link from 'next/link'

export default function About() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-orange-400 mb-4">About</h1>
        <p className="text-gray-400 mb-8">This is a second page.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Back home
        </Link>
      </div>
    </main>
  )
}