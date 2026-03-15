/** Full 8-burst staggered confetti sequence — used on regular ticket creation. */
export function fireFullConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const fire = confetti.create(undefined, {
      resize: true,
      useWorker: false,
    });

    // Center burst - massive (immediate)
    fire({
      particleCount: 300,
      spread: 180,
      startVelocity: 60,
      scalar: 1.3,
      origin: { y: 0.5 },
      zIndex: 9999,
    });

    // Top center - raining down (100ms delay)
    setTimeout(() => {
      fire({
        particleCount: 200,
        spread: 180,
        startVelocity: 50,
        scalar: 1.2,
        origin: { x: 0.5, y: 0 },
        zIndex: 9999,
      });
    }, 100);

    // Bottom center - shooting up (200ms delay)
    setTimeout(() => {
      fire({
        particleCount: 200,
        spread: 180,
        startVelocity: 50,
        scalar: 1.2,
        origin: { x: 0.5, y: 1 },
        zIndex: 9999,
      });
    }, 200);

    // Left side - full height coverage (300ms delay)
    setTimeout(() => {
      fire({
        particleCount: 150,
        angle: 90,
        spread: 180,
        startVelocity: 55,
        scalar: 1.1,
        origin: { x: 0, y: 0.5 },
        zIndex: 9999,
      });
    }, 300);

    // Right side - full height coverage (400ms delay)
    setTimeout(() => {
      fire({
        particleCount: 150,
        angle: 90,
        spread: 180,
        startVelocity: 55,
        scalar: 1.1,
        origin: { x: 1, y: 0.5 },
        zIndex: 9999,
      });
    }, 400);

    // Top-left corner (500ms delay)
    setTimeout(() => {
      fire({
        particleCount: 100,
        angle: 45,
        spread: 90,
        startVelocity: 45,
        scalar: 1.0,
        origin: { x: 0, y: 0 },
        zIndex: 9999,
      });
    }, 500);

    // Top-right corner (600ms delay)
    setTimeout(() => {
      fire({
        particleCount: 100,
        angle: 135,
        spread: 90,
        startVelocity: 45,
        scalar: 1.0,
        origin: { x: 1, y: 0 },
        zIndex: 9999,
      });
    }, 600);

    // Bottom-left corner (700ms delay)
    setTimeout(() => {
      fire({
        particleCount: 100,
        angle: 315,
        spread: 90,
        startVelocity: 45,
        scalar: 1.0,
        origin: { x: 0, y: 1 },
        zIndex: 9999,
      });
    }, 700);

    // Bottom-right corner (800ms delay)
    setTimeout(() => {
      fire({
        particleCount: 100,
        angle: 225,
        spread: 90,
        startVelocity: 45,
        scalar: 1.0,
        origin: { x: 1, y: 1 },
        zIndex: 9999,
      });
    }, 800);
  });
}

/** Single center-burst confetti — used on waitlist ticket creation. */
export function fireSimpleConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const fire = confetti.create(undefined, {
      resize: true,
      useWorker: false,
    });
    fire({
      particleCount: 300,
      spread: 180,
      startVelocity: 60,
      scalar: 1.3,
      origin: { y: 0.5 },
      zIndex: 9999,
    });
  });
}
