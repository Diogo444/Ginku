<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

defineOptions({ name: 'PerturbationView' })

const raw = ref([])
const isLoading = ref(true)
const errorMsg = ref('')

const etat = (code) => {
  switch (code) {
    case 0:
      return "pas d'info sur l'état."
    case 1:
      return 'La ligne fonctionne normalement (aucune perturbation en cours ni prévue)'
    case 2:
      return 'Il y a une information concernant la ligne (nouveauté, évolution)'
    case 3:
      return 'La ligne ne fonctionne pas en ce moment, selon sa période de fonctionnement'
    case 4:
      return 'Une perturbation est prévue dans le futur'
    case 5:
      return 'Une perturbation est en cours'
    case 6:
      return 'La circulation de la ligne est interrompue (totalement)'
  }
}

/** normalise un code hex en '#RRGGBB' même si 'fff' ou 'ffffff' (majuscules/minuscules) */
function toHexColor(v, fallback = '#000000') {
  if (!v) return fallback
  const s = String(v).replace('#', '').trim()
  if (!/^[0-9a-fA-F]+$/.test(s)) return fallback
  const hex =
    s.length === 3
      ? s
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : s.padEnd(6, '0').slice(0, 6)
  return `#${hex.toUpperCase()}`
}

const items = computed(() =>
  (Array.isArray(raw.value) ? raw.value : []).map((d, i) => ({
    id: d.idLigne ?? d.id ?? i,
    label: d.numLignePublic ?? '',
    bg: toHexColor(d.couleurFond, '#222222'),
    fg: toHexColor(d.couleurTexte, '#FFFFFF'),
    etat: d.etat ?? null,
  })),
)

onMounted(async () => {
  try {
    const { data } = await api.get('/etatLignes')
    raw.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    errorMsg.value = 'Impossible de récupérer les perturbations.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-screen-2xl p-4">
    <h1
      class="mb-8 text-center text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary"
    >
      Lignes perturbées
    </h1>

    <!-- états de chargement / erreur -->
    <p v-if="isLoading" class="text-center opacity-70">Chargement…</p>
    <p v-else-if="errorMsg" class="text-center text-red-500">{{ errorMsg }}</p>
    <p v-else-if="!items.length" class="text-center opacity-70">Aucune donnée.</p>

    <!-- grille -->
    <div
      v-else
      aria-label="Liste des lignes perturbées"
      class="flex flex-wrap gap-3 justify-center"
    >
      <div v-for="p in items" :key="p.id" class="group relative">
        <div
          :aria-label="etat(p.etat)"
          class="w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-md hover:shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 border border-white/10"
          :style="{ backgroundColor: p.bg, color: p.fg }"
          :title="p.label"
        >
          <span class="font-bold text-xs sm:text-sm leading-none text-center">
            {{ p.label }}
          </span>
        </div>
        <img class="absolute z-10 bottom-0 right-0" src="/svg/check.svg" :alt="etat(p.etat)" />
      </div>
    </div>
  </div>
</template>
