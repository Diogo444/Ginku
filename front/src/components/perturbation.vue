<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

defineOptions({ name: 'PerturbationView' })

const perturbations = ref([])
const isLoading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  try {
    const { data } = await api.get('/etatLignes')
    // Sécurise/normalise les champs attendus
    perturbations.value = Array.isArray(data)
      ? data.map((d, i) => ({
          id: d.id ?? d.idLigne ?? i,
          num: d.numLignePublic ?? '',
          etat: d.etat ?? null,
        }))
      : []
  } catch (e) {
    errorMsg.value = 'Impossible de récupérer les perturbations.'
    console.error(e)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <!-- CONTAINER : max-w sm en mobile, xl puis 2xl/3xl sur grands écrans -->
  <div class="mx-auto w-full max-w-sm md:max-w-xl xl:max-w-2xl 2xl:max-w-3xl p-4">
    <h1
      class="mb-6 text-center text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary"
    >
      Lignes perturbées
    </h1>

    <!-- états de chargement/erreur -->
    <div v-if="isLoading" class="py-10 text-center opacity-70">Chargement…</div>
    <div v-else-if="errorMsg" class="py-10 text-center text-red-600">{{ errorMsg }}</div>
    <div v-else-if="!perturbations.length" class="py-10 text-center opacity-70">
      Aucune perturbation.
    </div>

    <!-- GRILLE AUTO-FIT RÉACTIVE -->
    <ul
      v-else
      aria-label="Liste des lignes perturbées"
      class="grid gap-3 grid-cols-[repeat(auto-fit,minmax(72px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(88px,1fr))] md:grid-cols-[repeat(auto-fit,minmax(104px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]"
    >
      <li v-for="p in perturbations" :key="p.id">
        <div
          class="aspect-square rounded-xl border border-red-300 bg-red-100 shadow flex items-center justify-center p-2 text-red-700"
        >
          <div class="text-center leading-tight">
            <div class="font-semibold break-words text-sm md:text-base text-balance line-clamp-2">
              {{ p.num }}
            </div>
            <div v-if="p.etat !== null" class="text-[11px] opacity-70">
              {{ p.etat }}
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
