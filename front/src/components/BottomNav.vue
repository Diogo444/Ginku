<script setup>
import { useRoute } from 'vue-router'

defineOptions({ name: 'BottomNav' })

const route = useRoute()

const navItems = [
  { name: 'Favoris', icon: 'star', iconInactive: 'star_border', route: '/' },
  { name: 'Lignes', icon: 'directions_bus', iconInactive: 'directions_bus', route: '/lignes' },
  { name: 'Infos', icon: 'info', iconInactive: 'info', route: '/infos' },
]

const isActive = (item) => {
  if (item.route === '/') return route.path === '/'
  return route.path.startsWith(item.route)
}
</script>

<template>
  <nav class="bottom-nav fixed inset-x-0 bottom-0 bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 z-[90] shadow-[0_-5px_15px_rgba(0,0,0,0.02)]" aria-label="Navigation principale">
    <router-link
      v-for="item in navItems"
      :key="item.name"
      :to="item.route"
      :class="[
        'bottom-nav-item group transition-colors',
        isActive(item) 
          ? 'text-primary' 
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
      ]"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <span class="material-icons-round text-2xl group-hover:scale-110 transition-transform" aria-hidden="true">
        {{ isActive(item) ? item.icon : item.iconInactive }}
      </span>
      <span :class="['text-[10px] leading-none', isActive(item) ? 'font-bold' : 'font-medium']">
        {{ item.name }}
      </span>
    </router-link>
  </nav>
</template>
