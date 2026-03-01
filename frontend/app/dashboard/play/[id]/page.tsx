"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Loader2, Play, AlertCircle, Swords, Trophy, Copy } from "lucide-react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"

interface Challenge {
  id: string
  status: string
  betAmount: number
  creatorId: string
  challengerId: string
  fen?: string
  winnerId?: string
}

export default function PlayMatchRoom() {
  const params = useParams()
  const router = useRouter()
  const challengeId = params.id as string
  const [supabase] = useState(() => createClient())

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Accept Challenge State
  const [accepting, setAccepting] = useState(false)

  // Chess State
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [isUpdatingFen, setIsUpdatingFen] = useState(false)

  const fetchChallenge = async () => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single()

      if (error) throw error
      const fetchedChallenge = data as unknown as Challenge
      setChallenge(fetchedChallenge)

      if (fetchedChallenge.fen) {
        try {
            const newGame = new Chess()
            newGame.load(fetchedChallenge.fen)
            setGame(newGame)
            setFen(fetchedChallenge.fen)
        } catch (err) {
            console.error("Error loading fen:", err)
        }
      }

    } catch (e) {
      console.error("Error fetching challenge:", e)
      setError("No se pudo cargar la partida.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
    fetchChallenge()

    // Realtime subscription - Dependencies must ONLY be [challengeId] to avoid infinite reconnect loop
    const channel = supabase
      .channel(`play_room_${challengeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `id=eq.${challengeId}` },
        (payload) => {
          const updatedChallenge = payload.new as unknown as Challenge
          setChallenge(updatedChallenge)

          if (updatedChallenge.fen) {
              setFen((currentFen) => {
                  // Fallback in case updatedChallenge.fen is undefined, although the if check above prevents it.
                  // But TS might complain if updatedChallenge.fen is string | undefined and returned inside this closure.
                  const newFenString = updatedChallenge.fen as string;
                  if (newFenString !== currentFen) {
                      try {
                          const newGame = new Chess()
                          newGame.load(newFenString)
                          setGame(newGame)
                          return newFenString
                      } catch (e) {
                          console.error("Error updating fen from realtime:", e)
                          return currentFen
                      }
                  }
                  return currentFen
              })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId])

  const handleAcceptChallenge = async () => {
    setAccepting(true)
    try {
      const res = await fetch('/api/matchmaking/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al aceptar el reto')
      }

      // Challenge state will be updated via Realtime subscription
    } catch (e) {
      console.error("Error accepting challenge:", e)
      alert(e instanceof Error ? e.message : "Error al aceptar el reto")
    } finally {
      setAccepting(false)
    }
  }

  // Called to process backend win/draw payout
  const checkGameOver = async (currentGame: Chess, newFen: string) => {
      let result = null
      if (currentGame.isCheckmate()) {
          result = 'win'
      } else if (currentGame.isDraw() || currentGame.isStalemate() || currentGame.isThreefoldRepetition() || currentGame.isInsufficientMaterial()) {
          result = 'draw'
      }

      if (result) {
          const turn = currentGame.turn()
          // If it's black's turn to move and they are checkmated, white won.
          let winnerId = undefined
          if (result === 'win') {
              winnerId = turn === 'b' ? challenge?.creatorId : challenge?.challengerId
          }

          try {
              const res = await fetch('/api/matchmaking/finish', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      challengeId,
                      result,
                      winnerId
                  })
              })
              const data = await res.json()
              if (!res.ok) {
                  console.error("Error finalizing match:", data.error)
              }
          } catch (err) {
              console.error("Failed to call finish endpoint:", err)
          }
      }

      // FINALLY, update the FEN.
      // If it's a checkmate, we must payout BEFORE updating the DB FEN state to avoid players manipulating state
      // locally and missing payout.
      setIsUpdatingFen(true)
      supabase
          .from('challenges')
          .update({ fen: newFen })
          .eq('id', challengeId)
          .then(({ error }) => {
              if (error) {
                  // Revert FEN visually on failure
                  setFen(game.fen());
                  setGame(game);
                  alert('Error al registrar movimiento');
              }
              setIsUpdatingFen(false)
          })
  }

  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
      if (!challenge || challenge.status !== 'IN_PROGRESS' || isUpdatingFen) return false

      const isWhite = currentUserId === challenge.creatorId
      const isBlack = currentUserId === challenge.challengerId

      // Prevent moving if it's not the user's turn
      if ((game.turn() === 'w' && !isWhite) || (game.turn() === 'b' && !isBlack)) {
          return false
      }

      // Prevent moving opponent's pieces
      if (piece && piece[0] === 'w' && !isWhite) return false
      if (piece && piece[0] === 'b' && !isBlack) return false

      try {
          const gameCopy = new Chess()
          gameCopy.load(game.fen())
          const move = gameCopy.move({
              from: sourceSquare,
              to: targetSquare,
              promotion: "q", // Always promote to queen for simplicity in this implementation
          })

          if (move === null) return false

          setGame(gameCopy)
          const newFen = gameCopy.fen()
          setFen(newFen)

          // Run finish & fen DB update check
          checkGameOver(gameCopy, newFen)

          return true
      } catch (err) {
          console.error("Invalid move:", err)
          return false
      }
  }

  if (loading) {
      return (
          <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4 font-pixel uppercase">
             <Loader2 className="w-12 h-12 animate-spin text-foreground" />
             <p className="text-foreground animate-pulse">Cargando partida...</p>
          </div>
      )
  }

  if (error || !challenge) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
              <div className="bg-red-100 border-4 border-red-600 p-8 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
                 <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                 <h2 className="text-2xl font-black text-red-700 uppercase mb-2">Error</h2>
                 <p className="text-red-600 font-bold uppercase">{error || "Reto no encontrado"}</p>
                 <button onClick={() => router.push("/dashboard")} className="mt-6 yeezy-button w-full">Volver al Dashboard</button>
              </div>
          </div>
      )
  }

  const boardOrientation = currentUserId === challenge.challengerId ? 'black' : 'white'

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 font-mono pb-20">
      <div className="flex items-center gap-4 bg-background border-4 border-foreground p-4 shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
          <div className="bg-foreground text-background p-3 flex-shrink-0">
             <Swords className="w-8 h-8" />
          </div>
          <div>
              <h1 className="text-2xl md:text-3xl font-pixel uppercase text-foreground leading-tight">Partida en Curso</h1>
              <p className="text-foreground/80 font-bold uppercase text-sm md:text-base mt-1">Ajedrez • ${challenge.betAmount} USD</p>
          </div>
      </div>

      <div className="bg-background border-4 border-foreground p-6 shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
          {challenge.status === 'OPEN' ? (
              currentUserId === challenge.creatorId ? (
                  <div className="space-y-8 text-center py-6">
                      <div className="flex flex-col items-center justify-center space-y-6">
                          <div className="relative">
                              <Loader2 className="w-20 h-20 text-foreground animate-spin relative z-10" />
                          </div>
                          <div className="space-y-2">
                              <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">Esperando oponente...</h3>
                              <p className="text-foreground/80 max-w-md mx-auto text-lg font-bold">
                                  Comparte este enlace con tu amigo para que acepte el reto.
                              </p>
                          </div>
                      </div>

                      <div className="max-w-xl mx-auto space-y-3 text-left">
                          <label className="text-sm font-bold uppercase text-foreground/60 block mb-1">Compartir link del reto</label>
                          <div className="relative flex items-center">
                              <input
                                readOnly
                                value={typeof window !== 'undefined' ? window.location.href : ''}
                                className="w-full px-4 pr-16 py-4 border-4 border-foreground font-pixel text-xs bg-yeezy-light text-foreground focus:outline-none focus:ring-0"
                              />
                              <button
                                  className="absolute right-1 top-1 bottom-1 w-14 bg-foreground text-background flex items-center justify-center border-none cursor-pointer hover:bg-foreground/90 transition-colors"
                                  onClick={() => {
                                    navigator.clipboard.writeText(window.location.href)
                                  }}
                              >
                                  <Copy className="w-5 h-5" />
                              </button>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center py-10 space-y-8 text-center">
                      <div className="space-y-4">
                          <div className="w-24 h-24 bg-foreground text-background flex items-center justify-center mx-auto border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                              <Swords className="w-12 h-12" />
                          </div>
                          <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter">¡Has sido retado!</h3>
                          <p className="text-foreground/80 text-xl max-w-md mx-auto font-bold uppercase mt-4">
                              El creador ha puesto <span className="font-pixel text-foreground">${challenge.betAmount}</span> en juego.
                              <br /><br />
                              ¿Aceptas el desafío?
                          </p>
                      </div>

                      <button
                        onClick={handleAcceptChallenge}
                        disabled={accepting}
                        className="yeezy-button h-16 px-10 text-xl w-full max-w-sm flex items-center justify-center"
                      >
                        {accepting ? (
                          <>
                            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Play className="w-6 h-6 mr-3 fill-current" />
                            ACEPTAR Y APOSTAR ${challenge.betAmount}
                          </>
                        )}
                      </button>
                  </div>
              )
          ) : challenge.status === 'IN_PROGRESS' ? (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="flex flex-col items-center space-y-4">
                      <div className="flex justify-between w-full max-w-lg mb-2 font-bold uppercase">
                          <span>{boardOrientation === 'white' ? 'Tu Turno' : 'Turno del Oponente'}</span>
                          <span>{game.turn() === 'w' ? 'Blancas' : 'Negras'} a mover</span>
                      </div>
                      <div className="w-full max-w-lg aspect-square border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(17,17,17,1)] p-1 bg-yeezy-light">
                          <Chessboard
                              position={fen}
                              onPieceDrop={(source, target, piece) => onDrop(source, target, piece as string)}
                              boardOrientation={boardOrientation}
                              customDarkSquareStyle={{ backgroundColor: "#111111" }}
                              customLightSquareStyle={{ backgroundColor: "#eaddcf" }}
                          />
                      </div>
                  </div>
              </div>
          ) : challenge.status === 'COMPLETED' ? (
              <div className="text-center py-12 space-y-8">
                  <div className="inline-block border-4 border-foreground p-6 bg-yeezy-light shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                      <Trophy className="w-20 h-20 text-foreground" />
                  </div>
                  <div className="space-y-4">
                      <h3 className="text-4xl font-black uppercase">Partida Finalizada</h3>
                      <p className="text-foreground/80 text-lg font-bold uppercase">Esta partida ya ha concluido y los premios han sido entregados.</p>
                  </div>

                  {challenge.winnerId ? (
                     <div className="p-6 bg-foreground text-background border-4 border-foreground max-w-sm mx-auto shadow-[8px_8px_0px_0px_rgba(244,244,240,1)]">
                        <p className="text-background/80 font-bold uppercase mb-2">Ganador</p>
                        <p className="text-background font-black text-3xl uppercase">
                            {challenge.winnerId === currentUserId ? "¡TÚ!" : "Oponente"}
                        </p>
                     </div>
                  ) : (
                     <div className="p-6 bg-yeezy-light text-foreground border-4 border-foreground max-w-sm mx-auto shadow-[8px_8px_0px_0px_rgba(17,17,17,1)]">
                        <p className="text-foreground/80 font-bold uppercase mb-2">Resultado</p>
                        <p className="text-foreground font-black text-3xl uppercase">Empate</p>
                     </div>
                  )}

                  <button onClick={() => router.push("/dashboard")} className="yeezy-button px-8 py-6 text-lg h-auto mt-8 w-full max-w-sm">
                      Volver al Dashboard
                  </button>
              </div>
          ) : (
            <div className="text-center py-10 font-bold uppercase text-foreground/60">
              <p>Cargando estado de la partida...</p>
            </div>
          )}
      </div>
    </div>
  )
}
