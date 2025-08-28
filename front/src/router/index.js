import Arret from '@/views/arret.vue'
import ArretFromLigne from '@/views/arretFromLigne.vue'
import Home from '@/views/home.vue'
import InfosTransport from '@/views/infos-transport.vue'
import Lignes from '@/views/lignes.vue'
import Message from '@/views/message.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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

export default router
