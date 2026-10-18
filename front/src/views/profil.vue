<script setup>
import BackButton from '@/components/BackButton.vue'
import ProfileIdentity from '@/components/ProfileIdentity.vue'
import ContrastSetting from '@/components/ContrastSetting.vue'
import { isDark, setTheme } from '@/stores/theme'

defineOptions({ name: 'ProfilPage' })
</script>

<template>
  <div class="flex flex-col min-h-full w-full">
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <BackButton class="min-w-11 min-h-11" />
        <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Mon profil</h1>
      </div>
    </header>

    <div class="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-7">
      <ProfileIdentity />

      <section aria-labelledby="preferences-title" class="space-y-3">
        <div>
          <h2 id="preferences-title" class="text-base font-semibold text-gray-900 dark:text-white">Vos préférences</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Ginku, à votre façon.</p>
        </div>

        <div class="rounded-2xl bg-surface-light dark:bg-surface-dark p-4 sm:p-5 shadow-soft border border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <span class="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
              <span class="material-icons-round text-xl">palette</span>
            </span>
            <label for="profile-theme" class="flex-1 min-w-0 font-semibold text-sm text-gray-900 dark:text-white">Thème</label>
            <select
              id="profile-theme"
              :value="isDark ? 'dark' : 'light'"
              class="w-28 shrink-0 min-h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              @change="setTheme($event.target.value)"
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
          
        </div>

        <ContrastSetting />
      </section>
    </div>
  </div>
</template>
