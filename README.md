# Frequency Frontier

## Game Concept
A musical exploration game where you play as a sound wave navigating through a spectrum analyzer landscape. The game world is literally built from live audio analysis of music.

## Technology Stack
- **Next.js** - React framework for production
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework with dark mode
- **WebGL2** - Hardware-accelerated graphics rendering
- **PixiJS** - High-performance 2D WebGL renderer
- **Web Audio API** - Real-time frequency analysis
- **Tone.js** - Advanced audio manipulation and analysis
- **GSAP** - Smooth animations and transitions

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Game Features

### Core Mechanics
- Your character is a frequency that can shift up and down the audio spectrum
- The game world constantly morphs based on the currently playing music
- Different frequency ranges have different properties:
  - **Bass frequencies** (🔴 Red): Let you move through solid barriers but are slow
  - **Mid-range frequencies** (🟢 Green): Allow normal movement
  - **High frequencies** (🔵 Blue): Enable fast movement but are vulnerable
- Players must navigate to collect resonance points that appear at key musical moments
- Challenging sections require frequency-shifting to match specific notes in the music

### Controls
- **Mouse**: Move your frequency character
- **Arrow Keys**: Shift frequency up/down
- **A/D Keys**: Fine-tune frequency
- **1/2/3 Keys**: Quick frequency jumps (Bass/Mid/High)
- **Space**: Pause/Resume
- **R**: Restart when game over

### Musical Integration
- Import your own music to generate unique levels
- Game difficulty adapts to the complexity and tempo of the music
- "Boss battles" occur during musical crescendos
- Special power-ups appear during unique audio moments (drops, solos, etc.)

## Dark Mode
The game defaults to dark mode with a cyberpunk aesthetic featuring:
- Neon cyan and magenta color schemes
- Glowing UI elements
- Hardware-accelerated particle effects
- Real-time spectrum visualization

## Development

### Project Structure
```
├── components/          # React components
│   ├── GameContainer.tsx
│   ├── GameCanvas.tsx
│   └── GameUI.tsx
├── lib/
│   └── game-engine/     # Game logic
│       ├── game.ts
│       ├── audioProcessor.ts
│       ├── player.ts
│       └── gameWorld.ts
├── pages/               # Next.js pages
├── styles/              # Global styles
└── public/              # Static assets
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Extensions
- Collaborative multiplayer where each player controls different frequency ranges
- Level sharing based on popular songs
- A composition mode where players can create music specifically for challenging gameplay

Would you like me to elaborate on any part of this concept?