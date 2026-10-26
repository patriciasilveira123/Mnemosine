/**
 * Mnemosine - Jogo da Memória Filosófico
 * Author: Patrícia Silveira Penha
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CORE_PHILOSOPHERS, EXTENDED_PHILOSOPHERS, Philosopher } from './data/philosophers';
import { sounds, SoundSettings, SoundTheme, AmbientTrack } from './utils/audio';

interface CardItem extends Philosopher {
  instanceId: string;
}

interface GameConfig {
  playersCount: number;
  totalRounds: number;
  playerNames: string[];
  useExtendedPool: boolean;
}

const DEFAULT_PLAYER_NAMES = ['Sócrates', 'Simone de Beauvoir', 'Platão', 'Hannah Arendt'];
const PROGRESS_WIDTH_CLASSES = ['w-0', 'w-1/6', 'w-2/6', 'w-3/6', 'w-4/6', 'w-5/6', 'w-full'];

export default function App() {
  // Theme & Sound state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sounds.getSettings());

  // Game Mode: 'thinkers' (Modo Pensadores) or 'concepts' (Modo Conceitos)
  const [gameMode, setGameMode] = useState<'thinkers' | 'concepts'>('thinkers');

  // Match Configuration
  const [config, setConfig] = useState<GameConfig>({
    playersCount: 2,
    totalRounds: 3,
    playerNames: [...DEFAULT_PLAYER_NAMES],
    useExtendedPool: false
  });

  // Round & Player State
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [playerScores, setPlayerScores] = useState<number[]>([0, 0, 0, 0]);
  const [completedRoundsScores, setCompletedRoundsScores] = useState<number[]>([0, 0, 0, 0]);

  // Board & Gameplay State
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Metrics
  const [moves, setMoves] = useState<number>(0);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  // Memorization / Peek states
  const [initialMemorizeRemaining, setInitialMemorizeRemaining] = useState<number>(7);
  const [isInitialMemorizing, setIsInitialMemorizing] = useState<boolean>(true);
  const [peekUsedThisRound, setPeekUsedThisRound] = useState<boolean>(false);
  const [peekRemaining, setPeekRemaining] = useState<number>(0);
  const [isPeeking, setIsPeeking] = useState<boolean>(false);

  // Banner status message
  const [statusMessage, setStatusMessage] = useState<{
    type: 'memorize' | 'turn' | 'match' | 'peek';
    text: string;
  }>({
    type: 'memorize',
    text: 'Início da Partida: Memorize! (7s) • Todas visíveis'
  });

  // Modals
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);
  const [showRestartModal, setShowRestartModal] = useState<boolean>(false);
  const [showSoundModal, setShowSoundModal] = useState<boolean>(false);
  const [isFinalMatchEnd, setIsFinalMatchEnd] = useState<boolean>(false);

  // Temporary config modal state
  const [tempPlayersCount, setTempPlayersCount] = useState<number>(2);
  const [tempTotalRounds, setTempTotalRounds] = useState<number>(3);
  const [tempNames, setTempNames] = useState<string[]>([...DEFAULT_PLAYER_NAMES]);
  const [tempUseExtended, setTempUseExtended] = useState<boolean>(false);

  // Timers & modal pause refs
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memorizeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isModalOpenRef = useRef<boolean>(false);

  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    isModalOpenRef.current =
      showAboutModal || showConfigModal || showVictoryModal || showRestartModal || showSoundModal;
  }, [showAboutModal, showConfigModal, showVictoryModal, showRestartModal, showSoundModal]);

  // Preload all 15 philosopher portraits so cards render immediately without delay
  useEffect(() => {
    EXTENDED_PHILOSOPHERS.forEach((phil) => {
      const preloadImg = new Image();
      preloadImg.referrerPolicy = 'no-referrer';
      preloadImg.src = phil.image;
    });
  }, []);

  // Update customizable sound settings
  const handleUpdateSound = (partial: Partial<SoundSettings>, playSample?: 'flip' | 'match' | 'mismatch' | 'peek') => {
    sounds.updateSettings(partial);
    const updated = sounds.getSettings();
    setSoundSettings(updated);
    if (playSample && updated.enabled) {
      if (playSample === 'flip') sounds.playFlip();
      if (playSample === 'match') sounds.playMatch();
      if (playSample === 'mismatch') sounds.playMismatch();
      if (playSample === 'peek') sounds.playPeek();
    }
  };

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Format uppercase philosopher name to clean Title Case (e.g. "SIMONE DE BEAUVOIR" -> "Simone de Beauvoir")
  const formatThinkerName = (rawName: string) => {
    const lowerPrepositions = new Set(['de', 'da', 'do', 'das', 'dos']);
    return rawName
      .toLowerCase()
      .split(' ')
      .map((word, index) => {
        if (index > 0 && lowerPrepositions.has(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  // Switch Theme
  const handleSetTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  };

  // Build deck from philosophers
  const generateDeck = useCallback((extended: boolean) => {
    let pool: Philosopher[] = extended ? [...EXTENDED_PHILOSOPHERS] : [...CORE_PHILOSOPHERS];
    
    // Shuffle pool to pick 6 philosophers
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const selected6 = shuffledPool.slice(0, 6);

    const stamp = Date.now();
    const deck: CardItem[] = [];
    selected6.forEach((p, idx) => {
      deck.push({ ...p, instanceId: `${p.id}-a-${idx}-${stamp}` });
      deck.push({ ...p, instanceId: `${p.id}-b-${idx}-${stamp}` });
    });

    // Shuffle the 12 cards
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }, []);

  // Initialize a new round or fresh match
  const startRound = useCallback((roundNum: number, isNewMatch: boolean, overrideConfig?: GameConfig) => {
    const activeConfig = overrideConfig || config;

    // Clear all intervals and pending timeouts
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (memorizeTimerRef.current) clearInterval(memorizeTimerRef.current);
    if (peekTimerRef.current) clearInterval(peekTimerRef.current);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);

    setCurrentRound(roundNum);
    setCurrentTurnIndex(0);
    setPlayerScores([0, 0, 0, 0]);
    if (isNewMatch) {
      setCompletedRoundsScores([0, 0, 0, 0]);
      setSecondsElapsed(0);
    }
    setMoves(0);
    setMatchedIds([]);
    setFlippedIndices([]);
    setPeekUsedThisRound(false);
    setIsPeeking(false);
    setPeekRemaining(0);

    const newDeck = generateDeck(activeConfig.useExtendedPool);
    setCards(newDeck);

    // Initial 7s memorization
    setIsLocked(true);
    setIsInitialMemorizing(true);
    setInitialMemorizeRemaining(7);
    setStatusMessage({
      type: 'memorize',
      text: 'Início da Partida: Memorize! (7s) • Todas visíveis'
    });

    let count = 7;
    memorizeTimerRef.current = setInterval(() => {
      if (isModalOpenRef.current) return;
      count -= 1;
      if (count > 0) {
        setInitialMemorizeRemaining(count);
        setStatusMessage({
          type: 'memorize',
          text: `Início da Partida: Memorize! (${count}s) • Todas visíveis`
        });
      } else {
        if (memorizeTimerRef.current) clearInterval(memorizeTimerRef.current);
        setIsInitialMemorizing(false);
        setIsLocked(false);
        const firstPlayer = activeConfig.playerNames[0] || DEFAULT_PLAYER_NAMES[0];
        setStatusMessage({
          type: 'turn',
          text: `Vez de ${firstPlayer} • Escolha duas cartas`
        });

        // Start gameplay timer (pauses automatically while any modal is open)
        gameTimerRef.current = setInterval(() => {
          if (!isModalOpenRef.current) {
            setSecondsElapsed(prev => prev + 1);
          }
        }, 1000);
      }
    }, 1000);
  }, [config, generateDeck]);

  // Initial game setup on mount
  useEffect(() => {
    startRound(1, true);
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (memorizeTimerRef.current) clearInterval(memorizeTimerRef.current);
      if (peekTimerRef.current) clearInterval(peekTimerRef.current);
      if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
      sounds.stopAmbient();
    };
  }, []);

  // Handle round completion
  const handleRoundFinished = (roundNumber: number, totalRoundsCount: number) => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    sounds.playVictory();

    const isComplete = roundNumber >= totalRoundsCount;
    setIsFinalMatchEnd(isComplete);
    setStatusMessage({
      type: 'match',
      text: isComplete
        ? 'Partida concluída! Todos os pares foram encontrados.'
        : `Rodada ${roundNumber} concluída! Prepare-se para a próxima rodada.`
    });

    actionTimeoutRef.current = setTimeout(() => {
      setShowVictoryModal(true);
    }, 600);
  };

  // Card click handler
  const handleCardClick = (index: number) => {
    if (isLocked || isInitialMemorizing || isPeeking) return;
    const card = cards[index];
    if (!card) return;

    // Already flipped or matched
    if (flippedIndices.includes(index) || matchedIds.includes(card.id)) return;

    sounds.playFlip();

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      setIsLocked(true);

      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = cards[firstIdx];
      const secondCard = cards[secondIdx];

      if (firstCard.id === secondCard.id) {
        // MATCH!
        actionTimeoutRef.current = setTimeout(() => {
          sounds.playMatch();
          const newMatched = [...matchedIds, firstCard.id];
          setMatchedIds(newMatched);
          setFlippedIndices([]);

          // Update current player's round score
          setPlayerScores(prev => {
            const next = [...prev];
            next[currentTurnIndex] = (next[currentTurnIndex] || 0) + 1;
            return next;
          });

          const curName = config.playerNames[currentTurnIndex] || `Jogador ${currentTurnIndex + 1}`;

          // Check if round is finished (6 pairs)
          if (newMatched.length === 6) {
            setIsLocked(false);
            handleRoundFinished(currentRound, config.totalRounds);
          } else {
            setStatusMessage({
              type: 'match',
              text: `Par encontrado por ${curName}! Jogue novamente.`
            });
            setIsLocked(false);
          }
        }, 350);
      } else {
        // MISMATCH
        actionTimeoutRef.current = setTimeout(() => {
          sounds.playMismatch();
          setFlippedIndices([]);

          // Turn passes to next player
          const nextTurn = (currentTurnIndex + 1) % config.playersCount;
          setCurrentTurnIndex(nextTurn);
          const nextName = config.playerNames[nextTurn] || `Jogador ${nextTurn + 1}`;
          setStatusMessage({
            type: 'turn',
            text: `Vez de ${nextName} • Escolha duas cartas`
          });
          setIsLocked(false);
        }, 900);
      }
    }
  };

  // Trigger Peek (Revelado 10s)
  const handleTriggerPeek = () => {
    if (peekUsedThisRound || isLocked || isPeeking || isInitialMemorizing || matchedIds.length === 6) return;

    sounds.playPeek();
    setPeekUsedThisRound(true);
    setIsPeeking(true);
    setPeekRemaining(10);
    setStatusMessage({
      type: 'peek',
      text: 'Revelando Tabuleiro: 10s restantes'
    });

    let count = 10;
    peekTimerRef.current = setInterval(() => {
      if (isModalOpenRef.current) return;
      count -= 1;
      if (count > 0) {
        setPeekRemaining(count);
        setStatusMessage({
          type: 'peek',
          text: `Revelando Tabuleiro: ${count}s restantes`
        });
      } else {
        if (peekTimerRef.current) clearInterval(peekTimerRef.current);
        setIsPeeking(false);
        setPeekRemaining(0);
        const curName = config.playerNames[currentTurnIndex] || `Jogador ${currentTurnIndex + 1}`;
        setStatusMessage({
          type: 'turn',
          text: `Vez de ${curName} • Escolha duas cartas`
        });
      }
    }, 1000);
  };

  // Advance to next round or restart whole game
  const handleNextRoundOrRestart = () => {
    setShowVictoryModal(false);
    if (isFinalMatchEnd) {
      startRound(1, true);
    } else {
      setCompletedRoundsScores(prev =>
        prev.map((score, idx) => score + (playerScores[idx] || 0))
      );
      startRound(currentRound + 1, false);
    }
  };

  // Open config modal with current values
  const handleOpenConfig = () => {
    setTempPlayersCount(config.playersCount);
    setTempTotalRounds(config.totalRounds);
    setTempNames([...config.playerNames]);
    setTempUseExtended(config.useExtendedPool);
    setShowConfigModal(true);
  };

  // Apply new settings and start fresh match
  const handleApplyConfig = () => {
    const sanitizedNames = tempNames.map(
      (raw, idx) => raw.trim() || DEFAULT_PLAYER_NAMES[idx] || `Jogador ${idx + 1}`
    );
    const updatedConfig: GameConfig = {
      playersCount: tempPlayersCount,
      totalRounds: tempTotalRounds,
      playerNames: sanitizedNames,
      useExtendedPool: tempUseExtended
    };
    setConfig(updatedConfig);
    setTempNames(sanitizedNames);
    setShowConfigModal(false);
    startRound(1, true, updatedConfig);
  };

  // Open custom restart confirmation modal (replaces window.confirm blocked in iframes)
  const handleRestartPrompt = () => {
    setShowRestartModal(true);
  };

  // Execute full match restart
  const handleConfirmRestart = () => {
    sounds.playFlip();
    setShowRestartModal(false);
    setShowVictoryModal(false);
    startRound(1, true);
  };

  // Switch game mode cleanly (restarts current round without inflating total scores)
  const handleSwitchGameMode = (mode: 'thinkers' | 'concepts') => {
    if (gameMode === mode) return;
    setGameMode(mode);
    startRound(currentRound, false);
  };

  // Determine which cards are visually facing up
  const isCardFaceUp = (index: number, cardId: string) => {
    if (isInitialMemorizing || isPeeking) return true;
    if (matchedIds.includes(cardId)) return true;
    if (flippedIndices.includes(index)) return true;
    return false;
  };

  // Calculate victory leaderboard
  const getLeaderboard = () => {
    const list = [];
    for (let i = 0; i < config.playersCount; i++) {
      const roundPts = playerScores[i] || 0;
      const totalPts = (completedRoundsScores[i] || 0) + roundPts;
      list.push({
        index: i,
        name: config.playerNames[i] || DEFAULT_PLAYER_NAMES[i] || `Jogador ${i + 1}`,
        roundScore: roundPts,
        totalScore: totalPts
      });
    }
    list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  };

  const leaderboard = getLeaderboard();
  const leader = leaderboard[0];
  const isTie = leaderboard.length > 1 && leaderboard[0].totalScore === leaderboard[1].totalScore;
  const progressWidthClass = PROGRESS_WIDTH_CLASSES[Math.min(6, Math.max(0, matchedIds.length))];

  return (
    <div
      className={`min-h-screen font-sans select-none pb-24 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#0b101b] text-slate-100' : 'bg-[#f7f3ec] text-slate-900'
      }`}
    >
      <div className="max-w-md mx-auto min-h-screen flex flex-col px-4 pt-3 relative">
        
        {/* Top App Bar */}
        <header className="flex items-center justify-between py-2 border-b border-amber-900/30 mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestartPrompt}
              className="p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-300 border border-transparent active:scale-95 transition cursor-pointer header-btn"
              title="Reiniciar Partida"
              aria-label="Reiniciar Partida"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-[26px] header-icon">temple_hindu</span>
              <h1 className="font-cinzel text-xl font-bold tracking-wider text-amber-400 header-title">MNEMOSINE</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle (Icons Only) */}
            <div className="flex items-center gap-0.5 bg-[#151c2e] p-1 rounded-full border border-amber-900/40 theme-toggle-container">
              <button
                type="button"
                onClick={() => handleSetTheme('light')}
                title="Modo Claro"
                aria-label="Modo Claro"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                  theme === 'light'
                    ? 'bg-[#854d0e] text-white shadow-sm'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">light_mode</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                title="Modo Escuro"
                aria-label="Modo Escuro"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-[#854d0e]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">dark_mode</span>
              </button>
            </div>

            {/* About Button */}
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="p-1.5 rounded-full hover:bg-slate-800/60 text-amber-400 hover:text-amber-300 border border-amber-900/40 bg-[#151c2e]/60 active:scale-95 transition flex items-center justify-center cursor-pointer header-btn"
              title="Sobre o Jogo / Informações"
              aria-label="Sobre o Jogo"
            >
              <span className="material-symbols-outlined text-[20px]">info</span>
            </button>
          </div>
        </header>

        {/* Top Mode Selector: Modo Pensadores / Modo Conceitos */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-[#111728] p-1 rounded-2xl border border-amber-900/40 shadow-sm mode-selector-container">
          <button
            type="button"
            onClick={() => handleSwitchGameMode('thinkers')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-cinzel text-xs font-bold transition cursor-pointer ${
              gameMode === 'thinkers'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800/50 mode-selector-inactive'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">psychology</span>
            <span>Modo Pensadores</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchGameMode('concepts')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-cinzel text-xs transition cursor-pointer ${
              gameMode === 'concepts'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800/50 font-semibold mode-selector-inactive'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">auto_stories</span>
            <span>Modo Conceitos</span>
          </button>
        </div>

        {/* Level & Match Information */}
        <section className="bg-[#131b2e] rounded-2xl p-3 border border-amber-900/40 shadow-md mb-3 level-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 text-amber-400 font-cinzel text-xs font-bold px-2.5 py-0.5 rounded-md border border-amber-500/40 badge-panteao">
                {config.useExtendedPool ? 'PANTEÃO AMPLO' : 'ACERVO CLÁSSICO'}
              </span>
              <span className="text-xs font-medium text-slate-300 text-contrast-dark">
                {config.useExtendedPool
                  ? `6 Pares sorteados de ${EXTENDED_PHILOSOPHERS.length}`
                  : '6 Pares Clássicos'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-300 font-semibold text-contrast-gold">
              <span className="material-symbols-outlined text-[16px] text-amber-400 text-contrast-gold">emoji_events</span>
              <span>{config.playersCount === 1 ? '1 Solo' : `${config.playersCount} Jogadores`}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700/40 pt-2 text-contrast-muted">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-400 text-contrast-gold">casino</span>
              <span>
                Rodada <strong className="text-amber-400 font-bold text-contrast-gold">{currentRound}</strong> de {config.totalRounds}
              </span>
            </div>
            <span className="text-slate-400 italic text-contrast-muted">
              {gameMode === 'thinkers'
                ? 'Bustos escultóricos 3D no acervo'
                : 'Conceitos filosóficos fundamentais'}
            </span>
          </div>
        </section>

        {/* Player Turn Section */}
        <section className="bg-[#131b2e] rounded-2xl p-3 border border-amber-900/40 shadow-md mb-3 turn-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-[18px] text-contrast-gold">sports_esports</span>
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase text-contrast-dark">Turno dos Jogadores</span>
            </div>
            <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 board-subtle-pill">
              Ganha quem fizer mais pares
            </span>
          </div>

          <div className={`grid ${config.playersCount === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            {Array.from({ length: config.playersCount }).map((_, idx) => {
              const isCurrent = idx === currentTurnIndex;
              const name = config.playerNames[idx] || DEFAULT_PLAYER_NAMES[idx] || `Jogador ${idx + 1}`;
              const score = playerScores[idx] || 0;

              return (
                <div
                  key={idx}
                  className={`rounded-xl p-2.5 transition-all duration-300 relative flex flex-col justify-between min-h-[70px] ${
                    isCurrent
                      ? 'player-card-active border-2 border-amber-500 bg-amber-500/10 shadow-sm'
                      : 'player-card-inactive border border-slate-700/60 bg-slate-800/40 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span
                        className={`w-4 h-4 rounded-full ${
                          isCurrent ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-200 font-bold'
                        } text-[10px] flex items-center justify-center shrink-0`}
                      >
                        {idx + 1}
                      </span>
                      <span className={`player-name-text text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-amber-300' : 'text-slate-300'} truncate`}>
                        {name}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0">
                        SUA VEZ
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-700/30">
                    <span className="text-[10px] text-slate-400 text-contrast-muted">Pares:</span>
                    <span className={`player-score-text text-base font-cinzel font-bold ${isCurrent ? 'text-amber-400' : 'text-slate-200'}`}>
                      {score} <span className="player-score-unit text-[9px] font-sans font-normal text-slate-400 text-contrast-muted">PARES</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Metrics Bar */}
        <section className="bg-[#131b2e] rounded-2xl p-2.5 border border-amber-900/40 shadow-md mb-3 metrics-card">
          <div className="grid grid-cols-3 divide-x divide-slate-700/40 text-center">
            <div className="px-2">
              <div className="metric-label flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5 text-contrast-muted">
                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                <span>Movimentos</span>
              </div>
              <div className="text-lg font-bold font-cinzel text-slate-100 text-contrast-dark">{moves}</div>
            </div>
            <div className="px-2">
              <div className="metric-label flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5 text-contrast-muted">
                <span className="material-symbols-outlined text-[14px] text-amber-400 text-contrast-gold">timer</span>
                <span>Tempo</span>
              </div>
              <div className="text-lg font-bold font-cinzel text-amber-400 tracking-wider text-contrast-gold">
                {formatTime(secondsElapsed)}
              </div>
            </div>
            <div className="px-2">
              <div className="metric-label flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5 text-contrast-muted">
                <span className="material-symbols-outlined text-[14px] text-amber-400 text-contrast-gold">style</span>
                <span>Pares</span>
              </div>
              <div className="text-lg font-bold font-cinzel text-amber-400 text-contrast-gold">
                <span>{matchedIds.length}</span>
                <span className="text-xs text-slate-400 font-sans font-normal text-contrast-muted"> /6</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2 progress-track">
            <div
              className={`bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-300 ${progressWidthClass}`}
            />
          </div>
        </section>

        {/* Status / Alert Banner */}
        <div
          className={`rounded-xl px-3 py-2 border text-xs font-semibold flex items-center justify-between gap-2 mb-3 shadow-inner transition-colors duration-300 ${
            statusMessage.type === 'memorize'
              ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-amber-500/70 text-amber-300 status-banner-memorize'
              : statusMessage.type === 'match'
              ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 status-banner-match'
              : statusMessage.type === 'peek'
              ? 'bg-gradient-to-r from-amber-950/90 via-amber-900/70 to-amber-950/90 border-amber-400 text-amber-300 status-banner-peek'
              : 'bg-slate-800/90 border-slate-700/60 text-slate-200 status-banner-turn'
          }`}
        >
          <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
            <span className="material-symbols-outlined text-amber-400 text-[18px] shrink-0 text-contrast-gold">
              {statusMessage.type === 'memorize'
                ? 'auto_awesome'
                : statusMessage.type === 'match'
                ? 'stars'
                : statusMessage.type === 'peek'
                ? 'visibility'
                : 'sports_esports'}
            </span>
            <span className="truncate">{statusMessage.text}</span>
          </div>

          {matchedIds.length === 6 && !showVictoryModal && (
            <button
              type="button"
              onClick={() => setShowVictoryModal(true)}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-cinzel font-bold text-[10px] px-2.5 py-1 rounded-lg shadow-sm transition cursor-pointer"
            >
              {isFinalMatchEnd ? 'Ver Placar' : 'Próxima Rodada'}
            </button>
          )}
        </div>

        {/* 3x4 Cards Grid Board */}
        <main className="grid grid-cols-3 gap-2 flex-grow mb-4">
          {cards.map((card, idx) => {
            const isFaced = isCardFaceUp(idx, card.id);
            const isMatched = matchedIds.includes(card.id);

            return (
              <div
                key={card.instanceId}
                role="button"
                tabIndex={isMatched ? -1 : 0}
                aria-label={isFaced ? `${card.name} - ${card.conceptTitle}` : `Carta ${idx + 1} virada`}
                onClick={() => handleCardClick(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(idx);
                  }
                }}
                className={`card perspective-1000 aspect-[3/4.2] cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-amber-400 rounded-xl ${
                  isFaced ? 'card-flipped' : ''
                } ${isMatched ? 'card-matched pointer-events-none' : ''}`}
              >
                <div className="card-inner w-full h-full relative transform-style-3d">
                  
                  {/* BACK FACE: Moeda Grega com Símbolo Φ em Fundo Preto */}
                  <div className="back-card card-back absolute inset-0 w-full h-full rounded-xl bg-[#080c14] border-2 border-amber-900/60 p-1 flex flex-col items-center justify-between shadow-lg backface-hidden overflow-hidden">
                    <div className="w-full h-full border border-amber-900/40 rounded-lg p-1 flex flex-col items-center justify-center relative bg-black">
                      <div className="absolute inset-1 border border-dotted border-amber-600/30 rounded-md pointer-events-none" />
                      <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#f6e05e] via-[#d4af37] to-[#976e15] p-0.5 shadow-md flex items-center justify-center my-auto">
                        <div className="w-full h-full rounded-full bg-[#151009] border-2 border-[#ecc94b]/80 flex items-center justify-center relative overflow-hidden">
                          <span className="font-cinzel text-amber-400 font-extrabold text-2xl sm:text-3xl tracking-tighter drop-shadow-md">
                            Φ
                          </span>
                        </div>
                      </div>
                      <div className="font-cinzel text-[9px] tracking-widest text-[#ecc94b]/90 font-bold uppercase mt-auto mb-0.5">
                        MNEMOSINE
                      </div>
                    </div>
                  </div>

                  {/* FRONT FACE */}
                  <div className="front-card card-front absolute inset-0 w-full h-full rounded-xl bg-[#141b2c] border-2 border-amber-900/50 flex flex-col justify-between shadow-xl rotate-y-180 backface-hidden overflow-hidden">
                    {gameMode === 'thinkers' ? (
                      <div className="card-cqi-scope w-full h-full flex flex-col justify-between overflow-hidden">
                        <div className="relative w-full h-[60%] bg-[#090d16] overflow-hidden flex items-center justify-center shrink-0">
                          {failedImageIds[card.id] ? (
                            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-amber-400 text-3xl">
                                {card.icon}
                              </span>
                            </div>
                          ) : (
                            <>
                              <img
                                src={card.image}
                                alt={`Busto 3D de ${formatThinkerName(card.name)}`}
                                referrerPolicy="no-referrer"
                                decoding="async"
                                loading="eager"
                                onError={() =>
                                  setFailedImageIds((prev) => ({ ...prev, [card.id]: true }))
                                }
                                className="w-full h-full object-cover object-[center_22%] contrast-[1.03] saturate-[1.04]"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090d16]/50 via-transparent to-amber-300/[0.04]" />
                            </>
                          )}
                        </div>
                        <div className="card-caption w-full min-w-0 h-[40%] px-1 py-1 flex flex-col justify-between items-center text-center bg-[#141b2c] border-t border-amber-900/40 overflow-hidden">
                          {/* Aligned Philosopher Name */}
                          <div className="w-full min-w-0 flex-1 min-h-0 flex items-center justify-center text-center px-0.5 overflow-hidden">
                            <h3 className="thinker-card-name w-full max-w-full min-w-0 font-cinzel font-extrabold text-amber-300 text-center uppercase">
                              {card.name}
                            </h3>
                          </div>
                          {/* Aligned Concept Container */}
                          <div className="w-full min-w-0 h-[25px] sm:h-[28px] pt-0.5 flex items-center justify-center text-center px-0.5 border-t border-amber-900/30 shrink-0 overflow-hidden">
                            <span className="thinker-card-concept w-full max-w-full min-w-0 font-medium text-slate-200 italic text-center">
                              {card.concept}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card-cqi-scope w-full h-full px-[3px] py-1.5 flex flex-col justify-between items-center bg-gradient-to-b from-[#18233c] to-[#0f172a] text-center relative overflow-hidden">
                        {/* Era Header: Larger, clean Title Case, aligned */}
                        <div className="w-full min-w-0 h-[20px] sm:h-[24px] flex items-center justify-center border-b border-amber-900/40 pb-0.5 shrink-0">
                          <span className="concept-card-era w-full min-w-0 truncate text-amber-400/95 font-bold text-center">
                            {card.era}
                          </span>
                        </div>

                        {/* Single Main Concept: ~45% larger bold letters, centered & aligned across all cards, guaranteed inside card */}
                        <div className="w-full min-w-0 flex-1 min-h-0 flex items-center justify-center text-center py-1 overflow-hidden">
                          <h4 className="concept-card-title w-full max-w-full min-w-0 font-sans font-extrabold text-amber-300 text-center drop-shadow-sm">
                            {card.conceptTitle}
                          </h4>
                        </div>

                        {/* Philosopher Name: Larger Title Case in fixed height footer so middle concept stays aligned */}
                        <div className="w-full min-w-0 h-[36px] sm:h-[42px] pt-1 border-t border-amber-900/40 flex items-center justify-center text-center shrink-0 overflow-hidden">
                          <span className="concept-card-author w-full max-w-full min-w-0 font-sans font-bold text-amber-400 text-center">
                            {formatThinkerName(card.name)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0d1322]/95 backdrop-blur-md border-t border-amber-900/40 px-4 py-2.5 flex items-center justify-around z-30 shadow-2xl bottom-bar">
          <button
            type="button"
            onClick={handleOpenConfig}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-amber-400 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">groups</span>
            <span className="text-[11px] font-semibold">Partida</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSoundModal(true)}
            className={`flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer relative ${
              soundSettings.enabled ? 'text-slate-300 hover:text-amber-400' : 'text-slate-500 hover:text-amber-400'
            }`}
            title="Configurações de Som"
          >
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">
                {!soundSettings.enabled
                  ? 'volume_off'
                  : soundSettings.ambientEnabled
                  ? 'music_note'
                  : 'volume_up'}
              </span>
              {soundSettings.enabled && soundSettings.ambientEnabled && (
                <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-1 shadow-sm" />
              )}
            </div>
            <span className="text-[11px] font-semibold">
              {soundSettings.enabled ? 'Som' : 'Mudo'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleTriggerPeek}
            disabled={peekUsedThisRound || isLocked || isPeeking}
            className={`flex flex-col items-center gap-1 text-amber-400 active:scale-95 transition relative btn-peek cursor-pointer ${
              peekUsedThisRound ? 'opacity-40 cursor-not-allowed' : 'hover:text-amber-300'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span className="material-symbols-outlined text-[26px]">visibility</span>
              <span
                className={`absolute -top-1.5 -right-2 text-[9px] font-black px-1 rounded-full border border-slate-900 ${
                  peekUsedThisRound
                    ? 'bg-slate-700 text-slate-300 text-[8px]'
                    : 'bg-amber-500 text-slate-950 peek-badge'
                }`}
              >
                {peekUsedThisRound ? 'USADO' : '10s'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-amber-400">
              {peekUsedThisRound ? 'Esgotado' : 'Revelado (10s)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRestartPrompt}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-amber-400 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">replay</span>
            <span className="text-[11px] font-semibold">Reiniciar</span>
          </button>
        </nav>

        {/* MODAL: SOBRE O JOGO */}
        {showAboutModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-all duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAboutModal(false);
            }}
          >
            <div className="bg-[#12192c] border border-amber-900/50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto modal-card">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-2xl text-contrast-gold">auto_stories</span>
                  <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-400 text-contrast-gold">Jogo Mnemosine</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer modal-close-btn"
                  title="Fechar"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="mb-4 text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-amber-900/30 modal-subcard text-contrast-dark">
                <p className="text-justify">
                  O <strong className="text-amber-400 font-semibold text-contrast-gold">Jogo Mnemosine</strong> foi criado por{' '}
                  <strong className="text-slate-100 font-semibold text-contrast-dark">Patrícia Silveira Penha</strong>, com o auxílio de ferramentas de Inteligência Artificial (IA), com a finalidade de contribuir para o ensino e a aprendizagem da Filosofia de maneira lúdica, dinâmica e significativa.
                </p>
              </div>

              <div className="mb-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 modal-subcard">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-amber-400 text-lg text-contrast-gold">school</span>
                  <h3 className="font-cinzel text-xs font-bold text-amber-400 uppercase tracking-wider text-contrast-gold">
                    Autora e Formação
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 mb-2 font-medium text-contrast-dark">
                  <span className="text-amber-400 font-bold text-contrast-gold">Autora:</span> Patrícia Silveira Penha
                </p>
                <ul className="space-y-1.5 text-xs text-slate-300 list-none text-contrast-dark">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[14px] shrink-0 mt-0.5 text-contrast-gold">verified</span>
                    <span>Doutora em Filosofia pela Universidade Federal do Piauí (UFPI).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[14px] shrink-0 mt-0.5 text-contrast-gold">verified</span>
                    <span>Mestra em Filosofia pela Universidade Federal do Ceará (UFC).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[14px] shrink-0 mt-0.5 text-contrast-gold">verified</span>
                    <span>Graduada em Filosofia (Licenciatura) pela Universidade Estadual do Ceará (UECE).</span>
                  </li>
                </ul>
              </div>

              <div className="mb-5 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 modal-subcard">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-amber-400 text-lg text-contrast-gold">psychology</span>
                  <h3 className="font-cinzel text-xs font-bold text-amber-400 uppercase tracking-wider text-contrast-gold">
                    Objetivo do Jogo
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3 text-justify text-contrast-dark">
                  O Jogo Mnemosine tem como objetivo estimular a memória dos estudantes, favorecendo a identificação e a memorização dos nomes de filósofos e filósofas, bem como de conceitos filosóficos associados a pensadores e pensadoras relevantes da história da Filosofia.
                </p>
                <p className="text-xs text-slate-300 leading-relaxed text-justify text-contrast-dark">
                  Mais do que exercitar a memória, o jogo pretende aproximar os estudantes do pensamento filosófico, valorizando a diversidade de ideias e a contribuição de diferentes pensadores e pensadoras para a construção do conhecimento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-cinzel font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Entendido / Fechar</span>
              </button>
            </div>
          </div>
        )}

        {/* MODAL: CONFIGURAÇÃO DA PARTIDA */}
        {showConfigModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-all duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowConfigModal(false);
            }}
          >
            <div className="bg-[#12192c] border border-amber-900/50 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto modal-card">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-contrast-gold">tune</span>
                  <h2 className="font-cinzel text-lg font-bold text-amber-400 text-contrast-gold">Configurar Partida</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer modal-close-btn"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Jogadores selection */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-contrast-dark">Jogadores na Mesa</span>
                  <span className="text-amber-400 text-xs font-bold text-contrast-gold">
                    {tempPlayersCount === 1 ? '1 Filósofo(a) Solo' : `${tempPlayersCount} Filósofos e Filósofas`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { count: 1, label: '1 Solo', icon: 'person' },
                    { count: 2, label: '2 Dupla', icon: 'group' },
                    { count: 3, label: '3 Trio', icon: 'groups' },
                    { count: 4, label: '4 Quarteto', icon: 'diversity_3' }
                  ].map(item => (
                    <button
                      key={item.count}
                      type="button"
                      onClick={() => setTempPlayersCount(item.count)}
                      className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                        tempPlayersCount === item.count
                          ? 'border-2 border-amber-500 bg-amber-500/10 text-amber-300 modal-choice-btn-active'
                          : 'border border-slate-700 text-slate-300 hover:border-amber-500 modal-choice-btn'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nomes dos Jogadores */}
              <div className="mb-4 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 modal-subcard">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-contrast-muted">
                  Nomes dos Filósofos e Filósofas (Jogadores)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-amber-400 font-bold text-contrast-gold">1. Filósofo / Jogador:</span>
                    <input
                      type="text"
                      value={tempNames[0] || ''}
                      placeholder={DEFAULT_PLAYER_NAMES[0]}
                      onChange={(e) => {
                        const copy = [...tempNames];
                        copy[0] = e.target.value;
                        setTempNames(copy);
                      }}
                      className="w-full bg-[#0a101d] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-semibold focus:border-amber-500 outline-none modal-input"
                    />
                  </div>
                  {tempPlayersCount >= 2 && (
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold text-contrast-gold">2. Filósofa / Jogadora:</span>
                      <input
                        type="text"
                        value={tempNames[1] || ''}
                        placeholder={DEFAULT_PLAYER_NAMES[1]}
                        onChange={(e) => {
                          const copy = [...tempNames];
                          copy[1] = e.target.value;
                          setTempNames(copy);
                        }}
                        className="w-full bg-[#0a101d] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-semibold focus:border-amber-500 outline-none modal-input"
                      />
                    </div>
                  )}
                  {tempPlayersCount >= 3 && (
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold text-contrast-gold">3. Filósofo / Jogador:</span>
                      <input
                        type="text"
                        value={tempNames[2] || ''}
                        placeholder={DEFAULT_PLAYER_NAMES[2]}
                        onChange={(e) => {
                          const copy = [...tempNames];
                          copy[2] = e.target.value;
                          setTempNames(copy);
                        }}
                        className="w-full bg-[#0a101d] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-semibold focus:border-amber-500 outline-none modal-input"
                      />
                    </div>
                  )}
                  {tempPlayersCount >= 4 && (
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold text-contrast-gold">4. Filósofa / Jogadora:</span>
                      <input
                        type="text"
                        value={tempNames[3] || ''}
                        placeholder={DEFAULT_PLAYER_NAMES[3]}
                        onChange={(e) => {
                          const copy = [...tempNames];
                          copy[3] = e.target.value;
                          setTempNames(copy);
                        }}
                        className="w-full bg-[#0a101d] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-semibold focus:border-amber-500 outline-none modal-input"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Duração da Partida */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-contrast-dark">Duração da Partida</span>
                  <span className="text-amber-400 text-xs font-bold text-contrast-gold">
                    {tempTotalRounds === 1
                      ? '1 Rodada (Rápida)'
                      : tempTotalRounds === 3
                      ? '3 Rodadas (Clássica)'
                      : tempTotalRounds === 5
                      ? '5 Rodadas (Torneio)'
                      : '7 Rodadas (Maratona)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { r: 1, title: '1 Rodada', desc: 'Partida rápida e decisiva' },
                    { r: 3, title: '3 Rodadas', desc: 'Padrão equilibrado' },
                    { r: 5, title: '5 Rodadas', desc: 'Torneio dos Filósofos' },
                    { r: 7, title: '7 Rodadas', desc: 'Maratona de Mnemosine' }
                  ].map(item => (
                    <button
                      key={item.r}
                      type="button"
                      onClick={() => setTempTotalRounds(item.r)}
                      className={`p-2.5 rounded-xl text-left transition cursor-pointer ${
                        tempTotalRounds === item.r
                          ? 'border-2 border-amber-500 bg-amber-500/10 modal-choice-btn-active'
                          : 'border border-slate-700 hover:border-amber-500 modal-choice-btn'
                      }`}
                    >
                      <div className={`font-bold text-xs ${tempTotalRounds === item.r ? 'text-amber-300 text-contrast-gold' : 'text-slate-200 text-contrast-dark'}`}>
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-400 text-contrast-muted">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Acervo de Filósofos (Pantheon selector) */}
              <div className="mb-5 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between gap-3 modal-subcard">
                <div>
                  <div className="text-xs font-bold text-slate-200 text-contrast-dark">Sortear do Panteão Amplo (15)</div>
                  <div className="text-[10px] text-slate-400 text-contrast-muted">
                    Adiciona Aristóteles, Mary Wollstonecraft, Descartes, Djamila Ribeiro, Nietzsche, Edith Stein, Kant, Spinoza e Foucault
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTempUseExtended(!tempUseExtended)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                    tempUseExtended ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      tempUseExtended ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplyConfig}
                className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-cinzel font-bold text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                <span>Iniciar com essas Configurações</span>
              </button>
            </div>
          </div>
        )}

        {/* MODAL: FIM DE PARTIDA & CAMPEÃO */}
        {showVictoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all duration-300">
            <div className="bg-[#12192c] border-2 border-amber-500/80 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl modal-card">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-amber-400 text-3xl text-contrast-gold">emoji_events</span>
              </div>
              
              <div className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1 text-contrast-gold">
                {isFinalMatchEnd ? 'Panteão Conquistado' : `Fim da Rodada ${currentRound}`}
              </div>

              <h2 className="font-cinzel text-2xl font-bold text-slate-100 mb-1 text-contrast-dark">
                {isFinalMatchEnd
                  ? isTie
                    ? 'Empate Filosófico!'
                    : `${leader.name} Venceu!`
                  : `Rodada ${currentRound} Concluída!`}
              </h2>

              <p className="text-xs text-slate-300 mb-2 text-contrast-muted">
                {isFinalMatchEnd
                  ? 'Parabéns! O confronto filosófico terminou com grande sabedoria.'
                  : isTie
                  ? 'Placar empatado até agora! Preparem-se para a próxima rodada.'
                  : `Liderança com ${leader.name}. Preparem-se para a próxima rodada!`}
              </p>

              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/40 rounded-full px-3 py-1 mb-4 text-xs text-amber-400 font-semibold badge-panteao">
                <span className="material-symbols-outlined text-[15px]">timer</span>
                <span>Tempo Decorrido: <strong className="font-cinzel">{formatTime(secondsElapsed)}</strong></span>
              </div>

              <div className="bg-slate-900/80 rounded-2xl p-3 border border-slate-700/60 mb-5 text-left modal-subcard">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between text-contrast-gold">
                  <span>Placar de Pares</span>
                  <span className="text-[10px] text-slate-400 text-contrast-muted">
                    Rodada {currentRound} de {config.totalRounds}
                  </span>
                </div>
                <div className="space-y-2">
                  {leaderboard.map((item, rIdx) => (
                    <div
                      key={item.index}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 leaderboard-row"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full ${
                            rIdx === 0
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-700 text-slate-200 font-bold'
                          } text-xs flex items-center justify-center`}
                        >
                          {rIdx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-200 text-contrast-dark">{item.name}</div>
                          <div className="text-[10px] text-slate-400 text-contrast-muted">Jogador {item.index + 1}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-cinzel font-bold text-amber-400 text-contrast-gold">
                          {item.totalScore} {item.totalScore === 1 ? 'par' : 'pares'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleNextRoundOrRestart}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>
                    {isFinalMatchEnd
                      ? 'Jogar Novamente'
                      : `Avançar para Rodada ${currentRound + 1}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowVictoryModal(false)}
                  className="w-full py-2 bg-slate-800 border border-slate-700 text-slate-300 font-medium text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer modal-secondary-btn"
                >
                  Fechar Placar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMAR REINÍCIO DA PARTIDA */}
        {showRestartModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowRestartModal(false);
            }}
          >
            <div className="bg-[#12192c] border-2 border-amber-500/70 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl modal-card">
              <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/60 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-amber-400 text-3xl text-contrast-gold">replay</span>
              </div>

              <h2 className="font-cinzel text-lg sm:text-xl font-bold text-amber-400 mb-2 text-contrast-gold">
                Reiniciar Partida?
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5 text-contrast-muted">
                O placar e o cronômetro serão zerados, voltando à Rodada 1 com novas cartas embaralhadas.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmRestart}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-cinzel font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>Sim, Reiniciar Agora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestartModal(false)}
                  className="w-full py-2.5 bg-slate-800/80 border border-slate-700 text-slate-300 font-semibold text-xs sm:text-sm rounded-xl hover:bg-slate-700 transition cursor-pointer modal-secondary-btn"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PERSONALIZAÇÃO DE SOM DO JOGO */}
        {showSoundModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-all duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSoundModal(false);
            }}
          >
            <div className="bg-[#12192c] border border-amber-900/50 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto modal-card">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-contrast-gold">
                    {soundSettings.enabled ? 'graphic_eq' : 'volume_off'}
                  </span>
                  <h2 className="font-cinzel text-lg font-bold text-amber-400 text-contrast-gold">Personalizar Som</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSoundModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer modal-close-btn"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Master Sound Toggle */}
              <div className="mb-4 bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between modal-subcard">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-amber-400 text-[22px] text-contrast-gold">
                    {soundSettings.enabled ? 'volume_up' : 'volume_off'}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-100 text-contrast-dark">
                      Áudio Geral do Jogo
                    </div>
                    <div className="text-[10px] text-slate-400 text-contrast-muted">
                      {soundSettings.enabled ? 'Sons ativados na partida' : 'Todos os sons estão silenciados'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateSound({ enabled: !soundSettings.enabled }, !soundSettings.enabled ? 'flip' : undefined)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    soundSettings.enabled ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      soundSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className={soundSettings.enabled ? 'opacity-100 transition-opacity' : 'opacity-45 pointer-events-none transition-opacity'}>
                {/* Volume Slider */}
                <div className="mb-4 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 modal-subcard">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider text-contrast-dark">
                      Volume dos Efeitos
                    </span>
                    <span className="text-xs font-cinzel font-bold text-amber-400 text-contrast-gold">
                      {Math.round(soundSettings.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(soundSettings.volume * 100)}
                    onChange={(e) => handleUpdateSound({ volume: Number(e.target.value) / 100 })}
                    onMouseUp={() => sounds.playFlip()}
                    onTouchEnd={() => sounds.playFlip()}
                    className="w-full accent-amber-500 cursor-pointer h-2 rounded-lg"
                  />
                </div>

                {/* Sound Theme / Timbre Selector */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-contrast-dark">
                      Timbre Sonoro
                    </span>
                    <span className="text-[11px] text-amber-400 font-semibold text-contrast-gold">
                      Toque para ouvir
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'lira', title: 'Lira Grega', desc: 'Harmônico e acolhedor', icon: 'music_note' },
                      { id: 'cristal', title: 'Cristal Áureo', desc: 'Agudo e cristalino', icon: 'auto_awesome' },
                      { id: 'classico', title: 'Clássico', desc: 'Sintetizador retrô', icon: 'sports_esports' },
                      { id: 'suave', title: 'Sala de Aula', desc: 'Grave, suave e discreto', icon: 'school' }
                    ] as { id: SoundTheme; title: string; desc: string; icon: string }[]).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdateSound({ theme: item.id }, 'match')}
                        className={`p-2.5 rounded-xl text-left transition cursor-pointer ${
                          soundSettings.theme === item.id
                            ? 'border-2 border-amber-500 bg-amber-500/10 modal-choice-btn-active'
                            : 'border border-slate-700 hover:border-amber-500/70 modal-choice-btn'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-400 text-contrast-gold">{item.icon}</span>
                          <span className={`font-bold text-xs ${soundSettings.theme === item.id ? 'text-amber-300 text-contrast-gold' : 'text-slate-200 text-contrast-dark'}`}>
                            {item.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 text-contrast-muted">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ambient Relaxing Music Selector */}
                <div className="mb-4 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 modal-subcard">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-[20px] text-contrast-gold">library_music</span>
                      <div>
                        <div className="text-xs font-bold text-slate-200 text-contrast-dark">
                          Melodia Ambiente Relaxante
                        </div>
                        <div className="text-[10px] text-slate-400 text-contrast-muted">
                          {soundSettings.ambientEnabled
                            ? 'Tocando suavemente durante a partida'
                            : 'Escolha um estilo ou ative para relaxar'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateSound({ ambientEnabled: !soundSettings.ambientEnabled })}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                        soundSettings.ambientEnabled ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          soundSettings.ambientEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 4 Relaxing Music Styles: Medieval, Violino, Piano, Flauta */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      {
                        id: 'medieval',
                        title: 'Medieval',
                        desc: 'Alaúde e harpa suave',
                        icon: 'castle'
                      },
                      {
                        id: 'violino',
                        title: 'Violino',
                        desc: 'Adágio sereno em cordas',
                        icon: 'music_note'
                      },
                      {
                        id: 'piano',
                        title: 'Piano',
                        desc: 'Noturno calmo e relaxante',
                        icon: 'piano'
                      },
                      {
                        id: 'flauta',
                        title: 'Flauta Suave',
                        desc: 'Melodia doce e relaxante',
                        icon: 'air'
                      }
                    ] as { id: AmbientTrack; title: string; desc: string; icon: string }[]).map((track) => {
                      const isSelected = soundSettings.ambientTrack === track.id;
                      const isPlayingThis = soundSettings.ambientEnabled && isSelected;

                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() =>
                            handleUpdateSound({
                              ambientTrack: track.id,
                              ambientEnabled: true
                            })
                          }
                          className={`p-2.5 rounded-xl text-left transition cursor-pointer relative ${
                            isPlayingThis
                              ? 'border-2 border-amber-500 bg-amber-500/15 shadow-sm modal-choice-btn-active'
                              : isSelected
                              ? 'border border-amber-500/50 bg-slate-900/40 modal-choice-btn'
                              : 'border border-slate-700/80 hover:border-amber-500/60 bg-slate-900/30 modal-choice-btn'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0 text-contrast-gold">
                                {track.icon}
                              </span>
                              <span
                                className={`font-bold text-xs truncate ${
                                  isPlayingThis
                                    ? 'text-amber-300 text-contrast-gold'
                                    : 'text-slate-200 text-contrast-dark'
                                }`}
                              >
                                {track.title}
                              </span>
                            </div>
                            {isPlayingThis && (
                              <span className="material-symbols-outlined text-[14px] text-amber-400 shrink-0">
                                graphic_eq
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight text-contrast-muted">
                            {track.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {soundSettings.ambientEnabled && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300 text-contrast-muted">
                          Volume da Melodia
                        </span>
                        <span className="text-[11px] font-cinzel font-bold text-amber-400 text-contrast-gold">
                          {Math.round(soundSettings.ambientVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={Math.round(soundSettings.ambientVolume * 100)}
                        onChange={(e) => handleUpdateSound({ ambientVolume: Number(e.target.value) / 100 })}
                        className="w-full accent-amber-500 cursor-pointer h-2 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Individual Event Sound Toggles */}
                <div className="mb-5 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2.5 modal-subcard">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 text-contrast-dark">
                    Efeitos por Ação
                  </div>

                  {[
                    {
                      key: 'flipEnabled' as const,
                      label: 'Virar Carta',
                      sample: 'flip' as const,
                      checked: soundSettings.flipEnabled
                    },
                    {
                      key: 'matchEnabled' as const,
                      label: 'Encontrar Par Correto',
                      sample: 'match' as const,
                      checked: soundSettings.matchEnabled
                    },
                    {
                      key: 'mismatchEnabled' as const,
                      label: 'Par Diferente (Erro)',
                      sample: 'mismatch' as const,
                      checked: soundSettings.mismatchEnabled
                    },
                    {
                      key: 'specialEnabled' as const,
                      label: 'Revelar Tabuleiro e Vitória',
                      sample: 'peek' as const,
                      checked: soundSettings.specialEnabled
                    }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1 border-t border-slate-700/30 first:border-t-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.checked) {
                              handleUpdateSound({}, item.sample);
                            }
                          }}
                          title="Testar som"
                          className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center hover:bg-amber-500/25 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                        </button>
                        <span className="text-xs font-medium text-slate-200 text-contrast-dark">{item.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSound(
                            { [item.key]: !item.checked },
                            !item.checked ? item.sample : undefined
                          )
                        }
                        className={`w-10 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                          item.checked ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            item.checked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSoundModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 font-cinzel font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Concluir Ajustes de Som</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
