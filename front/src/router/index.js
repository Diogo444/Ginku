import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'

const Home = () => import('@/views/home.vue')
const Lignes = () => import('@/views/lignes.vue')
const Arret = () => import('@/views/arret.vue')
const ArretFromLigne = () => import('@/views/arretFromLigne.vue')
const InfosTrafic = () => import('@/views/infos-trafic.vue')
const InfosTransport = () => import('@/views/infos-transport.vue')
const Message = () => import('@/views/message.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { left: 0, top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { 
        title: 'Ginku — Horaires bus et tram en temps réel à Besançon',
        description: 'Consultez les horaires de bus et tramway Ginko en temps réel à Besançon et dans le Grand Besançon. Lignes, arrêts, favoris et infos trafic, tout en un clic.'
      },
    },
    {
      path: '/lignes',
      name: 'lignes',
      component: Lignes,
      meta: { 
        title: 'Toutes les lignes — Ginku',
        description: 'Découvrez toutes les lignes de bus et tramway Ginko à Besançon. Consultez les horaires en temps réel et les itinéraires.'
      },
    },
    {
      path: '/arret/:nom',
      name: 'ArretNomView',
      component: Arret,
      meta: { 
        title: 'Arrêt — Ginku',
        description: 'Consultez les horaires en temps réel à cet arrêt Ginko à Besançon.'
      },
    },
    {
      path: '/arretFromLigne/:idLigne/:idVariante/:numLigne',
      name: 'ArretFromLigneView',
      component: ArretFromLigne,
      props: true,
      meta: { 
        title: 'Arrêts de la ligne — Ginku',
        description: 'Liste des arrêts et horaires de cette ligne Ginko à Besançon.'
      },
    },
    {
      path: '/infos',
      name: 'InfosTrafic',
      component: InfosTrafic,
      meta: { 
        title: 'Infos trafic — Ginku',
        description: 'Consultez les informations de trafic en temps réel du réseau Ginko à Besançon : perturbations, incidents et messages importants.'
      },
    },
    {
      path: '/infos-transport/:id',
      name: 'InfosTransportPage',
      component: InfosTransport,
      meta: { 
        title: 'Info transport — Ginku',
        description: 'Détails d\'une information de transport du réseau Ginko à Besançon.'
      },
    },
    {
      path: '/message/:idLigne',
      name: 'MessagePage',
      component: Message,
      props: true,
      meta: { 
        title: 'Messages ligne — Ginku',
        description: 'Messages et informations spécifiques à cette ligne Ginko.'
      },
    }
  ],
})

const DEFAULT_TITLE = 'Ginku — Horaires bus et tram en temps réel à Besançon'
const DEFAULT_DESCRIPTION = 'Consultez les horaires de bus et tramway Ginko en temps réel à Besançon et dans le Grand Besançon. Lignes, arrêts, favoris et infos trafic, tout en un clic.'

// Fonction pour mettre à jour une balise meta
function updateMetaTag(name, content, isProperty = false) {
  const attr = isProperty ? 'property' : 'name'
  let element = document.querySelector(`meta[${attr}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, name)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

router.beforeEach((to) => {
  let title = to.meta.title || DEFAULT_TITLE
  let description = to.meta.description || DEFAULT_DESCRIPTION
  let url = `https://ginku.diogo-andrade.org${to.path}`

  // Mettre à jour les titres dynamiques avec les params de la route
  if (to.name === 'ArretNomView' && to.params.nom) {
    title = `Arrêt ${decodeURIComponent(to.params.nom)} — Ginku`
    description = `Horaires en temps réel de l'arrêt ${decodeURIComponent(to.params.nom)} du réseau Ginko à Besançon.`
  }
  if (to.name === 'ArretFromLigneView' && to.params.numLigne) {
    title = `Ligne ${to.params.numLigne} — Arrêts — Ginku`
    description = `Liste des arrêts et horaires de la ligne ${to.params.numLigne} du réseau Ginko à Besançon.`
  }

  // Mettre à jour le titre de la page
  document.title = title

  // Mettre à jour les meta tags
  updateMetaTag('description', description)
  updateMetaTag('og:title', title, true)
  updateMetaTag('og:description', description, true)
  updateMetaTag('og:url', url, true)
  updateMetaTag('twitter:title', title)
  updateMetaTag('twitter:description', description)

  // Mettre à jour la balise canonical
  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', url)
})

router.afterEach(() => {
  nextTick(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    const h1 = main.querySelector('h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus()
    } else {
      main.focus()
    }
  })
})

export default router
