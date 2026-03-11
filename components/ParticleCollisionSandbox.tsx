"use client";

import { Gamepad2, Lightbulb } from "lucide-react";

export default function ParticleCollisionSandbox() {
  return (
    <div className="my-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-6 overflow-hidden">
      <div className="mb-4 flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-primary shrink-0" />
        <h4 className="font-bold text-foreground">Particle Collision Sandbox</h4>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Two boxes with different particle speeds. Remove the wall and watch energy transfer until{" "}
        <strong className="text-foreground">thermal equilibrium</strong> — entropy & second law in action.
      </p>
      <div className="rounded-lg border border-border bg-background overflow-hidden max-h-[58dvh]">
        <div className="relative w-full aspect-[900/480] min-h-[300px]">
          <iframe
            src="/simulations/particle-collision-sandbox.html"
            title="Particle Collision Sandbox — entropy & equilibrium"
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts"
          />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">What&apos;s happening:</strong> Box A (cyan) has fast particles; Box B (orange) has slow ones.
          When you remove the wall, collisions transfer energy until both sides have the same average speed.
          That&apos;s <strong className="text-foreground">thermal equilibrium</strong> — the second law drives the system toward maximum entropy.
        </div>
      </div>
    </div>
  );
}
