/** @type {import('next').NextConfig} */

// O Lingo é publicado como SITE ESTÁTICO no GitHub Pages, sob /app/lingo/.
// Não há servidor: o Tutor roda 100% no navegador (modo demonstração, sem
// chave de API). Para o build do Pages, defina no ambiente:
//   NEXT_PUBLIC_BASE_PATH=/app/lingo
// Local (dev), a variável fica vazia e o app roda em http://localhost:3000.
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Headers de segurança (CSP etc.) só valem no servidor de dev — o GitHub
// Pages serve arquivos estáticos e não aplica headers. Ficam aqui para o
// `next dev` local; a exportação estática simplesmente os ignora.
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
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig = {
  output: "export", // gera site estático em out/ (GitHub Pages)
  basePath: base || undefined,
  assetPrefix: base || undefined,
  images: { unoptimized: true }, // sem otimizador de imagem no estático
  reactStrictMode: true,
  poweredByHeader: false,
  // headers() é ignorado na exportação estática; mantido só p/ o dev local.
  async headers() {
    return [{ source: "/(.*)", headers: seguranca }];
  },
};

export default nextConfig;
