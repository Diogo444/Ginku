<script setup>
import { useRouter } from 'vue-router'

defineOptions({ name: 'BackButton' })

const router = useRouter()

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<template>
  <button 
    @click="goBack"
    class="w-10 h-10 -ml-2 rounded-full bg-transparent flex items-center justify-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    aria-label="Retour"
  >
    <span class="material-icons-round text-2xl">arrow_back</span>
  </button>
</template>
