// Serve o build (dist/) com os mesmos cabeçalhos do vercel.json, para testar a CSP no computador.
// Uso: pnpm build && node scripts/serve-dist-with-headers.mjs [porta]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = join(dirname(fileURLToPath(import.meta.url)), '..')

const root = join(project, 'dist')
const port = Number(process.env.PORT ?? process.argv[2] ?? 8445)
const config = JSON.parse(await readFile(join(project, 'vercel.json'), 'utf8'))
const headers = Object.fromEntries(config.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])))
// HSTS não faz sentido em http://localhost
delete headers['Strict-Transport-Security']
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon' }

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, path)
  let body
  try {
    body = await readFile(file)
  } catch {
    file = join(root, 'index.html')
    body = await readFile(file)
  }
  res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(body)
}).listen(port, () => console.log(`dist com cabeçalhos em http://localhost:${port}`))
