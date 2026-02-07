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
      meta: { title: 'Ginku — Horaires bus et tram en temps réel à Besançon' },
    },
    {
      path: '/lignes',
      name: 'lignes',
      component: Lignes,
      meta: { title: 'Toutes les lignes — Ginku' },
    },
    {
      path: '/arret/:nom',
      name: 'ArretNomView',
      component: Arret,
      meta: { title: 'Arrêt — Ginku' },
    },
    {
      path: '/arretFromLigne/:idLigne/:idVariante/:numLigne',
      name: 'ArretFromLigneView',
      component: ArretFromLigne,
      props: true,
      meta: { title: 'Arrêts de la ligne — Ginku' },
    },
    {
      path: '/infos',
      name: 'InfosTrafic',
      component: InfosTrafic,
      meta: { title: 'Infos trafic — Ginku' },
    },
    {
      path: '/infos-transport/:id',
      name: 'InfosTransportPage',
      component: InfosTransport,
      meta: { title: 'Info transport — Ginku' },
    },
    {
      path: '/message/:idLigne',
      name: 'MessagePage',
      component: Message,
      props: true,
      meta: { title: 'Messages ligne — Ginku' },
    }
  ],
})

const DEFAULT_TITLE = 'Ginku — Horaires bus et tram en temps réel à Besançon'

router.beforeEach((to) => {
  document.title = to.meta.title || DEFAULT_TITLE

  // Mettre à jour les titres dynamiques avec les params de la route
  if (to.name === 'ArretNomView' && to.params.nom) {
    document.title = `Arrêt ${to.params.nom} — Ginku`
  }
  if (to.name === 'ArretFromLigneView' && to.params.numLigne) {
    document.title = `Ligne ${to.params.numLigne} — Arrêts — Ginku`
  }

  // Mettre à jour la balise canonical
  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', `https://ginku.diogo-andrade.org${to.path}`)
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
