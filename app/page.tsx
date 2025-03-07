import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <header className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
          DUOAI
        </h1>
        <p className="mt-2 text-gray-300">Your Intelligent Gaming Companion</p>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">About DUOAI</h2>
          <p className="text-gray-300 max-w-3xl">
            DUOAI is an advanced AI-powered gaming assistant designed to enhance your gaming experience.
            Using computer vision and natural language processing, DUOAI provides real-time assistance,
            strategy optimization, and personalized gaming insights.
          </p>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-purple-800">
              <h3 className="text-xl font-medium mb-2 text-purple-300">Real-Time Assistance</h3>
              <p className="text-gray-400">Get immediate help without pausing gameplay through voice commands and screen analysis.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-purple-800">
              <h3 className="text-xl font-medium mb-2 text-purple-300">Multiple AI Characters</h3>
              <p className="text-gray-400">Choose from different AI personalities to match your gaming style and preferences.</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-purple-800">
              <h3 className="text-xl font-medium mb-2 text-purple-300">Voice Interaction</h3>
              <p className="text-gray-400">Natural voice input and output for seamless communication during gameplay.</p>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">Get Started</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <a 
              href="https://github.com/yourusername/duoai/releases" 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2 px-6 rounded-full inline-flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download DUOAI
            </a>
            <a 
              href="/docs" 
              className="bg-transparent border border-purple-600 text-purple-400 hover:bg-purple-900 hover:text-white font-medium py-2 px-6 rounded-full inline-flex items-center"
            >
              View Documentation
            </a>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-gray-800 mt-12 py-6 bg-gray-900">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>© {new Date().getFullYear()} DUOAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
