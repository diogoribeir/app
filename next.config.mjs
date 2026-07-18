/** @type {import('next').NextConfig} */

// Headers de segurança aplicados a TODAS as respostas.
// CSP pragmática: o app não usa nenhum recurso externo (nem fonte, nem CDN),
// então tudo trava em 'self'. 'unsafe-inline'/'unsafe-eval' são exigidos pelo
// runtime do Next (dev/HMR e scripts inline de hidratação).
const seguranca = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // microfone liberado só para o próprio app (prática de fala 🎤)
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // não anunciar o framework
  async headers() {
    return [{ source: "/(.*)", headers: seguranca }];
  },
};

export default nextConfig;
