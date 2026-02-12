# Actions nécessaires pour optimiser le SEO

## 1. Créer les images manquantes

### Image Open Graph (og-image.png)
Créez une image PNG de 1200x630 pixels pour les partages sur les réseaux sociaux.
- Placez-la dans `front/public/og-image.png`
- Recommandation : utilisez Figma, Canva ou Photoshop
- Incluez le logo Ginku et un texte explicatif

### Icônes PWA
Créez des icônes pour le manifest PWA :
- `front/public/icon-192.png` (192x192 pixels)
- `front/public/icon-512.png` (512x512 pixels)
- Format : PNG avec fond transparent ou coloré (#D84358)

## 2. Configurer Google Search Console

1. Soumettez le sitemap : `https://ginku.diogo-andrade.org/sitemap.xml`
2. Vérifiez que robots.txt est accessible : `https://ginku.diogo-andrade.org/robots.txt`
3. Demandez une nouvelle indexation des pages principales
4. Activez le rapport "Expérience sur la page"

## 3. Améliorer le rendu côté serveur (optionnel mais recommandé)

Pour une meilleure indexation, envisagez :
- **Vite SSG** (Static Site Generation) avec vite-ssg
- **Nuxt 3** (migration vers framework SSR)
- **Prerendering** avec vite-plugin-prerender

### Installation vite-plugin-prerender (recommandé)
```bash
cd front
pnpm add -D vite-plugin-prerender
```

Puis ajoutez dans `vite.config.js` :
```javascript
import prerender from 'vite-plugin-prerender'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    prerender({
      routes: ['/', '/lignes', '/infos'],
      postProcess(renderedRoute) {
        renderedRoute.html = renderedRoute.html
          .replace(/<script (.*?)>/gi, '<script $1 defer>')
        return renderedRoute
      }
    })
  ]
})
```

## 4. Tester le SEO

Utilisez ces outils :
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

## 5. Vérifications post-déploiement

- [ ] Vérifier que og-image.png s'affiche correctement
- [ ] Tester le partage sur Facebook/Twitter
- [ ] Vérifier le manifest.json dans DevTools > Application
- [ ] Soumettre à nouveau le sitemap dans Google Search Console
- [ ] Vérifier l'indexation après 24-48h
