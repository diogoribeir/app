"use client";

import { useEffect } from "react";

/** Registra o service worker (habilita instalar no celular + offline). */
export default function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // base path do site estático (vazio no dev, "/app/lingo" no Pages)
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
        /* silencioso: PWA é progressivo, app funciona sem SW */
      });
    }
  }, []);
  return null;
}
