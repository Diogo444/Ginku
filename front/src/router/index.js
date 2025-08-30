import Arret from '@/views/arret.vue'
import ArretFromLigne from '@/views/arretFromLigne.vue'
import Home from '@/views/home.vue'
import InfosTransport from '@/views/infos-transport.vue'
import Lignes from '@/views/lignes.vue'
import Message from '@/views/message.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'

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
    },
    {
      path: '/lignes',
      name: 'lignes',
      component: Lignes,
    },
    {
      path: '/arret/:nom',
      name: 'ArretNomView',
      component: Arret,
    },
    {
      path: '/arretFromLigne/:idLigne/:idVariante/:numLigne',
      name: 'ArretFromLigneView',
      component: ArretFromLigne,
      props: true, // active automatiquement le passage en props
    },

    {
      path: '/infos-transport/:id',
      name: 'InfosTransportPage',
      component: InfosTransport,
    },
    {
      path: '/message/:idLigne',
      name: 'MessagePage',
      component: Message,
      props: true,
    }
  ],
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
