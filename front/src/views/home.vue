<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import api from '@/api'
import Perturbation from '@/components/perturbation.vue'

defineOptions({ name: 'HomePage' })

const arrets = ref([])
const searchTerm = ref('')
const showDropdown = ref(false)
const wrapperRef = ref(null)

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  try {
    const response = await api.get('/search')
    if (Array.isArray(response.data)) {
      arrets.value = response.data.filter((obj) => obj && typeof obj.nom === 'string' && obj.id)
    } else {
      console.error('Erreur lors de la récupération des arrêts:', response.data?.message)
      arrets.value = []
    }
  } catch (error) {
    console.error('Erreur lors de la requête:', error)
    arrets.value = []
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Liste des noms d'arrêts uniques filtrés (protection contre objets mal formés)
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const filteredUniqueNomArrets = computed(() => {
  const term = normalize(searchTerm.value.trim())
  if (!term) return []
  const seen = new Set()
  const uniqueNoms = []

  arrets.value.forEach((arret) => {
    if (!arret || typeof arret.nom !== 'string') return
    const nomOriginal = arret.nom
    const nom = normalize(nomOriginal)
    if (!nom.includes(term) || seen.has(nom)) return
    seen.add(nom)
    uniqueNoms.push(nomOriginal)
  })

  return uniqueNoms
})

watch(searchTerm, () => {
  showDropdown.value =
    searchTerm.value.trim().length > 0 && filteredUniqueNomArrets.value.length > 0
})
</script>

<template>
  <div
    class="flex items-center justify-start flex-col min-h-full w-full py-8 bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text"
  >
    <h1 class="sr-only">Accueil</h1>
    <div ref="wrapperRef" class="relative w-80" role="search">
      <label for="searchInput" class="sr-only">Rechercher un arrêt</label>
      <div
        class="flex items-center rounded-full border border-light-accent dark:border-dark-accent bg-light-secondary dark:bg-dark-secondary focus-within:ring-2 focus-within:ring-light-primary dark:focus-within:ring-dark-primary"
      >
        <span class="pl-3 pr-2 text-light-primary dark:text-dark-primary" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input
          id="searchInput"
          v-model="searchTerm"
          @focus="showDropdown = filteredUniqueNomArrets.length > 0"
          @input="showDropdown = filteredUniqueNomArrets.length > 0"
          type="text"
          placeholder="Rechercher un arrêt"
          class="flex-1 bg-transparent py-2 pr-4 text-light-text dark:text-dark-text placeholder-light-text dark:placeholder-dark-text focus:outline-none"
          autocomplete="off"
          autofocus
          aria-label="Rechercher un arrêt"
        />
      </div>
      <!-- Dropdown menu -->
      <ul
        v-show="showDropdown"
        class="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto bg-light-bg dark:bg-dark-secondary text-light-text dark:text-dark-text shadow-lg rounded-lg border border-light-accent dark:border-dark-accent"
      >
        <li
          v-for="nom in filteredUniqueNomArrets"
          :key="nom"
          class="cursor-pointer px-4 py-2 hover:bg-light-accent dark:hover:bg-dark-accent text-light-text dark:text-dark-text"
        >
          <router-link
            :to="{
              name: 'ArretNomView',
              params: { nom: nom },
            }"
            class="block w-full"
            @click="showDropdown = false"
          >
            {{ nom }}
          </router-link>
        </li>
      </ul>
    </div>
    <router-link
      to="/lignes"
      class="text-left text-light-primary dark:text-dark-primary mt-4 underline w-80 mb-5"
    >
      Afficher toutes les lignes
    </router-link>

    <Perturbation />
  </div>
</template>
