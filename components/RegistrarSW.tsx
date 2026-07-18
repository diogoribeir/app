"use client";

import { useEffect } from "react";

/** Registra o service worker (habilita instalar no celular + offline). */
export default function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencioso: PWA é progressivo, app funciona sem SW */
      });
    }
  }, []);
  return null;
}
