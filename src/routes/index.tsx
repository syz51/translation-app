import { Link, createFileRoute } from '@tanstack/react-router'
import { FileText, Video } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold">Translation App</h1>
          <p className="text-lg text-muted-foreground">Choose your workflow</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/video">
            <Card className="group cursor-pointer border-2 p-8 transition-all hover:border-primary hover:shadow-lg">
              <div className="mb-4 w-fit rounded-full bg-primary/10 p-4">
                <Video className="h-12 w-12 text-primary" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold">
                Video Transcription
              </h2>
              <p className="text-muted-foreground">
                Extract audio, transcribe, and translate video files
              </p>
              <Button className="mt-6 w-full" variant="default">
                Start with Video
              </Button>
            </Card>
          </Link>

          <Link to="/srt">
            <Card className="group cursor-pointer border-2 p-8 transition-all hover:border-primary hover:shadow-lg">
              <div className="mb-4 w-fit rounded-full bg-primary/10 p-4">
                <FileText className="h-12 w-12 text-primary" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold">SRT Translation</h2>
              <p className="text-muted-foreground">
                Directly translate existing SRT subtitle files
              </p>
              <Button className="mt-6 w-full" variant="default">
                Start with SRT
              </Button>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
