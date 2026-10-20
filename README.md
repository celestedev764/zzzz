# Wave — player de música (YouTube) com modo TV

## Subir na Vercel
1. Crie um repositório no GitHub com esta pasta (ou rode `npx vercel` dentro dela).
2. Na Vercel: **Add New → Project → Import**. Framework: **Other**. Não precisa de variável de ambiente.
3. Deploy. Pronto.

## Usar
- **Celular/PC:** abra `https://SEU-SITE.vercel.app`, busque e toque. Playlists ficam salvas no navegador (Exportar/Importar pra backup).
- **TV:** no navegador da TV abra `https://SEU-SITE.vercel.app/#tv` e aperte OK em "Começar". Aparece um código de 5 letras + QR code.
- **Transmitir:** no celular toque em **Transmitir pra TV** e digite o código (ou escaneie o QR). Tudo que você tocar vai pra TV.
- Na própria TV dá pra buscar usando as setas do controle.

## Rodar local
`node dev-server.mjs` → http://localhost:3000 (abra /#tv numa aba e conecte da outra).

Como funciona: `/api/search` faz scraping da busca do YouTube (sem API key). A reprodução usa o player oficial embutido do YouTube. A conexão celular↔TV é P2P (WebRTC via PeerJS), sem servidor próprio.
