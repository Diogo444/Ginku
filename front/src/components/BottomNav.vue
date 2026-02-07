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
  <nav class="fixed bottom-0 w-full bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-safe z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]" aria-label="Navigation principale">
    <div class="flex w-full">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.route"
        :class="[
          'flex flex-col items-center gap-1.5 group transition-colors justify-center py-3 flex-1 basis-0 min-h-[56px]',
          isActive(item) 
            ? 'text-primary' 
            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        ]"
        role="link"
        :aria-current="isActive(item) ? 'page' : undefined"
        :aria-label="item.name"
      >
        <div class="relative">
          <span class="material-icons-round text-2xl group-hover:scale-110 transition-transform" aria-hidden="true">
            {{ isActive(item) ? item.icon : item.iconInactive }}
          </span>
          <span 
            v-if="isActive(item)" 
            class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
            aria-hidden="true"
          ></span>
        </div>
        <span :class="['text-[10px]', isActive(item) ? 'font-bold' : 'font-medium']" aria-hidden="true">
          {{ item.name }}
        </span>
      </router-link>
    </div>
  </nav>
</template>
